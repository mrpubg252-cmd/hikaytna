import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Play, Server, AlertCircle, Loader2 } from "lucide-react";
import { seriesData } from "../lib/data";

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
    if (url && !url.includes("3iskk.xyz") && (url.startsWith("http://") || url.startsWith("https://"))) {
      return `/api/proxy-embed?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            <ArrowRight className="w-5 h-5" />
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

      {/* Video Player Main Canvas */}
      <div className="flex-1 w-full bg-black relative flex items-center justify-center">
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

      {/* Tips & Instructions Footer */}
      {!isLoading && (
        <div className="p-4 bg-[#111] border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#e50914]" />
            <span>في حال عدم عمل السيرفر، يرجى التبديل لسيرفر آخر من شريط السيرفرات بالأعلى.</span>
          </div>
          <div className="font-mono text-[10px] text-zinc-600 truncate max-w-xs sm:max-w-md bg-black/40 px-2.5 py-1 rounded-md" dir="ltr">
            Source: {activeServerUrl}
          </div>
        </div>
      )}
    </div>
  );
}
