import React from 'react';
import { Play, Sparkles } from 'lucide-react';
import { Series } from '../services/firebase';
import { getProxiedImageUrl } from '../services/api';
import { hasNewEpisode } from '../lib/episodeHistory';
import { getTMDBPoster, getTMDBPosterSync } from '../lib/tmdbHealing';
import { cn } from '../lib/utils';

interface SeriesCardProps {
  item: Series;
  onPress: () => void;
  isTop10?: boolean;
  topRank?: number;
  forceVertical?: boolean;
  key?: React.Key;
}

const SeriesCard = React.memo(({ item, onPress, isTop10, topRank, forceVertical }: SeriesCardProps) => {
  if (!item) return null;
  const _hasNew = hasNewEpisode(item);
  const [clicked, setClicked] = React.useState(false);
  const isLegendary = item.trailer?.includes('streamimdb') || item.episodes?.some(ep => ep.url?.includes('streamimdb'));

  const handlePress = React.useCallback(() => {
    if (_hasNew && !clicked) {
      import('../lib/episodeHistory').then(({ markSeriesAsRead }) => {
         markSeriesAsRead(item);
         setClicked(true);
      });
    }
    onPress();
  }, [_hasNew, clicked, item, onPress]);

  const [currentSrc, setCurrentSrc] = React.useState<string>(() => {
    return getProxiedImageUrl(item.image) || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop";
  });
  const [imageLoaded, setImageLoaded] = React.useState(true);

  const [isVertical, setIsVertical] = React.useState<boolean>(() => {
    return item.isVertical !== undefined ? item.isVertical : true;
  });

  React.useEffect(() => {
    setCurrentSrc(getProxiedImageUrl(item.image) || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop");
    setIsVertical(item.isVertical !== undefined ? item.isVertical : true);
    setImageLoaded(false);
  }, [item.id, item.image, item.isVertical]);

  const displayRating = React.useMemo(() => {
    if (item.rating && item.rating > 0) {
      return item.rating.toFixed(1);
    }
    const key = item.title || item.id || "";
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const minRating = 7.3;
    const maxRating = 9.3;
    const calculated = minRating + (absHash % 21) * ((maxRating - minRating) / 20);
    return calculated.toFixed(1);
  }, [item.rating, item.title, item.id]);

  const totalEpisodes = item.episodes?.length || 0;

  const overlayBadge = React.useMemo(() => {
    const title = (item.title || "").toLowerCase();
    const category = (item.category || "").toLowerCase();
    const episode = (item.episode || item.episodes_count || "").toLowerCase();

    const isSeasonEnd = 
      title.includes("نهاية موسم") || 
      title.includes("نهاية الموسم") || 
      title.includes("الموسم الأخير") || 
      title.includes("الموسم الاخير") ||
      episode.includes("الأخيرة") ||
      episode.includes("الاخيرة") ||
      episode.includes("النهائية") ||
      episode.includes("نهاية");

    const isDubbed = 
      category.includes("مدبلج") || 
      category.includes("مدبلجة") || 
      title.includes("مدبلج") || 
      title.includes("مدبلجة");

    const isSubbed = 
      category.includes("مترجم") || 
      category.includes("مترجمة") || 
      title.includes("مترجم") || 
      title.includes("مترجمة");

    return { isSeasonEnd, isDubbed, isSubbed };
  }, [item.title, item.category, item.episode, item.episodes_count]);

  // Render Vertical / Portrait Card (Matches Image 1)
  if (isVertical) {
    return (
      <div
        className={cn(
          "relative group cursor-pointer w-full rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-[0_12px_30px_rgba(0,0,0,0.8)] active:scale-[0.98] select-none flex flex-col dir-rtl text-right",
          isLegendary 
            ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/80 hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]" 
            : "border-white/5 shadow-md hover:border-white/15 hover:shadow-[0_10px_25px_rgba(229,9,20,0.2)]"
        )}
        onClick={handlePress}
      >
        {/* Vertical Image Container (2:3 aspect ratio) */}
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-zinc-950 flex items-center justify-center">
          {/* Rich Blurred Background Fill */}
          {currentSrc && (
            <img 
              src={currentSrc} 
              alt="" 
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 select-none pointer-events-none"
            />
          )}

          {/* Main Vertical Poster Artwork */}
          <img 
            src={currentSrc} 
            alt={item.title} 
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="relative max-w-full max-h-full object-contain transition-all duration-500 will-change-transform group-hover:scale-105 z-10 drop-shadow-lg"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalHeight && img.naturalWidth) {
                if (img.naturalHeight > img.naturalWidth * 1.1) {
                  setIsVertical(true);
                } else if (img.naturalWidth > img.naturalHeight * 1.1) {
                  setIsVertical(false);
                }
              }
              setImageLoaded(true);
            }}
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop";
              setImageLoaded(true);
            }}
          />

          {/* Vignette Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-black/20 pointer-events-none z-15" />

          {/* TOP 10 Badge on Top-Left (Vibrant Pink/Red matching Image 1) */}
          {(isTop10 || (topRank !== undefined && topRank > 0 && topRank <= 10)) && (
            <div className="absolute top-2 left-2 z-30 bg-gradient-to-b from-[#ff0055] to-[#e50914] text-white rounded-xl px-2 py-1 flex flex-col items-center justify-center shadow-2xl border border-white/20 select-none min-w-[34px]">
              <span className="text-[8px] font-black leading-none tracking-wider uppercase">TOP</span>
              <span className="text-[12px] font-black leading-none mt-0.5">{topRank ? topRank : "10"}</span>
            </div>
          )}

          {/* Rating Badge on Top-Right */}
          <div className="absolute top-2 right-2 bg-black/85 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] text-yellow-400 font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg z-20 select-none">
            ⭐ <span className="text-zinc-100">{displayRating}</span>
          </div>

          {/* Badges (جديد / LEGENDARY) */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
            {_hasNew && !clicked && (
              <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-lg animate-pulse">
                جديد 🔥
              </span>
            )}
            {isLegendary && (
              <span className="bg-amber-500 text-black text-[7px] font-black px-1 py-0.5 rounded flex items-center gap-0.5 shadow-xl select-none">
                <Sparkles className="w-2 h-2 fill-current" />
                LEGENDARY
              </span>
            )}
          </div>

          {/* Translation & Season Indicators on Bottom-Left */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-20">
            {overlayBadge.isSeasonEnd && (
              <span className="bg-rose-950/90 backdrop-blur-md text-rose-300 border border-rose-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                نهاية موسم 🎬
              </span>
            )}
            {!overlayBadge.isSeasonEnd && overlayBadge.isDubbed && (
              <span className="bg-emerald-950/90 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg select-none">
                مدبلج
              </span>
            )}
            {!overlayBadge.isSeasonEnd && overlayBadge.isSubbed && (
              <span className="bg-blue-950/90 backdrop-blur-md text-blue-300 border border-blue-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg select-none">
                مترجم
              </span>
            )}
          </div>

          {/* Play Icon Hover Overlay */}
          <div className="absolute inset-0 bg-primary/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-25">
            <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300">
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
            </div>
          </div>
        </div>

        {/* Title & Subtitle Details below image */}
        <div className="p-2 sm:p-2.5 bg-zinc-950/95 flex flex-col justify-between min-h-[64px] gap-0.5 z-20 border-t border-white/5">
          <h3 className="text-white font-black text-xs sm:text-sm leading-tight line-clamp-2 text-center dir-rtl group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-[10px] text-zinc-400 font-bold text-center">
            {totalEpisodes > 0 ? `${totalEpisodes} حلقة` : 'متوفر مجاناً'}
          </p>
        </div>
      </div>
    );
  }

  // Render Horizontal / Landscape Card (Untouched for horizontal posters)
  return (
    <div
      className={cn(
        "relative group cursor-pointer w-full rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-[0_12px_30px_rgba(0,0,0,0.8)] active:scale-[0.98] select-none flex flex-col dir-rtl text-right",
        isLegendary 
          ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/80 hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]" 
          : "border-white/5 shadow-md hover:border-white/15 hover:shadow-[0_10px_25px_rgba(229,9,20,0.2)]"
      )}
      onClick={handlePress}
    >
      {/* Landscape Image Container */}
      <div className="relative w-full aspect-video overflow-hidden bg-zinc-950 flex items-center justify-center">
        {/* Rich Blurred Background Fill so there are no empty gaps */}
        {currentSrc && (
          <img 
            src={currentSrc} 
            alt="" 
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-45 scale-125 select-none pointer-events-none"
          />
        )}

        {/* Uncropped Main Poster / Artwork */}
        <img 
          src={currentSrc} 
          alt={item.title} 
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="relative max-w-full max-h-full object-contain transition-all duration-500 will-change-transform group-hover:scale-105 z-10 drop-shadow-lg"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalHeight && img.naturalWidth) {
              if (img.naturalHeight > img.naturalWidth * 1.1) {
                setIsVertical(true);
              } else if (img.naturalWidth > img.naturalHeight * 1.1) {
                setIsVertical(false);
              }
            }
            setImageLoaded(true);
          }}
          onError={() => {
            if (currentSrc && currentSrc.includes('image.tmdb.org')) return;
            if (isTop10) {
              getTMDBPoster(item.title, item.category).then((healedUrl) => {
                if (healedUrl) {
                  setCurrentSrc(getProxiedImageUrl(healedUrl));
                  setIsVertical(true);
                } else {
                  setCurrentSrc("https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop");
                }
              });
            } else {
              setCurrentSrc("https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop");
            }
          }}
        />

        {/* Subtle Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-black/30 pointer-events-none z-15" />

        {/* Rating Badge */}
        <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] text-yellow-400 font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg z-20 select-none">
          ⭐ <span className="text-zinc-100">{displayRating}</span>
        </div>

        {/* Badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          {_hasNew && !clicked && (
            <span className="bg-red-600 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-md shadow-lg animate-pulse">
              جديد 🔥
            </span>
          )}
          {isLegendary && (
            <span className="bg-amber-500 text-black text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xl select-none">
              <Sparkles className="w-2.5 h-2.5 fill-current" />
              LEGENDARY
            </span>
          )}
        </div>

        {/* Play Icon Hover Overlay */}
        <div className="absolute inset-0 bg-primary/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-25">
          <div className="w-11 h-11 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300">
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Translation & Season Indicators on Bottom-Left */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-20">
          {overlayBadge.isSeasonEnd && (
            <span className="bg-rose-950/90 backdrop-blur-md text-rose-300 border border-rose-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              نهاية موسم 🎬
            </span>
          )}
          {!overlayBadge.isSeasonEnd && overlayBadge.isDubbed && (
            <span className="bg-emerald-950/90 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg select-none">
              مدبلج
            </span>
          )}
          {!overlayBadge.isSeasonEnd && overlayBadge.isSubbed && (
            <span className="bg-blue-950/90 backdrop-blur-md text-blue-300 border border-blue-500/30 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg select-none">
              مترجم
            </span>
          )}
        </div>
      </div>

      {/* Title & Category Details below image */}
      <div className="p-2.5 sm:p-3 bg-zinc-950/95 flex flex-col justify-between min-h-[68px] gap-1 z-20 border-t border-white/5">
        <h3 className="text-white font-black text-xs sm:text-sm leading-tight line-clamp-2 text-right dir-rtl group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold pt-0.5">
          <span className="text-zinc-300">{totalEpisodes > 0 ? `${totalEpisodes} حلقة` : 'متوفر الآن'}</span>
          {item.category && <span className="text-zinc-500 truncate max-w-[120px]">{item.category}</span>}
        </div>
      </div>
    </div>
  );
});

export default SeriesCard;
