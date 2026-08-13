import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Series } from "../services/firebase";
import { cn } from "../lib/utils";

interface FeaturedSliderProps {
  items: Series[];
  onPlay: (item: Series) => void;
}

export default function FeaturedSlider({ items, onPlay }: FeaturedSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter items that have valid images
  const sliderItems = React.useMemo(() => {
    return items.slice(0, 5); // Limit to top 5 featured items for maximum elegance
  }, [items]);

  useEffect(() => {
    if (sliderItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
    }, 6000); // Auto slide every 6 seconds
    return () => clearInterval(interval);
  }, [sliderItems.length]);

  if (sliderItems.length === 0) return null;

  const currentItem = sliderItems[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + sliderItems.length) % sliderItems.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % sliderItems.length);
  };

  // Helper to extract clean image url or use a fallback
  const imgUrl = currentItem.image || currentItem.img || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=1200&auto=format&fit=crop";

  return (
    <div className="relative w-full h-[62vh] sm:h-[65vh] md:h-[550px] lg:h-[600px] overflow-hidden bg-zinc-950 select-none group">
      
      {/* Background Slides with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Actual Banner Artwork - Covering the entire background */}
          <div className="absolute inset-0 w-full h-full">
            <img
              src={imgUrl}
              alt={currentItem.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            
            {/* Cinematic premium dark gradient overlays to fade out the poster into black and make texts legible */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/40 via-transparent to-[#050505]/40" />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Metadata & Actions Container - Centered nicely like the screenshot */}
      <div className="absolute inset-0 flex flex-col justify-end items-center text-center p-6 sm:p-8 pb-14 sm:pb-16 z-20 text-white dir-rtl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4 max-w-2xl px-4"
          >
            {/* Exclusivity Badge / Tag */}
            <div className="flex items-center gap-2 justify-center">
              <span className="bg-red-600 text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded shadow-lg animate-pulse">
                حصرياً
              </span>
              {currentItem.category && (
                <span className="bg-white/10 backdrop-blur-md border border-white/5 text-zinc-300 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded shadow-lg">
                  {currentItem.category}
                </span>
              )}
            </div>

            {/* Huge bold Title */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight line-clamp-2">
              {currentItem.title}
            </h1>

            {/* Sub-details (rating, categories) */}
            <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-zinc-300 font-bold drop-shadow-md">
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                {currentItem.rating || "8.5"}
              </span>
              <span className="text-white/30">|</span>
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-black">HD</span>
              {currentItem.episodes_count && (
                <>
                  <span className="text-white/30">|</span>
                  <span className="text-primary font-black">{currentItem.episodes_count}</span>
                </>
              )}
            </div>

            {/* Call to Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onPlay(currentItem)}
                className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black text-xs sm:text-sm font-black px-7 sm:px-9 py-3 rounded-full transition-all shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current translate-x-0.5 text-black" />
                <span>مشاهدة الآن</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Manual Sliding Chevron Buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 cursor-pointer hidden sm:block"
        title="السابق"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 cursor-pointer hidden sm:block"
        title="التالي"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Bottom Dot Pagination indicators */}
      <div className="absolute bottom-5 right-1/2 translate-x-1/2 flex items-center gap-2.5 z-35">
        {sliderItems.map((_, idx) => (
          <button
            key={`dot-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
              currentIndex === idx ? "w-7 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>

    </div>
  );
}
