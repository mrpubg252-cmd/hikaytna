import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendEmailVerification,
  signInAnonymously
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Shield, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  CheckCircle,
  UserCircle2,
  Ghost
} from 'lucide-react';

export default function AuthContainer() {
  const navigate = useNavigate();
  
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState<'google' | 'guest' | 'email' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Verification State
  const [pendingVerification, setPendingVerification] = useState(false);

  const translateError = (msg: string): string => {
    if (!msg) return 'حدث خطأ غير متوقع.';
    const lower = msg.toLowerCase();
    
    if (lower.includes('auth/invalid-credential') || lower.includes('auth/user-not-found') || lower.includes('auth/wrong-password')) {
      return 'عنوان البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    if (lower.includes('auth/email-already-in-use')) {
      return 'هذا البريد الإلكتروني مسجل لدينا بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.';
    }
    if (lower.includes('auth/weak-password')) {
      return 'كلمة المرور ضعيفة جداً. يجب أن تحتوي على 6 أحرف على الأقل.';
    }
    if (lower.includes('auth/too-many-requests')) {
      return 'تم إرسال الكثير من الطلبات بشكل متكرر. يرجى المحاولة لاحقاً.';
    }
    return msg;
  };

  const handleOAuth = async () => {
    setError(null);
    setLoading('google');
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/profile');
    } catch (err: any) {
      console.error('Google Auth failed:', err);
      setError(translateError(err.code || err.message));
    } finally {
      setLoading(null);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setLoading('guest');
    
    try {
      await signInAnonymously(auth);
      navigate('/profile');
    } catch (err: any) {
      console.error('Guest Auth failed:', err);
      setError('تعذر تسجيل الدخول كضيف حالياً، يرجى استخدام جوجل.');
    } finally {
      setLoading(null);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('يرجى كتابة البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading('email');

    try {
      if (authView === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/profile');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setPendingVerification(true);
      }
    } catch (err: any) {
      console.error('Firebase Email Auth failed:', err);
      setError(translateError(err.code || err.message));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="w-full flex flex-col items-center max-w-[420px] mx-auto p-4" dir="rtl">
      {/* View Toggle */}
      {!pendingVerification && (
        <div className="flex bg-zinc-900/40 p-1 rounded-2xl w-full border border-white/5 mb-10 backdrop-blur-md">
          <button
            onClick={() => { setAuthView('signin'); setError(null); }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authView === 'signin' 
                ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setAuthView('signup'); setError(null); }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authView === 'signup' 
                ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            إنشاء حساب
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!pendingVerification ? (
          <motion.div
            key={authView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full flex flex-col"
          >
            {/* Header Title */}
            <div className="w-full text-right mb-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                <Sparkles className="w-3 h-3" />
                <span>حكايتنا • Hkaytna</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white mb-2 leading-tight">
                {authView === 'signin' ? 'أهلاً بك مجدداً دمت سينمائياً' : 'مرحباً بك في عالم التميز البصري'}
              </h2>
              <p className="text-zinc-500 text-[11px] font-bold tracking-wide italic leading-relaxed">
                {authView === 'signin' ? 'سجل الدخول للمتابعة والمشاهدة الحصرية بلمسة واحدة' : 'أنشئ حسابك الآن بلمح البصر لتكتشف عوالم حصرية جديدة'}
              </p>
            </div>

            {/* Quick Access Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={handleOAuth}
                disabled={loading !== null}
                className="group relative h-14 bg-zinc-900/50 hover:bg-white text-zinc-400 hover:text-black border border-white/5 hover:border-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer overflow-hidden shadow-xl"
              >
                {loading === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0 transition-colors" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 15.02 1 12 1 7.37 1 3.4 3.67 1.15 7.56l3.86 3c.9-2.7 3.41-4.52 7-4.52z"
                      />
                      <path
                        fill="currentColor"
                        d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.43c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.74-4.92 3.74-8.58z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.01 10.56c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31l-3.86-3C.43 4.54 0 6.22 0 8.25s.43 3.71 1.15 5.31l3.86-3z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.7-2.87c-1.1.74-2.5 1.18-4.26 1.18-3.59 0-6.1-1.82-7-4.52l-3.86 3C3.4 20.33 7.37 23 12 23z"
                      />
                    </svg>
                    <span>قوقل</span>
                  </>
                )}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={handleGuestSignIn}
                disabled={loading !== null}
                className="group relative h-14 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer overflow-hidden shadow-xl"
              >
                {loading === 'guest' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ghost className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                    <span>تصفح كضيف</span>
                  </>
                )}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            {/* Separator */}
            <div className="relative mb-8 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <span className="relative bg-[#0a0a0a] px-5 text-[10px] text-zinc-600 font-black tracking-[0.2em] uppercase">أو الطريقة التقليدية</span>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="عنوان البريد الإلكتروني"
                    className="w-full h-14 bg-zinc-900/30 border border-white/5 focus:border-primary/40 text-white rounded-2xl pr-12 pl-4 text-right text-[13px] outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium placeholder:text-zinc-700"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة المرور السرية"
                    className="w-full h-14 bg-zinc-900/30 border border-white/5 focus:border-primary/40 text-white rounded-2xl pr-12 pl-14 text-right text-[13px] outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium placeholder:text-zinc-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors p-2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading !== null}
                className="relative w-full h-15 bg-primary text-black hover:bg-white transition-all duration-500 font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(229,9,20,0.15)] hover:shadow-none active:scale-[0.97] disabled:opacity-50 mt-2 cursor-pointer group overflow-hidden"
              >
                {loading === 'email' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{authView === 'signin' ? 'دخول فوري' : 'انضم الآن'}</span>
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  </>
                )}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity" />
              </button>
            </form>
          </motion.div>
        ) : (
          /* Verification Screen */
          <motion.div
            key="verification"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col items-center text-center py-6"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-8">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-4">
              خطوة واحدة متبقية!
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-10 px-4">
              لقد أرسلنا رابط التحقق إلى <span className="text-white font-bold">{email}</span>. يرجى مراجعة بريدك الإلكتروني والضغط على الرابط لتفعيل حسابك بالكامل.
            </p>

            <button
              onClick={() => navigate('/profile')}
              className="w-full h-14 bg-zinc-900 border border-white/5 text-white hover:bg-zinc-800 transition-all font-black text-xs uppercase tracking-widest rounded-2xl cursor-pointer"
            >
              تم التحقق؟ دخول الآن
            </button>
            
            <button
              onClick={() => setPendingVerification(false)}
              className="mt-6 text-zinc-500 hover:text-zinc-300 text-[11px] font-bold transition-colors"
            >
              العودة لتعديل البيانات
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-8 w-full p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-4 text-right backdrop-blur-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-500 font-black text-[11px] uppercase tracking-widest mb-1.5">تنبيه أمني</p>
              <p className="text-zinc-400 text-[11px] font-bold leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <div className="mt-16 flex flex-col items-center gap-4 opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          <Shield className="w-4 h-4 text-primary" />
          <span>نظام حماية البيانات النشط • Firebase Auth</span>
        </div>
        <div className="h-px w-8 bg-zinc-800" />
        <p className="text-[9px] text-zinc-600 max-w-[280px] leading-relaxed text-center font-bold">
          بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية العالمية المتبعة لدينا.
        </p>
      </div>
    </div>
  );
}

