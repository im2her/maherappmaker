import { useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowLeft, LogIn, Check, Crown, Code2, MonitorPlay, X, Mail, Lock, Phone, User as UserIcon, Share, PlusSquare, Download, ChevronLeft } from 'lucide-react';
import { CodeBackground } from './CodeBackground';
import { PWAInstall } from './PWAInstall';

interface LandingProps {
  onLogin: () => void;
}

type AuthMode = 'options' | 'email_login' | 'email_register' | 'forgot_password';

export function Landing({ onLogin }: LandingProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('options');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isPWAInstallOpen, setIsPWAInstallOpen] = useState(false);

  useEffect(() => {
    // Show PWA toast after a short delay
    const timer = setTimeout(() => {
      setIsPWAInstallOpen(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onLogin();
      }
    });
    return unsubscribe;
  }, [onLogin]);

  const resetForm = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setEmail('');
    setPassword('');
  };

  const handleOpenAuth = () => {
    setAuthMode('options');
    resetForm();
    setIsAuthModalOpen(true);
  };

  const mapAuthCodeToMessage = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
        return 'المستخدم غير موجود. يرجى إنشاء حساب أولاً.';
      case 'auth/wrong-password':
        return 'كلمة المرور غير صحيحة.';
      case 'auth/invalid-email':
        return 'البريد الإلكتروني غير صحيح.';
      case 'auth/user-disabled':
        return 'هذا الحساب تم تعطيله.';
      case 'auth/email-already-in-use':
        return 'هذا البريد الإلكتروني مستخدم بالفعل.';
      case 'auth/weak-password':
        return 'كلمة المرور ضعيفة جداً. يجب أن تكون 6 خانات على الأقل.';
      case 'auth/network-request-failed':
        return 'خطأ في الاتصال بالشبكة. تحقق من اتصالك.';
      case 'auth/operation-not-allowed':
        return 'هذه الطريقة غير مفعلة. يرجى مراجعة إعدادات Authentication في Firebase Console.';
      case 'auth/too-many-requests':
        return 'عمليات كثيرة جداً. تم حظرك مؤقتاً لحماية حسابك.';
      default:
        return 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (error: any) {
      setErrorMsg(mapAuthCodeToMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (authMode === 'email_login') {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        onLogin();
      } else if (authMode === 'email_register') {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setSuccessMsg('تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.');
        onLogin();
      } else if (authMode === 'forgot_password') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthMode('email_login');
        setErrorMsg('هذا البريد مسجل بالفعل، يرجى تسجيل الدخول.');
      } else {
        setErrorMsg(mapAuthCodeToMessage(error.code));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen mesh-bg flex flex-col items-center overflow-x-hidden rtl pb-20 selection:bg-gold-500/30 selection:text-gold-200">
      <CodeBackground />
      {/* Dynamic Glow Ornament (Performance Optimized) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold-500/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/5 blur-[110px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-6xl px-6 pt-24 md:pt-32 flex flex-col items-center">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-8 max-w-4xl mx-auto mb-24"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-32 h-32 md:w-40 md:h-40 bg-zinc-900 rounded-[2rem] shadow-2xl mb-8 mx-auto flex items-center justify-center border-2 border-gold-500/20 relative group overflow-hidden"
          >
            <img 
              src="/AppIcon~ios-marketing.png" 
              alt="Maher" 
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-500 shadow-[0_0_20px_rgba(197,160,89,0.2)]">
            <span className="text-sm font-bold tracking-wide">المنصة السعودية لبناء التطبيقات والمنصات</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.2]">
            حوّل أفكارك إلى تطبيقات آيفون وأندرويد واقعية <br className="hidden md:block" />
            مع <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">ماهر</span> مصنع التطبيقات وخبيرك الإستراتيجي
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            لا حاجة لكتابة الأكواد من الصفر، تحدث مع ماهر ببساطة، وسيقوم بتصميم وبرمجة تطبيقاتك فوراً. اختر الباقة المناسبة لك وابدأ رحلتك الآن.
          </p>

          <div className="pt-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenAuth}
              className="group relative inline-flex items-center bg-gold-500 text-zinc-950 font-bold text-xl px-10 py-5 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(197,160,89,0.4)] disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10">ابدأ تجربتك مع ماهر الآن</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Pricing Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full mb-12"
        >
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-white">اختر الباقة المناسبة لنجاحك</h2>
            <p className="text-zinc-400 text-lg">خطط تناسب جميع الاحتياجات، من التجربة إلى الاحتراف الكامل.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="flex flex-col p-8 rounded-3xl bg-zinc-900 border border-zinc-800 relative hover:border-zinc-700 transition-colors">
              <div className="mb-8">
                <div className="text-gold-500 bg-gold-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <MonitorPlay className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">مجاني</h3>
                <p className="text-zinc-400 text-sm h-10">الباقة المثالية لتجربة المنصة والمعاينة الفورية.</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">0</span>
                  <span className="text-zinc-500 font-medium">ريال / مدى الحياة</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  '5 أوامر برمجية يومياً (تتجدد يومياً)',
                  'معاينة فورية للتطبيقات باحجام متعددة',
                  'لا يمكن تحميل الكود المصدري',
                  'لا يمكن رؤية الكود',
                  'لا يمكن النشر السحابي'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleOpenAuth} className="w-full py-4 rounded-xl font-bold border-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                ابدأ مجاناً
              </button>
            </div>

            {/* Pro Tier */}
            <div className="flex flex-col p-8 rounded-3xl bg-zinc-900 border-2 border-gold-500 relative transform md:-translate-y-4 shadow-[0_0_40px_rgba(197,160,89,0.1)]">
              <div className="absolute top-0 inset-x-0 -translate-y-1/2 flex justify-center">
                <span className="bg-gold-500 text-zinc-950 text-sm font-bold px-4 py-1 rounded-full uppercase tracking-wider">الأكثر طلباً</span>
              </div>
              <div className="mb-8 mt-4">
                <div className="text-gold-500 bg-gold-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">المحترف</h3>
                <p className="text-zinc-400 text-sm h-10">للمطورين ورواد الأعمال الذين يريدون بناء مشاريعهم.</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">150</span>
                  <span className="text-zinc-500 font-medium">ريال / شهرياً</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  '50 أمر برمجي شهرياً (رصيد تراكمي)',
                  '5 أوامر برمجية يومياً (تتجدد يومياً)',
                  'معاينة فورية للتطبيقات الاحترافية',
                  'تنزيل الكود المصدري كامل',
                  'لا يمكن النشر السحابي'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleOpenAuth} className="w-full py-4 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors">
                اشترك الآن
              </button>
            </div>

            {/* Elite Tier */}
            <div className="flex flex-col p-8 rounded-3xl bg-zinc-900 border border-zinc-800 relative hover:border-zinc-700 transition-colors">
              <div className="mb-8">
                <div className="text-gold-500 bg-gold-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Crown className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">النخبة</h3>
                <p className="text-zinc-400 text-sm h-10">للمشاريع الكبيرة والاحتياجات البرمجية الضخمة.</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white">250</span>
                  <span className="text-zinc-500 font-medium">ريال / شهرياً</span>
                </div>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  '100 أمر برمجي شهرياً (رصيد تراكمي)',
                  '7 أوامر برمجية يومياً (تتجدد يومياً)',
                  'كافة مميزات باقة المحترف',
                  'الربط السحابي (Firebase)',
                  'النشر على Google Cloud',
                  'أولوية الاستجابة والسرعة'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleOpenAuth} className="w-full py-4 rounded-xl font-bold border-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                اشترك في النخبة
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md relative z-10 p-6 shadow-2xl"
            >
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 left-4 p-2 text-zinc-500 hover:text-white bg-zinc-800/50 rounded-full transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
              
              {authMode !== 'options' && (
                <button 
                  onClick={() => {
                    setAuthMode('options');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white bg-zinc-800/50 rounded-full transition-colors"
                  title="الرجوع للخيارات"
                >
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                </button>
              )}

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gold-500/10 text-gold-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gold-500/20">
                  <UserIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">مرحباً بك في ماهر</h3>
                <p className="text-zinc-400 text-sm">اختر طريقة الدخول المناسبة لك لبدء تجربتك</p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl text-center">
                  {successMsg}
                </div>
              )}

              {/* Options */}
              <AnimatePresence mode="wait">
                {authMode === 'options' && (
                  <motion.div
                    key="options"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-3 bg-white text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-zinc-100 transition-colors">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                      المتابعة باستخدام قوقل
                    </button>
                    <button onClick={() => setAuthMode('email_login')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 bg-zinc-800 text-white font-bold py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors">
                      <Mail className="w-5 h-5 text-zinc-400" />
                      البريد الإلكتروني
                    </button>
                  </motion.div>
                )}

                {/* Email Login/Register */}
                {(authMode === 'email_login' || authMode === 'email_register') && (
                  <motion.div
                    key="email"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <form onSubmit={handleEmailAction} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">البريد الإلكتروني</label>
                        <div className="relative">
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                          <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                            placeholder="your@email.com"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">كلمة المرور</label>
                        <div className="relative">
                          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                          <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                            placeholder="••••••••"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {authMode === 'email_login' && (
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rememberMe}
                              onChange={(e) => setRememberMe(e.target.checked)}
                              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-gold-500 focus:ring-gold-500 focus:ring-offset-zinc-900"
                            />
                            <span className="text-sm text-zinc-400">تذكرني</span>
                          </label>
                          <button type="button" onClick={() => setAuthMode('forgot_password')} className="text-sm text-gold-500 hover:text-gold-400">نسيت كلمة المرور؟</button>
                        </div>
                      )}
                      <button type="submit" disabled={isLoading} className="w-full py-3.5 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors flex justify-center items-center gap-2">
                        {isLoading ? 'جاري التنفيذ...' : authMode === 'email_login' ? 'تأكيد الدخول' : 'إنشاء حساب'}
                      </button>
                      <div className="text-center pt-2">
                        <button type="button" onClick={() => setAuthMode(authMode === 'email_login' ? 'email_register' : 'email_login')} className="text-sm text-zinc-400 hover:text-white">
                          {authMode === 'email_login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل الدخول'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Forgot Password */}
                {authMode === 'forgot_password' && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <form onSubmit={handleEmailAction} className="space-y-4">
                      <p className="text-sm text-zinc-400 text-center mb-4">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور.</p>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">البريد الإلكتروني</label>
                        <div className="relative">
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                          <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                            placeholder="your@email.com"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full py-3.5 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors flex justify-center items-center gap-2">
                        {isLoading ? 'جاري الإرسال...' : 'إرسال الرابط للإيميل'}
                      </button>
                    </form>
                  </motion.div>
                )}


              </AnimatePresence>


              {authMode !== 'options' && (
                <button type="button" onClick={() => { setAuthMode('options'); setErrorMsg(''); setSuccessMsg(''); }} className="mt-6 w-full text-center text-sm text-zinc-500 hover:text-white flex items-center justify-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  الرجوع للخيارات
                </button>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PWAInstall isOpen={isPWAInstallOpen} onClose={() => setIsPWAInstallOpen(false)} />
    </div>
  );
}
