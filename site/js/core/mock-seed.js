/* mock-seed.js — بيانات وهمية بنفس شكل استجابة القاعدة تماماً.
   ملف بيانات خالص بلا منطق؛ المحرّك في `mock-data.js`.

   ⚠️ كل ما هنا مؤقت للاختبار ويُستبدل من لوحة المشرف قبل النشر:
   أسماء المعارض، الأرقام، والآراء (موسومة صراحةً كتجريبية). */

const P = 'assets/posters';

export const collections = [
  { id: 'c1', name: 'معرض تجريبي أول', slug: 'demo-1', accent_color: null, sort: 1, published: true },
  { id: 'c2', name: 'معرض تجريبي ثانٍ', slug: 'demo-2', accent_color: null, sort: 2, published: true },
  { id: 'c3', name: 'معرض تجريبي ثالث', slug: 'demo-3', accent_color: null, sort: 3, published: true },
];

/** كل عمل بصورتين: الأساسية وصورة الكشف بالمرور (المؤثر 24). */
const w = (id, c, a, b, title, sort) => ({
  id, collection_id: c,
  image_url: `${P}/${a}`,
  image_hover_url: b ? `${P}/${b}` : '',
  title, alt: title, sort, published: true,
});

export const works = [
  w('w1', 'c1', 'ember-2.webp', 'ember-3.webp', 'عمل تجريبي ١', 1),
  w('w2', 'c1', 'ember-4.webp', 'ember-5.webp', 'عمل تجريبي ٢', 2),
  w('w3', 'c1', 'blue-1.webp', 'blue-2.webp', 'عمل تجريبي ٣', 3),
  w('w4', 'c1', 'blue-3.webp', '', 'عمل تجريبي ٤', 4),
  w('w5', 'c2', 'mint-1.webp', 'mint-2.webp', 'عمل تجريبي ٥', 1),
  w('w6', 'c2', 'mint-3.webp', 'mint-4.webp', 'عمل تجريبي ٦', 2),
  w('w7', 'c2', 'purple-1.webp', 'purple-2.webp', 'عمل تجريبي ٧', 3),
  w('w8', 'c2', 'purple-3.webp', '', 'عمل تجريبي ٨', 4),
  w('w9', 'c3', 'blue-4.webp', 'blue-5.webp', 'عمل تجريبي ٩', 1),
  w('w10', 'c3', 'mint-5.webp', 'purple-4.webp', 'عمل تجريبي ١٠', 2),
  w('w11', 'c3', 'purple-5.webp', 'ember-2.webp', 'عمل تجريبي ١١', 3),
  w('w12', 'c3', 'ember-3.webp', '', 'عمل تجريبي ١٢', 4),
];

export const packages = [
  { id: 'p1', name: 'بكج تجريبي أول', logo_url: `${P}/ember-2.webp`, cover_url: `${P}/ember-3.webp`, sort: 1, published: true },
  { id: 'p2', name: 'بكج تجريبي ثانٍ', logo_url: `${P}/blue-1.webp`, cover_url: `${P}/blue-2.webp`, sort: 2, published: true },
  { id: 'p3', name: 'بكج تجريبي ثالث', logo_url: `${P}/mint-1.webp`, cover_url: `${P}/mint-2.webp`, sort: 3, published: true },
  { id: 'p4', name: 'بكج تجريبي رابع', logo_url: `${P}/purple-1.webp`, cover_url: `${P}/purple-2.webp`, sort: 4, published: true },
];

const img = (file, caption) => ({ type: 'image', url: `${P}/${file}`, poster: '', caption });

