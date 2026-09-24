// نظام الخطوط: كل خط له "شخصية" ودور، لا نختار خطاً لأنه جميل فقط.
// الخطوط مضمّنة محلياً (fontsource) — لا تعتمد على الإنترنت وقت الرندر.
import { continueRender, delayRender } from "remotion";

import "@fontsource/lalezar/arabic-400.css";
import "@fontsource/lalezar/latin-400.css";
import "@fontsource/rakkas/arabic-400.css";
import "@fontsource/reem-kufi/arabic-700.css";
import "@fontsource/reem-kufi/arabic-400.css";
import "@fontsource/aref-ruqaa/arabic-700.css";
import "@fontsource/handjet/arabic-400.css";
import "@fontsource/handjet/arabic-700.css";
import "@fontsource/handjet/latin-400.css";
import "@fontsource/handjet/latin-700.css";
import "@fontsource/blaka/arabic-400.css";
import "@fontsource/marhey/arabic-700.css";
import "@fontsource/noto-kufi-arabic/arabic-900.css";
import "@fontsource/noto-kufi-arabic/arabic-500.css";
import "@fontsource/amiri/arabic-700.css";
import "@fontsource/el-messiri/arabic-700.css";
import "@fontsource/readex-pro/arabic-600.css";
import "@fontsource/readex-pro/arabic-300.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/crimson-pro/latin-500.css";
import "@fontsource/crimson-pro/latin-500-italic.css";
import "@fontsource/jetbrains-mono/latin-500.css";

/** الأدوار — استعمل الدور لا اسم الخط، فيتغيّر الطابع كلّه من مكان واحد */
export const FONT = {
  /** العنوان الثقيل — كما في صورة "الموائع": كتلة سوداء لها وزن */
  display: "'Lalezar', sans-serif",
  /** عناوين بطابع خطّ يدوي عريض — للجمل الانفعالية */
  punch: "'Rakkas', serif",
  /** كوفي هندسي — للتقنية والأنظمة */
  kufi: "'Reem Kufi', sans-serif",
  /** رقعة — للاقتباسات والجمل التي لها روح */
  ruqaa: "'Aref Ruqaa', serif",
  /** بكسلي/رقمي — للكود، الأرقام، الشاشات، الآلة الكاتبة */
  digital: "'Handjet', monospace",
  /** قوطي عربي — للتحذير، الدراما، "الجانب المظلم" */
  gothic: "'Blaka', serif",
  /** مرح دائري — للمعلومة الخفيفة */
  playful: "'Marhey', sans-serif",
  /** كوفي حديث ثقيل جداً — للأرقام الضخمة والعناوين الحديثة */
  heavy: "'Noto Kufi Arabic', sans-serif",
  /** نسخ كلاسيكي — للنصوص العلمية والتعريفات */
  naskh: "'Amiri', serif",
  /** نص قراءة نظيف — للترجمة والشروح */
  body: "'Readex Pro', sans-serif",
  ui: "'IBM Plex Sans Arabic', sans-serif",
  /** لاتيني سيريف أنيق — مثل Fluids في الصورة */
  serif: "'Crimson Pro', serif",
  serifDisplay: "'Instrument Serif', serif",
  mono: "'JetBrains Mono', monospace",
} as const;

const FACES = [
  "400 40px Lalezar", "400 40px Rakkas", "700 40px 'Reem Kufi'", "400 40px 'Reem Kufi'",
  "700 40px 'Aref Ruqaa'", "400 40px Handjet", "700 40px Handjet", "400 40px Blaka",
  "700 40px Marhey", "900 40px 'Noto Kufi Arabic'", "500 40px 'Noto Kufi Arabic'",
  "700 40px Amiri", "600 40px 'Readex Pro'", "300 40px 'Readex Pro'", "500 40px 'IBM Plex Sans Arabic'",
  "400 40px 'Instrument Serif'", "italic 400 40px 'Instrument Serif'", "500 40px 'Crimson Pro'",
  "italic 500 40px 'Crimson Pro'", "500 40px 'JetBrains Mono'",
];

// fontsource يستخدم unicode-range، فالخط لا يُحمَّل حتى يُستعمل. نجبره على التحميل
// قبل أول فريم، وإلا ظهر فريم أو اثنان بخط احتياطي (عيب يفضح أي مونتاج).
let loaded = false;
export const ensureFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const h = delayRender("fonts");
  Promise.all(FACES.flatMap((f) => [document.fonts.load(f, "العربية"), document.fonts.load(f, "Latin 123")]))
    .then(() => document.fonts.ready)
    .then(() => continueRender(h))
    .catch(() => continueRender(h));
};
