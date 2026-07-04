import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Episode } from '../types';
import { motion } from 'motion/react';
import { triggerAdFlow } from '../lib/utils';

interface EpisodeCardProps {
  key?: string;
  episode: Episode;
}

export default function EpisodeCard({ episode }: EpisodeCardProps) {
  const navigate = useNavigate();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    triggerAdFlow(`/watch/${episode.slug}`, navigate);
  };

  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="group relative bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl transition-all duration-300 border border-white/5"
    >
      <div onClick={handleClick} className="cursor-pointer">
        <div className="aspect-[2/3] relative overflow-hidden">
          <img 
            src={episode.img} 
            alt={episode.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-16 h-16 bg-[#b72424] rounded-full flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl">
              <Play fill="white" size={32} className="ml-1" />
            </div>
          </div>
          {/* Episode Label */}
          <div className="absolute top-4 left-4 bg-[#b72424] text-white px-3 py-1 rounded-md text-xs font-bold shadow-lg">
            حلقة {episode.episodeNum}
          </div>
        </div>
        <div className="p-4 text-right" dir="rtl">
          <h3 className="text-white font-bold text-sm line-clamp-2 leading-relaxed group-hover:text-[#b72424] transition-colors">
            {episode.title}
          </h3>
        </div>
      </div>
    </motion.div>
  );
}