export const package_blocks = [
  { id: 'b1', package_id: 'p1', title: 'Highlight', sort: 1, images: [img('ember-2.webp', 'الغلاف'), img('ember-3.webp', 'لقطة')] },
  { id: 'b2', package_id: 'p1', title: 'اللوجو', sort: 2, images: [img('ember-4.webp', 'اللوجو')] },
  { id: 'b3', package_id: 'p1', title: 'موك أب', sort: 3, images: [img('ember-5.webp', 'موك أب ١'), img('blue-4.webp', 'موك أب ٢')] },
  { id: 'b4', package_id: 'p1', title: 'لوحة الألوان', sort: 4, images: [img('purple-4.webp', 'اللوحة')] },
  { id: 'b5', package_id: 'p2', title: 'Highlight', sort: 1, images: [img('blue-1.webp', 'الغلاف')] },
  { id: 'b6', package_id: 'p2', title: 'اللوجو', sort: 2, images: [img('blue-2.webp', 'اللوجو')] },
  { id: 'b7', package_id: 'p2', title: 'التطبيقات', sort: 3, images: [img('blue-3.webp', 'تطبيق ١'), img('blue-5.webp', 'تطبيق ٢')] },
  { id: 'b8', package_id: 'p3', title: 'Highlight', sort: 1, images: [img('mint-1.webp', 'الغلاف')] },
  { id: 'b9', package_id: 'p3', title: 'منشورات', sort: 2, images: [img('mint-2.webp', 'منشور ١'), img('mint-4.webp', 'منشور ٢')] },
  { id: 'b10', package_id: 'p3', title: 'ستوري', sort: 3, images: [img('mint-5.webp', 'ستوري')] },
  { id: 'b11', package_id: 'p4', title: 'Highlight', sort: 1, images: [img('purple-1.webp', 'الغلاف')] },
  { id: 'b12', package_id: 'p4', title: 'الهوية', sort: 2, images: [img('purple-3.webp', 'الهوية'), img('purple-5.webp', 'تفاصيل')] },
];

/* `price` حقل نصي حر — لا أسعار (قرار المالك). يكتب فيه ما يشاء. */
export const services = [
  { id: 's1', name: 'بوستر إعلاني', description: 'بوستر يوقف السكرول — تكوين بصري مدروس يعبّر عن عرضك بأقوى شكل ممكن.', price: 'تسليم خلال 3–5 أيام', icon: 'poster', sort: 1, published: true },
  { id: 's2', name: 'هوية بصرية', description: 'لوجو، ألوان، خطوط، ودليل استخدام — نظام بصري كامل يوحّد كل نقاط تواصلك.', price: 'تسليم خلال 10–14 يوماً', icon: 'identity', sort: 2, published: true },
  { id: 's3', name: 'تصميم شعار', description: 'شعار يعبّر عنك من أول نظرة — مبني على دراسة لا مجرد شكل حلو.', price: 'جولتا تعديل مجانيتان', icon: 'logo', sort: 3, published: true },
  { id: 's4', name: 'منشورات سوشيال ميديا', description: 'حزمة منشورات متسقة الهوية، جاهزة للنشر على كل المنصات.', price: 'حزم من 6 إلى 30 منشوراً', icon: 'social', sort: 4, published: true },
  { id: 's5', name: 'بنر إعلاني', description: 'بنرات للمتاجر والحملات بمقاسات جاهزة لكل منصة.', price: 'كل المقاسات في التسليم', icon: 'banner', sort: 5, published: true },
  { id: 's6', name: 'غلاف كتاب', description: 'غلاف يحكي محتوى الكتاب قبل أن يُفتح.', price: 'ملفات طباعة جاهزة', icon: 'book', sort: 6, published: true },
];

export const process_steps = [
  { id: 'ps1', name: 'نسمعك', description: 'ترسل طلبك بكل تفاصيل فكرتك — ونرد عليك خلال ساعات بأسئلة تخصّص الملامح.', sort: 1, published: true },
  { id: 'ps2', name: 'نبني الفكرة', description: 'نجهّز اتجاهاً بصرياً يناسب ذوقك وأهداف مشروعك — وتوافق عليه قبل أي تنفيذ.', sort: 2, published: true },
  { id: 'ps3', name: 'نصمم ونلمّس', description: 'أول مسودة تصلك في الوقت المتفق عليه، ومعها جولتا تعديل مجانيتان لضبط كل تفصيلة.', sort: 3, published: true },
  { id: 'ps4', name: 'نسلّم ونمضي', description: 'تستلم ملفاتك بجميع الصيغ، المفتوحة والجاهزة للنشر، مع حقوق استخدام كاملة.', sort: 4, published: true },
];

