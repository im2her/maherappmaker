import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { User, sendEmailVerification, reload } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, safeAddDoc } from '../lib/firebase';
import { processRequest } from '../lib/engine';
import { requestNotificationPermission, sendNotification, sendAdminNotification } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Plus, LogOut, Code, Sparkles, Send, Paperclip, Menu, X, User as UserIcon, Monitor, Tablet, Smartphone, Download, RotateCcw, Play, ArrowRight, Lock, Crown, Settings, MousePointerClick, Cloud, Database, Globe, Server, CheckCircle2, Check, ChevronRight, Copy, ExternalLink, RefreshCw, Mail, History, Clock, Pin, Trash2, Folder, FileCode, ArrowDown, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import JSZip from 'jszip';
import { AdminDashboard } from './AdminDashboard';
import { Documentation } from './Documentation';
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
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
      onMouseLeave={() => { setShowActions(false); setIsConfirmingDelete(false); }}
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

      {(showActions || isActive || isConfirmingDelete) && (
        <div className={clsx(
          "absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-all bg-zinc-900/90 backdrop-blur-sm rounded-lg p-0.5 border border-zinc-800 shadow-xl",
          (showActions || isConfirmingDelete) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto"
        )}>
          {!isConfirmingDelete ? (
            <>
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
                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title="حذف المحادثة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 px-1 py-0.5">
              <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1 font-bold">تأكيد؟</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); onDelete(e); }} 
                className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/30" 
                title="نعم، احذف"
              >
                <Check className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} 
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700/50" 
                title="إلغاء"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
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
  onUndo?: (messageId: string) => void;
  canUndo?: boolean;
}

const MessageItem = memo(function MessageItem({ 
  message, 
  idx, 
  visibleCount, 
  messagesLength, 
  agentType, 
  handleSendMessage,
  isLoading,
  onUndo,
  canUndo
}: MessageItemProps) {
  let cleanContent = message.content;
  let suggestions: string[] = [];
  
  if (message.role === 'model') {
    cleanContent = message.content.replace(/\[SUGGESTION\]\s*(.*?)(?=\n|$)/gi, (match, p1) => {
      if (p1.trim()) suggestions.push(p1.trim());
      return '';
    }).trim();

    if (agentType === 'مصنع التطبيقات') {
      cleanContent = cleanContent.replace(/```(?:html|tsx|jsx)\n([\s\S]*?)```/g, '\n```html-hidden\n[تم تحديث واجهة المستخدم]\n```\n');
    } else if (agentType === 'ماهر العام') {
      cleanContent = cleanContent.replace(/```(?:html|tsx|jsx)\n([\s\S]*?)```/g, '\n```html-hidden\n[تم حجب الكود]\n```\n');
    }
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
                    if (match[1] === 'html-hidden' || (agentType === "مصنع التطبيقات" && match[1] === 'html') || agentType === "ماهر العام") {
                      return (
                        <div className="ltr text-sm font-inter mt-2 mb-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-gold-500" />
                            <span className="text-zinc-400 font-medium">
                              {agentType === "ماهر العام" ? "تم حجب الكود" : "تم تحديث واجهة المستخدم"}
                            </span>
                          </div>
                          {onUndo && canUndo && agentType === 'مصنع التطبيقات' && (
                            <button
                              onClick={() => {
                                if (onUndo) onUndo(message.id);
                              }}
                              className="text-xs px-3 py-1.5 flex items-center gap-1.5 bg-zinc-800 hover:bg-gold-500/20 hover:text-gold-400 text-zinc-300 rounded transition-colors flex-shrink-0 rtl border border-zinc-700 hover:border-gold-500/30"
                              title="استعادة هذه النسخة وتطبيقها"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              استعادة هذه النسخة
                            </button>
                          )}
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
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-800/20 rtl" id={`suggestions-${message.id}`}>
              {suggestions.slice(0, 2).map((sg, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(197, 160, 89, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(sg)}
                  disabled={isLoading}
                  className="text-sm font-medium px-5 py-3 bg-zinc-900/50 border border-gold-500/20 text-gold-200 hover:text-gold-500 hover:border-gold-500 rounded-2xl transition-all text-right max-w-full backdrop-blur-sm shadow-sm flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-gold-500" />
                  {sg}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  );
});

const LoadingIndicator = ({ agentType }: { agentType?: string }) => {
  const [textIdx, setTextIdx] = useState(0);
  const loadingTexts = useMemo(() => {
    if (agentType === 'ماهر العام') {
      return [
        "أبشر، جاري البحث عن أحسن إجابة تبرد كبدك 🔍",
        "يا بعدي، العلم الحين يوصلك بارد مبرد 🧊",
        "نحلل العلم ونجهز لك الرد السنع 📊",
        "لحظات يا بعدي، العلم عندي وبضبطه لك ⏳",
        "ماهر يزهب رده، الأكيد إنه بيعجبك 💡",
        "نسخّر الذكاء الاصطناعي لخدمة ربعنا 🤖",
        "أبشر الحين يجهز الرد اللي يبيض الوجه ✨",
        "هانت يا الزميل، ماهر قاعد يلقط لك أحسن الهرج 📝",
        "الوعد قدام، العلم الحين يخلص 🐎",
        "ماهر يضبط الفناجيل ويجهز العلم ☕",
        "مير اصبر علي شوي، العلم يبي له ركادة 🧘",
        "يا بعد حيي، العلم قيد الإنشاء والأكيد إنه زين 🛠️",
        "أبشر بالخير، العلم الحين يستوي على الجمر 🔥",
        "ماهر يقرأ اللي بخاطرك ويحطه في قالب سنع 🎨",
        "يا هلا ومسهلا، جاري تدشين أحسن رد لك 🚩",
        "أبشر، جاري البحث عن أدق التفاصيل 🔍",
        "تزهب يا الزميل، الرد الحين يقدح من راسي ⚡",
        "الوعد بالرد اللي يثلج الصدر، مير اصبر ❄️",
        "ماهر يضبط الوزنية ويجهز لك العلم وكاد ⚖️",
        "يا الزميل، العلم يبي له شوية تفكير، هانت 🧠",
        "أبشر، العلم الحين ينطبخ على نار هادية 🍲",
        "الوعد الحين يوصلك أحسن الهرج لك ✨",
        "ماهر يجمع علومه ويجهز لك الرد الجزل 📚",
        "يا بعدي، الرد الحين يزهب ويكون في خاطرك 🌙",
        "الأكيد، جاري تلميع الإجابة لتكون كفو 💎",
        "أبشر، ماهر يضبط لك العلم تضبيط 🛠️",
        "يا الزميل، الرد الحين يسري له علم 🐎",
        "جاري تجهيز أحسن العلوم الفنية 💡",
        "أبشر، العلم الحين يخلص ويسرك 🌟",
        "يا بعدي، جاري تحضير الرد بكل رقي 🎩",
        "الأكيد، العلم الحين يكتب بمداد الفهم 🖋️",
        "أبشر، جاري تصفية العلوم لتناسب مقامك 🌊",
        "يا الزميل، هانت والرد الحين يشرق نوره 🌅",
        "جاري بناء الرد على أسس متينة 🏗️",
        "أبشر، ماهر يجمع لك زبدة الهرج 🥛",
        "يا بعدي، جاري صياغة الفائدة في قالب إبداعي 💠",
        "الأكيد، العلم الحين يركد ويطلع أحسن ما فيه 💎",
        "أبشر، جاري تروية عطش سؤالك بإجابة وافية 🥤",
        "يا الزميل، الرد الحين يعانق السحاب ☁️",
        "جاري تزيين العلم بحلي من المنطق 🎀",
        "أبشر، جاري نسج الرد بخيوط من الحكمة 🧵",
        "يا بعدي، العلم الحين يبرق وبرقه يسر ⚡",
        "الأكيد، جاري تحضير القدوع والرد السنع ☕",
        "أبشر، ماهر يضبط لك الموجة لتكون واضحة 📻",
        "يا الزميل، جاري غرس العلم في تربة الإفهام 🌱",
        "جاري حصد النتائج لتكون بين يديك 🌾",
        "أبشر، العلم الحين يطير بجناحين من نور 🕊️",
        "يا بعدي، جاري تحويل الأفكار إلى واقع ملموس 🤝",
        "الأكيد، جاري صيد اللآلئ من بحر المعرفة 🐚",
        "أبشر، الرد الحين ينبت زهوراً من الفهم 🌹"
      ];
    }
    return [
      "أبشر بسعدك.. ماهر يقرأ أفكارك، وطلبك عندي! 🧠",
      "سم، جاري تحضير دلة الكود لبدء الشغل ☕",
      "الأكواد تتجمع لتصنع شي يرفع الرأس 🚀",
      "ماهر يصيغ السحر في سطور برمجية سنعة 🪄",
      "جاري هندسة التطبيق ليكون واجهة تبيض الوجه 🏗️",
      "نراجع التصاميم ونختار الألوان اللي تفتح النفس 🎨",
      "لحظات يا الزميل وتكتمل التحفة الفنية ⏳",
      "نحط اللمسات الجمالية اللي ما تخيب الظن ✨",
      "تطبيقك يزهب ليرى النور، أبشر بالخير 🌟",
      "جاري تحويل الهرج إلى أزرار وشاشات تفتح النفس 📱",
      "الأكيد إن هالفكرة بتكسر الدنيا 🌍",
      "ندور لك أحسن حزمة برمجية تضبط تطبيقك 📦",
      "ماهر يلبس نظاراته للتركيز، العلم جزل 👓",
      "ندمج الإبداع مع المنطق، والشغل نظيف 🧩",
      "نطلع أحسن العلوم من بنك الأفكار 💡",
      "جاري رسم الخرائط وتحديد المسارات السهلة 🗺️",
      "نضبط الأكواد لتكون سريعة كالبرق، قدام ⚡",
      "نتأكد إن كل شي تمام التمام 🎯",
      "نضيف رشة إبداع فوق الأكواد 🧚",
      "نسخّر الذكاء لخدمتك يا بعدي 🤖",
      "نقنص الأخطاء قبل لا تبين 🐛",
      "نرفع الهامات والمستويات للقمة 📈",
      "جاري ضغط الأكواد بذكاء ونباهة 🗜️",
      "نبني الواجهات لكل الشاشات، العلم واسع 💻",
      "تجهيز الدواوين (قواعد البيانات) لأحلامك 🗄️",
      "نكتب التاريخ.. وتطبيق يبيض الوجه 📜",
      "لحظات ويصير الخيال حقيقة ملموسة 🤝",
      "نجهز خيولنا السحابية لاستضافة إبداعك ☁️",
      "ماهر يطلب كبسة ليواصل الشغل بنشاط 🍚",
      "نعطي الأكواد لمسة كشخة وأناقة 🎩",
      "جاري استدعاء أفضل العلوم من سباتها 🐉",
      "نهندس تجربة مستخدم ما تنتسي 🎭",
      "كل سطر ينكتب بقلب حاضر 🛡️",
      "نطوي المسافات لننجز بأسرع وقت ⏱️",
      "نحاكي ملايين الأطراف لنضمن نجاحك 👥",
      "القهوة تخلص، والشغل يزود حلاه ☕",
      "جاري إضافة الحركات اللي تفتح العين 🎬",
      "نضبط الدقة في كل زاوية وضلع 📐",
      "ماهر شاد حيله، أبشر بالعز 🦅",
      "نغوص في بحر الأكواد ونجيب لك المحار 🌊",
      "نجهز منصة الإطراق للغاليين 🛫",
      "تطبيقك يا بعدي يحصل على جرعة تميز 💉",
      "نرتب العناصر زينة للناظرين 📸",
      "نجلب لك أجدد العلوم والتقنيات 🛸",
      "نلمع الواجهات لين تبرق صقالة 💎",
      "نحط حجر الأساس لمستقبلك الزاهر 🧱",
      "التوليفة السحرية في القدر تغلي 🧪",
      "ماهر يحسبها بالملي لتطبيق يبيض الوجه 🧮",
      "جاري تجميع القطع بدقة الصايغ 🔧",
      "نحط الشغف في كل زر نبرمجه 🔥",
      "الوقت يجري والأكواد تتدفق كنها سيل ⌚",
      "بسم الله، الشغل الحين يخلص 🤲",
      "يا الزميل هانت، مير الصبر طيب 🐎",
      "نضبط الشغل لين يقول بس 🎯",
      "أبشر، جاري بناء الجسور البرمجية 🌉",
      "سم، الكود الحين يتنظم مثل الصفوف 🏰",
      "نضبط التنسيق لين يصير زاهي 🌈",
      "يا الزميل، جاري فحص الرقاب (الأكواد) 🕵️",
      "نحط بصمة التميز في كل زاوية 🏺",
      "سم، جاري تجهيز الخلطة السرية للبرمجة 🧪",
      "الأكيد إن شغلك الحين يطلع جزل 💎",
      "نضبط الربط بين الأجزاء، كنه حلقة وصل 🔗",
      "يا بعد حيي، الكود الحين يسري فيه الروح ✨",
      "نحمل شعلة الإبداع وننور لك التطبيق 🕯️",
      "سم، جاري ترتيب الديكورات البرمجية 🛋️",
      "أبشر، العلم الحين يستوي على الجمر 🔥",
      "نجهز لك تطبيق يفتح النفس ويسر الخاطر 🌸",
      "يا الزميل، جاري صقل الأكواد لتكون لامعة 🌟",
      "سم، نضبط الإطارات البرمجية بحرفية 🖼️",
      "أبشر، جاري ترويض الخوارزميات الصعبة 🐎",
      "نحط لك في كل سطر حكمة وفن 🎨",
      "يا بعدي، جاري الربط مع السحاب بحب ☁️",
      "على أمرك، جاري تزيين الواجهات بأحلى حلة 👗",
      "أبشر، الكود الحين ينكتب بماء الذهب ✍️",
      "نضبط الأداء ليكون كفو في كل الظروف 🛡️",
      "يا الزميل، جاري تحضير الوليمة البرمجية 🍽️",
      "على أمرك، جاري تنسيق الخطوط والألوان بذوق ✒️",
      "أبشر، العلم الحين يخلص ويكون قدوع ☕",
      "نحط اللمسات اللي تخلي تطبيقك استثنائي 🎖️",
      "يا بعدي، جاري فحص كل شاردة وواردة 🔍",
      "على أمرك، جاري عجن الأكواد لتكون لينة وسهلة 🥣",
      "أبشر، جاري بناء القواعد المتينة لمشروعك 🧱",
      "نضبط التفاعل لين يكون سلس كنه ماء 💧",
      "يا الزميل، جاري شحن البطاريات البرمجية 🔋",
      "على أمرك، جاري تفتيح آفاق جديدة في تطبيقك 🌅",
      "أبشر، الكود الحين يرقص طرب من حلاه 💃",
      "نحط في تطبيقك روح الابتكار والجمال 🕊️",
      "يا بعدي، جاري غزل الأكواد بخيوط من نور 🧵",
      "على أمرك، جاري تروية عطش تطبيقك للتميز 🥤",
      "أبشر، العلم الحين ينبت ثمار برمجية 🍏",
      "نضبط السرعة لتكون كأنها البرق الخاطف 🌩️",
      "يا الزميل، جاري حياكة الواجهات بدقة 🧶",
      "على أمرك، جاري تعطير الأكواد بلمسات إبداعية 🌸",
      "أبشر، جاري بناء صرح تقني يشار له بالبنان 🏛️",
      "نحط لك في كل زر قصة نجاح 📖",
      "يا بعد حيي، جاري إيقاظ مارد البرمجة لخدمتك 🧞",
      "على أمرك، جاري تحويل الأحلام إلى كود ملموس 💭",
      "أبشر، العلم الحين يبرق وبرقه يسر ⚡",
      "نضبط التوازن البرمجي ليكون ممتاز ⚖️",
      "يا الزميل، جاري صيد الأخطاء بشبكة ذكية 🕸️",
      "على أمرك، جاري تنقية الأكواد من كل الشوائب 🌊",
      "أبشر، العلم الحين يسرق الأنظار بجماله 😍",
      "نحط لك في تطبيقك بصمة ما تتنسى 👣",
      "يا بعدي، جاري تلوين تطبيقك بألوان الفرح 🎨",
      "على أمرك، جاري هندسة الابتسامة في كل واجهة 😊",
      "أبشر، الكود الحين يتنفس هواء النجاح 🌬️",
      "نضبط الاتصال ليكون وثيق وقوي 🧱",
      "يا الزميل، جاري غرس بذور الإبداع في كودك 🌱",
      "على أمرك، جاري حصاد أحسن النتائج لمشروعك 🌾",
      "أبشر، العلم الحين يطير بجناحين من نور 🕊️",
      "نحط لك في تطبيقك لمسة من المستقبل 🚀",
      "يا بعد حيي، جاري إشعال فتيل العبقرية التقنية 🧨",
      "على أمرك، جاري تدريب الأكواد لتكون ذكية ولبقة 🧠",
      "أبشر، العلم الحين ينساب كنه شلال 🌊",
      "نضبط العمق البرمجي ليكون له أثر ⚓",
      "يا الزميل، جاري فتح بوابات النجاح لتطبيقك 🔓",
      "على أمرك، جاري رسم ملامح العظمة في مشروعك 🗿",
      "أبشر، الكود الحين يتجلى في أبهى صورة 💎",
      "نحط لك في الواجهة فنون تخطف الألباب 🎭",
      "يا بعدي، جاري نسج خيوط المستقبل في كودك 🛰️",
      "على أمرك، جاري ترويض التقنيات الحديثة لرضاك 🦁",
      "أبشر، العلم الحين يزهو بوشاح التميز 🏅",
      "نضبط الإيقاع البرمجي ليكون منسجم 🎵",
      "يا الزميل، جاري استخراج لآلئ الكود من الأعماق 🐚",
      "على أمرك، جاري تزيين تطبيقك بجواهر الابتكار 💍",
      "أبشر، الكود الحين يشرق كنه شمس الضحى ☀️",
      "نحط لك في كل سطر سحر من نوع خاص ✨",
      "يا بعد حيي، جاري إرساء قواعد المجد لتطبيقك 🏗️",
      "على أمرك، جاري تحليق تطبيقك في سماء الإبداع 🦅",
      "أبشر، العلم الحين يسري في عروق التكنولوجيا 🩸",
      "نضبط البوصلة البرمجية نحو القمة 🧭",
      "يا الزميل، جاري زراعة ورود الجمال في واجهاتك 🌹",
      "على أمرك، جاري سكب الإبداع في قوالب تقنية 🏺",
      "أبشر، الكود الحين ينبض بالحياة والنشاط 💓",
      "نحط لك في تطبيقك مفتاح كل الأبواب 🔑",
      "يا بعدي، جاري رسم لوحة فنية بأدوات برمجية 🖌️",
      "على أمرك، جاري تطويع الأرقام لتصنع العجب 🔢",
      "أبشر، العلم الحين يرتدي حلة النجاح البهية 👔",
      "نضبط الزوايا لتكون حادة ودقيقة 🎯",
      "يا الزميل، جاري استضافة أحسن الأفكار في كودك 🏠",
      "على أمرك، جاري إطلاق سراح المارد البرمجي لتحقيق حلمك 🧞‍♂️",
      "أبشر، العلم الحين يسطع نوره في كل مكان 💡",
      "نحط لك في تطبيقك روح المغامرة والنجاح 🧗",
      "على أمرك، جاري فك شيفرات الصعاب بكل مهارة 🔓",
      "أبشر، العلم الحين يرتوي من نبع المعرفة ⛲",
      "يا بعدي، جاري ترويض سطور البرمجة لتكون طوع أمرك 🐅",
      "على أمرك، جاري بناء عالمك التقني بكل حب وشغف ❤️",
      "أبشر، الكود الحين ينمو ويزدهر كنه بستان زاهر 🌳",
      "نضبط الدقة لتصل لمستوى العالمية 🌍",
      "يا الزميل، جاري حماية كودك بأمتن الدروع 🛡️",
      "على أمرك، جاري صقل الواجهة لتلمع كالنجم القطبي ⭐",
      "أبشر، العلم الحين يفيض بلمسات الرقي والجمال 💎",
      "نحط لك في كل واجهة لمحة من الإبداع الخالد 🎨",
      "يا بعد حيي، جاري ربط الخيوط البرمجية بإتقان الصايغ 🧵",
      "على أمرك، جاري تحويل كل تحدي إلى فرصة نجاح باهرة 🥇",
      "أبشر، الكود الحين يتناغم مع أحلامك الكبيرة 🌈",
      "نضبط التنسيق ليكون متناسق كعقد من اللؤلؤ 📿",
      "يا الزميل، جاري استكشاف آفاق جديدة لمشروعك 🔭",
      "على أمرك، جاري تزيين التطبيق بأبهى الألوان والظلال 🖌️",
      "أبشر، العلم الحين ينساب بكل سلاسة ويسر 💧",
      "نحط لك في تطبيقك سر التميز والنجاح الدائم 🗝️",
      "يا بعدي، جاري تلميع كل سطر برمجي ليكون واضحاً 💡",
      "على أمرك، جاري بناء تطبيقك ليكون منارة للتكنولوجيا 🗼",
      "أبشر، الكود الحين يرقص فرحاً بقرب الاكتمال ✨",
      "نضبط الأداء ليكون سريعاً كالبرق في كبد السماء ⚡",
      "يا الزميل، جاري وضع اللمسات النهائية التي تذهل العقول 🎭",
      "على أمرك، جاري تحضير تطبيقك ليكون رفيق نجاحك الدائم 🤝"
    ];
  }, [agentType]);

  useEffect(() => {
    // Pick a random starting point
    const setRandomText = () => {
      setTextIdx(prev => {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * loadingTexts.length);
        } while (nextIdx === prev && loadingTexts.length > 1);
        return nextIdx;
      });
    };

    setRandomText();
    const interval = setInterval(setRandomText, 4500);
    return () => clearInterval(interval);
  }, [loadingTexts]);

  return (
    <div className="flex w-full justify-start mt-2 mb-4">
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-lg">
        <div className="flex items-center gap-1.5 direction-ltr">
          <div className="w-2 h-2 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.span 
            key={textIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-gold-400 text-sm font-medium tracking-wide"
          >
            {loadingTexts[textIdx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};

const ChatInput = React.memo(function ChatInput({ 
  isLoading, 
  isExceeded, 
  cooldown, 
  onSendMessage, 
  onStop,
  agentType,
  attachedImages,
  setAttachedImages,
  handleFileSelect,
  isSelectionModeActive,
  setIsSelectionModeActive,
  selectedSelectors,
  setSelectedSelectors,
  activeTab,
  setActiveTab,
  handleDrop,
  handleDragOver,
  setShowUpgradeModal,
  currentChatId,
  setIsMobilePreviewOpen
}: {
  isLoading: boolean;
  isExceeded: boolean;
  cooldown: number;
  onSendMessage: (text: string) => void;
  onStop: () => void;
  agentType: string;
  attachedImages: string[];
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isSelectionModeActive: boolean;
  setIsSelectionModeActive: (val: boolean) => void;
  selectedSelectors: string[];
  setSelectedSelectors: React.Dispatch<React.SetStateAction<string[]>>;
  activeTab: string;
  setActiveTab: (val: any) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  setShowUpgradeModal: (val: boolean) => void;
  currentChatId: string | null;
  setIsMobilePreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
    // Default textarea behavior will insert a new line on 'Enter'.
  };

  const handleSendRequest = () => {
    if (isLoading) {
      onStop();
      return;
    }
    if (isExceeded && agentType !== 'ماهر العام') {
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
        {selectedSelectors.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex flex-col gap-2 mb-2 p-2 bg-gold-500/10 border border-gold-500/30 rounded-lg text-xs"
          >
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-3.5 h-3.5 text-gold-500 shrink-0" />
              <span className="text-gold-500 font-medium">تم تحديد {selectedSelectors.length} عنصر</span>
              <button 
                onClick={() => setSelectedSelectors([])}
                className="mr-auto p-1 hover:bg-gold-500/20 rounded text-gold-500 transition-colors"
                title="إزالة جميع التحديدات"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="max-h-24 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
              {selectedSelectors.map((selector, i) => (
                <div key={i} className="flex flex-row-reverse items-center gap-2 text-right">
                  <span className="font-mono opacity-80 text-gold-500/80 truncate flex-1 block" dir="ltr">{selector}</span>
                  <button 
                    onClick={() => setSelectedSelectors(prev => prev.filter(s => s !== selector))}
                    className="p-1 hover:bg-gold-500/20 rounded text-gold-500 transition-colors shrink-0"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
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
                  const nextState = !isSelectionModeActive;
                  setIsSelectionModeActive(nextState);
                  if (nextState && setIsMobilePreviewOpen) setIsMobilePreviewOpen(true);
                  setSelectedSelectors([]);
                }}
                className={clsx(
                  "p-2.5 transition-colors rounded-xl flex items-center gap-1.5",
                  isSelectionModeActive ? "bg-gold-500/20 text-gold-500" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                )}
                title="تعديل يدوي (تحديد عنصر)"
              >
                <MousePointerClick className="w-5 h-5" />
                {selectedSelectors.length > 0 && <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />}
              </button>
            )}
          </div>
          <button 
            onClick={handleSendRequest}
            disabled={(!inputMessage.trim() && attachedImages.length === 0 && !isExceeded && !isLoading) || cooldown > 0}
            className={clsx(
              "px-4 py-2.5 font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 group shadow-lg active:scale-95 min-w-[80px] justify-center",
              isLoading 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "bg-zinc-100 hover:bg-white text-zinc-950"
            )}
          >
            <span>
              {isLoading ? 'إيقاف' : isExceeded ? 'ترقية' : cooldown > 0 ? `انتظر (${cooldown})` : 'إرسال'}
            </span>
            {isLoading ? (
              <RotateCcw className="w-4 h-4 animate-spin-reverse" />
            ) : isExceeded ? (
              <Crown className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4 rtl:rotate-180" />
            )}
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
  const [selectedSelectors, setSelectedSelectors] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAttemptedCodeRef = useRef<string | null>(null);

  const handleStopRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const getTimestampDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return null;
  };

  const userPlan = userProfile?.plan || 'free';
  
  // Proactive Daily & Monthly Reset
  useEffect(() => {
    if (!user || !userProfile) return;
    const lastReset = getTimestampDate(userProfile?.lastMessageReset);
    const lastMonthlyReset = getTimestampDate(userProfile?.lastMonthlyReset);
    const now = new Date();
    
    const updates: any = {};
    
    // Daily Reset (24h)
    if (lastReset && (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
      updates.messageCount = 0;
      updates.lastMessageReset = serverTimestamp();
    }
    
    // Monthly Reset (1st of month)
    const isNewMonth = lastMonthlyReset && (
      now.getMonth() !== lastMonthlyReset.getMonth() || 
      now.getFullYear() !== lastMonthlyReset.getFullYear()
    );
    
    if (!lastMonthlyReset || isNewMonth) {
      updates.monthlyMessageCount = 0;
      updates.monthlyTotalMessages = 0; // New field for cost tracking
      updates.lastMonthlyReset = serverTimestamp();
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, updates).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'users'));
    }
  }, [userProfile, user]);

  // Cooldown effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  
  // Builder specific state
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [showNamingModal, setShowNamingModal] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [projectType, setProjectType] = useState<string>('تطبيق آيفون وأندرويد');
  const [activeTab, setActiveTab] = useState<'preview' | 'cloud'>('preview');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'provisioning-firebase' | 'provisioning-gcloud' | 'connected'>('connected');
  const [connectedService, setConnectedService] = useState<'firebase' | 'gcloud' | null>('gcloud');
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means latest
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(user.emailVerified);
  const currentChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  const [verificationSent, setVerificationSent] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  // Auto-detect view mode based on project type
  useEffect(() => {
    if (!projectType) return;
    const lowerType = projectType.toLowerCase();
    if (lowerType.includes('تطبيق') || lowerType.includes('موبايل') || lowerType.includes('آيفون') || lowerType.includes('أندرويد')) {
      setDeviceSize('mobile');
    } else {
      setDeviceSize('desktop');
    }
  }, [projectType]);

  // Request notification permissions
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Admin Broadcast Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'broadcasts'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          sendAdminNotification(data.title || 'تنبيه من ماهر', data.body || '');
        }
      });
    }, (err) => console.error("Broadcast error:", err));
    return () => unsubscribe();
  }, [user]);
  
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
        } catch (err: any) {
          if (err?.code !== 'auth/network-request-failed') {
            console.error("Error reloading user", err);
          }
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
  const [visibleCount, setVisibleCount] = useState(20);
  const [chatLimit, setChatLimit] = useState(30);
  const lastScrollCall = useRef(0);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);

    const now = Date.now();
    if (now - lastScrollCall.current < 200) return;
    lastScrollCall.current = now;

    if (scrollTop === 0) {
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
    setVisibleCount(20);
  }, [currentChatId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      if (prevChatRef.current !== currentChatId) {
        // Prepare for new chat load
        prevChatRef.current = currentChatId;
        prevMessagesLength.current = 0; // Reset length for the new chat
        prevMessagesLimit.current = messagesLimit;
      } else if (messagesLimit > prevMessagesLimit.current) {
         // Data load from scrolling up, don't scroll to bottom
         prevMessagesLength.current = messages.length;
         prevMessagesLimit.current = messagesLimit;
      } else if (messages.length > prevMessagesLength.current) {
        // Decide whether to snap or smooth scroll
        const isInitialLoad = prevMessagesLength.current === 0;
        
        if (isInitialLoad) {
          // Snap to bottom immediately for the first batch of messages
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          prevMessagesLength.current = messages.length;
        } else {
          // Smooth scroll only when NEW messages arrive during conversation
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          const diff = messages.length - prevMessagesLength.current;
          prevMessagesLength.current = messages.length;
          setVisibleCount(prev => prev + diff); 
        }
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
    
    let unsubscribeFallback: (() => void) | null = null;
    let fallbackQ;
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
      if (chatsData.length > 0 && !currentChatIdRef.current) {
        setCurrentChatId(chatsData[0].id);
        setAgentType(chatsData[0].agentName as any);
      }
    }, (error) => {
      // Fallback
      fallbackQ = query(collection(db, 'chats'), where('userId', '==', user.uid));
      unsubscribeFallback = onSnapshot(fallbackQ, (snapshot) => {
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
        if (chatsData.length > 0 && !currentChatIdRef.current) {
          setCurrentChatId(chatsData[0].id);
          setAgentType(chatsData[0].agentName as any);
        }
      });
    });

    return () => {
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
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

  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const handleCreateNewChat = async () => {
    if (isCreatingChat) return;
    setIsCreatingChat(true);
    try {
      const newChatRef = await safeAddDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'محادثة جديدة',
        agentName: agentType,
        updatedAt: serverTimestamp(),
        isPinned: false
      });
      setCurrentChatId(newChatRef.id);
      setMessages([]);
      setHistoryIndex(-1);
      setIsSidebarOpen(false);
      setIsMobilePreviewOpen(false);
      setActiveTab('preview');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    } finally {
      setIsCreatingChat(false);
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

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      // First delete messages subcollection
      const messagesSnap = await getDocs(collection(db, `chats/${chatId}/messages`));
      const messagePromises = messagesSnap.docs.map(m => deleteDoc(m.ref));
      await Promise.all(messagePromises);
      
      // Then delete the chat doc
      await deleteDoc(doc(db, 'chats', chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chats');
    }
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

  const handleSendMessage = useCallback(async (text: string, isAutoFix = false) => {
    if ((!text.trim() && attachedImages.length === 0) || isLoading) return;

    setIsLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const normalizedText = text.toLowerCase();
    
    // خوارزمية ذكية للتحويل التلقائي بين الأنماط لضمان عدم التحايل وضمان أفضل تجربة
    const executionKeywords = ['ابن', 'عدل', 'اضف', 'غير', 'كود', 'برمج', 'صمم', 'سوي', 'أريد تطبيق', 'build', 'create', 'update', 'add', 'fix', 'code', 'make'];
    const discussionKeywords = ['وش رايك', 'كيف', 'اشرح', 'وش هو', 'علمني', 'استشارة', 'وش تنصح', 'خطط', 'فكرة', 'discuss', 'explain', 'suggest', 'what is', 'how to'];

    const isExecutionIntent = executionKeywords.some(k => normalizedText.includes(k));
    const isDiscussionIntent = discussionKeywords.some(k => normalizedText.includes(k));

    let effectiveAgentType = agentType;
    if (isDiscussionIntent && !isExecutionIntent && agentType === 'مصنع التطبيقات') {
      effectiveAgentType = 'ماهر العام';
      setAgentType('ماهر العام');
    } else if (isExecutionIntent && agentType === 'ماهر العام') {
      effectiveAgentType = 'مصنع التطبيقات';
      setAgentType('مصنع التطبيقات');
    }

    const gameKeywords = ['لعبة', 'لعبه', 'game', 'games', 'gaming', 'قمار', 'مراهنة'];
    const isGameRequest = gameKeywords.some(keyword => normalizedText.includes(keyword));
    
    if (isGameRequest && effectiveAgentType === 'مصنع التطبيقات') {
      alert('عذراً، يمنع منعاً باتاً إنشاء أو تعديل الألعاب في منصة ماهر للحفاظ على استقرار النظام.');
      setIsLoading(false);
      return;
    }

    let finalPayload = text;
    
    if (selectedSelectors.length > 0) {
      finalPayload += `\n\n[AIS_METADATA_SECTION_START]\n`;
      selectedSelectors.forEach((sel, i) => {
        finalPayload += `CSS selector ${i + 1}: ${sel}\nCSS ${i + 1}: {\n\n}\n`;
      });
      finalPayload += `[AIS_METADATA_SECTION_END]`;
      setSelectedSelectors([]);
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
      let lastReset = getTimestampDate(userProfile?.lastMessageReset);
      const now = new Date();

      // Check for 24h reset
      if (!lastReset || (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
        dCount = 0;
        lastReset = now;
        await updateDoc(userRef, {
          messageCount: 0,
          lastMessageReset: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      const totalRemaining = (dLimit - dCount) + (mLimit - mCount);

      // تذكير الرصيد المنخفض + دعوة للتقييم/الثناء لجلب مكافأة (فقط للمشتركين)
      const currentUserPlan = userProfile?.plan || 'free';
      if (totalRemaining === 3 && !isAutoFix && effectiveAgentType !== 'ماهر العام' && (currentUserPlan === 'pro' || currentUserPlan === 'elite')) {
        finalPayload += "\n\n[إرشاد مخفي لماهر: رصيد المستخدم وصل لـ 3 رسائل فقط. استطلع رأيه فيك بذكاء؛ إذا كان معجباً بك، شجعه على التعبير عن ذلك، وإذا لم يعجبه الحال، خذها من باب التحدي التقني. تذكر أنك تملك صلاحية منحه 3 نقاط إضافية برصيد حقيقي عبر وسم [GRANT_REWARD_3] لتشجيعه على إكمال مشروعه.]";
      }

      if (effectiveAgentType !== 'ماهر العام' && totalRemaining <= 0 && !isAutoFix) {
        setShowUpgradeModal(true);
        setIsLoading(false);
        return;
      }

      if (!chatId) {
        const newChatRef = await safeAddDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: text ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : 'صورة مرفقة',
          agentName: effectiveAgentType,
          updatedAt: serverTimestamp()
        });
        chatId = newChatRef.id;
        setCurrentChatId(chatId);
      } else {
        const chat = chats.find(c => c.id === chatId);
        const updates: any = {
          updatedAt: serverTimestamp(),
          agentName: effectiveAgentType
        };
        
        if (chat && chat.title === 'محادثة جديدة' && messages.length === 0) {
           updates.title = text ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : 'صورة مرفقة';
        }
        await updateDoc(doc(db, 'chats', chatId), updates);
      }

      await safeAddDoc(collection(db, `chats/${chatId}/messages`), {
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
      
      if (effectiveAgentType === 'مصنع التطبيقات' && currentCode) {
        processingPrompt = `[رسالة تلقائية من النظام: هذا هو الكود الحالي. يجب عليك إضافة التعديلات التي يطلبها المستخدم عليه، وإرجاع الكود بالكامل دون حذف أي شيء قديم ودون اختصار:]\n\`\`\`html\n${currentCode}\n\`\`\`\n\nطلب المستخدم: ${finalPayload}`;
      }

      if (isAutoFix) {
        processingPrompt += `\n\n[إرشادات فنية مخفية للوكيل ماهر: هذا بلاغ عن خطأ برمجي. يرجى فحص الكود الحالي وإصلاح هذا الخطأ بدقة. يجب إرجاع الكود كاملاً بعد الإصلاح. في حال كان الخطأ معقداً ويستحيل إصلاحه برمجياً، قدم حلاً بديلاً أو وجه المستخدم برفق.]`;
      }
      
      const response = await processRequest(processingPrompt, effectiveAgentType, history, 0, abortController.signal);
      
      const hasReward = response.includes('[GRANT_REWARD_3]');
      const cleanResponse = response.replace(/\[DISCUSSION_ONLY\]/g, '').replace(/\[GRANT_REWARD_3\]/g, '').trim();

      await safeAddDoc(collection(db, `chats/${chatId}/messages`), {
        role: 'model',
        content: cleanResponse,
        createdAt: serverTimestamp()
      });

      // Handle Reward (Once every 24 hours) - Only for Pro and Elite users
      const userPlan = userProfile?.plan || 'free';
      if (hasReward && userProfile && (userPlan === 'pro' || userPlan === 'elite')) {
        const lastReward = userProfile.lastRewardAt?.toDate?.() || new Date(0);
        const now = new Date();
        const diffMs = now.getTime() - lastReward.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours >= 24) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            messageCount: increment(-3),
            lastRewardAt: serverTimestamp()
          });
          
          // Show reward notification
          sendNotification("🎁 مكافأة من ماهر", {
            body: "عشانك غالي علينا ومتميز في باقتك، زدنا رصيدك 3 أوامر إضافية! كمل إبداعك.",
            icon: "/AppIcon~ios-marketing.png"
          });
          
          // Log to admin for tracking
          sendAdminNotification("Maher Reward Granted", `User ${user.email} was rewarded with 3 credits.`);
        } else {
          console.log("Reward skipped: 24h limit");
          sendAdminNotification("Maher Reward Attempted", `User ${user.email} requested reward but is within 24h cooldown.`);
        }
      }

      // Send notification if tab is hidden
      sendNotification("اكتملت المهمة بنجاح!", {
        body: effectiveAgentType === 'مصنع التطبيقات' ? "قام ماهر بتحديث الكود وواجهة المستخدم." : "رد ماهر على استفسارك.",
      });

      if (userProfile && !isAutoFix && effectiveAgentType !== 'ماهر العام') {
        const userRef = doc(db, 'users', user.uid);
        const dLimit = getDailyLimit();
        const dUsed = userProfile?.messageCount || 0;

        const updates: any = {
          totalMessages: increment(1),
          monthlyTotalMessages: increment(1), // Total this month for cost estimation
          updatedAt: serverTimestamp()
        };

        if (dUsed < dLimit) {
          updates.messageCount = increment(1);
        } else {
          updates.monthlyMessageCount = increment(1);
        }
        
        await updateDoc(userRef, updates);
      }
      
    } catch (error: any) {
      if (error?.message === 'ABORTED') {
        console.log('Request aborted by user');
        return;
      }
      console.error(error);
      const errMessage = error?.message || String(error);
      
      if (chatId) {
        let errorMessage = 'عذراً، واجهت مشكلة تقنية بسيطة في الاتصال. يرجى المحاولة مرة أخرى.';
        
        if (errMessage.includes('QUOTA_EXHAUSTED') || errMessage.includes('LIMIT_REACHED')) {
          errorMessage = '⚠️ يبدو أن "ماهر" مشغول جداً الآن (تجاوز حد الطلبات). يرجى الانتظار دقيقة واحدة فقط ثم المحاولة مرة أخرى. هذا أمر مؤقت وسيتم حله قريباً.';
          setCooldown(60); // 60 seconds cooldown
        } else if (errMessage.includes('PROCESS_FAILED')) {
          errorMessage = 'عذراً، واجهت مشكلة تقنية بسيطة في الاتصال بسبب استغراق وقت طويل في التفكير. يرجى المحاولة مرة أخرى بنسخ نفس النص وإرساله.';
        }

        try {
          await safeAddDoc(collection(db, `chats/${chatId}/messages`), {
            role: 'model',
            content: errorMessage,
            createdAt: serverTimestamp()
          });
        } catch (innerErr) {
          console.error("Failed to save error message to chat:", innerErr);
        }
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentChatId, agentType, user, userProfile, messages, attachedImages, isLoading]);

  const isExceeded = useMemo(() => {
    if (agentType === 'ماهر العام') return false;
    const dLimit = getDailyLimit();
    const mLimit = getMonthlyLimit();
    
    let dUsed = userProfile?.messageCount || 0;
    const lastReset = getTimestampDate(userProfile?.lastMessageReset);
    const now = new Date();
    if (lastReset && (now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
       dUsed = 0;
    }
    
    let mUsed = userProfile?.monthlyMessageCount || 0;
    
    return (dUsed >= dLimit) && (mUsed >= mLimit);
  }, [userProfile, userPlan, agentType]);

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
            timestamp: getTimestampDate(msg.createdAt) || new Date(),
            id: msg.id
          });
        }
      }
    });
    return versions;
  }, [messages]);

  const handleUndo = useCallback((messageId: string) => {
    const vIndex = codeVersions.findIndex(v => v.id === messageId);
    if (vIndex >= 0) {
      setHistoryIndex(vIndex);
    }
  }, [codeVersions]);

  const currentCode = codeVersions.length > 0
    ? (historyIndex === -1 ? codeVersions[codeVersions.length - 1].code : codeVersions[historyIndex]?.code || '')
    : '';

  // Listen for messages from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ELEMENT_SELECTED') {
        setSelectedSelectors(prev => {
          if (prev.includes(event.data.selector)) {
            return prev.filter(s => s !== event.data.selector);
          }
          return [...prev, event.data.selector];
        });
        // We do NOT set isSelectionModeActive to false if we want multi-select.
      } else if (event.data && event.data.type === 'CODE_ERROR') {
        if (!currentCode || currentCode === lastAttemptedCodeRef.current || agentType !== "مصنع التطبيقات" || isSelectionModeActive) return;
        lastAttemptedCodeRef.current = currentCode;
        
        const errorMsg = event.data.message || "";
        let friendlyNote = "الإصلاح ما يخصم من رصيدك، أبشر بسعدك خلها علي وأنا بتصرف يا الزميل";
        
        if (errorMsg.includes("ReferenceError")) {
          friendlyNote = "أفا.. شكل الهواجيس خذتني ونسيت أعرف واحد من المتغيرات، أبشر الحين أربطه لك ولا يشغلك بال يا الزميل.";
        } else if (errorMsg.includes("SyntaxError")) {
          friendlyNote = "الظاهر فيه غلظة بسيطة في رص الحكي (الكود)، مير لا تشيل هم، الحين أرتب الأوراق من جديد وأضبطه لك.";
        } else if (errorMsg.includes("TypeError")) {
          friendlyNote = "صار فيه تداخل بسيط في الأشكال والأنواع، الحين أسنعها لك وأخلي التطبيق يمشي زي الحلاوة.";
        } else if (errorMsg.includes("RangeError") || errorMsg.includes("InternalError")) {
          friendlyNote = "يبدو إن الكود طمر فوق حده، أبشر به الحين أحسنه لك وأخليه يركد ويستقر يا الزميل.";
        }

        const autoFixPrompt = `[رسالة نظام تلقائية من ماهر]:
ظهر الخطأ البرمجي التالي للمستخدم عند تشغيل ومعاينة الكود الحالي:
"${event.data.message}" ${event.data.line ? `في السطر ${event.data.line}` : ''}

" ${friendlyNote} "`;
        
        handleSendMessage(autoFixPrompt, true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentCode, agentType, handleSendMessage, isSelectionModeActive]);

  const injectedPreviewCode = useMemo(() => {
    if (!currentCode) return '';
    
    let modifiedCode = currentCode;

    const errorCatchingScript = `
      <script>
        (function() {
          let errorCount = 0;
          window.addEventListener('error', function(e) {
            if (errorCount > 0) return; // Prevent loop
            // Ignore resize observer errors which are common and harmless
            if (e.message && e.message.includes('ResizeObserver')) return;
            errorCount++;
            window.parent.postMessage({ type: 'CODE_ERROR', message: e.message, line: e.lineno, col: e.colno }, '*');
          });
          window.addEventListener('unhandledrejection', function(e) {
            if (errorCount > 0) return;
            errorCount++;
            window.parent.postMessage({ type: 'CODE_ERROR', message: e.reason ? e.reason.toString() : 'Unhandled Promise Rejection' }, '*');
          });

          // Intercept links, forms and window.location to prevent parent navigation
          (function() {
            const prevent = (e) => {
              e.preventDefault();
              e.stopPropagation();
            };

            // Block location shifts
            try {
              window.onbeforeunload = function() { return null; };
              window.onunload = function() { return null; };
              
              // Prevent common history API navigation
              const noop = () => {};
              history.pushState = noop;
              history.replaceState = noop;
              // history.back, etc might be used for UI stuff, but we block top-level
            } catch(e) {}

            window.addEventListener('click', function(e) {
              if (e.defaultPrevented) return;
              let target = e.target;
              while(target && target.tagName !== 'A') {
                target = target.parentNode;
              }
              if(target && target.tagName === 'A') {
                const href = target.getAttribute('href');
                const targetAttr = target.getAttribute('target');
                
                // Allow external links in new tabs if they are absolute
                if (href && href.startsWith('http') && targetAttr === '_blank') {
                  return;
                }

                // Prevent all other navigations
                prevent(e);
                console.log("Prevented navigation in preview:", href);
              }
            }, true);

            window.addEventListener('submit', function(e) {
              prevent(e);
              console.log("Prevented form submission in preview");
            }, true);

            // Try to block window.top navigation
            try {
              const originalOpen = window.open;
              window.open = function() {
                console.log("Blocked window.open in preview");
                return null;
              };
              
              // We can't easily block window.location assignment directly,
              // but sandbox "allow-top-navigation" (missing) handled most cases.
            } catch(e) {}
          })();
        })();
      </script>
    `;

    if (modifiedCode.includes('<head>')) {
      modifiedCode = modifiedCode.replace('<head>', '<head>' + errorCatchingScript);
    } else {
       modifiedCode = errorCatchingScript + modifiedCode;
    }

    // ALWAYS INCLUDE SELECTION SCRIPT
    const selectionScript = `
      <script>
        (function() {
          let lastEl = null;
          let isSelectionActive = false;
          let hoverOverlay = null;
          let selectedSelectors = [];
          let selectedOverlays = [];

          window.addEventListener('message', (e) => {
            if (e.data.type === 'TOGGLE_SELECTION_MODE') {
              isSelectionActive = e.data.enabled;
              if (hoverOverlay) hoverOverlay.style.display = 'none';
            } else if (e.data.type === 'UPDATE_SELECTED_ELEMENTS') {
              selectedSelectors = e.data.selectors || [];
              updateSelectedOverlays();
            }
          });

          function ensureHoverOverlay() {
            if (hoverOverlay) return;
            hoverOverlay = document.createElement('div');
            hoverOverlay.style.position = 'fixed';
            hoverOverlay.style.pointerEvents = 'none';
            hoverOverlay.style.border = '2px solid #c5a059';
            hoverOverlay.style.backgroundColor = 'rgba(197, 160, 89, 0.1)';
            hoverOverlay.style.zIndex = '999999';
            hoverOverlay.style.display = 'none';
            hoverOverlay.style.transition = 'all 0.1s ease';
            document.body.appendChild(hoverOverlay);
          }

          function updateSelectedOverlays() {
            selectedOverlays.forEach(o => o.remove());
            selectedOverlays = [];
            selectedSelectors.forEach(sel => {
              try {
                const el = document.querySelector(sel);
                if (el) {
                  const overlay = document.createElement('div');
                  overlay.style.position = 'fixed';
                  overlay.style.pointerEvents = 'none';
                  overlay.style.border = '2px solid #10b981';
                  overlay.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                  overlay.style.zIndex = '999998';
                  
                  const rect = el.getBoundingClientRect();
                  overlay.style.width = Math.ceil(rect.width) + 'px';
                  overlay.style.height = Math.ceil(rect.height) + 'px';
                  overlay.style.top = Math.ceil(rect.top) + 'px';
                  overlay.style.left = Math.ceil(rect.left) + 'px';
                  document.body.appendChild(overlay);
                  selectedOverlays.push(overlay);
                }
              } catch(e) {}
            });
          }

          window.addEventListener('scroll', updateSelectedOverlays, true);
          window.addEventListener('resize', updateSelectedOverlays);

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
            if (!isSelectionActive) return;
            ensureHoverOverlay();
            const el = e.target;
            if (el === document.body || el === document.documentElement) {
              if (hoverOverlay) hoverOverlay.style.display = 'none';
              return;
            }
            lastEl = el;
            const rect = el.getBoundingClientRect();
            hoverOverlay.style.width = Math.ceil(rect.width) + 'px';
            hoverOverlay.style.height = Math.ceil(rect.height) + 'px';
            hoverOverlay.style.top = Math.ceil(rect.top) + 'px';
            hoverOverlay.style.left = Math.ceil(rect.left) + 'px';
            hoverOverlay.style.display = 'block';
          });

          document.addEventListener('click', (e) => {
            if (!isSelectionActive) return;
            e.preventDefault();
            e.stopPropagation();
            const selector = getSelector(e.target);
            window.parent.postMessage({ type: 'ELEMENT_SELECTED', selector }, '*');
          }, true);

          document.addEventListener('mouseleave', () => {
             if (hoverOverlay) hoverOverlay.style.display = 'none';
          });
        })();
      </script>
    `;

    if (modifiedCode.includes('</body>')) {
      return modifiedCode.replace('</body>', selectionScript + '</body>');
    }
    return modifiedCode + selectionScript;
  }, [currentCode]);

  // Sync selection state with iframe
  useEffect(() => {
    const iframe = document.querySelector('iframe[title="preview"]') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ 
        type: 'UPDATE_SELECTED_ELEMENTS', 
        selectors: selectedSelectors 
      }, '*');
    }
  }, [selectedSelectors, currentCode]);
  useEffect(() => {
    const iframe = document.querySelector('iframe[title="preview"]') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ 
        type: 'TOGGLE_SELECTION_MODE', 
        enabled: isSelectionModeActive 
      }, '*');
    }
  }, [isSelectionModeActive, previewRefreshKey, currentCode, historyIndex]);

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
    const lastReset = getTimestampDate(userProfile?.lastMessageReset);
    if (lastReset && (Date.now() - lastReset.getTime() > 24 * 60 * 60 * 1000)) {
      dUsed = 0;
    }

    let mUsed = userProfile?.monthlyMessageCount || 0;
    
    const dRemaining = Math.max(0, dLimit - dUsed);
    const mRemaining = Math.max(0, mLimit - mUsed);

    return dRemaining + mRemaining;
  }

  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const confirmNewProject = async () => {
    if (!projectTitle.trim() || isCreatingProject) return;
    
    const titleToSave = projectTitle.trim();
    const normalizedTitle = titleToSave.toLowerCase();
    const normalizedType = projectType.toLowerCase();

    // Strict prohibition of games as requested
    const gameKeywords = ['لعبة', 'لعبه', 'game', 'games', 'gaming'];
    const isGame = gameKeywords.some(keyword => 
      normalizedTitle.includes(keyword) || normalizedType.includes(keyword)
    );

    if (isGame) {
      alert('عذراً، يمنع منعاً باتاً إنشاء الألعاب في هذا النظام للحفاظ على استقرار الخدمة.');
      setShowNamingModal(false);
      setProjectTitle('');
      return;
    }

    // Comprehensive cleanup of any existing "game" projects for this user
    try {
      const qOldGames = query(
        collection(db, 'chats'), 
        where('userId', '==', user.uid)
      );
      const oldGamesSnap = await getDocs(qOldGames);
      for (const gameDoc of oldGamesSnap.docs) {
        const data = gameDoc.data();
        const t = (data.title || '').toLowerCase();
        const p = (data.projectType || '').toLowerCase();
        if (t.includes('لعبة') || t.includes('لعبه') || t.includes('game') || p.includes('لعبة') || p === 'game') {
          // Deep delete messages
          const msgsSnap = await getDocs(collection(db, `chats/${gameDoc.id}/messages`));
          const msgPromises = msgsSnap.docs.map(m => deleteDoc(m.ref));
          await Promise.all(msgPromises);
          // Delete chat
          await deleteDoc(gameDoc.ref);
        }
      }
    } catch (err) {
      console.error("Auto-cleanup games failed:", err);
    }
    
    // Close modal immediately and show full-page loading state
    setShowNamingModal(false);
    setProjectTitle(''); 
    setIsCreatingProject(true);

    try {
      const newChatRef = await safeAddDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: titleToSave,
        agentName: agentType,
        projectType: projectType,
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(newChatRef.id);
      setMessages([]);
      setHistoryIndex(-1);
      setCloudStatus('idle');
      setConnectedService(null);
      setIsSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    } finally {
      setIsCreatingProject(false);
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
    <div className="flex h-[100dvh] w-full max-w-full mesh-bg text-zinc-100 overflow-hidden rtl relative selection:bg-gold-500/30 selection:text-gold-200">
      {/* Optimized Background Layer - Cleaned up movement */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-gold-500/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-gold-500/5 blur-[120px] rounded-full" />
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
          {isCreatingProject && (
            <div className="w-full text-right p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center gap-2 animate-pulse mb-2">
              <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-zinc-400">جاري إنشاء المشروع...</span>
            </div>
          )}
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
              <div className="text-sm text-zinc-500 font-medium truncate flex flex-col gap-0.5 mt-0.5">
                <span>{userPlan === 'free' ? 'باقة مجانية' : userPlan === 'pro' ? 'الباقة الاحترافية' : 'باقة النخبة'}</span>
                {userProfile?.phone && <span className="text-[10px] opacity-60" dir="ltr">{userProfile.phone}</span>}
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
          {['mr.imaher@gmail.com', 'hoomiapp@gmail.com', 'md2maher@gmail.com'].includes(user.email || '') && (
            <div className="space-y-1 mb-1">
              <button 
                onClick={() => setShowAdminDashboard(true)}
                className="w-full flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">لوحة تحكم المسؤول</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => setShowDocumentation(true)}
            className="w-full flex items-center gap-2 text-zinc-400 hover:text-gold-400 px-2 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors mb-1"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-sm font-medium">دليل الاستخدام</span>
          </button>
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
        
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 h-full overflow-hidden">
          {/* IDE Center (Chat & Commands) */}
          <div 
            className={clsx(
              "flex flex-col border-l border-zinc-800/50 shrink-0 bg-zinc-950/50 h-full transition-all duration-300 relative",
              (agentType === "ماهر العام" || !isMobilePreviewOpen) ? "w-full" : "w-full lg:w-[420px]",
              isMobilePreviewOpen && agentType === "مصنع التطبيقات" ? "hidden lg:flex" : "flex"
            )}
          >
            <header className="shrink-0 flex items-center justify-between px-2 sm:px-4 h-16 border-b border-zinc-800/50 bg-zinc-900/30 overflow-x-auto hide-scrollbar gap-1 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <button className="lg:hidden text-zinc-400 hover:text-white p-1 sm:p-2 rounded-xl hover:bg-zinc-800/50 transition-colors" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="flex items-center bg-zinc-950/80 rounded-xl p-1 border border-zinc-800/50 shadow-inner w-[190px] sm:w-[280px]">
                {(["ماهر العام", "مصنع التطبيقات"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAgentType(type)}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 text-[9px] sm:text-xs font-bold rounded-lg transition-all duration-300 relative whitespace-nowrap",
                      agentType === type 
                        ? "bg-gold-500 text-zinc-950 shadow-[0_0_15px_rgba(234,179,8,0.2)]" 
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {type === "مصنع التطبيقات" ? <Code className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <AnimatePresence mode="wait">
                {agentType === "مصنع التطبيقات" && !isMobilePreviewOpen && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border bg-gold-500 text-zinc-950 border-gold-400 hover:bg-gold-400 transition-all shadow-md active:scale-95 group whitespace-nowrap"
                    onClick={() => {
                      setIsMobilePreviewOpen(true);
                      setIsSidebarOpen(false);
                    }}
                  >
                    <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">عرض المعاينة</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
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
              {!messages.length && !isLoading && (
                <div className="flex flex-col w-full items-end animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out rtl">
                  <div className="flex gap-3 sm:gap-4 max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] flex-row-reverse">
                    <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold-500 to-orange-600 p-0.5 shrink-0 flex items-center justify-center shadow-lg">
                      <div className="w-full h-full bg-zinc-950 rounded-[10px] sm:rounded-[14px] overflow-hidden flex items-center justify-center">
                        <img src="/AppIcon~ios-marketing.png" alt="Maher" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2 items-end mt-1 sm:mt-2">
                       <span className="text-xs sm:text-sm font-bold text-gold-500 flex items-center gap-1.5 px-1 flex-row-reverse">
                          <Sparkles className="w-3 sm:w-4 h-3 sm:h-4" />
                          {agentType === 'مصنع التطبيقات' ? "ماهر (مصنع التطبيقات)" : "ماهر العام"}
                       </span>
                       <div className="p-5 sm:p-6 rounded-2xl rounded-tr-sm bg-zinc-900 border border-zinc-800/50 shadow-xl w-full text-right relative overflow-hidden">
                          {/* Decorative blur */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                          
                          <div className="prose prose-sm sm:prose-base prose-invert prose-p:leading-relaxed text-zinc-300 relative z-10 w-full">
                             <h3 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-gold-400 to-gold-600 mb-4 inline-block">
                                أهلاً بك يا فخم! ✨
                             </h3>
                             {agentType === "مصنع التطبيقات" ? (
                               <>
                                 <p className="text-base sm:text-lg text-white mb-4 leading-relaxed font-medium">أنا ماهر، مهندسك الخاص وشريكك الذكي لبناء تحفتك التقنية القادمة.</p>
                                 <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                                   سواءً كنت تحلم بمتجر إلكتروني يكسر حاجز المبيعات، مبادرة لخدمة مجتمعك، تطبيق ذكي يعتمد على الخرائط، أو حتى بناء واجهة لنظام إداري معقّد...<br/>
                                   <strong className="text-zinc-200">أنا هنا لأحول خيالك إلى سطور برمجية تتنفس أمام عينيك في ثوانٍ.</strong>
                                 </p>
                                 <div className="mt-6 p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl relative overflow-hidden group">
                                   <div className="absolute inset-0 bg-gradient-to-r from-gold-500/0 via-gold-500/10 to-gold-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                   <p className="text-gold-400 font-bold text-base sm:text-lg m-0 relative z-10">ما هو التطبيق العظيم الذي سنبنيه معاً اليوم؟ 🚀</p>
                                 </div>
                               </>
                             ) : (
                               <>
                                 <p className="text-base sm:text-lg text-white mb-4 leading-relaxed font-medium">أنا ماهر، المساعد الاستثنائي لمناقشة أفكارك، كتابة أبحاثك، وحل أعتى المشكلات بعبقرية مطلقة.</p>
                                 <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                                   في هذا الوضع، نبتعد عن كتابة الأكواد لندخل في عمق الإبداع والمناقشة.<br/>
                                   سواء كنت تريد صياغة خطة تسويقية محكمة، كتابة سيناريو عبقري، أو حتى تحتاج إلى تفكير عميق لحل مشكلة معقدة...<br/>
                                   <strong className="text-zinc-200">أنا أقف إلى جانبك لنصل إلى الإجابة النموذجية معاً.</strong>
                                 </p>
                                 <div className="mt-6 p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl relative overflow-hidden group">
                                   <div className="absolute inset-0 bg-gradient-to-r from-gold-500/0 via-gold-500/10 to-gold-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                   <p className="text-gold-400 font-bold text-base sm:text-lg m-0 relative z-10">كيف أستطيع أن أبهرك اليوم؟ 🧠</p>
                                 </div>
                               </>
                             )}
                          </div>
                          
                          {agentType === "مصنع التطبيقات" && (
                            <div className="mt-8 flex flex-wrap gap-2 justify-end relative z-10">
                                {[
                                  "تطبيق توصيل طلبات 🛵",
                                  "متجر إلكتروني احترافي 🛒",
                                  "نظام إدارة مطاعم 🍕",
                                  "تطبيق حجوزات ومواعيد 📅"
                                ].map(suggestion => (
                                  <button 
                                    key={suggestion} 
                                    onClick={() => handleSendMessage(suggestion)} 
                                    className="text-xs sm:text-sm px-4 py-2.5 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white hover:border-gold-500/50 hover:bg-gold-500/10 transition-all font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                            </div>
                          )}
                          {agentType === "ماهر العام" && (
                            <div className="mt-8 flex flex-wrap gap-2 justify-end relative z-10">
                                {[
                                  "اكتب لي خطة تسويقية 📊",
                                  "كيف أبدأ مشروعي التقني؟ 💡",
                                  "لخّص لي كتاباً شهيراً 📚",
                                  "ساعدني في تنظيم وقتي ⏱️"
                                ].map(suggestion => (
                                  <button 
                                    key={suggestion} 
                                    onClick={() => handleSendMessage(suggestion)} 
                                    className="text-xs sm:text-sm px-4 py-2.5 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white hover:border-gold-500/50 hover:bg-gold-500/10 transition-all font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
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
                  onUndo={handleUndo}
                  canUndo={
                    message.role === 'model' &&
                    codeVersions.findIndex(v => v.id === message.id) >= 0
                  }
                />
              ))}
              
              {isLoading && <LoadingIndicator agentType={agentType} />}
              <div ref={messagesEndRef} className="h-4" />
              
              <AnimatePresence>
                {showScrollButton && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="absolute bottom-[110px] left-1/2 -translate-x-1/2 z-30 p-3 bg-gold-500 text-zinc-950 rounded-full shadow-2xl hover:bg-gold-400 transition-all active:scale-90"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
              
              {isExceeded && agentType !== 'ماهر العام' && (
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
            onStop={handleStopRequest}
            agentType={agentType}
            attachedImages={attachedImages}
            setAttachedImages={setAttachedImages}
            handleFileSelect={handleFileSelect}
            isSelectionModeActive={isSelectionModeActive}
            setIsSelectionModeActive={setIsSelectionModeActive}
            selectedSelectors={selectedSelectors}
            setSelectedSelectors={setSelectedSelectors}
            activeTab={activeTab}
            setActiveTab={handleTabSwitch}
            handleDrop={handleDrop}
            handleDragOver={handleDragOver}
            setShowUpgradeModal={setShowUpgradeModal}
            currentChatId={currentChatId}
            setIsMobilePreviewOpen={setIsMobilePreviewOpen}
          />
        </div>

        {/* IDE Right/Left Workspace Area (Preview) */}
        {agentType === "مصنع التطبيقات" && (
          <div className={clsx(
            "flex-1 flex-col bg-[#0A0A0A] relative h-full transition-all duration-300 min-w-0 w-full",
            isMobilePreviewOpen ? "flex" : "hidden lg:flex"
          )}>
            <header className="h-16 border-b border-zinc-800/50 flex flex-nowrap items-center justify-between px-2 sm:px-4 shrink-0 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 overflow-x-auto hide-scrollbar gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                <div className="flex items-center bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/50 shrink-0">
                  <button 
                    onClick={() => setIsMobilePreviewOpen(false)}
                    className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-zinc-400 hover:text-white hover:bg-red-500/10 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap group"
                    title="العودة للدردشة"
                  >
                    <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    <span className="hidden sm:inline">إغلاق المعاينة</span>
                    <span className="sm:hidden">إغلاق</span>
                  </button>
                  <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                  <button 
                    onClick={() => handleTabSwitch('preview')}
                    className={clsx("px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap", activeTab === 'preview' ? "bg-gold-500 text-zinc-950 shadow-lg" : "text-zinc-400 hover:text-zinc-200")}
                  >
                    المعاينة
                  </button>
                   <button 
                    onClick={() => handleTabSwitch('cloud')}
                    className={clsx("px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap", activeTab === 'cloud' ? "bg-gold-500 text-zinc-950 shadow-lg" : "text-zinc-400 hover:text-zinc-200")}
                  >
                    {userPlan !== 'elite' && <Lock className="w-3 h-3" />}
                    <span className="hidden lg:inline">السحابة (Cloud)</span>
                    <span className="lg:hidden">السحابة</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                {activeTab === 'preview' && (
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button 
                      onClick={() => setPreviewRefreshKey(prev => prev + 1)} 
                      className="p-1 sm:p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700 shrink-0"
                      title="تحديث الصفحة"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        const sizes: DeviceSize[] = ['mobile', 'tablet', 'desktop'];
                        const nextIndex = (sizes.indexOf(deviceSize) + 1) % sizes.length;
                        setDeviceSize(sizes[nextIndex]);
                      }}
                      className="flex items-center gap-1 sm:gap-2.5 px-2 sm:px-4 py-1.5 sm:py-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-zinc-200 hover:text-white transition-all group shadow-lg"
                      title="تغيير حجم العرض"
                    >
                      <div className="text-gold-500 group-hover:scale-110 transition-transform">
                        {deviceSize === 'mobile' ? <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" /> : 
                         deviceSize === 'tablet' ? <Tablet className="w-3 h-3 sm:w-4 sm:h-4" /> : 
                         <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap hidden sm:inline">
                        {deviceSize === 'mobile' ? 'معاينة الجوال' : 
                         deviceSize === 'tablet' ? 'معاينة التابلت' : 
                         'معاينة الكمبيوتر'}
                      </span>
                      <RotateCcw className="w-3 h-3 text-zinc-600 group-hover:text-gold-500 transition-colors" />
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleDownload}
                  disabled={!currentCode && userPlan !== 'free'}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
                          ? (connectedService === 'firebase' ? 'تم ربط Maher App Maker بنظام Maher Sync السحابي!' : 'تم النشر على سيرفرات Maher Global (المشفرة) بنجاح!') 
                          : cloudStatus.includes('provisioning') ? 'جاري تهيئة بيئة Maher App Maker...' : 'ربط المشروع بالسحابة الآمنة'}
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {cloudStatus === 'connected' 
                          ? (connectedService === 'firebase' 
                              ? 'مشروع "Maher App Maker" مرتبط الآن بنظام Maher Sync السحابي لضمان أسرع أداء وحفظ البيانات.' 
                              : 'تم نشر مشروعك على خوادم "Maher Global" العالمية بنجاح. الربط مع قاعدة البيانات مفعل بالكامل.') 
                          : cloudStatus === 'provisioning-firebase' 
                          ? `جاري إنشاء قاعدة بيانات Maher Sync...`
                          : cloudStatus === 'provisioning-gcloud'
                          ? `جاري ربط Maher App Maker بسيرفرات النخبة العالمية...`
                          : 'قم بربط مشروعك بسيرفرات النخبة من "ماهر" للحصول على استضافة احترافية وسرعة خارقة.'}
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
                            <h4 className="font-bold text-white text-sm">الاتصال بنظام Maher Sync</h4>
                            <p className="text-zinc-500 text-sm mt-1.5">بناء قاعدة بيانات سحابية مشفرة باستخدام حسابك الأساسي.</p>
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
                            <h4 className="font-bold text-white text-sm">نشر على سيرفرات Maher Global</h4>
                            <p className="text-zinc-500 text-sm mt-1.5">نشر الموقع فوراً عبر سيرفرات النخبة في أسرع مراكز البيانات العالمية.</p>
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
                                  <span className="text-xs font-bold text-white">بيانات المشروع (Maher Sync)</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-bold text-white">بيانات النشر (Maher Global)</span>
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
                                    : `https://maher-ai-application-maker-866149039829.us-central1.run.app`}
                                </span>
                                <Copy className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer shrink-0" />
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const projectId = 'maher-ai-application-maker-866149039829';
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
                              <span>{connectedService === 'firebase' ? 'إدارة بيانات Maher Sync' : 'إدارة سيرفرات Maher Global'}</span>
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
                    "h-full rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-white transition-all duration-300 ease-in-out relative max-w-full",
                    deviceSize === 'desktop' ? "w-full" : deviceSize === 'tablet' ? "w-full sm:w-[768px]" : "w-full sm:w-[375px]"
                  )}
                >
                  <div className="h-6 bg-zinc-300 w-full flex items-center px-3 gap-1.5 absolute top-0 z-10 hidden">
                     {/* Decorative MacOS dots could go here */}
                  </div>
                  <iframe 
                    key={previewRefreshKey}
                    title="preview"
                    srcDoc={injectedPreviewCode}
                    sandbox="allow-scripts allow-popups allow-forms"
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
                 {isExceeded ? 'تجاوزت الحد اليومي' : 'ترقية الباقة'}
               </h3>
               <p className="text-zinc-400 mb-8 max-w-sm">
                 {userPlan === 'pro' 
                   ? (isExceeded ? 'لقد استهلكت رصيدك اليومي لباقة المحترف. قم بالترقية لباقة النخبة للحصول على استخدام غير محدود أو انتظر حتى يكتمل دورة الـ 24 ساعة.' : 'أنت الآن على باقة المحترف. قم بالترقية لباقة النخبة للحصول على مميزات السيرفرات وإمكانات أعلى.')
                   : (isExceeded ? 'لقد استهلكت رصيدك اليومي المجاني (3 أوامر). اشترك في باقة المحترف أو النخبة للحصول على رصيد أكبر ومميزات احترافية!' : 'اختر الباقة المنسبة لاحتياجاتك واستمتع بمميزات متقدمة.')}
               </p>
               
               <div className="w-full space-y-3">
                 {userPlan !== 'elite' && userPlan !== 'pro' && (
                   <a 
                     href={`https://sa.myfatoorah.com/SAU/pa/06051153971267857?CustomerName=${encodeURIComponent(user?.displayName || user?.email?.split('@')[0] || '')}&CustomerEmail=${encodeURIComponent(user?.email || '')}`}
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="w-full py-4 rounded-xl font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-colors block border border-gold-500/30"
                   >
                     الاشتراك في باقة المحترف (150 ريال/شهرياً)
                   </a>
                 )}
                 {userPlan !== 'elite' && (
                   <a 
                     href={`https://sa.myfatoorah.com/SAU/pa/06051153971267957?CustomerName=${encodeURIComponent(user?.displayName || user?.email?.split('@')[0] || '')}&CustomerEmail=${encodeURIComponent(user?.email || '')}`}
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="w-full py-4 rounded-xl font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-colors block border shadow-[0_0_20px_rgba(197,160,89,0.3)]"
                   >
                     الاشتراك في باقة النخبة (250 ريال/شهرياً)
                   </a>
                 )}
                 <button onClick={() => setShowUpgradeModal(false)} className="w-full py-4 rounded-xl font-medium text-zinc-400 hover:text-white transition-colors block pt-2">
                   إلغاء النافذة
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
              <h3 className="text-xl font-bold text-white mb-2">إعداد المشروع الجديد</h3>
              <p className="text-zinc-400 text-sm mb-6">يرجى تحديد نوع واسم مشروعك للبدء في البناء</p>
              
              <div className="mb-4 text-right">
                <label className="block text-zinc-400 text-xs mb-2 pl-2">اسم المشروع</label>
                <input 
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="مثال: تطبيق توصيل الطلبات"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-gold-500 outline-none transition-all text-right"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && projectTitle.trim() && confirmNewProject()}
                />
              </div>

              <div className="mb-6 text-right">
                <label className="block text-zinc-400 text-xs mb-2 pl-2">نوع المشروع</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-gold-500 outline-none transition-all outline-none appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23C5A059'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'left 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option value="تطبيق آيفون وأندرويد">تطبيق آيفون وأندرويد</option>
                  <option value="متجر الكتروني">متجر الكتروني</option>
                  <option value="منصة تعليمية">منصة تعليمية</option>
                  <option value="لوحة تحكم (Dashboard)">لوحة تحكم (Dashboard)</option>
                  <option value="تطبيق ويب (Web App)">تطبيق ويب (Web App)</option>
                  <option value="نظام إدارة محتوى (CMS)">نظام إدارة محتوى (CMS)</option>
                  <option value="برنامج محاسبة">برنامج محاسبة</option>
                  <option value="موقع تعريفي">موقع تعريفي</option>
                  <option value="مدونة شخصية">مدونة شخصية</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
              
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

      <Documentation 
        isOpen={showDocumentation} 
        onClose={() => setShowDocumentation(false)} 
      />

    </div>
  );
}
