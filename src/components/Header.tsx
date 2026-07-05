import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Menu, X, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?s=${searchQuery}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#b72424] text-white h-16 shadow-lg">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between" dir="rtl">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img 
            src="/src/assets/images/app_logo_1783179325447.jpg" 
            alt="حكايتنا" 
            className="h-10 md:h-12 w-auto object-contain"
          />
        </Link>

        {/* Nav Links - Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="hover:text-gray-200 transition-colors">الرئيسية</Link>
          <Link to="/series" className="hover:text-gray-200 transition-colors">جميع المسلسلات</Link>
          <Link to="/episodes" className="hover:text-gray-200 transition-colors">جميع الحلقات</Link>
          <Link to="/movies" className="hover:text-gray-200 transition-colors">جميع الأفلام</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-[#921e1e] rounded-full transition-colors"
          >
            <Search size={24} />
          </button>

          {/* Sidebar Drawer Toggle Action */}
          <button 
            onClick={() => window.dispatchEvent(new Event('toggle_sidebar_drawer'))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-[#921e1e] border border-white/10 rounded-xl transition-all font-black text-xs cursor-pointer shadow-md"
            title="مفضلتي وسجل المشاهدة"
          >
            <Heart size={14} className="text-white fill-white/80 animate-pulse" />
            <span className="text-zinc-100">مفضلتي وسجلي</span>
          </button>

          <button className="hidden sm:flex items-center gap-2 p-2 hover:bg-[#921e1e] rounded-lg transition-colors">
            <User size={20} />
            <span className="text-sm font-medium">دخول</span>
          </button>
          <button 
            onClick={() => window.dispatchEvent(new Event('toggle_sidebar_drawer'))}
            className="md:hidden p-2 hover:bg-[#921e1e] rounded-full"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          >
            <button 
              onClick={() => setIsSearchOpen(false)}
              className="absolute top-6 right-6 p-2 text-white hover:text-gray-300"
            >
              <X size={32} />
            </button>
            
            <form onSubmit={handleSearch} className="w-full max-w-4xl relative px-4">
              <div className="flex flex-col items-center gap-8">
                <div className="bg-[#b72424] p-6 rounded-full shadow-2xl shadow-[#b72424]/40">
                  <Search size={48} className="text-white" />
                </div>
                <div className="w-full relative">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="ابحث عن مسلسل أو حلقة..."
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl text-white text-2xl md:text-4xl py-6 px-8 outline-none placeholder:text-gray-600 focus:border-[#b72424] transition-all text-center"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <p className="text-gray-500 text-lg">اضغط Enter للبحث</p>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
