import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { User, sendEmailVerification, reload } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { processRequest } from '../lib/engine';
import { motion, AnimatePresence } from 'motion/react';
import { CodeBackground } from './CodeBackground';
import { MessageSquare, Plus, LogOut, Code, Sparkles, Send, Paperclip, Menu, X, User as UserIcon, Monitor, Tablet, Smartphone, Download, RotateCcw, Play, ArrowRight, Lock, Crown, Settings, MousePointerClick, Cloud, Database, Globe, Server, CheckCircle2, ChevronRight, Copy, ExternalLink, RefreshCw, Mail, History, Clock, Pin, Trash2, Folder, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import JSZip from 'jszip';
import { AdminDashboard } from './AdminDashboard';
import { compressImage } from '../lib/imageUtils';

interface Chat {
  id: string;
  userId: string;
  title: string;
  agentName: string;
  updatedAt: any;
  isPinned?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: any;
}

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const ChatItem = React.memo(function ChatItem({ chat, isActive, onClick, onTogglePin, onDelete }: ChatItemProps) {
  const [showActions, setShowActions] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      setShowActions(true);
    }, 600);
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={startPress}
      onTouchEnd={endPress}
    >
      <button
        onClick={onClick}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-colors pr-3",
          isActive ? "bg-zinc-800/80 text-gold-500 shadow-sm" : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200",
          chat.isPinned && !isActive ? "text-zinc-300" : ""
        )}
      >
        {chat.isPinned ? (
          <Pin className="w-4 h-4 shrink-0 fill-gold-500 text-gold-500 rotate-45" />
        ) : (
          <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
        )}
        <span className="truncate flex-1 font-medium text-sm">{chat.title || 'مشروع...'}</span>
      </button>

      {(showActions || isActive) && (
        <div className={clsx(
          "absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-all bg-zinc-900/90 backdrop-blur-sm rounded-lg p-0.5 border border-zinc-800 shadow-xl",
          showActions ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto"
        )}>
          <button 
            onClick={onTogglePin}
            className={clsx(
              "p-1.5 rounded-md hover:bg-zinc-800 transition-colors",
              chat.isPinned ? "text-gold-500" : "text-zinc-500 hover:text-white"
            )}
            title={chat.isPinned ? "إلغاء التثبيت" : "تثبيت المحادثة"}
          >
            <Pin className={clsx("w-3.5 h-3.5", chat.isPinned && "fill-current rotate-45")} />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="حذف المحادثة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

interface MessageItemProps {
  message: Message;
  idx: number;
  visibleCount: number;
  messagesLength: number;
  agentType: string;
  handleSendMessage: (text: string) => void;
  isLoading: boolean;
}

const MessageItem = memo(function MessageItem({ 
  message, 
  idx, 
  visibleCount, 
  messagesLength, 
  agentType, 
  handleSendMessage,
  isLoading 
}: MessageItemProps) {
  let cleanContent = message.content;
  let suggestions: string[] = [];
  
  if (message.role === 'model') {
    cleanContent = message.content.replace(/\[SUGGESTION\]\s*(.*?)(?=\n|$)/gi, (match, p1) => {
      if (p1.trim()) suggestions.push(p1.trim());
      return '';
    }).trim();
  }

  return (
  <div 
    className={clsx(
      "flex flex-col w-full",
      message.role === 'user' ? "items-start" : "items-end"
    )}
  >
    <div className={clsx(
      "max-w-[95%] rounded-2xl px-4 py-3",
      message.role === 'user' 
        ? "bg-zinc-800 text-zinc-100 rounded-tr-sm border border-zinc-700/50" 
        : "bg-transparent text-zinc-300 w-full"
    )}>
      {message.role === 'user' ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed">{cleanContent}</p>
      ) : (
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md">
              <img src="/AppIcon~ios-marketing.png" alt="Maher" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-gold-500 font-bold leading-none">ماهر</span>
              <span className="text-[10px] text-zinc-500 mt-1">صـانـع الـتطـبيـقـات</span>
            </div>
          </div>
          <div className="prose prose-base prose-invert max-w-none prose-p:leading-relaxed text-zinc-300
            prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800/50 prose-pre:p-0 
            prose-a:text-gold-500">
            <ReactMarkdown
              components={{
                code({node, inline, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  if (!inline && match) {
                    if ((agentType === "مصنع التطبيقات" && match[1] === 'html') || agentType === "ماهر العام") {
                      return (
                        <div className="ltr text-sm font-inter mt-2 mb-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2">
                          <Code className="w-4 h-4 text-gold-500" />
                          <span className="text-zinc-400 font-medium">
                            {agentType === "ماهر العام" ? "تم حجب الكود" : "تم تحديث واجهة المستخدم"}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="ltr text-sm font-inter">
                        <SyntaxHighlighter
                          {...props}
                          children={String(children).replace(/\n$/, '')}
                          style={vscDarkPlus as any}
                          language={match[1]}
                          PreTag="div"
                          className="!m-0 !bg-transparent !p-3 !rounded-lg border border-zinc-800"
                        />
                      </div>
                    )
                  }
                  return (
                    <code {...props} className={clsx(className, "bg-zinc-800 text-gold-500 px-1.5 py-0.5 rounded text-sm font-inter")}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {cleanContent}
            </ReactMarkdown>
          </div>
          {suggestions.length > 0 && idx === (Math.min(messagesLength, visibleCount) - 1) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-800/50">
              {suggestions.map((sg, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sg)}
                  disabled={isLoading}
                  className="text-sm font-medium px-4 py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-zinc-950 hover:bg-gold-500 hover:border-gold-500 rounded-lg transition-colors text-right max-w-full"
                >
                  {sg}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  );
});

const ChatInput = React.memo(function ChatInput({ 
  isLoading, 
  isExceeded, 
  cooldown, 
  onSendMessage, 
  agentType,
  attachedImages,
  setAttachedImages,
  handleFileSelect,
  isSelectionModeActive,
  setIsSelectionModeActive,
  selectedSelector,
  setSelectedSelector,
  activeTab,
  setActiveTab,
  handleDrop,
  handleDragOver,
  setShowUpgradeModal,
  currentChatId
}: {
  isLoading: boolean;
  isExceeded: boolean;
  cooldown: number;
  onSendMessage: (text: string) => void;
  agentType: string;
  attachedImages: string[];
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isSelectionModeActive: boolean;
  setIsSelectionModeActive: (val: boolean) => void;
  selectedSelector: string | null;
  setSelectedSelector: (val: string | null) => void;
  activeTab: string;
  setActiveTab: (val: any) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  setShowUpgradeModal: (val: boolean) => void;
  currentChatId: string | null;
}) {
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentChatId) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentChatId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isExceeded) {
        setShowUpgradeModal(true);
        return;
      }
      if (inputMessage.trim() || attachedImages.length > 0) {
        onSendMessage(inputMessage);
        setInputMessage('');
        if (inputRef.current) {
          inputRef.current.style.height = '44px';
        }
      }
    }
  };

  const handleSendRequest = () => {
    if (isExceeded) {
      setShowUpgradeModal(true);
      return;
    }
    if (inputMessage.trim() || attachedImages.length > 0) {
      onSendMessage(inputMessage);
      setInputMessage('');
      if (inputRef.current) {
        inputRef.current.style.height = '44px';
      }
    }
  };

  return (
    <div className="p-4 bg-zinc-950 border-t border-zinc-800/50 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] text-zinc-500 font-medium">يمكنك سحب وإفلات الصور هنا أو استخدام أيقونة المشبك</span>
        {attachedImages.length > 0 && <span className="text-[10px] text-gold-500 font-bold animate-pulse">تم إرفاق {attachedImages.length} صور</span>}
      </div>
      {attachedImages.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {attachedImages.map((img, i) => (
            <div key={i} className="relative group w-12 h-12 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900">
              <img src={img} alt={`attachment ${i}`} className="w-full h-full object-cover" />
              <button 
                onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0 right-0 bg-red-500/80 text-white rounded-bl-lg w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {selectedSelector && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-2 mb-2 p-2 bg-gold-500/10 border border-gold-500/30 rounded-lg text-xs"
          >
            <MousePointerClick className="w-3.5 h-3.5 text-gold-500" />
            <span className="text-gold-500 font-medium flex-1 truncate">تم تحديد عنصر: <span className="font-mono opacity-80">{selectedSelector}</span></span>
            <button 
              onClick={() => setSelectedSelector(null)}
              className="p-1 hover:bg-gold-500/20 rounded text-gold-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-1 shadow-inner focus-within:border-gold-500/50 focus-within:ring-1 focus-within:ring-gold-500/50 transition-all"
      >
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            const target = e.target;
            requestAnimationFrame(() => {
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
            });
          }}
          onKeyDown={handleKeyDown}
          placeholder={cooldown > 0 ? `يرجى الانتظار ${cooldown} ثانية...` : isExceeded ? "انتهى رصيدك اليومي. قم بالترقية أو انتظر 24 ساعة." : (agentType === "مصنع التطبيقات" ? "صف التطبيق الذي تريد بناءه..." : "اسأل ماهر...")}
          className="w-full max-h-[150px] min-h-[44px] bg-transparent resize-none outline-none py-2.5 px-3 text-base text-zinc-100 placeholder:text-zinc-500 custom-scrollbar block disabled:opacity-50"
          rows={1}
          disabled={isExceeded || cooldown > 0}
        />
        <div className="flex items-center justify-between px-2 pb-1.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-xl hover:bg-zinc-800/50"
              title="إرفاق صورة"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            {agentType === "مصنع التطبيقات" && (
              <button 
                onClick={() => {
                  if (activeTab !== 'preview') setActiveTab('preview');
                  setIsSelectionModeActive(!isSelectionModeActive);
                  setSelectedSelector(null);
                }}
                className={clsx(
                  "p-2.5 transition-colors rounded-xl flex items-center gap-1.5",
                  isSelectionModeActive ? "bg-gold-500/20 text-gold-500" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                )}
                title="تعديل يدوي (تحديد عنصر)"
              >
                <MousePointerClick className="w-5 h-5" />
                {selectedSelector && <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />}
              </button>
            )}
          </div>
          <button 
            onClick={handleSendRequest}
            disabled={(!inputMessage.trim() && attachedImages.length === 0 && !isExceeded) || isLoading || cooldown > 0}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 group shadow-lg active:scale-95"
          >
            <span>{isExceeded ? 'ترقية' : cooldown > 0 ? `انتظر (${cooldown})` : 'إرسال'}</span>
            {isExceeded ? <Crown className="w-4 h-4" /> : <Send className="w-4 h-4 rtl:rotate-180" />}
          </button>
        </div>
      </div>
    </div>
  );
});

type DeviceSize = 'desktop' | 'tablet' | 'mobile';

export function MainApp({ user, userProfile }: { user: User; userProfile?: any }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentType, setAgentType] = useState<"ماهر العام" | "مصنع التطبيقات">("مصنع التطبيقات");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
  // Listen for messages from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ELEMENT_SELECTED') {
        setSelectedSelector(event.data.selector);
        setIsSelectionModeActive(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const userPlan = userProfile?.plan || 'free';
  
  // Proactive Daily Reset
  useEffect(() => {
    if (!user || !userProfile) return;
    const lastReset = userProfile?.lastMessageReset?.toDate();
    const now = new Date();
    if (lastReset && (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, {
        messageCount: 0,
        lastMessageReset: serverTimestamp()
      }).catch(err => console.error("Error resetting message count", err));
    }
  }, [userProfile, user]);

  // Cooldown effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  
  // Builder specific state
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [showNamingModal, setShowNamingModal] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'preview' | 'cloud'>('preview');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'provisioning-firebase' | 'provisioning-gcloud' | 'connected'>('connected');
  const [connectedService, setConnectedService] = useState<'firebase' | 'gcloud' | null>('gcloud');
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means latest
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(user.emailVerified);
  const [verificationSent, setVerificationSent] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  
  // Refresh verification status
  useEffect(() => {
    if (!isEmailVerified) {
      const interval = setInterval(async () => {
        try {
          await reload(user);
          if (user.emailVerified) {
            setIsEmailVerified(true);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Error reloading user", err);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isEmailVerified, user]);

  const handleResendVerification = async () => {
    try {
      await sendEmailVerification(user);
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 30000); // Reset after 30s
    } catch (err) {
      console.error("Error sending verification email", err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll inside chat
  const [messagesLimit, setMessagesLimit] = useState(50);
  const [visibleCount, setVisibleCount] = useState(5);
  const [chatLimit, setChatLimit] = useState(30);
  const lastScrollCall = useRef(0);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastScrollCall.current < 200) return;
    lastScrollCall.current = now;

    if (e.currentTarget.scrollTop === 0) {
      if (visibleCount < messages.length) {
        setVisibleCount(prev => prev + 5);
      } else if (messages.length >= messagesLimit) {
        setMessagesLimit(prev => prev + 50);
      }
    }
  }, [visibleCount, messages.length, messagesLimit]);

  const prevChatRef = useRef<string | null>(null);
  const prevMessagesLength = useRef<number>(0);
  const prevMessagesLimit = useRef<number>(messagesLimit);

  useEffect(() => {
    setVisibleCount(5);
  }, [currentChatId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      if (prevChatRef.current !== currentChatId) {
        // Snap to bottom on chat switch
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        prevChatRef.current = currentChatId;
        prevMessagesLength.current = messages.length;
        prevMessagesLimit.current = messagesLimit;
      } else if (messagesLimit > prevMessagesLimit.current) {
         // Data load from scrolling up, don't scroll to bottom
         prevMessagesLength.current = messages.length;
         prevMessagesLimit.current = messagesLimit;
      } else if (messages.length > prevMessagesLength.current) {
        // Smooth scroll only when NEW messages arrive (e.g. from user or bot)
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        prevMessagesLength.current = messages.length;
        setVisibleCount(5); // Reset visible count to 5 when new message arrives to keep it clean
      } else {
        prevMessagesLength.current = messages.length;
      }
    }
  }, [messages, isLoading, currentChatId, messagesLimit]);

  // Read chats
  useEffect(() => {
    let q;
    try {
      q = query(
        collection(db, 'chats'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(chatLimit)
      );
    } catch {
      q = query(
        collection(db, 'chats'),
        where('userId', '==', user.uid)
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      chatsData.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : Date.now();
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : Date.now();
        return tB - tA;
      });
      if (chatsData.length > chatLimit) {
        chatsData = chatsData.slice(0, chatLimit);
      }
      setChats(chatsData);
      if (chatsData.length > 0 && !currentChatId) {
        setCurrentChatId(chatsData[0].id);
        setAgentType(chatsData[0].agentName as any);
      }
    }, (error) => {
      // Fallback
      const fallbackQ = query(collection(db, 'chats'), where('userId', '==', user.uid));
      onSnapshot(fallbackQ, (snapshot) => {
        let chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        chatsData.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : Date.now();
          const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : Date.now();
          return tB - tA;
        });
        if (chatsData.length > chatLimit) {
          chatsData = chatsData.slice(0, chatLimit);
        }
        setChats(chatsData);
        if (chatsData.length > 0 && !currentChatId) {
          setCurrentChatId(chatsData[0].id);
          setAgentType(chatsData[0].agentName as any);
        }
      });
    });

    return () => unsubscribe();
  }, [user.uid, chatLimit]);

  // Read messages for current chat
  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }
    
    const q = query(
      collection(db, `chats/${currentChatId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(messagesLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      msgsData.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return tA - tB;
      });
      setMessages(msgsData);
      setHistoryIndex(-1); // Reset to latest whenever new messages arrive
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${currentChatId}/messages`));

    return () => unsubscribe();
  }, [currentChatId, messagesLimit]);

  const handleCreateNewChat = async () => {
    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'محادثة جديدة',
        agentName: agentType,
        updatedAt: serverTimestamp(),
        isPinned: false
      });
      setCurrentChatId(newChatRef.id);
      setIsSidebarOpen(false);
      setIsMobilePreviewOpen(false);
      setActiveTab('preview');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleTogglePinChat = async (e: React.MouseEvent, chatId: string, isPinned: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        isPinned: !isPinned,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error pinning chat", error);
    }
  };

  const confirmDeleteChat = async (chatId: string) => {
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chats');
    } finally {
      setChatToDelete(null);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setChatToDelete(chatId);
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          try {
            const dataUrl = await compressImage(file);
            setAttachedImages(prev => [...prev, dataUrl]);
          } catch (err) {
            console.error("Error compressing image", err);
          }
        }
      }
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && attachedImages.length === 0) || isLoading) return;

    setIsLoading(true);

    let finalPayload = text;
    
    if (selectedSelector) {
      finalPayload += `\n\n[AIS_METADATA_SECTION_START]\nCSS selector: ${selectedSelector}\n[AIS_METADATA_SECTION_END]`;
      setSelectedSelector(null);
      setIsSelectionModeActive(false);
    }

    if (attachedImages.length > 0) {
      finalPayload += '\n\n' + attachedImages.map((img, i) => `![صورة مرفقة ${i+1}](${img})`).join('\n\n');
      setAttachedImages([]);
    }

    let chatId = currentChatId;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const dLimit = getDailyLimit();
      const mLimit = getMonthlyLimit();
      
      let dCount = userProfile?.messageCount || 0;
      let mCount = userProfile?.monthlyMessageCount || 0;
      let lastReset = userProfile?.lastMessageReset?.toDate();
      const now = new Date();

      // Check for 24h reset
      if (!lastReset || (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
        dCount = 0;
        lastReset = now;
        await updateDoc(userRef, {
          messageCount: 0,
          lastMessageReset: serverTimestamp()
        });
      }

      const totalRemaining = (dLimit - dCount) + (mLimit - mCount);

      if (totalRemaining <= 0) {
        setShowUpgradeModal(true);
        setIsLoading(false);
        return;
      }

      if (!chatId) {
        const newChatRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: text ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : 'صورة مرفقة',
          agentName: agentType,
          updatedAt: serverTimestamp()
        });
        chatId = newChatRef.id;
        setCurrentChatId(chatId);
      } else {
        const chat = chats.find(c => c.id === chatId);
        const updates: any = {
          updatedAt: serverTimestamp(),
          agentName: agentType
        };
        
        if (chat && chat.title === 'محادثة جديدة' && messages.length === 0) {
           updates.title = text ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : 'صورة مرفقة';
        }
        await updateDoc(doc(db, 'chats', chatId), updates);
      }

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        role: 'user',
        content: finalPayload,
        createdAt: serverTimestamp()
      });

      const history = messages.map(m => {
        let content = m.content || '';
        if (m.role === 'model') {
          content = content.replace(/```(?:html|tsx|jsx)\n([\s\S]*?)```/g, '\n[تم إخفاء الكود لتوفير المساحة]\n');
        }
        return { role: m.role as "user" | "model", content };
      });
      
      let processingPrompt = finalPayload;
      if (agentType === 'مصنع التطبيقات' && currentCode) {
        processingPrompt = `[رسالة تلقائية من النظام: هذا هو الكود الحالي. يجب عليك إضافة التعديلات التي يطلبها المستخدم عليه، وإرجاع الكود بالكامل دون حذف أي شيء قديم ودون اختصار:]\n\`\`\`html\n${currentCode}\n\`\`\`\n\nطلب المستخدم: ${finalPayload}`;
      }
      
      const response = await processRequest(processingPrompt, agentType, history);
      const isDiscussion = response.includes('[DISCUSSION_ONLY]');
      const cleanResponse = response.replace(/\[DISCUSSION_ONLY\]/g, '');

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        role: 'model',
        content: cleanResponse,
        createdAt: serverTimestamp()
      });

      if (userProfile && !isDiscussion) {
        const userRef = doc(db, 'users', user.uid);
        const dLimit = getDailyLimit();
        const dUsed = userProfile?.messageCount || 0;

        if (dUsed < dLimit) {
          await updateDoc(userRef, {
            messageCount: increment(1),
            totalMessages: increment(1),
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(userRef, {
            monthlyMessageCount: increment(1),
            totalMessages: increment(1),
            updatedAt: serverTimestamp()
          });
        }
      }
      
    } catch (error: any) {
      console.error(error);
      const errMessage = error?.message || String(error);
      
      if (chatId) {
        let errorMessage = 'عذراً، واجهت مشكلة أثناء محاولة الرد. يرجى المحاولة مرة أخرى.';
        
        if (errMessage.includes('QUOTA_EXHAUSTED')) {
          errorMessage = '⚠️ يبدو أن "ماهر" مشغول جداً الآن (تجاوز حد الطلبات). يرجى الانتظار دقيقة واحدة فقط ثم المحاولة مرة أخرى. هذا أمر مؤقت وسيتم حله قريباً.';
          setCooldown(60); // 60 seconds cooldown
        } else if (errMessage.includes('GENERAL_ERROR')) {
          errorMessage = 'عذراً، حدث خطأ تقني غير متوقع أثناء التواصل مع "ماهر". يرجى إعادة المحاولة.';
        }

        await addDoc(collection(db, `chats/${chatId}/messages`), {
          role: 'model',
          content: errorMessage,
          createdAt: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentChatId, agentType, user, userProfile, messages, attachedImages, isLoading]);

  const isExceeded = useMemo(() => {
    const dLimit = getDailyLimit();
    const mLimit = getMonthlyLimit();
    
    let dUsed = userProfile?.messageCount || 0;
    const lastReset = userProfile?.lastMessageReset?.toDate();
    const now = new Date();
    if (lastReset && (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
       dUsed = 0;
    }
    
    let mUsed = userProfile?.monthlyMessageCount || 0;
    
    return (dUsed >= dLimit) && (mUsed >= mLimit);
  }, [userProfile, userPlan]);

  const currentChat = chats.find(c => c.id === currentChatId);

  // Extract all code block versions
  const codeVersions = useMemo(() => {
    const versions: { code: string; timestamp: Date; id: string }[] = [];
    messages.forEach(msg => {
      if (msg.role === 'model') {
        const matches = [...msg.content.matchAll(/```(?:html|tsx|jsx)\n([\s\S]*?)```/g)];
        if (matches.length > 0) {
          versions.push({
            code: matches[matches.length - 1][1],
            timestamp: msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(),
            id: msg.id
          });
        }
      }
    });
    return versions;
  }, [messages]);

  const currentCode = codeVersions.length > 0
    ? (historyIndex === -1 ? codeVersions[codeVersions.length - 1].code : codeVersions[historyIndex]?.code || '')
    : '';

  const injectedPreviewCode = useMemo(() => {
    if (!currentCode) return '';
    if (!isSelectionModeActive) return currentCode;

    const selectionScript = `
      <script>
        (function() {
          let lastEl = null;
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.pointerEvents = 'none';
          overlay.style.border = '2px solid #c5a059';
          overlay.style.backgroundColor = 'rgba(197, 160, 89, 0.1)';
          overlay.style.zIndex = '999999';
          overlay.style.display = 'none';
          overlay.style.transition = 'all 0.1s ease';
          document.body.appendChild(overlay);

          function getSelector(el) {
            if (el.id) return '#' + el.id;
            let path = [];
            while (el.nodeType === Node.ELEMENT_NODE) {
              let name = el.nodeName.toLowerCase();
              if (el.id) {
                name += '#' + el.id;
                path.unshift(name);
                break;
              } else {
                let sibling = el, nth = 1;
                while (sibling = sibling.previousElementSibling) {
                  if (sibling.nodeName.toLowerCase() == name) nth++;
                }
                if (nth != 1) name += ":nth-of-type(" + nth + ")";
              }
              path.unshift(name);
              el = el.parentNode;
            }
            return path.join(" > ");
          }

          document.addEventListener('mouseover', (e) => {
            const el = e.target;
            if (el === document.body || el === document.documentElement) return;
            lastEl = el;
            const rect = el.getBoundingClientRect();
            overlay.style.width = Math.ceil(rect.width) + 'px';
            overlay.style.height = Math.ceil(rect.height) + 'px';
            overlay.style.top = Math.ceil(rect.top) + 'px';
            overlay.style.left = Math.ceil(rect.left) + 'px';
            overlay.style.display = 'block';
          });

          document.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selector = getSelector(e.target);
            window.parent.postMessage({ type: 'ELEMENT_SELECTED', selector }, '*');
          }, true);

          document.addEventListener('mouseleave', () => {
             overlay.style.display = 'none';
          });
        })();
      </script>
    `;
    
    // Inject at end of body
    if (currentCode.includes('</body>')) {
      return currentCode.replace('</body>', selectionScript + '</body>');
    }
    return currentCode + selectionScript;
  }, [currentCode, isSelectionModeActive]);

  const handleCloudBack = () => {
    if (cloudStatus !== 'idle') {
      setCloudStatus('idle');
    } else {
      setActiveTab('preview');
    }
  };

  const handleStartProvisioning = (type: 'firebase' | 'gcloud') => {
    if (userPlan !== 'elite') {
      setShowUpgradeModal(true);
      return;
    }
    setCloudStatus(type === 'firebase' ? 'provisioning-firebase' : 'provisioning-gcloud');
    setTimeout(() => {
      setCloudStatus('connected');
      setConnectedService(type);
    }, 4000);
  };
  const handleDownload = async () => {
    if (userPlan === 'free') {
      setShowUpgradeModal(true);
      return;
    }
    if (!currentCode) return;
    const zip = new JSZip();
    zip.file('index.html', currentCode);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maher-app.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTabSwitch = (tab: 'preview' | 'cloud') => {
    if (tab === 'cloud' && userPlan !== 'elite') {
      setShowUpgradeModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleNewProject = () => {
    setShowNamingModal(true);
  };

  function getDailyLimit() {
    if (userPlan === 'elite') return 7;
    if (userPlan === 'pro') return 5;
    return 5;
  }

  function getMonthlyLimit() {
    if (userPlan === 'elite') return 100;
    if (userPlan === 'pro') return 50;
    return 0;
  }

  function getBalance() {
    const dLimit = getDailyLimit();
    const mLimit = getMonthlyLimit();
    
    let dUsed = userProfile?.messageCount || 0;
    const lastReset = userProfile?.lastMessageReset?.toDate();
    if (lastReset && (Date.now() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
      dUsed = 0;
    }

    let mUsed = userProfile?.monthlyMessageCount || 0;
    
    const dRemaining = Math.max(0, dLimit - dUsed);
    const mRemaining = Math.max(0, mLimit - mUsed);

    return dRemaining + mRemaining;
  }

  const confirmNewProject = async () => {
    if (!projectTitle.trim()) return;
    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: projectTitle.trim(),
        agentName: agentType,
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(newChatRef.id);
      setMessages([]);
      setHistoryIndex(-1);
      setCloudStatus('idle');
      setConnectedService(null);
      setShowNamingModal(false);
      setProjectTitle(''); 
      setIsSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleRestorePoint = (index: number) => {
    setHistoryIndex(index);
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          try {
            const dataUrl = await compressImage(file);
            setAttachedImages(prev => [...prev, dataUrl]);
          } catch (err) {
            console.error("Error compressing dropped image", err);
          }
        }
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex h-screen mesh-bg text-zinc-100 overflow-hidden rtl relative selection:bg-gold-500/30 selection:text-gold-200">
      <CodeBackground />
      {/* Optimized Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-gold-500/10 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-gold-500/5 blur-[120px] rounded-full" style={{ animationDelay: '3s' }} />
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Sidebar */}
      <motion.aside
        className={clsx(
          "fixed lg:static inset-y-0 right-0 z-50 w-72 bg-zinc-900 border-l border-zinc-800/50 transform transition-transform duration-300 flex flex-col shrink-0",
          isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-zinc-800/50 shrink-0 h-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-700/50 shadow-inner group">
              <img src="/AppIcon~ios-marketing.png" alt="Maher" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">
                {currentChat?.title || 'مشروع جديد'}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-1">بواسطة ماهر</p>
            </div>
          </div>
          <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 shrink-0">
          <button 
            onClick={handleNewProject}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-2.5 rounded-xl transition-colors font-medium border border-zinc-700/50 shadow-lg"
          >
            <Plus className="w-5 h-5 text-gold-500" />
            <span>مشروع جديد</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {chats.map(chat => (
            <ChatItem 
              key={chat.id}
              chat={chat}
              isActive={currentChatId === chat.id}
              onClick={() => {
                setCurrentChatId(chat.id);
                setAgentType(chat.agentName as any || "ماهر العام");
                setIsSidebarOpen(false);
              }}
              onTogglePin={(e) => handleTogglePinChat(e, chat.id, !!chat.isPinned)}
              onDelete={(e) => handleDeleteChat(e, chat.id)}
            />
          ))}
          {chats.length >= chatLimit && (
            <button
              onClick={() => setChatLimit(prev => prev + 30)}
              className="w-full text-center py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              عرض المزيد من المشاريع
            </button>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 font-inter shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-zinc-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate flex items-center justify-between">
                <span>{user.displayName || 'المستخدم'}</span>
                <span className="text-[10px] bg-gold-500/10 px-1.5 py-0.5 rounded border border-gold-500/20 text-gold-500">
                  {getBalance()} رصيد
                </span>
              </p>
              <div className="text-sm text-zinc-500 font-medium truncate flex items-center gap-1 mt-0.5">
                {userPlan === 'free' ? 'باقة مجانية' : userPlan === 'pro' ? 'الباقة الاحترافية' : 'باقة النخبة'}
              </div>
            </div>
          </div>
          {userPlan === 'free' && (
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="w-full flex items-center justify-center gap-2 mb-2 bg-zinc-900 border border-gold-500/30 text-gold-500 text-sm py-2.5 rounded-lg hover:bg-gold-500/10 transition-colors"
            >
              <Crown className="w-4 h-4" />
              <span>الترقية للباقة المدفوعة</span>
            </button>
          )}
          {user.email === 'mr.imaher@gmail.com' && (
            <button 
              onClick={() => setShowAdminDashboard(true)}
              className="w-full flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-2 mb-1 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">لوحة تحكم المسؤول</span>
            </button>
          )}
          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-2 text-zinc-400 hover:text-red-400 px-2 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">تسجيل الخروج</span>
          </button>
        </div>
      </motion.aside>

      {/* Main IDE Layout */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        
        {/* Email Verification Banner */}
        {!isEmailVerified && user.email && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3 text-amber-200 text-sm">
              <Mail className="w-5 h-5" />
              <span className="font-medium">يرجى تفعيل بريدك الإلكتروني لتتمكن من استخدام كافة مميزات المنصة.</span>
            </div>
            <button 
              onClick={handleResendVerification}
              disabled={verificationSent}
              className="px-4 py-1.5 bg-amber-500 text-zinc-950 text-xs font-bold rounded-xl hover:bg-amber-400 disabled:opacity-50 transition-all shadow-lg"
            >
              {verificationSent ? 'تم إرسال الرابط' : 'اضغط لإرسال رابط التفعيل'}
            </button>
          </div>
        )}
        
        <div className="flex-1 flex flex-col md:flex-row min-w-0 h-full overflow-hidden">
          {/* IDE Center (Chat & Commands) */}
          <div className={clsx(
            "flex flex-col border-l border-zinc-800/50 shrink-0 bg-zinc-950/50 h-full transition-all duration-300",
            (agentType === "ماهر العام" || !isMobilePreviewOpen) ? "w-full" : "w-full md:w-[380px] lg:w-[420px]",
            isMobilePreviewOpen && agentType === "مصنع التطبيقات" ? "hidden md:flex" : "flex"
          )}>
           <header className="shrink-0 flex items-center justify-between px-4 h-16 border-b border-zinc-800/50 bg-zinc-900/30">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center bg-zinc-950/50 rounded-lg p-1 border border-zinc-800/50">
                {(["ماهر العام", "مصنع التطبيقات"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAgentType(type)}
                    className={clsx(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5",
                      agentType === type 
                        ? "bg-gold-500 text-zinc-950 shadow-sm" 
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {type === "مصنع التطبيقات" ? <Code className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>
            {agentType === "مصنع التطبيقات" && (
              <button 
                className="text-zinc-300 hover:text-gold-500 flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800/50 transition-colors shadow-lg shadow-gold-500/5" 
                onClick={() => setIsMobilePreviewOpen(!isMobilePreviewOpen)}
              >
                {isMobilePreviewOpen ? (
                  <>
                    <MessageSquare className="w-4 h-4 text-gold-500" />
                    <span className="text-sm font-bold">الدردشة</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-gold-500" />
                    <span className="text-sm font-bold">معاينة</span>
                  </>
                )}
              </button>
            )}
          </header>

          <div 
            className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black" 
            id="chatbox"
            onScroll={handleScroll}
          >
            <div className="space-y-6">
              {messages.length > visibleCount && (
                <div className="text-center pb-2 flex flex-col items-center gap-2">
                  <div className="text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800/30">
                    اسحب للأعلى لرؤية الرسائل السابقة
                  </div>
                </div>
              )}
              {!messages.length && (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-70">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center overflow-hidden mb-4 border border-zinc-800/50">
                    <img src="/AppIcon~ios-marketing.png" alt="Maher" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">مرحباً بك!</h3>
                  <p className="text-zinc-400 text-sm">أنا ماهر، ما الذي تود القيام به اليوم؟</p>
                </div>
              )}
              
              {(messages.slice(-visibleCount)).map((message, idx) => (
                <MessageItem 
                  key={message.id}
                  message={message}
                  idx={idx}
                  visibleCount={visibleCount}
                  messagesLength={messages.length}
                  agentType={agentType}
                  handleSendMessage={handleSendMessage}
                  isLoading={isLoading}
                />
              ))}
              
              {isLoading && (
                <div className="flex w-full justify-start">
                  <div className="bg-transparent px-4 py-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
              
              {isExceeded && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-6 mb-8 p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-gold-500/20 rounded-2xl shadow-xl flex flex-col items-center text-center"
                >
                  <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mb-4">
                    <Crown className="w-8 h-8 text-gold-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">رصيدك اليومي انتهى</h3>
                  <p className="text-zinc-400 text-sm mb-6 max-w-sm">
                    لقد استهلكت جميع الأوامر البرمجية المتاحة لك اليوم. اشترك في الباقة الاحترافية للحصول على رصيد أكبر ومميزات حصرية!
                  </p>
                  <button 
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full sm:w-auto px-10 py-3.5 bg-gold-500 text-zinc-950 font-bold rounded-xl hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/10 active:scale-95"
                  >
                    عرض خيارات الترقية
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <ChatInput 
            isLoading={isLoading}
            isExceeded={isExceeded}
            cooldown={cooldown}
            onSendMessage={handleSendMessage}
            agentType={agentType}
            attachedImages={attachedImages}
            setAttachedImages={setAttachedImages}
            handleFileSelect={handleFileSelect}
            isSelectionModeActive={isSelectionModeActive}
            setIsSelectionModeActive={setIsSelectionModeActive}
            selectedSelector={selectedSelector}
            setSelectedSelector={setSelectedSelector}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleDrop={handleDrop}
            handleDragOver={handleDragOver}
            setShowUpgradeModal={setShowUpgradeModal}
            currentChatId={currentChatId}
          />
        </div>

        {/* IDE Right/Left Workspace Area (Preview) */}
        {agentType === "مصنع التطبيقات" && (
          <div className={clsx(
            "flex-1 flex-col bg-[#0A0A0A] relative h-full transition-all duration-300",
            isMobilePreviewOpen ? "flex" : "hidden"
          )}>
            <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-4 shrink-0 bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <button 
                  className="md:hidden text-zinc-300 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors" 
                  onClick={() => setIsMobilePreviewOpen(false)}
                  title="العودة للدردشة"
                >
                  <ArrowRight className="w-5 h-5 ml-1" />
                </button>
                <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/50">
                  <button 
                    onClick={() => handleTabSwitch('preview')}
                    className={clsx("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'preview' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200")}
                  >
                    المعاينة
                  </button>
                   <button 
                    onClick={() => handleTabSwitch('cloud')}
                    className={clsx("px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5", activeTab === 'cloud' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200")}
                  >
                    {userPlan !== 'elite' && <Lock className="w-3.5 h-3.5 text-gold-500" />}
                    السحابة (Cloud)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {activeTab === 'preview' && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPreviewRefreshKey(prev => prev + 1)} 
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                      title="تحديث الصفحة"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/50 ltr">
                      <button onClick={() => setDeviceSize('mobile')} className={clsx("p-1.5 rounded-md transition-colors", deviceSize === 'mobile' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                        <Smartphone className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeviceSize('tablet')} className={clsx("p-1.5 rounded-md transition-colors", deviceSize === 'tablet' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                        <Tablet className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeviceSize('desktop')} className={clsx("p-1.5 rounded-md transition-colors", deviceSize === 'desktop' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                        <Monitor className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleDownload}
                  disabled={!currentCode && userPlan !== 'free'}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="تنزيل الملف"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">تنزيل</span>
                </button>
              </div>
            </header>

            {/* Restoration Points Dropdown */}
            {codeVersions.length > 0 && (
              <div className="h-12 border-b border-zinc-800/50 flex items-center px-4 bg-zinc-900/40 shrink-0 gap-3 relative">
                <div className="relative">
                  <button 
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border shadow-sm",
                      isHistoryOpen 
                        ? "bg-gold-500 text-zinc-950 border-gold-400" 
                        : "bg-zinc-800/50 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800"
                    )}
                  >
                    <History className="w-4 h-4" />
                    <span>نقاط الاستعادة ({codeVersions.length})</span>
                    <ChevronRight className={clsx("w-4 h-4 transition-transform", isHistoryOpen ? "rotate-90" : "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isHistoryOpen && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[60]"
                          onClick={() => setIsHistoryOpen(false)}
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full mt-2 right-0 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[70] overflow-hidden backdrop-blur-xl"
                        >
                          <div className="p-3 border-b border-zinc-800 bg-zinc-800/20">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">تاريخ التحديثات</span>
                          </div>
                          <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {codeVersions.map((v, idx) => {
                              const isActive = (historyIndex === idx) || (historyIndex === -1 && idx === codeVersions.length - 1);
                              return (
                                <button 
                                  key={v.id} 
                                  onClick={() => {
                                    handleRestorePoint(idx);
                                    setIsHistoryOpen(false);
                                  }}
                                  className={clsx(
                                    "w-full flex items-center justify-between px-4 py-3 transition-colors text-right relative group",
                                    isActive ? "bg-gold-500/10 text-gold-500" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                                  )}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-sm flex items-center gap-2">
                                      {isActive && <CheckCircle2 className="w-4 h-4" />}
                                      تعديل #{idx + 1}
                                    </span>
                                    <span className="text-[10px] opacity-60 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {v.timestamp.toLocaleString('ar-SA', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        hour: 'numeric', 
                                        minute: 'numeric',
                                        hour12: true 
                                      })}
                                    </span>
                                  </div>
                                  {!isActive && (
                                    <RotateCcw className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </button>
                              );
                            }).reverse()}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                
                {historyIndex !== -1 && historyIndex !== codeVersions.length - 1 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-xs font-bold text-amber-500">أنت تستعرض نسخة قديمة</span>
                    <button 
                      onClick={() => setHistoryIndex(-1)}
                      className="text-[10px] bg-amber-500 text-zinc-950 px-2 py-0.5 rounded font-bold hover:bg-amber-400"
                    >
                      العودة للأحدث
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4">
              {!currentCode ? (
                <div className="text-center text-zinc-500 flex flex-col items-center">
                  <Code className="w-12 h-12 mb-4 opacity-20" />
                  <p>اطلب من ماهر صناعة واجهة ليتم عرضها هنا</p>
                </div>
              ) : activeTab === 'cloud' ? (
                <div className="w-full h-full overflow-auto bg-zinc-950 rounded-xl border border-zinc-800/50 p-6 shadow-2xl custom-scrollbar flex flex-col relative">
                  <button 
                    onClick={handleCloudBack}
                    className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all flex items-center gap-2 text-xs z-20"
                  >
                    <ArrowRight className="w-4 h-4 ml-2" />
                    <span>{cloudStatus === 'idle' ? 'العودة للمعاينة' : 'العودة للسحابة'}</span>
                  </button>
                  
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <div className="max-w-md w-full text-center space-y-8">
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className={clsx(
                          "absolute -inset-4 blur-xl rounded-full transition-colors duration-1000",
                          cloudStatus === 'connected' ? "bg-green-500/20" : cloudStatus.includes('provisioning') ? "bg-gold-500/20 animate-pulse" : "bg-gold-500/20"
                        )}></div>
                        {cloudStatus === 'connected' ? (
                          <CheckCircle2 className="w-20 h-20 text-green-500 relative" />
                        ) : cloudStatus.includes('provisioning') ? (
                          <RefreshCw className="w-20 h-20 text-gold-500 relative animate-spin" />
                        ) : (
                          <Cloud className="w-20 h-20 text-gold-500 relative" />
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-white">
                        {cloudStatus === 'connected' 
                          ? (connectedService === 'firebase' ? 'تم ربط Maher App Maker بـ Firebase!' : 'تم النشر على Google Cloud (Maher Core) بنجاح!') 
                          : cloudStatus.includes('provisioning') ? 'جاري تهيئة بيئة Maher App Maker...' : 'ربط المشروع بالسحابة'}
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {cloudStatus === 'connected' 
                          ? (connectedService === 'firebase' 
                              ? 'مشروع "Maher App Maker" مرتبط الآن ببيئة Firebase السحابية في الولايات المتحدة لضمان أسرع أداء.' 
                              : 'تم نشر مشروعك على خوادم "Maher Core" في Google Cloud بنجاح. الربط مع Firebase مفعل بالكامل.') 
                          : cloudStatus === 'provisioning-firebase' 
                          ? `جاري إنشاء قاعدة بيانات لـ Maher App Maker...`
                          : cloudStatus === 'provisioning-gcloud'
                          ? `جاري ربط Maher App Maker بسيرفرات Google Cloud الأمريكية...`
                          : 'قم بربط مشروعك بـ Google Cloud أو Firebase عبر سيرفرات النخبة من "ماهر" للحصول على استضافة احترافية.'}
                      </p>
                    </div>

                    {cloudStatus === 'idle' && (
                      <div className="grid grid-cols-1 gap-4">
                        <button 
                          onClick={() => handleStartProvisioning('firebase')}
                          className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-gold-500/50 hover:bg-zinc-800/80 transition-all group text-right"
                        >
                          <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                            <Database className="w-6 h-6 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-white text-sm">الاتصال بـ Firebase</h4>
                            <p className="text-zinc-500 text-sm mt-1.5">بناء قاعدة بيانات Firestore باستخدام إيميلك: {auth.currentUser?.email}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-gold-500 transition-colors" />
                        </button>

                        <button 
                          onClick={() => handleStartProvisioning('gcloud')}
                          className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-gold-500/50 hover:bg-zinc-800/80 transition-all group text-right"
                        >
                          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                            <Globe className="w-6 h-6 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-white text-sm">نشر على Google Cloud (سيرفرات أمريكية)</h4>
                            <p className="text-zinc-500 text-sm mt-1.5">نشر الموقع فوراً عبر Cloud Run في الولايات المتحدة للحصول على أفضل أداء عالمي.</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-gold-500 transition-colors" />
                        </button>
                      </div>
                    )}

                    {cloudStatus === 'connected' && (
                      <div className="grid grid-cols-1 gap-4">
                        <div className={clsx(
                          "p-4 bg-zinc-900 border rounded-2xl text-right transition-all",
                          connectedService === 'firebase' ? "border-orange-500/30" : "border-blue-500/30"
                        )}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {connectedService === 'firebase' ? (
                                <>
                                  <Database className="w-4 h-4 text-orange-500" />
                                  <span className="text-xs font-bold text-white">بيانات المشروع (Firebase)</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-bold text-white">بيانات النشر (Google Cloud)</span>
                                </>
                              )}
                            </div>
                            <div className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] rounded-full border border-green-500/20">نشط</div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                              <span className="text-[10px] text-zinc-500 uppercase font-mono">{connectedService === 'firebase' ? 'Project ID' : 'Site URL'}</span>
                              <div className="flex items-center gap-2 max-w-[70%]">
                                <span className="text-[10px] text-zinc-300 font-mono truncate">
                                  {connectedService === 'firebase' 
                                    ? `${projectTitle.toLowerCase().replace(/\s+/g, '-') || 'maher-app'}-${currentChatId?.substring(0, 4)}` 
                                    : `https://maherappmaker-498083310216.us-central1.run.app`}
                                </span>
                                <Copy className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer shrink-0" />
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const projectId = 'maherappmaker-498083310216';
                                if (connectedService === 'firebase') {
                                  window.open(`https://console.firebase.google.com/project/${projectId}`, '_blank');
                                } else {
                                  window.open(`https://console.cloud.google.com/run?project=${projectId}`, '_blank');
                                }
                              }}
                              className={clsx(
                                "w-full py-2 text-zinc-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-2",
                                connectedService === 'firebase' ? "bg-zinc-800 hover:bg-zinc-700" : "bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20"
                              )}
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{connectedService === 'firebase' ? 'فتح لوحة تحكم Firebase' : 'إدارة النشر على Google Cloud'}</span>
                            </button>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setCloudStatus('idle');
                            setConnectedService(null);
                          }}
                          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline"
                        >
                          إلغاء الربط والبدء من جديد
                        </button>
                      </div>
                    )}

                    <div className="pt-6 border-t border-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>اتصال آمن ومحمي</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
                <div 
                  className={clsx(
                    "h-full rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-white transition-all duration-300 ease-in-out relative",
                    deviceSize === 'desktop' ? "w-full" : deviceSize === 'tablet' ? "w-[768px]" : "w-[375px]"
                  )}
                >
                  <div className="h-6 bg-zinc-300 w-full flex items-center px-3 gap-1.5 absolute top-0 z-10 hidden">
                     {/* Decorative MacOS dots could go here */}
                  </div>
                  <iframe 
                    key={previewRefreshKey}
                    title="preview"
                    srcDoc={injectedPreviewCode}
                    sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
                    className="w-full h-full border-none bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setShowUpgradeModal(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg relative z-10 p-6 md:p-8 flex flex-col items-center text-center shadow-2xl"
             >
               <button 
                  onClick={() => setShowUpgradeModal(false)}
                  className="absolute top-4 left-4 p-2 text-zinc-500 hover:text-white bg-zinc-800/50 rounded-full"
               >
                 <X className="w-4 h-4" />
               </button>
               
               <div className="w-16 h-16 bg-gold-500/10 text-gold-500 rounded-2xl flex items-center justify-center mb-6">
                 <Crown className="w-8 h-8" />
               </div>
               
               <h3 className="text-2xl font-bold text-white mb-2">
                 تجاوزت الحد اليومي
               </h3>
               <p className="text-zinc-400 mb-8 max-w-sm">
                 {userPlan === 'pro' 
                   ? 'لقد استهلكت رصيدك اليومي لباقة المحترف (50 رسالة). قم بالترقية لباقة النخبة للحصول على استخدام غير محدود أو انتظر حتى يكتمل دورة الـ 24 ساعة.'
                   : 'لقد استهلكت رصيدك اليومي المجاني (3 رسائل). اشترك في باقة المحترف أو النخبة للحصول على رصيد أكبر ومميزات احترافية!'}
               </p>
               
               <div className="w-full space-y-3">
                 <button className="w-full py-4 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors">
                   {userPlan === 'pro' ? 'الترقية لباقة النخبة (200 ريال/شهرياً)' : 'الترقية لباقة المحترف (100 ريال/شهرياً)'}
                 </button>
                 <button onClick={() => setShowUpgradeModal(false)} className="w-full py-4 rounded-xl font-medium text-zinc-400 hover:text-white transition-colors">
                   {userPlan === 'pro' ? 'إلغاء المتابعة بباقة المحترف' : 'إلغاء المتابعة بالباقة المجانية'}
                 </button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Naming Modal */}
      <AnimatePresence>
        {showNamingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto mb-6 overflow-hidden border border-zinc-800">
                <img src="/AppIcon~ios-marketing.png" alt="Maher" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">ماذا تريد تسمية مشروعك؟</h3>
              <p className="text-zinc-400 text-sm mb-6">سيتم استخدام هذا الاسم في الحفظ والربط والنشر السحابي</p>
              
              <input 
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="مثال: تطبيق توصيل الطلبات"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-gold-500 outline-none transition-all mb-4 text-right"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && projectTitle.trim() && confirmNewProject()}
              />
              
              <div className="flex gap-3">
                <button 
                  onClick={confirmNewProject}
                  disabled={!projectTitle.trim()}
                  className="flex-1 py-3 bg-gold-500 hover:bg-gold-600 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ابدأ الآن
                </button>
                <button 
                  onClick={() => setShowNamingModal(false)}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showAdminDashboard && (
        <AdminDashboard 
          user={user} 
          onClose={() => setShowAdminDashboard(false)} 
          onSelectChat={(chatId) => setCurrentChatId(chatId)} 
        />
      )}

      {/* Chat Delete Confirmation Modal */}
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative rtl"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">حذف المحادثة</h3>
                <p className="text-zinc-400 text-sm mb-6">هل أنت متأكد من رغبتك في حذف هذه المحادثة؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setChatToDelete(null)}
                    className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={() => confirmDeleteChat(chatToDelete)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors border border-red-500/50"
                  >
                    نعم، احذف
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
