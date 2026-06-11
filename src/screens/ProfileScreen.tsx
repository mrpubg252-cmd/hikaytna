import React, { useState } from 'react';
import { User, Sparkles, Settings, Activity, ShieldCheck, HelpCircle } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfileScreen() {
  const [currentName, setCurrentName] = useState(() => {
    return localStorage.getItem('guest_chat_name') || 'حساب زائر';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNameInput.trim();
    if (!trimmed || trimmed === 'غير مسجل (حساب زائر)' || trimmed === 'حساب زائر') return;
    localStorage.setItem('guest_chat_name', trimmed);
    setCurrentName(trimmed);
    setIsEditingName(false);
    
    // Fire event to notify chat input or other screens
    window.dispatchEvent(new Event('name-updated'));
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans selection:bg-primary selection:text-white">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-24">
        <div className="space-y-8">
          
          {/* USER CARD PROFILE OVERVIEW */}
          <section className="bg-zinc-950/45 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-zinc-500/10 blur-2xl rounded-full group-hover:from-primary/35 transition-all" />
                <div className="w-28 h-28 rounded-[2rem] border border-white/10 bg-zinc-900/50 flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-300 group-hover:scale-105">
                  <User className="w-14 h-14 text-zinc-400" />
                </div>
              </div>
              
              <div className="text-center md:text-right space-y-3 flex-1">
                <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
                  {isEditingName ? (
                    <form onSubmit={handleRename} className="flex gap-2 items-center w-full max-w-sm">
                      <input 
                        type="text" 
                        value={newNameInput}
                        onChange={(e) => setNewNameInput(e.target.value)}
                        className="bg-black/80 border border-white/10 rounded-xl px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-primary text-right w-full"
                        required
                        placeholder="أدخل اسمك الجديد..."
                        autoFocus
                      />
                      <button 
                        type="submit" 
                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-red-500 transition active:scale-95 shrink-0"
                      >
                        حفظ
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingName(false)}
                        className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-xs font-black hover:bg-zinc-700 transition active:scale-95 shrink-0"
                      >
                        تراجع
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                        {currentName}
                      </h1>
                      <button 
                        onClick={() => {
                          setNewNameInput(currentName === 'حساب زائر' ? '' : currentName);
                          setIsEditingName(true);
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="تعديل اللقب"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-zinc-400 font-extrabold">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-ping" />
                  <span>حساب زائر نشط وآمن</span>
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
              <Sparkles className="w-5 h-5" />
            </div>
            <p>
              تم ترقية تجربة المشاهدة وإزالة الإعلانات المعقدة من داخل مشغل الفيديو لضمان متعة سينمائية سلسة ومجانية بالكامل للجميع!
            </p>
          </section>

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
