import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, 
  Maximize, Minimize, Download, RefreshCw, X, Film, AlertCircle, Expand, Shrink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface ChatVideoPlayerProps {
  src: string;
  isSticker?: boolean;
  className?: string;
  fileName?: string;
}

// Format seconds into MM:SS
function formatTime(sec: number): string {
  if (isNaN(sec) || !isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ChatVideoPlayer({
  src,
  isSticker = false,
  className,
  fileName
}: ChatVideoPlayerProps) {
  // Source fallback management: try direct and stream proxy
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    const lower = (src || '').toLowerCase();
    return lower.includes('top4top') || lower.includes('catbox');
  });
  const [loadError, setLoadError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Compute resolved stream URL
  const resolvedUrl = React.useMemo(() => {
    if (!src) return '';
    if (!src.startsWith('http://') && !src.startsWith('https://')) return src;
    if (useProxy) {
      return `/api/v1/stream-range-proxy?url=${encodeURIComponent(src)}`;
    }
    return src;
  }, [src, useProxy]);

  // Append #t=0.001 to ensure iOS Safari decodes the initial frame for inline thumbnail
  const previewVideoSrc = React.useMemo(() => {
    if (!resolvedUrl) return '';
    if (resolvedUrl.includes('#')) return resolvedUrl;
    return `${resolvedUrl}#t=0.001`;
  }, [resolvedUrl]);

  // Attempt to capture a canvas thumbnail on video frame load (solves iPhone black screen 100%)
  const handleLoadedData = () => {
    const video = previewVideoRef.current;
    if (!video || thumbnailUrl) return;

    try {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth, 480);
        canvas.height = Math.min(video.videoHeight, 270);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setThumbnailUrl(dataUrl);
        }
      }
    } catch (e) {
      // Ignore cross-origin canvas errors, standard video element will still render
    }
  };

  // If sticker video (auto-looping, small, silent)
  if (isSticker) {
    return (
      <div className="relative mt-2 w-24 h-24 rounded-2xl overflow-hidden shadow-md bg-zinc-900 border border-white/10 group cursor-pointer">
        <video
          src={previewVideoSrc}
          autoPlay
          loop
          muted
          playsInline
          webkit-playsinline="true"
          preload="auto"
          className="w-full h-full object-cover"
          onError={() => {
            if (!useProxy) setUseProxy(true);
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Inline Chat Bubble Video Card */}
      <div 
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 mt-2 max-w-[280px] sm:max-w-[340px] group cursor-pointer shadow-xl select-none transition-all active:scale-[0.98]",
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
      >
        {/* Aspect Ratio Box */}
        <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
          
          {/* Static Thumbnail generated or captured (shows instantaneously on iOS and Android) */}
          {thumbnailUrl && (
            <img 
              src={thumbnailUrl} 
              alt="Video Preview"
              className="absolute inset-0 w-full h-full object-cover z-0" 
            />
          )}

          {!loadError ? (
            <video
              ref={previewVideoRef}
              src={previewVideoSrc}
              playsInline
              webkit-playsinline="true"
              preload="auto"
              muted
              onLoadedData={handleLoadedData}
              onSeeked={handleLoadedData}
              onCanPlay={handleLoadedData}
              className={cn(
                "w-full h-full object-cover relative z-0 transition-opacity duration-300",
                thumbnailUrl ? "opacity-0" : "opacity-100"
              )}
              onError={() => {
                if (!useProxy) {
                  setUseProxy(true);
                } else {
                  setLoadError(true);
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-zinc-400">
              <Film className="w-8 h-8 text-zinc-600" />
              <span className="text-xs font-bold text-zinc-300">مقطع فيديو</span>
              <span className="text-[10px] text-primary">انقر للتشغيل في المشغل</span>
            </div>
          )}

          {/* Dark gradient overlay for contrast & readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none z-10" />

          {/* Big Center Play Button */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="w-13 h-13 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_4px_20px_rgba(220,38,38,0.6)] group-hover:scale-110 group-hover:bg-red-500 transition-all border border-white/20">
              <Play className="w-6 h-6 fill-current translate-x-0.5 text-white" />
            </div>
          </div>

          {/* Badge indicator */}
          <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-[10px] text-white font-bold z-20">
            <Film className="w-3 h-3 text-red-500" />
            <span>مشاهدة الفيديو</span>
          </div>
        </div>
      </div>

      {/* Professional Fullscreen Immersive Modal Player */}
      <AnimatePresence>
        {isModalOpen && (
          <ProfessionalVideoModal
            src={src}
            resolvedUrl={resolvedUrl}
            fileName={fileName}
            onClose={() => setIsModalOpen(false)}
            onToggleProxy={() => setUseProxy(prev => !prev)}
            isUsingProxy={useProxy}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface ProfessionalModalProps {
  src: string;
  resolvedUrl: string;
  fileName?: string;
  onClose: () => void;
  onToggleProxy: () => void;
  isUsingProxy: boolean;
}

function ProfessionalVideoModal({
  src,
  resolvedUrl,
  fileName,
  onClose,
  onToggleProxy,
  isUsingProxy
}: ProfessionalModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFillScreen, setIsFillScreen] = useState(false);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity
  const triggerActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 4000);
  }, [isPlaying]);

  useEffect(() => {
    triggerActivity();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [triggerActivity]);

  // Video event bindings
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        try {
          setBufferedEnd(video.buffered.end(video.buffered.length - 1));
        } catch (e) {}
      }
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setIsBuffering(false);
      setHasError(false);
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setHasError(false);
    };
    const onError = () => {
      setIsBuffering(false);
      setHasError(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    // Initial play attempt with audio catch for iOS
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to muted autoplay on iOS if sound blocked
        if (video) {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => setIsPlaying(false));
        }
      });
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, [resolvedUrl]);

  // Toggle Play / Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    triggerActivity();
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  // Seek by delta (seconds)
  const seekDelta = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    triggerActivity();
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  };

  // Seek bar change
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    triggerActivity();
    video.currentTime = val;
    setCurrentTime(val);
  };

  // Volume toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    triggerActivity();
    const next = !isMuted;
    video.muted = next;
    setIsMuted(next);
  };

  // Fullscreen toggle (Safari iOS + standard)
  const toggleFullscreen = () => {
    triggerActivity();
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    if ((video as any).webkitEnterFullscreen) {
      (video as any).webkitEnterFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999999] bg-black flex flex-col justify-between select-none"
      onClick={onClose}
      onMouseMove={triggerActivity}
      onTouchStart={triggerActivity}
    >
      {/* Top Header Bar */}
      <div 
        className={cn(
          "absolute top-0 inset-x-0 p-4 sm:p-5 flex items-center justify-between z-50 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
          <span className="text-xs font-bold hidden sm:inline">إغلاق</span>
        </button>

        {/* Video Mode Fill Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFillScreen(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 text-xs font-bold cursor-pointer"
          >
            {isFillScreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
            <span>{isFillScreen ? "احتواء الشاشة" : "ملء الشاشة"}</span>
          </button>
        </div>
      </div>

      {/* Main Video Box - Fills 100% of Screen on iPhone & Android */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex-1 bg-black flex items-center justify-center overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      >
        <video
          ref={videoRef}
          src={resolvedUrl}
          autoPlay
          playsInline
          webkit-playsinline="true"
          preload="auto"
          className={cn(
            "w-full h-full transition-all duration-300",
            isFillScreen ? "object-cover" : "object-contain"
          )}
        />

        {/* Buffering Spinner */}
        {isBuffering && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
            <div className="w-14 h-14 rounded-full border-4 border-red-600/30 border-t-red-600 animate-spin" />
          </div>
        )}

        {/* Error / Recovery UI */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/95 p-6 text-center z-30">
            <AlertCircle className="w-12 h-12 text-red-500 animate-pulse" />
            <p className="text-sm font-bold text-white">تعذر تشغيل الفيديو عبر الرابط المباشر</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleProxy();
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isUsingProxy ? "محاولة التشغيل المباشر" : "محاولة التشغيل عبر البروكسي"}</span>
            </button>
          </div>
        )}

        {/* Center Play Overlay when Paused */}
        {!isPlaying && !isBuffering && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none z-20">
            <div className="w-18 h-18 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.7)] scale-110 transition-transform">
              <Play className="w-9 h-9 fill-current translate-x-1 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Custom Bottom Control Bar */}
      <div 
        className={cn(
          "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/85 to-transparent p-4 sm:p-6 pb-8 flex flex-col gap-3 transition-opacity duration-300 z-50",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Seek Progress Bar */}
        <div className="relative w-full flex items-center group/seek py-2">
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-all"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div 
              className="absolute top-0 left-0 h-full bg-red-600 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* 2. Controls Row */}
        <div className="flex items-center justify-between gap-3 text-white dir-ltr">
          {/* Left Controls: Play, Rewind 10s, Forward 10s, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            <button
              onClick={() => seekDelta(-10)}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-zinc-300 hover:text-white cursor-pointer"
              title="تراجع 10 ثوانٍ"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => seekDelta(10)}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-zinc-300 hover:text-white cursor-pointer"
              title="تقديم 10 ثوانٍ"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Time Stamp */}
            <div className="text-xs font-mono text-zinc-300 font-bold ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-zinc-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Volume, Fullscreen */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
              title="ملء الشاشة"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
