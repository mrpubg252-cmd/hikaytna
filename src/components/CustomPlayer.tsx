import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  RotateCcw, RotateCw, List, Settings, CheckCircle2, X,
  ArrowRight, Sparkles, Shield, ExternalLink, ChevronLeft,
  AlertTriangle, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Episode } from '../services/firebase';
import { progressService } from '../services/progressService';
import HorizontalEpisodeList from './HorizontalEpisodeList';
import { useDevice } from '../context/DeviceAndNavigationContext';
import { formatEpisodeTitle } from './EpisodeGrid';
import { encryptValue } from '../lib/security';

interface CustomPlayerProps {
  videoUrl: string;
  activeServerUrl?: string;
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
  seriesCategory?: string;
  seriesTitle?: string;
}

interface ShadowVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  className?: string;
  onTimeUpdate?: (e: any) => void;
  onLoadedMetadata?: (e: any) => void;
  onError?: (e: any) => void;
  onWaiting?: (e: any) => void;
  onPlaying?: (e: any) => void;
  onSeeking?: (e: any) => void;
  onSeeked?: (e: any) => void;
  onStalled?: (e: any) => void;
  onCanPlay?: (e: any) => void;
  onCanPlayThrough?: (e: any) => void;
}

const ShadowVideo: React.FC<ShadowVideoProps> = ({
  videoRef,
  isPlaying,
  isMuted,
  className,
  onTimeUpdate,
  onLoadedMetadata,
  onError,
  onWaiting,
  onPlaying,
  onSeeking,
  onSeeked,
  onStalled,
  onCanPlay,
  onCanPlayThrough,
}) => {
  const { isTV, isMobile } = useDevice();
  const hostRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const isIOS = typeof window !== 'undefined' ? 
    (/iPhone|iPad|iPod/.test(window.navigator.userAgent) || 
     (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)) : false;

  // Enforce zero controls on smart TV, iOS, and mobile browser fallbacks
  React.useEffect(() => {
    if ((!isTV && !isIOS && !isMobile) || !videoRef.current) return;
    const video = videoRef.current;
    
    // Force controls off at load
    video.controls = false;
    video.removeAttribute('controls');
    video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    (video as any).disablePictureInPicture = true;
    (video as any).disableRemotePlayback = true;
    (video as any).webkitPlaysInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    
    const interval = setInterval(() => {
      if (video.controls) {
        video.controls = false;
        video.removeAttribute('controls');
      }
    }, 500); // Increased interval to 500ms for better performance
    
    return () => clearInterval(interval);
  }, [isTV, isMobile, videoRef]);

  // If it's a TV, iOS device (Safari mobile), or mobile browser, fallback to standard React video tag
  // Web browser engines fail to respect playsinline and trigger native player hijack when placed inside Closed Shadow Roots.
  if (isTV || isIOS || isMobile) {
    return (
      <video
        ref={videoRef as any}
        className={className}
        playsInline
        autoPlay
        muted={isMuted}
        x-webkit-airplay="deny"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onError={onError}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onSeeking={onSeeking}
        onSeeked={onSeeked}
        onStalled={onStalled}
        onCanPlay={onCanPlay}
        onCanPlayThrough={onCanPlayThrough}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          backgroundColor: 'transparent',
          transition: 'all 500ms ease',
          opacity: '1',
          filter: 'none'
        }}
      />
    );
  }

  // Non-TV standard behavior (Shadow DOM)
  return <ShadowVideoInternal 
      videoRef={videoRef} isPlaying={isPlaying} isMuted={isMuted} className={className} 
      onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata} onError={onError}
      onWaiting={onWaiting} onPlaying={onPlaying} onSeeking={onSeeking}
      onSeeked={onSeeked} onStalled={onStalled} onCanPlay={onCanPlay} onCanPlayThrough={onCanPlayThrough}
  />;
};

// Extracted internal component to prevent hook rules violation
const ShadowVideoInternal: React.FC<ShadowVideoProps> = ({
  videoRef,
  isPlaying,
  isMuted,
  className,
  onTimeUpdate,
  onLoadedMetadata,
  onError,
  onWaiting,
  onPlaying,
  onSeeking,
  onSeeked,
  onStalled,
  onCanPlay,
  onCanPlayThrough,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.muted = isMuted;
    }
  }, [isMuted]);
  
  React.useLayoutEffect(() => {
    if (!hostRef.current) return;
    
    const shadowRoot = hostRef.current.attachShadow({ mode: 'closed' });
    const video = document.createElement('video');
    video.muted = isMuted; // Set initial muted state
    video.preload = 'auto';

    video.tabIndex = -1;
    video.controls = false;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;
    
    // Prevent downloads, PiP, etc.
    video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    (video as any).disablePictureInPicture = true;
    (video as any).disableRemotePlayback = true;

    // Mobile/TV browser inline plays attributes
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true');
    video.setAttribute('x5-video-player-type', 'h5-page');
    video.setAttribute('x5-video-player-fullscreen', 'false');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.setAttribute('aria-hidden', 'true');

    // CSS Styling for Shadow Root (Tailwind cannot enter a closed shadow)
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.pointerEvents = 'none';
    video.style.backgroundColor = 'transparent';
    video.style.transition = 'all 500ms ease';
    video.style.opacity = isPlaying ? '1' : '0.9'; // Increased opacity for better visibility
    // Removed blur filter for mobile/TV performance optimization
    
    shadowRoot.appendChild(video);
    videoElementRef.current = video;

    // Constantly suppress controls via frequency intervals
    const interval = setInterval(() => {
      if (video.controls) {
        video.controls = false;
        video.removeAttribute('controls');
      }
    }, 500);

    // Bind ref
    if (videoRef) {
      (videoRef as any).current = video;
    }

    // Forward listeners safely to replicate React element behaviour
    const listeners: { [key: string]: (e: Event) => void } = {
      timeupdate: (e) => onTimeUpdate?.(e),
      loadedmetadata: (e) => onLoadedMetadata?.(e),
      error: (e) => onError?.(e),
      waiting: (e) => onWaiting?.(e),
      playing: (e) => onPlaying?.(e),
      seeking: (e) => onSeeking?.(e),
      seeked: (e) => onSeeked?.(e),
      stalled: (e) => onStalled?.(e),
      canplay: (e) => onCanPlay?.(e),
      canplaythrough: (e) => onCanPlayThrough?.(e),
    };

    Object.keys(listeners).forEach((event) => {
      video.addEventListener(event, listeners[event]);
    });

    return () => {
      clearInterval(interval);
      Object.keys(listeners).forEach((event) => {
        video.removeEventListener(event, listeners[event]);
      });
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (err) {
        console.warn('ShadowVideo cleanup error on unmount:', err);
      }
      if (videoRef) {
        (videoRef as any).current = null;
      }
    };
  }, [videoRef]);

  // Handle playing style update dynamically
  useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.style.opacity = isPlaying ? '1' : '0.9';
    }
  }, [isPlaying]);

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%' }} />;
};

