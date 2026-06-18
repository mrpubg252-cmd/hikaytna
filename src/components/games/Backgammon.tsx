import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Play } from 'lucide-react';

interface BackgammonProps {
  onGameEnd: (pts: number) => void;
}

export default function Backgammon({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [narrator, setNarrator] = useState('اضغط على "ارمِ الزهر" للبدء بالصخب الفولكلوري الرائع!');

  const startNewGame = () => {
    setPlayerScore(0);
    setBotScore(0);
    setDice(null);
    setNarrator('بدأ الصخب! لِنرمي زهر طاولة الملوك ونحقق النصر!');
    setGameState('playing');
  };

  const rollDice = () => {
    if (isRolling || gameState !== 'playing') return;

    setIsRolling(true);
    setNarrator('جاري خض الزهر العاجي على اللوح الخشبي... 🎲');

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      setDice([d1, d2]);
      setIsRolling(false);

      const sum = d1 + d2;
      let scoreGain = sum;

      // Double bonus
      if (d1 === d2) {
        scoreGain = sum * 2;
        setNarrator(`يا للروعة! حصلت على دُش بيش مزدوج [${d1}:${d2}]! مكافأة تقدم ${scoreGain} نقطة! 💥`);
      } else {
        setNarrator(`رميت الزهر وحصلت على [${d1}:${d2}]. تتقدم قطعك بمقدار ${scoreGain} خطوة!`);
      }

      const nextPlayerScore = Math.min(100, playerScore + scoreGain);
      setPlayerScore(nextPlayerScore);

      if (nextPlayerScore >= 100) {
        setGameState('ended');
        setNarrator('ملعب باهر! انتصرت بلعبة طاولة زهر العريقة وحصدت 2 نقطة لترقية النقاط! 🏆🎲');
        onGameEnd(2);
        return;
      }

      // Bot turn
      setTimeout(() => {
        makeBotMove();
      }, 1500);

    }, 1000);
  };

  const makeBotMove = () => {
    if (gameState !== 'playing') return;

    setNarrator('دور المعالج الاصطناعي الآن. يتم دحرجة الزوايا لصالحه... 🤖');

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      
      const sum = d1 + d2;
      let botGain = sum;

      if (d1 === d2) {
        botGain = sum * 2;
      }

      const nextBotScore = Math.min(100, botScore + botGain);
      setBotScore(nextBotScore);

      if (d1 === d2) {
        setNarrator(`🤖 المعالج دحرج دبل وشب [${d1}:${d2}] متقدماً بـ ${botGain} خطوة خطيرة!`);
      } else {
        setNarrator(`🤖 حرك المعالج رقعته بمقدار ${botGain} خطوة بعد رمية [${d1}:${d2}].`);
      }

      if (nextBotScore >= 100) {
        setGameState('ended');
        setNarrator('للأسف الشديد! أخرج خصمك المعالج كل قطعه من اللوح أولاً وكسب المباراة بالنقاط!');
        return;
      }

      setTimeout(() => {
        setNarrator('دورك مجدداً! رج وفضّ الزهر العاجي لتحتل الرقعة 🏆');
      }, 1400);

    }, 850);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-4xl mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-amber-500/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            🎲
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">طاولة زهر الشرق كلاسيك</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            تمتع بلعبة طاولة الزهر (البكغمون) الأكثر عراقة وإثارة! ارمِ الدش والبيش محاولاً إخراج قواشك وبطابيقك بأسرع وقت لتكسب نقطتين ذهبيتين!
          </p>
          <button
            onClick={startNewGame}
            className="px-10 py-4 bg-amber-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-amber-550/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            صف قطع القش واللعب 🎲
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-center">
          
          {/* Narrator */}
          <div className="md:col-span-4 space-y-4 text-right">
            <div className="bg-[#0c0c14] border border-white/5 p-5 rounded-[2rem] shadow-xl">
              <span className="text-[10px] text-amber-550 font-black uppercase tracking-widest block mb-1">معلق طاولة الزهر</span>
              <p className="text-sm text-zinc-200 font-extrabold leading-relaxed">{narrator}</p>
            </div>

            <div className="bg-zinc-950/60 border border-white/10 p-5 rounded-[2rem] flex flex-col items-center justify-center gap-4">
              <button
                onClick={rollDice}
                disabled={isRolling}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs rounded-2xl transition hover:scale-105 active:scale-95 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isRolling ? 'دحرجة...' : 'خض وارمِ الزهر الملكي 🎲'}</span>
              </button>

              {dice && (
                <div className="flex gap-4 justify-center items-center mt-2 animate-bounce">
                  <span className="w-12 h-12 bg-[#0c0c14] border-2 border-amber-500 rounded-2xl flex items-center justify-center font-black text-xl text-amber-400">{dice[0]}</span>
                  <span className="w-12 h-12 bg-[#0c0c14] border-2 border-amber-550 rounded-2xl flex items-center justify-center font-black text-xl text-amber-400">{dice[1]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Graphical Board Column */}
          <div className="md:col-span-8 bg-[#0c0c14]/50 border-2 border-white/10 rounded-[2.5rem] p-4 sm:p-6 flex items-center justify-center shadow-2xl relative">
            <div className="bg-[#17110a] border-4 border-amber-950 rounded-[1.8rem] p-5 w-full max-w-lg aspect-[1.5/1] relative flex flex-col justify-between shadow-2xl">
              
              {/* Top Columns points representing Backgammon points */}
              <div className="flex justify-between w-full h-24">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-[7%] h-full flex flex-col justify-start items-center relative"
                  >
                    {/* SVG Pointer triangles in wood textures */}
                    <svg viewBox="0 0 100 250" className={`w-full h-full ${i % 2 === 0 ? 'text-[#e5d4c0]' : 'text-[#ef4444]/20'}`}>
                      <polygon points="50,250 0,0 100,0" fill="currentColor"/>
                    </svg>

                    {/* Simulated points / pieces inside column */}
                    {i === 1 && <div className="absolute top-2 w-4 h-4 bg-red-500 border border-white rounded-full flex items-center justify-center font-bold text-[9px] text-white">2</div>}
                    {i === 5 && <div className="absolute top-2 w-4 h-4 bg-amber-500 border border-white rounded-full flex items-center justify-center font-bold text-[9px] text-black">5</div>}
                  </div>
                ))}
              </div>

              {/* Bar center divider */}
              <div className="absolute inset-y-0 left-1/2 w-6 bg-amber-950/40 -translate-x-1/2 flex flex-col items-center justify-center border-x border-amber-900/30">
                <span className="text-[10px] text-amber-500 font-extrabold uppercase transform rotate-90 leading-none">الحاجز 🪵</span>
              </div>

              {/* Score indicators of progress inside the Board layout */}
              <div className="px-6 flex items-center justify-between w-full z-15">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500 border border-white shadow-xl flex items-center justify-center text-[10px] text-black font-black">👑</div>
                  <div className="text-right">
                    <span className="text-[9px] text-zinc-500 block leading-none font-bold">باقي قطعك لدار النهاية</span>
                    <span className="text-sm font-black text-amber-400 block mt-1">{100 - playerScore}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] text-zinc-500 block leading-none font-bold">باقي قطع الخصم 🤖</span>
                    <span className="text-sm font-black text-red-500 block mt-1">{100 - botScore}%</span>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-red-500 border border-white shadow-xl flex items-center justify-center text-[10px] text-white font-black">🤖</div>
                </div>
              </div>

              {/* Bottom Columns points */}
              <div className="flex justify-between w-full h-24">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-[7%] h-full flex flex-col justify-end items-center relative"
                  >
                    <svg viewBox="0 0 100 250" className={`w-full h-full transform rotate-180 ${i % 2 === 1 ? 'text-[#e5d4c0]' : 'text-[#ef4444]/20'}`}>
                      <polygon points="50,250 0,0 100,0" fill="currentColor"/>
                    </svg>

                    {i === 11 && <div className="absolute bottom-2 w-4 h-4 bg-amber-500 border border-white rounded-full flex items-center justify-center font-bold text-[9px] text-black">2</div>}
                    {i === 6 && <div className="absolute bottom-2 w-4 h-4 bg-red-500 border border-white rounded-full flex items-center justify-center font-bold text-[9px] text-white">5</div>}
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      )}

      {gameState === 'ended' && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className="w-24 h-24 bg-amber-550/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-5xl animate-bounce shadow-2xl">
             🏆
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {playerScore >= 100 ? 'انتصرت وحصدت الرهان الفولكلوري! 🥇' : 'فاز خصمك بالدبل دُش!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-xs mx-auto">
              {playerScore >= 100 
                ? 'لقد لعبت مباراة طاولة زهر أثرية رائعة وشحنت قطعك بأمان وصعدت رصيدك بـ 2 نقطة كاملة!'
                : 'خصمك دحرج حجر النرد بسرعة مباغتة وتخلص من قواشه أولاً. ابدأ جولة انتقام إثارة ثانية!'}
            </p>
          </div>

          <button
            onClick={startNewGame}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>لعب طاولة زهر جديدة 🪵</span>
          </button>
        </div>
      )}
    </div>
  );
}
