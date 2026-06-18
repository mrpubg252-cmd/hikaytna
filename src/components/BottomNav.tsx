import React from 'react';
import { Home, MessageSquare, User, Film, Trophy, Gamepad2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;

  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsSearchOpen(true);
    const handleClose = () => setIsSearchOpen(false);
    
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };
    
    const handleBlur = () => {
      setIsKeyboardOpen(false);
    };

    window.addEventListener('search-opened', handleOpen);
    window.addEventListener('search-closed', handleClose);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    
    return () => {
      window.removeEventListener('search-opened', handleOpen);
      window.removeEventListener('search-closed', handleClose);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  if (isSearchOpen || isKeyboardOpen) return null;

  const tabs = [
    { id: 'chat', icon: MessageSquare, path: '/chat', label: 'الدردشة' },
    { id: 'shorts', icon: Film, path: '/shorts', label: 'الشورتس' },
    { id: 'games', icon: Gamepad2, path: '/games', label: 'الألعاب' },
    { id: 'home', icon: Home, path: '/', label: 'الرئيسية' },
    { id: 'matches', icon: Trophy, path: '/matches', label: 'المباريات' },
    { 
      id: 'profile', 
      icon: User, 
      path: '/profile', 
      label: user ? user.firstName || user.username || 'حسابي' : 'حسابي',
      isProfile: true 
    },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[100]">
      <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path;
          return (
            <Link 
              key={tab.id}
              to={tab.path}
              className="relative flex-1 py-3 group"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  {tab.isProfile && user ? (
                    <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all duration-300 ${isActive ? 'border-primary scale-110 shadow-[0_0_10px_rgba(229,9,20,0.5)]' : 'border-zinc-700'}`}>
                      <img src={user.imageUrl || ''} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <tab.icon 
                      className={`w-6 h-6 transition-all duration-300 ${
                        isActive ? 'text-primary scale-110' : 'text-zinc-500 group-hover:text-zinc-300'
                      }`} 
                    />
                  )}
                  {isActive && !tab.isProfile && (
                    <motion.div 
                      layoutId="activeTabIcon"
                      className="absolute -inset-2 bg-primary/10 rounded-xl -z-10 blur-sm"
                    />
                  )}
                </div>
                <span className={`text-[9px] font-black italic uppercase tracking-widest transition-colors duration-300 truncate max-w-[60px] text-center ${
                  isActive ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'
                }`}>
                  {tab.label}
                </span>
              </div>
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(229,9,20,0.5)]"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
