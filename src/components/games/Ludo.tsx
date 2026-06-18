import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCw } from 'lucide-react';

interface LudoProps {
  onGameEnd: (pts: number) => void;
}

export default function Ludo({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [diceNumber, setDiceNumber] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [turn, setTurn] = useState<'player' | 'bot'>('player');

  // Player and Bot token track values (0 on base, 24 is home)
  const [playerToken, setPlayerToken] = useState(0);
  const [botToken, setBotToken] = useState(0);

  const [narrator, setNarrator] = useState('اضغط على الشاكر لبدء رمي حجر لودو الملوكي!');

  const startNewMatch = () => {
    setPlayerToken(0);
    setBotToken(0);
    setDiceNumber(null);
    setTurn('player');
    setNarrator('بدأت القمة! دورك الآن، ارمِ حجر نرد الملوك!');
    setGameState('playing');
  };

  const rollDice = () => {
    if (isRolling || turn !== 'player' || gameState !== 'playing') return;

    setIsRolling(true);
    setNarrator('جاري خض النرد البلاتيني الذهبي... 🎲');

    setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1;
      setDiceNumber(rolled);
      setIsRolling(false);

      let nextPos = playerToken;
      if (playerToken === 0) {
        if (rolled === 6) {
          nextPos = 1;
          setNarrator('رائع جداً! حصلت على الرقم 6 وخرجت رقعتك للملعب بنجاح! 🚀');
        } else {
          setNarrator(`رميت ${rolled}. يمنع خروج قطعتك دون الحصول على الرقم 6! ⚔️`);
        }
      } else {
        if (nextPos + rolled <= 24) {
          nextPos += rolled;
          setNarrator(`تقدّمت قطعة لودو الملكية الخاصة بك بمقدار ${rolled} خطوة! ✅`);
        } else {
          setNarrator(`رميت ${rolled}. الرقم كبير جداً للوصول لنقطة النهاية بالضبط!`);
        }
      }

      setPlayerToken(nextPos);

      // Verify Win
      if (nextPos >= 24) {
        setGameState('ended');
        setNarrator('يا لك من داهية مبهر! سحقت الذكاء الاصطناعي وحققت 3 نقاط! 🏆🥇');
        onGameEnd(3); // Award 3 points!
        return;
      }

      // Next is Bot turn
      setTurn('bot');
      setTimeout(handleBotTurn, 1500);
    }, 1000);
  };

  const handleBotTurn = () => {
    if (gameState !== 'playing') return;

    setNarrator('خصمك المعالج يفكر الآن. جاري رمي النرد المعاكس... 🤖');
    const rolled = Math.floor(Math.random() * 6) + 1;

    setTimeout(() => {
      let nextBotPos = botToken;
      if (botToken === 0) {
        if (rolled === 6) {
          nextBotPos = 1;
          setNarrator(`حصل المعالج على 6 ودفع بقطعة اللودو في ساحة المعركة! 🚨`);
        } else {
          setNarrator(`رمى الخصم المعالج الرقم ${rolled}. لم يستطع الإفلات من منطقته!`);
        }
      } else {
        if (nextBotPos + rolled <= 24) {
          nextBotPos += rolled;
          // Splat / knockout check!
          if (nextBotPos === playerToken && playerToken !== 0) {
            setPlayerToken(0);
            setNarrator('💥 كبسة مدمرة! قام خصمك بضرب وسحق قطعتك وإرجاعك للبداية!');
          } else {
            setNarrator(`تقدّم الخصم المعالج ${rolled} خطوات إستراتيجية.`);
          }
        }
      }

      setBotToken(nextBotPos);

      // Verify bot win
      if (nextBotPos >= 24) {
        setGameState('ended');
        setNarrator('يا للأسف! فاز خصمك الاصطناعي هذه الجولة بالحظ الصرف. ثأر سريع؟');
        return;
      }

      setTurn('player');
      setNarrator(`دورك الآن! ارم النرد وشق طريقك نحو الفوز 🎯`);
    }, 900);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-4xl mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-amber-500/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <Trophy className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">طاولة لودو الملوك الذهبية</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            مستوحاة من الطاولات الكلاسيكية الشائعة بلون ريفي فخم! نافس غريمك الافتراضي بنوع لودو مبسط وسريع جداً.
          </p>
          <button
            onClick={startNewMatch}
            className="px-10 py-4 bg-amber-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            الانضمام لغرفة اللوح 🎲
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-center">
          
          {/* LEFT COLUMN: Narrator & stats inside a console cabinet panel */}
          <div className="md:col-span-4 space-y-4 text-right">
            <div className="bg-[#0c0c14] border-2 border-white/5 p-5 rounded-[2rem] shadow-xl space-y-3">
              <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest block mb-1">راوي طاولة الملوك</span>
              <p className="text-sm text-zinc-200 font-extrabold leading-relaxed">{narrator}</p>
            </div>

            <div className="bg-[#0c0c14]/40 border border-white/5 p-4 rounded-[1.5rem] divide-y divide-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-right pt-1">
                <span className="text-amber-500">{playerToken} / 24 خطوة</span>
                <span className="text-zinc-400">تقدمك (👑):</span>
              </div>
              <div className="flex items-center justify-between text-xs font-black text-right pt-3">
                <span className="text-red-500">{botToken} / 24 خطوة</span>
                <span className="text-zinc-400">تقدم الذكاء الاصطناعي (🤖):</span>
              </div>
            </div>

            {/* Shaker/Roll action panel */}
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-[2rem] flex flex-col items-center justify-center gap-4">
              {turn === 'player' ? (
                <button
                  onClick={rollDice}
                  disabled={isRolling}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs rounded-2xl transition hover:scale-105 active:scale-95 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isRolling ? 'الاهتزاز...' : 'ارمِ حجر نرد الملوك 🎲'}</span>
                </button>
              ) : (
                <div className="w-full py-4 bg-zinc-900 border border-white/10 text-zinc-400 font-extrabold text-xs rounded-2xl text-center animate-pulse">
                  بانتظار دور غريمك البرمجي... 🤖
                </div>
              )}

              {diceNumber !== null && (
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-16 h-16 bg-[#0c0c14] border-2 border-amber-550 rounded-2.5xl flex items-center justify-center font-black text-2xl text-amber-400 shadow-2xl"
                >
                  {diceNumber}
                </motion.div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN / CORE: Full Screen Scale Ludo Board */}
          <div className="md:col-span-8 bg-zinc-900/50 border-2 border-white/10 rounded-[2.5rem] p-4 sm:p-8 flex items-center justify-center shadow-2xl relative">
            <div className="bg-[#0c0c14] border-4 border-zinc-950 rounded-[2rem] p-4 aspect-square w-full max-w-lg md:max-w-md relative grid grid-cols-5 grid-rows-5 gap-1 shadow-2xl">
              
              {/* Player Team Base Container (Gold) */}
              <div className="col-span-2 row-span-2 bg-amber-500/10 border border-amber-500/30 rounded-2-xl flex flex-col items-center justify-center relative">
                <span className="text-[10px] text-amber-500 font-black absolute top-2">البداية (أنت)</span>
                {playerToken === 0 && (
                  <motion.div 
                    layoutId="playerToken"
                    className="w-10 h-10 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center font-black text-lg text-black shadow-lg shadow-amber-500/40 cursor-pointer"
                  >
                    👑
                  </motion.div>
                )}
              </div>

              {/* Path Blocks */}
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 4 ? 'bg-amber-500 border-amber-400 text-black animate-pulse' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>4</div>
              
              {/* Bot Team Base Container (Crimson Red) */}
              <div className="col-span-2 row-span-2 bg-red-650/10 border border-red-500/20 rounded-2-xl flex flex-col items-center justify-center relative">
                <span className="text-[10px] text-red-500 font-black absolute top-2">البداية (الخصم)</span>
                {botToken === 0 && (
                  <motion.div 
                    layoutId="botToken"
                    className="w-10 h-10 bg-red-500 border-2 border-white rounded-full flex items-center justify-center font-black text-lg text-white shadow-lg shadow-red-500/40"
                  >
                    🤖
                  </motion.div>
                )}
              </div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 3 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>3</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 3 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>3</div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 2 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>2</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 2 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>2</div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 1 ? 'bg-amber-500 border-amber-400 text-black font-extrabold' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>1</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 4 ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>4</div>

              {/* Middle Runway */}
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 5 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>5</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 6 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>6</div>
              
              {/* LUDO RED-EMERALD HOME ZONE */}
              <div className="bg-emerald-500/20 border-2 border-emerald-500/40 rounded-2xl flex flex-col items-center justify-center text-[10px] font-black italic relative overflow-hidden text-emerald-400">
                <span>النجاح 🏁</span>
                {playerToken >= 24 && <span className="absolute text-xl">🏆</span>}
                {botToken >= 24 && <span className="absolute text-xl">🤖</span>}
              </div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 6 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>6</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 5 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>5</div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 10 ? 'bg-amber-500 border-amber-400 text-black animate-pulse' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>10</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 9 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>9</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 8 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>8</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${playerToken === 7 ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>7</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 7 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>7</div>

              {/* Safe Neutral zone 1 */}
              <div className="col-span-2 row-span-2 bg-zinc-950 border border-white/5 rounded-2-xl flex flex-col items-center justify-center relative">
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider absolute bottom-2">أمان مشترك</span>
                {playerToken > 0 && playerToken < 24 && (
                  <motion.div 
                    layoutId="playerToken"
                    className="w-10 h-10 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center font-black text-lg text-black shadow-lg shadow-amber-500/40 cursor-pointer"
                  >
                    👑
                  </motion.div>
                )}
              </div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 8 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>8</div>
              
              {/* Safe Neutral zone 2 */}
              <div className="col-span-2 row-span-2 bg-zinc-950 border border-white/5 rounded-2-xl flex flex-col items-center justify-center relative">
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider absolute bottom-2">أمان مشترك</span>
                {botToken > 0 && botToken < 24 && (
                  <motion.div 
                    layoutId="botToken"
                    className="w-10 h-10 bg-red-500 border-2 border-white rounded-full flex items-center justify-center font-black text-lg text-white shadow-lg shadow-red-550/40"
                  >
                    🤖
                  </motion.div>
                )}
              </div>

              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 9 ? 'bg-red-500 border-red-400 text-white' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>9</div>
              <div className={`border-2 rounded-xl flex items-center justify-center font-black text-xs ${botToken === 10 ? 'bg-red-500 border-red-400 text-white animate-pulse' : 'bg-zinc-800/80 border-white/5 text-zinc-500'}`}>10</div>
            </div>
          </div>

        </div>
      )}

      {gameState === 'ended' && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className="w-24 h-24 bg-amber-500/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-5xl animate-bounce shadow-[0_0_35px_rgba(245,158,11,0.2)]">
            {playerToken >= 24 ? '🏆' : '☠️'}
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white mb-1">
              {playerToken >= 24 ? 'شربت نخب الفوز كبطل! 🏆' : 'سقطت رقعتك في المنعطف الأخير!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
              {playerToken >= 24 
                ? 'قدمت مباراة لودو إستراتيجية تليق بالملوك، وتم إضافة 3 نقاط ذهبية لحسابك لترقية العضوية فورياً!'
                : 'لقد حاولت التقدم بهدوء تام ولكن خصمك المعالج ضرب أمانك. ابدأ بالتحدي مجدداً لتثأر لحيويتك!'}
            </p>
          </div>

          <button
            onClick={startNewMatch}
            className="w-full max-w-sm mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>بدء جولة ملوكية جديدة ⚔️</span>
          </button>
        </div>
      )}
    </div>
  );
}
