// Public browser configuration. Never put API keys or real passwords here.
export const config = {
  brand: 'ECO',
  auth: {
    enabled: false,
    // Optional visual gate only, NOT secure authentication on static hosting.
    // { username: 'name', passwordSha256: '<SHA-256 hex digest>' }
    users: [],
  },
  workflows: {
    review: { url: '', timeoutMs: 120000 },
    takeoff: { url: '', timeoutMs: 120000 },
    design: { url: '', timeoutMs: 120000 },
  },
};

// Add a service here + its own entry in workflows above; UI renders automatically.
export const services = [
  {
    id: 'review', icon: 'review', category: 'مراجعة وتحليل',
    title: 'مراجعات هندسية ومالية',
    description: 'مقارنة فئات الأسعار المقدمة ومراجعة العروض.',
    short: 'المراجعات الهندسية والمالية',
    prompt: 'أرفق عروض الأسعار، واكتب البنود التي تريد مقارنتها أو مراجعتها.',
    placeholder: 'اكتب تفاصيل المراجعة أو مقارنة الأسعار…',
    accept: '.pdf,.xlsx,.xls,.csv,.docx,.txt', formats: 'PDF، Excel، Word',
    suggestions: ['مقارنة عروض أسعار', 'مراجعة بنود مقايسة', 'تحليل الفروق المالية'],
  },
  {
    id: 'takeoff', icon: 'takeoff', category: 'قياس وحصر',
    title: 'حصر أعمال من ملفات الأوتوكاد',
    description: 'استخراج الكميات وبنود الأعمال من الرسومات.',
    short: 'حصر أعمال الأوتوكاد',
    prompt: 'أرفق ملف الرسم، وحدّد نوع الأعمال ووحدة القياس المطلوبة.',
    placeholder: 'ما الأعمال التي تريد حصرها من الرسم؟',
    accept: '.dxf,.dwg,.pdf,.zip', formats: 'DXF، DWG، PDF',
    suggestions: ['حصر الأعمال المعمارية', 'حصر العناصر الإنشائية', 'إعداد جدول كميات'],
  },
  {
    id: 'design', icon: 'design', category: 'تخطيط وتصميم',
    title: 'إعداد رسومات تصميمية',
    description: 'إعداد الرسومات وفق المتطلبات والأبعاد والمراجع.',
    short: 'الرسومات التصميمية',
    prompt: 'اكتب متطلبات المشروع والأبعاد المتاحة، وأرفق المراجع إن وجدت.',
    placeholder: 'صف التصميم المطلوب والأبعاد والاشتراطات…',
    accept: '.dxf,.dwg,.pdf,.png,.jpg,.jpeg,.webp,.zip', formats: 'رسومات، صور، PDF',
    suggestions: ['إعداد مسقط معماري', 'تطوير فكرة تصميمية', 'مراجعة توزيع الفراغات'],
  },
];
