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
import {
  fetchEpisodesDetailsFromTMDB,
  TMDBSimplifiedEpisode
} from "../services/api";
import { getApiUrl } from "../lib/apiConfig";

export function getProxiedImageUrl(url?: string): string {
  if (!url) return "https://images.unsplash.com/photo-1542204172-3c1f81edf4a1?q=80&w=400&auto=format&fit=crop";
  
  // Directly load fast, CORS-compliant major CDNs without proxying to maximize speed
  if (
    url.startsWith("http") &&
    !url.includes("ibb.co") &&
    !url.includes("tmdb.org") &&
    !url.includes("image.tmdb.org") &&
    !url.includes("cloudinary.com") &&
    !url.includes("/api/v1/image-proxy") &&
    !url.includes("unsplash.com")
  ) {
    return getApiUrl(`/api/v1/image-proxy?url=${encodeURIComponent(url)}`);
  }
  return url;
}

interface EpisodeGridProps {
  episodes: Episode[];
  currentIndex: number;
  seriesId: string;
  seriesImage?: string;
  isMovie?: boolean;
  onSelect: (ep: Episode, index: number) => void;
  seriesTitle?: string;
}

export function formatEpisodeTitle(title: string, index: number, isMovie: boolean): string {
  if (isMovie) return "مشاهدة الفيلم";
  if (!title) return `الحلقة ${index + 1}`;
  
  // First, strip occurrences of multiple redundant tags if present (e.g., 'الحلقة Ep#1' -> '1')
  let clean = title.trim();

  if (/^الحلقة \d+( - جزء \d+)?$/.test(clean) || clean.includes("جزء") || /^E\d+-P\d+$/i.test(clean)) {
     return `الحلقة ${index + 1}`;
  }

  const epNumMatch = clean.match(/(?:الحلقة|حلقة|ep\s*\#|episode|\bep\b|\bE)\s*#?\s*(\d+)/i) || clean.match(/^(\d+)/);
  if (epNumMatch) {
    const num = parseInt(epNumMatch[1], 10);
    
    // Remove the match, and also ensure we strip stray word "الحلقة" if it was originally there
    let cleanDesc = clean
      .replace(epNumMatch[0], "")
      .replace(/(?:الحلقة|حلقة|ep|episode|\bE)\s*#?/ig, "")
      .replace(/^[-|_|\s|:]+/, "")
      .replace(/[-|_|\s|:]+$/, "")
      .trim();
      
    if (cleanDesc && cleanDesc.length >= 2) {
      return `الحلقة ${num} - ${cleanDesc}`;
    }

    return `الحلقة ${num}`;
  }

  return clean.includes("الحلقة") ? clean : `الحلقة ${clean}`;
}

export default function EpisodeGrid({
  episodes,
  currentIndex,
  seriesId,
  seriesImage,
  isMovie = false,
  onSelect,
  seriesTitle,
}: EpisodeGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [jumpToRange, setJumpToRange] = useState(0); // 0 means first block of 50
  const [isReversed, setIsReversed] = useState(false); // Newest first toggle
  const [tmdbEpisodes, setTmdbEpisodes] = useState<TMDBSimplifiedEpisode[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!seriesTitle) return;
    let active = true;
    fetchEpisodesDetailsFromTMDB(seriesTitle).then(data => {
      if (active && data && data.length > 0) {
        setTmdbEpisodes(data);
      }
    });
    return () => { active = false; };
  }, [seriesTitle]);

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
      {/* 2. Range Selector Tabs (Only if many episodes) - Rendered at top below title */}
      {!isMovie && !searchQuery && episodes.length > RANGE_SIZE && (
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

      {/* 1. Header Bar: Search and Sort */}
      {!isMovie && (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 px-0">
          {displayedEpisodes.map(({ ep, originalIndex }) => {
            const isWatched = progressService.isWatched(
              seriesId,
              originalIndex,
            );
            const isActive = currentIndex === originalIndex;

            return (
              <EpisodeGridItem
                key={originalIndex}
                ep={ep}
                originalIndex={originalIndex}
                seriesId={seriesId}
                seriesImage={seriesImage}
                seriesTitle={seriesTitle}
                isMovie={isMovie}
                isActive={isActive}
                isWatched={isWatched}
                onSelect={onSelect}
                tmdbEpisodes={tmdbEpisodes}
              />
            );
          })}
        </div>
      )}

      {/* 4. Range Selector Tabs (Repeated at bottom if many episodes) */}
      {!isMovie && !searchQuery && episodes.length > RANGE_SIZE && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto pt-6 border-t border-white/5 no-scrollbar direction-rtl mt-6">
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

    </div>
  );
}

// ----------------- SUBCOMPONENT: EpisodeGridItem -----------------
interface EpisodeGridItemProps {
  key?: any;
  ep: Episode;
  originalIndex: number;
  seriesId: string;
  seriesImage?: string;
  seriesTitle?: string;
  isMovie?: boolean;
  isActive: boolean;
  isWatched: boolean;
  onSelect: (ep: Episode, index: number) => void;
  tmdbEpisodes: TMDBSimplifiedEpisode[];
}

function EpisodeGridItem({
  ep,
  originalIndex,
  seriesId,
  seriesImage,
  seriesTitle,
  isMovie,
  isActive,
  isWatched,
  onSelect,
  tmdbEpisodes
}: EpisodeGridItemProps) {
  const displayTitle = formatEpisodeTitle(ep.title || (ep as any).name || "", originalIndex, isMovie || false);
  const isFinalEpisode =
    /الأخي?رة/i.test(ep.title || "") ||
    /الاخي?ره/i.test(ep.title || "") ||
    /النهائية/i.test(ep.title || "") ||
    /النهائيه/i.test(ep.title || "");

  // Parse actual episode number from title (e.g. "الحلقة 37" -> 37, or defaults to originalIndex + 1)
  let epNum = originalIndex + 1;
  const epTitleStr = ep.title || "";
  const numMatch = epTitleStr.match(/(?:الحلقة|حلقة|ep\s*\#|episode|ep|E)\s*#?\s*(\d+)/i) || epTitleStr.match(/^(\d+)/);
  if (numMatch) {
    epNum = parseInt(numMatch[1], 10);
  }

  // Find matching TMDB episode
  const tmdbEp = tmdbEpisodes.find(t => 
    t.absoluteEpisodeNumber === epNum || 
    t.episodeNumber === epNum
  ) || tmdbEpisodes.find(t => 
    t.episodeNumber === (originalIndex + 1)
  ) || tmdbEpisodes[originalIndex];

  // Calculated Fallback values
  let fallbackDuration = "";
  const isTurkishSeries = 
    /تركي|تركية|طائر الرفراف|عثمان|الحفرة|المتوحش|صلاح الدين|الغدار|حب|شراب التوت|المؤسس|عهد|الأمانة|حكايتنا|شخص آخر|المنظمة|القضاء/i.test(seriesTitle || "") ||
    /تركي|تركية/i.test(ep.title || "");

  if (tmdbEp && tmdbEp.runtime && tmdbEp.runtime > 15) {
    if (isTurkishSeries && tmdbEp.runtime < 65) {
      const calculatedRuntime = 120 + (originalIndex * 3) % 20;
      fallbackDuration = `${calculatedRuntime} دقيقة`;
    } else {
      fallbackDuration = `${tmdbEp.runtime} دقيقة`;
    }
  } else {
    let defaultRuntime = 45;
    const titleLower = (seriesTitle || "").toLowerCase();
    if (isTurkishSeries) {
      defaultRuntime = 120 + (originalIndex * 3) % 20;
    } else if (titleLower.includes("فيلم") || isMovie) {
      defaultRuntime = 95 + (originalIndex * 5) % 35;
    } else {
      defaultRuntime = 38 + (originalIndex * 2) % 12;
    }
    fallbackDuration = `${defaultRuntime} دقيقة`;
  }

  const fallbackThumbnail = (tmdbEp && tmdbEp.stillUrl) ? tmdbEp.stillUrl : seriesImage;
  const thumbnail = getProxiedImageUrl(fallbackThumbnail);

  return (
    <button
      onClick={() => onSelect(ep, originalIndex)}
      className="group flex flex-col text-right w-full outline-none cursor-pointer select-none bg-transparent hover:bg-transparent border-0 p-0 relative animate-fade-in"
    >
      {/* 16:9 Aspect ratio premium thumbnail */}
      <div className={cn(
        "relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-zinc-900 border transition-all duration-300 shadow-lg group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.7)] group-hover:scale-[1.03]",
        isActive
          ? "border-primary/60 ring-2 ring-primary/40 shadow-[0_0_20px_rgba(229,9,20,0.3)]"
          : "border-white/5 group-hover:border-white/10"
      )}>
        {thumbnail ? (
          <img
            referrerPolicy="no-referrer"
            src={thumbnail}
            alt={displayTitle}
            className={cn(
              "w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-all duration-500",
              isActive ? "scale-105 opacity-100" : "group-hover:scale-105"
            )}
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
              // Fallback to series image if the episode still fails to load
              if (thumbnail !== seriesImage && seriesImage) {
                e.currentTarget.src = seriesImage;
                return;
              }
              e.currentTarget.src =
                "https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png";
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-zinc-950 to-zinc-900" />
        )}

        {/* Dynamic Dark Gradient for Bottom Text/Badge Contrast */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Play overlay / pulse state */}
        {isActive ? (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-primary text-black flex items-center justify-center border border-primary shadow-[0_0_25px_rgba(229,9,20,0.6)] animate-pulse">
              <Play className="w-4 h-4 fill-current translate-x-[-0.5px]" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center border border-primary shadow-[0_0_20px_rgba(229,9,20,0.5)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-3.5 h-3.5 fill-current translate-x-[-0.5px]" />
            </div>
          </div>
        )}

        {/* Watched complete badge */}
        {isWatched && (
          <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md border border-emerald-400/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>مكتمل</span>
          </span>
        )}
        
        {ep.url?.includes('streamimdb') && (
          <span className="absolute top-2 left-2 bg-amber-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md uppercase tracking-tighter">
            <Sparkles className="w-2.5 h-2.5" />
            Legendary
          </span>
        )}
      </div>

      {/* Info Text layout below card */}
      <div className="mt-3 text-right flex flex-col space-y-1 w-full px-1">
        <span
          className={cn(
            "text-[13px] sm:text-sm font-black truncate leading-snug transition-colors duration-200",
            isActive
              ? (ep.url?.includes('streamimdb') ? "text-amber-500" : "text-primary")
              : "text-zinc-100 group-hover:text-primary",
            !isActive && ep.url?.includes('streamimdb') && "group-hover:text-amber-400"
          )}
        >
          {displayTitle}
        </span>

        <div className="flex items-center gap-1.5 mt-0.5">
          {isActive ? (
            <span className={cn(
              "text-[10px] font-black animate-pulse flex items-center gap-1",
              ep.url?.includes('streamimdb') ? "text-amber-500" : "text-primary"
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              تشغيل الآن
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
              <Eye className="w-3 h-3 text-zinc-600" />
              <span>{isWatched ? "شاهدته سابقاً" : "مفتوح للمشاهدة"}</span>
            </span>
          )}

          {isFinalEpisode && (
            <span className="text-[9px] text-[#ffca28] font-black bg-[#ffca28]/10 px-1.5 py-0.5 rounded-md border border-[#ffca28]/20 shadow-sm animate-pulse">
              👑 الأخيرة
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
