import React from 'react';
import Header from '../components/Header';
import SeriesChat from '../components/SeriesChat';
import BottomNav from '../components/BottomNav';

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
    
    // iOS & Android Visual Viewport dynamic resize fix
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        window.scrollTo(0, 0); // Prevent body scrolling away from viewport bounds
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
      className="fixed inset-0 w-full bg-black text-white flex flex-col overflow-hidden"
      style={{ height: viewportHeight }}
    >
      {/* Top Header visible on desktop screens, hidden on mobile & landscape to maximize chat viewport space */}
      <div className="hidden md:block shrink-0">
        <Header />
      </div>
      
      <main className={`flex-1 max-w-[1400px] mx-auto w-full px-0 sm:px-4 md:px-8 pt-0 sm:pt-2 ${isKeyboardOpen ? 'pb-0' : 'pb-[76px] sm:pb-[88px]'} flex flex-col min-h-0 h-full overflow-hidden`}>
        <div className="flex-1 min-h-0 bg-zinc-900/20 border-0 sm:border border-white/5 rounded-none sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-full">
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

