import React, { useRef, useEffect, memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, MessageCircle, Share2, VolumeX, Volume2, Film, AlertCircle, Flame, Play, Pause, Music, Edit3, Trash2
} from 'lucide-react';

interface ShortCardProps {
  item: any;
  index: number;
  activeIndex: number;
  isMuted: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  viewsCount: number;
  likesCount: number;
  userLiked: boolean;
  floatingHearts: any[];
  showVolumeBadge: boolean;
  videoUrlOverride: string | null;
  videoRefs: React.MutableRefObject<Record<number, HTMLVideoElement | null>>;
  onTapGesture: (e: React.MouseEvent) => void;
  onLike: (e: React.MouseEvent) => void;
  onOpenComments: () => void;
  onShare: () => void;
  onDelete?: (id: string) => void;
  onEditTitle?: (id: string, title: string) => void;
  parseTimeToSeconds: (str: string, end?: boolean) => number;
  setIsLoading: (v: boolean) => void;
  setHasError: (v: boolean) => void;
  setShowPrompt: (v: boolean) => void;
  onSelectSeries?: (seriesName: string, episodeNum: string) => void;
}

const ShortCard = memo(({
  item,
  index,
  activeIndex,
  isMuted,
  isPlaying,
  isLoading,
  hasError,
  viewsCount,
  likesCount,
  userLiked,
  floatingHearts,
  showVolumeBadge,
  videoUrlOverride,
  videoRefs,
  onTapGesture,
  onLike,
  onOpenComments,
  onShare,
  onDelete,
  onEditTitle,
  parseTimeToSeconds,
  setIsLoading,
  setHasError,
  setShowPrompt,
  onSelectSeries
}: ShortCardProps) => {
  const isCurrent = index === activeIndex;
  const isAdjacent = Math.abs(index - activeIndex) <= 1;

  // Track video progress internally to paint accurate scrubber timeline
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);
  const [splashType, setSplashType] = useState<'play' | 'pause' | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const isFirstRender = useRef(true);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);
  const touchStartTime = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressActive.current = false;
    touchStartTime.current = Date.now();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    startX.current = clientX;
    startY.current = clientY;

    // Use a solid 550ms timing for long press trigger
    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      setShowTikTokModal(true);
    }, 550);
  };

  const handleMovePress = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = Math.abs(clientX - startX.current);
    const deltaY = Math.abs(clientY - startY.current);

    // Only cancel the long-press timer if the movement is significant (e.g., scrolling or deliberate dragging > 15 pixels)
    if (deltaX > 15 || deltaY > 15) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleEndPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPressActive.current && Date.now() - touchStartTime.current < 450) {
      onTapGesture(e as any);
    }
    isLongPressActive.current = false;
  };

  const selectPlaybackSpeed = (speed: number) => {
    const video = videoRefs.current[index];
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSpeedSubmenu(false);
    setShowTikTokModal(false);
  };

  const handleDownloadWithWatermark = async () => {
    const videoUrl = videoUrlOverride || item.videoUrl;
    const downloadName = `حكايتنا_${item.seriesName || 'شورت'}_${Date.now()}.mp4`;
    const proxyUrl = `/api/v1/download-proxy?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(downloadName)}`;
    
    // Using window.location.href to trigger the download proxy which sends attachment headers
    window.location.href = proxyUrl;
  };

  const myCreatedShorts = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('hek_my_shorts_ids') || '[]');
    } catch {
      return [];
    }
  }, []);

  const isOwner = !!(
    localStorage.getItem('comment_author_name') === item.author || 
    myCreatedShorts.includes(item.id)
  );
  const isAdmin = localStorage.getItem('short_admin_access') === 'true';

  // Auto reset ready state when current state changes
  useEffect(() => {
    if (!isCurrent) {
      setIsVideoReady(false);
    }
  }, [isCurrent]);

  // Sync playback state with isCurrent and isPlaying
  useEffect(() => {
    const video = videoRefs.current[index];
    if (!video) return;

    if (isCurrent && isPlaying) {
      // Ensure muted matches current state
      video.muted = isMuted;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Autoplay was prevented:", error);
        });
      }
    } else {
      video.pause();
    }
  }, [isCurrent, isPlaying, index, videoRefs, isMuted]);

  // Trigger splash on playing state change to match full-screen UX
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isCurrent) return;
    setSplashType(isPlaying ? 'play' : 'pause');
    const timer = setTimeout(() => {
      setSplashType(null);
    }, 600);
    return () => clearTimeout(timer);
  }, [isPlaying, isCurrent]);

  return (
    <div 
      className="w-full h-full flex-shrink-0 snap-start snap-always relative flex flex-col justify-end overflow-hidden bg-black"
    >
      {/* Main Video Tap Interaction Area */}
      <div 
        className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-pointer select-none z-10"
        onMouseDown={handleStartPress}
        onMouseMove={handleMovePress}
        onMouseUp={handleEndPress}
        onTouchStart={handleStartPress}
        onTouchMove={handleMovePress}
        onTouchEnd={handleEndPress}
      >
        {/* Top Gradient Overlay */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/90 via-black/45 to-transparent z-20 pointer-events-none" />
        
        {/* Bottom Gradient Overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-t from-black/95 via-black/55 to-transparent z-20 pointer-events-none" />

        {/* Ambient Blurred Background for Large Screen Aesthetics */}
        <img 
          src={item.thumbnail} 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-125 pointer-events-none hidden"
          alt=""
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
        
        {/* Live Video Feeder */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video 
            ref={el => { videoRefs.current[index] = el; }}
            src={isAdjacent ? (videoUrlOverride || item.videoUrl) : undefined} 
            className={`w-full h-full object-cover md:object-contain bg-black transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0'}`}
            loop
            playsInline
            autoPlay
            preload={isCurrent ? "auto" : (index === activeIndex + 1 ? "metadata" : "none")}
            muted={isMuted}
            disablePictureInPicture={true}
            disableRemotePlayback={true}
            controlsList="nodownload nofullscreen noremoteplayback"
            {...{
              "x5-playsinline": "true",
              "x5-video-player-type": "h5-page",
              "x5-video-player-fullscreen": "false",
              "webkit-playsinline": "true"
            }}
            onTimeUpdate={(e) => {
              if (!isCurrent) return;
              const video = e.currentTarget;
              setProgress(video.currentTime);
              if (video.currentTime > 0.1) {
                setIsVideoReady(true);
              }
              
              if (item.timeRange && !item.isAd) {
                const start = parseTimeToSeconds(item.timeRange);
                const end = parseTimeToSeconds(item.timeRange, true);
                if (end > start + 0.5 && video.currentTime >= end) {
                  video.currentTime = start;
                  video.play().catch(() => {});
                }
              }
            }}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 1);
            }}
            onEnded={() => {
              setShowPrompt(false);
              if (item.timeRange && !item.isAd) {
                const video = videoRefs.current[index];
                if (video) {
                  video.currentTime = parseTimeToSeconds(item.timeRange);
                  video.play().catch(() => {});
                }
              }
            }}
            onCanPlay={() => {
              setIsVideoReady(true);
            }}
            onWaiting={() => {}}
            onPlaying={() => {
              setIsVideoReady(true);
              if (isCurrent) setIsLoading(false);
            }}
            onStalled={() => {
              // Browser naturally handles recovery. Avoid aggressive hard-reloading.
            }}
            onError={() => {
              if (isCurrent) {
                setHasError(true);
                setIsLoading(false);
              }
            }}
          />
          {/* Elegant fallback cover image that fades out seamlessly only when video starts playing or is ready */}
          <img 
            src={item.thumbnail} 
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 pointer-events-none z-15 ${isVideoReady ? 'opacity-0' : 'opacity-100'}`}
            alt=""
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
          {/* Aesthetic Vignettes for Dark Cinematic Quality */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.45)_110%)] pointer-events-none z-10" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)] pointer-events-none z-10" />
        </div>

        {/* Juicy Double-click Heart Pops with Spring Physics */}
        <AnimatePresence>
          {floatingHearts.map(heart => (
            <motion.div
              key={heart.id}
              initial={{ scale: 0, opacity: 1, rotate: -15 }}
              animate={{ 
                scale: [0, 2, 1.3, 1.5], 
                opacity: [1, 1, 0.9, 0],
                y: [-30, -150],
                rotate: [heart.id % 2 === 0 ? -15 : 15, heart.id % 2 === 0 ? -35 : 35]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ 
                left: heart.x, 
                top: heart.y,
                position: 'absolute',
                transform: 'translate(-50%, -50%)'
              }}
              className="pointer-events-none z-[80] text-primary drop-shadow-[0_4px_20px_rgba(229,9,20,0.7)]"
            >
              <Heart className="w-20 h-20 fill-primary text-primary" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Central Play/Pause Tap Splashes */}
        <AnimatePresence>
          {splashType && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] bg-black/60 p-6 rounded-full pointer-events-none border border-white/10 shadow-2xl"
            >
              {splashType === 'play' ? (
                <Play className="w-10 h-10 text-white fill-white" />
              ) : (
                <Pause className="w-10 h-10 text-white fill-white" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaker Volume Indicator */}
        <AnimatePresence>
          {showVolumeBadge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-zinc-950/80 p-5 rounded-full pointer-events-none border border-white/10 shadow-lg"
            >
              {isMuted ? <VolumeX className="w-8 h-8 text-primary" /> : <Volume2 className="w-8 h-8 text-green-500" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Blurred thumbnail for smooth streaming load */}
      <img 
        src={item.thumbnail} 
        referrerPolicy="no-referrer"
        className={`absolute inset-0 w-full h-full object-cover filter blur-lg transition-opacity duration-500 z-0 ${!isCurrent || isLoading || !isPlaying ? 'opacity-40' : 'opacity-0'}`}
        alt="Thumbnail buffer"
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

      {/* Spinner for Wi-Fi waiting state */}
      {isCurrent && isLoading && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="w-14 h-14 border-4 border-white/5 border-t-primary rounded-full animate-spin shadow-xl" />
        </div>
      )}

      {/* Stream Failure / Geoblock Guard */}
      {isCurrent && hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 z-[120] gap-4 px-6 text-center pointer-events-none">
          <div className="p-4 bg-primary/10 rounded-full border border-primary/20 animate-pulse">
            <AlertCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-white text-sm font-black">عفواً، لم يتوفر البث المباشر للقطة</p>
            <p className="text-zinc-500 text-[10px] font-bold">جاري محاولة تشغيل سيرفر احتياطي سريع...</p>
          </div>
        </div>
      )}

      {/* Side Action Panel (TikTok Icons style with custom counters) */}
      <div className="absolute right-4 bottom-[100px] flex flex-col items-center gap-4 sm:gap-5 z-40 pointer-events-auto">
        {/* Dynamic Like Icon */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={onLike}
            className={`w-14 h-14 rounded-full transition-all duration-300 relative group shadow-2xl flex items-center justify-center ${
              userLiked 
                ? 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.6)] border border-[#E50914]' 
                : 'bg-black/40 backdrop-blur-md text-white border border-white/10 hover:bg-black/60'
            }`}
          >
            <Heart className={`w-6 h-6 ${userLiked ? 'fill-current' : ''}`} />
            {userLiked && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.6 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#E50914]/30 rounded-full blur-xl"
              />
            )}
          </motion.button>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {(likesCount || 0).toLocaleString()}
          </span>
        </div>

        {/* Comment Drawer Trigger */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={onOpenComments}
            className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 shadow-2xl hover:bg-black/60 transition-all cursor-pointer flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
          <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            تعليق
          </span>
        </div>

        {/* Copy Share Link */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={onShare}
            className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 shadow-2xl hover:bg-black/60 transition-all cursor-pointer flex items-center justify-center"
          >
            <Share2 className="w-6 h-6" />
          </motion.button>
          <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            مشاركة
          </span>
        </div>


        {/* Custom Edit Option for Owners or Admins */}
        {onEditTitle && (isOwner || isAdmin) && (
          <div className="flex flex-col items-center gap-1">
            <motion.button 
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); onEditTitle(item.id, item.title); }}
              className="w-14 h-14 bg-blue-500/10 backdrop-blur-md rounded-full text-blue-400 border border-blue-500/25 shadow-2xl hover:bg-blue-500/20 hover:text-blue-300 transition-all cursor-pointer flex items-center justify-center"
              title="تعديل تفاصيل اللقطة والوقت"
            >
              <Edit3 className="w-6 h-6" />
            </motion.button>
            <span className="text-[11px] font-black text-blue-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              تعديل
            </span>
          </div>
        )}

        {/* Custom Delete Option for Owners or Admins */}
        {onDelete && (isOwner || isAdmin) && (
          <div className="flex flex-col items-center gap-1">
            <motion.button 
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="w-14 h-14 bg-red-600/10 backdrop-blur-md rounded-full text-red-500 border border-red-500/25 shadow-2xl hover:bg-red-600/20 hover:text-red-400 transition-all cursor-pointer flex items-center justify-center"
              title="حذف هذه اللقطة"
            >
              <Trash2 className="w-6 h-6" />
            </motion.button>
            <span className="text-[11px] font-black text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              حذف
            </span>
          </div>
        )}
      </div>

      {/* Short Dynamic Metadata Info (Bottom-Right/Left Glass Block) */}
      <div className="absolute bottom-[28px] left-5 right-22 z-40 flex flex-col items-end gap-3 pointer-events-none select-none">
        
        {/* Real Series Cover, Name & Episode info floating card */}
        {!item.isAd && (item.seriesName || item.episodeNum) && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectSeries) {
                onSelectSeries(item.seriesName, item.episodeNum || '1');
              }
            }}
            className="flex items-center gap-3 bg-zinc-950/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl w-fit ml-auto pointer-events-auto cursor-pointer hover:bg-zinc-900/60 transition group active:scale-95"
            title="انقر لمشاهدة الحلقة الكاملة 🎬"
          >
            {/* Cover Image of the series */}
            <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 shadow-lg group-hover:border-primary/40 transition">
              <img 
                src={item.seriesImage || item.thumbnail} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                alt={item.seriesName}
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Series Text Meta Details */}
            <div className="flex flex-col items-end text-right justify-center">
              <h4 className="text-white text-[12px] sm:text-[13px] font-black tracking-tight drop-shadow-sm leading-tight text-right line-clamp-1">
                {item.seriesName}
              </h4>
              <div className="flex items-center gap-1.5 mt-1 pointer-events-none">
                <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-lg border border-primary/20 shadow-[0_2px_8px_rgba(229,9,20,0.3)] select-none">
                  الحلقة {item.episodeNum || '1'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sponsor/Ad Indicator Badge */}
        {item.isAd && (
          <div className="bg-amber-500/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/20 shadow-md text-[10px] font-black text-amber-500 ml-auto mr-4">
             إعلان ممول 🌟
          </div>
        )}

        {/* Fiery Series Name Display */}
        {!item.isAd && item.seriesName && (
          <div className="flex flex-col items-end gap-1 ml-auto text-right mb-0.5 select-none pointer-events-none mr-2">
            <div className="flex items-center gap-1">
              <span className="text-[12px] sm:text-[13px] font-extrabold bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(249,115,22,0.6)] uppercase tracking-tight">
                مشهد حصري من {item.seriesName}
              </span>
              <span className="text-[10px] text-yellow-400 animate-pulse">🔥</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-extrabold text-zinc-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              👁️ {(viewsCount || 0).toLocaleString()} مشاهدة بصرية
            </span>
          </div>
        )}

        {/* Title details */}
        <h2 className="text-white text-[14px] sm:text-[16px] font-black leading-relaxed drop-shadow-[0_4px_12px_rgba(0,0,0,1)] max-w-sm ml-auto mr-2 text-right [text-wrap:balance] tracking-tight">
          {item.title}
        </h2>
      </div>

      {/* TIKTOK STYLE LONG PRESS GLASS DRAWER */}
      <AnimatePresence>
        {showTikTokModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 shadow-inner backdrop-blur-md z-[500] flex items-end justify-center"
            onClick={() => {
              setShowTikTokModal(false);
              setShowSpeedSubmenu(false);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-zinc-950/95 border-t border-white/10 rounded-t-[2.5rem] p-6 pb-12 text-center text-white space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Handle drag indicator */}
              <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-2" />
              
              {!showSpeedSubmenu ? (
                <div className="flex flex-col gap-3">
                  <span className="text-zinc-400 text-[11px] font-black tracking-widest uppercase mb-1">
                    خيارات اللقطة السريعة
                  </span>
                  
                  {/* Download option (text only) */}
                  <button
                    onClick={() => {
                      handleDownloadWithWatermark();
                      setShowTikTokModal(false);
                    }}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-2xl text-sm font-extrabold transition cursor-pointer text-center text-white border border-white/[0.03]"
                  >
                    تنزيل
                  </button>

                  {/* Speed submenu trigger (text only) */}
                  <button
                    onClick={() => setShowSpeedSubmenu(true)}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-2xl text-sm font-extrabold transition cursor-pointer text-center text-white border border-white/[0.03]"
                  >
                    تسريع
                  </button>

                  {/* Share option (text only) */}
                  <button
                    onClick={() => {
                      onShare();
                      setShowTikTokModal(false);
                    }}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-2xl text-sm font-extrabold transition cursor-pointer text-center text-white border border-white/[0.03]"
                  >
                    مشاركة
                  </button>

                  <button
                    onClick={() => setShowTikTokModal(false)}
                    className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl text-xs font-black transition cursor-pointer text-center mt-2 border border-red-500/10"
                  >
                    تراجع
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <span className="text-zinc-400 text-[11px] font-black tracking-widest uppercase mb-1">
                    ضبط سرعة تشغيل اللقطة (الحالي: x{playbackSpeed})
                  </span>
                  
                  {/* Speed selections */}
                  {[1, 1.5, 2, 3, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => selectPlaybackSpeed(speed)}
                      className={`w-full py-3.5 rounded-2xl text-xs font-bold transition cursor-pointer text-center ${
                        playbackSpeed === speed 
                          ? 'bg-primary text-black font-extrabold' 
                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/[0.02]'
                      }`}
                    >
                      {speed === 1 ? 'سرعة عادية (x1)' : `سرعة تشغيل ${speed}x`}
                    </button>
                  ))}

                  <button
                    onClick={() => setShowSpeedSubmenu(false)}
                    className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-2xl text-xs font-black transition cursor-pointer text-center mt-2"
                  >
                    رجوع للخيارات الرئيسية
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ShortCard.displayName = 'ShortCard';

export default ShortCard;
