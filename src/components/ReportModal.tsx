import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Check, X, Loader2, Send } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesTitle?: string;
  episodeTitle?: string;
  episodeSlug?: string;
}

const REPORT_REASONS = [
  'المشغل لا يعمل / جاري التحميل دائماً 🚫',
  'الترجمة غير متطابقة أو غير موجودة 🗣️',
  'جودة الفيديو ضعيفة أو تقطيع مستمر 📉',
  'الحلقة خاطئة أو ناقصة 🎞️',
  'مشكلة أخرى ⚠️'
];

// High-quality, pleasant, dual-tone professional chime synthesized on-the-fly
function playSuccessSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First note (soft C5 chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); 
    osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // Ramp to E5
    
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);

    // Second note (harmonious delay E5 to G5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); 
    osc2.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25); 
    
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
    gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.8);
  } catch (error) {
    console.error("Failed to play success sound:", error);
  }
}

export default function ReportModal({ isOpen, onClose, seriesTitle = "", episodeTitle = "", episodeSlug = "" }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const wordCount = comment.trim().split(/\s+/).filter(Boolean).length;
  const isValid = wordCount >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('الرجاء كتابة كلمة واحدة على الأقل لشرح المشكلة.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'reports'), {
        seriesTitle,
        episodeTitle,
        episodeSlug,
        reason: selectedReason,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });

      // Play the professional, non-annoying audio success chime
      playSuccessSound();
      
      setSubmitted(true);
      
      // Auto close after 2.5 seconds
      setTimeout(() => {
        handleReset();
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error('Failed to submit report:', err);
      setError('حدث خطأ أثناء إرسال البلاغ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedReason(REPORT_REASONS[0]);
    setComment('');
    setSubmitted(false);
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" dir="rtl">
          {/* Overlay Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 text-white"
          >
            {/* Close Button */}
            {!submitting && (
              <button 
                onClick={onClose}
                className="absolute top-4 left-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            )}

            <AnimatePresence mode="wait">
              {!submitted ? (
                /* Report Form */
                <motion.form 
                  key="report-form"
                  onSubmit={handleSubmit}
                  className="p-6 md:p-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-[#b72424]/10 p-3 rounded-xl border border-[#b72424]/20 text-[#b72424]">
                      <AlertTriangle size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">إرسال بلاغ عن مشكلة</h3>
                      <p className="text-xs text-gray-400 mt-1">نأسف لمواجهتك مشكلة، سنعمل على إصلاحها فوراً!</p>
                    </div>
                  </div>

                  {/* Series context description */}
                  {(seriesTitle || episodeTitle) && (
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-5 text-xs text-gray-300">
                      <span className="font-bold text-[#b72424]">المسلسل:</span> {seriesTitle} 
                      {episodeTitle && <> <span className="mx-1 text-gray-600">|</span> <span className="font-bold text-[#b72424]">الحلقة:</span> {episodeTitle}</>}
                    </div>
                  )}

                  {/* Reason Dropdown / Radio Grid */}
                  <div className="space-y-2.5 mb-5">
                    <label className="block text-sm font-bold text-gray-300 mr-1">نوع المشكلة</label>
                    <div className="grid grid-cols-1 gap-2">
                      {REPORT_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setSelectedReason(reason)}
                          className={`w-full text-right px-4 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between ${
                            selectedReason === reason
                              ? 'bg-[#b72424]/10 border-[#b72424] text-white shadow-md shadow-[#b72424]/5'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span>{reason}</span>
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selectedReason === reason ? 'border-[#b72424] bg-[#b72424]' : 'border-gray-600'
                          }`}>
                            {selectedReason === reason && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-between mr-1">
                      <label className="text-sm font-bold text-gray-300">تفاصيل المشكلة (مطلوب)</label>
                      <span className={`text-[11px] font-bold ${isValid ? 'text-emerald-500' : 'text-gray-500'}`}>
                        {wordCount} / 1 كلمة كحد أدنى
                      </span>
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="يرجى كتابة تفاصيل المشكلة بوضوح لنتمكن من مراجعتها وحلها سريعاً..."
                      rows={4}
                      className="w-full bg-[#18181f] border border-white/10 rounded-xl p-4 text-sm font-medium focus:outline-none focus:border-[#b72424] focus:ring-1 focus:ring-[#b72424] text-white placeholder-gray-500 transition-all resize-none"
                    />
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <div className="mb-5 bg-red-950/30 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting || !isValid}
                      className={`flex-1 font-black text-sm py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                        isValid 
                          ? 'bg-[#b72424] hover:bg-red-600 text-white shadow-red-950/20 cursor-pointer' 
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin w-4 h-4" />
                          جاري الإرسال...
                        </>
                      ) : (
                        <>
                          <Send size={16} className="rotate-180" />
                          إرسال البلاغ
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={onClose}
                      className="px-6 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.form>
              ) : (
                /* Success screen with checkmark */
                <motion.div 
                  key="report-success"
                  className="p-10 flex flex-col items-center text-center justify-center min-h-[350px]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
                    className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-6 border border-emerald-400/20"
                  >
                    <Check size={44} className="text-white stroke-[3.5]" />
                  </motion.div>

                  <h3 className="text-2xl font-black text-emerald-400 mb-2">تم استلام بلاغك بنجاح!</h3>
                  <p className="text-gray-300 text-sm max-w-sm leading-relaxed mb-1 font-semibold">
                    شكراً لك على مساعدتنا في تحسين الخدمة.
                  </p>
                  <p className="text-gray-500 text-xs leading-relaxed max-w-sm">
                    سيقوم فريق الدعم بمراجعة المشكلة والعمل على صيانتها فوراً.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
