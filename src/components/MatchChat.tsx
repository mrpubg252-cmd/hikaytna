import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, onValue, limitToLast, query, serverTimestamp, Database } from 'firebase/database';
import chatFirebaseConfig from '../services/chatFirebaseConfig.json';
import { Send, Users, Smile, User2, MessageSquare, Flame, Camera, X, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getApiUrl } from '../lib/apiConfig';

interface ChatMessage {
  id: string;
  userName: string;
  userAvatar: string; // 'boy1' | 'boy2' | 'girl1' | 'girl2'
  text: string;
  imageUrl?: string;
  createdAt: number;
}

interface MatchChatProps {
  matchId: string;
  matchTitle: string;
  onClose?: () => void;
}

const AVATARS = [
  {
    id: 'boy1',
    name: 'ولد أنيق',
    gender: 'boy',
    bgColor: 'bg-red-500/10 border-red-500/30'
  },
  {
    id: 'boy2',
    name: 'رياضي حماسي',
    gender: 'boy',
    bgColor: 'bg-rose-500/10 border-rose-500/30'
  },
  {
    id: 'girl1',
    name: 'مشجعة أنيقة',
    gender: 'girl',
    bgColor: 'bg-amber-500/10 border-amber-500/30'
  },
  {
    id: 'girl2',
    name: 'لطيفة حماسية',
    gender: 'girl',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30'
  }
];

const QUICK_REACTIONS = [
  '⚽ جوووووول!',
  '🔥 النبض مليون!',
  '🦁 وحش الملعب!',
  '😡 الحكم متحيز!',
  '😱 أوه فرصة تضيع!',
  '🧠 تكتيك من كوكب آخر',
  '👏 مباراة ممتازة'
];

