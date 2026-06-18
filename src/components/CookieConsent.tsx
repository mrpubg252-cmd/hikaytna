import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Check, X, Flame } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a preference
    const consent = localStorage.getItem('cookie_consent_choice');
    if (!consent) {
      // Small delay on mount for elite pacing
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (accepted: boolean) => {
    localStorage.setItem('cookie_consent_choice', accepted ? 'accepted' : 'rejected');
    if (accepted) {
      // Activating high-speed client optimizations block
      localStorage.setItem('high_speed_cache_enabled', 'true');
    }
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-32 sm:bottom-28 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto w-auto sm:w-[480px] z-[99999] bg-[#0c0c14]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
          dir="rtl"
        >
          <div className="space-y-4">
            {/* Header Title with animated glowing badges */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-650/10 text-primary rounded-2xl border border-primary/20 shrink-0 shadow-[0_0_15px_rgba(229,9,20,0.2)]">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white italic tracking-tight">تحسين سرعة التصفح والبث الفائق ⚡</h4>
                <p className="text-[10px] text-primary/80 font-bold uppercase tracking-wider">ملفات تعريف الارتباط وتجربة المستخدم</p>
              </div>
              <button 
                onClick={() => handleChoice(false)}
                className="mr-auto w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer border border-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description Text */}
            <div className="text-right">
              <p className="text-xs text-zinc-300 leading-relaxed font-bold">
                نستخدم ملفات الارتباط الذكية والتخزين المحلي لتقليص زمن معالجة الصفحات بنسبة <span className="text-primary font-black">75%</span>. 
                فهي تساعد على تسريع فتح مقاطع الشورتس والحلقات وتحميل سيرفرات المشاهدة فائق السرعة، وفتح المنصة فورياً في زيارتك القادمة.
              </p>
            </div>

            {/* Benefits Row */}
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3">
                <div className="text-[10px] font-black text-white mb-0.5">⏱️ تنزيل فوري للحلقات</div>
                <div className="text-[9px] text-zinc-500 font-bold">تخزين عناوين البث محلياً</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3">
                <div className="text-[10px] font-black text-white mb-0.5">💬 استمرارية الجلسة</div>
                <div className="text-[9px] text-zinc-500 font-bold">بقاء اسمك ودردشتك نشطين</div>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleChoice(true)}
                className="flex-1 py-3.5 px-4 bg-primary hover:bg-red-650 text-white rounded-2xl font-black text-xs transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تفعيل التجربة الفائقة (موصى به)</span>
              </button>
              
              <button
                onClick={() => handleChoice(false)}
                className="py-3.5 px-4 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/5 rounded-2xl font-black text-xs transition-all active:scale-95 cursor-pointer"
              >
                رفض الحفظ
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
