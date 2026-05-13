import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share, PlusSquare, Download, Monitor, Smartphone, ChevronLeft, ArrowUpCircle } from 'lucide-react';

interface PWAInstallProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ isOpen, onClose }) => {
  const [device, setDevice] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDevice('ios');
    } else if (/android/.test(ua)) {
      setDevice('android');
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Auto-close after 15 seconds if open
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 15000);
      return () => {
        clearTimeout(timer);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isOpen, onClose]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[400px] z-[100] bg-zinc-900/90 backdrop-blur-xl border border-gold-500/20 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden rtl"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gold-500/20">
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-gold-500"
            />
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex-shrink-0 border border-zinc-800 overflow-hidden shadow-lg">
              <img 
                src="/AppIcon~ios-marketing.png" 
                alt="Maher" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-white">تثبيت التطبيق</h3>
                <button 
                  onClick={onClose}
                  className="p-1 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 leading-tight mb-3">
                {device === 'ios' 
                  ? 'للتثبيت على الايفون: اضغط على زر المشاركة في شريط الأدوات السفلي ثم اختر "إضافة إلى الصفحة الرئيسية"' 
                  : (deferredPrompt 
                      ? 'بإمكانك الآن تثبيت ماهر كاختصار على شاشتك الرئيسية للوصول السريع'
                      : 'للحصول على أفضل تجربة، أضف ماهر إلى شاشتك الرئيسية عبر خيارات المتصفح (⋮)')}
              </p>

              <div className="flex flex-col gap-2">
                {device === 'ios' ? (
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50 w-fit">
                    <Share className="w-3 h-3 text-blue-400" />
                    <span>المشاركة</span>
                    <ChevronLeft className="w-3 h-3" />
                    <PlusSquare className="w-3 h-3 text-gold-500" />
                    <span>إضافة</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {deferredPrompt && (
                      <button 
                        onClick={handleInstallClick}
                        className="flex items-center justify-center gap-2 bg-gold-500 text-zinc-950 font-bold py-2 px-4 rounded-xl text-sm hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/10"
                      >
                        <Download className="w-4 h-4" />
                        <span>تثبيت الآن</span>
                      </button>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50 w-fit">
                      <Download className="w-3 h-3 text-gold-500" />
                      <span>أو من خيارات المتصفح (⋮)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-950/50 px-5 py-3 border-t border-zinc-800/50 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-medium">سريع • خفيف</span>
            <button 
              onClick={onClose}
              className="text-xs font-bold text-gold-500 hover:text-gold-400 transition-colors"
            >
              تم
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

  );
};
