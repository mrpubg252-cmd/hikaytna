import React, { useState, useEffect } from 'react';
import { User, Activity, ShieldCheck, Sparkles, Sliders, Copy, Check, Users, Gift, AlertTriangle, Flame } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfileScreen() {
  const [currentName, setCurrentName] = useState(() => {
    return localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  // Referral system states
  const [referrerId, setReferrerId] = useState('');
  const [points, setPoints] = useState(0);
  const [adFreeExpiry, setAdFreeExpiry] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorRedeem, setErrorRedeem] = useState<string | null>(null);
  const [successRedeem, setSuccessRedeem] = useState<string | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(true);

  useEffect(() => {
    // Load local referral ID
    let refId = localStorage.getItem('my_referral_id');
    if (!refId) {
      refId = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('my_referral_id', refId);
    }
    setReferrerId(refId);

    // Fetch user points & adFreeExpiry on mount
    fetchPointsAndExpiry(refId);
  }, []);

  const fetchPointsAndExpiry = (id: string) => {
    setLoadingPoints(true);
    fetch(`/api/v1/referral/points?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status) {
          setPoints(data.points || 0);
          setAdFreeExpiry(data.adFreeExpiry || 0);
          localStorage.setItem('my_points', String(data.points || 0));
          if (data.adFreeExpiry) {
            localStorage.setItem('ad_free_until', String(data.adFreeExpiry));
          } else {
            localStorage.removeItem('ad_free_until');
          }
        }
      })
      .catch((err) => console.warn('Points fetch failed:', err))
      .finally(() => setLoadingPoints(false));
  };

  const handleCopyLink = () => {
    const referralLink = `${window.location.origin}/?ref=${referrerId}`;
    navigator.clipboard.writeText(referralLink)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy code', err);
      });
  };

  const handleRedeemPoints = () => {
    if (points < 5) return;
    setIsRedeeming(true);
    setErrorRedeem(null);
    setSuccessRedeem(null);

    fetch('/api/v1/referral/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: referrerId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status) {
          setSuccessRedeem(data.message || 'تم مقايضة النقاط وتفعيل الإزالة الإعلانية الفورية لأسبوع كامل بنجاح! 🎉');
          setPoints(data.points);
          setAdFreeExpiry(data.adFreeExpiry);
          localStorage.setItem('my_points', String(data.points));
          localStorage.setItem('ad_free_until', String(data.adFreeExpiry));
          // Emit custom event to notify other players setup
          window.dispatchEvent(new Event('ad-status-updated'));
        } else {
          setErrorRedeem(data.message || 'حدث خطأ أثناء مقايضة النقاط، يرجى المحاولة لاحقاً.');
        }
      })
      .catch((err) => {
        console.error('Redeem failed:', err);
        setErrorRedeem('عذراً! خادم المقايضة غير مستجيب حالياً. حاول ثانية لاحقاً.');
      })
      .finally(() => {
        setIsRedeeming(false);
      });
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNameInput.trim();
    if (!trimmed || trimmed === 'غير مسجل (حساب زائر)') return;
    localStorage.setItem('guest_chat_name', trimmed);
    setCurrentName(trimmed);
    setIsEditingName(false);

    // Notify other components if needed
    window.dispatchEvent(new Event('name-updated'));
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-24">
        <div className="space-y-8">
          
          {/* USER CARD PROFILE OVERVIEW */}
          <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
             <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/25 blur-2xl rounded-full group-hover:bg-primary/45 transition-all animate-pulse" />
                <div className="w-32 h-32 rounded-[2rem] border-4 border-zinc-950 bg-black/50 flex items-center justify-center relative z-10 shadow-2xl transition-transform group-hover:scale-105">
                  <User className="w-16 h-16 text-zinc-400" />
                </div>
              </div>
              
               <div className="text-center md:text-right space-y-2 flex-1">
                 <div className="flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
                   {isEditingName ? (
                     <form onSubmit={handleRename} className="flex gap-2 items-center">
                       <input 
                         type="text" 
                         value={newNameInput}
                         onChange={(e) => setNewNameInput(e.target.value)}
                         className="bg-black/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary text-right"
                         required
                         placeholder="أدخل اسمك الجديد..."
                         autoFocus
                       />
                       <button 
                         type="submit" 
                         className="bg-emerald-500 text-black px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-emerald-400 active:scale-95 transition cursor-pointer"
                       >
                         حفظ الاسم
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setIsEditingName(false)}
                         className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-zinc-750 active:scale-95 transition cursor-pointer"
                       >
                         تراجع
                       </button>
                     </form>
                   ) : (
                     <div className="flex items-center gap-2">
                       <h1 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-2">
                         {currentName}
                       </h1>
                       <button 
                         onClick={() => {
                           setNewNameInput(currentName === 'غير مسجل (حساب زائر)' ? '' : currentName);
                           setIsEditingName(true);
                         }}
                         className="p-1 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                         title="تعديل اللقب"
                       >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                         </svg>
                       </button>
                     </div>
                   )}
                 </div>
                 <div className="flex items-center justify-center md:justify-start gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-ping" />
                   <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">حساب زائر نشط وآمن</span>
                 </div>
               </div>
            </div>
          </section>

          {/* ADVANCED REFERRAL & AD-FREE SYSTEM SECTION */}
          <section className="bg-zinc-950/50 border border-white/5 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-red-800/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 pb-6 border-b border-white/5 relative z-10 text-right w-full">
              <div className="flex items-center gap-4 flex-row-reverse w-full md:w-auto">
                <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-primary shadow-[0_0_20px_rgba(239,68,68,0.15)] flex-shrink-0">
                  <Gift className="w-8 h-8 animate-bounce" />
                </div>
                <div className="space-y-1 block text-right">
                  <h2 className="text-xl md:text-2xl font-black text-white">نظام الدعوات وترقية العضوية 👑</h2>
                  <p className="text-xs text-zinc-400">ادعُ أصدقاءك لتخطي وإلغاء جميع الإعلانات الفاصلة مجاناً بالكامل!</p>
                </div>
              </div>

              {/* POINTS REWARD PILL */}
              <div className="bg-zinc-900 border border-white/5 px-6 py-4 rounded-3xl flex items-center gap-4 flex-row-reverse shadow-inner w-full md:w-auto md:mr-auto justify-center md:justify-start">
                <div className="text-right">
                  <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-wider">رصيد نقاطك الحالي</span>
                  <span className="text-2xl font-black text-primary font-mono tracking-tight">{points}</span>
                </div>
                <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-400">
                  <Flame className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* AD-FREE ACTIVE TICKER */}
            {adFreeExpiry > Date.now() ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-center sm:text-right">
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-2 sm:mb-0">
                    👑
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-400">أنت عضو مميز خالي من الإعلانات! 🎉</h4>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      ينتهي اشتراكك في: <span className="text-emerald-300 font-bold font-sans">
                        {new Date(adFreeExpiry).toLocaleString('ar-EG', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  نشط ومفعّل
                </span>
              </div>
            ) : (
              <div className="bg-zinc-900/65 border border-white/5 p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-center sm:text-right">
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2 sm:mb-0">
                    🍿
                  </div>
                  <div className="space-y-0.5 block">
                    <h4 className="text-sm font-black text-zinc-300">العضوية العادية الحالية</h4>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-bold">كل 5 نقاط تتيح لك إزالة الفواصل الإعلانية لمدة أسبوع كامل فورياً.</p>
                  </div>
                </div>
                <span className="px-4 py-2 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-bold tracking-wider">
                  محدودة بـ 6 ثوانٍ من الانتظار
                </span>
              </div>
            )}

            {/* THREE-STEP HOW IT WORKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 text-right">
              {/* STEP 1: INVITE */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 md:p-6 space-y-4 text-right">
                <div className="flex items-center gap-3 flex-row-reverse">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-primary font-black font-mono">1</div>
                  <h3 className="text-sm font-black text-white">انسخ رابط إحالتك الفريد</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed md:pr-11 pr-0 text-right">
                  قم بمشاركة الرابط الخاص بك مع أصدقائك أو على أي من شبكات التواصل الاجتماعي (تيك توك، واتساب، تليجرام).
                </p>

                {/* COPY LINK WIDGET */}
                <div className="pt-2 md:pr-11 pr-0">
                  <div className="bg-black/60 border border-white/5 rounded-2xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative">
                    <span className="text-[10px] md:text-xs font-mono text-zinc-450 truncate text-center sm:text-left select-all px-2.5 py-1.5 bg-black/40 rounded-xl border border-white/[0.03]">
                      {window.location.origin}/?ref={referrerId}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center justify-center gap-1.5 bg-primary hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 flex-shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>تم النسخ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 2: COLLECT POINTS */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 md:p-6 space-y-4 flex flex-col justify-between text-right">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-primary font-black font-mono">2</div>
                    <h3 className="text-sm font-black text-white">مقايضة النقاط وتفعيل الإزالة 👑</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed md:pr-11 pr-0 text-right">
                    جمّع 5 نقاط على الأقل من دعوة أصدقاء حقيقيين، وسيتاح لك مقايضتها وتفعيل أسبوع كامل بدون انتظار مباشرة!
                  </p>
                </div>

                {/* REDEEM ACTION BUTTON */}
                <div className="pt-4 md:pr-11 pr-0 text-right">
                  <button
                    onClick={handleRedeemPoints}
                    disabled={points < 5 || isRedeeming}
                    className={`w-full py-3 px-5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 flex-row-reverse ${
                      points >= 5 
                        ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer hover:shadow-red-500/30' 
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isRedeeming ? (
                      <span>جاري معالجة طلبك... ⌛</span>
                    ) : points >= 5 ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>استبدال 5 نقاط وتنشيط أسبوع بدون إعلانات 🚀</span>
                      </>
                    ) : (
                      <span>مطلوب {5 - points} نقاط إضافية على الأقل للمقايضة</span>
                    )}
                  </button>

                  {/* SUCCESS / ERROR NOTICES */}
                  {successRedeem && (
                    <p className="text-[10px] text-emerald-400 font-bold mt-2.5 text-center leading-relaxed animate-pulse">
                      {successRedeem}
                    </p>
                  )}
                  {errorRedeem && (
                    <p className="text-[10px] text-red-500 font-bold mt-2.5 text-center leading-relaxed">
                      {errorRedeem}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* HIGH-SECURITY NO SELF-FRAUD WARNING CARD (SCARE NOTICE) */}
            <div className="bg-[#120303]/90 border border-red-500/10 rounded-3xl p-6 relative z-10 pl-6 text-right">
              <div className="flex items-start gap-4 flex-row-reverse text-right">
                <div className="p-3 bg-red-500/10 border border-red-500/25 text-primary rounded-2xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
                </div>
                <div className="space-y-1.5 block text-right">
                  <h4 className="text-sm font-black text-red-500 italic">تنبيه هام ومشدد لمكافحة التلاعب بالنظام ⚠️</h4>
                  <p className="text-xs text-zinc-350 leading-relaxed font-bold animate-pulse">
                    تم تفعيل فحص البصمة الرقمية الفائقة (Telemetry) وعقود الأجهزة لحظر السلوكيات الاصطناعية وتزوير النقاط. 
                    في حالة قيامك بمحاولة فتح رابط الإحالة الخاص بك بنفسك من متصفح آخر أو بيئة وهمية، سيقوم نظام الحماية الآلي تلقائياً 
                    بحظر حسابك وحرمانك فورياً من مشاهدة وتنزيل المسلسلات لانتهاك السياسات الأمنية. انشر الرابط بين أشخاص حقيقيين فقط!
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* STREAM QUALITY STATS SECTION */}
          <section className="bg-zinc-950/20 border border-white/5 rounded-[2rem] p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3 text-right">
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 text-primary">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">تفاصيل اتصال العضوية 🌐</h2>
                <p className="text-xs text-zinc-500">مؤشرات الأداء الفعلية وسرعة اتصال المشغل التفاعلي مع الخوادم السحابية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">خادم الاتصال</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">اتصال مشفر وآمن</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">مدعوم بنظام حماية SSL لحمايتك من التتبع الخارجي.</p>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">سرعة الاستجابة</span>
                  <div className="text-emerald-400 text-xs font-black">9ms</div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">استجابة فائقة السرعة</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">أعلى سرعة توجيه ذكية مع خوادم معالجة البث المحسّنة.</p>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">دقة العرض</span>
                  <div className="text-primary text-xs font-black">Full HD+</div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">تلقائي فائق الدقة</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">تحديد ذكي لأعلى دقة عرض تناسب سرعة جهازك الحالي.</p>
                </div>
              </div>

            </div>
          </section>

          {/* DIRECT SUPPORT BANNER */}
          <section className="bg-zinc-950/45 border border-white/5 rounded-[2rem] p-6 text-center text-xs md:text-sm text-zinc-400 leading-relaxed font-extrabold max-w-4xl mx-auto space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-primary mb-2">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <p className="max-w-xl mx-auto">
              تم ترقية تجربة المشاهدة وتهيئة مشغل الفيديو لضمان متعة سينمائية فائقة مجاناً بالكامل لجميع المستخدمين!
            </p>
          </section>

          {/* GENERAL HELP FOOTER */}
          <section className="bg-zinc-900/15 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8">
             <p className="text-center text-zinc-550 font-bold text-xs">تم إتاحة منصة المشاهدة والدردشة التفاعلية بالكامل للجميع بدون شروط تسجيل معقدة.</p>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
