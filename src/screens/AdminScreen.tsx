import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Send, Trash2, CheckCircle2, AlertTriangle, 
  Info, X, Clock, Plus, Film, Tv, Image as ImageIcon, 
  Star, Type, Hash, ExternalLink, Sparkles, Pencil, RefreshCw,
  Settings, Smartphone, Link
} from 'lucide-react';
import { db } from '../services/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { clearCache } from '../services/dataService';

interface Notice {
  id: string;
  text: string;
  timestamp: number;
  type: 'info' | 'warning' | 'success' | 'error';
}

interface CustomSeries {
  id?: string;
  title: string;
  image: string;
  category: string;
  rating: number;
  isPriority: boolean;
  trailer: string;
  isSeries: boolean;
  createdAt?: number;
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeTab, setActiveTab] = useState<'notices' | 'series' | 'settings'>('series');
  
  // Notice states
  const [text, setText] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [isSending, setIsSending] = useState(false);
  
  // Series states
  const [customSeriesList, setCustomSeriesList] = useState<CustomSeries[]>([]);
  const [newSeries, setNewSeries] = useState<CustomSeries & { rawEpisodes: string }>({
    title: '',
    image: '',
    category: 'أجنبي',
    rating: 9.0,
    isPriority: true,
    trailer: '',
    isSeries: true,
    rawEpisodes: '' // For multi-episode input
  });
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);

  // App settings state
  const [appDownloadUrl, setAppDownloadUrl] = useState('');
  const [appIosDownloadUrl, setAppIosDownloadUrl] = useState('');
  const [blockShortsOnBrowser, setBlockShortsOnBrowser] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Check if previously logged in via chat
    const isAdmin = localStorage.getItem('short_admin_access') === 'true';
    if (isAdmin) {
      setIsAuthenticated(true);
    }
  }, []);

  // Load notices
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'notices') return;
    
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
  }, [isAuthenticated, activeTab]);

  // Load custom series
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'series') return;

    const fetchSeries = async () => {
      try {
        const firestore = getFirestore();
        const q = query(collection(firestore, "custom_series"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const list: CustomSeries[] = [];
        snap.forEach(d => {
          list.push({ ...d.data() as CustomSeries, id: d.id });
        });
        setCustomSeriesList(list);
      } catch (err) {
        console.error("Error fetching custom series:", err);
      }
    };

    fetchSeries();
  }, [isAuthenticated, activeTab]);

  // Load app settings
  useEffect(() => {
    if (!isAuthenticated) return;
    const settingsRef = ref(db, 'app_settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setAppDownloadUrl(val.download_url || '');
        setAppIosDownloadUrl(val.ios_download_url || '');
        setBlockShortsOnBrowser(val.block_shorts_on_browser !== false);
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await set(ref(db, 'app_settings'), {
        download_url: appDownloadUrl.trim(),
        ios_download_url: appIosDownloadUrl.trim(),
        block_shorts_on_browser: blockShortsOnBrowser
      });
      alert('تم حفظ إعدادات التطبيق بنجاح! 🚀');
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123' || password === 'bewCew,iDYgC@K6') {
      setIsAuthenticated(true);
      if (password === 'bewCew,iDYgC@K6') {
        localStorage.setItem('short_admin_access', 'true');
        localStorage.setItem('guest_chat_name', 'المدير 🛡️');
      }
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
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

  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
      await remove(ref(db, `system_notices/${id}`));
    } catch (err) {
      console.error("Failed to delete notice:", err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeries.title || !newSeries.image || !newSeries.trailer) {
      alert('الرجاء إكمال كافة الحقول المطلوبة');
      return;
    }

    setIsSavingSeries(true);
    try {
      const firestore = getFirestore();
      const seriesId = editingSeriesId || ("custom_" + Date.now());
      
      let episodes = [];
      if (newSeries.isSeries && newSeries.rawEpisodes.trim()) {
        const lines = newSeries.rawEpisodes.split('\n');
        episodes = lines.filter(l => l.includes('|')).map((line, idx) => {
          const [title, url] = line.split('|').map(s => s.trim());
          return { title: title || `الحلقة ${idx + 1}`, url, link1: url, link2: '', link3: '' };
        });
      }

      if (episodes.length === 0) {
        episodes = [
          { title: newSeries.isSeries ? "الحلقة الأولى" : "الفيلم كامل", url: newSeries.trailer, link1: newSeries.trailer, link2: "", link3: "" }
        ];
      }

      const seriesData = {
        id: seriesId,
        title: newSeries.title,
        image: newSeries.image,
        category: newSeries.category,
        rating: newSeries.rating,
        isPriority: newSeries.isPriority,
        trailer: newSeries.trailer,
        isSeries: newSeries.isSeries,
        createdAt: editingSeriesId ? (customSeriesList.find(s => s.id === editingSeriesId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        episodes
      };
      
      await setDoc(doc(firestore, "custom_series", seriesId), seriesData);
      
      try {
        await set(ref(db, 'last_series_update'), Date.now());
      } catch (ee) {
        console.warn("Could not register global updates timestamp:", ee);
      }
      
      clearCache(); // Force refresh for all users
      
      if (editingSeriesId) {
        setCustomSeriesList(customSeriesList.map(s => s.id === editingSeriesId ? (seriesData as any) : s));
        setEditingSeriesId(null);
      } else {
        setCustomSeriesList([seriesData as any, ...customSeriesList]);
      }

      setNewSeries({
        title: '',
        image: '',
        category: 'أجنبي',
        rating: 9.0,
        isPriority: true,
        trailer: '',
        isSeries: true,
        rawEpisodes: ''
      });
      alert(editingSeriesId ? 'تم تحديث العمل بنجاح!' : 'تم إضافة العمل بنجاح! سيظهر للجميع فوراً.');
    } catch (err) {
      console.error("Error saving series:", err);
      alert('حدث خطأ أثناء حفظ العمل');
    } finally {
      setIsSavingSeries(false);
    }
  };

  const handleEditSeries = (series: any) => {
    setEditingSeriesId(series.id);
    let rawEp = '';
    if (series.episodes && series.episodes.length > 0) {
      // Don't include the first one if it's just the default fallback duplicated from trailer
      rawEp = series.episodes.map((ep: any) => `${ep.title} | ${ep.url}`).join('\n');
    }
    
    setNewSeries({
      title: series.title,
      image: series.image,
      category: series.category,
      rating: series.rating || 9.0,
      isPriority: series.isPriority || false,
      trailer: series.trailer || '',
      isSeries: series.isSeries !== undefined ? series.isSeries : true,
      rawEpisodes: rawEp
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSeries = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العمل؟')) return;
    try {
      const firestore = getFirestore();
      await deleteDoc(doc(firestore, "custom_series", id));
      
      try {
        await set(ref(db, 'last_series_update'), Date.now());
      } catch (ee) {
        console.warn("Could not register global updates timestamp:", ee);
      }
      
      clearCache(); // Force refresh
      setCustomSeriesList(customSeriesList.filter(s => s.id !== id));
    } catch (err) {
      console.error("Error deleting series:", err);
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
          <h1 className="text-xl font-bold text-white mb-2">لوحة التحكم</h1>
          <p className="text-zinc-400 text-sm mb-8 text-center">
            الرجاء إدخال كلمة المرور للوصول للنظام
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
              <h1 className="text-white font-bold">لوحة الإدارة 🛡️</h1>
              <p className="text-zinc-400 text-xs mt-0.5">تحكم كامل في المحتوى والمنصة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button
                onClick={() => navigate('/')}
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 gap-1">
          <button
            onClick={() => setActiveTab('series')}
            className={cn(
              "flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5",
              activeTab === 'series' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )}
          >
            <Tv className="w-4 h-4 shrink-0" />
            <span>الأعمال</span>
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={cn(
              "flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5",
              activeTab === 'notices' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )}
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>الإشعارات</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5",
              activeTab === 'settings' ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-white"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>الإعدادات</span>
          </button>
        </div>

        {activeTab === 'notices' && (
          <>
            {/* Composer */}
            <section className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl">
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <span>بث إشعار جديد</span>
              </h2>
              <form onSubmit={handleSendNotice} className="flex flex-col gap-4">
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
                <span>سجل الإشعارات</span>
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
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </>
        )}

        {activeTab === 'series' && (
          <>
            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">
                    {editingSeriesId ? 'تعديل العمل' : 'إضافة عمل جديد'}
                  </h2>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {editingSeriesId ? 'قم بتعديل بيانات المسلسل أو الفيلم المختارة' : 'سيتم إضافة العمل برابط المدمج المباشر'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSeries} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" />
                    اسم العمل
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: Breaking Bad"
                    value={newSeries.title}
                    onChange={(e) => setNewSeries({...newSeries, title: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5" />
                    التصنيف
                  </label>
                  <select
                    value={newSeries.category}
                    onChange={(e) => setNewSeries({...newSeries, category: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm font-bold appearance-none"
                  >
                    <option value="أجنبي">أجنبي</option>
                    <option value="أفلام">أفلام</option>
                    <option value="تركي">تركي</option>
                    <option value="عربي">عربي</option>
                    <option value="أنمي">أنمي</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    رابط الصورة (بوستر)
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={newSeries.image}
                    onChange={(e) => setNewSeries({...newSeries, image: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" />
                    رابط المشغل المدمج (Embed URL) أو رابط الحلقة الأولى
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={newSeries.trailer}
                    onChange={(e) => setNewSeries({...newSeries, trailer: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm"
                    dir="ltr"
                  />
                </div>

                {newSeries.isSeries && (
                  <div className="space-y-2 md:col-span-2 mb-4">
                    <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                      <Tv className="w-3.5 h-3.5" />
                      إضافة حلقات المسلسل (اختياري)
                    </label>
                    <textarea
                      placeholder={`الحلقة 1 | https://link.com\nالحلقة 2 | https://link2.com`}
                      value={newSeries.rawEpisodes}
                      onChange={(e) => setNewSeries({...newSeries, rawEpisodes: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 min-h-[120px] outline-none focus:border-primary transition-all text-sm"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">نسق الإضافة: (اسم الحلقة | الرابط) - كل حلقة في سطر جديد</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" />
                    التقييم
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    max="10"
                    min="0"
                    value={newSeries.rating}
                    onChange={(e) => setNewSeries({...newSeries, rating: parseFloat(e.target.value)})}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm font-bold"
                  />
                </div>

                <div className="flex items-center gap-6 mt-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={newSeries.isSeries} 
                        onChange={() => setNewSeries({...newSeries, isSeries: !newSeries.isSeries})} 
                      />
                      <div className={cn("w-10 h-5 rounded-full transition-colors", newSeries.isSeries ? "bg-primary" : "bg-zinc-800")} />
                      <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform", newSeries.isSeries ? "translate-x-5" : "translate-x-0")} />
                    </div>
                    <span className="text-xs font-black text-zinc-300 group-hover:text-white transition-colors">مسلسل</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={newSeries.isPriority} 
                        onChange={() => setNewSeries({...newSeries, isPriority: !newSeries.isPriority})} 
                      />
                      <div className={cn("w-10 h-5 rounded-full transition-colors", newSeries.isPriority ? "bg-primary" : "bg-zinc-800")} />
                      <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform", newSeries.isPriority ? "translate-x-5" : "translate-x-0")} />
                    </div>
                    <span className="text-xs font-black text-zinc-300 group-hover:text-white transition-colors">تثبيت في الأعلى</span>
                  </label>
                </div>

                <div className="md:col-span-2 pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingSeries}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black rounded-2xl py-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]"
                  >
                    {isSavingSeries ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {editingSeriesId ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        <span>{editingSeriesId ? 'حفظ التعديلات' : 'إضافة العمل الآن'}</span>
                      </>
                    )}
                  </button>
                  {editingSeriesId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSeriesId(null);
                        setNewSeries({
                          title: '',
                          image: '',
                          category: 'أجنبي',
                          rating: 9.0,
                          isPriority: true,
                          trailer: '',
                          isSeries: true,
                          rawEpisodes: ''
                        });
                      }}
                      className="px-8 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-2xl py-4 transition-colors text-sm"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section>
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span>الأعمال المضافة يدوياً ({customSeriesList.length})</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customSeriesList.map((s) => (
                  <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center gap-4 group">
                    <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0">
                      <img src={s.image} alt={s.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-black text-sm truncate">{s.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">{s.category}</span>
                        <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          {s.rating}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditSeries(s)}
                        className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white"
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => s.id && handleDeleteSeries(s.id)}
                        className="p-2.5 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {customSeriesList.length === 0 && (
                  <div className="md:col-span-2 text-center p-12 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl border-dashed">
                    <Tv className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">لا توجد أعمال مضافة يدوياً حتى الآن</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'settings' && (
          <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">إعدادات تطبيق الجوال والمنصة</h2>
                <p className="text-zinc-500 text-xs mt-0.5">تخصيص روابط التحميل والبرمجة لمنع فتح ميزة الشورتس خارج تطبيقك</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5" />
                  رابط تحميل تطبيق الأندرويد (Google Play / APK Link)
                </label>
                <input
                  type="url"
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  value={appDownloadUrl}
                  onChange={(e) => setAppDownloadUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5" />
                  رابط تحميل تطبيق الـ iOS (Apple App Store Link) - اختياري
                </label>
                <input
                  type="url"
                  placeholder="https://apps.apple.com/app/..."
                  value={appIosDownloadUrl}
                  onChange={(e) => setAppIosDownloadUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm"
                  dir="ltr"
                />
              </div>

              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <h4 className="text-xs sm:text-sm font-black text-white">تفعيل حظر الشورتس على المتصفحات العامة</h4>
                    <p className="text-[10px] text-zinc-500">عند التفعيل، سيُطلب من زوار الموقع عبر المتصفح العادي تحميل تطبيقك لمشاهدة الشورتس</p>
                  </div>
                  <label className="relative flex items-center cursor-pointer group shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={blockShortsOnBrowser} 
                      onChange={() => setBlockShortsOnBrowser(!blockShortsOnBrowser)} 
                    />
                    <div className={cn("w-10 h-5 rounded-full transition-colors", blockShortsOnBrowser ? "bg-primary" : "bg-zinc-800")} />
                    <div className={cn("absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform", blockShortsOnBrowser ? "translate-x-5" : "translate-x-0")} />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black rounded-2xl py-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {isSavingSettings ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>حفظ إعدادات المنصة</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 p-5 bg-primary/5 rounded-2xl border border-primary/10">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>كيف تفتح ميزة الشورتس داخل تطبيقك (Webview / Flutter)؟</span>
              </h3>
              <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                لإلغاء حظر الشورتس عند فتح الموقع داخل تطبيق الجوال الخاص بك، يمكنك ضبط كود الـ Webview في تطبيقك ليحتوي على كلمة <code className="text-primary bg-primary/10 px-1 py-0.5 rounded font-mono">HekayahApp</code> داخل الـ User-Agent، أو استخدام أحد الطرق التالية لتجاوز الحظر تلقائياً:
              </p>
              
              <div className="space-y-4" dir="ltr">
                <div className="text-left">
                  <p className="text-white text-xs font-bold mb-1 text-left">Android (Java/Kotlin WebView):</p>
                  <pre className="bg-black p-3 rounded-xl border border-zinc-800 text-[10px] sm:text-xs text-primary font-mono overflow-x-auto text-left">
{`String customUA = webView.getSettings().getUserAgentString() + " HekayahApp";
webView.getSettings().setUserAgentString(customUA);`}
                  </pre>
                </div>

                <div className="text-left">
                  <p className="text-white text-xs font-bold mb-1 text-left">Flutter (webview_flutter):</p>
                  <pre className="bg-black p-3 rounded-xl border border-zinc-800 text-[10px] sm:text-xs text-primary font-mono overflow-x-auto text-left">
{`WebView(
  initialUrl: 'https://your-site-url.com/shorts',
  userAgent: 'HekayahApp',
)`}
                  </pre>
                </div>

                <div className="text-left">
                  <p className="text-white text-xs font-bold mb-1 text-left">Swift UI (WKWebView iOS):</p>
                  <pre className="bg-black p-3 rounded-xl border border-zinc-800 text-[10px] sm:text-xs text-primary font-mono overflow-x-auto text-left">
{`webView.customUserAgent = "HekayahApp"`}
                  </pre>
                </div>

                <div className="text-left">
                  <p className="text-white text-xs font-bold mb-1 text-left">Query Parameter URL bypass:</p>
                  <p className="text-zinc-500 text-[11px] mb-1 text-left">Or append bypass parameter directly to URL:</p>
                  <pre className="bg-black p-3 rounded-xl border border-zinc-800 text-[10px] sm:text-xs text-primary font-mono overflow-x-auto text-left">
{`https://your-site.com/shorts?app=true`}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
