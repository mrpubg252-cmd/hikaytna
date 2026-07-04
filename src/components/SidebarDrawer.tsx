import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Clock, Trash2, Play, Flame, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, triggerAdFlow } from '../lib/utils';

export default function SidebarDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const navigate = useNavigate();

  // Load data from localStorage
  const loadData = () => {
    try {
      const hist = JSON.parse(localStorage.getItem('watch_history') || '[]');
      const favs = JSON.parse(localStorage.getItem('favorites_series') || '[]');
      setHistory(hist);
      setFavorites(favs);
    } catch (e) {
      console.error("Error loading localStorage items inside sidebar:", e);
    }
  };

  useEffect(() => {
    loadData();

    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleUpdate = () => loadData();

    window.addEventListener('toggle_sidebar_drawer', handleToggle);
    window.addEventListener('watch_history_updated', handleUpdate);
    window.addEventListener('favorites_updated', handleUpdate);

    return () => {
      window.removeEventListener('toggle_sidebar_drawer', handleToggle);
      window.removeEventListener('watch_history_updated', handleUpdate);
      window.removeEventListener('favorites_updated', handleUpdate);
    };
  }, []);

  const removeFavorite = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = favorites.filter((fav) => fav.slug !== slug);
      localStorage.setItem('favorites_series', JSON.stringify(updated));
      setFavorites(updated);
      // Dispatch update to let Watch.tsx know if it's currently showing
      window.dispatchEvent(new Event('favorites_updated'));
    } catch (err) {
      console.error(err);
    }
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem('watch_history');
      setHistory([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = (path: string) => {
    setIsOpen(false);
    triggerAdFlow(path, navigate);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] cursor-pointer"
          />

          {/* Drawer Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 right-0 w-full max-w-[420px] bg-[#0c0c0e] border-l border-white/10 shadow-2xl z-[110] flex flex-col text-white"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-[#b72424]" />
                <span className="font-black text-lg">لوحة التحكم الجانبية</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white text-gray-400 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              
              {/* Favorites Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <h3 className="font-black text-sm">مسلسلاتي المفضلة</h3>
                  </div>
                  <span className="text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">
                    {favorites.length}
                  </span>
                </div>

                {favorites.length === 0 ? (
                  <div className="py-8 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-500">
                    <Heart className="w-8 h-8 text-zinc-700 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold">لم تقم بإضافة أي مسلسلات للمفضلة</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">افتح أي مسلسل واضغط على زر المفضلة للحفظ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {favorites.map((fav) => (
                      <div
                        key={fav.slug}
                        onClick={() => handleItemClick(`/series/${fav.slug}`)}
                        className="flex items-center gap-3 p-2 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-[#b72424]/30 rounded-xl transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-black shadow-md ring-1 ring-white/10">
                          <img
                            src={fav.img}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            alt={fav.title}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black truncate text-zinc-100 group-hover:text-white transition-colors">
                            {fav.title}
                          </h4>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">مسلسل مترجم حصري</span>
                        </div>
                        <button
                          onClick={(e) => removeFavorite(fav.slug, e)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-400 transition-all z-10 mr-1 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Watch History Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-black text-sm">سجل المشاهدة المؤخرة</h3>
                  </div>
                  {history.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="text-[10px] text-zinc-400 hover:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      مسح السجل
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="py-8 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-500">
                    <Clock className="w-8 h-8 text-zinc-700 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold">سجل المشاهدة فارغ</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">الحلقات التي تتابعها ستظهر هنا لمتابعة مشاهدتها</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {history.map((item) => (
                      <div
                        key={item.slug}
                        onClick={() => handleItemClick(`/watch/${item.slug}`)}
                        className="flex gap-3 p-2 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-emerald-500/20 rounded-xl transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-black shadow-md ring-1 ring-white/10 relative">
                          <img
                            src={item.img}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                            alt={item.title}
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play size={10} fill="white" className="text-white" />
                          </div>
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            <h4 className="text-xs font-black truncate text-zinc-100 group-hover:text-emerald-400 transition-colors">
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{item.seriesTitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Sticky Promo Footer */}
            <div className="p-4 bg-zinc-950 border-t border-white/10 text-center select-none">
              <div className="bg-gradient-to-r from-[#b72424]/10 to-transparent p-3 rounded-xl border border-[#b72424]/20 flex items-center gap-3 text-right">
                <div className="p-2 bg-[#b72424] rounded-lg shrink-0">
                  <Flame size={16} className="text-white fill-white animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-zinc-100">بث عالي الدقة بدون حدود</h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">شكراً لاختيارك شبكة حكايتنا لمشاهدة مسلسلاتك المفضلة.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
