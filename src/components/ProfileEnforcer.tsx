import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Check, ChevronLeft, Sparkles, Image } from 'lucide-react';

export default function ProfileEnforcer() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('custom');
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => localStorage.getItem('user_avatar_url'));
  const [isUploading, setIsUploading] = useState(false);
  
  // New States for adjustment
  const [adjustingFile, setAdjustingFile] = useState<File | null>(null);
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);
  const [verticalPos, setVerticalPos] = useState(50); // 0 to 100
  const [horizontalPos, setHorizontalPos] = useState(50); // 0 to 100
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(() => localStorage.getItem('user_profile_template') || 'none');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const TEMPLATES = [
    { id: 'none', label: 'بدون', emoji: '❌', img: '' },
    { id: 'saudia', label: 'السعودية 🇸🇦', img: 'https://i.ibb.co/V9mFrz8/saudia-badge.png' },
    { id: 'football', label: 'كورة ⚽', img: 'https://i.ibb.co/0Xp5Z9H/ball.png' },
    { id: 'fire', label: 'حماس 🔥', img: 'https://i.ibb.co/68v8LSw/fire-badge.png' },
    { id: 'crown', label: 'تاج 👑', img: 'https://i.ibb.co/RPhPscx/crown.png' },
  ];

  useEffect(() => {
    const savedName = localStorage.getItem('guest_chat_name');
    const hasSetup = localStorage.getItem('profile_setup_complete');
    
    if (savedName) setName(savedName);
    
    if (!hasSetup || !savedName || savedName.includes('مستخدم جديد')) {
      setShow(true);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAdjustingFile(file);
      const url = URL.createObjectURL(file);
      setTempPreviewUrl(url);
      setIsAdjusting(true);
      setSelectedAvatar('custom');
    }
  };

  const handleUploadAndConfirm = async () => {
    if (!adjustingFile) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', adjustingFile);
      
      const response = await fetch('/api/v1/upload-media', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        setCustomAvatar(data.url);
        setSelectedAvatar('custom');
        localStorage.setItem('user_avatar_url', data.url);
        localStorage.setItem('user_avatar_pos_v', verticalPos.toString());
        localStorage.setItem('user_avatar_pos_h', horizontalPos.toString());
        setIsAdjusting(false);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert('فشل رفع الصورة. حاول مرة أخرى.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      alert('يرجى إدخال اسم حقيقي (3 حروف على الأقل) ✍️');
      return;
    }

    const reserved = ['مدير', 'ادمن', 'admin', 'moderator'];
    if (reserved.some(r => trimmed.toLowerCase().includes(r))) {
      alert('هذا الاسم محجوز للإدارة ⚠️');
      return;
    }

    localStorage.setItem('guest_chat_name', trimmed);
    localStorage.setItem('comment_author_name', trimmed);
    localStorage.setItem('profile_setup_complete', 'true');
    localStorage.setItem('user_avatar_pos_v', verticalPos.toString());
    localStorage.setItem('user_avatar_pos_h', horizontalPos.toString());
    if (selectedTemplate) {
      localStorage.setItem('user_profile_template', selectedTemplate);
    } else {
      localStorage.removeItem('user_profile_template');
    }
    
    localStorage.setItem('guest_chat_avatar', 'custom');
    if (customAvatar) {
      localStorage.setItem('user_avatar_url', customAvatar);
    }

    window.dispatchEvent(new Event('profile-updated'));
    setShow(false);
  };

  const triggerFileSelect = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200000] bg-[#020202]/98 backdrop-blur-3xl flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3.5rem] p-8 shadow-[0_20px_100px_rgba(0,0,0,1)] text-right space-y-8 my-auto relative"
        >
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-red-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-white">أهلاً بك في حكايتنا 🎬</h2>
            <p className="text-zinc-500 text-[10px] font-bold leading-relaxed px-4">
              يرجى إكمال ملفك الشخصي لتتمكن من الدردشة ومتابعة المسلسلات والتفاعل مع العروض الحصرية.
            </p>
          </div>

          <div className="space-y-8">
            {/* Avatar Selection & Adjustment Section */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                {/* Main clickable circle */}
                <button
                  type="button"
                  onClick={triggerFileSelect}
                  className="w-36 h-36 rounded-full border-4 border-zinc-900 overflow-hidden bg-gradient-to-br from-zinc-900 to-black hover:from-zinc-850 hover:to-zinc-950 flex items-center justify-center shadow-2xl transition-all duration-300 hover:border-red-600/50 relative active:scale-95 group focus:outline-none"
                  disabled={isAdjusting}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {isAdjusting ? (
                    <motion.div 
                      className="w-full h-full cursor-move"
                      drag
                      dragConstraints={{ left: -50, right: 50, top: -50, bottom: 50 }}
                      onDrag={(e, info) => {
                         const newH = Math.min(Math.max(horizontalPos - info.delta.x / 2, 0), 100);
                         const newV = Math.min(Math.max(verticalPos - info.delta.y / 2, 0), 100);
                         setHorizontalPos(newH);
                         setVerticalPos(newV);
                      }}
                    >
                      <img 
                        src={tempPreviewUrl!} 
                        className="w-[200%] h-[200%] max-w-none object-cover pointer-events-none" 
                        style={{ objectPosition: `${horizontalPos}% ${verticalPos}%` }}
                        alt="Adjusting" 
                      />
                      {/* Grid overlay for professional Cropping reference */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30 border border-white/20">
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                        <div className="border border-white/20" />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
                      {customAvatar || tempPreviewUrl ? (
                        <>
                          <img 
                            src={customAvatar || tempPreviewUrl!} 
                            className="w-full h-full object-cover rounded-full" 
                            style={{ objectPosition: `${horizontalPos}% ${verticalPos}%` }}
                            alt="Custom Avatar" 
                          />
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                            <Camera className="w-5 h-5 text-white mb-1 animate-bounce" />
                            <span className="text-[9px] font-black text-white">تغيير الصورة</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center space-y-2 pointer-events-none px-2">
                          <div className="p-3 bg-zinc-800/80 rounded-full text-zinc-400 group-hover:text-white transition-colors">
                            <Camera className="w-6 h-6" />
                          </div>
                          <span className="text-[11px] font-extrabold text-white tracking-wide block whitespace-normal leading-normal">
                            اضغط هنا لوضع صورتك
                          </span>
                        </div>
                      )}
                      
                      {/* Template Overlay */}
                      {selectedTemplate && selectedTemplate !== 'none' && (
                        <motion.img 
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          src={TEMPLATES.find(t => t.id === selectedTemplate)?.img} 
                          className="absolute inset-0 w-full h-full object-contain p-1.5 pointer-events-none z-30"
                        />
                      )}
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-40">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>

              {/* Adjustment Controls */}
              {isAdjusting && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4 text-center"
                >
                  <p className="text-[10px] font-black text-center text-red-500 uppercase tracking-widest animate-pulse">حرك الصورة لضبط الأبعاد 📐</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleUploadAndConfirm}
                      disabled={isUploading}
                      className="flex-1 bg-white text-black text-[11px] py-3 rounded-xl font-black transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isUploading ? 'جاري الرفع...' : 'حفظ وصنع التميز ✨'}
                    </button>
                    <button 
                      onClick={() => setIsAdjusting(false)}
                      className="px-4 bg-zinc-900 text-zinc-500 text-[11px] py-3 rounded-xl border border-zinc-800 font-black cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Template Selection - only visible if has avatar, and rendered in visual circular stories style */}
              {(customAvatar || tempPreviewUrl) && !isAdjusting && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-3"
                >
                  <label className="block text-[11px] font-black text-zinc-400 mr-2 uppercase tracking-widest text-right">أضف لمسة خاصة (قوالب) ✨</label>
                  <div className="flex items-center justify-center gap-3 overflow-x-auto py-2 px-1">
                    {TEMPLATES.map(t => {
                      const isSelected = selectedTemplate === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`relative flex-shrink-0 flex flex-col items-center gap-1.5 focus:outline-none transition-all ${
                            isSelected ? 'scale-110' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className={`w-14 h-14 rounded-full border-2 p-0.5 relative transition-all ${
                            isSelected ? 'border-red-650 ring-4 ring-red-650/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
                          }`}>
                            {/* Visual circle combining user Avatar and badging preview */}
                            <div className="w-full h-full rounded-full bg-zinc-950 overflow-hidden relative flex items-center justify-center">
                              {customAvatar ? (
                                <img 
                                  src={customAvatar} 
                                  className="w-full h-full object-cover" 
                                  style={{ objectPosition: `${horizontalPos}% ${verticalPos}%` }}
                                  alt="Avatar" 
                                />
                              ) : (
                                <User className="w-5 h-5 text-zinc-600" />
                              )}
                              
                              {/* Actual template badge overlaid on it */}
                              {t.img ? (
                                <img 
                                  src={t.img} 
                                  className="absolute inset-0 w-full h-full object-contain p-0.5 z-10 pointer-events-none" 
                                  alt="badge" 
                                />
                              ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-xs pointer-events-none">{t.emoji}</span>
                              )}
                            </div>
                            
                            {/* Selected Check overlay */}
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 bg-red-650 text-white rounded-full p-0.5 border border-zinc-950 shadow">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <span className={`text-[9px] font-black tracking-tight ${isSelected ? 'text-red-500' : 'text-zinc-500'}`}>
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Name Input */}
            {!isAdjusting && (
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-zinc-400 mr-2 uppercase tracking-widest text-right">
                  الاسم أو اللقب ✍️
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="مثال: ليلى الشامية 🍿"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-red-650 focus:ring-4 focus:ring-red-600/10 placeholder-zinc-750 transition-all text-right font-black"
                  />
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-red-500 transition-colors" />
                </div>
                <p className="text-[9px] text-zinc-600 mr-2 text-right">يجب أن يكون الاسم حقيقياً وراقياً ليظهر للمشاركين الآخرين.</p>
              </div>
            )}

            {/* Final Action */}
            {!isAdjusting && (
              <button
                type="button"
                onClick={handleSave}
                className="w-full group bg-gradient-to-r from-red-650 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-black py-5 rounded-[2rem] transition-all shadow-[0_15px_40px_rgba(229,9,20,0.2)] flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
              >
                <span>تأكيد الهوية والدخول 🚀</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
