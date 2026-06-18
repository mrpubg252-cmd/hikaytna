import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Info, Star, Share2, Copy, Check, Clock, 
  Tv, Trophy, Flame, ChevronRight, Play, RefreshCw, 
  Volume2, ShieldAlert, Heart, Zap, PlaySquare
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { getApiUrl } from '../lib/apiConfig';

// Game Types
type ActiveGame = 'horror' | 'racer' | 'ludo' | null;

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
      alert('⚠️ عذراً! لقد نفذت محاولاتك اليومية (5/5). يمكنك الانتشار للغد لمواصلة جمع النقاط أو مشاركة رابط الإحالة الخاص بك لتسجيل نقاط جديدة وإلغاء الإعلانات فوراً!');
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
              className={`px-5 py-3.5 rounded-2.5xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 ${
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
              <HorrorMazeGame onGameEnd={handleEarnPoints} />
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
                  <span className="text-[10px] text-cyan-400 bg-cyan-450/10 border border-cyan-450/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">سرعة أركيد ثنائية الأبعاد</span>
                  <h3 className="text-sm font-black">متسابق الفضاء السيبراني 🚀</h3>
                </div>
              </div>
              <SpaceRacerGame onGameEnd={handleEarnPoints} />
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
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wider animate-pulse">تحدي لودو كلاسيك</span>
                  <h3 className="text-sm font-black">ملك اللودو VS الذكاء الاصطناعي 🎲</h3>
                </div>
              </div>
              <LudoGame onGameEnd={handleEarnPoints} />
            </motion.section>
          )}

          {/* LIST AVAILABLE GAMES COMPACT BENTO LIST */}
          {!activeGame && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Game Card 1: 3D Horror Maze */}
              <div className="bg-zinc-900/40 border border-white/5 hover:border-red-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(229,9,20,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/5 blur-3xl rounded-full" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] bg-red-600/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">ثلاثية الأبعاد رعب</span>
                     <Gamepad2 className="w-5 h-5 text-zinc-550 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-primary transition-colors">الهروب من الظلال الفطنة 👻</h3>
                    <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                      ادخل المتاهة المظلمة ثلاثية الأبعاد، تجنب مطاردة الشبح القرمزي، وابحث عن مفاتيح الخروج لتربح النقاط!
                    </p>
                  </div>
                  
                  {/* Features list */}
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1.5 font-bold text-zinc-500">
                    <div className="flex justify-between"><span>+2 نقاط ذهبية</span><span>الجائزة المستهدفة:</span></div>
                    <div className="flex justify-between"><span>العثور على 3 مفاتيح</span><span>شرط تحقيق الفوز:</span></div>
                    <div className="flex justify-between"><span>لوحة أسهم / أزرار شاشة</span><span>قناة التحكم لليسار:</span></div>
                  </div>
                </div>

                <button
                  onClick={() => handleStartGame('horror')}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-red-650 hover:bg-red-600 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>افتح بوابة الهروب 💀</span>
                </button>
              </div>

              {/* Game Card 2: Space Racer */}
              <div className="bg-zinc-900/40 border border-white/5 hover:border-cyan-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(6,182,212,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-600/5 blur-3xl rounded-full" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">سباق فضاء أركيد</span>
                     <Gamepad2 className="w-5 h-5 text-zinc-550 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors">متسابق الفضاء السيبراني 🚀</h3>
                    <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                      وجه كبسولتك الكونية عبر الحقول المغناطيسية، تفادى الكويكبات القاتلة الساقطة وابتلع الوقود لكسب نقاط كبرى!
                    </p>
                  </div>

                  {/* Features list */}
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1.5 font-bold text-zinc-500">
                    <div className="flex justify-between"><span>+2 نقاط ذهبية</span><span>الجائزة المستهدفة:</span></div>
                    <div className="flex justify-between"><span>تجاوز 500 متر مسافة</span><span>شرط تحقيق الفوز:</span></div>
                    <div className="flex justify-between"><span>لمس الجانبين / أسهم كيبورد</span><span>طريقة التوجيه:</span></div>
                  </div>
                </div>

                <button
                  onClick={() => handleStartGame('racer')}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-cyan-550 hover:bg-cyan-500 active:scale-95 text-black font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>أطلق المحركات الكونية 🪐</span>
                </button>
              </div>

              {/* Game Card 3: Classical Ludo */}
              <div className="bg-zinc-900/40 border border-white/5 hover:border-amber-500/25 rounded-[2rem] p-6 flex flex-col justify-between space-y-6 transition-all duration-300 md:hover:scale-[1.01] hover:shadow-[0_15px_40px_rgba(245,158,11,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-600/5 blur-3xl rounded-full" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] bg-amber-600/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">تحدي ذكاء كلاسيكي</span>
                     <Gamepad2 className="w-5 h-5 text-zinc-550 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">ملك لودو العرب 🎲</h3>
                    <p className="text-xs text-zinc-400 font-bold mt-1.5 leading-relaxed">
                      نافس المساعد البرمجي بمباراة ريفية ذهبية تمنحك إحساس الطاولات الحقيقية. دحرج النرد وحرك قطعك باحتراف!
                    </p>
                  </div>

                  {/* Features list */}
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1.5 font-bold text-zinc-500">
                    <div className="flex justify-between"><span>+3 نقاط بريميوم</span><span>النقاط المستهدفة:</span></div>
                    <div className="flex justify-between"><span>الفوز على الخصم الذكي</span><span>شرط تحقيق الفوز:</span></div>
                    <div className="flex justify-between"><span>نقرة لمس بسيطة</span><span>طرق التحكم والتحريك:</span></div>
                  </div>
                </div>

                <button
                  onClick={() => handleStartGame('ludo')}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-amber-550 hover:bg-amber-500 active:scale-95 text-black font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>ارمي حجر النرد الملكي 👑</span>
                </button>
              </div>

            </section>
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

/* ==========================================
   GAME 1: 3D ESCAPE HORROR MAZE
   ========================================== */
function HorrorMazeGame({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'won'>('idle');
  const [keysFound, setKeysFound] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  
  // Game loops values inside refs to bypass react state latency
  const playerRef = useRef({ x: 1.5, y: 1.5, angle: 0 });
  const keysRef = useRef<{ x: number, y: number, found: boolean }[]>([
    { x: 3.5, y: 3.5, found: false },
    { x: 6.5, y: 1.5, found: false },
    { x: 1.5, y: 6.5, found: false },
  ]);
  const ghostRef = useRef({ x: 7.5, y: 7.5 });
  const keysCountRef = useRef(0);

  // Spooky 3D Maze layout
  const map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];

  const startGame = () => {
    playerRef.current = { x: 1.5, y: 1.5, angle: 0 };
    keysRef.current = [
      { x: 3.5, y: 3.5, found: false },
      { x: 6.5, y: 1.5, found: false },
      { x: 1.5, y: 6.5, found: false },
    ];
    ghostRef.current = { x: 7.5, y: 7.5 };
    keysCountRef.current = 0;
    setKeysFound(0);
    setSurvivalTime(0);
    setGameState('playing');
  };

  // Keyboard controls listener
  useEffect(() => {
    if (gameState !== 'playing') return;

    let localKeys = { w: false, s: false, a: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') localKeys.w = true;
      if (key === 's' || e.key === 'ArrowDown') localKeys.s = true;
      if (key === 'a' || e.key === 'ArrowLeft') localKeys.a = true;
      if (key === 'd' || e.key === 'ArrowRight') localKeys.d = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') localKeys.w = false;
      if (key === 's' || e.key === 'ArrowDown') localKeys.s = false;
      if (key === 'a' || e.key === 'ArrowLeft') localKeys.a = false;
      if (key === 'd' || e.key === 'ArrowRight') localKeys.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = Date.now();
    let animId: number;

    const gameLoop = () => {
      if (gameState !== 'playing') return;

      const delta = (Date.now() - lastTime) / 1000;
      lastTime = Date.now();

      // Survival Timer increment
      setSurvivalTime(prev => prev + delta);

      // Player Rotation and movement logic
      const rotSpeed = 2.5;
      const moveSpeed = 1.8;

      if (localKeys.a) {
        playerRef.current.angle -= rotSpeed * delta;
      }
      if (localKeys.d) {
        playerRef.current.angle += rotSpeed * delta;
      }

      let dx = 0;
      let dy = 0;

      if (localKeys.w) {
        dx += Math.cos(playerRef.current.angle) * moveSpeed * delta;
        dy += Math.sin(playerRef.current.angle) * moveSpeed * delta;
      }
      if (localKeys.s) {
        dx -= Math.cos(playerRef.current.angle) * moveSpeed * delta;
        dy -= Math.sin(playerRef.current.angle) * moveSpeed * delta;
      }

      // Safe collision test
      const nextX = playerRef.current.x + dx;
      const nextY = playerRef.current.y + dy;

      if (map[Math.floor(playerRef.current.y)][Math.floor(nextX)] === 0) {
        playerRef.current.x = nextX;
      }
      if (map[Math.floor(nextY)][Math.floor(playerRef.current.x)] === 0) {
        playerRef.current.y = nextY;
      }

      // Ghost Pursuit logic (moves slowly towards players)
      const ghostSpd = 0.85;
      const gDx = playerRef.current.x - ghostRef.current.x;
      const gDy = playerRef.current.y - ghostRef.current.y;
      const distToGhost = Math.sqrt(gDx*gDx + gDy*gDy);

      ghostRef.current.x += (gDx / distToGhost) * ghostSpd * delta;
      ghostRef.current.y += (gDy / distToGhost) * ghostSpd * delta;

      // Contact with ghost triggers GameOver
      if (distToGhost < 0.35) {
        setGameState('gameover');
        return;
      }

      // Keys gathering logic
      keysRef.current.forEach((k) => {
        if (!k.found) {
          const kDx = playerRef.current.x - k.x;
          const kDy = playerRef.current.y - k.y;
          const kDist = Math.sqrt(kDx*kDx + kDy*kDy);
          if (kDist < 0.35) {
            k.found = true;
            keysCountRef.current++;
            setKeysFound(keysCountRef.current);

            if (keysCountRef.current >= 3) {
              setGameState('won');
              onGameEnd(2); // Award 2 points
            }
          }
        }
      });

      // RENDER STYLISH MULTI-PERSPECTIVE HORROR SCENE ON CANVAS
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Render ceiling/floor gradient
          let halfWidth = canvas.width / 2;
          let halfHeight = canvas.height / 2;

          let ceilGrad = ctx.createLinearGradient(0, 0, 0, halfHeight);
          ceilGrad.addColorStop(0, '#000000');
          ceilGrad.addColorStop(1, '#0e0202');
          ctx.fillStyle = ceilGrad;
          ctx.fillRect(0, 0, canvas.width, halfHeight);

          let floorGrad = ctx.createLinearGradient(0, halfHeight, 0, canvas.height);
          floorGrad.addColorStop(0, '#030303');
          floorGrad.addColorStop(1, '#0c0202');
          ctx.fillStyle = floorGrad;
          ctx.fillRect(0, halfHeight, canvas.width, halfHeight);

          // Simple 3D First Person raycasting rendering simulation
          const fov = Math.PI / 3;
          const numRays = 120;
          const rayStep = fov / numRays;
          const eyeX = playerRef.current.x;
          const eyeY = playerRef.current.y;

          for (let i = 0; i < numRays; i++) {
            const rayAngle = playerRef.current.angle - (fov / 2) + i * rayStep;
            let rayDist = 0;
            let hitWall = false;

            const cosRA = Math.cos(rayAngle);
            const sinRA = Math.sin(rayAngle);

            while (!hitWall && rayDist < 12) {
              rayDist += 0.05;
              const testX = Math.floor(eyeX + cosRA * rayDist);
              const testY = Math.floor(eyeY + sinRA * rayDist);

              if (testX < 0 || testX >= 9 || testY < 0 || testY >= 9) {
                hitWall = true;
                rayDist = 12;
              } else if (map[testY][testX] === 1) {
                hitWall = true;
              }
            }

            // Draw Wall strip
            const sliceWidth = canvas.width / numRays;
            // Fisheye correction
            const stepAng = rayAngle - playerRef.current.angle;
            const correctedDist = rayDist * Math.cos(stepAng);
            const wallHeight = Math.min(canvas.height, (canvas.height / correctedDist) * 1.2);

            // Shading color based on distance and texture
            const shade = Math.max(0, 1 - correctedDist / 10);
            const hexShade = Math.floor(180 * shade);
            ctx.fillStyle = `rgb(${hexShade}, ${Math.floor(10 * shade)}, ${Math.floor(15 * shade)})`;
            ctx.fillRect(i * sliceWidth, halfHeight - wallHeight/2, sliceWidth + 0.5, wallHeight);
          }

          // Ambient 2D Spooky Radar overlay for immersive play!
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(canvas.width - 110, 10, 100, 100);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(canvas.width - 110, 10, 100, 100);

          // Grid and entities scale in Radar
          const radarScale = 11;
          // Render Ghost on radar
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(canvas.width - 110 + ghostRef.current.x * radarScale, 10 + ghostRef.current.y * radarScale, 3, 0, Math.PI * 2);
          ctx.fill();

          // Render player on radar
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(canvas.width - 110 + playerRef.current.x * radarScale, 10 + playerRef.current.y * radarScale, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Render active keys on radar
          ctx.fillStyle = '#f59e0b';
          keysRef.current.forEach(k => {
            if (!k.found) {
              ctx.beginPath();
              ctx.arc(canvas.width - 110 + k.x * radarScale, 10 + k.y * radarScale, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Text metrics overlay inside canvas
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`المفاتيح المجمعة: ${keysCountRef.current}/3 🔑`, 15, 25);
          ctx.fillText(`وقت الصمود: ${Math.floor(survivalTime)} ثانية`, 15, 42);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Handle on-screen arrow directions click for mobile support
  const handleArrowClick = (dir: 'a' | 'd' | 'w' | 's') => {
    const rotSpeed = 0.5;
    const moveSpeed = 0.35;
    if (dir === 'a') playerRef.current.angle -= rotSpeed;
    if (dir === 'd') playerRef.current.angle += rotSpeed;
    
    let dx = 0;
    let dy = 0;
    if (dir === 'w') {
      dx += Math.cos(playerRef.current.angle) * moveSpeed;
      dy += Math.sin(playerRef.current.angle) * moveSpeed;
    }
    if (dir === 's') {
      dx -= Math.cos(playerRef.current.angle) * moveSpeed;
      dy -= Math.sin(playerRef.current.angle) * moveSpeed;
    }

    const nextX = playerRef.current.x + dx;
    const nextY = playerRef.current.y + dy;
    if (map[Math.floor(playerRef.current.y)][Math.floor(nextX)] === 0) playerRef.current.x = nextX;
    if (map[Math.floor(nextY)][Math.floor(playerRef.current.x)] === 0) playerRef.current.y = nextY;
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full">
      
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-red-600/10 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-base font-black italic">هروب الظلال: رعب المتاهة الفائق</h4>
          <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">
            استكشف المتاهة ثلاثية الأبعاد واجمع 3 مفاتيح ذهبية لفتح مخرج الطوارئ والهروب قبل أن يلحق بك شبح القصر الأحمر!
          </p>
          <button
            onClick={startGame}
            className="px-8 py-3.5 bg-primary text-black font-black text-xs rounded-xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            بدء اللعب الفوري
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-4 w-full">
          <div className="relative border-4 border-zinc-900 rounded-[2rem] overflow-hidden bg-black max-w-md mx-auto aspect-[4/3] w-full">
            <canvas 
              ref={canvasRef} 
              width={400} 
              height={300} 
              className="w-full h-full block" 
            />
          </div>

          {/* Touch direction joypad buttons for mobile */}
          <div className="grid grid-cols-3 gap-2 w-48 mx-auto mt-4" dir="ltr">
            <div />
            <button 
              onClick={() => handleArrowClick('w')}
              className="w-12 h-12 bg-zinc-900/80 active:bg-red-650 rounded-xl border border-white/10 flex items-center justify-center active:scale-90 transition cursor-pointer"
            >
              ▲
            </button>
            <div />
            <button 
              onClick={() => handleArrowClick('a')}
              className="w-12 h-12 bg-zinc-900/80 active:bg-red-650 rounded-xl border border-white/10 flex items-center justify-center active:scale-90 transition cursor-pointer"
            >
              ◀
            </button>
            <button 
              onClick={() => handleArrowClick('s')}
              className="w-12 h-12 bg-zinc-900/80 active:bg-red-650 rounded-xl border border-white/10 flex items-center justify-center active:scale-90 transition cursor-pointer"
            >
              ▼
            </button>
            <button 
              onClick={() => handleArrowClick('d')}
              className="w-12 h-12 bg-zinc-900/80 active:bg-red-650 rounded-xl border border-white/10 flex items-center justify-center active:scale-90 transition cursor-pointer"
            >
              ▶
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 font-extrabold">ملاحظة: يمكنك استخدام أسهم لوحة المفاتيح أو أزرار W/A/S/D للتوجيه أيضاً!</p>
        </div>
      )}

      {(gameState === 'gameover' || gameState === 'won') && (
        <div className="py-12 space-y-6 max-w-sm">
          <div className={`p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2 ${
            gameState === 'won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-600/10 text-primary border border-primary/20'
          }`}>
             <span className="text-4xl">{gameState === 'won' ? '🏆' : '💀'}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-black italic">
              {gameState === 'won' ? 'تهانينا الحارة! ركضت ونجوت 🎉' : 'عذراً! أمسك شبح القصر بظلالك 💀'}
            </h4>
            <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">
              {gameState === 'won' 
                ? 'لقد استجمعت قواك بنجاح وحصدت جميع المفاتيح وحصلت على خطوة إضافية تمنحك نقطتين لقائمتك الذهبية!'
                : 'لقد قاتلت وصمدت بنجاح لعدة ثوانٍ ولكن المطاردة انتهت بالقبض عليك. حاول مراراً وتكراراً للفوز!'}
            </p>
          </div>

          <div className="flex bg-zinc-950/60 border border-white/10 p-4 rounded-2xl justify-between text-xs font-bold w-full">
            <span>المفاتيح: {keysFound}/3 🔑</span>
            <span>الصمود: {Math.floor(survivalTime)} ثانية ⏱️</span>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 px-6 bg-white text-black font-black text-xs rounded-2xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>إعادة محاولة اللعب</span>
          </button>
        </div>
      )}

    </div>
  );
}

/* ==========================================
   GAME 2: SPACE RACER VERTICAL Runner
   ========================================== */
function SpaceRacerGame({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'won'>('idle');
  const [score, setScore] = useState(0);

  // Core ref values for fluid frame cycle
  const playerX = useRef(150);
  const asteroids = useRef<{ x: number, y: number, speed: number, size: number }[]>([]);
  const fuelCells = useRef<{ x: number, y: number }[]>([]);
  const gameScoreRef = useRef(0);

  const startGame = () => {
    playerX.current = 150;
    asteroids.current = [];
    fuelCells.current = [];
    gameScoreRef.current = 0;
    setScore(0);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    let localKeys = { left: false, right: false };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') localKeys.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') localKeys.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') localKeys.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') localKeys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animId: number;
    let spawnTimer = 0;

    const gameLoop = () => {
      if (gameState !== 'playing') return;

      // Adjust player positions
      const speed = 5;
      if (localKeys.left) playerX.current = Math.max(20, playerX.current - speed);
      if (localKeys.right) playerX.current = Math.min(280, playerX.current + speed);

      // Increment raw score distance
      gameScoreRef.current += 1;
      setScore(Math.floor(gameScoreRef.current / 5));

      // Spawning entities
      spawnTimer++;
      if (spawnTimer % 25 === 0) {
        asteroids.current.push({
          x: Math.random() * 280 + 10,
          y: -20,
          speed: Math.random() * 3 + 2.5,
          size: Math.random() * 14 + 10
        });
      }

      if (spawnTimer % 60 === 0) {
        fuelCells.current.push({
          x: Math.random() * 280 + 10,
          y: -20
        });
      }

      // Update Asteroids position and bounds checking
      asteroids.current.forEach((ast, idx) => {
        ast.y += ast.speed;
        
        // Collisions test
        const dist = Math.sqrt((playerX.current - ast.x)**2 + (270 - ast.y)**2);
        if (dist < ast.size + 12) {
          setGameState('gameover');
        }
      });

      // Filter out redundant items
      asteroids.current = asteroids.current.filter(ast => ast.y < 350);

      // Update fuel cell canisters
      fuelCells.current.forEach((fuel, idx) => {
        fuel.y += 3;
        
        // Gulp / Collision
        const dist = Math.sqrt((playerX.current - fuel.x)**2 + (270 - fuel.y)**2);
        if (dist < 22) {
          gameScoreRef.current += 100; // instant bonus distance!
          fuelCells.current.splice(idx, 1);
        }
      });
      fuelCells.current = fuelCells.current.filter(fuel => fuel.y < 350);

      // Check win condition (reaching 500 score)
      if (Math.floor(gameScoreRef.current / 5) >= 500) {
        setGameState('won');
        onGameEnd(2); // Award 2 points
      }

      // DRAW VERTICAL CYBERSPACE RACING SCENE
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Cyber Space Background
          ctx.fillStyle = '#06060c';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Star particles streaming
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          for (let i = 0; i < 15; i++) {
            const starY = (spawnTimer * 2 + i * 40) % canvas.height;
            const starX = (i * 27) % canvas.width;
            ctx.fillRect(starX, starY, 1.5, 1.5);
          }

          // Draw neon track bounds
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(10, canvas.height);
          ctx.moveTo(canvas.width - 10, 0);
          ctx.lineTo(canvas.width - 10, canvas.height);
          ctx.stroke();

          // Render fuel canister items
          fuelCells.current.forEach(fuel => {
            ctx.fillStyle = '#10b981';
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(fuel.x, fuel.y, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
          });

          // Draw Asteroids hurdles
          asteroids.current.forEach(ast => {
            ctx.fillStyle = '#1e1b4b';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ast.x, ast.y, ast.size, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
          });

          // Draw Spaceship Racer
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Nose tip
          ctx.moveTo(playerX.current, 252);
          // Left wing
          ctx.lineTo(playerX.current - 12, 275);
          // Left jet footer
          ctx.lineTo(playerX.current - 6, 275);
          // Engine core
          ctx.lineTo(playerX.current, 270);
          // Right jet footer
          ctx.lineTo(playerX.current + 6, 275);
          // Right wing
          ctx.lineTo(playerX.current + 12, 275);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Combustion engine flame loop
          ctx.fillStyle = spawnTimer % 2 === 0 ? '#f59e0b' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(playerX.current - 4, 276);
          ctx.lineTo(playerX.current, 285 + (spawnTimer%3)*2);
          ctx.lineTo(playerX.current + 4, 276);
          ctx.closePath();
          ctx.fill();

          // Score text metrics overlay
          ctx.fillStyle = '#ffffff';
          ctx.font = 'black 11px sans-serif';
          ctx.fillText(`المسافة: ${Math.floor(gameScoreRef.current / 5)}م / 500م`, 15, 25);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 className="text-base font-black italic">كبسولة النجوم الصاعدة 🌌</h4>
          <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">
            طر بسفينتك الحربية عبر التجاويف الثقالية، وتفادى الكويكبات القاتلة بينما تقوم بامتصاص براميل وقود اليورانيوم لتسريع التحليق والوصول لهدفك!
          </p>
          <button
            onClick={startGame}
            className="px-8 py-3.5 bg-cyan-500 text-black font-black text-xs rounded-xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            انطلاق الرحلة الكونية
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-4 w-full">
          <div className="relative border-4 border-zinc-900 rounded-[2rem] overflow-hidden bg-black max-w-sm mx-auto aspect-[3/4] w-full">
            <canvas 
              ref={canvasRef} 
              width={300} 
              height={320} 
              className="w-full h-full block" 
            />
          </div>

          {/* Large touch control buttons for touch screens */}
          <div className="flex items-center justify-between gap-6 max-w-sm mx-auto">
            <button
              onTouchStart={() => playerX.current = Math.max(20, playerX.current - 18)}
              onClick={() => playerX.current = Math.max(20, playerX.current - 18)}
              className="flex-1 py-4 bg-zinc-900 active:bg-cyan-500 hover:text-white rounded-2xl font-black text-sm border border-white/5 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <span>◀ يسار</span>
            </button>
            <button
              onTouchStart={() => playerX.current = Math.min(280, playerX.current + 18)}
              onClick={() => playerX.current = Math.min(280, playerX.current + 18)}
              className="flex-1 py-4 bg-zinc-900 active:bg-cyan-500 hover:text-white rounded-2xl font-black text-sm border border-white/5 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <span>يمين ▶</span>
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 font-extrabold">يمكنك استخدام زري الأسهم (يمين/يسار) أو مفاتيح A و D للتوجيه!</p>
        </div>
      )}

      {(gameState === 'gameover' || gameState === 'won') && (
        <div className="py-12 space-y-6 max-w-sm">
          <div className={`p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2 ${
            gameState === 'won' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-red-650/10 text-primary border border-primary/20'
          }`}>
             <span className="text-4xl">{gameState === 'won' ? '🛸' : '💥'}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-black italic">
              {gameState === 'won' ? 'تهانينا! حطمت الأرقام القياسية 🏁' : 'انفجرت كبسولتك الجوية بفعل حطام فضائي!'}
            </h4>
            <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">
              {gameState === 'won' 
                ? 'لقد قطعت 500 متر كاملة من الكويكبات الخطرة وهبطت بنجاح، مما يكسبك نقطتين إضافيتين فورياً!'
                : 'التعرض للاصطدام المباشر يدمر محركات الدفع. حافظ على تركيزك الشديد لكسب التحدي القادم!'}
            </p>
          </div>

          <div className="bg-zinc-950/60 border border-white/10 p-4 rounded-2xl text-center text-xs font-black w-full text-zinc-300">
            المسافة الإجمالية المقطوعة: {score}م
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 px-6 bg-white text-black font-black text-xs rounded-2xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>معاودة الطيران</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   GAME 3: CLASSIC INTERACTIVE LUDO MINI
   ========================================== */
function LudoGame({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [diceNumber, setDiceNumber] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [turn, setTurn] = useState<'player' | 'bot'>('player');

  // Player and Bot token track values (0 on base, 57 is home)
  const [playerToken, setPlayerToken] = useState(0);
  const [botToken, setBotToken] = useState(0);

  const [narrator, setNarrator] = useState('اضغط على النرد الملكي لبدء رمي الحجر!');

  const startNewMatch = () => {
    setPlayerToken(0);
    setBotToken(0);
    setDiceNumber(null);
    setTurn('player');
    setNarrator('بدأت المعركة! دورك الآن، ارمِ حجر النرد!');
    setGameState('playing');
  };

  const rollDice = () => {
    if (isRolling || turn !== 'player' || gameState !== 'playing') return;

    setIsRolling(true);
    setNarrator('جاري هز كيس النرد الذّهبي... 🎲');

    // Simple delay for high realistic tension
    setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1;
      setDiceNumber(rolled);
      setIsRolling(false);

      // Handle Ludo Rules
      let nextPos = playerToken;
      if (playerToken === 0) {
        if (rolled === 6) {
          nextPos = 1;
          setNarrator('أحسنت! حصلت على 6 وخرجت قطعة لودو الخاصة بك إلى الملعب! 🚀');
        } else {
          setNarrator(`رميت ${rolled}. تحتاج إلى الرقم 6 للخروج من منطقة البداية! ⚔️`);
        }
      } else {
        if (nextPos + rolled <= 24) {
          nextPos += rolled;
          setNarrator(`تحركت قطعة لودو الخاصة بك بمقدار ${rolled} خطوات! ✅`);
        } else {
          setNarrator(`رميت ${rolled}. الرقم كبير جداً لحجر النهاية!`);
        }
      }

      setPlayerToken(nextPos);

      // Verify Win
      if (nextPos >= 24) {
        setGameState('ended');
        setNarrator('يا لك من محترف! انتصرت على الذكاء الاصطناعي بنجاح وحصدت 3 نقاط! 🏆🥇');
        onGameEnd(3); // Award 3 points!
        return;
      }

      // Next is Bot turn after delay
      setTurn('bot');
      setTimeout(handleBotTurn, 1800);
    }, 1100);
  };

  const handleBotTurn = () => {
    if (gameState !== 'playing') return;

    setNarrator('دور المعالج الآن. يتم رمي النرد للخصم... 🤖');
    const rolled = Math.floor(Math.random() * 6) + 1;

    setTimeout(() => {
      let nextBotPos = botToken;
      if (botToken === 0) {
        if (rolled === 6) {
          nextBotPos = 1;
          setNarrator(`حصل الخصم المعالج على 6 وتقدّم بقطعة لودو للملعب! 🚨`);
        } else {
          setNarrator(`رمى الخصم المعالج الرقم ${rolled}. لم يخرج من منطقته بعد!`);
        }
      } else {
        if (nextBotPos + rolled <= 24) {
          nextBotPos += rolled;
          // Simple knockout check!
          if (nextBotPos === playerToken && playerToken !== 0) {
            setPlayerToken(0);
            setNarrator('💥 يا للهول! قام خصمك بضرب قطعتك وإرجاعك لمنطقة الصفر!');
          } else {
            setNarrator(`تحرك الخصم بمقدار ${rolled} خطوات إستراتيجية.`);
          }
        }
      }

      setBotToken(nextBotPos);

      // Verify bot win
      if (nextBotPos >= 24) {
        setGameState('ended');
        setNarrator('للأسف! انتصر خصمك المعالج هذه المرة وضاعت خطة المكاسب. حاول مجدداً!');
        return;
      }

      setTurn('player');
      setNarrator(`دورك الآن! ارم النرد وتقدّم بمجموعتك 🎯`);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-md mx-auto">
      {gameState === 'idle' && (
        <div className="py-8 space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <Trophy className="w-8 h-8" />
          </div>
          <h4 className="text-base font-black italic">طاولة لودو الملوك الذهبية</h4>
          <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">
            تحدى الذكاء الاصطناعي بلعبة لودو مصغرة حقيقية ومسلية جداً. ارم النرد وحاول إيصال قطعك بأمان لخط النهاية قبل خصمك!
          </p>
          <button
            onClick={startNewMatch}
            className="px-8 py-3.5 bg-amber-500 text-black font-black text-xs rounded-xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            الانضمام لغرفة اللوح
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6 w-full">
          {/* Narrator Display Screen */}
          <div className="bg-[#0a0a0f] border border-white/5 p-4 rounded-2xl text-center">
            <span className="text-[9px] text-[#fbbf24] font-black uppercase tracking-widest block mb-1">راوي طاولة الملوك</span>
            <p className="text-xs text-zinc-200 font-extrabold leading-relaxed">{narrator}</p>
          </div>

          {/* Graphical Miniature Ludo Board */}
          <div className="bg-zinc-900 border-4 border-zinc-950 rounded-[2.5rem] p-4 aspect-square w-full relative grid grid-cols-5 grid-rows-5 gap-1 shadow-2xl">
            
            {/* Player Base (Gold) */}
            <div className="col-span-2 row-span-2 bg-[#fbbf24]/10 border border-[#fbbf24]/40 rounded-2xl flex flex-col items-center justify-center relative">
              <span className="text-[9px] text-[#fbbf24] font-black absolute top-2">البداية (أنت)</span>
              {playerToken === 0 && (
                <motion.div 
                  layoutId="playerToken"
                  className="w-8 h-8 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center font-black text-black shadow-lg shadow-amber-500/40"
                >
                  👑
                </motion.div>
              )}
            </div>

            {/* Path block top */}
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 4 ? 'bg-amber-450 border-amber-400 text-black font-black animate-pulse' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>4</div>
            
            {/* Bot Base (Crimson) */}
            <div className="col-span-2 row-span-2 bg-red-650/10 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center relative">
              <span className="text-[9px] text-red-500 font-black absolute top-2">البداية (الخصم)</span>
              {botToken === 0 && (
                <motion.div 
                  layoutId="botToken"
                  className="w-8 h-8 bg-red-500 border-2 border-white rounded-full flex items-center justify-center font-black text-white shadow-lg"
                >
                  🤖
                </motion.div>
              )}
            </div>

            {/* Path Grid row 2 */}
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 3 ? 'bg-amber-450 border-amber-400 text-black font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>3</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 3 ? 'bg-red-500 border-red-400 text-white font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>3</div>

            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 2 ? 'bg-amber-450 border-amber-400 text-black font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>2</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 2 ? 'bg-red-500 border-red-400 text-white font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>2</div>

            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 1 ? 'bg-amber-450 border-amber-400 text-black font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>1</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 4 ? 'bg-red-500 border-red-400 text-white font-semibold animate-pulse' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>4</div>

            {/* Center Runway blocks */}
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 5 ? 'bg-amber-450 border-amber-400 text-black font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>5</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 6 ? 'bg-amber-450 border-amber-400 text-black font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>6</div>
            
            {/* LUDO HOME (Center Square) */}
            <div className="bg-[#10b981]/25 border-2 border-[#10b981]/50 rounded-2xl flex flex-col items-center justify-center text-[9px] font-black italic relative overflow-hidden text-emerald-400">
               <span>النهاية 🎯</span>
               {playerToken >= 24 && <span className="absolute text-base">👑</span>}
               {botToken >= 24 && <span className="absolute text-base">🤖</span>}
            </div>

            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 6 ? 'bg-red-500 border-red-400 text-white font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>6</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 5 ? 'bg-red-500 border-red-400 text-white font-semibold' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>5</div>

            {/* Path Grid row 4 */}
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 10 ? 'bg-amber-450 border-amber-400 text-black font-semibold animate-pulse' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>10</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 9 ? 'bg-amber-450 border-amber-400 text-black' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>9</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 8 ? 'bg-amber-450 border-amber-400 text-black' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>8</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${playerToken === 7 ? 'bg-amber-450 border-amber-400 text-black' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>7</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 7 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>7</div>

            {/* Base block bottom */}
            <div className="col-span-2 row-span-2 bg-[#10b981]/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center relative">
               <span className="text-[8px] text-zinc-500 font-bold">منطقة أمان متبادلة</span>
               {playerToken > 0 && playerToken < 24 && (
                 <motion.div 
                   layoutId="playerToken"
                   className="w-8 h-8 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center font-black text-black shadow-lg"
                 >
                   👑
                 </motion.div>
               )}
            </div>

            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 8 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>8</div>
            
            <div className="col-span-2 row-span-2 bg-[#10b981]/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center relative">
               <span className="text-[8px] text-zinc-500 font-bold">منطقة أمان متبادلة</span>
               {botToken > 0 && botToken < 24 && (
                 <motion.div 
                   layoutId="botToken"
                   className="w-8 h-8 bg-red-500 border-2 border-white rounded-full flex items-center justify-center font-black text-white shadow-lg"
                 >
                   🤖
                 </motion.div>
               )}
            </div>

            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 9 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>9</div>
            <div className={`border rounded-xl flex items-center justify-center font-bold text-[10px] ${botToken === 10 ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>10</div>

          </div>

          {/* Roll Controls panel with realistic gold dice shaker */}
          <div className="flex flex-col items-center justify-center gap-4">
             <div className="flex items-center gap-4 justify-center">
               <div className="text-right">
                 <span className="text-[10px] text-zinc-500 block font-bold leading-none">مستوى تقدمك</span>
                 <span className="text-xs font-black text-amber-500 block mt-1">{playerToken} / 24 خطوة</span>
               </div>
               <div className="w-px h-8 bg-white/10" />
               <div className="text-right">
                 <span className="text-[10px] text-zinc-500 block font-bold leading-none">مستوى الخصم</span>
                 <span className="text-xs font-black text-red-500 block mt-1">{botToken} / 24 خطوة</span>
               </div>
             </div>

             <div className="flex items-center justify-center gap-4">
               {turn === 'player' ? (
                 <button
                   onClick={rollDice}
                   disabled={isRolling}
                   className="px-8 py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs rounded-2xl transition hover:scale-105 active:scale-95 shadow-xl shadow-amber-500/10 flex items-center gap-2 cursor-pointer"
                 >
                   <span>{isRolling ? 'الاهتزاز...' : 'ارمِ حجر نرد الملوك 🎲'}</span>
                 </button>
               ) : (
                 <div className="px-8 py-4 bg-zinc-900 border border-white/10 text-zinc-400 font-extrabold text-xs rounded-2xl animate-pulse">
                   بانتظار دور غريمك البرمجي... 🤖
                 </div>
               )}

               {diceNumber !== null && (
                 <motion.div 
                   initial={{ scale: 0, rotate: -180 }}
                   animate={{ scale: 1, rotate: 0 }}
                   className="w-14 h-14 bg-zinc-950 border-2 border-amber-550 rounded-2xl flex items-center justify-center font-black text-xl text-amber-400 shadow-2xl"
                 >
                   {diceNumber}
                 </motion.div>
               )}
             </div>
          </div>
        </div>
      )}

      {gameState === 'ended' && (
        <div className="py-12 space-y-6 max-w-sm">
          <div className="w-20 h-20 bg-amber-550/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-4xl animate-bounce">
            {playerToken >= 24 ? '🏆' : '☠️'}
          </div>

          <div className="space-y-2">
            <h4 className="text-lg font-black italic">
              {playerToken >= 24 ? 'انتصرت وحصدت الثروة 🏆' : 'أطاح بك الغريم العاقل!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed">
              {playerToken >= 24 
                ? 'قدمت أداء لودو أسطوري، تم إضافة 3 نقاط مباشرة لرصيدك لتسهيل تجاوز الإعلانات للأبد!'
                : 'لقد اقتربت من معقل النهاية ولكن الغريم ضرب خطواتك وتأهب مسبقاً. حاول الانتقام باللعب ثانية!'}
            </p>
          </div>

          <button
            onClick={startNewMatch}
            className="w-full py-4 px-6 bg-white text-black font-black text-xs rounded-2xl shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>خوض جولة لودو تالية</span>
          </button>
        </div>
      )}
    </div>
  );
}
