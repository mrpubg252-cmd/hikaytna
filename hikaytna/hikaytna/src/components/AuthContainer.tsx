import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
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
  CheckCircle
} from 'lucide-react';

export default function AuthContainer() {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const navigate = useNavigate();
  
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState<'google' | 'email' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Verification State
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const translateError = (msg: string): string => {
    if (!msg) return 'حدث خطأ غير متوقع.';
    const lower = msg.toLowerCase();
    
    if (lower.includes('identifier') || lower.includes('username') || lower.includes('email')) {
      if (lower.includes('invalid') || lower.includes('incorrect')) {
        return 'عنوان البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      }
    }
    if (lower.includes('password') && lower.includes('incorrect')) {
      return 'كلمة المرور التي أدخلتها غير صحيحة، يرجى المحاولة مرة أخرى.';
    }
    if (lower.includes('password') && lower.includes('too short')) {
      return 'كلمة المرور قصيرة جداً. يجب أن تحتوي على 8 أحرف على الأقل.';
    }
    if (lower.includes('already exists') || lower.includes('taken') || lower.includes('exists')) {
      return 'هذا البريد الإلكتروني مسجل لدينا بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.';
    }
    if (lower.includes('already verified') || lower.includes('already_verified') || lower.includes('has already been verified')) {
      return 'بريدك الإلكتروني مؤكد ومسجل بالفعل! يرجى تبديل القائمة بالأعلى إلى "تسجيل الدخول" وكتابة بريدك وكلمة المرور لتدخل مباشرة.';
    }
    if (lower.includes('session') || lower.includes('loaded')) {
      return 'يرجى تحديث الصفحة والمحاولة مرة أخرى.';
    }
    if (lower.includes('code') && (lower.includes('incorrect') || lower.includes('invalid'))) {
      return 'رمز التحقق الذي أدخلته غير صحيح. يرجى التحقق من بريدك وإعادة إدخاله.';
    }
    return msg;
  };

  const handleOAuth = async () => {
    setError(null);
    setLoading('google');
    
    try {
      // Use signIn for Google OAuth, as Clerk handles existing/new users automatically.
      if (!isSignInLoaded || !signIn) {
        throw new Error('لم يكتمل تحميل نظام تسجيل الحساب، يرجى المحاولة بعد قليل.');
      }
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin + '/profile',
        redirectUrlComplete: window.location.origin + '/profile',
      });
    } catch (err: any) {
      console.error('OAuth redirect failed:', err);
      let errorMsg = 'حدث خطأ غير متوقع أثناء الاتصال بجوجل.';
      if (err.errors && err.errors[0]) {
        errorMsg = err.errors[0].longMessage || err.errors[0].message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(translateError(errorMsg));
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

    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 رموز أو أكثر.');
      return;
    }

    setLoading('email');

    try {
      if (authView === 'signin') {
        if (!isSignInLoaded || !signIn) {
          throw new Error('نظام تسجيل الدخول قيد التحميل الآن، يرجى الانتظار ثوانٍ.');
        }
        try {
          const result = await signIn.create({
            identifier: email,
            password,
          });

          if (result.status === "complete") {
            await setSignInActive({ session: result.createdSessionId });
            navigate('/profile');
          } else {
            throw new Error('تتطلب عمليتك خطوات إضافية غير مدعومة حالياً. الرجاء استخدام الدخول عبر جوجل.');
          }
        } catch (signInErr: any) {
          // Check if user doesn't exist (form_identifier_not_found) to register them in one-go
          const isUserNotFound = signInErr.errors?.some((err: any) => 
            err.code === 'form_identifier_not_found' || 
            err.message?.toLowerCase().includes('not found') ||
            err.message?.toLowerCase().includes('no user')
          );

          if (isUserNotFound && isSignUpLoaded && signUp) {
            setAuthView('signup');
            await signUp.create({
              emailAddress: email,
              password,
            });
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setPendingVerification(true);
            setError('هذا البريد الإلكتروني لم يكن مسجلاً سابقاً. تم إنشاء حساب جديد وإرسال رمز التفعيل تلقائياً!');
            return;
          }
          throw signInErr;
        }
      } else {
        if (!isSignUpLoaded || !signUp) {
          throw new Error('نظام إنشاء الحساب قيد التحميل الآن، يرجى الانتظار ثوانٍ.');
        }
        try {
          await signUp.create({
            emailAddress: email,
            password,
          });

          // Trigger code mailing
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
        } catch (signUpErr: any) {
          // Check if already registered to log them in automatically
          const isAlreadyExists = signUpErr.errors?.some((err: any) => 
            err.code === 'form_identifier_exists' || 
            err.code === 'email_address_taken' ||
            err.message?.toLowerCase().includes('exists') ||
            err.message?.toLowerCase().includes('taken')
          );

          if (isAlreadyExists && isSignInLoaded && signIn) {
            setAuthView('signin');
            const result = await signIn.create({
              identifier: email,
              password,
            });
            if (result.status === "complete") {
              await setSignInActive({ session: result.createdSessionId });
              navigate('/profile');
              return;
            }
          }
          throw signUpErr;
        }
      }
    } catch (err: any) {
      console.error('Email authentication failed:', err);
      let errorMsg = 'تعذر التحقق من البيانات المطلوبة.';
      if (err.errors && err.errors[0]) {
        errorMsg = err.errors[0].longMessage || err.errors[0].message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(translateError(errorMsg));
    } finally {
      setLoading(null);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!verificationCode) {
      setError('يرجى تصحيح رمز التحقق وكتابته كاملاً.');
      return;
    }

    setLoading('verify');

    try {
      if (!isSignUpLoaded || !signUp) {
        throw new Error('نظام التحقق غير متصل حالياً.');
      }
      
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (completeSignUp.status === "complete") {
        await setSignUpActive({ session: completeSignUp.createdSessionId });
        navigate('/profile');
      } else {
        throw new Error('لم تكتمل تفاصيل إنشاء الحساب بنجاح. يرجى التحقق من الرمز.');
      }
    } catch (err: any) {
      console.error('Registration verification failed:', err);
      
      // If already completed or already verified, handle it gracefully
      if (signUp && signUp.status === "complete" && signUp.createdSessionId) {
        try {
          await setSignUpActive({ session: signUp.createdSessionId });
          navigate('/profile');
          return;
        } catch (sessErr) {
          console.error('Failed to set active session:', sessErr);
        }
      }

      const isAlreadyVerified = err.errors?.some((e: any) => 
        e.code === 'verification_already_verified' || 
        e.message?.toLowerCase().includes('already verified')
      );

      if (isAlreadyVerified && signUp && signUp.createdSessionId) {
        try {
          await setSignUpActive({ session: signUp.createdSessionId });
          navigate('/profile');
          return;
        } catch (sessErr) {
          console.error('Failed to activate already verified session:', sessErr);
        }
      }

      let errorMsg = 'رمز التحقق المدخل غير صحيح.';
      if (err.errors && err.errors[0]) {
        errorMsg = err.errors[0].longMessage || err.errors[0].message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(translateError(errorMsg));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="w-full flex flex-col items-center max-w-[420px] mx-auto p-4" dir="rtl">
      {/* View Toggle (Sign In / Sign Up) - Only visible when not in pending verification */}
      {!pendingVerification && (
        <div className="flex bg-zinc-900/80 p-1.5 rounded-2xl w-full border border-white/5 mb-8 transition-all">
          <button
            onClick={() => { setAuthView('signin'); setError(null); }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authView === 'signin' 
                ? 'bg-zinc-800 text-white shadow-lg shadow-black/40' 
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setAuthView('signup'); setError(null); }}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              authView === 'signup' 
                ? 'bg-zinc-800 text-white shadow-lg shadow-black/40' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            إنشاء حساب جديد
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!pendingVerification ? (
          <motion.div
            key={authView}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full flex flex-col"
          >
            {/* Header Title */}
            <div className="w-full text-right mb-6">
              <h2 className="text-2xl font-black tracking-wide text-white mb-2">
                {authView === 'signin' ? 'أهلاً بك مجدداً دمت سينمائياً' : 'مرحباً بك في عالم التميز البصري'}
              </h2>
              <p className="text-zinc-500 text-[10px] font-bold tracking-wider">
                {authView === 'signin' ? 'سجل الدخول للمتابعة والمشاهدة الحصرية' : 'أنشئ حسابك الآن لتكتشف عوالم حصرية جديدة'}
              </p>
            </div>

            {/* Google Authentication Button */}
            <button
              onClick={handleOAuth}
              disabled={loading !== null}
              className="w-full h-14 bg-white text-black hover:bg-neutral-100 font-extrabold text-xs rounded-2xl flex items-center justify-between px-5 transition-all active:scale-[0.99] disabled:opacity-50 group hover:shadow-[0_10px_25px_rgba(255,255,255,0.05)] cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {loading === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 15.02 1 12 1 7.37 1 3.4 3.67 1.15 7.56l3.86 3c.9-2.7 3.41-4.52 7-4.52z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.43c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.74-4.92 3.74-8.58z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.01 10.56c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31l-3.86-3C.43 4.54 0 6.22 0 8.25s.43 3.71 1.15 5.31l3.86-3z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.7-2.87c-1.1.74-2.5 1.18-4.26 1.18-3.59 0-6.1-1.82-7-4.52l-3.86 3C3.4 20.33 7.37 23 12 23z"
                    />
                  </svg>
                )}
                <span>
                  {loading === 'google' ? 'جاري الاتصال بجوجل...' : 'الاستمرار باستخدام حساب جوجل'}
                </span>
              </div>
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:-translate-x-1 transition-transform" />
            </button>

            {/* Separator / Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-zinc-500 font-black tracking-widest px-4 uppercase">أو استخدام البريد الإلكتروني</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Custom Email Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
              {/* Email Address Input */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider block text-right pr-2">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-13 bg-zinc-900/50 border border-white/5 focus:border-primary/50 text-white rounded-2xl pr-11 pl-4 text-right text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider block text-right pr-2">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-13 bg-zinc-900/50 border border-white/5 focus:border-primary/50 text-white rounded-2xl pr-11 pl-12 text-right text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium placeholder:text-zinc-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading !== null}
                className="w-full h-14 bg-primary text-black hover:bg-primary/95 transition-all font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-[0_12px_24px_rgba(229,9,20,0.25)] hover:shadow-[0_12px_30px_rgba(229,9,20,0.35)] active:scale-[0.99] disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading === 'email' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : authView === 'signin' ? (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>إنشاء الحساب والمواصلة</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          /* Verification Code Input Screen */
          <motion.div
            key="verification"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col text-right"
          >
            {/* Header Title */}
            <div className="w-full mb-6">
              <h2 className="text-2xl font-black text-white mb-2.5">
                تأكيد حسابك الحصري
              </h2>
              <p className="text-zinc-400 text-xs leading-relaxed">
                قُمنا بإرسال رمز تحقق سري من 6 خانات إلى بريدك الإلكتروني: <span className="text-primary font-bold">{email}</span>. يرجى كتابته لتفعيل اشتراكك ومزاياك.
              </p>
            </div>

            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider block text-right pr-2">
                  رمز التحقق (6 أرقام)
                </label>
                <div className="relative">
                  <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full h-13 bg-zinc-900/50 border border-white/5 focus:border-primary/50 text-white rounded-2xl pr-11 pl-4 text-center text-sm font-mono tracking-[0.4em] outline-none focus:ring-1 focus:ring-primary/20 transition-all font-bold placeholder:text-zinc-700"
                    required
                  />
                </div>
              </div>

              {/* Verify and Back buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="w-full h-14 bg-primary text-black hover:bg-primary/95 transition-all font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-[0_12px_24px_rgba(229,9,20,0.25)] cursor-pointer"
                >
                  {loading === 'verify' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <span>تأكيد الرمز وتفعيل الحساب</span>
                      <CheckCircle className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingVerification(false)}
                  className="w-full h-13 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة لإدخال البريد الإلكتروني</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert Box */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 w-full p-4 bg-red-500/10 border border-red-500/15 rounded-2xl flex items-start gap-3.5 text-red-400 text-xs text-right leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-bold">
              <p className="text-red-500 font-black mb-1">تعذر المتابعة</p>
              <p className="text-zinc-400 font-medium">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative footer info */}
      <div className="mt-12 flex flex-col items-center gap-2.5 text-center">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span>تشفير اتصالات آمن 100% مدعوم بواسطة Clerk</span>
        </div>
        <p className="text-[9px] text-zinc-600 max-w-[280px] leading-relaxed">
          باستمرارك في تسجيل الدخول أو إنشاء حساب، فإنك توافق على سياسات الخصوصية والاتفاقيات الأمنية.
        </p>
      </div>
    </div>
  );
}

