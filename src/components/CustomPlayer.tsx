import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  RotateCcw, RotateCw, List, Settings, CheckCircle2, X,
  ArrowRight, Sparkles, Shield, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Episode } from '../services/firebase';
import { progressService } from '../services/progressService';
import HorizontalEpisodeList from './HorizontalEpisodeList';

interface CustomPlayerProps {
  videoUrl: string;
  seriesId: string;
  seriesImage: string;
  episodeIndex: number;
  episodes: Episode[];
  servers: { name: string; url: string }[];
  onSelectEpisode: (ep: Episode, index: number) => void;
  onSelectServer: (url: string) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onTimeUpdate?: (time: number) => void;
}

const CustomPlayer = forwardRef((props: CustomPlayerProps, ref) => {
  const {
    videoUrl,
    seriesId,
    seriesImage,
    episodeIndex,
    episodes,
    servers,
    onSelectEpisode,
    onSelectServer,
    isMaximized,
    onToggleMaximize,
    onTimeUpdate,
  } = props;

  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.play().catch(() => {});
      }
    },
    play: () => videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
  }));
  
  // Custom PlayerJS properties
  const [playerjsLoaded, setPlayerjsLoaded] = useState(false);
  const playerjsInstanceRef = useRef<any>(null);

  // Native player properties
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [isIframeFallback, setIsIframeFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRewindAnimation, setShowRewindAnimation] = useState(false);
  const [showForwardAnimation, setShowForwardAnimation] = useState(false);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const handleMouseEnterControls = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsHoveringControls(true);
    }
  };
  const handleMouseLeaveControls = () => {
    setIsHoveringControls(false);
  };
  const [isSearchOverlayActive, setIsSearchOverlayActive] = useState(false);

  // Connection status tracking to adapt streaming speeds
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dynamic viewport measurement state for iOS landscape maximizes
  const [viewportHeight, setViewportHeight] = useState('100%');

  useEffect(() => {
    if (!isMaximized) {
      setViewportHeight('100%');
      return;
    }

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight('100dvh');
      }
    };

    handleResize();
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMaximized]);

  // Prevent double-touch to zoom gestures on iOS Safari
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastTouchTime = 0;
    const handleTouchStart = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchTime < 300) {
        // Prevent double tap native zoom on iOS while retaining scrolling
        e.preventDefault();
      }
      lastTouchTime = now;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setIsSearchOverlayActive(true);
      setShowControls(false); // Force control system completely off
      setShowSpeedMenu(false); // Force speed overlay off
      setShowEpisodeMenu(false); // Force episode overlay off
    };
    const handleClose = () => {
      setIsSearchOverlayActive(false);
    };

    window.addEventListener('search-opened', handleOpen);
    window.addEventListener('search-closed', handleClose);

    return () => {
      window.removeEventListener('search-opened', handleOpen);
      window.removeEventListener('search-closed', handleClose);
    };
  }, []);

  // --- Professional Ad Management System (YouTube Style Embedded) ---
  const [adBreakActive, setAdBreakActive] = useState(false);
  const [adStage, setAdStage] = useState<'pre-countdown' | 'playing'>('pre-countdown');
  const [adCountdown, setAdCountdown] = useState(3);
  const [adIframeLoaded, setAdIframeLoaded] = useState(false);
  const [adLoadSeconds, setAdLoadSeconds] = useState(0);
  const [adIframeKey, setAdIframeKey] = useState(0);
  const [adsBlocked, setAdsBlocked] = useState(false);
  const adPointsRef = useRef<Set<number>>(new Set());
  const sessionStartTimeRef = useRef<number>(0);
  const AD_URL = "https://www.effectivecpmnetwork.com/n5afwdtr78?key=21317cc52736e0f8228abe7f47a236ca";

  useEffect(() => {
    // Probe the ad network domain silently upon load
    const probeAds = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        
        await fetch(AD_URL, { 
          mode: 'no-cors', 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (err) {
        // Adblocker detected or ad provider offline - bypass ads completely
        console.warn("Notice: Ad blocker detected or ad network unreachable. Activating full premium ad-free mode.");
        setAdsBlocked(true);
      }
    };
    probeAds();
  }, []);

  const showAdBreak = () => {
    // If user is premium or adblocker is active, skip ads entirely
    if (profile?.isPremium || adsBlocked) return;

    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setAdBreakActive(true);
    setAdStage('pre-countdown');
    setAdCountdown(3); // Undergoes 3 seconds premium countdown before showing ad Web iframe
    setAdIframeLoaded(false);
    setAdLoadSeconds(0);
    setAdIframeKey(prev => prev + 1);
  };

  useEffect(() => {
    if (!videoUrl) return;

    // Reset tracking for new video
    sessionStartTimeRef.current = Date.now();
    adPointsRef.current.clear(); // Allow points to re-trigger for new episode

    const interval = setInterval(() => {
      // 1. Session Timing (Wall Clock)
      const wallTimeSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

      // 2. Video Timing (Stream)
      const video = videoRef.current;
      const videoTimeSeconds = video ? Math.floor(video.currentTime) : 0;

      // Logic: Use video time for native, wall time for embeds
      const currentTime = isIframeFallback ? wallTimeSeconds : videoTimeSeconds;

      // Defined trigger seconds - no longer starting from 10 seconds to avoid annoying users!
      // Trigger at 5 minutes (300s), 15 minutes (900s), 25 minutes (1500s) etc.
      const triggerPoints = [300, 900, 1500, 2100];

      for (const pt of triggerPoints) {
        if (!adPointsRef.current.has(pt) && currentTime >= pt) {
          adPointsRef.current.add(pt);
          showAdBreak();
          break;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [videoUrl, isIframeFallback, adsBlocked]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (adBreakActive) {
      if (adStage === 'pre-countdown') {
        if (adCountdown > 0) {
          timer = setTimeout(() => setAdCountdown(prev => prev - 1), 1000);
        } else {
          // Pre-countdown finished, open the ad stage
          setAdStage('playing');
          setAdCountdown(5); // 5 seconds ad duration countdown
          setAdIframeLoaded(false);
          setAdLoadSeconds(0);
        }
      } else if (adStage === 'playing') {
        if (!adIframeLoaded) {
          if (adLoadSeconds >= 2) {
            // Elegant instant auto-bypass for blocked ad script / failed/slow network loading
            handleSkipAd();
          } else {
            timer = setTimeout(() => {
              setAdLoadSeconds(prev => prev + 1);
            }, 1000);
          }
        } else {
          if (adCountdown > 0) {
            timer = setTimeout(() => setAdCountdown(prev => prev - 1), 1000);
          }
        }
      }
    }
    return () => clearTimeout(timer);
  }, [adBreakActive, adStage, adCountdown, adIframeLoaded, adLoadSeconds]);

  const handleSkipAd = () => {
    setAdBreakActive(false);
    const video = videoRef.current;
    if (video) {
      // Restore correct active volume settings and unmute to secure the audio output
      video.muted = isMuted;
      video.volume = volume;
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };
  // ------------------------------------------------------------------

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'middle' | null }>({ time: 0, side: null });
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  // Dynamic PlayerJS Loader
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already loaded globally (i.e. if playerjsCode.js or a direct upload exists)
    if ((window as any).Playerjs) {
      setPlayerjsLoaded(true);
      return;
    }

    // Try to load custom playerjs.js from the public directory
    const script = document.createElement('script');
    script.src = '/playerjs.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).Playerjs) {
        console.log('PlayerJS custom copy loaded successfully from /public/playerjs.js');
        setPlayerjsLoaded(true);
      }
    };
    script.onerror = () => {
      console.log('Custom playerjs.js not found in public folder. Using sleek fallback native player.');
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize PlayerJS if loaded and direct stream is used (non-embed)
  useEffect(() => {
    if (!playerjsLoaded || isIframeFallback || !videoUrl) return;

    const PlayerjsClass = (window as any).Playerjs;
    if (!PlayerjsClass) return;

    // Destroy any existing playerjs instance first
    if (playerjsInstanceRef.current) {
      try {
        playerjsInstanceRef.current?.api('destroy');
      } catch (e) {
        console.warn('Error destroying playerjs:', e);
      }
      playerjsInstanceRef.current = null;
    }

    // Prepare container
    const container = document.getElementById('pjs-player');
    if (!container) return;
    container.innerHTML = '';

    setIsLoading(false);

    try {
      const pjs = new PlayerjsClass({
        id: 'pjs-player',
        file: videoUrl,
        autoplay: true,
      });

      playerjsInstanceRef.current = pjs;
    } catch (err) {
      console.error('Error starting PlayerJS:', err);
    }

    return () => {
      if (playerjsInstanceRef.current) {
        try {
          playerjsInstanceRef.current.api('destroy');
        } catch (e) {
          console.warn('Error destroying playerjs on cleanup:', e);
        }
        playerjsInstanceRef.current = null;
      }
    };
  }, [playerjsLoaded, videoUrl, isIframeFallback]);

  // Check if link is iframe/embed only or a standard direct video
  useEffect(() => {
    setIsLoading(true);
    setIsBuffering(false);
    setIsIframeFallback(false);
    
    if (!videoUrl) {
      return;
    }
    
    const urlLower = videoUrl.toLowerCase();
    
    // Explicitly handle our secure frame proxies
    if (urlLower.startsWith('/api/v1/secured-player')) {
      setIsIframeFallback(true);
      setIsLoading(false);
      setIsPlaying(true);
      return;
    }
    
    const isDirectVideo = 
      urlLower.includes('.mp4') || 
      urlLower.includes('.m3u8') || 
      urlLower.includes('.webm') || 
      urlLower.includes('.ogg') || 
      urlLower.includes('.mov') ||
      urlLower.includes('.jpg') ||
      urlLower.includes('.png');

    if (!isDirectVideo) {
      setIsIframeFallback(true);
      setIsLoading(false);
      setIsPlaying(true);
      return;
    }

    if (playerjsLoaded) {
      // If PlayerJS is active, we let it manage itself
      setIsLoading(false);
      return;
    }

    // Direct stream initialization for the fallback native player
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (urlLower.includes('.m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 180,          // Load up to 180 seconds ahead of time for ultimate slow network safety
          maxMaxBufferLength: 360,       // Max buffer capacity up to 6 minutes of continuous streaming
          maxBufferSize: 180 * 1024 * 1024, // Aggressively cache video content in RAM
          progressive: true,
          capLevelToPlayerSize: true,    // Matches stream level size dynamically to save bandwidth on mobile
          autoStartLoad: true,
          abrBandWidthFactor: 0.95,      // Optimistic but robust bandwidth filter
          abrBandWidthUpFactor: 0.4,     // Super cautious up-scaling so weak data doesn't suddenly stutter
          testBandwidth: true,
          backBufferLength: 90,          // Hold loaded history so reverse scrubbing doesn't trigger reloading
          appendErrorMaxRetry: 12,       // Aggressively retry loads before failing in poor signals
          fragLoadingMaxRetry: 8,         // Retry fragmented chunks frequently on bad connections
          manifestLoadingMaxRetry: 8,
          levelLoadingMaxRetry: 8,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setIsBuffering(false);
          resumeWatchProgress();
          video.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("HLS network error, attempting recovery level reload:", data);
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("HLS media fatal error, attempting recovery:", data);
                hls?.recoverMediaError();
                break;
              default:
                console.warn("HLS unrecoverable fatal error, falling back to iframe:", data);
                setIsIframeFallback(true);
                setIsLoading(false);
                break;
            }
          } else {
            // Treat fragment load errors as weak network warnings & downgrade quality to index 0 dynamically!
            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
              console.warn("Weak network connection detected. Forcing stream resolution downgrade to zero.", data);
              if (hls) {
                hls.currentLevel = 0; // Force lowest resolution level index to maintain zero buffers!
                hls.startLoad();
              }
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
        video.load(); // Explicitly trigger hardware media system on Safari & iOS
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setIsBuffering(false);
          resumeWatchProgress();
          video.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        });
      } else {
        setIsIframeFallback(true);
        setIsLoading(false);
      }
    } else {
      // Regular streaming files (MP4/WebM)
      video.src = videoUrl;
      video.load(); // Explicitly call .load() for instant cross-browser parsing
      const onPlayable = () => {
        setIsLoading(false);
        setIsBuffering(false);
        resumeWatchProgress();
        video.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
        video.removeEventListener('canplay', onPlayable);
      };
      video.addEventListener('canplay', onPlayable);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      if (video) {
        video.pause();
        video.src = '';
      }
    };
  }, [videoUrl, episodeIndex, playerjsLoaded]);

  // Resume progress logic
  const resumeWatchProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    const savedSecond = progressService.getProgress(seriesId, episodeIndex);
    if (savedSecond > 0 && savedSecond < (video.duration || 100000)) {
      video.currentTime = savedSecond;
    }
  };

  // Auto-Save watch progress every 4 seconds
  useEffect(() => {
    if (isIframeFallback || playerjsLoaded) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && isPlaying && video.currentTime > 5) {
        progressService.saveProgress(seriesId, episodeIndex, video.currentTime);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying, isIframeFallback, seriesId, episodeIndex, playerjsLoaded]);

  // Mouse activity or interactions to reset the controls timer
  const resetControlsTimeout = (forceShow: boolean = false) => {
    if (forceShow) {
      setShowControls(true);
    }
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }

    if (showControls) {
      const isTV = /SmartTV|WebOS|Tizen|AppleTV|AndroidTV|GoogleTV|Opera TV|Viera|SonyDTV/i.test(navigator.userAgent);
      
      // If speed menu or episode menu or search is active, do not auto-hide controls to let the user select
      if (showSpeedMenu || showEpisodeMenu || isSearchOverlayActive) {
        return;
      }

      // If hovering controls on desktop, keep it visible. On TV, bypass hover lock because magic remote pointer sticks.
      if (isHoveringControls && !isTV) {
        return;
      }

      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000); // 3 seconds timeout
    }
  };

  // Toggle controls visibility cleanly and securely
  const toggleControls = () => {
    setShowControls(prev => !prev);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, [showControls, isPlaying, showSpeedMenu, showEpisodeMenu, isHoveringControls, isSearchOverlayActive]);

  // Handle Play/Pause Action
  const handlePlayPause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setShowControls(false); // Do not show controls on pause! Keep clean screen as explicitly requested.
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowControls(false); // Do not show controls on play/resume! Keep clean screen.
    }
  };

  // Core gesture state machine
  const handleInteraction = (clientX: number, clientY: number, currentTarget: HTMLElement) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = currentTarget.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const clickPercent = clickX / width;
    const clickPercentY = clickY / height;

    // Define coordinates for the EXACT absolute center interaction (بالنص فقط لا فوق ولا تحت)
    const isExactCenter = (clickPercent >= 0.35 && clickPercent <= 0.65) && (clickPercentY >= 0.35 && clickPercentY <= 0.65);

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 280;

    let zone: 'left' | 'right' | 'middle' = 'middle';
    if (clickPercent < 0.3) {
      zone = 'left';
    } else if (clickPercent > 0.7) {
      zone = 'right';
    }

    const isDoubleTap = !isExactCenter && (zone === 'left' || zone === 'right') &&
                        (zone === lastTapRef.current.side) &&
                        (now - lastTapRef.current.time < DOUBLE_TAP_DELAY);

    lastTapRef.current = { time: now, side: zone };

    if (isDoubleTap) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }

      if (zone === 'left') {
        skipTime(-10);
      } else {
        skipTime(10);
      }
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const executeClick = () => {
      setShowSpeedMenu(false);
      setShowEpisodeMenu(false);
      toggleControls();
    };

    if (isExactCenter) {
      // EXACT CENTER (بالنص فقط): Toggle play/pause only, keep controls strictly hidden
      setShowSpeedMenu(false);
      setShowEpisodeMenu(false);
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
        setShowControls(false); // Do not show controls on pause! Keep clean screen as explicitly requested.
      } else {
        video.play().catch(() => {});
        setIsPlaying(true);
        setShowControls(false); // Do not show controls on play/resume! Keep clean screen.
      }
    } else {
      // Clicking anywhere outside the EXACT center (top, bottom, left/right margins) toggles controls
      if (zone === 'middle') {
        executeClick();
      } else {
        clickTimeoutRef.current = setTimeout(() => {
          executeClick();
          clickTimeoutRef.current = null;
        }, DOUBLE_TAP_DELAY);
      }
    }
  };

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('a') ||
      target.closest('.custom-scrollbar') ||
      target.closest('.no-toggle')
    ) {
      return;
    }

    handleInteraction(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePlayerTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('a') ||
      target.closest('.custom-scrollbar') ||
      target.closest('.no-toggle')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    lastTouchTimeRef.current = Date.now();
    const touch = e.touches[0] || e.changedTouches[0];
    if (touch) {
      handleInteraction(touch.clientX, touch.clientY, e.currentTarget);
    }
  };

  const handleVideoError = () => {
    console.warn("Native video playback failed, falling back to iframe player.");
    setIsIframeFallback(true);
    setIsLoading(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    onTimeUpdate?.(currentTime);
  }, [currentTime, onTimeUpdate]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || isNaN(duration) || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    
    video.currentTime = clickPercent * duration;
    setCurrentTime(video.currentTime);
    resetControlsTimeout();
  };

  const skipTime = (amount: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + amount), duration);
    setCurrentTime(video.currentTime);
    resetControlsTimeout(showControls);

    if (amount < 0) {
      setShowRewindAnimation(true);
      setTimeout(() => setShowRewindAnimation(false), 800);
    } else {
      setShowForwardAnimation(true);
      setTimeout(() => setShowForwardAnimation(false), 800);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.volume = val;
      video.muted = val === 0;
      setVolume(val);
      setIsMuted(val === 0);
    }
    resetControlsTimeout();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    resetControlsTimeout();
  };

  const handleSpeedChange = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSpeedMenu(false);
    resetControlsTimeout();
  };

  const toggleBrowserFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!container) return;

    // Check if any element is already in fullscreen
    const isFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;

    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } else {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        if (isIframeFallback) {
          // If playing inside an iframe on iOS, cross-origin security prevents us from touching the inner video.
          // Therefore, we MUST use our custom high-performance CSS fullscreen (Cinema Mode) which fits the screen perfectly.
          onToggleMaximize();
        } else {
          // iOS Safari on iPhone requires native video fullscreen to hide Safari's URL/address bar completely!
          // We find the active video element (could be our native fallback video or a playerjs video)
          const targetVideo = video || document.querySelector('#pjs-player video') || document.querySelector('video');
          if (targetVideo && (targetVideo as any).webkitEnterFullscreen) {
            try {
              (targetVideo as any).webkitEnterFullscreen();
            } catch (e) {
              console.error("Failed to enter webkitEnterFullscreen, falling back to CSS maximize", e);
              onToggleMaximize();
            }
          } else {
            onToggleMaximize();
          }
        }
      } else {
        // Desktop/Other: Use native Fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => onToggleMaximize());
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if (video && (video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        } else {
          onToggleMaximize();
        }
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={() => resetControlsTimeout(false)}
      onMouseLeave={() => isPlaying && !isHoveringControls && setShowControls(false)}
      onClick={handlePlayerClick}
      className={cn(
        "relative select-none flex flex-col items-center justify-center bg-black overflow-hidden group w-full h-full text-white cursor-pointer transition-all duration-300 touch-manipulation",
        isSearchOverlayActive ? "z-0 pointer-events-none opacity-0 select-none scale-95" : "",
        isMaximized 
          ? (isSearchOverlayActive ? "fixed inset-0 w-full z-0 opacity-0 pointer-events-none" : "fixed inset-0 w-screen h-[100dvh] z-[99999] p-0 m-0 border-none rounded-none") 
          : "aspect-video rounded-xl border border-white/5"
      )}
      style={isMaximized ? { height: viewportHeight, width: '100vw', top: 0, left: 0 } : undefined}
    >
      {!videoUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 gap-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
          <p className="text-zinc-400 text-sm font-bold tracking-widest text-center px-4">جاري تجهيز سيرفرات المشغل المباشر...</p>
        </div>
      ) : isIframeFallback ? (
        // Iframe / Web Embed Player view
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {!adBreakActive ? (
            <iframe 
              src={videoUrl}
              className="w-full h-full border-none"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              title="External Movie Player"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-500 font-bold text-xs gap-2 select-none">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <span>جاري تشغيل الفاصل الإعلاني المؤقت...</span>
            </div>
          )}
          
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
            <button
              onClick={() => setShowEpisodeMenu(!showEpisodeMenu)}
              className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all text-[10px] font-black uppercase tracking-wider shadow-2xl"
            >
              <List className="w-4 h-4 text-primary" />
              اختيار حلقة
            </button>
            
            <button
              onClick={toggleBrowserFullscreen}
              className="p-2 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all shadow-2xl"
              title={isMaximized ? "تصغير الشاشة" : "تكبير الشاشة"}
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : playerjsLoaded ? (
        // Dynamic custom PlayerJS renderer container
        <div className="relative w-full h-full">
          <div id="pjs-player" className="w-full h-full bg-black" />
          
          {/* Transparent bar for floating episode and maximize triggers on PlayerJS */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
            <button
              onClick={(e) => { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); }}
              className="flex items-center gap-2 bg-black/85 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all text-[10px] font-black uppercase tracking-wider shadow-2xl"
            >
              <List className="w-4 h-4 text-primary" />
              الحلقات
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleBrowserFullscreen(); }}
              className="p-2 bg-black/85 backdrop-blur-md rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all shadow-2xl"
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        // High fidelity completely updated stable native fallback player (Netflix / YouTube styling)
        <>
          {isLoading && (
            <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black gap-4 select-none">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/30" />
              <div className="flex flex-col items-center gap-1.5 text-center px-6">
                <p className="text-white text-sm font-black tracking-widest uppercase">جاري التجهيز والتشغيل...</p>
                <p className="text-zinc-500 text-[10px] font-bold">يرجى الانتظار لحين تحميل سيرفرات البث المستقر</p>
                {isOffline && (
                  <span className="mt-2 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black animate-pulse">
                     ⚠️ أنت غير متصل بالإنترنت حالياً
                  </span>
                )}
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleVideoError}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => { setIsBuffering(false); setIsLoading(false); }}
            onSeeking={() => setIsBuffering(true)}
            onSeeked={() => setIsBuffering(false)}
            onStalled={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onCanPlayThrough={() => setIsBuffering(false)}
            preload="auto"
            className={cn(
              "w-full h-full object-contain pointer-events-none transition-all duration-500",
              !isPlaying ? "opacity-60 blur-[2px]" : "opacity-100 blur-0"
            )}
            playsInline={true}
            tabIndex={-1}
            disablePictureInPicture={true}
            disableRemotePlayback={true}
            controlsList="nodownload nofullscreen noremoteplayback"
            controls={false}
            {...{
              "x-webkit-airplay": "deny",
              "aria-hidden": "true"
            }}
          />

          {!isLoading && (
            <>
              {/* Paused Overlay Dimming Layer */}
              {!isPlaying && (
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-[2px] pointer-events-none" />
              )}

              {/* Master Video overlay gestures & controls layer */}
              <div 
                onClick={handlePlayerClick}
                onTouchStart={handlePlayerTouch}
                className="absolute inset-0 z-[100] select-none touch-none cursor-pointer flex items-center justify-center"
              >
                {/* Left side rewinding feedback animation */}
                <div className="absolute left-[10%] sm:left-[15%] pointer-events-none z-20">
                  <AnimatePresence>
                    {showRewindAnimation && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1.1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center justify-center bg-black/85 text-white rounded-full w-20 h-20 border border-white/10 shadow-[0_0_30px_rgba(229,9,20,0.3)]"
                      >
                        <RotateCcw className="w-8 h-8 text-primary animate-pulse" />
                        <span className="text-[10px] font-black tracking-wider mt-1">10- ث</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Central Play indicator overlay */}
                <div className="pointer-events-none z-20">
                  <div className={cn(
                    "transition-all duration-300 transform",
                    !isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-90"
                  )}>
                    <div className="w-12 h-12 bg-black/80 backdrop-blur-md border border-white/15 rounded-full text-white flex items-center justify-center shadow-2xl">
                      <Play className="w-5 h-5 text-primary fill-primary ml-0.5 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Right side forwarding feedback animation */}
                <div className="absolute right-[10%] sm:right-[15%] pointer-events-none z-20">
                  <AnimatePresence>
                    {showForwardAnimation && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1.1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center justify-center bg-black/85 text-white rounded-full w-20 h-20 border border-white/10 shadow-[0_0_30px_rgba(229,9,20,0.3)]"
                      >
                        <RotateCw className="w-8 h-8 text-primary animate-pulse" />
                        <span className="text-[10px] font-black tracking-wider mt-1">10+ ث</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Master custom controls layout (Premium Translucent Dashboard) */}
              <div 
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={handleMouseEnterControls}
                onMouseLeave={handleMouseLeaveControls}
                className={cn(
                  "absolute inset-x-0 bottom-0 z-[120] p-1.5 transition-all duration-300 flex flex-col gap-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pl-[calc(0.375rem+env(safe-area-inset-left))] pr-[calc(0.375rem+env(safe-area-inset-right))]",
                  (showControls && !isSearchOverlayActive) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                )}
              >
            <div className="bg-[#0c0c10]/98 border border-white/5 rounded-xl p-1.5 sm:p-2 flex flex-col gap-1 shadow-[0_24px_60px_rgba(0,0,0,0.95)]">
              
              {/* Timeline slider row */}
              <div className="flex flex-col gap-0.5 w-full">
                <div 
                  onClick={handleSeek}
                  className="h-1.5 w-full bg-zinc-900/90 border border-white/[0.03] rounded-full cursor-pointer relative group/timeline"
                >
                  {/* Crimson Progress fill */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.7)] rounded-full transition-all duration-75"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                  
                  {/* Handle indicator */}
                  <div 
                    className="absolute top-1/2 -track-translate-y-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-primary scale-0 group-hover/timeline:scale-100 transition-transform duration-150 shadow-lg shadow-black/80"
                    style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                  />
                </div>

                {/* Video Duration metrics */}
                <div className="flex justify-between text-[10px] font-black tracking-wider text-zinc-400 font-mono">
                  <span>{formatTime(duration)}</span>
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>

              {/* Functional Dashboard Options Row */}
              <div className="flex flex-row items-center justify-between w-full gap-2">
                
                {/* Left controls: Volume, Play/Pause, Rewind, Fast Forward */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={handlePlayPause}
                    className="p-1.5 bg-primary hover:bg-[#c10d10] text-white rounded-full transition-all active:scale-95 shadow-lg shadow-primary/30"
                    title={isPlaying ? "إيقاف" : "تشغيل"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>

                  <button 
                    onClick={(e) => skipTime(-10, e)}
                    className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95"
                    title="الرجوع 10 ثواني"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button 
                    onClick={(e) => skipTime(10, e)}
                    className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95"
                    title="التقديم 10 ثواني"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Volume Controller with seamless popup */}
                  <div className="flex items-center gap-1 group/volume pl-1 border-l border-white/5">
                    <button 
                      onClick={toggleMute}
                      className="p-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-zinc-500" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-8 sm:w-12 accent-primary h-1 bg-zinc-800 rounded-lg cursor-pointer transition-all opacity-40 group-hover/volume:opacity-100 focus:opacity-100"
                    />
                  </div>
                </div>

                {/* Right controls: Speed Modifier, Episode List toggle, Fullscreen */}
                <div className="flex items-center gap-1.5 shrink-0">
                  
                  {/* Playback rate settings menu switcher */}
                  <div className="relative">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); setShowEpisodeMenu(false); }}
                      className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all"
                    >
                      <Settings className="w-3 h-3 text-zinc-400 animate-spin-slow" />
                      {playbackRate}x
                    </button>

                    {showSpeedMenu && (
                      <div className="absolute bottom-full mb-2 left-0 w-20 bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-40 flex flex-col p-1">
                        {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={cn(
                              "w-full text-center py-1 rounded-md text-[9px] font-bold transition-all px-1.5 text-right",
                              playbackRate === speed ? "bg-primary text-white" : "hover:bg-white/5 text-zinc-400"
                            )}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fully polished EPISODES Switcher drawer */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); setShowSpeedMenu(false); }}
                    className="flex items-center gap-1.5 bg-primary/25 hover:bg-primary/35 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-primary/40 text-white font-black text-[10px] sm:text-xs tracking-tight shadow-xl active:scale-95 transition-all pointer-events-auto"
                  >
                    <List className="w-3.5 h-3.5 text-primary" />
                    <span>الحلقات</span>
                  </button>

                  {/* Browser fullscreen trigger */}
                  <button 
                    onClick={toggleBrowserFullscreen}
                    className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-white/5"
                    title="ملئ الشاشة"
                  >
                    {isMaximized ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                  </button>
                </div>

              </div>
            </div>
          </div>
          </>)}
        </>
      )}

      {/* YOUTUBE-STYLE FULLSCREEN AD OVERLAY */}
      <AnimatePresence>
        {adBreakActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[400] bg-black overflow-hidden flex flex-col no-toggle"
            onClick={(e) => e.stopPropagation()}
          >
            {adStage === 'pre-countdown' ? (
              /* Pre-countdown screen before launching ad content */
              <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-white p-6 relative select-none">
                <div className="absolute inset-0 bg-radial-gradient from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                <div className="relative flex flex-col items-center gap-6 max-w-sm text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-[10px] text-primary font-black animate-pulse">
                    <Sparkles className="w-3 h-3 fill-current" />
                    <span>محبوب الجماهير: حكايتنا</span>
                  </span>

                  <h3 className="text-xl sm:text-2xl font-black text-white/95 leading-snug font-sans">
                    سيظهر الإعلان المدعوم بعد ثوانٍ قليلة لضمان استمرار السيرفرات المجانية بجودة عالية
                  </h3>

                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-primary animate-spin" />
                    <span className="text-4xl font-black text-primary font-mono animate-bounce">{adCountdown}</span>
                  </div>

                  <p className="text-zinc-500 text-xs font-bold leading-relaxed px-4">
                    يمكنك الحصول على اشتراك بريميوم خالٍ تماماً من الإعلانات بمشاركة الرابط الخاص بك مع أقاربك وأصدقائك وكسب 10 نقاط!
                  </p>
                </div>
              </div>
            ) : (
              /* Actual Playing Ad State */
              <>
                {/* Header Information Bar */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-6 z-20 pointer-events-none">
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">محتوى إعلاني مدعوم</span>
                  </div>
                </div>

                {/* Main Ad Content (Embedded Iframe) */}
                <div className="flex-1 w-full bg-white relative">
                  <iframe 
                    key={adIframeKey}
                    src={`${AD_URL}&cb=${adIframeKey}`} 
                    className="w-full h-full border-none pointer-events-auto"
                    title="Advertisement"
                    onLoad={() => setAdIframeLoaded(true)}
                    referrerPolicy="no-referrer"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
                  />
                  {!adIframeLoaded && (
                    <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center flex-col gap-4 p-8 select-none text-center">
                      {/* Premium Animated Background */}
                      <div className="absolute inset-0 bg-radial-gradient from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none animate-pulse" />
                      
                      <div className="relative z-10 flex flex-col items-center gap-4 max-w-sm">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <div className="absolute inset-x-0 inset-y-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                        </div>

                        <h3 className="text-lg font-extrabold text-white font-sans leading-snug">
                          جاري تهيئة خوادم الإرسال الداعم...
                        </h3>
                        
                        <p className="text-zinc-400 text-xs font-semibold leading-relaxed">
                          يتم الآن فحص اتصال الإرسال الآمن لضمان استمرار تشغيل السيرفرات مجاناً بجودة ممتازة. ({adLoadSeconds}ث)
                        </p>

                        {adLoadSeconds >= 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdIframeKey(prev => prev + 1);
                              setAdLoadSeconds(0);
                            }}
                            className="mt-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white font-black transition-all active:scale-95 flex items-center gap-2 backdrop-blur-md"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                            تحديث الاتصال والتحميل الفوري 🔄
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Corner Skip Button Overlay */}
                <div className="absolute bottom-8 right-0 z-30 flex flex-col items-end gap-2 pr-0">
                  {/* Skip is allowed if countdown reaches 0 OR if advertisement load exceeds 4 seconds */}
                  {(!adIframeLoaded && adLoadSeconds < 4) || (adIframeLoaded && adCountdown > 0) ? (
                    <div className="bg-black/95 backdrop-blur-xl border border-white/10 border-r-0 px-6 py-3 rounded-l-xl text-white font-black text-xs tracking-widest flex items-center gap-3 select-none">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      {!adIframeLoaded ? `جاري التحميل... (${4 - adLoadSeconds}ث)` : `يمكنك التخطي بعد ${adCountdown}`}
                    </div>
                  ) : (
                    <motion.button 
                      initial={{ x: 100 }}
                      animate={{ x: 0 }}
                      onClick={handleSkipAd}
                      className="bg-primary text-white hover:bg-white hover:text-black hover:scale-105 px-8 py-4 rounded-l-2xl border border-white/20 border-r-0 transition-all font-black text-sm uppercase tracking-widest shadow-[0_0_40px_rgba(229,9,20,0.5)] flex items-center gap-3 active:scale-95"
                    >
                      تخطي الإعلان
                      <ArrowRight className="w-4 h-4 text-white" />
                    </motion.button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* EPISODE LIST OVERLAY */}
      <AnimatePresence>
        {showEpisodeMenu && (
          <>
             {/* Backdrop for the drawer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEpisodeMenu(false)}
              className="absolute inset-0 bg-black/85 z-[340] cursor-pointer"
            />
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-80 max-w-[80vw] h-full bg-[#07070a]/99 border-l border-white/10 z-[350] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col p-6 pr-[calc(1.5rem+env(safe-area-inset-right))] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex flex-col text-right">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider">قائمة الحلقات</h3>
                  <span className="text-[9px] text-zinc-500 font-bold">بث فوري سريع</span>
                </div>
                <button 
                  onClick={() => setShowEpisodeMenu(false)}
                  className="text-[10px] font-black text-zinc-400 hover:text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1 pb-10">
                {/* SERVER SELECTOR */}
                <div>
                  <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3 px-1">سيرفرات المشاهدة</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {servers.map((srv, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => onSelectServer(srv.url)} 
                        className={cn(
                          "w-full text-right p-3 rounded-xl text-xs font-bold transition-all border",
                          srv.url === videoUrl 
                            ? "bg-primary border-primary text-white" 
                            : "bg-zinc-900/40 border-white/5 text-zinc-300 hover:bg-zinc-800"
                        )}
                      >
                        {srv.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* EPISODES */}
                <div>
                  <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3 px-1">الحلقات</h3>
                  <HorizontalEpisodeList 
                    episodes={episodes}
                    currentIndex={episodeIndex}
                    seriesImage={seriesImage}
                    seriesId={seriesId}
                    onSelect={(ep, idx) => onSelectEpisode(ep, idx)}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CustomPlayer;
