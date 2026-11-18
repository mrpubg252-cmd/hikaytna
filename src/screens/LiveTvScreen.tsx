import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Volume2, VolumeX, Maximize2, Tv, Search, Shield, Activity, Sparkles, ArrowLeft, RefreshCw, Info, Heart, Languages } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import CustomPlayer from '../components/CustomPlayer';

interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  streamUrl: string;
  isIframe?: boolean;
  desc?: string;
  isPopular?: boolean;
  country?: string;
  flag?: string;
  network: string; // Grouping Network (e.g. "قنوات MBC بث مباشر", etc.)
}

export default function LiveTvScreen() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [selectedCountry, setSelectedCountry] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playerSectionRef = useRef<HTMLDivElement>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('live_channels_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Fetch IPTV Channels from backend parser
  useEffect(() => {
    let active = true;
    const loadChannels = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/iptv/channels");
        const json = await res.json();
        if (active) {
          if (json.status && Array.isArray(json.data)) {
            setChannels(json.data);
            if (json.data.length > 0) {
              setSelectedChannel(json.data[0]);
            }
          } else {
            setError("عذراً، فشل جلب قائمة القنوات.");
          }
        }
      } catch (err) {
        if (active) {
          setError("حدث خطأ أثناء الاتصال بالخادم.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadChannels();
    return () => {
      active = false;
    };
  }, []);

  // Compute countries list dynamically based on loaded channels
  const COUNTRIES = useMemo(() => {
    const uniqueMap = new Map<string, string>();
    channels.forEach(c => {
      if (c.country && c.country !== "متنوع") {
        uniqueMap.set(c.country, c.flag || "🌍");
      }
    });
    const list = Array.from(uniqueMap.entries()).map(([name, flag]) => ({ name, flag }));
    return [{ name: 'الكل', flag: '🌍' }, ...list];
  }, [channels]);

  // Compute categories list dynamically based on loaded channels
  const CATEGORIES = useMemo(() => {
    const cats = new Set<string>();
    channels.forEach(c => {
      if (c.category) cats.add(c.category);
    });
    return ["الكل", ...Array.from(cats)];
  }, [channels]);

  // Toggle favorite channel
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const updated = prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id];
      localStorage.setItem('live_channels_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  // Filter channels based on search, category, and selected country
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesCategory = activeCategory === "الكل" || channel.category === activeCategory;
      const matchesCountry = selectedCountry === "الكل" || channel.country === selectedCountry;
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (channel.desc && channel.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (channel.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (channel.country && channel.country.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesCountry && matchesSearch;
    });
  }, [channels, activeCategory, selectedCountry, searchQuery]);

  // Group channels by their network category
  const groupedChannels = useMemo(() => {
    const groups: { [key: string]: Channel[] } = {};
    filteredChannels.forEach(channel => {
      const net = channel.network || "قنوات متنوعة بث مباشر";
      if (!groups[net]) {
        groups[net] = [];
      }
      groups[net].push(channel);
    });
    return groups;
  }, [filteredChannels]);

  // Map filteredChannels to expected Episode format for CustomPlayer
  const mappedEpisodes = useMemo(() => {
    return filteredChannels.map(channel => ({
      title: channel.name,
      link1: channel.streamUrl,
      image: channel.logo,
    }));
  }, [filteredChannels]);

  const currentEpisodeIndex = useMemo(() => {
    if (!selectedChannel) return 0;
    const idx = filteredChannels.findIndex(c => c.id === selectedChannel.id);
    return idx === -1 ? 0 : idx;
  }, [filteredChannels, selectedChannel]);

  // Select a channel and scroll smoothly up to the player
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center font-sans space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
          <Tv className="w-6 h-6 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm font-black text-zinc-400 animate-pulse">جاري جلب وتحديث قائمة القنوات السعودية والتركية...</p>
      </div>
    );
  }

  if (error || channels.length === 0 || !selectedChannel) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center font-sans space-y-4 p-6 text-center">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-xl font-black text-zinc-200">فشل تحميل البث المباشر</h2>
        <p className="text-xs text-zinc-500 max-w-md">حدث خطأ أثناء تحميل باقات IPTV أو أن الرابط غير متاح حالياً.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-red-650 hover:bg-red-700 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer"
        >
          إعادة المحاولة 🔄
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans relative pb-32">
      {/* Premium Header */}
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* Title Spotlight Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-wider animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-red-650" />
              <span>البث التلفزيوني المباشر الفوري</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              تلفاز السعودية وتركيا المباشر 🇸🇦 🇹🇷
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-bold">
              البث الحي الحصري للقنوات السعودية والتركية مع الترجمة الاحترافية الفورية بالذكاء الاصطناعي.
            </p>
          </div>

          {/* Search bar inside view */}
          <div className="relative w-full md:max-w-xs group">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="ابحث عن قناة أو تصنيف..."
              className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-2.5 pr-11 pl-4 text-xs font-black text-right text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all placeholder-zinc-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Country Selection Section */}
        <div className="space-y-2.5 mb-6 bg-zinc-950/40 p-4 sm:p-5 rounded-3xl border border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-zinc-300 flex items-center gap-2">
              <span className="text-red-500 text-lg">🌍</span>
              <span>اختر الدولة:</span>
            </h3>
            {selectedCountry !== "الكل" && (
              <button 
                onClick={() => setSelectedCountry("الكل")}
                className="text-[10px] font-black text-red-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                إعادة ضبط الكل 🔄
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-none">
            {COUNTRIES.map(country => {
              const isSelected = selectedCountry === country.name;
              return (
                <button
                  key={country.name}
                  onClick={() => {
                    setSelectedCountry(country.name);
                    const countryChannels = channels.filter(
                      c => (country.name === "الكل" || c.country === country.name) &&
                           (activeCategory === "الكل" || c.category === activeCategory)
                    );
                    if (countryChannels.length > 0) {
                      setSelectedChannel(countryChannels[0]);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black shrink-0 transition-all border select-none cursor-pointer active:scale-95",
                    isSelected
                      ? "bg-red-650 text-white border-red-600/50 shadow-lg shadow-red-650/20 scale-105"
                      : "bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white"
                  )}
                >
                  <span className="text-base select-none">{country.flag}</span>
                  <span>{country.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="space-y-2 mb-6">
          <h3 className="text-xs font-black text-zinc-500 flex items-center gap-1.5 px-1">
            <span>🏷️ تصفية حسب التصنيف:</span>
          </h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  const catChannels = channels.filter(
                    c => (category === "الكل" || c.category === category) &&
                         (selectedCountry === "الكل" || c.country === selectedCountry)
                  );
                  if (catChannels.length > 0 && !catChannels.some(c => c.id === selectedChannel.id)) {
                    setSelectedChannel(catChannels[0]);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer border select-none",
                  activeCategory === category
                    ? "bg-red-650 text-white border-red-600/50 shadow-lg shadow-red-650/10 scale-105"
                    : "bg-zinc-950 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Video Player Dashboard (Full Width Cinema Mode) */}
        <div ref={playerSectionRef} className="space-y-4 mb-10 scroll-mt-20">
          <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden bg-zinc-950 border border-white/5 shadow-2xl group/player">
            <CustomPlayer
              videoUrl={selectedChannel.streamUrl}
              seriesId="live_tv_channels"
              seriesImage={selectedChannel.logo}
              episodeIndex={currentEpisodeIndex}
              episodes={mappedEpisodes}
              servers={[]}
              onSelectEpisode={(ep, idx) => {
                const channel = filteredChannels[idx];
                if (channel) {
                  setSelectedChannel(channel);
                }
              }}
              onSelectServer={() => {}}
              isMaximized={false}
              onToggleMaximize={() => {}}
              seriesTitle={selectedChannel.name}
              isLiveTv={true}
              channelCountry={selectedChannel.country}
              channelCategory={selectedChannel.category}
              channelName={selectedChannel.name}
            />
          </div>

          {/* Channel Details */}
          <div className="grid grid-cols-1 gap-5">
            {/* Metadata & Details */}
            <div className="bg-zinc-950 border border-white/5 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <span className="w-16 h-16 sm:w-20 sm:h-20 p-2 bg-zinc-900/60 rounded-2xl border border-white/5 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                      <img 
                        referrerPolicy="no-referrer" 
                        src={selectedChannel.logo} 
                        className="w-full h-full object-contain" 
                        alt={selectedChannel.name} 
                      />
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                          {selectedChannel.name}
                        </h2>
                        {selectedChannel.isPopular && (
                          <span className="bg-amber-500/10 text-amber-500 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-0.5 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                            مميز
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 font-bold flex items-center gap-1.5">
                        <span>البلد/النوع:</span>
                        <span className="text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {selectedChannel.country || selectedChannel.category}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {selectedChannel.category}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Add to favorites */}
                  <button
                    onClick={(e) => toggleFavorite(selectedChannel.id, e)}
                    className={cn(
                      "p-3 rounded-2xl border transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-2 font-black text-xs select-none",
                      favorites.includes(selectedChannel.id)
                        ? "bg-red-650/10 border-red-500/20 text-red-500"
                        : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", favorites.includes(selectedChannel.id) && "fill-current")} />
                    <span className="hidden sm:inline">أضف للمفضلة</span>
                  </button>
                </div>

                {selectedChannel.desc && (
                  <div className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-bold border-t border-white/5 pt-3">
                    {selectedChannel.desc}
                  </div>
                )}
              </div>

              {/* Secure Notice */}
              <div className="bg-red-950/15 border border-red-500/10 rounded-2xl p-4 flex gap-3 text-right">
                <Shield className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-red-500">نظام بث تلفاز العرب الآمن 🛡️</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-bold">
                    البث المباشر يعمل ببروتوكولات التوزيع عالية السرعة وسيرفرات مخصصة تضمن استقرار كامل وبدون إعلانات منبثقة مزعجة.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Channel Networks Grid (EXACTLY MATCHING USER SCREENSHOT DESIGN) */}
        <div className="space-y-12">
          {Object.entries(groupedChannels).length === 0 ? (
            <div className="text-center py-20 bg-zinc-950/20 border border-white/5 rounded-3xl space-y-3">
              <span className="text-5xl">📡</span>
              <h3 className="text-base font-black text-zinc-400">لا توجد قنوات مطابقة لبحثك</h3>
              <p className="text-xs text-zinc-600 font-bold">يرجى تجربة كلمة بحث أخرى أو اختيار دولة مختلفة</p>
            </div>
          ) : (
            (Object.entries(groupedChannels) as [string, Channel[]][]).map(([networkName, networkChannels]) => (
              <div key={networkName} className="space-y-4">
                {/* Network Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-650 shrink-0" />
                    <h2 className="text-base sm:text-lg font-black text-zinc-100">{networkName}</h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-bold">({networkChannels.length} قناة)</span>
                </div>

                {/* Grid of Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {networkChannels.map(channel => {
                    const isSelected = selectedChannel.id === channel.id;
                    const isFav = favorites.includes(channel.id);
                    return (
                      <div
                        key={channel.id}
                        onClick={() => handleSelectChannel(channel)}
                        className={cn(
                          "bg-zinc-900/60 border rounded-3xl p-4 flex flex-col items-center justify-between hover:border-red-500/20 transition-all aspect-[4/5] hover:-translate-y-1 shadow-md shadow-black/40 group relative overflow-hidden select-none cursor-pointer active:scale-95",
                          isSelected
                            ? "border-red-500/60 bg-red-950/5 shadow-lg shadow-red-650/5 scale-102"
                            : "border-white/5 hover:bg-zinc-900/90"
                        )}
                      >
                        {/* Live Indicator on selected */}
                        {isSelected && (
                          <span className="absolute top-3.5 right-3.5 bg-red-600 w-2.5 h-2.5 rounded-full animate-pulse shadow-md shadow-red-650/40 z-20" />
                        )}

                        {/* Favorite Button on Card */}
                        <button
                          onClick={(e) => toggleFavorite(channel.id, e)}
                          className={cn(
                            "absolute top-2 left-2 p-1.5 rounded-full bg-black/40 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-black/60 transition-all shrink-0 cursor-pointer active:scale-90 z-20 opacity-0 group-hover:opacity-100",
                            isFav && "opacity-100 text-red-500 bg-red-950/20 border-red-500/10"
                          )}
                        >
                          <Heart className={cn("w-3 h-3", isFav && "fill-current")} />
                        </button>

                        {/* Logo Wrapper */}
                        <div className="w-full aspect-square bg-zinc-950/60 rounded-2xl p-3.5 border border-white/5 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 mb-3 shadow-inner">
                          <img 
                            referrerPolicy="no-referrer" 
                            src={channel.logo} 
                            className="w-full h-full object-contain pointer-events-none" 
                            alt={channel.name} 
                          />
                        </div>

                        {/* Labels */}
                        <div className="w-full text-center space-y-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-zinc-100 leading-snug group-hover:text-white transition-colors truncate w-full">
                            {channel.name}
                          </h4>
                          <p className="text-[10px] text-zinc-500 font-bold truncate w-full">
                            {channel.country} • {channel.category}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer & Bottom Navigation */}
      <Footer />
      <BottomNav />
    </div>
  );
}
