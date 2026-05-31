import React, { useState, useEffect } from 'react';
import { User, Share2, Copy, Check, Gift, Crown, Trophy, Sparkles, AlertCircle } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfileScreen() {
  const [currentName, setCurrentName] = useState(() => {
    return localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)';
  });
  const [enteredName, setEnteredName] = useState('');
  
  // Manage or generate unique guest referrer ID
  const [myRefId, setMyRefId] = useState('');
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [copied, setCopied] = useState(false);

  const hasRegisteredName = currentName && currentName !== 'غير مسجل (حساب زائر)' && currentName.trim().length > 0;

  useEffect(() => {
    let storedId = localStorage.getItem('my_referral_id');
    if (!storedId) {
      storedId = 'REF_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem('my_referral_id', storedId);
    }
    setMyRefId(storedId);

    // Fetch latest points from server
    const fetchPoints = () => {
      fetch(`/api/v1/referral/points?id=${storedId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status) {
            setPoints(data.points);
            if (data.points >= 10) {
              localStorage.setItem('ads_removed_forever', 'true');
            } else {
              localStorage.removeItem('ads_removed_forever');
            }
          }
        })
        .catch(err => console.error("Could not fetch user points:", err))
        .finally(() => setLoadingPoints(false));
    };

    fetchPoints();
    // Intermittent poll every 10 seconds for real-time live click updates!
    const interval = setInterval(fetchPoints, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync user mapping profile when they are fully registered
  useEffect(() => {
    if (hasRegisteredName && myRefId) {
      fetch('/api/v1/referral/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId: myRefId, username: currentName })
      }).catch(err => console.error("Error setting ref mapper:", err));
    }
  }, [currentName, myRefId, hasRegisteredName]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredName.trim() || enteredName.trim() === 'غير مسجل (حساب زائر)') return;
    localStorage.setItem('guest_chat_name', enteredName.trim());
    setCurrentName(enteredName.trim());
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameInput.trim() || newNameInput.trim() === 'غير مسجل (حساب زائر)') return;
    localStorage.setItem('guest_chat_name', newNameInput.trim());
    setCurrentName(newNameInput.trim());
    setIsEditingName(false);
  };

  const referralLink = `${window.location.origin}/?ref=${myRefId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const adRemovalActive = points >= 10;
  const progressPercent = Math.min(100, (points / 10) * 100);

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
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-all" />
                <div className="w-32 h-32 rounded-[2rem] border-4 border-zinc-950 bg-black/50 flex items-center justify-center relative z-10 shadow-2xl transition-transform group-hover:scale-105">
                  {adRemovalActive ? (
                    <Crown className="w-16 h-16 text-amber-400 animate-pulse" />
                  ) : (
                    <User className="w-16 h-16 text-zinc-500" />
                  )}
                </div>
              </div>
              
               <div className="text-center md:text-right space-y-2">
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
                         حفظ
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setIsEditingName(false)}
                         className="bg-zinc-850 text-zinc-300 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-zinc-750 active:scale-95 transition cursor-pointer"
                       >
                         تراجع
                       </button>
                     </form>
                   ) : (
                     <>
                       <h1 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-2">
                         {currentName}
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
                       </h1>
                       {adRemovalActive && (
                         <span className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none shadow-[0_0_12px_#f59e0b] flex items-center gap-1 shrink-0">
                           <Crown className="w-3 h-3 fill-current" /> ذهبي (بدون إعلانات)
                         </span>
                       )}
                     </>
                   )}
                 </div>
                 <div className="flex items-center justify-center md:justify-end gap-3">
                   <span className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">حساب دخول مفتوح</span>
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 </div>
               </div>
            </div>
          </section>

          {/* REFERRAL SYSTEM SECTION */}
          <section className={`backdrop-blur-xl border rounded-[2rem] p-8 relative overflow-hidden transition-all duration-350 ${
            adRemovalActive 
              ? 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.08)]' 
              : 'bg-zinc-900/30 border-white/5'
          }`}>
             <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/5 blur-[80px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
             
             <div className="flex flex-col gap-6 relative z-10">
                <div className="flex items-start gap-4 text-right">
                  <div className={`p-4 rounded-xl border ${
                    adRemovalActive 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                      : 'bg-zinc-950/80 border-white/10 text-zinc-400'
                  }`}>
                    {adRemovalActive ? <Trophy className="w-7 h-7" /> : <Gift className="w-7 h-7" />}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h2 className="text-xl font-black tracking-tight text-white select-none">نظام إزالة الإعلانات مجاناً للأبد</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      شارك الرابط مَع أصدقائك أو فِى مَجموعاتِك. عِندَمَا يَدخُل 10 أشخاص حقيقِيين عبر الرابط الخاص بك ويَتَفاعلوا مَع الموقع لِثوان، سَيتِم تفعيل الوَضع الذهبي وإزالة الإعلانات مِن حِسابِك لِلأبد دُونَ الحَاجة لِأي اشتراك مالي!
                    </p>
                  </div>
                </div>

                {/* Live values state indicator */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">رصيد النقاط الحالي</span>
                    <span className="text-4xl font-black tracking-tighter text-white mt-1">
                      {loadingPoints ? (
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin my-1" />
                      ) : (
                        points
                      )}
                    </span>
                  </div>

                  <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">الحالة النشطة</span>
                    <span className={`text-[13px] font-black mt-2 rounded-full px-3 py-1 ${
                      adRemovalActive 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {adRemovalActive ? 'إعلانات معطلة' : 'عضوية مدعومة بإعلان'}
                    </span>
                  </div>
                </div>

                {/* PROGRESS BAR BAR */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-xs font-bold font-sans">
                    <span className="text-zinc-400">التقدم لإلغاء الإعلانات</span>
                    <span className={adRemovalActive ? 'text-amber-400 font-black' : 'text-primary font-black'}>
                      {points} / 10 إحالة حقيقية
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-950 border border-white/5 rounded-full overflow-hidden p-[1px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 relative ${
                        adRemovalActive 
                          ? 'bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_12px_#f59e0b]' 
                          : 'bg-gradient-to-r from-red-600 to-primary shadow-[0_0_12px_rgba(229,9,20,0.5)]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* MILESTONES MAP */}
                <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                  <span className="text-zinc-400 text-xs font-black select-none block">مستويات الترقية والجوائز المتاحة لعدّادك:</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    
                    <div className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      points >= 2 
                        ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' 
                        : 'bg-zinc-950/60 border-white/5 text-zinc-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            points >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border border-white/5 text-zinc-400'
                          }`}>المستوى 1</span>
                          {points >= 2 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <h4 className={`text-xs font-black mt-2.5 ${points >= 2 ? 'text-white' : 'text-zinc-400'}`}>زائر ذهبي نشط</h4>
                        <p className="text-[10px] leading-normal opacity-80 mt-1">يحصل جهازك على تفضيل في دعم السيرفر والرد السريع من حكيم الذكي.</p>
                      </div>
                      <span className="text-[10px] font-black mt-3">يتطلب 2 إحالات حقيقية</span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      points >= 5 
                        ? 'bg-blue-500/5 border-blue-500/30 text-blue-400' 
                        : 'bg-zinc-950/60 border-white/5 text-zinc-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            points >= 5 ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-900 border border-white/5 text-zinc-400'
                          }`}>المستوى 2</span>
                          {points >= 5 && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <h4 className={`text-xs font-black mt-2.5 ${points >= 5 ? 'text-white' : 'text-zinc-400'}`}>الوضع الفضي المميز</h4>
                        <p className="text-[10px] leading-normal opacity-80 mt-1">مسح 80% من إعلانات البانر والتسريع المباشر لتدفق المشغل الفني الحركي.</p>
                      </div>
                      <span className="text-[10px] font-black mt-3">يتطلب 5 إحالات حقيقية</span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      points >= 10 
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.06)]' 
                        : 'bg-zinc-950/60 border-white/5 text-zinc-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            points >= 10 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-900 border border-white/5 text-zinc-400'
                          }`}>التاج الذهبي</span>
                          {points >= 10 && <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
                        </div>
                        <h4 className={`text-xs font-black mt-2.5 ${points >= 10 ? 'text-white' : 'text-zinc-400'}`}>حساب المشاهدة الذهبي للأبد</h4>
                        <p className="text-[10px] leading-normal opacity-80 mt-1">إيقاف تام وكلي لجميع النوافذ الإعلانية والمشغلات الترويجية ومدى الحياة!</p>
                      </div>
                      <span className="text-[10px] font-black mt-3">يتطلب 10 إحالات حقيقية</span>
                    </div>

                  </div>
                </div>

                {/* UNIQUE COPY REFERRAL CONTROLLER */}
                {hasRegisteredName ? (
                  <div className="space-y-2 mt-4">
                    <span className="text-zinc-400 text-xs font-black select-none">رابط الإحالة المباشر:</span>
                    <div className="flex items-center gap-2 p-1 bg-zinc-950/90 border border-white/5 rounded-xl pl-3">
                      <button 
                        onClick={handleCopyLink}
                        className={`px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all outline-none whitespace-nowrap active:scale-95 ${
                          copied 
                            ? 'bg-emerald-500 text-black font-sans' 
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'تم النسخ' : 'نسخ رابط الإحالة'}
                      </button>
                      <input 
                        type="text" 
                        readOnly 
                        value={referralLink} 
                        dir="ltr"
                        onClick={handleCopyLink}
                        className="bg-transparent border-none text-zinc-400 text-xs font-semibold focus:outline-none w-full ml-2 cursor-pointer truncate"
                      />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveName} className="space-y-4 p-5 bg-zinc-950/85 border border-white/5 rounded-2xl text-right mt-4">
                    <div className="flex items-center gap-2 text-primary font-black text-xs select-none">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <span>تفعيل نظام الإحالة مجاناً والجوائز</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      الرجاء تسجيل اسمك / اللقب أولاً لتتمكن من إنشاء رمز الإحالة المخصص لك وبدء دعوة الأصدقاء!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        required
                        placeholder="اكتب اسم عضوية زائر الخاصة بك..."
                        value={enteredName}
                        onChange={(e) => setEnteredName(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary text-right"
                      />
                      <button 
                        type="submit"
                        className="bg-primary hover:bg-red-700 text-white text-xs font-black px-5 py-2.5 rounded-xl transition duration-200 active:scale-95 select-none"
                      >
                        حفظ الاسم وتوليد الرابط ⚡
                      </button>
                    </div>
                  </form>
                )}

                {/* Security verification notice */}
                <div className="text-[10px] text-zinc-500 text-center font-bold flex items-center justify-center gap-1 mt-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  يقوم نظام الحماية بالفحص الفوري للتأكد من أن الدخول يتم عبر أجهزة جوالات أو أجهزة كمبيوتر حقيقية لمنع إحالات البريد العشوائي.
                </div>
             </div>
          </section>

          {/* INFO BANNER */}
          <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8">
             <p className="text-center text-zinc-500 font-bold text-sm">تم إزالة نظام تسجيل الدخول وإتاحة المشاهدة والدردشة بالكامل للجميع بدون حدود للسرعة القصوى.</p>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
