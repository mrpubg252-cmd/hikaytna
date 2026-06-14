import React, { useState, useEffect } from 'react';
import { Trophy, Tv, Calendar, RefreshCw, Play, X, Loader2, Sparkles, CheckCircle, Info, Flame } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
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
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<{ match: Match; iframeUrl: string } | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'cup'>('all');

  const fetchMatches = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/v1/matches/scrape'));
      const data = await res.json();
      if (data.status && Array.isArray(data.matches)) {
        setMatches(data.matches);
      } else {
        setError('تعذر تغذية البيانات الحية حالياً. يرجى المحاولة لاحقاً.');
      }
    } catch (err: any) {
      setError('خطأ في الاتصال بالخادم. تأكد من جودة اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    // Auto refresh every 90 seconds
    const interval = setInterval(() => fetchMatches(true), 90000);
    return () => clearInterval(interval);
  }, []);

  const handleWatchStream = async (match: Match, bypassAdGate = false) => {
    const params = new URLSearchParams(window.location.search);
    const isUnlocked = params.get('unlocked') === 'true' && params.get('matchId') === match.id;

    if (!isUnlocked && !bypassAdGate) {
      const currentOrigin = window.location.origin;
      const redirectPath = `${currentOrigin}/matches?matchId=${encodeURIComponent(match.id)}&unlocked=true`;
      window.location.href = `/ads?redirect=${encodeURIComponent(redirectPath)}`;
      return;
    }

    setLoadingStream(true);
    try {
      const res = await fetch(getApiUrl(`/api/v1/matches/stream?url=${encodeURIComponent(match.matchPageUrl)}`));
      const data = await res.json();
      if (data.status && data.iframeUrl) {
        setActiveStream({ match, iframeUrl: data.iframeUrl });
      } else {
        alert('رابط البث لهذه المباراة لم يتوفر بعد أو جاري تجهيزه من قبل الناقل.');
      }
    } catch (err) {
      alert('حدث خطأ أثناء جلب رابط البث. يرجى إعادة المحاولة.');
    } finally {
      setLoadingStream(false);
    }
  };

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

  // Filter & Search
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

  // Extract unique leagues
  const totalLiveCount = matches.filter(m => m.live).length;

  return (
    <div className="min-h-screen bg-black text-white pb-32 selection:bg-emerald-500 selection:text-black">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-24 space-y-8">
        {/* HERO BANNER SECTION */}
        <section className="relative rounded-[2.5rem] bg-gradient-to-br from-emerald-950/40 via-zinc-900/60 to-black border border-emerald-500/10 p-6 md:p-10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-amber-500/5 blur-[100px] rounded-full translate-y-1/3 -translate-x-1/3 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-right flex-1">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-black tracking-widest uppercase">
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                <span>أقوى مباريات كأس العالم والبطولات الكبرى بحجم البث الأصلي</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none">
                مباريات اليوم وبث مباشر <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-400">
                  بجودة HD فائقة الاستقرار 🔥
                </span>
              </h1>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-xl font-medium">
                تابع شعائر كرة القدم والنزالات الكروية بثوانيها الحقيقية. نسحب لك أقوى الروابط الحرة المستقرة لتستمتع بجودة خارقة من هاتفك أو حاسوبك فوراً ومجاناً بالكامل!
              </p>
            </div>
            
            <div className="relative shrink-0 flex items-center justify-center p-2">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-3xl bg-zinc-950 border border-white/5 flex items-center justify-center shadow-2xl">
                <Trophy className="w-16 h-16 md:w-20 md:h-20 text-amber-400 animate-bounce" />
              </div>
            </div>
          </div>
        </section>

        {/* CONTROLS AREA */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-4 rounded-3xl">
          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              كل المباريات ({matches.length})
            </button>
            <button
              onClick={() => setActiveFilter('live')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'live' 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 font-black' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white animate-ping" />
              مباشر الآن ({totalLiveCount})
            </button>
            <button
              onClick={() => setActiveFilter('cup')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'cup' 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              🏆 الكؤوس والبطولات الكبرى
            </button>
          </div>

          {/* Search Input & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="ابحث عن فريق، بطولة، قناة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-2 text-xs text-right text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-500 transition-colors"
              />
            </div>
            <button 
              onClick={() => fetchMatches(true)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* LOADING & ERROR LAYOUTS */}
        {loading && matches.length === 0 && (
          <div className="py-24 text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-emerald-500 animate-spin" />
              <Trophy className="absolute w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">جاري سحب المباريات الحية...</h3>
              <p className="text-zinc-550 text-xs">نقوم في الخلفية بالبحث عن أفضل خوادم بث المباراة يرجى الصبر ثوانٍ معدودة</p>
            </div>
          </div>
        )}

        {error && matches.length === 0 && (
          <div className="bg-red-950/20 border border-red-500/10 rounded-[2rem] p-8 text-center space-y-4 max-w-xl mx-auto">
            <Info className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-black text-white">خطأ في جلب المباريات</h3>
              <p className="text-sm text-zinc-500 mt-1">{error}</p>
            </div>
            <button 
              onClick={() => fetchMatches()}
              className="bg-red-500 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-red-400 active:scale-95 transition cursor-pointer"
            >
              إعادة المحاولة 🔄
            </button>
          </div>
        )}

        {/* MATCHES CARDS GRID */}
        {!loading && filteredMatches.length === 0 && (
          <div className="bg-zinc-900/10 border border-white/5 rounded-[2rem] p-12 text-center space-y-3">
            <Trophy className="w-12 h-12 text-zinc-700 mx-auto" />
            <h3 className="text-base font-black text-zinc-400">لا توجد مباريات مطابقة للبحث حالياً</h3>
            <p className="text-zinc-650 text-xs">يرجى التأكد من كتابة مسميات أخرى أو تصفح كل الأقسام بالأعلى.</p>
          </div>
        )}

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
                  className="relative bg-zinc-900/30 backdrop-blur-xl border border-white/5 hover:border-emerald-500/20 rounded-[2rem] p-6 transition-all duration-300 flex flex-col justify-between group overflow-hidden animate-fade-in"
                >
                  {/* Subtle Background Turf Ripple */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none" />

                  {/* Match header info */}
                  <div className="relative z-10 flex items-center justify-between text-xs mb-6">
                    <span className="font-black text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/15 py-1 px-3 rounded-full shrink-0">
                      🏆 {m.league}
                    </span>
                    {m.live ? (
                      <span className="flex items-center gap-1.5 font-bold text-red-400 bg-red-950/40 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        مباشر الآن
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-bold flex items-center gap-1 text-[10px] bg-zinc-950/40 px-2.5 py-1 rounded-full border border-white/5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500 animate-pulse" />
                        {m.statusText || m.time}
                      </span>
                    )}
                  </div>

                  {/* VS Teams Block */}
                  <div className="relative z-10 flex items-center justify-between gap-4 py-3">
                    {/* Team 1 */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="relative w-16 h-16 md:w-20 md:h-20 bg-black/60 border border-white/5 rounded-full p-3 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                        <img 
                          src={m.logo1 || 'https://via.placeholder.com/70?text=Logo'} 
                          alt={m.team1}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/70?text=No+Logo';
                          }}
                        />
                      </div>
                      <h4 className="text-sm md:text-base font-black truncate max-w-[130px] text-white">
                        {m.team1}
                      </h4>
                    </div>

                    {/* VS / Score Middle Badge */}
                    <div className="shrink-0 flex flex-col items-center justify-center space-y-1.5">
                      {m.result ? (
                        <span className="text-2xl md:text-3xl font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-2xl border border-emerald-500/20 font-mono shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                          {m.result}
                        </span>
                      ) : (
                        <span className="text-lg md:text-xl font-black text-amber-400 bg-amber-500/5 px-3.5 py-1.5 rounded-2xl border border-amber-500/10">
                          VS
                        </span>
                      )}
                      
                      {m.statusText && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          m.live 
                            ? 'text-red-400 bg-red-950/40 border-red-500/20 animate-pulse'
                            : m.statusText.includes("انتهت")
                            ? 'text-zinc-500 bg-zinc-950/40 border-white/5'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/10'
                        }`}>
                          {m.statusText}
                        </span>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="relative w-16 h-16 md:w-20 md:h-20 bg-black/60 border border-white/5 rounded-full p-3 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                        <img 
                          src={m.logo2 || 'https://via.placeholder.com/70?text=Logo'} 
                          alt={m.team2}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/70?text=No+Logo';
                          }}
                        />
                      </div>
                      <h4 className="text-sm md:text-base font-black truncate max-w-[130px] text-white">
                        {m.team2}
                      </h4>
                    </div>
                  </div>

                  {/* Bottom details & Play CTA */}
                  <div className="relative z-10 border-t border-white/5 pt-4 mt-6 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5 items-start">
                      <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-bold">
                        <Tv className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate max-w-[130px]">{m.channel}</span>
                      </div>
                      {m.commentator && m.commentator !== "غير معروف" && (
                        <span className="text-[10px] text-zinc-500 font-bold shrink-0">
                          🎙️ {m.commentator}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleWatchStream(m)}
                      disabled={loadingStream}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black py-2.5 px-6 rounded-2xl text-xs font-black flex items-center gap-2 transition duration-200 active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 animate-pop-in"
                    >
                      {loadingStream ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>شاهد البث</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SPORTS DECORATIVE BANNER */}
        <section className="bg-zinc-950/45 border border-white/5 rounded-[2.5rem] p-8 text-center text-xs md:text-sm text-zinc-400 leading-relaxed font-black max-w-4xl mx-auto space-y-3 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-amber-400 mb-2 relative z-10">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <p className="max-w-xl mx-auto relative z-10">
            البطولات منقولة بلحظتها وبمختلف معلقي العالم العربي! إذا واجهت ثقلاً في تحميل الفيديو، اضغط على زر تحسين السيرفرات لتهيئة خط اتصال احتياطي مستقر فوراً.
          </p>
        </section>

        {/* INTERACTIVE POPUP MODAL FOR EMBEDDED PLAYER */}
        <AnimatePresence>
          {activeStream && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6"
            >
              <div 
                className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 to-black pointer-events-none" 
                onClick={() => setActiveStream(null)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="relative bg-zinc-950 border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col justify-between overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.8)] z-10"
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h3 className="text-sm md:text-base font-black text-white ml-2">
                        {activeStream.match.team1} VS {activeStream.match.team2}
                      </h3>
                      <p className="text-[10px] text-emerald-400 font-bold mt-0.5">
                        🎥 بث مباشر مستقر • {activeStream.match.channel} • {activeStream.match.league}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveStream(null)}
                    className="p-2 hover:bg-white/5 rounded-full transition text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Video Iframe Container */}
                <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                  <iframe
                    src={activeStream.iframeUrl}
                    title="Live Stream"
                    className="w-full h-full border-none rounded-b-[1rem]"
                    allowFullScreen
                    scrolling="no"
                    allow="autoplay; encrypted-media"
                  />
                </div>

                {/* Modal Footer / Advice */}
                <div className="p-4 bg-zinc-900/40 border-t border-white/5 text-[10px] sm:text-xs text-zinc-500 font-extrabold flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-emerald-500">
                    <CheckCircle className="w-3.5 h-3.5 fill-emerald-500/10" />
                    تم التوصيل بخادم البث الآمن
                  </span>
                  <span>لأفضل دقة عرض وموثوقية، تأكد من استقرار الإنترنت لديك.</span>
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
