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
import { Sparkles, ArrowLeft, LogIn, Check, Crown, Code2, MonitorPlay, X, Mail, Lock, Phone, User as UserIcon, Share, PlusSquare, Download, ChevronLeft, MessageCircle, ShieldCheck, HelpCircle, Info, ExternalLink, BookOpen, FileText } from 'lucide-react';
import { AppRainBackground } from './AppRainBackground';
import { PWAInstall } from './PWAInstall';
import { LanguageSelector } from './LanguageSelector';
import { Documentation } from './Documentation';

interface LandingProps {
  onLogin: () => void;
}

type AuthMode = 'options' | 'email_login' | 'email_register' | 'forgot_password' | 'complete_profile';

export function Landing({ onLogin }: LandingProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('options');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isPWAInstallOpen, setIsPWAInstallOpen] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<'terms' | 'faq' | 'privacy' | 'glossary' | null>(null);
  const [showDocumentation, setShowDocumentation] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // For social login completion
  const [tempUser, setTempUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if profile exists in Firestore
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          
          if (!userSnap.exists()) {
            setTempUser(user);
            setFullName(user.displayName || '');
            setAuthMode('complete_profile');
            setIsAuthModalOpen(true);
          } else {
            onLogin();
          }
        } catch (err) {
          console.error("Error checking user profile on landing:", err);
          onLogin(); // Fallback to let MainApp handle it if there's a permission issue
        }
      }
    });
    return unsubscribe;
  }, [onLogin]);

  const resetForm = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setTempUser(null);
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
      const result = await signInWithPopup(auth, googleProvider);
      
      // Request notification permissions
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      
      // Check if user exists in Firestore
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // If user is new via Google, ask for name and phone
        setTempUser(result.user);
        setFullName(result.user.displayName || '');
        setAuthMode('complete_profile');
      } else {
        onLogin();
      }
    } catch (error: any) {
      setErrorMsg(mapAuthCodeToMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const validatePhone = (p: string) => {
    if (!p) return null; // Optional
    if (!p.startsWith('05')) return 'رقم الجوال يجب أن يبدأ بـ 05';
    if (p.length !== 10) return 'رقم الجوال يجب أن يكون 10 أرقام';
    if (!/^\d+$/.test(p)) return 'رقم الجوال يجب أن يحتوي على أرقام فقط';
    return null;
  };

  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    if (!phoneNumber) {
      setErrorMsg('يرجى إدخال رقم الجوال');
      setIsLoading(false);
      return;
    }
    const phoneError = validatePhone(phoneNumber);
    if (phoneError) {
      setErrorMsg(phoneError);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Find email associated with this phone
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const q = query(collection(db, 'users'), where('phone', '==', phoneNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMsg('رقم الجوال هذا غير مسجل لدينا.');
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0].data();
      const userEmail = userDoc.email;

      // 2. Sign in with identified email and provided password
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      // Request notification permissions
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      
      onLogin();
    } catch (error: any) {
      setErrorMsg(mapAuthCodeToMessage(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'email_login' && loginMethod === 'phone') {
      return handlePhoneLogin(e);
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (authMode === 'email_login') {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        
        // Request notification permissions
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
        
        onLogin();
      } else if (authMode === 'email_register') {
        const phoneError = validatePhone(phone);
        if (phoneError) {
          setErrorMsg(phoneError);
          setIsLoading(false);
          return;
        }

        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Immediately create profile with additional details
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          fullName,
          email: userCredential.user.email,
          phone,
          plan: 'free',
          messageCount: 0,
          monthlyMessageCount: 0,
          lastMessageReset: serverTimestamp(),
          subscriptionCount: 0,
          totalMessages: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await sendEmailVerification(userCredential.user);
        setSuccessMsg('تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.');
        onLogin();
      } else if (authMode === 'forgot_password') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني (الجيميل).');
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

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    setIsLoading(true);
    setErrorMsg('');

    const phoneError = validatePhone(phone);
    if (phoneError) {
      setErrorMsg(phoneError);
      setIsLoading(false);
      return;
    }

    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await setDoc(doc(db, 'users', tempUser.uid), {
        fullName,
        email: tempUser.email,
        phone,
        plan: 'free',
        messageCount: 0,
        monthlyMessageCount: 0,
        lastMessageReset: serverTimestamp(),
        subscriptionCount: 0,
        totalMessages: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onLogin();
    } catch (error: any) {
      setErrorMsg('فشل حفظ البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen mesh-bg flex flex-col items-center overflow-x-hidden w-full rtl pb-20 selection:bg-gold-500/30 selection:text-gold-200">
      <AppRainBackground />
      {/* Dynamic Glow Ornament (Performance Optimized) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold-500/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/5 blur-[110px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 pt-6 flex justify-end z-50 relative">
        <LanguageSelector />
      </div>

      <div className="relative z-10 w-full max-w-6xl px-6 pt-12 md:pt-20 flex flex-col items-center">
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
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-500 shadow-[0_0_20px_rgba(197,160,89,0.2)] max-w-full">
            <span className="text-xs sm:text-sm font-bold tracking-wide text-center">المنصة السعودية لبناء التطبيقات والمنصات</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-relaxed md:leading-[1.4] break-words px-2">
            صمم تطبيقك بضغطة زر ✨<br />
            مع <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 font-extrabold uppercase tracking-wider">ماهر Ai</span> 🧠<br />
            بناء فوري بدقائق ⏱️<br />
            بذكاء إصطناعي فائق ⚡<br />
            معاينة حية لحظية 📱<br />
            <span className="text-gold-500">ابدأ مجاناً الآن 🎁</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            لا حاجة لكتابة الأكواد من الصفر، تحدث مع ماهر ببساطة، وسيقوم بتصميم وبرمجة تطبيقاتك فوراً. اختر الباقة المناسبة لك وابدأ رحلتك الآن.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenAuth}
              className="group relative inline-flex items-center bg-gold-500 text-zinc-950 font-bold text-xl px-10 py-5 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(197,160,89,0.4)] disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10">ابدأ تجربتك مع ماهر الآن</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsPWAInstallOpen(true)}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold px-6 py-5 rounded-2xl hover:bg-zinc-800 hover:text-white transition-colors shadow-lg sm:whitespace-nowrap"
            >
              <Download className="w-5 h-5 text-gold-500" />
              تثبيت التطبيق على جهازك
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
                  '5 أوامر برمجية يومياً (مجانا)',
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
                  '5 أوامر برمجية يومياً (مجانا)',
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
                  '7 أوامر برمجية يومياً (مجانا)',
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

      {/* Footer */}
      <footer className="relative z-10 w-full bg-zinc-950/40 backdrop-blur-md border-t border-zinc-900 mt-auto py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Brand & Contact */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] space-y-6 hover:border-gold-500/30 transition-colors shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold-500/10 rounded-xl">
                <img src="/AppIcon~ios-marketing.png" alt="Maher Logo" className="w-8 h-8 rounded-lg" />
              </div>
              <span className="text-xl font-bold text-white">ماهر مصنع التطبيقات</span>
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed font-medium">
              حلول سعودية مبتكرة لتحويل الأفكار إلى تطبيقات واقعية باستخدام الذكاء الاصطناعي.
            </p>
            <a 
              href="https://wa.me/966530008069" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-3 w-fit bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 px-5 py-3 rounded-2xl transition-all group"
            >
              <MessageCircle className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
              <div className="text-right">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">تواصل مباشر</div>
                <div className="text-sm font-bold text-green-400">واتساب</div>
              </div>
            </a>
          </div>

          {/* Card 2: Quick Info */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] space-y-6 hover:border-gold-500/30 transition-colors shadow-xl">
            <h4 className="text-white font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
              روابط سريعة
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setShowDocumentation(true)} 
                className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-bold">دليل الاستخدام</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-zinc-600 group-hover:translate-x-[-4px] transition-transform" />
              </button>
              <button 
                onClick={() => setActiveInfoModal('glossary')} 
                className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-bold">المصطلحات</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-zinc-600 group-hover:translate-x-[-4px] transition-transform" />
              </button>
              <button 
                onClick={() => setActiveInfoModal('faq')} 
                className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-bold">الأسئلة الشائعة</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-zinc-600 group-hover:translate-x-[-4px] transition-transform" />
              </button>
              <button 
                onClick={() => setActiveInfoModal('terms')} 
                className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-bold">الشروط والأحكام</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-zinc-600 group-hover:translate-x-[-4px] transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 3: Support & Rights */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2rem] space-y-6 hover:border-gold-500/30 transition-colors shadow-xl">
            <h4 className="text-white font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
              تغطية التكاليف
            </h4>
            <div className="p-4 bg-gold-500/5 border border-gold-500/10 rounded-2xl">
              <p className="text-zinc-200 text-sm leading-relaxed font-medium">
                تعتبر الاشتراكات دعماً تشغيلياً لتغطية تكاليف تقنيات الذكاء الاصطناعي الضخمة، لضمان استمرارية الخدمة بأعلى كفاءة لجميع المستخدمين.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-800/50">
              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                © {new Date().getFullYear()} جميع الحقوق محفوظة لـ "منصة ماهر".
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modals */}
      <AnimatePresence>
        {activeInfoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setActiveInfoModal(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-gold-500/10"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold-500/10 rounded-xl text-gold-500">
                    {activeInfoModal === 'terms' ? <ShieldCheck className="w-6 h-6" /> : activeInfoModal === 'glossary' ? <FileText className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {activeInfoModal === 'terms' ? 'الشروط والأحكام القانونية' : activeInfoModal === 'glossary' ? 'المصطلحات' : 'الأسئلة الشائعة والتعريف'}
                  </h3>
                </div>
                <button onClick={() => setActiveInfoModal(null)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                {activeInfoModal === 'glossary' ? (
                  <div className="space-y-6 text-zinc-300">
                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gold-500 rounded-full" />
                        المصطلحات الشائعة في المنصة
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                          <h5 className="text-gold-500 font-bold mb-2">الأمر البرمجي (الرسالة)</h5>
                          <p className="text-sm text-zinc-400">هو الطلب النصي الذي ترسله إلى ماهر ويقوم بناءً عليه بكتابة أو تعديل الكود المصدري. يحسب كل طلب كنقطة أو أمر برمجي واحد.</p>
                        </div>
                        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                          <h5 className="text-gold-500 font-bold mb-2">النشر السحابي (Cloud Deployment)</h5>
                          <p className="text-sm text-zinc-400">خاصية متوفرة لباقة النخبة تسمح بربط تطبيقك بقواعد بيانات حقيقية ورفع الكود على خوادم ليصبح متاحاً للجميع برابط مباشر.</p>
                        </div>
                        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                          <h5 className="text-gold-500 font-bold mb-2">الكود المصدري (Source Code)</h5>
                          <p className="text-sm text-zinc-400">هو الشفرة البرمجية الكاملة لتطبيقك التي يولدها ماهر. يمكنك تنزيلها بشكل كامل كملف مضغوط (في الباقات المدفوعة).</p>
                        </div>
                        <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                          <h5 className="text-gold-500 font-bold mb-2">المعاينة الفورية (Live Preview)</h5>
                          <p className="text-sm text-zinc-400">هي الشاشة التفاعلية التي تظهر مباشرة بعد تنفيذ الأمر البرمجي لتمكنك من رؤية تطبيقك واستخدامه كما لو كان حقيقياً.</p>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : activeInfoModal === 'terms' ? (
                  <div className="space-y-6 text-zinc-300">
                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gold-500 rounded-full" />
                        اتفاقية الاستخدام
                      </h4>
                      <p className="text-sm leading-relaxed text-zinc-400">
                        باستخدامك لمنصة "ماهر"، فإنك تقر وتوافق على الالتزام بكافة الشروط المذكورة هنا. المنصة تهدف لتوفير أدوات برمجية متقدمة باستخدام الذكاء الاصطناعي لتسهيل عملية بناء التطبيقات.
                      </p>
                    </section>
                    
                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2 text-red-400">
                        <X className="w-4 h-4" />
                        الاستخدام المحظور (هام جداً)
                      </h4>
                      <p className="text-sm leading-relaxed">
                        يُمنع منعاً باتاً صرامة استخدام المنصة في إنشاء أي نوع من أنواع الألعاب بجميع أشكالها (ترفيهية، تعليمية، مراهنات، إلخ). المنصة مخصصة للتطبيقات الخدمية والمنصات التقنية الجادة فقط. أي محاولة لخرق هذا القانون قد تؤدي لإيقاف الحساب فوراً دون استرداد الرسوم.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gold-500 rounded-full" />
                        المسؤولية القانونية
                      </h4>
                      <p className="text-sm leading-relaxed">
                        يتحمل المستخدم كامل المسؤولية القانونية والأخلاقية عن أي تطبيق يتم بناؤه أو نشره باستخدام المنصة. منصة "ماهر" والمطور القائم عليها غير مسؤولين عن أي سوء استخدام للكود المصدري أو البيانات من قبل المستخدمين.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gold-500 rounded-full" />
                        حقوق الملكية
                      </h4>
                      <p className="text-sm leading-relaxed">
                        نحن نمنحك الحق في استخدام الكود الناتج عن المنصة في مشاريعك الخاصة (في باقات المحترف والنخبة)، ولكن يظل حق ملكية النظام والأدوات الذكية المستخدمة محفوظاً لمنصة ماهر.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gold-500 rounded-full" />
                        الخصوصية والبيانات
                      </h4>
                      <p className="text-sm leading-relaxed">
                        نحن نلتزم بحماية بياناتك الشخصية وتشفيرها. لا نقوم بمشاركة بيانات المستخدمين مع أي جهة خارجية إلا في حدود ما يفرضه القانون في المملكة العربية السعودية.
                      </p>
                    </section>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-zinc-800/30 border border-zinc-800 p-6 rounded-3xl">
                      <h4 className="text-gold-500 font-bold mb-3">ما هي منصة ماهر؟</h4>
                      <p className="text-zinc-300 text-sm leading-relaxed">
                        منصة "ماهر" هي أول منصة سعودية متكاملة تتيح للمستخدمين بناء تطبيقات الهواتف الذكية كاملة (Frontend & Backend) عن طريق المحادثة باللغة العربية والإنجليزية، دون الحاجة لخبرة برمجية مسبقة.
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="p-3 bg-zinc-800 border border-zinc-700 h-fit rounded-2xl">
                          <Info className="w-6 h-6 text-gold-500" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold mb-2">من أين نشأت وبواسطة من؟</h4>
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            نشأت الفكرة بهدف تمكين الشباب السعودي والعربي من دخول سوق التقنية وصناعة تطبيقاتهم الخاصة بأقل التكاليف وبأعلى سرعة ممكنة. تم تطوير المنصة وبناؤها بالكامل بواسطة المبرمج والشاب السعودي "ماهر الثبيتي".
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="p-3 bg-zinc-800 border border-zinc-700 h-fit rounded-2xl">
                          <Crown className="w-6 h-6 text-gold-500" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold mb-2">ما هو الهدف من المنصة؟</h4>
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            هدفنا هو جعل البرمجة والتقنية متاحة للجميع، وإزالة العوائق المالية والتقنية التي تواجه أصحاب الأفكار المبدعة في رحلة تحويل أفكارهم إلى مشاريع حية.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="p-3 bg-zinc-800 border border-zinc-700 h-fit rounded-2xl">
                          <ShieldCheck className="w-6 h-6 text-gold-500" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold mb-2">هل الاشتراكات تجارية؟</h4>
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            تعتبر الاشتراكات في المقام الأول دعماً للمنصة لتغطية التكاليف التشغيلية الضخمة (مثل خدمات الحوسبة السحابية، واجهات الذكاء الاصطناعي، والصيانة)، وليست ربحية بحتة. نحن نسعى لتوفير الخدمة بأقل سعر ممكن لخدمة المجتمع التقني.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-center">
                <button 
                  onClick={() => setActiveInfoModal(null)}
                  className="bg-gold-500 text-zinc-950 px-8 py-3 rounded-2xl font-bold hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20"
                >
                  فهمت ذلك
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md relative z-10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-none"
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

              {/* Auth Mode Toggle */}
              {authMode === 'email_login' && (
                <div className="flex bg-zinc-950/50 p-1 rounded-xl border border-zinc-800 mb-6">
                  <button 
                    onClick={() => setLoginMethod('email')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${loginMethod === 'email' ? 'bg-gold-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    بالبريد الإلكتروني
                  </button>
                  <button 
                    onClick={() => setLoginMethod('phone')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${loginMethod === 'phone' ? 'bg-gold-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    برقم الجوال
                  </button>
                </div>
              )}

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
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGoogleLogin} 
                      disabled={isLoading} 
                      type="button"
                      className="w-full flex items-center justify-center gap-3 bg-white text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-zinc-100 transition-colors shadow-lg relative z-20 touch-manipulation mb-3"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 pointer-events-none" alt="Google" />
                      المتابعة باستخدام قوقل
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.preventDefault(); setAuthMode('email_login'); setLoginMethod('phone'); }} 
                      disabled={isLoading} 
                      type="button"
                      className="w-full flex items-center justify-center gap-3 bg-zinc-800 text-white font-bold py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors shadow-lg relative z-20 touch-manipulation mb-3"
                    >
                      <Phone className="w-5 h-5 text-zinc-400 pointer-events-none" />
                      رقم الجوال
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.preventDefault(); setAuthMode('email_login'); setLoginMethod('email'); }} 
                      disabled={isLoading} 
                      type="button"
                      className="w-full flex items-center justify-center gap-3 bg-zinc-800 text-white font-bold py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors shadow-lg relative z-20 touch-manipulation"
                    >
                      <Mail className="w-5 h-5 text-zinc-400 pointer-events-none" />
                      البريد الإلكتروني
                    </motion.button>
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
                      {authMode === 'email_register' && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">الاسم الكامل</label>
                          <div className="relative">
                            <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input 
                              type="text" 
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                              placeholder="أدخل اسمك"
                            />
                          </div>
                        </div>
                      )}
                      
                      {loginMethod === 'email' || authMode === 'email_register' ? (
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
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">رقم الجوال (05XXXXXXXX)</label>
                          <div className="relative">
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input 
                              type="tel" 
                              required
                              maxLength={10}
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                              placeholder="05XXXXXXXX"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      )}

                      {authMode === 'email_register' && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">رقم الجوال (05XXXXXXXX)</label>
                          <div className="relative">
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input 
                              type="tel" 
                              maxLength={10}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                              placeholder="05XXXXXXXX (اختياري)"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      )}
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
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit" 
                        disabled={isLoading} 
                        className="w-full py-4 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(197,160,89,0.3)] active:shadow-none"
                      >
                        {isLoading ? 'جاري التنفيذ...' : authMode === 'email_login' ? 'تأكيد الدخول' : 'إنشاء حساب'}
                      </motion.button>
                      <div className="text-center pt-2">
                        <button type="button" onClick={() => setAuthMode(authMode === 'email_login' ? 'email_register' : 'email_login')} className="text-sm text-zinc-400 hover:text-white py-2 px-4">
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
                        {isLoading ? 'جاري الإرسال...' : 'إرسال رابط استعادة الرقم السري'}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Complete Profile */}
                {authMode === 'complete_profile' && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <form onSubmit={handleCompleteProfile} className="space-y-4">
                      <p className="text-sm text-zinc-400 text-center mb-4">يرجى إكمال بياناتك للمتابعة.</p>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">الاسم الكامل</label>
                        <div className="relative">
                          <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                          <input 
                            type="text" 
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                            placeholder="أدخل اسمك"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">رقم الجوال (05XXXXXXXX)</label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                          <input 
                            type="tel" 
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pr-10 pl-4 text-white focus:outline-none focus:border-gold-500"
                            placeholder="05XXXXXXXX (اختياري)"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full py-3.5 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors flex justify-center items-center gap-2">
                        {isLoading ? 'جاري الحفظ...' : 'إكمال التسجيل'}
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
      
      <Documentation 
        isOpen={showDocumentation} 
        onClose={() => setShowDocumentation(false)} 
      />
    </div>
  );
}
