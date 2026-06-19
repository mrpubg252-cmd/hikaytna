import React, { useState, useEffect } from 'react';
import { Trophy, Tv, Play, X, Loader2, Sparkles, AlertCircle, Info, Calendar } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { fetchEpisodesFromAPI, fetchPlayUrlFromAPI } from '../services/api';

interface MatchEpisode {
  title: string;
  url: string;
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<MatchEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeStream, setActiveStream] = useState<{ title: string; iframeUrl: string; streamError?: boolean } | null>(null);
  const [loadingStream, setLoadingStream] = useState<string | null>(null); // url or 'main'
  
  const MAIN_BROADCAST_URL = 'https://fh.alooytv12.xyz/world-cup-2026';
  const MATCHES_URL = 'https://fh.alooytv12.xyz/watch/fifa-2026.html';

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const episodes = await fetchEpisodesFromAPI(MATCHES_URL);
        if (episodes && episodes.length > 0) {
          setMatches(episodes);
        } else {
          setError('لم يتم العثور على مباريات مسجلة حالياً.');
        }
      } catch (err: any) {
        setError('خطأ في الاتصال بخادم بيانات المباريات.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatches();
  }, []);

  const handleWatchStream = async (title: string, url: string, isMain: boolean = false, bypassAdGate = false) => {
    const params = new URLSearchParams(window.location.search);
    const identifier = isMain ? 'main' : encodeURIComponent(title);
    const isUnlocked = params.get('unlocked') === 'true' && params.get('matchId') === identifier;

    if (!isUnlocked && !bypassAdGate) {
      const currentOrigin = window.location.origin;
      const redirectPath = `${currentOrigin}/matches?matchId=${identifier}&unlocked=true`;
      window.location.href = `/gateway?redirect=${encodeURIComponent(redirectPath)}`;
      return;
    }

    setLoadingStream(isMain ? 'main' : url);
    try {
      const iframeUrl = await fetchPlayUrlFromAPI(url);
      if (iframeUrl) {
        setActiveStream({ title, iframeUrl, streamError: false });
      } else {
        setActiveStream({ title, iframeUrl: "", streamError: true });
      }
    } catch (err) {
      setActiveStream({ title, iframeUrl: "", streamError: true });
    } finally {
      setLoadingStream(null);
    }
  };

  // Watch Screen Ad Redirect Callback Handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('matchId');
    const unlocked = params.get('unlocked');
    
    if (matchId && unlocked === 'true') {
      if (matchId === 'main') {
        handleWatchStream('بث مباشر - كأس العالم 2026', MAIN_BROADCAST_URL, true, true);
      } else {
        const decodedTitle = decodeURIComponent(matchId);
        const targetMatch = matches.find(m => m.title === decodedTitle);
        if (targetMatch) {
          handleWatchStream(targetMatch.title, targetMatch.url, false, true);
        } else if (matches.length > 0) {
          // If we have matches but didn't find the target, maybe the title doesn't match perfectly.
          // Handle this edge case gracefully if needed.
        }
      }
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [matches, window.location.search]);

  return (
    <div className="min-h-screen bg-[#070708] text-white pb-32 selection:bg-amber-600 selection:text-white font-sans">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 sm:pt-6 space-y-8">
        
        {/* MATCHES LIST */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-zinc-900 pb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-black">المباريات</h2>
            </div>
            <p className="text-sm text-zinc-400 font-bold">مباريات منتهية - ملخص كامل</p>
          </div>

          {loading ? (
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-[2rem] py-24 text-center space-y-4 shadow-sm">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-amber-600 animate-spin" />
              </div>
              <h3 className="text-xs font-black text-white">جاري تحميل المباريات...</h3>
            </div>
          ) : error ? (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-[2rem] p-8 text-center space-y-4 max-w-xl mx-auto">
              <Info className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-sm font-black text-white">{error}</h3>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-[#0b0b0d] border border-zinc-900 rounded-[2rem] p-16 text-center space-y-3 shadow-md max-w-2xl mx-auto">
              <AlertCircle className="w-12 h-12 text-zinc-500 mx-auto" />
              <h3 className="text-sm font-black text-zinc-300">لا توجد مباريات مسجلة</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {matches.map((match, index) => {
                  const isLoading = loadingStream === match.url;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      onClick={() => !isLoading && handleWatchStream(match.title, match.url, false)}
                      className="group flex items-center justify-between gap-4 bg-zinc-950/40 hover:bg-zinc-900/80 border border-zinc-900/60 hover:border-amber-900/50 rounded-2xl p-5 cursor-pointer transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 flex-1 overflow-hidden">
                        <div className="w-12 h-12 rounded-xl bg-amber-950/30 border border-amber-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <Play className="w-5 h-5 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)] ml-1" />
                        </div>
                        <h4 className="text-sm font-black text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                          {match.title}
                        </h4>
                      </div>
                      
                      <div className="shrink-0 text-zinc-600">
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        ) : (
                          <Tv className="w-5 h-5 group-hover:text-amber-500 transition-colors" />
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* DETAILED WATCH GAME EVENT MODAL INTERFACE */}
        <AnimatePresence>
          {activeStream && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-[#020202]/98 backdrop-blur-2xl flex items-center justify-center p-3 md:p-6"
            >
              <div 
                className="absolute inset-0 bg-gradient-to-b from-amber-950/5 to-[#000000] pointer-events-none" 
                onClick={() => setActiveStream(null)}
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="relative bg-[#09090b] border border-amber-900/30 rounded-[2rem] w-full max-w-5xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10"
              >
                {/* Modal Header */}
                <div className="p-4 md:p-5 border-b border-zinc-900 flex items-center justify-between gap-4 bg-zinc-950/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                      <Tv className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm md:text-base font-black text-white">
                      {activeStream.title}
                    </h3>
                  </div>

                  <button 
                    onClick={() => setActiveStream(null)}
                    className="p-2 hover:bg-zinc-900 rounded-full transition text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Stream Embed */}
                <div className="relative aspect-video w-full bg-black flex flex-col items-center justify-center">
                  {activeStream.streamError ? (
                    <div className="p-8 text-center space-y-4 max-w-md mx-auto">
                      <div className="w-14 h-14 rounded-full bg-red-950/15 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                        <AlertCircle className="w-8 h-8 animate-bounce" />
                      </div>
                      <h4 className="text-sm font-black text-white">البث غير متوفر حالياً</h4>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        قد يكون هذا البث قد انتهى أو غير متاح في الوقت الحالي. يرجى العودة لاحقاً.
                      </p>
                    </div>
                  ) : (
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
