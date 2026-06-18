import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Zap } from 'lucide-react';

interface DartsProps {
  onGameEnd: (pts: number) => void;
}

export default function Darts({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [dartsRemaining, setDartsRemaining] = useState(3);
  const [totalScore, setTotalScore] = useState(0);
  const [narrator, setNarrator] = useState('اسحب السهم للخارج واسقطه لرمي السهم بدقة!');
  
  // Throwing physics state represented inside refs
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragCurrent = useRef({ x: 0, y: 0 });
  
  const dartPos = useRef({ x: 150, y: 250 });
  const dartVelocity = useRef({ x: 0, y: 0 });
  const isDartInFlight = useRef(false);

  // Dartboard specs
  const boardCenter = { x: 150, y: 80 };

  const startGame = () => {
    setDartsRemaining(3);
    setTotalScore(0);
    isDartInFlight.current = false;
    isDragging.current = false;
    dartPos.current = { x: 150, y: 250 };
    setNarrator('بدأ التحدي! اسحب السهم الدائري أسفل اللوحة لتوجيه رميتك!');
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    let animId: number;

    const gameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw deep premium space/cyber arcade room
        ctx.fillStyle = '#06060c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid lines behind game for premium feeling
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 20) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
          ctx.stroke();
        }

        // 1. Draw glowing Dartboard
        const cx = boardCenter.x;
        const cy = boardCenter.y;

        // Outer rings
        const rings = [
          { r: 70, color: '#ef4444', score: 10 },
          { r: 55, color: '#161623', score: 20 },
          { r: 40, color: '#10b981', score: 30 },
          { r: 25, color: '#161623', score: 40 },
          { r: 12, color: '#ef4444', score: 50 }, // Single Bullseye
          { r: 5, color: '#fbbf24', score: 100 }  // Double Bullseye
        ];

        rings.forEach(ring => {
          ctx.fillStyle = ring.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, 0, Math.PI*2);
          ctx.fill();
          ctx.stroke();
        });

        // Slice borders representing real dart boards
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a)*70, cy + Math.sin(a)*70);
          ctx.stroke();
        }

        // 2. Physics / Flight calculation
        if (isDartInFlight.current) {
          dartPos.current.x += dartVelocity.current.x;
          dartPos.current.y += dartVelocity.current.y;

          // Air friction slowing down or vertical perspective scaling
          dartPos.current.y -= 1.2; // pull towards board height

          // Hit detection
          const distToBoard = Math.abs(dartPos.current.y - cy);
          if (distToBoard < 6 || dartPos.current.y <= cy) {
            isDartInFlight.current = false;
            
            // Calculate score based on landing impact
            const dx = dartPos.current.x - cx;
            const dy = dartPos.current.y - cy;
            const hitDistance = Math.sqrt(dx*dx + dy*dy);

            let hitScore = 0;
            if (hitDistance <= 5) hitScore = 100;
            else if (hitDistance <= 12) hitScore = 50;
            else if (hitDistance <= 25) hitScore = 40;
            else if (hitDistance <= 40) hitScore = 30;
            else if (hitDistance <= 55) hitScore = 20;
            else if (hitDistance <= 70) hitScore = 10;

            setTotalScore(prev => prev + hitScore);

            if (hitScore === 100) {
              setNarrator('🎯 أسطووووري! أصبت سوبر بولز آي الملكي المقدر بـ 100 نقطة!');
            } else if (hitScore >= 40) {
              setNarrator(`🎯 رائع جداً! رمية متقنة تفجرت بـ ${hitScore} نقطة!`);
            } else if (hitScore > 0) {
              setNarrator(`👍 رمية مقبولة، حصلت على ${hitScore} نقطة!`);
            } else {
              setNarrator('❌ عذراً! مرت الرمية خارج نطاق الرقعة!');
            }

            // Next dart cycle
            const nextDarts = dartsRemaining - 1;
            setDartsRemaining(nextDarts);

            if (nextDarts <= 0) {
              setTimeout(() => {
                setGameState('ended');
                onGameEnd(2); // Award 2 points on completion
              }, 1500);
            } else {
              // Reset dart positions for next turn
              dartPos.current = { x: 150, y: 250 };
            }
          }
        }

        // 3. Draw drag indicator line during active aim
        if (isDragging.current && !isDartInFlight.current) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(dartPos.current.x, dartPos.current.y);
          // Drawing inverted path for aiming vector
          const aimX = dartPos.current.x + (dragStart.current.x - dragCurrent.current.x) * 1.5;
          const aimY = dartPos.current.y + (dragStart.current.y - dragCurrent.current.y) * 1.5;
          ctx.lineTo(aimX, aimY);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        }

        // 4. Render Dart Arrow
        ctx.fillStyle = isDartInFlight.current ? '#ef4444' : '#fbbf24';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        const x = dartPos.current.x;
        const y = dartPos.current.y;

        ctx.beginPath();
        ctx.moveTo(x, y - 14); // Nose tip
        ctx.lineTo(x - 4, y + 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Arrow fletcher feathers
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - 5, y + 4, 3, 6);
        ctx.fillRect(x + 2, y + 4, 3, 6);

        // Core dot indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI*2);
        ctx.fill();
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, dartsRemaining]);

  const handleStart = (clientX: number, clientY: number) => {
    if (isDartInFlight.current || gameState !== 'playing') return;
    isDragging.current = true;
    dragStart.current = { x: clientX, y: clientY };
    dragCurrent.current = { x: clientX, y: clientY };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    dragCurrent.current = { x: clientX, y: clientY };
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Calculate throw impulse velocity
    const dx = dragStart.current.x - dragCurrent.current.x;
    const dy = dragStart.current.y - dragCurrent.current.y;
    const force = Math.sqrt(dx*dx + dy*dy);

    if (force > 15) {
      // Trigger throw
      dartVelocity.current = {
        x: (dx / 11),
        y: (dy / 11)
      };
      isDartInFlight.current = true;
      setNarrator('🌀 انطلق السهم طائراً بالهواء نحو لوحة الهدف!');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-lg mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-amber-500/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            🎯
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">دارتس: صائد رقعة الهدف</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            تمكن من إصدار رميات أسهم متقنة للغاية نحو الهدف! اسحب ذيل السهم بالأسفل للخلف لزيادة القوة ثم دعه يطير للوسط لتكسب الرصيد.
          </p>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-amber-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-amber-550/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            مسك الأسهم واللعب الآن
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6 w-full max-w-sm mx-auto">
          {/* Narrator */}
          <div className="bg-[#0c0c14] border border-white/5 p-4 rounded-2xl text-center">
            <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest block mb-1">حالة الرميات الحالية</span>
            <p className="text-xs text-zinc-200 font-extrabold leading-relaxed">{narrator}</p>
          </div>

          {/* Interactive touch-physics board */}
          <div 
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches[0]) handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onTouchMove={(e) => {
              if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onMouseUp={handleEnd}
            onTouchEnd={handleEnd}
            className="relative border-4 border-zinc-950 rounded-[2.5rem] overflow-hidden bg-[#06060c] shadow-[0_0_50px_rgba(245,158,11,0.15)] aspect-square w-full select-none cursor-crosshair touch-none"
          >
            <canvas 
              ref={canvasRef} 
              width={300} 
              height={300} 
              className="w-full h-full block" 
            />

            {/* Bottom touch instructions overlay */}
            <div className="absolute inset-x-4 bottom-4 bg-zinc-900/80 backdrop-blur-md p-2.5 rounded-xl border border-white/5 text-[9px] text-zinc-400 font-extrabold text-center pointer-events-none uppercase">
              👇 اسحب بإصبعك/الماوس هنا للخلف وأفلته للتسديد!
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 bg-[#0c0c14]/40 border border-white/5 p-4 rounded-2xl divide-x divide-x-reverse divide-white/5 text-xs font-black text-zinc-300">
            <div className="px-2">النقاط: {totalScore} 🎯</div>
            <div className="px-2 font-black text-amber-400">الأسهم المتبقية: {dartsRemaining} / 3 ⚡</div>
          </div>
        </div>
      )}

      {gameState === 'ended' && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className="w-24 h-24 bg-amber-550/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-5xl animate-bounce shadow-2xl">
             🏆
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              انتهى التحدي وحان وقت الجوائز!
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-xs mx-auto">
              نجحت في إنهاء رمياتك الثلاث وحصدت ما مجموعه <span className="text-amber-500 font-black">{totalScore} نقطة هدف</span>، مما يمنحك نقطتين إيجابيتين لطاقة البريميوم لحسابك!
            </p>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>رمي جولة أسهم دارتس جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
}
