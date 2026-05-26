import React from 'react';
import { Sparkles, User, Settings as SettingsIcon } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProfileScreen() {
  const guestName = localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)';
  
  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-24">
        <div className="space-y-8">
          <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
             <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-all" />
                <div className="w-32 h-32 rounded-[2rem] border-4 border-zinc-950 bg-black/50 flex items-center justify-center relative z-10 shadow-2xl transition-transform group-hover:scale-105">
                  <User className="w-16 h-16 text-zinc-500" />
                </div>
              </div>
              
              <div className="text-center md:text-right space-y-2">
                <h1 className="text-4xl font-black italic tracking-tighter text-white">{guestName}</h1>
                <div className="flex items-center justify-center md:justify-end gap-3">
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">حساب دخول مفتوح</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8">
             <p className="text-center text-zinc-500 font-bold text-sm">تم إزالة نظام تسجيل الدخول وإتاحة المشاهدة والدردشة بالكامل للجميع بدون حدود.</p>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
