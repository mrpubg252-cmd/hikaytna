import React, { useState, useEffect } from 'react';
import { Trophy, Tv, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import MatchChat from '../components/MatchChat';
import { motion, AnimatePresence } from 'motion/react';
import CustomPlayer from '../components/CustomPlayer';
import { fetchPlayUrlFromAPI } from '../services/api';

export default function MatchesScreen() {
  const [activeStream, setActiveStream] = useState<{ title: string; matchId: string; iframeUrl: string; streamError?: boolean } | null>(null);
  const [loadingStream, setLoadingStream] = useState<string | null>(null); // matchId 'main'
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false);
  
  const MAIN_BROADCAST_URL = 'https://fh.alooytv12.xyz/world-cup-2026';

  const handleWatchStream = async (title: string, url: string, isMain: boolean = false, bypassAdGate = false) => {
    const params = new URLSearchParams(window.location.search);
    const identifier = isMain ? 'main' : encodeURIComponent(url);
    const isUnlocked = params.get('unlocked') === 'true' && params.get('matchId') === identifier;

    if (!isUnlocked && !bypassAdGate) {
      const currentOrigin = window.location.origin;
      const redirectPath = `${currentOrigin}/matches?matchId=${identifier}&unlocked=true`;
      window.location.href = `/gateway?redirect=${encodeURIComponent(redirectPath)}`;
      return;
    }

    setLoadingStream(identifier);
    try {
      const iframeUrl = await fetchPlayUrlFromAPI(url);
      if (iframeUrl) {
        setActiveStream({ title, matchId: identifier, iframeUrl, streamError: false });
      } else {
        setActiveStream({ title, matchId: identifier, iframeUrl: "", streamError: true });
      }
    } catch (err) {
      setActiveStream({ title, matchId: identifier, iframeUrl: "", streamError: true });
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
        handleWatchStream('كأس العالم 2026 - بث مباشر', MAIN_BROADCAST_URL, true, true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#070708] text-white pb-32 selection:bg-red-650 selection:text-white font-sans overflow-x-hidden">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 sm:pt-6 space-y-6">
        
        {/* WORLD CUP MAIN HERO BANNER */}
        <div className="relative group overflow-hidden rounded-[2.5rem] bg-zinc-950/40 border border-red-900/30 p-8 md:p-12 shadow-[0_10px_40px_rgba(220,38,38,0.1)] flex flex-col md:flex-row items-center justify-between gap-8 mt-2">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-red-900/5 mix-blend-overlay pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 flex-1 space-y-4 md:space-y-6 text-center md:text-right">
            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 leading-tight block">
              كأس العالم 2026
            </h1>
            <p className="text-zinc-400 text-sm md:text-base font-bold max-w-xl mx-auto md:mx-0">
              تابع البث المباشر لأكبر حدث رياضي. بث حصري ومستقر عالي الجودة لبطولة كأس العالم، متاح الآن على مدار الساعة.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleWatchStream('كأس العالم 2026 - بث مباشر', MAIN_BROADCAST_URL, true)}
              disabled={loadingStream === 'main'}
              className="mt-4 mx-auto md:mx-0 bg-gradient-to-l from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 text-white px-8 py-4 rounded-2xl font-black text-sm md:text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)] transition-all cursor-pointer w-full md:w-auto"
            >
              {loadingStream === 'main' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Tv className="w-5 h-5 animate-pulse" />
              )}
              شاهد البث المباشر الآن
            </motion.button>
          </div>
          
          {/* Trophy Graphic */}
          <div className="relative z-10 w-48 h-48 md:w-64 md:h-64 flex-shrink-0 transition flex justify-center items-center">
            <div className="absolute inset-0 bg-red-500/20 blur-[60px] rounded-full" />
            <Trophy className="w-full h-full text-zinc-100 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse will-change-transform" />
          </div>
        </div>

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
                className="absolute inset-0 bg-gradient-to-b from-red-950/10 to-[#000000] pointer-events-none" 
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
                        {activeStream.title}
                      </h3>
                      <p className="text-[10px] text-zinc-400 font-bold mt-0.5">
                        البث المباشر يعمل بأعلى جودة ممكنة
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
                      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-full bg-red-950/15 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                          <AlertCircle className="w-8 h-8 animate-bounce" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-black text-white">بث اللقاء غير متوفر حالياً</h4>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            البث المباشر لهذا الرابط غير متاح حالياً. يرجى الانتظار والمحاولة مرة أخرى بعد قليل.
                          </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-2">
                          <button
                            onClick={() => setActiveStream(null)}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-extrabold text-[10px] px-5 py-2.5 rounded-xl transition cursor-pointer"
                          >
                            رجوع
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full relative">
                        <CustomPlayer
                          videoUrl={activeStream.iframeUrl}
                          seriesId={activeStream.matchId}
                          seriesImage=""
                          episodeIndex={0}
                          episodes={[{ title: activeStream.title, url: activeStream.iframeUrl, link1: activeStream.iframeUrl, link2: '', link3: '' }]}
                          servers={[{ name: 'المصدر الرئيسي', url: activeStream.iframeUrl }]}
                          onSelectEpisode={() => {}}
                          onSelectServer={() => {}}
                          isMaximized={isPlayerMaximized}
                          onToggleMaximize={() => setIsPlayerMaximized(!isPlayerMaximized)}
                          seriesCategory="Matches"
                          seriesTitle={activeStream.title}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Box (Col span 1) - Real-time match Chat Room */}
                  <div className="lg:col-span-1 h-[420px] lg:h-full flex flex-col">
                    <MatchChat 
                      matchId={activeStream.matchId} 
                      matchTitle={activeStream.title} 
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-3.5 bg-[#0b0b0d] border-t border-zinc-900 text-[10px] text-zinc-550 font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <CheckCircle className="w-3.5 h-3.5 fill-zinc-500/10 text-zinc-500" />
                    مشغل مدمج عالي الكفاءة
                  </span>
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