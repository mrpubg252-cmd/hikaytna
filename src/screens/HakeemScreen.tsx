import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Send, Sparkles, MessageSquare, Bot, Play, 
  Trash2, Volume2, VolumeX, Image as ImageIcon, Mic, X, 
  RefreshCw, Heart, ChevronLeft, Plus, History, FileText, 
  Link as LinkIcon, Paperclip, PanelRightClose, PanelRightOpen, 
  Loader2, Edit2, Check, ExternalLink, Copy, Star
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAllSeries } from '../services/dataService';
import { 
  Series, 
  HakeemMessage, 
  HakeemSession, 
  saveHakeemSession, 
  deleteHakeemSession, 
  subscribeUserHakeemSessions 
} from '../services/firebase';
import { getApiUrl } from '../lib/apiConfig';
import { navigateToWatchOrAds } from '../utils/watchNavigation';

interface AttachedFile {
  url: string;
  name: string;
  type: 'image' | 'pdf';
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

function getUserId(): string {
  let pid = localStorage.getItem('guest_chat_pid');
  if (!pid) {
    pid = 'user_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('guest_chat_pid', pid);
  }
  return pid;
}

function createDefaultWelcomeMessage(): HakeemMessage {
  return {
    id: 'welcome_' + Date.now(),
    role: 'model',
    text: 'أهلاً بك يا بطل! أنا **حكيم** ✨، مستشارك الذكي المدعوم بنموذج **ChatGPT OCR** الخارق لقراءة النصوص والصور والمستندات (PDF/IMG).\n\nتبي تسألني عن مسلسل؟ ترسل لي لقطة شاشة من مشهد أو ملف PDF لسيناريو أو تقرير؟ اسألني أو ارفع ملفاتك وسأحللها لك فوراً! 🍿🎬',
    timestamp: Date.now()
  };
}

export default function HakeemScreen() {
  const navigate = useNavigate();
  const userId = useRef(getUserId()).current;

  // Multi-session State
  const [sessions, setSessions] = useState<HakeemSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem('hakeem_active_session_id') || '';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Active Chat State
  const [messages, setMessages] = useState<HakeemMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);

