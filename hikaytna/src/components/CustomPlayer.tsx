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
}

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
  } = props;

  const resolvedVideoUrl = React.useMemo(() => {
    if (!videoUrl) return '';
    if (videoUrl.includes('mega.nz')) {
      // Convert standard Mega file URLs into the embed URL representation
      // e.g. /file/... -> /embed/...
      return videoUrl.replace(/\/file\//i, '/embed/');
    }
    return videoUrl;
  }, [videoUrl]);

  const { profile } = useAuth();
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

  // Auto-Orient to landscape when maximized + playing
  useEffect(() => {
    if (isPlaying && isMaximized) {
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.lock === 'function') {
        // Attempt to lock to landscape
        (screen as any).orientation.lock('landscape').catch((e: any) => console.warn("Orientation lock unsupported or declined by user gesture", e));
      }
    } else {
      // Unlock when paused or closed
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        (screen as any).orientation.unlock();
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof (screen as any).orientation !== 'undefined' && typeof (screen as any).orientation.unlock === 'function') {
        (screen as any).orientation.unlock();
      }
    };
  }, [isPlaying, isMaximized]);

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
          console.log("GitHub ads file is empty. Disabling ads.");
          setAdCampaigns([]);
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
            setCurrentAdVideoSrc(campaign.videoUrl);
            setCurrentAdClickThrough(campaign.clickThrough);
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
    if (profile?.isPremium || localStorage.getItem('ads_removed_forever') === 'true') {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }
    if (adCampaigns.length === 0) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);

    // Pick random cinematic video ad source from campaign state list
    const randomIndex = Math.floor(Math.random() * adCampaigns.length);
    const campaign = adCampaigns[randomIndex];
    setCurrentAdVideoSrc(campaign.videoUrl);
    setCurrentAdClickThrough(campaign.clickThrough);
    setCurrentAdImpression(campaign.impressionUrl);

    // Fire impression and tracking pixels (BOTH Image and Fetch with no-cors to guarantee earnings registration)
    const trackUrls = [
      ...(campaign.impressionUrls || []),
      ...(campaign.trackingUrls || []),
      ...(campaign.impressionUrl ? [campaign.impressionUrl] : [])
    ];

    const uniqueTrackUrls = Array.from(new Set(trackUrls));

    uniqueTrackUrls.forEach((url) => {
      if (url && url.startsWith('http')) {
        // Fire via Fetch api in no-cors background mode
        fetch(url, { mode: 'no-cors' }).catch((err) => {
          console.warn("Fetch tracking pixel fail:", err);
        });
        
        // Fire via standard programmatic Image elements to ensure cookies + referrer context are properly saved
        try {
          const img = new Image();
          img.src = url;
        } catch (e) {
          console.warn("Image tracking pixel fail:", e);
        }
      }
    });

    setAdBreakActive(true);
    setAdIsPlaying(true);
    setAdMuted(false);
    setIframeHasLoaded(false);

    if (adFallbackTimeoutRef.current) {
      clearTimeout(adFallbackTimeoutRef.current);
    }
    
    // Check if we should use iframe ad mode
    const isForcedNetwork = campaign.clickThrough?.includes('effectivecpmnetwork.com');
    const isIframeAd = !campaign.videoUrl || 
                      campaign.videoUrl === "" ||
                      campaign.clickThrough?.includes('omg10.com') || 
                      campaign.clickThrough?.includes('tiny-ambition.com') ||
                      isForcedNetwork ||
                      campaign.clickThrough?.includes('silence') ||
                      campaign.clickThrough?.includes('silent');
    setUseIframeAd(true); // Force iframe mode for this specific network request as per user intent
    setIframeHasLoaded(false);

    // If it's a web-ad, set a safety timeout to force visibility if it fails to send load event
    const safetyTime = 6000;
    adFallbackTimeoutRef.current = setTimeout(() => {
      setIframeHasLoaded(true); 
      console.log("Forced ad visibility after safety timeout (6s)");
    }, safetyTime);

    // Skip button is now available after 8 seconds for better engagement
    setAdCountdown(8);
    setAdDuration(30);

    setAdCurrentTime(0);
    setAdDuration(isForcedNetwork ? 30 : (campaign.defaultDuration || 20));
  };

  useEffect(() => {
    if (!resolvedVideoUrl) return;

    sessionStartTimeRef.current = Date.now();
    lastTimeRef.current = 0;
    adPointsRef.current.clear();
    const newPoints: number[] = [];

    // Generate smarter trigger points for ads (Yellow Markers)
    // First ad scheduled early (after 30-45 seconds) for quick verification
    let nextScheduledPoint = Math.floor(Math.random() * 15) + 30; 
    for (let i = 0; i < 8; i++) {
      adPointsRef.current.add(nextScheduledPoint);
      newPoints.push(nextScheduledPoint);
      // Next ads every 2-4 minutes for active monetization session
      nextScheduledPoint += Math.floor(Math.random() * 120) + 120;
    }
    setVisualAdPoints(newPoints);

    console.log("Ad points scheduled:", newPoints);

    const interval = setInterval(() => {
      const wallTimeSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
      const video = videoRef.current;
      const videoTimeSeconds = video ? Math.floor(video.currentTime) : 0;
      
      const currentTime = isIframeFallback ? wallTimeSeconds : (videoTimeSeconds > 0 ? videoTimeSeconds : wallTimeSeconds);
      const previousTime = lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      if (adBreakActive || adCampaigns.length === 0) return; 

      // If user is Gold/Premium, skip
      if (profile?.isPremium || localStorage.getItem('ads_removed_forever') === 'true') {
        return;
      }

      // Trigger scheduled mid-rolls (Natural playback or Seeking past)
      const points = Array.from(adPointsRef.current) as number[];
      for (const pt of points) {
        // Condition 1: Natural playback hits the point
        // Condition 2: User seeks past the point (jumped from before pt to after pt)
        const hitPoint = (currentTime >= pt && currentTime < pt + 3);
        const jumpedPastPoint = (previousTime < pt && currentTime > pt + 1);

        if (hitPoint || jumpedPastPoint) {
          console.log(`Triggering ad at ${pt}s. Method: ${jumpedPastPoint ? 'Seek Detection' : 'Linear Playback'}`);
          adPointsRef.current.delete(pt); 
          setVisualAdPoints(prev => prev.filter(p => p !== pt));
          showAdBreak();
          break;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [resolvedVideoUrl, isIframeFallback, adsBlocked, profile, adCampaigns]);

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

  const handleSkipAd = () => {
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

    // If it's an iframe ad, clicking any part of the player area acts as a click-through
    if (useIframeAd && currentAdClickThrough) {
      window.open(currentAdClickThrough, '_blank');
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
    
      // Explicitly handle our secure frame proxies
      if (urlLower.startsWith('/api/v1/secured-player')) {
        setIsIframeFallback(true);
        setIsLoading(false);
        setIsPlaying(true);
        return;
      }
    
    const isDirectVideo = 
      urlLower.startsWith('/api/v1/stream-proxy') ||
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
          maxBufferLength: 60,           // 60s buffer
          maxMaxBufferLength: 360,       // Max buffer capacity up to 6 minutes of continuous streaming
          maxBufferSize: 64 * 1024 * 1024, // 64MB RAM limit
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
        video.src = resolvedVideoUrl;
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
      video.src = resolvedVideoUrl;
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
  }, [resolvedVideoUrl, episodeIndex, playerjsLoaded]);

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
      }, isTV ? 5050 : 3000); // Slightly shorter timeout on TV
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const isTV = /SmartTV|WebOS|Tizen|AppleTV|AndroidTV|GoogleTV|Opera TV|Viera|SonyDTV/i.test(navigator.userAgent);
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
      const isTV = /SmartTV|WebOS|Tizen|AppleTV|AndroidTV|GoogleTV|Opera TV|Viera|SonyDTV/i.test(navigator.userAgent);
      if (!isTV) return;

      switch(e.key) {
        case 'ArrowLeft':
          skipTime(-10);
          resetControlsTimeout(true);
          break;
        case 'ArrowRight':
          skipTime(10);
          resetControlsTimeout(true);
          break;
        case 'MediaPlayPause':
        case ' ' :
          handlePlayPause();
          resetControlsTimeout(true);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showControls, isPlaying]);


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

  const handleCanPlay = () => {
    setIsBuffering(false);
    const video = videoRef.current;
    if (!video) return;

    if (lastPositionRef.current > 0) {
      // Only restore if it's significantly different (e.g., reset to 0)
      if (Math.abs(video.currentTime - lastPositionRef.current) > 1) {
        video.currentTime = lastPositionRef.current;
      }
      lastPositionRef.current = 0; // Clear it
    }
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
      onMouseMove={handleMouseMove}
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
      {!resolvedVideoUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 gap-4">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
          <p className="text-zinc-400 text-sm font-bold tracking-widest text-center px-4">جاري تجهيز سيرفرات المشغل المباشر...</p>
        </div>
      ) : isIframeFallback ? (
        // Iframe / Web Embed Player view
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {!adBreakActive ? (
            <iframe 
              src={resolvedVideoUrl}
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
              className="flex items-center gap-2 bg-black/80 px-3 py-2 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all text-[10px] font-black uppercase tracking-wider shadow-2xl"
            >
              <List className="w-4 h-4 text-primary" />
              اختيار حلقة
            </button>
            
            <button
              onClick={toggleBrowserFullscreen}
              className="p-2 bg-black/80 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all shadow-2xl"
              title={isMaximized ? "تصغير الشاشة" : "تكبير الشاشة"}
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
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
            <button
              onClick={(e) => { e.stopPropagation(); toggleBrowserFullscreen(); }}
              className="p-2 bg-black/85 rounded-xl border border-white/10 hover:bg-black text-white hover:text-primary transition-all shadow-2xl"
            >
              {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        // High fidelity completely updated stable native fallback player (Netflix / YouTube styling)
        <>
          <SafariNotification />
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
            onWaiting={() => {}}
            onPlaying={() => { setIsLoading(false); }}
            onSeeking={() => {}}
            onSeeked={() => {}}
            onStalled={() => {}}
            onCanPlay={handleCanPlay}
            onCanPlayThrough={() => setIsBuffering(false)}
            preload="auto"
            className={cn(
              "w-full h-full object-contain pointer-events-none transition-all duration-500",
              !isPlaying ? "opacity-60 blur-[2px]" : "opacity-100 blur-0"
            )}
            style={{ pointerEvents: 'none' }}
            playsInline={true}
            tabIndex={-1}
            controls={false}
            {...{
              "webkit-playsinline": "true",
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

              {/* Buffering/Offline Indicator */}
              {isOffline && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none bg-black/30 backdrop-blur-sm">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-3 text-sm text-white font-medium drop-shadow-md">
                    تحقق من الاتصال...
                  </p>
                </div>
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
                    <div className="w-12 h-12 bg-black/80 border border-white/15 rounded-full text-white flex items-center justify-center shadow-2xl">
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
                  {/* Yellow Ad Indicators like YouTube */}
                  {visualAdPoints.length > 0 && visualAdPoints.map((pt: number) => {
                    const totalDuration = duration || (videoRef.current?.duration) || 3600;
                    const ratio = pt / totalDuration;
                    if (ratio > 1) return null;
                    return (
                      <div 
                        key={pt}
                        className="absolute w-1 px-0.5 h-full z-[25] top-0 pointer-events-none flex items-center justify-center"
                        style={{ left: `${ratio * 100}%` }}
                      >
                         <div className="w-[3px] h-full bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,1)] border-x border-black/20" />
                      </div>
                    );
                  })}
                  
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePlayPause(); }}
                    tabIndex={0}
                    className="p-1.5 bg-primary hover:bg-[#c10d10] text-white rounded-full transition-all active:scale-95 shadow-lg shadow-primary/30 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none"
                    title={isPlaying ? "إيقاف" : "تشغيل"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>

                  <button 
                    onClick={(e) => skipTime(-10, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') skipTime(-10); }}
                    tabIndex={0}
                    className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none rounded-full"
                    title="الرجوع 10 ثواني"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button 
                    onClick={(e) => skipTime(10, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') skipTime(10); }}
                    tabIndex={0}
                    className="p-1 text-zinc-405 hover:text-white transition-colors hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none rounded-full"
                    title="التقديم 10 ثواني"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Volume Controller with seamless popup */}
                  <div className="flex items-center gap-1 group/volume pl-1 border-l border-white/5">
                    <button 
                      onClick={toggleMute}
                      onKeyDown={(e) => { if (e.key === 'Enter') toggleMute(); }}
                      tabIndex={0}
                      className="p-1 text-zinc-400 hover:text-white transition-colors focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none rounded-full"
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
                      tabIndex={0}
                      className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none"
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
                            tabIndex={0}
                            className={cn(
                              "w-full text-center py-1 rounded-md text-[9px] font-bold transition-all px-1.5 text-right focus:bg-primary/90 focus:text-white focus:outline-none",
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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setShowEpisodeMenu(!showEpisodeMenu); setShowSpeedMenu(false); } }}
                    tabIndex={0}
                    aria-label="الحلقات"
                    className="flex items-center gap-1.5 bg-primary/25 hover:bg-primary/35 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-primary/40 text-white font-black text-[10px] sm:text-xs tracking-tight shadow-xl active:scale-95 transition-all pointer-events-auto focus:ring-4 focus:ring-primary focus:scale-105 focus:outline-none focus:bg-primary/40"
                  >
                    <List className="w-3.5 h-3.5 text-primary" />
                    <span>الحلقات</span>
                  </button>

                  {/* Browser fullscreen trigger */}
                  <button 
                    onClick={toggleBrowserFullscreen}
                    tabIndex={0}
                    className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all border border-white/5 focus:ring-4 focus:ring-primary focus:scale-110 focus:outline-none"
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

      <AnimatePresence>
        {adBreakActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 z-[400] overflow-hidden flex flex-col no-toggle select-none transition-colors duration-500",
              "bg-[#0a0a0c]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPauseAd();
            }}
          >
            {/* Background HTML5 Video Ad Stream or Web Ad Iframe */}
            <div className={cn(
              "absolute inset-0 z-0 flex items-center justify-center transition-colors duration-500",
              "bg-[#0a0a0c]"
            )}>
              {useIframeAd ? (
                 <div className="w-full h-full relative z-0 bg-[#0a0a0c] flex items-center justify-center">
                   {/* Ad loader overlay on top */}
                   {!iframeHasLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0c] z-[20] pointer-events-none">
                       <div className="relative w-14 h-14 mb-5">
                          <div className="absolute inset-0 border-[3px] border-yellow-500/10 rounded-full"></div>
                          <div className="absolute inset-0 border-[3px] border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                          <div className="absolute inset-2 border border-white/5 rounded-full animate-pulse"></div>
                       </div>
                       <div className="text-center px-6 max-w-xs">
                          <span className="text-yellow-500 text-[11px] font-black uppercase tracking-[0.25em] block mb-2 animate-pulse">تحميل الإعلان الآمن</span>
                          <span className="text-zinc-500 text-[8px] font-medium leading-relaxed">يرجى الانتظار قليلاً.. نجهز لك عرضاً مميزاً يدعم استمرارية "حكايتنا"</span>
                       </div>
                    </div>
                   )}
                   <iframe 
                     src={currentAdClickThrough || ''} 
                     className={cn(
                       "absolute inset-0 w-full h-full border-none pointer-events-auto z-10 transition-opacity duration-300",
                       iframeHasLoaded ? "opacity-100" : "opacity-0"
                     )}
                     title="Sponsored Offer"
                     allow="autoplay; fullscreen; encrypted-media"
                     sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                     referrerPolicy="no-referrer"
                     onLoad={() => {
                        setIframeHasLoaded(true);
                        if (adFallbackTimeoutRef.current) {
                          clearTimeout(adFallbackTimeoutRef.current);
                        }
                     }}
                   />
                   {/* Integrated Sponsored Label */}
                   {iframeHasLoaded && (
                     <div className="absolute top-4 left-3 z-[20] flex items-center gap-2 pointer-events-none">
                       <div className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-xl">AD</div>
                       <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-white/90 text-[10px] font-bold border border-white/10 uppercase tracking-widest">Sponsored</div>
                     </div>
                   )}
                 </div>
              ) : (
                <>
                  {currentAdClickThrough && (
                    <iframe 
                      src={currentAdClickThrough} 
                      className="absolute inset-0 w-1 h-1 opacity-0 pointer-events-none" 
                      title="Earnings Tracker"
                    />
                  )}
                  <video
                    ref={adVideoRef}
                    src={currentAdVideoSrc}
                    className="w-full h-full object-cover opacity-90 cursor-pointer"
                    playsInline
                    autoPlay
                    muted={adMuted}
                    onTimeUpdate={() => {
                      if (adVideoRef.current) {
                         setAdCurrentTime(adVideoRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (adVideoRef.current) {
                         setAdDuration(adVideoRef.current.duration || 15);
                      }
                    }}
                    onEnded={handleSkipAd}
                  />
                </>
              )}

              {/* Premium dark gradient overlay masks so branding and buttons are highly legible */}
              <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-10" />
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black via-black/35 to-transparent pointer-events-none z-10" />
            </div>

            {/* Top Info Bar */}
            <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-4 z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full border border-white/15 pointer-events-auto shadow-md">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-black text-amber-400 font-sans tracking-wide">
                  {useIframeAd ? "إعلان برعاية" : "إعلان فيديو ممول"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-white/15 pointer-events-auto shadow-md">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-black text-white/90">حكايتنا بريميوم</span>
              </div>
            </div>

            {/* Small YouTube-Style Advertiser Box in Bottom-Left */}
            <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-6 z-20 pointer-events-none">
              <motion.a 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.95, y: 0 }}
                href={currentAdClickThrough}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="pointer-events-auto bg-black/80 hover:bg-black/95 text-white border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black tracking-tight transition-all hover:scale-105 shadow-2xl max-w-[190px] hover:border-amber-400/50"
              >
                <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">زيارة موقع المعلن ↗</span>
              </motion.a>
            </div>

            {/* Bottom Controls Bar for Ad Media */}
            <div 
              className="absolute bottom-3 inset-x-3 h-12 bg-black/80 rounded-xl border border-white/10 flex items-center justify-between px-3 z-[30] shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Controls on Left: Play/Pause, Mute, Timer */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePlayPauseAd}
                  className="p-1.5 text-white hover:text-primary transition-colors hover:bg-white/5 rounded-lg border border-white/5"
                  title={adIsPlaying ? "إيقاف مؤقت" : "تشغيل"}
                >
                  {adIsPlaying ? <Pause className="w-3.5 h-3.5 fill-current animate-pulse text-white hover:text-primary" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-white hover:text-primary" />}
                </button>

                <button
                  type="button"
                  onClick={handleToggleMuteAd}
                  className="p-1.5 text-white hover:text-primary transition-colors hover:bg-white/5 rounded-lg border border-white/5"
                  title={adMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                >
                  {adMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500 hover:text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-white hover:text-primary" />}
                </button>

                {/* Ad Timeline Label */}
                <span className="text-[10px] sm:text-[11px] font-black font-sans text-zinc-300 select-none">
                  إعلان • {Math.floor(adCurrentTime)}ث / {Math.floor(adDuration)}ث
                </span>
              </div>

              {/* Seamless Linear Ad Progress Bar in Amber/Yellow YouTube styling */}
              <div className="flex-1 max-w-xs mx-4 h-1 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_#f59e0b] transition-all duration-300"
                  style={{ width: `${(adCurrentTime / (adDuration || 15)) * 100}%` }}
                />
              </div>

              {/* Skipping mechanism */}
              <div className="flex items-center shrink-0">
                {adCountdown > 0 ? (
                  <div className="bg-black/60 border border-white/10 px-2.5 py-1.5 rounded-lg text-white font-black text-[10px] sm:text-xs flex items-center gap-1.5 select-none font-sans">
                    <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>تخطي بعد {adCountdown}ث</span>
                  </div>
                ) : (
                  <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    type="button"
                    onClick={handleSkipAd}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black font-black hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] px-4 py-2 rounded-lg border border-black/10 transition-all text-xs uppercase flex items-center gap-2 active:scale-95 font-sans"
                  >
                    <span>تخطي الإعلان</span>
                    <ArrowRight className="w-3 h-3 text-current animate-bounce" />
                  </motion.button>
                )}
              </div>
            </div>
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
                          (activeServerUrl ? srv.url === activeServerUrl : srv.url === resolvedVideoUrl)
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
                    onSelect={(ep, idx) => {
                      onSelectEpisode(ep, idx);
                      setShowEpisodeMenu(false);
                    }}
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
