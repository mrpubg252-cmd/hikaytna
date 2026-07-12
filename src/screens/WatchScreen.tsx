import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Share2, Heart, History, MessageSquare, X, ChevronDown, ChevronUp, Download, Trash2, Play, CheckCircle2, AlertTriangle, Globe, Wifi, WifiOff, ExternalLink, Sparkles, Loader2, Users } from 'lucide-react';
import EpisodeGrid, { formatEpisodeTitle } from '../components/EpisodeGrid';
import CustomPlayer from '../components/CustomPlayer';
import Header from '../components/Header';
import { fetchEpisodesFromAPI, fetchPlayUrlFromAPI, fetchPlayDetailsFromAPI, fetchSeriesDetailsFromTMDB, fetchPersonCreditsFromTMDB, getProxiedImageUrl } from '../services/api';
import { fetchAllSeries } from '../services/dataService';
import { Episode, Series } from '../services/firebase';
import { db } from '../services/firebase';
import { ref, set, onValue } from 'firebase/database';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { progressService } from '../services/progressService';
import { encryptValue } from '../lib/security';
import SeriesChat from '../components/SeriesChat';
import { offlineService } from '../services/offlineService';
import { getApiUrl } from '../lib/apiConfig';
import { getTMDBPosterSync } from '../lib/tmdbHealing';

