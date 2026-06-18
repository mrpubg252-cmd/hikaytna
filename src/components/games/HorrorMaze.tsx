import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Play, Volume2, ShieldAlert } from 'lucide-react';
import { VirtualJoystick } from './VirtualJoystick';

interface HorrorMazeProps {
  onGameEnd: (pts: number) => void;
}

export default function HorrorMaze({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover' | 'won'>('idle');
  const [keysFound, setKeysFound] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  
  // Joystick values inside refs for lag-free rendering
  const joystickValue = useRef({ x: 0, y: 0 });

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
    joystickValue.current = { x: 0, y: 0 };
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

      // Player Rotation and movement speed
      const rotSpeed = 2.5;
      const moveSpeed = 1.8;

      // Handle input combining Keyboard and Virtual Joystick
      let rotateInput = 0;
      let moveInput = 0;

      // Keyboard check
      if (localKeys.a) rotateInput = -1;
      if (localKeys.d) rotateInput = 1;
      if (localKeys.w) moveInput = 1;
      if (localKeys.s) moveInput = -1;

      // Joystick override if active
      if (Math.abs(joystickValue.current.x) > 0.05) {
        rotateInput = joystickValue.current.x;
      }
      if (Math.abs(joystickValue.current.y) > 0.05) {
        // Joystick y points down on drag down, so we invert for movement
        moveInput = -joystickValue.current.y;
      }

      // Apply rotation
      playerRef.current.angle += rotateInput * rotSpeed * delta;

      // Calculate path direction displacement
      let dx = Math.cos(playerRef.current.angle) * moveInput * moveSpeed * delta;
      let dy = Math.sin(playerRef.current.angle) * moveInput * moveSpeed * delta;

      // Collision test against map bounds
      const nextX = playerRef.current.x + dx;
      const nextY = playerRef.current.y + dy;

      if (map[Math.floor(playerRef.current.y)][Math.floor(nextX)] === 0) {
        playerRef.current.x = nextX;
      }
      if (map[Math.floor(nextY)][Math.floor(playerRef.current.x)] === 0) {
        playerRef.current.y = nextY;
      }

      // Ghost pursuit AI (moves slowly towards players)
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

      // Render Spooky Raycaster
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill general buffer background
          ctx.fillStyle = '#050000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          let halfWidth = canvas.width / 2;
          let halfHeight = canvas.height / 2;

          // Render ceiling and floor gradient
          let ceilGrad = ctx.createLinearGradient(0, 0, 0, halfHeight);
          ceilGrad.addColorStop(0, '#020000');
          ceilGrad.addColorStop(1, '#0e0202');
          ctx.fillStyle = ceilGrad;
          ctx.fillRect(0, 0, canvas.width, halfHeight);

          let floorGrad = ctx.createLinearGradient(0, halfHeight, 0, canvas.height);
          floorGrad.addColorStop(0, '#030303');
          floorGrad.addColorStop(1, '#0b0202');
          ctx.fillStyle = floorGrad;
          ctx.fillRect(0, halfHeight, canvas.width, halfHeight);

          // Raycasting algorithm - scaled automatically to represent cinematic viewport width
          const fov = Math.PI / 2.5; // wider field of view for premium panorama feeling!
          const numRays = 180; // higher density for premium widescreen rendering
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
            const stepAng = rayAngle - playerRef.current.angle;
            const correctedDist = rayDist * Math.cos(stepAng);
            const wallHeight = Math.min(canvas.height, (canvas.height / correctedDist) * 1.5);

            // Distance-based ambient red-mist shade
            const shade = Math.max(0, 1 - correctedDist / 10);
            const hexShade = Math.floor(220 * shade);
            ctx.fillStyle = `rgb(${hexShade}, ${Math.floor(15 * shade)}, ${Math.floor(20 * shade)})`;
            ctx.fillRect(i * sliceWidth, halfHeight - wallHeight/2, sliceWidth + 0.5, wallHeight);
          }

          // Ambient 2D Radar viewport
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(canvas.width - 110, 10, 100, 100);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(canvas.width - 110, 10, 100, 100);

          const radarScale = 11;
          
          // Radar: Ghost
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(canvas.width - 110 + ghostRef.current.x * radarScale, 10 + ghostRef.current.y * radarScale, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Radar: Player
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(canvas.width - 110 + playerRef.current.x * radarScale, 10 + playerRef.current.y * radarScale, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Radar: Keys
          ctx.fillStyle = '#fbbf24';
          keysRef.current.forEach(k => {
            if (!k.found) {
              ctx.beginPath();
              ctx.arc(canvas.width - 110 + k.x * radarScale, 10 + k.y * radarScale, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Text overlay indicators inside canvas
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`المفاتيح المجمعة: ${keysCountRef.current}/3 🔑`, 15, 25);
          ctx.fillText(`وقت الصمود: ${Math.floor(survivalTime)} ثانية ⏱️`, 15, 42);
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
    <div ref={containerRef} className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-full">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-red-650/15 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse shadow-[0_0_30px_rgba(229,9,20,0.2)]">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">هروب الظلال: رعب المتاهة الفائق</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            استمر بالهرب في المتاهة المظلمة ثلاثية الأبعاد واجمع 3 مفاتيح ذهبية لفتح البوابة، وتجنب شبح القصر الأحمر!
          </p>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-primary text-white font-black text-xs rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            اسحب خيط الرعب والعب الآن
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6 w-full flex flex-col items-center relative">
          {/* Main Cinematic Landscape Game Window */}
          <div className="relative border-2 border-white/10 rounded-[2rem] overflow-hidden bg-black shadow-[0_0_50px_rgba(229,9,20,0.15)] aspect-[16/9] w-full max-w-4xl mx-auto">
            <canvas 
              ref={canvasRef} 
              width={720} 
              height={405} 
              className="w-full h-full block" 
            />

            {/* Virtual Joystick Overlay - Absolutely positioned for console experience! */}
            <div className="absolute bottom-6 right-6 z-55" dir="ltr">
              <VirtualJoystick 
                onChange={(pos) => {
                  joystickValue.current = pos;
                }}
                onEnd={() => {
                  joystickValue.current = { x: 0, y: 0 };
                }}
              />
            </div>

            {/* Hint message on overlay */}
            <div className="absolute bottom-6 left-6 hidden md:block bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] text-zinc-400 font-bold text-right border border-white/5">
              💡 وجه بالماوس/اللمس بالجوستيك الجانبي، أو تسابق بأسهم الكيبورد!
            </div>
          </div>

          <p className="text-[10px] text-primary bg-primary/5 border border-primary/20 px-3 py-1 rounded-full font-extrabold animate-pulse md:hidden">
            📱 حرك إصبعك على مقبض الجويستيك الدائري بالأعلى للتحكم السلس والهروب!
          </p>
        </div>
      )}

      {(gameState === 'gameover' || gameState === 'won') && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className={`p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2 shadow-2xl ${
            gameState === 'won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-600/10 text-primary border border-primary/20 animate-shake'
          }`}>
             <span className="text-5xl">{gameState === 'won' ? '🏆' : '💀'}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {gameState === 'won' ? 'تهانينا الحارة! تفوقت على الكابوس 🎉' : 'عذراً! قبض عليك شبح المتاهة الداكنة!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm mx-auto">
              {gameState === 'won' 
                ? 'لقد دبرت طوق نجاتك ببراعة وجمعت كل المفاتيح، وكسبت رصيد نقطتين بنجاح لمكافأة رصيدك الذهبي!'
                : 'لقد حاولت الصمود والهرب في زوايا المتاهة ولكن الشلال أدرك خطواتك. قم بالانتقام بلعب جولة جديدة!'}
            </p>
          </div>

          <div className="grid grid-cols-2 bg-[#0c0c14]/80 border border-white/10 p-4 rounded-2.5xl max-w-sm mx-auto divide-x divide-x-reverse divide-white/15 text-xs font-black text-zinc-300">
            <div className="px-2">المفاتيح المجمعة: {keysFound}/3 🔑</div>
            <div className="px-2">مدة الصمود: {Math.floor(survivalTime)} ثانية ⏱️</div>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-sm mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>محاولة الهروب مجدداً ⚔️</span>
          </button>
        </div>
      )}
    </div>
  );
}
