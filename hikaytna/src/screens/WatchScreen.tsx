import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Share2, Heart, History, MessageSquare, X, ChevronDown, ChevronUp } from 'lucide-react';
import EpisodeGrid from '../components/EpisodeGrid';
import CustomPlayer from '../components/CustomPlayer';
import Header from '../components/Header';
import { fetchEpisodesFromAPI, fetchPlayUrlFromAPI } from '../services/api';
import { Episode, Series } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { progressService } from '../services/progressService';
import SeriesChat from '../components/SeriesChat';

export default function WatchScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { series } = (location.state as { series: Series }) || {};
  
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [activeServerUrl, setActiveServerUrl] = useState('');
  const [servers, setServers] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  
  const playerRef = useRef<HTMLDivElement>(null);
  const playerControlRef = useRef<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const resolvedUrlsCache = useRef<Record<string, string>>({});

  // Always scroll to the absolute top of the page immediately on mount and whenever the series changes
  useEffect(() => {
    window.scrollTo(0, 0);

    const handleScrollTop = () => {
      window.scrollTo({ top: 0, behavior: 'instant' as any });
    };
    
    // Multiple visual frame checks for mobile and slow networks
    handleScrollTop();
    const timer1 = setTimeout(handleScrollTop, 50);
    const timer2 = setTimeout(handleScrollTop, 150);
    const timer3 = setTimeout(handleScrollTop, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [series?.id]);

  // Esc key to exit maximized viewport mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // iOS Visual Viewport fix for Drawer
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        if (isChatOpen || isMaximized) {
          // window.scrollTo(0, 0); // Removed to prevent forced scrolling during keyboard focus
        }
      }
    };

    if (window.visualViewport) {
      handleResize();
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [isChatOpen, isMaximized]);

  // Prevent background body scrolling when viewing in immersive maximized mode
  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100vw';
      document.body.style.height = '100dvh';
      document.body.style.top = '0';
      document.body.style.left = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    };
  }, [isMaximized]);

  useEffect(() => {
    if (!series) {
      navigate('/');
      return;
    }
    // Deeply reset states to guarantee instant transition for new series from the AI drawer
    setEpisodes([]);
    setCurrentEpisode(0);
    setVideoUrl('');
    setServers([]);
    setLoading(true);
    resolvedUrlsCache.current = {}; // Clean up memory cache for the new series!
    
    loadEpisodes();
  }, [series?.id]);

  // High-performance background prefetching of future episodes (perfect for weak connection & buttery smooth flow)
  useEffect(() => {
    if (episodes.length === 0) return;

    const prefetchCount = 3; // Prefetch the next 3 episodes
    const startIdx = currentEpisode + 1;
    const endIdx = Math.min(startIdx + prefetchCount, episodes.length);

    const prefetchNextEpisodes = async () => {
      for (let i = startIdx; i < endIdx; i++) {
        const ep = episodes[i];
        const rawUrl = ep.link1 || ep.url;
        if (rawUrl && !resolvedUrlsCache.current[rawUrl]) {
          try {
            const lowerUrl = rawUrl.toLowerCase();
            const isDirect = lowerUrl.includes('.mp4') || lowerUrl.includes('.m3u8') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg') || lowerUrl.includes('.jpg') || lowerUrl.includes('.png');
            
            if (isDirect) {
              resolvedUrlsCache.current[rawUrl] = rawUrl;
            } else {
              // Soft prefetch in the background quietly without blocking any execution
              fetchPlayUrlFromAPI(rawUrl).then(playUrl => {
                if (playUrl) {
                  resolvedUrlsCache.current[rawUrl] = playUrl;
                }
              }).catch(() => {});
            }
          } catch (e) {
            // Ignore prefetch failures
          }
        }
      }
    };

    const prefetchTimer = setTimeout(prefetchNextEpisodes, 2500);
    return () => clearTimeout(prefetchTimer);
  }, [currentEpisode, episodes]);
  
  async function loadEpisodes() {
    let eps: Episode[] = [];
    
    if (series.url) {
      eps = await fetchEpisodesFromAPI(series.url);
    }
    
    if (eps.length === 0 && series.episodes) {
      eps = Array.isArray(series.episodes) 
        ? series.episodes 
        : Object.values(series.episodes);
    }
    
    // Filter duplicates if not "حلم اشرف" or "ليلى_مدبلج"
    let finalEps = eps;
    if (series.title !== "حلم اشرف" && series.title !== "ليلى_مدبلج") {
      const uniqueEps: Episode[] = [];
      const seenEpisodes = new Set();
      for (const ep of eps) {
        const key = `${ep.title}-${ep.link1 || ep.url}`;
        if (!seenEpisodes.has(key)) {
          uniqueEps.push(ep);
          seenEpisodes.add(key);
        }
      }
      finalEps = uniqueEps;
    }
    
    // Sort episodes numerically based on title, handling special keywords
    finalEps.sort((a, b) => {
      const getOrder = (title: string) => {
        const cleanTitle = title.toLowerCase();
        if (cleanTitle.includes('الاخيرة') || cleanTitle.includes('الأخيرة') || cleanTitle.includes('last')) return 99999;
        
        // Extract the first number found in the title
        const match = title.match(/\d+/);
        if (match) return parseInt(match[0]);
        
        return 0;
      };
      
      const orderA = getOrder(a.title);
      const orderB = getOrder(b.title);
      
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
    
    setEpisodes(finalEps);
    if (finalEps.length > 0) {
      // Check last watched episode if any
      const savedIndex = localStorage.getItem(`mo_play_last_ep_${series.id}`);
      const indexToPlay = savedIndex ? parseInt(savedIndex) : 0;
      playEpisode(finalEps[indexToPlay] || finalEps[0], indexToPlay, false);
    }
    setLoading(false);
  }
  
  async function getSecuredUrl(rawUrl: string) {
    if (!rawUrl) return '';
    if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be') || rawUrl.startsWith('/api/v1/')) {
      return rawUrl;
    }
    
    // Check local memory cache first for instant resolution with 0ms delay!
    if (resolvedUrlsCache.current[rawUrl]) {
      return resolvedUrlsCache.current[rawUrl];
    }
    
    const lowerUrl = rawUrl.toLowerCase();
    const isDirect = lowerUrl.includes('.mp4') || lowerUrl.includes('.m3u8') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg') || lowerUrl.includes('.jpg') || lowerUrl.includes('.png');

    if (isDirect) {
      resolvedUrlsCache.current[rawUrl] = rawUrl;
      return rawUrl;
    } else {
      // It's probably an iframe player that requires resolving
      const playUrl = await fetchPlayUrlFromAPI(rawUrl);
      const result = playUrl || rawUrl;
      resolvedUrlsCache.current[rawUrl] = result;
      return result;
    }
  }

  async function playEpisode(ep: Episode, index: number, autoScroll = true) {
    // Save progress of current episode
    if (episodes.length > 0) {
      progressService.markAsWatched(series.id, currentEpisode);
    }

    setCurrentEpisode(index);
    localStorage.setItem(`mo_play_last_ep_${series.id}`, index.toString());
    
    setVideoUrl(''); // Reset for loader
    
    let rawUrl = ep.link1 || ep.url;
    let url = await getSecuredUrl(rawUrl);
    
    setVideoUrl(url);
    setActiveServerUrl(rawUrl);
    
    // Setup servers
    const srv = [
      { name: 'سيرفر رئيسي', url: ep.link1 || ep.url },
      { name: 'سيرفر احتياطي 1', url: ep.link2 || '' },
      { name: 'سيرفر احتياطي 2', url: ep.link3 || '' },
    ].filter(s => s.url);
    
    setServers(srv);

    // Scroll to player
    if (autoScroll) {
      playerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function handleServerSelect(rawUrl: string) {
     setVideoUrl(''); // loader
     let url = await getSecuredUrl(rawUrl);
     setVideoUrl(url);
     setActiveServerUrl(rawUrl);
  }

  if (!series) return null;
  
  return (
    <div className="min-h-screen bg-[#050505] pb-20">
      <Header />
      
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        {/* Navigation Info */}
        <div className="w-full px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between text-gray-400 text-[10px] sm:text-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">الرئيسية</button>
            <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4 rotate-180" />
            <span className="text-white font-semibold truncate max-w-[120px] sm:max-w-none">{series.title}</span>
          </div>
        </div>

        {/* Professional Video Player Section */}
        {loading ? (
          <div className="w-full aspect-video flex items-center justify-center bg-black">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div 
            ref={playerRef}
            className={cn(
              "w-full transition-all duration-300",
              isMaximized 
                ? "fixed inset-0 w-full z-[100]" 
                : "relative mb-6 sm:mb-8"
            )}
          >
            <CustomPlayer
              ref={playerControlRef}
              videoUrl={videoUrl}
              activeServerUrl={activeServerUrl}
              seriesId={series.id}
              seriesImage={series.image}
              episodeIndex={currentEpisode}
              episodes={episodes}
              servers={servers}
              onSelectEpisode={(ep, idx) => playEpisode(ep, idx)}
              onSelectServer={handleServerSelect}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(!isMaximized)}
              onTimeUpdate={(t) => setPlayerTime(t)}
            />
          </div>
        )}



        <div className="w-full px-4 sm:px-8 flex flex-col lg:flex-row gap-8 sm:gap-12">
          {/* Main Content (Player + Info) */}
          <div className="flex-1 space-y-8 sm:space-y-12">
            {/* Info Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div>
                <motion.div 
                   initial={{ x: 20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   className="flex items-center gap-2 mb-2"
                >
                  <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black italic uppercase">Now Playing</span>
                </motion.div>
                <motion.h1 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl sm:text-5xl font-black-italic text-white"
                >
                  {series.title}
                </motion.h1>
                <p className="text-zinc-500 font-bold text-xs sm:text-sm mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {episodes[currentEpisode]?.title ? `الإطلالة: الحلقة ${episodes[currentEpisode].title}` : `الحلقة ${currentEpisode + 1}`}
                </p>
              </div>

              {/* Professional Chat Portal Trigger Card */}
              <div className="w-full lg:w-[420px] shrink-0 order-last lg:order-none">
                <div className="bg-[#121218] border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
                  {/* Collapsible header button */}
                  <button 
                    onClick={() => setIsChatExpanded(!isChatExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-900/80 hover:bg-zinc-800/90 border-b border-white/5 transition-all outline-none cursor-pointer group select-none text-right"
                  >
                    <div className="text-zinc-400 group-hover:text-white transition">
                      {isChatExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronUp className="w-4 h-4 text-zinc-500 animate-bounce" />}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col text-right">
                        <span className="text-[11px] font-black text-white">دردشة الحلقة المباشرة 🔥</span>
                        <span className="text-[9px] text-zinc-500 font-bold">تواصل ونقاش مع المجتمع حول هذه الحلقة</span>
                      </div>
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                  </button>

                  {isChatExpanded ? (
                    <div className="h-[400px] flex flex-col">
                      <SeriesChat 
                        seriesId={series.id} 
                        seriesTitle={series.title} 
                        seriesImage={series.image}
                        currentPlaybackTime={playerTime}
                        onSeekTo={(t) => {
                          playerControlRef.current?.seekTo(t);
                        }}
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsChatExpanded(true)}
                      className="p-5 text-center cursor-pointer hover:bg-zinc-900/40 transition duration-200 select-none group/tap"
                    >
                      <span className="text-[10px] font-black tracking-wider text-primary group-hover/tap:underline flex items-center justify-center gap-1.5 uppercase">
                        <span>اضغط لفتح شات النقاش والحماس</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Servers Section */}
            <section className="bg-zinc-900/30 px-5 py-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-1 h-4 bg-primary rounded-full animate-pulse" />
                <h2 className="text-xs sm:text-sm font-black text-zinc-400 font-sans">سيرفرات المشاهدة الإضافية:</h2>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-end">
                {servers.map((srv, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setVideoUrl(srv.url)} 
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm active:scale-95",
                      srv.url === videoUrl 
                        ? "bg-primary border-primary text-white font-extrabold shadow-primary/20" 
                        : "bg-zinc-800/40 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-white/20"
                    )}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Episodes Grid Section */}
            <section className="bg-zinc-900/30 p-5 sm:p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 sm:h-6 bg-primary rounded-full" />
                <h2 className="text-lg sm:text-xl font-black-italic italic uppercase tracking-tight">قائمة الحلقات</h2>
              </div>
              <EpisodeGrid 
                episodes={episodes}
                currentIndex={currentEpisode}
                seriesId={series.id}
                seriesImage={series.image}
                onSelect={(ep, idx) => playEpisode(ep, idx)}
              />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-96 flex flex-col gap-6">

            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 p-6 rounded-3xl border border-white/5">
               <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-3">
                 <History className="w-3 h-3" />
                 DETAILS
               </div>
               <div className="space-y-3">
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Category</span>
                    <span className="text-white uppercase tracking-tighter shrink-0">{series.category || 'GENERAL'}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Rating</span>
                    <span className="text-yellow-400 shrink-0">⭐ {series.rating} / 10</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase italic">Views</span>
                    <span className="text-white shrink-0">{series.views}</span>
                 </div>
               </div>
            </div>

          </aside>
        </div>
      </div>

      {/* Modern Slide-over Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] cursor-pointer"
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '-100%' }}
               animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 240 }}
              className="fixed top-0 left-0 w-full sm:max-w-md bg-[#0d0d12] border-r border-white/5 z-[160] shadow-2xl flex flex-col"
              style={{ height: viewportHeight }}
              dir="ltr"
            >
              <div className="flex-1 h-full" dir="rtl">
                <SeriesChat 
                  seriesId={series.id} 
                  seriesTitle={series.title} 
                  seriesImage={series.image}
                  currentPlaybackTime={playerTime}
                  onSeekTo={(t) => {
                    playerControlRef.current?.seekTo(t);
                  }}
                  onClose={() => setIsChatOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
