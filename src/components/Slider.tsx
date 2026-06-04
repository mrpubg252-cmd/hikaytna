import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Play, Settings, Search, Check, X, Film, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Series, db } from '../services/firebase';
import { ref, set } from 'firebase/database';
import { sliderSelections, syncSliderSelections } from '../services/api';

interface SliderShadowVideoProps {
  src: string;
  isMuted: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onError: () => void;
  onPlaying?: () => void;
  onMuteRequired?: () => void;
}

const SliderShadowVideo: React.FC<SliderShadowVideoProps> = ({
  src,
  isMuted,
  videoRef,
  onEnded,
  onError,
  onPlaying,
  onMuteRequired
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  React.useLayoutEffect(() => {
    if (!hostRef.current) return;

    hostRef.current.innerHTML = '';
    const shadowRoot = hostRef.current.attachShadow({ mode: 'closed' });

    const video = document.createElement('video');
    video.preload = 'auto';
    video.tabIndex = -1;
    video.controls = false;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;
    video.autoplay = true;
    video.loop = false;
    video.muted = isMuted;

    video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    (video as any).disablePictureInPicture = true;
    (video as any).disableRemotePlayback = true;

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true');
    video.setAttribute('x5-video-player-type', 'h5-page');
    video.setAttribute('x5-video-player-fullscreen', 'false');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.setAttribute('aria-hidden', 'true');

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.pointerEvents = 'none';

    video.src = src;

    shadowRoot.appendChild(video);
    videoElementRef.current = video;

    if (videoRef) {
      (videoRef as any).current = video;
    }

    const handleEnded = () => onEnded();
    const handleError = () => onError();
    const handlePlaying = () => {
      if (onPlaying) onPlaying();
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('playing', handlePlaying);

    video.play().catch((err) => {
      console.warn("[Shadow Video Autoplay Blocked] Falling back to muted play:", err.message);
      video.muted = true;
      if (onMuteRequired) {
        onMuteRequired();
      }
      video.play().catch(() => {});
    });

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('playing', handlePlaying);
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (err) {}
      if (videoRef) {
        (videoRef as any).current = null;
      }
    };
  }, [src, videoRef]);

  useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return <div ref={hostRef} className="w-full h-full" />;
};

const getYoutubeEmbedUrl = (url: string) => {
  if (!url) return '';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    let videoId = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1`;
    }
  }
  return '';
};

interface SliderProps {
  series: Series[];
  isAdmin?: boolean;
  allSeriesForManager?: Series[];
}

export default function Slider({ series, isAdmin = false, allSeriesForManager = [] }: SliderProps) {
  const [index, setIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [ytLoaded, setYtLoaded] = useState(false); // Clean track of YouTube iframe initial buffer
  const [isMuted, setIsMuted] = useState(true); // Default to muted to guarantee instant compatible autoplay on all mobile/desktop browsers
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(true);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // List of all series with sliderSelected state overlayed
  const managerSeriesList = useMemo(() => {
    if (!allSeriesForManager) return [];
    
    return allSeriesForManager.filter((s: Series) => {
      if (!s || !s.id) return false;
      if (!managerSearch) return true;
      const q = managerSearch.toLowerCase().trim();
      return (s.title || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q);
    });
  }, [allSeriesForManager, managerSearch]);

  const selectedInSlider = useMemo(() => {
    if (!allSeriesForManager) return [];
    return allSeriesForManager.filter(s => s && s.id && sliderSelections && sliderSelections[s.id]?.selected === true);
  }, [allSeriesForManager, sliderSelections]);

  const handleToggleSliderSelect = async (seriesItem: Series) => {
    setSavingId(seriesItem.id);
    const currentlySelected = sliderSelections[seriesItem.id]?.selected === true;
    const nextState = !currentlySelected;

    const selectData = nextState ? {
      selected: true,
      seriesId: seriesItem.id,
      title: seriesItem.title,
      category: seriesItem.category || '',
      selectedAt: Date.now()
    } : null;

    try {
      // 1. Save to custom node backend server (100% reliable)
      const res = await fetch(`/api/v1/slider-selections/${seriesItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectData || { selected: false })
      });
      const resData = await res.json();

      // Refresh memory cache in front-end
      await syncSliderSelections();

      // 2. Commit safely to RTDB
      try {
        const sliderItemRef = ref(db, `slider_selections/${seriesItem.id}`);
        await set(sliderItemRef, selectData);
      } catch (fbErr: any) {
        console.warn("RTDB Slider sync restricted (using backend local persistence):", fbErr.message);
      }
    } catch (err: any) {
      console.error("Failed to update slider selections:", err);
    } finally {
      setSavingId(null);
    }
  };

  // Bind activeSeries directly to the provided series (up to 8 for performance/safety fallback)
  const activeSeries = useMemo(() => series.slice(0, 8), [series]);

  // Safely bound index if active series changes/shrinks
  useEffect(() => {
    if (activeSeries.length === 0) {
      setIndex(0);
    } else if (index >= activeSeries.length) {
      setIndex(0);
    }
  }, [activeSeries.length, index]);

  const current = useMemo(() => activeSeries[index] || null, [activeSeries, index]);

  // Derived state to instantly reset video and active playback state BEFORE render phase commits.
  // This guarantees that the very first frame of a new slide is ALWAYS the gorgeous high-res background poster,
  // preventing any black screen flashes or video leaking from the previous slide.
  const currentId = current?.id || null;
  const [prevId, setPrevId] = useState<string | null>(null);

  if (currentId !== prevId) {
    setPrevId(currentId);
    setShowVideo(false);
    setIsVideoActive(false);
    setYtLoaded(false); // Reset YouTube loaded state
    setIsTrailerPlaying(true);
  }

  // Strict transition reset: whenever active slide ID shifts, reset video states instantly to show background image first!
  useEffect(() => {
    setShowVideo(false);
    setIsVideoActive(false);
    setYtLoaded(false); // Reset YouTube loaded state
    setIsTrailerPlaying(true);
  }, [currentId]);

  const nextSlide = () => {
    if (activeSeries.length === 0) return;
    setIndex((prev) => (prev + 1) % activeSeries.length);
  };

  const handleSliderClick = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    const video = videoRef.current;
    if (video) {
      video.muted = newMuted;
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
    setIsTrailerPlaying(true);
  };

  useEffect(() => {
    if (activeSeries.length === 0 || !current) return;
    
    // If there's a trailer, start loading the video context instantly
    if (current?.trailer) {
      setShowVideo(true);

      // Safety Watchdog: Auto-advance after 30 seconds so it never hangs
      const watchdog = setTimeout(() => {
        nextSlide();
      }, 30000);

      return () => {
        clearTimeout(watchdog);
      };
    } else {
      // Fallback: if no trailer, move to next slide after 5s
      const timer = setTimeout(nextSlide, 5000);
      return () => clearTimeout(timer);
    }
  }, [index, activeSeries, current?.id]);

  // Synchronize dynamic user volume interaction back to both the direct HTML5 video element AND the YouTube iframe API
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }

    // Sync mute state specifically to YouTube Iframe via postMessage
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        const message = JSON.stringify({
          event: 'command',
          func: isMuted ? 'mute' : 'unMute'
        });
        iframe.contentWindow?.postMessage(message, '*');
      } catch (e) {
        console.warn("Failed to post volume balance to YouTube iframe:", e);
      }
    }
  }, [isMuted, showVideo, index]);

  useEffect(() => {
    if (!showVideo || !current?.trailer) return;
    
    const youtubeUrl = getYoutubeEmbedUrl(current.trailer);
    if (youtubeUrl) {
      if (ytLoaded) {
        // Safe 1.5s visual poster delay to let video stream decode completely before fading
        const showTimer = setTimeout(() => {
          setIsVideoActive(true);
        }, 1500);
        return () => clearTimeout(showTimer);
      } else {
        // Fallback watchdog: force video active after 3.2s if onLoad took too long
        const watchTimer = setTimeout(() => {
          setIsVideoActive(true);
        }, 3200);
        return () => clearTimeout(watchTimer);
      }
    }
  }, [showVideo, current?.trailer, ytLoaded]);

  // Clean up HTML5 video elements & release GPU/RAM instantly upon component unmounting
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.src = '';
          video.load();
        } catch (e) {
          console.warn("Slider unmount video release error", e);
        }
      }
    };
  }, []);

  if (activeSeries.length === 0 || !current) return null;

  const youtubeUrl = getYoutubeEmbedUrl(current?.trailer || '');
  const isDirect = current?.trailer ? (
    current.trailer.toLowerCase().includes('.mp4') ||
    current.trailer.toLowerCase().includes('.m3u8') ||
    current.trailer.toLowerCase().includes('.webm') ||
    current.trailer.toLowerCase().includes('.ogg')
  ) : false;

  return (
    <div 
      className="relative w-full h-[60vh] sm:h-[80vh] overflow-hidden bg-black cursor-pointer group/slider"
      onClick={handleSliderClick}
    >
      <AnimatePresence>
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 will-change-opacity"
        >
          {/* Background Image - Always there, but fades out when video starts */}
          <motion.img 
            src={current.image} 
            alt={current.title}
            loading="eager"
            decoding="async"
            animate={{ opacity: isVideoActive ? 0.2 : 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover will-change-opacity"
            onError={(e) => {
              const currentSrc = e.currentTarget.src;
              if (currentSrc.includes('/api/v1/image-proxy?url=')) {
                try {
                  const urlPart = currentSrc.split('url=')[1];
                  if (urlPart) {
                    e.currentTarget.src = decodeURIComponent(urlPart);
                    return;
                  }
                } catch(err) {}
              }
              e.currentTarget.src = 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
            }}
          />

          {/* Video Trailer */}
          {showVideo && current?.trailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isVideoActive ? 1 : 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 overflow-hidden bg-black"
            >
              {youtubeUrl ? (
                <iframe
                  ref={iframeRef}
                  src={youtubeUrl}
                  onLoad={() => {
                    setYtLoaded(true);
                  }}
                  className="w-full h-full object-cover scale-[1.35] pointer-events-none border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    backgroundColor: 'black'
                  }}
                />
              ) : isDirect ? (
                <SliderShadowVideo
                  src={current.trailer || ''}
                  isMuted={isMuted}
                  videoRef={videoRef}
                  onEnded={nextSlide}
                  onPlaying={() => setIsVideoActive(true)}
                  onMuteRequired={() => setIsMuted(true)}
                  onError={() => {
                    console.error("Video failed to load, moving to next slide");
                    nextSlide();
                  }}
                />
              ) : null}
              {/* Transparent Click Shield covering the raw video element from TV browser curation/detection */}
              <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto cursor-default" />
            </motion.div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent" />
          
          {/* Central Elegant Interaction Overlay */}
          {showVideo && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <AnimatePresence>
                {isMuted ? (
                  // Muted Sticker Banner - optimized for ultra-smooth 60 FPS on weak processors & Smart TVs
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-zinc-950/98 border border-white/10 px-5 py-3.5 rounded-2xl flex flex-col items-center gap-2 shadow-2xl animate-pulse text-center max-w-xs sm:max-w-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                      <VolumeX className="w-5 h-5 animate-bounce" />
                    </div>
                    <span className="text-white text-xs font-black">التريلر بدون صوت 🔇</span>
                    <span className="text-zinc-400 text-[10px] font-bold">اضغط في أي مكان على الشاشة للتشغيل بالصوت 🔊</span>
                  </motion.div>
                ) : !isTrailerPlaying ? (
                  // Unmuted but Paused feedback
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="w-14 h-14 bg-zinc-950/98 border border-white/10 rounded-full flex items-center justify-center text-white shadow-xl"
                  >
                    <Play className="w-6 h-6 text-primary fill-primary ml-1" />
                  </motion.div>
                ) : (
                  // Temporary unmuted state flash indicator (fades out in 1s)
                  <motion.div 
                    initial={{ scale: 1.1, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="w-14 h-14 bg-zinc-950/98 border border-white/10 rounded-full flex items-center justify-center text-white shadow-xl"
                  >
                    <Volume2 className="w-6 h-6 text-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-20 right-4 left-4 sm:right-12 sm:left-auto max-w-4xl text-right z-20 pointer-events-none">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-end gap-2 mb-2 sm:mb-4"
        >
          <span className="bg-primary px-2 sm:px-3 py-1 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white shadow-lg">حصرياً</span>
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-[100px] font-black-italic leading-[0.9] sm:leading-[0.8] text-white uppercase mb-4 sm:mb-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          {current.title}
        </motion.h1>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-end gap-3 sm:gap-6 mb-6 sm:mb-8 text-xs sm:text-sm font-semibold"
        >
          <span className="text-zinc-300 tracking-widest uppercase text-[10px] sm:text-sm truncate max-w-[100px] sm:max-w-none">{current.category || 'GENERAL'}</span>
          <span className="text-zinc-500">|</span>
          <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] border border-white/10 font-black">HD</span>
        </motion.div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-end gap-2 sm:gap-4 pointer-events-auto"
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate('/watch', { state: { series: current } });
            }}
            className="flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-4 bg-white text-black font-black text-[10px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.2em] rounded-full hover:scale-105 transition-transform shadow-xl shadow-white/5"
          >
            مشاهدة الآن
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate('/chat');
            }}
            className="flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-4 bg-zinc-850/95 text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.2em] rounded-full border border-white/10 hover:bg-zinc-700 transition-colors shadow-xl"
          >
            المجلس العام
          </button>
        </motion.div>
      </div>


      
      <div className="absolute bottom-8 right-1/2 translate-x-1/2 flex gap-2 z-20">
        {activeSeries.map((_, i) => (
          <div 
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-8 bg-primary shadow-[0_0_10px_#E50914]' : 'w-2 bg-white/30'}`}
          />
        ))}
      </div>

      {/* Dynamic Admin Settings Button */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsManagerOpen(true);
          }}
          className="absolute top-24 w-10 h-10 left-4 sm:left-12 z-40 bg-black/70 hover:bg-black border border-white/15 text-white rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 active:scale-95 cursor-pointer hover:border-primary"
          title="ترتيب وإعداد السلايدر"
        >
          <Settings className="w-5 h-5 text-primary" />
        </button>
      )}

      {/* Dynamic Slider Management Modal (Admin Only) */}
      <AnimatePresence>
        {isManagerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsManagerOpen(false);
            }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 cursor-default"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-zinc-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/40">
                <button
                  onClick={() => setIsManagerOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-right">
                  <h2 className="text-xl font-black text-white">إعداد محتوى السلايدر الخاص بك</h2>
                  <Settings className="w-5 h-5 text-primary" />
                </div>
              </div>

              {/* Top Section: Active slider selection summary */}
              <div className="px-6 py-4 bg-zinc-900/20 border-b border-zinc-900 text-right">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-2">المسلسلات النشطة بالسلايدر حالياً</span>
                <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                  {selectedInSlider.length === 0 ? (
                    <span className="text-xs text-zinc-500 italic block w-full text-center">لا يوجد مسلسلات محددة. سيتم عرض المسلسلات المميزة تلقائياً.</span>
                  ) : (
                    selectedInSlider.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-xs font-black">
                        <button
                          onClick={() => handleToggleSliderSelect(s)}
                          disabled={savingId === s.id}
                          className="hover:text-white transition-colors ml-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                        <span>{s.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/10">
                <div className="relative">
                  <input
                    type="text"
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    placeholder="ابحث عن مسلسل لإضافته إلى السلايدر..."
                    className="w-full bg-zinc-900/80 border border-zinc-800 text-white rounded-xl py-3 px-4 pr-10 text-right focus:outline-none focus:border-primary/50 text-xs placeholder:text-zinc-500 font-bold"
                  />
                  <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-3.5" />
                </div>
              </div>

              {/* Series Listing */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[40vh]">
                {managerSeriesList.length === 0 ? (
                  <p className="text-center text-zinc-600 py-10 text-sm">لم يتم العثور على أي نتائج مطابقة للبحث.</p>
                ) : (
                  managerSeriesList.slice(0, 100).map((s: Series) => {
                    const isSelected = sliderSelections[s.id]?.selected === true;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 border border-zinc-900/50 hover:bg-zinc-900 transition-colors"
                      >
                        {/* Selector checkbox */}
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleToggleSliderSelect(s)}
                            disabled={savingId === s.id}
                            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 ${
                              isSelected
                                ? 'bg-primary text-white shadow-[0_0_10px_rgba(229,9,20,0.3)] hover:bg-primary/90'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            {savingId === s.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>محدد</span>
                              </>
                            ) : (
                              <span>إضافة</span>
                            )}
                          </button>
                        </div>

                        {/* Series Details info */}
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <h4 className="text-xs font-black text-white">{s.title}</h4>
                            <span className="text-[10px] text-zinc-500 font-bold mt-1 block">{s.category}</span>
                          </div>
                          <img
                            src={s.image}
                            alt=""
                            className="w-10 h-10 object-cover rounded-lg border border-zinc-800"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
