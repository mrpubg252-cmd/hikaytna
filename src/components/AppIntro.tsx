import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AppIntroProps {
  onComplete?: () => void;
}

export default function AppIntro({ onComplete }: AppIntroProps) {
  const [showIntro, setShowIntro] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [stage, setStage] = useState<'drawing' | 'ignited' | 'steady' | 'complete'>('drawing');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Overcome browser autoplay restrictions for unmuted video on first user tap
  useEffect(() => {
    if (!showIntro || videoFailed) return;

    const resumeVideoAudio = () => {
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => console.log("User interaction play attempt:", e));
        }
      }
    };

    // Try to trigger on mount
    resumeVideoAudio();

    window.addEventListener('click', resumeVideoAudio);
    window.addEventListener('touchstart', resumeVideoAudio);
    window.addEventListener('keydown', resumeVideoAudio);

    return () => {
      window.removeEventListener('click', resumeVideoAudio);
      window.removeEventListener('touchstart', resumeVideoAudio);
      window.removeEventListener('keydown', resumeVideoAudio);
    };
  }, [showIntro, videoFailed]);

  // 2. Video Playback & Timers
  useEffect(() => {
    if (!showIntro) return;

    // We keep the intro display for exactly 5.8 seconds, then trigger complete
    const completeTimer = setTimeout(() => {
      setStage('complete');
      setTimeout(() => {
        setShowIntro(false);
        if (onComplete) {
          onComplete();
        }
      }, 800); // fade out duration
    }, 5600);

    // Neon Ignite / Glow trigger after 1.8 seconds in the custom animation
    const igniteTimer = setTimeout(() => {
      setStage('ignited');
    }, 1500);

    const steadyTimer = setTimeout(() => {
      setStage('steady');
    }, 2200);

    // Try to play the real video if available
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("PWA Custom Video Intro is playing successfully!");
          })
          .catch((error) => {
            console.warn("Video play failed or file /intro.mp4 not found, falling back to gorgeous custom cinematic rendering:", error);
            setVideoFailed(true);
          });
      }
    }

    return () => {
      clearTimeout(completeTimer);
      clearTimeout(igniteTimer);
      clearTimeout(steadyTimer);
    };
  }, [showIntro]);

  // 3. Cosmic Space Particles Canvas
  useEffect(() => {
    if (!showIntro || videoFailed === false) return; // Only run particle canvas for fallback mode
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Astro-particles
    const particleCount = 75;
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      speedY: number;
      speedX: number;
      opacity: number;
      pulseDirection: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        speedY: (Math.random() * 0.4 + 0.1) * -1, // floating up slightly
        speedX: Math.random() * 0.3 - 0.15,
        opacity: Math.random() * 0.7 + 0.2,
        pulseDirection: Math.random() > 0.5 ? 0.01 : -0.01,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height * 0.45,
        10,
        width / 2,
        height * 0.45,
        Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, '#040409');
      bgGrad.addColorStop(0.5, '#020204');
      bgGrad.addColorStop(1, '#000001');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render star particles
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.shadowBlur = p.radius * 3;
        ctx.shadowColor = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Update Position
        p.y += p.speedY;
        p.x += p.speedX;
        p.opacity += p.pulseDirection;

        if (p.opacity > 0.95) p.pulseDirection = -0.01;
        if (p.opacity < 0.15) p.pulseDirection = 0.01;

        // Wrap boundaries
        if (p.y < 0) p.y = height;
        if (p.x < 0 || p.x > width) p.x = Math.random() * width;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [showIntro, videoFailed]);

  if (!showIntro) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="fixed inset-0 z-[9999999] bg-black select-none overflow-hidden touch-none"
      >
        {/* REAL INTERACTIVE VIDEO ATTEMPT */}
        {!videoFailed && (
          <video
            ref={videoRef}
            src="/intro.mp4"
            className="w-full h-full object-cover"
            playsInline
            autoPlay
            onError={() => {
              console.log("Direct video asset triggers error or is missing; initiating stunning cinematic container fallback.");
              setVideoFailed(true);
            }}
          />
        )}

        {/* HIGH-END HANDCRAFTED CUSTOM CINEMATIC FALLBACK */}
        {videoFailed && (
          <div className="absolute inset-0 flex flex-col justify-between items-center relative overflow-hidden">
            {/* Background Drifting Cosmos */}
            <canvas ref={canvasRef} className="absolute inset-0 z-0" />

            {/* Glowing spotlight from bottom-center */}
            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[80vw] h-[30vh] bg-red-600/10 blur-[80px] rounded-full z-0 pointer-events-none" />

            {/* TOP MARGIN */}
            <div className="pt-10 z-10" />

            {/* MIDDLE COMPONENT: THE LOGO ANIMATION */}
            <div className="flex flex-col items-center justify-center space-y-8 z-10 relative">
              
              {/* Cinematic Neon Logo Frame */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                
                {/* Underglow aura */}
                <div 
                  className={`absolute inset-0 rounded-full bg-red-600/2 transition-all duration-[1200ms] blur-[40px] ${
                    stage !== 'drawing' ? 'bg-red-500/30 scale-125 blur-[60px]' : 'scale-75'
                  }`}
                />

                {/* SVG Vector Draw & Glow */}
                <svg
                  className="w-36 h-36 relative z-10"
                  viewBox="0 0 200 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    {/* Glowing Filter effects */}
                    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="bubble-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <gradientStop offset="0%" stopColor="#ef4444" />
                      <gradientStop offset="100%" stopColor="#991b1b" />
                    </linearGradient>
                  </defs>

                  {/* Red bubble background - ignites intensely */}
                  {(stage === 'ignited' || stage === 'steady') && (
                    <motion.path
                      d="M 60,30 L 140,30 C 173,30 173,75 173,75 L 173,125 C 173,158 140,158 140,158 L 90,158 L 50,185 L 65,158 L 60,158 C 27,158 27,125 27,125 L 27,75 C 27,30 60,30 60,30 Z"
                      fill="url(#bubble-grad)"
                      initial={{ scale: 0.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 120, damping: 15 }}
                      className="shadow-[0_0_50px_rgba(239,68,68,0.6)]"
                    />
                  )}

                  {/* Outline Neon Path - Draws in phase 1 */}
                  <motion.path
                    d="M 60,30 L 140,30 C 173,30 173,75 173,75 L 173,125 C 173,158 140,158 140,158 L 90,158 L 50,185 L 65,158 L 60,158 C 27,158 27,125 27,125 L 27,75 C 27,30 60,30 60,30 Z"
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#neon-glow)"
                    initial={{ strokeDasharray: 700, strokeDashoffset: 700 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 2.2, ease: "easeOut" }}
                  />

                  {/* Inner Play Triangle */}
                  {(stage === 'ignited' || stage === 'steady') ? (
                    <motion.path
                      d="M 85,73 L 130,100 L 85,127 Z"
                      fill="#ffffff"
                      initial={{ opacity: 0, scale: 0.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    />
                  ) : (
                    <motion.path
                      d="M 85,73 L 130,100 L 85,127 Z"
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      strokeLinejoin="round"
                      initial={{ strokeDasharray: 120, strokeDashoffset: 120 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                    />
                  )}
                </svg>

                {/* Sparkling Flare Particles radiating outwards on ignite */}
                {stage === 'ignited' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white absolute animate-[ping_0.8s_ease-out_infinite] blur-[1px] scale-[15]" />
                    <div className="w-40 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent absolute transform rotate-12 scale-150 opacity-40 animate-pulse" />
                    <div className="w-40 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent absolute transform -rotate-45 scale-150 opacity-40 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Text Typography with Glowing effect */}
              <div className="text-center space-y-2 mt-4 select-none">
                <motion.h1
                  initial={{ opacity: 0, y: 15 }}
                  animate={stage !== 'drawing' ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.8 }}
                  className="text-white text-3xl font-black tracking-widest font-sans drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                  style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}
                >
                  حكايتنا
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={stage === 'steady' ? { opacity: 0.6 } : {}}
                  transition={{ duration: 1.0 }}
                  className="text-white/40 text-xs font-mono font-medium tracking-widest uppercase"
                >
                  hikayatna.my
                </motion.p>
              </div>
            </div>

            {/* BOTTOM SECTION: GROUND REFLECTION & LOADING BAR */}
            <div className="w-full flex flex-col items-center z-10">
              
              {/* Subtle Loading Progress Bar indicator */}
              <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative mb-12 border border-white/[0.02]">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5.4, ease: "linear" }}
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-600 to-red-400 font-sans shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                />
              </div>

              {/* Ground stone/grid reflection deck */}
              <div className="w-full h-24 bg-gradient-to-t from-black via-[#06060c] to-transparent border-t border-white/[0.05] relative w-screen">
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    transform: 'perspective(150px) rotateX(65deg)',
                    transformOrigin: 'top center'
                  }}
                />
                {/* Soft ground gloss reflection overlay */}
                <div 
                  className={`absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-full bg-red-600/10 blur-[25px] rounded-full transition-all duration-[2000ms] ${
                    stage !== 'drawing' ? 'opacity-100 scale-110' : 'opacity-20 scale-75'
                  }`}
                />
                
                {/* Footer security labels in the style guidelines */}
                <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 font-bold select-none whitespace-nowrap text-center">
                  نظام التوجيه السحابي للمشاهدة الآمنة بذكاء ⚡
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
