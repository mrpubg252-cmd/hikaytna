import React, { useState, useRef, useEffect } from 'react';
import { useAuth as useContextAuth } from '../context/AuthContext';
import { 
  User, LogOut, Star, Share2, Shield, 
  ChevronDown, Copy, Check, Lock, Unlock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function ProfileMenu() {
  const { user, profile, loading, signOut } = useContextAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    const referralLink = `${window.location.origin}?ref=${profile?.userId}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = () => {
    signOut();
    setIsOpen(false);
  };

  if (loading) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 group"
      >
        {user ? (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black italic text-zinc-100 leading-none">{user.firstName || user.username || 'حسابي'}</p>
              <p className="text-[8px] text-primary font-bold uppercase tracking-widest mt-0.5">
                {profile?.isPremium ? 'PREMIUM' : `${profile?.points || 0}/10 PTS`}
              </p>
            </div>
            <div className="relative">
              <img 
                src={user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                className="w-8 h-8 rounded-full border border-white/20 shadow-lg"
                alt="Profile"
              />
              {profile?.isPremium && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-zinc-950 flex items-center justify-center">
                  <Star className="w-1.5 h-1.5 text-black fill-black" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-[10px] font-black italic text-white uppercase tracking-widest pl-2">تسجيل الدخول</span>
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <User className="w-4 h-4 text-zinc-400" />
            </div>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full mt-3 left-0 w-72 bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[60]"
          >
            {!user ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-black italic mb-2">عضوية بريميوم</h3>
                <p className="text-xs text-zinc-500 mb-6 font-medium">سجل دخولك لجمع النقاط وإزالة الإعلانات مجاناً</p>
                <button 
                  onClick={() => { navigate('/profile'); setIsOpen(false); }}
                  className="w-full bg-primary text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Star className="w-4 h-4 fill-black" />
                  بدء تسجيل الدخول
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Header Profile */}
                <div className="p-6 bg-white/5 border-b border-white/5 flex flex-col items-center text-center">
                  <img 
                    src={user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                    className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-2xl mb-3"
                    alt="Avatar" 
                  />
                  <h3 className="font-black italic text-zinc-100">{user.fullName || user.username}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    {profile?.isPremium ? 'Premium Member' : 'Regular Member'}
                  </p>
                </div>

                {/* Progress Section */}
                <div className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-zinc-400">نظام النقاط</span>
                      <span className={profile?.isPremium ? 'text-primary' : 'text-zinc-500'}>
                        {profile?.points || 0} / 10
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(((profile?.points || 0) / 10) * 100, 100)}%` }}
                        className="h-full bg-primary shadow-[0_0_15px_rgba(229,9,20,0.5)]"
                      />
                    </div>
                    {!profile?.isPremium && (
                      <p className="text-[9px] text-zinc-500 font-bold text-center">
                        تتبقى لك {Math.max(10 - (profile?.points || 0), 0)} نقاط لإزالة الإعلانات
                      </p>
                    )}
                  </div>

                  {/* Referral Link */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      <Share2 className="w-3 h-3" />
                      رابط الدعوة الخاص بك
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-mono text-zinc-500 truncate">
                        {`${window.location.origin}?ref=${profile?.userId}`}
                      </div>
                      <button 
                        onClick={handleCopy}
                        className={`p-2 rounded-xl border transition-all ${copied ? 'bg-green-500/20 border-green-500/50 text-green-500' : 'bg-white/5 border-white/10 text-white'}`}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Logout */}
                <button 
                  onClick={handleSignOut}
                  className="w-full p-5 flex items-center justify-center gap-2 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5 text-xs font-black uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
