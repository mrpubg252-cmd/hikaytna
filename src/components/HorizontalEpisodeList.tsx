import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Episode } from '../services/firebase';
import { cn } from '../lib/utils';
import { CheckCircle2, Play, Search, Eye } from 'lucide-react';
import { progressService } from '../services/progressService';

interface HorizontalEpisodeListProps {
  episodes: Episode[];
  currentIndex: number;
  seriesImage: string;
  seriesId: string;
  onSelect: (ep: Episode, index: number) => void;
}

function formatEpisodeTitle(title: string, index: number): string {
  if (!title) return `الحلقة ${index + 1}`;
  let clean = title.trim();
  
  // Clean prefixes for visual elegance
  clean = clean.replace(/^(ep|episode|ep\#|ep\.|halka|الحلقة)\s*/gi, '');
  
  const parsed = parseInt(clean);
  if (!isNaN(parsed)) {
    return `الحلقة ${parsed}`;
  }
  
  return title.includes('الحلقة') ? title : `الحلقة ${title}`;
}

const ITEMS_PER_PAGE = 24;

export default function HorizontalEpisodeList({
  episodes,
  currentIndex,
  seriesImage,
  seriesId,
  onSelect,
}: HorizontalEpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(episodes.length / ITEMS_PER_PAGE);

  // Auto scroll/align to the page containing current active episode
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < episodes.length) {
      const pageOfCurrent = Math.floor(currentIndex / ITEMS_PER_PAGE);
      setSelectedPageIndex(pageOfCurrent);
    }
  }, [currentIndex, episodes.length]);

  useEffect(() => {
    // Scroll active item into view within the scroll container safely without shifting browser window
    if (containerRef.current) {
      const container = containerRef.current;
      const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        const containerHeight = container.clientHeight;
        const elemTop = activeEl.offsetTop;
        const elemHeight = activeEl.offsetHeight;
        
        // Centering the selected item smoothly in the sidebar drawer list container
        const targetScrollTop = elemTop - (containerHeight / 2) + (elemHeight / 2);
        
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex, selectedPageIndex]);

  // Filter episodes
  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return episodes.map((ep, idx) => ({ ep, originalIndex: idx }));
    }
    const query = searchQuery.toLowerCase().trim();
    return episodes
      .map((ep, idx) => ({ ep, originalIndex: idx }))
      .filter(({ ep, originalIndex }) => {
        const titleStr = ep.title.toLowerCase();
        const epNumStr = (originalIndex + 1).toString();
        return titleStr.includes(query) || epNumStr === query || titleStr.replace(/\D/g, '').includes(query);
      });
  }, [episodes, searchQuery]);

  const displayedEpisodes = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredEpisodes.slice(0, 50);
    }
    const start = selectedPageIndex * ITEMS_PER_PAGE;
    return filteredEpisodes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEpisodes, searchQuery, selectedPageIndex]);

  return (
    <div className="space-y-4">
      {/* Search search input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          dir="rtl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث برقم الحلقة... (مثال: 5)"
          className="w-full bg-zinc-900/60 border border-white/5 rounded-full py-2 pl-3 pr-9 text-[10px] text-white outline-none focus:border-primary/50 placeholder-zinc-500 font-bold transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400 hover:text-white bg-white/5 px-1.5 py-0.5 rounded"
          >
            إلغاء
          </button>
        )}
      </div>

      {/* Pages tabs for quick jumps if many episodes */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 select-none custom-scrollbar pb-1">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const isTabActive = selectedPageIndex === idx;
            const startNum = idx * ITEMS_PER_PAGE + 1;
            const endNum = Math.min((idx + 1) * ITEMS_PER_PAGE, episodes.length);
            
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPageIndex(idx)}
                className={cn(
                  "px-2 py-1 text-[9px] font-black rounded-lg border transition-all shrink-0 cursor-pointer active:scale-95",
                  isTabActive
                    ? "bg-primary text-black border-primary"
                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white"
                )}
              >
                <span dir="ltr">{startNum} - {endNum}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Episode List Column */}
      <div 
        ref={containerRef}
        className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1 pb-4 custom-scrollbar"
      >
        {displayedEpisodes.map(({ ep, originalIndex }) => {
          const isWatched = progressService.isWatched(seriesId, originalIndex);
          const isActive = currentIndex === originalIndex;
          const displayTitle = formatEpisodeTitle(ep.title, originalIndex);

          return (
            <button
              key={originalIndex}
              data-active={isActive}
              type="button"
              onClick={() => onSelect(ep, originalIndex)}
              className={cn(
                "group text-right relative bg-[#09090c]/80 hover:bg-zinc-900 border rounded-xl p-2 transition-all duration-200 flex items-center gap-2.5 w-full outline-none cursor-pointer",
                isActive
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                  : "border-white/5 hover:border-white/10 active:scale-[0.99]"
              )}
            >
              {/* Image thumbnail nested in list */}
              <div className="relative w-16 aspect-video rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-white/[0.03]">
                {seriesImage ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={seriesImage}
                    alt={displayTitle}
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-zinc-950 to-zinc-900" />
                )}
                
                {/* Play hover/current overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Play className={cn(
                    "w-3 h-3 transition-transform duration-250",
                    isActive ? "text-primary scale-110 fill-primary" : "text-white opacity-80 group-hover:scale-110"
                  )} />
                </div>
              </div>

              {/* Title specs */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className={cn(
                  "text-[10px] sm:text-xs font-black truncate leading-tight transition-colors duration-200",
                  isActive ? "text-primary font-black scale-102 inline-block origin-right" : "text-zinc-200 group-hover:text-primary"
                )}>
                  {displayTitle}
                </span>

                <div className="flex items-center gap-1.5 mt-0.5">
                  {isWatched && (
                    <span className="text-emerald-400 text-[8px] font-black flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      مكتمل
                    </span>
                  )}
                  {!isWatched && !isActive && (
                    <span className="text-zinc-500 text-[8px] font-bold flex items-center gap-0.5">
                      <Eye className="w-2 h-2 text-zinc-650" />
                      جاهز
                    </span>
                  )}
                  {isActive && (
                    <span className="text-primary text-[8px] font-extrabold animate-pulse">
                      يتم تشغيلها الآن ✨
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
}
