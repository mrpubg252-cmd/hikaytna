import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, User, X, Mic, Wand2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

import SettingsMenu from './SettingsMenu';
import AiChatDrawer from './AiChatDrawer';

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  // Multi-resilient dynamic mobile visual viewport resize listener (fixes keyboard cut-off on Chrome/Safari mobile platforms)
  useEffect(() => {
    if (!isAiOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight(`${window.innerHeight}px`);
      }
    };

    // Prevent body background scroll while chat drawer is actively open
    document.body.style.overflow = 'hidden';

    if (window.visualViewport) {
      handleResize();
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.body.style.overflow = '';
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isAiOpen]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      } else {
        setRecentSearches(['قيامة عثمان', 'المتوحش', 'طائر الرفراف', 'صلاح الدين']);
      }
    } catch (e) {
      console.warn("Failed to load search history", e);
    }
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      window.dispatchEvent(new Event('search-opened'));
    } else {
      window.dispatchEvent(new Event('search-closed'));
    }
    return () => {
      window.dispatchEvent(new Event('search-closed'));
    };
  }, [isSearchOpen]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'ar-SA';
      recognitionRef.current.continuous = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsListening(false);
        // Auto search after voice
        setTimeout(() => {
          if (transcript.trim()) {
            handleSearch(undefined, transcript);
          }
        }, 800);
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, [navigate]);

  const toggleVoiceSearch = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setSearchQuery('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSearch = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSearch = (customQuery !== undefined ? customQuery : searchQuery).trim();
    if (queryToSearch) {
      setRecentSearches(prev => {
        const filtered = prev.filter(item => item.toLowerCase().trim() !== queryToSearch.toLowerCase().trim());
        const next = [queryToSearch, ...filtered].slice(0, 5);
        try {
          localStorage.setItem('recent_searches', JSON.stringify(next));
        } catch (err) {
          console.warn("Failed to save search history", err);
        }
        return next;
      });

      navigate(`/?q=${encodeURIComponent(queryToSearch)}`);
      setIsSearchOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
            <SettingsMenu />
          </div>

        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <div className="text-primary text-xl sm:text-3xl font-black italic tracking-tighter uppercase">حكايتنا</div>
        </Link>
        
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-4">
             <button 
                onClick={() => setIsAiOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 cursor-pointer relative group"
                title="ذكاء اصطناعي (حكيم)"
              >
                <Wand2 className="w-4 h-4 text-primary group-hover:scale-110 transition-all" />
                <span className="absolute -top-0.5 -left-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              </button>
             <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-zinc-400 hover:text-primary transition-all border border-white/5"
              >
                <Search className="w-5 h-5" />
              </button>
            <Link to="/chat" className="p-1.5 sm:p-2 text-zinc-400 hover:text-primary transition-colors hidden sm:block">
              <MessageSquare className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

       {/* Modern Slide-over AI Assistant Chat Panel */}
      <AnimatePresence>
        {isAiOpen && (
          <>
            {/* Backdrop click to close - remains beautifully visible with a 15% width tap-to-close safe zone on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[150] cursor-pointer"
            />
            
            {/* Drawer Container (Optimized with responsive width to expose tap-to-close overlay zone, plus real-time iOS/Android visual viewport height adaptation) */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 w-[85%] sm:w-[420px] bg-[#0a0a0f] border-r border-white/5 z-[155] sm:z-[160] shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
              style={{ height: viewportHeight }}
              dir="ltr"
            >
              <div className="flex-1 h-full flex flex-col overflow-hidden" dir="rtl">
                <AiChatDrawer onClose={() => setIsAiOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Prominent Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSearchOpen(false)}
            className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-start p-4 pt-4 sm:p-12 sm:pt-10 overflow-y-auto w-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl text-center space-y-6 sm:space-y-8 px-1 sm:px-0"
            >
              {/* Back Bar aligned correctly with text instructions and close button */}
              <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-4 group" onClick={(e) => e.stopPropagation()}>
                <div className="text-zinc-500 text-[10px] sm:text-xs font-black">اضغط في أي مكان فارغ بالخلفية للرجوع</div>
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all border border-white/10 hover:border-white/20 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Search Bar at the Very Top */}
              <div className="relative group w-full" onClick={(e) => e.stopPropagation()}>
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-orange-600/30 rounded-2xl blur opacity-25 group-focus-within:opacity-45 transition-opacity"></div>
                <form 
                  onSubmit={handleSearch}
                  className="relative flex items-center justify-between gap-1.5 bg-[#09090f] border border-white/10 rounded-2xl p-1 sm:p-1.5 focus-within:border-primary/50 transition-all duration-300 w-full overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-zinc-500 mx-1.5 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      dir="rtl"
                      placeholder="اسم المسلسل، البطل، أو النوع..."
                      className="w-full bg-transparent border-none outline-none text-white text-xs sm:text-base font-bold py-2 placeholder-zinc-600 font-sans text-right"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 px-1">
                    {searchQuery.trim() !== "" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 active:scale-90 text-zinc-400 hover:text-white transition-all cursor-pointer border border-white/5"
                          title="تفريغ خانة البحث"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          className="h-8 sm:h-10 px-2.5 sm:px-4 rounded-xl bg-red-650 hover:bg-red-600 active:scale-95 font-black text-white text-[11px] sm:text-sm flex items-center gap-1 sm:gap-1.5 transition-all shadow-lg shadow-red-650/10 cursor-pointer"
                        >
                          <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>بحث</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={toggleVoiceSearch}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
                          isListening 
                            ? 'bg-red-600 text-white animate-pulse' 
                            : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-primary border border-white/5'
                        }`}
                        title="بحث صوتي"
                      >
                        <Mic className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* 2. Brand badge and instructions underneath search bar */}
              <div className="flex flex-col items-center gap-2 sm:gap-3 select-none" onClick={(e) => e.stopPropagation()}>
                {/* Brand Spotlight Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-black animate-pulse">
                  <Wand2 className="w-3.5 h-3.5 fill-current" />
                  <span>محرك البحث والترشيحات الذكية</span>
                </span>
                
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight drop-shadow-xl">
                  ابحث عن <span className="bg-gradient-to-r from-primary via-orange-500 to-yellow-500 bg-clip-text text-transparent">مسلسلك المفضل</span>
                </h2>
                
                <p className="text-[10px] sm:text-xs text-zinc-400 font-bold max-w-md mx-auto leading-relaxed px-4">
                  اكتب اسم المسلسل، البطل، أو الكلمات الرئيسية، وسنقوم بالترشيح لك فوراً
                </p>
              </div>

              {isListening && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 py-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-2 h-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, 32, 8] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                        className="w-1.5 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-primary font-black italic uppercase tracking-widest">جاري الاستماع...</span>
                </motion.div>
              )}

              <div className="flex flex-col items-center gap-4 w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-zinc-500 text-sm">
                  <span className="font-bold text-zinc-400">آخر عمليات البحث:</span>
                  {recentSearches.map((tag, idx) => (
                    <button 
                      key={tag + '_' + idx}
                      onClick={() => { setSearchQuery(tag); handleSearch(undefined, tag); }}
                      className="px-4 py-2 bg-white/5 rounded-full hover:bg-white/10 hover:text-white hover:border-primary/50 text-zinc-300 font-bold text-sm transition-all border border-white/5 active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {recentSearches.length > 0 && (
                  <button 
                    onClick={() => {
                      try {
                        localStorage.removeItem('recent_searches');
                        setRecentSearches([]);
                      } catch (err) {}
                    }}
                    className="text-xs text-zinc-600 hover:text-red-500 transition-colors cursor-pointer font-bold underline"
                  >
                    مسح السجل
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
