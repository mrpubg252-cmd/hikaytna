import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Series } from '../services/firebase';

interface SliderProps {
  series: Series[];
}

export default function Slider({ series }: SliderProps) {
  const [index, setIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted to guarantee instant compatible autoplay on all mobile/desktop browsers
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(true);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Slice down to exactly 3 series as requested by the user
  const activeSeries = useMemo(() => series.slice(0, 3), [series]);

  const nextSlide = () => {
    if (activeSeries.length === 0) return;
    setIndex((prev) => (prev + 1) % activeSeries.length);
    setShowVideo(false);
    setIsTrailerPlaying(true);
  };

  const handleSliderClick = () => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);

    // Keep playing automatically
    if (video.paused) {
      video.play().catch(() => {});
    }
    setIsTrailerPlaying(true);
  };

  useEffect(() => {
    if (activeSeries.length === 0) return;

    const current = activeSeries[index];
    
    // If there's a trailer, show image for 1s then switch to video
    if (current.trailer) {
      const timer = setTimeout(() => {
        setShowVideo(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Fallback: if no trailer, move to next slide after 5s
      const timer = setTimeout(nextSlide, 5000);
      return () => clearTimeout(timer);
    }
  }, [index, activeSeries]);

  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.muted = isMuted;
      const playPromise = videoRef?.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsTrailerPlaying(true);
        }).catch(error => {
          console.warn("Autoplay with sound was blocked, playing muted:", error);
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [showVideo, index]);

  // Global interaction listener to auto-unmute when the user interacts elsewhere on screen if possible
  useEffect(() => {
    const handleInteraction = () => {
      const video = videoRef.current;
      if (video && showVideo && isMuted) {
        video.muted = false;
        setIsMuted(false);
        video.play().catch(() => {});
        setIsTrailerPlaying(true);
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return cleanup;
  }, [isMuted, showVideo]);

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

  if (activeSeries.length === 0) return null;

  const current = activeSeries[index];

  return (
    <div 
      className="relative w-full h-[60vh] sm:h-[80vh] overflow-hidden bg-black cursor-pointer group/slider"
      onClick={handleSliderClick}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          {/* Background Image - Always there, but fades out when video starts */}
          <motion.img 
            src={current.image} 
            alt={current.title}
            animate={{ opacity: showVideo ? 0 : 1 }}
            transition={{ duration: 1 }}
            className="w-full h-full object-cover"
          />

          {/* Video Trailer */}
          {showVideo && current.trailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 overflow-hidden"
            >
              <video
                ref={videoRef}
                src={current.trailer}
                className="w-full h-full object-fill pointer-events-none select-none"
                autoPlay
                muted={isMuted}
                onEnded={nextSlide}
                playsInline={true}
                webkitPlaysInline={true}
                tabIndex={-1}
                disablePictureInPicture={true}
                disableRemotePlayback={true}
                controlsList="nodownload nofullscreen noremoteplayback"
                preload="auto"
                controls={false}
                {...{
                  "x-webkit-airplay": "deny",
                  "aria-hidden": "true"
                }}
                onError={() => {
                  console.error("Video failed to load, moving to next slide");
                  nextSlide();
                }}
              />
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
          <span className="text-[#ffca28] flex items-center gap-1 font-bold tracking-tight">⭐ {current.rating.toFixed(1)}</span>
          <span className="text-zinc-500">|</span>
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
    </div>
  );
}
