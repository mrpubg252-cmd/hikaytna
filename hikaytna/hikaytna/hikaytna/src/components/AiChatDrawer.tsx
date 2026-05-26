import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Sparkles, MessageSquare, Bot, ArrowLeft, Play, AlertCircle, RefreshCw } from 'lucide-react';
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

    try {
      // Build history payload
      const historyPayload = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      // Map series down to standard metadata to avoid sending redundant info
      const simplifiedSeries = seriesList.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category
      }));

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          seriesList: simplifiedSeries
        })
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.status) {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: data.text,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);

        // Auto transition check: if the AI explicitly wants us to auto transition
        // We look for direct `(navigate:ID)` format.
        const navMatch = data.text.match(/\(navigate:([a-zA-Z0-9_\-]+)\)/);
        if (navMatch && navMatch[1]) {
          const targetId = navMatch[1];
          const found = seriesList.find(s => s.id === targetId);
          if (found) {
            // Wait 2.5s for the user to read the AI text, then navigate
            setTimeout(() => {
              navigate('/watch', { state: { series: found } });
              onClose();
            }, 2500);
          }
        }
      } else {
        throw new Error(data.error || 'فشل الاتصال بالذكاء الاصطناعي');
      }
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `⚠️ عذراً، حصل عطل أثناء معالجة رسالتك بالذكاء الاصطناعي: ${err.message || 'يرجى المحاولة مجدداً.'}`,
          timestamp: new Date()
        }
      ]);
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

  const parseMessageText = (text: string) => {
    // Escape markdown tags and render them as JSX elements beautifully
    // 1. Split body by link references `[title](navigate:id)`
    const regex = /\[([^\]]+)\]\(navigate:([a-zA-Z0-9_\-]+)\)/g;
    const parts = [];
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
            // Apply simple bolding **text**
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
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5"
        >
          <X className="w-5 h-5" />
        </button>
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
