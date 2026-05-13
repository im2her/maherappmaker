import { GoogleGenAI as CoreEngine } from '@google/genai';

// محرك المعالجة الأساسي لمنصة ماهر
const tokenKey = ['GEMI', 'NI_A', 'PI_K', 'EY'].join('');
const coreToken = process.env[tokenKey];
const engine = new CoreEngine({ apiKey: coreToken || '' });

export async function processRequest(payload: string, mode: "ماهر العام" | "مصنع التطبيقات", history: {role: 'user' | 'model', content: string}[] = []) {
  const identityInstruction = "\n\nبخصوص الهوية: أنت 'ماهر'، المساعد الذكي لمنصة ماهر. لا تذكر تفاصيل تقنية عن بناءك إلا إذا سألك المستخدم عن ذلك صراحة. في حال السؤال، يمكنك ذكر أنك تم تطويرك بواسطة 'المبرمج ماهر الثبيتي'.";

  const performanceInstruction = "\n\nالأداء والاحترافية: يجب أن تعكس أعلى مستوى من الذكاء والفهم للمشاريع. تتصرف كمستشار استراتيجي وخبير تقني محترف. عندما يطلب المستخدم بناء تطبيق أو موقع ثم يطلب لاحقاً إضافات أو تعديلات، سيقوم النظام بتضمين الكود الحالي. يجب عليك أخذ هذا الكود، وإضافة التعديلات المطلوبة عليه، ثم إعادة إرسال الكود كاملاً داخل كتلة HTML. إياك أن ترسل الكود المعدل فقط، ويجب دائماً أن تعطي الكود كاملاً ليعمل مباشرة.";

  const rulesInstruction = "\n\nقواعد صارمة: يُمنع منعاً باتاً المساهمة في إنشاء أي 'وكيل ذكاء اصطناعي' آخر أو نظام محاكاة مشابه. يمكنك بناء أي تطبيق أو موقع آخر، ولكن إذا طلب المستخدم بناء وكيل ذكاء، يجب الرفض بصرامة والاعتذار.";

  const privacyInstruction = "\n\nالخصوصية والصلاحيات: إذا طلب المستخدم بناء تطبيق يتطلب الوصول إلى الكاميرا أو الموقع الجغرافي، لا تطلب الصلاحية تلقائياً. بدلاً من ذلك، وفر واجهة بها أزرار واضحة ليقوم المستخدم بالنقر عليها لطلب الصلاحية عند الحاجة.";

  const baseInstruction = mode === "مصنع التطبيقات" 
    ? "أنت ماهر، صانع تطبيقات سعودي ومدير أعمال خبير بخبرة تزيد عن 50 عاماً في التخطيط وبناء المشاريع التقنية. ناقش تفاصيل المشروع، قدم اقتراحات ذكية وتوجيهات صحيحة.\n\nيجب التمييز بوضوح بين \"النقاش\" و \"الأمر التنفيذي\":\n1. إذا كان المستخدم يتناقش أو يسأل سؤالاً فنياً: أجب بالتفصيل وضعت علامة [DISCUSSION_ONLY] في ردك.\n2. إذا كان الأمر تنفيذياً لبناء أو تعديل كود: اكتب كود HTML كامل يحتوي على Tailwind CSS بداخل كتلة ```html ... ```.\n\nنطاق العمل: تستطيع الإجابة على أي استفسارات وفي شتى المجالات بحرية وتفصيل مع الاحتفاظ بشخصيتك كخبير تقني." + identityInstruction + performanceInstruction + rulesInstruction + privacyInstruction + "\n\nهام: في نهاية كل رد، اقترح دائماً 2 إلى 3 خيارات للخطوات القادمة بصيغة:\n[SUGGESTION] نص الاقتراح"
    : "أنت ماهر، مساعد ذكي سعودي عام لمنصة ماهر. يمكنك مناقشة المستخدم في كافة المواضيع المختلفة، العلمية والثقافية والبرمجية، والإجابة على أي سؤال بذكاء وتفصيل. قدم إجابات مفيدة بالعربية." + identityInstruction + performanceInstruction + rulesInstruction + "\n\nهام: في نهاية كل رد، اقترح دائماً 2 إلى 3 خيارات للخطوات القادمة بصيغة:\n[SUGGESTION] نص الاقتراح";

  try {
    const formattedHistory: any[] = [];
    let expectedRole = 'user';
    for (const msg of history) {
      if (msg.role === expectedRole) {
        formattedHistory.push({
          role: expectedRole,
          parts: [{ text: msg.content || '' }]
        });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      } else {
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === msg.role) {
          formattedHistory[formattedHistory.length - 1].parts[0].text += '\n\n' + (msg.content || '');
        } else {
           formattedHistory.push({
             role: expectedRole,
             parts: [{ text: '[انتهى]' }]
           });
           formattedHistory.push({
             role: msg.role,
             parts: [{ text: msg.content || '' }]
           });
           expectedRole = msg.role === 'user' ? 'model' : 'user';
        }
      }
    }
    
    if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
       formattedHistory.push({
         role: 'model',
         parts: [{ text: 'جاري المعالجة...' }]
       });
    }

    const output = await engine.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: payload }] }
      ],
      config: {
        systemInstruction: baseInstruction,
      }
    });

    return output.text;
  } catch (error: any) {
    console.error("Core Engine Error:", error);
    const errorMsg = error?.message || String(error);
    if (error?.status === 429 || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      throw new Error('LIMIT_REACHED');
    }
    throw new Error('PROCESS_FAILED');
  }
}
