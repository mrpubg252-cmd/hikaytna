import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, Sparkles, MessageSquare, Bot, ArrowLeft, Play, 
  AlertCircle, RefreshCw, Key, ShieldCheck, Heart, ThumbsUp, 
  Volume2, VolumeX, ChevronDown, Star, Zap, Info, Compass, Sparkle, Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchAllSeries } from '../services/dataService';
import { Series } from '../services/firebase';
import { getApiUrl } from '../lib/apiConfig';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface AiChatDrawerProps {
  onClose: () => void;
}

interface HeartParticle {
  id: string;
  x: number;
  y: number;
}

const PRESET_PROMPTS = [
  { text: 'اقترح لي مسلسل تركي رومانسي وحزين 💔', icon: '💖', color: 'border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5 text-rose-350 hover:bg-rose-500/10' },
  { text: 'عندكم مسلسل المتوحش؟ عطني قصته 🐺', icon: '🐺', color: 'border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-500/5 text-indigo-350 hover:bg-indigo-500/10' },
  { text: 'أبي مسلسل أكشن وحرب تاريخي رهيب ⚔️', icon: '⚔️', color: 'border-red-500/20 hover:border-red-500/50 bg-red-500/5 text-red-350 hover:bg-red-500/10' },
  { text: 'دلني على مسلسل خليجي درامي راقي 📺', icon: '📺', color: 'border-amber-500/20 hover:border-amber-500/50 bg-amber-500/5 text-amber-350 hover:bg-amber-500/10' },
  { text: 'اقتراح خفيف وكوميدي يسليني 🎭', icon: '🎭', color: 'border-purple-500/20 hover:border-purple-500/50 bg-purple-500/5 text-purple-350 hover:bg-purple-500/10' },
  { text: 'أريد كرتون مدبلج عائلي رهيب 🧸', icon: '🧸', color: 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5 text-emerald-350 hover:bg-emerald-500/10' }
];

// Modern synthetic audio chimes using browser AudioContext to avoid remote file asset dependency
const playModernChime = (type: 'send' | 'receive' | 'heart') => {
  try {
    const savedMuted = localStorage.getItem('hakeem_sound_muted');
    if (savedMuted === 'true') return;
    
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'receive') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(840, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'heart') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {
    // Gracefully handle browser autoplay blocks
  }
};

export default function AiChatDrawer({ onClose }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWaitWarning, setShowWaitWarning] = useState(false);
  const requestActiveRef = useRef(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSoundMuted, setIsSoundMuted] = useState(() => {
    return localStorage.getItem('hakeem_sound_muted') === 'true';
  });
  
  // Persist liked/loved elements
  const [reactions, setReactions] = useState<Record<string, 'liked' | null>>({});
  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Admin API Key setting state
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiBaseUrl, setNewApiBaseUrl] = useState('');
  const [newApiModel, setNewApiModel] = useState('');
  const [newApiType, setNewApiType] = useState<'gemini' | 'openai'>('gemini');
  const [settingStatus, setSettingStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load first message as greeting with synthetic delay to look organic
  useEffect(() => {
    const greetingMsg: Message = {
      id: 'welcome',
      role: 'model',
      text: 'مرحباً بك! أنا **حكيم** ✨، مستشارك الذكي المتخصص في عالم الدراما والمسلسلات.\n\nيمكنك سؤالي عن قصة أي مسلسل، أبطاله، أو اطلب ترشيح مسلسل يناسب مزاجك وسآخذك إليه مباشرة! 🍿',
      timestamp: new Date()
    };
    setMessages([greetingMsg]);

    // Load local series list to pass to Gemini as context
    async function loadSeries() {
      try {
        const list = await fetchAllSeries();
        setSeriesList(list);
      } catch (e) {
        console.error('Error fetching series list for AI context:', e);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadSeries();
  }, []);

  // Control scrolling behaviour
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  }, [messages, isTyping]);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 200;
    setShowScrollDown(isUp);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    playModernChime('send');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);
    requestActiveRef.current = true;
    
    const waitTimer = setTimeout(() => {
      if (requestActiveRef.current) {
        setShowWaitWarning(true);
        setTimeout(() => setShowWaitWarning(false), 5000);
      }
    }, 5000);

    try {
      // Build history payload in the format expected by the server
      const historyPayload = messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        text: m.text
      }));

      const res = await fetch(getApiUrl('/api/v1/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          seriesList: seriesList
        })
      });

      if (!res.ok) throw new Error('فشل الاتصال بخدمة حكيم');

      const data = await res.json();
      const aiText = data.text || "";

      if (aiText) {
        playModernChime('receive');
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: aiText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error('رد فارغ من الذكاء الاصطناعي');
      }
    } catch (err: any) {
      playModernChime('receive');
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `عذراً! حكيم واجه ضغطاً مؤقتاً، أرجوك حاول مجدداً وسأكون جاهزاً فوراً لخدمتك! 🤖❤️`,
          timestamp: new Date()
        }
      ]);
    } finally {
      requestActiveRef.current = false;
      clearTimeout(waitTimer);
      setIsTyping(false);
      setShowWaitWarning(false);
    }
  };

  const toggleSound = () => {
    const targetVal = !isSoundMuted;
    setIsSoundMuted(targetVal);
    localStorage.setItem('hakeem_sound_muted', String(targetVal));
  };

  const triggerHeartReaction = (msgId: string) => {
    const isLiked = reactions[msgId] === 'liked';
    setReactions(prev => ({
      ...prev,
      [msgId]: isLiked ? null : 'liked'
    }));

    if (!isLiked) {
      playModernChime('heart');
      // Create high-fidelity temporary floating heart particles
      const newParticles = Array.from({ length: 7 }).map((_, idx) => ({
        id: `${msgId}-${Date.now()}-${idx}`,
        x: (Math.random() - 0.5) * 80, // drift left/right
        y: -10 - Math.random() * 50     // drift up
      }));
      setParticles(prev => [...prev, ...newParticles]);
      setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1000);
    }
  };

  const matchAllNavigations = (text: string): Series[] => {
    const ids: string[] = [];
    
    // 1. Scan for explicit navigate:id markers
    const regex = /navigate:([a-zA-Z0-9_\-]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    
    // 2. Scan for mentions of actual series titles in the message
    seriesList.forEach(series => {
      const cleanTitle = series.title.trim();
      if (cleanTitle.length > 2) {
        if (text.includes(cleanTitle)) {
          if (!ids.includes(series.id)) {
            ids.push(series.id);
          }
        }
        
        // Colloquial match (removing "ال" prefix)
        const colloquialTitle = cleanTitle.replace(/^(ال)/, '');
        if (colloquialTitle.length > 3 && text.includes(colloquialTitle)) {
          if (!ids.includes(series.id)) {
            ids.push(series.id);
          }
        }
      }
    });

    return ids.map(id => seriesList.find(s => s.id === id)).filter((s): s is Series => !!s);
  };

  const cleanTextOfLinks = (text: string): string => {
    let cleaned = text.replace(/\[[^\]]+\]\([^\s\)]+\)/g, '');
    cleaned = cleaned.replace(/\(\s*https?:\/\/[^\s\)]+\s*\)/gi, '');
    cleaned = cleaned.replace(/https?:\/\/[^\s\)]+/gi, '');
    cleaned = cleaned.replace(/\(\s*navigate:[a-zA-Z0-9_\-]+\s*\)/gi, '');
    cleaned = cleaned.replace(/navigate:[a-zA-Z0-9_\-]+/gi, '');
    cleaned = cleaned.replace(/\[\]|\(\)/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  };

  // Luxury parsing engine for nested bold accents, custom numbered and bullet lists
  const parseMessageText = (text: string) => {
    const cleaned = cleanTextOfLinks(text);
    const lines = cleaned.split('\n');

    return (
      <div className="space-y-3 text-right">
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lineIdx} className="h-2" />;

          // Check if bullet point (- or * or •)
          const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ');
          // Check if numbered line (e.g. 1. or 2.)
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);

          let displayLine = trimmed;
          if (isBullet) {
            displayLine = trimmed.substring(2);
          } else if (numMatch) {
            displayLine = numMatch[2];
          }

          // Bold processing
          const contentParts = displayLine.split('**') || [];
          const textElement = (
            <span className="leading-relaxed text-sm text-[13.5px] text-zinc-150 font-normal">
              {contentParts.map((sub, sIdx) => 
                sIdx % 2 === 1 ? (
                  <strong key={sIdx} className="font-extrabold text-[#fda4af] bg-red-500/5 px-1 py-0.5 rounded border border-red-500/10 drop-shadow-sm font-sans mx-0.5">
                    {sub}
                  </strong>
                ) : (
                  sub
                )
              )}
            </span>
          );

          if (isBullet) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pr-1.5 py-0.5 bg-gradient-to-l from-white/[0.02] to-transparent rounded-lg border-r-2 border-primary/20">
                <span className="text-[10px] text-primary select-none mt-1.5">✨</span>
                <div className="flex-1 min-w-0">{textElement}</div>
              </div>
            );
          }

          if (numMatch) {
            return (
              <div key={lineIdx} className="flex items-start gap-2.5 pr-2 py-1 bg-gradient-to-l from-[#1e1b4b]/20 to-transparent rounded-xl border-r-2 border-indigo-400/30">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/35 to-primary/35 flex items-center justify-center text-[9px] font-black text-indigo-200 border border-indigo-500/20 shadow-sm shrink-0 mt-0.5 select-none">
                  {numMatch[1]}
                </span>
                <div className="flex-1 min-w-0">{textElement}</div>
              </div>
            );
          }

          return (
            <p key={lineIdx} className="leading-relaxed text-zinc-200 text-[13.5px]">
              {textElement}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#07070b] text-white overflow-hidden relative font-sans">
      
      {/* Absolute Dynamic Ambient Blur Circles for modern background visual */}
      <div className="absolute top-[-100px] left-[-100px] w-72 h-72 bg-primary/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-72 h-72 bg-indigo-600/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <div className="relative bg-[#0d0d14]/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-orange-600 to-[#b91c1c] flex items-center justify-center shadow-lg shadow-primary/25 relative border border-white/10 shrink-0">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10b981] rounded-full border-2 border-[#0d0d14] shadow-sm animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-white leading-none">
                حكيم - مساعدك الفاخر
              </h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            </div>
            {/* Status tags */}
            <div className="flex items-center gap-1.5 mt-1 select-none">
              <span className="text-[9px] text-[#fda4af] font-black flex items-center gap-0.5 bg-rose-500/10 border border-rose-500/10 px-1 py-[0.5px] rounded-md shadow-inner">
                <Zap className="w-2.5 h-2.5 animate-pulse" /> ذكاء فوري
              </span>
              <span className="text-[9px] text-zinc-400 font-bold">• خبير الدراما</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle bell */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all active:scale-95 duration-200 cursor-pointer ${
              isSoundMuted 
                ? 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300' 
                : 'bg-[#b91c1c]/10 border-primary/20 text-primary hover:bg-[#b91c1c]/20'
            }`}
             title={isSoundMuted ? "تفعيل الأصوات" : "كتم الأصوات"}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Admin access overlay triggers */}
          {(localStorage.getItem('guest_chat_name') === 'bewCew,iDYgC@K6' || localStorage.getItem('guest_chat_name') === 'المدير 🛡️') && (
            <button 
              onClick={() => setShowApiKeySetting(true)}
              className="p-2 hover:bg-white/5 bg-zinc-900/40 rounded-xl text-zinc-500 hover:text-amber-500 transition-colors border border-white/5 cursor-pointer"
              title="إعدادات الحكيم"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          <button 
            onClick={onClose}
            className="p-2.5 bg-zinc-900/50 hover:bg-red-500/15 rounded-xl text-zinc-400 hover:text-rose-400 transition-all active:scale-95 duration-205 border border-white/5 cursor-pointer flex items-center justify-center group"
            title="إغلاق المحادثة"
          >
            <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>
      
      {/* Admin API Key configuration panel with glassmorphism */}
      <AnimatePresence>
        {showApiKeySetting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="absolute inset-0 z-50 bg-[#07070b]/96 backdrop-blur-xl p-6 flex flex-col items-center justify-center space-y-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center border border-amber-400/20 shadow-xl shadow-amber-500/10">
              <Key className="w-6 h-6 text-white" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">لوحة تحكم حكيم API</h3>
              <p className="text-[11px] text-zinc-500 font-bold">تحديث مفاتيح ونظم الذكاء الاصطناعي</p>
            </div>

            <div className="w-full max-w-xs space-y-4 max-h-[70vh] overflow-y-auto px-1 pb-4 scrollbar-none">
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-amber-500/90 font-bold leading-relaxed text-right">
                  ⚠️ إرشادات الموفرات:
                  <br />- مفتاح Gemini الكلاسيكي (AIza...) اختر <b>Google Gemini</b>.
                  <br />- الروابط التوافقية OpenAI أو كود (AQ...) اختر <b>OpenAI/Other</b>.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-extrabold pr-1.5">كود لوحة الإدارة 🔐</label>
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="الرقم السري للإدارة..."
                  className="w-full bg-[#0d0d14] border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 text-white font-mono placeholder-zinc-600 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-extrabold pr-1.5">جهة التشغيل (Provider)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setNewApiType('gemini')}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all duration-200 ${newApiType === 'gemini' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-[#0d0d14] border-white/5 text-zinc-500'}`}
                  >
                    Google Gemini
                  </button>
                  <button 
                    onClick={() => setNewApiType('openai')}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all duration-200 ${newApiType === 'openai' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-[#0d0d14] border-white/5 text-zinc-500'}`}
                  >
                    OpenAI Engine
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-extrabold pr-1.5">مفتاح الاتصال (API Key)</label>
                <input 
                  type="text"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={newApiType === 'gemini' ? "AIzaSy..." : "sk-..."}
                  className="w-full bg-[#0d0d14] border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 text-white font-mono placeholder-zinc-600 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              {newApiType === 'openai' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-extrabold pr-1.5">رابط النهاية (Base URL)</label>
                  <input 
                    type="text"
                    value={newApiBaseUrl}
                    onChange={(e) => setNewApiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-[#0d0d14] border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 text-white font-mono placeholder-zinc-600 focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-extrabold pr-1.5">الموديل (Model ID)</label>
                <input 
                  type="text"
                  value={newApiModel}
                  onChange={(e) => setNewApiModel(e.target.value)}
                  placeholder={newApiType === 'gemini' ? "gemini-1.5-flash" : "gpt-3.5-turbo"}
                  className="w-full bg-[#0d0d14] border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary/50 text-white font-mono placeholder-zinc-600 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              {settingStatus.type !== 'idle' && (
                <div className={`p-3 rounded-xl text-[10px] font-black text-center ${
                  settingStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                  settingStatus.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/25' :
                  'bg-zinc-900 border border-white/5 text-zinc-400 animate-pulse'
                }`}>
                  {settingStatus.msg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowApiKeySetting(false)}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-white text-[10.5px] font-black rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  onClick={async () => {
                    setSettingStatus({ type: 'loading', msg: 'جاري التحديث...' });
                    try {
                      const res = await fetch(getApiUrl('/api/v1/admin/gemini-key'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          password: adminPassword, 
                          key: newApiKey,
                          baseUrl: newApiBaseUrl,
                          model: newApiModel,
                          type: newApiType
                        })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setSettingStatus({ type: 'success', msg: data.message });
                        setTimeout(() => setShowApiKeySetting(false), 2000);
                      } else {
                        setSettingStatus({ type: 'error', msg: data.error || 'خطأ في البيئة' });
                      }
                    } catch (e) {
                      setSettingStatus({ type: 'error', msg: 'خطأ في الاتصال بالشبكة' });
                    }
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary to-orange-600 hover:opacity-90 text-white text-[10.5px] font-black rounded-xl transition-all shadow-lg shadow-primary/25 cursor-pointer"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning slow rate notifier */}
      <AnimatePresence>
        {showWaitWarning && (
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25 }}
            className="px-4 pt-3 pb-0 z-40 relative"
          >
            <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 p-3 rounded-2xl text-[10px] text-center font-black flex items-center justify-center gap-2 shadow-lg backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
              حكيم يقوم بتحضير إجابة ثرية ومفيدة لك الآن.. رجاءً انتظر ثوانٍ! ☕⏳
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Message Flow and Welcome Screen */}
      <div 
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-none relative"
      >
        
        {/* Welcome Dashboard when conversation has just started */}
        {messages.length <= 1 && !isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center py-6 text-center space-y-6"
          >
            {/* Glowing Central Ambient AI core */}
            <div className="relative flex items-center justify-center select-none py-4">
              <motion.div 
                animate={{ scale: [1, 1.1, 1], rotate: 360 }}
                transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary/30 to-indigo-600/30 border border-primary/20 flex items-center justify-center relative shadow-inner"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1c1917] to-zinc-950 flex items-center justify-center border border-white/15">
                  <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
                </div>
                {/* Orbital animated borders */}
                <div className="absolute inset-[-6px] rounded-full border border-dashed border-primary/10 animate-spin" style={{ animationDuration: '40s' }} />
                <div className="absolute inset-[-12px] rounded-full border border-[0.5px] border-indigo-500/5" />
              </motion.div>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent flex items-center justify-center gap-1.5 leading-none">
                أهلاً بك مع المستشار حكيم! 🍿
              </h1>
              <p className="text-[11px] text-zinc-400 font-bold max-w-xs mx-auto leading-relaxed">
                مساعد الذكاء الاصطناعي الأسرع لتلخيص وتحليل وترشيح أي كرتون أو مسلسل تركي، كوري، وعربي تفضله مباشرة وبضغطة واحدة!
              </p>
            </div>

            {/* Three feature badges of honor */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-sm select-none">
              <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                <Compass className="w-4 h-4 text-[#FDA4AF] mb-1.5" />
                <span className="text-[10px] font-black text-zinc-200">ترشيحات فورية</span>
                <span className="text-[8px] text-zinc-500 font-bold mt-0.5">حسب مزاجك</span>
              </div>
              <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                <Sparkle className="w-4 h-4 text-amber-400 mb-1.5" />
                <span className="text-[10px] font-black text-zinc-200">تحديثات حية</span>
                <span className="text-[8px] text-zinc-500 font-bold mt-0.5">متصل بالدليل</span>
              </div>
              <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                <Award className="w-4 h-4 text-emerald-400 mb-1.5" />
                <span className="text-[10px] font-black text-zinc-200">سرد قصصي</span>
                <span className="text-[8px] text-zinc-500 font-bold mt-0.5">تفاصيل دقيقة</span>
              </div>
            </div>

            {/* Presets Grid beautifully presented */}
            <div className="w-full max-w-sm pt-2 text-right space-y-3">
              <div className="text-[10px] text-zinc-400 font-bold flex items-center gap-1 px-1 justify-start">
                <Sparkles className="w-3 h-3 text-amber-400 fill-current" />
                <span>جرّب أن تسألني عبر الاختصارات التالية:</span>
              </div>
              <div className="flex flex-col gap-2">
                {PRESET_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSend(prompt.text)}
                    className={`p-3 text-right text-[11px] font-semibold border rounded-xl flex items-center justify-between transition-all cursor-pointer ${prompt.color} group duration-250`}
                  >
                    <span className="truncate pr-1 group-hover:text-white transition-colors">{prompt.text}</span>
                    <span className="text-sm scale-100 group-hover:scale-115 transition-transform shrink-0 ml-1.5">{prompt.icon}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Regular Message Logs */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const hasReactions = reactions[m.id] === 'liked';

          return (
            <motion.div 
              key={m.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`flex flex-col ${isUser ? 'items-start' : 'items-end'} relative group/msg overflow-visible`}
            >
              <div className={`relative max-w-[85%] rounded-2xl p-4.5 text-right text-xs shadow-lg transition-transform duration-300 ${
                isUser 
                  ? 'bg-gradient-to-r from-primary to-orange-600 border border-red-500/10 text-white rounded-tl-none font-medium'
                  : 'bg-[#111118]/85 border border-[#232338]/50 text-zinc-300 rounded-tr-none relative'
              }`}>
                
                {/* Floating dynamic heart containment for particles */}
                <div className="absolute overflow-visible pointer-events-none inset-0">
                  <AnimatePresence>
                    {particles.map((p) => {
                      if (!p.id.startsWith(m.id)) return null;
                      return (
                        <motion.span
                          key={p.id}
                          initial={{ opacity: 1, scale: 0.6, x: 0, y: 0 }}
                          animate={{ 
                            opacity: 0, 
                            scale: [1.2, 1.6, 0.9], 
                            x: p.x, 
                            y: p.y, 
                            rotate: (Math.random() - 0.5) * 60 
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                          className="absolute bottom-2 left-6 text-red-500 text-xs pointer-events-none"
                        >
                          ❤️
                        </motion.span>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Message Body Content parsing */}
                {parseMessageText(m.text)}

                {/* Highly-engineered custom Netflix-like recommendation cards */}
                {!isUser && matchAllNavigations(m.text).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    <div className="text-[10px] text-zinc-400 font-extrabold flex items-center gap-1.5 justify-start">
                      <Sparkles className="w-3.5 h-3.5 text-primary fill-current animate-pulse" />
                      <span>توجيه فوري لمشاهدة العمل:</span>
                    </div>
                    
                    <div className="flex flex-col gap-2.5">
                      {matchAllNavigations(m.text).map((ser) => (
                        <motion.div 
                          key={ser.id}
                          whileHover={{ y: -1 }}
                          className="flex items-center gap-3 bg-[#171722]/80 border border-white/5 rounded-2.5xl p-2.5 hover:border-primary/20 hover:bg-[#1a1a29] transition-all duration-300 text-right group/card"
                        >
                          <div className="relative w-15 aspect-[4/3] rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-950">
                            <img 
                              src={ser.image} 
                              alt={ser.title} 
                              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const currentSrc = e.currentTarget.src;
                                if (currentSrc.includes('/api/v1/image-proxy?url=')) {
                                  try {
                                    const urlPart = currentSrc.split('url=')[1];
                                    if (urlPart) {
                                      e.currentTarget.src = decodeURIComponent(urlPart);
                                      return;
                                    }
                                  } catch(err) {}
                                }
                                e.currentTarget.src = 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
                              }}
                            />
                            {/* Dark gradient overlay on thumb */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                          </div>
                          
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-[11px] font-black text-white truncate group-hover/card:text-primary transition-colors">
                                {ser.title}
                              </h4>
                              {ser.rating ? (
                                <span className="text-[8px] bg-amber-500/10 text-amber-400 font-black px-1 rounded flex items-center shrink-0">
                                  ★ {ser.rating}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 select-none">
                              <span className="text-[9px] text-zinc-400 font-bold truncate">
                                {ser.category || 'عام'}
                              </span>
                              {ser.episodes && ser.episodes.length > 0 && (
                                <span className="text-[8.5px] text-zinc-500 font-black">
                                  • {ser.episodes.length} حلقة
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              navigate('/watch', { state: { series: ser } });
                              onClose();
                            }}
                            className="shrink-0 bg-primary hover:bg-[#c10d10] text-white text-[10.5px] font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all duration-200 active:scale-95 shadow-lg shadow-primary/15 cursor-pointer border border-white/5"
                          >
                            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                            <span>تشغيل</span>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-toolbar with reaction heart on bot messages */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.03] select-none">
                  {/* Timestamp */}
                  <div className="text-[8.5px] text-zinc-500 font-bold font-mono">
                    {m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-1 ml-[-2px]">
                      {/* Thumbs up standard feedback */}
                      <button 
                        onClick={() => triggerHeartReaction(m.id)}
                        className={`p-1 rounded-md transition-all active:scale-90 flex items-center justify-center cursor-pointer hover:bg-white/5 ${
                          hasReactions ? 'text-rose-500 scale-105' : 'text-zinc-650 hover:text-zinc-400'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${hasReactions ? 'fill-current' : ''}`} />
                        {hasReactions && <span className="text-[9px] ml-0.5 font-bold">1</span>}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          );
        })}

        {/* Bouncing sparkles typing state */}
        {isTyping && (
          <div className="flex flex-col items-end">
            <div className="bg-[#111118]/85 border border-[#232338]/40 rounded-2xl p-4 rounded-tr-none flex items-center gap-2 relative">
              <div className="flex items-center gap-1 shrink-0 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[10px] text-zinc-450 font-black flex items-center gap-1 selection:bg-transparent">
                حكيم يفكر الآن <Sparkles className="w-3 h-3 text-amber-400 fill-current animate-pulse" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Snap Scroll Down Alert Widget */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-18 left-1/2 -translate-x-1/2 z-30 bg-[#0d0d14]/90 border border-white/5 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-xl backdrop-blur-md cursor-pointer active:scale-95"
          >
            صفّي لأسفل <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Spark suggestions widget (Shows up only when we have active messages) */}
      {messages.length > 1 && !isTyping && (
        <div className="px-3 py-2 bg-gradient-to-t from-[#0d0d14] to-transparent border-t border-white/5 select-none overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
          <button
            onClick={() => handleSend('اقترح لي عشوائياً')}
            className="inline-block py-1 px-2.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[9.5px] font-black transition-all cursor-pointer shrink-0"
          >
            🎲 اقتراح عشوائي
          </button>
          <button
            onClick={() => handleSend('مسلسلات مشابهة لفيلم رعب')}
            className="inline-block py-1 px-2.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[9.5px] font-black transition-all cursor-pointer shrink-0"
          >
            🧟 رعب وحماس
          </button>
          <button
            onClick={() => handleSend('أقصر مسلسل بقائمتكم')}
            className="inline-block py-1 px-2.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[9.5px] font-black transition-all cursor-pointer shrink-0"
          >
            ⚡ قصير وسريع
          </button>
          <button
            onClick={() => handleSend('أعلى مسلسل تقييماً هنا')}
            className="inline-block py-1 px-2.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[9.5px] font-black transition-all cursor-pointer shrink-0"
          >
            🏆 الترتيب الأفضل
          </button>
        </div>
      )}

      {/* Input container field form */}
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#0d0d14]/95 backdrop-blur-md border-t border-white/5 w-full z-20">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputVal);
          }}
          className="flex gap-2 items-center"
        >
          <div className="flex-1 relative flex items-center focus-within:ring-1 focus-within:ring-primary/25 rounded-2xl bg-[#141420] border border-white/5 focus-within:border-primary/40 transition-all">
            <input
              type="text"
              dir="rtl"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="اسأل حكيم عن قصة أي مسلسل، ترشيح، أو لخص قصة..."
              className="w-full bg-transparent border-0 px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none"
              disabled={isTyping}
            />
            {isTyping && (
              <span className="absolute left-3 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            )}
          </div>
          <button 
            type="submit"
            disabled={!inputVal.trim() || isTyping}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-orange-600 hover:opacity-90 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:opacity-40 active:scale-95 shadow-lg shadow-primary/10 shrink-0 cursor-pointer border border-white/5"
          >
            <Send className="w-3.5 h-3.5 rotate-180" />
          </button>
        </form>
      </div>

    </div>
  );
}
