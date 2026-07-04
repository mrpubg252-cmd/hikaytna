import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Series } from '../types';
import { Loader2, Play, Info, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SeriesDetails() {
  const { slug } = useParams();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const { data } = await axios.get(`/api/series/${slug}`);
        setSeries(data);
      } catch (error) {
        console.error("Fetch series error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [slug]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#b72424]" size={48} />
      </div>
    );
  }

  if (!series) return <div className="text-center py-20">المسلسل غير موجود</div>;

  return (
    <div className="pb-12 bg-[#0a0a0a]" dir="rtl">
      {/* Hero Header */}
      <div className="relative w-full h-[55vh] md:h-[80vh]">
        <img 
          src={series.backdrop || series.img} 
          className="w-full h-full object-cover object-top"
          alt={series.title}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-transparent hidden md:block" />
        
        <div className="absolute inset-0 flex items-center justify-center md:justify-start max-w-7xl mx-auto px-4 pt-16 md:pt-32">
          <div className="max-w-2xl text-center md:text-right w-full">
            <h1 className="text-2xl md:text-7xl font-black mb-4 md:mb-6 drop-shadow-2xl leading-tight px-2">
              {series.title}
            </h1>
            <p className="text-gray-300 mb-6 md:mb-8 leading-relaxed text-xs md:text-xl line-clamp-2 md:line-clamp-4 drop-shadow-md hidden sm:block">
              {series.description}
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start px-4">
              <Link 
                to={series.episodes && series.episodes.length > 0 ? `/watch/${series.episodes[0].epSlug}` : '#'}
                className="bg-white text-black px-6 md:px-10 py-2.5 md:py-4 rounded-md font-black flex items-center justify-center gap-2 md:gap-3 hover:bg-gray-200 transition-all text-sm md:text-xl shadow-xl flex-1 md:flex-none"
              >
                <Play size={18} className="md:size-28" fill="black" />
                مشاهدة الآن
              </Link>
              <button className="bg-white/20 backdrop-blur-md text-white px-6 md:px-10 py-2.5 md:py-4 rounded-md font-black flex items-center justify-center gap-2 md:gap-3 hover:bg-white/30 transition-all text-sm md:text-xl shadow-xl flex-1 md:flex-none">
                <Info size={18} className="md:size-28" />
                المزيد
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes List - Netflix Style */}
      <section className="max-w-7xl mx-auto px-4 mt-8 md:-mt-24 relative z-20 pb-20">
        <div className="flex items-center justify-between mb-8 md:mb-12">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter">الحلقات</h2>
            <div className="h-1.5 md:h-2 w-20 md:w-32 bg-[#b72424] rounded-full shadow-lg shadow-[#b72424]/40" />
          </div>
          <div className="bg-white/5 border border-white/10 px-5 md:px-8 py-2 md:py-3 rounded-xl font-black text-xs md:text-xl backdrop-blur-md text-gray-300">
            {series.seasons?.[0]?.title || 'الموسم الأول'}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {series.episodes && series.episodes.length > 0 ? (
            series.episodes.map((ep, index) => (
              <Link 
                key={ep.epSlug} 
                to={`/watch/${ep.epSlug}`}
                className="group flex items-center gap-4 md:gap-10 p-4 md:p-8 rounded-2xl bg-[#111] hover:bg-[#1a1a1a] transition-all duration-500 border border-white/5 hover:border-[#b72424]/30 shadow-2xl relative overflow-hidden"
              >
                {/* Background Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#b72424]/0 to-[#b72424]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <span className="text-2xl md:text-6xl font-black text-white/10 group-hover:text-white/20 transition-all duration-500 min-w-[30px] md:min-w-[80px] text-center italic">
                  {index + 1}
                </span>
                
                <div className="relative aspect-video w-32 md:w-72 rounded-xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/10">
                  <img 
                    src={series.img} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70 group-hover:opacity-100" 
                    alt={ep.title || `الحلقة ${ep.epNum}`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/50 scale-110 group-hover:scale-100">
                    <div className="w-10 h-10 md:w-20 md:h-20 bg-[#b72424] rounded-full flex items-center justify-center shadow-2xl ring-2 ring-white/20">
                      <Play size={20} className="md:size-40" fill="white" />
                    </div>
                  </div>
                </div>
                
                <div className="flex-grow min-w-0 z-10">
                  <div className="flex items-center justify-between mb-2 md:mb-4">
                    <h3 className="text-base md:text-3xl font-black group-hover:text-[#b72424] transition-colors truncate">
                      {ep.title || `الحلقة ${ep.epNum}`}
                    </h3>
                  </div>
                  <p className="text-gray-500 text-[11px] md:text-lg line-clamp-2 md:line-clamp-3 leading-relaxed font-medium max-w-4xl opacity-60 group-hover:opacity-100 transition-opacity">
                    شاهد الآن المسلسل المترجم {series.title} الحلقة {ep.epNum} بجودة عالية HD. قصة مثيرة وأحداث متسارعة في هذا الموسم، حصرياً على حكايتنا.
                  </p>
                </div>
                
                <div className="hidden lg:flex flex-col items-center gap-2 text-gray-700 group-hover:text-[#b72424] transition-all">
                   <ChevronLeft size={48} className="transform group-hover:-translate-x-2 transition-transform duration-500" />
                   <span className="text-[10px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">شاهد</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5">
              <p className="text-gray-500 text-xl font-bold">عذراً، لم يتم العثور على حلقات لهذا المسلسل حالياً.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
