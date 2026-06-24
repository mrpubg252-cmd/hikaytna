import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Send, Sparkles, MessageSquare, Bot, Play, 
  Trash2, Volume2, VolumeX, Image as ImageIcon, Mic, X, 
  RefreshCw, Heart, ThumbsUp, ChevronLeft, HelpCircle
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAllSeries } from '../services/dataService';
import { Series } from '../services/firebase';
import { getApiUrl } from '../lib/apiConfig';
import { navigateToWatchOrAds } from '../utils/watchNavigation';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string; // base64 string for displaying sent image
  audio?: boolean; // indicator if audio was sent
}

interface SuggestedPrompt {
  text: string;
  icon: string;
  color: string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { text: 'اقترح لي مسلسل تركي رومانسي وحزين 💔', icon: '💖', color: 'from-pink-500/10 to-rose-500/10 border-rose-500/20 text-rose-300' },
  { text: 'عندكم مسلسل المتوحش؟ عطني قصته 🐺', icon: '🐺', color: 'from-blue-500/10 to-indigo-500/10 border-indigo-500/20 text-indigo-300' },
  { text: 'أبي مسلسل أكشن وحرب تاريخي رهيب ⚔️', icon: '⚔️', color: 'from-red-500/10 to-orange-500/10 border-red-500/20 text-red-300' },
  { text: 'دلني على مسلسل درامي عائلي راقي 📺', icon: '📺', color: 'from-amber-500/10 to-yellow-500/10 border-yellow-500/20 text-amber-300' },
];

