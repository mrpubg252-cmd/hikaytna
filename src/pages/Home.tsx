import React, { useEffect, useState } from 'react';
import axios from 'axios';
import HeroSlider from '../components/HeroSlider';
import EpisodeCard from '../components/EpisodeCard';
import { Episode, Featured } from '../types';
import { Loader2, Zap } from 'lucide-react';
import { triggerAdFlow } from '../lib/utils';

export default function Home() {
  const [latest, setLatest] = useState<Episode[]>([]);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [latestRes, featuredRes] = await Promise.all([
          axios.get('/api/latest-episodes'),
          axios.get('/api/featured')
        ]);
        setLatest(latestRes.data);
        setFeatured(featuredRes.data);
      } catch (error) {
        console.error("Home fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#b72424]" size={48} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* Slider */}
      <HeroSlider items={featured} />

      {/* Latest Episodes Section */}
      <section className="max-w-7xl mx-auto w-full px-4" dir="rtl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#b72424] p-2 rounded-lg shadow-lg">
              <Zap size={24} className="fill-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold border-r-4 border-[#b72424] pr-3">
              أحدث الحلقات
            </h2>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors text-sm">عرض الكل</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {latest.map((ep) => (
            <EpisodeCard key={ep.slug} episode={ep} />
          ))}
        </div>
      </section>

      {/* Featured Series Section */}
      <section className="max-w-7xl mx-auto w-full px-4" dir="rtl">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-[#b72424] p-2 rounded-lg shadow-lg">
            <Zap size={24} className="fill-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold border-r-4 border-[#b72424] pr-3">
            مسلسلات مختارة
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {featured.slice(0, 6).map((item) => (
            <div 
              key={item.slug} 
              onClick={() => triggerAdFlow(`/series/${item.slug}`)}
              className="group relative h-48 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer"
            >
              <img 
                src={item.img} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex items-end p-4">
                <h3 className="text-white font-bold text-lg group-hover:text-[#b72424] transition-colors line-clamp-1">
                  {item.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
