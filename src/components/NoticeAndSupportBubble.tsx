import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, X, AlertCircle, MessageSquareWarning, ArrowLeft, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, push, set } from 'firebase/database';
import { decryptValue } from '../lib/security';
import { db as fallbackDb } from '../services/firebase';
import { getApiUrl } from '../lib/apiConfig';
import chatFirebaseConfig from '../services/chatFirebaseConfig.json';

export interface Notice {
  id: string;
  text: string;
  image?: string;
  timestamp: number;
  type: 'info' | 'warning' | 'success';
}

export default function NoticeAndSupportBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notices' | 'support'>('notices');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeDb, setActiveDb] = useState<any>(fallbackDb);

  // Personal referral alerts & unread states
  const [personalAlerts, setPersonalAlerts] = useState<Notice[]>([]);
  const [personalUnreadCount, setPersonalUnreadCount] = useState(0);

  // Support section form state
  const [guestName, setGuestName] = useState(localStorage.getItem('guest_chat_name') || '');
  const [message, setMessage] = useState('');
  const [issueType, setIssueType] = useState('بطء في تشغيل الحلقات');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [supportWaitWarning, setSupportWaitWarning] = useState<string | null>(null);

  // Audio Context chime for premium user feedback
  const playSupportSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.Q.setValueAtTime(1, now);
      filter.connect(audioCtx.destination);

      const playTone = (freq: number, start: number, duration: number, volume: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(volume, start + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(filter);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play sweet chime chord
      playTone(523.25, now, 0.4, 0.15);         // C5
      playTone(659.25, now + 0.08, 0.45, 0.13);  // E5
      playTone(783.99, now + 0.16, 0.5, 0.12);   // G5
      playTone(1046.50, now + 0.24, 0.6, 0.1);   // C6
    } catch (err) {
      console.warn("Could not play sound: Web Audio API blocker", err);
    }
  };

  // Referral URL enter banner alert
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [showReferrerAlert, setShowReferrerAlert] = useState(false);

  // Keep track of our own support tickets for reply checking
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [unreadReplies, setUnreadReplies] = useState(0);

  // Initialize secure config-based database connection dynamically
  useEffect(() => {
    async function initSecureDB() {
      try {
        let databaseInstance;
        if (!getApps().find(a => a.name === 'chatApp')) {
          const app = initializeApp(chatFirebaseConfig, 'chatApp');
          databaseInstance = getDatabase(app);
        } else {
          databaseInstance = getDatabase(getApp('chatApp'));
        }
        setActiveDb(databaseInstance);
        
        // Fetch tickets and replies
        const ticketsRef = ref(databaseInstance, 'support_tickets');
        onValue(ticketsRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
             const newReplies: Record<string, string> = {};
             // Assuming ticket nodes have `reply` property added by admin
             Object.entries(val).forEach(([key, ticket]: [string, any]) => {
                if (ticket.reply) {
                    newReplies[key] = ticket.reply;
                }
             });
             setReplies(newReplies);
             // Logic: count unread replies
             const storedReplies = JSON.parse(localStorage.getItem('seen_replies') || '{}');
             let unread = 0;
             Object.keys(newReplies).forEach(key => {
                 if (!storedReplies[key]) unread++;
             });
             setUnreadReplies(unread);
          }
        });
      } catch (err) {
        console.warn("NoticeAndSupportBubble secure db initialize failed, using fallback database:", err);
      }
    }
    initSecureDB();
  }, []);

  useEffect(() => {
    if (!activeDb) return;
    // 1. Setup real-time firebase updates for admin announcements/notices
    try {
      const noticesRef = ref(activeDb, 'system_notices');
      const unsubscribe = onValue(noticesRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const loaded: Notice[] = [];
          if (Array.isArray(val)) {
            val.forEach((item, index) => {
              if (item) {
                loaded.push({
                  id: String(index),
                  text: item.text || String(item),
                  image: item.image || '',
                  timestamp: item.timestamp || Date.now(),
                  type: item.type || 'warning'
                });
              }
            });
          } else if (typeof val === 'object') {
              Object.entries(val).forEach(([key, value]: [string, any]) => {
                loaded.push({
                  id: key,
                  text: value.text || String(value),
                  image: value.image || '',
                  timestamp: value.timestamp || Date.now(),
                  type: value.type || 'warning'
                });
              });
          }
          // Sort newest first
          loaded.sort((a, b) => b.timestamp - a.timestamp);
          setNotices(loaded);
          
          // Track read status using localStorage to show dynamic badge
          const lastReadTime = Number(localStorage.getItem('last_read_notice_time') || 0);
          const unread = loaded.filter(n => n.timestamp > lastReadTime).length;
          setUnreadCount(unread);
        } else {
          // Robust elegant default announcements if Firebase does not have system_notices node yet
          const fallbackNotices: Notice[] = [
            {
              id: 'fallback_1',
              text: '🔧 نقوم الآن بتحديث مشغلات الميديا والسيرفرات لتوفير جودة وسرعة مشاهدة فائقة بدون تقطيع.',
              timestamp: Date.now() - 5 * 60 * 1000,
              type: 'warning'
            },
            {
              id: 'fallback_2',
              text: '✨ مميز: تم افتتاح نظام حساب المشاهدة الذهبي وإلغاء الإعلانات تلقائياً بمجرد إحالة 10 أصدقاء لجهازك!',
              timestamp: Date.now() - 36 * 60 * 1000,
              type: 'info'
            }
          ];
          setNotices(fallbackNotices);
          const lastReadTime = Number(localStorage.getItem('last_read_notice_time') || 0);
          const unread = fallbackNotices.filter(n => n.timestamp > lastReadTime).length;
          setUnreadCount(unread);
        }
      }, (error) => {
        console.warn("Firebase read notices error (using elegant local fallback):", error);
        const fallbackNotices: Notice[] = [
          {
            id: 'fallback_1',
            text: '🔧 نقوم الآن بتحديث مشغلات الميديا والسيرفرات لتوفير جودة وسرعة مشاهدة فائقة بدون تقطيع.',
            timestamp: Date.now() - 5 * 60 * 1000,
            type: 'warning'
          },
          {
            id: 'fallback_2',
            text: '✨ مميز: تم افتتاح نظام حساب المشاهدة الذهبي وإلغاء الإعلانات تلقائياً بمجرد إحالة 10 أصدقاء لجهازك!',
            timestamp: Date.now() - 36 * 60 * 1000,
            type: 'info'
          }
        ];
        setNotices(fallbackNotices);
        const lastReadTime = Number(localStorage.getItem('last_read_notice_time') || 0);
        const unread = fallbackNotices.filter(n => n.timestamp > lastReadTime).length;
        setUnreadCount(unread);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn("Could not load system notices Firebase subscription, using local alerts queue:", err);
    }
  }, [activeDb]);

  const fetchPersonalAlerts = () => {
    const myId = localStorage.getItem('my_referral_id');
    if (!myId) return;
    
    fetch(`/api/v1/referral/alerts?id=${myId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status && data.alerts) {
          const formatted: Notice[] = data.alerts.map((a: any) => ({
            id: a.id,
            text: a.text,
            timestamp: a.timestamp,
            type: a.type || 'success'
          }));
          setPersonalAlerts(formatted);
          
          // Count unread personal alerts (compare against last read alert timestamp)
          const lastReadAlertTime = Number(localStorage.getItem('last_read_alert_time') || 0);
          const unreadAlerts = formatted.filter((a: any) => a.timestamp > lastReadAlertTime).length;
          setPersonalUnreadCount(unreadAlerts);
        }
      })
      .catch(err => console.warn("Fetch personal alerts bypassed:", err));
  };

  // Poll for personal alerts every 25 seconds for real-time feel
  useEffect(() => {
    fetchPersonalAlerts();
    const interval = setInterval(fetchPersonalAlerts, 25000);
    return () => clearInterval(interval);
  }, []);

  // Check for the referral enter link logic on initial mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      // Lookup referrer username
      fetch(`/api/v1/referral/lookup?id=${refCode}`)
        .then(res => res.json())
        .then(data => {
          if (data.status && data.username) {
            setReferrerName(data.username);
            setShowReferrerAlert(true);
          }
        })
        .catch(err => console.error("Could not fetch referrer profile name:", err));
    }
  }, []);

  const handleOpenWidget = () => {
    setIsOpen(true);
    setUnreadCount(0);
    setPersonalUnreadCount(0);
    
    // Mark announcements as read
    if (notices.length > 0) {
      const highestTimestamp = Math.max(...notices.map(n => n.timestamp));
      localStorage.setItem('last_read_notice_time', String(highestTimestamp));
    }
    
    // Mark personal alerts as read
    const highestAlertTimestamp = Date.now();
    localStorage.setItem('last_read_alert_time', String(highestAlertTimestamp));
    
    // Mark replies as read
    if (Object.keys(replies).length > 0) {
        const storedReplies = JSON.parse(localStorage.getItem('seen_replies') || '{}');
        Object.keys(replies).forEach(key => storedReplies[key] = true);
        localStorage.setItem('seen_replies', JSON.stringify(storedReplies));
        setUnreadReplies(0);
    }

    // Refresh immediately on opening
    fetchPersonalAlerts();
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // 24 hours report cooldown constraint
    const lastReport = localStorage.getItem('hek_last_report_time');
    if (lastReport) {
      const elapsed = Date.now() - parseInt(lastReport, 10);
      const limit = 24 * 60 * 60 * 1000;
      if (elapsed < limit) {
        const remainingMs = limit - elapsed;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        setSupportWaitWarning(`${hours} ساعة و ${minutes} دقيقة 🛡️`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Push support ticket object to Firebase Realtime Database
      const ticketsRef = ref(activeDb, 'support_tickets');
      await push(ticketsRef, {
        name: guestName.trim() || 'زائر غير مسجل',
        message: message.trim(),
        issueType: issueType,
        timestamp: Date.now(),
        status: 'pending'
      });
      
      // Save report timestamp
      localStorage.setItem('hek_last_report_time', Date.now().toString());
      setSupportWaitWarning(null);

      // Snd feedback & animations
      playSupportSuccessSound();
      setSuccess(true);
      setMessage('');
      setTimeout(() => setSuccess(false), 9000); // Keep success on-screen a bit longer to admire
    } catch (err) {
      console.error("Firebase support ticket push failed:", err);
      alert('حدث خطأ أثناء إرسال تذكرتك، برجاء التحقق من جودة الاتصال بالإنترنت.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. Referral Enter Banner Alert Popup */}
      {showReferrerAlert && referrerName && (
        <div className="fixed top-20 left-6 right-6 md:left-auto md:w-[420px] bg-gradient-to-br from-zinc-950 to-zinc-900 border border-amber-500/30 text-white rounded-[2rem] p-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] z-[99999] animate-bounce-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-amber-400 text-[10px] font-black tracking-widest uppercase">تفعيل رمز الإحالة</span>
                <button onClick={() => setShowReferrerAlert(false)} className="text-zinc-500 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-sm font-black text-white leading-relaxed">أهلاً بك في منصة المشاهدة المباشرة!</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                قمت بالدخول عبر الرابط المعتمد لصديقك <span className="text-amber-400 font-extrabold">{referrerName}</span>. تم التحقق من هويتك كزائر حقيقي واحتساب نقطة له في نقاط الذهبية ومسح الإعلانات. هنيئاً لكم!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Chat/Messages/Announcements Floating Circle Bubble */}
      <div className="fixed bottom-32 md:bottom-32 right-4 md:right-6 z-[9990] select-none text-right">
        <button 
          onClick={handleOpenWidget}
          id="system-notices-bubble"
          className="relative group w-12 h-12 rounded-full bg-primary hover:bg-red-700 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(229,9,20,0.4)] transition-all duration-300 hover:scale-110 cursor-pointer border border-white/10"
        >
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping group-hover:bg-primary/40" />
          <MessageSquare className="w-5.5 h-5.5 relative z-10" />
          
          {/* Unread badge alert */}
          {(unreadCount + unreadReplies + personalUnreadCount) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-zinc-950 animate-pulse">
              {(unreadCount + unreadReplies + personalUnreadCount) > 9 ? '9+' : (unreadCount + unreadReplies + personalUnreadCount)}
            </span>
          )}

          {/* Floating name tag */}
          <span className="absolute right-14 bg-black/90 backdrop-blur-md text-white text-[10px] font-black py-1 px-2.5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-250 shadow-2xl whitespace-nowrap">
            الرسائل والدعم الفني ⚡
          </span>
        </button>
      </div>

      {/* 3. Sliding Panel Drawer Control */}
      {isOpen && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-end justify-end p-4 md:p-8">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
          
          {/* Main Widget container panel */}
          <div className="relative w-full max-w-md h-[80vh] bg-zinc-950 border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
            
            {/* Widget header */}
            <header className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5 hover:bg-zinc-850 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">مركز المتابعة والدعم</span>
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>
            </header>

            {/* Nav tabs selection buttons */}
            <div className="grid grid-cols-2 border-b border-white/5 p-2 bg-zinc-900/20">
              <button 
                onClick={() => setActiveTab('support')}
                className={`py-3 text-xs font-black rounded-2xl transition flex items-center justify-center gap-2 ${
                  activeTab === 'support' 
                    ? 'bg-primary text-white shadow-xl shadow-primary/10' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`}
              >
                <MessageSquareWarning className="w-4 h-4" />
                الدعم الفني والشكاوى
              </button>
              
              <button 
                onClick={() => setActiveTab('notices')}
                className={`py-3 text-xs font-black rounded-2xl transition flex items-center justify-center gap-2 ${
                  activeTab === 'notices' 
                    ? 'bg-primary text-white shadow-xl shadow-primary/10' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                إشعارات ورسائل الإدارة
              </button>
            </div>

            {/* Navigation Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Notices list page */}
              {activeTab === 'notices' && (
                <div className="space-y-4 text-right animate-fade-in">
                  {/* Section A: Personal Referral Link Alerts (النقاط وتنبيهات الإحالة) */}
                  <div className="bg-amber-500/[0.03] border border-amber-500/15 rounded-[2rem] p-4 text-right">
                    <div className="flex items-center justify-between border-b border-amber-500/10 pb-2 mb-3">
                      <div className="flex items-center gap-1.5 font-black text-[11px] text-amber-400">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span>إشعارات نقاط الإحالة الخاصة بك</span>
                      </div>
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>

                    {personalAlerts.length === 0 ? (
                      <div className="py-6 text-center text-zinc-500 text-xs">
                        <p className="font-bold">لا توجد تنبيهات إحالة جديدة مضافة حالياً.</p>
                        <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">شارك رابط الإحالة الخاص بك مع أصدقائك واكسب نقاط ذهبية فوراً لتصفح بدون إعلانات!</p>
                      </div>
                    ) : (
                      /* Set capped and accelerated scrollable viewport to avoid layout lag */
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scroll-smooth select-none" style={{ contentVisibility: 'auto' }}>
                        {personalAlerts.slice(0, 15).map((a) => (
                          <div 
                            key={a.id}
                            className="bg-zinc-900/60 border border-white/5 p-3.5 rounded-2xl flex items-start gap-3 transition active:scale-[0.98] hover:bg-zinc-900 duration-150"
                          >
                            <div className="flex-grow flex flex-col space-y-1">
                              <p className="text-[11px] text-zinc-200 font-bold leading-relaxed">{a.text}</p>
                              <span className="text-[9px] text-zinc-500 block font-mono">
                                {new Date(a.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-base shrink-0">🎁</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section B: System Announcements (أخبار وتحديثات الإدارة العامة) */}
                  <div className="space-y-3">
                    <div className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">التحديثات المباشرة وحالة السيرفرات الإدارية</div>
                    
                    {notices.length === 0 ? (
                      <div className="h-28 flex flex-col items-center justify-center text-center gap-2">
                        <AlertCircle className="w-6 h-6 text-zinc-600 animate-pulse" />
                        <p className="text-xs text-zinc-500 font-bold">لا توجد رسائل إدارية نشطة حالياً.</p>
                      </div>
                    ) : (
                      notices.slice(0, 10).map((not) => (
                        <div 
                          key={not.id} 
                          className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                            not.type === 'warning'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                              : not.type === 'success'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                              : 'bg-zinc-900/80 border-white/5 text-zinc-300'
                          }`}
                        >
                          <div className="flex-1 space-y-2">
                            {not.image && (
                              <img 
                                src={not.image} 
                                alt="Notice" 
                                className="w-full h-32 object-cover rounded-xl border border-white/10 mb-2 shadow-lg"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <p className="text-xs font-bold leading-relaxed">{not.text}</p>
                            <span className="text-[9px] text-zinc-500 block font-mono">
                              {new Date(not.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`p-2 rounded-lg shrink-0 ${
                            not.type === 'warning' 
                              ? 'bg-amber-500/20 text-amber-400' 
                              : not.type === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Technical support submit section page */}
              {activeTab === 'support' && (
                <div className="space-y-4 text-right">
                  <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">طلب مساعدة أو الإبلاغ عن مشكلة ميديا</div>
                  
                  {supportWaitWarning ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center space-y-3">
                      <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                      <h4 className="text-sm font-black text-white">عذراً، تم تسجيل بلاغ مسبق مؤخراً!</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        بموجب حماية منصتنا، لا يمكنك إرسال أكثر من بلاغ واحد كل 24 ساعة للإدارة كأقصى استخدام آمن.
                      </p>
                      <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl text-amber-400 font-mono text-[10px] font-black inline-block mt-2">
                        الوقت المتبقي لإمكانية الإرسال: {supportWaitWarning}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSupportWaitWarning(null)} 
                        className="w-full mt-3 bg-white/5 border-0 hover:bg-white/10 text-zinc-300 font-black text-xs py-2.5 rounded-xl transition cursor-pointer"
                      >
                        حسناً، فهمت
                      </button>
                    </div>
                  ) : success ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
                      {/* Premium Animated SVG Checkmark drawing */}
                      <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                        <svg className="w-16 h-16 text-emerald-500" viewBox="0 0 52 52">
                          <motion.circle 
                            cx="26" 
                            cy="26" 
                            r="24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="4"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                          <motion.path 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="4" 
                            strokeLinecap="round" 
                            d="M15 27.5l7 7 15-15"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                          />
                        </svg>
                      </div>

                      <h4 className="text-sm font-black text-white">تم إرسال تذكرتك بنجاح! 🛡️❤️</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                        تم ارسال بلاغك الى إدارة سوف نراجع بلاغك بسرعه عاليه نحنا نهتم ب مستخدمينا بشكل احترافي.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSendSupport} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-300">اسم المستخدم (المسجل لديك):</label>
                        <input 
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="اكتب اسم عضوية زائر المسجلة لديك..."
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-right"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-300">نوع المشكلة التي تواجهها:</label>
                        <select
                          value={issueType}
                          onChange={(e) => setIssueType(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary text-right"
                        >
                          <option value="بطء في تشغيل الحلقات">بطء شديد وتقطيع في تشغيل الفيديوهات</option>
                          <option value="حلقة معينة لا تظهر">حلقة أو حلقة كاملة فارغة لا تفتح</option>
                          <option value="توقف سيرفر المشاهدة">فشل سيرفر خارجي عن التحميل بالكامل</option>
                          <option value="مشكلة بنقاط الإحالة">عدم احتساب إحالة أو مشكلة بالحساب الذهبي</option>
                          <option value="اقتراح أو طلب آخر">اقتراح تحسين / إضافة أنمي جديد</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-300">تفاصيل المشكلة / اسم الأنمي ورقم الحلقة:</label>
                        <textarea
                          required
                          rows={4}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="الرجاء توضيح الحلقة ورقمها أو المشكلة تفصيلياً لنتمكن من معالجتها..."
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-right resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className="w-full bg-primary hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 font-black text-xs py-3.5 rounded-xl transition-all shadow-xl shadow-primary/15 flex items-center justify-center gap-2 text-white active:scale-95"
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 ml-1" />
                        )}
                        إرسال تذكرة الفحص والحل
                      </button>
                    </form>
                  )}
                  
                  <div className="pt-4 border-t border-white/5 text-center">
                    <span className="text-[10px] text-zinc-500 font-bold block">
                      فريق الدعم الفني متواجد 24/7 لمراجعة وقراءة بلاغات التشغيل الفورية.
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
