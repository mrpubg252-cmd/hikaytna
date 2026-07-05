import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CategoryBar from "../components/CategoryBar";
import SeriesCard from "../components/SeriesCard";
import BottomNav from "../components/BottomNav";
import { fetchCategoryPage, getCachedSeriesByCategory, getAllCachedSeries, fetchAllSeries } from "../services/dataService";
import { applyPrioritySort } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Series } from "../services/firebase";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, ArrowLeft, AlertCircle, AlertTriangle, X } from "lucide-react";
import NoticeAndSupportBubble from "../components/NoticeAndSupportBubble";
import { fuzzyMatchArabic } from "../lib/utils";
import { navigateToWatchOrAds } from "../utils/watchNavigation";
import {
  initializeEpisodeTracking,
  hasNewEpisode,
  getEpisodeUpdatedAt,
  markSeriesAsRead,
  getLastNewDetectedAt,
} from "../lib/episodeHistory";

export default function HomeScreen() {
  const [allSeriesRaw, setAllSeriesRaw] = useState<Series[]>([]);
  const [globalCache, setGlobalCache] = useState<Series[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("تركي");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const itemsPerPage = 30;
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q");

  const [showCheatedAlert, setShowCheatedAlert] = useState(false);

  useEffect(() => {
    const checkAlert = () => {
      setShowCheatedAlert(localStorage.getItem('cheated_detector_alert') === 'true');
    };
    checkAlert();
    window.addEventListener('cheated-alert-updated', checkAlert);
    return () => window.removeEventListener('cheated-alert-updated', checkAlert);
  }, []);

  // 1. Initial Data Preload
  useEffect(() => {
    const initData = async () => {
      try {
        const fullList = await fetchAllSeries(false);
        setGlobalCache(fullList);
      } catch (err) {
        console.warn("Silent background preload failed:", err);
      }
    };
    initData();

    const adminAccess = localStorage.getItem('short_admin_access') === 'true' || 
                        localStorage.getItem('guest_chat_name') === 'المدير 🛡️';
    setIsAdmin(adminAccess);
  }, []);

  // 2. Optimized Category Loading
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadCategory() {
      if (!isMounted) return;
      setError(null);
      
      const cached = getCachedSeriesByCategory(selectedCategory);
      if (cached.length > 0) {
        setAllSeriesRaw(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Fetch the first 4 pages for thorough coverage (especially for Turkish series)
        const pagePromises = [0, 1, 2, 3].map(page => 
          fetchCategoryPage(selectedCategory, page, controller.signal)
        );
        
        const results = await Promise.allSettled(pagePromises);
        let allFetched: Series[] = [];
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value.length > 0) {
            allFetched = [...allFetched, ...res.value];
          }
        });

        if (isMounted && allFetched.length > 0) {
          initializeEpisodeTracking(allFetched);
          setAllSeriesRaw(allFetched);
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error("Error loading category", err);
        if (isMounted && cached.length === 0) setError("تعذر تحميل قائمة المسلسلات حالياً.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCategory();

    const handleSync = () => {
      if (!isMounted) return;
      const allCached = getAllCachedSeries();
      setGlobalCache([...allCached]);
      
      const categoryData = getCachedSeriesByCategory(selectedCategory);
      if (categoryData.length > 0) {
        setAllSeriesRaw([...categoryData]);
      }
    };

    window.addEventListener("series-data-updated", handleSync);
    window.addEventListener("category-pins-updated", handleSync);

    return () => {
      isMounted = false;
      controller.abort();
      window.removeEventListener("series-data-updated", handleSync);
      window.removeEventListener("category-pins-updated", handleSync);
    };
  }, [selectedCategory]);

  // 3. Centralized Processing (Sorting + Filtering) - This is where the magic happens!
  // We apply the heavy logic here in useMemo to keep the UI buttery smooth.
  const processedSeries = useMemo(() => {
    try {
      // Step A: Determine base list (Search vs Category)
      let list: Series[] = [];
      if (query) {
        const q = query.toLowerCase().trim();
        // Index search across ALL loaded series
        const seenIds = new Set();
        const pool = [...allSeriesRaw];
        pool.forEach(s => seenIds.add(s.id));
        
        globalCache.forEach(s => {
          if (!seenIds.has(s.id)) pool.push(s);
        });

        list = pool.filter(s => 
          fuzzyMatchArabic(s.title || "", q) || 
          fuzzyMatchArabic(s.category || "", q)
        );
      } else {
        list = allSeriesRaw;
      }

      // Step B: Apply Universal Professional Sort (handled by API service for consistency)
      return applyPrioritySort(list);
    } catch (err) {
      console.error("Processing series failed:", err);
      return [];
    }
  }, [allSeriesRaw, globalCache, query]);

  // 4. Pagination
  const totalPages = Math.ceil(processedSeries.length / itemsPerPage);
  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedSeries.slice(start, start + itemsPerPage);
  }, [processedSeries, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, query]);

  function handleCategoryChange(category: string) {
    if (category !== selectedCategory) {
      setSelectedCategory(category);
      setCurrentPage(1);
    }
  }


  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-zinc-900 border border-primary/20 flex items-center justify-center animate-bounce">
          <AlertCircle className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">عذراً، حدث خطأ في النظام</h2>
          <p className="text-zinc-500 max-w-xs mx-auto text-sm leading-relaxed">
            {error}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-[0_0_30px_rgba(229,9,20,0.3)] active:scale-95"
        >
          إعادة تحميل التطبيق
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="text-5xl font-black italic text-primary drop-shadow-[0_0_20px_rgba(229,9,20,0.4)] animate-pulse mb-6">
          حكايتنا
        </div>
        <div className="w-10 h-10 border-4 border border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Header />

      <AnimatePresence>
        {showCheatedAlert && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{
              x: [320, 0, 0, 0, 100, 320],
              opacity: [0, 1, 1, 1, 0.4, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              repeatDelay: 4,
              ease: "easeInOut",
              times: [0, 0.08, 0.5, 0.85, 0.95, 1]
            }}
            className="fixed top-24 right-4 md:right-8 w-[92%] sm:w-[480px] z-[200] max-w-full"
          >
            <div className="bg-[#0f0202]/95 backdrop-blur-2xl border border-red-500/25 shadow-[0_20px_50px_rgba(239,68,68,0.3)] rounded-[2rem] p-5 md:p-6 text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-3xl rounded-full" />
              
              <button 
                onClick={() => {
                  localStorage.removeItem('cheated_detector_alert');
                  sessionStorage.removeItem('cheated_detector_alert');
                  setShowCheatedAlert(false);
                }}
                className="absolute top-4 left-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer z-50 animate-pulse"
                title="إغلاق التحذير"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-4 flex-row-reverse relative z-10 pl-6 text-right">
                <div className="p-3 bg-red-500/15 border border-red-500/20 rounded-2xl text-red-500 max-h-[46px] flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1 select-none">
                  <h4 className="text-xs sm:text-sm font-black text-red-500 tracking-tight italic">إشعار أمني: تم رصد محاولة تلاعب بالدعوات ⚠️</h4>
                  <p className="text-[10px] sm:text-xs text-zinc-350 leading-relaxed font-bold">
                    إذا قمت بدخول نفس رابط الإحالة الخاص بك قد يتم حظرك من مشاهدة المسلسلات، لذا قم بمشاركة رابط إحالتك إلى أشخاص حقيقيين فقط!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-20">
        <div className="relative z-10 pt-4">
          <CategoryBar
            selected={selectedCategory}
            onSelect={handleCategoryChange}
          />

          <div className="px-4 sm:px-8 py-8 sm:py-12 pb-32">
            <div className="flex items-center justify-between mb-8 sm:mb-10">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl sm:text-3xl font-black-italic border-r-4 border-primary pr-4 sm:pr-6">
                  {query
                    ? "SEARCH RESULTS"
                    : selectedCategory === "الكل"
                    ? "NEW SERIES"
                    : `${selectedCategory.toUpperCase()} SERIES`}
                </h2>
                {query && (
                  <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-2 mr-6 text-zinc-500 hover:text-white transition-colors text-[10px] font-black group"
                  >
                    <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                    مسح البحث: "{query}"
                  </button>
                )}
              </div>
              <span className="text-zinc-600 font-bold text-[8px] sm:text-[10px] tracking-widest uppercase italic">
                {processedSeries.length} TITLES
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-8">
              {paginatedSeries.length > 0 ? (
                paginatedSeries.map((item) => (
                  <SeriesCard
                    key={`series-${item.id}`}
                    item={item}
                    onPress={() => {
                      markSeriesAsRead(item);
                      navigateToWatchOrAds(navigate, item);
                    }}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700">
                    <ChevronRight className="w-10 h-10 rotate-45 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white mb-2">
                      عذراً، لم نجد ما تبحث عنه
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                      تأكد من كتابة اسم المسلسل بشكل صحيح، أو جرب البحث بكلمة
                      أخرى.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Professional Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-16 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 direction-rtl">
                  {/* Previous Button (Points Right in Arabic RTL) */}
                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === 1}
                    className="w-10 h-10 bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white rounded-xl disabled:opacity-20 transition-all flex items-center justify-center"
                    title="السابق"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((idx) => {
                        // Very compact sliding window
                        if (totalPages <= 5) return true;
                        if (idx === 1 || idx === totalPages) return true;
                        return Math.abs(idx - currentPage) <= (currentPage === 1 || currentPage === totalPages ? 2 : 1);
                      })
                      .map((idx, i, arr) => (
                        <React.Fragment key={idx}>
                          {i > 0 && idx - arr[i - 1] > 1 && (
                            <span className="text-zinc-700 px-0.5 select-none text-[10px]">...</span>
                          )}
                          <button
                            onClick={() => {
                              setCurrentPage(idx);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`w-9 h-9 rounded-xl font-black text-[10px] transition-all flex items-center justify-center ${
                              currentPage === idx
                                ? "bg-primary text-white shadow-[0_0_20px_rgba(229,9,20,0.4)] scale-110 z-10"
                                : "bg-zinc-900 text-zinc-500 hover:text-white border border-white/5"
                            }`}
                          >
                            {idx}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  {/* Next Button (Points Left in Arabic RTL) */}
                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white rounded-xl disabled:opacity-20 transition-all flex items-center justify-center"
                    title="التالي"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-zinc-600 font-bold text-[9px] tracking-widest uppercase">
                  صفحة <span className="text-white">{currentPage}</span> من {totalPages}
                </p>
              </div>
            )}

            {processedSeries.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <p className="text-xl">لا توجد مسلسلات في هذا القسم حالياً.</p>
              </div>
            )}
          </div>
        </div>
        <Footer />
      </main>
      <BottomNav />
      <NoticeAndSupportBubble />
    </div>
  );
}