/* لوجو فقط — `name` للوصف البديل، و`note` لا يُعرض (قرار المالك). */
export const payment_methods = [
  { id: 'pm1', name: 'طريقة دفع ١', logo_url: '', note: '', sort: 1, published: true },
  { id: 'pm2', name: 'طريقة دفع ٢', logo_url: '', note: '', sort: 2, published: true },
  { id: 'pm3', name: 'طريقة دفع ٣', logo_url: '', note: '', sort: 3, published: true },
  { id: 'pm4', name: 'طريقة دفع ٤', logo_url: '', note: '', sort: 4, published: true },
];

/* ⚠️ آراء تجريبية بحتة — ليست لأشخاص حقيقيين. تُستبدل قبل النشر. */
export const testimonials = [
  { id: 't1', name: 'عميل تجريبي ١', role: 'نص تجريبي', rating: 5, text: 'هذا نص رأي تجريبي موضوع لتجربة الشكل فقط، ويُستبدل برأي حقيقي من لوحة المشرف.', sort: 1, published: true },
  { id: 't2', name: 'عميل تجريبي ٢', role: 'نص تجريبي', rating: 5, text: 'نص تجريبي ثانٍ بطول مختلف قليلاً للتأكد من أن البطاقة تتمدّد بلا كسر في التخطيط.', sort: 2, published: true },
  { id: 't3', name: 'عميل تجريبي ٣', role: 'نص تجريبي', rating: 4, text: 'نص تجريبي بتقييم أربع نجوم — لاختبار النجمة الفارغة.', sort: 3, published: true },
  { id: 't4', name: 'عميل تجريبي ٤', role: 'نص تجريبي', rating: 5, text: 'نص تجريبي رابع، قصير.', sort: 4, published: true },
  { id: 't5', name: 'عميل تجريبي ٥', role: 'نص تجريبي', rating: 5, text: 'نص تجريبي خامس، أطول قليلاً حتى نرى كيف تتصرف البطاقة مع فقرة كاملة من الكلام المتصل بلا فواصل واضحة.', sort: 5, published: true },
];

const order = (n, name, contact, service, status, read) => ({
  id: `o${n}`, order_number: `APX-1${String(n).padStart(3, '0')}`,
  service, services_json: null,
  items_json: { items: [{ id: 'oi1', name: service, qty: 1 }], custom: [] },
  name, contact, platform: 'واتساب', usage: 'تجاري — مشروع أو متجر',
  description: 'وصف تجريبي للطلب يشرح الفكرة المطلوبة بتفصيل كافٍ.',
  file_url: '', status, read,
  created_at: new Date(Date.now() - n * 86400000).toISOString(),
});

export const orders = [
  order(1, 'اسم تجريبي ١', '966500000001', 'بوستر إعلاني', 'new', false),
  order(2, 'اسم تجريبي ٢', '966500000002', 'هوية بصرية', 'in_progress', true),
  order(3, 'اسم تجريبي ٣', '966500000003', 'تصميم شعار', 'done', true),
  order(4, 'اسم تجريبي ٤', '966500000004', 'منشورات سوشيال ميديا', 'new', false),
  order(5, 'اسم تجريبي ٥', '966500000005', 'بنر إعلاني', 'cancelled', true),
  order(6, 'اسم تجريبي ٦', '966500000006', 'غلاف كتاب', 'new', false),
];