  // Attached files (ChatGPT OCR: images & PDF)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [customFileUrl, setCustomFileUrl] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  // Sound/TTS state
  const [isSoundMuted, setIsSoundMuted] = useState(() => {
    return localStorage.getItem('hakeem_sound_muted') === 'true';
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reactions & previews
  const [reactions, setReactions] = useState<Record<string, 'liked' | null>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);
  const waveformIntervalRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load series list for deep links
  useEffect(() => {
    async function loadSeries() {
      try {
        const list = await fetchAllSeries();
        setSeriesList(list);
      } catch (e) {
        console.warn('Error fetching series list for Hakeem:', e);
      } finally {
        setLoadingSeries(false);
      }
    }
    loadSeries();
  }, []);

  // Initialize Speech Synthesis
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          synthRef.current = window.speechSynthesis;
          if (typeof window.speechSynthesis.getVoices === 'function') {
            window.speechSynthesis.getVoices();
          }
        }
      } catch (e) {
        console.warn("Speech synthesis init:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Realtime Firebase Subscription for User Sessions
  useEffect(() => {
    const unsub = subscribeUserHakeemSessions(userId, (loadedSessions) => {
      setSessions(loadedSessions);

      if (loadedSessions.length === 0) {
        // Create initial session if none exists
        const initialSessionId = 'conv_' + Date.now();
        const initialSession: HakeemSession = {
          id: initialSessionId,
          title: 'محادثة جديدة',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [createDefaultWelcomeMessage()]
        };
        saveHakeemSession(userId, initialSession);
        setCurrentSessionId(initialSessionId);
        localStorage.setItem('hakeem_active_session_id', initialSessionId);
        setMessages(initialSession.messages);
      } else {
        // Select active session or default to the most recent
        const savedId = localStorage.getItem('hakeem_active_session_id');
        const match = loadedSessions.find(s => s.id === savedId) || loadedSessions[0];
        if (match) {
          setCurrentSessionId(match.id);
          setMessages(match.messages || [createDefaultWelcomeMessage()]);
        }
      }
    });

    return () => unsub();
  }, [userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // TTS Speech Helper
  const speakText = (text: string) => {
    if (isSoundMuted || !synthRef.current) return;
    stopSpeaking();

    const cleanedText = text
      .replace(/\[[^\]]+\]\(navigate:[^\s\)]+\)/g, (match) => {
        const innerText = match.match(/\[([^\]]+)\]/);
        return innerText ? innerText[1] : '';
      })
      .replace(/[\*\#_`~]/g, '')
      .replace(/navigate:[a-zA-Z0-9_\-]+/gi, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'ar-SA';
    const voices = synthRef.current.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith('ar')) || voices.find(v => v.name.toLowerCase().includes('arabic'));
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) synthRef.current.cancel();
    setIsSpeaking(false);
  };

  const toggleSound = () => {
    const next = !isSoundMuted;
    setIsSoundMuted(next);
    localStorage.setItem('hakeem_sound_muted', String(next));
    if (next) stopSpeaking();
  };

  // Audio chimes
  const playChime = (type: 'send' | 'receive' | 'heart') => {
    try {
      if (localStorage.getItem('hakeem_sound_muted') === 'true') return;
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
    } catch (e) {}
  };

  // Voice recording
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
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setAudioBase64(base64String.split(',')[1]);
        };
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
      waveformIntervalRef.current = setInterval(() => {
        setWaveformBars(Array.from({ length: 16 }, () => Math.floor(Math.random() * 24) + 6));
      }, 100);
    } catch (e) {
      alert('تعذر الوصول إلى الميكروفون. يرجى منح الإذن من إعدادات المتصفح.');
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

  // ==========================================
  // Session Actions (Start New / Switch / Delete)
  // ==========================================
  const handleStartNewSession = async () => {
    const newId = 'conv_' + Date.now();
    const newSession: HakeemSession = {
      id: newId,
      title: 'محادثة جديدة',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [createDefaultWelcomeMessage()]
    };
    setCurrentSessionId(newId);
    setMessages(newSession.messages);
    localStorage.setItem('hakeem_active_session_id', newId);
    setIsSidebarOpen(false);
    await saveHakeemSession(userId, newSession);
  };

  const handleSelectSession = (session: HakeemSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || [createDefaultWelcomeMessage()]);
    localStorage.setItem('hakeem_active_session_id', session.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه المحادثة من سجل Firebase؟')) return;
    await deleteHakeemSession(userId, sessionId);
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        handleSelectSession(remaining[0]);
      } else {
        handleStartNewSession();
      }
    }
  };

  const handleSaveTitle = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const updated = { ...session, title: editingTitle.trim(), updatedAt: Date.now() };
      await saveHakeemSession(userId, updated);
    }
    setEditingSessionId(null);
  };

  // ==========================================
  // File Upload Handlers (ChatGPT OCR: IMG & PDF)
  // ==========================================
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachedFiles.length + files.length > 10) {
      alert('الحد الأقصى لروابط الملفات المرفقة هو 10 ملفات في الطلب الواحد.');
      return;
    }

    setIsUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
        const isImg = file.type.startsWith('image/');

        if (!isPdf && !isImg) {
          alert(`الملف "${file.name}" غير مدعوم. يدعم حكيم ملفات الصور و PDF فقط 📄🖼️`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(getApiUrl('/api/v1/hakeem/upload'), {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.url) {
            setAttachedFiles(prev => [
              ...prev,
              {
                url: data.url,
                name: file.name,
                type: isPdf ? 'pdf' : 'image'
              }
            ]);
          } else {
            alert(`فشل رفع ${file.name}: ${data.error || 'خطأ غير معروف'}`);
          }
        } else {
          alert(`تعذر رفع الملف ${file.name}`);
        }
      }
    } catch (err: any) {
      alert('خطأ أثناء رفع الملفات: ' + err.message);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddDirectUrl = () => {
    const url = customFileUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('يرجى إدخال رابط مباشر صالح يبدأ بـ https://');
      return;
    }
    const isPdf = url.toLowerCase().includes('.pdf');
    const name = url.split('/').pop()?.split('?')[0] || (isPdf ? 'document.pdf' : 'image.jpg');
    setAttachedFiles(prev => [
      ...prev,
      {
        url,
        name,
        type: isPdf ? 'pdf' : 'image'
      }
    ]);
    setCustomFileUrl('');
    setShowUrlModal(false);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ==========================================
  // Send Message Logic
  // ==========================================
  const handleSend = async (textToSend: string) => {
    const finalMsg = textToSend.trim();
    const hasVoice = !!audioBase64;
    const hasFiles = attachedFiles.length > 0;

    if (!finalMsg && !hasFiles && !hasVoice) return;
    if (isTyping) return;

    playChime('send');
    stopSpeaking();

    const userMsg: HakeemMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: finalMsg || (hasVoice ? '🎤 رسالة صوتية' : '📎 وسائط مرفقة للتحليل'),
      timestamp: Date.now(),
      fileUrls: hasFiles ? attachedFiles.map(f => f.url) : undefined,
      audio: hasVoice || undefined
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Save user message immediately to Firebase
    let activeSession = sessions.find(s => s.id === currentSessionId);
    let sessionTitle = activeSession?.title || 'محادثة جديدة';
    if (sessionTitle === 'محادثة جديدة' && finalMsg) {
      sessionTitle = finalMsg.slice(0, 32) + (finalMsg.length > 32 ? '...' : '');
    }

    const sessionToSave: HakeemSession = {
      id: currentSessionId || ('conv_' + Date.now()),
      title: sessionTitle,
      createdAt: activeSession?.createdAt || Date.now(),
      updatedAt: Date.now(),
      messages: updatedMessages
    };
    saveHakeemSession(userId, sessionToSave);

    // Clear input
    setInputVal('');
    const filesSent = [...attachedFiles];
    setAttachedFiles([]);
    setAudioBase64(null);
    setAudioBlob(null);

    setIsTyping(true);

    let replyText = '';
    try {
      const historyPayload = messages.slice(-10).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        text: m.text
      }));

      const response = await fetch(getApiUrl('/api/v1/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMsg || 'تفحص هذه الملفات المرفقة بنموذج ChatGPT OCR واشرح لي ما فيها بالتفصيل.',
          history: historyPayload,
          seriesList: seriesList,
          file_urls: filesSent.map(f => f.url),
          audio: hasVoice ? { data: audioBase64, mimeType: 'audio/webm' } : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        replyText = data.text || '';
      } else {
        throw new Error('Server returned non-ok');
      }

      if (replyText) {
        playChime('receive');
        const botMsg: HakeemMessage = {
          id: 'bot_' + Date.now(),
          role: 'model',
          text: replyText,
          timestamp: Date.now()
        };

        const finalSessionMessages = [...updatedMessages, botMsg];
        setMessages(finalSessionMessages);

        // Save complete conversation to Firebase
        saveHakeemSession(userId, {
          ...sessionToSave,
          updatedAt: Date.now(),
          messages: finalSessionMessages
        });

        speakText(replyText);
      } else {
        throw new Error('Empty response');
      }
    } catch (err: any) {
      console.error('Hakeem chat error:', err);
      playChime('receive');
      const errorMsg: HakeemMessage = {
        id: 'err_' + Date.now(),
        role: 'model',
        text: 'عذراً! واجهت صعوبة في معالجة طلبك حالياً، يرجى المحاولة مرة أخرى وسأكون في خدمتك فوراً! 🤖❤️',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Reactions
  const handleReaction = (msgId: string) => {
    const current = reactions[msgId];
    setReactions(prev => ({
      ...prev,
      [msgId]: current === 'liked' ? null : 'liked'
    }));
    if (current !== 'liked') playChime('heart');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };



  const cleanMessageText = (text: string): string => {
    if (typeof text !== 'string') return '';
    try {
      // 1. Remove [label](navigate:id) -> just label
      let clean = text.replace(/\[([^\]]+)\]\s*\(\s*navigate:[^\s\)]+\s*\)/g, '$1');
      // 2. Remove naked navigate:id
      clean = clean.replace(/navigate:[a-zA-Z0-9_\-]+/gi, '');
      // 3. Remove artifacts like literal \n or double stars if any
      clean = clean.replace(/\\n/g, '\n').trim();
      return clean;
    } catch (e) {
      return text;
    }
  };

  return (
    <div className="h-screen bg-[#07070a] text-white flex overflow-hidden font-sans relative" dir="rtl">
      
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* ========================================================= */}
      {/* Sidebar: Past Conversations (ChatGPT / Claude Experience)  */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={`fixed lg:static top-0 bottom-0 right-0 z-50 w-72 sm:w-80 bg-[#0a0a0f] border-l border-white/5 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black text-white">سجل المحادثات</h2>
              <p className="text-[10px] text-zinc-500 font-bold">محفوظ في Firebase سحابياً ☁️</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleStartNewSession}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-primary to-rose-600 hover:from-primary/90 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>محادثة جديدة</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 no-scrollbar">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-xs font-semibold">
              لا توجد محادثات سابقة حتى الآن.
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === currentSessionId;
              const isEditing = editingSessionId === sess.id;

              return (
                <div
                  key={sess.id}
                  onClick={() => !isEditing && handleSelectSession(sess)}
                  className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-zinc-900/90 border-primary/40 text-white shadow-md'
                      : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-zinc-500'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle(sess.id, e as any);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        autoFocus
                        className="bg-black/60 border border-primary/50 text-xs px-2 py-1 rounded-lg text-white outline-none w-full font-bold"
                      />
                    ) : (
                      <div className="truncate text-xs font-bold">
                        {sess.title || 'محادثة بدون عنوان'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <button
                        onClick={(e) => handleSaveTitle(sess.id, e)}
                        className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(sess.id);
                            setEditingTitle(sess.title);
                          }}
                          className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="تعديل العنوان"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400"
                          title="حذف المحادثة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/5 bg-zinc-950/80">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              سيرفر الدردشة نشط
            </span>
            <span className="text-zinc-600">ChatGPT OCR v2</span>
          </div>
        </div>
      </motion.aside>

      {/* ========================================================= */}
      {/* Main Chat Area                                            */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        
        {/* Header */}
        <header className="shrink-0 z-30 backdrop-blur-xl bg-[#07070a]/90 border-b border-white/5 px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-all cursor-pointer"
              title="سجل المحادثات"
            >
              {isSidebarOpen ? <PanelRightClose className="w-5 h-5 text-primary" /> : <PanelRightOpen className="w-5 h-5" />}
            </button>

            <Link to="/" className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-300 transition-all">
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  حكيم الذكي
                  <span className="text-[9px] bg-primary/20 border border-primary/30 text-primary font-bold px-1.5 py-0.5 rounded-md">ChatGPT OCR</span>
                </h1>
                <p className="text-[10px] text-zinc-400 font-semibold truncate max-w-[150px] sm:max-w-xs">
                  {sessions.find(s => s.id === currentSessionId)?.title || 'محادثة جديدة'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* New Chat quick button */}
            <button
              onClick={handleStartNewSession}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>محادثة جديدة</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isSoundMuted
                  ? 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
                  : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
              }`}
              title={isSoundMuted ? "تشغيل النطق الصوتي" : "إيقاف النطق الصوتي"}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse text-primary" />}
            </button>
          </div>
        </header>

        {/* Messages List */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-6 flex flex-col no-scrollbar"
        >
          {messages.length <= 1 && (
            <div className="max-w-2xl mx-auto w-full text-center space-y-6 my-auto py-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-primary/15 to-rose-600/10 border border-primary/20 shadow-xl shadow-primary/10"
              >
                <Bot className="w-10 h-10 text-primary" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">حكيم منصة حكايتنا المدعوم بـ ChatGPT OCR</h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-md mx-auto leading-relaxed">
                  اسأل عن أي مسلسل، أو ارفع صورة لقطة شاشة 🖼️ أو مستند PDF 📄 لقراءته وتحليله فوراً مع حفظ محادثاتك في Firebase!
                </p>

              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto text-right">
                {SUGGESTED_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.text)}
                    className={`p-3.5 rounded-2xl border text-xs font-semibold text-zinc-300 flex items-center gap-3 bg-[#0a0a0f] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer ${p.color}`}
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
                  const directWatchSeries: any[] = [];
                  const cleanText = isBot ? cleanMessageText(m.text) : m.text;

                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 ${!isBot ? 'justify-end' : ''}`}
                    >
                      {/* Bot Avatar */}
                      {isBot && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-lg shrink-0 mt-1">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="space-y-2 max-w-[88%] sm:max-w-[78%]">
                        {/* Bubble */}
                        <div
                          className={`rounded-3xl p-4 text-xs sm:text-sm font-semibold leading-relaxed shadow-md relative group select-text ${
                            isBot
                              ? 'bg-[#0c0c14] border border-white/5 text-zinc-100 rounded-tr-none'
                              : 'bg-gradient-to-br from-primary to-red-700 text-white rounded-tl-none'
                          }`}
                        >
                          {/* Attached Files rendering */}
                          {m.fileUrls && m.fileUrls.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {m.fileUrls.map((url, fIdx) => {
                                const isPdf = url.toLowerCase().includes('.pdf');
                                return isPdf ? (
                                  <a
                                    key={fIdx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-red-500/50 transition-all text-xs font-bold text-white group/pdf"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <span className="truncate max-w-[160px]">مستند PDF مرفق</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover/pdf:text-white" />
                                  </a>
                                ) : (
                                  <div
                                    key={fIdx}
                                    onClick={() => setPreviewImageUrl(url)}
                                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/15 cursor-pointer hover:scale-105 transition-all shadow-md"
                                  >
                                    <img src={url} alt="Attached" className="w-full h-full object-cover" />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Message Text */}
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {cleanText}
                          </div>

                          {/* Audio indicator */}
                          {m.audio && (
                            <div className="mt-2 flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full w-fit text-[10px]">
                              <Mic className="w-3 h-3 text-rose-300" />
                              <span>رسالة صوتية</span>
                            </div>
                          )}

                          {/* Bottom Action Strip */}
                          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-bold">
                            <span>{new Date(m.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => copyToClipboard(cleanText)}
                                className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white"
                                title="نسخ النص"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {isBot && (
                                <button
                                  onClick={() => handleReaction(m.id)}
                                  className={`p-1 rounded-md transition-colors ${
                                    reactions[m.id] === 'liked' ? 'text-primary' : 'text-zinc-400 hover:text-white'
                                  }`}
                                  title="إعجاب"
                                >
                                  <Heart className={`w-3 h-3 ${reactions[m.id] === 'liked' ? 'fill-current' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>


                      </div>

                      {/* User Avatar */}
                      {!isBot && (
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 mt-1 text-xs">
                          👤
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-lg shrink-0 mt-1">
                <Sparkles className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-[#0c0c14] border border-white/5 rounded-2xl rounded-tr-none px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================= */}
        {/* Bottom Input Area with ChatGPT OCR Files Support           */}
        {/* ========================================================= */}
        <footer className="shrink-0 bg-[#07070a]/95 border-t border-white/5 px-4 py-3 sm:px-6">
          <div className="max-w-3xl mx-auto space-y-2">
            
            {/* Attached Media Chips */}
            <AnimatePresence>
              {(attachedFiles.length > 0 || isUploadingFile || audioBlob) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap items-center gap-2 bg-[#0c0c14] border border-white/5 p-2.5 rounded-2xl"
                >
                  {isUploadingFile && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري رفع ومعالجة الوسائط للـ OCR...</span>
                    </div>
                  )}

                  {attachedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold"
                    >
                      {f.type === 'pdf' ? (
                        <div className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <img src={f.url} alt="" className="w-6 h-6 rounded object-cover" />
                      )}
                      <span className="truncate max-w-[120px] text-zinc-300">{f.name}</span>
                      <button
                        onClick={() => removeAttachedFile(idx)}
                        className="text-zinc-500 hover:text-white p-0.5 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {audioBlob && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-bold">
                      <Mic className="w-3.5 h-3.5 animate-pulse" />
                      <span>تسجيل صوتي جاهز</span>
                      <button onClick={cancelRecording} className="text-zinc-400 hover:text-white mr-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Bar */}
            <div className="flex items-center gap-2">
              
              {/* File Attachment Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,application/pdf"
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile || isRecording}
                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                title="إرفاق صور أو ملفات PDF للـ OCR"
              >
                <Paperclip className="w-4 h-4 text-zinc-400 hover:text-primary transition-all" />
              </button>

              {/* Direct URL Button */}
              <button
                onClick={() => setShowUrlModal(true)}
                disabled={isUploadingFile || isRecording}
                className="hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                title="إضافة رابط ملف مباشر"
              >
                <LinkIcon className="w-4 h-4 text-zinc-400 hover:text-primary transition-all" />
              </button>

              {/* Voice Recorder Button */}
              <button
                onClick={isRecording ? stopRecordingAndKeep : startRecording}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer border ${
                  isRecording
                    ? 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/30 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/5'
                }`}
                title={isRecording ? "إيقاف وحفظ" : "تسجيل صوتي"}
              >
                <Mic className="w-4 h-4 text-zinc-400 hover:text-rose-400 transition-all" />
              </button>

              {/* Text Input / Recording bar */}
              {isRecording ? (
                <div className="flex-1 bg-[#120a0d] border border-rose-500/30 rounded-2xl h-11 px-4 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                    <span className="text-xs font-mono font-bold text-rose-300">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 justify-center flex-1 h-6 overflow-hidden max-w-[200px]">
                    {waveformBars.map((h, i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 bg-rose-400 rounded-full"
                        animate={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={stopRecordingAndKeep}
                      className="text-xs bg-rose-500 text-white px-2.5 py-1 rounded-xl font-bold cursor-pointer"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={cancelRecording}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1 font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 bg-[#0a0a0f] border border-white/5 rounded-2xl h-11 px-3 flex items-center gap-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend(inputVal);
                    }}
                    placeholder="اكتب سؤالك أو اطلب تحليل لقطة/PDF..."
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-zinc-200 px-2 placeholder-zinc-500"
                  />

                  <button
                    onClick={() => handleSend(inputVal)}
                    disabled={!inputVal.trim() && attachedFiles.length === 0 && !audioBase64}
                    className="w-8 h-8 rounded-xl bg-primary hover:bg-rose-600 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:scale-95 shrink-0 cursor-pointer shadow-md shadow-primary/20"
                  >
                    <Send className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* ========================================================= */}
      {/* Direct URL Modal                                          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showUrlModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  إضافة رابط صورة أو مستند PDF
                </h3>
                <button onClick={() => setShowUrlModal(false)} className="text-zinc-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                ألصق رابطاً مباشراً لصورة أو ملف PDF متاح للوصول بدون تسجيل دخول أو كوكيز:
              </p>

              <input
                type="url"
                value={customFileUrl}
                onChange={(e) => setCustomFileUrl(e.target.value)}
                placeholder="https://example.com/file.pdf أو image.jpg"
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddDirectUrl}
                  disabled={!customFileUrl.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-rose-600 disabled:opacity-40"
                >
                  إضافة للوسائط
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* Image Lightbox Preview                                    */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewImageUrl && (
          <div
            onClick={() => setPreviewImageUrl(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={previewImageUrl} alt="Full preview" className="w-full h-full object-contain" />
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
