import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Moon, Sun, Monitor, 
  Palette, Shield, Info, Smartphone, Eye, Sparkles, Check, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDevice } from '../context/DeviceAndNavigationContext';

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(localStorage.getItem('reduceMotion') === 'true');
  const [mobileMode, setMobileMode] = useState(localStorage.getItem('mobileMode') === 'true');
  const [isStandalone, setIsStandalone] = useState(false);
  const { displayMode, setDisplayMode } = useDevice();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
    setIsStandalone(!!isStandaloneMode);
  }, []);

  useEffect(() => {
    // Lock app permanently to professional dark mode
    const root = window.document.documentElement;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    localStorage.setItem('theme', 'dark');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMotion = () => {
    const newState = !reduceMotion;
    setReduceMotion(newState);
    localStorage.setItem('reduceMotion', String(newState));
  };

  const toggleMobile = () => {
    const newState = !mobileMode;
    setMobileMode(newState);
    localStorage.setItem('mobileMode', String(newState));
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 text-zinc-400 hover:text-white group"
      >
        <SettingsIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full mt-3 right-0 w-80 bg-zinc-950/98 border border-white/10 rounded-3xl overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.6)] z-[110]"
          >
            <div className="p-6">
              <h3 className="text-sm font-black italic flex items-center gap-2 mb-6">
                <Sparkles className="w-4 h-4 text-primary" />
                تخصيص الواجهة
              </h3>

              <div className="space-y-6">
                {/* Device Display Scaling Options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                    <span>مقاس العرض وحجم شاشتك 📺</span>
                    <Monitor className="w-3 h-3" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'auto', label: 'تلقائي / كمبيوتر 💻' },
                      { id: 'mobile', label: 'شاشة جوال 📱' },
                      { id: 'ipad', label: 'شاشة آيباد / تابلت 📟' },
                      { id: 'sony', label: 'شاشة سوني / كونسول 🎮' },
                      { id: 'tv', label: 'شاشة تلفزيون ذكي 📺' },
                    ].map((opt) => (
                      <button 
                        key={opt.id}
                        type="button"
                        onClick={() => setDisplayMode(opt.id)}
                        className={`flex items-center justify-center p-2.5 rounded-xl border text-[10px] font-black tracking-tight leading-none text-center transition-all relative ${
                          displayMode === opt.id 
                            ? 'bg-primary/20 border-primary text-primary scale-[1.02] shadow-sm' 
                            : 'bg-black/30 border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {displayMode === opt.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-1 right-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                   <button 
                     onClick={toggleMobile}
                     className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                   >
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg transition-colors ${mobileMode ? 'bg-indigo-500/20 text-indigo-500' : 'bg-white/5 text-zinc-500'}`}>
                           <Smartphone className="w-4 h-4" />
                         </div>
                         <span className="text-xs font-black italic">نسخة الجوال المطورة</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${mobileMode ? 'bg-primary' : 'bg-zinc-800'}`}>
                        <motion.div 
                          animate={{ x: mobileMode ? 16 : 0 }}
                          className="absolute left-1 top-1 w-2 h-2 bg-black rounded-full shadow-sm" 
                        />
                      </div>
                   </button>

                   <button 
                     onClick={toggleMotion}
                     className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                   >
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg transition-colors ${reduceMotion ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-zinc-500'}`}>
                           <Eye className="w-4 h-4" />
                         </div>
                         <span className="text-xs font-black italic">تقليل المؤثرات</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${reduceMotion ? 'bg-primary' : 'bg-zinc-800'}`}>
                        <motion.div 
                          animate={{ x: reduceMotion ? 16 : 0 }}
                          className="absolute left-1 top-1 w-2 h-2 bg-black rounded-full shadow-sm" 
                        />
                      </div>
                   </button>
                </div>

                {/* Premium install/shortcut action */}
                {!isStandalone && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        window.dispatchEvent(new Event('trigger-install-wizard'));
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-red-950/20 to-zinc-900/65 border border-red-500/10 hover:border-red-500/30 hover:bg-red-950/10 text-right transition-all cursor-pointer group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 flex-row-reverse text-right">
                         <div className="p-2.5 rounded-xl bg-red-500/10 text-primary border border-red-500/20 group-hover:scale-110 transition-transform">
                           <Smartphone className="w-4 h-4" />
                         </div>
                         <div>
                           <span className="text-xs font-black text-white block">إضافة حكايتنا للشاشة</span>
                           <span className="text-[9px] text-zinc-500 block font-bold mt-0.5">ثبته كتطبيق مستقل أو كاختصار سريع</span>
                         </div>
                      </div>
                      <ArrowLeft className="w-3.5 h-3.5 text-zinc-500 group-hover:-translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                <div className="pt-2">
                   <div className="flex items-center justify-center gap-6 py-4 border-t border-white/5">
                      <button className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none">
                         <Shield className="w-3 h-3" />
                         الخصوصية
                      </button>
                      <button className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none">
                         <Info className="w-3 h-3" />
                         عن التطبيق
                      </button>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