export default function HakeemScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  
  // Image attachment state
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // base64
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sound/TTS state
  const [isSoundMuted, setIsSoundMuted] = useState(() => {
    return localStorage.getItem('hakeem_sound_muted') === 'true';
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Heart animation / rating reactions
  const [reactions, setReactions] = useState<Record<string, 'liked' | null>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);
  const waveformIntervalRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize Speech Synthesis and Load Series List
  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const greetingMsg: Message = {
      id: 'welcome',
      role: 'model',
      text: 'أهلاً بك يا بطل! أنا **حكيم** ✨، مستشارك الذكي والخبير الدرامي على منصة **حكايتنا**.\n\nتبي مسلسل يسليك؟ تذكر لقطة أو قصة وناسي الاسم؟ اسألني أو ارسل لي لقطة أو تحدث معي صوتياً، وببحث لك عنها بثواني وبوديك لها مباشرة! 🍿🚀',
      timestamp: new Date()
    };
    setMessages([greetingMsg]);

    async function loadSeries() {
      try {
        const list = await fetchAllSeries();
        setSeriesList(list);
      } catch (e) {
        console.error('Error fetching series list for Hakeem:', e);
      } finally {
        setLoadingSeries(false);
      }
    }
    loadSeries();

    return () => {
      stopSpeaking();
      clearInterval(recordTimerRef.current);
      clearInterval(waveformIntervalRef.current);
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle Speech (TTS) Output
  const speakText = (text: string) => {
    if (isSoundMuted || !synthRef.current) return;
    
    stopSpeaking();

    // Clean markdown and action links from text to read beautifully
    let cleanedText = text
      .replace(/\[[^\]]+\]\(navigate:[^\s\)]+\)/g, (match) => {
        const innerText = match.match(/\[([^\]]+)\]/);
        return innerText ? innerText[1] : '';
      })
      .replace(/[\*\#_`~]/g, '') // remove markdown symbols
      .replace(/navigate:[a-zA-Z0-9_\-]+/gi, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'ar-SA';
    
    // Attempt to locate a natural Arabic voice
    const voices = synthRef.current.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith('ar')) || voices.find(v => v.name.toLowerCase().includes('arabic'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };

  const toggleSound = () => {
    const nextState = !isSoundMuted;
    setIsSoundMuted(nextState);
    localStorage.setItem('hakeem_sound_muted', String(nextState));
    if (nextState) {
      stopSpeaking();
    }
  };

  // Helper to trigger audio chimes using Web Audio API
  const playChime = (type: 'send' | 'receive' | 'heart') => {
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
      // autoplay block handler
    }
  };

  // Voice recording engine
  const startRecording = async () => {
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const cleanBase64 = base64String.split(',')[1];
          setAudioBase64(cleanBase64);
        };

        // stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration counter
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Waveform simulator for beautiful UI feedback
      waveformIntervalRef.current = setInterval(() => {
        setWaveformBars(Array.from({ length: 15 }).map(() => Math.random() * 32 + 4));
      }, 100);

    } catch (err) {
      console.error('Microphone access failed:', err);
      alert('عذراً، يجب السماح باستخدام المايكروفون لتسجيل الصوت 🎙️');
    }
  };

  const stopRecordingAndKeep = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
      clearInterval(waveformIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioBase64(null);
    clearInterval(recordTimerRef.current);
    clearInterval(waveformIntervalRef.current);
  };

  // Image Attachment Handlers
  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح 🖼️');
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAttachedImage(base64String);
    };
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    setImageMimeType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Message Sender
  const handleSend = async (textToSend: string, forceVoiceBase64?: string) => {
    const finalMsg = textToSend.trim();
    const hasVoice = !!(forceVoiceBase64 || audioBase64);
    
    if (!finalMsg && !attachedImage && !hasVoice) return;
    if (isTyping) return;

    playChime('send');
    stopSpeaking();

    const userMessageId = Date.now().toString();
    const userMsg: Message = {
      id: userMessageId,
      role: 'user',
      text: finalMsg || (hasVoice ? '🎤 رسالة صوتية' : '🖼️ لقطة مرفقة'),
      timestamp: new Date(),
      image: attachedImage || undefined,
      audio: hasVoice || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    
    // Clear input panel states
    setInputVal('');
    setAttachedImage(null);
    setAudioBase64(null);
    setAudioBlob(null);
    setImageMimeType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsTyping(true);

    try {
      // Construct history
      const historyPayload = messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        text: m.text
      }));

      // Set up multimodal payload if available
      const imagePayload = attachedImage ? {
        data: attachedImage.split(',')[1],
        mimeType: imageMimeType || 'image/jpeg'
      } : undefined;

      const audioPayload = (forceVoiceBase64 || audioBase64) ? {
        data: forceVoiceBase64 || audioBase64,
        mimeType: 'audio/webm'
      } : undefined;

      const response = await fetch(getApiUrl('/api/v1/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMsg || (audioPayload ? "استمع لرسالتي الصوتية وأجبني بحكمة ولطف." : "تفحص هذه اللقطة وأخبرني ما هذا المسلسل وبصيرة عنه بالتفصيل."),
          history: historyPayload,
          seriesList: seriesList,
          image: imagePayload,
          audio: audioPayload
        })
      });

      if (!response.ok) throw new Error('Failed to connect to Hakeem service');

      const data = await response.json();
      const replyText = data.text || '';

      if (replyText) {
        playChime('receive');
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: replyText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
        
        // Speak aloud automatically if not muted
        speakText(replyText);
      } else {
        throw new Error('Empty response');
      }

    } catch (err) {
      console.error('Hakeem chat error:', err);
      playChime('receive');
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: 'عذراً! حكيم واجه ضغطاً مؤقتاً، أرجوك حاول مجدداً وسأكون جاهزاً فوراً لخدمتك! 🤖❤️',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Heart Reaction
  const handleReaction = (msgId: string) => {
    const current = reactions[msgId];
    setReactions(prev => ({
      ...prev,
      [msgId]: current === 'liked' ? null : 'liked'
    }));
    if (current !== 'liked') {
      playChime('heart');
    }
  };

  // Link Parser Helper
  const parseNavigationLinks = (text: string): Series[] => {
    const matches: Series[] = [];
    const regex = /navigate:([a-zA-Z0-9_\-]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const id = match[1];
      const series = seriesList.find(s => s.id === id);
      if (series && !matches.some(m => m.id === series.id)) {
        matches.push(series);
      }
    }

    // Secondary name match fallback
    seriesList.forEach(s => {
      if (s.title && s.title.length > 2 && text.includes(s.title)) {
        if (!matches.some(m => m.id === s.id)) {
          matches.push(s);
        }
      }
    });

    return matches;
  };

  // Text cleaner
  const cleanMessageText = (text: string): string => {
    let clean = text.replace(/\[([^\]]+)\]\(navigate:[^\s\)]+\)/g, '$1');
    clean = clean.replace(/navigate:[a-zA-Z0-9_\-]+/gi, '');
    clean = clean.replace(/[\(\)\[\]]/g, '');
    return clean;
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Header Container */}
      <header className="sticky top-0 z-[100] backdrop-blur-xl bg-[#07070a]/80 border-b border-white/5 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all text-zinc-300">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center relative shadow-[0_0_15px_rgba(229,9,20,0.2)]">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#07070a]" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-1">
                حكيم الذكي
                <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-md">مستشار الدراما</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 font-semibold">متصل الآن ومستعد لمساعدتك ⚡</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <button 
            onClick={toggleSound}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              isSoundMuted 
                ? 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200' 
                : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
            }`}
            title={isSoundMuted ? "تشغيل الصوت" : "كتم صوت حكيم"}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Messages & Suggestions Chat Grid */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-6 flex flex-col relative z-10"
      >
        {messages.length <= 1 && (
          <div className="max-w-2xl mx-auto w-full text-center space-y-8 my-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex p-4 rounded-[2.5rem] bg-gradient-to-br from-primary/15 to-indigo-600/5 border border-primary/15 shadow-[0_0_40px_rgba(229,9,20,0.1)] mb-2"
            >
              <Bot className="w-12 h-12 text-primary" />
            </motion.div>
            
            <div className="space-y-3">
              <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white">دردش مع حكيم منصة حكايتنا!</h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium leading-relaxed max-w-md mx-auto">
                اسأل حكيم عن تفاصيل المسلسل الذي تفكر فيه، أو ارفع لقطة شاشة من مشهد يعجبك، أو تحدث صوتياً لمعرفة العمل فوراً!
              </p>
            </div>

            {/* Suggestions list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-right">
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.text)}
                  className={`p-4 rounded-2xl border text-xs font-semibold text-zinc-300 flex items-center gap-3 bg-[#0a0a0f] hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all ${p.color}`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-right leading-relaxed flex-1">{p.text}</span>
                  <ChevronLeft className="w-4 h-4 shrink-0 opacity-40" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 1 && (
          <div className="max-w-3xl mx-auto w-full space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isBot = m.role === 'model';
                const directWatchSeries = isBot ? parseNavigationLinks(m.text) : [];
                const cleanText = isBot ? cleanMessageText(m.text) : m.text;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className={`flex items-start gap-3 ${!isBot ? 'justify-end' : ''}`}
                  >
                    {/* Bot avatar */}
                    {isBot && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className="space-y-2 max-w-[85%] sm:max-w-[75%]">
                      {/* Message Bubble */}
                      <div 
                        className={`rounded-[1.5rem] p-4 text-xs sm:text-sm font-semibold leading-relaxed shadow-md relative group select-text ${
                          isBot 
                            ? 'bg-[#0a0a0f] border border-white/5 text-zinc-100 rounded-tr-none' 
                            : 'bg-gradient-to-br from-primary to-red-700 text-white rounded-tl-none'
                        }`}
                      >
                        {/* Sent image display */}
                        {m.image && (
                          <div className="mb-3 max-w-full rounded-xl overflow-hidden border border-white/10 shadow-inner">
                            <img src={m.image} alt="Sent Asset" className="max-h-[220px] object-cover w-full" />
                          </div>
                        )}

                        {/* Text formatting support */}
                        <div className="whitespace-pre-wrap">
                          {cleanText}
                        </div>

                        {/* Interactive Audio Indicator */}
                        {m.audio && (
                          <div className="mt-2 flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full w-fit">
                            <Mic className="w-3.5 h-3.5 text-rose-300" />
                            <span className="text-[10px] text-zinc-100">رسالة صوتية مسموعة</span>
                          </div>
                        )}

                        {/* Reaction details */}
                        <div className="absolute left-2 -bottom-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => handleReaction(m.id)}
                            className={`p-1.5 rounded-full transition-all border cursor-pointer hover:scale-110 ${
                              reactions[m.id] === 'liked' 
                                ? 'bg-primary/20 border-primary text-primary' 
                                : 'bg-black/80 border-white/5 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-3 h-3 ${reactions[m.id] === 'liked' ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Series Instant Actions (Quick Watching) */}
                      {isBot && directWatchSeries.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {directWatchSeries.map((series) => (
                            <button
                              key={series.id}
                              onClick={() => navigateToWatchOrAds(series, navigate)}
                              className="px-3 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-full text-[10px] sm:text-xs font-bold text-primary flex items-center gap-2 cursor-pointer transition-all animate-pulse"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>شاهد مسلسل "{series.title}" الآن 🍿</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User Profile Avatar */}
                    {!isBot && (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10 mt-1">
                        <span className="text-xs">👤</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {isTyping && (
          <div className="max-w-3xl mx-auto w-full flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shrink-0 mt-1">
              <Sparkles className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-[1.5rem] rounded-tr-none px-4 py-3.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input panel container */}
      <footer className="sticky bottom-0 z-50 bg-gradient-to-t from-[#050507] via-[#07070a] to-[#07070a]/90 border-t border-white/5 px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-3">
          
          {/* Dynamic Image/Audio Attachments Previews */}
          <AnimatePresence>
            {(attachedImage || audioBlob) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap items-center gap-3 bg-[#0c0c14] border border-white/5 p-3 rounded-2xl overflow-hidden"
              >
                {/* Image Preview Thumbnail */}
                {attachedImage && (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shadow-inner group">
                    <img src={attachedImage} alt="Attachment" className="w-full h-full object-cover" />
                    <button 
                      onClick={removeAttachedImage}
                      className="absolute top-1 right-1 p-1 bg-black/80 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Voice Preview indicator */}
                {audioBlob && (
                  <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-xl flex-1 justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                      <span className="text-xs text-zinc-300 font-semibold">جاهز لإرسال التسجيل الصوتي 🎤</span>
                    </div>
                    <button 
                      onClick={cancelRecording}
                      className="text-zinc-400 hover:text-white transition-colors text-xs font-bold shrink-0 flex items-center gap-1 p-1"
                    >
                      <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-500" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Interactive Input Grid */}
          <div className="flex items-center gap-2">
            
            {/* Image Attachment Button */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={triggerImageUpload}
              disabled={isRecording}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
              title="إرفاق لقطة أو صورة"
            >
              <ImageIcon className="w-4.5 h-4.5 text-zinc-400 hover:text-primary transition-all" />
            </button>

            {/* Voice Recorder button */}
            <button
              onClick={isRecording ? stopRecordingAndKeep : startRecording}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer border ${
                isRecording 
                  ? 'bg-rose-500 text-white border-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' 
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/5'
              }`}
              title={isRecording ? "إيقاف وحفظ الصوت" : "تسجيل رسالة صوتية"}
            >
              <Mic className="w-4.5 h-4.5 text-zinc-400 hover:text-rose-400 transition-all" />
            </button>

            {/* Live recording status waveform overlay */}
            {isRecording ? (
              <div className="flex-1 bg-[#120a0d] border border-rose-500/20 rounded-full h-11 px-4 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-[11px] font-mono font-bold text-rose-300">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                {/* Waveform visualizer */}
                <div className="flex items-center gap-0.5 justify-center flex-1 h-6 overflow-hidden max-w-[200px]">
                  {waveformBars.map((h, i) => (
                    <motion.div 
                      key={i} 
                      className="w-0.5 bg-rose-400/80 rounded-full"
                      animate={{ height: `${h}px` }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={stopRecordingAndKeep}
                    className="text-[10px] bg-rose-500 text-white px-2.5 py-1 rounded-full font-bold cursor-pointer"
                  >
                    حفظ
                  </button>
                  <button 
                    onClick={cancelRecording}
                    className="text-[10px] text-zinc-500 hover:text-white px-2 py-1 font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-[#0a0a0f] border border-white/5 rounded-full h-11 px-3 flex items-center gap-2 shadow-inner focus-within:border-primary/25 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend(inputVal);
                  }}
                  placeholder="اسأل حكيم عن مسلسلاتك المفضلة..."
                  className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-zinc-200 px-2 placeholder-zinc-500"
                />

                <button
                  onClick={() => handleSend(inputVal)}
                  disabled={!inputVal.trim() && !attachedImage && !audioBase64}
                  className="w-8.5 h-8.5 rounded-full bg-primary hover:bg-red-700 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:scale-95 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
