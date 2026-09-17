// ============================================================
// whatsapp.js — بناء رسالة الطلب وتسليمها لواتساب.
//
// ⚠️ حقيقة تقنية: رابط wa.me لا يدعم إرفاق صور — نصاً فقط. هذا قيد من
//    واتساب نفسه. لذلك ثلاثة مستويات، والأول يوصّل الصور فعلياً:
//      أ) navigator.share({files})  → الصور والنص معاً في محادثة واحدة
//      ب) رفع الصور ووضع روابطها داخل النص ثم فتح wa.me
//      ج) نسخ النص للحافظة وفتح wa.me بالنص الأساسي
//
// القالب نفسه يُحرَّر من لوحة المشرف (مفتاح `wa_template` في site_content)
// فيغيّر المالك الصيغة والجمل بلا لمس الكود.
// ============================================================

/** القالب الافتراضي — يُستعمل حين لا يضع المشرف قالباً خاصاً. */
export const DEFAULT_TEMPLATE = [
  '🧾 *طلب جديد — {{order_number}}*',
  '━━━━━━━━━━━━━━━',
  '',
  '👤 الاسم: {{name}}',
  '📱 التواصل: {{contact}} · {{platform}}',
  '🎯 الاستخدام: {{usage}}',
  '',
  '📦 *البنود*',
  '{{items}}',
  'الإجمالي: {{total_units}} بنداً',
  '',
  '📝 *الفكرة*',
  '{{description}}',
  '{{#attachments}}',
  '🖼 *المرفقات ({{attachments_count}})*',
  '{{attachments}}',
  '{{/attachments}}',
  '',
  '⏱ {{date}} · {{time}}',
  '━━━━━━━━━━━━━━━',
  'أُرسل من {{brand}}',
].join('\n');

/** المتغيّرات المتاحة في القالب — تُعرض للمشرف في اللوحة. */
export const TEMPLATE_VARS = [
  ['order_number', 'رقم الطلب'],
  ['name', 'اسم العميل'],
  ['contact', 'وسيلة التواصل'],
  ['platform', 'المنصة المفضّلة'],
  ['usage', 'نوع الاستخدام'],
  ['items', 'قائمة البنود (سطر لكل بند)'],
  ['items_count', 'عدد البنود'],
  ['total_units', 'مجموع القطع'],
  ['description', 'وصف الفكرة'],
  ['attachments', 'روابط المرفقات'],
  ['attachments_count', 'عدد المرفقات'],
  ['date', 'التاريخ'],
  ['time', 'الوقت'],
  ['brand', 'اسم الاستوديو'],
  ['site', 'رابط الموقع'],
];

/** رقم طلب فريد: طابع زمني بالأساس 36 + عشوائي. */
export function genOrderNumber(prefix = 'APX') {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${prefix}-${t}${r}`;
}

/** ينظّف رقم الهاتف ويطبّعه لصيغة دولية بلا رموز. */
export function normalizePhone(raw, countryCode = '966') {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = countryCode + d.slice(1);      // 05… → 9665…
  else if (d.length <= 9) d = countryCode + d;              // 5…   → 9665…
  return d;
}

/** هل يبدو هذا رقم هاتف صالحاً؟ */
export function isPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15;
}

/**
 * يعبّئ القالب. يدعم أقساماً شرطية {{#key}}…{{/key}} تُحذف إن كانت القيمة فارغة.
 * دالة خالصة — قابلة للاختبار وحدها.
 */
export function fillTemplate(template, vars = {}) {
  let out = String(template || DEFAULT_TEMPLATE);

  // الأقسام الشرطية أولاً
  out = out.replace(/\{\{#(\w+)\}\}\n?([\s\S]*?)\{\{\/\1\}\}\n?/g,
    (_, key, body) => (vars[key] ? body : ''));

  // ثم المتغيّرات
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });

  // تنظيف الأسطر الفارغة المتتالية
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** يبني كائن المتغيّرات من حالة الطلب. */
export function buildVars(order = {}, { brand = '', site = '' } = {}) {
  const lines = order.lines || [];
  const files = (order.attachments || []).filter(Boolean);
  const now = new Date(order.created_at || Date.now());

  return {
    order_number: order.order_number || '',
    name: order.name || '',
    contact: order.contact || '',
    platform: order.platform || '',
    usage: order.usage || '',
    items: lines.map((l) => `• ${l.name} ×${l.qty}${l.custom ? ' (طلب خاص)' : ''}`).join('\n'),
    items_count: String(lines.length),
    total_units: String(lines.reduce((s, l) => s + Number(l.qty || 0), 0)),
    description: order.description || '',
    attachments: files.map((u, i) => `${i + 1}) ${u}`).join('\n'),
    attachments_count: String(files.length),
    date: now.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false }),
    brand,
    site,
  };
}

/** الحد العملي لطول رابط wa.me قبل أن تبدأ المتصفحات بقصّه. */
export const MAX_URL_TEXT = 1800;

/** يبني الرابط النهائي، ويقصّر المرفقات إن طال النص. */
export function buildWhatsAppUrl(phone, text) {
  const to = normalizePhone(phone);
  let body = String(text || '');
  if (encodeURIComponent(body).length > MAX_URL_TEXT * 3) {
    body = body.slice(0, MAX_URL_TEXT) + '\n…';
  }
  const encoded = encodeURIComponent(body);
  return to ? `https://wa.me/${to}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/** هل يستطيع الجهاز مشاركة ملفات أصلياً؟ (المستوى أ) */
export function canShareFiles(files = []) {
  if (!files.length) return false;
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try { return navigator.canShare({ files }); } catch { return false; }
}

/** المستوى أ — ورقة المشاركة الأصلية: الصور والنص معاً. */
export async function shareNative(files, text, title = 'طلب جديد') {
  await navigator.share({ files, text, title });
  return 'native';
}

/** نسخ احتياطي للحافظة (المستوى ج). */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}
