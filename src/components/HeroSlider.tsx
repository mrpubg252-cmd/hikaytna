import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Featured } from '../types';

interface HeroSliderProps {
  items: Featured[];
}

export default function HeroSlider({ items }: HeroSliderProps) {
  if (!items.length) return null;

  return (
    <div className="relative w-full h-[50vh] md:h-[75vh] overflow-hidden bg-black shadow-2xl">
      <Swiper
        dir="rtl"
        spaceBetween={0}
        centeredSlides={true}
        autoplay={{
          delay: 7000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="h-full w-full"
      >
        {items.map((item) => (
          <SwiperSlide key={item.slug}>
            <div className="relative w-full h-full">
              {/* Background Image */}
              <img 
                src={item.img} 
                alt={item.title}
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
              />
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/60 via-transparent to-transparent hidden md:block" />
              
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-24 text-center md:text-right">
                <div className="max-w-3xl md:w-full">
                  <h2 className="text-2xl md:text-7xl font-black text-white mb-4 md:mb-6 drop-shadow-2xl leading-tight">
                    {item.title}
                  </h2>
                  <p className="text-gray-300 mb-6 md:mb-10 text-sm md:text-xl hidden md:block leading-relaxed max-w-2xl border-r-4 border-[#b72424] pr-4">
                    مشاهدة المسلسل التركي {item.title} حصرياً ومترجم باحترافية على موقع حكايتنا. استمتع بتجربة فريدة بجودة عالية وبدون تقطيع.
                  </p>
                  <div className="flex gap-3 mt-4 md:mt-8 justify-center md:justify-start">
                    <Link 
                      to={`/series/${item.slug}`}
                      className="flex items-center justify-center gap-2 bg-[#b72424] text-white px-6 md:px-12 py-3 md:py-4 rounded-xl font-black text-base md:text-xl hover:bg-[#921e1e] transition-all transform hover:scale-105 shadow-2xl flex-1 md:flex-none"
                    >
                      <Play size={20} className="md:size-32" fill="white" />
                      مشاهدة الآن
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <style dangerouslySetInnerHTML={{ __html: `
        .swiper-button-next, .swiper-button-prev { color: white !important; }
        .swiper-pagination-bullet-active { background: #b72424 !important; }
      `}} />
    </div>
  );
}
