import React, { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { Episode } from "../services/firebase";
import {
  CheckCircle2,
  Play,
  Eye,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { progressService } from "../services/progressService";

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
      .replace(/(?:ep|episode|ep\#|ep\.|halka|الحلقة|حلقة|حلق)\s*#?\d+/gi, "")
      .replace(/\d+/g, "")
      .replace(/حلق[هة]/g, "")
      .replace(/[-|_]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanDesc && cleanDesc.length > 2) {
      // Capitalize first letter of any English word leftover or keep original
      return `الحلقة ${num} - ${cleanDesc}`;
    }

    return `الحلقة ${num}`;
  }

  return title.includes("الحلقة") ? title : `الحلقة ${title}`;
}

export default function EpisodeGrid({
  episodes,
  currentIndex,
  seriesId,
  seriesImage,
  onSelect,
}: EpisodeGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [jumpToRange, setJumpToRange] = useState(0); // 0 means first block of 50
  const [isReversed, setIsReversed] = useState(false); // Newest first toggle
  const searchInputRef = useRef<HTMLInputElement>(null);

  const episodesWithIndices = useMemo(() => {
    const mapped = episodes.map((ep, originalIndex) => ({ ep, originalIndex }));
    return isReversed ? [...mapped].reverse() : mapped;
  }, [episodes, isReversed]);

  // Compute filtered episodes based on search
  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return episodesWithIndices;
    }

    const query = searchQuery.toLowerCase().trim();
    return episodesWithIndices.filter(({ ep, originalIndex }) => {
      const titleStr = ep.title.toLowerCase();
      const epNumStr = (originalIndex + 1).toString();
      return (
        titleStr.includes(query) ||
        epNumStr === query ||
        titleStr.replace(/\D/g, "").includes(query)
      );
    });
  }, [episodesWithIndices, searchQuery]);

  // Range size for segments
  const RANGE_SIZE = 50;
  const totalRanges = Math.ceil(episodes.length / RANGE_SIZE);

  // Auto-reset jumpToRange if current page index out of bounds
  useEffect(() => {
    if (jumpToRange >= totalRanges && totalRanges > 0) {
      setJumpToRange(0);
    }
  }, [totalRanges, jumpToRange]);

  // If searching, display more matches immediately.
  // Otherwise display specific range or current visible count.
  const displayedEpisodes = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredEpisodes.slice(0, 100);
    }
    
    // Split into segments of 50
    const start = jumpToRange * RANGE_SIZE;
    const end = start + RANGE_SIZE;
    
    // We take the slice from the current order (original or reversed)
    return filteredEpisodes.slice(start, end);
  }, [filteredEpisodes, searchQuery, jumpToRange, episodes.length]);

  return (
    <div className="space-y-6">
      {/* 1. Header Bar: Search and Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/40 p-4 rounded-3xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            dir="rtl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الحلقة أو العنوان..."
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-4 pr-11 text-xs text-white outline-none focus:border-primary/50 placeholder-zinc-500 font-bold transition-all"
          />
        </div>

        <button
          onClick={() => setIsReversed(!isReversed)}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all border",
            isReversed 
              ? "bg-primary text-white border-primary shadow-[0_0_15px_rgba(229,9,20,0.3)]" 
              : "bg-zinc-900 text-zinc-400 border-white/5 hover:text-white"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{isReversed ? "من الأحدث" : "من الأقدم"}</span>
        </button>
      </div>

      {/* 2. Range Selector Tabs (Only if many episodes) */}
      {!searchQuery && episodes.length > RANGE_SIZE && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar direction-rtl">
          {Array.from({ length: totalRanges }).map((_, i) => {
            const startNum = i * RANGE_SIZE + 1;
            const endNum = Math.min((i + 1) * RANGE_SIZE, episodes.length);
            const active = jumpToRange === i;
            
            return (
              <button
                key={i}
                onClick={() => {
                  setJumpToRange(i);
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className={cn(
                  "shrink-0 px-6 py-2.5 rounded-xl text-[10px] font-black transition-all border whitespace-nowrap",
                  active
                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105"
                    : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-white hover:bg-zinc-900"
                )}
              >
                الحلقات {startNum} - {endNum}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. The Grid display */}
      {displayedEpisodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/5 rounded-2xl bg-zinc-950/20">
          <Sparkles className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
          <p className="text-xs font-bold text-zinc-500">
            لم نجد أي حلقة تطابق بحثك
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-0">
          {displayedEpisodes.map(({ ep, originalIndex }) => {
            const isWatched = progressService.isWatched(
              seriesId,
              originalIndex,
            );
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
                    : "border-white/5 hover:border-white/10 active:scale-[0.99]",
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
                        if (currentSrc.includes("/api/v1/image-proxy?url=")) {
                          try {
                            const urlPart = currentSrc.split("url=")[1];
                            if (urlPart) {
                              e.currentTarget.src = decodeURIComponent(urlPart);
                              return;
                            }
                          } catch (err) {}
                        }
                        e.currentTarget.src =
                          "https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-zinc-950 to-zinc-900" />
                  )}

                  {/* Play gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 border",
                        isActive
                          ? "bg-primary text-black border-primary scale-110"
                          : "bg-black/60 text-white border-white/20 group-hover:bg-primary group-hover:text-black group-hover:border-primary group-hover:scale-110",
                      )}
                    >
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
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-black truncate leading-snug transition-colors duration-200",
                      isActive
                        ? "text-primary font-black"
                        : "text-white group-hover:text-primary",
                    )}
                  >
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
