import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { 
  Share2, Star, Shield, Copy, Check, 
  LogOut, Award, Zap, Heart, 
  History, Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import AuthContainer from '../components/AuthContainer';

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const { signOut } = useClerkAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const referralLink = `${window.location.origin}?ref=${profile?.userId}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const referralLink = `${window.location.origin}?ref=${profile?.userId}`;
  const points = profile?.points || 0;
  const progress = Math.min((points / 10) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-24">
        {!user ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-10"
          >
            <div className="w-full max-w-lg bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
               {/* Background Decorative Elements */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
               
               <div className="relative z-10">
                 <div className="flex items-center justify-center gap-3 mb-10 text-primary">
                    <Sparkles className="w-8 h-8 animate-pulse" />
                    <span className="text-sm font-black italic tracking-widest uppercase">حكايتنا بريميوم</span>
                 </div>
                 
                 <AuthContainer />
               </div>
            </div>
            
            <p className="mt-8 text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center max-w-xs leading-relaxed">
               بتسجيل دخولك، أنت توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Header Profile */}
            <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
               <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-all" />
                  <img 
                    src={user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                    className="w-32 h-32 rounded-[2rem] border-4 border-zinc-950 relative z-10 shadow-2xl transition-transform group-hover:scale-105"
                    alt="Avatar"
                  />
                  {profile?.isPremium && (
                    <div className="absolute -bottom-2 -right-2 bg-primary p-3 rounded-2xl border-4 border-zinc-950 z-20 shadow-xl">
                      <Star className="w-5 h-5 text-black fill-black" />
                    </div>
                  )}
                </div>
                
                <div className="text-center md:text-right space-y-2">
                  <h1 className="text-4xl font-black italic tracking-tighter text-white">{user.fullName || user.username}</h1>
                  <div className="flex items-center justify-center md:justify-end gap-3">
                    <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">{user.primaryEmailAddress?.emailAddress}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="pt-3 flex flex-wrap justify-center md:justify-end gap-3 text-[11px] font-black uppercase tracking-wider italic">
                     <span className="bg-zinc-800/50 px-4 py-2 rounded-xl border border-white/10 text-zinc-300">ID: {user.id.slice(-6)}</span>
                     <span className={`px-4 py-2 rounded-xl border ${profile?.isPremium ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        {profile?.isPremium ? 'PREMIUM MEMBER' : 'FREE MEMBER'}
                     </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Referral Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black italic flex items-center gap-3">
                    <Award className="w-6 h-6 text-primary" />
                    نظام النقاط
                  </h2>
                  <span className="font-mono text-primary font-black italic">{points} / 10</span>
                </div>
                
                <div className="space-y-4">
                  <div className="h-4 bg-black/40 border border-white/5 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-red-600 to-primary"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed">
                    {profile?.isPremium 
                      ? "تهانينا! لقد حصلت على العضوية المميزة، جميع الإعلانات متوقفة الآن." 
                      : `اجمع ${10 - points} نقاط إضافية لترقية حسابك وإزالة الإعلانات للأبد.`}
                  </p>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                   <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                     <Share2 className="w-3 h-3" />
                     رابط الإحالة
                   </div>
                   <div className="flex gap-2">
                     <div className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-500 truncate">
                       {referralLink}
                     </div>
                     <button 
                        onClick={handleCopy}
                        className={`p-3 rounded-xl border transition-all ${copied ? 'bg-green-500/20 border-green-500/50 text-green-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                     >
                       {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                     </button>
                   </div>
                </div>
              </section>

              <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 grid grid-cols-2 gap-4">
                 <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
                    <Zap className="w-8 h-8" />
                    <span className="text-[10px] font-black uppercase">المشاهدات</span>
                 </button>
                 <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
                    <Heart className="w-8 h-8" />
                    <span className="text-[10px] font-black uppercase">المفضلة</span>
                 </button>
                 <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
                    <History className="w-8 h-8" />
                    <span className="text-[10px] font-black uppercase">السجل</span>
                 </button>
                 <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
                    <SettingsIcon className="w-8 h-8" />
                    <span className="text-[10px] font-black uppercase">الإعدادات</span>
                 </button>
              </section>
            </div>

            <button 
              onClick={() => signOut()}
              className="w-full p-6 text-zinc-500 hover:text-red-500 transition-colors font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 border border-white/5 rounded-2xl hover:bg-red-500/5 hover:border-red-500/20"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج من الحساب
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
