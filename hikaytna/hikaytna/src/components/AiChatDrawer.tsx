import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Sparkles, MessageSquare, Bot, ArrowLeft, Play, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchAllSeries } from '../services/dataService';
import { Series } from '../services/firebase';

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

// ============ إعدادات DeepSeek - لا تحتاج أي مفتاح خارجي ============
const BASE_URL = "https://aiapiv2.pekpik.com/v1";
const MODEL = "deepseek-chat";
const GITHUB_RAW = "https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/main/README.md";

// ذاكرة تخزين مؤقت عالمية
const WORKING_KEY_CACHE = new Map<number, number>();

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
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // حالة المفاتيح
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [isRefreshingKeys, setIsRefreshingKeys] = useState(false);
  const [keysStatus, setKeysStatus] = useState<'loading' | 'ready' | 'empty'>('loading');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ============ سحب المفاتيح تلقائياً ============
  const fetchFreshKeys = async (silent = false) => {
    if (!silent) setIsRefreshingKeys(true);
    setKeysStatus('loading');
    
    try {
      const response = await fetch(GITHUB_RAW, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();

      const newKeys: string[] = [];
      // الأولوية لـ deepseek-chat
      const regex = /(sk-[a-zA-Z0-9]{48})\s+deepseek-chat/g;
      let match;
      while ((match = regex.exec(markdown)) !== null) {
        if (!newKeys.includes(match[1])) newKeys.push(match[1]);
      }

      // خطة بديلة: smart-chat
      if (newKeys.length === 0) {
        const fallback = /(sk-[a-zA-Z0-9]{48})\s+smart-chat/g;
        while ((match = fallback.exec(markdown)) !== null) {
          if (!newKeys.includes(match[1])) newKeys.push(match[1]);
        }
      }

      if (newKeys.length > 0) {
        setApiKeys(newKeys);
        setCurrentKeyIndex(0);
        WORKING_KEY_CACHE.clear();
        setKeysStatus('ready');
        console.log(`✅ [حكيم] ${newKeys.length} مفتاح DeepSeek جاهز`);
      } else {
        setKeysStatus('empty');
        console.warn('⚠️ [حكيم] لا مفاتيح متاحة حالياً');
      }
    } catch (err) {
      console.error('❌ [حكيم] فشل سحب المفاتيح:', err);
      setKeysStatus('empty');
    } finally {
      if (!silent) setIsRefreshingKeys(false);
    }
  };

  useEffect(() => {
    async function loadSeries() {
      try {
        const list = await fetchAllSeries();
        setSeriesList(list);
      } catch (e) {
        console.error('Error fetching series list:', e);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadSeries();
    fetchFreshKeys(true); // سحب صامت عند التحميل
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ============ استدعاء DeepSeek API مباشرة ============
  const callDeepSeekAPI = async (
    message: string, 
    keyIdx: number
  ): Promise<{ success: boolean; reply?: string; error?: string }> => {
    if (keyIdx >= apiKeys.length) {
      return { success: false, error: "لا مفاتيح متاحة" };
    }

    const apiKey = apiKeys[keyIdx];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      // بناء سياق المسلسلات
      const seriesContext = seriesList.length > 0 
        ? seriesList.map(s => `- ${s.title} (${s.category}) [id: ${s.id}]`).join('\n')
        : 'لا توجد مسلسلات محملة بعد.';

      const systemPrompt = `أنت "حكيم"، مستشار ذكي متخصص في مسلسلات منصة "حكايتنا".
مهمتك:
1. أجب بالعربية حصراً وبشكل طبيعي وودود.
2. عند ترشيح مسلسل موجود في القائمة، أضف رابطه المباشر بهذا التنسيق بالضبط: [العنوان](navigate:ID).
3. إذا سألك المستخدم عن مسلسل غير موجود، أخبره بلطف واقترح بديلاً من القائمة.
4. استخدم الإيموجي باعتدال. لا تذكر أنك DeepSeek أو أي تفاصيل تقنية. أنت "حكيم" فقط.
5. إذا طلب منك المستخدم شيئاً خارج نطاق المسلسلات، أجب بأدب أنك متخصص في مسلسلات حكايتنا فقط.

قائمة المسلسلات المتاحة:
${seriesContext}`;

      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Connection": "keep-alive"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 800
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errBody.substring(0, 100)}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;

      if (!reply || reply.trim().length === 0) {
        throw new Error("رد فارغ من النموذج");
      }

      // تخزين المفتاح الناجح في الذاكرة المؤقتة
      WORKING_KEY_CACHE.set(keyIdx, Date.now());
      return { success: true, reply };

    } catch (err: any) {
      clearTimeout(timeout);
      WORKING_KEY_CACHE.delete(keyIdx);
      return { success: false, error: err.message };
    }
  };

  // ============ تدوير تلقائي سريع ============
  const sendWithAutoRotate = async (
    message: string
  ): Promise<{ success: boolean; reply?: string }> => {
    // إذا ما فيه مفاتيح، اسحب جديدة
    if (apiKeys.length === 0) {
      await fetchFreshKeys(true);
    }

    // 1. تجربة المفاتيح المخزنة مؤقتاً أولاً (الأسرع)
    const cacheEntries = Array.from(WORKING_KEY_CACHE.entries());
    // ترتيب الأحدث أولاً
    cacheEntries.sort((a, b) => b[1] - a[1]);
    
    for (const [idx, timestamp] of cacheEntries) {
      if (Date.now() - timestamp < 300000 && idx < apiKeys.length) {
        setCurrentKeyIndex(idx);
        const result = await callDeepSeekAPI(message, idx);
        if (result.success) return { success: true, reply: result.reply };
      }
    }

    // 2. تجربة جميع المفاتيح
    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (currentKeyIndex + i) % apiKeys.length;
      setCurrentKeyIndex(idx);
      const result = await callDeepSeekAPI(message, idx);
      if (result.success) return { success: true, reply: result.reply };
    }

    // 3. فشل كل شيء، اسحب مفاتيح جديدة وحاول مرة أخيرة
    await fetchFreshKeys(true);
    if (apiKeys.length > 0) {
      const result = await callDeepSeekAPI(message, 0);
      if (result.success) return { success: true, reply: result.reply };
    }

    return { success: false };
  };

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

    try {
      const result = await sendWithAutoRotate(textToSend);
      setIsTyping(false);

      if (result.success && result.reply) {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: result.reply,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);

        // التنقل التلقائي
        const navMatch = result.reply.match(/\(navigate:([a-zA-Z0-9_\-]+)\)/);
        if (navMatch && navMatch[1]) {
          const targetId = navMatch[1];
          const found = seriesList.find(s => s.id === targetId);
          if (found) {
            setTimeout(() => {
              navigate('/watch', { state: { series: found } });
              onClose();
            }, 2500);
          }
        }
      } else {
        throw new Error('جميع المفاتيح مستنزفة');
      }
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: '⚠️ عذراً، جميع مفاتيح الذكاء الاصطناعي مستنزفة مؤقتاً.\n\n🔹 تم سحب مفاتيح جديدة تلقائياً.\n🔹 اضغط على زر **🔄 تحديث** في الأعلى لتجربة يدوية.\n🔹 أو حاول مجدداً بعد قليل.',
          timestamp: new Date()
        }
      ]);
      fetchFreshKeys(true);
    }
  };

  const matchAllNavigations = (text: string): Series[] => {
    const ids: string[] = [];
    const regex = /navigate:([a-zA-Z0-9_\-]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!ids.includes(match[1])) ids.push(match[1]);
    }
    return ids.map(id => seriesList.find(s => s.id === id)).filter((s): s is Series => !!s);
  };

  const parseMessageText = (text: string) => {
    const regex = /\[([^\]]+)\]\(navigate:([a-zA-Z0-9_\-]+)\)/g;
    const parts: { type: 'text' | 'nav-link'; content?: string; title?: string; id?: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, matchIndex) });
      }
      parts.push({ type: 'nav-link', title: match[1], id: match[2] });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return (
      <div className="space-y-2">
        {parts.map((p, idx) => {
          if (p.type === 'nav-link') {
            const seriesObj = seriesList.find(s => s.id === p.id);
            return (
              <button
                key={idx}
                onClick={() => {
                  if (seriesObj) {
                    navigate('/watch', { state: { series: seriesObj } });
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 my-1.5 bg-gradient-to-r from-primary to-orange-600 text-white font-black text-xs rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 border border-white/20 ml-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {p.title}
              </button>
            );
          } else {
            const contentParts = p.content?.split('**') || [];
            return (
              <span key={idx} className="whitespace-pre-wrap leading-relaxed">
                {contentParts.map((sub, sIdx) =>
                  sIdx % 2 === 1 ? <strong key={sIdx} className="font-extrabold text-white">{sub}</strong> : sub
                )}
              </span>
            );
          }
        })}
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
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#101017] ${
              keysStatus === 'ready' ? 'bg-emerald-500' : keysStatus === 'loading' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              حكيم - مستشارك الذكي
              <Sparkles className="w-3.5 h-3.5 text-primary fill-current" />
            </h2>
            <p className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
              {keysStatus === 'ready' && <Wifi className="w-3 h-3 text-emerald-500" />}
              {keysStatus === 'empty' && <WifiOff className="w-3 h-3 text-red-500" />}
              {keysStatus === 'loading' && <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />}
              {keysStatus === 'ready' ? `${apiKeys.length} مفاتيح DeepSeek` :
               keysStatus === 'loading' ? 'جاري تحميل المفاتيح...' :
               'لا توجد مفاتيح - اضغط تحديث'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchFreshKeys(false)}
            disabled={isRefreshingKeys}
            className="p-1.5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5 disabled:opacity-40"
            title="سحب مفاتيح جديدة من المستودع"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingKeys ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

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
              {parseMessageText(m.text)}

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
                        onClick={() => {
                          navigate('/watch', { state: { series: ser } });
                          onClose();
                        }}
                        className="flex items-center gap-2.5 bg-zinc-900/60 border border-white/5 rounded-xl p-1.5 hover:border-primary/40 hover:bg-zinc-900 transition-all duration-300 cursor-pointer group/navcard text-right"
                      >
                        <div className="relative w-16 aspect-[4/3] rounded-lg overflow-hidden shrink-0 border border-white/5 bg-zinc-950">
                          <img
                            src={ser.image}
                            alt={ser.title}
                            className="w-full h-full object-cover group-hover/navcard:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/navcard:opacity-100 transition-opacity">
                            <Play className="w-3.5 h-3.5 text-white fill-current" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-[11px] font-black text-white group-hover/navcard:text-primary transition-colors truncate">
                            {ser.title}
                          </h4>
                          <span className="text-[9px] text-zinc-550 font-bold mt-0.5">
                            {ser.category}
                          </span>
                        </div>
                        <div className="pl-1.5 shrink-0">
                          <span className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary group-hover/navcard:bg-primary group-hover/navcard:text-white transition-all flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[9px] text-zinc-500 font-bold mt-2.5 text-left font-mono">
                {m.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col items-end">
            <div className="bg-[#12121c] border border-primary/10 rounded-2xl p-4.5 rounded-tr-none flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
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
            اقتراحات سريعة لتبدأ:
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