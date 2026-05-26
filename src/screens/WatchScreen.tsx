import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Share2, Heart, History, MessageSquare, X, ChevronDown, ChevronUp, Download, Trash2, Play, CheckCircle2, AlertTriangle, Globe, Wifi, WifiOff, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import EpisodeGrid from '../components/EpisodeGrid';
import CustomPlayer from '../components/CustomPlayer';
import Header from '../components/Header';
import { fetchEpisodesFromAPI, fetchPlayUrlFromAPI } from '../services/api';
import { Episode, Series } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { progressService } from '../services/progressService';
import { encryptValue } from '../lib/security';
import SeriesChat from '../components/SeriesChat';
import { offlineService } from '../services/offlineService';

export default function WatchScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { series } = (location.state as { series: Series }) || {};
  
  useEffect(() => {
    if (!series) {
      navigate('/', { replace: true });
    }
  }, [series, navigate]);

  if (!series) return null;

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [activeServerUrl, setActiveServerUrl] = useState('');
  const [servers, setServers] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  
  // Ad verification States
  const [isAdVisited, setIsAdVisited] = useState(() => {
    return localStorage.getItem('hek_ad_visited_v1') === 'true';
  });
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCountdown, setAdCountdown] = useState(10);
  const [hasClickedAd, setHasClickedAd] = useState(false);
  
  // Offline caching States
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [isPlayingOffline, setIsPlayingOffline] = useState(false);
  
  // Custom Sleek toast message state
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const checkOfflineStatus = async () => {
    if (!series || episodes.length === 0) return;
    try {
      const isDownloadedResult = await offlineService.isEpisodeDownloaded(series.id, currentEpisode);
      setIsDownloaded(isDownloadedResult);
    } catch {
      setIsDownloaded(false);
    }
  };

  useEffect(() => {
    checkOfflineStatus();
    setIsPlayingOffline(false);
  }, [currentEpisode, episodes, series?.id]);

  // Countdown timer when clicking the sponsor link
  useEffect(() => {
    let timer: any;
    if (showAdModal && hasClickedAd && adCountdown > 0) {
      timer = setInterval(() => {
        setAdCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showAdModal, hasClickedAd, adCountdown]);

  const handleOpenAdLink = () => {
    setHasClickedAd(true);
    setAdCountdown(10);
    window.open('https://omg10.com/4/10670523', '_blank', 'noopener,noreferrer');
  };

  const handleUnlockDownloads = () => {
    localStorage.setItem('hek_ad_visited_v1', 'true');
    setIsAdVisited(true);
    setShowAdModal(false);
    setHasClickedAd(false);
    showToast('تم فتح ميزة التحميل والأوفلاين لجميع الحلقات بنجاح 🔓🎬', 'success');
  };

  const startDownloadFlow = async () => {
    if (!videoUrl) {
      showToast('برجاء تشغيل الحلقة أولاً حتى نتمكن من جلب السيرفر النشط', 'error');
      return;
    }

    const urlLower = videoUrl.toLowerCase();
    
    // Check if the current video is an iframe or YouTube video
    const isUnsupported = urlLower.includes('youtube.com') || 
                          urlLower.includes('youtu.be') || 
                          urlLower.includes('mega.nz') ||
                          (!videoUrl.startsWith('blob:') && 
                           !videoUrl.includes('/api/v1/stream-proxy') && 
                           !urlLower.includes('.mp4') && 
                           !urlLower.includes('.webm') &&
                           !urlLower.includes('.m3u8') &&
                           !urlLower.includes('.mov'));

    if (isUnsupported) {
      showToast('هذا السيرفر عبارة عن مشغّل خارجي ولا يدعم التحميل للأوفلاين. يرجى اختيار السيرفر الرئيسي أو سيرفر مباشر آخر! ⚠️', 'error');
      return;
    }

    if (urlLower.includes('.m3u8')) {
      showToast('هذا السيرفر عبارة عن بث مجزأ (M3U8) لا يدعم وضع الأوفلاين للتحميل. يرجى اختيار سيرفر MP4 عادي للتحميل! 🍿', 'error');
      return;
    }

    if (!isAdVisited) {
      setAdCountdown(10);
      setHasClickedAd(false);
      setShowAdModal(true);
      return;
    }

    try {
      setDownloadError('');
      setDownloadProgress(0);
      const epTitle = episodes[currentEpisode]?.title || `الحلقة ${currentEpisode + 1}`;
      
      showToast('جاري البدء في تحميل الحلقة محلياً... قد يستغرق ذلك دقيقة 🚀', 'info');

      await offlineService.downloadEpisode(
        series.id,
        series.title,
        series.image,
        currentEpisode,
        epTitle,
        videoUrl,
        (progress) => {
          setDownloadProgress(progress);
        }
      );

      setIsDownloaded(true);
      setDownloadProgress(null);
      showToast('تم تنزيل الحلقة بنجاح! يمكنك الآن فصل الإنترنت ومتابعة المشاهدة 🍿✨', 'success');
    } catch (err: any) {
      console.error(err);
      setDownloadProgress(null);
      setDownloadError('فشل تنزيل الحلقة من السيرفر الحالي. يرجى تجربة سيرفر آخر.');
      showToast('تعذر تنزيل الحلقة من السيرفر الحالي', 'error');
    }
  };

  const playOfflineEpisode = async () => {
    try {
      const data = await offlineService.getOfflineEpisodeBlob(series.id, currentEpisode);
      if (data) {
        const localBlobUrl = URL.createObjectURL(data.blob);
        setVideoUrl(localBlobUrl);
        setIsPlayingOffline(true);
        showToast('وضع الأوفلاين نشط! تشغيل آمن وسريع من الهاتف مباشرة 🔌⚡', 'success');
      } else {
        showToast('الملف المحلي غير متوفر أو تالف', 'error');
      }
    } catch (err) {
      showToast('خطأ أثناء تشغيل الملف المحلي', 'error');
    }
  };

  const saveToDeviceExternally = async () => {
    try {
      const data = await offlineService.getOfflineEpisodeBlob(series.id, currentEpisode);
      if (data) {
        const epTitle = episodes[currentEpisode]?.title || `الحلقة ${currentEpisode + 1}`;
        const cleanTitle = `${series.title}_الحلقة_${epTitle}.mp4`.replace(/\s+/g, '_');
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(data.blob);
        a.download = cleanTitle;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('جاري حفظ ملف الفيديو في مجلد التنزيلات بجهازك 💾🚀', 'success');
      } else {
        showToast('ملف الحلقة غير متوفر للتصدير الخارجي', 'error');
      }
    } catch (err) {
      showToast('تعذر تصدير الملف الخارجي لجهازك', 'error');
    }
  };

  const deleteOfflineEpisode = async () => {
    if (window.confirm('هل تريد حذف هذه الحلقة من الذاكرة المحلية لتوفير مساحة على هاتف؟')) {
      try {
        await offlineService.deleteOfflineEpisode(series.id, currentEpisode);
        setIsDownloaded(false);
        setIsPlayingOffline(false);
        // Reload episode to original online server URL
        const rawUrl = episodes[currentEpisode]?.link1 || episodes[currentEpisode]?.url;
        const onlineUrl = await getSecuredUrl(rawUrl);
        setVideoUrl(onlineUrl);
        showToast('تمت إزالة الملف المحلي وتحرير المساحة بنجاح 🗑️', 'success');
      } catch {
        showToast('فشل حذف الملف المحلي', 'error');
      }
    }
  };
  
  const playerRef = useRef<HTMLDivElement>(null);
  const playerControlRef = useRef<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const resolvedUrlsCache = useRef<Record<string, string>>({});

  // Always scroll to the absolute top of the page immediately on mount and whenever the series changes
  useEffect(() => {
    window.scrollTo(0, 0);

    const handleScrollTop = () => {
      window.scrollTo({ top: 0, behavior: 'instant' as any });
    };
    
    // Multiple visual frame checks for mobile and slow networks
    handleScrollTop();
    const timer1 = setTimeout(handleScrollTop, 50);
    const timer2 = setTimeout(handleScrollTop, 150);
    const timer3 = setTimeout(handleScrollTop, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [series?.id]);

  // Esc key to exit maximized viewport mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // iOS Visual Viewport fix for Drawer
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        if (isChatOpen || isMaximized) {
          // window.scrollTo(0, 0); // Removed to prevent forced scrolling during keyboard focus
        }
      }
    };

    if (window.visualViewport) {
      handleResize();
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [isChatOpen, isMaximized]);

  // Prevent background body scrolling when viewing in immersive maximized mode
  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100vw';
      document.body.style.height = '100dvh';
      document.body.style.top = '0';
      document.body.style.left = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    };
  }, [isMaximized]);

  useEffect(() => {
    if (!series) {
      navigate('/');
      return;
    }
    const controller = new AbortController();
    
    // Deeply reset states to guarantee instant transition for new series from the AI drawer
    setEpisodes([]);
    setCurrentEpisode(0);
    setVideoUrl('');
    setServers([]);
    setLoading(true);
    resolvedUrlsCache.current = {}; // Clean up memory cache for the new series!
    
    loadEpisodes(controller.signal);

    return () => {
      controller.abort("Series changed or watch unmounted");
    };
  }, [series?.id]);

  // High-performance background prefetching disabled for TV browsers
  useEffect(() => {
    // Left intentionally empty
  }, [currentEpisode, episodes]);
  
  async function loadEpisodes(signal?: AbortSignal) {
    let eps: Episode[] = [];
    
    if (series.url) {
      eps = await fetchEpisodesFromAPI(series.url, signal);
    }
    
    if (eps.length === 0 && series.episodes) {
      eps = Array.isArray(series.episodes) 
        ? series.episodes 
        : Object.values(series.episodes);
    }
    
    // Filter duplicates if not "حلم اشرف" or "ليلى_مدبلج"
    let finalEps = eps;
    if (series.title !== "حلم اشرف" && series.title !== "ليلى_مدبلج") {
      const uniqueEps: Episode[] = [];
      const seenEpisodes = new Set();
      for (const ep of eps) {
        const key = `${ep.title}-${ep.link1 || ep.url}`;
        if (!seenEpisodes.has(key)) {
          uniqueEps.push(ep);
          seenEpisodes.add(key);
        }
      }
      finalEps = uniqueEps;
    }
    
    // Sort episodes numerically based on title, handling special keywords
    finalEps.sort((a, b) => {
      const getOrder = (title: string) => {
        const cleanTitle = title.toLowerCase();
        if (cleanTitle.includes('الاخيرة') || cleanTitle.includes('الأخيرة') || cleanTitle.includes('last')) return 99999;
        
        // Extract the first number found in the title
        const match = title.match(/\d+/);
        if (match) return parseInt(match[0]);
        
        return 0;
      };
      
      const orderA = getOrder(a.title);
      const orderB = getOrder(b.title);
      
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
    
    setEpisodes(finalEps);
    if (finalEps.length > 0) {
      // Check last watched episode if any
      const savedIndex = localStorage.getItem(`mo_play_last_ep_${series.id}`);
      const indexToPlay = savedIndex ? parseInt(savedIndex) : 0;
      const episodeToPlay = finalEps[indexToPlay] || finalEps[0];
      if (episodeToPlay) {
        playEpisode(episodeToPlay, indexToPlay, false);
      }
    }
    setLoading(false);
  }
  
  async function getSecuredUrl(rawUrl: string, signal?: AbortSignal) {
    if (!rawUrl) return '';
    if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be') || rawUrl.startsWith('/api/v1/')) {
      return rawUrl;
    }
    
    // Check local memory cache first for instant resolution with 0ms delay!
    if (resolvedUrlsCache.current[rawUrl]) {
      return resolvedUrlsCache.current[rawUrl];
    }
    
    const lowerUrl = rawUrl.toLowerCase();
    const isDirect = lowerUrl.includes('.mp4') || 
                     lowerUrl.includes('.m3u8') || 
                     lowerUrl.includes('.webm') || 
                     lowerUrl.includes('.ogg') || 
                     lowerUrl.includes('.mov');

    if (isDirect) {
      resolvedUrlsCache.current[rawUrl] = rawUrl;
      return rawUrl;
    } else {
      // It's probably an iframe player that requires resolving
      const playUrl = await fetchPlayUrlFromAPI(rawUrl, signal);
      const result = playUrl || rawUrl;
      resolvedUrlsCache.current[rawUrl] = result;
      return result;
    }
  }

  const playControllerRef = useRef<AbortController | null>(null);

  async function playEpisode(ep: Episode, index: number, autoScroll = true) {
    // Abort previous play request if any
    if (playControllerRef.current) {
      playControllerRef.current.abort("New episode selected");
    }
    const controller = new AbortController();
    playControllerRef.current = controller;

    // Save progress of current episode
    if (episodes.length > 0) {
      progressService.markAsWatched(series.id, currentEpisode);
    }

    // Check if the episode is downloaded in offline storage (if so, always play it on the main custom player!)
    let isEpDownloaded = false;
    try {
      isEpDownloaded = await offlineService.isEpisodeDownloaded(series.id, index);
    } catch (e) {
      console.error("Failed to check if episode is downloaded:", e);
    }

    if (isEpDownloaded && !navigator.onLine) {
      try {
        const data = await offlineService.getOfflineEpisodeBlob(series.id, index);
        if (data) {
          const localBlobUrl = URL.createObjectURL(data.blob);
          setCurrentEpisode(index);
          localStorage.setItem(`mo_play_last_ep_${series.id}`, index.toString());
          setVideoUrl(localBlobUrl);
          setActiveServerUrl('blob:offline');
          setIsDownloaded(true);
          setIsPlayingOffline(true);
          showToast('تم تشغيل الحلقة المحملة محلياً (وضع الأوفلاين) 🍿⚡', 'success');
          if (autoScroll) {
            playerRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
          return;
        }
      } catch (e) {
        console.error("Offline episode loading failed:", e);
      }
    }

    // Clean offline state auto-transitions: if we have internet, reset the offline mode state and stream normally!
    // If offline but we have internet (unreliable navigator.onLine), proceed
    if (navigator.onLine) {
      setIsPlayingOffline(false);
    } else {
      // Check if we can reach our own health endpoint to double-check "offline" status
      try {
        const ping = await fetch('/api/health').catch(() => null);
        if (ping && ping.ok) {
          // We are actually online!
          setIsPlayingOffline(false);
        } else {
          // Truly offline and the episode is not downloaded to local storage!
          showToast('⚠️ يرجى تحميل هذه الحلقة أولاً لتتمكن من مشاهدتها بدون إنترنت! 🍿🔒', 'error');
          return;
        }
      } catch (err) {
        showToast('⚠️ يرجى تحميل هذه الحلقة أولاً لتتمكن من مشاهدتها بدون إنترنت! 🍿🔒', 'error');
        return;
      }
    }

    // Normal Online playback mode
    setCurrentEpisode(index);
    localStorage.setItem(`mo_play_last_ep_${series.id}`, index.toString());
    
    setVideoUrl(''); // Reset for loader
    
    let rawUrl = ep.link1 || ep.url;
    let url = await getSecuredUrl(rawUrl, controller.signal);
    
    if (controller.signal.aborted) return;
    
    setVideoUrl(url);
    setActiveServerUrl(rawUrl);
    
    // Setup servers
    const srv = [
      { name: 'سيرفر رئيسي', url: ep.link1 || ep.url },
      { name: 'سيرفر احتياطي 1', url: ep.link2 || '' },
      { name: 'سيرفر احتياطي 2', url: ep.link3 || '' },
    ].filter(s => s.url);
    
    setServers(srv);

    // Dynamic initial check to see if THIS episode is already downloaded
    try {
      const offlineCheck = await offlineService.isEpisodeDownloaded(series.id, index);
      setIsDownloaded(offlineCheck);
    } catch {
      setIsDownloaded(false);
    }

    // Scroll to player
    if (autoScroll) {
      playerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function handleServerSelect(rawUrl: string) {
     if (playControllerRef.current) playControllerRef.current.abort("Server switched");
     const controller = new AbortController();
     playControllerRef.current = controller;

     setVideoUrl(''); // loader
     let url = await getSecuredUrl(rawUrl, controller.signal);
     if (controller.signal.aborted) return;
     setVideoUrl(url);
     setActiveServerUrl(rawUrl);
  }

  if (!series) return null;
  
  return (
    <div className="min-h-screen bg-[#050505] pb-20">
      <Header />
      
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        {/* Navigation Info */}
        <div className="w-full px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between text-gray-400 text-[10px] sm:text-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">الرئيسية</button>
            <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4 rotate-180" />
            <span className="text-white font-semibold truncate max-w-[120px] sm:max-w-none">{series.title}</span>
          </div>
        </div>

        {/* Professional Video Player Section */}
        {loading ? (
          <div className="w-full aspect-video flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div 
            ref={playerRef}
            className={cn(
              "w-full transition-all duration-300 sticky top-0 bg-[#050505] z-40",
              isMaximized 
                ? "fixed inset-0 w-full z-[100]" 
                : "relative mb-6 sm:mb-8"
            )}
          >
            <CustomPlayer
              ref={playerControlRef}
              videoUrl={videoUrl}
              activeServerUrl={activeServerUrl}
              seriesId={series.id}
              seriesImage={series.image}
              episodeIndex={currentEpisode}
              episodes={episodes}
              servers={servers}
              onSelectEpisode={(ep, idx) => playEpisode(ep, idx)}
              onSelectServer={handleServerSelect}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(!isMaximized)}
              onTimeUpdate={(t) => setPlayerTime(t)}
            />
          </div>
        )}



        <div className="w-full px-4 sm:px-8 flex flex-col lg:flex-row gap-8 sm:gap-12">
          {/* Main Content (Player + Info) */}
          <div className="flex-1 space-y-8 sm:space-y-12">
            {/* Info Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div>
                <motion.div 
                   initial={{ x: 20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   className="flex items-center gap-2 mb-2"
                >
                  <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black italic uppercase">Now Playing</span>
                </motion.div>
                <motion.h1 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl sm:text-5xl font-black-italic text-white"
                >
                  {series.title}
                </motion.h1>
                <p className="text-zinc-500 font-bold text-xs sm:text-sm mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {episodes[currentEpisode]?.title ? `الإطلالة: الحلقة ${episodes[currentEpisode].title}` : `الحلقة ${currentEpisode + 1}`}
                </p>
              </div>

              {/* Professional Chat Portal Trigger Card */}
              <div className="w-full lg:w-[420px] shrink-0 order-last lg:order-none">
                <div className="bg-[#121218] border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
                  {/* Collapsible header button */}
                  <button 
                    onClick={() => setIsChatExpanded(!isChatExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-900/80 hover:bg-zinc-800/90 border-b border-white/5 transition-all outline-none cursor-pointer group select-none text-right"
                  >
                    <div className="text-zinc-400 group-hover:text-white transition">
                      {isChatExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronUp className="w-4 h-4 text-zinc-500 animate-bounce" />}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col text-right">
                        <span className="text-[11px] font-black text-white">دردشة الحلقة المباشرة 🔥</span>
                        <span className="text-[9px] text-zinc-500 font-bold">تواصل ونقاش مع المجتمع حول هذه الحلقة</span>
                      </div>
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                  </button>

                  {isChatExpanded ? (
                    <div className="h-[400px] flex flex-col">
                      <SeriesChat 
                        seriesId={series.id} 
                        seriesTitle={series.title} 
                        seriesImage={series.image}
                        currentPlaybackTime={playerTime}
                        onSeekTo={(t) => {
                          playerControlRef.current?.seekTo(t);
                        }}
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsChatExpanded(true)}
                      className="p-5 text-center cursor-pointer hover:bg-zinc-900/40 transition duration-200 select-none group/tap"
                    >
                      <span className="text-[10px] font-black tracking-wider text-primary group-hover/tap:underline flex items-center justify-center gap-1.5 uppercase">
                        <span>اضغط لفتح شات النقاش والحماس</span>
                        <ChevronUp className="w-3.5 h-3.5 animate-bounce" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Servers Section */}
            <section className="bg-zinc-900/30 px-5 py-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" />
                <h2 className="text-xs sm:text-sm font-black text-zinc-400 font-sans">سيرفرات المشاهدة الإضافية:</h2>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-end">
                {servers.map((srv, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => handleServerSelect(srv.url)} 
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm active:scale-95 cursor-pointer",
                      srv.url === activeServerUrl 
                        ? "bg-primary border-primary text-white font-extrabold shadow-primary/20" 
                        : "bg-zinc-800/40 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-white/20"
                    )}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>
            </section>

            {/* المشاهدة والتحميل بدون إنترنت (سيرفر خارجي وداخلي) */}
            <section className="bg-gradient-to-r from-[#0d0d12]/90 to-[#12121e]/90 p-5 sm:p-6 rounded-3xl border border-white/5 relative overflow-hidden group shadow-xl">
              {/* Decorative premium ambient glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-300" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="space-y-1.5 text-right flex-1">
                  <div className="flex items-center gap-2 justify-end md:justify-start">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black italic uppercase tracking-wider">OFFLINE MODE</span>
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <h2 className="text-sm sm:text-base font-black text-white">نظام المتابعة والتحميل بدون إنترنت 📥</h2>
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-relaxed">
                    حمّل الحلقات مباشرة إلى جهازك وبسيرفر محلي فائق السرعة، لتستمتع بمتابعة مسلسلاتك المفضلة في أي مكان دون استهلاك باقة الإنترنت!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0 self-end md:self-auto w-full md:w-auto">
                  {downloadProgress !== null ? (
                    <div className="w-full sm:w-64 bg-zinc-950/95 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 relative">
                      <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-zinc-400">
                        <span>جاري حفظ الحلقة محلياً...</span>
                        <span className="text-primary font-black">{downloadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-200" 
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        <span>يرجى عدم إغلاق الصفحة لحين الانتهاء</span>
                      </div>
                    </div>
                  ) : isDownloaded ? (
                    <div className="flex flex-wrap gap-2 w-full justify-end sm:justify-start">
                      {isPlayingOffline ? (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold leading-none select-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <WifiOff className="w-3.5 h-3.5" />
                          <span>وضع تشغيل الأوفلاين نشط الآن</span>
                        </div>
                      ) : (
                        <button 
                          onClick={playOfflineEpisode}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>تشغيل أوفلاين (بدون نت)</span>
                        </button>
                      )}

                      <button 
                        onClick={saveToDeviceExternally}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 hover:text-white text-zinc-300 text-xs font-bold border border-white/5 transition-all active:scale-95 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>حفظ في الهاتف (خارجي)</span>
                      </button>

                      <button 
                        onClick={deleteOfflineEpisode}
                        className="flex items-center justify-center p-2 rounded-full bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 transition-all active:scale-95 cursor-pointer"
                        title="حذف من الذاكرة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startDownloadFlow}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-black transition-all active:scale-95 shadow-md shadow-primary/15 cursor-pointer"
                    >
                      <Download className="w-4 h-4 animate-bounce" />
                      <span>بدء تحميل الحلقة الحالية ⚡</span>
                    </button>
                  )}
                </div>
              </div>
              
              {downloadError && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}
            </section>

            {/* Episodes Grid Section */}
            <section className="bg-zinc-900/30 p-5 sm:p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 sm:h-6 bg-primary rounded-full animate-pulse" />
                <h2 className="text-lg sm:text-xl font-black-italic italic uppercase tracking-tight">قائمة الحلقات</h2>
              </div>
              <EpisodeGrid 
                episodes={episodes}
                currentIndex={currentEpisode}
                seriesId={series.id}
                seriesImage={series.image}
                onSelect={(ep, idx) => playEpisode(ep, idx)}
              />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-96 flex flex-col gap-6">

            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 p-6 rounded-3xl border border-white/5">
               <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-3">
                 <History className="w-3 h-3" />
                 DETAILS
               </div>
               <div className="space-y-3">
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Category</span>
                    <span className="text-white uppercase tracking-tighter shrink-0">{series.category || 'GENERAL'}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Rating</span>
                    <span className="text-yellow-400 shrink-0">⭐ {series.rating} / 10</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Views</span>
                    <span className="text-white shrink-0">{series.views}</span>
                 </div>
               </div>
            </div>

          </aside>
        </div>
      </div>

      {/* Modern Slide-over Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] cursor-pointer"
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '-100%' }}
               animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 240 }}
              className="fixed top-0 left-0 w-full sm:max-w-md bg-[#0d0d12] border-r border-white/5 z-[160] shadow-2xl flex flex-col"
              style={{ height: viewportHeight }}
              dir="ltr"
            >
              <div className="flex-1 h-full" dir="rtl">
                <SeriesChat 
                  seriesId={series.id} 
                  seriesTitle={series.title} 
                  seriesImage={series.image}
                  currentPlaybackTime={playerTime}
                  onSeekTo={(t) => {
                    playerControlRef.current?.seekTo(t);
                  }}
                  onClose={() => setIsChatOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sponsor Ad verification Modal */}
      <AnimatePresence>
        {showAdModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            {/* Backdrop with realistic blurring */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!hasClickedAd || adCountdown === 0) setShowAdModal(false);
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-[#0f0f15]/97 border border-white/10 rounded-[28px] p-6 sm:p-8 max-w-md w-full relative z-[210] shadow-2xl text-center backdrop-blur-md"
            >
              {/* Close Button if ready */}
              {(!hasClickedAd || adCountdown === 0) && (
                <button 
                  onClick={() => setShowAdModal(false)}
                  className="absolute top-4 left-4 p-1.5 rounded-full bg-zinc-900 border border-white/5 hover:bg-zinc-800 transition text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Icon Display */}
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                <Download className="w-7 h-7 text-primary" />
              </div>

              <h3 className="text-lg sm:text-xl font-black text-white mb-2 font-sans">تنشيط وضع التحميل والتشغيل بدون نت 🔓</h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                لكي تتمكن من تحميل حلقات المسلسل بجودة كاملة وبخصائص الأوفلاين، يرجى زيارة موقع الراعي الإعلاني لمدة <span className="text-primary font-bold">10 ثوانٍ فقط</span> لمساعدتنا في ترقية الخوادم وتوفير البث السريع مجاناً.
              </p>

              {/* Steps Area */}
              <div className="space-y-4 mb-6">
                {!hasClickedAd ? (
                  <button 
                    onClick={handleOpenAdLink}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-xs transition-all active:scale-95 shadow-xl shadow-primary/20 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>الدخول لموقع الراعي الإعلاني 🌐⚡</span>
                  </button>
                ) : (
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col items-center">
                    {adCountdown > 0 ? (
                      <>
                        {/* Countdown circle */}
                        <div className="w-14 h-14 rounded-full border-4 border-primary/10 border-t-primary animate-spin flex items-center justify-center text-sm font-black text-white mb-4">
                          <span className="animate-pulse">{adCountdown}</span>
                        </div>
                        <p className="text-xs text-zinc-400 font-bold">يرجى الانتظار لتأكيد الدورة الإعلانية...</p>
                        <p className="text-[10px] text-zinc-600 mt-1">المتبقي: {adCountdown} ثواني</p>
                      </>
                    ) : (
                      <div className="text-center space-y-4 w-full">
                        <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-black text-emerald-400">تم تفعيل التراخيص بنجاح! 🎉</p>
                          <p className="text-[10px] text-zinc-500 mt-1">شكراً لك على الدعم المتواصل لمجتمع حكايات.</p>
                        </div>
                        
                        <button 
                          onClick={handleUnlockDownloads}
                          className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
                        >
                          تفعيل وتحميل الحلقة الحالية الآن 🍿🔥
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Support reference note */}
              <div className="flex items-center gap-1.5 justify-center text-[10px] text-zinc-500 font-medium">
                <Globe className="w-3.5 h-3.5 text-zinc-600" />
                <span>نظام الحماية والروابط آمن ومعتمد 100%</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifier */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[250] max-w-sm w-full font-sans"
          >
            <div className={cn(
              "px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border text-xs sm:text-sm font-bold text-white text-right backdrop-blur-xl",
              toastMessage.type === 'success' 
                ? 'bg-[#062016]/95 border-emerald-500/30'
                : toastMessage.type === 'error'
                  ? 'bg-[#290a0a]/95 border-red-500/30'
                  : 'bg-[#12121c]/95 border-primary/30'
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0 animate-ping",
                toastMessage.type === 'success' 
                  ? 'bg-emerald-400' 
                  : toastMessage.type === 'error'
                    ? 'bg-red-400'
                    : 'bg-primary'
              )} />
              <span className="flex-1">{toastMessage.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
