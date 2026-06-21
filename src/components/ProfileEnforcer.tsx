import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Check, ChevronLeft, Sparkles } from 'lucide-react';

const AVATARS = [
  { id: 'boy1', url: 'https://i.ibb.co/L5p8Xf6/boy1.png' },
  { id: 'girl1', url: 'https://i.ibb.co/vYVvM3v/girl1.png' },
  { id: 'boy2', url: 'https://i.ibb.co/F8Sgpx7/boy2.png' },
  { id: 'girl2', url: 'https://i.ibb.co/3s6xWHP/girl2.png' },
  { id: 'boy3', url: 'https://i.ibb.co/album/0wvJfBH' },
];

export default function ProfileEnforcer() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('guest_chat_name');
    const hasSetup = localStorage.getItem('profile_setup_complete');
    
    if (!hasSetup || !savedName || savedName.includes('مستخدم جديد')) {
      setShow(true);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/v1/upload-media', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.status === 'success' && data.fileUrl) {
        setCustomAvatar(data.fileUrl);
        setSelectedAvatar('custom');
      }
    } catch (err) {
      console.error("Upload failed:", err);
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
    
    if (selectedAvatar === 'custom' && customAvatar) {
      localStorage.setItem('user_avatar_url', customAvatar);
      localStorage.setItem('guest_chat_avatar', 'custom');
    } else {
      localStorage.setItem('guest_chat_avatar', selectedAvatar);
      localStorage.removeItem('user_avatar_url');
    }

    window.dispatchEvent(new Event('profile-updated'));
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200000] bg-[#020202]/98 backdrop-blur-3xl flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 shadow-[0_20px_100px_rgba(0,0,0,1)] text-right space-y-8"
        >
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-red-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-white">أهلاً بك في حكايتنا 🎬</h2>
            <p className="text-zinc-500 text-xs font-bold leading-relaxed">
              يرجى إكمال ملفك الشخصي لتتمكن من الدردشة ومتابعة المسلسلات والتفاعل مع العروض الحصرية.
            </p>
          </div>

          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-zinc-900 overflow-hidden bg-zinc-900 flex items-center justify-center shadow-xl transition-all duration-300 group-hover:border-red-600/50">
                  {selectedAvatar === 'custom' && customAvatar ? (
                    <img src={customAvatar} className="w-full h-full object-cover" alt="Custom Avatar" />
                  ) : (
                    <img src={AVATARS.find(a => a.id === selectedAvatar)?.url || AVATARS[0].url} className="w-full h-full object-cover" alt="Selected Avatar" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-red-600 p-2 rounded-xl border-4 border-zinc-950 shadow-lg cursor-pointer hover:bg-red-500 transition-colors">
                  <Camera className="w-4 h-4 text-white" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {AVATARS.map(avatar => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`w-12 h-12 rounded-2xl border-2 transition-all p-0.5 overflow-hidden ${
                      selectedAvatar === avatar.id ? 'border-red-600' : 'border-zinc-800 opacity-40 hover:opacity-100 hover:border-zinc-700'
                    }`}
                  >
                    <img src={avatar.url} className="w-full h-full object-cover" alt={avatar.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-zinc-400 mr-2 uppercase tracking-widest text-right">
                الاسم أو اللقب ✍️
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: ليلى الشامية 🍿"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/10 placeholder-zinc-700 transition-all text-right font-black"
                />
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700" />
              </div>
              <p className="text-[9px] text-zinc-600 mr-2 text-right">يجب أن يكون الاسم حقيقياً وراقياً ليظهر للمشاركين الآخرين.</p>
            </div>

            <button
              onClick={handleSave}
              className="w-full group bg-gradient-to-r from-red-650 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-black py-5 rounded-[1.8rem] transition-all shadow-[0_10px_30px_rgba(229,9,20,0.2)] flex items-center justify-center gap-3 active:scale-95"
            >
              <span>تأكيد الهوية والدخول 🚀</span>
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
