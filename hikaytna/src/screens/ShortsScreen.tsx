import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, MessageCircle, Share2, Plus, VolumeX, Volume2, X, Send, Award, Film, AlertCircle, Play, Flame, Sparkles, Smile, Video,
  ChevronUp, ChevronDown, Eye, Trash2, Clock, ArrowRight, Edit3
} from 'lucide-react';
import { db, firestore, fetchAllFromFirebase } from '../services/firebase';
import { fetchAllSeries } from '../services/dataService';
import { ref as rtdbRef, onValue, push, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { fetchEpisodesFromAPI, fetchPlayUrlFromAPI } from '../services/api';
import BottomNav from '../components/BottomNav';
import SeriesChat from '../components/SeriesChat';
import ShortCard from '../components/ShortCard';

interface ShortComment {
  id: string;
  name: string;
  text: string;
  timestamp: number;
}

interface ShortItem {
  id: string;
  title: string;
  seriesName: string;
  videoUrl: string;
  thumbnail: string;
  likes: number;
  views?: number;
  timeRange: string;
  tag: string;
  author: string;
  authorId?: string;
  isAd?: boolean;
  adLink?: string;
}

// 1. The 6 allowed series with specific thumbnails for instant load
export const ALLOWED_SERIES_DATA = [
  { title: 'مسلسل ليلى', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل حلم أشرف', image: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل المتوحش', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل حجرة ورقة مقص', image: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل بهار', image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل العبقري', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل الطائر الرفراف', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل إخوتي', image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=200&auto=format&fit=crop' },
  { title: 'مسلسل كريستال', image: 'https://images.unsplash.com/photo-1533488765986-dfa2a9939acd?q=80&w=200&auto=format&fit=crop' }
];

export const ALLOWED_SERIES = ALLOWED_SERIES_DATA.map(s => s.title);

// High definition streams for high-speed Wi-Fi connections (from fast Google server)
export const HD_VIDEO_TEMPLATES: Record<string, string> = {
  'مسلسل ليلى': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'مسلسل حلم أشرف': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'مسلسل المتوحش': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'مسلسل حجرة ورقة مقص': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'مسلسل بهار': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'مسلسل العبقري': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
};

// Resilient CDNs of high reliability video stream fallbacks to survive network congestion/CORS issues
export const HIGH_RELIABILITY_FALLBACKS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4'
];

// Generates dynamic daily-shifted clip starting time using streaming network mode
function getDailyTimesAndOffset(seed: number, seriesName: string) {
  const today = new Date().getDate(); 
  const startMinute = 12 + ((today + seed * 4) % 22); 
  
  const format = (m: number) => {
    const h = Math.floor(m / 60);
    const minStr = (m % 60).toString().padStart(2, '0');
    return `${h > 0 ? h : '00'}:${minStr}:00`;
  };

  const timeRange = `${format(startMinute)} - ${format(startMinute + 1)}`;
  // Highly premium default stream
  const videoUrl = HD_VIDEO_TEMPLATES[seriesName] || HD_VIDEO_TEMPLATES['مسلسل ليلى'];

  return { timeRange, videoUrl };
}

// Parses string time range start/end moment to absolute seconds to trigger programmatic seeks and looping
function parseTimeToSeconds(timeStr: string, getEnd = false): number {
  if (!timeStr) return 0;
  // Handle space separator if user typed it
  const cleanStr = timeStr.trim().replace(/\s/g, '');
  const partsRange = cleanStr.split('-');
  const targetPart = (getEnd && partsRange.length > 1) ? partsRange[1] : partsRange[0];
  
  const parts = targetPart.split(':').map(Number);
  
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 1) {
    return (parts[0] || 0);
  }
  return 0;
}

function normalizeTitle(title: string): string {
  return title.replace(/مسلسل/g, '').replace(/أ|إ|آ/g, 'ا').replace(/\s+/g, '').trim().toLowerCase();
}

function isSeriesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = normalizeTitle(name1);
  const n2 = normalizeTitle(name2);
  // Allow match if one is contained in another, and normalizeTitle should handle the rest
  return n1.includes(n2) || n2.includes(n1);
}

// Determines if a video URL is a brief Chromecast/nature fallback template
function isSampleVideoUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return true;
  const lower = urlStr.toLowerCase();
  return (
    lower.includes('googleapis.com/gtv-videos-bucket') ||
    lower.includes('w3schools.com') ||
    lower.includes('sample') ||
    lower.includes('forbigger') ||
    lower.includes('movie.mp4') ||
    lower.includes('mov_bbb')
  );
}

// URLs to exclude
const BLACKLISTED_URLS = [
  'shadwo.pro',
  'esheaq.onl',
  'example.com'
];

function isBlacklistedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return BLACKLISTED_URLS.some(blacklisted => url.includes(blacklisted));
}

// Default initial premium shorts from episode 1 of the 6 allowed series
const INITIAL_SHORTS: ShortItem[] = [
  {
    id: 'ep1_leila',
    title: 'لحظة عاصفة: وقوع الحادث الأليم الذي غير مصير ليلى بالكامل! 💥🎬',
    seriesName: 'مسلسل ليلى',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop',
    likes: 4205,
    views: 12540,
    timeRange: '15:40 - 16:40',
    tag: 'لقطة حارة',
    author: 'فريق الإشراف'
  },
  {
    id: 'ep1_ashraf',
    title: 'لحظة الحقيقة: أشرف يكشف خديعة العمر لأقرب الناس إليه ويقرر الانتقام! 🥹⚡',
    seriesName: 'مسلسل حلم أشرف',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=600&auto=format&fit=crop',
    likes: 3152,
    views: 9450,
    timeRange: '22:15 - 23:15',
    tag: 'قمة الوفاء',
    author: 'فريق الإشراف'
  },
  {
    id: 'ep1_motawahish',
    title: 'أكشن ومواجهة: يامان يفجر المفاجأة وينتقم لعائلته في الحارة القديمة! ⚔️🔥',
    seriesName: 'مسلسل المتوحش',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
    likes: 5418,
    views: 18120,
    timeRange: '18:10 - 19:10',
    tag: 'حماس ناري',
    author: 'فريق الإشراف'
  },
  {
    id: 'ep1_hujra',
    title: 'مواجهة ذكاء: مرافعة قانونية جائرة تنفجر في المحكمة وتكشف سر دفين! ⚖️🧠',
    seriesName: 'مسلسل حجرة ورقة مقص',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop',
    likes: 2194,
    views: 6510,
    timeRange: '25:30 - 26:30',
    tag: 'ألعاب العقل',
    author: 'فريق الإشراف'
  },
  {
    id: 'ep1_bahar',
    title: 'لقطة قوة: بهار تنفجر بالحق وتقلب الطاولة على الجميع بذكاء خارق! 🌸💪',
    seriesName: 'مسلسل بهار',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=600&auto=format&fit=crop',
    likes: 3680,
    views: 11040,
    timeRange: '12:50 - 13:50',
    tag: 'قوة امرأة',
    author: 'فريق الإشراف'
  },
  {
    id: 'ep1_abqari',
    title: 'صراع العباقرة: كشف الهوية السرية للعبقري وتغيير موازين الأرقام! 💻♟️',
    seriesName: 'مسلسل العبقري',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop',
    likes: 6710,
    views: 20130,
    timeRange: '30:20 - 31:20',
    tag: 'مواجهة الكبار',
    author: 'فريق الإشراف'
  }
];

