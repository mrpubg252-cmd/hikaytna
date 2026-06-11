import React, { useState } from 'react';
import { User, Activity, ShieldCheck, Sparkles, Sliders } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfileScreen() {
  const [currentName, setCurrentName] = useState(() => {
    return localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

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
