import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowRight, Play, Maximize, Settings, Volume2, ChevronDown, Download } from "lucide-react";
import { seriesData } from "../lib/data";
import Chat from "../components/Chat";
import { useState } from "react";

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const series = seriesData.find((s) => s.id === id);
  const [activeTab, setActiveTab] = useState<'episodes' | 'chat'>('episodes');

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <h2>المسلسل غير موجود</h2>
      </div>
    );
  }

  const episodes = series.seasons?.[0]?.episodes || [];

  return (
    <div className="min-h-screen bg-[#050505] pt-24 px-4 md:px-8 pb-8 flex flex-col lg:flex-row gap-8 max-w-[1920px] mx-auto">
      
      {/* Main Content (Player & Details) */}
      <div className="flex-1 flex flex-col gap-8 min-w-0">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit bg-[#111] px-4 py-2 rounded-full border border-zinc-800"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-bold">عودة</span>
        </button>

        {/* Cinematic Player Placeholder */}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative group shadow-2xl border border-zinc-800">
          <img 
            src={series.heroImage} 
            alt={series.title} 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button className="bg-red-600/90 text-white p-6 rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-xl shadow-red-600/30">
              <Play className="w-10 h-10 pl-2" fill="currentColor" />
            </button>
          </div>

          {/* Player Controls (Decorative) */}
          <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
            <div className="flex items-center gap-6 text-white w-full max-w-2xl">
              <Play className="w-7 h-7 cursor-pointer hover:text-red-500 transition-colors" fill="currentColor" />
              <Volume2 className="w-7 h-7 cursor-pointer hover:text-red-500 transition-colors" />
              <div className="flex-1 h-1.5 bg-zinc-600 rounded-full cursor-pointer relative group/bar">
                <div className="absolute top-0 left-0 h-full bg-red-600 w-1/3 rounded-full relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity shadow-lg scale-110 -translate-x-2"></div>
                </div>
              </div>
              <span className="text-sm font-mono font-bold">14:23 / 45:00</span>
            </div>
            <div className="flex items-center gap-6 text-white ml-6">
              <Settings className="w-7 h-7 cursor-pointer hover:text-red-500 transition-colors" />
              <Maximize className="w-7 h-7 cursor-pointer hover:text-red-500 transition-colors" />
            </div>
          </div>
        </div>

        {/* Series Details */}
        <div className="text-white space-y-4">
          <h1 className="text-3xl md:text-5xl font-black">{series.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400 font-bold">
            <span className="text-red-500 border border-red-500/30 bg-red-500/10 px-2.5 py-1 rounded-md">{series.rating || series.imdb} ★</span>
            <span>{series.year}</span>
            <span className="border border-zinc-600 px-2.5 py-1 rounded-md bg-zinc-800/50">HD</span>
            <span>{series.category}</span>
          </div>
          <p className="text-lg text-gray-300 leading-relaxed max-w-4xl bg-[#111] p-6 rounded-2xl border border-zinc-800 shadow-lg">
            {series.description}
          </p>
        </div>
      </div>

      {/* Right Sidebar (Tabs: Episodes / Chat) */}
      <div className="lg:w-[400px] xl:w-[450px] flex-shrink-0 flex flex-col bg-[#111] rounded-2xl border border-zinc-800 shadow-xl overflow-hidden h-[800px] lg:h-[calc(100vh-8rem)] sticky top-24">
        
        {/* Tabs Header */}
        <div className="flex items-center border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('episodes')}
            className={`flex-1 py-4 text-center font-bold text-lg transition-colors border-b-2 ${activeTab === 'episodes' ? 'border-red-600 text-white bg-zinc-900/50' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-zinc-900/20'}`}
          >
            الحلقات
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-4 text-center font-bold text-lg transition-colors border-b-2 ${activeTab === 'chat' ? 'border-red-600 text-white bg-zinc-900/50' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-zinc-900/20'}`}
          >
            الدردشة الحية
          </button>
        </div>

        {/* Tabs Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* Episodes Tab */}
          {activeTab === 'episodes' && (
            <div className="absolute inset-0 flex flex-col p-6">
              <div className="relative mb-6">
                <select className="w-full bg-[#1a1a1a] border border-zinc-700 text-white rounded-xl px-4 py-3.5 appearance-none cursor-pointer outline-none focus:border-zinc-500 font-bold shadow-sm">
                  <option>الموسم الأول</option>
                  {series.seasonsCount && series.seasonsCount > 1 && <option>الموسم الثاني</option>}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-4">
                {episodes.length > 0 ? episodes.map((episode) => (
                  <Link to={`/series/${series.id}/play?url=${encodeURIComponent(episode.url || '')}`} key={episode.id} className="w-full flex items-center gap-4 group p-3 hover:bg-zinc-800/80 rounded-xl transition-all border border-transparent hover:border-zinc-700 text-right">
                    <div className="relative w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900 shadow-md">
                      <img src={episode.thumbnail || series.heroImage} alt={episode.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform duration-300 drop-shadow-md" fill="currentColor" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-base truncate mb-1 group-hover:text-red-400 transition-colors">{episode.title}</h4>
                      <p className="text-gray-400 text-xs truncate mb-2">{episode.subtitle || "دراما • إثارة"}</p>
                      <span className="text-xs font-bold text-gray-500 bg-zinc-900 px-2 py-1 rounded-md">{episode.duration || "45m"}</span>
                    </div>
                    <div className="p-2 text-gray-600 hover:text-white transition-colors">
                      <Download className="w-5 h-5" />
                    </div>
                  </Link>
                )) : (
                  <div className="text-center text-gray-500 py-10">
                    لا توجد حلقات متاحة حالياً
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="absolute inset-0">
              <Chat seriesId={series.id} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
