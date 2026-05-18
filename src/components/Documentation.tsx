import { X, BookOpen, MessageSquare, Code, Sparkles, Command, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Documentation({ isOpen, onClose }: DocumentationProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 bg-black/60 backdrop-blur-sm rtl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl h-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-500">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">دليل استخدام المنصة</h2>
                <p className="text-sm text-zinc-400">طرق التعامل مع ماهر واستخراج أفضل النتائج</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="space-y-10">
              
              {/* Intro section */}
              <section className="space-y-4">
                <h3 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  من هو ماهر؟
                </h3>
                <p className="text-zinc-300 leading-relaxed">
                  ماهر هو زميلك التقني، ومطور واجهات (Frontend Developer) ومصمم ومبرمج متكامل بخبرة واسعة. 
                  يعمل ماهر في العادة بين وضعين رئيسيين: 
                  <span className="font-bold text-gold-500"> مصنع التطبيقات</span> (لبرمجة وبناء الواجهات) 
                  و <span className="font-bold text-blue-400">ماهر العام</span> (للنقاشات، الاستشارات والتخطيط).
                </p>
              </section>

              {/* Grid of modes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50">
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 mb-4">
                    <Code className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2">في وضع مصنع التطبيقات</h4>
                  <ul className="space-y-2 text-sm text-zinc-400 list-disc list-inside">
                    <li>أعطه أوامر صريحة للبناء (مثلاً: ابنِ، عدّل، ضِف).</li>
                    <li>يقوم بتعديل الأكواد فوراً ويحدّث واجهة التطبيق المباشرة.</li>
                    <li>لتعديل جزء محدد، يمكنك تفعيل أداة التحديد واستخدامها.</li>
                  </ul>
                </div>
                
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2">في وضع ماهر العام</h4>
                  <ul className="space-y-2 text-sm text-zinc-400 list-disc list-inside">
                    <li>اسأله، استشره، وخطط معه (مثلاً: وش رايك، كيف أسوي).</li>
                    <li>يحلل الأفكار، يكتب المحتوى، ويقترح خطط تسويقية وبرمجية.</li>
                    <li>لن يقوم بتعديل الكود في هذا الوضع، فقط نقاش وتوجيه.</li>
                  </ul>
                </div>
              </div>

              {/* Best Practices */}
              <section className="space-y-4">
                <h3 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                  <Command className="w-5 h-5" />
                  طرق صياغة الطلبات المثالية
                </h3>
                <div className="space-y-4">
                  <div className="bg-zinc-800/20 p-4 rounded-xl border border-zinc-800/50">
                    <h5 className="font-medium text-white mb-2">❌ الأوامر الضعيفة</h5>
                    <p className="text-zinc-400 text-sm">"ابغى تطبيق حلو" ، "عدل الزر" ، "التطبيق ما يشتغل"</p>
                  </div>
                  <div className="bg-gold-500/5 p-4 rounded-xl border border-gold-500/20">
                    <h5 className="font-medium text-white mb-2">✅ الأوامر الاحترافية</h5>
                    <p className="text-zinc-300 text-sm">"ابنِ تطبيق لإدارة المهام. في الصفحة الرئيسية أريد ثلاث أعمدة: مهام جديدة، قيد التنفيذ، ومكتملة، مع زر لإضافة مهمة بلون ذهبي. استخدم خطوط واضحة وتصميم داكن (Dark Theme)."</p>
                  </div>
                </div>
              </section>

              {/* Additional Tips */}
              <section className="space-y-4">
                <h3 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  نصائح إضافية للاستخدام 
                </h3>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-zinc-300 text-sm">
                    <span className="text-gold-500 font-bold shrink-0">1. استخدم التحديد (Selection):</span>
                    <span>عندما تريد تعديل زر أو عنصر محدد، استخدم أيقونة التحديد، انقر على العنصر في شاشة العرض، ثم اكتب أمرك (مثلاً: غير لون هذا الزر للأحمر).</span>
                  </li>
                  <li className="flex gap-3 text-zinc-300 text-sm">
                    <span className="text-gold-500 font-bold shrink-0">2. إرفاق الصور:</span>
                    <span>يمكنك إرفاق صورة لتصميم أعجبك أو واجهة تريد تقليدها، وقل لماهر: "حول هذا التصميم إلى كود حقيقي".</span>
                  </li>
                  <li className="flex gap-3 text-zinc-300 text-sm">
                    <span className="text-gold-500 font-bold shrink-0">3. الانتباه للرصيد المستهلك:</span>
                    <span>الطلبات التي تحتوي على "توليد كود" تستهلك الكلمات بشكل أسرع. استخدم وضع النقاش العادي للأسئلة والاستشارات للحفاظ على رصيدك.</span>
                  </li>
                  <li className="flex gap-3 text-zinc-300 text-sm">
                    <span className="text-gold-500 font-bold shrink-0">4. الاستعادة والمحفوظات:</span>
                    <span>إذا حدث خطأ في التصميم أو لم يعجبك التعديل الأخير، قم بالضغط على زر "تراجع عن التعديل" في نفس رد ماهر للعودة فوراً للنسخة التي قبله.</span>
                  </li>
                </ul>
              </section>

            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
