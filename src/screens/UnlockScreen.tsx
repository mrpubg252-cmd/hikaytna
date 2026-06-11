import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
      // Optional cleanup of script elements
      try { script1.remove(); } catch (e) {}
      try { script2.remove(); } catch (e) {}
      try { script3.remove(); } catch (e) {}
      try { script4.remove(); } catch (e) {}
      try { script5.remove(); } catch (e) {}
    };
  }, []);

  const handleUnlockAndGo = () => {
    // Redirect or navigate to target url (WatchScreen) with unlocked=true
    navigate(targetUrl, { replace: true });
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-6 select-none font-sans" style={{ background: '#ffffff' }}>
      <div className="w-full max-w-md text-center space-y-8 p-4">
        
        {/* Minimalist instructions */}
        <div className="space-y-4">
          <h2 className="text-xl md:text-2xl font-black text-zinc-800">
            جاري تهيئة خوادم البث المباشر...
          </h2>
          <p className="text-zinc-500 text-xs md:text-sm leading-relaxed max-w-xs mx-auto">
            يرجى الانتظار بضع ثوانٍ لتخطي الإعلان الراعي والتحويل الفوري لسرعة البث القصوى.
          </p>
        </div>

        {/* Minimal Countdown Indicator */}
        <div className="flex flex-col items-center justify-center py-4">
          {!isReady ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="text-5xl font-black text-red-600 font-mono tracking-tighter">
                {countdown}
              </div>
              <span className="text-[10px] font-bold text-zinc-400">ثانية متبقية</span>
            </div>
          ) : (
            <div className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl text-xs font-black animate-pulse">
              تم تجهيز مَزَامَنَة البث بنجاح!
            </div>
          )}
        </div>

        {/* Red Return Button Container */}
        <div className="pt-2 w-full">
          {!isReady ? (
            <button 
              disabled
              className="w-full py-4 px-6 bg-zinc-100 text-zinc-400 font-black text-sm rounded-xl cursor-not-allowed select-none transition-all"
            >
              الرجاء الانتظار {countdown} ثوانٍ لمتابعة المشاهدة...
            </button>
          ) : (
            <button 
              onClick={handleUnlockAndGo}
              className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-black text-sm md:text-base rounded-xl shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer text-center"
            >
              العودة للموقع ومتابعة المشاهدة 🚀
            </button>
          )}
        </div>

        <div className="text-[10px] text-zinc-400 font-semibold select-none pt-4">
          شبكة البث الآمنة المعززة تضمن لك مشاهدة سلسة وذات دقة عالية.
        </div>

      </div>
    </div>
  );
}
