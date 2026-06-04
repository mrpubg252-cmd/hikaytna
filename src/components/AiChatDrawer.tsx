import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Sparkles, MessageSquare, Bot, ArrowLeft, Play, AlertCircle, RefreshCw, Key, ShieldCheck } from 'lucide-react';
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

const PRESET_PROMPTS = [
  'اقترح لي مسلسل تركي رومانسي وحزين 💔',
  'عندكم مسلسل المتوحش؟ عطني قصته وتفاصيله 🐺',
  'أبي مسلسل أكشن وحرب تاريخي رهيب ⚔️',
  'دلني على مسلسل خليجي درامي من القائمة 📺'
];

export default function AiChatDrawer({ onClose }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'مرحباً بك! أنا **حكيم** ✨، مستشارك الذكي المتخصص في عالم الدراما والمسلسلات.\n\nيمكنك سؤالي عن قصة أي مسلسل، أبطاله، أو اطلب مني ترشيح مسلسل يناسب مزاجك من قائمة مسلسلات منصة **حكايتنا** وسآخذك إليه مباشرة! 🍿',
      timestamp: new Date()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWaitWarning, setShowWaitWarning] = useState(false);
  const requestActiveRef = useRef(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Admin API Key setting state
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiBaseUrl, setNewApiBaseUrl] = useState('');
  const [newApiModel, setNewApiModel] = useState('');
  const [newApiType, setNewApiType] = useState<'gemini' | 'openai'>('gemini');
  const [settingStatus, setSettingStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

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
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `عذراً! حكيم مشغول حالياً، الإدارة ستقوم بإصلاحه قريباً! 🤖❤️`,
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
        // Direct title match
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
    // 1. Remove markdown links of any form, e.g., [Text](URL or navigate)
    let cleaned = text.replace(/\[[^\]]+\]\([^\s\)]+\)/g, '');
    
    // 2. Remove standard URLs inside parentheses first, e.g. (https://...)
    cleaned = cleaned.replace(/\(\s*https?:\/\/[^\s\)]+\s*\)/gi, '');
    // Remove standalone URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s\)]+/gi, '');
    
    // 3. Remove raw navigate triggers with parentheses, e.g., (navigate:id)
    cleaned = cleaned.replace(/\(\s*navigate:[a-zA-Z0-9_\-]+\s*\)/gi, '');
    cleaned = cleaned.replace(/navigate:[a-zA-Z0-9_\-]+/gi, '');
    
    // 4. Remove empty brackets or parentheses that could remain
    cleaned = cleaned.replace(/\[\]|\(\)/g, '');
    
    // 5. Normalise spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  };

  const parseMessageText = (text: string) => {
    const cleaned = cleanTextOfLinks(text);
    
    // Apply simple bolding **text**
    const contentParts = cleaned.split('**') || [];
    return (
      <div className="space-y-2">
        <span className="whitespace-pre-wrap leading-relaxed text-sm text-gray-200">
          {contentParts.map((sub, sIdx) => 
            sIdx % 2 === 1 ? (
              <strong key={sIdx} className="font-black text-amber-400 drop-shadow-sm">
                {sub}
              </strong>
            ) : (
              sub
            )
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="bg-[#101017] border-b border-white/5 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/20 relative">
            <Bot className="w-5.5 h-5.5 text-white animate-pulse" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#101017]" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              حكيم - مستشارك الذكي
              <Sparkles className="w-3.5 h-3.5 text-primary fill-current" />
            </h2>
            <p className="text-[10px] text-zinc-400 font-bold">خبير المسلسلات والترشيحات الذكية</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(localStorage.getItem('guest_chat_name') === 'bewCew,iDYgC@K6' || localStorage.getItem('guest_chat_name') === 'المدير 🛡️') && (
            <button 
              onClick={() => setShowApiKeySetting(true)}
              className="p-1.5 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-amber-500 transition-colors border border-white/5"
              title="إعدادات الحكيم"
            >
              <Key className="w-4.4 h-4.4" />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Admin API Key Overlayer */}
      <AnimatePresence>
        {showApiKeySetting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-md p-6 flex flex-col items-center justify-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Key className="w-8 h-8 text-primary" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-white">إعدادات حكيم (Hakeem API)</h3>
              <p className="text-xs text-zinc-500 font-bold">تحديث مفتاح التشغيل للمساعد الذكي</p>
            </div>

            <div className="w-full max-w-xs space-y-4 max-h-[70vh] overflow-y-auto px-1 pb-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-amber-500 font-bold leading-relaxed">
                  ⚠️ تأكد من اختيار النوع الصحيح:
                  <br />- الـ API Key العادي (AIza...) اختر <b>Google Gemini</b>.
                  <br />- الـ Token (AQ...) أو الروابط الخارجية اختر <b>OpenAI/Other</b>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black px-1">كود الإدارة</label>
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="أدخل كود الإدارة هنا..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-primary/50 transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black px-1">نوع المزود (Provider Type)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setNewApiType('gemini')}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all ${newApiType === 'gemini' ? 'bg-primary/20 border-primary text-primary' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
                  >
                    Google Gemini
                  </button>
                  <button 
                    onClick={() => setNewApiType('openai')}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all ${newApiType === 'openai' ? 'bg-purple-500/20 border-purple-500 text-purple-500' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
                  >
                    OpenAI/Other
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black px-1">API Key</label>
                <input 
                  type="text"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={newApiType === 'gemini' ? "AIzaSy..." : "sk-..."}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-primary/50 transition-all font-mono"
                />
              </div>

              {newApiType === 'openai' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-black px-1">Base URL (للـ OpenAI المتوافق)</label>
                  <input 
                    type="text"
                    value={newApiBaseUrl}
                    onChange={(e) => setNewApiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-primary/50 transition-all font-mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 font-black px-1">اسم الموديل (اختياري)</label>
                <input 
                  type="text"
                  value={newApiModel}
                  onChange={(e) => setNewApiModel(e.target.value)}
                  placeholder={newApiType === 'gemini' ? "gemini-1.5-flash" : "gpt-3.5-turbo"}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-primary/50 transition-all font-mono"
                />
              </div>

              {settingStatus.type !== 'idle' && (
                <div className={`p-3 rounded-xl text-[10px] font-black text-center ${
                  settingStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                  settingStatus.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {settingStatus.msg}
                </div>
              )}

              <div className="flex gap-2 pt-2 pb-4">
                <button 
                  onClick={() => setShowApiKeySetting(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black rounded-xl transition-all"
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
                        setSettingStatus({ type: 'error', msg: data.error || 'خطأ في التحديث' });
                      }
                    } catch (e) {
                      setSettingStatus({ type: 'error', msg: 'فشل في الاتصال بالسيرفر' });
                    }
                  }}
                  className="flex-1 py-3 bg-primary hover:bg-red-700 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Banner */}
      <AnimatePresence>
        {showWaitWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-4 pt-4 pb-0 z-40"
          >
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-2.5 rounded-xl text-[10px] text-center font-bold">
              حكيم عليه ضغط الان يرجى الانتضار حتى يرد عليك حكيم
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((m) => (
          <div 
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'}`}
          >
            <div className={`max-w-[85%] rounded-2xl p-4.5 text-right text-xs shadow-md ${
              m.role === 'user' 
                ? 'bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none font-bold'
                : 'bg-[#12121c] border border-primary/10 text-zinc-300 rounded-tr-none'
            }`}>
              {/* Message Content */}
              {parseMessageText(m.text)}

              {/* Dynamic Series Recommendation Cards */}
              {m.role === 'model' && matchAllNavigations(m.text).length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-2 select-none">
                  <div className="text-[10px] text-zinc-450 font-black flex items-center gap-1.5 justify-start">
                    <Sparkles className="w-3.5 h-3.5 text-primary fill-current animate-pulse" />
                    <span>انقر للمشاهدة الفورية:</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {matchAllNavigations(m.text).map((ser) => (
                      <div 
                        key={ser.id}
                        className="flex items-center gap-2.5 bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 hover:border-white/10 hover:bg-zinc-900/80 transition-all duration-300 cursor-default text-right"
                      >
                        <div className="relative w-14 aspect-[4/3] rounded-lg overflow-hidden shrink-0 border border-white/5 bg-zinc-950">
                          <img 
                            src={ser.image} 
                            alt={ser.title} 
                            className="w-full h-full object-cover"
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
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-[11px] font-black text-white truncate">
                            {ser.title}
                          </h4>
                          <span className="text-[10px] text-zinc-500 font-bold mt-0.5">
                            {ser.category}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            navigate('/watch', { state: { series: ser } });
                            onClose();
                          }}
                          className="shrink-0 bg-primary hover:bg-red-700 text-white text-[10px] font-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-1 transition-all duration-200 active:scale-95 shadow-lg shadow-primary/20 cursor-pointer border border-white/5"
                        >
                          <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                          <span>مشاهدة</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time display */}
              <div className="text-[9px] text-zinc-500 font-bold mt-2.5 text-left font-mono">
                {m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col items-end">
            <div className="bg-[#12121c] border border-primary/10 rounded-2xl p-4.5 rounded-tr-none flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Presets Grid */}
      {messages.length === 1 && (
        <div className="p-4 bg-[#0d0d12] border-t border-white/5 space-y-2">
          <div className="text-[10px] text-zinc-400 font-black flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary fill-current" />
            تأثيرات سريعة واقتراحات مقترحة لتبدأ:
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {PRESET_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="p-2 text-right text-[10px] bg-white/5 border border-white/5 hover:border-primary/20 hover:bg-primary/5 rounded-xl text-zinc-300 hover:text-white transition-all font-bold"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#101017] border-t border-white/5 w-full">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputVal);
          }}
          className="flex gap-2 items-center"
        >
          <input
            type="text"
            dir="rtl"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="اسأل حكيم عن أي مسلسل أو اطلب اقتراحاً..."
            className="flex-1 bg-zinc-900 border border-white/5 focus:border-primary/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none transition-all"
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputVal.trim() || isTyping}
            className="w-10 h-10 rounded-2xl bg-primary hover:bg-[#c10d10] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-primary active:scale-95 shadow-lg shadow-primary/10 shrink-0"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
}
