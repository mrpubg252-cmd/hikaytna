import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Send, Trash2, CheckCircle2, AlertTriangle, Info, X, Clock } from 'lucide-react';
import { db } from '../services/firebase';
import { ref, onValue, push, remove } from 'firebase/database';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface Notice {
  id: string;
  text: string;
  timestamp: number;
  type: 'info' | 'warning' | 'success' | 'error';
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [text, setText] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [isSending, setIsSending] = useState(false);
  
  const navigate = useNavigate();

  // Load notices
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const noticesRef = ref(db, 'system_notices');
    const unsubscribe = onValue(noticesRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const loaded: Notice[] = [];
        if (typeof val === 'object' && !Array.isArray(val)) {
          Object.entries(val).forEach(([key, value]: [string, any]) => {
            loaded.push({
              id: key,
              text: value.text || String(value),
              timestamp: value.timestamp || Date.now(),
              type: value.type || 'warning'
            });
          });
        }
        loaded.sort((a, b) => b.timestamp - a.timestamp);
        setNotices(loaded);
      } else {
        setNotices([]);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSending(true);
    try {
      const noticesRef = ref(db, 'system_notices');
      await push(noticesRef, {
        text: text.trim(),
        type,
        timestamp: Date.now()
      });
      setText('');
    } catch (err) {
      console.error("Failed to send notice:", err);
      alert('حدث خطأ أثناء الإرسال');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
      await remove(ref(db, `system_notices/${id}`));
    } catch (err) {
      console.error("Failed to delete notice:", err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-sm flex flex-col items-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">لوحة التحكم السريعة</h1>
          <p className="text-zinc-400 text-sm mb-8 text-center text-balance">
            الرجاء إدخال كلمة المرور للوصول إلى نظام نشر الإشعارات
          </p>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-center"
              dir="ltr"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
            >
              دخول
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 font-medium rounded-xl px-4 py-3 transition-colors text-sm"
            >
              العودة للموقع
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-white font-bold">بث الإشعارات</h1>
              <p className="text-zinc-400 text-xs mt-0.5">أرسل تنبيهات لكافة المستخدمين مباشرة</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Composer */}
        <section className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            <span>إشعار جديد</span>
          </h2>
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <textarea
              placeholder="اكتب رسالة الإشعار هنا..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 min-h-[120px] outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y text-sm leading-relaxed"
            />
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between">
              
              <div className="flex bg-zinc-950 rounded-xl p-1 border border-zinc-800/80">
                {(['info', 'success', 'warning', 'error'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                      type === t 
                        ? (t === 'info' ? 'bg-blue-500/20 text-blue-400' : 
                           t === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
                           t === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 
                           'bg-red-500/20 text-red-400')
                        : "text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    {t === 'info' && <Info className="w-3.5 h-3.5" />}
                    {t === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {t === 'warning' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {t === 'error' && <ShieldAlert className="w-3.5 h-3.5" />}
                    <span>
                      {t === 'info' ? 'معلومة' : t === 'success' ? 'نجاح' : t === 'warning' ? 'تنبيه' : 'تحذير'}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!text.trim() || isSending}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl px-8 py-3 transition-colors flex items-center justify-center gap-2 text-sm shrink-0"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>إرسال الآن</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* History */}
        <section>
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span>الإشعارات السابقة والفعلية</span>
          </h2>
          
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {notices.map((notice) => (
                <motion.div
                  key={notice.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-start gap-4 group"
                >
                  <div className={cn(
                    "mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    notice.type === 'info' ? 'bg-blue-500/10 text-blue-400' :
                    notice.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                    notice.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                  )}>
                    {notice.type === 'info' && <Info className="w-4 h-4" />}
                    {notice.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                    {notice.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                    {notice.type === 'error' && <ShieldAlert className="w-4 h-4" />}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-white text-sm leading-relaxed mb-2 whitespace-pre-wrap">{notice.text}</p>
                    <span className="text-[10px] sm:text-xs text-zinc-500">
                      {new Date(notice.timestamp).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(notice.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="حذف الإشعار"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
              
              {notices.length === 0 && (
                <div className="text-center p-8 bg-zinc-900/30 border border-zinc-800/50 rounded-xl border-dashed">
                  <p className="text-zinc-500 text-sm">لا توجد إشعارات نشطة حالياً</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

      </div>
    </div>
  );
}
