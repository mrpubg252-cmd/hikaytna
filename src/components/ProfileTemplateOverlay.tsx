import React from 'react';

interface Props {
  template: string | null | undefined;
  className?: string;
}

export default function ProfileTemplateOverlay({ template, className = 'absolute inset-0 w-full h-full' }: Props) {
  if (!template || template === 'none') return null;

  return (
    <div className={`${className} pointer-events-none z-30 select-none overflow-visible`}>
      {template === 'saudia' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]">
          {/* Saudi Green & Luxury Gold Border */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#10b981" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 2" />
          
          {/* Palm and Crossed Swords at bottom center */}
          <g transform="translate(37, 72) scale(0.26)">
            {/* Palm */}
            <path d="M50 35 C50 15, 20 10, 10 30 C30 30, 45 40, 50 50 C50 40, 65 30, 90 30 C80 10, 50 15, 50 35" fill="#10b981" />
            <rect x="47.5" y="45" width="5" height="15" rx="2.5" fill="#fbbf24" />
            {/* Swords */}
            <path d="M20 70 L80 70 M25 75 L75 65" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
            <path d="M15 78 C25 68, 50 62, 85 62" fill="none" stroke="#10b981" strokeWidth="3" />
            <path d="M85 78 C75 68, 50 62, 15 62" fill="none" stroke="#10b981" strokeWidth="3" />
          </g>
          
          {/* Golden Stars at top corners to make it feel super VIP */}
          <path d="M50 5 L52 9 L57 9 L53 12 L55 16 L50 14 L45 16 L47 12 L43 9 L48 9 Z" fill="#fbbf24" />
          <path d="M20 20 L21 23 L24 23 L22 25 L23 28 L20 26 L17 28 L18 25 L16 23 L19 23 Z" fill="#fbbf24" />
          <path d="M80 20 L81 23 L84 23 L82 25 L83 28 L80 26 L77 28 L78 25 L76 23 L79 23 Z" fill="#fbbf24" />
        </svg>
      )}

      {template === 'football' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
          {/* Sporty stadium dynamic boundary */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#ef4444" strokeWidth="2" />
          {/* Inner playground white lines dashed */}
          <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
          
          {/* Soccer Ball at bottom center */}
          <g transform="translate(42, 74) scale(0.16)">
            <circle cx="50" cy="50" r="45" fill="#ffffff" stroke="#18181b" strokeWidth="5" />
            {/* Soccer pentagon patterns */}
            <polygon points="50,25 65,35 60,55 40,55 35,35" fill="#18181b" />
            <polygon points="50,25 35,35 15,30 20,10 40,5" fill="#18181b" opacity="0.8" />
            <polygon points="50,25 65,35 85,30 80,10 60,5" fill="#18181b" opacity="0.8" />
            <polygon points="40,55 35,35 15,30 10,50 25,65" fill="#18181b" opacity="0.8" />
            <polygon points="60,55 65,35 85,30 90,50 75,65" fill="#18181b" opacity="0.8" />
            <polygon points="40,55 60,55 75,65 50,85 25,65" fill="#18181b" opacity="0.8" />
          </g>

          {/* Goal posts mini graphic at the top of circle */}
          <path d="M35 12 L35 4 L65 4 L65 12" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <path d="M35 4 L65 12 M35 12 L65 4" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1 1" opacity="0.4" />
        </svg>
      )}

      {template === 'fire' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(249,115,22,0.7)]">
          {/* Glowing Blazing Ring */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="url(#fireGradient)" strokeWidth="3" />
          
          <defs>
            <linearGradient id="fireGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>

          {/* Fire flames at bottom climbing up */}
          <g fill="url(#fireGradient)">
            {/* Center main flame */}
            <path d="M50 96 C42 96, 38 85, 45 72 C48 68, 52 64, 50 56 C53 62, 58 66, 56 75 C55 85, 58 96, 50 96 Z" />
            {/* Left Flame */}
            <path d="M28 88 C20 82, 22 70, 29 60 C32 56, 30 52, 28 46 C32 50, 36 55, 34 63 C33 72, 36 82, 28 88 Z" transform="rotate(-15, 28, 88)" fill="url(#fireGradient)" />
            {/* Right Flame */}
            <path d="M72 88 C80 82, 78 70, 71 60 C68 56, 70 52, 72 46 C68 50, 64 55, 66 63 C67 72, 64 82, 72 88 Z" transform="rotate(15, 72, 88)" fill="url(#fireGradient)" />
          </g>
        </svg>
      )}

      {template === 'crown' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
          {/* Luxury Royal dotted thin border */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 3" opacity="0.75" />
          
          {/* Glistening Royal Crown at the top */}
          <g transform="translate(25, -12) scale(0.5)" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
            {/* Crown Base */}
            <path d="M10 70 L90 70 L85 85 L15 85 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
            {/* Crown Peaks */}
            <path d="M10 70 L15 35 L33 55 L50 20 L67 55 L85 35 L90 70 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" />
            
            {/* Royal jewels inside base */}
            <circle cx="30" cy="78" r="4" fill="#ef4444" />
            <circle cx="50" cy="78" r="4" fill="#3b82f6" />
            <circle cx="70" cy="78" r="4" fill="#10b981" />
            
            {/* Jewel tips */}
            <circle cx="15" cy="35" r="5" fill="#facc15" stroke="#d97706" strokeWidth="1" />
            <circle cx="50" cy="20" r="6" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
            <circle cx="85" cy="35" r="5" fill="#facc15" stroke="#d97706" strokeWidth="1" />
          </g>

          {/* Golden diamonds on the sides */}
          <polygon points="10,50 13,46 16,50 13,54" fill="#fbbf24" />
          <polygon points="90,50 87,46 84,50 87,54" fill="#fbbf24" />
        </svg>
      )}

      {template === 'vip' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]">
          <defs>
            <linearGradient id="vipGold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="30%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="purpleGem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#6b21a8" />
            </linearGradient>
          </defs>
          {/* VIP Golden Shiny Frame */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="url(#vipGold)" strokeWidth="3" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.6" />
          
          {/* Big Sparkling Purple Diamond at top */}
          <g transform="translate(42, -5) scale(0.16)" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            <polygon points="50,15 80,45 50,90 20,45" fill="url(#purpleGem)" stroke="url(#vipGold)" strokeWidth="4" />
            <polygon points="50,15 50,90 80,45" fill="#d8b4fe" opacity="0.3" />
            <polygon points="50,15 20,45 50,45" fill="#f3e8ff" opacity="0.4" />
          </g>

          {/* Little diamonds on sides */}
          <g transform="translate(3, 45) scale(0.08)">
            <polygon points="50,15 80,45 50,90 20,45" fill="url(#purpleGem)" stroke="url(#vipGold)" strokeWidth="4" />
          </g>
          <g transform="translate(89, 45) scale(0.08)">
            <polygon points="50,15 80,45 50,90 20,45" fill="url(#purpleGem)" stroke="url(#vipGold)" strokeWidth="4" />
          </g>

          {/* Golden Stars in lower corners */}
          <path d="M22 80 L23.5 83 L26.5 83 L24 85 L25 88 L22 86 L19 88 L20 85 L17.5 83 L20.5 83 Z" fill="url(#vipGold)" />
          <path d="M78 80 L79.5 83 L82.5 83 L80 85 L81 88 L78 86 L75 88 L76 85 L73.5 83 L76.5 83 Z" fill="url(#vipGold)" />
        </svg>
      )}

      {template === 'anime' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]">
          {/* Anime Cute Pink Cherry Blossom Frame */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#f472b6" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#fce7f3" strokeWidth="1" strokeDasharray="5 2" />

          {/* Top Sakura Flower */}
          <g transform="translate(42, -5) scale(0.16)">
            {/* 5 Petals */}
            <path d="M50 50 C50 30, 30 30, 30 50 C30 70, 50 70, 50 50" fill="#f472b6" />
            <path d="M50 50 C70 50, 70 30, 50 30 C30 30, 30 50, 50 50" fill="#f472b6" transform="rotate(72, 50, 50)" />
            <path d="M50 50 C70 50, 70 30, 50 30 C30 30, 30 50, 50 50" fill="#f472b6" transform="rotate(144, 50, 50)" />
            <path d="M50 50 C70 50, 70 30, 50 30 C30 30, 30 50, 50 50" fill="#f472b6" transform="rotate(216, 50, 50)" />
            <path d="M50 50 C70 50, 70 30, 50 30 C30 30, 30 50, 50 50" fill="#f472b6" transform="rotate(288, 50, 50)" />
            <circle cx="50" cy="50" r="8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          </g>

          {/* Falling sakura petal bottom-right */}
          <g transform="translate(76, 76) scale(0.12) rotate(45)">
            <path d="M50 50 C40 30, 15 35, 25 55 C35 75, 60 70, 50 50" fill="#f472b6" opacity="0.9" />
          </g>
          {/* Falling sakura petal bottom-left */}
          <g transform="translate(14, 74) scale(0.1) rotate(-30)">
            <path d="M50 50 C40 30, 15 35, 25 55 C35 75, 60 70, 50 50" fill="#f472b6" opacity="0.8" />
          </g>
        </svg>
      )}

      {template === 'neon' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]">
          <defs>
            <linearGradient id="neonCyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* Glowing Neon Ring */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="url(#neonCyanPurple)" strokeWidth="3" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.9" />

          {/* Left Lightning Bolt */}
          <g transform="translate(2, 38) scale(0.12)" fill="#22d3ee" className="drop-shadow-[0_0_8px_#06b6d4]">
            <polygon points="30,5 5,55 25,55 15,95 45,40 25,40" />
          </g>

          {/* Right Lightning Bolt */}
          <g transform="translate(86, 38) scale(0.12)" fill="#e9d5ff" className="drop-shadow-[0_0_8px_#a855f7]">
            <polygon points="30,5 5,55 25,55 15,95 45,40 25,40" />
          </g>

          {/* Top tech lines */}
          <path d="M38 6 L45 10 L55 10 L62 6" fill="none" stroke="url(#neonCyanPurple)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}

      {template === 'retro' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
          {/* Classic Filmstrip Frame */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#1c1917" strokeWidth="4" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#f59e0b" strokeWidth="1.5" />

          {/* Film perforations around the ring */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.8" />

          {/* Clapperboard at bottom-center */}
          <g transform="translate(34, 74) scale(0.32)" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {/* Clapper body */}
            <rect x="5" y="15" width="26" height="20" rx="3" fill="#1c1917" stroke="#ffffff" strokeWidth="1" />
            {/* Clapper top bar */}
            <path d="M3 15 L33 11 L31 7 L3 11 Z" fill="#1c1917" stroke="#ffffff" strokeWidth="1" />
            {/* White stripes on clapper */}
            <line x1="8" y1="14" x2="12" y2="10" stroke="#ffffff" strokeWidth="2" />
            <line x1="18" y1="13" x2="22" y2="9" stroke="#ffffff" strokeWidth="2" />
            <line x1="28" y1="12" x2="32" y2="8" stroke="#ffffff" strokeWidth="2" />
            {/* Red heart on clapperboard */}
            <path d="M18 22 C16 20, 13 21, 13 24 C13 27, 18 30, 18 30 C18 30, 23 27, 23 24 C23 21, 20 20, 18 22 Z" fill="#ef4444" />
          </g>

          {/* Vintage star at top center */}
          <path d="M50 5 L51.5 9 L55.5 9 L52.2 11.5 L53.5 15.5 L50 13 L46.5 15.5 L47.8 11.5 L44.5 9 L48.5 9 Z" fill="#ef4444" />
        </svg>
      )}

      {template === 'winter' && (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(186,230,253,0.7)]">
          {/* Winter Crystal Frozen Frame */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="#7dd3fc" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#e0f2fe" strokeWidth="1" strokeDasharray="3 4" />

          {/* Snowflake crystal top-center */}
          <g transform="translate(42, -5) scale(0.16)" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" fill="none">
            <line x1="50" y1="20" x2="50" y2="80" />
            <line x1="20" y1="50" x2="80" y2="50" />
            <line x1="29" y1="29" x2="71" y2="71" />
            <line x1="29" y1="71" x2="71" y2="29" />
            {/* branches */}
            <path d="M50 30 L40 25 M50 30 L60 25" />
            <path d="M50 70 L40 75 M50 70 L60 75" />
            <path d="M30 50 L25 40 M30 50 L25 50" />
            <path d="M70 50 L75 40 M70 50 L75 60" />
          </g>

          {/* Tiny snowflakes on the sides */}
          <g transform="translate(6, 44) scale(0.08)" stroke="#7dd3fc" strokeWidth="5" strokeLinecap="round" fill="none">
            <line x1="50" y1="20" x2="50" y2="80" /><line x1="20" y1="50" x2="80" y2="50" />
            <line x1="29" y1="29" x2="71" y2="71" /><line x1="29" y1="71" x2="71" y2="29" />
          </g>
          <g transform="translate(86, 44) scale(0.08)" stroke="#7dd3fc" strokeWidth="5" strokeLinecap="round" fill="none">
            <line x1="50" y1="20" x2="50" y2="80" /><line x1="20" y1="50" x2="80" y2="50" />
            <line x1="29" y1="29" x2="71" y2="71" /><line x1="29" y1="71" x2="71" y2="29" />
          </g>
        </svg>
      )}
    </div>
  );
}
