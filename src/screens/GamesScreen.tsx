import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Info, Star, Share2, Copy, Check, Clock, 
  Trophy, Flame, ChevronRight, Play, RefreshCw, ShieldAlert 
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

// Modular Games Imports
import HorrorMaze from '../components/games/HorrorMaze';
import SpaceRacer from '../components/games/SpaceRacer';
import Ludo from '../components/games/Ludo';
import TicTacToe from '../components/games/TicTacToe';
import Darts from '../components/games/Darts';
import Chess from '../components/games/Chess';
import Backgammon from '../components/games/Backgammon';
import Solitaire from '../components/games/Solitaire';

// Game Types
type ActiveGame = 'horror' | 'racer' | 'ludo' | 'chess' | 'backgammon' | 'tic_tac_toe' | 'solitaire' | 'darts' | null;

export default function GamesScreen() {
  // Game States
  const [isIntroActive, setIsIntroActive] = useState(() => {
    return sessionStorage.getItem('games_intro_performed') !== 'true';
  });
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [hasAdRemoved, setHasAdRemoved] = useState(() => {
    return localStorage.getItem('ads_removed_forever') === 'true';
  });

  // Daily attempts management (5 attempts per 24 hours)
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [nextResetTime, setNextResetTime] = useState<string>('');

  // Referral / User ID state
  const [myReferralId, setMyReferralId] = useState('');

  // Settle user ID and load current attempts
  useEffect(() => {
    // 1. Generate/Load Referral ID
    let refId = localStorage.getItem('my_referral_id');
    if (!refId) {
      refId = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('my_referral_id', refId);
    }
    setMyReferralId(refId);

    // 2. Load Point Balance
    fetch(`/api/v1/referral/points?id=${refId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setUserPoints(data.points);
          if (data.points >= 10) {
            localStorage.setItem('ads_removed_forever', 'true');
            setHasAdRemoved(true);
          }
        }
      })
      .catch(err => console.warn('Points fetch failed:', err));

    // 3. Game attempts manager (with 24h reset safety)
    const storedAttempts = localStorage.getItem('saved_game_attempts_v1');
    const storedTimestamp = localStorage.getItem('game_attempts_reset_time_v1');
    const now = Date.now();

    if (storedAttempts && storedTimestamp) {
      const remainingTime = parseInt(storedTimestamp, 10) - now;
      if (remainingTime <= 0) {
        // Reset as 24h expired
        localStorage.setItem('saved_game_attempts_v1', '5');
        localStorage.setItem('game_attempts_reset_time_v1', (now + 24 * 60 * 60 * 1000).toString());
        setAttemptsRemaining(5);
        updateResetLabel(now + 24 * 60 * 60 * 1000);
      } else {
        setAttemptsRemaining(parseInt(storedAttempts, 10));
        updateResetLabel(parseInt(storedTimestamp, 10));
      }
    } else {
      localStorage.setItem('saved_game_attempts_v1', '5');
      localStorage.setItem('game_attempts_reset_time_v1', (now + 24 * 60 * 60 * 1000).toString());
      setAttemptsRemaining(5);
      updateResetLabel(now + 24 * 60 * 60 * 1000);
    }

    // 4. Trigger alert notice if the visitor tried to cheat by clicking their own link
    const params = new URLSearchParams(window.location.search);
    const incomingRef = params.get('ref');
    if (incomingRef && incomingRef === refId) {
      alert('🔔 تنبيه النظام الذكي: لقد ضغطت على رابط الإحالة الخاص بك! يرجى مشاركة الرابط مع الزملاء أو الأصدقاء للحصول على المكافآت الحقيقية ومنع حظر الحساب. 🧡');
    }
  }, []);

  const updateResetLabel = (targetTime: number) => {
    const hoursRemaining = Math.max(0, Math.ceil((targetTime - Date.now()) / (1000 * 60 * 60)));
    setNextResetTime(`${hoursRemaining} ساعة`);
  };

  const handleStartGame = (game: ActiveGame) => {
    if (attemptsRemaining <= 0) {
      alert('⚠️ عذراً! لقد نفذت محاولاتك اليومية (5/5). يمكنك المحاولة غداً لمواصلة جمع النقاط، أو مشاركة رابط الإحالة الخاص بك لتسجيل نقاط جديدة وإلغاء الإعلانات فوراً!');
      return;
    }

    // Deduct attempt
    const newAttempts = attemptsRemaining - 1;
    setAttemptsRemaining(newAttempts);
    localStorage.setItem('saved_game_attempts_v1', newAttempts.toString());
    setActiveGame(game);
  };

  const handleEarnPoints = (earned: number) => {
    if (earned <= 0) return;
    setUserPoints(prev => {
      const nextPoints = prev + earned;
      // Sync on backend
      fetch('/api/v1/referral/add-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: myReferralId, amount: earned })
      })
      .then(res => res.json())
      .then(data => {
        if (data.status && data.points >= 10) {
          localStorage.setItem('ads_removed_forever', 'true');
          setHasAdRemoved(true);
        }
      })
      .catch(err => console.error('Points increment backend error:', err));

      return nextPoints;
    });
  };

  const skipIntro = () => {
    sessionStorage.setItem('games_intro_performed', 'true');
    setIsIntroActive(false);
  };

  // Skip delay trigger
  useEffect(() => {
    if (isIntroActive) {
      const timer = setTimeout(() => {
        skipIntro();
      }, 4200);
      return () => clearTimeout(timer);
    }
  }, [isIntroActive]);

  const handleCopyLink = () => {
    const referralLink = `${window.location.origin}?ref=${myReferralId}`;
    navigator.clipboard.writeText(referralLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleManualRedeemAdFree = () => {
    if (userPoints >= 10) {
      localStorage.setItem('ads_removed_forever', 'true');
      setHasAdRemoved(true);
      alert('🎉 مبارك! تم تفعيل وضع البريميوم المجاني مدى الحياة وحذف جميع صفحات الإعلانات بشكل كامل وبدون تأخير!');
    } else {
      alert(`🔒 تبقت لك ${10 - userPoints} نقاط لفتح الميزة الذهبية مجاناً.`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans relative overflow-x-hidden">
      <Header />

      {/* Intro Animation Layer */}
      <AnimatePresence>
        {isIntroActive && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(15px)' }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[100000] bg-gradient-to-b from-[#020205] via-[#050512] to-[#010103] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            {/* Pulsing Starry Sky */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black/90 to-black pointer-events-none" />
            
            <button 
              onClick={skipIntro}
              className="absolute top-8 left-8 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black text-zinc-400 hover:text-white rounded-full transition-all cursor-pointer z-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>تخطي الحركة ⚡</span>
            </button>

            <div className="relative space-y-12 max-w-lg w-full flex flex-col items-center">
              {/* Massive Custom PlayStation Controller SVG */}
              <motion.div
                initial={{ scale: 0.3, rotate: -45, y: 100, opacity: 0 }}
                animate={{ 
                  scale: [0.3, 1.1, 1], 
                  rotate: [-45, 10, 0], 
                  y: [100, -20, 0], 
                  opacity: 1 
                }}
                transition={{ 
                  duration: 1.8, 
                  times: [0, 0.4, 0.8, 1],
                  type: 'spring', 
                  bounce: 0.3 
                }}
                className="w-48 h-48 sm:w-64 sm:h-64 filter drop-shadow-[0_0_35px_rgba(229,9,20,0.4)]"
              >
                <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-zinc-300">
                  <path d="M128 352c-24-32-48-96-48-128s32-96 64-96h224c32 0 64 64 64 96s-24 96-48 128" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="224" y="240" width="64" height="20" rx="10" fill="currentColor"/>
                  {/* Left D-Pad */}
                  <path d="M144 192v48M120 216h48" stroke="#E50914" strokeWidth="16" strokeLinecap="round"/>
                  {/* Right Buttons Classic Playstation Symbology */}
                  <circle cx="368" cy="192" r="12" stroke="#4b5563" strokeWidth="6" fill="none" />
                  <path d="M356 240l24-24M380 240l-24-24" stroke="#E50914" strokeWidth="6" strokeLinecap="round"/>
                  {/* Glowing Joysticks */}
                  <circle cx="200" cy="288" r="32" fill="#1f2937" stroke="#4b5563" strokeWidth="8"/>
                  <circle cx="312" cy="288" r="32" fill="#1f2937" stroke="#4b5563" strokeWidth="8"/>
                </svg>
              </motion.div>

              {/* Glowing Warp Trail Effect */}
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 4, 0], opacity: [0, 0.8, 0] }}
                transition={{ duration: 1.4, delay: 0.8 }}
                className="absolute w-1 h-32 bg-gradient-to-b from-primary to-transparent rounded-full -z-10 blur-sm"
              />

              {/* Text Animation */}
              <div className="space-y-4">
                <motion.h3 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                  className="text-2xl sm:text-3.5xl font-black italic tracking-tighter"
                >
                  صالة ألعاب <span className="bg-gradient-to-r from-primary via-orange-500 to-yellow-500 bg-clip-text text-transparent">حكايتنا التفاعلية</span> 🎮
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.8 }}
                  transition={{ delay: 1.6 }}
                  className="text-xs text-zinc-400 font-bold max-w-sm mx-auto leading-relaxed"
                >
                  العب واجمع النقاط الذهبية لإصدار تذكرة متميزة تحذف الإعلانات كلياً بنقرة واحدة!
                </motion.p>
              </div>

              {/* Controller Ascending Skyward Animation */}
              <motion.div
                animate={{ 
                  y: [0, -350], 
                  scale: [1, 0.05], 
                  opacity: [1, 0] 
                }}
                transition={{ duration: 1.2, delay: 2.8, ease: 'easeIn' }}
                className="absolute inset-x-0 top-0 h-4 w-full pointer-events-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 space-y-8 text-right relative z-10">
        
        {/* WORLD CLASS HERO BANNER with floating 3D Ludo Render */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0c0c16] via-[#12080a] to-[#040409] border-2 border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(229,9,20,0.08),_transparent_55%)] pointer-events-none" />
          
          <div className="space-y-6 max-w-xl flex flex-col items-start text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider">
              🎮 صالة ألعاب الأركيد الكبرى
            </span>
            <h1 className="text-3xl sm:text-4.5xl font-black italic tracking-tight leading-none text-white text-right">
              استمتع بأقوى <br />الألعاب الكلاسيكية 🚀
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-bold leading-relaxed max-w-md text-right">
              مجموعة مختارة ومطوّرة بعناية من الألعاب ثنائية وثلاثية الأبعاد لتحدي الإثارة والذكاء، العب الآن بنقرة واحدة بمحاكاة كاملة الشاشة خالية من الأخطاء والبطء!
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <span className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] sm:text-xs text-zinc-300 font-extrabold flex items-center gap-2">
                🟢 10+ ألعاب فورية
              </span>
              <span className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] sm:text-xs text-zinc-300 font-extrabold flex items-center gap-2">
                🔥 500K+ لاعب نشط
              </span>
              <span className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] sm:text-xs text-zinc-300 font-extrabold flex items-center gap-2">
                ⚡ لعب ملء الشاشة
              </span>
            </div>
          </div>

          {/* Floating 3D Ludo Render Image Wrapper */}
          <motion.div 
            initial={{ y: 0 }}
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-48 h-48 sm:w-64 sm:h-64 relative bg-zinc-950 rounded-[2rem] overflow-hidden shadow-2xl border-2 border-white/10 shrink-0 select-none group"
          >
            <img 
              src="/src/assets/images/ludo_3d_render_1781743492285.jpg" 
              alt="Ludo 3D Majestic Render" 
              className="w-full h-full object-cover transition-transform duration-750 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
              <span className="text-[10px] font-black text-amber-400 tracking-wider">لودو الملوك ثلاثية الأبعاد 🎲</span>
            </div>
          </motion.div>
        </section>

        {/* TOP STATUS BAR: Energy attempt & point counters */}
        <section className="bg-gradient-to-b from-zinc-900/60 to-zinc-950/20 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 text-primary animate-pulse">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black italic">نظام التحدي والجوائز 🏆</h2>
              <p className="text-xs text-zinc-500 font-bold mt-1">اجمع النقاط لفتح عضوية بريميوم الخالية من الإعلانات كلياً!</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-end w-full md:w-auto">
            {/* Points balance widget */}
            <div className="flex items-center gap-3 bg-zinc-950 border border-white/10 px-5 py-3.5 rounded-2.5xl">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block font-bold leading-none">رصيدك الحالي</span>
                <span className="text-sm font-black text-amber-400 block mt-1">{userPoints} نقطة</span>
              </div>
            </div>

            {/* Daily attempts energy widget */}
            <div className="flex items-center gap-3 bg-zinc-950 border border-white/10 px-5 py-3.5 rounded-2.5xl">
              <Clock className="w-5 h-5 text-emerald-400" />
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block font-bold leading-none">طاقة اللعب المتبقية</span>
                <span className="text-sm font-black text-white block mt-1">
                  {attemptsRemaining} / 5 محاولات
                </span>
              </div>
            </div>

            {/* Status premium unlock */}
            <button
              onClick={handleManualRedeemAdFree}
              className={`px-5 py-3.5 rounded-2.5xl font-black text-xs transition-with-duration hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 ${
                hasAdRemoved 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                  : 'bg-primary text-black hover:scale-105 active:scale-95 shadow-lg shadow-primary/20'
              }`}
            >
              <Star className={`w-4 h-4 ${hasAdRemoved ? 'fill-current' : 'fill-black'}`} />
              <span>{hasAdRemoved ? 'وضع البريميوم نشط ✨' : 'تفعيل الإزالة الأبدية للإعلانات (10 نقاط)'}</span>
            </button>
          </div>
        </section>

        {attemptsRemaining === 0 && (
          <section className="bg-red-950/20 border border-red-500/20 rounded-[2rem] p-6 space-y-4">
             <div className="flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-primary shrink-0 mt-1" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-[#fda4af]">نفذت طاقتك اليومية! ⏰</h4>
                  <p className="text-xs text-[#f43f5e] font-bold">
                    تنتهي المهلة خلال <span className="font-black bg-[#991b1b]/50 px-2.5 py-0.5 rounded-md text-white">{nextResetTime}</span> لتجديد طاقتك مجدداً.
                  </p>
                  <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">
                    يمكنك أيضاً كسب الطاقة والنقاط مجاناً وبلا حدود عبر دعوة زملائك لدخول الموقع ودعمك!
                  </p>
                </div>
             </div>

             {/* Referral widget */}
             <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 w-full text-right">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">رابط إحالتك الفريد</div>
                  <div className="text-xs text-white font-mono select-all break-all">{`${window.location.origin}?ref=${myReferralId}`}</div>
                </div>
                 <button
                   onClick={handleCopyLink}
                   className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-zinc-200 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                 >
                   {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                   <span>{copiedCode ? 'تم النسخ!' : 'نسخ الرابط والبدء بالمشاركة'}</span>
                 </button>
             </div>
          </section>
        )}

        {/* ACTIVE STAGE CANVASES RENDER */}
        <AnimatePresence mode="wait">
          {activeGame === 'horror' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">شبح الرعب ثلاثي الأبعاد</span>
                  <h3 className="text-sm font-black">هروب الظلال الداكنة 💀</h3>
                </div>
              </div>
              <HorrorMaze onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'racer' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-400 bg-cyan-400/10 border border-cyan-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">سرعة أركيد ثنائية الأبعاد</span>
                  <h3 className="text-sm font-black">متسابق الفضاء السيبراني 🚀</h3>
                </div>
              </div>
              <SpaceRacer onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'ludo' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">تحدي لودو كلاسيك</span>
                  <h3 className="text-sm font-black">ملك اللودو VS الذكاء الاصطناعي 🎲</h3>
                </div>
              </div>
              <Ludo onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'chess' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">شطرنج الملوك</span>
                  <h3 className="text-sm font-black">شطرنج حكايتنا 👑</h3>
                </div>
              </div>
              <Chess onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'backgammon' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-550 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">بكغمون شرقي</span>
                  <h3 className="text-sm font-black">طاولة زهر الشرق 🎲</h3>
                </div>
              </div>
              <Backgammon onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'tic_tac_toe' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">تكتيك XO ذكي</span>
                  <h3 className="text-sm font-black">مبارزة إكس أو ❌</h3>
                </div>
              </div>
              <TicTacToe onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'solitaire' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">مطابقة ورق ورق ورق</span>
                  <h3 className="text-sm font-black">سوليتير مطابقة الكروت ♠</h3>
                </div>
              </div>
              <Solitaire onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {activeGame === 'darts' && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-[2.5rem] p-4 sm:p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button 
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الخروج من اللعبة</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">دارتس دقة فيب</span>
                  <h3 className="text-sm font-black">صائد رقعة الهدف 🎯</h3>
                </div>
              </div>
              <Darts onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {/* LIST AVAILABLE GAMES COMPACT BENTO LIST */}
          {!activeGame && (
            <div className="space-y-12">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button className="text-xs font-black text-rose-500 hover:text-white transition flex items-center gap-1">
                  <span>عرض جميع الألعاب ◀</span>
                </button>
                <h2 className="text-xl sm:text-2xl font-black italic text-right flex items-center gap-2">
                  <span>ألعاب مميزة 🎮</span>
                </h2>
              </div>

              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Ludo Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-amber-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(245,158,11,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-650/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">الأكثر شعبية 🎲</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-amber-500 transition-colors">ملك اللودو العرب 🎲</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        اللعبة الكلاسيكية المحبوبة بمحاكاة جميلة من الخشب الفاخر والأشكال الكلاسيكية!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+3 نقاط ذهبية</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>انتصر بمباراة النرد</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('ludo')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

                {/* Chess Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-amber-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(245,158,11,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-650/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">تحدي الذكاء والمناورة ♚</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">شطرنج حكايتنا 👑</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        لعبة الذكاء والاستراتيجية الأكثر عفة، ناور بذكاء وحاصر ملك الخصم!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+3 نقاط مباركة</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>قم بـ هرم كش ملك</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('chess')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

                {/* Backgammon Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-amber-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(245,158,11,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-650/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">زهر وطاولة 🎲</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">طاولة زهر الشرق 🎲</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        لعبة الحظ والتكتيك العريقة، ارمِ زهر النرد البراق وسرّع تقدم قطعك للخارج!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+2 نقاط ثمينة</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>تقدم بـ 100 خطوة أولاً</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('backgammon')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

                {/* TicTacToe Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-primary/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(229,9,20,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-red-650/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-red-600/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">تسلية سريعة ⚡</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-primary transition-colors">مبارزة إكس أو ❌</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        لعبة XO البسيطة والممتعة للغاية بشكل كلاسيكي مدهش، اختبر مهارتك وسرعتك!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+1 نقطة سريعة</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>ثلاثة صفوف متشابهة</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('tic_tac_toe')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

                {/* Solitaire Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-indigo-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(99,102,241,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-indigo-550/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">مطابقة الذاكرة ♣</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-550 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">سوليتير مطابقة الكروت ♠</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        لعبة الأوراق الكلاسيكية، ركّز على صور وبدلات الورق وقم بمطابقتها بنجاح!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+2 نقاط ذهبية</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>طابق الـ 6 مجموعات</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('solitaire')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

                {/* Darts Game */}
                <div className="bg-[#0c0c14] border border-white/5 hover:border-amber-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(245,158,11,0.06)] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-650/5 blur-3xl rounded-full" />
                  <div className="space-y-4 text-right">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">تصويب ودقة 🎯</span>
                       <Gamepad2 className="w-5 h-5 text-zinc-550 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-amber-500 transition-colors">صائد رقعة الهدف 🎯</h3>
                      <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                        أصب الهدف بحجر الرمي ونل نقاطك، اسحب السهم برفق ودعه يستقر بالمنتصف!
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1 font-bold text-zinc-500">
                      <div className="flex justify-between"><span>+2 نقاط فوز</span><span>الجائزة المستهدفة:</span></div>
                      <div className="flex justify-between"><span>أنهي الرميات الثلاث</span><span>الشرط الأساسي:</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGame('darts')}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#ef4444] hover:bg-red-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    <span>العب الآن ◀</span>
                  </button>
                </div>

              </section>

              {/* SPECIAL ACTION ARCADE SECTION */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="text-xs font-black text-[#f43f5e] tracking-widest uppercase">تحديات الأركيد ثلاثية الأبعاد 🌌</span>
                  <h3 className="text-lg font-black text-white italic">تحديات عابرة للفضاء والغموض 🛰️</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Space Racer Card */}
                  <div className="bg-gradient-to-br from-[#040916] to-black border border-white/5 hover:border-cyan-500/20 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row justify-between items-center gap-6 group transition">
                    <div className="space-y-4 text-right flex-1 w-full">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[9px] font-black uppercase tracking-wider">كبسولات الطيران الفضائي</span>
                      <h4 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors">متسابق الفضاء السيبراني 🚀</h4>
                      <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                        حلّق بالكبسولة، تجنب الكويكبات الساقطة من الأعالي، وامتص يورانيوم الوقود لتصل إلى أمان المجرة الكونية!
                      </p>
                      <button
                        onClick={() => handleStartGame('racer')}
                        className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-450 text-black font-black text-xs rounded-xl shadow-lg transition"
                      >
                        بدء كسر المسافة 🪐
                      </button>
                    </div>
                    
                    <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/20 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-xl shrink-0">
                      🚀
                    </div>
                  </div>

                  {/* Horror Escape Card */}
                  <div className="bg-gradient-to-br from-[#120407] to-black border border-white/5 hover:border-red-500/20 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row justify-between items-center gap-6 group transition">
                    <div className="space-y-4 text-right flex-1 w-full">
                      <span className="px-2.5 py-1 rounded-full bg-red-600/10 border border-primary/25 text-primary text-[9px] font-black uppercase tracking-wider">رعب ومتاهات معقدة</span>
                      <h4 className="text-xl font-black text-white group-hover:text-primary transition-colors">هروب رعب ثلاثي الأبعاد 👻</h4>
                      <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                        بث المحاكاة الصوتية المرعبة، ابحث عن مفاتيح السر وتسلل داخل متاهات الجدران الخرسانية بعيداً عن أعين الشبح القاني!
                      </p>
                      <button
                        onClick={() => handleStartGame('horror')}
                        className="px-6 py-3.5 bg-red-650 hover:bg-red-600 text-white font-black text-xs rounded-xl shadow-lg transition"
                      >
                        ولوج ممرات المتاهة 💀
                      </button>
                    </div>

                    <div className="w-24 h-24 bg-red-650/10 border border-primary/20 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-xl shrink-0">
                      💀
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}
        </AnimatePresence>

        {/* CHEAT PREVENTION INFORMATION CARD */}
        <section className="bg-zinc-950/40 border border-white/5 rounded-[2rem] p-6 space-y-4 text-right">
          <div className="flex items-center gap-2 text-primary font-black text-xs">
            <Info className="w-4 h-4" />
            <span>نظام الضمان وموثوقية الإحالات الذكي ⛔</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-bold">
            يتضمن النظام خوارزمية ذكية لمقاومة التلاعب؛ حيث يقوم بالتحقق من بصمة المتصفح، وعناوين IP، والتحقق البشري التفاعلي للأعضاء لدعم حسابك. 
            يرجى تجنب تكرار استخدام جهازك الشخصي لدعم رابطك الخاص لمنع تجميد رصيدك. 
            أرسل الرابط لأصدقائك بجروبات المحادثة لدعمك مجاناً وبكل أمان!
          </p>
        </section>

      </main>

      <BottomNav />
    </div>
  );
}
