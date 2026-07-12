import React from 'react';
import { cn } from '../lib/utils';

interface CategoryBarProps {
  selected: string;
  onSelect: (category: string) => void;
}

const CATEGORIES = ['الكل', 'تركي', 'خليجي', 'عربي', 'رمضان', 'أفلام', 'آسيوي وكوري', 'أجنبي', 'فارسي'];

export default React.memo(function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  const displayCategories = CATEGORIES.includes(selected) 
    ? CATEGORIES 
    : [selected, ...CATEGORIES];

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-8 py-4 no-scrollbar">
      {displayCategories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
            selected === cat 
              ? "bg-white text-black border-white shadow-xl shadow-white/5" 
              : "bg-zinc-900 text-zinc-500 border-white/5 hover:text-white"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
});
