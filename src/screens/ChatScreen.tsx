import React from 'react';
import Header from '../components/Header';
import SeriesChat from '../components/SeriesChat';
import BottomNav from '../components/BottomNav';
import { motion } from 'motion/react';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function ChatScreen() {
  const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);

  const [viewportHeight, setViewportHeight] = React.useState('100dvh');

  React.useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };
    const handleBlur = () => setIsKeyboardOpen(false);

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    
    // iOS Visual Viewport fix
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        window.scrollTo(0, 0); // Prevent body scrolling away from the viewport bounds
      }
    };

    if (window.visualViewport) {
      handleResize();
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return (
    <div 
      className="fixed left-0 top-0 w-full bg-black text-white flex flex-col"
      style={{ height: viewportHeight }}
    >
      <Header />
      
      <main className={`flex-1 max-w-[1400px] mx-auto w-full px-0 sm:px-8 pt-1 sm:pt-2 ${isKeyboardOpen ? 'pb-0' : 'pb-[96px] sm:pb-28'} flex flex-col min-h-0`}>
        <div className="hidden sm:flex flex-col gap-0.5 sm:gap-2 mb-2 sm:mb-4 shrink-0 px-2">
          <div className="flex items-center gap-1.5 text-primary">
            <Sparkles className="w-3.5 h-3.5 fill-current sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] italic">شات</span>
          </div>
          <h1 className="text-xl sm:text-5xl font-black italic tracking-tighter">
            الدرد<span className="text-primary">شة المباشرة.</span>
          </h1>
        </div>

        <div className="flex-1 min-h-0 bg-zinc-900/20 border-0 sm:border border-white/5 rounded-none sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
          <SeriesChat 
            seriesId="global_chat_v1" 
            seriesTitle="شات" 
            isGlobal={true} 
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
