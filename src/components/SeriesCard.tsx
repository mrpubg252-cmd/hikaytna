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
  key?: React.Key;
}

const SeriesCard = React.memo(({ item, onPress }: SeriesCardProps) => {
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
    const cached = getTMDBPosterSync(item.title, item.category);
    if (cached) return cached;
    return getProxiedImageUrl(item.image) || "";
  });
  const [imageLoaded, setImageLoaded] = React.useState(false);

  React.useEffect(() => {
    const cached = getTMDBPosterSync(item.title, item.category);
    if (cached) {
      setCurrentSrc(cached);
      return;
    }

    const isPlaceholder = !item.image || 
      item.image.includes('images.unsplash.com') || 
      item.image.includes('default_image') || 
      item.image.includes('thumbnail.jpg') || 
      item.image.includes('logo.png') ||
      item.image.includes('3iskk') ||
      item.image.includes('video_thumb');

    if (isPlaceholder) {
      getTMDBPoster(item.title, item.category).then((healedUrl) => {
        if (healedUrl) {
          setCurrentSrc(healedUrl);
        }
      });
    } else {
      setCurrentSrc(item.image);
    }
  }, [item.title, item.image, item.category]);

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
          className={cn(
            "relative max-w-full max-h-full object-contain transition-all duration-500 will-change-transform group-hover:scale-105 z-10 drop-shadow-lg",
            imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (currentSrc && currentSrc.includes('image.tmdb.org')) return;
            getTMDBPoster(item.title, item.category).then((healedUrl) => {
              if (healedUrl) setCurrentSrc(healedUrl);
              else setCurrentSrc("https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop");
            });
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
