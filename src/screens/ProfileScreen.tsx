import React, { useState, useEffect } from 'react';
import { 
  User, 
  Activity, 
  ShieldCheck, 
  Sparkles, 
  Sliders, 
  Copy, 
  Check, 
  Users, 
  Gift, 
  AlertTriangle, 
  Flame, 
  ChevronDown, 
  ChevronUp, 
  Palette, 
  HelpCircle, 
  Database, 
  Trash2, 
  Grid, 
  TrendingUp, 
  Smartphone, 
  RefreshCw, 
  Award,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ProfileTemplateOverlay from '../components/ProfileTemplateOverlay';
import { syncProfileToFirebase } from '../utils/profileSync';

export default function ProfileScreen() {
  const [currentName, setCurrentName] = useState(() => {
    return localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)';
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('user_avatar_url') || '';
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const TEMPLATES = [
    { id: 'none', label: 'بدون إطار', emoji: '❌' },
    { id: 'saudia', label: 'السعودية 🇸🇦' },
    { id: 'football', label: 'كورة ⚽' },
    { id: 'fire', label: 'حماس 🔥' },
    { id: 'crown', label: 'تاج 👑' },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    return localStorage.getItem('user_profile_template') || 'none';
  });
  const [verticalPos, setVerticalPos] = useState(() => {
    return parseFloat(localStorage.getItem('user_avatar_pos_v') || '50');
  });
  const [horizontalPos, setHorizontalPos] = useState(() => {
    return parseFloat(localStorage.getItem('user_avatar_pos_h') || '50');
  });
  const [zoomVal, setZoomVal] = useState(() => {
    return parseFloat(localStorage.getItem('user_avatar_zoom') || '100');
  });

  // Expandable sections state for setting list (accordion style)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    theme: true,
    badges: false,
    referrals: false,
    network: false,
    help: false
  });

  // Referral system states
  const [referrerId, setReferrerId] = useState('');
  const [points, setPoints] = useState(0);
  const [adFreeExpiry, setAdFreeExpiry] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorRedeem, setErrorRedeem] = useState<string | null>(null);
  const [successRedeem, setSuccessRedeem] = useState<string | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(true);

  // Position adjustment toggles
  const [showAdjuster, setShowAdjuster] = useState(false);

  useEffect(() => {
    // Load local referral ID
    let refId = localStorage.getItem('my_referral_id');
    if (!refId) {
      refId = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('my_referral_id', refId);
    }
    setReferrerId(refId);

    // Fetch user points & adFreeExpiry on mount
    fetchPointsAndExpiry(refId);

    const handleProfileChange = () => {
      setCurrentName(localStorage.getItem('guest_chat_name') || 'غير مسجل (حساب زائر)');
      setAvatarUrl(localStorage.getItem('user_avatar_url') || '');
      setSelectedTemplate(localStorage.getItem('user_profile_template') || 'none');
      setVerticalPos(parseFloat(localStorage.getItem('user_avatar_pos_v') || '50'));
      setHorizontalPos(parseFloat(localStorage.getItem('user_avatar_pos_h') || '50'));
      setZoomVal(parseFloat(localStorage.getItem('user_avatar_zoom') || '100'));
      syncProfileToFirebase();
    };

    window.addEventListener('profile-updated', handleProfileChange);
    window.addEventListener('name-updated', handleProfileChange);
    window.addEventListener('avatar-updated', handleProfileChange);

    return () => {
      window.removeEventListener('profile-updated', handleProfileChange);
      window.removeEventListener('name-updated', handleProfileChange);
      window.removeEventListener('avatar-updated', handleProfileChange);
    };
  }, []);

  const fetchPointsAndExpiry = (id: string) => {
    setLoadingPoints(true);
    fetch(`/api/v1/referral/points?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status) {
          setPoints(data.points || 0);
          setAdFreeExpiry(data.adFreeExpiry || 0);
          localStorage.setItem('my_points', String(data.points || 0));
          if (data.adFreeExpiry) {
            localStorage.setItem('ad_free_until', String(data.adFreeExpiry));
          } else {
            localStorage.removeItem('ad_free_until');
          }
        }
      })
      .catch((err) => console.warn('Points fetch failed:', err))
      .finally(() => setLoadingPoints(false));
  };

  const handleCopyLink = () => {
    const referralLink = `${window.location.origin}/?ref=${referrerId}`;
    navigator.clipboard.writeText(referralLink)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy code', err);
      });
  };

  const handleRedeemPoints = () => {
    if (points < 5) return;
    setIsRedeeming(true);
    setErrorRedeem(null);
    setSuccessRedeem(null);

    fetch('/api/v1/referral/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: referrerId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status) {
          setSuccessRedeem(data.message || 'تم مقايضة النقاط وتفعيل الإزالة الإعلانية الفورية لأسبوع كامل بنجاح! 🎉');
          setPoints(data.points);
          setAdFreeExpiry(data.adFreeExpiry);
          localStorage.setItem('my_points', String(data.points));
          localStorage.setItem('ad_free_until', String(data.adFreeExpiry));
          window.dispatchEvent(new Event('ad-status-updated'));
        } else {
          setErrorRedeem(data.message || 'حدث خطأ أثناء مقايضة النقاط، يرجى المحاولة لاحقاً.');
        }
      })
      .catch((err) => {
        console.error('Redeem failed:', err);
        setErrorRedeem('عذراً! خادم المقايضة غير مستجيب حالياً. حاول ثانية لاحقاً.');
      })
      .finally(() => {
        setIsRedeeming(false);
      });
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNameInput.trim();
    if (!trimmed || trimmed === 'غير مسجل (حساب زائر)') return;

    const lower = trimmed.toLowerCase();
    const isReserved = lower.includes('مدير') || lower.includes('المدير') || lower.includes('ادمن') || lower.includes('أدمن') || lower.includes('admin') || lower.includes('moderator');

    if (isReserved) {
      if (trimmed === 'bewCew,iDYgC@K6') {
        localStorage.setItem('short_admin_access', 'true');
        localStorage.setItem('guest_chat_name', 'المدير 🛡️');
        localStorage.setItem('comment_author_name', 'المدير 🛡️');
        setCurrentName('المدير 🛡️');
        setIsEditingName(false);
        alert('أهلاً بك يا مدير الموقع! تم تفعيل صلاحيات التحكم بالكامل بنجاح. 🛡️');
        window.dispatchEvent(new Event('name-updated'));
        return;
      } else {
        alert('عذراً، هذا اللقب محجوز لإدارة المنصة فقط! ⚠️');
        return;
      }
    }

    localStorage.setItem('guest_chat_name', trimmed);
    setCurrentName(trimmed);
    setIsEditingName(false);
    window.dispatchEvent(new Event('name-updated'));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صور فقط! 🖼️');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/upload-media', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setAvatarUrl(data.url);
        localStorage.setItem('user_avatar_url', data.url);
        window.dispatchEvent(new Event('avatar-updated'));
        alert('تم تحديث صورتك الشخصية بنجاح! ✨');
      } else {
        alert(data.error || 'فشل رفع الصورة، حاول مرة أخرى.');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert('حدث خطأ في الاتصال بالخادم أثناء الرفع.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleResetProfile = () => {
    if (confirm('هل أنت متأكد من رغبتك في إعادة تعيين الهوية بالكامل؟ سيتم مسح صورتك وقالبك ولقبك والبدء من جديد.')) {
      localStorage.removeItem('guest_chat_name');
      localStorage.removeItem('user_avatar_url');
      localStorage.removeItem('user_profile_template');
      localStorage.removeItem('profile_setup_complete');
      localStorage.removeItem('guest_chat_avatar');
      localStorage.removeItem('user_avatar_zoom');
      
      setCurrentName('غير مسجل (حساب زائر)');
      setAvatarUrl('');
      setSelectedTemplate('none');
      setVerticalPos(50);
      setHorizontalPos(50);
      setZoomVal(100);

      window.dispatchEvent(new Event('profile-updated'));
      window.dispatchEvent(new Event('name-updated'));
      window.dispatchEvent(new Event('avatar-updated'));
      
      alert('تمت إعادة ضبط الحساب بنجاح! سيطلب منك النظام اختيار هويتك الجديدة عند الانتقال.');
      window.location.reload();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSavePosition = (axis: 'v' | 'h' | 'z', value: number) => {
    if (axis === 'v') {
      setVerticalPos(value);
      localStorage.setItem('user_avatar_pos_v', value.toString());
    } else if (axis === 'h') {
      setHorizontalPos(value);
      localStorage.setItem('user_avatar_pos_h', value.toString());
    } else {
      setZoomVal(value);
      localStorage.setItem('user_avatar_zoom', value.toString());
    }
    window.dispatchEvent(new Event('profile-updated'));
  };

  return (
    <div id="profile-screen-container" className="min-h-screen bg-black text-white pb-32">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-24">
        <div className="space-y-6">
          
          {/* ===================== USER CARD PROFILE OVERVIEW ===================== */}
          <section id="profile-hero-card" className="bg-zinc-900/30 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
              
              {/* Avatar Frame Box */}
              <div className="relative group">
                <div className="absolute inset-0 bg-red-650/15 blur-xl rounded-full group-hover:bg-red-650/25 transition-all duration-300" />
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-zinc-950 bg-zinc-900 flex items-center justify-center relative z-20 shadow-2xl transition-transform duration-300 group-hover:scale-105 overflow-hidden">
                  
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      className="w-full h-full object-cover rounded-full" 
                      style={{ 
                        objectPosition: `${horizontalPos}% ${verticalPos}%`,
                        transform: `scale(${zoomVal / 100})`
                      }}
                      alt="Profile" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-zinc-950 to-zinc-900 flex items-center justify-center rounded-full">
                      <User className="w-12 h-12 text-zinc-550" />
                    </div>
                  )}

                  {/* Template Overlay Badge */}
                  {selectedTemplate && selectedTemplate !== 'none' && (
                    <ProfileTemplateOverlay template={selectedTemplate} />
                  )}
                  
                  {/* Photo Edit Trigger on Hover */}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer z-40">
                    <div className="p-2 bg-white/10 rounded-full mb-1">
                      {isUploadingAvatar ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[9px] font-black text-white">تغيير الصورة</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                  </label>
                </div>

                {isUploadingAvatar && (
                   <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full z-30 shadow-lg animate-bounce">
                     جاري الرفع...
                   </div>
                )}
              </div>
              
              {/* Profile Meta info */}
              <div className="text-center sm:text-right space-y-2 flex-1 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row items-center gap-2 justify-center sm:justify-start">
                  
                  {isEditingName ? (
                    <form onSubmit={handleRename} className="flex gap-2 items-center w-full max-w-xs justify-center sm:justify-start">
                      <input 
                        type="text" 
                        value={newNameInput}
                        onChange={(e) => setNewNameInput(e.target.value)}
                        className="bg-black border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-600 text-right flex-1 font-bold"
                        required
                        placeholder="أدخل اللقب الجديد..."
                        autoFocus
                      />
                      <button 
                        type="submit" 
                        className="bg-red-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-red-700 active:scale-95 transition cursor-pointer flex-shrink-0"
                      >
                        حفظ
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingName(false)}
                        className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-zinc-750 active:scale-95 transition cursor-pointer flex-shrink-0"
                      >
                        إلغاء
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 flex-row-reverse sm:flex-row">
                      <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none text-right">
                        {currentName}
                      </h1>
                      <button 
                        onClick={() => {
                          setNewNameInput(currentName === 'غير مسجل (حساب زائر)' ? '' : currentName);
                          setIsEditingName(true);
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        title="تعديل اللقب"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <div className="px-3 py-1 rounded-full bg-zinc-950/60 border border-white/[0.03] flex items-center gap-2 flex-row-reverse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    <span className="text-[10px] text-zinc-400 font-extrabold">حساب زائر نشط وآمن</span>
                  </div>

                  <div 
                    onClick={() => {
                      const pid = localStorage.getItem('guest_chat_pid') || '';
                      navigator.clipboard.writeText(pid);
                      alert('📋 تم نسخ رقم الـ ID الخاص بك بنجاح! شاركه مع أصدقائك ليتواصلوا معك خاص.');
                    }}
                    className="px-3 py-1 rounded-full bg-zinc-950/60 border border-white/[0.03] hover:border-primary/20 flex items-center gap-2 flex-row-reverse cursor-pointer hover:bg-black transition-all active:scale-95 text-zinc-400 hover:text-white"
                    title="اضغط لنسخ معرّف الحساب"
                  >
                    <Copy className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] font-extrabold font-mono tracking-wider">ID: {localStorage.getItem('guest_chat_pid')}</span>
                  </div>

                  {adFreeExpiry > Date.now() ? (
                    <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black flex items-center gap-1.5">
                      <span>عضوية ذهبية مميزة</span>
                      <Award className="w-3 h-3 text-amber-400" />
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-zinc-500 text-[10px] font-bold">
                      عضوية عادية
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ===================== ACCOMPANYING INTERACTIVE SETTINGS MENU ===================== */}
          <div id="settings-accordion-list" className="space-y-3.5">
            
            {/* 1. SECTION: PROFILE BADGES LAYOUT */}
            <div className="bg-zinc-900/25 border border-white/5 rounded-3xl overflow-hidden transition-all duration-300">
              <button 
                type="button"
                onClick={() => toggleSection('badges')}
                className="w-full px-5 py-4.5 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: expandedSections.badges ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-500 hover:text-white"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
                
                <div className="flex items-center gap-3 flex-row-reverse text-right">
                  <div className="p-2.5 bg-red-650/10 text-primary rounded-2xl flex-shrink-0">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white hover:text-primary transition-colors text-right">تخصيص القالب والشارات ✨</h3>
                    <p className="text-[10px] text-zinc-500 text-right">اختر قالب أو نسّق صورة حضورك بالدردشة</p>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedSections.badges && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-white/[0.03] bg-zinc-950/40 p-5 space-y-5"
                  >
                    <p className="text-right text-xs text-zinc-400 font-medium leading-relaxed max-w-xl mr-auto">
                      اختر شارة لدمجها فوراً على صورتك الشخصية لتظهر بشكل ملكي مميز بين المعلقين والمشاهدين في الدردشات التفاعلية:
                    </p>

                    {/* Badge Circles selector */}
                    <div className="flex flex-wrap items-center justify-center gap-3.5 py-2">
                      {TEMPLATES.map(t => {
                        const isSelected = selectedTemplate === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(t.id);
                              localStorage.setItem('user_profile_template', t.id);
                              window.dispatchEvent(new Event('profile-updated'));
                              window.dispatchEvent(new Event('name-updated'));
                              window.dispatchEvent(new Event('avatar-updated'));
                            }}
                            className={`relative flex-shrink-0 flex flex-col items-center gap-1.5 focus:outline-none transition-all p-2 rounded-2xl ${
                              isSelected ? 'scale-105 bg-white/[0.02]' : 'opacity-55 hover:opacity-100 hover:scale-[1.02]'
                            }`}
                          >
                            <div className={`w-14 h-14 rounded-full border-2 p-0.5 relative transition-all ${
                              isSelected ? 'border-red-650 ring-4 ring-red-650/15' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                            }`}>
                              <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 relative flex items-center justify-center">
                                {avatarUrl ? (
                                  <img 
                                    src={avatarUrl} 
                                    className="w-full h-full object-cover rounded-full" 
                                    style={{ 
                                      objectPosition: `${horizontalPos}% ${verticalPos}%`,
                                      transform: `scale(${zoomVal / 100})`
                                    }}
                                    alt="Preview Frame" 
                                  />
                                ) : (
                                  <User className="w-5 h-5 text-zinc-650" />
                                )}
                                
                                {t.id !== 'none' && (
                                  <ProfileTemplateOverlay template={t.id} />
                                )}
                              </div>

                              {isSelected && (
                                <div className="absolute -top-1 -right-1 bg-red-650 text-white rounded-full p-0.5 border border-zinc-950 shadow">
                                   <Check className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>
                            
                            <span className={`text-[10px] font-black ${isSelected ? 'text-red-500' : 'text-zinc-500'}`}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Fine tuning sliders */}
                    {avatarUrl && (
                      <div className="border-t border-white/5 pt-4 space-y-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-black text-zinc-300">أبعاد وضبط موضع الصورة شخصياً</span>
                          <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Zoom Control Slider */}
                          <div className="space-y-1.5 bg-zinc-900/50 p-3 rounded-2xl border border-white/[0.02]">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                              <span>{zoomVal}%</span>
                              <span>التقريب والبعد (الزوم) 🔍</span>
                            </div>
                            <input 
                              type="range" 
                              min="100" 
                              max="300" 
                              value={zoomVal}
                              onChange={(e) => handleSavePosition('z', parseFloat(e.target.value))}
                              className="w-full accent-red-650 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Horizontal Alignment */}
                          <div className="space-y-1.5 bg-zinc-900/50 p-3 rounded-2xl border border-white/[0.02]">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                              <span>{Math.round(horizontalPos)}%</span>
                              <span>الموضع الأفقي ↔️</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={horizontalPos}
                              onChange={(e) => handleSavePosition('h', parseFloat(e.target.value))}
                              className="w-full accent-red-650 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Vertical Alignment */}
                          <div className="space-y-1.5 bg-zinc-900/50 p-3 rounded-2xl border border-white/[0.02]">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                              <span>{Math.round(verticalPos)}%</span>
                              <span>الموضع العمودي ↕️</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={verticalPos}
                              onChange={(e) => handleSavePosition('v', parseFloat(e.target.value))}
                              className="w-full accent-red-650 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. SECTION: AD-FREE MEMBERSHIP & REFERRAL VIP SYSTEM */}
            <div className="bg-zinc-900/25 border border-white/5 rounded-3xl overflow-hidden transition-all duration-300">
              <button 
                type="button"
                onClick={() => toggleSection('referrals')}
                className="w-full px-5 py-4.5 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: expandedSections.referrals ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-500 hover:text-white"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
                
                <div className="flex items-center gap-3 flex-row-reverse text-right">
                  <div className="p-2.5 bg-yellow-500/10 text-yellow-450 rounded-2xl flex-shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white hover:text-yellow-450 transition-colors text-right">العضوية المميزة ودعوة الأصدقاء 👑</h3>
                    <p className="text-[10px] text-zinc-500 text-right">أزل جميع الإعلانات مجاناً وجمّع النقاط</p>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedSections.referrals && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-white/[0.03] bg-zinc-950/40 p-5 space-y-6"
                  >
                    {/* Points visual grid header */}
                    <div className="bg-zinc-900/60 rounded-2xl p-4 flex items-center justify-between gap-4 flex-row-reverse border border-white/[0.02]">
                      <div className="text-right">
                        <span className="block text-[9px] text-zinc-500 font-black uppercase tracking-wider">رصيدك الحالي</span>
                        <span className="text-2xl font-black text-yellow-450 font-mono leading-none">{points} نقاط</span>
                      </div>
                      
                      <div className="text-left">
                        {adFreeExpiry > Date.now() ? (
                          <span className="inline-block px-3 py-1 text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            مساعد إعلانات مفعّل مجاناً
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 text-[9px] font-black text-zinc-400 bg-zinc-800 rounded-full">
                            باقة عادية (إعلانية)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step-by-step logic formatted clean */}
                    <div className="space-y-4">
                      
                      {/* Step 1: Link Copier */}
                      <div className="bg-zinc-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-black text-white">1. انسخ رابط الدعوة وانشره 📱</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          لكل صديق يفتح الرابط الخاص بك وينضم لمشاهدة المسلسلات، ستحصل تلقائياً على نقطة واحدة في رصيدك.
                        </p>

                        <div className="bg-black/40 border border-white/5 rounded-xl p-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                          <span className="text-[10px] font-mono text-zinc-400 select-all p-2 truncate bg-black/60 rounded-lg flex-1 w-full text-center sm:text-left">
                            {window.location.origin}/?ref={referrerId}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>تم النسخ!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ الرابط</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Points Action */}
                      <div className="bg-zinc-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-black text-white">2. استبدل نقاطك بالعضوية الفاخرة VIP 💎</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          استبدل كل 5 نقاط مباشرة لتفعيل أسبوع كامل بدون أي إعلانات أو فواصل انتظار نهائياً!
                        </p>

                        <button
                          type="button"
                          onClick={handleRedeemPoints}
                          disabled={points < 5 || isRedeeming}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 flex-row-reverse ${
                            points >= 5 
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer shadow-lg hover:shadow-yellow-500/20' 
                              : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {isRedeeming ? (
                            <span>جاري المعالجة... ✅</span>
                          ) : points >= 5 ? (
                            <>
                              <Sparkles className="w-4 h-4 text-black" />
                              <span>استبدل 5 نقاط الآن لتنشيط VIP 🪐</span>
                            </>
                          ) : (
                            <span>جمّع {5 - points} نقاط إضافية على الأقل للاستبدال</span>
                          )}
                        </button>

                        {successRedeem && (
                          <p className="text-[10px] text-emerald-400 font-bold text-center mt-1 animate-pulse">{successRedeem}</p>
                        )}
                        {errorRedeem && (
                          <p className="text-[10px] text-red-550 font-bold text-center mt-1">{errorRedeem}</p>
                        )}
                      </div>

                      {/* Smart security alert simplified inside - highly premium style */}
                      <div className="bg-red-950/25 border border-red-900/20 rounded-2xl p-4 flex gap-3 text-right">
                        <div className="p-2 bg-red-650/10 text-primary rounded-xl h-fit">
                          <Lock className="w-4 h-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[11px] font-black text-primary">نظام الأمان الذكي نشط 🛡️</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            يقوم النظام بالتحقق تلقائياً من صحة الإحالات وصلاحيات بيئة الاتصال. سيتم تصفير رصيد أو تقييد حسابات استخدام الروابط الوهمية أو الاحتيال لضمان عدالة اللعب.
                          </p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. SECTION: STREAM QUALITY INDICATORS */}
            <div className="bg-zinc-900/25 border border-white/5 rounded-3xl overflow-hidden transition-all duration-300">
              <button 
                type="button"
                onClick={() => toggleSection('network')}
                className="w-full px-5 py-4.5 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: expandedSections.network ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-500 hover:text-white"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
                
                <div className="flex items-center gap-3 flex-row-reverse text-right">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl flex-shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white hover:text-emerald-450 transition-colors text-right">مؤشرات الأداء وجودة الاتصال 🌐</h3>
                    <p className="text-[10px] text-zinc-500 text-right">استجابة البث الحالية وسرعة التوجيه مع السيرفر</p>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedSections.network && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-white/[0.03] bg-zinc-950/40 p-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      
                      <div className="bg-zinc-900/40 border border-white/[0.02] p-4.5 rounded-2xl flex flex-col justify-between space-y-3.5 text-right">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[9px] font-black uppercase tracking-wider">خادم الاتصال</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">اتصال مشفر بالكامل</h4>
                          <p className="text-[9px] text-zinc-550 mt-1 leading-normal">محمي بنظام SSL لمنع تعقب أنشطة المشاهدة وتحسين الخصوصية.</p>
                        </div>
                      </div>

                      <div className="bg-zinc-900/40 border border-white/[0.02] p-4.5 rounded-2xl flex flex-col justify-between space-y-3.5 text-right">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[9px] font-black uppercase tracking-wider">زمن الاستجابة</span>
                          <div className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-2 py-0.5 rounded-md">9ms</div>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">استجابة الخادم فائقة</h4>
                          <p className="text-[9px] text-zinc-550 mt-1 leading-normal">توجيه طلبات ذكي لضمان استقرار الخادم تحت ذروة الضغط.</p>
                        </div>
                      </div>

                      <div className="bg-zinc-900/40 border border-white/[0.02] p-4.5 rounded-2xl flex flex-col justify-between space-y-3.5 text-right">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[9px] font-black uppercase tracking-wider">دقة محتوى المشغل</span>
                          <div className="text-primary text-[10px] font-black bg-red-550/10 px-2 py-0.5 rounded-md">Full HD+</div>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">تحديد ذكي ومتكيف</h4>
                          <p className="text-[9px] text-zinc-550 mt-1 leading-normal">يعمل التكييف الآلي مع سرعة الإنترنت لتفادي التقطيع تماماً.</p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. SECTION: HELP & COMMON ISSUES */}
            <div className="bg-zinc-900/25 border border-white/5 rounded-3xl overflow-hidden transition-all duration-300">
              <button 
                type="button"
                onClick={() => toggleSection('help')}
                className="w-full px-5 py-4.5 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: expandedSections.help ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-500 hover:text-white"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
                
                <div className="flex items-center gap-3 flex-row-reverse text-right">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl flex-shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white hover:text-blue-450 transition-colors text-right">مساعدة وأجوبة الأسئلة الشائعة ❓</h3>
                    <p className="text-[10px] text-zinc-500 text-right">استفسارات المشغل الصوتي والبث وتفعيل الميزات</p>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedSections.help && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="border-t border-white/[0.03] bg-zinc-950/40 p-5 space-y-4"
                  >
                    <div className="space-y-3.5 text-right">
                      
                      <div className="p-3 bg-zinc-900/30 rounded-xl border border-white/[0.01]">
                        <h4 className="text-xs font-black text-white mb-1">كيف يمكنني تفعيل المشغل التفاعلي؟</h4>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          عند فتح أي حلقة، يظهر مشغل الفيديو تلقائياً وبأعلى جودة وسرعة توجيه، يمكنك الدردشة الحية مع المتابعين بالانتقال اللحظي.
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-900/30 rounded-xl border border-white/[0.01]">
                        <h4 className="text-xs font-black text-white mb-1">لماذا لم يتم رصد نقاطي بعد دعوة أصدقائي؟</h4>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          يجب على الصديق المدعو الدخول للموقع عبر متصفحه لأول مرة حتى يحتسبها نظام التدقيق تلقائياً في رصيدك الفعلي.
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-900/30 rounded-xl border border-white/[0.01]">
                        <h4 className="text-xs font-black text-white mb-1">هل توجد رسوم خفية أو إجبار على الدفع؟</h4>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          خدمة المشاهدة والدردشة بالمنصة مجانية بالكامل للجميع 100%. نظام الدعوات وجمع النقاط هو ميزة اختيارية بحتة لتخطي الإعلانات الفاصلة.
                        </p>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* ===================== PREMIUM UTILITIES AT BOTTOM (DANGER ROW / CLEANSE OPTIONS) ===================== */}
          <section id="danger-options-area" className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-zinc-950/40 border border-white/[0.03] rounded-3xl mt-6 text-center sm:text-right">
            <div className="space-y-0.5 text-center sm:text-right">
              <h4 className="text-xs font-black text-white">إعادة تعيين وبدء هوية جديدة</h4>
              <p className="text-[10px] text-zinc-500">سيتم مسح بيانات الاسم والصورة كلياً من المتصفح والبدء من جديد</p>
            </div>
            
            <button
              type="button"
              onClick={handleResetProfile}
              className="px-4.5 py-2 rounded-2xl bg-red-950/30 hover:bg-red-950/60 text-primary border border-red-900/25 text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إعادة تعيين الهوية بالكامل</span>
            </button>
          </section>

          {/* DIRECT SUPPORT BANNER */}
          <section id="direct-support-banner" className="bg-zinc-950/20 border border-white/5 rounded-2xl p-5 text-center text-xs text-zinc-500 leading-relaxed max-w-xl mx-auto space-y-1 mt-4">
            <div className="mx-auto w-8 h-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-primary mb-1">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <p>
              تم تهيئة المنصة وتنسيق الأداء لضمان متعة سينمائية خفيفة وفائقة لجميع المشاركين مجاناً بالكامل!
            </p>
          </section>

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
