import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Users, 
  UserCheck, 
  UserPlus, 
  UserMinus,
  Send, 
  Mic, 
  Square, 
  Image, 
  Smile, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ArrowLeft, 
  Clock, 
  Search, 
  Volume2, 
  Sparkles,
  User,
  Shield,
  Activity,
  ChevronLeft,
  Copy,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ref, push, set, onValue, remove, get } from 'firebase/database';
import { db } from '../services/firebase';
import { AVATARS } from '../components/SeriesChat';
import ProfileTemplateOverlay from '../components/ProfileTemplateOverlay';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { cn } from '../lib/utils';
import { getApiUrl } from '../lib/apiConfig';

const getProxiedUrl = (url?: string) => {
  if (!url) return '';
  if (
    url.startsWith('https://f.top4top.') || 
    url.startsWith('http://f.top4top.') || 
    url.includes('top4top.') ||
    url.includes('catbox.moe') ||
    url.startsWith('http://')
  ) {
    return `/api/v1/stream-range-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

// Simple Custom Audio Player for direct messages
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
    
    if (audioRef.current.paused) {
      audioRef.current.play().catch(err => {
        console.warn("Retrying playback...", err);
        if (audioRef.current) {
          audioRef.current.load();
          audioRef.current.play().catch(e2 => console.error("Play failed:", e2));
        }
      });
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

  return (
    <div className="flex items-center gap-2 bg-black/40 border border-zinc-800 rounded-xl p-2 min-w-[180px] select-none text-white my-1" style={{ direction: 'ltr' }}>
      <audio ref={audioRef} src={getProxiedUrl(src)} preload="metadata" className="hidden" />
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-8 h-8 rounded-full bg-primary hover:bg-primary/85 hover:scale-105 active:scale-95 flex items-center justify-center transition shrink-0 cursor-pointer text-black"
      >
        {isPlaying ? <span className="text-[10px]">⏸</span> : <span className="text-[10px] translate-x-[1px]">▶</span>}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={currentTime} 
          onChange={(e) => {
            if (audioRef.current) {
              const val = parseFloat(e.target.value);
              audioRef.current.currentTime = val;
              setCurrentTime(val);
            }
          }}
          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary" 
        />
        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

interface UserProfile {
  userId: string;
  name: string;
  avatar: string;
  avatarPosV?: string;
  avatarPosH?: string;
  avatarZoom?: string;
  template?: string;
  lastActive?: number;
}

interface DirectMessage {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  createdAt: number;
  isSticker?: boolean;
}

interface Conversation {
  friendId: string;
  lastMessage: string;
  lastMessageSenderId: string;
  timestamp: number;
  unread: boolean;
  friendProfile?: UserProfile;
}

interface FriendRequest {
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderAvatarPosV?: string;
  senderAvatarPosH?: string;
  senderAvatarZoom?: string;
  senderTemplate?: string;
  timestamp: number;
}

export default function DirectMessagesScreen() {
  const myId = localStorage.getItem('guest_chat_pid') || 'guest_temp';
  const myName = localStorage.getItem('guest_chat_name') || 'مشاهد';

  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  
  // Real-time user profile directory cache to render friends correctly
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile>>({});

  // Chat panel active state
  const [activeChatFriendId, setActiveChatFriendId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Sticker Panel inside Private Messages
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [savedStickers, setSavedStickers] = useState<{id: string, url: string}[]>(() => {
    const saved = localStorage.getItem('user_saved_stickers');
    return saved ? JSON.parse(saved) : [
      { id: 'st1', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpiazJpbmRxZXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vV07p7lS8JzUu8kY9S/giphy.gif' },
      { id: 'st2', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpiazJpbmRxZXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/v3HwU9Z8R2u9k867p8/giphy.gif' },
      { id: 'st3', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpiazJpbmRxZXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vO8fJ2Zp6uR2P6w4zM/giphy.gif' },
      { id: 'st4', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpiazJpbmRxZXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeXpkeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/vNfR9Xp1o2k5X2R5W9/giphy.gif' },
    ];
  });

  // Voice recording states
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<number | null>(null);

  // Search profile states
  const [searchUserIdInput, setSearchUserIdInput] = useState('');
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Selected user profile view modal
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [friendshipStatusWithViewed, setFriendshipStatusWithViewed] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and check URL params for direct actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actPid = params.get('chat_with_pid');
    if (actPid && db) {
      setActiveChatFriendId(actPid);
      
      // Auto-load and show user profile modal
      const userRef = ref(db, `users/${actPid}`);
      get(userRef).then(snapshot => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          setViewedProfile({
            userId: actPid,
            name: val.name || val.userName || 'مستخدم جديد',
            avatar: val.avatar || val.userAvatar || 'boy1',
            avatarPosV: val.avatarPosV || val.userAvatarPosV || '50',
            avatarPosH: val.avatarPosH || val.userAvatarPosH || '50',
            avatarZoom: val.avatarZoom || val.userAvatarZoom || '100',
            template: val.template || val.userTemplate || ''
          });
        }
      });

      // Clean up URL parameters quietly
      const url = new URL(window.location.href);
      url.searchParams.delete('chat_with_pid');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [db]);

  // Listen to profile updates dynamically
  useEffect(() => {
    if (!db || !myId) return;

    // 1. Fetch conversations list
    const convsRef = ref(db, `user_conversations/${myId}`);
    const unsubConvs = onValue(convsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setConversations([]);
        return;
      }
      const list = Object.entries(data).map(([friendId, val]: [string, any]) => ({
        friendId,
        lastMessage: val.lastMessage || '',
        lastMessageSenderId: val.lastMessageSenderId || '',
        timestamp: val.timestamp || 0,
        unread: !!val.unread
      }));
      // Sort by latest message
      list.sort((a, b) => b.timestamp - a.timestamp);
      setConversations(list);

      // Fetch profiles for these conversation partners
      list.forEach(c => {
        fetchAndCacheProfile(c.friendId);
      });
    });

    // 2. Fetch friends list
    const friendsRef = ref(db, `friends/${myId}`);
    const unsubFriends = onValue(friendsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setFriends([]);
        return;
      }
      const friendIds = Object.keys(data);
      friendIds.forEach(fid => {
        fetchAndCacheProfile(fid);
      });
    });

    // 3. Fetch incoming friend requests
    const reqsRef = ref(db, `friend_requests/${myId}`);
    const unsubReqs = onValue(reqsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setIncomingRequests([]);
        return;
      }
      const list = Object.entries(data)
        .filter(([_, val]: [string, any]) => val && val.status === 'pending')
        .map(([senderId, val]: [string, any]) => ({
          senderId,
          senderName: val.senderName || 'مستخدم',
          senderAvatar: val.senderAvatar || 'boy1',
          senderAvatarPosV: val.senderAvatarPosV,
          senderAvatarPosH: val.senderAvatarPosH,
          senderAvatarZoom: val.senderAvatarZoom,
          senderTemplate: val.senderTemplate,
          timestamp: val.timestamp || 0
        }));
      setIncomingRequests(list);
    });

    return () => {
      unsubConvs();
      unsubFriends();
      unsubReqs();
    };
  }, [db, myId]);

  // Sync state for actual friends array when profileCache or friends list keys change
  useEffect(() => {
    if (!db || !myId) return;
    const friendsRef = ref(db, `friends/${myId}`);
    get(friendsRef).then(snapshot => {
      const data = snapshot.val();
      if (data) {
        const friendIds = Object.keys(data);
        const list: UserProfile[] = [];
        friendIds.forEach(fid => {
          if (profileCache[fid]) {
            list.push(profileCache[fid]);
          } else {
            // Placeholder
            list.push({ userId: fid, name: 'جاري التحميل...', avatar: 'boy1' });
          }
        });
        setFriends(list);
      } else {
        setFriends([]);
      }
    });
  }, [profileCache]);

  // Keep viewedProfile's friendship status updated
  useEffect(() => {
    if (!viewedProfile || !db || !myId) return;

    // Check friendship status
    const checkStatus = async () => {
      const friendsRef = ref(db, `friends/${myId}/${viewedProfile.userId}`);
      const friendSnap = await get(friendsRef);
      if (friendSnap.exists()) {
        setFriendshipStatusWithViewed('friends');
        return;
      }

      const sentRef = ref(db, `friend_requests/${viewedProfile.userId}/${myId}`);
      const sentSnap = await get(sentRef);
      if (sentSnap.exists() && sentSnap.val().status === 'pending') {
        setFriendshipStatusWithViewed('pending_sent');
        return;
      }

      const receivedRef = ref(db, `friend_requests/${myId}/${viewedProfile.userId}`);
      const receivedSnap = await get(receivedRef);
      if (receivedSnap.exists() && receivedSnap.val().status === 'pending') {
        setFriendshipStatusWithViewed('pending_received');
        return;
      }

      setFriendshipStatusWithViewed('none');
    };

    checkStatus();
  }, [viewedProfile, myId]);

  // Fetch and cache user profile details
  const fetchAndCacheProfile = (userId: string) => {
    if (!db || profileCache[userId]) return;
    const userRef = ref(db, `users/${userId}`);
    get(userRef).then(snapshot => {
      const val = snapshot.val();
      if (val) {
        const profile: UserProfile = {
          userId,
          name: val.name || 'مستخدم جديد',
          avatar: val.avatar || 'boy1',
          avatarPosV: val.avatarPosV || '50',
          avatarPosH: val.avatarPosH || '50',
          avatarZoom: val.avatarZoom || '100',
          template: val.template || '',
          lastActive: val.lastActive
        };
        setProfileCache(prev => ({
          ...prev,
          [userId]: profile
        }));
      }
    });
  };

  // Setup actual active chat messages stream
  useEffect(() => {
    if (!db || !myId || !activeChatFriendId) {
      setChatMessages([]);
      return;
    }

    // Set conversations unread to false
    set(ref(db, `user_conversations/${myId}/${activeChatFriendId}/unread`), false);

    const chatKey = [myId, activeChatFriendId].sort().join('_');
    const privateRef = ref(db, `private_chats/${chatKey}`);

    const unsubChat = onValue(privateRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setChatMessages([]);
        return;
      }
      const list = Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        senderId: val.senderId,
        text: val.text || '',
        imageUrl: val.imageUrl,
        audioUrl: val.audioUrl,
        createdAt: val.createdAt || 0,
        isSticker: !!val.isSticker
      }));
      list.sort((a, b) => a.createdAt - b.createdAt);
      setChatMessages(list);

      // scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => {
      unsubChat();
    };
  }, [db, activeChatFriendId, myId]);

  // Search User by ID
  const handleSearchUser = async () => {
    const input = searchUserIdInput.trim();
    if (!input) return;
    setIsSearching(true);
    setSearchError('');
    setSearchedUser(null);

    try {
      const userRef = ref(db, `users/${input}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        setSearchedUser({
          userId: input,
          name: val.name || 'مستخدم مجهول',
          avatar: val.avatar || 'boy1',
          avatarPosV: val.avatarPosV || '50',
          avatarPosH: val.avatarPosH || '50',
          avatarZoom: val.avatarZoom || '100',
          template: val.template || ''
        });
      } else {
        setSearchError('عذراً، لم نجد أي مستخدم يحمل هذا الرقم المعرف (ID) ⚠️');
      }
    } catch (err) {
      console.error(err);
      setSearchError('حدث خطأ أثناء البحث، يرجى المحاولة لاحقاً.');
    } finally {
      setIsSearching(false);
    }
  };

  // Send Friend Request
  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!db || !myId) return;
    if (targetUserId === myId) {
      alert('لا يمكنك إرسال طلب صداقة لنفسك! 😄');
      return;
    }

    try {
      const requestRef = ref(db, `friend_requests/${targetUserId}/${myId}`);
      await set(requestRef, {
        senderId: myId,
        senderName: myName,
        senderAvatar: localStorage.getItem('user_avatar_url') || localStorage.getItem('guest_chat_avatar') || 'boy1',
        senderAvatarPosV: localStorage.getItem('user_avatar_pos_v') || '50',
        senderAvatarPosH: localStorage.getItem('user_avatar_pos_h') || '50',
        senderAvatarZoom: localStorage.getItem('user_avatar_zoom') || '100',
        senderTemplate: localStorage.getItem('user_profile_template') || '',
        timestamp: Date.now(),
        status: 'pending'
      });
      setFriendshipStatusWithViewed('pending_sent');
      alert('تم إرسال طلب الصداقة بنجاح! وفي انتظار قبول الطرف الآخر. ✨');
    } catch (err) {
      console.error(err);
      alert('فشل إرسال الطلب، يرجى إعادة المحاولة.');
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (senderId: string) => {
    if (!db || !myId) return;
    try {
      // 1. Add to both friends lists
      await set(ref(db, `friends/${myId}/${senderId}`), true);
      await set(ref(db, `friends/${senderId}/${myId}`), true);

      // 2. Remove or complete request
      await remove(ref(db, `friend_requests/${myId}/${senderId}`));

      // 3. Create initial conversation slot
      await set(ref(db, `user_conversations/${myId}/${senderId}`), {
        friendId: senderId,
        lastMessage: 'تم قبول طلب الصداقة! 👋 ابدأ المراسلة الآن',
        lastMessageSenderId: senderId,
        timestamp: Date.now(),
        unread: true
      });
      await set(ref(db, `user_conversations/${senderId}/${myId}`), {
        friendId: myId,
        lastMessage: 'تم قبول طلب الصداقة! 👋 ابدأ المراسلة الآن',
        lastMessageSenderId: senderId,
        timestamp: Date.now(),
        unread: false
      });

      // Force refreshing friends
      fetchAndCacheProfile(senderId);
      setFriendshipStatusWithViewed('friends');
      alert('تم قبول طلب الصداقة بنجاح! لقد أصبحتم أصدقاء الآن. 🎉');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في قبول الطلب.');
    }
  };

  // Decline Friend Request
  const handleDeclineRequest = async (senderId: string) => {
    if (!db || !myId) return;
    try {
      await remove(ref(db, `friend_requests/${myId}/${senderId}`));
      setFriendshipStatusWithViewed('none');
      alert('تم رفض طلب الصداقة.');
    } catch (err) {
      console.error(err);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendId: string) => {
    if (!db || !myId) return;
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء الصداقة وإزالة هذا المستخدم من قائمة أصدقائك؟')) return;

    try {
      await remove(ref(db, `friends/${myId}/${friendId}`));
      await remove(ref(db, `friends/${friendId}/${myId}`));
      setFriendshipStatusWithViewed('none');
      alert('تم إلغاء الصداقة بنجاح.');
    } catch (err) {
      console.error(err);
    }
  };

  // Send Direct Message
  const handleSendPrivateMessage = async (textOverride?: string, customImg?: string, customAud?: string, isStickerOption = false) => {
    if (!db || !myId || !activeChatFriendId) return;

    const txt = textOverride !== undefined ? textOverride : inputText.trim();
    const finalImg = customImg !== undefined ? customImg : attachedImage;
    const finalAud = customAud !== undefined ? customAud : '';

    if (!txt && !finalImg && !finalAud) return;

    const chatKey = [myId, activeChatFriendId].sort().join('_');
    const privateRef = ref(db, `private_chats/${chatKey}`);
    const newMsgRef = push(privateRef);

    const msgData = {
      senderId: myId,
      text: txt,
      imageUrl: finalImg || '',
      audioUrl: finalAud || '',
      createdAt: Date.now(),
      isSticker: isStickerOption
    };

    setInputText('');
    setAttachedImage(null);

    try {
      await set(newMsgRef, msgData);

      // Update conversations index for both users
      let displayMessage = txt;
      if (finalAud) displayMessage = '🎙️ رسالة صوتية';
      else if (finalImg && isStickerOption) displayMessage = '✨ ملصق مميز';
      else if (finalImg) displayMessage = '🖼️ صورة';

      await set(ref(db, `user_conversations/${myId}/${activeChatFriendId}`), {
        friendId: activeChatFriendId,
        lastMessage: displayMessage,
        lastMessageSenderId: myId,
        timestamp: Date.now(),
        unread: false
      });

      await set(ref(db, `user_conversations/${activeChatFriendId}/${myId}`), {
        friendId: myId,
        lastMessage: displayMessage,
        lastMessageSenderId: myId,
        timestamp: Date.now(),
        unread: true
      });
    } catch (err) {
      console.error('Send DM error:', err);
    }
  };

  // Image Upload inside DM
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/upload-media', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setAttachedImage(data.url);
        // Ask if send directly
        if (confirm('هل ترغب في إرسال الصورة المحددة فوراً؟')) {
          handleSendPrivateMessage('', data.url);
        }
      } else {
        alert('فشل رفع الصورة.');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء رفع الصورة.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Voice Note Recorder inside DM
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("متصفحك لا يدعم تسجيل الصوت أو يفتقد لصلاحية الوصول.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

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
        stream.getTracks().forEach(track => track.stop());

        setIsUploadingImage(true);
        try {
          const formData = new FormData();
          const extension = mediaRecorder.mimeType?.includes('mp4') ? 'm4a' : 'mp3';
          formData.append("file", audioBlob, `dm_voice_${Date.now()}.${extension}`);

          const uploadRes = await fetch("/api/v1/upload-media", {
            method: "POST",
            body: formData
          });
          
          if (!uploadRes.ok) {
            alert("عذراً، فشل رفع المقطع الصوتي لخوادمنا.");
            return;
          }

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.url) {
            handleSendPrivateMessage('', '', uploadData.url);
          } else {
            alert("عذراً، فشل رفع المقطع الصوتي.");
          }
        } catch (err) {
          console.error(err);
          alert("عذراً، حدث خطأ أثناء الرفع.");
        } finally {
          setIsUploadingImage(false);
        }
      };

      mediaRecorder.start();
      setIsVoiceRecording(true);
      setVoiceSeconds(0);
      
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("يرجى منح صلاحية الميكروفون لتسجيل فويس بنجاح.");
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

  const openUserProfile = (userId: string) => {
    if (profileCache[userId]) {
      setViewedProfile(profileCache[userId]);
    } else {
      // Fetch once
      const userRef = ref(db, `users/${userId}`);
      get(userRef).then(snapshot => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const profile = {
            userId,
            name: val.name || 'مستخدم جديد',
            avatar: val.avatar || 'boy1',
            avatarPosV: val.avatarPosV || '50',
            avatarPosH: val.avatarPosH || '50',
            avatarZoom: val.avatarZoom || '100',
            template: val.template || ''
          };
          setProfileCache(prev => ({ ...prev, [userId]: profile }));
          setViewedProfile(profile);
        } else {
          alert('تعذر تحميل معلومات هذا المستخدم.');
        }
      });
    }
  };

  // Helper for rendering date nicely
  const formatTimeText = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-primary/30 pb-32">
      <Header />

      <main className="max-w-6xl mx-auto px-4 pt-4 pb-12">
        
        {/* Desktop Split Pane & Mobile Single Panel Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-zinc-950/40 border border-white/5 rounded-[2rem] overflow-hidden min-h-[650px] shadow-2xl relative">
          
          {/* LEFT COLUMN: Conversation List & Actions (4 Columns on Desktop) */}
          <div className={cn(
            "md:col-span-4 border-l border-white/5 flex flex-col h-[650px] bg-zinc-950/70",
            activeChatFriendId ? "hidden md:flex" : "flex"
          )}>
            
            {/* My ID Badge Card */}
            <div className="p-4 bg-gradient-to-br from-zinc-900 to-zinc-950 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">معرف الخاص بك (ID)</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(myId);
                    alert('📋 تم نسخ الـ ID الخاص بك بنجاح!');
                  }}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-primary hover:text-primary-hover transition-all flex items-center gap-1 text-[10px] font-black"
                >
                  <Copy className="w-3 h-3" />
                  نسخ الـ ID
                </button>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono select-all text-amber-400 font-bold text-center tracking-wider">
                {myId}
              </div>
            </div>

            {/* Custom Tab selectors */}
            <div className="flex border-b border-white/5 bg-zinc-950 p-2 gap-1.5">
              <button 
                onClick={() => setActiveTab('chats')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 border",
                  activeTab === 'chats' 
                    ? "bg-primary border-primary text-black" 
                    : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                المحادثات
                {conversations.filter(c => c.unread).length > 0 && (
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                )}
              </button>
              
              <button 
                onClick={() => setActiveTab('friends')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 border",
                  activeTab === 'friends' 
                    ? "bg-primary border-primary text-black" 
                    : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                الأصدقاء
              </button>

              <button 
                onClick={() => setActiveTab('requests')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 border relative",
                  activeTab === 'requests' 
                    ? "bg-primary border-primary text-black" 
                    : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white"
                )}
              >
                <UserCheck className="w-3.5 h-3.5" />
                الطلبات
                {incomingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-[8px] text-white font-black px-1.5 py-0.5 rounded-full ring-2 ring-zinc-950">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Add Friend Area */}
            <div className="p-3 border-b border-white/5 bg-zinc-950/20">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="ابحث برقم الـ ID لإرسال طلب صداقة..."
                  value={searchUserIdInput}
                  onChange={(e) => setSearchUserIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                  className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-primary/40 transition-all font-mono text-center"
                />
                <button 
                  onClick={handleSearchUser}
                  disabled={isSearching}
                  className="px-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center text-zinc-300 border border-white/5 active:scale-95"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Search results banner */}
              {searchedUser && (
                <div className="mt-3 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 p-3 rounded-2xl animate-fade-in flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-900 relative border border-white/10 shrink-0">
                      {searchedUser.avatar.startsWith('http') ? (
                        <img 
                          src={getProxiedUrl(searchedUser.avatar)} 
                          className="w-full h-full object-cover rounded-full" 
                          style={{
                            objectPosition: `${searchedUser.avatarPosH || '50'}% ${searchedUser.avatarPosV || '50'}%`,
                            transform: `scale(${(parseFloat(searchedUser.avatarZoom || '100')) / 100})`
                          }}
                          alt="" 
                        />
                      ) : (
                        AVATARS.find(a => a.id === searchedUser.avatar)?.svg
                      )}
                      {searchedUser.template && searchedUser.template !== 'none' && (
                        <ProfileTemplateOverlay template={searchedUser.template} />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-white">{searchedUser.name}</h5>
                      <p className="text-[9px] text-zinc-500 font-mono">{searchedUser.userId.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setViewedProfile(searchedUser);
                      setSearchUserIdInput('');
                      setSearchedUser(null);
                    }}
                    className="px-2.5 py-1 bg-primary text-black text-[10px] font-black rounded-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    عرض الملف
                  </button>
                </div>
              )}
              {searchError && (
                <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* TAB CONTAINER BODY: List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              
              {/* 1. CHATS TAB */}
              {activeTab === 'chats' && (
                <>
                  {conversations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                      <MessageSquare className="w-8 h-8 opacity-25 text-primary" />
                      <p className="text-xs font-bold leading-relaxed">لا توجد محادثات خاصة بعد.<br />افتح شات المسلسل واضغط على اسم أي مستخدم لبدء محادثة سرية وسريعة معه!</p>
                    </div>
                  ) : (
                    conversations.map(c => {
                      const profile = profileCache[c.friendId];
                      const avatarId = profile?.avatar || 'boy1';
                      const avatarObj = AVATARS.find(a => a.id === avatarId);
                      const displayName = profile?.name || 'جاري التحميل...';

                      return (
                        <button
                          key={c.friendId}
                          onClick={() => setActiveChatFriendId(c.friendId)}
                          className={cn(
                            "w-full text-right p-3 rounded-2xl flex items-center gap-3 transition-all border",
                            activeChatFriendId === c.friendId 
                              ? "bg-gradient-to-r from-zinc-900 to-zinc-950 border-primary/30" 
                              : "bg-zinc-900/40 border-white/5 hover:bg-zinc-900/70"
                          )}
                        >
                          {/* Avatar block with dynamic position and template */}
                          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden shadow relative">
                            {avatarId.startsWith('http') ? (
                              <img 
                                src={getProxiedUrl(avatarId)} 
                                className="w-full h-full object-cover rounded-full" 
                                style={{ 
                                  objectPosition: `${profile?.avatarPosH || '50'}% ${profile?.avatarPosV || '50'}%`,
                                  transform: `scale(${(parseFloat(profile?.avatarZoom || '100')) / 100})`
                                }}
                                alt="" 
                              />
                            ) : (
                              avatarObj?.svg
                            )}
                            {profile?.template && profile?.template !== 'none' && (
                              <ProfileTemplateOverlay template={profile.template} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="text-xs font-black text-white truncate max-w-[120px]">{displayName}</h4>
                              <span className="text-[8px] font-mono text-zinc-500">{formatTimeText(c.timestamp)}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-semibold truncate leading-relaxed">
                              {c.lastMessage}
                            </p>
                          </div>

                          {c.unread && (
                            <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                          )}
                        </button>
                      );
                    })
                  )}
                </>
              )}

              {/* 2. FRIENDS TAB */}
              {activeTab === 'friends' && (
                <>
                  {friends.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                      <Users className="w-8 h-8 opacity-25 text-primary" />
                      <p className="text-xs font-bold">لم تقم بإضافة أي أصدقاء بعد. 👥<br />اضغط على صورة أي شخص في الدردشة وأرسل له طلب صداقة!</p>
                    </div>
                  ) : (
                    friends.map(f => {
                      const avatarObj = AVATARS.find(a => a.id === f.avatar);
                      return (
                        <div
                          key={f.userId}
                          className="w-full bg-zinc-900/30 border border-white/5 p-2.5 rounded-2xl flex items-center justify-between hover:bg-zinc-900/60 transition-all"
                        >
                          <div 
                            onClick={() => setViewedProfile(f)}
                            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                          >
                            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden relative">
                              {f.avatar.startsWith('http') ? (
                                <img 
                                  src={getProxiedUrl(f.avatar)} 
                                  className="w-full h-full object-cover rounded-full" 
                                  style={{ 
                                    objectPosition: `${f.avatarPosH || '50'}% ${f.avatarPosV || '50'}%`,
                                    transform: `scale(${(parseFloat(f.avatarZoom || '100')) / 100})`
                                  }}
                                  alt="" 
                                />
                              ) : (
                                avatarObj?.svg
                              )}
                              {f.template && f.template !== 'none' && (
                                <ProfileTemplateOverlay template={f.template} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-white truncate max-w-[120px]">{f.name}</h4>
                              <p className="text-[9px] text-zinc-500 font-mono">نشط مؤخراً</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setActiveChatFriendId(f.userId)}
                              className="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-black text-[10px] font-black rounded-lg transition-all"
                            >
                              مراسلة
                            </button>
                            <button
                              onClick={() => handleRemoveFriend(f.userId)}
                              className="p-1.5 bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-lg transition-all border border-white/5"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* 3. REQUESTS TAB */}
              {activeTab === 'requests' && (
                <>
                  {incomingRequests.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                      <UserCheck className="w-8 h-8 opacity-25 text-primary" />
                      <p className="text-xs font-bold">لا توجد طلبات صداقة معلقة حالياً. ✨</p>
                    </div>
                  ) : (
                    incomingRequests.map(r => {
                      const avatarObj = AVATARS.find(a => a.id === r.senderAvatar);
                      return (
                        <div
                          key={r.senderId}
                          className="w-full bg-zinc-900/30 border border-white/5 p-3 rounded-2xl flex flex-col gap-2 transition-all hover:bg-zinc-900/60"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden relative">
                              {r.senderAvatar.startsWith('http') ? (
                                <img 
                                  src={getProxiedUrl(r.senderAvatar)} 
                                  className="w-full h-full object-cover rounded-full" 
                                  style={{ 
                                    objectPosition: `${r.senderAvatarPosH || '50'}% ${r.senderAvatarPosV || '50'}%`,
                                    transform: `scale(${(parseFloat(r.senderAvatarZoom || '100')) / 100})`
                                  }}
                                  alt="" 
                                />
                              ) : (
                                avatarObj?.svg
                              )}
                              {r.senderTemplate && r.senderTemplate !== 'none' && (
                                <ProfileTemplateOverlay template={r.senderTemplate} />
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-white">{r.senderName}</h4>
                              <p className="text-[8px] text-zinc-500 font-mono">أرسل لك طلب صداقة</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => handleAcceptRequest(r.senderId)}
                              className="flex-1 py-1 bg-primary hover:bg-primary/90 text-black text-[10px] font-black rounded-lg transition-all"
                            >
                              قبول
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(r.senderId)}
                              className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-black rounded-lg border border-white/5 transition-all"
                            >
                              رفض
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

            </div>

          </div>

          {/* RIGHT COLUMN: Chat Thread Panel (8 Columns on Desktop) */}
          <div className={cn(
            "md:col-span-8 flex flex-col h-[650px] bg-[#0c0c13]/40",
            activeChatFriendId ? "flex" : "hidden md:flex"
          )}>
            
            {activeChatFriendId ? (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-white/5 bg-zinc-950/80 flex items-center justify-between select-none">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setActiveChatFriendId(null)}
                      className="md:hidden p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div 
                      onClick={() => openUserProfile(activeChatFriendId)}
                      className="w-9 h-9 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden relative cursor-pointer"
                    >
                      {profileCache[activeChatFriendId]?.avatar?.startsWith('http') ? (
                        <img 
                          src={getProxiedUrl(profileCache[activeChatFriendId]?.avatar)} 
                          className="w-full h-full object-cover rounded-full" 
                          style={{ 
                            objectPosition: `${profileCache[activeChatFriendId]?.avatarPosH || '50'}% ${profileCache[activeChatFriendId]?.avatarPosV || '50'}%`,
                            transform: `scale(${(parseFloat(profileCache[activeChatFriendId]?.avatarZoom || '100')) / 100})`
                          }}
                          alt="" 
                        />
                      ) : (
                        AVATARS.find(a => a.id === profileCache[activeChatFriendId]?.avatar)?.svg
                      )}
                      {profileCache[activeChatFriendId]?.template && profileCache[activeChatFriendId]?.template !== 'none' && (
                        <ProfileTemplateOverlay template={profileCache[activeChatFriendId]?.template} />
                      )}
                    </div>

                    <div onClick={() => openUserProfile(activeChatFriendId)} className="cursor-pointer">
                      <h3 className="text-xs font-black text-white">{profileCache[activeChatFriendId]?.name || 'جاري التحميل...'}</h3>
                      <p className="text-[9px] text-primary flex items-center gap-1 font-black">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        محادثة خاصة مؤمنة
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => openUserProfile(activeChatFriendId)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black transition-all"
                  >
                    عرض الملف
                  </button>
                </div>

                {/* Messages feed area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-black/10">
                  
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6 space-y-2 select-none">
                      <Shield className="w-10 h-10 text-primary opacity-30" />
                      <h4 className="text-xs font-black text-zinc-400">محادثة مشفرة وآمنة تماماً 🔒</h4>
                      <p className="text-[10px] leading-relaxed max-w-sm">المحادثات الخاصة بينك وبين أصدقائك تمنحك الحرية الكاملة لتبادل الأفكار والصور والملصقات والمقاطع الصوتية.</p>
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      const isMe = msg.senderId === myId;
                      const senderProfile = isMe ? null : profileCache[activeChatFriendId];
                      const senderAvatar = isMe 
                        ? (localStorage.getItem('user_avatar_url') || localStorage.getItem('guest_chat_avatar') || 'boy1') 
                        : (senderProfile?.avatar || 'boy1');
                      const avatarObj = AVATARS.find(a => a.id === senderAvatar);

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex items-start gap-2.5",
                            isMe ? "flex-row-reverse text-right" : "flex-row text-right"
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 shrink-0 overflow-hidden relative shadow-sm">
                            {senderAvatar.startsWith('http') ? (
                              <img 
                                src={getProxiedUrl(senderAvatar)} 
                                className="w-full h-full object-cover rounded-full" 
                                style={{ 
                                  objectPosition: isMe 
                                    ? `${localStorage.getItem('user_avatar_pos_h') || '50'}% ${localStorage.getItem('user_avatar_pos_v') || '50'}%` 
                                    : `${senderProfile?.avatarPosH || '50'}% ${senderProfile?.avatarPosV || '50'}%`,
                                  transform: `scale(${(parseFloat(isMe ? (localStorage.getItem('user_avatar_zoom') || '100') : (senderProfile?.avatarZoom || '100'))) / 100})`
                                }}
                                alt="" 
                              />
                            ) : (
                              avatarObj?.svg
                            )}
                            {((isMe && localStorage.getItem('user_profile_template')) || (!isMe && senderProfile?.template)) && (
                              <ProfileTemplateOverlay template={isMe ? localStorage.getItem('user_profile_template') || '' : senderProfile?.template || ''} />
                            )}
                          </div>

                          <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 mb-0.5 text-[8px] font-black text-zinc-500">
                              <span>{isMe ? 'أنت' : senderProfile?.name}</span>
                              <span className="text-[7px] opacity-60 tracking-wider font-mono pr-1 border-r border-white/5">
                                {formatTimeText(msg.createdAt)}
                              </span>
                            </div>

                            <div
                              className={cn(
                                "relative px-3.5 py-2 rounded-2xl text-[12px] font-semibold leading-relaxed shadow-lg transition-all",
                                isMe ? "bg-primary text-black rounded-tr-none" : "bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none"
                              )}
                            >
                              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                              {msg.imageUrl && (
                                <div className={cn("rounded-xl overflow-hidden mt-1 max-w-sm", msg.isSticker ? "w-28 h-28 bg-transparent" : "aspect-video bg-zinc-950")}>
                                  <img 
                                    src={getProxiedUrl(msg.imageUrl)} 
                                    alt="Shared media" 
                                    className="w-full h-full object-contain" 
                                  />
                                </div>
                              )}

                              {msg.audioUrl && (
                                <CustomAudioPlayer src={msg.audioUrl} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input panel */}
                <div className="p-3 border-t border-white/5 bg-zinc-950/80 flex flex-col gap-2 select-none relative">
                  
                  {/* Attached media previews */}
                  {attachedImage && (
                    <div className="relative inline-block mr-auto ml-3 bg-zinc-900 border border-zinc-800 p-1 rounded-xl mb-1">
                      <img src={getProxiedUrl(attachedImage)} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                      <button 
                        type="button" 
                        onClick={() => setAttachedImage(null)} 
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-600 border border-zinc-900 flex items-center justify-center text-[9px] text-white font-black shadow"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowStickerPanel(!showStickerPanel)}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition border",
                        showStickerPanel 
                          ? "bg-primary border-primary text-black" 
                          : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                      )}
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-9 h-9 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition active:scale-95 shrink-0"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />

                    {/* Speech note / mic recorder button */}
                    {isVoiceRecording ? (
                      <div className="flex items-center gap-1.5 bg-red-600/10 border border-red-500/30 px-3 py-1.5 rounded-xl shrink-0">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping shrink-0" />
                        <span className="text-[10px] font-black text-red-500 font-mono shrink-0 pr-1">{voiceSeconds}s</span>
                        <button 
                          type="button" 
                          onClick={() => stopVoiceRecording(false)}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] rounded-lg shadow-md transition shrink-0"
                        >
                          إرسال
                        </button>
                        <button 
                          type="button" 
                          onClick={() => stopVoiceRecording(true)}
                          className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] rounded-lg transition shrink-0"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={startVoiceRecording}
                        className="w-9 h-9 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition active:scale-95 shrink-0"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}

                    <input 
                      type="text"
                      placeholder={isVoiceRecording ? "جاري تسجيل صوتي..." : "اكتب رسالتك الخاصة هنا..."}
                      value={inputText}
                      disabled={isVoiceRecording}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendPrivateMessage()}
                      className="flex-1 bg-zinc-900/80 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-primary/40 transition-all font-semibold"
                    />

                    <button 
                      onClick={() => handleSendPrivateMessage()}
                      disabled={isVoiceRecording}
                      className="w-9 h-9 bg-primary hover:bg-primary/95 hover:scale-105 active:scale-95 text-black rounded-xl flex items-center justify-center transition shrink-0"
                    >
                      <Send className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Dynamic Stickers Panel inline */}
                  {showStickerPanel && (
                    <div className="absolute bottom-14 right-2 w-72 h-44 bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl p-2 z-[9999] overflow-y-auto grid grid-cols-4 gap-1.5 custom-scrollbar">
                      {savedStickers.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            handleSendPrivateMessage('', st.url, undefined, true);
                            setShowStickerPanel(false);
                          }}
                          className="aspect-square bg-black/40 rounded-xl p-1.5 hover:bg-white/5 border border-white/5 transition-all group overflow-hidden"
                        >
                          <img src={getProxiedUrl(st.url)} className="w-full h-full object-contain group-hover:scale-110 transition-transform" alt="" />
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 select-none space-y-3">
                <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10 shadow-[0_0_30px_rgba(229,9,20,0.05)] text-primary">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-black text-white">الرسائل الخاصة الآمنة والمباشرة</h3>
                <p className="text-xs leading-relaxed max-w-sm">اختر أي محادثة من القائمة اليسرى لبدء التراسل الفوري، أو ابحث عن أصدقائك ودردش معهم في بيئة مشفرة ومؤمنة بالكامل.</p>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* VIEW USER PROFILE OVERLAY MODAL */}
      {viewedProfile && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="w-full max-w-sm bg-gradient-to-br from-[#0c0c14] to-[#040408] border border-white/10 p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative space-y-6 text-center">
            
            <button
              onClick={() => setViewedProfile(null)}
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
            >
              ✕
            </button>

            <h4 className="text-[10px] font-black tracking-widest text-primary uppercase">الملف الشخصي للمستخدم 🍿</h4>

            {/* Premium Profile Avatar Preview */}
            <div className="relative w-28 h-28 mx-auto rounded-full bg-zinc-950 border-2 border-primary/20 p-1.5 shadow-xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 relative">
                {viewedProfile.avatar.startsWith('http') ? (
                  <img 
                    src={getProxiedUrl(viewedProfile.avatar)} 
                    className="w-full h-full object-cover rounded-full shadow-inner" 
                    style={{ 
                      objectPosition: `${viewedProfile.avatarPosH || '50'}% ${viewedProfile.avatarPosV || '50'}%`,
                      transform: `scale(${(parseFloat(viewedProfile.avatarZoom || '100')) / 100})`
                    }}
                    alt="" 
                  />
                ) : (
                  AVATARS.find(a => a.id === viewedProfile.avatar)?.svg
                )}
              </div>
              {viewedProfile.template && viewedProfile.template !== 'none' && (
                <ProfileTemplateOverlay template={viewedProfile.template} />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-white flex items-center justify-center gap-1">
                {viewedProfile.name}
                {viewedProfile.name.includes('المدير') && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/20 text-[7px] text-primary border border-primary/30 ml-1 font-mono font-black">VIP</span>
                )}
              </h3>
              <p className="text-[10px] font-mono text-zinc-500">رقم المعرّف الفريد (ID):</p>
              <div className="bg-black/30 border border-white/5 px-3 py-1.5 rounded-xl text-[11px] text-amber-500 font-mono tracking-wider select-all cursor-pointer hover:bg-black/50 transition-all text-center inline-block"
                   onClick={() => {
                     navigator.clipboard.writeText(viewedProfile.userId);
                     alert('📋 تم نسخ رقم المعرف بنجاح!');
                   }}>
                {viewedProfile.userId}
              </div>
            </div>

            {/* Friend Request States and Chat Navigation buttons */}
            <div className="space-y-2.5">
              {viewedProfile.userId !== myId ? (
                <>
                  {friendshipStatusWithViewed === 'friends' ? (
                    <div className="flex items-center justify-center gap-1 bg-primary/10 border border-primary/20 py-2 rounded-xl text-primary text-xs font-black">
                      <Check className="w-4 h-4 stroke-[3]" />
                      أنت وهذا المستخدم أصدقاء ✓
                    </div>
                  ) : friendshipStatusWithViewed === 'pending_sent' ? (
                    <div className="bg-zinc-900 border border-white/5 py-2 rounded-xl text-zinc-400 text-xs font-black">
                      تم إرسال طلب الصداقة (قيد الانتظار)
                    </div>
                  ) : friendshipStatusWithViewed === 'pending_received' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(viewedProfile.userId)}
                        className="flex-1 py-2 bg-primary hover:bg-primary/95 text-black text-xs font-black rounded-xl transition-all active:scale-95"
                      >
                        قبول طلب الصداقة
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(viewedProfile.userId)}
                        className="px-4 py-2 bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-xl border border-white/5 transition-all"
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSendFriendRequest(viewedProfile.userId)}
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:opacity-95 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      إرسال طلب صداقة مميز
                    </button>
                  )}

                  <button
                    onClick={() => {
                      // Navigate/set active direct messages chat
                      setActiveChatFriendId(viewedProfile.userId);
                      setViewedProfile(null);
                    }}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-200 text-xs font-black rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" />
                    بدء محادثة سرية خاصة
                  </button>
                  
                  {friendshipStatusWithViewed === 'friends' && (
                    <button
                      onClick={() => handleRemoveFriend(viewedProfile.userId)}
                      className="w-full py-2 bg-white/5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-xl text-[10px] font-black transition-all"
                    >
                      إلغاء الصداقة وإزالة المستخدم
                    </button>
                  )}
                </>
              ) : (
                <div className="bg-zinc-900/50 border border-white/5 py-2.5 rounded-xl text-zinc-400 text-xs font-black">
                  هذا هو حسابك الشخصي ✨
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
