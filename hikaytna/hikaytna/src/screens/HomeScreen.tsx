import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Slider from '../components/Slider';
import CategoryBar from '../components/CategoryBar';
import SeriesCard from '../components/SeriesCard';
import BottomNav from '../components/BottomNav';
import { fetchAllSeries } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Series } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

import { fuzzyMatchArabic } from '../lib/utils';

export default function HomeScreen() {
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [filteredSeries, setFilteredSeries] = useState<Series[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('تركي');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const navigate = useNavigate();
  const location = useLocation();
  const { checkReferral, user } = useAuth();
  
  useEffect(() => {
    // Check for referral code in URL
    const searchParams = new URLSearchParams(location.search);
    const refCode = searchParams.get('ref');
    if (refCode && user) {
      checkReferral(refCode);
    }
  }, [location.search, user]);
  
  const query = new URLSearchParams(location.search).get('q');
  
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (allSeries.length > 0) {
      if (query) {
        setFilteredSeries(
          allSeries.filter(s => fuzzyMatchArabic(s.title || "", query))
        );
        setSelectedCategory('نتائج البحث');
      } else {
        handleCategoryChange(selectedCategory);
      }
      setCurrentPage(1); // Reset to first page on search or category change
    }
  }, [query, allSeries]);
  
  async function loadData() {
    try {
      const data = await fetchAllSeries();
      setAllSeries(data);
      
      if (!query) {
        handleCategoryChange('تركي');
      }
    } catch (error) {
      console.error('Data Load Error:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setCurrentPage(1); // Always reset page
    
    let filtered: Series[] = [];
    
    switch(category) {
      case 'الكل':
        filtered = allSeries;
        break;
      
      case 'تركي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('تركي') || cat.includes('turki') || cat.includes('turk');
        });
        break;
      
      case 'عربي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('عربي') || cat.includes('arabic') || cat.includes('arabi');
        });
        break;
      
      case 'خليجي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('خليجي') || cat.includes('kleeji') || cat.includes('khaleeji');
        });
        break;
      
      case 'رمضان':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('رمضان') || cat.includes('ramadan');
        });
        break;
      
      case 'أفلام':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('افلام') || cat.includes('أفلام') || cat.includes('movie');
        });
        break;
      
      case 'أنمي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('انمي') || cat.includes('أنمي') || cat.includes('anmi') || cat.includes('anime');
        });
        break;
      
      case 'آسيوي وكوري':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('كور') || cat.includes('اسي') || cat.includes('korean') || cat.includes('asia') || cat.includes('آسيوي');
        });
        break;

      case 'أجنبي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('أجنبي') || cat.includes('اجنبي') || cat.includes('foreign') || cat.includes('western');
        });
        break;
      
      case 'فارسي':
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          return cat.includes('فارسي') || cat.includes('farisi');
        });
        break;
      
      default:
        filtered = allSeries.filter(s => {
          const cat = s.category?.toLowerCase() || "";
          const title = s.title?.toLowerCase() || "";
          const searchCat = category.toLowerCase();
          return cat.includes(searchCat) || title.includes(searchCat);
        });
        break;
    }

    // Now, apply the professional sorting logic!
    const sorted = [...filtered].sort((a, b) => {
      // 1. Priority series (like 'حلم اشرف')
      const aPriority = a.title?.includes('حلم اشرف') || a.isPriority || false;
      const bPriority = b.title?.includes('حلم اشرف') || b.isPriority || false;
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      // 2. New series sorting
      if (category === 'الكل') {
        const aTurkish = a.category?.includes('تركي') || false;
        const bTurkish = b.category?.includes('تركي') || false;
        if (aTurkish && !bTurkish) return -1;
        if (!aTurkish && bTurkish) return 1;
      } else {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
      }

      // 3. Rating descending
      return (b.rating || 0) - (a.rating || 0);
    });

    setFilteredSeries(sorted);
  }

  const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);
  const paginatedSeries = filteredSeries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="text-5xl font-black italic text-primary drop-shadow-[0_0_20px_rgba(229,9,20,0.4)] animate-pulse mb-6">
          حكايتنا
        </div>
        <div className="w-10 h-10 border-4 border border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] text-zinc-600 font-extrabold tracking-[0.3em] uppercase mt-4">جاري تحميل المسلسلات...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Header />
      
      <main className="pb-20">
        <Slider series={allSeries.slice(0, 5)} />
        
        <div className="relative z-10 -mt-10 sm:-mt-20">
          <CategoryBar selected={selectedCategory} onSelect={handleCategoryChange} />
          
          <div className="px-4 sm:px-8 py-8 sm:py-12 pb-32">
            
            <div className="flex items-center justify-between mb-8 sm:mb-10">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl sm:text-3xl font-black-italic border-r-4 border-primary pr-4 sm:pr-6">
                  {selectedCategory === 'الكل' ? 'NEW SERIES' : `${selectedCategory.toUpperCase()} SERIES`}
                </h2>
                {query && (
                  <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 mr-6 text-zinc-500 hover:text-white transition-colors text-[10px] font-black group"
                  >
                    <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                    مسح البحث: "{query}"
                  </button>
                )}
              </div>
              <span className="text-zinc-600 font-bold text-[8px] sm:text-[10px] tracking-widest uppercase italic">
                {filteredSeries.length} TITLES
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-8">
              {paginatedSeries.length > 0 ? (
                paginatedSeries.map((item) => (
                  <div
                    key={item.id}
                    className="transition-all duration-300 transform hover:scale-[1.03]"
                  >
                    <SeriesCard 
                      item={item} 
                      onPress={() => navigate('/watch', { state: { series: item } })} 
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700">
                    <ChevronRight className="w-10 h-10 rotate-45 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white mb-2">عذراً، لم نجد ما تبحث عنه</h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                      تأكد من كتابة اسم المسلسل بشكل صحيح، أو جرب البحث بكلمة أخرى.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-1 sm:gap-3">
                <button 
                  onClick={() => {
                    setCurrentPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="p-2 sm:p-3 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 disabled:opacity-20 hover:text-primary hover:border-primary/30 transition-all active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1 sm:gap-2">
                  {getPageNumbers().map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setCurrentPage(num);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border font-black text-xs sm:text-sm transition-all active:scale-90 ${
                        currentPage === num 
                          ? "bg-primary border-primary text-black shadow-[0_0_20px_rgba(229,9,20,0.3)]" 
                          : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-zinc-600 px-1">...</span>
                      <button
                        onClick={() => {
                          setCurrentPage(totalPages);
                          window.scrollTo({ top: 400, behavior: 'smooth' });
                        }}
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border font-black text-xs sm:text-sm bg-zinc-900 border-white/5 text-zinc-400 hover:text-white`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => {
                    setCurrentPage(p => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="p-2 sm:p-3 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 disabled:opacity-20 hover:text-primary hover:border-primary/30 transition-all active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            )}

            {filteredSeries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <p className="text-xl">لا توجد مسلسلات في هذا القسم حالياً.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