const CustomPlayer = forwardRef((props: CustomPlayerProps, ref) => {
  const {
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
    onTimeUpdate,
    seriesCategory,
    seriesTitle,
  } = props;

  const resolvedVideoUrl = React.useMemo(() => {
    if (!videoUrl) return '';
    
    let target = videoUrl;

    if (target.includes('mega.nz')) {
      // Convert standard Mega file URLs into the embed URL representation
      // e.g. /file/... -> /embed/...
      target = target.replace(/\/file\//i, '/embed/');
    }

    // Wrap Dailymotion, iplayerhls, arabveturk and cdnz in our proxy
    if (target.includes('dailymotion.com') || target.includes('iplayerhls.com') || target.includes('cdnz.online') || target.includes('arabveturk.com') || target.includes('arbtrk') || target.includes('artrk') || target.includes('huntrexus.com')) {
      try {
        const encrypted = encryptValue(target);
        if (target.includes('.m3u8') || target.includes('.mp4')) {
           return `/api/v1/stream-proxy/${encodeURIComponent(encrypted)}`;
        }
        return `/api/v1/3isk-player?url=${encodeURIComponent(encrypted)}`;
      } catch (e) {
        console.warn('[CustomPlayer] Encryption failed:', e);
      }
    }

    return target;
  }, [videoUrl]);

  const { profile } = useAuth();
  const { isTV, isMobile } = useDevice();
  const isLowEnd = isMobile || isTV; // Optimization flag for reduced motion/effects
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPositionRef = useRef<number>(0);

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
  const [isForceRotated, setIsForceRotated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkStandalone = () => {
        const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const navigatorStandalone = (window.navigator as any).standalone === true;
        setIsStandalone(displayModeStandalone || navigatorStandalone || !!(document.referrer && document.referrer.includes('android-app://')));
      };
      checkStandalone();
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', checkStandalone);
        return () => mediaQuery.removeEventListener('change', checkStandalone);
      }
    }
  }, []);

  const isIOSDevice = typeof window !== 'undefined' ? 
    (/iPhone|iPad|iPod/.test(window.navigator.userAgent) || 
     (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)) : false;
  const useCssRotationFallback = isForceRotated && isIOSDevice;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeekingState, setIsSeekingState] = useState(false);
  const seekTrackerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('player_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('player_muted');
    return saved === 'true';
  });

  // Keep video mute state in sync and save to localStorage
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
    localStorage.setItem('player_muted', isMuted ? 'true' : 'false');
  }, [isMuted, videoRef.current]);

  // Keep volume in sync and save to localStorage
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    localStorage.setItem('player_volume', volume.toString());
  }, [volume, videoRef.current]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [showCategoryOverlay, setShowCategoryOverlay] = useState(false);

  useEffect(() => {
    if (videoUrl && seriesCategory) {
      setShowCategoryOverlay(true);
      const timer = setTimeout(() => {
        setShowCategoryOverlay(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [videoUrl, seriesCategory]);

  // Master Dynamic Media Session Lockscreen Widget Sync
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const epNum = episodeIndex + 1;
    const currentEpisodeObj = episodes[episodeIndex];
    const displayEpTitle = currentEpisodeObj ? (currentEpisodeObj.title || `الحلقة ${epNum}`) : `الحلقة ${epNum}`;

    const formattedSeriesTitle = seriesTitle || "مسلسل";
    const min = Math.floor(currentTime / 60);
    const sec = Math.floor(currentTime % 60);
    const formattedProgress = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    // Ensure the image URL is fully absolute for iOS/Android media session widgets to fetch successfully
    let absoluteImage = seriesImage || "";
    if (absoluteImage) {
      if (!absoluteImage.startsWith('http://') && !absoluteImage.startsWith('https://')) {
        if (absoluteImage.startsWith('/')) {
          absoluteImage = `${window.location.origin}${absoluteImage}`;
        } else {
          absoluteImage = `${window.location.origin}/${absoluteImage}`;
        }
      }
    } else {
      absoluteImage = `${window.location.origin}/logo.png`;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${displayEpTitle} - وصل إلى الدقيقة [ ${formattedProgress} ]`,
      artist: formattedSeriesTitle,
      album: "حكايتنا - بث مباشر بجودة عالية 🎬",
      artwork: [
        { src: absoluteImage, sizes: "512x512", type: "image/jpeg" },
        { src: absoluteImage, sizes: "256x256", type: "image/png" },
        { src: absoluteImage, sizes: "192x192", type: "image/png" }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        setIsPlaying(false);
      }
    });

    if (duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: currentTime
        });
      } catch (err) {
        console.warn("MediaSession setPositionState error:", err);
      }
    }
  }, [seriesTitle, episodeIndex, episodes, currentTime, duration, seriesImage]);

  const [isVolumeAdjustMode, setIsVolumeAdjustMode] = useState(false);
  const [blockPopups, setBlockPopups] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [localToast, setLocalToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setLocalToast({ text, type });
  };

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => {
        setLocalToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [resumeTimeText, setResumeTimeText] = useState('');
  const lastButtonClickTimeRef = useRef<number>(0);
  const [isIframeFallback, setIsIframeFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutOptions, setShowTimeoutOptions] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const isLocalOfflineVideo = videoUrl && videoUrl.startsWith('blob:');
  const [showOfflineNotification, setShowOfflineNotification] = useState(false);
  const [showRewindAnimation, setShowRewindAnimation] = useState(false);
  const [showForwardAnimation, setShowForwardAnimation] = useState(false);
  const [isSpeedingUp, setIsSpeedingUp] = useState(false);
  const originalSpeedRef = useRef<number>(1);
  const longPressTimeoutRef = useRef<any>(null);
  const singleClickTimeoutRef = useRef<any>(null);
  const isTouchDeviceRef = useRef<boolean>(false);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const handleMouseEnterControls = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsHoveringControls(true);
    }
  };
  const handleMouseLeaveControls = () => {
    setIsHoveringControls(false);
  };
  const [isSearchOverlayActive, setIsSearchOverlayActive] = useState(false);

  const SafariNotification = () => {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const [show, setShow] = useState(() => {
    if (!isSafari) return false;
    return !sessionStorage.getItem('safari_warning_shown');
  });

  useEffect(() => {
    if (show) {
      sessionStorage.setItem('safari_warning_shown', 'true');
      const timer = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-4 inset-x-4 z-[200] bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white p-3 rounded-lg text-sm text-center shadow-xl"
    >
      <p className="font-medium">قد تظهر بعض المشاكل في مشغل سفاري.</p>
      <p className="text-xs text-zinc-400 mt-1">يرجى اختيار متصفح كروم لتجربة أفضل.</p>
    </motion.div>
  );
};

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

  // Offline Wi-Fi tip timer (disappears after 3 seconds)
  useEffect(() => {
    if (isOffline && isLocalOfflineVideo) {
      setShowOfflineNotification(true);
      const timer = setTimeout(() => {
        setShowOfflineNotification(false);
        setIsLoading(false); // Instantly ready
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowOfflineNotification(false);
    }
  }, [isOffline, isLocalOfflineVideo, resolvedVideoUrl]);

  // Auto-Orient to landscape when maximized
  useEffect(() => {
    if (isMaximized || isForceRotated) {
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.lock === 'function') {
        // Attempt to lock to landscape
        (screen as any).orientation.lock('landscape').catch((e: any) => console.warn("Orientation lock unsupported or declined by user gesture", e));
      }
    } else {
      // Unlock when closed
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        try { (screen as any).orientation.unlock(); } catch (e) {}
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        try { (screen as any).orientation.unlock(); } catch (e) {}
      }
    };
  }, [isMaximized, isForceRotated]);

  // Turn off manual forced rotation automatically if screen is no longer maximized
  useEffect(() => {
    if (!isMaximized) {
      setIsForceRotated(false);
    }
  }, [isMaximized]);

  // Sync state if native browser fullscreen is exited (e.g. by back button, swipe gesture)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      // If native fullscreen was exited, make sure we reflect it by unmaximizing
      if (!isCurrentlyFullscreen && isMaximized) {
        onToggleMaximize();
        setIsForceRotated(false);
        if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
          try { (screen as any).orientation.unlock(); } catch (e) {}
        }
      }
    };

    const handleWebkitVideoEndFullscreen = () => {
      if (isMaximized) {
        onToggleMaximize();
        setIsForceRotated(false);
        if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
          try { (screen as any).orientation.unlock(); } catch (e) {}
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitendfullscreen', handleWebkitVideoEndFullscreen, true);

    const video = videoRef.current;
    if (video) {
      video.addEventListener('webkitendfullscreen', handleWebkitVideoEndFullscreen);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitendfullscreen', handleWebkitVideoEndFullscreen, true);
      if (video) {
        video.removeEventListener('webkitendfullscreen', handleWebkitVideoEndFullscreen);
      }
    };
  }, [isMaximized, onToggleMaximize, videoRef]);

  const toggleForceRotation = () => {
    const nextState = !isForceRotated;
    setIsForceRotated(nextState);
    if (nextState) {
      if (!isMaximized) {
        onToggleMaximize();
      }
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.lock === 'function') {
        (screen as any).orientation.lock('landscape').catch(() => {});
      }
    } else {
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        try { (screen as any).orientation.unlock(); } catch (e) {}
      }
    }
  };

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

  // --- Professional Video Ad Management System (YouTube Style Embedded) ---
  const [adBreakActive, setAdBreakActive] = useState(false);
  const [adIsPlaying, setAdIsPlaying] = useState(true);
  const [adMuted, setAdMuted] = useState(false);
  const [adVolume, setAdVolume] = useState(1);
  const [adDuration, setAdDuration] = useState(15);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  const [adCountdown, setAdCountdown] = useState(3);
  const [useIframeAd, setUseIframeAd] = useState(false);
  const [iframeHasLoaded, setIframeHasLoaded] = useState(false);
  const adFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [adsBlocked, setAdsBlocked] = useState(false);
  const [visualAdPoints, setVisualAdPoints] = useState<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const adPointsRef = useRef<Set<number>>(new Set());
  const preRollTriggeredRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const adVideoRef = useRef<HTMLVideoElement>(null);

  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);

  const [currentAdVideoSrc, setCurrentAdVideoSrc] = useState<string>("");
  const [currentAdClickThrough, setCurrentAdClickThrough] = useState<string>("");
  const [currentAdImpression, setCurrentAdImpression] = useState<string>("");

  // Auto focus the ad skip button on TV when the countdown reaches 0
  useEffect(() => {
    if (isTV && adBreakActive && adCountdown === 0) {
      setTimeout(() => {
        const btn = document.getElementById('ad-skip-button');
        if (btn) {
          btn.focus();
          document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => el.classList.remove('tv-focused'));
          btn.classList.add('tv-focused');
        }
      }, 100);
    }
  }, [isTV, adBreakActive, adCountdown]);

  // Dynamic fetcher that pulls from GitHub the user's customizable campaigns
  useEffect(() => {
    const fetchLatestAds = async () => {
      const customAdUrl = "https://www.effectivecpmnetwork.com/n5afwdtr78?key=21317cc52736e0f8228abe7f47a236ca";
      const customCampaign = {
        videoUrl: "",
        clickThrough: customAdUrl,
        impressionUrl: "",
        impressionUrls: [],
        trackingUrls: [],
        defaultDuration: 30
      };

      try {
        const githubUrl = "https://raw.githubusercontent.com/mrpubg252-cmd/esp-config/refs/heads/main/ads.json";
        const res = await fetch(githubUrl);
        if (!res.ok) throw new Error("Could not fetch latest ads JSON");
        
        const rawContent = await res.text();
        if (!rawContent || rawContent.trim() === "") {
          console.log("GitHub ads file is empty. Activating fallback ads.");
          setAdCampaigns([customCampaign]);
          setCurrentAdVideoSrc("");
          setCurrentAdClickThrough(customAdUrl);
          return;
        }

        let adsList: any[] = [];
        let adLinkUrl = "";

        // Attempt to parse as JSON first
        try {
          const data = JSON.parse(rawContent);
          
          if (Array.isArray(data)) {
            adsList = data;
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.ads)) {
              adsList = data.ads;
            } else if (Array.isArray(data.campaigns)) {
              adsList = data.campaigns;
            } else if (data.videoUrl || data.video_url || data.url) {
              adsList = [data];
            } else if (data.vastUrl || data.vast_url || data.adUrl || data.link || data.ad_url || data.clickThrough || data.click_through) {
              adLinkUrl = data.vastUrl || data.vast_url || data.adUrl || data.link || data.ad_url || data.clickThrough || data.click_through || "";
            }
          } else if (typeof data === 'string' && data.startsWith('http')) {
            adLinkUrl = data;
          }
        } catch (jsonErr) {
          const trimmed = rawContent.trim();
          if (trimmed.startsWith('http')) {
            adLinkUrl = trimmed;
          } else if (trimmed.startsWith('<')) {
            await handleVastXml(trimmed);
            return;
          }
        }

        // Helper to parse VAST XML
        async function handleVastXml(xmlText: string) {
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            const ads = xmlDoc.getElementsByTagName("Ad");
            const parsedCampaigns: any[] = [];

            for (let j = 0; j < ads.length; j++) {
              const adNode = ads[j];
              const mediaFiles = adNode.getElementsByTagName("MediaFile");
              let videoUrl = "";
              for (let i = 0; i < mediaFiles.length; i++) {
                const type = mediaFiles[i].getAttribute("type") || "";
                const delivery = mediaFiles[i].getAttribute("delivery") || "";
                if (type.includes("mp4") || type.includes("webm") || delivery === "progressive") {
                  videoUrl = mediaFiles[i].textContent?.trim() || "";
                  if (videoUrl) break;
                }
              }
              if (!videoUrl && mediaFiles.length > 0) {
                videoUrl = mediaFiles[0].textContent?.trim() || "";
              }

              const clickThroughs = adNode.getElementsByTagName("ClickThrough");
              const clickThrough = clickThroughs.length > 0 ? clickThroughs[0].textContent?.trim() : "";

              const impressionUrls: string[] = [];
              const impressions = adNode.getElementsByTagName("Impression");
              for (let i = 0; i < impressions.length; i++) {
                const url = impressions[i].textContent?.trim();
                if (url) impressionUrls.push(url);
              }

              const trackingUrls: string[] = [];
              const trackings = adNode.getElementsByTagName("Tracking");
              for (let i = 0; i < trackings.length; i++) {
                const event = trackings[i].getAttribute("event") || "";
                if (event === "start" || event === "creativeView") {
                  const url = trackings[i].textContent?.trim();
                  if (url) trackingUrls.push(url);
                }
              }

              if (videoUrl) {
                parsedCampaigns.push({
                  videoUrl,
                  clickThrough: clickThrough || adLinkUrl || "https://tiny-ambition.com",
                  impressionUrl: impressionUrls[0] || "",
                  impressionUrls,
                  trackingUrls,
                  defaultDuration: 30
                });
              }
            }

            if (parsedCampaigns.length > 0) {
              setAdCampaigns(parsedCampaigns);
              setCurrentAdVideoSrc(parsedCampaigns[0].videoUrl);
              setCurrentAdClickThrough(parsedCampaigns[0].clickThrough);
              setCurrentAdImpression(parsedCampaigns[0].impressionUrl || "");
              console.log("Successfully parsed VAST XML campaigns:", parsedCampaigns);
              return true;
            }
          } catch (e) {
            console.error("Failed to parse VAST XML:", e);
          }
          return false;
        }

        if (adLinkUrl) {
          console.log("Found VAST / Ad link:", adLinkUrl);
          try {
            const resV = await fetch(`/api/v1/resolve-vast?url=${encodeURIComponent(adLinkUrl)}`);
            if (resV.ok) {
              const dataV = await resV.json();
              if (dataV.status) {
                const campaign = {
                  videoUrl: dataV.mediaFiles?.[0] || "https://www.silent-basis.pro/152327/199275/425826_abc27z.mp4",
                  clickThrough: dataV.clickThrough,
                  impressionUrl: dataV.impressionUrls?.[0] || "",
                  impressionUrls: dataV.impressionUrls || [],
                  trackingUrls: dataV.trackingUrls || [],
                  defaultDuration: 30
                };
                setAdCampaigns([campaign]);
                setCurrentAdVideoSrc(campaign.videoUrl);
                setCurrentAdClickThrough(campaign.clickThrough);
                setCurrentAdImpression(campaign.impressionUrl);
                console.log("VAST URL resolved seamlessly via backend proxy:", campaign);
                return;
              }
            }
          } catch (err) {
            console.warn("Direct fetch of VAST URL via proxy failed. Parsing format type.", err);
          }

          const endsWithVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(adLinkUrl);
          if (endsWithVideo || adLinkUrl.includes("silence") || adLinkUrl.includes("silent") || adLinkUrl.includes("mp4")) {
            const campaign = {
              videoUrl: adLinkUrl,
              clickThrough: adLinkUrl,
              impressionUrl: "",
              impressionUrls: [],
              trackingUrls: [],
              defaultDuration: 30
            };
            setAdCampaigns([campaign]);
            setCurrentAdVideoSrc(adLinkUrl);
            setCurrentAdClickThrough(adLinkUrl);
            setCurrentAdImpression("");
            console.log("Direct video url campaign loaded:", campaign);
            return;
          } else {
            const promoCampaign = {
              videoUrl: "https://www.silent-basis.pro/152327/199275/425826_abc27z.mp4",
              clickThrough: adLinkUrl,
              impressionUrl: "",
              impressionUrls: [],
              trackingUrls: [],
              defaultDuration: 15
            };
            setAdCampaigns([promoCampaign]);
            setCurrentAdVideoSrc(promoCampaign.videoUrl);
            setCurrentAdClickThrough(promoCampaign.clickThrough);
            setCurrentAdImpression("");
            console.log("Premium sponsor video fallback loaded with redirect URL:", promoCampaign);
            return;
          }
        }

        if (adsList.length > 0) {
          const parsed = adsList.map((x: any) => {
            const finalImpressions = x.impressionUrls || (x.impressionUrl ? [x.impressionUrl] : []) || [];
            const clickUrl = x.link || x.clickThrough || x.click_through || x.click || x.redirect || x.adUrl || "https://tiny-ambition.com";
            return {
              videoUrl: x.videoUrl || x.video_url || x.url || x.src || x.mediaFile || "",
              clickThrough: clickUrl,
              impressionUrl: x.impressionUrl || x.impression_url || x.impression || x.track || "",
              impressionUrls: Array.from(new Set([...finalImpressions, clickUrl])),
              trackingUrls: x.trackingUrls || [],
              defaultDuration: Number(x.defaultDuration || x.default_duration || x.duration || 30)
            };
          }).filter(x => x.videoUrl || x.clickThrough);

          // Highly intelligent background VAST resolver for custom ad elements
          const fullyResolved = await Promise.all(parsed.map(async (camp) => {
            if (camp.clickThrough && (
              camp.clickThrough.includes("vast") || 
              camp.clickThrough.includes(".xml") || 
              camp.clickThrough.includes("tiny-ambition.com") || 
              camp.clickThrough.includes("silent-basis.pro") || 
              camp.clickThrough.includes("/d/") || 
              camp.clickThrough.includes("omg10.com") ||
              camp.clickThrough.includes("demXFkz")
            )) {
              try {
                const resV = await fetch(`/api/v1/resolve-vast?url=${encodeURIComponent(camp.clickThrough)}`);
                if (resV.ok) {
                  const dataV = await resV.json();
                  if (dataV.status) {
                    camp.clickThrough = dataV.clickThrough;
                    camp.impressionUrls = Array.from(new Set([...camp.impressionUrls, ...(dataV.impressionUrls || [])]));
                    camp.trackingUrls = Array.from(new Set([...camp.trackingUrls, ...(dataV.trackingUrls || [])]));
                    if (dataV.impressionUrls?.[0]) {
                      camp.impressionUrl = dataV.impressionUrls[0];
                    }
                    console.log("Ad campaign successfully resolved via proxy server. New clickThrough:", camp.clickThrough);
                  }
                }
              } catch (e) {
                console.warn("VAST proxy check fail for", camp.clickThrough, e);
              }
            }
            return camp;
          }));

          if (fullyResolved.length > 0) {
            const finalSet = [customCampaign, ...fullyResolved];
            setAdCampaigns(finalSet);
            setCurrentAdVideoSrc(finalSet[0].videoUrl);
            setCurrentAdClickThrough(finalSet[0].clickThrough);
            setCurrentAdImpression(finalSet[0].impressionUrl || "");
            console.log("Successfully resolved and loaded dynamic campaign list:", finalSet);
            return;
          }
        }

        console.log("Adding default user ad to campaign list.");
        setAdCampaigns([customCampaign]);
        setCurrentAdVideoSrc("");
        setCurrentAdClickThrough(customAdUrl);

      } catch (err) {
        console.warn("Resolving premium user ads from fallback:", err);
        setAdCampaigns([customCampaign]);
        setCurrentAdVideoSrc("");
        setCurrentAdClickThrough(customAdUrl);
      }
    };
    fetchLatestAds();
  }, []);

  const showAdBreak = () => {
    // Ad breaks are completely disabled as requested by the user
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
    return;
  };

  useEffect(() => {
    // Ad breaks are completely disabled as requested by the user
    setVisualAdPoints([]);
  }, [resolvedVideoUrl]);

  // Autoplay handler for the ad video element
  useEffect(() => {
    if (adBreakActive && adVideoRef.current) {
      const playPromise = adVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Autoplay muted triggered to bypass browser policies", err);
          setAdMuted(true);
          if (adVideoRef.current) {
            adVideoRef.current.muted = true;
            adVideoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [adBreakActive, currentAdVideoSrc]);

  // Unified physical countdown and iframe timer progress
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (adBreakActive) {
      if (adCountdown > 0) {
        timer = setTimeout(() => {
          setAdCountdown(prev => Math.max(0, prev - 1));
        }, 1000);
      }
      
      // If using iframe ad, we need a manual ticker for adCurrentTime
      if (useIframeAd) {
        const progressInterval = setInterval(() => {
          setAdCurrentTime(prev => {
            if (prev >= adDuration) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 0.1;
          });
        }, 100);
        return () => {
          clearTimeout(timer);
          clearInterval(progressInterval);
        };
      }
    }
    return () => clearTimeout(timer);
  }, [adBreakActive, adCountdown, useIframeAd, adDuration]);

  const handleSkipAd = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (adFallbackTimeoutRef.current) {
      clearTimeout(adFallbackTimeoutRef.current);
    }
    setAdBreakActive(false);
    setIframeHasLoaded(false);
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
      video.volume = volume;
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handlePlayPauseAd = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // If it's an iframe ad, interactions are handled natively inside the embedded webpage frame.
    // There is no need to trigger annoying external browser popups when the user touches this area.
    if (useIframeAd && currentAdClickThrough) {
      return;
    }

    const adVideo = adVideoRef.current;
    if (!adVideo) return;
    if (adIsPlaying) {
      adVideo.pause();
      setAdIsPlaying(false);
    } else {
      adVideo.play().catch(() => {});
      setAdIsPlaying(true);
    }
  };

  const handleToggleMuteAd = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const adVideo = adVideoRef.current;
    if (!adVideo) return;
    adVideo.muted = !adMuted;
    setAdMuted(!adMuted);
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
    if (!playerjsLoaded || isIframeFallback || !resolvedVideoUrl) return;

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
        file: resolvedVideoUrl,
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
  }, [playerjsLoaded, resolvedVideoUrl, isIframeFallback]);

  // Check if link is iframe/embed only or a standard direct video
  useEffect(() => {
    setIsLoading(true);
    setIsBuffering(false);
    setIsIframeFallback(false);
    
    if (!resolvedVideoUrl) {
      return;
    }
    
    const urlLower = resolvedVideoUrl.toLowerCase();
    
    // Explicitly handle Dailymotion and other embed-only servers
    const isEmbedOnly = 
      (urlLower && (
        urlLower.includes('dailymotion') || 
        urlLower.includes('syndication') ||
        urlLower.includes('vimeo') ||
        urlLower.includes('youtube') ||
        urlLower.includes('ok.ru')
      )) ||
      (activeServerUrl && (
        activeServerUrl.toLowerCase().includes('dailymotion') || 
        activeServerUrl.toLowerCase().includes('syndication') ||
        activeServerUrl.toLowerCase().includes('vimeo') ||
        activeServerUrl.toLowerCase().includes('ok.ru')
      )) ||
      (activeServerName && (
        activeServerName.toLowerCase().includes('dailymotion') ||
        activeServerName.toLowerCase().includes('ok.ru')
      ));

    if (isEmbedOnly || (urlLower && (urlLower.startsWith('/api/v1/secured-player') || urlLower.startsWith('/api/v1/titanic-player') || urlLower.startsWith('/api/v1/3isk-player')))) {
      setIsIframeFallback(true);
      setIsLoading(false);
      setIsPlaying(true);
      return;
    }
    
    const isDirectVideo = 
      urlLower && (
        urlLower.startsWith('blob:') ||
        urlLower.startsWith('/api/v1/stream-proxy') ||
        urlLower.includes('.mp4') || 
        urlLower.includes('.m3u8') || 
        urlLower.includes('.webm') || 
        urlLower.includes('.ogg') || 
        urlLower.includes('.mov') ||
        urlLower.includes('.jpg') ||
        urlLower.includes('.png') ||
        (activeServerUrl && (
          activeServerUrl.toLowerCase().includes('.mp4') ||
          activeServerUrl.toLowerCase().includes('.m3u8') ||
          activeServerUrl.toLowerCase().includes('.webm')
        ))
      );

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
    const isHlsStream = !urlLower.startsWith('blob:') && (urlLower.includes('.m3u8') || (activeServerUrl && activeServerUrl.toLowerCase().includes('.m3u8')));

    if (isHlsStream) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 20,           // Balanced: Faster start, enough buffer for stability
          maxMaxBufferLength: 180,       // 3 minutes of buffer
          maxBufferSize: 48 * 1024 * 1024, // 48MB RAM limit for better buffering
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
        hls.loadSource(resolvedVideoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setIsBuffering(false);
          resumeWatchProgress();
          video.muted = isMuted;
          video.volume = volume;
          video.play().then(() => {
            setIsPlaying(true);
            setShowControls(false); // Hide controls if playing perfectly
          }).catch(() => {
            setIsPlaying(false);
            setShowControls(true); // Keep controls open so user can press play
          });
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
                console.warn("HLS unrecoverable fatal error, staying in player for retry logic:", data);
                setShowTimeoutOptions(true); // Let user decide rather than auto-switching to inferior player
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
        video.src = resolvedVideoUrl;
        video.load(); // Explicitly trigger hardware media system on Safari & iOS
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setIsBuffering(false);
          resumeWatchProgress();
          video.muted = isMuted;
          video.volume = volume;
          video.play().then(() => {
            setIsPlaying(true);
            setShowControls(false);
          }).catch(() => {
            setIsPlaying(false);
            setShowControls(true);
          });
        });
      } else {
        console.warn("HLS not supported in this environment, showing options");
        setShowTimeoutOptions(true);
        setIsLoading(false);
      }
    } else {
      // Regular streaming files (MP4/WebM)
      video.src = resolvedVideoUrl;
      video.load(); // Explicitly call .load() for instant cross-browser parsing
      const onPlayable = () => {
        setIsLoading(false);
        setIsBuffering(false);
        resumeWatchProgress();
        video.muted = isMuted;
        video.volume = volume;
        video.play().then(() => {
          setIsPlaying(true);
          setShowControls(false);
        }).catch(() => {
          setIsPlaying(false);
          setShowControls(true);
        });
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
  }, [resolvedVideoUrl, episodeIndex, playerjsLoaded]);

  // Resume progress logic
  const resumeWatchProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    const savedSecond = progressService.getProgress(seriesId, episodeIndex);
    if (savedSecond > 0 && savedSecond < (video.duration || 100000)) {
      video.currentTime = savedSecond;
      
      // Calculate minutes and seconds for the professional notification text
      const mins = Math.floor(savedSecond / 60);
      const secs = Math.floor(savedSecond % 60);
      const formattedEpClean = formatEpisodeTitle(episodes[episodeIndex]?.title || "", episodeIndex, false);
      setResumeTimeText(`تم الاستئناف: ${formattedEpClean} عند الدقيقة ${mins}:${secs.toString().padStart(2, '0')}`);
      setShowResumeNotification(true);
      setTimeout(() => setShowResumeNotification(false), 4500);
    }
  };

  // Load initial progress and default duration for iframe embeds
  useEffect(() => {
    if (isIframeFallback) {
      const savedSecond = progressService.getProgress(seriesId, episodeIndex);
      if (savedSecond > 0) {
        setCurrentTime(savedSecond);
        const mins = Math.floor(savedSecond / 60);
        const secs = Math.floor(savedSecond % 60);
        const formattedEpClean = formatEpisodeTitle(episodes[episodeIndex]?.title || "", episodeIndex, false);
        setResumeTimeText(`تم الاستئناف: ${formattedEpClean} عند الدقيقة ${mins}:${secs.toString().padStart(2, '0')}`);
        setShowResumeNotification(true);
        const timer = setTimeout(() => setShowResumeNotification(false), 4500);
        return () => clearTimeout(timer);
      } else {
        setCurrentTime(0);
      }
      setDuration(3600); // Default 1 hour estimation for embed streams
    }
  }, [isIframeFallback, seriesId, episodeIndex, episodes]);

  // Instant watch progress save on component unmount and browser close (beforeunload)
  useEffect(() => {
    const saveCurrentProgress = () => {
      if (isIframeFallback) {
        if (currentTime > 5) {
          progressService.saveProgress(seriesId, episodeIndex, currentTime);
        }
      } else {
        const video = videoRef.current;
        if (video && video.currentTime > 5) {
          progressService.saveProgress(seriesId, episodeIndex, video.currentTime);
        }
      }
    };

    window.addEventListener('beforeunload', saveCurrentProgress);
    return () => {
      window.removeEventListener('beforeunload', saveCurrentProgress);
      saveCurrentProgress();
    };
  }, [seriesId, episodeIndex, isIframeFallback, currentTime]);

  // Simulating time progress inside frame embeds to keep the timeline working perfectly!
  useEffect(() => {
    if (!isIframeFallback || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 1;
        const total = duration || 3600;
        if (next >= total) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isIframeFallback, isPlaying, duration]);

  // Auto-Save watch progress every 4 seconds
  useEffect(() => {
    if (isIframeFallback) {
      if (playerjsLoaded) return;
      const interval = setInterval(() => {
        if (isPlaying && currentTime > 5) {
          progressService.saveProgress(seriesId, episodeIndex, currentTime);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
    
    if (playerjsLoaded) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && isPlaying && video.currentTime > 5) {
        progressService.saveProgress(seriesId, episodeIndex, video.currentTime);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying, isIframeFallback, seriesId, episodeIndex, playerjsLoaded, currentTime]);

  // Mouse activity or interactions to reset the controls timer
  const resetControlsTimeout = (forceShow: boolean = false) => {
    if (forceShow) {
      setShowControls(true);
    }
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }

    if (showControls || forceShow) {
      // If episode menu or search is active, do not auto-hide controls to let the user select
      if (showEpisodeMenu || isSearchOverlayActive) {
        return;
      }

      // If hovering controls on desktop, keep it visible. On TV, bypass hover lock because magic remote pointer sticks.
      if (isHoveringControls && !isTV && !showSpeedMenu) {
        return;
      }

      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setIsVolumeAdjustMode(false);
      }, isTV ? 5050 : 3000); // Slightly shorter timeout on TV
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTV) {
      const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
      const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
      if (dx < 4 && dy < 4) {
        return; // Skip fake mouse moves to let controls hide properly
      }
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    resetControlsTimeout(false);
  };

  // Basic remote control key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isOkKey = e.key === 'Enter' || e.key === 'Select' || e.key === 'OK' || e.key === 'Ok' || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66;

      // Unconditional ad break key override (works on ALL devices/remotes)
      if (adBreakActive) {
        if (adCountdown === 0 && isOkKey) {
          e.preventDefault();
          e.stopPropagation();
          handleSkipAd();
          return;
        }
        // Eat all navigation/select keystrokes while ad is running to protect visual state
        const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Select', 'OK', ' ', 'Escape'];
        const keyCodesToPrevent = [13, 23, 66, 37, 38, 39, 40];
        if (keysToPrevent.includes(e.key) || keyCodesToPrevent.includes(e.keyCode)) {
          e.preventDefault();
        }
        return;
      }

      if (!isTV) return;

      const tvKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Select', 'OK', 'Ok', ' ', 'Select', 'Accept'];
      if (!tvKeys.includes(e.key) && e.keyCode !== 13) return;

      // If volume adjust mode is active, prevent standard controls handler
      if (isVolumeAdjustMode) {
        return;
      }

      // 1. If controls are hidden, any navigation key wakes up the controls of the video player,
      // EXCEPT when a context drawer or specialized menu is already active!
      if (!showControls) {
        if (showEpisodeMenu || showSpeedMenu || isVolumeAdjustMode) {
          return; // Don't hijack if drawers or adjusting is already active
        }
        e.preventDefault();
        setShowControls(true);
        resetControlsTimeout(true);
        
        // Let the DOM update, then target the Play/Pause button or selection
        setTimeout(() => {
          const playBtn = containerRef.current?.querySelector('.play-pause-btn') as HTMLElement;
          if (playBtn) {
            playBtn.focus();
            playBtn.classList.add('tv-focused');
          }
        }, 80);
        return;
      }

      // 2. If controls are active:
      if (e.key === ' ' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        handlePlayPause();
        resetControlsTimeout(true);
      } else if (e.key === 'ArrowLeft') {
        // If the focused element of the browser is NOT another button (e.g. they are just watching), they can seek directly
        const activeEl = document.activeElement as HTMLElement;
        const isButtonFocused = activeEl && (activeEl.getAttribute('data-tv-focusable') === 'true');
        if (!isButtonFocused) {
          e.preventDefault();
          skipTime(-10);
          resetControlsTimeout(true);
        }
      } else if (e.key === 'ArrowRight') {
        const activeEl = document.activeElement as HTMLElement;
        const isButtonFocused = activeEl && (activeEl.getAttribute('data-tv-focusable') === 'true');
        if (!isButtonFocused) {
          e.preventDefault();
          skipTime(10);
          resetControlsTimeout(true);
        }
      } else if (e.key === 'ArrowUp') {
        const activeEl = document.activeElement as HTMLElement;
        const isButtonFocused = activeEl && (activeEl.getAttribute('data-tv-focusable') === 'true');
        if (!isButtonFocused && showControls && !showEpisodeMenu && !showSpeedMenu && !isVolumeAdjustMode) {
          e.preventDefault();
          setShowControls(false);
          setShowSpeedMenu(false);
          setIsVolumeAdjustMode(false);
        } else if (!showControls) {
          e.preventDefault();
          toggleControls();
        }
      } else if (e.key === 'ArrowDown') {
        if (!showControls) {
          e.preventDefault();
          toggleControls();
        }
      } else if (e.key === 'Enter' || e.key === 'Select' || e.key === 'OK' || e.key === 'Ok' || e.keyCode === 13) {
        const activeEl = document.activeElement as HTMLElement;
        const isButtonFocused = activeEl && (activeEl.getAttribute('data-tv-focusable') === 'true');
        if (!isButtonFocused) {
          e.preventDefault();
          toggleControls();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showControls, isPlaying, isTV, adBreakActive, adCountdown, showEpisodeMenu, showSpeedMenu, isVolumeAdjustMode]);


  // Automatically focus active episode/first item or close button when episode drawer menu opens
  useEffect(() => {
    if (showEpisodeMenu) {
      setTimeout(() => {
        const drawer = document.getElementById('episode-drawer');
        if (!drawer) return;
        
        // Find visible active episode button
        const activeEpBtn = drawer.querySelector('[data-active="true"]') as HTMLElement;
        if (activeEpBtn) {
          activeEpBtn.focus();
          document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => el.classList.remove('tv-focused'));
          activeEpBtn.classList.add('tv-focused');
          activeEpBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback to first focusable button
          const closeBtn = drawer.querySelector('[data-tv-focusable="true"]') as HTMLElement;
          if (closeBtn) {
            closeBtn.focus();
            document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => el.classList.remove('tv-focused'));
            closeBtn.classList.add('tv-focused');
          }
        }
      }, 150);
    }
  }, [showEpisodeMenu]);


  // Automatically trigger a helpful timeout fallback if loading hangs (e.g., slow server, CORS, or blocked autoplay)
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      setShowTimeoutOptions(false);
      timer = setTimeout(() => {
        // Only show options, never switch to iframe automatically anymore
        setShowTimeoutOptions(true);
      }, isTV ? 10000 : 15000); // More generous loading time
    } else {
      setShowTimeoutOptions(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading, resolvedVideoUrl, isTV]);


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
    lastButtonClickTimeRef.current = Date.now();
    if (e) e.stopPropagation();
    
    if (isIframeFallback) {
      setIsPlaying(prev => {
        const nextVal = !prev;
        if (!nextVal) {
          setShowControls(true);
        } else {
          setShowControls(false);
        }
        return nextVal;
      });
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Restore unmuted audio state if it was muted merely by autoplay blocks
    if (video.muted && !isMuted) {
      video.muted = false;
    }

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setShowControls(true); // Show controls and centered button when paused
    } else {
      if (video) {
        video.muted = isMuted;
        video.volume = volume;
      }
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowControls(false); // Hide controls on play/resume
    }
  };

  // Start long press timer to speed up to 2.0x
  const startLongPressTimer = (e: React.MouseEvent | React.TouchEvent) => {
    if (isIframeFallback) return;

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    if ('button' in e && e.button !== 0) return;

    if ('touches' in e) {
      isTouchDeviceRef.current = true;
    }

    longPressTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        originalSpeedRef.current = video.playbackRate || playbackRate;
        video.playbackRate = 2.0;
        setIsSpeedingUp(true);
        if (navigator.vibrate) {
          try { navigator.vibrate(25); } catch (err) {}
        }
      }
    }, 450);
  };

  // End long press timer and restore original playback speed
  const endLongPressTimer = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (isSpeedingUp) {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = originalSpeedRef.current;
      }
      setIsSpeedingUp(false);
      lastButtonClickTimeRef.current = Date.now();
    }
  };

  // Touch screen specialized event handlers for flawless mobile UX (native speed & feel)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isTouchDeviceRef.current = true;
    
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

    startLongPressTimer(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    isTouchDeviceRef.current = true;

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
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

    if (isSpeedingUp) {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = originalSpeedRef.current;
      }
      setIsSpeedingUp(false);
      lastButtonClickTimeRef.current = Date.now();
      if (e.cancelable) {
        e.preventDefault();
      }
      return;
    }

    // Process tap/double-tap immediately from coordinates for responsive mobile skipping
    const touch = e.changedTouches[0];
    if (touch) {
      handleInteraction(touch.clientX, touch.clientY, e.currentTarget);
    }

    if (e.cancelable) {
      e.preventDefault(); // Stop synthesized click mouse events instantly
    }
  };

  const handleTouchCancel = (e: React.TouchEvent<HTMLDivElement>) => {
    endLongPressTimer(e);
  };

  // Core gesture state machine
  const handleInteraction = (clientX: number, clientY: number, currentTarget: HTMLElement) => {
    if (isSpeedingUp) return; // Ignore standard gestures during fast-forward mode

    // Avoid immediate click execution if we just released a long press speed-up or button inside the player
    if (Date.now() - lastButtonClickTimeRef.current < 500) {
      return;
    }

    const video = videoRef.current;
    if (!video && !isIframeFallback) return;

    // Restore unmuted audio state if it was muted merely by autoplay blocks
    if (video && video.muted && !isMuted) {
      video.muted = false;
    }

    const rect = currentTarget.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const width = rect.width;
    const clickPercent = clickX / width;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 310;

    // Elite 3-zone system: Left 40% (Rewind), Middle 20% (Instant Play/Pause), Right 40% (Fast Forward)
    let zone: 'left' | 'right' | 'middle' = 'middle';
    if (clickPercent < 0.4) {
      zone = 'left';
    } else if (clickPercent > 0.6) {
      zone = 'right';
    }

    if (zone === 'middle') {
      // Middle tap is instantly processed on tap 1 (no delay) for immediate UX response!
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      handlePlayPause();
      return;
    }

    // Determine double tap state for left/right zones
    const isDoubleTap = (zone === lastTapRef.current.side) &&
                        (now - lastTapRef.current.time < DOUBLE_TAP_DELAY);

    // Record tap details
    lastTapRef.current = { time: now, side: zone };

    if (isDoubleTap) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }

      // Action double tap skip instantly
      if (zone === 'left') {
        skipTime(-10);
      } else {
        skipTime(10);
      }
      return;
    }

    // First tap on side zones initiates single click timer to toggle player controls
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      setShowSpeedMenu(false);
      setShowEpisodeMenu(false);
      toggleControls();
      clickTimeoutRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    // Ignore Mouse events on Touch screens to stay fully deterministic and clear
    if (isTouchDeviceRef.current) {
      return;
    }

    if (isSpeedingUp) {
      return; // Ignore clicking right after speeding up
    }

    if (Date.now() - lastButtonClickTimeRef.current < 500) {
      return;
    }

    // If it's a programmatic click (e.g., from TV Enter key when controls are hidden)
    if (e.clientX === 0 && e.clientY === 0 && isTV) {
      toggleControls();
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

  const handleVideoError = (e: any) => {
    console.warn("Native video playback encountered an issue:", e?.type || e?.message || "unknown_error");
    // Instead of immediate fallback, try to wait or show timeout options
    if (!showTimeoutOptions) {
      setShowTimeoutOptions(true);
    }
    setIsBuffering(false);
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

  const lastEmittedTimeRef = useRef(-1);
  useEffect(() => {
    const rounded = Math.floor(currentTime);
    if (rounded % 4 === 0 && rounded !== lastEmittedTimeRef.current) {
      lastEmittedTimeRef.current = rounded;
      onTimeUpdate?.(currentTime);
    }
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

  const handleCanPlay = () => {
    setIsBuffering(false);
    const video = videoRef.current;
    if (!video) return;

    // Explicitly sync volume and muted state to override any browser-native mute/reset behaviors
    video.muted = isMuted;
    video.volume = volume;

    if (lastPositionRef.current > 0) {
      // Only restore if it's significantly different (e.g., reset to 0)
      if (Math.abs(video.currentTime - lastPositionRef.current) > 1) {
        video.currentTime = lastPositionRef.current;
      }
      lastPositionRef.current = 0; // Clear it
    }
  };

  const calculateSeekTime = (clientX: number) => {
    if (!seekTrackerRef.current || isNaN(duration) || duration === 0) return 0;
    const rect = seekTrackerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(clickX / width, 1));
    return percentage * duration;
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsSeekingState(true);
    const clientX = 'touches' in e 
      ? (e.touches && e.touches[0] ? e.touches[0].clientX : 0) 
      : (e as React.MouseEvent).clientX;
    const targetTime = calculateSeekTime(clientX);
    
    if (isIframeFallback) {
      setCurrentTime(targetTime);
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = targetTime;
        setCurrentTime(video.currentTime);
      }
    }
    resetControlsTimeout();
  };

  useEffect(() => {
    if (!isSeekingState) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e 
        ? (e.touches && e.touches[0] ? e.touches[0].clientX : 0) 
        : (e as MouseEvent).clientX;
      const targetTime = calculateSeekTime(clientX);
      
      if (isIframeFallback) {
        setCurrentTime(targetTime);
      } else {
        const video = videoRef.current;
        if (video) {
          video.currentTime = targetTime;
          setCurrentTime(video.currentTime);
        }
      }
      resetControlsTimeout();
    };

    const onEnd = () => {
      setIsSeekingState(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isSeekingState, duration, isIframeFallback]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setShowSpeedMenu(false);
    setShowEpisodeMenu(false);
    setIsVolumeAdjustMode(false);
    if (isNaN(duration) || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    
    const targetTime = clickPercent * duration;
    if (isIframeFallback) {
      setCurrentTime(targetTime);
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = targetTime;
        setCurrentTime(video.currentTime);
      }
    }
    resetControlsTimeout();
  };

  const skipTime = (amount: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setShowSpeedMenu(false);
    setShowEpisodeMenu(false);
    setIsVolumeAdjustMode(false);
    
    if (isIframeFallback) {
      setCurrentTime(prev => Math.min(Math.max(0, prev + amount), duration));
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.min(Math.max(0, video.currentTime + amount), duration);
        setCurrentTime(video.currentTime);
      }
    }
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

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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
    if (!container) return;

    // Check if any element is already in fullscreen
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isMaximized) {
      // Exit Maximized
      onToggleMaximize();
      setIsForceRotated(false);
      
      if (isFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }

      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        try { (screen as any).orientation.unlock(); } catch (e) {}
      }
    } else {
      // Enter Maximized
      onToggleMaximize();

      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.lock === 'function') {
        (screen as any).orientation.lock('landscape').catch(() => {});
      }

      if (isIOS) {
        // Allow iPhone to use native video player if available
        if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          try { (videoRef.current as any).webkitEnterFullscreen(); } catch (e) {}
        }
      } else {
        // Desktop/Other: Try native Fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => {});
        } else if ((container as any).webkitRequestFullscreen) {
          try { (container as any).webkitRequestFullscreen(); } catch (e) {}
        }
      }
    }
  };

  // Professional TV Remote Detection & Spatial Auto-Handling
  useEffect(() => {
    if (!isTV) return;

    const handleTvKeyDown = (e: KeyboardEvent) => {
      if (!isTV) return;
      if (adBreakActive) return; // Skip normal TV key navigation overlay while an ad break is active

      const isOkKey = e.key === 'Enter' || e.key === 'Select' || e.key === 'OK' || e.key === 'Ok' || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66;
      const isBackKey = e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 27 || e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461;
      
      let directionKey = '';
      if (e.key === 'ArrowUp' || e.keyCode === 19) directionKey = 'ArrowUp';
      else if (e.key === 'ArrowDown' || e.keyCode === 20) directionKey = 'ArrowDown';
      else if (e.key === 'ArrowLeft' || e.keyCode === 21) directionKey = 'ArrowLeft';
      else if (e.key === 'ArrowRight' || e.keyCode === 22) directionKey = 'ArrowRight';

      const isArrowKey = directionKey !== '';

      if (isBackKey) {
        if (showEpisodeMenu) { setShowEpisodeMenu(false); e.preventDefault(); e.stopPropagation(); return; }
        if (showSpeedMenu) { setShowSpeedMenu(false); e.preventDefault(); e.stopPropagation(); return; }
        if (showControls) { setShowControls(false); e.preventDefault(); e.stopPropagation(); return; }
        if (isMaximized) {
          onToggleMaximize();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (isArrowKey || isOkKey) {
        // Auto-show controls on any remote interaction
        if (!showControls && !adBreakActive && !showEpisodeMenu && !showSpeedMenu) {
          setShowControls(true);
          resetControlsTimeout(true);
          
          // Force focus onto the play/pause button if nothing is currently focused in the player
          setTimeout(() => {
            const activeEl = document.activeElement;
            const container = containerRef.current;
            if (container && (!activeEl || !container.contains(activeEl))) {
              const playBtn = container.querySelector('.play-pause-btn') as HTMLElement;
              if (playBtn) {
                playBtn.focus();
                playBtn.classList.add('tv-focused');
              }
            }
          }, 50);
          return;
        }

        resetControlsTimeout(true);

        if (isArrowKey) {
          const activeEl = document.activeElement as HTMLElement;

          // SPECIAL: If focused on Progress Bar, Left/Right should SEEK, not move focus
          if (activeEl?.getAttribute('aria-label') === 'شريط التقدم' && (directionKey === 'ArrowLeft' || directionKey === 'ArrowRight')) {
             return; // Let the progress bar onKeyDown handle it
          }

          // Special handling for adjusting modes
          if (isVolumeAdjustMode) {
            if (directionKey === 'ArrowUp' || directionKey === 'ArrowDown') {
              return;
            } else if (directionKey === 'ArrowLeft' || directionKey === 'ArrowRight') {
              setIsVolumeAdjustMode(false);
            }
          }

          // Spatial Navigation Logic
          e.preventDefault();
          moveTvFocus(directionKey);
        }
      }
    };

    const moveTvFocus = (direction: string) => {
      const container = containerRef.current;
      if (!container) return;

      const activeEl = document.activeElement as HTMLElement;
      
      // Prioritize focus group based on open overlays
      let scopeContainer: HTMLElement = container;
      if (showEpisodeMenu) {
        scopeContainer = document.getElementById('episode-drawer') || container;
      } else if (showSpeedMenu) {
        scopeContainer = document.getElementById('speed-menu') || container;
      }

      const focusables = Array.from(scopeContainer.querySelectorAll('[data-tv-focusable="true"]')) as HTMLElement[];
      const visibleFocusables = focusables.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
      });

      if (visibleFocusables.length === 0) return;

      // If nothing relevant focused, jump to logical primary
      if (!activeEl || !scopeContainer.contains(activeEl)) {
        const target = visibleFocusables[0];
        target.focus();
        visibleFocusables.forEach(f => f.classList.remove('tv-focused'));
        target.classList.add('tv-focused');
        return;
      }

      const curRect = activeEl.getBoundingClientRect();
      const curCenter = { x: curRect.left + curRect.width / 2, y: curRect.top + curRect.height / 2 };

      let bestTarget: HTMLElement | null = null;
      let minDistance = Infinity;

      visibleFocusables.forEach(candidate => {
        if (candidate === activeEl) return;
        const candRect = candidate.getBoundingClientRect();
        const candCenter = { x: candRect.left + candRect.width / 2, y: candRect.top + candRect.height / 2 };

        const dx = candCenter.x - curCenter.x;
        const dy = candCenter.y - curCenter.y;

        let isPossible = false;
        if (direction === 'ArrowUp') isPossible = dy < -5;
        if (direction === 'ArrowDown') isPossible = dy > 5;
        if (direction === 'ArrowLeft') isPossible = dx < -5;
        if (direction === 'ArrowRight') isPossible = dx > 5;

        if (isPossible) {
          const dist = direction === 'ArrowUp' || direction === 'ArrowDown'
            ? Math.abs(dy) + Math.abs(dx) * 4 // Prefer vertical alignment for Up/Down
            : Math.abs(dx) + Math.abs(dy) * 4; // Prefer horizontal alignment for Left/Right

          if (dist < minDistance) {
            minDistance = dist;
            bestTarget = candidate;
          }
        }
      });

      if (bestTarget) {
        (bestTarget as HTMLElement).focus();
        // Global cleanup and local assignment to prevent focus duplication visuals
        container.querySelectorAll('.tv-focused').forEach(f => f.classList.remove('tv-focused'));
        (bestTarget as HTMLElement).classList.add('tv-focused');
      }
    };

    window.addEventListener('keydown', handleTvKeyDown);
    return () => window.removeEventListener('keydown', handleTvKeyDown);
  }, [isTV, showControls, adBreakActive]);

  // Master custom controls layout (Premium Translucent Dashboard)
  const controlsLayout = (
    <div 
      className={cn(
        "absolute inset-x-0 bottom-0 z-[120] p-1.5 transition-all duration-300 flex flex-col gap-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pl-[calc(0.375rem+env(safe-area-inset-left))] pr-[calc(0.375rem+env(safe-area-inset-right))]",
        (showControls && !isSearchOverlayActive) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <div className={cn(
        "bg-[#0c0c10]/98 border border-white/5 rounded-xl p-1.5 sm:p-2 flex flex-col gap-1",
        !isLowEnd ? "shadow-[0_24px_60px_rgba(0,0,0,0.95)] backdrop-blur-md" : "shadow-none"
      )}>
        
        {/* Timeline slider row */}
        <div className="flex flex-col gap-0.5 w-full px-1 py-1">
          <div 
            ref={seekTrackerRef}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            tabIndex={showControls ? 0 : -1}
            data-tv-focusable={showControls ? "true" : "false"}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault(); e.stopPropagation(); skipTime(-10);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault(); e.stopPropagation(); skipTime(10);
              }
            }}
            aria-label="شريط التقدم"
            className="relative flex items-center h-4 w-full cursor-pointer select-none group/timeline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg"
          >
            {/* The outer track container */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full relative overflow-hidden group-hover/timeline:h-2 transition-all duration-200">
              {/* Yellow Ad Indicators like YouTube */}
              {visualAdPoints.length > 0 && visualAdPoints.map((pt: number) => {
                const totalDuration = duration || (videoRef.current?.duration) || 3600;
                const ratio = pt / totalDuration;
                if (ratio > 1) return null;
                return (
                  <div 
                    key={pt}
                    className="absolute w-[3px] h-full z-[25] top-0 pointer-events-none bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,1)]"
                    style={{ left: `${ratio * 100}%` }}
                  />
                );
              })}
              
              {/* Crimson Progress fill */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.7)] rounded-full"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>

            {/* Glowing drag-indicator thumb (positioned on the right side of progress fill) */}
            <div 
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(229,9,20,0.9)] transition-transform duration-100 pointer-events-none z-30",
                isSeekingState ? "scale-125 opacity-100" : "scale-100 opacity-0 group-hover/timeline:opacity-100"
              )}
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>

          {/* Video Duration metrics */}
          <div className="flex justify-between text-[11px] font-black tracking-wider text-zinc-400 font-mono mt-0.5 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Functional Dashboard Options Row */}
        <div className="flex flex-row items-center justify-between w-full gap-1 sm:gap-2 mt-1">
          
          {/* Left controls: Volume, Play/Pause, Rewind, Fast Forward */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button 
              onClick={handlePlayPause}
              tabIndex={showControls ? 0 : -1}
              data-tv-focusable={showControls ? "true" : "false"}
              className="p-1.5 bg-primary hover:bg-[#c10d10] text-white rounded-full transition-all active:scale-95 shadow-lg shadow-primary/30 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none play-pause-btn"
              title={isPlaying ? "إيقاف" : "تشغيل"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            <button 
              onClick={(e) => skipTime(-10, e)}
              tabIndex={showControls ? 0 : -1}
              data-tv-focusable={showControls ? "true" : "false"}
              className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none rounded-full shrink-0"
              title="الرجوع 10 ثواني"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button 
              onClick={(e) => skipTime(10, e)}
              tabIndex={showControls ? 0 : -1}
              data-tv-focusable={showControls ? "true" : "false"}
              className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none rounded-full shrink-0"
              title="التقديم 10 ثواني"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Volume controls with Mute/Unmute Toggle & high-fidelity slider bar */}
            <div className="flex items-center gap-1 group/volume relative ml-1 bg-white/5 border border-white/10 rounded-full px-1.5 py-0.5 sm:px-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                  resetControlsTimeout();
                }}
                tabIndex={showControls ? 0 : -1}
                data-tv-focusable={showControls ? "true" : "false"}
                className="p-1 text-zinc-400 hover:text-white transition-colors hover:scale-110 active:scale-95 focus:ring-4 focus:ring-primary focus:outline-none rounded-full shrink-0"
                title={isMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                  resetControlsTimeout();
                }}
                className="w-12 sm:w-16 h-1 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
              />
            </div>


          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); setShowEpisodeMenu(false); }}
              tabIndex={showControls ? 0 : -1}
              data-tv-focusable={showControls ? "true" : "false"}
              className="flex items-center gap-0.5 px-1.5 py-1 sm:px-2 rounded-lg bg-white/5 border border-white/10 text-[8px] sm:text-[9px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none shrink-0"
            >
              {playbackRate}x
            </button>
            {!isLocalOfflineVideo && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); setShowSpeedMenu(false); setIsVolumeAdjustMode(false); }}
                  tabIndex={showControls ? 0 : -1}
                  data-tv-focusable={showControls ? "true" : "false"}
                  className="flex items-center gap-1 sm:gap-1.5 bg-primary/25 hover:bg-primary/35 px-2 py-1 sm:px-3 sm:py-2 rounded-xl border border-primary/40 text-white font-black text-[9px] sm:text-xs tracking-tight shadow-xl focus:ring-4 focus:ring-primary focus:outline-none focus:bg-primary/40 shrink-0"
                >
                  <List className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                  <span>الحلقات</span>
                </button>
              </>
            )}
            {isMobile && isStandalone && isMaximized && (
              <button 
                onClick={(e) => { e.stopPropagation(); toggleForceRotation(); }}
                tabIndex={showControls ? 0 : -1}
                data-tv-focusable={showControls ? "true" : "false"}
                title="تدوير الشاشة"
                className={cn(
                  "px-2 h-7 sm:h-8 flex items-center justify-center gap-1 rounded-lg border focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none shrink-0 transition-colors text-[10px] font-bold",
                  isForceRotated 
                    ? "bg-primary border-primary text-white" 
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border-white/10"
                )}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>تدوير</span>
              </button>
            )}
            <button 
              onClick={toggleBrowserFullscreen}
              tabIndex={showControls ? 0 : -1}
              data-tv-focusable={showControls ? "true" : "false"}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none shrink-0"
            >
              {isMaximized ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div 
        id="custom-video-player-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !isHoveringControls && setShowControls(false)}
      onClick={handlePlayerClick}
      className={cn(
        "relative select-none flex flex-col items-center justify-center bg-black overflow-hidden group w-full h-full text-white cursor-pointer transition-all duration-300 touch-manipulation",
        isSearchOverlayActive ? "z-0 pointer-events-none opacity-0 select-none scale-95" : "",
        (isMaximized || isForceRotated)
          ? (isSearchOverlayActive ? "fixed inset-0 w-full z-0 opacity-0 pointer-events-none" : "fixed inset-0 w-screen h-[100dvh] z-[99999] p-0 m-0 border-none rounded-none") 
          : "aspect-video rounded-xl border border-white/5"
      )}
      style={
        useCssRotationFallback ? {
          width: '100dvh',
          height: '100dvw',
          transform: 'rotate(90deg)',
          transformOrigin: 'top left',
          marginLeft: '100vw',
          position: 'fixed' as const,
          top: 0,
          left: 0,
          zIndex: 99999,
        } : ((isMaximized || isForceRotated) ? { height: viewportHeight, width: '100vw', top: 0, left: 0 } : undefined)
      }
    >
      {/* ----------------- BRAND OVERLAY (ON PLAYBACK LOAD) ----------------- */}
      <AnimatePresence>
        {showCategoryOverlay && seriesCategory && (
          <motion.div
            initial={{ y: "-20px", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-20px", opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 150 }}
            className="absolute right-4 top-4 z-[1500] pointer-events-none flex items-center gap-1.5 px-3 py-1 bg-black/85 backdrop-blur-md border border-white/10 rounded-full shadow-lg"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse shrink-0" />
            <span className="text-[9px] text-zinc-400 font-black">تصنيف:</span>
            <span className="text-[11px] font-black text-white">{seriesCategory}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- PROFESSIONAL AD OVERLAY ----------------- */}
      <AnimatePresence>
        {adBreakActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[2000] bg-zinc-950 flex flex-col items-center justify-center overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {useIframeAd ? (
              <div className="absolute inset-0 w-full h-full bg-zinc-950 flex items-center justify-center">
                <iframe
                  src={currentAdClickThrough}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  onLoad={() => setIframeHasLoaded(true)}
                  style={{ opacity: iframeHasLoaded ? 1 : 0.4 }}
                />
                {!iframeHasLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 pointer-events-none">
                    <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-400 text-xs font-bold font-sans">جاري تحميل إعلان الشريك الموثوق...</p>
                  </div>
                )}
              </div>
            ) : (
              <video
                ref={adVideoRef}
                src={currentAdVideoSrc}
                autoPlay
                playsInline={true}
                muted={adMuted}
                onEnded={() => handleSkipAd()}
                onTimeUpdate={() => {
                  if (adVideoRef.current) {
                    setAdCurrentTime(adVideoRef.current.currentTime);
                  }
                }}
                onDurationChange={() => {
                  if (adVideoRef.current) {
                     setAdDuration(adVideoRef.current.duration || 30);
                  }
                }}
                className="w-full h-full object-contain pointer-events-auto bg-black cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentAdClickThrough) {
                    setUseIframeAd(true);
                  }
                }}
              />
            )}

            {/* Top Bar with Branding and Mute button for Video Ads */}
            <div className="absolute top-4 left-4 right-4 z-[2100] flex justify-between items-center pointer-events-none">
              <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-[10px] text-zinc-300 font-black font-sans">
                  {useIframeAd ? "موقع الشريك الراعي" : "إعلان ممول"}
                </span>
              </div>
              
              {useIframeAd && currentAdVideoSrc ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUseIframeAd(false);
                    setIframeHasLoaded(false);
                  }}
                  className="pointer-events-auto px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 border border-white/15 text-white rounded-xl text-[10px] font-black font-sans transition-all active:scale-95 flex items-center gap-1.5 backdrop-blur-md"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rotate-180 animate-pulse-horizontal" />
                  <span>العودة لمشاهدة الإعلان Video</span>
                </button>
              ) : !useIframeAd ? (
                <button
                  onClick={handleToggleMuteAd}
                  className="pointer-events-auto p-2 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 hover:bg-black/90 text-white transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  {adMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
              ) : null}
            </div>

            {/* Bottom Controls / Skip Action Button Row */}
            <div className="absolute bottom-6 left-6 right-6 z-[2100] flex justify-between items-end pointer-events-none">
              
              {/* Left Action Banner (Clickable) */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentAdClickThrough) {
                    setUseIframeAd(true);
                  }
                }}
                className="pointer-events-auto cursor-pointer bg-black/80 border border-white/10 hover:border-yellow-500 hover:bg-black p-3 rounded-2xl flex items-center gap-3 transition-all max-w-xs text-right backdrop-blur-md"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 text-sm font-black">
                  🔗
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-zinc-400 font-bold">زيارة موقع الراعي</span>
                  <span className="text-xs text-white font-black truncate max-w-[150px]">
                    {currentAdClickThrough ? (() => {
                      try {
                        return new URL(currentAdClickThrough).hostname;
                      } catch (err) {
                        return "تفاصل أكثر";
                      }
                    })() : "تفاصل أكثر"}
                  </span>
                </div>
              </div>

              {/* Right Skip / Countdown Controller */}
              <div className="flex flex-col items-end gap-2 text-right">
                {adCountdown > 0 ? (
                  <div className="bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/5 font-black text-right text-xs">
                    <span className="text-zinc-400">يمكنك تخطي الإعلان بعد </span>
                    <span className="text-yellow-500 font-mono text-sm">{adCountdown}</span>
                    <span className="text-zinc-400"> ثوانٍ</span>
                  </div>
                ) : (
                  <button
                    id="ad-skip-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipAd(e);
                    }}
                    data-tv-focusable="true"
                    className="pointer-events-auto px-5 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-black text-xs sm:text-sm rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.3)] transition-all transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-yellow-500 flex items-center gap-2 border border-yellow-400/40 tv-focusable"
                  >
                    <span>تخطي الإعلان</span>
                    <ChevronLeft className="w-4 h-4 animate-bounce-x" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!resolvedVideoUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 gap-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
          <p className="text-zinc-400 text-sm font-bold tracking-widest text-center px-4">جاري تجهيز سيرفرات المشغل المباشر...</p>
        </div>
      ) : playerjsLoaded ? (
        // Dynamic custom PlayerJS renderer container
        <div className="relative w-full h-full">
          <SafariNotification />
          <div id="pjs-player" className="w-full h-full bg-black" />
          
          {/* Transparent bar for floating episode and maximize triggers on PlayerJS */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
            <button
              onClick={(e) => { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); }}
              className="flex items-center gap-2 bg-black/85 px-3 py-2 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all text-[10px] font-black uppercase tracking-wider shadow-2xl"
            >
              <List className="w-4 h-4 text-primary" />
              الحلقات
            </button>
            {isMobile && isStandalone && isMaximized && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleForceRotation(); }}
                className={cn(
                  "p-2 rounded-xl border transition-all shadow-2xl flex items-center justify-center gap-1.5 text-xs font-black",
                  isForceRotated 
                    ? "bg-primary border-primary text-white" 
                    : "bg-black/85 border-white/10 text-white hover:text-primary"
                )}
                title="تدوير الشاشة"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[10px]">تدوير</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); toggleBrowserFullscreen(); }}
              className="p-2 bg-black/85 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all shadow-2xl"
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        // High fidelity native fallback player
        <>
          <SafariNotification />
           {isLoading && (
            <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#07070a] gap-4 select-none">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
              <div className="flex flex-col items-center gap-1.5 text-center px-6 max-w-sm font-sans">
                <p className="text-white text-sm font-black tracking-widest uppercase">جاري تشغيل الحلقة</p>
                <p className="text-zinc-400 text-[10px] font-bold">يرجى الانتظار لتجهيز البث الآمن...</p>
                
                {isOffline && (
                  isLocalOfflineVideo ? (
                    <span className="mt-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-full text-[10px] font-black animate-pulse text-center">
                       🍿 تشغيل أوفلاين: بإمكانك إطفاء الواي فاي الآن والمشاهدة بدون استهلاك الباقة!
                    </span>
                  ) : (
                    <span className="mt-2 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black animate-pulse">
                       ⚠️ أنت غير متصل بالإنترنت حالياً
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {isIframeFallback ? (
            (() => {
              const isDailymotion = (resolvedVideoUrl && (resolvedVideoUrl.toLowerCase().includes('dailymotion') || resolvedVideoUrl.toLowerCase().includes('syndication'))) ||
                                    (activeServerUrl && (activeServerUrl.toLowerCase().includes('dailymotion') || activeServerUrl.toLowerCase().includes('syndication'))) ||
                                    (activeServerName && activeServerName.toLowerCase().includes('dailymotion'));
              
              if (isDailymotion) {
                const targetUrl = activeServerUrl || resolvedVideoUrl || '';
                return (
                  <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden group">
                    {/* Background Layer */}
                    <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none">
                      <img 
                        src="/episode.png" 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover blur-sm scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = seriesImage || '';
                        }}
                      />
                    </div>
                    
                    {/* Content Layer */}
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block w-full max-w-2xl aspect-video rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                      >
                        <img 
                          src="/episode.png" 
                          alt="اضغط لمشاهدة الحلقة" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = seriesImage || '';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/20 hover:bg-black/0 transition-colors duration-300 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-2xl transition-transform duration-300 hover:scale-110">
                            <Play className="w-10 h-10 fill-current ml-1" />
                          </div>
                        </div>
                      </a>
                      
                      <div className="mt-8 text-center space-y-3 animate-fade-in">
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                          سيرفر Dailymotion الخاص 🚀
                        </h3>
                        <p className="text-sm text-zinc-300 font-medium max-w-md">
                          اضغط على الصورة أعلاه لمشاهدة الحلقة بجودة عالية.
                          <br/>
                          تم تعطيل مانع الإعلانات لهذا السيرفر لضمان التشغيل.
                        </p>
                        
                        <a 
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-colors border border-white/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          فتح في صفحة جديدة
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className={cn(
                  "w-full h-full relative",
                  resolvedVideoUrl && resolvedVideoUrl.includes('streamimdb') && "p-1 rounded-2xl bg-gradient-to-tr from-amber-500/30 via-primary/20 to-amber-500/30"
                )}>
                  <iframe
                    src={resolvedVideoUrl || ''}
                    className={cn(
                      "w-full h-full border-0 animate-fade-in",
                      resolvedVideoUrl && resolvedVideoUrl.includes('streamimdb') && "rounded-xl shadow-2xl"
                    )}
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox={
                      blockPopups 
                        ? "allow-scripts allow-same-origin allow-forms allow-presentation" 
                        : "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox"
                    }
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'black',
                      position: 'relative',
                      zIndex: 10,
                    }}
                  />
                  {resolvedVideoUrl.includes('streamimdb') && (
                    <div className="absolute top-4 left-4 z-20 pointer-events-none">
                      <div className="bg-amber-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-3 h-3 fill-current" />
                        PREMIUM STREAMING
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <ShadowVideo
              videoRef={videoRef}
              isPlaying={isPlaying}
              isMuted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleVideoError}
              onWaiting={() => {}}
              onPlaying={() => { setIsLoading(false); }}
              onSeeking={() => {}}
              onSeeked={() => {}}
              onStalled={() => {}}
              onCanPlay={handleCanPlay}
              onCanPlayThrough={() => setIsBuffering(false)}
              className="w-full h-full"
            />
          )}

          {!isLoading && (
            <>
              {/* Buffering/Offline Indicator */}
              {isOffline && (
                isLocalOfflineVideo ? (
                  showOfflineNotification && (
                    <div className="absolute top-4 inset-x-4 z-40 flex items-center justify-center pointer-events-none animate-fade-in">
                      <div className="bg-[#051e14]/95 backdrop-blur-md border border-emerald-500/30 px-5 py-3 rounded-2xl shadow-2xl text-emerald-400 text-[11px] sm:text-xs font-black text-center flex items-center gap-2.5 animate-bounce max-w-[90%] mx-auto relative overflow-hidden">
                        <span className="w-2 h-2 rounded-full bg-emerald-450 animate-ping shrink-0" />
                        <span>🍿 بإمكانك إطفاء الواي فاي الآن ومتابعة المشاهدة بدون إنترنت وبدون استهلاك الباقة! ⚡</span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none bg-black/60 backdrop-blur-md px-6 text-center animate-fade-in">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-primary/20"></div>
                    <p className="text-white text-sm font-semibold mb-1">
                      تحقق من الاتصال بالإنترنت... 🌐
                    </p>
                    <p className="text-zinc-400 text-xs max-w-xs leading-relaxed">
                      إذا قمت بتحميل هذه الحلقة مسبقاً، يرجى تفعيل وضع الأوفلاين.
                    </p>
                  </div>
                )
              )}

              <div 
                onMouseDown={startLongPressTimer}
                onMouseUp={endLongPressTimer}
                onMouseLeave={endLongPressTimer}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                onClick={handlePlayerClick}
                className={cn(
                  "absolute inset-0 z-[100] select-none cursor-pointer flex items-center justify-center font-sans overflow-hidden touch-none",
                  isIframeFallback ? "pointer-events-none" : "pointer-events-auto"
                )}>
                
                {/* 2x Speed-up indicator banner */}
                <AnimatePresence>
                  {isSpeedingUp && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[130] flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-primary/40 text-white shadow-2xl text-[10px] sm:text-xs font-black tracking-widest uppercase animate-pulse"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span>سرعة مضاعفة 2.0x ⚡</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Double Tap Left (Rewind) Ripple Overlay */}
                <AnimatePresence>
                  {showRewindAnimation && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-black/40 to-transparent flex items-center justify-center pointer-events-none z-[110]"
                    >
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                        className="flex flex-col items-center gap-2 bg-black/50 p-4 rounded-full"
                      >
                        <div className="flex gap-0.5 select-none" dir="ltr">
                          <motion.span animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 0.6 }} className="text-white text-xl font-bold">◀</motion.span>
                          <motion.span animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }} className="text-white text-xl font-bold">◀</motion.span>
                          <motion.span animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="text-white text-xl font-bold">◀</motion.span>
                        </div>
                        <span className="text-[10px] sm:text-xs font-black tracking-wider text-white">10ث للخلف</span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Double Tap Right (Forward) Ripple Overlay */}
                <AnimatePresence>
                  {showForwardAnimation && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-black/40 to-transparent flex items-center justify-center pointer-events-none z-[110]"
                    >
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                        className="flex flex-col items-center gap-2 bg-black/50 p-4 rounded-full"
                      >
                        <div className="flex gap-0.5 select-none" dir="ltr">
                          <motion.span animate={{ x: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="text-white text-xl font-bold">▶</motion.span>
                          <motion.span animate={{ x: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }} className="text-white text-xl font-bold">▶</motion.span>
                          <motion.span animate={{ x: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 0.6 }} className="text-white text-xl font-bold">▶</motion.span>
                        </div>
                        <span className="text-[10px] sm:text-xs font-black tracking-wider text-white">10ث للأمام</span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Central Play/Pause Circular Button Overlay */}
              <AnimatePresence>
                {(showControls || !isPlaying) && !isIframeFallback && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 z-[120] flex items-center justify-center pointer-events-none"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(e);
                      }}
                      data-tv-focusable="true"
                      id="center-play-pause"
                      className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:scale-110 shadow-2xl pointer-events-auto"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
                      ) : (
                        <Play className="w-5 h-5 md:w-6 md:h-6 text-white fill-white ml-0.5" />
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Floating navigation icons for Embeds */}
              {isIframeFallback && (
                <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]">
                  {activeServerUrl && (activeServerUrl.toLowerCase().includes('dailymotion.com') || activeServerUrl.toLowerCase().includes('syndication')) && (
                    <a
                      href={activeServerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-red-650 to-red-750 hover:from-red-700 hover:to-red-800 px-3 py-2 rounded-xl border border-red-500/30 text-white text-[10px] font-black uppercase tracking-wider shadow-2xl pointer-events-auto cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                      الذهاب للحلقة 🚀
                    </a>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); }}
                    className="flex items-center gap-2 bg-black/85 px-3 py-2 rounded-xl border border-white/10 text-white text-[10px] font-black uppercase tracking-wider shadow-2xl pointer-events-auto"
                  >
                    <List className="w-4 h-4 text-primary" />
                    الحلقات
                  </button>
                  {isMobile && isStandalone && isMaximized && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleForceRotation(); }}
                      className={cn(
                        "p-2 rounded-xl border text-white transition-all shadow-2xl flex items-center justify-center gap-1.5 pointer-events-auto",
                        isForceRotated ? "bg-primary border-primary" : "bg-black/85 border-white/10"
                      )}
                      title="تدوير الشاشة"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span className="text-[10px]">تدوير</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBrowserFullscreen(); }}
                    className="p-2 bg-black/85 rounded-xl border border-white/10 text-white shadow-2xl pointer-events-auto"
                  >
                    {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {!isIframeFallback && controlsLayout}

              {/* RESUME PROGRESS NOTIFICATION TOAST */}
              <AnimatePresence>
                {showResumeNotification && (
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="absolute bottom-20 sm:bottom-24 left-4 sm:left-6 z-[1500] bg-zinc-950/92 backdrop-blur-md rounded-xl border border-red-500/10 text-white px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center gap-2.5 font-bold pointer-events-none select-none text-right max-w-xs"
                  >
                    <span className="text-sm">⏰</span>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] sm:text-[11px] font-black text-red-500 tracking-wider">تم الاستئناف</span>
                      <span className="text-[11px] sm:text-[12px] text-zinc-200 mt-0.5">{resumeTimeText}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SPEED MENU OVERLAY */}
              <AnimatePresence>
                {showSpeedMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.4 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowSpeedMenu(false)}
                      className="absolute inset-0 bg-black/60 z-[340] cursor-pointer"
                    />
                    <motion.div
                      id="speed-menu"
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className={cn(
                        "absolute bottom-24 left-1/2 -translate-x-1/2 z-[350] bg-zinc-900/98 border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[160px] shadow-2xl",
                        !isLowEnd && "backdrop-blur-xl"
                      )}
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleSpeedChange(rate)}
                          data-tv-focusable="true"
                          className={cn(
                            "w-full text-right px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between gap-3",
                            playbackRate === rate ? "bg-primary text-white" : "text-zinc-400 hover:bg-white/5"
                          )}
                        >
                          <span dir="ltr">{rate}x</span>
                          {playbackRate === rate && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* EPISODE LIST OVERLAY */}
              <AnimatePresence>
                {showEpisodeMenu && !isLocalOfflineVideo && (
                  <div className="absolute inset-x-0 bottom-0 top-0 z-[1000] flex flex-col justify-end">
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowEpisodeMenu(false)}
                      className={cn(
                        "absolute inset-0 bg-black/60 cursor-pointer",
                        !isLowEnd && "backdrop-blur-xs"
                      )}
                    />

                    {/* Bottom overlay panel - Compact stylish height (28%-32%) so it doesn't cover much of the player background feedback */}
                    <motion.div
                      id="episode-drawer"
                      onClick={(e) => e.stopPropagation()}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      style={{ willChange: 'transform' }}
                      className="relative w-full h-[175px] sm:h-[185px] shrink-0 bg-[#0a0b10] border-t border-white/10 shadow-[0_-15px_40px_rgba(0,0,0,0.85)] flex flex-col px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] overflow-hidden rounded-t-[1.5rem] sm:rounded-t-[2rem]"
                    >
                      {/* Centered Drag Handle Accent */}
                      <div className="w-8 h-0.5 bg-white/10 rounded-full mx-auto mb-2 shrink-0" />

                      {/* Top Header Row of Panel */}
                      <div className="flex items-center justify-between pb-1.5 shrink-0">
                        <div className="w-6 h-6" /> {/* spacing placeholder */}
                        <div className="text-center flex-1">
                          <h3 className="text-[11px] sm:text-xs font-black text-white">اختر حلقة للمشاهدة ({episodes.length})</h3>
                        </div>
                        <button 
                          onClick={() => setShowEpisodeMenu(false)}
                          data-tv-focusable="true"
                          className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-primary hover:bg-white/5 border border-white/10 hover:border-primary/20 rounded-full cursor-pointer transition-all duration-155"
                        >
                          <ChevronLeft className="w-3 h-3 shrink-0 -rotate-90" />
                        </button>
                      </div>

                      {/* Content Section */}
                      <div className="flex-grow pt-1 w-full min-h-0">
                        <HorizontalEpisodeList 
                          episodes={episodes}
                          currentIndex={episodeIndex}
                          seriesImage={seriesImage}
                          seriesId={seriesId}
                          onSelect={(ep, idx) => {
                            setIsIframeFallback(false);
                            setIsLoading(true);
                            onSelectEpisode(ep, idx);
                            setShowEpisodeMenu(false);
                            resetControlsTimeout(true);
                          }}
                        />
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* LOCAL TOAST NOTIFICATIONS */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[8000] pointer-events-none">
                <AnimatePresence>
                  {localToast && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="max-w-xs px-4 py-3 rounded-2xl bg-zinc-950/95 border border-white/10 text-white shadow-[0_15px_35px_rgba(0,0,0,0.8)] text-xs font-black text-right flex items-center gap-2 pointer-events-auto"
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        localToast.type === 'success' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' :
                        localToast.type === 'error' ? 'bg-rose-400 shadow-[0_0_6px_#f43f5e]' :
                        'bg-blue-400 shadow-[0_0_6px_#60a5fa]'
                      )} />
                      <span>{localToast.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}
      </div>
    </>
  );
});

export default CustomPlayer;
