import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, User, X, Mic, Wand2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

import SettingsMenu from './SettingsMenu';
import AiChatDrawer from './AiChatDrawer';

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const navigate = useNavigate();
  const recognitionRef = useRef<any>(null);

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
            navigate(`/?q=${encodeURIComponent(transcript)}`);
            setIsSearchOpen(false);
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

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`);
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
            {/* Backdrop click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] cursor-pointer"
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 240 }}
              className="fixed inset-y-0 left-0 h-[100dvh] w-full sm:max-w-md bg-[#0a0a0f] border-r border-white/5 z-[160] shadow-2xl flex flex-col"
              dir="ltr"
            >
              <div className="flex-1 h-full flex flex-col" dir="rtl">
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
              className="w-full max-w-2xl text-center space-y-6 sm:space-y-8"
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
              <div className="relative group" onClick={(e) => e.stopPropagation()}>
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-orange-600/50 rounded-[40px] blur opacity-20 group-focus-within:opacity-40 transition-opacity"></div>
                <form 
                  onSubmit={handleSearch}
                  className="relative flex items-center bg-zinc-900/40 border border-white/10 rounded-[32px] p-2 transition-all group-focus-within:border-primary/50"
                >
                  <Search className="w-6 h-6 text-zinc-500 ml-6" />
                  <input
                    autoFocus
                    type="text"
                    dir="rtl"
                    placeholder="اسم المسلسل، البطل، أو النوع..."
                    className="flex-1 bg-transparent border-none outline-none text-white text-xl sm:text-4xl font-bold py-4 px-4 placeholder-zinc-700 italic font-sans"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceSearch}
                    className={`w-12 sm:w-16 h-12 sm:h-16 rounded-[24px] flex items-center justify-center transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-primary'}`}
                  >
                    <Mic className="w-6 h-6" />
                  </button>
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

              <div className="flex flex-wrap items-center justify-center gap-4 text-zinc-500 text-sm" onClick={(e) => e.stopPropagation()}>
                <span className="font-bold">مقترحات:</span>
                {['قيامة عثمان', 'المتوحش', 'طائر الرفراف', 'صلاح الدين'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => { setSearchQuery(tag); handleSearch(); }}
                    className="px-4 py-2 bg-white/5 rounded-full hover:bg-white/10 hover:text-white transition-all border border-white/5"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
