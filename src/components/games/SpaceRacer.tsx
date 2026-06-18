import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Play } from 'lucide-react';
import { VirtualJoystick } from './VirtualJoystick';

interface SpaceRacerProps {
  onGameEnd: (pts: number) => void;
}

export default function SpaceRacer({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'won'>('idle');
  const [score, setScore] = useState(0);

  // Core values inside refs to avoid react states delay
  const playerX = useRef(200); // adjusted default for widescreen
  const joystickValue = useRef({ x: 0, y: 0 });
  const asteroids = useRef<{ x: number, y: number, speed: number, size: number }[]>([]);
  const fuelCells = useRef<{ x: number, y: number }[]>([]);
  const gameScoreRef = useRef(0);

  const startGame = () => {
    playerX.current = 240; // centered in a 480 widescreen canvas
    asteroids.current = [];
    fuelCells.current = [];
    gameScoreRef.current = 0;
    joystickValue.current = { x: 0, y: 0 };
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

      const canvas = canvasRef.current;
      if (!canvas) return;

      const playerMoveWidth = canvas.width;

      // Adjust player positions (combining keyboard and joystick)
      const speed = 6;
      let inputX = 0;
      if (localKeys.left) inputX = -1;
      if (localKeys.right) inputX = 1;

      if (Math.abs(joystickValue.current.x) > 0.05) {
        inputX = joystickValue.current.x;
      }

      playerX.current = Math.max(25, Math.min(playerMoveWidth - 25, playerX.current + inputX * speed));

      // Distance score increment
      gameScoreRef.current += 1;
      setScore(Math.floor(gameScoreRef.current / 5));

      // Spawners logic
      spawnTimer++;
      if (spawnTimer % 20 === 0) {
        asteroids.current.push({
          x: Math.random() * (playerMoveWidth - 40) + 20,
          y: -20,
          speed: Math.random() * 4 + 3,
          size: Math.random() * 14 + 10
        });
      }

      if (spawnTimer % 55 === 0) {
        fuelCells.current.push({
          x: Math.random() * (playerMoveWidth - 40) + 20,
          y: -20
        });
      }

      // Asteroids update
      asteroids.current.forEach((ast) => {
        ast.y += ast.speed;
        
        // Collisions test
        const dist = Math.sqrt((playerX.current - ast.x)**2 + (330 - ast.y)**2);
        if (dist < ast.size + 14) {
          setGameState('gameover');
        }
      });
      asteroids.current = asteroids.current.filter(ast => ast.y < 420);

      // Fuel canisters logic
      fuelCells.current.forEach((fuel, idx) => {
        fuel.y += 3.5;
        
        // Collision test
        const dist = Math.sqrt((playerX.current - fuel.x)**2 + (330 - fuel.y)**2);
        if (dist < 24) {
          gameScoreRef.current += 100; // instant distance bonus!
          fuelCells.current.splice(idx, 1);
        }
      });
      fuelCells.current = fuelCells.current.filter(fuel => fuel.y < 420);

      // Verify Win condition (reaching 500 score)
      if (Math.floor(gameScoreRef.current / 5) >= 500) {
        setGameState('won');
        onGameEnd(2); // Award 2 points
      }

      // Draw vertical cyberspace scene
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Starry space grid background
        ctx.fillStyle = '#040409';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Streaming star dust particles
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        for (let i = 0; i < 25; i++) {
          const starY = (spawnTimer * 2.5 + i * 35) % canvas.height;
          const starX = (i * 47) % canvas.width;
          ctx.fillRect(starX, starY, 1.5, 1.5);
        }

        // Draw neon boundaries
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(10, canvas.height);
        ctx.moveTo(canvas.width - 10, 0);
        ctx.lineTo(canvas.width - 10, canvas.height);
        ctx.stroke();

        // Render fuel cells
        fuelCells.current.forEach(fuel => {
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fuel.x, fuel.y, 8, 0, Math.PI*2);
          ctx.fill();
          ctx.stroke();

          // Core details
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fuel.x, fuel.y, 3, 0, Math.PI*2);
          ctx.fill();
        });

        // Render asteroid stones
        asteroids.current.forEach(ast => {
          // Glassmorphic fiery rock look
          ctx.fillStyle = '#161623';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ast.x, ast.y, ast.size, 0, Math.PI*2);
          ctx.fill();
          ctx.stroke();

          // Internal crater details
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.beginPath();
          ctx.arc(ast.x - ast.size/3, ast.y - ast.size/3, ast.size/3, 0, Math.PI*2);
          ctx.fill();
        });

        // Draw sleek spaceship
        const pX = playerX.current;
        const pY = 330;

        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Nose pointer
        ctx.moveTo(pX, pY - 18);
        // Left wing and body jets
        ctx.lineTo(pX - 16, pY + 12);
        ctx.lineTo(pX - 8, pY + 8);
        ctx.lineTo(pX, pY + 4);
        // Right wing and jets
        ctx.lineTo(pX + 8, pY + 8);
        ctx.lineTo(pX + 16, pY + 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Engine core plume
        ctx.fillStyle = spawnTimer % 2 === 0 ? '#10b981' : '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(pX - 5, pY + 9);
        ctx.lineTo(pX, pY + 22 + (spawnTimer%3)*3);
        ctx.lineTo(pX + 5, pY + 9);
        ctx.closePath();
        ctx.fill();

        // Stats metrics text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`المسافة: ${Math.floor(gameScoreRef.current / 5)}م / 500م 🚀`, 20, 25);
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
    <div ref={containerRef} className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-full">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-cyan-600/15 border border-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-[0_0_30px_rgba(6,182,212,0.25)]">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">كبسولة النجوم الصاعدة 🌌</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            تفادى الكويكبات والشهب الساقطة، وابطش بخلايا وقود اليورانيوم لتسريع كبسولتك والوصول لهدف الـ 500 متر!
          </p>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-cyan-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-cyan-550/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            بدء الرحلة السيبرانية 🪐
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6 w-full flex flex-col items-center relative">
          {/* Main Cinematic Landscape Widescreen Game Window */}
          <div className="relative border-2 border-white/10 rounded-[2rem] overflow-hidden bg-black shadow-[0_0_50px_rgba(6,182,212,0.15)] aspect-[16/9] w-full max-w-4xl mx-auto">
            <canvas 
              ref={canvasRef} 
              width={720} 
              height={405} 
              className="w-full h-full block" 
            />

            {/* Virtual Joystick Overlay */}
            <div className="absolute bottom-6 right-6 z-55" dir="ltr">
              <VirtualJoystick 
                onChange={(pos) => {
                  joystickValue.current = { x: pos.x, y: 0 }; // Only horizontal control is enough for racer!
                }}
                onEnd={() => {
                  joystickValue.current = { x: 0, y: 0 };
                }}
              />
            </div>

            {/* Instruction Panel */}
            <div className="absolute bottom-6 left-6 hidden md:block bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] text-zinc-400 font-bold border border-white/5 text-right">
              💡 وجّه الكبسولة لليمين واليسار باستخدام الجويستيك أو أزرار الأسهم!
            </div>
          </div>

          <p className="text-[10px] text-cyan-400 bg-cyan-500/5 border border-cyan-500/20 px-3 py-1 rounded-full font-extrabold animate-pulse md:hidden">
            📱 اسحب مقبض الجويستيك يميناً ويساراً للتوجيه الدقيق والسريع!
          </p>
        </div>
      )}

      {(gameState === 'gameover' || gameState === 'won') && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className={`p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2 shadow-2xl ${
            gameState === 'won' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-red-650/10 text-primary border border-primary/20'
          }`}>
             <span className="text-5xl">{gameState === 'won' ? '🪐' : '💥'}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {gameState === 'won' ? 'تهانينا! قطعت المسافة الآمنة 🏁' : 'انفجرت المركبة بفعل اصطدام مباشر!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm mx-auto">
              {gameState === 'won' 
                ? 'لقد عبرت حقول الشهب بجدية فائقة وهبطت بنجاح على قاعدة المجرة، كاسباً نقطتين لقائمتك الذهبية!'
                : 'الأجسام الفضائية سريعة ومدمرة. حافظ على هدوء يديك وترقّب لتفوز بالجولة القادمة!'}
            </p>
          </div>

          <div className="bg-[#0c0c14]/80 border border-white/10 p-4 rounded-2.5xl max-w-sm mx-auto text-center text-xs font-black text-zinc-300">
            المسافة الإجمالية المقطوعة: {score} متر 🚀
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-sm mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>معاودة الطيران والتحليق ☄️</span>
          </button>
        </div>
      )}
    </div>
  );
}
