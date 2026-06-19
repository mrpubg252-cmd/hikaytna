import React, { useState, useEffect } from 'react';
import { Trophy, Tv, Calendar, RefreshCw, Play, X, Loader2, Sparkles, CheckCircle, Info, Flame, AlertCircle, MessageSquare } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import MatchChat from '../components/MatchChat';
import { motion, AnimatePresence } from 'motion/react';
import { getApiUrl } from '../lib/apiConfig';

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
  const [activeStream, setActiveStream] = useState<{ match: Match; iframeUrl: string; streamError?: boolean } | null>(null);
  const [loadingStream, setLoadingStream] = useState<string | null>(null); // match ID of the clicked stream
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'cup'>('all');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Helper to determine if a match has ended
  const isMatchEnded = (m: Match) => {
    if (m.ended) return true;
    const txt = (m.statusText || '').trim();
    if (txt.includes('انتهت') || txt.includes('انتهي') || txt.includes('منتهية')) return true;
    if (!m.live && m.result && m.result.trim() !== '' && m.result.trim() !== '-') return true;
    return false;
  };

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

  const fetchMatches = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/v1/matches/scrape'));
      const data = await res.json();
      if (data.status && Array.isArray(data.matches)) {
        setMatches(data.matches);
      } else {
        setError('لا يوجد خوادم بث حي نشطة حالياً. يرجى المتابعة لاحقاً.');
      }
    } catch (err: any) {
      setError('خطأ في الاتصال بالخادم الرئيسي لقنوات البث. يرجى التحديث.');
    } finally {
      setLoading(false);
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

  const totalLiveCount = matches.filter(m => m.live).length;

  return (
    <div className="min-h-screen bg-[#070708] text-white pb-32 selection:bg-red-650 selection:text-white font-sans">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 sm:pt-6 space-y-6">
        
        {/* CLEAN TABLE/GRID HEADER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/40 border border-zinc-900/60 p-5 rounded-[2rem] shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
            <h1 className="text-base font-black text-white">جدول مباريات اليوم</h1>
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
        {!loading && filteredMatches.length === 0 && (
          <div className="bg-[#0b0b0d] border border-zinc-900 rounded-[2rem] p-16 text-center space-y-3 shadow-md max-w-2xl mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500/20 mx-auto animate-bounce" />
            <h3 className="text-sm font-black text-zinc-300">لا يوجد بث للمباريات حالياً</h3>
            <p className="text-zinc-550 text-[10px] max-w-lg mx-auto">
              تظهر هنا روابط وبث المباراة فور انطلاق اللقاءات المقررة. لا توجد مواجهات مطابقة لشروط الفرز الحالية. يرجى تصفح فئات أخرى.
            </p>
          </div>
        )}

        {/* MATCHES LIST / CARDS */}
        <AnimatePresence mode="popLayout">
          {filteredMatches.length > 0 && (
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {filteredMatches.map((m, index) => (
                <motion.div
                  key={m.id || index}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="relative bg-zinc-950/40 border border-zinc-900/60 hover:border-red-950 rounded-[2rem] p-6 transition-all duration-300 flex flex-col justify-between group overflow-hidden"
                >
                  {/* Subtle Background Red Ripple Accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-red-600/10 transition-colors" />

                  {/* Match Header */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] mb-6">
                    <span className="font-black text-zinc-300 bg-zinc-900/60 border border-zinc-850 py-1.5 px-3.5 rounded-full shrink-0">
                      🏆 {m.league}
                    </span>
                    {m.live ? (
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
                      
                      {m.statusText && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                          m.live 
                            ? 'text-red-400 bg-red-950/40 border-red-500/20 animate-pulse'
                            : 'text-zinc-500 bg-zinc-900/50 border-zinc-850'
                        }`}>
                          {m.statusText}
                        </span>
                      )}
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
                      <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold">
                        <Tv className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate max-w-[120px]">{m.channel || 'بث مباشر'}</span>
                      </div>
                      {m.commentator && m.commentator !== "غير معروف" && (
                        <span className="text-[10px] text-zinc-500 font-bold shrink-0">
                          🎙️ {m.commentator}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => m.live && handleWatchStream(m)}
                      disabled={loadingStream !== null || !m.live}
                      className={`py-2.5 px-6 rounded-2xl text-[11px] font-black flex items-center gap-2 transition duration-250 shrink-0 ${
                        m.live 
                          ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-600/10 hover:shadow-red-600/25 active:scale-95" 
                          : "bg-zinc-950 border border-zinc-900 text-zinc-505 cursor-not-allowed"
                      }`}
                    >
                      {loadingStream === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Play className={`w-3.5 h-3.5 ${m.live ? 'fill-current text-white' : 'text-zinc-750'}`} />
                      )}
                      <span>
                        {m.live 
                          ? "شاهد المباراة والدردشة" 
                          : isMatchEnded(m)
                            ? "انتهت المباراة" 
                            : "لم تبدأ بعد"}
                      </span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* DETAILED WATCH GAME WITH CHAT MODAL INTERFACE */}
        <AnimatePresence>
          {activeStream && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-[#020202]/98 backdrop-blur-2xl flex items-center justify-center p-3 md:p-6"
            >
              <div 
                className="absolute inset-0 bg-gradient-to-b from-red-950/5 to-[#000000] pointer-events-none" 
                onClick={() => setActiveStream(null)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="relative bg-[#09090b] border border-zinc-900 rounded-[2rem] w-full max-w-6xl max-h-[95vh] flex flex-col justify-between overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.95)] z-10"
              >
                {/* Modal Header */}
                <div className="p-4 md:p-5 border-b border-zinc-900 flex items-center justify-between gap-4 shrink-0 bg-zinc-950/60">
                  <div className="flex items-center gap-3 text-right">
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                      <Tv className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs md:text-sm font-black text-white">
                        {activeStream.match.team1} ضد {activeStream.match.team2}
                      </h3>
                      <p className="text-[10px] text-red-500 font-bold mt-0.5">
                        {activeStream.match.league} • القناة الناقلة: {activeStream.match.channel}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveStream(null)}
                    className="p-2 hover:bg-zinc-900 rounded-full transition text-zinc-400 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Shared Grid Area: Left is Player / Error view, Right is Chat */}
                <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 lg:grid-cols-3 h-full min-h-0 bg-black">
                  
                  {/* Left Box (Cols span 2) - Video Embed or Failure Screen */}
                  <div className="lg:col-span-2 relative aspect-video lg:aspect-auto w-full min-h-[220px] md:min-h-[420px] bg-black flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-l border-zinc-900">
                    {activeStream.streamError ? (
                      /* LUXURY STREAM ABSENT CARD (REPLACES ALERT DIALOG) */
                      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-full bg-red-950/15 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                          <AlertCircle className="w-8 h-8 animate-bounce" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-black text-white">بث اللقاء غير متوفر حالياً</h4>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            البث المباشر لهذه المباراة لم يبدأ من المصدر بعد، أو أن السيرفرات الناقلة تخضع للتجهيز حالياً. يرجى الانتظار والمحاولة مع انطلاق صافرة البداية.
                          </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-2">
                          <button
                            onClick={() => handleWatchStream(activeStream.match, true)}
                            className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] px-5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer"
                          >
                            تثبيت الاتصال بالبث 🔄
                          </button>
                          <button
                            onClick={() => setActiveStream(null)}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-extrabold text-[10px] px-5 py-2.5 rounded-xl transition cursor-pointer"
                          >
                            رجوع
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Embed Stream Frame output */
                      <iframe
                        src={activeStream.iframeUrl}
                        title="Live Match Player"
                        className="w-full h-full border-none bg-black"
                        allowFullScreen
                        scrolling="no"
                        allow="autoplay; encrypted-media"
                      />
                    )}
                  </div>

                  {/* Right Box (Col span 1) - Real-time match Chat Room */}
                  <div className="lg:col-span-1 h-[420px] lg:h-full flex flex-col">
                    <MatchChat 
                      matchId={activeStream.match.id} 
                      matchTitle={`${activeStream.match.team1} VS ${activeStream.match.team2}`} 
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-3.5 bg-[#0b0b0d] border-t border-zinc-900 text-[10px] text-zinc-550 font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 text-red-500">
                    <CheckCircle className="w-3.5 h-3.5 fill-red-500/10" />
                    خادم البث آمن وبجودة تلقائية متعددة الاستقرار
                  </span>
                  <span>الدردشة تخضع للرقابة التلقائية المباشرة، التزم بالتشجيع النظيف 💬</span>
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
