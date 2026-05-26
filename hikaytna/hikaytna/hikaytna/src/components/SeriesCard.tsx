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

export default function SeriesCard({ item, onPress }: SeriesCardProps) {
  const isNewEpisode = hasNewEpisode(item);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative group cursor-pointer aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5"
      onClick={onPress}
    >
      <img 
        src={item.image} 
        alt={item.title} 
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover transition-transform duration-500"
      />

      {isNewEpisode && (
        <div className="absolute top-2.5 right-2 w-max bg-red-600 border border-white/20 text-[9px] sm:text-[10px] text-white font-extrabold px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.6)] flex items-center gap-1.5 animate-pulse z-30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white bg-opacity-90 inline-block animate-ping" />
          حلقة جديدة
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3 sm:p-5">
        <div className="text-yellow-400 text-[8px] sm:text-[10px] font-black italic mb-0.5 sm:mb-1">⭐ {item.rating.toFixed(1)}</div>
        <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-tight truncate">{item.title}</h3>
      </div>

      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl">
          <Play className="w-6 h-6 text-black fill-current" />
        </div>
      </div>
    </motion.div>
  );
}
