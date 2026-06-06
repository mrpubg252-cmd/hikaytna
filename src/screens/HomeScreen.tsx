import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Slider from "../components/Slider";
import CategoryBar from "../components/CategoryBar";
import SeriesCard from "../components/SeriesCard";
import BottomNav from "../components/BottomNav";
import { fetchCategoryPage, getCachedSeriesByCategory, getAllCachedSeries, fetchAllSeries } from "../services/dataService";
import { applyPrioritySort } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Series } from "../services/firebase";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, ArrowLeft, AlertCircle } from "lucide-react";
import NoticeAndSupportBubble from "../components/NoticeAndSupportBubble";
import { fuzzyMatchArabic } from "../lib/utils";
import {
  initializeEpisodeTracking,
  hasNewEpisode,
  getEpisodeUpdatedAt,
  markSeriesAsRead,
  getLastNewDetectedAt,
} from "../lib/episodeHistory";

export default function HomeScreen() {
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("تركي");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; // Increased to show more items per page
  
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q");

  const [globalCache, setGlobalCache] = useState<Series[]>([]);

  useEffect(() => {
    // Keep global cache fresh and trigger background global preload instantly
    // to populate the search database across ALL categories!
    const initPreload = async () => {
      try {
        const fullList = await fetchAllSeries(false);
        setGlobalCache(fullList);
      } catch (err) {
        console.warn("Silent background preload failed:", err);
      }
    };
    initPreload();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadCategory() {
      if (!isMounted) return;
      setError(null);
      
      // Try to load from cache first for instant UI response
      const cached = getCachedSeriesByCategory(selectedCategory);
      if (cached.length > 0) {
        setAllSeries(sortAndProcess(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }

      const filterUnique = (list: Series[]) => {
        const uniqueSeen = new Set();
        return list.filter((s) => {
          const cleanTitle = (s.title || "").toLowerCase().trim().replace(/^(المسلسل التركي|المسلسل الكوري|المسلسل المكسيكي|المسلسل الاسيوي|المسلسل|الفيلم|البرنامج|مسلسل|برنامج|فيلم)\s+/g, "").replace(/^ال/g, "").replace(/ـ/g, "").replace(/\s+/g, "");
          const key = cleanTitle || (s.id || "").toString().toLowerCase().trim();
          if (!key || uniqueSeen.has(key)) return false;
          uniqueSeen.add(key);
          return true;
        });
      };

      try {
        // Step 1: FETCH PAGE 0 IMMEDIATELY FOR INSTANT USER LOAD (~300-500ms)
        let combined: Series[] = [];
        try {
          const page0Series = await fetchCategoryPage(selectedCategory, 0, controller.signal);
          if (page0Series.length > 0) {
            combined = [...page0Series];
            if (isMounted) {
              initializeEpisodeTracking(combined);
              setAllSeries(sortAndProcess(combined));
              setLoading(false);
            }
          }
        } catch (e) {
          console.warn("Error fetching page 0:", e);
        }

        if (!isMounted || controller.signal.aborted) return;

        // Step 2: ACCUMULATE DEEP PAGES FAST BY FETCHING IN PARALLEL CHUNKS (of 5 pages)
        // This ensures the entire massive category is loaded completely in 1-2 seconds instead of taking 30 seconds!
        const maxPageIndex = 45;
        const chunkSize = 5;

        for (let baseIdx = 1; baseIdx <= maxPageIndex; baseIdx += chunkSize) {
          if (!isMounted || controller.signal.aborted) break;

          const chunkPages: number[] = [];
          for (let p = baseIdx; p < baseIdx + chunkSize && p <= maxPageIndex; p++) {
            chunkPages.push(p);
          }

          // Fetch all pages in this chunk in parallel!
          const chunkResults = await Promise.allSettled(
            chunkPages.map(idx => fetchCategoryPage(selectedCategory, idx, controller.signal))
          );

          if (!isMounted || controller.signal.aborted) break;

          let chunkSeries: Series[] = [];
          let hasNewContent = false;

          chunkResults.forEach(res => {
            if (res.status === "fulfilled" && res.value.length > 0) {
              chunkSeries = [...chunkSeries, ...res.value];
              hasNewContent = true;
            }
          });

          // If the entire chunk returned absolutely no items, we must have hit the end of the category
          if (!hasNewContent && chunkSeries.length === 0) {
            console.log(`[Dynamic Chunk Pagination] Reached end of category "${selectedCategory}" at page index ${baseIdx}`);
            break;
          }

          if (chunkSeries.length > 0) {
            combined = [...combined, ...chunkSeries];
            const currentUnique = filterUnique(combined);
            if (currentUnique.length > 0) {
              setAllSeries(sortAndProcess(currentUnique));
              setLoading(false);
            }
          }

          // A small polite delay to prevent rate-limiting or heavy burst while preserving lightning speed
          await new Promise(r => setTimeout(r, 150));
        }

        // If even the first page returned nothing, and we have no cached data, display the user-friendly warning
        const currentCache = getCachedSeriesByCategory(selectedCategory);
        if (combined.length === 0 && cached.length === 0 && currentCache.length === 0) {
          setError("فشل الاتصال بالخادم. يرجى التأكد من الإنترنت أو المحاولة لاحقاً.");
        }
      } catch (err) {
        console.error("Error loading category", err);
        if (isMounted && cached.length === 0) setError("تعذر تحميل قائمة المسلسلات حالياً.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // Optimized sort and process helper
    function sortAndProcess(list: Series[]) {
      // First apply the centralized priority and exclusion sort
      let sorted = applyPrioritySort(list);

      // Then apply secondary UI-specific sorting (new detected logic)
      const mapped = sorted.map((s: Series) => {
        return {
          ...s,
          _hasNew: hasNewEpisode(s),
          _updatedAt: getEpisodeUpdatedAt(s) || 0,
          _detectedAt: getLastNewDetectedAt(s) || 0
        };
      });

      mapped.sort((a: any, b: any) => {
        // Keeps priority items at the VERY top
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        
        // If BOTH are priority, do NOT fall through to new-episode sort
        // Preserve the order from applyPrioritySort
        if (a.isPriority && b.isPriority) {
          // Since it's a stable sort, returning 0 keeps existing order
          return 0;
        }

        if (a._hasNew && !b._hasNew) return -1;
        if (!a._hasNew && b._hasNew) return 1;
        
        if (a._hasNew && b._hasNew) {
          return b._updatedAt - a._updatedAt;
        }

        if (a._detectedAt !== b._detectedAt) {
          return b._detectedAt - a._detectedAt;
        }

        return (b.rating || 0) - (a.rating || 0);
      });

      return mapped;
    }

    loadCategory();

    const handleBackgroundSync = () => {
      if (!isMounted) return;
      
      // Reactive update of the global search cache
      const allCached = getAllCachedSeries();
      setGlobalCache(allCached);

      const currentCache = getCachedSeriesByCategory(selectedCategory);
      if (currentCache.length > 0) {
        setAllSeries(prev => {
          const combined = [...prev, ...currentCache];
          const seen = new Set();
          const unique = combined.filter((s) => {
            const key = (s.id || s.title || "").toString().toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return sortAndProcess(unique);
        });
      }
    };

    window.addEventListener("series-data-updated", handleBackgroundSync);

    return () => {
      isMounted = false;
      controller.abort("Navigation or category change");
      window.removeEventListener("series-data-updated", handleBackgroundSync);
    };
  }, [selectedCategory]);

  const filteredSeries = useMemo(() => {
    try {
      if (!query) return allSeries;
      const q = query.toLowerCase().trim();
      
      // When searching, we look through BOTH the currently loaded category items 
      // AND the global cache to ensure nothing is missed.
      const globalPool = globalCache;
      
      // Combine and deduplicate
      const combinedPool = [...allSeries];
      const seenIds = new Set(allSeries.map(s => s.id));
      
      globalPool.forEach(s => {
        if (!seenIds.has(s.id)) {
          combinedPool.push(s);
          seenIds.add(s.id);
        }
      });

      return combinedPool.filter((s: Series) => {
        if (!s) return false;
        
        // Search in title
        const titleMatch = fuzzyMatchArabic(s.title || "", q);
        if (titleMatch) return true;
        
        // Search in category (allow searching for "تركي", "كوري", etc.)
        const categoryMatch = fuzzyMatchArabic(s.category || "", q);
        if (categoryMatch) return true;
        
        return false;
      });
    } catch (err) {
      console.error("Filtering error", err);
      return allSeries;
    }
  }, [allSeries, query, globalCache]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);

  // Pagination logic: only show items for current page
  const paginatedSeries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const items = filteredSeries.slice(startIndex, startIndex + itemsPerPage);
    // If we're on a page that doesn't have enough items but there are more pages theoretically,
    // this keeps the layout consistent. With slice it's fine.
    return items;
  }, [filteredSeries, currentPage]);

  // Reset page when filtering or changing category
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSeries.length, selectedCategory, query]);

  function handleCategoryChange(category: string) {
    if (category !== selectedCategory) {
      setSelectedCategory(category);
      // Stay on page 1 of the new category
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

      <main className="pb-20">
        <Slider series={filteredSeries.slice(0, 5)} />

        <div className="relative z-10 -mt-10 sm:-mt-20">
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
                {filteredSeries.length} TITLES
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
                      navigate("/watch", { state: { series: item } });
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

            {filteredSeries.length === 0 && !loading && (
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
