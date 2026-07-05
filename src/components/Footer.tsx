import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#1a1a1a] text-white border-t border-white/5 py-12 mt-12" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-right">
        <div>
          <Link to="/" className="flex items-center gap-2 mb-6">
            <img 
              src="/src/assets/images/app_logo_1783179325447.jpg" 
              alt="حكايتنا" 
              className="h-12 w-auto object-contain"
            />
          </Link>
          <p className="text-gray-400 leading-relaxed text-sm">
            موقع حكايتنا مسلسلات هو منصة احترافية لمشاهدة أحدث المسلسلات التركية المترجمة والمدبلجة، يتميز بتصميم عصري وسرعة في جلب المحتوى. استمتع بأفضل تجربة مشاهدة.
          </p>
        </div>

        <div>
          <h4 className="text-xl font-bold mb-6 border-r-4 border-[#b72424] pr-3">روابط سريعة</h4>
          <ul className="space-y-4 text-gray-400">
            <li><Link to="/series" className="hover:text-[#b72424] transition-colors">جميع المسلسلات</Link></li>
            <li><Link to="/episodes" className="hover:text-[#b72424] transition-colors">جميع الحلقات</Link></li>
            <li><Link to="/movies" className="hover:text-[#b72424] transition-colors">جميع الأفلام</Link></li>
            <li><Link to="/privacy" className="hover:text-[#b72424] transition-colors">سياسة الخصوصية</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xl font-bold mb-6 border-r-4 border-[#b72424] pr-3">اتصل بنا</h4>
          <p className="text-gray-400 text-sm mb-4">للمقترحات أو الإبلاغ عن مشاكل تقنية:</p>
          <a href="mailto:contact@hikaytna.my" className="text-[#b72424] font-bold hover:underline">contact@hikaytna.my</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
        <p>© 2026 حكايتنا مسلسلات. جميع الحقوق محفوظة.</p>
        <div className="flex items-center gap-1">
          صنع بكل <Heart size={14} className="text-[#b72424] fill-[#b72424]" /> لمحبين الدراما
        </div>
      </div>
    </footer>
  );
}
