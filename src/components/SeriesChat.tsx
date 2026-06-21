import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, remove, get, Database, query, limitToLast } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Users, Sparkles, Smile, Clock, User2, RefreshCw, Mic, Square, Volume2, Wand2, X, MessageSquare, Share2, Camera, Reply, ArrowLeft, LogIn, ShieldAlert, Play, Pause, Trash2, Video, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';
import { decryptValue } from '../lib/security';
import { useAuth } from '../context/AuthContext';
import AuthContainer from './AuthContainer';
import { fetchAllSeries } from '../services/dataService';
import { getApiUrl } from '../lib/apiConfig';
import chatFirebaseConfig from '../services/chatFirebaseConfig.json';
import { firestore } from '../services/firebase';
import { checkBanStatus, reportComment, getOrCreateUserId } from '../services/banService';

let db: Database | null = null;

// Speech-to-Text types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string; // id of avatar in AVATARS
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: number;
  replyTo?: {
    userName: string;
    text: string;
  };
  sceneTime?: number;
  sceneImage?: string;
  edited?: boolean;
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
          console.warn("Retrying playback for iOS Safari in SeriesChat...", error);
          if (audioRef.current) {
            audioRef.current.load(); 
            audioRef.current.play().catch(e2 => console.error("Final play attempt failed in SeriesChat:", e2));
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
    <div className="flex items-center gap-2 bg-black/40 border border-zinc-805 rounded-xl p-2 min-w-[180px] select-none text-white my-1" style={{ direction: 'ltr' }}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-8 h-8 rounded-full bg-primary hover:bg-primary/85 hover:scale-105 active:scale-95 flex items-center justify-center transition shrink-0 cursor-pointer text-black"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-[1.5px]" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={currentTime} 
          onChange={handleProgressChange}
          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

interface PendingScene {
  time: number;
  timeStr: string;
  image: string;
}

interface SeriesChatProps {
  seriesId: string;
  seriesTitle: string;
  onClose?: () => void;
  currentPlaybackTime?: number;
  onSeekTo?: (seconds: number) => void;
  isGlobal?: boolean;
  seriesImage?: string;
}

export const AVATARS = [
  {
    id: 'boy1',
    name: 'ولد أنيق',
    gender: 'boy',
    svg: (
      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="g-boy1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g-boy1)" />
        <path d="M50 30 C38 30, 36 40, 36 48 C36 58, 40 68, 50 68 C60 68, 64 58, 64 48 C64 40, 62 30, 50 30 Z" fill="#ffdbac" />
        <path d="M34 42 C30 30, 36 22, 50 20 C64 22, 70 30, 66 42 C62 38, 58 35, 50 37 C42 35, 38 38, 34 42 Z" fill="#2d2d2d" />
        <path d="M42 22 C32 24, 34 36, 38 40" stroke="#2d2d2d" strokeWidth="3" strokeLinecap="round" />
        <path d="M58 22 C68 24, 66 36, 62 40" stroke="#2d2d2d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="43" cy="48" r="5" stroke="#ffffff" strokeWidth="2.5" fill="#1e293b" />
        <circle cx="57" cy="48" r="5" stroke="#ffffff" strokeWidth="2.5" fill="#1e293b" />
        <line x1="48" y1="48" x2="52" y2="48" stroke="#ffffff" strokeWidth="2" />
        <path d="M46 56 Q50 60 54 56" stroke="#2d2d2d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    )
  },
  {
    id: 'boy2',
    name: 'ولد رياضي',
    gender: 'boy',
    svg: (
      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="g-boy2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g-boy2)" />
        <path d="M50 32 C39 32, 38 42, 38 49 C38 59, 42 67, 50 67 C58 67, 62 59, 62 49 C62 42, 61 32, 50 32 Z" fill="#f1c27d" />
        <path d="M35 44 C35 32, 42 24, 50 24 C58 24, 65 32, 65 44" fill="#ef4444" />
        <ellipse cx="50" cy="24" rx="14" ry="5" fill="#dc2626" />
        <path d="M22 40 Q35 34 45 42" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        <circle cx="45" cy="49" r="2.5" fill="#1e293b" />
        <circle cx="55" cy="49" r="2.5" fill="#1e293b" />
        <path d="M42 45 Q45 43 47 45" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M53 45 Q55 43 57 45" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M45 56 Q50 62 55 56" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    )
  },
  {
    id: 'girl1',
    name: 'بنت أنيقة',
    gender: 'girl',
    svg: (
      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="g-girl1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g-girl1)" />
        <path d="M50 32 C39 32, 38 41, 38 49 C38 58, 42 66, 50 66 C58 66, 62 58, 62 49 C62 41, 61 32, 50 32 Z" fill="#ffdbac" />
        <path d="M38 32 C34 32, 30 46, 30 64 C30 74, 33 76, 35 76 C37 76, 38 66, 38 49 C38 40, 42 34, 50 34 C58 34, 62 40, 62 49 C62 66, 63 76, 65 76 C67 76, 70 74, 70 64 C70 46, 66 32, 62 32 Z" fill="#312e81" />
        <path d="M38 32 C41 26, 59 26, 62 32" fill="#312e81" stroke="#312e81" strokeWidth="2" />
        <circle cx="37" cy="52" r="3" fill="#fbbf24" />
        <circle cx="63" cy="52" r="3" fill="#fbbf24" />
        <path d="M41 47 Q44 45 47 47" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M53 47 Q56 45 59 47" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="44" cy="51" r="2.5" fill="#1e293b" />
        <circle cx="56" cy="51" r="2.5" fill="#1e293b" />
        <circle cx="41" cy="55" r="2" fill="#f43f5e" opacity="0.6" />
        <circle cx="59" cy="55" r="2" fill="#f43f5e" opacity="0.6" />
        <path d="M47 57 Q50 60 53 57" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    )
  },
  {
    id: 'girl2',
    name: 'بنت لطيفة',
    gender: 'girl',
    svg: (
      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="g-girl2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g-girl2)" />
        <circle cx="32" cy="28" r="11" fill="#4c1d95" />
        <circle cx="68" cy="28" r="11" fill="#4c1d95" />
        <path d="M50 33 C40 33, 39 42, 39 49 C39 58, 43 66, 50 66 C57 66, 61 58, 61 49 C61 42, 60 33, 50 33 Z" fill="#f1c27d" />
        <path d="M35 38 C35 32, 40 28, 50 28 C60 28, 65 32, 65 38 C60 36, 56 34, 50 36 C44 34, 40 36, 35 38 Z" fill="#4c1d95" />
        <path d="M41 48 Q44 49 46 47" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="55" cy="48" r="2.5" fill="#1e293b" />
        <path d="M47 56 Q50 61 53 56" fill="#f43f5e" />
        <path d="M47 56 Q50 61 53 56" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <ellipse cx="41" cy="54" rx="3" ry="1.5" fill="#f43f5e" opacity="0.6" />
        <ellipse cx="59" cy="54" rx="3" ry="1.5" fill="#f43f5e" opacity="0.6" />
      </svg>
    )
  }
];

export default function SeriesChat({ seriesId, seriesTitle = 'هذا العمل', onClose, currentPlaybackTime, onSeekTo, isGlobal, seriesImage }: SeriesChatProps) {
  const [userName, setUserName] = useState<string>('مشاهد');
  const [userAvatar, setUserAvatar] = useState<string>('boy1');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestGenderInput, setGuestGenderInput] = useState<'boy' | 'girl'>('boy');
  
  useEffect(() => {
    let savedName = localStorage.getItem('guest_chat_name');
    const savedAvatar = localStorage.getItem('guest_chat_avatar');
    if (savedName && savedAvatar) {
      setUserName(savedName);
      setUserAvatar(savedAvatar);
    } else {
      setIsProfileModalOpen(true);
    }
  }, []);

  const saveGuestProfile = () => {
    if (!guestNameInput.trim()) return;
    const rawName = guestNameInput.trim();
    let finalName = rawName;
    
    const lower = rawName.toLowerCase();
    const isReserved = lower.includes('مدير') || lower.includes('المدير') || lower.includes('ادمن') || lower.includes('أدمن') || lower.includes('admin') || lower.includes('moderator');

    if (isReserved) {
      if (rawName === 'bewCew,iDYgC@K6') {
        finalName = 'المدير 🛡️';
        localStorage.setItem('short_admin_access', 'true');
      } else {
        alert('عذراً، هذا اللقب محجوز لإدارة المنصة فقط! ⚠️');
        return;
      }
    } else if (rawName === 'bewCew,iDYgC@K6') {
      finalName = 'المدير 🛡️';
      localStorage.setItem('short_admin_access', 'true');
    } else {
      localStorage.setItem('short_admin_access', 'false');
    }

    // randomly pick an avatar from gender
    const genderAvatars = AVATARS.filter(a => a.gender === guestGenderInput);
    const chosenAvatar = genderAvatars[Math.floor(Math.random() * genderAvatars.length)].id;
    
    setUserName(finalName);
    setUserAvatar(chosenAvatar);
    localStorage.setItem('guest_chat_name', finalName);
    localStorage.setItem('guest_chat_avatar', chosenAvatar);
    setIsProfileModalOpen(false);
  };

  const isRegistered = true; // Always true for guest access

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [inputText, setInputText] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [dbError, setDbError] = useState<string>('');
  const [isDbReady, setIsDbReady] = useState(false);

  // Direct image uploading and lightbox preview states
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Native voice recording states
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  
  // Real-time Presence, Typing indicators
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [showWaitWarning, setShowWaitWarning] = useState(false);
  
  // Pending scene share
  const [pendingScene, setPendingScene] = useState<PendingScene | null>(null);

  // Editing state
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  // Ban states and Action Sheet Menu
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [actionMenuMessage, setActionMenuMessage] = useState<ChatMessage | null>(null);
  
  const isTypingRef = useRef<boolean>(false);
  const setTypingStateInDb = (isTyping: boolean) => {
    if (!db || !isDbReady) return;
    if (isTypingRef.current === isTyping) return; // Prevent network spam on every keystroke!
    isTypingRef.current = isTyping;

    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
    const presenceId = (localStorage.getItem('guest_chat_pid') || 'guest_temp');
    const typingRef = ref(db, `typing/${safeSeriesId}/${presenceId}`);
    if (isTyping) {
      set(typingRef, { name: userName, timestamp: Date.now() }).catch(() => {});
    } else {
      remove(typingRef).catch(() => {});
    }
  };

  // Pulse typing status as text input state changes
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (inputText.trim()) {
      setTypingStateInDb(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        setTypingStateInDb(false);
      }, 3000);
    } else {
      setTypingStateInDb(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  }, [inputText, isDbReady]);

  // Clean typing status on unmount of series or chat
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (db && isDbReady) {
        const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
        const presenceId = (localStorage.getItem('guest_chat_pid') || 'guest_temp');
        remove(ref(db, `typing/${safeSeriesId}/${presenceId}`)).catch(() => {});
      }
    };
  }, [seriesId, isDbReady]);

  // Real-time presence pulse & watchers counter syncing
  useEffect(() => {
    if (!isDbReady || !db) return;
    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
    
    // Determine unique guest token or authenticated subscriber token
    let presenceId = localStorage.getItem('guest_chat_pid');
    if (!presenceId) {
      presenceId = `guest_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('guest_chat_pid', presenceId);
    }
    
    const presenceRef = ref(db, `presence/${safeSeriesId}/${presenceId}`);
    const myPresence = {
      userId: presenceId,
      name: userName,
      lastActive: Date.now()
    };
    
    // Set presence instantly
    set(presenceRef, myPresence).catch(() => {});
    
    // Removed aggressive 15sec interval because onDisconnect handles removal naturally without lag.
    
    // Subscribe to online users
    const presenceListRef = ref(db, `presence/${safeSeriesId}`);
    const unsubscribePresence = onValue(presenceListRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setOnlineCount(1);
        return;
      }
      const now = Date.now();
      let count = 0;
      Object.values(data).forEach((p: any) => {
        if (p && now - (p.lastActive || 0) <= 45000) {
          count++;
        }
      });
      setOnlineCount(Math.max(1, count));
    });

    // Subscribe to who is active and compiling text replies
    const typingListRef = ref(db, `typing/${safeSeriesId}`);
    const unsubscribeTyping = onValue(typingListRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setTypingUsers([]);
        return;
      }
      const now = Date.now();
      const currentPresenceId = localStorage.getItem('guest_chat_pid');
      const activeTypers: string[] = [];
      Object.entries(data).forEach(([pId, val]: [string, any]) => {
        if (pId !== currentPresenceId && val && now - (val.timestamp || 0) <= 6000) {
          activeTypers.push(val.name);
        }
      });
      setTypingUsers(activeTypers);
    });
    
    // Prune self on unmount
    return () => {
      unsubscribePresence();
      unsubscribeTyping();
      remove(presenceRef).catch(() => {});
    };
  }, [seriesId, isDbReady, userName]);

  // Initialize DB Securely
  useEffect(() => {
    async function initSecureDB() {
      if (db) {
        setIsDbReady(true);
        return;
      }
      try {
        if (!getApps().find(a => a.name === 'chatApp')) {
          const app = initializeApp(chatFirebaseConfig, 'chatApp');
          db = getDatabase(app);
        } else {
          db = getDatabase(getApp('chatApp'));
        }
        setIsDbReady(true);
      } catch (err) {
        console.warn("Failed to initialize chat database from local JSON configuration:", err);
        setDbError("فشل في تهيئة نظام الدردشة.");
      }
    }
    initSecureDB();
  }, []);

  // SignUp Form status
  const [signupName, setSignupName] = useState('');
  const [signupAvatar, setSignupAvatar] = useState('boy1');
  const [signupError, setSignupError] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const recognitionRef = useRef<any>(null);
  const preRecordingText = useRef('');
  const isIntentionalStop = useRef(false);
  const timerRef = useRef<number | null>(null);
  
  // Update localStorage on change
  useEffect(() => {
    if (!isRegistered) {
      localStorage.setItem('chat_messages_count', '0');
    }
  }, [isRegistered]);

  // Check ban status on load
  useEffect(() => {
    const verifyUserBan = async () => {
      const status = await checkBanStatus();
      if (status.isBanned) {
        setIsBanned(true);
        setBanReason(status.reason || 'إساءة استخدام أو إزعاج المستخدمين');
      }
    };
    verifyUserBan();
  }, []);

  // Sync Timer for messages aging and active DB purge
  useEffect(() => {
    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
    
    // Purge old docs on load
    purgeExpiredDocs(safeSeriesId);
  }, [seriesId]);

  // Firebase Live Sync & Cleanup
  useEffect(() => {
    if (!isDbReady || !db) return;
    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
    const messagesRef = ref(db, `chats/${safeSeriesId}`);
    
    // Create query to only download/sync the last displayLimit messages to prevent lag and run ultra-smoothly!
    const chatQuery = query(messagesRef, limitToLast(displayLimit));

    const unsubscribe = onValue(chatQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }

      const now = Date.now();
      const loadedMessages: ChatMessage[] = [];

      Object.entries(data).forEach(([key, val]: [string, any]) => {
        const timestamp = val.createdAt || now;
        // Client-side visual filter: only show if newer than 5 days
        if (now - timestamp <= 5 * 24 * 60 * 60 * 1000) {
          loadedMessages.push({
            id: key,
            userId: val.userId || 'unknown',
            userName: val.userName || 'مشاهد غامض',
            userAvatar: val.userAvatar || 'boy1',
            text: val.text || '',
            imageUrl: val.imageUrl || '',
            videoUrl: val.videoUrl || '',
            audioUrl: val.audioUrl || '',
            createdAt: timestamp,
            replyTo: val.replyTo,
            sceneTime: val.sceneTime,
            sceneImage: val.sceneImage
          });
        }
      });

      // Sort messages chronologically
      loadedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(loadedMessages);
      setDbError(''); // Clear error if reading is successful
    }, (error) => {
      console.error("Firebase Read Error:", error);
      setDbError("عذراً، جاري انتسابك مع قواعد فايربيس. يرجى التأكد من تفعيل صلاحيات الكتابة والقراءة (Rules: .read=true, .write=true) في لوحة Firebase Realtime Database.");
    });

    return () => {
      unsubscribe();
    };
  }, [seriesId, isDbReady, displayLimit]);

  // Track series changes and message additions to grow limit organically only on new posts
  const prevSeriesIdRef = useRef<string | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  // Reset displayLimit to 50 when changing series
  useEffect(() => {
    setDisplayLimit(50);
  }, [seriesId]);

  useEffect(() => {
    if (prevSeriesIdRef.current !== seriesId) {
      prevSeriesIdRef.current = seriesId;
      lastMsgIdRef.current = lastMessageId || null;
      return;
    }

    if (lastMessageId && lastMsgIdRef.current && lastMessageId !== lastMsgIdRef.current) {
      // A new message has indeed arrived in real-time!
      // We increment displayLimit so that we don't truncate the older messages in view
      setDisplayLimit(prev => prev + 1);
    }
    
    lastMsgIdRef.current = lastMessageId || null;
  }, [lastMessageId, seriesId]);

  // Scroll to bottom only when a new message is appended (lastMessageId changes) or initially loaded
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [lastMessageId, isRegistered]);

  // Handles automatic dynamic loading when scrolling up near the top of the chat
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop <= 10) {
      // If we've loaded as many messages as the display limit, there are likely more in Firebase!
      if (messages.length === displayLimit) {
        const previousScrollHeight = target.scrollHeight;
        const previousScrollTop = target.scrollTop;
        
        // Load 10 more messages from Firebase
        setDisplayLimit(prev => prev + 10);
        
        // Smoothly adjust scroll position so user doesn't lose track
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const change = messagesContainerRef.current.scrollHeight - previousScrollHeight;
            messagesContainerRef.current.scrollTop = previousScrollTop + change;
          }
        });
      }
    }
  };

  const purgeExpiredDocs = async (safeId: string) => {
    if (!db) return;
    try {
      const messagesRef = ref(db, `chats/${safeId}`);
      const snapshot = await get(messagesRef);
      const data = snapshot.val();
      if (!data) return;

      const now = Date.now();
      const expiredKeys: string[] = [];

      Object.entries(data).forEach(([key, val]: [string, any]) => {
        const timestamp = val.createdAt || now;
        if (now - timestamp > 5 * 24 * 60 * 60 * 1000) {
          expiredKeys.push(key);
        }
      });

      if (expiredKeys.length > 0) {
        await Promise.all(expiredKeys.map(key => 
          remove(ref(db, `chats/${safeId}/${key}`))
        ));
      }
    } catch (err) {
      console.warn("Failed to purge old messages:", err);
    }
  };

  const triggerAiChatReply = async (safeSeriesId: string, userText: string) => {
    if (!db) return;

    // We strip out the mention tag
    const cleanQuery = userText.replace(/@\u062d\u0643\u064a\u0645|@حكيم/g, '').trim();
    if (!cleanQuery) return;

    setIsAiReplying(true);
    const waitTimer = setTimeout(() => {
        if (isAiReplying) {
          setShowWaitWarning(true);
          setTimeout(() => setShowWaitWarning(false), 5000);
        }
    }, 5000);

    try {
      // 1. Fetch simplified series list for AI context
      let simplifiedSeries: any[] = [];
      try {
        const list = await fetchAllSeries();
        simplifiedSeries = list.map(s => ({
          id: s.id,
          title: s.title,
          category: s.category
        }));
      } catch (err) {
        console.warn("Could not load series references for chat AI:", err);
      }

      // CLIENT-SIDE AI INITIATION (Internal Hakim)
      // Note: This API uses the server-side key updated via admin panel.
      const res = await fetch(getApiUrl('/api/v1/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanQuery,
          seriesList: simplifiedSeries,
          history: [] 
        })
      });

      if (!res.ok) throw new Error('Communication error');
      const data = await res.json();
      const aiText = data.text || "";

      if (aiText) {
        // Push Hakim's answer as a new message to the group chat
        const aiMsgRef = push(ref(db, `chats/${safeSeriesId}`));
        await set(aiMsgRef, {
          userName: `حكيم ✨ (مستشارك الذكي)`,
          userAvatar: `https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png`,
          text: aiText,
          createdAt: Date.now()
        });
      } else {
        throw new Error("Empty AI Response");
      }
    } catch (err: any) {
      console.error("Failed to process internal AI chat response:", err);
      if (db) {
        try {
          const aiMsgRef = push(ref(db, `chats/${safeSeriesId}`));
          const errorText = `عذراً! حكيم يواجه مشكلة في الاتصال حالياً. يرجى التأكد من مفتاح API أو المحاولة لاحقاً! 🤖❤️`;
            
          await set(aiMsgRef, {
            userName: `حكيم ✨ (مستشارك الذكي)`,
            userAvatar: `https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png`,
            text: errorText,
            createdAt: Date.now()
          });
        } catch (dbErr) {
          console.error("Failed to push fallback error to firebase chat:", dbErr);
        }
      }
    } finally {
      setIsAiReplying(false);
      clearTimeout(waitTimer);
      setShowWaitWarning(false);
    }
  };

  const handleReportMessage = async (msg: ChatMessage) => {
    const success = await reportComment({
      commentId: msg.id,
      commentText: msg.text || '[وسائط]',
      authorName: msg.userName,
      chatType: 'series',
      channelName: seriesName || 'مسلسل',
      reporterName: userName || 'مستخدم'
    });
    if (success) {
      alert("شكراً لك! تم استلام بلاغك وسيقوم فريق حكايتنا بمراجعة التعليق قريباً 🛡️✅");
    } else {
      alert("عذراً، حدث خطأ أثناء إرسال البلاغ. يرجى المحاولة مرة أخرى.");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customTxt?: string, customImg?: string, customVid?: string, customAud?: string) => {
    if (e) e.preventDefault();
    if (isBanned) {
      alert(`عذراً، لا يمكنك التعليق! حسابك محظور في كل غرف ومسلسلات شات حكايتنا بسبب إساءة الاستخدام أو إزعاج الآخرين. 🚨\n\nالسبب: ${banReason}`);
      return;
    }
    if (!db) return;

    const txt = customTxt !== undefined ? customTxt : inputText.trim();
    const finalImg = customImg !== undefined ? customImg : attachedImageUrl;
    const finalVid = customVid !== undefined ? customVid : '';
    const finalAud = customAud !== undefined ? customAud : '';

    if (!txt && !replyTo && !pendingScene && !finalImg && !finalVid && !finalAud) return;

    // Safety checks
    if (!userName || !userAvatar) return;

    let senderName = userName;

    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');

    // If editing
    if (editingMsg) {
      try {
        const msgRef = ref(db, `chats/${safeSeriesId}/${editingMsg.id}`);
        await set(msgRef, {
          ...editingMsg,
          text: txt,
          edited: true
        });
        setEditingMsg(null);
        setInputText('');
        return;
      } catch (err) {
        console.error("Edit error:", err);
      }
    }

    const messagesRef = ref(db, `chats/${safeSeriesId}`);
    const newMsgRef = push(messagesRef);
    
    const msgData: any = {
      userId: localStorage.getItem('guest_chat_pid') || 'guest_temp',
      userName: senderName,
      userAvatar,
      text: txt || (pendingScene ? `شوفوا هاذ اللقطة عند الدقيقة ${pendingScene.timeStr} 🔥` : ''),
      imageUrl: finalImg || '',
      videoUrl: finalVid || '',
      audioUrl: finalAud || '',
      createdAt: Date.now(),
    };

    if (replyTo) {
      msgData.replyTo = {
        userName: replyTo.userName,
        text: replyTo.text || 'رسالة صوتية'
      };
    }

    if (pendingScene) {
      msgData.sceneTime = pendingScene.time;
      msgData.sceneImage = pendingScene.image;
    }

    setInputText('');
    setReplyTo(null);
    setPendingScene(null);
    setAttachedImageUrl(null);

    try {
      await set(newMsgRef, msgData);
      // Quietly clean up old messages in background
      purgeExpiredDocs(safeSeriesId);

      // Trigger AI reply if user mentioned @حكيم or حكيم, or flagged as AI query
      const lowerTxt = txt.toLowerCase();
      if (lowerTxt.includes('حكيم') || lowerTxt.includes('@حكيم')) {
        setTimeout(() => triggerAiChatReply(safeSeriesId, txt), 200);
      }
    } catch (error) {
      console.error("Failed to send message to RTDB:", error);
      setDbError("فشل إرسال التعليق!");
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
        if (isImage) {
          handleSendMessage(undefined, "", uploadData.url, "", "");
        } else if (isVideo) {
          handleSendMessage(undefined, "", "", uploadData.url, "");
        } else if (isAudio) {
          handleSendMessage(undefined, "", "", "", uploadData.url);
        } else {
          handleSendMessage(undefined, "", uploadData.url, "", "");
        }
      } else {
        alert(isImage ? "عذراً، فشل رفع الصورة." : "عذراً، فشل رفع المقطع.");
      }
    } catch (err) {
      console.error("File upload failing:", err);
      alert(isImage ? "عذراً، فشل رفع الصورة." : "عذراً، فشل رفع الملف.");
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
      
      // Determine best MIME type for the browser (Safari prefers audio/mp4)
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        // Release hardware mic resource
        stream.getTracks().forEach(track => track.stop());

        setUploadingImage(true);
        try {
          const formData = new FormData();
          const extension = mediaRecorder.mimeType?.includes('mp4') ? 'mp4' : 'webm';
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
            handleSendMessage(undefined, "", "", "", uploadData.url);
          } else {
            alert("عذراً، فشل رفع المقطع الصوتي لخوادمنا.");
          }
        } catch (err) {
          console.error("Audio upload failing:", err);
          alert("عذراً، فشل رفع المقطع الصوتي لخوادمنا.");
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

  const shareScene = async () => {
    if (currentPlaybackTime === undefined || !db) return;
    
    const mins = Math.floor(currentPlaybackTime / 60);
    const secs = Math.floor(currentPlaybackTime % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    setPendingScene({
      time: currentPlaybackTime,
      timeStr,
      image: seriesImage || ''
    });
    
    // Focus input
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (input) input.focus();
  };

  const deleteMessage = async (msgId: string) => {
    if (!db) return;
    const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
    try {
      await remove(ref(db, `chats/${safeSeriesId}/${msgId}`));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setInputText(msg.text || '');
    // Focus input
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (input) input.focus();
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setDbError("متصفحك لا يدعم خاصية تحويل الصوت إلى نص.");
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      isIntentionalStop.current = false;
      preRecordingText.current = inputText;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA'; 
      recognition.continuous = true;
      recognition.interimResults = true;
      // Heuristic to improve stability
      (recognition as any).maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        let sessionFinals = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionFinals += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        
        const fullText = (preRecordingText.current + ' ' + sessionFinals).trim();
        setInputText(fullText);
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          setDbError("يرجى السماح بالوصول للميكروفون.");
          stopRecording();
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recognition.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setInterimText('');
      
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Speech STT error:", err);
      setDbError("حدث خطأ في تشغيل النظام الصوتي.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    isIntentionalStop.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Stop error:", e);
      }
    }
    setIsRecording(false);
    setInterimText('');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const POPULAR_EXPRESSIONS = [
    { emoji: '🔥', label: 'حماس' },
    { emoji: '👑', label: 'أسطوري' },
    { emoji: '😱', label: 'صدمة' },
    { emoji: '🤣', label: 'هههه' },
    { emoji: '❤️', label: 'بطل' },
    { emoji: '👋', label: 'يا هلا' }
  ];

  const sendExpression = async (exprText: string) => {
    if (!isRegistered || !userName || !userAvatar || !db) return;
    try {
      const safeSeriesId = (seriesId || 'default').replace(/[\.\$\#\[\]\/\s]/g, '_');
      const messagesRef = ref(db, `chats/${safeSeriesId}`);
      const newMsgRef = push(messagesRef);
      await set(newMsgRef, {
        userName,
        userAvatar,
        text: exprText,
        createdAt: Date.now()
      });

      // Quietly clean up old messages in background
      purgeExpiredDocs(safeSeriesId);
    } catch (error) {
      console.warn("RTDB expression shoot error:", error);
      setDbError("فشل إرسال التفاعل السريع! يرجى مراجعة صلاحيات وقواعد الكتابة لـ Realtime Database.");
    }
  };

  const handleLogOut = () => {
    // Handled by AuthContext and ProfileMenu
  };

  // Helper to format remaining time until message is deleted (5 days lifespan)
  const getRemainingTimeText = (createdAt: number) => {
    const elapsed = currentTime - createdAt;
    const remainingMs = (5 * 24 * 60 * 60 * 1000) - elapsed;
    if (remainingMs <= 0) return 'يختفي الآن...';
    
    const remainingSecs = Math.floor(remainingMs / 1000);
    const mins = Math.floor(remainingSecs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `يختفي خلال ${days} أيام`;
    if (hours > 0) return `يختفي خلال ${hours} ساعات`;
    if (mins > 0) return `يختفي خلال ${mins} دقائق`;
    
    return `يختفي خلال ${remainingSecs} ثانية`;
  };

  const selectedAvatarObj = AVATARS.find(a => a.id === userAvatar);

  const cleanAndRenderAiText = (text: string) => {
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
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 6. Split by bold markers '**'
    const contentParts = cleaned.split('**') || [];
    return (
      <span className="whitespace-pre-wrap leading-relaxed">
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
    );
  };

  return (
    <div className="w-full bg-[#0d0d10] sm:rounded-3xl rounded-none border-0 sm:border border-white/5 overflow-hidden flex flex-col h-full shadow-2xl relative font-sans">
      {/* Header */}
      <div className="bg-[#121215] border-b border-white/5 p-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {onClose && (
            <button 
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="text-right pr-1">
            <h3 className="text-[11px] font-black text-white flex items-center gap-1.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {seriesTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <button 
            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-zinc-500 hover:text-red-400 group"
            onClick={() => { /* Trigger report action - link to NoticeAndSupportBubble if possible | For now just alert */ alert('سيتم فتح نظام البلاغات قريباً'); }}
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">{onlineCount}</span>
          {localStorage.getItem('short_admin_access') === 'true' && (
            <Link to="/admin" target="_blank" className="p-1.5 hover:bg-primary/20 rounded-full transition-all text-primary border border-primary/20 ml-1 group" title="لوحة الإدارة">
              <ShieldAlert className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 relative overflow-hidden flex flex-col bg-zinc-950">
        
        {/* Profile Dialog for seamless fallback signup/signin */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 overflow-y-auto p-6 flex flex-col items-center justify-center text-right"
            >
              <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
                <div className="text-center space-y-2">
                  <h3 className="text-white font-black text-xl">مرحباً بك في الشات! 👋</h3>
                  <p className="text-zinc-400 text-xs font-semibold">لا يوجد تسجيل دخول، فقط اختر اسمك وادخل للدردشة المفتوحة مع الجميع.</p>
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">اسمك المستعار</label>
                  <input 
                    type="text" 
                    dir="rtl"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    placeholder="مثال: مشاهد غامض..." 
                    className="w-full bg-black/50 border border-white/5 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm font-semibold text-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">هل أنت؟</label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setGuestGenderInput('boy')}
                      className={cn(
                        "flex-1 py-3 px-2 rounded-xl text-xs font-black border transition-all text-center",
                        guestGenderInput === 'boy' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-black/50 text-zinc-500 border-white/5 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      ولد 👦
                    </button>
                    <button 
                      type="button"
                      onClick={() => setGuestGenderInput('girl')}
                      className={cn(
                        "flex-1 py-3 px-2 rounded-xl text-xs font-black border transition-all text-center",
                        guestGenderInput === 'girl' ? "bg-pink-500/20 text-pink-400 border-pink-500/50" : "bg-black/50 text-zinc-500 border-white/5 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      بنت 👧
                    </button>
                  </div>
                </div>

                <button 
                  onClick={saveGuestProfile}
                  disabled={!guestNameInput.trim()}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  دخول الشات ✨
                </button>
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

        {/* Message List */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar relative"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 opacity-50">
              <MessageSquare className="w-8 h-8" />
              <p className="text-xs font-bold">كن أول من يكتب في الشات!</p>
            </div>
          )}

          {/* Premium Loader for previous messages if there are remaining messages */}
          {messages.length > 0 && messages.length === displayLimit && (
            <div className="flex justify-center py-2">
              <button 
                onClick={() => {
                  if (messagesContainerRef.current) {
                    const previousScrollHeight = messagesContainerRef.current.scrollHeight;
                    const previousScrollTop = messagesContainerRef.current.scrollTop;
                    // Increase by 15 messages on click
                    setDisplayLimit(prev => prev + 15);
                    requestAnimationFrame(() => {
                      if (messagesContainerRef.current) {
                        const change = messagesContainerRef.current.scrollHeight - previousScrollHeight;
                        messagesContainerRef.current.scrollTop = previousScrollTop + change;
                      }
                    });
                  }
                }}
                className="text-[11px] font-black text-amber-500/80 hover:text-amber-400 transition-colors bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-white/5 shadow"
              >
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                عرض الرسائل السابقة 🍿
              </button>
            </div>
          )}

          {messages.map((msg) => {
            const msgAvatarObj = AVATARS.find(a => a.id === msg.userAvatar);
            const isMe = msg.userId === localStorage.getItem('guest_chat_pid');
            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse text-right' : 'flex-row text-right'}`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden shadow">
                  {msg.userAvatar.startsWith('http') ? (
                    <img src={msg.userAvatar} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                    msgAvatarObj?.svg
                  )}
                </div>
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-[9px] font-black text-zinc-500">
                    <span className={cn(msg.userName.includes('المدير') ? "text-primary flex items-center gap-1" : "text-zinc-500")}>
                      {msg.userName}
                      {msg.userName.includes('المدير') && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/20 text-[7px] text-primary border border-primary/30 ml-1">VIP</span>
                      )}
                    </span>
                    <span className="text-[8px] font-mono opacity-60 tracking-wider pr-1.5 border-r border-white/10">{getRemainingTimeText(msg.createdAt)}</span>
                  </div>
                  <div 
                    className={cn(
                      "group relative px-3.5 py-2 rounded-2xl text-[12px] font-semibold leading-relaxed shadow-lg cursor-pointer hover:scale-[0.99] active:scale-[0.97] transition-all",
                      isMe ? "bg-primary text-black rounded-tr-none hover:opacity-90" : "bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none hover:bg-zinc-800"
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, a, input, [role="button"], video, audio')) return;
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
                  >
                    {/* Always visible Reply button */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setReplyTo(msg); }}
                        className="absolute -left-7 top-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                    
                    {msg.replyTo && (
                      <div className={cn(
                        "mb-2 p-2 rounded-xl border-r-4 text-[11px] bg-black/40 border-primary text-white font-medium flex flex-col gap-0.5",
                      )}>
                        <span className="font-black text-primary text-[10px] uppercase">رداً على {msg.replyTo.userName}</span>
                        <span className="text-zinc-200 truncate">{msg.replyTo.text}</span>
                      </div>
                    )}
                    <div className="text-[13px]">{msg.userName && msg.userName.includes('حكيم') ? cleanAndRenderAiText(msg.text || '') : msg.text}</div>
                    {msg.imageUrl && (
                      <div className="relative overflow-hidden rounded-xl border border-zinc-900 bg-black/40 mt-2 max-w-[200px] cursor-pointer hover:opacity-90 transition active:scale-[0.98]">
                        <img 
                          src={msg.imageUrl} 
                          alt="تعليق مصور" 
                          referrerPolicy="no-referrer"
                          onClick={(e) => { e.stopPropagation(); setPreviewImage(msg.imageUrl || null); }}
                          className="w-full h-auto max-h-[160px] object-cover rounded-xl"
                        />
                      </div>
                    )}
                    {msg.videoUrl && (
                      <div className="relative overflow-hidden rounded-xl border border-zinc-900 bg-black mt-2 max-w-[240px]">
                        <video 
                          src={msg.videoUrl} 
                          controls 
                          preload="metadata"
                          className="w-full h-auto max-h-[180px] object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    {msg.audioUrl && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <CustomAudioPlayer src={msg.audioUrl} />
                      </div>
                    )}
                    {msg.edited && <span className="text-[8px] opacity-50 mr-1">(تم التعديل)</span>}
                      {msg.sceneTime !== undefined && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSeekTo?.(msg.sceneTime!); }} 
                        className={cn(
                          "mt-3 block w-full overflow-hidden rounded-2xl border transition-all group/card",
                          (msg.text && msg.text.length > 50) ? "aspect-[16/9]" : "aspect-video",
                          isMe ? "bg-black/20 border-white/5 hover:border-white/20" : "bg-black/30 border-white/5 hover:border-primary/40"
                        )}
                      >
                        <div className={cn(
                          "relative w-full bg-zinc-950 flex items-center justify-center overflow-hidden",
                           (msg.text && msg.text.length > 50) ? "h-full" : "aspect-video"
                        )}>
                          <img src={msg.sceneImage || '/placeholder-series.jpg'} referrerPolicy="no-referrer" alt="scene" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover/card:scale-105 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                          <div className="absolute inset-0 flex items-center justify-center z-20">
                             <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 group-hover/card:scale-110 transition-transform">
                               <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                             </div>
                          </div>
                          <div className={cn(
                            "absolute bottom-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black italic shadow-2xl tracking-wider",
                            isMe ? "bg-black/50 text-white" : "bg-primary/90 text-black"
                          )}>
                            <Clock className="w-3 h-3" />
                            <span>{Math.floor(msg.sceneTime / 60)}:{(msg.sceneTime % 60).toString().padStart(2, '0')}</span>
                          </div>
                        </div>
                        <div className="p-2.5 text-right bg-black/50 backdrop-blur-sm">
                          <p className={cn("text-[10px] font-bold flex items-center gap-2", isMe ? "text-zinc-400" : "text-zinc-200")}>
                            <Share2 className="w-3 h-3" />
                            شاهد هذه اللحظة المميزة
                          </p>
                        </div>
                      </button>
                    )}

                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Real-time Typing and AI response alerts bar */}
        {(typingUsers.length > 0 || isAiReplying) && (
          <div className="px-4 py-2 bg-[#0d0d14] border-t border-white/5 flex items-center gap-2 text-[10px] text-zinc-400 font-bold animate-fade-in select-none">
            <RefreshCw className="w-3 h-3 text-primary animate-spin" />
            <span className="italic block">
              {isAiReplying ? (
                <span className="text-primary font-black">حكيم يستحضر الرد الذكي الآن... ✨</span>
              ) : typingUsers.length === 1 ? (
                `المتابع ${typingUsers[0]} يكتب تعليقاً...`
              ) : (
                `المتابعون ${typingUsers.join(' و ')} يكتبون الآن...`
              )}
            </span>
          </div>
        )}

        {/* Input area */}
        <div className="bg-[#121218] border-t border-white/5 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-0">
          <AnimatePresence mode="popLayout">
            {replyTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-white/5 flex items-center justify-between border-b border-white/5"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Reply className="w-3 h-3 text-primary shrink-0" />
                  <div className="text-[10px] text-zinc-400 truncate pr-2">
                    <span className="font-black text-white/50">رد على {replyTo.userName}:</span> {replyTo.text}
                  </div>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
              </motion.div>
            )}

            {editingMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-blue-500/10 flex items-center justify-between border-b border-blue-500/20"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Wand2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <div className="text-[10px] text-blue-400/70 truncate pr-2">
                    <span className="font-black">تعديل رسالتك:</span> {editingMsg.text}
                  </div>
                </div>
                <button onClick={() => { setEditingMsg(null); setInputText(''); }} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
              </motion.div>
            )}

            {pendingScene && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-zinc-900 border-b border-emerald-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0 border border-white/10 relative">
                    {pendingScene.image && <img src={pendingScene.image} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-50" />}
                    <Camera className="absolute inset-0 m-auto w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-black text-emerald-400">مشاركة لقطة</p>
                    <p className="text-[9px] text-zinc-500">سيتم إرفاق لقطة عند {pendingScene.timeStr}</p>
                  </div>
                  <button onClick={() => setPendingScene(null)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500"><X className="w-4 h-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-4 py-2 border-b border-white/5 bg-zinc-950/20 flex flex-col gap-2">
            {/* Action Row */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {(currentPlaybackTime !== undefined) && (
                <button 
                  type="button"
                  onClick={shareScene} 
                  className={cn(
                    "flex items-center gap-1 px-2 py-2 rounded-lg text-[8px] font-bold tracking-tight transition-all shrink-0 border relative overflow-hidden group whitespace-nowrap active:scale-95",
                    pendingScene 
                      ? "bg-zinc-800 text-zinc-500 border-white/5 cursor-not-allowed" 
                      : "bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.12)]"
                  )}
                >
                  <Camera className="w-2.5 h-2.5" />
                  <span>{pendingScene ? 'جاري التحضير...' : `شارك لقطة من مسلسل ${seriesTitle}`}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <button 
                type="button"
                onClick={() => setInputText(prev => prev.includes('@حكيم') ? prev : `@حكيم ${prev} `)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black transition-all shrink-0 border bg-primary/10 text-primary border-primary/25 hover:bg-primary/20 active:scale-95 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" /> 
                اسأل حكيم
              </button>

              <div className="w-[1.5px] h-4 bg-white/10 shrink-0 mx-1" />

              {/* Quick Replies */}
              {[
                { label: 'سلام عليكم', text: 'سلام عليكم' },
                { label: '😂😂😂', text: '😂😂😂' },
                { label: 'حي عينك', text: 'حي عينك' },
                { label: 'ههههههههههه', text: 'هههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههههه 😂' }
              ].map(e => (
                <button 
                  type="button" 
                  key={e.label} 
                  onClick={() => { setInputText(e.text); setTimeout(() => handleSendMessage(), 50); }} 
                  className="px-4 py-2 bg-zinc-900 rounded-xl text-[11px] font-bold text-zinc-400 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all shrink-0 hover:text-primary whitespace-nowrap active:scale-95"
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Always show input, handle restriction in handleSendMessage */}
          {uploadingImage && (
            <div className="flex items-center gap-2 mb-2 bg-primary/10 border border-primary/20 text-primary py-1.5 px-3 rounded-xl text-[10px] w-fit mr-auto ml-3">
              <div className="w-3.5 h-3.5 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
              <span>جاري رفع وتنشيط الملف...</span>
            </div>
          )}
          {attachedImageUrl && (
            <div className="relative inline-block mb-2 mr-auto ml-3 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
              <img src={attachedImageUrl} alt="Preview" className="w-14 h-14 object-cover rounded-lg" />
              <button 
                type="button" 
                onClick={() => setAttachedImageUrl(null)} 
                className="absolute -top-1.5 -right-1.5 bg-black text-white hover:bg-rose-600 rounded-full p-0.5 border border-zinc-800 duration-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="p-3 flex gap-2 items-center">
            {isVoiceRecording ? (
              <div className="flex-1 flex items-center justify-between bg-zinc-900/60 border border-primary/20 rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  <div className="text-[10px] font-black text-primary uppercase tracking-widest">
                    جاري تسجيل فويس... {voiceSeconds}ث
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => stopVoiceRecording(true)} 
                    className="p-1 px-2.5 text-zinc-500 hover:text-rose-500 transition-colors duration-200 text-xs"
                    title="إلغاء التسجيل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => stopVoiceRecording(false)} 
                    className="w-8 h-8 bg-primary text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
                    title="تأكيد وإرسال"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            ) : isRecording ? (
              <div className="flex-1 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2">
                <div className="flex items-center gap-3">
                  <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  <div className="text-[10px] font-black text-primary uppercase tracking-widest truncate max-w-[150px]">أسمعك... {interimText}</div>
                </div>
                <button type="button" onClick={stopRecording} className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-lg"><Square className="w-3 h-3" /></button>
              </div>
            ) : (
              <>
                <button type="submit" disabled={!inputText.trim() && !replyTo && !pendingScene && !attachedImageUrl} className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-lg shrink-0 transition-all", (inputText.trim() || replyTo || pendingScene || attachedImageUrl) ? "bg-primary text-black" : "bg-white/5 text-zinc-500 opacity-20")}><Send className={cn("w-4.5 h-4.5 -rotate-45", editingMsg && "rotate-0")} /></button>
                <input type="text" dir="rtl" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={pendingScene ? "اكتب تعليقك على اللقطة..." : editingMsg ? "اكتب التعديل..." : "اكتب تعليقك أو اسأل حكيم..."} className="flex-1 bg-white/5 border border-white/5 rounded-full py-2.5 px-5 text-xs outline-none text-white focus:ring-1 focus:ring-primary/40 placeholder-zinc-600 font-semibold" />
                
                <label className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer border border-white/5" title="إرفاق صورة أو فيديو">
                  <Camera className="w-4.5 h-4.5" />
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingImage}
                  />
                </label>
                
                <button type="button" onClick={startVoiceRecording} className="w-10 h-10 bg-zinc-800 text-zinc-400 rounded-full flex items-center justify-center hover:text-white shrink-0 transition-colors" title="تسجيل رسالة صوتية"><Mic className="w-4.5 h-4.5" /></button>
                <button type="button" onClick={startRecording} className="w-8 h-8 bg-zinc-900 border border-zinc-800 text-zinc-550 rounded-full flex items-center justify-center hover:text-primary shrink-0 transition-colors text-[9px]" title="تحويل الصوت لنص">تخطيط</button>
              </>
            )}
          </form>
        </div>
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
              className="absolute top-4 right-4 bg-zinc-900/80 text-white p-3 rounded-full border border-zinc-850 hover:bg-zinc-800 transition duration-200"
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
                    setReplyTo(actionMenuMessage);
                    setActionMenuMessage(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  <Reply className="w-4 h-4 text-emerald-400" />
                  <span>الرد على هذا التعليق</span>
                </button>

                {/* 2. Report Option */}
                {actionMenuMessage.userId !== localStorage.getItem('guest_chat_pid') && (
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
                {actionMenuMessage.userId === localStorage.getItem('guest_chat_pid') && actionMenuMessage.text && !actionMenuMessage.imageUrl && !actionMenuMessage.videoUrl && !actionMenuMessage.audioUrl && typeof startEdit === 'function' && (
                  <button
                    onClick={() => {
                      startEdit(actionMenuMessage);
                      setActionMenuMessage(null);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-amber-950/20 hover:border-amber-900 border border-zinc-850 text-amber-400 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 text-amber-400" />
                    <span>تعديل التعليق ✍️</span>
                  </button>
                )}

                {/* 4. Delete Option (if mine) */}
                {actionMenuMessage.userId === localStorage.getItem('guest_chat_pid') && typeof deleteMessage === 'function' && (
                  <button
                    onClick={() => {
                      deleteMessage(actionMenuMessage.id);
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
