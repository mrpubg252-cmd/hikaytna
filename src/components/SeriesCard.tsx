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
    // 1. Check synchronous cache first for zero-latency presentation
    const cached = getTMDBPosterSync(item.title, item.category);
    if (cached) return cached;
    
    // 2. Return original image or transparent loading state
    return getProxiedImageUrl(item.image) || "";
  });
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // Pre-emptive healing if the image parameter is empty or a generic placeholder
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
    // Generate a consistent pseudo-random rating based on original details
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

  return (
    <div
      className={cn(
        "relative group cursor-pointer aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-[0_12px_30px_rgba(0,0,0,0.8)] active:scale-[0.98] select-none",
        isLegendary 
          ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/80 hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]" 
          : "border-white/5 shadow-md hover:border-white/15"
      )}
      onClick={handlePress}
    >
      {/* Blurred background copy for premium seamless fit, preventing any blank gaps while showing 100% of the poster */}
      {currentSrc && (
        <div className="absolute inset-0 w-full h-full overflow-hidden select-none pointer-events-none bg-zinc-950">
          <img 
            src={currentSrc} 
            alt="" 
            referrerPolicy="no-referrer"
            className={cn(
              "w-full h-full object-cover blur-2xl opacity-35 scale-125 transition-opacity duration-500",
              imageLoaded ? 'opacity-35' : 'opacity-0'
            )}
          />
        </div>
      )}

      {/* Main Image with Object-Contain so 100% of the original artwork/title is visible without any crop */}
      <img 
        src={currentSrc} 
        alt={item.title} 
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(
          "absolute inset-0 w-full h-full object-fill transition-all duration-500 will-change-transform z-10",
          imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          isLegendary && "scale-[1.01]"
        )}
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          if (currentSrc && currentSrc.includes('image.tmdb.org')) {
            return;
          }
          getTMDBPoster(item.title, item.category).then((healedUrl) => {
            if (healedUrl) {
              setCurrentSrc(healedUrl);
            } else {
              setCurrentSrc("https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop");
            }
          });
        }}
      />

      {isLegendary && (
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-transparent to-transparent pointer-events-none z-25" />
      )}

      {/* Floating Rating Badge */}
      <div className="absolute top-2.5 left-2 bg-black/75 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] text-yellow-500 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg z-30 select-none">
        ⭐ <span className="text-zinc-100">{displayRating}</span>
      </div>

      {isLegendary && (
        <div className="absolute top-2.5 right-2 bg-amber-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-xl z-30 select-none animate-pulse">
          <Sparkles className="w-2.5 h-2.5 fill-current" />
          LEGENDARY
        </div>
      )}
      
      {/* Title with solid dark backdrop for legibility */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent pt-8 pb-3 px-3 sm:pb-5 sm:px-5 z-20">
        <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-tight truncate text-right direction-rtl">{item.title}</h3>
      </div>

      {/* Hover visual Play indicator */}
      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300">
          <Play className="w-6 h-6 text-black fill-current translate-x-0.5" />
        </div>
      </div>
    </div>
  );
});

export default SeriesCard;
