import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, SkipForward, SkipBack, ListVideo, Server, 
  Tv, Loader2, RotateCw, Check, Info, ArrowRight, ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';

interface Episode {
  epNum: number;
  epSlug: string;
  title: string;
}

interface ServerItem {
  name: string;
  url: string;
  directUrl?: string;
}

interface CustomPlayerProps {
  videoUrl: string;
  activeServerUrl: string;
  seriesId: string;
  seriesImage: string;
  episodeIndex: number;
  episodes: Episode[];
  servers: ServerItem[];
  onSelectEpisode: (episode: Episode, index: number) => void;
  onSelectServer: (url: string) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  seriesTitle?: string;
  seriesCategory?: string;
}

export default function CustomPlayer({
  videoUrl,
  activeServerUrl,
  seriesId,
  seriesImage,
  episodeIndex,
  episodes,
  servers,
  onSelectEpisode,
  onSelectServer,
  isMaximized,
  onToggleMaximize,
  seriesTitle = "مسلسل",
  seriesCategory = "مسلسل"
}: CustomPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('player_volume');
      return saved !== null ? parseFloat(saved) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('player_muted');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{ side: 'left' | 'right'; show: boolean }>({ side: 'left', show: false });
  const [forceIframe, setForceIframe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset forceIframe when video or server changes
  useEffect(() => {
    setForceIframe(false);
    setError(null);
  }, [videoUrl, activeServerUrl]);

  // Listen for messages from proxy iframes (like Cloudflare block notifications)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'switch-server') {
        const currentIndex = servers.findIndex(s => s.url === activeServerUrl);
        if (currentIndex !== -1 && currentIndex < servers.length - 1) {
          onSelectServer(servers[currentIndex + 1].url);
        } else if (servers.length > 0) {
          onSelectServer(servers[0].url);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeServerUrl, servers, onSelectServer]);

  const isDirectStream = !forceIframe && videoUrl && (
    videoUrl.includes('/api/proxy-hls') || 
    videoUrl.includes('.m3u8') || 
    videoUrl.includes('.mp4') || 
    videoUrl.includes('.webm')
  );

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load video (HLS or native)
  useEffect(() => {
    if (!isDirectStream || !videoRef.current || !videoUrl) return;

    setIsLoading(true);
    setIsPlaying(false);
    setError(null);

    // If loading takes too long (e.g. 15 seconds), show error/suggest backup
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoading && !isPlaying) {
        setError("يبدو أن البث يستغرق وقتاً طويلاً للتحميل. يمكنك تجربة المشغل الاحتياطي.");
      }
    }, 15000);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;

    const isHls = videoUrl.includes('.m3u8') || videoUrl.includes('/api/proxy-hls');

    if (Hls.isSupported() && isHls) {
      const hls = new Hls({
        maxMaxBufferLength: 15,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
      });

      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("HLS Network Error:", data);
              if (data.response && data.response.code === 403) {
                setIsLoading(false);
                setError("تم حظر هذا السيرفر من قبل مزود البث (Error 403/1005). يرجى التبديل للمشغل الاحتياطي أو تجربة سيرفر آخر.");
                hls.destroy();
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("HLS Media Error:", data);
              hls.recoverMediaError();
              break;
            default:
              console.error("HLS Fatal Error:", data);
              setIsLoading(false);
              setError("فشل تحميل البث المباشر. يرجى تجربة المشغل الاحتياطي.");
              hls.destroy();
              break;
          }
        }
      });
    } else if (videoUrl) {
      // Fallback to standard source
      video.src = videoUrl;
      video.load();
      
      const handleCanPlay = () => {
        setIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      };

      const handleError = () => {
        setIsLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setError("فشل تحميل ملف الفيديو مباشرة.");
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      };
    }

    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [videoUrl, isDirectStream]);

  // Sync volume states with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
    try {
      localStorage.setItem('player_volume', volume.toString());
      localStorage.setItem('player_muted', isMuted ? 'true' : 'false');
    } catch {}
  }, [volume, isMuted]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Monitor fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDirectStream) return;
      
      // If user is focused on an input, skip hotkeys
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'arrowup':
          e.preventDefault();
          adjustVolume(0.05);
          break;
        case 'arrowdown':
          e.preventDefault();
          adjustVolume(-0.05);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirectStream, volume, isMuted, isPlaying]);

  // Reset/Trigger control hide timeout on activity
  const triggerActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowServerMenu(false);
      }, 3000);
    }
  };

  useEffect(() => {
    triggerActivity();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
    triggerActivity();
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    let newTime = videoRef.current.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerActivity();
  };

  const adjustVolume = (delta: number) => {
    setVolume((prev) => {
      const next = Math.max(0, Math.min(1, prev + delta));
      if (next > 0) setIsMuted(false);
      return next;
    });
    triggerActivity();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    triggerActivity();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerActivity();
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width * 0.35) {
      // Double tap left (rewind 10s)
      seekRelative(-10);
      setDoubleTapFeedback({ side: 'left', show: true });
      setTimeout(() => setDoubleTapFeedback(f => ({ ...f, show: false })), 600);
    } else if (clickX > width * 0.65) {
      // Double tap right (fast-forward 10s)
      seekRelative(10);
      setDoubleTapFeedback({ side: 'right', show: true });
      setTimeout(() => setDoubleTapFeedback(f => ({ ...f, show: false })), 600);
    } else {
      togglePlay();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentEpisode = episodes[episodeIndex];
  const hasPrevEpisode = episodeIndex > 0;
  const hasNextEpisode = episodeIndex < episodes.length - 1;

  const handlePrevEpClick = () => {
    if (hasPrevEpisode) {
      onSelectEpisode(episodes[episodeIndex - 1], episodeIndex - 1);
    }
  };

  const handleNextEpClick = () => {
    if (hasNextEpisode) {
      onSelectEpisode(episodes[episodeIndex + 1], episodeIndex + 1);
    }
  };

  return (
      <div 
        ref={containerRef}
        onMouseMove={triggerActivity}
        onClick={triggerActivity}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`relative aspect-video w-full bg-black overflow-hidden shadow-2xl transition-all duration-300 ring-1 ring-white/5 select-none ${
          isMaximized && !isFullscreen ? 'fixed inset-0 z-[120] h-screen aspect-auto' : 'rounded-xl md:rounded-2xl'
        }`}
      >
      {/* Background ambient poster light */}
      {seriesImage && !isPlaying && (
        <div 
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 scale-105 pointer-events-none transition-opacity duration-700" 
          style={{ backgroundImage: `url(${seriesImage})` }}
        />
      )}

      {/* Main Streaming Area */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
        {isDirectStream ? (
          /* Custom Native Video Player */
          <>
            <video
              ref={videoRef}
              onClick={togglePlay}
              onDoubleClick={handleDoubleTap}
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
              onEnded={handleNextEpClick}
              playsInline
              className="w-full h-full object-contain cursor-pointer"
            />

            {/* Double Tap Floating Visual Feedbacks */}
            <AnimatePresence>
              {doubleTapFeedback.show && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`absolute top-1/2 -translate-y-1/2 z-55 bg-black/60 backdrop-blur-md text-white rounded-full p-4 pointer-events-none ${
                    doubleTapFeedback.side === 'left' ? 'left-1/4' : 'right-1/4'
                  }`}
                >
                  <span className="font-bold text-lg flex items-center gap-1.5 font-mono">
                    {doubleTapFeedback.side === 'left' ? <ArrowLeft className="w-5 h-5 animate-pulse" /> : <ArrowRight className="w-5 h-5 animate-pulse" />}
                    {doubleTapFeedback.side === 'left' ? '10-' : '10+'} ث
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading Indicator */}
            {(isLoading || error) && (
              <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center bg-black/90 backdrop-blur-xl z-50 p-6 text-center">
                {error ? (
                  <>
                    <AlertTriangle className="w-16 h-16 text-[#b72424] mb-2" />
                    <div className="space-y-3">
                      <p className="text-base font-black text-white">{error}</p>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">المواقع الأصلية (مثل miravd) تفرض قيوداً على الاتصال أحياناً. المشغل الاحتياطي هو الحل الأفضل في هذه الحالة.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-14 h-14 text-[#b72424] animate-spin drop-shadow-lg" />
                    <div className="space-y-2">
                      <p className="text-base font-black text-zinc-100">جاري الاتصال بخادم البث...</p>
                      <p className="text-xs text-zinc-400">إذا استغرق الأمر أكثر من 30 ثانية، نوصي بالتبديل للمشغل الاحتياطي</p>
                    </div>
                  </>
                )}
                
                <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForceIframe(true);
                      setError(null);
                    }}
                    className="w-full px-6 py-4 bg-[#b72424] hover:bg-red-600 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-[#b72424]/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Server className="w-5 h-5" />
                    استخدام المشغل الاحتياطي (حل سريع)
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Try next server if available
                      const currentIndex = servers.findIndex(s => s.url === activeServerUrl);
                      if (currentIndex !== -1 && currentIndex < servers.length - 1) {
                        onSelectServer(servers[currentIndex + 1].url);
                      } else if (servers.length > 0) {
                        onSelectServer(servers[0].url);
                      }
                      setError(null);
                    }}
                    className="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    تجربة سيرفر مختلف
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Iframe Server Embed Sandbox Mode */
          <div className="relative w-full h-full bg-black">
            {forceIframe && (
              <div className="absolute top-4 right-4 z-50">
                <button
                  type="button"
                  onClick={() => setForceIframe(false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all border border-emerald-500/30 flex items-center gap-1.5 text-xs font-black shadow-lg cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>العودة للمشغل المتطور</span>
                </button>
              </div>
            )}
            {(() => {
              const activeServerItem = servers.find(s => s.url === activeServerUrl);
              const iframeSrc = (activeServerItem as any)?.directUrl || activeServerUrl || videoUrl;
              return iframeSrc ? (
                <iframe
                  src={iframeSrc}
                  className="w-full h-full border-none"
                  allowFullScreen
                  title="Streaming Server"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-[#07070a]">
                  <Loader2 className="w-10 h-10 text-[#b72424] animate-spin" />
                  <span className="text-sm font-semibold text-zinc-400">جاري الاتصال بخادم البث...</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* OVERLAY CONTROLS (Only for Direct Video Stream) */}
      {isDirectStream && (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/85 flex flex-col justify-between p-4 md:p-6 z-40 transition-all duration-300"
            >
              {/* TOP BAR Controls */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-[#b72424] mb-0.5 tracking-wider uppercase flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5" />
                    {seriesCategory} • {currentEpisode ? `الحلقة ${currentEpisode.epNum}` : ''}
                  </span>
                  <h1 className="text-sm md:text-base font-extrabold text-white truncate max-w-[280px] md:max-w-[450px]">
                    {seriesTitle}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setForceIframe(true)}
                    className="px-3 py-2 rounded-lg bg-[#b72424]/40 hover:bg-[#b72424] text-white transition-all border border-[#b72424]/50 flex items-center gap-1.5 text-xs font-black shadow-md cursor-pointer"
                    title="التحويل إلى المشغل الاحتياطي"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>المشغل الاحتياطي</span>
                  </button>

                  {/* Quick toggle fullscreen and maximize screen */}
                  <button 
                    onClick={onToggleMaximize}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
                    title={isMaximized ? "تصغير الشاشة" : "تكبير الشاشة"}
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors border border-white/5"
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CENTER Play/Pause Button overlay */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-6 md:gap-10">
                <button 
                  onClick={handlePrevEpClick}
                  disabled={!hasPrevEpisode}
                  className={`p-3 rounded-full border transition-all duration-200 transform hover:scale-105 ${
                    hasPrevEpisode 
                      ? 'bg-zinc-900/60 hover:bg-zinc-800 border-white/10 text-white' 
                      : 'bg-zinc-950/20 border-white/5 text-zinc-600 cursor-not-allowed'
                  }`}
                  title="الحلقة السابقة"
                >
                  <SkipBack className="w-5 h-5 rotate-180" />
                </button>

                <button 
                  onClick={togglePlay}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#b72424] hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-950/50 transform hover:scale-110 active:scale-95 transition-all duration-200"
                >
                  {isPlaying ? <Pause className="w-6 md:w-7 h-6 md:h-7" /> : <Play className="w-6 md:w-7 h-6 md:h-7 fill-white translate-x-[2px]" />}
                </button>

                <button 
                  onClick={handleNextEpClick}
                  disabled={!hasNextEpisode}
                  className={`p-3 rounded-full border transition-all duration-200 transform hover:scale-105 ${
                    hasNextEpisode 
                      ? 'bg-zinc-900/60 hover:bg-zinc-800 border-white/10 text-white' 
                      : 'bg-zinc-950/20 border-white/5 text-zinc-600 cursor-not-allowed'
                  }`}
                  title="الحلقة التالية"
                >
                  <SkipForward className="w-5 h-5 rotate-180" />
                </button>
              </div>

              {/* BOTTOM CONTROLS & Progress Slider */}
              <div className="space-y-4">
                {/* Custom Progress Bar Slider */}
                <div className="group/progress flex items-center gap-3">
                  <span className="text-[11px] font-bold text-zinc-400 font-mono select-none">
                    {formatTime(currentTime)}
                  </span>

                  <div 
                    onClick={handleProgressClick}
                    className="relative flex-1 h-1.5 md:h-2 bg-white/15 rounded-full cursor-pointer overflow-hidden transition-all duration-200 group-hover/progress:h-2.5"
                  >
                    {/* Played Track */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#b72424] to-red-500 rounded-full" 
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                    {/* Slider thumb preview dot */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-[#b72424] opacity-0 group-hover/progress:opacity-100 transition-opacity duration-150"
                      style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 7px)` }}
                    />
                  </div>

                  <span className="text-[11px] font-bold text-zinc-400 font-mono select-none">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Lower Controls Strip */}
                <div className="flex items-center justify-between">
                  {/* Left Controls (Volume, speed, info) */}
                  <div className="flex items-center gap-3 md:gap-5">
                    {/* Volume Controls */}
                    <div className="flex items-center gap-2 group/volume">
                      <button 
                        onClick={toggleMute}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                      >
                        {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                      </button>
                      
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          setIsMuted(false);
                        }}
                        className="w-0 overflow-hidden opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-200 h-1 rounded-full accent-[#b72424] bg-white/20 cursor-pointer"
                      />
                    </div>

                    {/* Speed Selector */}
                    <div className="relative">
                      <button 
                        onClick={() => {
                          setShowSpeedMenu(!showSpeedMenu);
                          setShowServerMenu(false);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>سرعة البث ({playbackRate}x)</span>
                      </button>

                      <AnimatePresence>
                        {showSpeedMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-10 left-0 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-xl p-1.5 min-w-[120px] shadow-2xl flex flex-col z-55"
                          >
                            <span className="text-[10px] text-zinc-500 font-bold px-2 py-1 select-none text-left">سرعة التشغيل</span>
                            {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => {
                                  setPlaybackRate(rate);
                                  setShowSpeedMenu(false);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                                  playbackRate === rate ? 'bg-[#b72424] text-white' : 'text-zinc-300 hover:bg-white/5'
                                }`}
                              >
                                <span>{rate}x</span>
                                {playbackRate === rate && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Right Controls (Server Dropdown, Episode Drawer Trigger) */}
                  <div className="flex items-center gap-2 md:gap-4">
                    {/* Servers dropdown inside player controls */}
                    <div className="relative">
                      <button 
                        onClick={() => {
                          setShowServerMenu(!showServerMenu);
                          setShowSpeedMenu(false);
                        }}
                        className="flex items-center gap-1.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 transition-all active:scale-95"
                      >
                        <Server className="w-3.5 h-3.5 text-[#b72424]" />
                        <span>خوادم البث</span>
                      </button>

                      <AnimatePresence>
                        {showServerMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-11 right-0 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-xl p-1.5 min-w-[160px] shadow-2xl flex flex-col z-55 text-right"
                          >
                            <span className="text-[10px] text-zinc-500 font-bold px-2.5 py-1 select-none">اختر خادم بث سريع</span>
                            <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
                              {servers.map((srv, idx) => {
                                const isActive = srv.url === activeServerUrl;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      onSelectServer(srv.url);
                                      setShowServerMenu(false);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold text-right transition-colors ${
                                      isActive ? 'bg-[#b72424]/20 text-[#ef4444] border border-[#b72424]/30' : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                                    }`}
                                  >
                                    <span className="truncate">{srv.name}</span>
                                    {isActive ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <RotateCw className="w-3 h-3 text-zinc-500 flex-shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Episode drawer trigger */}
                    <button 
                      onClick={() => setShowEpisodesDrawer(true)}
                      className="flex items-center gap-1.5 bg-[#b72424] hover:bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-md shadow-red-950/25 transition-all active:scale-95"
                    >
                      <ListVideo className="w-3.5 h-3.5" />
                      <span>قائمة الحلقات</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* EPISODE LIST SIDE DRAWER (Works in both direct and iframe modes!) */}
      <AnimatePresence>
        {showEpisodesDrawer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex justify-end"
            onClick={() => setShowEpisodesDrawer(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-[280px] md:w-[320px] h-full bg-zinc-950/95 border-r border-white/10 p-5 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col h-full overflow-hidden">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 select-none">
                  <span className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                    <ListVideo className="w-4.5 h-4.5 text-[#b72424]" />
                    قائمة حلقات المسلسل
                  </span>
                  <button 
                    onClick={() => setShowEpisodesDrawer(false)}
                    className="text-xs font-bold text-zinc-500 hover:text-white px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-colors"
                  >
                    إغلاق
                  </button>
                </div>

                {/* Episodes Scrollable List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {episodes.map((ep, idx) => {
                    const isCurrent = idx === episodeIndex;
                    return (
                      <button
                        key={ep.epSlug || idx}
                        onClick={() => {
                          onSelectEpisode(ep, idx);
                          setShowEpisodesDrawer(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-right transition-all transform active:scale-98 ${
                          isCurrent 
                            ? 'bg-gradient-to-r from-[#b72424]/20 to-transparent border-[#b72424] text-white font-extrabold shadow-md shadow-[#b72424]/10' 
                            : 'bg-zinc-900/40 hover:bg-zinc-900/80 border-white/5 hover:border-white/10 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 truncate">
                          <span className="text-[11px] font-bold text-zinc-500 uppercase">حلقة {ep.epNum}</span>
                          <span className="text-xs font-extrabold truncate">{ep.title}</span>
                        </div>
                        {isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-[#b72424]/20 border border-[#b72424] flex items-center justify-center flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#b72424] animate-ping" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/5 hover:bg-[#b72424] flex items-center justify-center flex-shrink-0 transition-all text-[10px] font-bold">
                            {ep.epNum}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
