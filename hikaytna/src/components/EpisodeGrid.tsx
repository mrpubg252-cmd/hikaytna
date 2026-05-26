import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '../lib/utils';
import { Episode } from '../services/firebase';
import { CheckCircle2, Play, Eye, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { progressService } from '../services/progressService';

interface EpisodeGridProps {
  episodes: Episode[];
  currentIndex: number;
  seriesId: string;
  seriesImage?: string;
  onSelect: (ep: Episode, index: number) => void;
}

function formatEpisodeTitle(title: string, index: number): string {
  if (!title) return `الحلقة ${index + 1}`;
  let clean = title.trim();

  // If there's any integer number in the string, let's use it as the clean episode number
  const numberMatch = clean.match(/\d+/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    
    // Clean description to see if there is genuine Arabic text that is not duplicate ep info
    let cleanDesc = clean
      .replace(/(?:ep|episode|ep\#|ep\.|halka|الحلقة|حلقة|حلق)\s*#?\d+/gi, '')
      .replace(/\d+/g, '')
      .replace(/حلق[هة]/g, '')
      .replace(/[-|_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanDesc && cleanDesc.length > 2) {
      // Capitalize first letter of any English word leftover or keep original
      return `الحلقة ${num} - ${cleanDesc}`;
    }
    
    return `الحلقة ${num}`;
  }

  return title.includes('الحلقة') ? title : `الحلقة ${title}`;
}

const ITEMS_PER_PAGE = 24;

export default function EpisodeGrid({ episodes, currentIndex, seriesId, seriesImage, onSelect }: EpisodeGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group episodes into chunks/pages of size ITEMS_PER_PAGE
  const totalPages = Math.ceil(episodes.length / ITEMS_PER_PAGE);

  // Auto-align selected page to contain the active currentIndex on mount or change
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < episodes.length) {
      const pageOfCurrent = Math.floor(currentIndex / ITEMS_PER_PAGE);
      setSelectedPageIndex(pageOfCurrent);
    }
  }, [currentIndex, episodes.length]);

  // Compute filtered episodes based on search
  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return episodes.map((ep, originalIndex) => ({ ep, originalIndex }));
    }
    
    const query = searchQuery.toLowerCase().trim();
    return episodes
      .map((ep, originalIndex) => ({ ep, originalIndex }))
      .filter(({ ep, originalIndex }) => {
        const titleStr = ep.title.toLowerCase();
        const epNumStr = (originalIndex + 1).toString();
        return titleStr.includes(query) || epNumStr === query || titleStr.replace(/\D/g, '').includes(query);
      });
  }, [episodes, searchQuery]);

  // If searching, we display everything matches or first 50 results.
  // If not searching, we only display the selected page's items to maintain perfect hardware frame rates.
  const displayedEpisodes = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredEpisodes.slice(0, 50);
    }
    const start = selectedPageIndex * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredEpisodes.slice(start, end);
  }, [filteredEpisodes, searchQuery, selectedPageIndex]);

  return (
    <div className="space-y-6">
      {/* 1. Instant Seek & Filtration Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 p-3 sm:p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            dir="rtl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الحلقة أو الاسم... (مثال: 5)"
            className="w-full bg-zinc-900/60 border border-white/5 rounded-full py-2 pl-4 pr-10 text-xs text-white outline-none focus:border-primary/50 placeholder-zinc-500 font-bold transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 hover:text-white bg-white/5 px-2 py-0.5 rounded"
            >
              إلغاء
            </button>
          )}
        </div>
        
        <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5 md:self-center shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          <span>المجموع: <strong className="text-zinc-300 font-black">{episodes.length} حلقة</strong></span>
          {searchQuery && (
            <span> | تم العثور على: <strong className="text-primary font-black">{filteredEpisodes.length} حلقة</strong></span>
          )}
        </div>
      </div>

      {/* 2. Netflix-style Segment Tabs for ranges */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex flex-wrap gap-2 pb-1 overflow-x-auto custom-scrollbar select-none">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const startNum = idx * ITEMS_PER_PAGE + 1;
            const endNum = Math.min((idx + 1) * ITEMS_PER_PAGE, episodes.length);
            const isTabActive = selectedPageIndex === idx;
            
            return (
              <button
                key={idx}
                onClick={() => setSelectedPageIndex(idx)}
                className={cn(
                  "px-4 py-2 text-[11px] font-black rounded-xl transition-all border shrink-0 cursor-pointer active:scale-95",
                  isTabActive
                    ? "bg-primary text-black border-primary shadow-lg shadow-primary/10"
                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900/80 hover:border-white/10"
                )}
              >
                <span>الحلقات</span> <span dir="ltr">({startNum} - {endNum})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. The Grid display (Fast & Lightweight) */}
      {displayedEpisodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/5 rounded-2xl bg-zinc-950/20">
          <Sparkles className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
          <p className="text-xs font-bold text-zinc-500">لم نجد أي حلقة تطابق بحثك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-0">
          {displayedEpisodes.map(({ ep, originalIndex }) => {
            const isWatched = progressService.isWatched(seriesId, originalIndex);
            const isActive = currentIndex === originalIndex;
            const displayTitle = formatEpisodeTitle(ep.title, originalIndex);
            const isFinalEpisode = 
              /الأخي?رة/i.test(ep.title) || 
              /الاخي?ره/i.test(ep.title) ||
              /النهائية/i.test(ep.title) ||
              /النهائيه/i.test(ep.title);
            
            return (
              <button
                key={originalIndex}
                onClick={() => onSelect(ep, originalIndex)}
                className={cn(
                  "group text-right relative bg-zinc-950/60 hover:bg-zinc-900/80 border rounded-2xl p-2.5 transition-all duration-300 flex items-center gap-3.5 select-none w-full outline-none cursor-pointer",
                  isActive
                    ? "border-primary/50 bg-[#121217] shadow-xl shadow-primary/5 ring-1 ring-primary/30"
                    : "border-white/5 hover:border-white/10 active:scale-[0.99]"
                )}
              >
                {/* Thumbnail with custom playing indicators */}
                <div className="relative w-28 aspect-[16/9] sm:w-32 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/[0.03]">
                  {seriesImage ? (
                    <img
                      referrerPolicy="no-referrer"
                      src={seriesImage}
                      alt={displayTitle}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
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
                  
                  {/* Play gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 border",
                      isActive 
                        ? "bg-primary text-black border-primary scale-110" 
                        : "bg-black/60 text-white border-white/20 group-hover:bg-primary group-hover:text-black group-hover:border-primary group-hover:scale-110"
                    )}>
                      <Play className="w-3.5 h-3.5 fill-current translate-x-[-0.5px]" />
                    </div>
                  </div>

                  {/* Watched complete indicator badge on thumbnail */}
                  {isWatched && (
                    <span className="absolute bottom-1 right-1 bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>مكتمل</span>
                    </span>
                  )}
                </div>

                {/* Title and stats layout on right */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                  <span className={cn(
                    "text-xs sm:text-sm font-black truncate leading-snug transition-colors duration-200",
                    isActive ? "text-primary font-black" : "text-white group-hover:text-primary"
                  )}>
                    {displayTitle}
                  </span>
                  
                  <div className="flex items-center flex-wrap gap-1.5 mt-1">
                    {isActive ? (
                      <span className="inline-flex items-center text-[10px] text-primary font-black animate-pulse bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        تشغيل الآن
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
                        <Eye className="w-3 h-3 text-zinc-600" />
                        <span>مفتوح للمشاهدة</span>
                      </span>
                    )}

                    {isFinalEpisode && (
                      <span className="inline-flex items-center text-[9px] text-[#ffca28] font-black bg-[#ffca28]/10 px-1.5 py-0.5 rounded-md border border-[#ffca28]/20 shadow-sm animate-pulse">
                        👑 الحلقة الأخيرة
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