export const site_content = [
  { key: 'brand', value: 'aboal3z.dzn' },
  { key: 'status_badge', value: 'متاح لمشاريع جديدة' },
  { key: 'hero_title_1', value: 'خلّ براندك' },
  { key: 'hero_title_hl', value: 'يوقف' },
  { key: 'hero_title_2', value: 'السكرول.' },
  { key: 'hero_subtitle', value: 'استوديو تصميم بصري — بوسترات، هويات، ولوجوهات تُبنى على فكرة لا على ذوق عابر.' },
  { key: 'hero_cta', value: 'اطلب تصميمك' },
  { key: 'hero_cta_alt', value: 'شوف الشغل' },

  { key: 'about_label', value: 'من أنا' },
  { key: 'about_title', value: 'مصمم هوية بصرية' },
  { key: 'about_text', value: 'أشتغل على الهويات البصرية والشعارات، وأساعد البراندات الناشئة تبني حضوراً يُعرف من أول نظرة.' },

  { key: 'stats_label', value: 'أرقام' },
  { key: 'stat_1_value', value: '250' },
  { key: 'stat_1_label', value: 'عمل منجز' },
  { key: 'stat_2_value', value: '90' },
  { key: 'stat_2_label', value: 'عميل' },
  { key: 'stat_3_value', value: '6' },
  { key: 'stat_3_label', value: 'سنوات خبرة' },

  { key: 'works_title', value: 'الأعمال' },
  { key: 'works_sub', value: 'مرّ على أي عمل لتشوف النسخة الثانية منه.' },
  { key: 'packages_title', value: 'البكجات' },
  { key: 'packages_sub', value: 'حزم متكاملة جاهزة للانطلاق.' },
  { key: 'services_title', value: 'الخدمات' },
  { key: 'services_sub', value: 'ما نقدّمه، بوضوح وبلا مفاجآت.' },
  { key: 'process_title', value: 'كيف نشتغل' },
  { key: 'process_sub', value: 'من الفكرة إلى التسليم.' },
  { key: 'testimonials_title', value: 'قالوا عنا' },
  { key: 'testimonials_sub', value: 'آراء تجريبية — تُستبدل بآراء حقيقية.' },
  { key: 'payments_title', value: 'طرق الدفع' },
  { key: 'payments_sub', value: 'الدفع يتم خارج الموقع.' },

  { key: 'order_title', value: 'جاهز نبدأ؟' },
  { key: 'order_sub', value: 'أرسل طلبك وخلّ الباقي علينا.' },
  { key: 'order_cta', value: 'اطلب الآن' },

  { key: 'footer_text', value: 'استوديو تصميم بصري — نصنع أعمالاً تُوقف السكرول وتروي قصص برانداتها.' },
  { key: 'whatsapp', value: '966511572807' },
  { key: 'whatsapp_label', value: 'تواصل معنا' },
  { key: 'instagram', value: 'aboal3z.dzn' },
  { key: 'instagram_label', value: 'إلهام يومي' },
];

export const theme = [
  { key: 'c-accent', value: '#2563EB' },
  { key: 'fs-scale', value: '1' },
  { key: 's-scale', value: '1' },
  { key: 'fx-intensity', value: '1' },
];

export const overrides = [];

const lay = (key, sort, columns, align = 'stretch') => ({
  id: `l-${key}`, section_key: key, sort, columns, align,
  gap: 'var(--s-4)', bg_type: 'none', bg_value: '', visible: true,
});

export const layout = [
  lay('hero', 1, 1), lay('about', 2, 1), lay('works', 3, 1), lay('packages', 4, 1),
  lay('services', 5, 2), lay('process', 6, 1), lay('testimonials', 7, 1),
  lay('payments', 8, 4), lay('order', 9, 1), lay('footer', 10, 1),
];

export const custom_blocks = [];

export const order_items = [
  { id: 'oi1', name: 'بوستر', description: 'بوستر مفرد بمقاس واحد', unit_price: '', icon: 'poster', sort: 1, published: true },
  { id: 'oi2', name: 'لوجو', description: 'شعار بصيغه المفتوحة والجاهزة', unit_price: '', icon: 'logo', sort: 2, published: true },
  { id: 'oi3', name: 'بنر', description: 'بنر بمقاسات المنصات', unit_price: '', icon: 'banner', sort: 3, published: true },
  { id: 'oi4', name: 'هوية كاملة', description: 'لوجو وألوان وخطوط ودليل', unit_price: '', icon: 'identity', sort: 4, published: true },
  { id: 'oi5', name: 'منشور سوشيال', description: 'منشور واحد جاهز للنشر', unit_price: '', icon: 'social', sort: 5, published: true },
];
