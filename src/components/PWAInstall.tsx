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
    if (!deferredPrompt) {
      alert('نظام التشغيل لديك يمنع تثبيت التطبيق مباشرةً. يرجى التثبيت يدوياً من خيارات المتصفح (⋮) أو خيار "إضافة إلى الشاشة الرئيسية".');
      return;
    }
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-6 w-[92vw] max-w-[360px] z-[200] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden rtl"
        >
          {/* Progress Bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-zinc-800">
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-gold-500"
            />
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-950 rounded-lg flex-shrink-0 border border-zinc-800 overflow-hidden shadow-sm">
                <img 
                  src="/AppIcon~ios-marketing.png" 
                  alt="Maher" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">تثبيت التطبيق</h3>
                  <button 
                    onClick={onClose}
                    className="p-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                  {device === 'ios' 
                    ? 'أضف ماهر لشاشتك الرئيسية لتجربة أسرع.' 
                    : (deferredPrompt 
                        ? 'أضف ماهر كاختصار للوصول السريع.'
                        : 'أضف التطبيق لشاشتك عبر خيارات المتصفح (⋮).')}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              {device === 'ios' ? (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-300 bg-zinc-800/50 px-2 py-2 rounded-lg border border-zinc-700/50">
                  <span>اضغط</span>
                  <Share className="w-3 h-3 text-blue-400 mx-0.5" />
                  <span>ثم اختر</span>
                  <PlusSquare className="w-3 h-3 text-gold-500 mx-0.5" />
                  <span>إضافة إلى الشاشة</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleInstallClick}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gold-500 text-zinc-950 font-bold py-2 rounded-lg text-xs hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تثبيت الآن</span>
                  </button>
                  <button 
                    onClick={onClose}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    لاحقاً
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