export default function WatchScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { seriesId, episodeIndex } = useParams();
  const { series: routeSeries } = (location.state as { series: Series }) || {};

  // Resolve the series, loading from route state, local storage cache, or sessionStorage backup
  const [series, setSeries] = useState<Series | null>(() => {
    if (routeSeries) {
      sessionStorage.setItem('backup_watching_series', JSON.stringify(routeSeries));
      return routeSeries;
    }

    const targetId = seriesId || new URLSearchParams(window.location.search).get('id');
    if (targetId) {
      const cleanTId = targetId.trim();

      // High performance fallback: check the local storage series cache for instant 0ms offline lookup
      try {
        const cachedData = localStorage.getItem('serene_series_cache');
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          const rawList = parsedCache?.data;
          if (Array.isArray(rawList)) {
            const found = rawList.find((s: any) => {
              const cleanSId = s.id?.trim() || '';
              const cleanTitle = s.title?.trim() || '';
              return (
                cleanSId === cleanTId ||
                encodeURIComponent(cleanSId) === cleanTId ||
                cleanSId === decodeURIComponent(cleanTId) ||
                cleanTitle === cleanTId ||
                encodeURIComponent(cleanTitle) === cleanTId ||
                cleanTitle === decodeURIComponent(cleanTId)
              );
            });
            if (found) {
              sessionStorage.setItem('backup_watching_series', JSON.stringify(found));
              return found;
            }
          }
        }
      } catch (err) {
        console.warn("WatchScreen synchronous localStorage fallback failed:", err);
      }
    }

    const backup = sessionStorage.getItem('backup_watching_series');
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        if (!targetId) return parsed;
        
        const cleanTId = targetId.trim();
        const cleanPId = parsed.id.trim();
        const cleanPTitle = parsed.title?.trim() || '';
        
        if (
          cleanPId === cleanTId ||
          encodeURIComponent(cleanPId) === cleanTId ||
          cleanPId === decodeURIComponent(cleanTId) ||
          cleanPTitle === cleanTId ||
          encodeURIComponent(cleanPTitle) === cleanTId ||
          cleanPTitle === decodeURIComponent(cleanTId)
        ) {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loadingSeries, setLoadingSeries] = useState(!series);

  // Sync routeSeries with series state for smooth switching
  useEffect(() => {
    if (routeSeries) {
      setSeries(routeSeries);
      sessionStorage.setItem('backup_watching_series', JSON.stringify(routeSeries));
      setLoadingSeries(false);
    }
  }, [routeSeries]);

  const [isAdGatePassed, setIsAdGatePassed] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    const locParams = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    const isUnlockedParam = params.get('unlocked') === 'true' || locParams.get('unlocked') === 'true';
    const seriesIdFromUrl = seriesId || params.get('id');
    const isUnlockedSession = seriesIdFromUrl ? sessionStorage.getItem('unlocked_' + seriesIdFromUrl) === 'true' : false;
    return isUnlockedParam || isUnlockedSession;
  });

  // Dynamic series loading by ID if they arrived from the direct external ads link
  useEffect(() => {
    if (!series) {
      const params = new URLSearchParams(location.search);
      const queryId = seriesId || params.get('id');
      if (queryId) {
        setLoadingSeries(true);
        fetchAllSeries()
          .then((all) => {
            const found = all.find((s) => {
              const cleanSId = s.id.trim();
              const cleanQId = queryId.trim();
              const cleanTitle = s.title?.trim() || '';
              return (
                cleanSId === cleanQId ||
                encodeURIComponent(cleanSId) === cleanQId ||
                cleanSId === decodeURIComponent(cleanQId) ||
                cleanSId.replace(/_/g, '/') === cleanQId.replace(/_/g, '/') ||
                cleanTitle === cleanQId ||
                encodeURIComponent(cleanTitle) === cleanQId ||
                cleanTitle === decodeURIComponent(cleanQId)
              );
            });
            if (found) {
              setSeries(found);
              sessionStorage.setItem('backup_watching_series', JSON.stringify(found));
            } else {
              navigate('/', { replace: true });
            }
          })
          .catch(() => navigate('/', { replace: true }))
          .finally(() => setLoadingSeries(false));
      } else {
        navigate('/', { replace: true });
      }
    } else {
      setLoadingSeries(false);
    }
  }, [series, seriesId, location.search, navigate]);

  useEffect(() => {
    if (!series) return;

    const params = new URLSearchParams(window.location.search);
    const locParams = new URLSearchParams(location.search);

    // Detect if the page was hard-reloaded/refreshed
    const isReload = typeof window !== 'undefined' && (
      window.performance?.navigation?.type === 1 || 
      (window.performance?.getEntriesByType?.('navigation')?.[0] as any)?.type === 'reload'
    );

    if (isReload) {
      sessionStorage.removeItem('unlocked_' + series.id);
    }

    const isUnlockedParam = params.get('unlocked') === 'true' || locParams.get('unlocked') === 'true';
    const isUnlockedSession = sessionStorage.getItem('unlocked_' + series.id) === 'true';

    const isPremium = localStorage.getItem('ads_removed_forever') === 'true' || (() => {
      const adUntil = localStorage.getItem('ad_free_until');
      if (!adUntil) return false;
      const adUntilNum = parseInt(adUntil, 10);
      return !isNaN(adUntilNum) && adUntilNum > Date.now();
    })();

    if (isUnlockedParam || (isUnlockedSession && !isReload) || isPremium) {
      setIsAdGatePassed(true);
      sessionStorage.setItem('unlocked_' + series.id, 'true');
    } else {
      setIsAdGatePassed(false);
      // Direct full standalone window replace to the Express-served /ads endpoint (prevents history pollution)
      const currentPathName = window.location.pathname;
      const targetRedirect = `${window.location.origin}${currentPathName}?unlocked=true`;
      window.location.replace(`/gateway?id=${encodeURIComponent(series.id)}&redirect=${encodeURIComponent(targetRedirect)}`);
    }
  }, [series, location.search]);

  // Overcome mobile back button black screen/ads-looping issues
  useEffect(() => {
    if (!series || !isAdGatePassed) return;

    // Push a dummy history state to intercept the next system/device physical back actions
    window.history.pushState({ isWatchActive: true }, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      // Direct replace navigation back to standard home screen
      navigate('/', { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [series, isAdGatePassed, navigate]);

  if (loadingSeries || !series) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4 select-none">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-red-650 animate-spin relative z-10" />
          <div className="absolute inset-0 bg-red-600/20 blur-lg rounded-full scale-150 animate-pulse" />
        </div>
        <span className="text-xs text-zinc-400 font-black">جاري تحميل وتجهيز خادم الفيديو... 🍿</span>
        
        {/* Guard to prevent infinite loading if the fetch fails silently */}
        <button 
          onClick={() => navigate('/', { replace: true })}
          className="mt-4 px-6 py-2 bg-zinc-900 text-zinc-500 rounded-full text-[10px] font-bold border border-white/5 hover:text-white transition-all"
        >
          العودة للرئيسية في حال تعذر التحميل
        </button>
      </div>
    );
  }

  if (!isAdGatePassed) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        {/* Ambient premium glowing background */}
        <div className="absolute inset-0 bg-red-600/5 pointer-events-none opacity-40 animate-pulse" />
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full space-y-5">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin relative z-10" />
            <div className="absolute inset-0 bg-red-600/25 blur-xl rounded-full scale-150 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-white text-sm font-black tracking-tight">جاري تهيئة البث المباشر...</h3>
            <p className="text-zinc-500 text-[10px] leading-relaxed">يرصد النظام طلبك لتوجيهك لخادم الإعلانات الراعي ومتابعة البث بدقة فائقة سلسة 🍿⚡</p>
          </div>
        </div>
      </div>
    );
  }

  const resolvedSeriesImage = React.useMemo(() => {
    return getTMDBPosterSync(series.title, series.category) || getProxiedImageUrl(series.image) || "";
  }, [series]);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(() => {
    if (episodeIndex) {
      const parsed = parseInt(episodeIndex, 10);
      return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }
    const params = new URLSearchParams(window.location.search);
    const queryEp = params.get('ep');
    if (queryEp) {
      const parsed = parseInt(queryEp, 10);
      return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }
    return 0;
  });
  const [videoUrl, setVideoUrl] = useState('');
  const [activeServerUrl, setActiveServerUrl] = useState('');
  const [servers, setServers] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [tmdbData, setTmdbData] = useState<{ description: string; backdrop: string; rating: number; year: string; cast: any[]; crew: any[] } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  const [showPlayerNotice, setShowPlayerNotice] = useState(true);

  useEffect(() => {
    setShowPlayerNotice(true);
    const timer = setTimeout(() => {
      setShowPlayerNotice(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentEpisode]);

  const [selectedActor, setSelectedActor] = useState<any | null>(null);
  const [actorWorks, setActorWorks] = useState<Series[]>([]);
  const [loadingActorWorks, setLoadingActorWorks] = useState(false);
  const [allSiteSeries, setAllSiteSeries] = useState<Series[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const adminAccess = localStorage.getItem('short_admin_access') === 'true' || localStorage.getItem('guest_chat_name') === 'المدير 🛡️';
    setIsAdmin(adminAccess);

    const checkPins = () => {
      import('../services/api').then(({ categoryPins }) => {
        const p = categoryPins[series.id];
        setIsPinned(p && p.pinned === true);
      });
    };

    checkPins();

    const handleUpdate = () => checkPins();
    window.addEventListener("category-pins-updated", handleUpdate);
    
    // Global subscription to the pin state of THIS series in RTDB (Visible to everyone!)
    const pinRef = ref(db, `category_pins/${series.id}`);
    const unsubscribe = onValue(pinRef, (snapshot) => {
      const val = snapshot.val();
      setIsPinned(val && val.pinned === true);
    }, (err) => {
      console.warn("RTDB individual series pin sync deferred:", err.message);
      checkPins();
    });

    return () => {
      window.removeEventListener("category-pins-updated", handleUpdate);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [series.id]);

  const handleTogglePin = async () => {
    try {
      const pinData = isPinned ? null : {
        pinned: true,
        seriesId: series.id,
        title: series.title,
        category: series.category || '',
        pinnedAt: Date.now()
      };

      // 1. Persist directly inside Node back-end memory/JSON (100% reliable)
      const res = await fetch(`/api/v1/pins/${series.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pinData || { pinned: false })
      });
      const resData = await res.json();

      // Refresh cache
      if (resData && resData.pins) {
        const { syncCategoryPins } = await import('../services/api');
        await syncCategoryPins();
      }

      // 2. Safely sync to RTDB if we can, do not crash on auth blocks
      try {
        const pinRef = ref(db, `category_pins/${series.id}`);
        await set(pinRef, pinData);
      } catch (fbErr: any) {
        console.warn("Firebase RTDB Pin sync restricted (deferred on backend):", fbErr.message);
      }

      // 3. Write securely to local Firestore (Applet's own database ID for instant delivery!)
      try {
        const { doc, setDoc, deleteDoc } = await import("firebase/firestore");
        const { db: firestoreDb } = await import("../lib/firebase");
        const pinDocRef = doc(firestoreDb, "category_pins", series.id);
        if (pinData) {
          await setDoc(pinDocRef, pinData);
        } else {
          await deleteDoc(pinDocRef);
        }
      } catch (fsErr: any) {
        console.warn("Firestore Pin sync restricted:", fsErr.message);
      }

      if (isPinned) {
        setIsPinned(false);
        showToast('تم إلغاء تثبيت المسلسل من صدارة التصنيف بنجاح ✨', 'success');
      } else {
        setIsPinned(true);
        showToast('تم تثبيت المسلسل في صدارة التصنيف بنجاح 👑📌', 'success');
      }
    } catch (e: any) {
      console.error(e);
      showToast('فشل تعديل تثبيت المسلسل. حاول مجدداً.', 'error');
    }
  };

  // Load TMDB Data
  useEffect(() => {
    if (!series?.title) return;
    
    const controller = new AbortController();
    fetchSeriesDetailsFromTMDB(series.title, controller.signal)
      .then(data => {
        if (data) setTmdbData(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('TMDB error', err);
      });
      
    return () => controller.abort();
  }, [series?.title]);

  const handleActorClick = async (actor: any) => {
    setSelectedActor(actor);
    setLoadingActorWorks(true);
    setActorWorks([]);

    try {
      // 1. Ensure we have all site series loaded
      let currentAllSeries = allSiteSeries;
      if (currentAllSeries.length === 0) {
        currentAllSeries = await fetchAllSeries();
        setAllSiteSeries(currentAllSeries);
      }

      // 2. Fetch actor credits from TMDB
      const credits = await fetchPersonCreditsFromTMDB(actor.id);
      
      // 3. Normalize titles for comparison
      const normalize = (t: string) => (t || "").toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/ـ/g, "")
        .replace(/\b(ماطاش|ما\s+طاش)\b/gi, "مطاش")
        .replace(/^(مسلسل|برنامج|فيلم)\s+/g, "")
        .replace(/(مترجم|مدبلج|حصريا|كامل|كاملا|اون لاين|بجودة|عالية|HD|WEB-DL)/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const actorTitles = credits.map((c: any) => ({
        local: normalize(c.title || c.name),
        original: normalize(c.original_title || c.original_name)
      }));

      // 4. Cross reference with site series - use more strict matching
      const matched = currentAllSeries.filter(s => {
        const sNorm = normalize(s.title);
        if (sNorm.length < 2) return false; // Prevent matching empty or 1-letter titles
        
        return actorTitles.some((at: any) => {
          const checkMatch = (targetTitle: string) => {
            if (!targetTitle || targetTitle.length < 2) return false;
            
            // Check for exact match
            if (targetTitle === sNorm) return true;
            
            // Alphanumeric clean match to ignore punctuation
            const sClean = sNorm.replace(/[^a-zA-Z0-9ا-ي]/g, "");
            const tClean = targetTitle.replace(/[^a-zA-Z0-9ا-ي]/g, "");
            if (sClean === tClean) return true;
            
            // Split into clean words
            const getCleanWords = (str: string) => str
              .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'،؛]/g, " ")
              .split(/\s+/)
              .map(w => w.trim())
              .filter(w => w.length >= 2);

            const sWords = getCleanWords(sNorm);
            const tWords = getCleanWords(targetTitle);
            
            const genericWords = ["في", "من", "على", "مع", "لا", "ما", "عن", "ال", "حب", "حرب", "يوم", "حياة", "بنت", "ولد", "ابن", "ام", "اب", "طريق", "نجمة", "بحر", "امراة", "رجل", "ملك", "امير", "سماء", "ارض", "نور", "نار", "صيف", "شتاء", "ربيع", "خريف", "ليل", "نهار", "طائر"];

            if (sWords.length === 1 && tWords.length > 0) {
              const singleWord = sWords[0];
              // check if targetTitle has this word as an exact word block
              if (tWords.includes(singleWord)) return true;
            } else if (sWords.length > 1 && tWords.length > 0) {
              // Check intersection of words
              const matches = sWords.filter(sw => tWords.some(tw => tw === sw || tw.includes(sw) || sw.includes(tw)));
              // Filter out matches on generic words if we only matched 1 word
              const nonGenericMatches = matches.filter(m => !genericWords.includes(m));
              
              // If we matched multiple words, or if we matched a highly specific non-generic word
              if (matches.length >= 2 || (matches.length === 1 && nonGenericMatches.length > 0)) {
                return true;
              }
            }
            
            // Substring checks for longer titles
            if (sNorm.length >= 4 && targetTitle.includes(sNorm)) return true;
            if (targetTitle.length >= 4 && sNorm.includes(targetTitle)) return true;

            return false;
          };
          
          return checkMatch(at.local) || checkMatch(at.original);
        });
      });

      setActorWorks(matched);
    } catch (err) {
      console.error("Actor works filter error:", err);
    } finally {
      setLoadingActorWorks(false);
    }
  };
  
  // Ad verification States
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
    setShowAdModal(false);
    setHasClickedAd(false);
    startDownloadFlow(true);
  };

  const startDownloadFlow = async (bypassAd = false) => {
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

    const isPremium = localStorage.getItem('ads_removed_forever') === 'true' || (() => {
      const adUntil = localStorage.getItem('ad_free_until');
      if (!adUntil) return false;
      const adUntilNum = parseInt(adUntil, 10);
      return !isNaN(adUntilNum) && adUntilNum > Date.now();
    })();

    if (!bypassAd && !isPremium) {
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
  const resolvedUrlsCache = useRef<Record<string, any>>({});

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
      const seenTitles = new Set();
      for (const ep of eps) {
        if (!ep || !ep.title) continue;
        const normTitle = ep.title.trim().replace(/\s+/g, ' ');
        if (!seenTitles.has(normTitle)) {
          uniqueEps.push(ep);
          seenTitles.add(normTitle);
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
      // Respect dynamic route episodeIndex first
      let indexToPlay = 0;
      if (episodeIndex) {
        const parsed = parseInt(episodeIndex, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < finalEps.length) {
          indexToPlay = parsed;
        }
      } else {
        const savedIndex = localStorage.getItem(`mo_play_last_ep_${series.id}`);
        if (savedIndex) {
          const parsed = parseInt(savedIndex, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < finalEps.length) {
            indexToPlay = parsed;
          }
        }
      }
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
      const cached = resolvedUrlsCache.current[rawUrl];
      return typeof cached === 'string' ? cached : cached.player_url;
    }
    
    let targetUrl = rawUrl;
    const lowerUrl = rawUrl.toLowerCase();
    const isDirect = lowerUrl.includes('.mp4') || 
                     lowerUrl.includes('.m3u8') || 
                     lowerUrl.includes('.webm') || 
                     lowerUrl.includes('.ogg') || 
                     lowerUrl.includes('.mov');

    if (!isDirect) {
      // It's probably an iframe player that requires resolving
      const playUrl = await fetchPlayUrlFromAPI(rawUrl, signal);
      if (playUrl) {
        targetUrl = playUrl;
      }
    }

    let result = targetUrl.replace(/^http:\/\//i, 'https://');
    const resultLower = result.toLowerCase();

    // If it's a direct video stream, or if it points to AlooyTV/fitnur, or if the system resolved to an archive.org warning video,
    // proxy it via our server-side secure stream-proxy to inject the correct Referer/Origin headers.
    const isVideoFile = resultLower.includes('.mp4') || 
                        resultLower.includes('.m3u8') || 
                        resultLower.includes('.webm');
                        
    const is3iskSource = resultLower.includes('3iskk') || 
                          resultLower.includes('fitnur.com') || 
                          resultLower.includes('archive.org');

    const isIframe = resultLower.includes('/embed/') || 
                     resultLower.includes('/players/') || 
                     resultLower.includes('play.php') || 
                     resultLower.includes('iframe');

    if ((isVideoFile || is3iskSource) && !isIframe && !result.startsWith('/api/v1/')) {
      const encrypted = encodeURIComponent(encryptValue(result));
      result = getApiUrl(`/api/v1/stream-proxy/${encrypted}`);
    }

    resolvedUrlsCache.current[rawUrl] = result;
    return result;
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
          try {
            const cleanUrl = `/watch/${encodeURIComponent(series.title || series.id)}/${index}`;
            window.history.replaceState({ ...window.history.state }, '', cleanUrl);
          } catch (e) {
            console.warn("Unable to push clean state offline", e);
          }
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
        const ping = await fetch(getApiUrl('/api/health')).catch(() => null);
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
    
    // Gracefully update browser address bar with the clean URL without reloading!
    try {
      const cleanUrl = `/watch/${encodeURIComponent(series.title || series.id)}/${index}`;
      window.history.replaceState({ ...window.history.state }, '', cleanUrl);
    } catch (e) {
      console.warn("Unable to push clean state", e);
    }
    
    setVideoUrl(''); // Reset for loader
    
    let rawUrl = ep.link1 || ep.url;
    let finalUrl = '';
    let fetchedServers: { name: string; url: string }[] = [];

    if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be') || rawUrl.startsWith('/api/v1/')) {
      finalUrl = rawUrl;
      fetchedServers = [{ name: 'سيرفر رئيسي', url: rawUrl }];
    } else {
      // Check local cache
      const cached = resolvedUrlsCache.current[rawUrl];
      if (cached && typeof cached === 'object' && cached.player_url) {
        finalUrl = cached.player_url;
        fetchedServers = cached.servers || [];
      } else {
        const playDetails = await fetchPlayDetailsFromAPI(rawUrl, controller.signal);
        if (playDetails) {
          finalUrl = playDetails.player_url;
          fetchedServers = playDetails.servers || [];
          resolvedUrlsCache.current[rawUrl] = playDetails;
        } else {
          finalUrl = rawUrl;
          fetchedServers = [{ name: 'سيرفر رئيسي', url: rawUrl }];
        }
      }
    }
    
    if (controller.signal.aborted) return;
    
    setVideoUrl(finalUrl);
    setActiveServerUrl(rawUrl);
    setServers(fetchedServers);

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

      const isDailymotion = 
        rawUrl.toLowerCase().includes('dailymotion') || 
        rawUrl.toLowerCase().includes('syndication') || 
        rawUrl.toLowerCase().includes('dmcdn.net') ||
        rawUrl.toLowerCase().includes('dm.com') ||
        rawUrl.toLowerCase().includes('dai.ly');
      
      if (isDailymotion) {
        // Update UI state to trigger the Dailymotion view
        setActiveServerUrl(rawUrl);
        setVideoUrl(rawUrl);
        
        // No automatic window.open here, user will click the professional button below
        return;
      }

      setVideoUrl(''); // loader
      let url = await getSecuredUrl(rawUrl, controller.signal);
      if (controller.signal.aborted) return;
      setVideoUrl(url);
      setActiveServerUrl(rawUrl);
  }

  if (!series) return null;
  
  return (
    <div className="min-h-screen bg-[#050505] pb-20 relative overflow-hidden">
      {/* Immersive Background Backdrop */}
      {tmdbData?.backdrop && (
        <div className="absolute top-0 left-0 w-full h-[600px] pointer-events-none opacity-20 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/60 to-[#050505]" />
          <img 
            src={tmdbData.backdrop} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="relative z-10">
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

        {/* Animated notice above player */}
        <AnimatePresence>
          {showPlayerNotice && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full px-4 sm:px-8 mb-4 overflow-hidden"
            >
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex items-center justify-between gap-3 text-primary text-xs sm:text-sm font-bold shadow-lg shadow-primary/5">
                <div className="flex items-center gap-2.5 flex-1 justify-center">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
                  <span>إذا لم تعمل الحلقة، يرجى تغيير السيرفر من قائمة السيرفرات الإضافية بالأسفل 🍿</span>
                </div>
                <button 
                  onClick={() => setShowPlayerNotice(false)}
                  className="p-1 hover:bg-primary/20 rounded-full transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              seriesImage={resolvedSeriesImage}
              episodeIndex={currentEpisode}
              episodes={episodes}
              servers={servers}
              onSelectEpisode={(ep, idx) => playEpisode(ep, idx)}
              onSelectServer={handleServerSelect}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(!isMaximized)}
              onTimeUpdate={(t) => {
                setPlayerTime(t);
              }}
              seriesCategory={series.category}
              seriesTitle={series.title}
            />
          </div>
        )}

        <div className="w-full px-4 sm:px-8 flex flex-col lg:flex-row gap-8 sm:gap-12">
          {/* Main Content (Player + Info) */}
          <div className="flex-1 space-y-8 sm:space-y-12">
            {/* Info Section */}
            <div className="flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
              <div className="flex flex-col items-center justify-center">
                <motion.div 
                   initial={{ scale: 0.8, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className="flex items-center justify-center gap-2 mb-4"
                >
                   {(() => {
                    const dmKeywords = ['dailymotion', 'dm.com', 'dmcdn.net', 'dai.ly'];
                    const lowerActive = (activeServerUrl || '').toLowerCase();
                    const lowerVideo = (videoUrl || '').toLowerCase();
                    
                    // Strict Dailymotion detection
                    const isDM = dmKeywords.some(kw => 
                      lowerActive.includes(kw) || 
                      lowerVideo.includes(kw)
                    );
                    
                    if (isDM) {
                      const targetUrl = activeServerUrl || videoUrl || '';
                      
                      return (
                        <motion.a 
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ scale: 0.8, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.05, filter: "brightness(1.2)" }}
                          whileTap={{ scale: 0.95 }}
                          className="group relative bg-gradient-to-r from-red-600 via-red-500 to-red-800 bg-[length:200%_auto] hover:bg-[100%_center] text-white border-2 border-white/30 px-14 py-6 rounded-3xl text-lg sm:text-2xl font-black italic uppercase animate-pulse flex items-center gap-6 cursor-pointer shadow-[0_0_100px_rgba(220,38,38,1)] transition-all duration-700 ring-8 ring-red-600/30 hover:ring-red-600/70 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                          <div className="p-3 bg-white/20 rounded-2xl group-hover:bg-white/30 transition-colors shadow-inner">
                            <Play className="w-10 h-10 fill-current animate-bounce drop-shadow-lg" />
                          </div>
                          <div className="flex flex-col items-start leading-none text-right">
                            <span className="text-[11px] sm:text-[13px] opacity-90 not-italic font-black tracking-[0.4em] mb-2 text-white/95 border-b border-white/20 pb-1">EXTERNAL SERVER • DIRECT ACCESS</span>
                            <span className="tracking-tighter drop-shadow-2xl text-3xl sm:text-4xl font-sans">ذهاب إلى الحلقة</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-4xl group-hover:translate-x-4 transition-transform duration-500 drop-shadow-2xl">🚀</span>
                          </div>
                        </motion.a>
                      );
                    }
                    return (
                      <span className="bg-red-600/10 text-red-500 border border-red-500/20 px-6 py-2 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] shadow-inner backdrop-blur-sm">Now Playing</span>
                    );
                  })()}
                </motion.div>
                <motion.h1 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl sm:text-5xl font-black-italic text-white text-center"
                >
                  {series.title}
                </motion.h1>

                {/* Servers Section - Centered cleanly */}
                {servers && servers.length > 0 && (
                  <div className="mt-4 bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-black text-zinc-400">سيرفرات المشاهدة المتوفرة:</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center justify-center">
                      {servers.map((srv, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleServerSelect(srv.url)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 cursor-pointer",
                            srv.url === activeServerUrl
                              ? "bg-primary border-primary text-white font-extrabold shadow-[0_0_15px_rgba(229,9,20,0.2)]"
                              : "bg-zinc-800/30 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          )}
                        >
                          سيرفر {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 max-w-2xl flex flex-col items-center justify-center text-center mx-auto"
                >
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-medium line-clamp-3 hover:line-clamp-none transition-all duration-300 cursor-pointer">
                    {tmdbData?.description || series.description || "لا يوجد وصف متوفر لهذا العمل حالياً."}
                  </p>
                  {(tmdbData?.year || (tmdbData?.rating && tmdbData.rating > 0)) && (
                    <div className="flex items-center justify-center gap-4 mt-3">
                      {tmdbData.year && (
                        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-zinc-500 uppercase">
                          <History className="w-3.5 h-3.5" />
                          {tmdbData.year}
                        </span>
                      )}
                      {tmdbData.rating > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-yellow-500/80 uppercase">
                          <Sparkles className="w-3.5 h-3.5" />
                          TMDB {tmdbData.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>

                <p className="text-zinc-500 font-bold text-xs sm:text-sm mt-4 flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {episodes[currentEpisode] ? formatEpisodeTitle(episodes[currentEpisode].title || "", currentEpisode, false) : `الحلقة ${currentEpisode + 1}`}
                </p>

                {isAdmin && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-2xl bg-zinc-950/80 border border-yellow-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-yellow-500 shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-white text-xs sm:text-sm font-extrabold">لوحة تحكم المدير المسؤولة 🛡️</h3>
                        <p className="text-zinc-400 text-[10px] sm:text-xs">تثبيت هذا المسلسل في صدارة تصنيفه ({series.category || "الكل"})</p>
                      </div>
                    </div>
                    <button
                      onClick={handleTogglePin}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black italic uppercase transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer",
                        isPinned 
                          ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-yellow-500 hover:bg-yellow-500/90 text-black border border-yellow-600/30 font-extrabold"
                      )}
                    >
                      {isPinned ? (
                        <>
                          <X className="w-4 h-4" />
                          إلغاء التثبيت 📌
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          تثبيت في الصدارة 👑
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Social Channels Call-To-Action */}
              <div className="w-full lg:w-[420px] shrink-0 order-last lg:order-none flex flex-col gap-4">
                
                {/* Channels Banner */}
                <div className="flex flex-col gap-3">
                  <a 
                    href="https://whatsapp.com/channel/0029VbBJSZO5vKAFVk9MoW1a" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex flex-1 items-center justify-between p-3 sm:px-4 sm:py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 rounded-2xl sm:rounded-3xl transition-all duration-300 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </div>
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[11px] sm:text-[13px] font-black text-white truncate">الواتساب</span>
                        <span className="text-[9px] sm:text-[11px] text-[#25D366] font-bold truncate">تابع قناة حكايتنا في واتساب</span>
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://www.tiktok.com/@hikaytna_my?_r=1&_t=ZN-97O75l6SjSw" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex flex-1 items-center justify-between p-3 sm:px-4 sm:py-3 bg-[#00f2fe]/10 hover:bg-[#00f2fe]/20 border border-[#00f2fe]/20 rounded-2xl sm:rounded-3xl transition-all duration-300 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-[#00f2fe]/20 flex items-center justify-center text-[#00f2fe] group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-1.11 4.39-2.79 5.86-1.63 1.4-3.83 2.15-6.02 1.94-2.19-.18-4.22-1.31-5.54-3.05-1.28-1.66-1.74-3.8-1.34-5.83.39-1.99 1.56-3.72 3.19-4.83 1.62-1.11 3.65-1.5 5.6-1.19.01 1.43.01 2.86.01 4.29-1.07-.4-2.27-.4-3.32.06-.99.41-1.76 1.25-2.08 2.26-.35 1.05-.18 2.25.43 3.15.63.89 1.71 1.43 2.8 1.44 1.12.02 2.22-.5 2.87-1.41.48-.68.73-1.5.7-2.33-.03-5.74-.01-11.48-.02-17.22z" /></svg>
                      </div>
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[11px] sm:text-[13px] font-black text-white truncate">تيك توك</span>
                        <span className="text-[9px] sm:text-[11px] text-[#00f2fe] font-bold truncate">تابع حسابنا في تيك توك</span>
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://t.me/hikaytna_my" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex flex-1 items-center justify-between p-3 sm:px-4 sm:py-3 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/20 rounded-2xl sm:rounded-3xl transition-all duration-300 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-[#0088cc] group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24"><path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zM5.353 11.455c5.385-2.345 8.974-3.89 10.767-4.636 1.71-.711 2.065-.835 2.296-.84.051-.001.166.012.236.062.059.043.087.106.096.155.021.118.067.433-.03 1.157-1.1 8.243-1.636 11.666-1.921 13.235-.118.65-.262.868-.466.883-.437.032-1.066-.445-1.49-.723-1.026-.671-1.691-1.077-2.694-1.74-1.152-.76-0.406-1.18.012-1.606.108-.112 1.996-1.83 2.033-1.986.004-.017.009-.081-.03-.112-.038-.031-.089-.021-.129-.012-.054.012-2.126 1.382-3.842 2.545-.251.171-.478.254-.683.251-.225-.004-.658-.127-.98-.242-.395-.137-.707-.209-.68-.44.014-.118.152-.239.414-.361z"/></svg>
                      </div>
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[11px] sm:text-[13px] font-black text-white truncate">التلجرام</span>
                        <span className="text-[9px] sm:text-[11px] text-[#0088cc] font-bold truncate">نقاشات وحصريات</span>
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://www.instagram.com/hikaytna_my?igsh=MW5qeXY1NXBwazE3dw==" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex flex-1 items-center justify-between p-3 sm:px-4 sm:py-3 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 border border-[#E1306C]/20 rounded-2xl sm:rounded-3xl transition-all duration-300 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-[#E1306C]/20 flex items-center justify-center text-[#E1306C] group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                        </svg>
                      </div>
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[11px] sm:text-[13px] font-black text-white truncate">الإنستغرام</span>
                        <span className="text-[9px] sm:text-[11px] text-[#E1306C] font-bold truncate">تابع حسابنا في إنستغرام</span>
                      </div>
                    </div>
                  </a>
                </div>

                {/* Professional Chat Portal Trigger Card */}
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
                        seriesImage={resolvedSeriesImage}
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

            {/* Episodes Grid Section */}
            <section className="bg-zinc-900/30 p-5 sm:p-8 rounded-3xl border border-white/5">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 sm:h-6 bg-primary rounded-full animate-pulse" />
                  <h2 className="text-lg sm:text-xl font-black-italic italic uppercase tracking-tight">
                    {episodes.length === 1 && (/فيلم|افلام/i.test(series.category || "") || /فيلم/i.test(series.title || "")) ? "مشاهدة الفيلم" : "قائمة الحلقات"}
                  </h2>
                </div>
              </div>
              <EpisodeGrid 
                episodes={episodes}
                currentIndex={currentEpisode}
                seriesId={series.id}
                seriesImage={resolvedSeriesImage}
                seriesTitle={series.title}
                isMovie={episodes.length === 1 && (/فيلم|افلام/i.test(series.category || "") || /فيلم/i.test(series.title || ""))}
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
                    <span className="text-yellow-400 shrink-0">⭐ {tmdbData?.rating ? tmdbData.rating.toFixed(1) : series.rating} / 10</span>
                 </div>
                 {tmdbData?.year && (
                   <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-500 uppercase italic">Year</span>
                      <span className="text-white shrink-0">{tmdbData.year}</span>
                   </div>
                 )}
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Views</span>
                    <span className="text-white shrink-0">{series.views}</span>
                 </div>
               </div>
            </div>

          </aside>
        </div>
      </div>
    </div>

      {/* Actor Works Modal */}
      <AnimatePresence>
        {selectedActor && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActor(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-xl bg-zinc-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl z-[201] max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20">
                    <img src={selectedActor.profile_path || 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{selectedActor.name}</h2>
                    <p className="text-xs text-zinc-500 font-bold">أعمال الفنان المتاحة في موقعنا</p>
                  </div>
                </div>
                <button onClick={() => setSelectedActor(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {loadingActorWorks ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm font-bold">جاري البحث في مكتبة الموقع...</p>
                  </div>
                ) : actorWorks.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {actorWorks.map((work) => (
                      <motion.div 
                        key={work.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                           setSelectedActor(null);
                           navigate(`/watch/${encodeURIComponent(work.title || work.id)}`, { state: { series: work } });
                        }}
                        className="group cursor-pointer"
                      >
                         <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 border border-white/5 mb-2 relative">
                            <img src={work.image} alt={work.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                               <Play className="w-8 h-8 text-white bg-primary rounded-full p-2" />
                            </div>
                         </div>
                         <p className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-primary transition-colors">{work.title}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 text-zinc-500">
                    <AlertTriangle className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-bold max-w-[200px]">عذراً، هذا الفنان ليس له أعمال أخرى متاحة حالياً في مكتبتنا.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  seriesImage={resolvedSeriesImage}
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

              <h3 className="text-lg sm:text-xl font-black text-white mb-2 font-sans">تجهيز الحلقة للتحميل بدون نت 🔓</h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                لكي تتمكن من تحميل <span className="text-primary font-bold">هذه الحلقة</span> بجودة كاملة، يرجى زيارة موقع الراعي لمدة <span className="text-primary font-bold">10 ثوانٍ فقط</span>. (هذا الإجراء مطلوب لكل حلقة لدعم ترقية الخوادم وتوفير التحميل المجاني).
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
