import { Play, Plus, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { seriesData } from "../lib/data";
import { useListStore } from "../store/listStore";
import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { cn } from "../lib/utils";

export default function Home() {
  const featured = seriesData[0];
  const { addToList, removeFromList, isInList } = useListStore();

  const handleListToggle = (e: MouseEvent, series: any) => {
    e.preventDefault();
    if (isInList(series.id)) {
      removeFromList(series.id);
    } else {
      addToList(series);
    }
  };

  return (
    <div className="pt-24 px-4 md:px-8 pb-10 max-w-[1920px] mx-auto space-y-12">
      {/* Hero Section / Slider */}
      <div className="relative rounded-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] lg:aspect-[3/1] bg-zinc-900 shadow-2xl">
        <img
          src={featured.heroImage}
          alt={featured.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />

        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-16">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            {featured.isNew && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded mb-4 inline-block">
                جديد
              </span>
            )}
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 drop-shadow-lg">
              {featured.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-300 mb-4 font-bold flex-wrap">
              {featured.ageRating && (
                <span className="border border-gray-500 px-1.5 py-0.5 rounded text-xs">
                  {featured.ageRating}
                </span>
              )}
              <span>{featured.seasonsCount} موسم</span>
              <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
              <span>{featured.category}</span>
              <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
              <span>{featured.year}</span>
            </div>
            
            <div className="flex items-center gap-2 mb-6">
              <span className="text-red-600 font-black text-lg">★</span>
              <span className="text-white font-bold">{featured.imdb || featured.rating}</span>
              <span className="bg-[#f5c518] text-black text-[10px] font-black px-1.5 py-0.5 rounded ml-1">IMDb</span>
            </div>

            <p className="text-base md:text-lg text-gray-300 mb-8 line-clamp-3 leading-relaxed max-w-xl hidden md:block">
              {featured.description}
            </p>

            <div className="flex items-center gap-4">
              <Link
                to={`/series/${featured.id}`}
                className="flex items-center gap-2 bg-red-600 text-white px-6 md:px-8 py-3 rounded-md font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                <span>شاهد الحلقات</span>
              </Link>
              <button
                onClick={(e) => handleListToggle(e, featured)}
                className="flex items-center gap-2 bg-[#222] text-white px-4 md:px-6 py-3 rounded-md font-bold hover:bg-[#333] transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">قائمتي</span>
              </button>
            </div>
          </motion.div>
        </div>
        
        {/* Slider Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-6 h-1.5 bg-red-600 rounded-full"></div>
          <div className="w-6 h-1.5 bg-zinc-600 rounded-full"></div>
          <div className="w-6 h-1.5 bg-zinc-600 rounded-full"></div>
        </div>
      </div>

      {/* Series Cards Row */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-bold text-white">المسلسلات المتاحة</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
          {seriesData.map((series, idx) => (
            <Link
              key={series.id}
              to={`/series/${series.id}`}
              className="relative aspect-[2/3] rounded-xl overflow-hidden group cursor-pointer block shadow-xl bg-zinc-900"
            >
              <img
                src={series.coverImage}
                alt={series.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="bg-red-600 rounded-full p-4 transform scale-50 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-red-600/50">
                  <Play className="w-6 h-6 text-white pl-1" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                <h3 className="font-bold text-white text-base md:text-lg mb-1">{series.title}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <span>{series.year}</span>
                  <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                  <span>{series.category}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

