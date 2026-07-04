import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ChevronRight, ChevronLeft, LayoutGrid, Play } from 'lucide-react';
import { cn, triggerAdFlow } from '../lib/utils';
import { Series } from '../types';
import CustomPlayer from '../components/CustomPlayer';
import SeriesChat from '../components/SeriesChat';

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

  useEffect(() => {
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
                  onClick={() => prevEp && triggerAdFlow(`/watch/${prevEp.epSlug}`)}
                  className={cn(
                    "bg-[#1a1a1a] p-3 md:p-4 rounded-xl transition-all border border-white/10",
                    !prevEp ? "opacity-30 cursor-not-allowed" : "hover:bg-[#b72424] hover:border-[#b72424]"
                  )}
                >
                  <ChevronRight size={20} className="md:size-24" />
                </button>
                <button 
                  disabled={!nextEp}
                  onClick={() => nextEp && triggerAdFlow(`/watch/${nextEp.epSlug}`)}
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
              videoUrl={resolving ? "" : (resolvedVideo?.videoUrl || activeServer)}
              activeServerUrl={activeServer}
              seriesId={series?.slug || ""}
              seriesImage={series?.img || ""}
              episodeIndex={currentEpIndex}
              episodes={series?.episodes || []}
              servers={data.servers || []}
              onSelectEpisode={(ep, index) => {
                triggerAdFlow(`/watch/${ep.epSlug}`);
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
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2 text-sm md:text-base">
                <span>تحميل</span>
              </button>
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2 text-sm md:text-base">
                <span>المفضلة</span>
              </button>
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2 text-sm md:text-base">
                <span>إبلاغ</span>
              </button>
              <button className="bg-white/5 py-4 md:py-5 rounded-xl md:rounded-2xl font-black hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2 text-sm md:text-base">
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
          </div>

          {/* Sidebar (Episode List) */}
          {series && (
            <div className="lg:w-[350px] xl:w-[400px] shrink-0">
              <div className="bg-[#141414] rounded-2xl md:rounded-3xl border border-white/5 p-5 md:p-6 lg:sticky lg:top-24 max-h-[60vh] lg:max-h-[80vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
                  <h3 className="text-lg md:text-xl font-black">قائمة الحلقات</h3>
                  <span className="text-[#b72424] font-bold text-sm md:text-base">{series.episodes?.length} حلقة</span>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 md:pr-2 space-y-2">
                  {series.episodes?.map((ep) => (
                    <button 
                      key={ep.epSlug} 
                      onClick={() => triggerAdFlow(`/watch/${ep.epSlug}`)}
                      className={cn(
                        "w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all border text-right",
                        slug === ep.epSlug 
                          ? "bg-[#b72424] border-[#b72424] shadow-lg shadow-[#b72424]/20 text-white" 
                          : "bg-white/5 border-transparent hover:bg-white/10 text-gray-300 hover:text-white"
                      )}
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                        <Play size={16} className="md:size-20" fill={slug === ep.epSlug ? "white" : "currentColor"} />
                      </div>
                      <div className="flex-grow overflow-hidden">
                        <h4 className="font-bold text-xs md:text-sm line-clamp-1">
                          الحلقة {ep.epNum}
                        </h4>
                        <p className="text-[10px] md:text-xs text-white/40 truncate">{series.title}</p>
                      </div>
                    </button>
                  ))}
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
