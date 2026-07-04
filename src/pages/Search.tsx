import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import { motion } from 'motion/react';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('s') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSearch() {
      if (!query) return;
      setLoading(true);
      try {
        const res = await axios.get(`/api/search?s=${query}`);
        setResults(res.data);
      } catch (error) {
        console.error("Search fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSearch();
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" dir="rtl">
      <div className="flex items-center gap-4 mb-12">
        <div className="bg-[#b72424] p-3 rounded-2xl">
          <SearchIcon size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold italic">نتائج البحث</h1>
          <p className="text-gray-400">تبحث عن: <span className="text-[#b72424] font-bold">"{query}"</span></p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#b72424]" size={48} />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {results.map((item) => (
            <motion.div 
              key={item.slug}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -10 }}
              className="group relative bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl border border-white/5"
            >
              <Link to={item.type === 'series' ? `/series/${item.slug}` : `/watch/${item.slug}`}>
                <div className="aspect-[2/3] relative overflow-hidden">
                  <img 
                    src={item.img} 
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-[#b72424] text-white px-4 py-2 rounded-full font-bold shadow-xl">
                      {item.type === 'series' ? 'عرض المسلسل' : 'مشاهدة'}
                    </span>
                  </div>
                </div>
                <div className="p-4 text-right">
                  <h3 className="text-white font-bold text-sm line-clamp-2 leading-relaxed group-hover:text-[#b72424] transition-colors">
                    {item.title}
                  </h3>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-[#1a1a1a] rounded-3xl border border-white/5">
          <p className="text-gray-500 text-xl">لم نجد أي نتائج لبحثك، جرب كلمات أخرى.</p>
        </div>
      )}
    </div>
  );
}
