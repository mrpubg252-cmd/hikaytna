import React, { useState, useEffect, useRef } from 'react';
import { db as rtdb } from '../services/firebase';
import { ref, push, onValue, limitToLast, query, serverTimestamp } from 'firebase/database';
import { Send, Users, Smile, User2, MessageSquare, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  userName: string;
  userAvatar: string; // 'boy1' | 'boy2' | 'girl1' | 'girl2'
  text: string;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    const chatRef = ref(rtdb, `matchesChat/${matchId}`);
    const q = query(chatRef, limitToLast(60));

    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed: ChatMessage[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          userName: value.userName || 'مشجع مجهول',
          userAvatar: value.userAvatar || 'boy1',
          text: value.text || '',
          createdAt: value.createdAt || Date.now()
        }));
        setMessages(parsed.sort((a, b) => a.createdAt - b.createdAt));
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [matchId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (msgText: string) => {
    const trimmed = msgText.trim();
    if (!trimmed) return;

    try {
      const chatRef = ref(rtdb, `matchesChat/${matchId}`);
      push(chatRef, {
        userName,
        userAvatar,
        text: trimmed,
        createdAt: serverTimestamp()
      });
      setText('');
    } catch (err) {
      console.error('Error sending message:', err);
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
                  {msg.text}
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
            onClick={() => handleSendMessage(react)}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-[10px] font-bold text-zinc-350 hover:text-white rounded-full transition border border-zinc-800 whitespace-nowrap cursor-pointer"
          >
            {react}
          </button>
        ))}
      </div>

      {/* Message Input Trigger */}
      <div className="p-3 bg-zinc-900/40 border-t border-zinc-900 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(text);
          }}
          className="flex items-center gap-2"
        >
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-2.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white rounded-xl transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4 transform rotate-180" />
          </button>

          <input
            type="text"
            placeholder="اكتب رسيلتك الحماسية هنا..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 text-xs text-right bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-550 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
          />
        </form>
      </div>

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
                  className="flex-1 py-2 bg-red-650 hover:bg-red-600 disabled:bg-zinc-800 text-white font-black rounded-xl text-[10px] cursor-pointer"
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
