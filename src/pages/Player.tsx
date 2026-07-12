import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { 
  ArrowRight, Play, Server, AlertCircle, Loader2, MessageCircle, 
  Send, Instagram, Video, MessageSquare, ChevronDown, SlidersHorizontal, Search, Eye 
} from "lucide-react";
import { seriesData } from "../lib/data";
import Chat from "../components/Chat";

interface VideoServer {
  name: string;
  url: string;
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let watchUrl = searchParams.get("url");

  // Ensure 3iskk episode URLs end with /see/ to properly load the player
  if (watchUrl && watchUrl.includes("3iskk.xyz/watch/episodes/") && !watchUrl.endsWith("see/")) {
    if (!watchUrl.endsWith("/")) {
      watchUrl += "/";
    }
    watchUrl += "see/";
  }

  const series = seriesData.find((s) => s.id === id);

  // Custom player states
  const [servers, setServers] = useState<VideoServer[]>([]);
  const [selectedServerIdx, setSelectedServerIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showChat, setShowChat] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!watchUrl) return;

    async function fetchEmbedServers() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/get-episode-embed?url=${encodeURIComponent(watchUrl || "")}`);
        if (!response.ok) throw new Error("فشل الاتصال بالخادم");
        const data = await response.json();
        
        if (data.servers && data.servers.length > 0) {
          setServers(data.servers);
          setSelectedServerIdx(0);
        } else {
          // Fallback to raw watchUrl
          setServers([{ name: "سيرفر رئيسي", url: watchUrl || "" }]);
        }
      } catch (err) {
        console.error("Failed to load clean embed servers:", err);
        // Fallback to raw watchUrl on any error
        setServers([{ name: "سيرفر رئيسي (احتياطي)", url: watchUrl || "" }]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEmbedServers();
  }, [watchUrl]);

  if (!series || !watchUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-[#050505]">
        <h2>المحتوى غير موجود</h2>
      </div>
    );
  }

  const activeServerUrl = servers[selectedServerIdx]?.url || watchUrl;

  // Proxy third-party player embeds to bypass Referer anti-embed blocks
  const getIframeSrc = (url: string) => {
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      return `/api/proxy-embed?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const episodes = series.seasons?.[0]?.episodes || [];
  
  // Find current active episode based on the query parameter `url`
  const activeEpisode = useMemo(() => {
    return episodes.find(e => e.url && (e.url.includes(watchUrl || "") || (watchUrl || "").includes(e.url))) || episodes[0];
  }, [episodes, watchUrl]);

  const filteredEpisodes = useMemo(() => {
    let list = [...episodes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.subtitle?.toLowerCase().includes(q));
    }
    if (sortOrder === 'desc') {
      list.reverse();
    }
    return list;
  }, [episodes, searchQuery, sortOrder]);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col text-right" dir="rtl">
      {/* Header */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
            <span className="font-bold">عودة</span>
          </button>
          <h1 className="text-xl font-bold text-white truncate">مشاهدة: {series.title}</h1>
        </div>

        {/* Server Selector Tab */}
        {!isLoading && servers.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 bg-black p-1.5 rounded-xl border border-zinc-900">
            <span className="text-xs text-zinc-500 px-2 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              اختر السيرفر:
            </span>
            {servers.map((server, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedServerIdx(idx)}
                className={`px-3 py-1.5 text-sm rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  selectedServerIdx === idx
                    ? "bg-[#e50914] text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Play className={`w-3 h-3 ${selectedServerIdx === idx ? "fill-white" : ""}`} />
                {server.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Video Player Main Canvas */}
        <div className="w-full bg-black relative flex items-center justify-center border-b border-zinc-900 shadow-2xl aspect-video max-h-[70vh]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 text-center p-6 animate-pulse">
              <Loader2 className="w-12 h-12 text-[#e50914] animate-spin" />
              <h3 className="text-lg font-bold text-white">جاري تجهيز السيرفرات السريعة...</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                نقوم حالياً بتصفية الإعلانات المزعجة والنوافذ المنبثقة لتوفير أفضل تجربة مشاهدة مباشرة وسلسة.
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 w-full h-full">
              <iframe
                src={getIframeSrc(activeServerUrl)}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen"
              ></iframe>
            </div>
          )}
        </div>

        {/* Tips & Instructions Info Bar */}
        {!isLoading && (
          <div className="max-w-5xl mx-auto mt-4 px-4">
            <div className="p-3 bg-[#111] border border-zinc-800/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#e50914]" />
                <span>في حال عدم عمل السيرفر، يرجى التبديل لسيرفر آخر من شريط السيرفرات بالأعلى.</span>
              </div>
              <div className="font-mono text-[10px] text-zinc-600 truncate max-w-xs sm:max-w-md bg-black/40 px-2.5 py-1 rounded-md" dir="ltr">
                Source: {activeServerUrl}
              </div>
            </div>
          </div>
        )}

        {/* Series Details and Info Block */}
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="text-center mt-8">
            <span className="bg-red-950/40 border border-red-500/20 text-red-500 font-bold px-4 py-1 text-xs uppercase tracking-wider rounded-full">
              NOW PLAYING
            </span>
          </div>

          <h1 className="text-center text-3xl md:text-4xl font-extrabold text-white mt-3">
            {series.title}
          </h1>

          {/* Servers Selection list inside details exactly like design */}
          <div className="max-w-xl mx-auto mt-6 bg-[#0c0c0c] border border-zinc-900 rounded-2xl p-4 text-center">
            <span className="text-xs text-zinc-400 font-bold flex items-center justify-center gap-1.5 mb-3">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
              سيرفرات المشاهدة المتوفرة:
            </span>
            <div className="flex flex-wrap gap-2 justify-center">
              {servers.map((server, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedServerIdx(idx)}
                  className={`px-4 py-2 text-xs rounded-xl font-bold transition-all border ${
                    selectedServerIdx === idx
                      ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25 scale-105"
                      : "bg-[#141414] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                  }`}
                >
                  {server.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description & Metadata */}
          <div className="max-w-3xl mx-auto mt-6 text-center space-y-4">
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              {series.description}
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-zinc-500">
              <span className="text-yellow-500 border border-yellow-500/30 bg-yellow-500/5 px-2 py-0.5 rounded">
                TMDB {series.rating || series.imdb || "8.1"}
              </span>
              <span>•</span>
              <span>{series.year || "2025"}</span>
              <span>•</span>
              <span>{series.category || "دراما"}</span>
            </div>
            {activeEpisode && (
              <div className="text-red-500 font-bold text-sm mt-2 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                <span>{activeEpisode.title} - {series.title}</span>
              </div>
            )}
          </div>

          {/* Social Channels List exactly like design */}
          <div className="max-w-4xl mx-auto mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* WhatsApp */}
            <a href="https://whatsapp.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-[#081a10] border border-emerald-950/60 hover:bg-[#0d2618] transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-5 h-5 fill-emerald-500/10" />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs text-zinc-200">الواتساب</h4>
                  <p className="text-[10px] text-emerald-500/80 font-bold">تابع قناتنا في واتساب</p>
                </div>
              </div>
            </a>

            {/* TikTok */}
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-[#05181f] border border-cyan-950/60 hover:bg-[#082733] transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs text-zinc-200">تيك توك</h4>
                  <p className="text-[10px] text-cyan-400/80 font-bold">تابع حسابنا في تيك توك</p>
                </div>
              </div>
            </a>

            {/* Telegram */}
            <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-[#0a1524] border border-blue-950/60 hover:bg-[#0f233d] transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs text-zinc-200">التلجرام</h4>
                  <p className="text-[10px] text-blue-400/80 font-bold">نقاشات وحصريات</p>
                </div>
              </div>
            </a>

            {/* Instagram */}
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-[#1f0913] border border-pink-950/60 hover:bg-[#300d1e] transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Instagram className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs text-zinc-200">الإنستغرام</h4>
                  <p className="text-[10px] text-pink-400/80 font-bold">تابع حسابنا في إنستغرام</p>
                </div>
              </div>
            </a>
          </div>

          {/* Live Chat Section Dropdown */}
          <div className="max-w-4xl mx-auto mt-6">
            <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-[#070707]">
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full flex items-center justify-between p-4 text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-600/10 flex items-center justify-center text-red-500">
                    <MessageSquare className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm block text-zinc-200">دردشة الحلقة المباشرة 🔥</span>
                    <span className="text-[11px] text-zinc-500 block">تواصل ونقاش مع المجتمع حول هذه الحلقة</span>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform duration-300 ${showChat ? "rotate-180" : ""}`} />
              </button>
              
              {showChat && (
                <div className="border-t border-zinc-900 h-[400px]">
                  <Chat seriesId={series.id} />
                </div>
              )}
            </div>
          </div>

          {/* Episodes List Section exact design matching the screenshot */}
          <div className="max-w-4xl mx-auto mt-12 bg-[#090909]/60 border border-zinc-900/80 rounded-2xl p-6 shadow-xl">
            {/* Header: قائمة الحلقات with red vertical tag */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5 border-r-4 border-red-600 pr-3">
                <h2 className="text-lg md:text-xl font-extrabold text-white">قائمة الحلقات</h2>
              </div>
            </div>

            {/* Filters Bar: search input and sort selection button */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-black/60 border border-zinc-900 rounded-2xl p-4 mb-6">
              {/* Left filter */}
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="w-full sm:w-auto bg-[#121212] border border-zinc-800 text-zinc-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 justify-center hover:text-white hover:border-zinc-700 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{sortOrder === "asc" ? "من الأقدم" : "من الأحدث"}</span>
              </button>

              {/* Right search bar */}
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="ابحث برقم الحلقة أو العنوان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121212] border border-zinc-800 rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-red-600 transition-colors text-right"
                  dir="rtl"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Grid of cards exactly matching design */}
            {filteredEpisodes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filteredEpisodes.map((episode) => {
                  const isCurrent = activeEpisode && activeEpisode.id === episode.id;
                  
                  return (
                    <Link
                      to={`/series/${series.id}/play?url=${encodeURIComponent(episode.url || "")}`}
                      key={episode.id}
                      className="group block bg-[#0c0c0c] border border-zinc-900 rounded-2xl p-2.5 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all shadow-lg text-right"
                    >
                      {/* Image Thumbnail Container */}
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-900 shadow-inner">
                        <img
                          src={episode.thumbnail || series.heroImage}
                          alt={episode.title}
                          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Overlay elements */}
                        {isCurrent ? (
                          <>
                            {/* Green top badge */}
                            <span className="absolute top-2.5 right-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-lg backdrop-blur-sm">
                              مكتمل
                            </span>
                            {/* Centered red Play button */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/40">
                                <Play className="w-4 h-4 fill-white text-white pl-0.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Hover overlay for normal cards */
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white backdrop-blur-sm">
                              <Play className="w-4 h-4 fill-white text-white pl-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Text details beneath image exactly like design */}
                      <div className="px-1.5 pb-1">
                        <h4 className={`text-right font-bold text-xs mt-3 line-clamp-1 transition-colors ${isCurrent ? "text-red-500" : "text-zinc-200 group-hover:text-red-500"}`}>
                          {episode.title} - {series.title}
                        </h4>
                        
                        <div className="flex items-center justify-end gap-1.5 mt-1.5">
                          {isCurrent ? (
                            <div className="flex items-center gap-1 text-[10px] text-red-500/90 font-bold">
                              <span>تشغيل الآن</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                              <span>مفتوح للمشاهدة</span>
                              <Eye className="w-3 h-3 text-zinc-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500 text-xs font-bold bg-black/20 rounded-2xl border border-zinc-900/60">
                لا توجد حلقات تطابق بحثك حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

