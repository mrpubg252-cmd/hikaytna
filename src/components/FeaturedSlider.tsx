import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, ChevronLeft, ChevronRight, Star, Volume2, VolumeX, Film } from "lucide-react";
import { Series } from "../services/firebase";
import { cn } from "../lib/utils";

interface FeaturedSliderProps {
  items: Series[];
  onPlay: (item: Series) => void;
}

// Extract YouTube ID safely from various formats
function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

const SOUND_PREF_KEY = "hkayatna_slider_sound_enabled";

export default function FeaturedSlider({ items, onPlay }: FeaturedSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  
  // Audio state - default to unmuted (sound on)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREF_KEY);
      return saved === "false" ? true : false;
    } catch {
      return false;
    }
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideDetailsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Global user interaction listener to unlock audio on iOS and Android automatically
  useEffect(() => {
    const unlockAudio = () => {
      if (videoRef.current && videoRef.current.muted && !isMuted) {
        videoRef.current.muted = false;
        videoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener("touchstart", unlockAudio, { passive: true, once: true });
    window.addEventListener("pointerdown", unlockAudio, { passive: true, once: true });
    window.addEventListener("click", unlockAudio, { passive: true, once: true });
    window.addEventListener("scroll", unlockAudio, { passive: true, once: true });

    return () => {
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("scroll", unlockAudio);
    };
  }, [isMuted]);

  // Requirement: Series that HAVE a trailer become FIRST in the slider, without removing others!
  const sliderItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    const withTrailer: Series[] = [];
    const withoutTrailer: Series[] = [];

    items.forEach((s) => {
      const hasTrailer = !!(s.trailer && s.trailer.trim().length > 5);
      if (hasTrailer) {
        withTrailer.push(s);
      } else {
        withoutTrailer.push(s);
      }
    });

    return [...withTrailer, ...withoutTrailer].slice(0, 10);
  }, [items]);

  const currentItem = sliderItems[currentIndex];
  const hasTrailer = !!(currentItem?.trailer && currentItem.trailer.trim().length > 5);
  const ytId = hasTrailer ? getYouTubeId(currentItem.trailer) : null;
  const isTrailerPlaying = hasTrailer && showTrailer && videoLoaded && !videoFailed;

  // Reset trailer states whenever the slide changes, and start 1.5-second timer to start trailer
  useEffect(() => {
    setShowTrailer(false);
    setVideoLoaded(false);
    setVideoFailed(false);
    setShowDetails(true);

    if (hideDetailsTimerRef.current) {
      clearTimeout(hideDetailsTimerRef.current);
    }

    if (!hasTrailer) return;

    const timer = setTimeout(() => {
      setShowTrailer(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentIndex, hasTrailer]);

  // When trailer video actually starts playing, keep details for 2 seconds then smoothly fade out
  useEffect(() => {
    if (isTrailerPlaying) {
      setShowDetails(true);
      if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);

      hideDetailsTimerRef.current = setTimeout(() => {
        setShowDetails(false);
      }, 2000);
    } else {
      setShowDetails(true);
    }
  }, [isTrailerPlaying]);

  // Tap/click anywhere on slider during trailer: reveal details for 3.5 seconds then fade back out
  const handleSliderClick = () => {
    if (!isTrailerPlaying) return;

    setShowDetails((prev) => {
      const next = !prev;
      if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);

      if (next) {
        hideDetailsTimerRef.current = setTimeout(() => {
          setShowDetails(false);
        }, 3500);
      }
      return next;
    });
  };

  // Handle Video AutoPlay & Sound on iOS Safari
  useEffect(() => {
    if (!showTrailer || !videoRef.current || ytId) return;

    const videoEl = videoRef.current;
    videoEl.muted = isMuted;

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoaded(true);
        })
        .catch(() => {
          if (videoEl) {
            videoEl.muted = true;
            videoEl.play().then(() => setVideoLoaded(true)).catch(() => {
              setVideoFailed(true);
              setShowTrailer(false);
              setShowDetails(true);
            });
          }
        });
    }
  }, [showTrailer, isMuted, currentIndex, ytId]);

  // Handle end of trailer video: Immediately restore details and smoothly advance to next slide
  const handleVideoEnded = () => {
    if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);
    setShowTrailer(false);
    setVideoLoaded(false);
    setShowDetails(true);
    setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
  };

  // Slide auto-advance duration:
  // If trailer is present and not failed, wait until trailer finishes (onEnded).
  // If no trailer, or if video failed, switch smoothly after 7 seconds.
  useEffect(() => {
    if (sliderItems.length <= 1) return;

    if (hasTrailer && !videoFailed) {
      // Allow the trailer video to play completely without interrupting it!
      // Set generous safety timeout (3 minutes) in case video never finishes
      const safetyTimeout = setTimeout(() => {
        handleVideoEnded();
      }, 180000);
      return () => clearTimeout(safetyTimeout);
    }

    const interval = setInterval(() => {
      if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);
      setShowTrailer(false);
      setVideoLoaded(false);
      setShowDetails(true);
      setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [sliderItems.length, currentIndex, hasTrailer, videoFailed]);

  // Listen for YouTube trailer iframe ended event
  useEffect(() => {
    if (!hasTrailer || !ytId) return;

    const handleYTMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === "string") {
          const parsed = JSON.parse(event.data);
          // YouTube API onStateChange: 0 means ENDED
          if (parsed.event === "onStateChange" && parsed.info === 0) {
            handleVideoEnded();
          }
        }
      } catch (e) {}
    };

    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, [hasTrailer, ytId, sliderItems.length]);

  if (sliderItems.length === 0 || !currentItem) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);
    setShowTrailer(false);
    setVideoLoaded(false);
    setShowDetails(true);
    setCurrentIndex((prev) => (prev - 1 + sliderItems.length) % sliderItems.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hideDetailsTimerRef.current) clearTimeout(hideDetailsTimerRef.current);
    setShowTrailer(false);
    setVideoLoaded(false);
    setShowDetails(true);
    setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted((prev) => {
      const nextMuted = !prev;
      try {
        localStorage.setItem(SOUND_PREF_KEY, nextMuted ? "false" : "true");
      } catch {}

      if (videoRef.current) {
        videoRef.current.muted = nextMuted;
        if (!nextMuted) {
          videoRef.current.play().catch(() => {});
        }
      }
      return nextMuted;
    });
  };

  const imgUrl = currentItem.image || currentItem.img || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=1200&auto=format&fit=crop";

  const episodesCountText = useMemo(() => {
    if (currentItem.episodes_count && currentItem.episodes_count !== '0') {
      return currentItem.episodes_count.includes('حلقة') ? currentItem.episodes_count : `${currentItem.episodes_count} حلقة`;
    }
    if (currentItem.episodes && currentItem.episodes.length > 0) {
      return `${currentItem.episodes.length} حلقة`;
    }
    return null;
  }, [currentItem]);

  // Is the button in solid white pill mode?
  // Always true when trailer is not playing, or when details are visible!
  const isWhiteButton = !isTrailerPlaying || showDetails;

  return (
    <div 
      onClick={handleSliderClick}
      className="relative w-full h-[58vh] sm:h-[62vh] md:h-[520px] lg:h-[580px] overflow-hidden bg-zinc-950 select-none group cursor-pointer"
    >
      {/* Background Slides with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Main Container */}
          <div className="absolute inset-0 w-full h-full bg-zinc-950 overflow-hidden flex items-center justify-center">
            
            {/* 1. Poster Artwork - Base layer */}
            <img
              src={imgUrl}
              alt={currentItem.title}
              referrerPolicy="no-referrer"
              className={cn(
                "absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-1000",
                isTrailerPlaying ? "opacity-0" : "opacity-100"
              )}
            />

            {/* 2. Trailer Video Player - Cinema scale with zero subtitle obstruction */}
            {hasTrailer && showTrailer && !videoFailed && (
              <div 
                className={cn(
                  "absolute inset-0 w-full h-full flex items-center justify-center bg-black transition-opacity duration-1000",
                  videoLoaded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                {ytId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${ytId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1`}
                    title="Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{ border: 0 }}
                    onLoad={() => setVideoLoaded(true)}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={currentItem.trailer}
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    muted={isMuted}
                    preload="auto"
                    className="w-full h-full object-cover pointer-events-none"
                    onCanPlay={() => setVideoLoaded(true)}
                    onPlaying={() => setVideoLoaded(true)}
                    onEnded={handleVideoEnded}
                    onError={() => {
                      setVideoFailed(true);
                      setShowTrailer(false);
                      setShowDetails(true);
                    }}
                  />
                )}
              </div>
            )}
            
            {/* Gradient overlays: Balanced cinema atmosphere without blurring or dimming video subtitles */}
            {/* Poster ambient gradient */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 via-35% to-transparent pointer-events-none z-10 transition-opacity duration-700",
              isTrailerPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
            )} />
            
            {/* Subtle top shade for buttons & header contrast */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#050505]/70 via-[#050505]/20 to-transparent pointer-events-none z-10" />
            
            {/* Slim bottom seam transition to blend smoothly with dark page without touching subtitles */}
            <div className={cn(
              "absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-transparent pointer-events-none z-10 transition-opacity duration-700",
              isTrailerPlaying ? "opacity-60" : "opacity-100"
            )} />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Top-Left: Audio control button when trailer is playing */}
      {isTrailerPlaying && !ytId && (
        <div className="absolute top-16 left-4 sm:left-6 z-40">
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white backdrop-blur-md border border-white/15 transition-all active:scale-95 cursor-pointer shadow-lg"
            title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-zinc-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* Unified Overlay: Poster Details (Fades out 2s after trailer starts, reappears on tap, always on when trailer ends) */}
      <div 
        className={cn(
          "absolute inset-0 flex flex-col justify-end items-center text-center p-6 sm:p-8 pb-36 sm:pb-40 z-20 text-white dir-rtl pointer-events-none transition-opacity duration-700",
          (!isTrailerPlaying || showDetails) ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="space-y-3 sm:space-y-4 max-w-2xl px-4 pointer-events-auto">
          {/* Badges */}
          <div className="flex items-center gap-2 justify-center">
            <span className="bg-red-600 text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded shadow-lg animate-pulse">
              حصرياً
            </span>
            {hasTrailer && (
              <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
                <Film className="w-3 h-3" />
                إعلان تشويقي
              </span>
            )}
            {currentItem.category && (
              <span className="bg-white/10 backdrop-blur-md border border-white/5 text-zinc-300 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded shadow-lg">
                {currentItem.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight line-clamp-2">
            {currentItem.title}
          </h1>

          {/* Sub-details */}
          <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-zinc-300 font-bold drop-shadow-md">
            <span className="flex items-center gap-1 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-current" />
              {currentItem.rating || "9.0"}
            </span>
            <span className="text-white/30">|</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-black">HD</span>
            {episodesCountText && (
              <>
                <span className="text-white/30">|</span>
                <span className="text-primary font-black">{episodesCountText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Centered "مشاهدة الآن" Button with Smooth Background Transition */}
      {/* Elevated position above subtitles */}
      <div className="absolute bottom-[105px] sm:bottom-[115px] md:bottom-[120px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(currentItem);
          }}
          className={cn(
            "flex items-center gap-2 text-xs sm:text-sm font-black transition-all duration-700 ease-in-out cursor-pointer active:scale-95 select-none",
            isWhiteButton
              ? "bg-white hover:bg-zinc-100 text-black px-7 sm:px-9 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/80"
              : "bg-transparent text-white px-5 py-2.5 rounded-full drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] hover:scale-105 border border-transparent"
          )}
        >
          <span>مشاهدة الآن</span>
          <Play className={cn(
            "w-4 h-4 fill-current transition-colors duration-700",
            isWhiteButton ? "text-black translate-x-0.5" : "text-white"
          )} />
        </button>
      </div>

      {/* Manual Sliding Chevron Buttons (Hidden during trailer) */}
      <button
        onClick={handlePrev}
        className={cn(
          "absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 cursor-pointer hidden sm:block",
          isTrailerPlaying && "hidden"
        )}
        title="السابق"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={handleNext}
        className={cn(
          "absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 cursor-pointer hidden sm:block",
          isTrailerPlaying && "hidden"
        )}
        title="التالي"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Bottom Dot Pagination indicators (only when not in trailer) */}
      <div 
        className={cn(
          "absolute bottom-4 right-1/2 translate-x-1/2 flex items-center gap-2.5 z-25 transition-opacity duration-500",
          isTrailerPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {sliderItems.map((_, idx) => (
          <button
            key={`dot-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
              currentIndex === idx ? "w-7 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