export default function MatchChat({ matchId, matchTitle }: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [activeUsers, setActiveUsers] = useState<number>(1);
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('boy1');
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputGender, setInputGender] = useState<'boy' | 'girl'>('boy');
  const [db, setDb] = useState<Database | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);

  // Direct Image upload states
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize DB instance
  useEffect(() => {
    try {
      let instance: Database;
      if (!getApps().find(a => a.name === 'chatApp')) {
        const app = initializeApp(chatFirebaseConfig, 'chatApp');
        instance = getDatabase(app);
      } else {
        instance = getDatabase(getApp('chatApp'));
      }
      setDb(instance);
      setIsDbReady(true);
    } catch (err) {
      console.warn("Failed to initialize match chat database:", err);
    }
  }, []);

  // Initialize identity from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('match_chat_name');
    const savedAvatar = localStorage.getItem('match_chat_avatar');
    if (savedName && savedAvatar) {
      setUserName(savedName);
      setUserAvatar(savedAvatar);
    } else {
      // Pick a random default name
      const randomNames = ['قناص الأهداف', 'ساحر المستطيل', 'المشجع المخلص', 'عاشق الكروية', 'مايسترو التكتيك', 'جنرال الدكة'];
      const defaultName = randomNames[Math.floor(Math.random() * randomNames.length)] + ' #' + Math.floor(Math.random() * 900 + 100);
      const defaultAvatar = 'boy' + (Math.floor(Math.random() * 2) + 1);
      setUserName(defaultName);
      setUserAvatar(defaultAvatar);
      localStorage.setItem('match_chat_name', defaultName);
      localStorage.setItem('match_chat_avatar', defaultAvatar);
    }

    // Set a dynamic simulation or count of presence active users
    setActiveUsers(Math.floor(Math.random() * 34) + 12);
    const interval = setInterval(() => {
      setActiveUsers(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        return next > 5 ? next : 12;
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [matchId]);

  // Firebase RTDB Live Chat listener
  useEffect(() => {
    if (!isDbReady || !db) return;
    const chatRef = ref(db, `matchesChat/${matchId}`);
    const q = query(chatRef, limitToLast(60));

    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed: ChatMessage[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          userName: value.userName || 'مشجع مجهول',
          userAvatar: value.userAvatar || 'boy1',
          text: value.text || '',
          imageUrl: value.imageUrl || '',
          createdAt: value.createdAt || Date.now()
        }));
        setMessages(parsed.sort((a, b) => a.createdAt - b.createdAt));
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [matchId, isDbReady, db]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (msgText: string, imgUrl?: string | null) => {
    const trimmed = msgText.trim();
    if (!trimmed && !imgUrl) return;
    if (!isDbReady || !db) return;

    try {
      const chatRef = ref(db, `matchesChat/${matchId}`);
      push(chatRef, {
        userName,
        userAvatar,
        text: trimmed,
        imageUrl: imgUrl || "",
        createdAt: serverTimestamp()
      });
      setText('');
      setAttachedImageUrl(null);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show indicator
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const uploadEndpoint = getApiUrl ? getApiUrl("/api/v1/upload-image") : "/api/v1/upload-image";
          const uploadRes = await fetch(uploadEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64String })
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.url) {
            setAttachedImageUrl(uploadData.url);
          } else {
            alert(uploadData.error || "عذراً فشل رفع الصورة، يرجى المحاولة مرة أخرى.");
          }
        } catch (xhrErr) {
          console.error("XHR Image upload error:", xhrErr);
          alert("خطأ أثناء التواصل مع خادم الرفع.");
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (readErr) {
      console.error("Failed to read file:", readErr);
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = () => {
    if (!inputName.trim()) return;
    const finalName = inputName.trim();
    const chosenAvatar = inputGender === 'boy' ? 'boy' + (Math.floor(Math.random() * 2) + 1) : 'girl' + (Math.floor(Math.random() * 2) + 1);
    
    setUserName(finalName);
    setUserAvatar(chosenAvatar);
    localStorage.setItem('match_chat_name', finalName);
    localStorage.setItem('match_chat_avatar', chosenAvatar);
    setShowProfileSetup(false);
  };

  const renderAvatarInitials = (avatarId: string, name: string) => {
    const firstLetter = name ? name.substring(0, 2) : '⚽';
    let colorClass = "bg-red-500/20 text-red-400 border border-red-500/40";
    if (avatarId.includes('girl')) {
      colorClass = "bg-rose-500/20 text-rose-400 border border-rose-500/40";
    } else if (avatarId.includes('2')) {
      colorClass = "bg-amber-500/20 text-amber-400 border border-amber-500/40";
    }
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-inner ${colorClass}`}>
        {firstLetter}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[480px] md:h-full bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden text-right">
      {/* Chat Room Header */}
      <div className="bg-zinc-900/40 p-3.5 border-b border-zinc-900 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
          <span className="text-zinc-400 text-[10px] font-bold flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-red-500" />
            <span>{activeUsers} متصل الآن</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-black text-rose-500 tracking-tight">شات اللقاء التفاعلي</h4>
          <MessageSquare className="w-4 h-4 text-rose-500 shrink-0" />
        </div>
      </div>

      {/* Profile Bar / Identity customizer */}
      <div className="bg-zinc-900/10 hover:bg-zinc-900/20 px-4 py-2 border-b border-zinc-900/40 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={() => {
            setInputName(userName);
            setShowProfileSetup(true);
          }}
          className="text-[10px] font-bold text-zinc-500 hover:text-red-400 transition underline cursor-pointer"
        >
          تعديل الاسم 👤
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-zinc-400">تدردش كـ: <span className="text-white font-black">{userName}</span></span>
          {renderAvatarInitials(userAvatar, userName)}
        </div>
      </div>

      {/* Messages Board */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 space-y-2.5 opacity-60">
            <MessageSquare className="w-8 h-8 text-zinc-700 animate-bounce" />
            <p className="text-[11px] font-bold text-zinc-500">لا توجد رسائل بعد. كن أول من يهتف بالملعب! 🎉</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-2.5 items-start ${msg.userName === userName ? 'flex-row' : 'flex-row-reverse'}`}
            >
              {renderAvatarInitials(msg.userAvatar, msg.userName)}
              <div className="flex flex-col max-w-[75%] space-y-1">
                <span className={`text-[9px] font-bold ${msg.userName === userName ? 'text-rose-400 text-left' : 'text-zinc-400 text-right'}`}>
                  {msg.userName === userName ? 'أنا' : msg.userName}
                </span>
                <div 
                  className={`rounded-2xl px-3.5 py-2.5 text-xs text-right whitespace-pre-wrap break-words leading-relaxed shadow-md border ${
                    msg.userName === userName 
                      ? 'bg-red-500/10 border-red-500/20 text-red-50' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-350'
                  }`}
                >
                  {msg.text && <p className={msg.imageUrl ? "mb-2" : ""}>{msg.text}</p>}
                  {msg.imageUrl && (
                    <div className="relative overflow-hidden rounded-xl border border-zinc-850 bg-black/40 mt-1 max-w-[200px] cursor-pointer hover:opacity-90 transition active:scale-[0.98]">
                      <img 
                        src={msg.imageUrl} 
                        alt="بث مشجع" 
                        referrerPolicy="no-referrer"
                        onClick={() => setPreviewImage(msg.imageUrl || null)}
                        className="w-full h-auto max-h-[160px] object-cover rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Presets */}
      <div className="px-3 py-1.5 bg-zinc-900/25 border-t border-zinc-900/40 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 shrink-0 flex-row-reverse">
        {QUICK_REACTIONS.map((react, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(react, null)}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-[10px] font-bold text-zinc-350 hover:text-white rounded-full transition border border-zinc-800 whitespace-nowrap cursor-pointer"
          >
            {react}
          </button>
        ))}
      </div>

      {/* Message Input Trigger */}
      <div className="p-3 bg-zinc-900/40 border-t border-zinc-900 shrink-0">
        {/* Attachment Thumbnails & Upload indicators */}
        {uploadingImage && (
          <div className="flex items-center gap-2 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-1.5 px-3 rounded-xl text-[10px] w-fit mr-auto">
            <div className="w-3.5 h-3.5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
            <span>جاري رفع وتنشيط الصورة...</span>
          </div>
        )}
        {attachedImageUrl && (
          <div className="relative inline-block mb-2 mr-auto bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <img src={attachedImageUrl} alt="Preview" className="w-14 h-14 object-cover rounded-lg" />
            <button 
              type="button" 
              onClick={() => setAttachedImageUrl(null)} 
              className="absolute -top-1.5 -right-1.5 bg-black text-white hover:bg-rose-600 rounded-full p-0.5 border border-zinc-850 duration-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(text, attachedImageUrl);
          }}
          className="flex items-center gap-2"
        >
          <button
            type="submit"
            disabled={!text.trim() && !attachedImageUrl}
            className="p-2.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white rounded-xl transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4 transform rotate-180" />
          </button>

          <input
            type="text"
            placeholder="اكتب رسيلتك الحماسية هنا..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 text-xs text-right bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
          />

          <label className="p-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center border border-zinc-850">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
          </label>
        </form>
      </div>

      {/* Lightbox Image Preview Dialog overlay */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setPreviewImage(null)} 
              className="absolute top-4 right-4 bg-zinc-900/80 text-white p-3 rounded-full border border-zinc-800 hover:bg-zinc-800 transition duration-200"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={previewImage} 
              alt="Full Preview" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-zinc-800"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlaid Profile Customization Screen */}
      <AnimatePresence>
        {showProfileSetup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm p-4 flex flex-col justify-center"
          >
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-3xl space-y-4 max-w-xs mx-auto text-right w-full">
              <h3 className="text-xs font-black text-rose-500">اختر هويتك الكروية</h3>
              
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold block">اللقب المستعار</label>
                <input
                  type="text"
                  maxLength={18}
                  placeholder="لقب التشجيع (مثال: الهداف)"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full text-xs text-right bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-bold block">الجنس المفضل للأفاتار</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setInputGender('girl')}
                    className={`py-1.5 text-xs rounded-xl border font-black transition cursor-pointer ${
                      inputGender === 'girl' 
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400' 
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400'
                    }`}
                  >
                    بنت 🚺
                  </button>
                  <button
                    onClick={() => setInputGender('boy')}
                    className={`py-1.5 text-xs rounded-xl border font-black transition cursor-pointer ${
                      inputGender === 'boy' 
                        ? 'bg-red-500/10 border-red-500 text-red-400' 
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400'
                    }`}
                  >
                    ولد 🚹
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowProfileSetup(false)}
                  className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-black rounded-xl text-[10px] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={!inputName.trim()}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-black rounded-xl text-[10px] cursor-pointer"
                >
                  حفظ 💾
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