export default function ShortsScreen() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    const val = localStorage.getItem('hek_shorts_muted');
    return val === null ? true : val === 'true'; // Default to true (muted) on first visit to comply with browser autoplay policy!
  });
  const [showVolumeBadge, setShowVolumeBadge] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('hek_shorts_muted', newMuted.toString());
    setShowVolumeBadge(true);
    setTimeout(() => setShowVolumeBadge(false), 800);
  };
  const [isPlaying, setIsPlaying] = useState(true);

  // Initialize unique user ID in local storage for identity management
  useEffect(() => {
    if (!localStorage.getItem('hek_user_id')) {
      const newUserId = crypto.randomUUID();
      localStorage.setItem('hek_user_id', newUserId);
    }
  }, []);

  // Database series logic
  const [allDBSeries, setAllDBSeries] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('hek_series_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const seriesNames = useMemo(() => {
    const fromDB = allDBSeries.map(s => s.title);
    const defaults = ["مسلسل ليلى", "مسلسل حلم أشرف", "مسلسل المتوحش", "مسلسل حجرة ورقة مقص", "مسلسل بهار", "مسلسل العبقري"];
    return Array.from(new Set([...fromDB, ...defaults]));
  }, [allDBSeries]);
  
  // Realtime likes, views & comments state
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [viewsMap, setViewsMap] = useState<Record<string, number>>({});
  const [userLiked, setUserLiked] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('shorts_user_liked');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Storage of raw shared clips from Firebase to combine and dynamically rank
  const [rawSharedShorts, setRawSharedShorts] = useState<ShortItem[]>(() => {
    try {
      const saved = localStorage.getItem('hek_shorts_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // Use localStorage for instant load + revalidation
  const [ads, setAds] = useState<ShortItem[]>(() => {
    try {
      const saved = localStorage.getItem('hek_ads_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Throttle fetching external assets
  const lastAdsFetchRef = useRef<number>(0);
  
  // Live Comments state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<ShortComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState(localStorage.getItem('comment_author_name') || '');
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('short_admin_access') === 'true');
  const [rtdbDeletedShorts, setRtdbDeletedShorts] = useState<Record<string, boolean>>({});
  const [rtdbEditedShorts, setRtdbEditedShorts] = useState<Record<string, {title: string, timeRange: string, videoUrl: string}>>({});
  const [visitorNameInput, setVisitorNameInput] = useState('');
  const [showIdentityModal, setShowIdentityModal] = useState(!authorName);

  // Custom modal/dialog states to replace raw prompts and confirms
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editShortId, setEditShortId] = useState<string | null>(null);
  const [editShortTitle, setEditShortTitle] = useState('');
  const [editShortTimeRange, setEditShortTimeRange] = useState('');
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showBetaMessage, setShowBetaMessage] = useState(true);

  // Modern Premium Category Filter slider state & Custom Toast States
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setShowBetaMessage(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleSetIdentity = () => {
    const trimmed = visitorNameInput.trim();
    if (!trimmed) {
      showToast("يرجى إدخال اسمك أولاً ✍️", "error");
      return;
    }

    if (trimmed === 'bewCew,iDYgC@K6') {
      setIsAdmin(true);
      localStorage.setItem('short_admin_access', 'true');
      setAuthorName('المدير 🛡️');
      localStorage.setItem('comment_author_name', 'المدير 🛡️');
    } else {
      setIsAdmin(false);
      localStorage.setItem('short_admin_access', 'false');
      setAuthorName(trimmed);
      localStorage.setItem('comment_author_name', trimmed);
    }
    setShowIdentityModal(false);
  };

  // Post dynamic new short form (Episode Selection)
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [pubSeriesName, setPubSeriesName] = useState(ALLOWED_SERIES[0]);
  const [pubEpisodeNum, setPubEpisodeNum] = useState('1');
  const [pubStartTime, setPubStartTime] = useState('10:00');
  const [pubEndTime, setPubEndTime] = useState('11:00');
  const [pubTitleSuffix, setPubTitleSuffix] = useState('');
  const [pubTag, setPubTag] = useState('لقطة حاسمة 🔥');
  const [seriesSearchQuery, setSeriesSearchQuery] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  
  // Highly optimized memoized list of available non-blacklisted series options for publishing
  const publishSeriesOptions = useMemo(() => {
    if (!isPublishOpen) return []; // Completely skip computation unless modal is requested!
    const list = allDBSeries.length > 0 ? allDBSeries : ALLOWED_SERIES_DATA;
    return list.filter(s => {
      if (seriesSearchQuery && !s.title.toLowerCase().includes(seriesSearchQuery.toLowerCase())) return false;
      if (!s.url && !s.episodes) return true;
      
      // Fast check: blacklisted URL of the main series
      if (s.url && isBlacklistedUrl(s.url)) return false;
      
      // Fast-path sample check of first/last episodes instead of loop over hundreds
      const episodesArr = s.episodes ? (Array.isArray(s.episodes) ? s.episodes : Object.values(s.episodes)) : [];
      if (episodesArr.length > 0) {
        const firstEp = episodesArr[0];
        const lastEp = episodesArr[episodesArr.length - 1];
        if (firstEp && isBlacklistedUrl(firstEp.link1 || firstEp.url)) return false;
        if (lastEp && isBlacklistedUrl(lastEp.link1 || lastEp.url)) return false;
      }
      return true;
    }).slice(0, 15);
  }, [allDBSeries, seriesSearchQuery, isPublishOpen]);
  
  // Video references and loading States
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const playTimeoutRef = useRef<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasLoadedDB, setHasLoadedDB] = useState(false);

  useEffect(() => {
    setShowPrompt(false);
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  // Dynamic automatic healing URL fallback mapping states
  const [videoUrlOverrides, setVideoUrlOverrides] = useState<Record<string, string>>({});
  const [videoRetryCount, setVideoRetryCount] = useState<Record<string, number>>({});

  // 1. Fetch available episodes database on startup (API + Firebase consolidated)
  useEffect(() => {
    const now = Date.now();
    const cacheAge = now - parseInt(localStorage.getItem('hek_series_cache_ts') || '0');
    
    // Only fetch if cache is older than 30 minutes
    if (cacheAge > 30 * 60 * 1000 || allDBSeries.length === 0) {
      fetchAllSeries()
        .then(data => {
          setAllDBSeries(data);
          localStorage.setItem('hek_series_cache', JSON.stringify(data));
          localStorage.setItem('hek_series_cache_ts', now.toString());
        })
        .catch(err => {
          console.warn("Could not retrieve series from dataService", err);
        });
    }

    // Fetch Ads from GitHub (only once per hour to avoid Rate Exceeded)
    const adsCacheAge = now - parseInt(localStorage.getItem('hek_ads_cache_ts') || '0');
    if (adsCacheAge > 60 * 60 * 1000 || ads.length === 0) {
      fetch('https://raw.githubusercontent.com/mrpubg252-cmd/esp-config/refs/heads/main/ads.json')
        .then(res => {
          if (!res.ok) throw new Error('GitHub limit reached');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            const mappedAds = data.map((ad: any, i: number) => ({
              id: `ad_${i}`,
              title: ad.title || 'إعلان مميز 🌟',
              seriesName: 'إعلان ممول',
              videoUrl: ad.url || ad.videoUrl || ad.video || '',
              thumbnail: ad.thumbnail || ad.image || 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=400&auto=format&fit=crop',
              likes: Math.floor(Math.random() * 500) + 1000,
              views: Math.floor(Math.random() * 5000) + 10000,
              timeRange: 'إعلان',
              tag: 'AD',
              author: ad.author || 'المعلن',
              isAd: true,
              adLink: ad.link || ad.redirect || '#'
            }));
            const filteredAds = mappedAds.filter((ad: any) => ad.videoUrl);
            setAds(filteredAds);
            localStorage.setItem('hek_ads_cache', JSON.stringify(filteredAds));
            localStorage.setItem('hek_ads_cache_ts', Date.now().toString());
          }
        })
        .catch(err => console.warn("Ads fetch failed or limited", err));
    }
  }, []);

  // 2. Fetch all real-time views records from firebase
  useEffect(() => {
    try {
      const viewsRef = rtdbRef(db, 'short_views');
      const unsubscribe = onValue(viewsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setViewsMap(val);
        }
      });
      return () => unsubscribe();
    } catch {}
  }, []);

  // 3. Fetch all real-time likes records from firebase
  useEffect(() => {
    try {
      const likesRef = rtdbRef(db, 'short_likes');
      const unsubscribe = onValue(likesRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setLikesMap(val);
        }
      });
      return () => unsubscribe();
    } catch {}
  }, []);

  // Listen to admin deleted and edited shorts from RTDB Realtime Database
  useEffect(() => {
    try {
      const deletedRef = rtdbRef(db, 'deleted_shorts');
      const unsubscribeDel = onValue(deletedRef, (snapshot) => {
        setRtdbDeletedShorts(snapshot.val() || {});
      });

      const editedRef = rtdbRef(db, 'edited_shorts');
      const unsubscribeEdit = onValue(editedRef, (snapshot) => {
        setRtdbEditedShorts(snapshot.val() || {});
      });

      return () => {
        unsubscribeDel();
        unsubscribeEdit();
      };
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 4. Fetch all dynamic clips published by readers from firestore
  useEffect(() => {
    try {
      const q = query(collection(firestore, 'shorts'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedClips = snapshot.docs.map(doc => {
            const item = doc.data();
            const seriesName = item.seriesName || (ALLOWED_SERIES_DATA[0]?.title) || 'مسلسل ليلى';
            const defaultUrl = HD_VIDEO_TEMPLATES[seriesName] || HD_VIDEO_TEMPLATES['مسلسل ليلى'];
            return {
              id: doc.id,
              title: item.title || 'لقطة جديدة رائعة',
              seriesName: seriesName,
              episodeNum: item.episodeNum || '',
              videoUrl: item.videoUrl || defaultUrl,
              thumbnail: item.thumbnail || 'https://images.unsplash.com/photo-1543508282-6319a3e2621d?q=80&w=400&auto=format&fit=crop',
              likes: item.likes || 0,
              views: item.views || 0,
              timeRange: item.timeRange || '10:00 - 11:00',
              tag: item.tag || 'لقطة متابع',
              author: item.author || 'متبع حكايتنا'
            };
          });

          // Load all user shorts
          setRawSharedShorts(loadedClips);
          localStorage.setItem('hek_shorts_cache', JSON.stringify(loadedClips));
          setHasLoadedDB(true);
        });
      return () => unsubscribe();
    } catch {
      setRawSharedShorts([]);
      setHasLoadedDB(true);
    }
  }, [allDBSeries]);

  const shorts = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 90 * 24 * 60 * 60 * 1000;

    const filtered = rawSharedShorts.filter(s => {
      // Direct Realtime/LocalStorage admin deletion fallback bypass
      if (rtdbDeletedShorts[s.id] || localStorage.getItem(`rtdb_del_${s.id}`) === 'true') {
        return false;
      }
      if (isBlacklistedUrl(s.videoUrl)) return false;
      
      const createdAt = (s as any).createdAt?.toMillis ? (s as any).createdAt.toMillis() : ((s as any).createdAt || now); 
      const isAncient = (now - createdAt) > thirtyDaysMs;
      const isPopular = (s.likes || 0) > 10 || (s.views || 0) > 50; // Low threshold to keep user content
      
      if (isAncient && !isPopular) return false;
      return true;
    });

    // Apply real-time admin title/timeRange overrides
    const withEdits = filtered.map(s => {
      const edit = rtdbEditedShorts[s.id] || JSON.parse(localStorage.getItem(`rtdb_edit_${s.id}`) || 'null');
      let baseShort = s;
      if (edit) {
        baseShort = {
          ...s,
          title: edit.title || s.title,
          timeRange: edit.timeRange || s.timeRange,
          videoUrl: edit.videoUrl || s.videoUrl
        };
      }

      // Find matched series
      const matchedSeries = allDBSeries.find(ser => ser.title === baseShort.seriesName) || ALLOWED_SERIES_DATA.find(ser => ser.title === baseShort.seriesName);
      const seriesImage = matchedSeries?.image || matchedSeries?.thumbnail || 'https://images.unsplash.com/photo-1543508282-6319a3e2621d?q=80&w=400&auto=format&fit=crop';
      
      // Determine episodeNum
      let episodeNum = (baseShort as any).episodeNum || '';
      if (!episodeNum) {
        const idMatch = baseShort.id.match(/^ep(\d+)/i);
        if (idMatch) {
          episodeNum = idMatch[1];
        } else {
          episodeNum = '1';
        }
      }

      return {
        ...baseShort,
        seriesImage,
        episodeNum
      };
    });

    const combined = [...withEdits];

    // Inject Ads every 3 items
    if (ads.length > 0) {
      const result: ShortItem[] = [];
      let adIdx = 0;
      combined.forEach((item, index) => {
        result.push(item);
        if ((index + 1) % 3 === 0 && adIdx < ads.length) {
          result.push(ads[adIdx]);
          adIdx++;
        }
      });
      return result;
    }

    combined.sort((a, b) => {
      const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : ((a as any).createdAt || now);
      const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : ((b as any).createdAt || now);
      
      const likesA = a.likes || 0;
      const likesB = b.likes || 0;
      const viewsA = a.views || 0;
      const viewsB = b.views || 0;

      // Higher weight for new user content (Recency is KING)
      const scoreA = (timeA / 100000) + (likesA * 2 + viewsA);
      const scoreB = (timeB / 100000) + (likesB * 2 + viewsB);
      return scoreB - scoreA;
    });

    return combined.filter((item, index, self) => {
      const url = item.videoUrl || '';
      const isBlacklisted = url.includes('commondatastorage.googleapis.com') || url.includes('example.com') || url.includes('BigBuckBunny');
      if (isBlacklisted) return false;
      
      // Smart duplicate check: Only filter if same author AND same content
      const firstIndex = self.findIndex(s => s.videoUrl === item.videoUrl && s.timeRange === item.timeRange && s.author === item.author);
      return firstIndex === index;
    });
  }, [rawSharedShorts, ads, rtdbDeletedShorts, rtdbEditedShorts, allDBSeries]);

  // Dynamic Category Filter to play only from chosen series
  const filteredShorts = useMemo(() => {
    if (selectedCategory === 'الكل') return shorts;
    return shorts.filter(s => s.seriesName === selectedCategory || (selectedCategory === 'إعلان ممول' && s.isAd));
  }, [shorts, selectedCategory]);

  // Optimizer: Only render videos in a sliding window (Previous, Current, Next)
  const renderRange = useMemo(() => {
    const range = 2; // Keep 2 videos before and after for smooth scrolling buffer
    return {
      start: Math.max(0, activeIndex - range),
      end: Math.min(filteredShorts.length - 1, activeIndex + range)
    };
  }, [activeIndex, filteredShorts.length]);

  useEffect(() => {
    const currentActiveId = filteredShorts[activeIndex]?.id;
    if (currentActiveId) {
      const newIdx = filteredShorts.findIndex(x => x.id === currentActiveId);
      if (newIdx !== -1 && newIdx !== activeIndex) {
        setActiveIndex(newIdx);
      }
    }
  }, [filteredShorts]);



  // Programmatic offset seeking when active video changes
  const activeShortId = filteredShorts[activeIndex]?.id;
  const activeShortTimeRange = filteredShorts[activeIndex]?.timeRange;

  useEffect(() => {
    const activeVideo = videoRefs.current[activeIndex];
    if (activeVideo && activeShortTimeRange) {
      const startSecs = parseTimeToSeconds(activeShortTimeRange);
      
      const handleSetTime = () => {
        if (Math.abs(activeVideo.currentTime - startSecs) > 4) {
          activeVideo.currentTime = startSecs;
        }
      };

      activeVideo.addEventListener('loadedmetadata', handleSetTime);

      if (activeVideo.readyState >= 1) {
        handleSetTime();
      }

      return () => {
        activeVideo.removeEventListener('loadedmetadata', handleSetTime);
      };
    }
  }, [activeIndex, activeShortId]); // Reduced dependencies

  // Force like on double click
  const forceLike = (key: string, currentShortLikes: number) => {
    if (userLiked[key]) return; // already liked, do nothing in db to prevent spam
    
    const updatedUserLiked = { ...userLiked, [key]: true };
    setUserLiked(updatedUserLiked);
    try {
      localStorage.setItem('shorts_user_liked', JSON.stringify(updatedUserLiked));
    } catch {}

    const currentLikesNum = likesMap[key] !== undefined ? likesMap[key] : currentShortLikes;
    const finalLikes = currentLikesNum + 1;

    setLikesMap(prev => ({ ...prev, [key]: finalLikes }));

    try {
      set(rtdbRef(db, `short_likes/${key}`), finalLikes);
    } catch {}
  };

  // Load live Firebase comments when active index switches or panel open
  useEffect(() => {
    if (filteredShorts.length === 0 || !isCommentsOpen) return;
    const currentShort = filteredShorts[activeIndex];
    if (!currentShort) return;

    try {
      const commentsRef = rtdbRef(db, `short_comments/${currentShort.id}`);
      const unsubscribe = onValue(commentsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Object.entries(val).map(([key, c]: [string, any]) => ({
            id: key,
            name: c.name || 'متابع مجهول',
            text: c.text || '',
            timestamp: c.timestamp || Date.now()
          })).sort((a,b) => b.timestamp - a.timestamp);
          setComments(list);
        } else {
          setComments([]);
        }
      });
      return () => unsubscribe();
    } catch {}
  }, [activeIndex, isCommentsOpen, shorts]);

  const [playBlocked, setPlayBlocked] = useState(false);

  // Scroll to index utility that leverages GPU translation for low-end screen controllers
  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const elementHeight = el.clientHeight;
    if (elementHeight <= 0) return;

    el.scrollTo({
      top: index * elementHeight,
      behavior: 'smooth'
    });
    setActiveIndex(index);
    setIsPlaying(true);
    setPlayBlocked(false);
  };

  // Playback managers based on activeIndex
  useEffect(() => {
    // Collect all video keys
    Object.entries(videoRefs.current).forEach(([idxStr, rawVideo]) => {
      const idx = parseInt(idxStr);
      const video = rawVideo as HTMLVideoElement | null;
      if (!video) return;

      if (idx === activeIndex) {
        if (isPlaying) {
          setIsLoading(true);
          setHasError(false);
          video.muted = isMuted;

          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsLoading(false);
                setPlayBlocked(false);
              })
              .catch((err) => {
                console.warn("Play promise exception caught:", err);
                setIsLoading(false);
                
                // If it is a genuine NotAllowedError (browser autoplay policy), attempt playing muted fallback
                if (err && err.name === 'NotAllowedError') {
                  video.muted = true;
                  video.play()
                    .then(() => {
                      setIsMuted(true);
                      localStorage.setItem('hek_shorts_muted', 'true');
                      setPlayBlocked(false);
                    })
                    .catch(() => {
                      setPlayBlocked(true);
                      setIsPlaying(false);
                    });
                } else {
                  // Scroll interruptions or minor network gaps should NOT force a global mute state
                  setPlayBlocked(false);
                }
              });
          }
        } else {
          video.pause();
        }
      } else {
        // Halt and rewind non-focused video elements to release GPU threads on old devices
        try {
          video.pause();
          video.currentTime = 0;
        } catch {}
      }
    });
  }, [activeIndex, isPlaying, isMuted, filteredShorts]);

  // 6. Intelligent real-time views accumulator (TikTok style) with aggressive throttling
  const lastIncrementedRef = useRef<string | null>(null);

  useEffect(() => {
    if (filteredShorts.length === 0) return;
    const currentShort = filteredShorts[activeIndex];
    if (!currentShort) return;

    const key = currentShort.id;
    if (lastIncrementedRef.current === key) return;
    
    // Prevent view count loops by limiting updates
    const lastSessionView = localStorage.getItem(`viewed_${key}`);
    const now = Date.now();
    if (lastSessionView && (now - parseInt(lastSessionView)) < 60000) return; // Only count once per minute per short

    lastIncrementedRef.current = key;
    localStorage.setItem(`viewed_${key}`, now.toString());

    const currentViews = viewsMap[key] !== undefined ? viewsMap[key] : (currentShort.views || 0);
    try {
      set(rtdbRef(db, `short_views/${key}`), currentViews + 1);
    } catch (err) {
      console.error("Failed to increment views:", err);
    }
  }, [activeIndex, filteredShorts.length]); // Use length instead of whole array to stabilize

  // Handle double-tap/double-click on the video to spawn a TikTok floating heart
  const handleDoubleTap = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate coordinates relative to the card container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const heartId = Date.now() + Math.random();
    setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);

    // Auto cleanup heart element
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 800);

    // Trigger like
    const currentShort = filteredShorts[activeIndex];
    if (currentShort) {
      const key = currentShort.id;
      forceLike(key, currentShort.likes);
    }
  };

  // Safe gesture multiplexer to protect double click layouts
  const handleTapGesture = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Professional Audio Unblock System: Unmute on first interaction
    if (isMuted) {
      toggleMute();
    }

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 280;
    
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
      handleDoubleTap(e);
    } else {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      playTimeoutRef.current = setTimeout(() => {
        togglePlay();
        playTimeoutRef.current = null;
      }, 220);
    }
    lastTapRef.current = now;
  };

  // Clean-up timing frame handles of the gesture module on unmount
  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, []);

  // Handle native drag & scroll snapping
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollPos = el.scrollTop;
    const elementHeight = el.clientHeight;
    if (elementHeight <= 0) return;
    const rawIndex = Math.round(scrollPos / elementHeight);
    
    if (rawIndex !== activeIndex && rawIndex >= 0 && rawIndex < filteredShorts.length) {
      setActiveIndex(rawIndex);
      setIsPlaying(true);
      setPlayBlocked(false);
    }
  };

  const togglePlay = () => {
    const activeVideo = videoRefs.current[activeIndex] as HTMLVideoElement | null;
    if (!activeVideo) return;
    if (isPlaying) {
      activeVideo.pause();
      setIsPlaying(false);
    } else {
      setPlayBlocked(false);
      activeVideo.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          activeVideo.muted = true;
          activeVideo.play()
            .then(() => {
              setIsMuted(true);
              setIsPlaying(true);
            })
            .catch(() => {
              setPlayBlocked(true);
              setIsPlaying(false);
            });
        });
    }
  };

  // Instant unblock and sound trigger on tactile gesture
  const handleTactileUnblock = () => {
    setPlayBlocked(false);
    setIsPlaying(true);
    setIsMuted(false);
    const activeVideo = videoRefs.current[activeIndex] as HTMLVideoElement | null;
    if (activeVideo) {
      activeVideo.muted = false;
      const playPromise = activeVideo.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setPlayBlocked(false);
          })
          .catch(() => {
            // Webkit absolute mute fallback
            activeVideo.muted = true;
            activeVideo.play()
              .then(() => {
                setIsMuted(true);
              });
          });
      }
    }
  };

  // Toggle Likes with firebase and sync to localStorage
  const handleLike = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentShort = filteredShorts[activeIndex];
    if (!currentShort) return;

    const key = currentShort.id;
    const liked = !userLiked[key];
    
    const updatedUserLiked = { ...userLiked, [key]: liked };
    setUserLiked(updatedUserLiked);
    try {
      localStorage.setItem('shorts_user_liked', JSON.stringify(updatedUserLiked));
    } catch {}

    const currentLikesNum = likesMap[key] !== undefined ? likesMap[key] : currentShort.likes;
    const net = liked ? 1 : -1;
    const finalLikes = Math.max(0, currentLikesNum + net);

    setLikesMap(prev => ({ ...prev, [key]: finalLikes }));

    try {
      set(rtdbRef(db, `short_likes/${key}`), finalLikes);
    } catch {}
  };

  // Comments submit handler
  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const currentShort = filteredShorts[activeIndex];
    if (!currentShort || !newComment.trim()) return;

    const nickname = authorName.trim() || 'عضو حكايتنا 🎬';
    localStorage.setItem('comment_author_name', nickname);

    try {
      const targetRef = rtdbRef(db, `short_comments/${currentShort.id}`);
      push(targetRef, {
        name: nickname,
        text: newComment.trim(),
        timestamp: Date.now()
      });
      setNewComment('');
    } catch {
      showToast("عذراً، فشل الاتصال بقاعدة البيانات لزيادة التفاعل.", "error");
    }
  };

  // Handle dynamic publishing from episodes of series (Extracting the real episode link!)
  const handlePublishShort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;
    
    // Convert MM:SS to total seconds for the fragment
    const startTimeInSecs = parseTimeToSeconds(pubStartTime);
    const endTimeInSecs = parseTimeToSeconds(pubEndTime);
    
    if (endTimeInSecs <= startTimeInSecs) {
        showToast('يجب أن تكون نهاية اللقطة بعد بدايتها.', "error");
        return;
    }
    
    setIsPublishing(true);
    
    // Search the full series archive from our real Firebase database state (`allDBSeries`)
    const matchedSeries = allDBSeries.find(s => s.title === pubSeriesName);
    
    let baseSourceVideo = '';
    if (matchedSeries) {
      let episodesArr = matchedSeries.episodes 
        ? (Array.isArray(matchedSeries.episodes) ? matchedSeries.episodes : Object.values(matchedSeries.episodes))
        : [];
        
      if (episodesArr.length === 0 && matchedSeries.url) {
        try {
          episodesArr = await fetchEpisodesFromAPI(matchedSeries.url);
        } catch (err) {
          console.warn(`Failed to fetch API episodes for ${matchedSeries.title}`, err);
        }
      }
      
      if (episodesArr && episodesArr.length > 0) {
        const epIdx = parseInt(pubEpisodeNum) - 1;
        const matchedEp = episodesArr[epIdx] || episodesArr[0];
        if (matchedEp) {
          // Extract the real video link
          let rawEpUrl = matchedEp.link1 || matchedEp.url || matchedEp.link2 || matchedEp.link3 || '';
          // Try to fetch the direct playable URL from api using our play proxy if it's an API episode URL lacking direct mp4
          if (rawEpUrl && !rawEpUrl.endsWith('.mp4') && !rawEpUrl.endsWith('.m3u8')) {
             try {
                const fromApi = await fetchPlayUrlFromAPI(rawEpUrl);
                if (fromApi) rawEpUrl = fromApi;
             } catch { }
          }
          baseSourceVideo = rawEpUrl;
        }
      }
    }
    
    // Validate if it is a blacklisted video
    if (isBlacklistedUrl(baseSourceVideo)) {
      showToast("عذراً، هذا الرابط غير مدعوم أو لا يحتوي على محتوى صالح.", "error");
      setIsPublishing(false);
      return;
    }
    
    // If absolutely no video link found, DO NOT fall back to templates. Show error!
    if (!baseSourceVideo || baseSourceVideo.includes('example.com')) {
      showToast("عذراً، لا يمكن العثور على رابط فيديو صالح لهذه الحلقة.", "error");
      setIsPublishing(false);
      return;
    }
    
    // Embed the fragment parameter on URL so that the video starts seeking instantly
    const videoUrlWithFragment = `${baseSourceVideo}#t=${startTimeInSecs},${endTimeInSecs}`;
    
    if (!authorName) {
      showToast("يرجى إدخال اسمك أولاً عبر زر الملف الشخصي العلوي! ✍️", "error");
      setIsPublishing(false);
      setShowIdentityModal(true);
      return;
    }

    const publisherName = authorName;
    const finalTitle = pubTitleSuffix.trim() ? pubTitleSuffix.trim() : `لقطة رائعة من ${pubSeriesName} 🎬🔥`;
    const targetTimeRange = `${pubStartTime} - ${pubEndTime}`;

    // Check if exactly this clip already exists
    const isDuplicate = filteredShorts.some(s => s.videoUrl === videoUrlWithFragment && s.timeRange === targetTimeRange);
    if (isDuplicate) {
      showToast("هذه اللقطة موجودة بالفعل وتم نشرها مسبقاً! 🎬", "error");
      setIsPublishing(false);
      return;
    }

    try {
      const docRef = await addDoc(collection(firestore, 'shorts'), {
        title: finalTitle,
        seriesName: pubSeriesName,
        episodeNum: pubEpisodeNum,
        videoUrl: videoUrlWithFragment,
        thumbnail: 'https://images.unsplash.com/photo-1543508282-6319a3e2621d?q=80&w=400&auto=format&fit=crop',
        likes: Math.floor(Math.random() * 10) + 15, 
        views: Math.floor(Math.random() * 80) + 120, // default dummy organic startup views
        timeRange: targetTimeRange,
        tag: pubTag.trim() || 'حلقات',
        author: publisherName,
        authorId: localStorage.getItem('hek_user_id'),
        createdAt: serverTimestamp()
      });

      try {
        const myIds = JSON.parse(localStorage.getItem('hek_my_shorts_ids') || '[]');
        if (Array.isArray(myIds)) {
          myIds.push(docRef.id);
          localStorage.setItem('hek_my_shorts_ids', JSON.stringify(myIds));
        }
      } catch (err) {
        console.warn("Could not save to local short list", err);
      }

      showToast(`🎉 تم حفظ وبث المقطع بنجاح وسيظهر للجمهور فوراً!`, "success");
      setIsPublishOpen(false);
      setPubTitleSuffix('');
    } catch (err) {
      console.error(err);
      showToast("عفواً، فشل نشر اللقطة.", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePreviewScene = async () => {
    if (previewLoading) return;
    setPreviewLoading(true);
    setPreviewUrl('');
    
    try {
      const matchedSeries = allDBSeries.find(s => s.title === pubSeriesName);
      if (!matchedSeries) throw new Error();

      let episodesArr = matchedSeries.episodes 
        ? (Array.isArray(matchedSeries.episodes) ? matchedSeries.episodes : Object.values(matchedSeries.episodes))
        : [];
      
      const epIdx = parseInt(pubEpisodeNum) - 1;
      const matchedEp = episodesArr[epIdx] || episodesArr[0];
      if (!matchedEp) throw new Error();

      let rawEpUrl = matchedEp.link1 || matchedEp.url || '';
      if (rawEpUrl && !rawEpUrl.endsWith('.mp4') && !rawEpUrl.endsWith('.m3u8')) {
        const fromApi = await fetchPlayUrlFromAPI(rawEpUrl);
        if (fromApi) rawEpUrl = fromApi;
      }

      if (!rawEpUrl) throw new Error();

      const startSecs = parseTimeToSeconds(pubStartTime);
      setPreviewUrl(`${rawEpUrl}#t=${startSecs}`);
    } catch {
      showToast("عذراً، لا يمكن معاينة هذه الحلقة حالياً.", "error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleShareShort = () => {
    const currentShort = filteredShorts[activeIndex];
    if (!currentShort) return;
    const shareUrl = `${window.location.origin}/shorts?id=${currentShort.id}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          showToast("⚡ تم نسخ رابط شورت حكايتنا المباشر بنجاح! شاركه الآن.", "success");
        })
        .catch(() => {
          showToast("رابط اللقطة المباشر: " + shareUrl, "info");
        });
    } else {
      showToast("رابط اللقطة المباشر: " + shareUrl, "info");
    }
  };

  const handleSelectSeries = (seriesName: string, episodeNumStr: string) => {
    const matchedSeries = allDBSeries.find(s => s.title === seriesName);
    if (!matchedSeries) {
      showToast("عفواً، لا يمكن العثور على المسلسل الكامل حالياً ⚠️", "error");
      return;
    }

    let episodeIndex = 0;
    if (matchedSeries.episodes) {
      const eps = Array.isArray(matchedSeries.episodes) 
        ? matchedSeries.episodes 
        : Object.values(matchedSeries.episodes);
      
      const foundIdx = eps.findIndex((ep: any) => {
        const match = ep.title.match(/\d+/);
        return match && match[0] === episodeNumStr;
      });
      if (foundIdx !== -1) {
        episodeIndex = foundIdx;
      }
    }

    localStorage.setItem(`mo_play_last_ep_${matchedSeries.id}`, episodeIndex.toString());
    navigate('/watch', { state: { series: matchedSeries } });
  };

  const handleDeleteShort = (id: string) => {
    const shortItem = filteredShorts.find(s => s.id === id);
    const myCreatedShorts = (() => {
      try {
        return JSON.parse(localStorage.getItem('hek_my_shorts_ids') || '[]');
      } catch {
        return [];
      }
    })();
    
    // Check ownership by ID first (more secure), then by name
    const currentUserId = localStorage.getItem('hek_user_id');
    const isOwnerById = shortItem && currentUserId && shortItem.authorId === currentUserId;
    const isOwnerByName = shortItem && localStorage.getItem('comment_author_name') === shortItem.author;
    
    const isOwner = isOwnerById || isOwnerByName || (shortItem && myCreatedShorts.includes(shortItem.id));
    
    const isActualAdmin = localStorage.getItem('short_admin_access') === 'true';

    if (!isActualAdmin && !isOwner) {
      showToast("عذراً، لا تملك الصلاحية لحذف هذه اللقطة 🛑", "error");
      return;
    }

    setDeleteConfirmId(id);
  }

  const confirmDeleteShort = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    try {
      // 1. Mark in client-side localStorage to hide immediately
      localStorage.setItem(`rtdb_del_${id}`, 'true');

      // 2. Mark in RTDB for all users
      await set(rtdbRef(db, `deleted_shorts/${id}`), true);

      // 3. Try to delete from Firestore
      try {
        await deleteDoc(doc(firestore, 'shorts', id));
      } catch (err) {
        console.warn("Firestore delete blocked; fallback deletion bypass handled via RTDB master.");
      }

      showToast("تم الحذف بنجاح! ✨", "success");
    } catch (err) {
      console.error(err);
      showToast("عذراً، حدث خطأ أثناء الحذف ⚠️", "error");
    } finally {
      setDeleteConfirmId(null);
    }
  }

  const handleEditShortDetails = (id: string, currentTitle: string) => {
    const shortItem = filteredShorts.find(s => s.id === id);
    const myCreatedShorts = (() => {
      try {
        return JSON.parse(localStorage.getItem('hek_my_shorts_ids') || '[]');
      } catch {
        return [];
      }
    })();
    const isOwner = shortItem && (
      localStorage.getItem('comment_author_name') === shortItem.author || 
      myCreatedShorts.includes(shortItem.id)
    );
    const isActualAdmin = localStorage.getItem('short_admin_access') === 'true';

    if (!isActualAdmin && !isOwner) {
      showToast("عذراً، لا تملك الصلاحية لتعديل هذه اللقطة 🛑", "error");
      return;
    }

    setEditShortId(id);
    setEditShortTitle(currentTitle);
    setEditShortTimeRange(shortItem?.timeRange || "00:00 - 00:30");
  }

  const confirmEditShort = async () => {
    if (!editShortId) return;
    const id = editShortId;
    const shortItem = filteredShorts.find(s => s.id === id);
    if (!shortItem) return;

    const parts = editShortTimeRange.split('-');
    if (parts.length !== 2) {
      showToast("خطأ: صيغة الوقت غير صالحة. يرجى إدخال الوقت بصيغة مخصصة مثل (01:25 - 01:55)", "error");
      return;
    }

    const startStr = parts[0].trim();
    const endStr = parts[1].trim();

    // Check if both are valid MM:SS or HH:MM:SS format
    const timeReg = /^(?:(?:(\d+):)?(\d+):)?(\d+)$/;
    if (!timeReg.test(startStr) || !timeReg.test(endStr)) {
      showToast("خطأ: يرجى كتابة شريط الوقت بشكل دقيق.", "error");
      return;
    }

    try {
      const startSecs = parseTimeToSeconds(startStr);
      const endSecs = parseTimeToSeconds(endStr, true);
      
      if (endSecs <= startSecs) {
        showToast("خطأ: يجب أن يكون وقت النهاية بعد وقت البداية.", "error");
        return;
      }

      // Update the base source video URL fragment if the videoUrl has a #t=...
      let baseVideoUrl = shortItem?.videoUrl || "";
      const hashIndex = baseVideoUrl.indexOf("#t=");
      if (hashIndex !== -1) {
        baseVideoUrl = baseVideoUrl.substring(0, hashIndex);
      }
      
      const updatedVideoUrl = `${baseVideoUrl}#t=${startSecs},${endSecs}`;

      const editObj = {
        title: editShortTitle.trim() || shortItem.title, 
        timeRange: editShortTimeRange.trim(),
        videoUrl: updatedVideoUrl
      };

      // 1. Save in client-side localStorage
      localStorage.setItem(`rtdb_edit_${id}`, JSON.stringify(editObj));

      // 2. Proactively update the local state immediately for instant feedback
      setRtdbEditedShorts(prev => ({
        ...prev,
        [id]: editObj
      }));

      // 3. Save to RTDB for all users
      try {
        await set(rtdbRef(db, `edited_shorts/${id}`), editObj);
      } catch (err) {
        console.warn("RTDB edit blocked or offline. Saved locally.", err);
      }

      // 4. Try to update in Firestore
      try {
        await updateDoc(doc(firestore, 'shorts', id), { 
          title: editShortTitle.trim() || shortItem.title, 
          timeRange: editShortTimeRange.trim(),
          videoUrl: updatedVideoUrl
        });
      } catch (err) {
        console.warn("Firestore edit blocked or offline; fallback update bypass handled.", err);
      }

      showToast("🎉 تم تعديل لقطتك الحماسية بنجاح!", "success");
      setEditShortId(null);
    } catch (err) {
      console.error(err);
      showToast("عذراً، حدث خطأ أثناء تعديل معلومات اللقطة.", "error");
    }
  }

  const confirmClearAllShorts = async () => {
    try {
      const promises = rawSharedShorts.map(async (s) => {
        localStorage.setItem(`rtdb_del_${s.id}`, 'true');
        await set(rtdbRef(db, `deleted_shorts/${s.id}`), true);
        try {
          await deleteDoc(doc(firestore, 'shorts', s.id));
        } catch (err) {
          // ignore client write block on firestore
        }
      });
      await Promise.all(promises);
      showToast("تم تنظيف المكتبة بنجاح! ✨", "success");
    } catch (e) {
      console.error(e);
      showToast("عذراً، حدث خطأ أثناء الحذف.", "error");
    } finally {
      setShowClearAllConfirm(false);
    }
  };

  // Compile list of numerical episodes based on selected series from db or fallback
  const getSelectedSeriesEpisodes = () => {
    const found = allDBSeries.find(s => s.title === pubSeriesName);
    if (found && found.episodes && found.episodes.length > 0) {
      return Array.from({ length: found.episodes.length }, (_, i) => (i + 1).toString());
    }
    // Generic fallback count
    return Array.from({ length: 40 }, (_, i) => (i + 1).toString());
  };

  const currentShort = filteredShorts[activeIndex];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col relative select-none font-sans overflow-hidden">
      
      {/* Dynamic Toast Alerts System */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.92 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[400000] px-5 py-3 rounded-2xl border text-xs font-black shadow-2xl flex items-center gap-2 text-right bg-zinc-900/95 backdrop-blur-md ${
              toast.type === 'success'
                ? 'border-emerald-500/30 text-emerald-400'
                : toast.type === 'error'
                ? 'border-red-500/30 text-red-400'
                : 'border-blue-500/30 text-blue-400'
            }`}
          >
            <span>{toast.message}</span>
            {toast.type === 'success' && <span>⚡</span>}
            {toast.type === 'error' && <span>⚠️</span>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showIdentityModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Video className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white">مرحباً بك في شورت حكايتنا 🎬</h2>
                <p className="text-zinc-400 text-xs font-bold">يرجى إدخال اسمك للبدء في تصفح ونشر اللقطات</p>
              </div>

              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="ادخل اسمك هنا..."
                  value={visitorNameInput}
                  onChange={(e) => setVisitorNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetIdentity()}
                  className="w-full bg-black border border-white/10 rounded-2xl p-4 text-center text-sm text-white focus:outline-none focus:border-primary font-black placeholder:text-zinc-600 transition-all"
                  autoFocus
                />
                
                <button 
                  onClick={handleSetIdentity}
                  className="w-full bg-primary hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-primary/20 border border-white/10"
                >
                  دخول الآن 🚀
                </button>
              </div>

              <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
                * يمكنك كتابة كود الوصول الخاص إذا كنت تمتلك صلاحيات الإشراف
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasLoadedDB && (
        <div className="absolute inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-zinc-400 text-xs font-black animate-pulse">جاري تحضير عرض شورت حكايتنا... 🎥✨</p>
        </div>
      )}


      {/* 1. TikTok Style Immersive Device Viewport Frame Container */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-3 relative">
        <div className="relative w-full max-w-[420px] h-[100dvh] sm:h-[88vh] bg-zinc-950 border-0 sm:border border-white/10 rounded-none sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
          
          {/* Top Bar Wrapper: Back Button, Profile, Upload */}
          <div className="absolute top-0 inset-x-0 h-16 z-[160] flex items-center justify-between px-3.5 pointer-events-none">
            
            <div className="pointer-events-auto flex items-center gap-2">
              <button 
                onClick={() => {
                  localStorage.removeItem('comment_author_name');
                  localStorage.removeItem('short_admin_access');
                  window.location.reload();
                }}
                className="w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 shadow-lg cursor-pointer transition active:scale-95"
                title="تغيير الهوية"
              >
                <Smile className="w-5 h-5 text-white" />
              </button>

              <button 
                onClick={() => {
                  if (!authorName) {
                    setShowIdentityModal(true);
                  } else {
                    setIsPublishOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-black py-2 px-3.5 rounded-full border border-white/5 shadow-lg cursor-pointer transition active:scale-95"
              >
                <span>+ لقطتك 🎬</span>
              </button>

              {isAdmin && (
                <button 
                  onClick={() => setShowClearAllConfirm(true)}
                  className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full border border-red-500/20 transition active:scale-95 shadow-md cursor-pointer"
                  title="مسح جميع اللقطات"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/')}
              className="pointer-events-auto flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-black py-2 px-4 rounded-full border border-white/10 transition active:scale-95 shadow-lg cursor-pointer"
            >
              <span>رجوع</span>
              <ArrowRight className="w-4 h-4 text-primary fill-none stroke-[3.5]" />
            </button>
          </div>

          {/* Beta Status / Warning Bar */}
          <AnimatePresence>
            {showBetaMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 inset-x-0 z-[150] px-3 pointer-events-none flex flex-col gap-2"
              >
                <div className="bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs font-bold px-4 py-2 rounded-full inline-block self-start">
                  حكايتنا بيتا 🧪
                </div>
                <div className="bg-amber-500/90 text-black text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  أنا لسا بيتا، قد تظهر أخطاء مثل شاشة سوداء، سنقوم بحلها في أقرب وقت. ⚠️
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrollable container for snap interaction */}
          <div 
            ref={containerRef}
            onScroll={handleContainerScroll}
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar flex flex-col overflow-x-hidden"
          >
          {filteredShorts.length > 0 ? (
            filteredShorts.map((item, idx) => {
              const isCurrent = idx === activeIndex;
              // STRICT VIRTUALIZATION: only render if it's the current, the previous or the next one.
              const shouldRender = Math.abs(idx - activeIndex) <= 1;
              const viewsCount = viewsMap[item.id] !== undefined ? viewsMap[item.id] : (item.views || 0);
              const likesCount = likesMap[item.id] !== undefined ? likesMap[item.id] : (item.likes || 0);

              if (!shouldRender) {
                return (
                  <div 
                    key={item.id} 
                    className="w-full h-full flex-shrink-0 snap-start snap-always relative flex flex-col justify-end overflow-hidden"
                    style={{ height: '100%' }}
                  />
                );
              }

              return (
                <ShortCard
                  key={item.id}
                  item={item}
                  index={idx}
                  activeIndex={activeIndex}
                  isMuted={isMuted}
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                  hasError={hasError}
                  viewsCount={viewsCount}
                  likesCount={likesCount}
                  userLiked={!!userLiked[item.id]}
                  floatingHearts={floatingHearts}
                  showVolumeBadge={showVolumeBadge}
                  videoUrlOverride={videoUrlOverrides[item.id]}
                  videoRefs={videoRefs}
                  onTapGesture={handleTapGesture}
                  onLike={handleLike}
                  onOpenComments={() => setIsCommentsOpen(true)}
                  onShare={handleShareShort}
                  onDelete={handleDeleteShort}
                  onEditTitle={handleEditShortDetails}
                  parseTimeToSeconds={parseTimeToSeconds}
                  setIsLoading={setIsLoading}
                  setHasError={setHasError}
                  setShowPrompt={setShowPrompt}
                  onSelectSeries={handleSelectSeries}
               />
              );
            })
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-primary rounded-full animate-spin" />
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider">تنزيل الباقة السحابية...</p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* 3. Realtime Live Discussion Comments Panel (Bottom Drawer) */}
      <AnimatePresence>
        {isCommentsOpen && currentShort && (
          <div className="fixed inset-0 z-[250000] bg-black/80 backdrop-blur-sm flex items-end justify-center pb-0">
             <SeriesChat 
               seriesId={currentShort.id} 
               seriesTitle={currentShort.seriesName} 
               seriesImage={currentShort.thumbnail}
               onClose={() => setIsCommentsOpen(false)} 
             />
          </div>
        )}
      </AnimatePresence>

      {/* 4. Publisher Short Modal Box (Dynamic Episode Selector, No Raw Manual MP4 Links!) */}
      <AnimatePresence>
        {isPublishOpen && (
          <div className="fixed inset-0 z-[300000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="absolute inset-0 select-none cursor-pointer" onClick={() => setIsPublishOpen(false)} />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2rem] p-6 text-right overflow-hidden shadow-2xl z-20 select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-5">
                <button 
                  onClick={() => setIsPublishOpen(false)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white">قص لقطة من حلقات المسلسل ✂️</h3>
                  <Video className="w-4.5 h-4.5 text-primary" />
                </div>
              </div>

              <form onSubmit={handlePublishShort} className="space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar pb-4">
                {/* Search Series */}
                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="ابحث عن المسلسل (مثل: ليلى، المتوحش)..."
                      value={seriesSearchQuery}
                      onChange={(e) => setSeriesSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-3 px-10 text-xs text-white focus:outline-none focus:border-primary/50 placeholder:text-zinc-700 font-bold text-right"
                    />
                    <Video className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                  </div>
                </div>

                {/* Visual Series Choice */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-zinc-400">اختر المسلسل لإنشاء اللقطة 🎬</label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
                    {publishSeriesOptions.map((opt) => (
                      <div 
                        key={opt.title}
                        onClick={() => {
                          setPubSeriesName(opt.title);
                          setPubEpisodeNum('1');
                        }}
                        className={`flex-shrink-0 w-24 snap-start cursor-pointer transition-all duration-300 ${
                          pubSeriesName === opt.title ? 'scale-105 filter-none' : 'opacity-40 grayscale blur-[1px] hover:opacity-70'
                        }`}
                      >
                        <div className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-colors ${
                          pubSeriesName === opt.title ? 'border-primary shadow-lg shadow-primary/30' : 'border-white/5'
                        }`}>
                          <img 
                            src={opt.image || opt.thumbnail || `https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?q=80&w=200&auto=format&fit=crop`}
                            className="w-full h-full object-cover"
                            alt={opt.title}
                            loading="lazy"
                          />
                          {pubSeriesName === opt.title && (
                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                        <p className={`mt-1.5 text-[9px] font-black text-center truncate ${pubSeriesName === opt.title ? 'text-primary' : 'text-zinc-500'}`}>
                          {opt.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Episode Choice directly from series list! */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-zinc-400">اختر الحلقة المعنيّة للحفظ 📑</label>
                  <select 
                    value={pubEpisodeNum}
                    onChange={(e) => setPubEpisodeNum(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-right text-xs text-white focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    {getSelectedSeriesEpisodes().map((epNum) => (
                      <option key={epNum} value={epNum}>الحلقة {epNum}</option>
                    ))}
                  </select>
                </div>

                {/* Micro segment selection (Precise Time Entry) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-zinc-400">من الوقت (MM:SS) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="مثال: 10:00"
                      value={pubStartTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^[0-9:]*$/.test(val)) setPubStartTime(val);
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-center text-xs text-white focus:outline-none focus:border-primary font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-zinc-400">إلى الوقت (MM:SS) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="مثال: 10:45"
                      value={pubEndTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^[0-9:]*$/.test(val)) setPubEndTime(val);
                      }}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-center text-xs text-white focus:outline-none focus:border-primary font-bold"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold text-center bg-zinc-950/50 py-1.5 rounded-lg border border-white/5">
                   💡 استخدم تنسيق (دقيقة:ثانية) مثل 05:30 أو فقط (ثانية) مثل 90
                </p>

                {/* Preview Button */}
                <div className="space-y-2">
                  <button 
                    type="button"
                    onClick={handlePreviewScene}
                    disabled={previewLoading}
                    className="w-full bg-zinc-950 border border-white/10 hover:border-amber-500/50 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black text-amber-500 transition active:scale-95"
                  >
                    {previewLoading ? <div className="w-3 h-3 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {previewLoading ? 'جاري تحضير المعاينة...' : 'معاينة اللقطة قبل النشر 🎞️'}
                  </button>

                  {previewUrl && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative"
                    >
                      <video 
                        src={previewUrl} 
                        className="w-full h-full object-contain" 
                        controls 
                        autoPlay 
                        muted
                      />
                      <button 
                        onClick={() => setPreviewUrl('')}
                        className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Custom Title detail description */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-zinc-400">ما هو عنوان اللقطة؟ (اختياري) ✍️</label>
                  <p className="text-[9px] text-zinc-500 font-bold mb-1">الناشر الحالي: {authorName}</p>
                  <input 
                    type="text"
                    placeholder="مثال: يامان يودع بهار وسط الدمار! 😢"
                    value={pubTitleSuffix}
                    onChange={(e) => setPubTitleSuffix(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-right text-xs text-white focus:outline-none focus:border-primary placeholder:text-zinc-650 font-medium"
                  />
                </div>

                {/* Custom tags */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-zinc-400">ملصق اللقطة</label>
                  <select 
                    value={pubTag}
                    onChange={(e) => setPubTag(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-right text-xs text-white focus:outline-none focus:border-primary text-slate-300 font-bold cursor-pointer"
                  >
                    <option value="لقطة حاسمة 🔥">لقطة حاسمة 🔥</option>
                    <option value="أكشن مدمر ⚔️">أكشن مدمر ⚔️</option>
                    <option value="لحظة حزينة 💔">لحظة حزينة 💔</option>
                    <option value="مواجهة العباقرة 🧠">مواجهة العباقرة 🧠</option>
                    <option value="نهاية صادمة 😱">نهاية صادمة 😱</option>
                  </select>
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  disabled={isPublishing}
                  className={`w-full ${isPublishing ? 'bg-zinc-600' : 'bg-primary hover:bg-red-700'} text-white text-xs font-black py-3 rounded-xl transition duration-250 flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-md shadow-primary/20`}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>{isPublishing ? "جاري تجهيز وبث اللقطة..." : "قص ونشر اللقطة للجمهور فورا! ⚙️🎥"}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Custom Live Overlays To Replace Window Prompts and Confirms */}
      <AnimatePresence>
        {/* Delete Confirmation Dialog */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[400000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setDeleteConfirmId(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2rem] p-6 text-center shadow-2xl z-20"
            >
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-black text-white mb-2">حذف اللقطة نهائياً؟ ⚠️</h3>
              <p className="text-zinc-400 text-xs font-medium mb-6 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذه اللقطة الحماسية؟ لن تتمكن من استعادتها مرة أخرى!
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={confirmDeleteShort}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95 shadow-md"
                >
                  نعم، احذف 🛑
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95 border border-white/5"
                >
                  إلغاء الحذف
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clear All Confirmation Dialog */}
        {showClearAllConfirm && (
          <div className="fixed inset-0 z-[400000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setShowClearAllConfirm(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-blue-500/25 rounded-[2rem] p-6 text-center shadow-2xl z-20"
            >
              <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-black text-white mb-2">مسح جميع اللقطات؟ ⚠️</h3>
              <p className="text-zinc-400 text-xs font-medium mb-6 leading-relaxed">
                هل أنت متأكد من مسح وتنظيف كامل مكتبة اللقطات للجميع؟ هذا الإجراء لا يمكن التراجع عنه!
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={confirmClearAllShorts}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95"
                >
                  نعم، امسح الكل 🔥
                </button>
                <button 
                  onClick={() => setShowClearAllConfirm(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95 border border-white/5"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Details Lightbox Dialog */}
        {editShortId && (
          <div className="fixed inset-0 z-[400000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setEditShortId(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/15 rounded-[2rem] p-6 text-right shadow-2xl z-20 select-none space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <button 
                  onClick={() => setEditShortId(null)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white">تعديل تفاصيل اللقطة 📝</h3>
                  <Edit3 className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-zinc-400">عنوان اللقطة الحماسية ⚡</label>
                  <input 
                    type="text"
                    value={editShortTitle}
                    onChange={(e) => setEditShortTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-right text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                    placeholder="اكتب عنوان اللقطة..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-zinc-400">توقيت اللقطة (بداية ونهاية) ⏱️</label>
                  <input 
                    type="text"
                    value={editShortTimeRange}
                    onChange={(e) => setEditShortTimeRange(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-center text-xs text-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                    placeholder="مثال: 01:25 - 01:55"
                  />
                  <p className="text-[9px] text-zinc-500 font-bold text-center">
                    صيغة الوقت المقبولة: دقيقة:ثانية - دقيقة:ثانية
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={confirmEditShort}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95 shadow-lg shadow-blue-500/10"
                >
                  حفظ التعديلات ✨
                </button>
                <button 
                  onClick={() => setEditShortId(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl text-xs transition active:scale-95 border border-white/5"
                >
                  إلغاء التعديل
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
