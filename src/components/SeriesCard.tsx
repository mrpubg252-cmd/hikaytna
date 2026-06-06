import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { Series } from '../services/firebase';
import { hasNewEpisode } from '../lib/episodeHistory';

interface SeriesCardProps {
  item: Series;
  onPress: () => void;
  key?: React.Key;
}

const SeriesCard = React.memo(({ item, onPress }: SeriesCardProps) => {
  if (!item) return null;
  const isNewEpisode = hasNewEpisode(item);
  const [imageLoaded, setImageLoaded] = React.useState(false);

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
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="relative group cursor-pointer aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 will-change-transform"
      onClick={onPress}
    >
      <img 
        src={item.image} 
        alt={item.title} 
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-opacity duration-500 will-change-transform ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImageLoaded(true)}
        onError={(e) => {
          const currentSrc = e.currentTarget.src;
          if (currentSrc.includes('/api/v1/image-proxy?url=')) {
            try {
              const urlPart = currentSrc.split('url=')[1];
              if (urlPart) {
                e.currentTarget.src = decodeURIComponent(urlPart);
                setImageLoaded(true);
                return;
              }
            } catch(err) {}
          }
          e.currentTarget.src = 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
          setImageLoaded(true);
        }}
      />

      {/* Floating Rating Badge */}
      <div className="absolute top-2.5 left-2 bg-black/70 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] text-yellow-500 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg z-30 select-none">
        ⭐ <span className="text-zinc-100">{displayRating}</span>
      </div>

      {isNewEpisode && (
        <div className="absolute top-2.5 right-2 w-max bg-red-600 border border-white/20 text-[9px] sm:text-[10px] text-white font-extrabold px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.6)] flex items-center gap-1.5 animate-pulse z-30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white bg-opacity-90 inline-block animate-ping" />
          حلقة جديدة
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3 sm:p-5">
        <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-tight truncate">{item.title}</h3>
      </div>

      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl">
          <Play className="w-6 h-6 text-black fill-current" />
        </div>
      </div>
    </motion.div>
  );
});

export default SeriesCard;
