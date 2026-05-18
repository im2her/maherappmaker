import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe } from 'lucide-react';

export const supportedLanguages = [
  { code: 'ar', name: 'العربية', flagUrl: 'https://flagcdn.com/w20/sa.png' },
  { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w20/us.png' },
  { code: 'ja', name: '日本語', flagUrl: 'https://flagcdn.com/w20/jp.png' },
  { code: 'zh-CN', name: '中文', flagUrl: 'https://flagcdn.com/w20/cn.png' },
  { code: 'de', name: 'Deutsch', flagUrl: 'https://flagcdn.com/w20/de.png' },
  { code: 'fr', name: 'Français', flagUrl: 'https://flagcdn.com/w20/fr.png' },
  { code: 'es', name: 'Español', flagUrl: 'https://flagcdn.com/w20/es.png' },
  { code: 'pt', name: 'Português', flagUrl: 'https://flagcdn.com/w20/br.png' }
];

export function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('ar');

  useEffect(() => {
    // Force set cookie from localStorage if available (helps with iframe partitioning)
    const storedLang = localStorage.getItem('maher_lang');
    if (storedLang && storedLang !== 'ar' && !document.cookie.includes(`googtrans=/ar/${storedLang}`)) {
      document.cookie = `googtrans=/ar/${storedLang}; path=/; SameSite=None; Secure;`;
      document.cookie = `googtrans=/ar/${storedLang}; domain=${window.location.hostname}; path=/; SameSite=None; Secure;`;
      if (document.documentElement.dir === 'rtl') {
        document.documentElement.dir = 'ltr';
        document.documentElement.className = 'ltr';
        window.location.reload(); // Reload to let it apply early
        return;
      }
    } else if (storedLang === 'ar') {
      // Ensure it's Arabic
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure;`;
      setCurrentLang('ar');
    }

    // Check cookie
    const match = document.cookie.match(/googtrans=\/ar\/([^;]+)/);
    if (match && match[1]) {
      setCurrentLang(match[1]);
      // Make sure the document starts in correct mode
      if (match[1] !== 'ar') {
        document.documentElement.dir = 'ltr';
        document.documentElement.className = 'ltr';
      }
    } else {
      // Auto detection logic if no cookie is set
      const userLang = navigator.language.toLowerCase();
      let target = 'ar';
      
      if (userLang.startsWith('en')) target = 'en';
      else if (userLang.startsWith('ja')) target = 'ja';
      else if (userLang.startsWith('zh')) target = 'zh-CN';
      else if (userLang.startsWith('de')) target = 'de';
      else if (userLang.startsWith('fr')) target = 'fr';
      else if (userLang.startsWith('es')) target = 'es';
      else if (userLang.startsWith('pt')) target = 'pt';
      
      if (target !== 'ar' && !storedLang) {
        setCurrentLang(target);
        localStorage.setItem('maher_lang', target);
        document.cookie = `googtrans=/ar/${target}; path=/; SameSite=None; Secure;`;
        document.cookie = `googtrans=/ar/${target}; domain=${window.location.hostname}; path=/; SameSite=None; Secure;`;
        document.cookie = `googtrans=/ar/${target}; domain=.${window.location.hostname}; path=/; SameSite=None; Secure;`;
        document.documentElement.dir = 'ltr';
        document.documentElement.className = 'ltr';
        
        // Force reload to apply Google Translate
        if (!sessionStorage.getItem('langAutoDetected')) {
          sessionStorage.setItem('langAutoDetected', 'true');
          window.location.reload();
        }
      }
    }
    
    // Inject GT script if not already present
    if (!document.getElementById('google-translate-script')) {
      // Add the root div for it
      if (!document.getElementById('google_translate_element')) {
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.position = 'absolute';
        div.style.top = '-9999px';
        div.style.left = '-9999px';
        div.style.width = '1px';
        div.style.height = '1px';
        div.style.overflow = 'hidden';
        document.body.appendChild(div);
      }

      (window as any).googleTranslateElementInit = () => {
        if (!(window as any).google) return;
        new (window as any).google.translate.TranslateElement({
          pageLanguage: 'ar',
          includedLanguages: 'ar,en,ja,zh-CN,de,fr,es,pt',
          autoDisplay: false,
        }, 'google_translate_element');
      };

      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const changeLanguage = (code: string) => {
    if (code === currentLang) {
      setIsOpen(false);
      return;
    }
    
    const domain = window.location.hostname;
    const isAR = code === 'ar';
    const cookieOptions = "path=/; SameSite=None; Secure;";
    
    // Save to localStorage for persistence
    localStorage.setItem('maher_lang', code);
    
    // Clear all existing variations of googtrans cookie before setting
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; ${cookieOptions}`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${domain}; ${cookieOptions}`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${domain}; ${cookieOptions}`;

    // Set new cookie if not Arabic
    if (!isAR) {
      document.cookie = `googtrans=/ar/${code}; ${cookieOptions}`;
      document.cookie = `googtrans=/ar/${code}; domain=${domain}; ${cookieOptions}`;
      document.cookie = `googtrans=/ar/${code}; domain=.${domain}; ${cookieOptions}`;
    }
    
    window.location.reload();
  };

  const activeLang = supportedLanguages.find(l => l.code === currentLang) || supportedLanguages[0];

  return (
    <div className="relative z-[9999] notranslate" dir="ltr">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur border border-zinc-800 hover:border-gold-500/50 text-white px-3 py-2 rounded-xl transition-all shadow-lg min-w-[120px]"
      >
        <Globe className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium flex-1 text-left hidden sm:block">{activeLang.name}</span>
        <img src={activeLang.flagUrl} alt={activeLang.name} className="w-5 h-auto rounded-[2px]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-14 left-0 w-48 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 notranslate"
            >
              {supportedLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full text-left px-3 py-2.5 rounded-[10px] text-sm transition-all flex items-center justify-between ${
                    currentLang === lang.code 
                      ? 'bg-zinc-800/80 text-white font-medium' 
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <img src={lang.flagUrl} alt={lang.name} className="w-5 h-auto rounded-[2px]" />
                    <span>{lang.name}</span>
                  </span>
                  {currentLang === lang.code && (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
