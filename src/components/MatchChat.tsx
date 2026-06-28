import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, onValue, limitToLast, query, serverTimestamp, Database, set } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import chatFirebaseConfig from '../services/chatFirebaseConfig.json';
import { Send, Users, Smile, User2, MessageSquare, Flame, Camera, X, Image, Play, Pause, Mic, Square, Trash2, Video, Pencil, ShieldAlert, Reply, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getApiUrl } from '../lib/apiConfig';
import { firestore } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { checkBanStatus, reportComment, getOrCreateUserId } from '../services/banService';

interface ChatRepliedMsg {
  id: string;
  userName: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
}

interface ChatMessage {
  id: string;
  userName: string;
  userAvatar: string; // 'boy1' | 'boy2' | 'girl1' | 'girl2'
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  createdAt: number;
  repliedTo?: ChatRepliedMsg;
}

interface MatchChatProps {
  matchId: string;
  matchTitle: string;
  onClose?: () => void;
}

function CustomAudioPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!audioRef.current) return;
    
    // Explicitly handle iOS Safari audio context resume or load
    if (audioRef.current.paused) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Retrying playback for iOS Safari...", error);
          if (audioRef.current) {
            audioRef.current.load(); 
            audioRef.current.play().catch(e2 => console.error("Final play attempt failed:", e2));
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  return (
    <div className="flex items-center gap-2 bg-black/40 border border-zinc-800 rounded-xl p-2 min-w-[240px] md:min-w-[280px] select-none text-white my-1" style={{ direction: 'ltr' }}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 flex items-center justify-center transition shrink-0 cursor-pointer text-white"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-[1px]" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={currentTime} 
          onChange={handleProgressChange}
          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
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

  // Direct Image and file upload states
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Native voice recording states
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Custom Reply and Edit States
  const [repliedMessage, setRepliedMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Ban states and Action Sheet Menu
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [actionMenuMessage, setActionMenuMessage] = useState<ChatMessage | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    
    // Check ban status on load
    const verifyUserBan = async () => {
      const status = await checkBanStatus();
      if (status.isBanned) {
        setIsBanned(true);
        setBanReason(status.reason || 'إساءة استخدام أو إزعاج المستخدمين');
      }
    };
    verifyUserBan();
  }, []);

  const handleEditMessage = async (msgId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (!isDbReady || !db) return;
    try {
      await set(ref(db, `matchesChat/${matchId}/${msgId}/text`), trimmed);
      setEditingMessageId(null);
      setEditingText('');
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة تماماً؟ 🗑️')) return;
    if (!isDbReady || !db) return;
    try {
      await set(ref(db, `matchesChat/${matchId}/${msgId}`), null);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleReportMessage = async (msg: ChatMessage) => {
    // 24 hours report cooldown constraint
    const lastReport = localStorage.getItem('hek_last_report_time');
    if (lastReport) {
      const elapsed = Date.now() - parseInt(lastReport, 10);
      const limit = 24 * 60 * 60 * 1000;
      if (elapsed < limit) {
        const remainingMs = limit - elapsed;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        alert(`عذراً، بموجب حماية منصتنا، لا يمكن إرسال أكثر من بلاغ واحد كل 24 ساعة للإدارة كأقصى استخدام آمن.\n\nالمتبقي لجاهزية الإبلاغ: ${hours} ساعة و ${minutes} دقيقة 🛡️`);
        return;
      }
    }

    if (!window.confirm("هل تريد الإبلاغ عن هذا التعليق لاحتوائه على سب، شتم، أو محتوى غير لائق؟ 🚨")) return;
    try {
      const reportId = `report_${Date.now()}`;
      await setDoc(doc(firestore, "reports", reportId), {
        messageId: msg.id,
        reporterName: userName || 'مجهول',
        offenderName: msg.userName || 'مجهول',
        text: msg.text || '',
        imageUrl: msg.imageUrl || '',
        videoUrl: msg.videoUrl || '',
        audioUrl: msg.audioUrl || '',
        reportedAt: Date.now(),
        matchId: matchId,
        status: 'pending'
      });
      
      localStorage.setItem('hek_last_report_time', Date.now().toString());
      
      // Chime Sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;
        const playTone = (freq: number, start: number, duration: number, volume: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gainNode.gain.setValueAtTime(0, start);
          gainNode.gain.linearRampToValueAtTime(volume, start + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gainNode);
          osc.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        playTone(523.25, now, 0.4, 0.15);
        playTone(659.25, now + 0.08, 0.45, 0.13);
        playTone(783.99, now + 0.16, 0.5, 0.12);
        playTone(1046.50, now + 0.24, 0.6, 0.1);
      } catch (audioErr) {}

      alert('تم ارسال بلاغك الى اداره سوف نراجع بلاغك بسرعه عاليه نحنا نهتم ب مستخدمينا بشكل احترافي 🛡️✅');
    } catch (e) {
      console.error("Failed to submit abuse report:", e);
      alert('تم ارسال بلاغك الى اداره سوف نراجع بلاغك بسرعه عاليه نحنا نهتم ب مستخدمينا بشكل احترافي 🛡️✅');
    }
  };

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
          videoUrl: value.videoUrl || '',
          audioUrl: value.audioUrl || '',
          createdAt: value.createdAt || Date.now(),
          repliedTo: value.repliedTo || undefined
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

  const handleSendMessage = (msgText: string, imgUrl?: string | null, vUrl?: string | null, aUrl?: string | null) => {
    if (isBanned) {
      alert(`عذراً، لا يمكنك التعليق! حسابك محظور في كل غرف ومسلسلات شات حكايتنا بسبب إساءة الاستخدام أو إزعاج الآخرين. 🚨\n\nالسبب: ${banReason}`);
      return;
    }

    const trimmed = msgText.trim();
    if (!trimmed && !imgUrl && !vUrl && !aUrl) return;
    if (!isDbReady || !db) return;

    try {
      const chatRef = ref(db, `matchesChat/${matchId}`);
      const payload: any = {
        userName,
        userAvatar,
        text: trimmed,
        imageUrl: imgUrl || "",
        videoUrl: vUrl || "",
        audioUrl: aUrl || "",
        createdAt: serverTimestamp()
      };

      if (repliedMessage) {
        payload.repliedTo = {
          id: repliedMessage.id,
          userName: repliedMessage.userName,
          text: repliedMessage.text || "",
          imageUrl: repliedMessage.imageUrl || "",
          audioUrl: repliedMessage.audioUrl || ""
        };
      }

      push(chatRef, payload);
      setText('');
      setAttachedImageUrl(null);
      setRepliedMessage(null);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadEndpoint = getApiUrl ? getApiUrl("/api/v1/upload-media") : "/api/v1/upload-media";
      const uploadRes = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData
      });
      
      if (!uploadRes.ok) {
        console.error("Upload failed with status", uploadRes.status);
        alert("عذرًا، حدث خطأ في الخادم (حجم الملف كبير أو السيرفر مشغول).");
        setUploadingImage(false);
        e.target.value = '';
        return;
      }

      const uploadData = await uploadRes.json();
      
      if (uploadData.success && uploadData.url) {
        // Instantly send to Firebase matching the user's intent!
        if (isImage) {
          handleSendMessage("", uploadData.url, "", "");
        } else if (isVideo) {
          handleSendMessage("", "", uploadData.url, "");
        } else if (isAudio) {
          handleSendMessage("", "", "", uploadData.url);
        } else {
          handleSendMessage("", uploadData.url, "", "");
        }
      } else {
        alert(uploadData.error || "عذراً فشل رفع الملف، يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error("XHR file upload error:", err);
      alert("خطأ أثناء التواصل مع خادم الرفع (قد يكون الملف كبيراً جداً).");
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("متصفحك لا يدعم تسجيل الصوت أو يفتقد لصلاحية الوصول.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const isIOSorSafari = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) || 
        (navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome"));
      
      // Determine best MIME type for the browser (Safari prefers audio/mp4)
      let mimeType = 'audio/webm';
      if (isIOSorSafari) {
        mimeType = 'audio/mp4';
      } else if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      let options: any = {};
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
        options = { mimeType };
      } else if (isIOSorSafari) {
        try {
          options = { mimeType: 'audio/mp4' };
        } catch (e) {
          options = {};
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const isMp4 = mediaRecorder.mimeType?.includes('mp4') || mediaRecorder.mimeType?.includes('aac') || isIOSorSafari;
        const blobType = isMp4 ? 'audio/mp4' : 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        
        // Release hardware mic resource
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size === 0) {
          alert("تنبيه: التسجيل الصوتي فارغ، يرجى المحاولة مرة أخرى.");
          return;
        }

        setUploadingImage(true);
        try {
          const formData = new FormData();
          // Specify compatible extensions (.mp4 or .mp3) so top4top.io accepts them
          const extension = isMp4 ? 'mp4' : 'mp3';
          formData.append("file", audioBlob, `voice_${Date.now()}.${extension}`);

          const uploadEndpoint = getApiUrl ? getApiUrl("/api/v1/upload-media") : "/api/v1/upload-media";
          const uploadRes = await fetch(uploadEndpoint, {
            method: "POST",
            body: formData
          });
          
          if (!uploadRes.ok) {
            console.error("Audio Upload failed with status", uploadRes.status);
            alert("عذرًا، حدث خطأ في الخادم (حجم الملف كبير أو السيرفر مشغول).");
            setUploadingImage(false);
            return;
          }

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.url) {
            handleSendMessage("", "", "", uploadData.url);
          } else {
            alert(uploadData.error || "عذراً فشل رفع الملف، يرجى المحاولة مرة أخرى.");
          }
        } catch (err) {
          console.error("Audio upload error:", err);
          alert("خطأ أثناء التواصل مع خادم الرفع (قد يكون الملف كبيراً جداً).");
        } finally {
          setUploadingImage(false);
        }
      };

      mediaRecorder.start();
      setIsVoiceRecording(true);
      setVoiceSeconds(0);
      
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      alert("يرجى تفعيل صلاحية الميكروفون لتسجيل فويس بنجاح.");
    }
  };

  const stopVoiceRecording = (cancel = false) => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    
    setIsVoiceRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.onstop = () => {
          if (mediaRecorderRef.current) {
            const stream = mediaRecorderRef.current.stream;
            stream.getTracks().forEach(track => track.stop());
          }
        };
      }
      mediaRecorderRef.current.stop();
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
          messages.map((msg) => {
            const isMyMsg = msg.userName === userName;
            const isEditing = editingMessageId === msg.id;

            return (
              <div 
                key={msg.id} 
                className={`flex gap-2.5 items-start ${isMyMsg ? 'flex-row' : 'flex-row-reverse'}`}
              >
                {renderAvatarInitials(msg.userAvatar, msg.userName)}
                <div className="flex flex-col max-w-[75%] space-y-1">
                  <div className={`flex items-center gap-2 ${isMyMsg ? 'justify-start' : 'justify-end'}`}>
                    <span className={`text-[9px] font-bold ${isMyMsg ? 'text-rose-400' : 'text-zinc-400'}`}>
                      {msg.userName === userName ? 'أنا' : msg.userName}
                    </span>
                    <span className="text-[7px] text-zinc-650">
                      {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Replied message block if present */}
                  {msg.repliedTo && (
                    <div className="bg-zinc-950/60 border-l-2 border-red-500 rounded-xl px-2.5 py-1.5 mb-1 text-right text-[9px] text-zinc-500 font-bold select-none max-w-full">
                      <span className="font-bold text-rose-500 block truncate text-[8px]">الرد على: {msg.repliedTo.userName}</span>
                      <span className="truncate block max-w-[180px]">
                        {msg.repliedTo.text || (msg.repliedTo.audioUrl ? "🎙️ رسالة صوتية" : msg.repliedTo.imageUrl ? "🖼️ صورة" : "مقطع وسائط")}
                      </span>
                    </div>
                  )}

                  <div className="relative group">
                    {isEditing ? (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 space-y-2 text-right">
                        <textarea
                          rows={2}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full bg-black/60 border border-zinc-805 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 text-right"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleEditMessage(msg.id, editingText)}
                            className="bg-red-650 hover:bg-red-500 text-white p-1 rounded-lg transition"
                            title="حفظ"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingMessageId(null)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-1 rounded-lg transition"
                            title="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button, a, input, [role="button"], video, audio')) return;
                          // Optional: we can trigger long press logic here if needed, 
                          // but for now let's just ensure it's clickable
                        }}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).closest('button, a, input, [role="button"], video, audio')) return;
                          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = setTimeout(() => {
                            setActionMenuMessage(msg);
                          }, 400) as unknown as number;
                        }}
                        onPointerUp={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                        onPointerLeave={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                        onPointerCancel={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                        className={`rounded-2xl px-3.5 py-2.5 text-xs text-right whitespace-pre-wrap break-words leading-relaxed shadow-md border cursor-pointer hover:scale-[0.99] transition active:scale-[0.97] ${
                          isMyMsg 
                            ? 'bg-red-500/10 border-red-500/20 text-red-50 hover:bg-red-500/15' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-350 hover:bg-zinc-850'
                        }`}
                      >
                        {msg.text && <p className={(msg.imageUrl || msg.videoUrl || msg.audioUrl) ? "mb-2" : ""}>{msg.text}</p>}
                        
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

                        {msg.videoUrl && (
                          <div className="relative overflow-hidden rounded-xl border border-zinc-850 bg-black mt-1 max-w-[240px]">
                            <video 
                              src={msg.videoUrl} 
                              controls 
                              playsInline
                              webkit-playsinline="true"
                              preload="metadata"
                              className="w-full h-auto max-h-[180px] object-cover rounded-xl bg-black"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {msg.audioUrl && (
                          <div className="mt-1">
                            <CustomAudioPlayer src={msg.audioUrl} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick interactive actions on Hover/Focus */}
                    <div className={`absolute -top-3.5 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5 bg-zinc-920/95 border border-zinc-800 p-1.5 rounded-full shadow-lg ${isMyMsg ? 'left-2' : 'right-2'} z-50`}>
                      {/* Reply button */}
                      <button
                        onClick={() => setRepliedMessage(msg)}
                        className="text-zinc-400 hover:text-white transition p-1 rounded-full hover:bg-zinc-800"
                        title="رد"
                      >
                        <Reply className="w-3 h-3" />
                      </button>

                      {/* Edit button (if my text message) */}
                      {isMyMsg && msg.text && !msg.imageUrl && !msg.videoUrl && !msg.audioUrl && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditingText(msg.text);
                          }}
                          className="text-amber-400 hover:text-amber-300 transition p-1 rounded-full hover:bg-zinc-800"
                          title="تعديل"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}

                      {/* Abuse Report (if other's message) */}
                      {!isMyMsg && (
                        <button
                          onClick={() => handleReportMessage(msg)}
                          className="text-zinc-500 hover:text-red-500 transition p-1 rounded-full hover:bg-zinc-800"
                          title="إبلاغ"
                        >
                          <ShieldAlert className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete button (if own OR admin) */}
                      {(isMyMsg || isAdmin) && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-rose-500 hover:text-rose-400 transition p-1 rounded-full hover:bg-rose-950/40"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
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
        {/* Reply drawer indicator */}
        {repliedMessage && (
          <div className="flex items-center justify-between p-2.5 bg-rose-950/20 border-r-2 border-red-500 rounded-xl text-right text-[10px] text-zinc-400 gap-3 mb-2 shrink-0">
            <div className="flex flex-col gap-0.5 text-right w-full">
              <span className="font-black text-rose-400 text-[9px]">الرد على: {repliedMessage.userName}</span>
              <span className="truncate max-w-[200px] text-[10px] text-zinc-350 mt-0.5">
                {repliedMessage.text || (repliedMessage.audioUrl ? "🎙️ رسالة صوتية مخصصة" : repliedMessage.imageUrl ? "🖼️ صورة مرفقة" : "مقطع وسائط حية")}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setRepliedMessage(null)} 
              className="p-1 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attachment Thumbnails & Upload indicators */}
        {uploadingImage && (
          <div className="flex items-center gap-2 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-1.5 px-3 rounded-xl text-[10px] w-fit mr-auto">
            <div className="w-3.5 h-3.5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
            <span>جاري رفع وتنشيط الملف...</span>
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
          {isVoiceRecording ? (
            <div className="flex-1 flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">جاري تسجيل فويس... {voiceSeconds}ث</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => stopVoiceRecording(true)} 
                  className="text-zinc-500 hover:text-red-500 hover:bg-zinc-900 duration-200 p-1 rounded-lg"
                  title="إلغاء التسجيل"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button" 
                  onClick={() => stopVoiceRecording(false)} 
                  className="w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
                  title="تأكيد وإرسال"
                >
                  <Square className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <>
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

              <label className="p-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center border border-zinc-850" title="ارفاق صورة أو فيديو">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                />
              </label>

              <button 
                type="button" 
                onClick={startVoiceRecording} 
                className="p-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center border border-zinc-850"
                title="تسجيل رسالة صوتية"
              >
                <Mic className="w-4 h-4" />
              </button>
            </>
          )}
        </form>
      </div>

      {/* Lightbox Image Preview Dialog overlay */}
      {previewImage && createPortal(
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setPreviewImage(null)} 
              className="absolute top-8 right-8 z-[1000000] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={previewImage} 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

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

      {/* Interactive Bottom Sheet for Comment Options */}
      <AnimatePresence>
        {actionMenuMessage && (
          <div className="fixed inset-0 z-[400000] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            {/* Backdrop click closer */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setActionMenuMessage(null)} />
            
            {/* Slide up panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="relative w-full max-w-sm bg-zinc-950 border-t border-zinc-850 rounded-t-3xl p-5 text-right font-sans z-50 flex flex-col space-y-4 shadow-2xl select-none"
            >
              {/* Drag bar indicator */}
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-1 flex-shrink-0" />
              
              <div className="text-center pb-2 border-b border-zinc-900 leading-relaxed">
                <p className="text-[10px] text-zinc-500 font-bold mb-0.5">خيارات التعليق</p>
                <p className="text-xs text-zinc-300 font-bold truncate max-w-[280px] mx-auto">
                  "{actionMenuMessage.text || "محتوى وسائط حية"}"
                </p>
              </div>

              <div className="space-y-2">
                {/* 1. Reply Option */}
                <button
                  onClick={() => {
                    setRepliedMessage(actionMenuMessage);
                    setActionMenuMessage(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  <Reply className="w-4 h-4 text-emerald-400" />
                  <span>الرد على هذا التعليق</span>
                </button>

                {/* 2. Report Option */}
                {actionMenuMessage.userName !== userName && (
                  <button
                    onClick={() => {
                      handleReportMessage(actionMenuMessage);
                      setActionMenuMessage(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-red-950/20 hover:border-red-900 border border-zinc-850 text-red-400 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-550" />
                    <span>إبلاغ عن محتوى غير لائق 🚨</span>
                  </button>
                )}

                {/* 3. Edit Option (if is mine) */}
                {actionMenuMessage.userName === userName && actionMenuMessage.text && !actionMenuMessage.imageUrl && !actionMenuMessage.videoUrl && !actionMenuMessage.audioUrl && (
                  <button
                    onClick={() => {
                      setEditingMessageId(actionMenuMessage.id);
                      setEditingText(actionMenuMessage.text);
                      setActionMenuMessage(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-amber-950/20 hover:border-amber-900 border border-zinc-850 text-amber-400 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 text-amber-400" />
                    <span>تعديل التعليق ✍️</span>
                  </button>
                )}

                {/* 4. Delete Option (if mine or Admin) */}
                {(actionMenuMessage.userName === userName || isAdmin) && (
                  <button
                    onClick={() => {
                      handleDeleteMessage(actionMenuMessage.id);
                      setActionMenuMessage(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-955/20 border border-rose-500/20 text-rose-450 hover:bg-rose-950/40 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>حذف التعليق نهائياً 🗑️</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setActionMenuMessage(null)}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-black rounded-2xl text-[11px] transition cursor-pointer text-center"
              >
                إغلاق القائمة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
