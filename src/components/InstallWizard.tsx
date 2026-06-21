import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Smartphone, Star, Share, PlusSquare, 
  Sparkles, Layers, ArrowLeft, ArrowRight, CheckCircle2, Zap
} from 'lucide-react';

interface InstallWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstallWizard({ isOpen, onClose }: InstallWizardProps) {
  const [option, setOption] = useState<'select' | 'app_guide' | 'shortcut_guide'>('select');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  
  // Detect User Platform
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('other');
    }

    // Listen for BeforeInstallPromptEvent
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("PWA deferred prompt captured successfully! Ready to prompt.");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the native install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        {/* Backdrop clicks */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal Window Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_45px_100px_rgba(0,0,0,0.8)] z-10 text-right flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <header className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/20">
            <button 
              onClick={onClose}
              className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/5 hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 flex-row-reverse">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-primary">
                <Smartphone className="w-4 h-4 animate-pulse" />
              </div>
              <h3 className="text-sm font-black text-white">إضافة حكايتنا لشاشتك</h3>
            </div>
          </header>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {option === 'select' && (
              <div className="space-y-6">
                <div className="text-center space-y-2 py-2">
                  <div className="inline-flex gap-1.5 items-center justify-center bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-[10px] text-primary font-black">
                    <Sparkles className="w-3 h-3 text-primary" />
                    تجربة استخدام ذكية
                  </div>
                  <h4 className="text-base font-black text-white">كيف ترغب بتشغيل حكايتنا؟</h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    منصة حكايتنا تدعم أحدث تقنيات التشغيل العالمية. اختر الخيار المناسب لطريقة استخدامك لتستمتع بمشاهدة أسرع وبأعلى دقة.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Option 1: Full App Installation */}
                  <button
                    onClick={() => setOption('app_guide')}
                    className="group bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-white/5 hover:border-red-500/30 p-5 rounded-3xl text-right flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden cursor-pointer"
                  >
                    {/* Glow light accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 blur-2xl rounded-full group-hover:bg-red-500/10 transition-colors" />
                    
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                      <Layers className="w-6 h-6" />
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-row-reverse justify-end">
                        <span className="text-white font-black text-sm group-hover:text-primary transition-colors">تحويله إلى تطبيق كامل (PWA)</span>
                        <span className="bg-red-500/20 text-primary text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full uppercase">موصى به</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        قم بتثبيته كتطبيق مستقل يعمل بملء الشاشة، سرعة فائقة، يشمل الإنترو السينمائي المشوق عند الدخول ومظهر مريح مخصص لجهازك.
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Browser Shortcut */}
                  <button
                    onClick={() => setOption('shortcut_guide')}
                    className="group bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-white/5 hover:border-sky-500/30 p-5 rounded-3xl text-right flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden cursor-pointer"
                  >
                    {/* Glow light accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-600/5 blur-2xl rounded-full group-hover:bg-sky-500/10 transition-colors" />

                    <div className="p-3.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl group-hover:bg-sky-500 group-hover:text-zinc-950 transition-all">
                      <Star className="w-6 h-6" />
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-row-reverse justify-end">
                        <span className="text-white font-black text-sm group-hover:text-sky-400 transition-colors">إنشاء اختصار بريد سريع (Shortcut)</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        يضيف أيقونة حكايتنا على شاشتك لتفتح فورياً داخل متصفحك الافتراضي (Chrome/Safari) مباشرة لتوفير البيانات وتجاوز الإنترو الطويل.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Footer security notes */}
                <div className="bg-zinc-900/30 border border-white/[0.02] rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-zinc-500 font-bold block leading-relaxed">
                    🌟 لا يتطلب التثبيت مساحة من جهازك، ولا نمر عبر متاجر App Store أو Play Store لتفعيل باقة المشاهدة الذهبية مجاناً.
                  </span>
                </div>
              </div>
            )}

            {/* APP GUIDE */}
            {option === 'app_guide' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setOption('select')} 
                    className="flex items-center gap-1.5 text-xs font-black text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/5 px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    الرجوع
                  </button>
                  <span className="text-xs font-black text-primary">خطوات تثبيت التطبيق الكامل 🍿</span>
                </div>

                {/* Direct native trigger if browser holds standard trigger */}
                {deferredPrompt ? (
                  <div className="bg-primary/10 border border-primary/30 rounded-3xl p-5 text-center space-y-4">
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      متصفحك الحالي يدعم تثبيت التطبيق بضغطة زر واحدة فورا! انقر على الزر بالأسفل لتثبيته.
                    </p>
                    <button
                      onClick={handleNativeInstall}
                      className="inline-flex items-center gap-2 bg-primary hover:bg-red-700 text-white text-xs font-black px-6 py-3 rounded-2xl shadow-xl transition active:scale-95 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                      تثبيت تطبيق حكايتنا الآن تلقائياً
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Platform Selector buttons to show right custom guide */}
                    <div className="grid grid-cols-2 gap-2 bg-black/60 p-1.5 rounded-2xl border border-white/5">
                      <button
                        onClick={() => setPlatform('android')}
                        className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          platform === 'android' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        أندرويد / سامسونج / شاومي 🤖
                      </button>
                      <button
                        onClick={() => setPlatform('ios')}
                        className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          platform === 'ios' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        أبل آيفون / آيباد 🍏
                      </button>
                    </div>

                    {/* IOS SAFARI APP STEP-BY-STEP */}
                    {platform === 'ios' && (
                      <div className="space-y-4">
                        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4 text-right">
                          <h5 className="text-xs font-black text-white">خطوات التثبيت على نظام iOS (سفاري):</h5>
                          
                          <ol className="space-y-3 text-[11px] text-zinc-400">
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">1</span>
                              <span className="flex-1">افتح الموقع بالمتصفح الرسمي <span className="text-white font-extrabold">سفاري (Safari)</span>.</span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">2</span>
                              <span className="flex-1 flex items-center gap-1.5 flex-row-reverse justify-end">
                                اضغط على أيقونة 
                                <span className="bg-zinc-800 p-1 rounded-md text-sky-400 border border-white/10"><Share className="w-3.5 h-3.5 inline" /> مشاركة</span> 
                                الموجودة بأسفل شريط المتصفح.
                              </span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">3</span>
                              <span className="flex-1 flex items-center gap-1.5 flex-row-reverse justify-end">
                                مرر للأسفل واضغط على خيار
                                <span className="bg-zinc-800 text-white font-bold px-2 py-0.5 rounded border border-white/10 text-[10px]"><PlusSquare className="w-3 h-3 inline ml-1" /> إضافة للشاشة الرئيسية</span>.
                              </span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">4</span>
                              <span className="flex-1 flex items-center gap-1.5 flex-row-reverse justify-end">
                                اضغط على <span className="text-primary font-black">إضافة (Add)</span> بالزاوية العلوية لتأكيد الثبيت.
                              </span>
                            </li>
                          </ol>
                        </div>

                        {/* Interactive iOS Mock */}
                        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-4 space-y-3 relative overflow-hidden">
                          <span className="text-[9px] text-zinc-500 font-extrabold block uppercase mb-1">توضيح مرئي لخدمة iOS:</span>
                          <div className="bg-black/80 rounded-2xl p-3 border border-white/5 space-y-2 text-right">
                            <div className="flex items-center gap-3.5 flex-row-reverse border-b border-white/5 pb-2">
                              <img src="/logo.png" className="w-10 h-10 rounded-xl border border-white/10 animate-pulse" alt="logo" />
                              <div className="flex-1 text-right">
                                <span className="text-xs font-black text-white block">تطبيق حكايتنا 🍿</span>
                                <span className="text-[9px] text-zinc-500 font-bold block">hikayatna.my</span>
                              </div>
                            </div>
                            <div className="py-1 text-[10px] font-bold text-zinc-400 flex items-center justify-between flex-row-reverse">
                              <span>إضافة للشاشة الرئيسية</span>
                              <PlusSquare className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ANDROID CHROME APP STEP-BY-STEP */}
                    {platform !== 'ios' && (
                      <div className="space-y-4">
                        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4 text-right">
                          <h5 className="text-xs font-black text-white">خطوات التثبيت على نظام أندرويد (جوجل كروم):</h5>

                          <ol className="space-y-3 text-[11px] text-zinc-400">
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">1</span>
                              <span className="flex-1">افتح المتصفح <span className="text-white font-extrabold">كروم (Chrome)</span> أو <span className="text-white font-extrabold">سامسونغ</span>.</span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">2</span>
                              <span className="flex-1">اضغط على <span className="text-white font-black">أيقونة النقاط الثلاث (⋮)</span> في القائمة العلوية أو السفلية.</span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">3</span>
                              <span className="flex-1">اضغط على الخيار المعتمد <span className="text-emerald-400 font-extrabold">"تثبيت التطبيق"</span> أو <span className="text-amber-400 font-extrabold">"التنزيل كـ App"</span>.</span>
                            </li>
                            <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">4</span>
                              <span className="flex-1">وافق على نافذة التنزيل ليظهر التطبيق على هاتفك وحسابك فوراً.</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SHORTCUT GUIDES */}
            {option === 'shortcut_guide' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setOption('select')} 
                    className="flex items-center gap-1.5 text-xs font-black text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/5 px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    الرجوع
                  </button>
                  <span className="text-xs font-black text-sky-400">إنشاء اختصار سريع بالشاشة ⭐️</span>
                </div>

                <div className="bg-sky-500/5 border border-sky-500/10 rounded-3xl p-5 text-right space-y-4">
                  <h5 className="text-xs font-black text-white">لماذا تختار "الاختصار السري"؟</h5>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    هذا الخيار مثالي للأجهزة القديمة أو الأشخاص الذين يريدون تجاوز الإنترو السينمائي لتطبيقنا وفتح البوابة فوراً للاستمتاع دون تأخير وبسرعة قصوى.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4 text-right">
                    <h5 className="text-xs font-black text-white">خطوات إضافة الاختصار:</h5>
                    <ol className="space-y-3 text-[11px] text-zinc-400">
                      <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                        <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">1</span>
                        <span className="flex-1">اضغط على قائمة المتصفح (المشاركة أو النقاط الثلاث).</span>
                      </li>
                      <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                        <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">2</span>
                        <span className="flex-1 flex items-center gap-1 flex-row-reverse justify-end">
                          اختر
                          <span className="bg-zinc-800 text-white font-bold px-1.5 py-0.5 rounded border border-white/10 text-[10px]">إضافة لإشاراتي المرجعية / إضافة للشاشة</span>.
                        </span>
                      </li>
                      <li className="flex items-center gap-3 flex-row-reverse leading-relaxed">
                        <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-white font-bold font-mono">3</span>
                        <span className="flex-1 text-sky-400 font-extrabold">سيتم تفعيل الرابط بدون تشغيل الإنترو المطول ⚡!</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer controls action button */}
          <footer className="p-6 border-t border-white/5 text-center bg-zinc-900/20">
            <button
              onClick={onClose}
              className="w-full bg-zinc-900 border border-white/5 hover:bg-zinc-850 hover:text-white transition rounded-2xl py-3 text-xs font-black text-zinc-400 cursor-pointer"
            >
              فهمت، إغلاق النافذة
            </button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
