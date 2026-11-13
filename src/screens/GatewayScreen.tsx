import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAppRouteUrl, getRouteSearchParams } from '../lib/apiConfig';

export default function GatewayScreen() {
  const location = useLocation();
  const params = getRouteSearchParams();
  const seriesId = params.get('id') || new URLSearchParams(location.search).get('id') || '';
  const redirectUrl = params.get('redirect') || new URLSearchParams(location.search).get('redirect') || '';

  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleProceed = () => {
    if (redirectUrl) {
      window.location.replace(redirectUrl);
    } else if (seriesId) {
      window.location.replace(getAppRouteUrl(`/watch/${encodeURIComponent(seriesId)}?unlocked=true`));
    } else {
      window.location.replace(getAppRouteUrl('/'));
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center px-6 py-10 text-center"
    >
      <div className="max-w-md w-full space-y-6">
        <h2 className="text-2xl font-black text-gray-900 leading-snug">
          جاري تهيئة خوادم البث المباشر...
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          يرجى الانتظار بضع ثوانٍ لتخطي الإعلان الراعي والتحويل الفوري لسرعة البث القصوى.
        </p>

        {countdown > 0 && (
          <div className="text-7xl font-black text-red-600 font-mono my-6 tabular-nums">
            {countdown}
          </div>
        )}

        <button
          type="button"
          disabled={countdown > 0}
          onClick={handleProceed}
          className={
            countdown > 0
              ? 'w-full py-4 px-6 rounded-2xl bg-gray-100 text-gray-400 font-extrabold text-sm cursor-not-allowed'
              : 'w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-base shadow-[0_10px_30px_rgba(220,38,38,0.4)] transition-all active:scale-95 cursor-pointer'
          }
        >
          {countdown > 0
            ? `الرجاء الانتظار ${countdown} ثوانٍ لمتابعة المشاهدة...`
            : 'تخطي الإعلان والدخول للمشاهدة الآن 🍿🚀'}
        </button>

        <p className="text-[11px] text-gray-400 font-semibold pt-4">
          شبكة البث الآمنة المعززة تضمن لك مشاهدة سلسة وذات دقة عالية.
        </p>
      </div>
    </div>
  );
}
