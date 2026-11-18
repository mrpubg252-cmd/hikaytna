import React, { useState, useEffect } from 'react';
import { Trophy, Tv, Calendar, RefreshCw, Play, X, Loader2, Sparkles, CheckCircle, Info, Flame, AlertCircle, MessageSquare, Pencil, Trash, Plus } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import MatchChat from '../components/MatchChat';
import CustomPlayer from '../components/CustomPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { getApiUrl } from '../lib/apiConfig';
import { db, firestore } from '../services/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

interface Match {
  id: string;
  team1: string;
  team2: string;
  logo1: string;
  logo2: string;
  matchPageUrl: string;
  channel: string;
  commentator?: string;
  time: string;
  result?: string;
  statusText?: string;
  league: string;
  live: boolean;
  ended?: boolean;
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<'yesterday' | 'today' | 'tomorrow'>('today');
  const [activeStream, setActiveStream] = useState<{ match: Match; iframeUrl: string; streamError?: boolean } | null>(null);
  const [selectedServerUrl, setSelectedServerUrl] = useState<string>('');
  const [loadingStream, setLoadingStream] = useState<string | null>(null); // match ID of the clicked stream
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'cup'>('all');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeArticle, setActiveArticle] = useState<{ title: string; img: string; date: string; content: string[] } | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [isMatchPlayerMaximized, setIsMatchPlayerMaximized] = useState(false);
  const [useSeriesPlayerForMatches, setUseSeriesPlayerForMatches] = useState(true);

  React.useEffect(() => {
    if (activeStream) {
      setSelectedServerUrl(activeStream.iframeUrl || '');
    } else {
      setSelectedServerUrl('');
    }
  }, [activeStream]);

  const availableServers = React.useMemo(() => {
    if (!activeStream) return [];
    const base = activeStream.iframeUrl || '';
    const matchUrl = activeStream.match.matchPageUrl || '';
    
    let channelNum = '3';
    const numMatch = (base + ' ' + matchUrl).match(/bein-(\d+)|b(\d+)/i);
    if (numMatch) {
      channelNum = numMatch[1] || numMatch[2] || '3';
    }

    const mainAlbaplayer = `https://x.shotkoora.live/albaplayer/b${channelNum}/`;
    const albaplayer2 = `https://x.shotkoora.live/albaplayer/b${channelNum === '1' ? '2' : '1'}/`;
    const albaplayer3 = `https://x.shotkoora.live/albaplayer/b${channelNum === '3' ? '4' : '3'}/`;

    const list = [
      { id: 1, name: 'سيرفر 1 (البث الرئيسي HD ⚡)', url: base },
      { id: 2, name: 'سيرفر 2 (بث مباشر HD 📺)', url: mainAlbaplayer },
      { id: 3, name: 'سيرفر 3 (متعدد الجودات 🍿)', url: albaplayer2 },
      { id: 4, name: 'سيرفر 4 (سريع للجوال 📱)', url: albaplayer3 },
      { id: 5, name: 'سيرفر 5 (سيرفر احتياطي 🛡️)', url: matchUrl }
    ];

    const uniqueList: typeof list = [];
    const seen = new Set<string>();
    list.forEach(s => {
      if (s.url && !seen.has(s.url)) {
        seen.add(s.url);
        uniqueList.push(s);
      }
    });

    return uniqueList;
  }, [activeStream]);

  // Admin specific states for live match stream override
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isSavingCustomUrl, setIsSavingCustomUrl] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Custom stream overrides dictionary: matchId -> custom url
  const [customStreams, setCustomStreams] = useState<Record<string, string>>({});

  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({
    team1: '',
    team2: '',
    logo1: '',
    logo2: '',
    league: 'الدوري الإسباني',
    channel: 'beIN Sports Live',
    commentator: 'حفيظ دراجي',
    time: '22:00',
    result: '-',
    statusText: 'تبدأ قريباً',
    live: true,
    streamUrl: ''
  });

  const [isUploadingLogo1, setIsUploadingLogo1] = useState(false);
  const [isUploadingLogo2, setIsUploadingLogo2] = useState(false);

  const handleFileUpload = async (file: File, teamNum: 1 | 2) => {
    const setter = teamNum === 1 ? setIsUploadingLogo1 : setIsUploadingLogo2;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/v1/upload-media', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        setNewMatchForm(prev => ({
          ...prev,
          [teamNum === 1 ? 'logo1' : 'logo2']: data.url
        }));
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert('فشل رفع شعار الفريق. حاول مرة أخرى.');
    } finally {
      setter(false);
    }
  };

  const handleSaveAddMatch = async () => {
    if (!newMatchForm.team1.trim() || !newMatchForm.team2.trim()) {
      alert('الرجاء إدخال أسماء الفريقين المتباريين 🤝');
      return;
    }
    setLoading(true);
    try {
      const uniqueId = `custom_match_${Date.now()}`;
      
      await setDoc(doc(firestore, "custom_matches", uniqueId), {
        team1: newMatchForm.team1,
        team2: newMatchForm.team2,
        logo1: newMatchForm.logo1 || 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png',
        logo2: newMatchForm.logo2 || 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png',
        matchPageUrl: `https://hikaytna-matches-custom/${uniqueId}`,
        channel: newMatchForm.channel,
        commentator: newMatchForm.commentator,
        time: newMatchForm.time,
        result: newMatchForm.result,
        statusText: newMatchForm.statusText,
        league: newMatchForm.league,
        live: newMatchForm.live,
        ended: false,
        createdAt: Date.now()
      });

      if (newMatchForm.streamUrl.trim()) {
        const val = newMatchForm.streamUrl.trim();
        await setDoc(doc(firestore, "match_streams", uniqueId), { url: val, updatedAt: Date.now() });
        try {
          await set(ref(db, `match_streams/${uniqueId}`), val);
        } catch (rtdbErr) {}
        setCustomStreams(prev => ({ ...prev, [uniqueId]: val }));
      }

      alert('تم إضافة وجدولة المباراة الجديدة بثبات بنجاح! 🏆');
      setShowAddMatchModal(false);
      
      setNewMatchForm({
        team1: '',
        team2: '',
        logo1: '',
        logo2: '',
        league: 'الدوري الإسباني',
        channel: 'beIN Sports Live',
        commentator: 'غير معروف',
        time: '22:00',
        result: '-',
        statusText: 'تبدأ قريباً',
        live: true,
        streamUrl: ''
      });

      fetchMatches();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ المباراة.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomMatch = async (matchId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المباراة تماماً من جدول العرض؟')) return;
    try {
      await deleteDoc(doc(firestore, "custom_matches", matchId));
      await deleteDoc(doc(firestore, "match_streams", matchId));
      try {
        await set(ref(db, `match_streams/${matchId}`), null);
      } catch (e) {}
      fetchMatches();
      alert('تمت إزالة المباراة بالكامل بنجاح! 🗑️');
    } catch (e) {
      console.error(e);
      alert('فشل حذف المباراة من جدول العرض.');
    }
  };

  const handleOpenOutsideEditor = async (match: Match) => {
    setEditingMatch(match);
    setCustomUrlInput('');
    
    // Check local loaded cache map first
    if (customStreams[match.id]) {
      setCustomUrlInput(customStreams[match.id]);
    } else {
      // Fallback query from Firestore
      try {
        const snap = await getDocs(collection(firestore, "match_streams"));
        snap.forEach((doc) => {
          if (doc.id === match.id) {
            setCustomUrlInput(doc.data().url || '');
          }
        });
      } catch (e) {
        console.error("Could not fetch stream override from Firestore:", e);
      }
    }
  };

  const handleSaveOutsideStream = async () => {
    if (!editingMatch) return;
    const val = customUrlInput.trim();
    if (!val) {
      alert('الرجاء إدخال رابط بث صحيح أولاً ✍️');
      return;
    }
    setIsSavingCustomUrl(true);
    try {
      // 1. Write to Firestore (Guaranteed to work securely)
      const docRef = doc(firestore, "match_streams", editingMatch.id);
      await setDoc(docRef, { url: val, updatedAt: Date.now() });

      // 2. Try warning-free write to Realtime Database
      try {
        await set(ref(db, `match_streams/${editingMatch.id}`), val);
      } catch (rtdbErr) {
        console.warn("RTDB write warning (handled gracefully):", rtdbErr);
      }

      // Update local state map
      setCustomStreams(prev => ({ ...prev, [editingMatch.id]: val }));

      alert('تم حفظ وتعميم رابط البث المباشر للجميع بنجاح! 🚀');
      setEditingMatch(null);
    } catch (err) {
      console.error(err);
      alert('فشل حفظ الرابط في قاعدة البيانات.');
    } finally {
      setIsSavingCustomUrl(false);
    }
  };

  const handleDeleteOutsideStream = async () => {
    if (!editingMatch) return;
    if (!window.confirm('هل أنت متأكد من حذف البث المخصص والرجوع للبث التلقائي؟')) return;
    setIsSavingCustomUrl(true);
    try {
      // 1. Delete from Firestore
      const docRef = doc(firestore, "match_streams", editingMatch.id);
      await deleteDoc(docRef);

      // 2. Try warning-free delete on Realtime Database
      try {
        await set(ref(db, `match_streams/${editingMatch.id}`), null);
      } catch (rtdbErr) {
        console.warn("RTDB delete warning (handled gracefully):", rtdbErr);
      }

      // Update local state map
      setCustomStreams(prev => {
        const next = { ...prev };
        delete next[editingMatch.id];
        return next;
      });

      alert('تم استرجاع البث التلقائي الافتراضي بنجاح! 🔄');
      setEditingMatch(null);
    } catch (err) {
      console.error(err);
      alert('فشل تعطيل الرابط المخصص.');
    } finally {
      setIsSavingCustomUrl(false);
    }
  };

  // Authenticate admin on mount & load custom stream overrides
  useEffect(() => {
    setIsAdmin(localStorage.getItem('short_admin_access') === 'true');

    const loadCustomStreams = async () => {
      try {
        const snap = await getDocs(collection(firestore, "match_streams"));
        const overrides: Record<string, string> = {};
        snap.forEach((doc) => {
          const dData = doc.data();
          if (dData && dData.url) {
            overrides[doc.id] = dData.url;
          }
        });
        setCustomStreams(overrides);
      } catch (e) {
        console.error("Failed to load custom stream overrides from Firestore:", e);
      }
    };
    loadCustomStreams();

    // Listen to Realtime Database `/match_streams` for direct live updates if authorized
    try {
      const rtdbRef = ref(db, 'match_streams');
      const unsubscribe = onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const cleanVal: Record<string, string> = {};
            Object.entries(val).forEach(([k, v]) => {
              if (
                typeof v === 'string' &&
                v.trim().length > 10 &&
                (v.trim().startsWith('http') || v.trim().includes('/'))
              ) {
                cleanVal[k] = v.trim();
              }
            });
            setCustomStreams(prev => ({ ...prev, ...cleanVal }));
          }
        }
      }, (error) => {
        console.warn("RTDB direct subscription ignored gracefully:", error);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("RTDB listener failed setup:", e);
    }
  }, []);

  const [sportsNews, setSportsNews] = useState<Array<{ title: string; img: string; link: string }>>([]);

  // Helper to determine if a match has ended
  const isMatchEnded = (m: Match) => {
    if (m.ended === true) return true;
    const txt = (m.statusText || '').trim();
    if (txt.includes('انتهت') || txt.includes('انتهي') || txt.includes('منتهية') || txt.includes('Finished') || txt.includes('FT')) return true;
    return false;
  };

  const fetchSportsNews = async () => {
    try {
      const res = await fetch(getApiUrl('/api/v1/matches/news'));
      const data = await res.json();
      if (data.status && Array.isArray(data.news)) {
        setSportsNews(data.news);
      }
    } catch (e) {
      console.warn('Failed to fetch sports news:', e);
    }
  };

  useEffect(() => {
    fetchSportsNews();
  }, []);

  // Clock Ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const tInterval = setInterval(updateTime, 1000);
    return () => clearInterval(tInterval);
  }, []);

  const fetchMatches = async (isRefresh = false, targetDay?: 'yesterday' | 'today' | 'tomorrow') => {
    const dayToFetch = targetDay || selectedDay;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      // 1. Fetch scraped match feed
      const res = await fetch(getApiUrl(`/api/v1/matches/scrape?day=${dayToFetch}`));
      const data = await res.json();
      let scrapedList: Match[] = [];
      if (data.status && Array.isArray(data.matches)) {
        scrapedList = data.matches;
      }

      // 2. Fetch custom matches from Firestore if today
      let customList: Match[] = [];
      if (dayToFetch === 'today') {
        try {
          const customSnap = await getDocs(collection(firestore, "custom_matches"));
          customSnap.forEach((doc) => {
            const mData = doc.data();
            if (mData) {
              customList.push({
                id: doc.id,
                team1: mData.team1 || '',
                team2: mData.team2 || '',
                logo1: mData.logo1 || mData.team1Logo || '',
                logo2: mData.logo2 || mData.team2Logo || '',
                matchPageUrl: mData.matchPageUrl || '',
                channel: mData.channel || 'beIN Sports Live',
                commentator: mData.commentator || 'غير معروف',
                time: mData.time || '22:00',
                result: mData.result || '-',
                statusText: mData.statusText || 'تبدأ قريباً',
                league: mData.league || 'الدوري الإسباني',
                live: mData.live !== undefined ? mData.live : true,
                ended: mData.ended !== undefined ? mData.ended : false,
              });
            }
          });
        } catch (firestoreErr) {
          console.warn("Could not load custom matches:", firestoreErr);
        }
      }

      // 3. Prevent duplicate overlaps by ID (Custom matches override duplicates)
      const combined: Match[] = [...customList];
      scrapedList.forEach((sMatch) => {
        if (!combined.some(c => c.id === sMatch.id)) {
          combined.push(sMatch);
        }
      });

      setMatches(combined);
    } catch (err: any) {
      setError('خطأ في الاتصال بالخادم الرئيسي لقنوات البث. يرجى التحديث.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenArticle = async (newsLink: string) => {
    if (!newsLink || newsLink === '#') return;
    setLoadingArticle(true);
    try {
      const res = await fetch(getApiUrl(`/api/v1/matches/article?url=${encodeURIComponent(newsLink)}`));
      const data = await res.json();
      if (data.status && data.article) {
        setActiveArticle(data.article);
      }
    } catch (e) {
      console.warn('Failed to fetch article details:', e);
    } finally {
      setLoadingArticle(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    // Auto refresh matches list every 60 seconds
    const interval = setInterval(() => fetchMatches(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleWatchStream = async (match: Match, bypassAdGate = false) => {
    const params = new URLSearchParams(window.location.search);
    const isUnlocked = params.get('unlocked') === 'true' && params.get('matchId') === match.id;

    if (!isUnlocked && !bypassAdGate) {
      const currentOrigin = window.location.origin;
      const redirectPath = `${currentOrigin}/matches?matchId=${encodeURIComponent(match.id)}&unlocked=true`;
      window.location.href = `/gateway?redirect=${encodeURIComponent(redirectPath)}`;
      return;
    }

    setLoadingStream(match.id);
    try {
      // 1. Direct query from Firestore cache map first (fully secure and robust)
      const customUrl = customStreams[match.id];
      if (customUrl && customUrl.trim() !== "") {
        setActiveStream({ match, iframeUrl: customUrl.trim(), streamError: false });
        return;
      }

      // 2. Direct query from Firebase Realtime Database first for admin override stream link as fallback
      const customStreamRef = ref(db, `match_streams/${match.id}`);
      const snap = await get(customStreamRef);
      if (snap.exists() && snap.val() && snap.val().trim() !== "") {
        setActiveStream({ match, iframeUrl: snap.val().trim(), streamError: false });
        // Update cache state
        setCustomStreams(prev => ({ ...prev, [match.id]: snap.val().trim() }));
        return;
      }

      // 3. Fall back to scraping the standard portal
      const res = await fetch(getApiUrl(`/api/v1/matches/stream?url=${encodeURIComponent(match.matchPageUrl)}`));
      const data = await res.json();
      if (data.status && data.iframeUrl) {
        setActiveStream({ match, iframeUrl: data.iframeUrl, streamError: false });
      } else {
        // Activate in-modal stream-error view
        setActiveStream({ match, iframeUrl: "", streamError: true });
      }
    } catch (err) {
      setActiveStream({ match, iframeUrl: "", streamError: true });
    } finally {
      setLoadingStream(null);
    }
  };

  // Real-time listener for current active match stream in Firebase Realtime Database
  useEffect(() => {
    if (!activeStream?.match?.id) return;
    const matchId = activeStream.match.id;
    const customStreamRef = ref(db, `match_streams/${matchId}`);
    
    const unsubscribe = onValue(customStreamRef, (snapshot) => {
      if (snapshot.exists()) {
        const customUrl = snapshot.val();
        if (customUrl && customUrl.trim() !== "" && customUrl !== activeStream.iframeUrl) {
          setActiveStream(prev => prev ? { ...prev, iframeUrl: customUrl, streamError: false } : null);
        }
      }
    });
    
    return () => unsubscribe();
  }, [activeStream?.match?.id]);

  // Admin Custom Match Stream Savers
  const handleSaveCustomStream = async () => {
    if (!activeStream) return;
    const matchId = activeStream.match.id;
    const urlVal = customUrlInput.trim();
    if (!urlVal) {
      alert('الرجاء إدخال رابط بث صحيح');
      return;
    }
    
    setIsSavingCustomUrl(true);
    try {
      // 1. Write to Firestore (Primary & 100% reliable)
      const streamDocRef = doc(firestore, "match_streams", matchId);
      await setDoc(streamDocRef, { url: urlVal, updatedAt: Date.now() });

      // 2. Try warning-free write to RTDB (secondary)
      try {
        await set(ref(db, `match_streams/${matchId}`), urlVal);
      } catch (rtdbErr) {
        console.warn("RTDB write warning (fully expected on restricted databases):", rtdbErr);
      }

      // Update local state map
      setCustomStreams(prev => ({ ...prev, [matchId]: urlVal }));

      setActiveStream(prev => prev ? { ...prev, iframeUrl: urlVal, streamError: false } : null);
      setIsAdminEditing(false);
      alert('تم حفظ وتعميم رابط البث المباشر المخصص بنجاح للجميع! 🚀');
    } catch (err: any) {
      console.error("Error setting custom match stream:", err);
      alert('حدث خطأ أثناء حفظ الرابط السحابي في Firestore.');
    } finally {
      setIsSavingCustomUrl(false);
    }
  };

  const handleDeleteCustomStream = async () => {
    if (!activeStream) return;
    const matchId = activeStream.match.id;
    if (!window.confirm('هل أنت متأكد من استعادة البث التلقائي المصدر والمزامنة الافتراضية؟')) return;

    setIsSavingCustomUrl(true);
    try {
      // 1. Delete from Firestore
      const streamDocRef = doc(firestore, "match_streams", matchId);
      await deleteDoc(streamDocRef);

      // 2. Try RTDB deletion
      try {
        await set(ref(db, `match_streams/${matchId}`), null);
      } catch (rtdbErr) {
        console.warn("RTDB delete warning (fully expected on restricted databases):", rtdbErr);
      }

      // Update local state map
      setCustomStreams(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });

      // Force refresh of stream by calling scraper
      setIsAdminEditing(false);
      handleWatchStream(activeStream.match, true);
      alert('تم إزالة الرابط المخصص واستعادة البث التلقائي لجميع الزوار! 🔄');
    } catch (err: any) {
      console.error("Error deleting custom match stream:", err);
      alert('حدث خطأ أثناء إعادة ضبط البث');
    } finally {
      setIsSavingCustomUrl(false);
    }
  };

  // Watch Screen Ad Redirect Callback Handler
  useEffect(() => {
    if (matches.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('matchId');
    const unlocked = params.get('unlocked');
    
    if (matchId && unlocked === 'true') {
      const targetMatch = matches.find(m => m.id === matchId);
      if (targetMatch) {
        handleWatchStream(targetMatch, true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [matches]);

  // Filter and Search logic
  const filteredMatches = matches.filter(m => {
    const matchesSearch = 
      m.team1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.team2.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.league.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.channel.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'live') return m.live;
    if (activeFilter === 'cup') {
      return m.league.includes('كأس') || m.league.includes('العالم') || m.league.includes('كاس') || m.league.includes('أبطال') || m.league.includes('دوري');
    }
    return true;
  });

  // Sort matches so LIVE matches ALWAYS appear at the very top
  const sortedMatches = React.useMemo(() => {
    return [...filteredMatches].sort((a, b) => {
      if (a.live && !b.live) return -1;
      if (!a.live && b.live) return 1;
      const aEnded = isMatchEnded(a);
      const bEnded = isMatchEnded(b);
      if (!aEnded && bEnded) return -1;
      if (aEnded && !bEnded) return 1;
      return 0;
    });
  }, [filteredMatches]);

  const totalLiveCount = matches.filter(m => m.live).length;

  return (
    <div className="min-h-screen bg-[#070708] text-white pb-32 selection:bg-red-650 selection:text-white font-sans">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 sm:pt-6 space-y-6">
        
        {/* DAY SELECTOR TABS (مباريات الأمس / اليوم / الغد) */}
        <div className="flex items-center justify-center sm:justify-start gap-2 bg-zinc-950/70 p-2 sm:p-2.5 rounded-2xl border border-zinc-900 overflow-x-auto no-scrollbar shadow-md">
          <button
            onClick={() => {
              setSelectedDay('yesterday');
              fetchMatches(false, 'yesterday');
            }}
            className={`px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 shrink-0 ${
              selectedDay === 'yesterday'
                ? 'bg-blue-650 text-white border-blue-500 shadow-md shadow-blue-600/20'
                : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:text-white'
            }`}
          >
            <span>مباريات الأمس ⚽</span>
          </button>

          <button
            onClick={() => {
              setSelectedDay('today');
              fetchMatches(false, 'today');
            }}
            className={`px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 shrink-0 ${
              selectedDay === 'today'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/20'
                : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>مباريات اليوم 🔴</span>
          </button>

          <button
            onClick={() => {
              setSelectedDay('tomorrow');
              fetchMatches(false, 'tomorrow');
            }}
            className={`px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 shrink-0 ${
              selectedDay === 'tomorrow'
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:text-white'
            }`}
          >
            <span>مباريات الغد ⏰</span>
          </button>
        </div>

        {/* CLEAN TABLE/GRID HEADER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/40 border border-zinc-900/60 p-5 rounded-[2rem] shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
            <h1 className="text-base font-black text-white">
              {selectedDay === 'yesterday' 
                ? 'نتائج مباريات الأمس | حكايتنا ⚽' 
                : selectedDay === 'tomorrow' 
                  ? 'جدول مباريات الغد | حكايتنا ⏰' 
                  : 'جدول مباريات اليوم (البث المباشر) | حكايتنا 🔴'}
            </h1>
            {isAdmin && (
              <button
                onClick={() => setShowAddMatchModal(true)}
                className="mr-3 px-4 py-2 bg-gradient-to-r from-red-650 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-[10px] font-black rounded-xl shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>إضافة مباراة مخصصة 🏆</span>
              </button>
            )}
          </div>

          {/* Search Input & Refresh Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="ابحث عن خصم، بطولة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d0d0f] border border-zinc-900 rounded-2xl px-4 py-2.5 text-[11px] text-right text-white focus:outline-none focus:border-red-600 placeholder-zinc-500 transition-colors font-sans"
              />
            </div>
            <button 
              onClick={() => fetchMatches(true)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-850 rounded-2xl text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* LOADING STATE CARD */}
        {loading && matches.length === 0 && (
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-[2rem] py-24 text-center space-y-4 shadow-sm">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-red-600 animate-spin" />
              <div className="absolute w-3 h-3 rounded-full bg-white animate-ping" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-white">جاري تحميل جدول مباريات اليوم...</h3>
              <p className="text-zinc-500 text-[10px]">نقوم بربط المزامنة والتحقق من جودة البث في الوقت الفعلي</p>
            </div>
          </div>
        )}

        {/* ERROR STATE CARD */}
        {error && matches.length === 0 && (
          <div className="bg-zinc-950/20 border border-zinc-900 rounded-[2rem] p-8 text-center space-y-4 max-w-xl mx-auto">
            <Info className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-sm font-black text-white">تعذر تغذية البيانات</h3>
              <p className="text-[11px] text-zinc-500 mt-1">{error}</p>
            </div>
            <button 
              onClick={() => fetchMatches()}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-bold active:scale-95 transition cursor-pointer"
            >
              تحديث الجدول الآن 🔄
            </button>
          </div>
        )}

        {/* EMPTY MATCHES STATE */}
        {!loading && sortedMatches.length === 0 && (
          <div className="bg-[#0b0b0d] border border-zinc-900 rounded-[2rem] p-16 text-center space-y-3 shadow-md max-w-2xl mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500/20 mx-auto animate-bounce" />
            <h3 className="text-sm font-black text-zinc-300">لا يوجد بث للمباريات حالياً</h3>
            <p className="text-zinc-550 text-[10px] max-w-lg mx-auto">
              تظهر هنا روابط وبث المباراة فور انطلاق اللقاءات المقررة. لا توجد مواجهات مطابقة لشروط الفرز الحالية. يرجى تصفح فئات أخرى.
            </p>
          </div>
        )}

        {/* MATCHES LIST / CARDS (LIVE MATCHES FIRST) */}
        <AnimatePresence mode="popLayout">
          {sortedMatches.length > 0 && (
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {sortedMatches.map((m, index) => {
                const streamUrl = customStreams[m.id];
                const isCustomized = typeof streamUrl === 'string' && 
                                     streamUrl.trim().length > 10 && 
                                     (streamUrl.trim().startsWith('http') || streamUrl.trim().includes('/'));
                return (
                  <motion.div
                    key={m.id || index}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`relative bg-zinc-950/40 border rounded-[2rem] p-6 transition-all duration-300 flex flex-col justify-between group overflow-hidden ${
                      isCustomized ? "border-emerald-650/40 hover:border-emerald-500/80" : "border-zinc-900/60 hover:border-red-950"
                    }`}
                  >
                    {/* Subtle Background Red Ripple Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-red-600/10 transition-colors" />

                    {/* Match Header */}
                    <div className="relative z-10 flex items-center justify-between text-[11px] mb-6">
                      <span className="font-black text-zinc-300 bg-zinc-900/60 border border-zinc-850 py-1.5 px-3.5 rounded-full shrink-0">
                        🏆 {m.league}
                      </span>
                      {isCustomized ? (
                        <span className="flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          بث مباشر متاح
                        </span>
                      ) : m.live ? (
                        <span className="flex items-center gap-1.5 font-bold text-red-400 bg-red-950/40 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          بث مباشر
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-bold flex items-center gap-1 text-[10px] bg-zinc-900/30 px-2.5 py-1 rounded-full border border-zinc-850">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500 animate-pulse" />
                          {m.statusText || m.time}
                        </span>
                      )}
                    </div>

                  {/* Teams and vs Block */}
                  <div className="relative z-10 flex items-center justify-between gap-4 py-2">
                    {/* Team 1 */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="relative w-16 h-16 bg-black/50 border border-zinc-900 rounded-full p-3 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                        <img 
                          src={m.logo1 || 'https://via.placeholder.com/70?text=Logo'} 
                          alt={m.team1}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/70?text=No+Logo';
                          }}
                        />
                      </div>
                      <h4 className="text-xs md:text-sm font-black truncate max-w-[120px] text-white">
                        {m.team1}
                      </h4>
                    </div>

                    {/* VS Badge */}
                    <div className="shrink-0 flex flex-col items-center justify-center space-y-1.5">
                      {m.result ? (
                        (() => {
                          const parts = m.result.split('-').map(p => p.trim());
                          if (parts.length === 2) {
                            return (
                              <div 
                                className="flex items-center justify-center gap-1.5 font-mono text-xl md:text-2xl font-black text-red-500 bg-red-500/10 px-4 py-1.5 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
                                dir="ltr"
                              >
                                <span>{parts[1]}</span>
                                <span className="text-zinc-500 font-sans text-lg">-</span>
                                <span>{parts[0]}</span>
                              </div>
                            );
                          }
                          return (
                            <span className="text-xl md:text-2xl font-black tracking-widest text-red-500 bg-red-500/10 px-4 py-1.5 rounded-2xl border border-red-500/20 font-mono shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                              {m.result}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-xs font-black text-rose-500 bg-rose-500/5 px-3 py-1.5 rounded-2xl border border-rose-500/10">
                          VS
                        </span>
                      )}
                      
                      {isCustomized ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-950/40 border-emerald-500/20 animate-pulse">
                          بث مخصص نشط ⚡
                        </span>
                      ) : m.statusText ? (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                          m.live 
                            ? 'text-red-400 bg-red-950/40 border-red-500/20 animate-pulse'
                            : 'text-zinc-500 bg-zinc-900/50 border-zinc-850'
                        }`}>
                          {m.statusText}
                        </span>
                      ) : null}
                    </div>

                    {/* Team 2 */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="relative w-16 h-16 bg-black/50 border border-zinc-900 rounded-full p-3 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                        <img 
                          src={m.logo2 || 'https://via.placeholder.com/70?text=Logo'} 
                          alt={m.team2}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/70?text=No+Logo';
                          }}
                        />
                      </div>
                      <h4 className="text-xs md:text-sm font-black truncate max-w-[120px] text-white">
                        {m.team2}
                      </h4>
                    </div>
                  </div>

                  {/* BOTTOM DETAIL AND CTA */}
                  <div className="relative z-10 border-t border-zinc-900/60 pt-4 mt-6 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5 items-start">
                      {m.channel && m.channel.trim() !== "" && m.channel !== "beIN Sports HD" && m.channel !== "beIN Sports Live" && (
                        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
                          <Tv className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="truncate max-w-[120px]">{m.channel}</span>
                        </div>
                      )}
                      {m.commentator && m.commentator.trim() !== "" && m.commentator !== "عصام الشوالي" && m.commentator !== "غير معروف" && (
                        <span className="text-[10px] text-zinc-500 font-bold shrink-0">
                          🎙️ {m.commentator}
                        </span>
                      )}
                      {(!m.channel || m.channel === "beIN Sports HD" || m.channel.trim() === "") && (
                        <span className="text-[11px] text-zinc-400 font-bold flex items-center gap-1">
                          ⏰ {m.time}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenOutsideEditor(m)}
                            className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-2xl transition cursor-pointer shrink-0"
                            title="تعديل رابط البث المباشر للجميع"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Trash icon if custom match */}
                          {m.id.startsWith('custom_') && (
                            <button
                              onClick={() => handleDeleteCustomMatch(m.id)}
                              className="p-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-500 rounded-2xl transition cursor-pointer shrink-0"
                              title="حذف هذه المباراة بالكامل"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => (m.live || isCustomized) && handleWatchStream(m)}
                        disabled={loadingStream !== null || (!m.live && !isCustomized)}
                        className={`py-2.5 px-6 rounded-2xl text-[11px] font-black flex items-center gap-2 transition duration-250 shrink-0 ${
                          isCustomized 
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25 active:scale-95 border border-emerald-500/20" 
                            : m.live 
                              ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-600/10 hover:shadow-red-600/25 active:scale-95" 
                              : "bg-zinc-950 border border-zinc-900 text-zinc-500 cursor-not-allowed"
                        }`}
                      >
                        {loadingStream === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <Play className={`w-3.5 h-3.5 ${m.live || isCustomized ? 'fill-current text-white' : 'text-zinc-750'}`} />
                        )}
                        <span>
                          {isCustomized 
                            ? "اضغط لمشاهدة البث" 
                            : m.live 
                              ? "شاهد المباراة والدردشة" 
                              : isMatchEnded(m)
                                ? "انتهت المباراة" 
                                : "لم تبدأ بعد"}
                        </span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );})}
            </motion.div>
          )}
        </AnimatePresence>

        {/* OUTSIDE MATCH STREAM EDITOR MODAL */}
        <AnimatePresence>
          {editingMatch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1100] bg-[#000000]/90 backdrop-blur-xl flex items-center justify-center p-4 font-sans"
            >
              <div 
                className="absolute inset-0" 
                onClick={() => setEditingMatch(null)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8 max-w-lg w-full text-right space-y-5 shadow-2xl z-10"
              >
                <div className="flex items-center justify-between flex-row-reverse">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Pencil className="w-4 h-4" />
                    </span>
                    <span>تعديل بث مباراة: {editingMatch.team1} ضد {editingMatch.team2}</span>
                  </h3>
                  <button
                    onClick={() => setEditingMatch(null)}
                    className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-right font-sans">
                  <label className="block text-[10px] font-bold text-zinc-400">رابط البث المباشر (رابط iframe أو رابط السيرفر المباشر):</label>
                  <textarea
                    dir="ltr"
                    rows={4}
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#0d0d0f] border border-zinc-900 focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none placeholder-zinc-700 font-mono whitespace-pre-wrap resize-none transition-all text-left"
                  />
                  <p className="text-[9px] text-zinc-500 leading-relaxed pt-1">
                    هذا الرابط سيغطى على البث الافتراضي وسيتفعل لجميع زوار موقعك فوراً بشكل احترافي.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2 font-sans">
                  <button
                    onClick={handleSaveOutsideStream}
                    disabled={isSavingCustomUrl}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs py-3.5 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                  >
                    {isSavingCustomUrl ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>حفظ وتعميم البث 🚀</span>
                  </button>

                  <button
                    onClick={handleDeleteOutsideStream}
                    disabled={isSavingCustomUrl}
                    className="bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 text-red-400 font-bold text-[10px] px-4 py-3.5 rounded-xl transition cursor-pointer shrink-0"
                  >
                    حذف المخصص 🔄
                  </button>

                  <button
                    onClick={() => setEditingMatch(null)}
                    className="bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-bold text-[10px] px-4 py-3.5 rounded-xl transition cursor-pointer shrink-0"
                  >
                    إلغاء لغتي
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STREAM MATCH MODAL: ONLY PLAYER AND SERVER SELECTOR */}
        <AnimatePresence>
          {activeStream && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-[#020202]/98 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6"
            >
              <div 
                className="absolute inset-0 bg-black/90 cursor-pointer" 
                onClick={() => {
                  setActiveStream(null);
                  setIsAdminEditing(false);
                }}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="relative bg-[#09090b] border border-zinc-900 rounded-[2.5rem] w-full max-w-5xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10 flex flex-col my-auto"
              >
                {/* Match Header Bar */}
                <div className="p-4 sm:p-5 border-b border-zinc-900 flex items-center justify-between gap-4 shrink-0 bg-zinc-950/80">
                  <div className="flex items-center gap-3 text-right">
                    <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                      <Tv className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white">
                        {activeStream.match.team1} ضد {activeStream.match.team2}
                      </h3>
                      <p className="text-[10px] text-red-500 font-bold mt-0.5">
                        {activeStream.match.league} • القناة الناقلة: {activeStream.match.channel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUseSeriesPlayerForMatches(!useSeriesPlayerForMatches)}
                      className="py-1.5 px-3 border border-red-500/30 bg-red-650/20 text-red-400 hover:bg-red-650/40 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      title="التبديل بين مشغل المسلسلات ومشغل البث المباشر"
                    >
                      <Sparkles className="w-3 h-3 text-red-500 animate-pulse" />
                      <span>{useSeriesPlayerForMatches ? 'مشغل المسلسلات 🍿' : 'مشغل البث 📺'}</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setCustomUrlInput(selectedServerUrl || activeStream.iframeUrl || '');
                          setIsAdminEditing(!isAdminEditing);
                        }}
                        className="py-1.5 px-3 border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
                        title="تعديل رابط البث المباشر"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{isAdminEditing ? 'عرض البث' : 'تعديل البث'}</span>
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setActiveStream(null);
                        setIsAdminEditing(false);
                      }}
                      className="p-2 hover:bg-zinc-900 rounded-full transition text-zinc-400 hover:text-white cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Video Player Section */}
                <div className="relative aspect-video w-full max-h-[65vh] bg-black flex flex-col items-center justify-center border-b border-zinc-900 overflow-hidden">
                  {isAdminEditing ? (
                    /* Admin Stream Override Box */
                    <div className="w-full max-w-xl p-6 md:p-8 space-y-4 text-right font-sans my-auto">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">تعديل رابط البث المباشر (لوحة الإدارة)</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                            سيتم مزامنة الرابط الجديد سحابياً في Firebase فوراً عند جميع الزوار!
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="block text-[10px] font-bold text-zinc-400">رابط البث المباشر الجديد (iframe/server URL):</label>
                        <textarea
                          dir="ltr"
                          rows={3}
                          value={customUrlInput}
                          onChange={(e) => setCustomUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-zinc-950 border border-zinc-900 focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-white focus:outline-none placeholder-zinc-700 transition font-mono whitespace-pre-wrap resize-none"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <button
                          onClick={handleSaveCustomStream}
                          disabled={isSavingCustomUrl}
                          className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-[11px] py-3 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                        >
                          {isSavingCustomUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          <span>حفظ وتعميم البث سحابياً</span>
                        </button>

                        <button
                          onClick={handleDeleteCustomStream}
                          disabled={isSavingCustomUrl}
                          className="bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 text-red-400 font-bold text-[10px] px-4 py-3 rounded-xl transition cursor-pointer"
                        >
                          استعادة البث التلقائي 🔄
                        </button>

                        <button
                          onClick={() => setIsAdminEditing(false)}
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-[10px] px-4 py-3 rounded-xl transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : activeStream.streamError ? (
                    /* Stream Error Box */
                    <div className="p-8 text-center space-y-4 max-w-md mx-auto my-auto">
                      <div className="w-14 h-14 rounded-full bg-red-950/15 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                        <AlertCircle className="w-8 h-8 animate-bounce" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-black text-white">بث اللقاء غير متوفر حالياً</h4>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          البث المباشر لهذه المباراة لم يبدأ من المصدر بعد. يرجى التبديل بين السيرفرات بالأسفل أو المحاولة مجدداً.
                        </p>
                      </div>
                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={() => handleWatchStream(activeStream.match, true)}
                          className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] px-5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer"
                        >
                          إعادة المحاولة 🔄
                        </button>
                        <button
                          onClick={() => setActiveStream(null)}
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-extrabold text-[10px] px-5 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          إغلاق
                        </button>
                      </div>
                    </div>
                  ) : useSeriesPlayerForMatches ? (
                    /* SERIES CUSTOM PLAYER FOR MATCHES */
                    <CustomPlayer
                      videoUrl={selectedServerUrl || activeStream.iframeUrl}
                      activeServerUrl={selectedServerUrl || activeStream.iframeUrl}
                      seriesId={activeStream.match.id}
                      seriesImage={activeStream.match.logo1 || activeStream.match.logo2 || 'https://yalla-sd.org/wp-content/uploads/2026/01/InShot_20260102_210059277-scaled-1-350x197.jpg'}
                      episodeIndex={0}
                      episodes={[{
                        id: activeStream.match.id,
                        episode: 1,
                        title: `${activeStream.match.team1} ضد ${activeStream.match.team2}`,
                        url: activeStream.match.matchPageUrl
                      }]}
                      servers={availableServers.map(s => ({ name: s.name, url: s.url }))}
                      onSelectEpisode={() => {}}
                      onSelectServer={(url) => setSelectedServerUrl(url)}
                      isMaximized={isMatchPlayerMaximized}
                      onToggleMaximize={() => setIsMatchPlayerMaximized(!isMatchPlayerMaximized)}
                      seriesCategory={activeStream.match.league}
                      seriesTitle={`${activeStream.match.team1} ضد ${activeStream.match.team2}`}
                    />
                  ) : (
                    /* Direct Video Iframe Player */
                    <iframe
                      key={selectedServerUrl || activeStream.iframeUrl}
                      src={selectedServerUrl || activeStream.iframeUrl}
                      title="Live Match Player"
                      className="w-full h-full border-none bg-black"
                      allowFullScreen
                      scrolling="no"
                      allow="autoplay; encrypted-media; picture-in-picture"
                    />
                  )}
                </div>

                {/* SERVER SELECTOR BAR ONLY (NO CHAT OR EXTRA TEXT) */}
                {!isAdminEditing && !activeStream.streamError && (
                  <div className="p-4 sm:p-5 bg-zinc-950/95 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-black">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span>اختر سيرفر المشاهدة المناسب:</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full max-w-3xl">
                      {availableServers.map((server) => {
                        const activeUrl = selectedServerUrl || activeStream.iframeUrl;
                        const isSelected = activeUrl === server.url;
                        return (
                          <button
                            key={server.id}
                            onClick={() => setSelectedServerUrl(server.url)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border active:scale-95 shadow-md flex items-center gap-2 ${
                              isSelected
                                ? "bg-red-600 text-white border-red-500 shadow-red-600/30 font-extrabold scale-105"
                                : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                            }`}
                          >
                            <Tv className={`w-3.5 h-3.5 ${isSelected ? 'text-white animate-pulse' : 'text-zinc-500'}`} />
                            <span>{server.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ADD NEW CUSTOM MATCH MODAL */}
        <AnimatePresence>
          {showAddMatchModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto font-sans"
            >
              <div 
                className="absolute inset-0" 
                onClick={() => setShowAddMatchModal(false)}
              />
              
              <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                className="relative bg-zinc-950 border border-zinc-900 rounded-[2.5rem] w-full max-w-lg p-7 overflow-hidden shadow-2xl space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between flex-row-reverse border-b border-zinc-900/60 pb-3">
                  <h3 className="text-sm font-black text-rose-500">إضافة مباراة وجدولة بث جديد 🏆</h3>
                  <button
                    onClick={() => setShowAddMatchModal(false)}
                    className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-right font-sans max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
                  {/* Teams Inputs */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">اسم الفريق الأول (اليمين):</label>
                      <input
                        type="text"
                        placeholder="مثال: ريال مدريد"
                        value={newMatchForm.team1}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, team1: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">اسم الفريق الثاني (اليسار):</label>
                      <input
                        type="text"
                        placeholder="مثال: برشلونة"
                        value={newMatchForm.team2}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, team2: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                  </div>

                  {/* Logo Uploaders */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-400">شعار الفريق الأول 🔥</label>
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-zinc-800 hover:border-red-600/40 transition-all aspect-square bg-zinc-900/20 flex flex-col items-center justify-center gap-2">
                        {newMatchForm.logo1 ? (
                          <img src={newMatchForm.logo1} className="w-full h-full object-contain p-4" alt="logo1" />
                        ) : (
                          <div className="text-zinc-500 flex flex-col items-center p-2 text-center">
                            <Plus className="w-6 h-6 mb-1 opacity-20" />
                            <span className="text-[9px]">اضغطر للرفع</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 1);
                          }}
                        />
                        {isUploadingLogo1 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="أو رابط الشعار..."
                        value={newMatchForm.logo1}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, logo1: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-[10px] text-zinc-400 focus:outline-none focus:border-red-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-400">شعار الفريق الثاني 🔥</label>
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-zinc-800 hover:border-red-600/40 transition-all aspect-square bg-zinc-900/20 flex flex-col items-center justify-center gap-2">
                        {newMatchForm.logo2 ? (
                          <img src={newMatchForm.logo2} className="w-full h-full object-contain p-4" alt="logo2" />
                        ) : (
                          <div className="text-zinc-500 flex flex-col items-center p-2 text-center">
                            <Plus className="w-6 h-6 mb-1 opacity-20" />
                            <span className="text-[9px]">اضغطر للرفع</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 2);
                          }}
                        />
                        {isUploadingLogo2 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="أو رابط الشعار..."
                        value={newMatchForm.logo2}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, logo2: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-[10px] text-zinc-400 focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>

                  {/* League and Channel */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">البطولة / الدوري:</label>
                      <input
                        type="text"
                        placeholder="مثال: الدوري الإنجليزي الممتاز"
                        value={newMatchForm.league}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, league: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">قناة البث الافتراضية:</label>
                      <input
                        type="text"
                        placeholder="مثال: beIN Sports HD 1"
                        value={newMatchForm.channel}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, channel: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                  </div>

                  {/* Commentator and Time */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">المعلق الرياضي:</label>
                      <input
                        type="text"
                        placeholder="مثال: عصام الشوالي"
                        value={newMatchForm.commentator}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, commentator: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">توقيت المباراة أو حالتها:</label>
                      <input
                        type="text"
                        placeholder="مثال: 22:00 بتوقيت مكة"
                        value={newMatchForm.time}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                  </div>

                  {/* Status, Result, Live Boolean */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">شعار الحالة:</label>
                      <input
                        type="text"
                        placeholder="مثال: جارية الآن"
                        value={newMatchForm.statusText}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, statusText: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">النتيجة:</label>
                      <input
                        type="text"
                        placeholder="مثال: 0 - 0"
                        value={newMatchForm.result}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, result: e.target.value }))}
                        className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-400">حالة البث:</label>
                      <select
                        value={newMatchForm.live ? "live" : "upcoming"}
                        onChange={(e) => setNewMatchForm(prev => ({ ...prev, live: e.target.value === "live" }))}
                        className="w-full bg-[#101014] border border-zinc-950 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550"
                      >
                        <option value="live">جاهز للبث (مباشر)</option>
                        <option value="upcoming">مجدولة لاحقاً</option>
                      </select>
                    </div>
                  </div>

                  {/* Stream URL */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-400">رابط البث الحي (إجباري لتشغيل المشاهدة):</label>
                    <textarea
                      rows={3}
                      placeholder="أدخل رابط البث (رابط مباشر أو iframe)..."
                      value={newMatchForm.streamUrl}
                      onChange={(e) => setNewMatchForm(prev => ({ ...prev, streamUrl: e.target.value }))}
                      className="w-full bg-[#101014] border border-zinc-900 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-550 font-mono text-left"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-zinc-900">
                  <button
                    onClick={handleSaveAddMatch}
                    className="flex-1 bg-gradient-to-r from-red-650 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-black text-xs py-3.5 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <span>تأكيد وجدولة البث 🚀</span>
                  </button>
                  <button
                    onClick={() => setShowAddMatchModal(false)}
                    className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SPORTS NEWS SECTION */}
        {sportsNews.length > 0 && (
          <div className="pt-8 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <h2 className="text-sm font-black text-white">آخر الأخبار الرياضية | حكايتنا 📰</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sportsNews.map((news, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenArticle(news.link)}
                  className="bg-zinc-950/40 border border-zinc-900/60 hover:border-red-600/40 rounded-2xl overflow-hidden group transition-all duration-300 flex flex-col justify-between text-right cursor-pointer"
                >
                  <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={news.img}
                      alt={news.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://yalla-sd.org/wp-content/uploads/2026/01/InShot_20260102_210059277-scaled-1-350x197.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-red-400 transition-colors line-clamp-2 leading-relaxed">
                      {news.title}
                    </h3>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                      <span>حكايتنا رياضة ⚡</span>
                      <span className="text-red-500 group-hover:underline">قراءة الخبر بالكامل 📖</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* IN-APP ARTICLE READER MODAL (NO EXTERNAL REDIRECTS) */}
        <AnimatePresence>
          {activeArticle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 font-sans overflow-y-auto"
            >
              <div 
                className="absolute inset-0" 
                onClick={() => setActiveArticle(null)}
              />

              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="relative bg-zinc-950 border border-zinc-900 rounded-[2.5rem] max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl z-10 my-auto text-right"
              >
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                  <span className="text-[10px] font-black text-red-500 bg-red-950/40 border border-red-500/20 px-3 py-1 rounded-full">
                    حكايتنا رياضة ⚡
                  </span>
                  <button
                    onClick={() => setActiveArticle(null)}
                    className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base md:text-lg font-black text-white leading-relaxed">
                    {activeArticle.title}
                  </h2>

                  {activeArticle.img && (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 shadow-md">
                      <img
                        src={activeArticle.img}
                        alt={activeArticle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://yalla-sd.org/wp-content/uploads/2026/01/InShot_20260103_114716968-scaled-1-630x300.jpg';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-3 pt-2 text-zinc-300 text-xs md:text-sm leading-relaxed">
                    {activeArticle.content.map((paragraph, pIdx) => (
                      <p key={pIdx} className="bg-zinc-900/30 p-3.5 rounded-2xl border border-zinc-850/50">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-900 flex justify-end">
                  <button
                    onClick={() => setActiveArticle(null)}
                    className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-6 py-3 rounded-2xl transition cursor-pointer active:scale-95"
                  >
                    إغلاق الخبر ✖️
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
