import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ChevronRight, ChevronLeft, LayoutGrid, Play, AlertTriangle, Heart, Share2, Download } from 'lucide-react';
import { cn, triggerAdFlow } from '../lib/utils';
import { Series } from '../types';
import CustomPlayer from '../components/CustomPlayer';
import SeriesChat from '../components/SeriesChat';
import ReportModal from '../components/ReportModal';

export default function Watch() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeServer, setActiveServer] = useState<string>('');
  const [resolvedVideo, setResolvedVideo] = useState<{ videoUrl: string | null; type: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    // Intercept direct external link copies to require going through the ad skip page
    const hasAdShown = sessionStorage.getItem('ad_shown_this_session') === 'true';
    if (!hasAdShown) {
      sessionStorage.setItem('ad_shown_this_session', 'true');
      window.location.replace(`/ad?redirectUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    async function fetchWatchData() {
      setLoading(true);
      try {
        const res = await axios.get(`/api/episode/${slug}`);
        setData(res.data);
        
        if (res.data.servers?.length > 0) {
          setActiveServer(res.data.servers[0].url);
        } else {
          setActiveServer(res.data.iframeSrc);
        }

        // Fetch series details for context
        if (res.data.seriesSlug) {
          const seriesRes = await axios.get(`/api/series/${res.data.seriesSlug}`);
          setSeries(seriesRes.data);
        }
      } catch (error) {
        console.error("Watch fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchWatchData();
    window.scrollTo(0, 0);
  }, [slug]);

  // Save to Watch History when episode and series are loaded
  useEffect(() => {
    if (data && series) {
      try {
        const historyJson = localStorage.getItem('watch_history') || '[]';
        const history = JSON.parse(historyJson);
        const newItem = {
          slug: slug,
          title: data.title,
          seriesTitle: series.title,
          seriesSlug: series.slug,
          img: series.img,
          watchedAt: Date.now()
        };
        const filtered = history.filter((item: any) => item.slug !== newItem.slug);
        const updated = [newItem, ...filtered].slice(0, 8);
        localStorage.setItem('watch_history', JSON.stringify(updated));
        window.dispatchEvent(new Event('watch_history_updated'));
      } catch (err) {
        console.error("Failed to save history:", err);
      }
    }
  }, [data, series]);

  // Check Favorite State
  useEffect(() => {
    if (series) {
      try {
        const favs = JSON.parse(localStorage.getItem('favorites_series') || '[]');
        setIsFavorited(favs.some((fav: any) => fav.slug === series.slug));
      } catch (e) {
        setIsFavorited(false);
      }
    }
  }, [series]);

  const toggleFavorite = () => {
    if (!series) return;
    try {
      const favs = JSON.parse(localStorage.getItem('favorites_series') || '[]');
      const isAlready = favs.some((fav: any) => fav.slug === series.slug);
      let updated;
      if (isAlready) {
        updated = favs.filter((fav: any) => fav.slug !== series.slug);
        setIsFavorited(false);
      } else {
        updated = [...favs, {
          title: series.title,
          slug: series.slug,
          img: series.img,
          addedAt: Date.now()
        }];
        setIsFavorited(true);
      }
      localStorage.setItem('favorites_series', JSON.stringify(updated));
      window.dispatchEvent(new Event('favorites_updated'));
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  useEffect(() => {
    if (!activeServer) {
      setResolvedVideo(null);
      return;
    }

    async function resolve() {
      setResolving(true);
      setResolvedVideo(null);
      try {
        const res = await axios.get(`/api/resolve-video?url=${encodeURIComponent(activeServer)}`);
        if (res.data && res.data.videoUrl) {
          setResolvedVideo(res.data);
        } else {
          setResolvedVideo(null);
        }
      } catch (error) {
        console.error("Failed to resolve video direct link:", error);
        setResolvedVideo(null);
      } finally {
        setResolving(false);
      }
    }

    // Resolve automatically for high performance direct stream player
    resolve();
  }, [activeServer]);

  const currentEpIndex = series?.episodes?.findIndex(ep => ep.epSlug === slug) ?? -1;
  const nextEp = currentEpIndex !== -1 && series?.episodes ? series.episodes[currentEpIndex + 1] : null;
  const prevEp = currentEpIndex !== -1 && series?.episodes ? series.episodes[currentEpIndex - 1] : null;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="animate-spin text-[#b72424]" size={48} />
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 bg-[#0a0a0a]">الحلقة غير موجودة</div>;

  return (
    <div className="pb-12 bg-[#0a0a0a] min-h-screen" dir="rtl">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-4 md:mt-8">
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          
          {/* Main Content (Player) */}
          <div className="flex-grow">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
              <div>
                <h1 className="text-xl md:text-3xl font-black mb-1 md:mb-2 leading-tight">{data.title}</h1>
                {series && (
                  <Link to={`/series/${series.slug}`} className="text-[#b72424] font-bold hover:underline flex items-center gap-2 text-sm md:text-base">
                    <LayoutGrid size={14} className="md:size-16" />
                    {series.title}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  disabled={!prevEp}
                  onClick={() => prevEp && triggerAdFlow(`/watch/${prevEp.epSlug}`, navigate)}
                  className={cn(
                    "bg-[#1a1a1a] p-3 md:p-4 rounded-xl transition-all border border-white/10",
                    !prevEp ? "opacity-30 cursor-not-allowed" : "hover:bg-[#b72424] hover:border-[#b72424]"
                  )}
                >
                  <ChevronRight size={20} className="md:size-24" />
                </button>
                <button 
                  disabled={!nextEp}
                  onClick={() => nextEp && triggerAdFlow(`/watch/${nextEp.epSlug}`, navigate)}
                  className={cn(
                    "bg-[#1a1a1a] p-3 md:p-4 rounded-xl transition-all border border-white/10",
                    !nextEp ? "opacity-30 cursor-not-allowed" : "hover:bg-[#b72424] hover:border-[#b72424]"
                  )}
                >
                  <ChevronLeft size={20} className="md:size-24" />
                </button>
              </div>
            </div>

            {/* Video Player */}
            <CustomPlayer
              videoUrl={resolvedVideo?.videoUrl || (activeServer && !activeServer.includes('/api/proxy') ? `/api/proxy-player?url=${encodeURIComponent(activeServer)}` : activeServer)}
              activeServerUrl={activeServer}
              seriesId={series?.slug || ""}
              seriesImage={series?.img || ""}
              episodeIndex={currentEpIndex}
              episodes={series?.episodes || []}
              servers={data.servers || []}
              onSelectEpisode={(ep, index) => {
                triggerAdFlow(`/watch/${ep.epSlug}`, navigate);
              }}
              onSelectServer={(url) => {
                setActiveServer(url);
              }}
              isMaximized={isMaximized}
              onToggleMaximize={() => {
                setIsMaximized(!isMaximized);
              }}
              seriesTitle={series?.title}
              seriesCategory="مسلسل"
            />

            {/* Server Selection */}
            <div className="mt-6 md:mt-10">
              <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="h-6 md:h-8 w-1 md:w-1.5 bg-[#b72424] rounded-full" />
                <h3 className="text-lg md:text-xl font-black text-white">اختر سيرفر المشاهدة</h3>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {data.servers?.map((server: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveServer(server.url)}
                    className={cn(
                      "px-5 md:px-8 py-3 md:py-4 rounded-lg md:rounded-xl font-black transition-all border-2 text-sm md:text-lg",
                      activeServer === server.url 
                        ? "bg-[#b72424] border-[#b72424] text-white shadow-xl shadow-[#b72424]/30" 
                        : "bg-[#141414] border-white/5 text-gray-400 hover:border-[#b72424] hover:text-white"
                    )}
                  >
                    {server.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mt-8 md:mt-10">
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2.5 text-sm md:text-base text-gray-300 hover:text-white cursor-pointer">
                <Download className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <span>تحميل</span>
              </button>
              <button 
                onClick={toggleFavorite}
                className={cn(
                  "py-4 md:py-5 rounded-xl md:rounded-2xl font-black transition-all border flex items-center justify-center gap-2.5 text-sm md:text-base cursor-pointer",
                  isFavorited 
                    ? "bg-[#b72424]/10 border-[#b72424]/30 text-[#b72424]" 
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-[#b72424]/10 hover:border-[#b72424]/30 hover:text-[#b72424]"
                )}
              >
                <Heart className={cn("w-4 h-4 md:w-5 md:h-5 text-rose-500", isFavorited && "fill-rose-500")} />
                <span>{isFavorited ? "مضاف للمفضلة" : "المفضلة"}</span>
              </button>
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-500 transition-all border border-white/10 flex items-center justify-center gap-2.5 text-sm md:text-base text-gray-300 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                <span>إبلاغ</span>
              </button>
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2.5 text-sm md:text-base text-gray-300 hover:text-white cursor-pointer">
                <Share2 className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <span>مشاركة</span>
              </button>
            </div>

            {/* Live Chat */}
            {series && (
              <div className="mt-8 md:mt-10">
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="h-6 md:h-8 w-1 md:w-1.5 bg-[#b72424] rounded-full" />
                  <h3 className="text-lg md:text-xl font-black text-white">الدردشة الحية والمناقشة 💬</h3>
                </div>
                <SeriesChat seriesId={series.slug} seriesTitle={series.title} />
              </div>
            )}

            {/* Report Dialog Modal */}
            <ReportModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              seriesTitle={series?.title}
              episodeTitle={data?.title}
              episodeSlug={slug}
            />
          </div>

          {/* Sidebar (Episode List) - Netflix Style Sidebar */}
          {series && (
            <div className="lg:w-[380px] xl:w-[440px] shrink-0">
              <div className="bg-[#111] rounded-2xl md:rounded-3xl border border-white/5 p-4 md:p-5 lg:sticky lg:top-24 max-h-[65vh] lg:max-h-[80vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#b72424] rounded-full" />
                    <h3 className="text-base md:text-lg font-black text-white">قائمة الحلقات</h3>
                  </div>
                  <span className="text-[#b72424] font-bold text-xs md:text-sm bg-[#b72424]/10 px-2.5 py-1 rounded-full">{series.episodes?.length} حلقة</span>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                  {series.episodes?.map((ep, idx) => {
                    const isActive = slug === ep.epSlug;
                    return (
                      <button 
                        key={ep.epSlug} 
                        onClick={() => triggerAdFlow(`/watch/${ep.epSlug}`, navigate)}
                        className={cn(
                          "w-full flex gap-3.5 p-2 rounded-xl transition-all duration-300 text-right group border",
                          isActive 
                            ? "bg-gradient-to-l from-[#b72424]/20 to-transparent border-[#b72424]/40 shadow-lg shadow-[#b72424]/5" 
                            : "bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/5"
                        )}
                      >
                        {/* Thumbnail (Right side in RTL) */}
                        <div className="relative w-24 h-14 md:w-28 md:h-16 rounded-lg overflow-hidden shrink-0 shadow-md ring-1 ring-white/10 bg-zinc-900 flex-shrink-0">
                          <img 
                            src={series.img} 
                            alt={`الحلقة ${ep.epNum}`}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                          />
                          {/* Netflix Hover Overlay */}
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300",
                            isActive ? "opacity-100 bg-black/55" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <div className="w-7 h-7 rounded-full bg-[#b72424] text-white flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                              <Play size={12} fill="white" className="mr-0.5" />
                            </div>
                          </div>
                          
                          {/* Episode Index Badge */}
                          <span className="absolute top-1.5 right-1.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded leading-none select-none">
                            {idx + 1}
                          </span>
                          
                          {/* Active Watch Progress Line */}
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#b72424] shadow-lg shadow-[#b72424]/50 animate-pulse" />
                          )}
                        </div>

                        {/* Text Metadata (Left side in RTL) */}
                        <div className="flex flex-col justify-center min-w-0 flex-grow select-none">
                          <div className="flex items-center gap-1.5 mb-1">
                            <h4 className={cn(
                              "font-black text-xs md:text-sm truncate",
                              isActive ? "text-[#b72424]" : "text-gray-100 group-hover:text-white"
                            )}>
                              الحلقة {ep.epNum}
                            </h4>
                            {isActive && (
                              <span className="text-[9px] font-black text-[#b72424] bg-[#b72424]/15 px-1.5 py-0.5 rounded-full uppercase tracking-tight animate-pulse shrink-0">
                                تشاهد الآن
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] md:text-xs text-zinc-400 group-hover:text-zinc-300 truncate font-medium">
                            {series.title}
                          </p>
                          <p className="text-[9px] text-zinc-500 group-hover:text-zinc-400 truncate mt-0.5 font-medium">
                            بث فوري فائق السرعة
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>


        {/* Info Box */}
        <div className="mt-12 bg-[#1a1a1a] p-8 rounded-3xl border-r-8 border-[#b72424] shadow-xl">
          <h3 className="text-xl font-black mb-4">تنبيه المشاهدة</h3>
          <p className="text-gray-400 leading-relaxed font-medium">
            نحن في <span className="text-white font-bold">حكايتنا</span> نسعى دائماً لتوفير أفضل جودة ممكنة. إذا واجهت أي تقطيع في البث، يرجى تجربة سيرفر آخر من القائمة المتوفرة. جميع المسلسلات مترجمة باحترافية لتناسب ذوقكم الرفيع.
          </p>
        </div>
      </div>
    </div>
  );
}
