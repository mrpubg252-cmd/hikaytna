import React, { useState, useEffect, useRef, memo } from 'react';
import { Episode } from '../services/firebase';
import { cn } from '../lib/utils';
import { CheckCircle2, Play } from 'lucide-react';
import { progressService } from '../services/progressService';

interface HorizontalEpisodeListProps {
  episodes: Episode[];
  currentIndex: number;
  seriesImage: string;
  seriesId: string;
  onSelect: (ep: Episode, index: number) => void;
}

export default memo(function HorizontalEpisodeList({
  episodes,
  currentIndex,
  seriesImage,
  seriesId,
  onSelect,
}: HorizontalEpisodeListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Center/scroll-to active episode smoothly once mounted or when active episode changes
  useEffect(() => {
    if (containerRef.current) {
      // Small timeout to ensure DOM is ready and layout is calculated
      setTimeout(() => {
        if (!containerRef.current) return;
        const activeEl = containerRef.current.querySelector('[data-active="true"]') as HTMLElement;
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 50);
    }
  }, [currentIndex, episodes.length]);

  return (
    <div className="space-y-1">
      {/* Episodes Horizontal Carousel */}
      <div 
        ref={containerRef}
        className="flex flex-row items-stretch gap-2.5 pb-2 overflow-x-auto select-none snap-x snap-mandatory scroll-smooth no-scrollbar scroll-ps-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {episodes.map((ep, originalIndex) => {
          const isWatched = progressService.isWatched(seriesId, originalIndex);
          const isActive = currentIndex === originalIndex;
          const displayTitle = `الحلقة ${originalIndex + 1}`;

          return (
            <button
              key={originalIndex}
              data-active={isActive || undefined}
              tabIndex={0}
              type="button"
              onClick={() => onSelect(ep, originalIndex)}
              onFocus={(e) => {
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              data-tv-focusable="true"
              className={cn(
                "group text-right relative flex flex-col w-[130px] sm:w-[145px] shrink-0 snap-center rounded-xl bg-zinc-950 border transition-all duration-200 outline-none cursor-pointer focus:ring-2 focus:ring-primary focus:border-primary overflow-hidden shadow-inner",
                isActive
                  ? (ep.url?.includes('streamimdb') ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/20" : "border-primary bg-primary/5 ring-1 ring-primary/20")
                  : (ep.url?.includes('streamimdb') ? "border-amber-500/10 hover:border-amber-500/30" : "border-white/5 hover:border-white/10 hover:bg-zinc-900 active:scale-[0.98]")
              )}
            >
              {/* Image thumbnail 16:9 banner */}
              <div className="relative w-full aspect-[16/9] bg-zinc-900 overflow-hidden shrink-0 border-b border-white/[0.02]">
                {seriesImage ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={seriesImage}
                    alt={displayTitle}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-[center_top] opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 pointer-events-none will-change-transform"
                    onError={(e) => {
                      const currentSrc = e.currentTarget.src;
                      if (currentSrc.includes('/api/v1/image-proxy?url=')) {
                        try {
                          const urlPart = currentSrc.split('url=')[1];
                          if (urlPart) {
                            e.currentTarget.src = decodeURIComponent(urlPart);
                            return;
                          }
                        } catch(err) {}
                      }
                      e.currentTarget.src = 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-zinc-950 to-zinc-900" />
                )}

                {ep.url?.includes('streamimdb') && (
                  <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-amber-500/20 to-transparent pointer-events-none" />
                )}
                
                {/* Dark overlay trailing */}
                <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />

                {/* Play hover/current centered circle */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-black shadow animate-pulse",
                      ep.url?.includes('streamimdb') ? "bg-amber-500" : "bg-primary/95"
                    )}>
                      <Play className="w-2 h-2 fill-current text-white" />
                    </span>
                  </div>
                )}

                {/* 100% Accurate HD Badge Overlay */}
                <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-md text-[7px] font-extrabold text-white px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow border border-white/5 select-none font-sans">
                  <Play className={cn("w-1.5 h-1.5 fill-current", ep.url?.includes('streamimdb') ? "text-amber-500" : "text-primary")} />
                  <span>HD</span>
                </div>
              </div>

              {/* Title & Stats container */}
              <div className={cn(
                "py-1.5 px-2 text-center flex flex-col justify-center min-h-0 flex-1 w-full border-t border-white/5",
                isActive ? (ep.url?.includes('streamimdb') ? "bg-amber-500/10" : "bg-primary/5") : "bg-[#0b0c12]"
              )}>
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-extrabold truncate block text-center w-full leading-snug transition-colors duration-150",
                  isActive 
                    ? (ep.url?.includes('streamimdb') ? "text-amber-500" : "text-primary") 
                    : "text-zinc-200 group-hover:text-amber-400"
                )}>
                  {displayTitle}
                </span>

                <div className="flex items-center justify-center gap-1 mt-0.5 select-none text-[7px] font-sans">
                  {isWatched && (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                      <CheckCircle2 className="w-1.5 h-1.5" />
                      مكتمل
                    </span>
                  )}
                  {!isWatched && !isActive && (
                    <span className="text-zinc-500 font-medium whitespace-nowrap">
                      {ep.url?.includes('streamimdb') ? "متاح للتميز ✨" : "جاهز فوراً ⚡"}
                    </span>
                  )}
                  {isActive && (
                    <span className={cn(
                      "font-black animate-pulse",
                      ep.url?.includes('streamimdb') ? "text-amber-500" : "text-primary"
                    )}>
                      يُعرض الآن
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
