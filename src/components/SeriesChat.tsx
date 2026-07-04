import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, Users, MessageSquare, Flame, Check, User, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SeriesChatProps {
  seriesId: string;
  seriesTitle: string;
}

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  avatarColor: string;
  createdAt: any;
}

const AVATAR_COLORS = [
  'from-red-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-pink-500 to-fuchsia-600',
];

const QUICK_REPLIES = [
  'الحلقة أسطورية! 🔥',
  'أفضل مسلسل شاهدته في حياتي ❤️',
  'متحمس جداً للحلقة القادمة! ✨',
  'البث سريع جداً، شكراً حكايتنا 🍿',
  'الأحداث أصبحت غير متوقعة 😱',
  'النهاية كانت صادمة للغاية!💔',
];

export default function SeriesChat({ seriesId, seriesTitle }: SeriesChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('chat_username') || '';
    } catch {
      return '';
    }
  });
  const [avatarColor, setAvatarColor] = useState(() => {
    try {
      return localStorage.getItem('chat_avatar_color') || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    } catch {
      return AVATAR_COLORS[0];
    }
  });
  const [tempUsername, setTempUsername] = useState('');
  const [isJoined, setIsJoined] = useState(!!username);
  const [onlineCount, setOnlineCount] = useState(42);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a random cute Arabic default name
  useEffect(() => {
    if (!tempUsername && !username) {
      const prefixes = ['متابع', 'بطل', 'عاشق', 'محب', 'نجم', 'مشاهد'];
      const suffixes = ['الدراما', 'الفن', 'الغموض', 'القصة', 'الحب', 'الإثارة'];
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      setTempUsername(`${randomPrefix}_${randomSuffix}_${randomNum}`);
    }
  }, [username]);

  // Simulate online count updates to make it feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + delta;
        return next > 10 ? (next < 150 ? next : 120) : 25;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages from Firestore
  useEffect(() => {
    if (!seriesId) return;

    const messagesCol = collection(db, 'chats', seriesId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(80));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            text: data.text || '',
            username: data.username || 'مجهول',
            avatarColor: data.avatarColor || AVATAR_COLORS[0],
            createdAt: data.createdAt,
          });
        });
        setMessages(list);
      },
      (error) => {
        console.error('Firestore chat fetch error:', error);
      }
    );

    return () => unsubscribe();
  }, [seriesId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoinChat = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = tempUsername.trim();
    if (!finalName) return;

    try {
      localStorage.setItem('chat_username', finalName);
      localStorage.setItem('chat_avatar_color', avatarColor);
    } catch {}

    setUsername(finalName);
    setIsJoined(true);
  };

  const handleSendMessage = async (textToSend: string) => {
    const msgText = textToSend.trim();
    if (!msgText || !seriesId || !username) return;

    try {
      const messagesCol = collection(db, 'chats', seriesId, 'messages');
      await addDoc(messagesCol, {
        text: msgText,
        username,
        avatarColor,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send message to Firebase:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col bg-[#0f0f15]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl h-[500px] w-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-white/[0.02] border-b border-white/10 select-none">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#b72424]" />
            دردشة مباشرة: {seriesTitle || 'المسلسل'}
          </span>
        </div>
        
        <div className="flex items-center gap-1 bg-zinc-800/60 text-zinc-300 px-2.5 py-1 rounded-full text-xs font-semibold border border-white/5">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span>{onlineCount} متصل الآن</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isJoined ? (
          /* Join Screen */
          <motion.form
            key="join-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleJoinChat}
            className="flex-1 flex flex-col justify-center items-center p-6 text-center max-w-sm mx-auto"
          >
            <div className="w-16 h-16 bg-gradient-to-tr from-[#b72424] to-[#e11d48] rounded-2xl flex items-center justify-center shadow-lg shadow-[#b72424]/20 mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="font-bold text-lg mb-1 text-zinc-100">انضم لدردشة العرض المباشر!</h3>
            <p className="text-xs text-zinc-400 mb-6">شارك برأيك وتفاعل مع آلاف المتابعين الآخرين في نفس الوقت.</p>

            <div className="w-full text-right mb-4">
              <label className="block text-xs font-bold text-zinc-400 mb-1.5 mr-1">الاسم المستعار</label>
              <input
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                maxLength={25}
                className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#b72424] focus:ring-1 focus:ring-[#b72424] text-white placeholder-zinc-500 transition-all text-center"
                placeholder="أدخل اسمك المستعار..."
              />
            </div>

            <div className="w-full mb-6">
              <label className="block text-xs font-bold text-zinc-400 mb-2 mr-1 text-right">اختر لون صورتك الرمزية</label>
              <div className="flex justify-center gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-tr ${color} border-2 transition-all duration-200 transform hover:scale-110 flex items-center justify-center ${
                      avatarColor === color ? 'border-white scale-105 shadow-md shadow-white/10' : 'border-transparent opacity-70'
                    }`}
                  >
                    {avatarColor === color && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#b72424] to-red-600 hover:from-red-600 hover:to-rose-600 text-white font-bold text-sm py-3 px-6 rounded-xl transition-all shadow-lg shadow-red-950/25 flex items-center justify-center gap-2 group"
            >
              دخول للدردشة
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.form>
        ) : (
          /* Chat Screen */
          <motion.div
            key="chat-room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 select-none">
                  <Flame className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
                  <p className="text-sm font-semibold">لا توجد رسائل بعد</p>
                  <p className="text-xs text-zinc-600 mt-1">كن أول من يكتب تعليقاً حماسياً هنا!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.username === username;
                  const showUsername = index === 0 || messages[index - 1].username !== msg.username;
                  
                  return (
                    <div key={msg.id || index} className={`flex gap-2.5 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      {showUsername ? (
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${msg.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-md select-none flex-shrink-0`}>
                          {msg.username.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}

                      {/* Content Block */}
                      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {showUsername && (
                          <span className="text-[11px] font-bold text-zinc-400 mb-1 px-1">
                            {isMe ? 'أنت' : msg.username.replace(/_/g, ' ')}
                          </span>
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm ${
                          isMe 
                            ? 'bg-[#b72424] text-white rounded-tr-none' 
                            : 'bg-zinc-800/80 text-zinc-100 rounded-tl-none border border-white/5'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies Tray */}
            <div className="px-4 py-2 bg-zinc-950/40 border-t border-white/5 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none select-none">
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(reply)}
                  className="inline-block bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full text-xs font-semibold border border-white/5 transition-all duration-150 transform active:scale-95"
                >
                  {reply}
                </button>
              ))}
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleFormSubmit} className="p-3 bg-white/[0.01] border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب رسالة هنا للجميع..."
                maxLength={150}
                className="flex-1 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[#b72424] focus:ring-1 focus:ring-[#b72424] text-white placeholder-zinc-500 transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  inputText.trim() 
                    ? 'bg-[#b72424] hover:bg-red-600 text-white shadow-lg shadow-red-950/20' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
