import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Cookie, Check, X } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already expressed consent in this browser
    const consent = localStorage.getItem('hek_cookie_consent');
    if (!consent) {
      // Small graceful delay to let other animations settle first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('hek_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('hek_cookie_consent', 'declined');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-50 overflow-hidden"
          id="cookie-consent-container"
        >
          {/* Main Premium Card */}
          <div className="relative p-5 rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 flex flex-col gap-4 text-right">
            {/* Glow Accent */}
            <div className="absolute top-0 right-1/4 w-32 h-10 bg-primary/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header / Info Section */}
            <div className="flex items-start gap-3.5 flex-row-reverse">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-white text-xs sm:text-sm font-black flex items-center gap-1.5 justify-end">
                  <span>خصوصيتك تهمنا</span>
                  <Shield className="w-3.5 h-3.5 text-primary" />
                </h4>
                <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed font-bold">
                  نحن نستخدم ملفات تعريف الارتباط لضمان تقديم أروع وأسرع تجربة تصفح لك. لك كامل الحرية في قبولها أو إلغائها في أي وقت.
                </p>
              </div>
            </div>

            {/* Response Actions */}
            <div className="flex items-center gap-2 flex-row-reverse">
              <button
                onClick={handleAccept}
                className="flex-1 py-2 px-4 rounded-xl bg-white text-black text-[11px] font-black hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                id="btn-cookie-accept"
              >
                <Check className="w-3.5 h-3.5" />
                <span>موافق، قبول</span>
              </button>
              
              <button
                onClick={handleDecline}
                className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] font-bold border border-white/5 hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
                id="btn-cookie-decline"
              >
                <X className="w-3 h-3" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
