import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Info, ExternalLink, X, Shield, Sparkles } from 'lucide-react';

// Highly optimized, lightweight, responsive PayPal vector icon (SVG)
function PayPalIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fill="#0070ba"
        d="M20.015 6.779c-.218 2.628-1.921 4.382-4.394 4.382h-1.72c-.43 0-.802.314-.876.74l-.904 5.234c-.041.238-.244.41-.485.41h-2.583a.453.453 0 0 1-.448-.528l2.548-14.775a.453.453 0 0 1 .448-.376H16.03c1.7 0 2.95.36 3.66 1.1s.89 1.83.5 3.32a6.386 6.386 0 0 1-.175.493z"
      />
      <path
        fill="#1546a1"
        d="M17.15 10.379c-.218 2.628-1.921 4.382-4.394 4.382H11.04c-.43 0-.802.314-.876.74l-.904 5.234c-.041.238-.244.41-.485.41H6.188a.453.453 0 0 1-.448-.528L8.288 5.842a.453.453 0 0 1 .448-.376H13.17c1.7 0 2.95.36 3.66 1.1s.89 1.83.5 3.32a6.386 6.386 0 0 1-.18.493z"
        opacity="0.85"
      />
    </svg>
  );
}

export default function Footer() {
  const [showAboutModal, setShowAboutModal] = useState(false);

  const paypalUrl = "https://paypal.me/AbdullahGabby?locale.x=ar_EG&country.x=SA";

  return (
    <footer className="relative border-t border-white/5 bg-zinc-950/60 pt-16 pb-32 px-4 sm:px-8">
      {/* 
        OPTIMIZED PERFORMANCE: Removed all heavy absolute divs with 'blur-3xl' filter overlays
        which cause composite, paint, and transition lag/stuttering on smart TVs, older iPad styles, and Safari browsers.
      */}

      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center space-y-10 relative z-10">
        
        {/* Brand Header */}
        <div className="space-y-3">
          <div className="text-3xl sm:text-4xl font-black italic tracking-wider text-primary drop-shadow-[0_2px_10px_rgba(229,9,20,0.2)]">
            حكايتنا
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            منصتك الترفيهية الأولى لمشاهدة أحدث المسلسلات العربية والتركية والمدبلجة والأنمي الحصري بجودة 4K وسيرفرات فائقة السرعة بدون إعلانات مزعجة.
          </p>
        </div>

        {/* Dynamic Buttons Area (من نحن & ادعمنا) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl">
          
          {/* Support Website Button (PayPal Style - Ultra Clean, No constant ping/pulse animations) */}
          <a
            href={paypalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative w-full sm:w-auto min-w-[240px] bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-black text-xs sm:text-sm py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg transform hover:-translate-y-0.5 active:scale-98 cursor-pointer"
          >
            <PayPalIcon className="w-5 h-5 text-black group-hover:scale-105 transition-transform duration-200" />
            <span>ادعمنا الآن عبر بايبال 👑</span>
          </a>

          {/* About Us Button (Elegant Slate Glass) */}
          <button
            onClick={() => setShowAboutModal(true)}
            className="w-full sm:w-auto min-w-[180px] bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 hover:border-white/10 font-bold text-xs sm:text-sm py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5 active:scale-98 cursor-pointer"
          >
            <Info className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            <span>من نحن ؟</span>
          </button>
        </div>

        {/* Quick supportive notes below buttons */}
        <p className="text-[11px] sm:text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
          تبرعك الكريم يساهم مباشرة في استئجار السيرفرات السريعة وصيانة المشغل لتجربة ترفيهية خالية من الإعلانات! ❤️
        </p>

        {/* Footer Bottom copyright/meta info */}
        <div className="w-full border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-500 text-[10px] sm:text-[11px]">
          <div>
            &copy; {new Date().getFullYear()} حكايتنا. جميع الحقوق محفوظة للإدارة والمطورين.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-zinc-400 transition-colors cursor-pointer">شروط الاستخدام</span>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <span className="hover:text-zinc-400 transition-colors cursor-pointer">سياسة الخصوصية</span>
          </div>
        </div>

      </div>

      {/* About Us Modal (Beautiful non-laggy lightweight transition) */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-[100005] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Modal backdrop closer */}
            <div className="absolute inset-0" onClick={() => setShowAboutModal(false)} />

            {/* Modal Content container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-[2.5rem] p-8 md:p-10 overflow-hidden shadow-2xl text-right"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowAboutModal(false)}
                className="absolute top-6 left-6 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">منصة حكايتنا 🌟</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">ABOUT THE PLATFORM</p>
                  </div>
                </div>

                <div className="space-y-4 text-zinc-400 text-xs sm:text-sm leading-relaxed font-medium">
                  <p>
                    موقع <strong className="text-white">حكايتنا</strong> هو صرح ترفيهي رقمي مخصص لعشاق السينما والدراما العربية، الخليجية، التركية، بالإضافة للأنمي الياباني والقصص المدبلجة.
                  </p>
                  <p>
                    تأسس هذا الموقع لإيجاد بديل رائد يجمع سهولة الاستخدام المطلقة وجودة بث استثنائية دون إعلانات منبثقة مزعجة أو اشتراكات مكلفة ترهق كاهل المستمع والمشاهد العربي.
                  </p>
                  <p>
                    رسالتنا تتركز على دمج الابتكار البرمجي والذكاء التقني وتوفير سيرفرات ذات نطاقات عالمية عالية الاستجابة، لنقل تجربة صالة العرض الكبرى مباشرةً إلى أجهزتكم وسينماتكم المنزلية وتلفزيوناتكم الذكية وبصورة خالية تماماً من العيوب والتعقيد.
                  </p>
                </div>

                {/* Inline Support Call to Action for the Paypal link */}
                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col items-center sm:flex-row justify-between gap-4">
                  <p className="text-[11px] text-zinc-500 font-bold text-center sm:text-right">
                    إذا نالت خدماتنا رضاك وحزت بالمتعة المرجوة، يسعدنا تبرعك لضمان ترقية الخوادم وصيانة المشغل دائمًا! 👑
                  </p>
                  <a
                    href={paypalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto bg-primary hover:bg-red-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(229,9,20,0.3)] active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <PayPalIcon className="w-4 h-4 text-white" />
                    <span>ادعمنا الآن</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </footer>
  );
}
