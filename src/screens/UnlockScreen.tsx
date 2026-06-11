import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, ShieldAlert, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function UnlockScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(6);
  const [isReady, setIsReady] = useState(false);

  // Parse target URL
  const params = new URLSearchParams(location.search);
  const targetUrl = params.get('target') || '/';

  useEffect(() => {
    // 1. DYNAMICALLY INJECT ALL AD SCRIPTS NATIVELY IN HEAD
    const script1 = document.createElement('script');
    script1.dataset.zone = '11033994';
    script1.src = 'https://n6wxm.com/vignette.min.js';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.dataset.zone = '11033969';
    script2.src = 'https://n6wxm.com/vignette.min.js';
    document.head.appendChild(script2);

    const script3 = document.createElement('script');
    script3.dataset.zone = '10995706';
    script3.src = 'https://nap5k.com/tag.min.js';
    document.head.appendChild(script3);

    const script4 = document.createElement('script');
    script4.dataset.zone = '10943622';
    script4.src = 'https://al5sm.com/tag.min.js';
    document.head.appendChild(script4);

    const script5 = document.createElement('script');
    script5.src = 'https://quge5.com/88/tag.min.js';
    script5.dataset.zone = '234781';
    script5.async = true;
    script5.setAttribute('data-cfasync', 'false');
    document.head.appendChild(script5);

    // 2. COUNTDOWN TIMER LOGIC
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      // Optional cleanup of script elements to avoid memory leaks
      try { script1.remove(); } catch (e) {}
      try { script2.remove(); } catch (e) {}
      try { script3.remove(); } catch (e) {}
      try { script4.remove(); } catch (e) {}
      try { script5.remove(); } catch (e) {}
    };
  }, []);

  const handleUnlockAndGo = () => {
    // Determine the redirection watch URL - append unlocked=true so WatchScreen unlocks playing
    const connector = targetUrl.includes('?') ? '&' : '?';
    const finalRedirect = `${targetUrl}${connector}unlocked=true`;
    
    // Redirect the page top-level
    window.location.href = finalRedirect;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none font-sans">
      {/* Visual Ambient Background Spheroids */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-800/10 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="w-full max-w-lg bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 text-center space-y-8 shadow-2xl relative z-10 transition-all">
        
        {/* Decorative Glowing Play Icon Header */}
        <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-red-600 to-primary flex items-center justify-center shadow-[0_10px_35px_rgba(229,9,20,0.3)] animate-pulse">
          <Play className="w-10 h-10 text-white fill-current ml-1" />
        </div>

        <div className="space-y-3">
          <span className="text-primary text-[10px] font-black tracking-widest uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            بوابة تأمين البث المباشر
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
            تهيئة الخوادم المجانية ⚡
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-md mx-auto">
            مرحباً بك! لمشاهدة العمل بدقة عالية وبدون إعلانات داخل المشغل، نرجو الانتظار بضع ثوانٍ فقط لتأكيد الرصيد والدعم المباشر ومزامنة البث مع خوادمنا.
          </p>
        </div>

        {/* Dynamic Interactive Progress / Timer Circular Area */}
        <div className="flex flex-col items-center justify-center py-4">
          {!isReady ? (
            <div className="relative flex items-center justify-center">
              {/* Spinning Accent Border Ring */}
              <div className="w-24 h-24 rounded-full border-4 border-zinc-800 border-t-primary animate-spin" />
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black font-mono tracking-tighter text-white animate-bounce">
                  {countdown}
                </span>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                  ثانية
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl text-xs font-black animate-fade-in animate-pulse">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تمت تهيئة البث وتفعيل سرعة المشاهدة القصوى بنجاح!</span>
            </div>
          )}
        </div>

        {/* Action Button Container */}
        <div className="pt-2">
          {!isReady ? (
            <button 
              disabled
              className="w-full py-4 px-6 bg-zinc-800 text-zinc-500 font-extrabold text-sm sm:text-base rounded-2xl shadow-inner cursor-not-allowed select-none transition-all flex items-center justify-center gap-2"
            >
              <span>الرجاء الانتظار {countdown} ثوانٍ لتوفير الرابط...</span>
            </button>
          ) : (
            <button 
              onClick={handleUnlockAndGo}
              className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-primary hover:from-red-500 hover:to-red-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-[0_10px_35px_rgba(229,9,20,0.55)] hover:shadow-[0_12px_40px_rgba(229,9,20,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2.5"
            >
              <span>العودة للموقع ومشاهدة العمل الآن</span>
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Security / Quality Verification Footer Badges */}
        <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-zinc-500 font-extrabold select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span>خوادم فائقة السرعة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span>نظام البث الآمن SSL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
