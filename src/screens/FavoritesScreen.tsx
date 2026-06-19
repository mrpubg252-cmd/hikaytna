import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import SeriesCard from '../components/SeriesCard';
import BottomNav from '../components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Search, Film } from 'lucide-react';
import { navigateToWatchOrAds } from '../utils/watchNavigation';

export default function FavoritesScreen() {
  const navigate = useNavigate();
  // Use a simulated local state for now or the same favorite logic as before
  const [favorites] = useState<any[]>([]); // This would normally come from a hook

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-24 sm:pt-32 pb-40">
        <div className="flex flex-col gap-2 mb-12">
          <div className="flex items-center gap-3 text-primary">
            <Heart className="w-5 h-5 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">مكتبتك الخاصة</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter">
            المفض<span className="text-primary truncate">لة.</span>
          </h1>
        </div>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
            {favorites.map((series) => (
              <SeriesCard 
                key={series.id} 
                item={series} 
                onPress={() => navigateToWatchOrAds(navigate, series)} 
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mb-8 border border-white/5">
              <Film className="w-10 h-10 text-zinc-600" />
            </div>
            <h2 className="text-2xl font-black italic mb-3">لا يوجد مسلسلات هنا بعد</h2>
            <p className="text-zinc-500 max-w-sm text-sm font-bold uppercase tracking-widest leading-relaxed">
              أضف مسلسلاتك المفضلة لتتمكن من الوصول إليها في أي وقت ومن أي مكان.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
