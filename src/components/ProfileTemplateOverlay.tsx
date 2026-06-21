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
    </div>
  );
}
