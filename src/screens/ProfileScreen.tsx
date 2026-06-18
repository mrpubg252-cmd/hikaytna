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
          // Emit custom event to refresh player checks immediately
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

  const isAdFreeActive = adFreeExpiry > Date.now();
  const readableExpiry = isAdFreeActive
    ? new Date(adFreeExpiry).toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

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
          <section className="bg-zinc-950/50 border border-white/5 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden space-y-8">
            <div className="absolute top-0 left-0 w-80 h-80 bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10 pb-6 border-b border-white/5 text-right">
              <div className="space-y-1">
                <div className="flex items-center gap-2 lg:gap-3 justify-start sm:justify-start flex-row-reverse">
                  <h2 className="text-xl font-black text-white italic tracking-tight">نظام الدعوات وترقية العضوية بدون إعلانات 🚀</h2>
                  <div className="p-2.5 rounded-2xl bg-[#0a0a0f] border border-white/5 text-primary">
                    <Gift className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-medium max-w-xl">
                  شارك موقع الحامي مسلسلات مع أصدقائك للحصول على نقاط حقيقية ومقايضتها بفترات مشاهدة متميزة خالية تماماً من الصفحات الإعلانية الفاصلة!
                </p>
              </div>

              {/* POINTS BADGE */}
              <div className="flex items-center gap-3 bg-zinc-900/60 self-start sm:self-center px-5 py-3 rounded-2xl border border-white/10 shadow-lg">
                <span className="text-xs text-zinc-450 font-black tracking-widest uppercase">النقاط الحالية:</span>
                <span className="text-2xl font-black text-red-500 tracking-tighter tabular-nums animate-pulse">{points}</span>
              </div>
            </div>

            {/* AD-FREE COUNTDOWN / STATUS CARD */}
            <div className="relative z-10">
              {isAdFreeActive ? (
                <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 text-right space-y-2 relative overflow-hidden">
                  <div className="absolute top-3 left-3 flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400">
                    <Flame className="w-5 h-5 animate-bounce" />
                  </div>
                  <h3 className="text-emerald-400 font-black text-md flex items-center gap-2 flex-row-reverse justify-start">
                    <span>ترقية المشاهدة بدون إعلانات مفعلة حالياً 👑</span>
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed font-bold">
                    حسابك مستقر وضمن الفئة الاستثنائية الفاخرة! لن تشاهد أي صفحات إعلانية فاصلة عند تشغيل أو تحميل أي حلقة في الموقع حتى تاريخ:
                  </p>
                  <p className="text-xs sm:text-sm text-white font-black underline decoration-emerald-500/50 underline-offset-4">
                    {readableExpiry}
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-white/5 text-right space-y-2">
                  <h3 className="text-zinc-450 font-bold text-sm">الباقة العادية مفعّلة حالياً 🍿</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    نظام الإعلانات الفاصلة يعمل بشكل افتراضي. للحصول على أسبوع مشاهدة كامل خالي تماماً وبدون أي إعلانات، جمّع 5 نقاط عن طريق مشاركة رابطك الحصري تالياً ومقايضتها فورياً!
                  </p>
                </div>
              )}
            </div>

            {/* ACTION SECTION: COPY AND REDEEM */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 text-right">
              
              {/* COPY LINK CARD */}
              <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black text-white mb-1 flex items-center gap-2 justify-end">
                    <span>رابط إحالتك الفريد والحصري 🔗</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    انسخ هذا الرابط وأرسله لأصدقائك أو مجموعاتك. بمجرد تحميل وقراءة Telemetry الإنسان الحقيقي للزائر الجديد، ستُضاف نقطة لرصيدك!
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-full flex items-center justify-between gap-2 bg-black border border-white/10 rounded-2xl p-2 pl-3">
                    <button
                      onClick={handleCopyLink}
                      className={`flex items-center justify-center p-2 rounded-xl text-black transition-all cursor-pointer ${
                        isCopied ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-primary hover:bg-primary-hover hover:scale-[1.03]'
                      }`}
                      title="نسخ الرابط"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                    </button>
                    <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px] sm:max-w-xs text-left direction-ltr select-all">
                      {referrerId ? `${window.location.origin}/?ref=${referrerId}` : 'جاري التجهيز...'}
                    </span>
                  </div>
                  {isCopied && (
                    <p className="text-[10px] text-emerald-400 font-bold text-left animate-fade-in">
                      ✓ تم نسخ رابط إحالتك بنجاح! شاركه الآن 🚀
                    </p>
                  )}
                </div>
              </div>

              {/* REDEEM SYSTEM CARD */}
              <div className="bg-[#0c0c12]/20 border border-white/5 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black text-white mb-1 flex items-center gap-2 justify-end">
                    <span>مقايضة النقاط وتفعيل الترقية 💎</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    لكل <span className="text-primary font-bold">5 نقاط</span>، يمكنك مقايضتها وتفعيل باقة العضوية الخالية من الإعلانات تماماً لمدة <span className="text-emerald-400 font-bold">أسبوع كامل</span>. وتتم مراكمة الفترات عند تكرار المقايضة!
                  </p>
                </div>

                <div className="space-y-3">
                  {points >= 5 ? (
                    <button
                      onClick={handleRedeemPoints}
                      disabled={isRedeeming}
                      className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-black rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isRedeeming ? 'جاري تفعيل الإزالة...' : 'مقايضة 5 نقاط وترقية أسبوع إزالة إعلانات 👑'}
                    </button>
                  ) : (
                    <div>
                      <button
                        disabled
                        className="w-full py-3.5 bg-zinc-900 border border-white/5 text-zinc-500 text-xs font-bold rounded-2xl cursor-not-allowed"
                      >
                        رصيدك أقل من 5 نقاط لمقايضة باقة أسبوع
                      </button>
                      <p className="text-[9px] text-zinc-500 text-center mt-1.5">
                        تحتاج إلى جمع {5 - points} نقاط إضافية لتفعيل المقايضة الفورية.
                      </p>
                    </div>
                  )}

                  {successRedeem && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400 text-[10px] font-bold text-center">
                      {successRedeem}
                    </div>
                  )}

                  {errorRedeem && (
                    <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-[10px] font-bold text-center">
                      {errorRedeem}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ANTI-CHEAT SCARY MESSAGE BAR */}
            <div className="bg-red-950/20 border border-red-500/10 rounded-2xl p-4 flex items-start gap-3 text-right">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="text-xs font-black text-red-400">إشعار حماية نظام الإحالة والأحقية القانونية</h5>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  يرجى الحرص البالغ على مشاركة رابط الإحالة لزيارات من أشخاص أو أصدقاء حقيقيين يتفاعلون مع المنصة بصدق. فحص Telemetry للروبوتات مفّعل وقائم على الفحص المتكرر، واستخدام طرق احتيالية ذاتية (كزيارة رابطك بنفسك من متصفح آخر) قد يؤدي إلى فرض تشفير تلقائي وإيقاف إمكانية تشغيل أو متابعة أي مسلسل لك بشكل دائم!
                </p>
              </div>
            </div>

          </section>

          {/* STREAM QUALITY STATS SECTION */}
          <section className="bg-zinc-950/20 border border-white/5 rounded-[2rem] p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3 text-right">
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 text-primary">
                <Activity className="w-6 h-6" />
              </div>
              <div className="text-right flex-1">
                <h2 className="text-lg font-black text-white">تفاصيل اتصال العضوية 🌐</h2>
                <p className="text-xs text-zinc-500">مؤشرات الأداء الفعلية وسرعة اتصال المشغل التفاعلي مع الخوادم السحابية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4 text-right">
                <div className="flex items-center justify-between text-zinc-400 flex-row-reverse">
                  <span className="text-[10px] font-black uppercase tracking-wider">خادم الاتصال</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">اتصال مشفر وآمن</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">مدعوم بنظام حماية SSL لحمايتك من التتبع الخارجي.</p>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4 text-right">
                <div className="flex items-center justify-between text-zinc-400 flex-row-reverse">
                  <span className="text-[10px] font-black uppercase tracking-wider">سرعة الاستجابة</span>
                  <div className="text-emerald-400 text-xs font-black">9ms</div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">استجابة فائقة السرعة</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-normal">أعلى سرعة توجيه ذكية مع خوادم معالجة البث المحسّنة.</p>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4 text-right">
                <div className="flex items-center justify-between text-zinc-400 flex-row-reverse">
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
