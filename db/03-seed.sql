-- ============================================================
-- 03-seed.sql — البذرة الأولى.
--
-- ما تزرعه: مفاتيح النصوص وترتيب الأقسام وقالب رسالة واتساب —
-- أي الهيكل الذي بدونه تبدأ اللوحة فارغة بلا حقول.
--
-- ما لا تزرعه عمداً: أعمال أو بكجات أو آراء وهمية. تلك تُضاف من
-- لوحة التحكم ببياناتك الحقيقية.
--
-- شغّله بعد 02-security.sql. آمن لإعادة التشغيل: يحدّث ولا يكرّر.
-- ============================================================

-- ── ترتيب الأقسام ──
insert into public.layout (section_key, sort, columns, visible) values
  ('hero', 1, 2, true), ('about', 2, 2, true), ('works', 3, 4, true),
  ('packages', 4, 4, true), ('services', 5, 3, true), ('process', 6, 4, true),
  ('testimonials', 7, 3, true), ('payments', 8, 4, true), ('order', 9, 1, true)
on conflict (section_key) do nothing;

-- ── نصوص الموقع ──
-- عدّلها كلها من: لوحة التحكم ← نصوص الموقع
insert into public.site_content (key, value) values
  ('brand', 'aboal3z.dzn'),
  ('status_badge', 'متاح لمشاريع جديدة'),

  ('hero_title_1', 'خلّ براندك'),
  ('hero_title_hl', 'يوقف'),
  ('hero_title_2', 'السكرول.'),
  ('hero_subtitle', 'استوديو تصميم بصري — بوسترات، هويات، ولوجوهات تُبنى على فكرة لا على ذوق عابر.'),
  ('hero_cta', 'اطلب تصميمك'),
  ('hero_cta_alt', 'شوف الشغل'),

  ('about_label', 'من أنا'),
  ('about_title', 'مصمم هوية بصرية'),
  ('about_text', 'أشتغل على الهويات البصرية والشعارات، وأساعد البراندات الناشئة تبني حضوراً يُعرف من أول نظرة.'),
  ('stat_1_value', '250'), ('stat_1_label', 'عمل منجز'),
  ('stat_2_value', '90'),  ('stat_2_label', 'عميل'),
  ('stat_3_value', '6'),   ('stat_3_label', 'سنوات خبرة'),

  ('works_title', 'الأعمال'),
  ('works_sub', 'مرّ على أي عمل لتشوف النسخة الثانية منه.'),
  ('packages_title', 'البكجات'),
  ('packages_sub', 'حزم متكاملة جاهزة للانطلاق.'),
  ('services_title', 'الخدمات'),
  ('services_sub', 'ما نقدّمه، بوضوح وبلا مفاجآت.'),
  ('process_title', 'كيف نشتغل'),
  ('process_sub', 'من الفكرة إلى التسليم.'),
  ('testimonials_title', 'قالوا عنا'),
  ('testimonials_sub', 'آراء عملاء حقيقيين.'),
  ('payments_title', 'طرق الدفع'),
  ('payments_sub', 'الدفع يتم خارج الموقع.'),
  ('payments_note', ''),

  ('order_title', 'جاهز نبدأ؟'),
  ('order_sub', 'أرسل طلبك وخلّ الباقي علينا.'),
  ('order_cta', 'اطلب الآن'),
  ('package_cta', 'اطلب هذا البكج'),
  ('order_prefix', 'APX'),

  ('footer_text', 'استوديو تصميم بصري — نصنع أعمالاً تُوقف السكرول وتروي قصص برانداتها.'),
  ('footer_legal', 'كل الحقوق محفوظة.'),

  -- ⚠️ ضع رقمك الحقيقي هنا، أو من: لوحة التحكم ← الإعدادات ← التواصل
  ('whatsapp', ''),
  ('whatsapp_label', 'تواصل معنا'),
  ('instagram', ''),
  ('instagram_label', 'إلهام يومي'),
  ('x', ''),
  ('email', ''),

  ('seo_title', 'aboal3z.dzn — استوديو تصميم بصري'),
  ('seo_description', 'بوسترات، هويات بصرية، وشعارات تُبنى على فكرة لا على ذوق عابر.')
on conflict (key) do nothing;

-- ── قالب رسالة واتساب ──
-- عدّله من: لوحة التحكم ← الإعدادات ← رسالة واتساب (مع معاينة حيّة)
insert into public.site_content (key, value) values ('wa_template',
E'🧾 *طلب جديد — {{order_number}}*\n'
 '━━━━━━━━━━━━━━━\n'
 '\n'
 '👤 الاسم: {{name}}\n'
 '📱 التواصل: {{contact}} · {{platform}}\n'
 '🎯 الاستخدام: {{usage}}\n'
 '\n'
 '📦 *البنود*\n'
 '{{items}}\n'
 'الإجمالي: {{total_units}} بنداً\n'
 '\n'
 '📝 *الفكرة*\n'
 '{{description}}\n'
 '{{#attachments}}\n'
 '🖼 *المرفقات ({{attachments_count}})*\n'
 '{{attachments}}\n'
 '{{/attachments}}\n'
 '\n'
 '⏱ {{date}} · {{time}}\n'
 '━━━━━━━━━━━━━━━\n'
 'أُرسل من {{brand}}')
on conflict (key) do nothing;

-- ── بنود الطلب: نقطة انطلاق، عدّلها من الكتالوج ──
insert into public.order_items (name, description, icon, sort, published) values
  ('بوستر إعلاني',   'بوستر واحد بمقاسات السوشيال',  'poster',   1, true),
  ('تصميم شعار',     'شعار كامل بملفات المصدر',      'logo',     2, true),
  ('هوية بصرية',     'شعار وألوان وخطوط ودليل',      'identity', 3, true),
  ('منشورات سوشيال', 'حزمة منشورات لحساباتك',        'social',   4, true),
  ('بنر إعلاني',     'بنر ويب أو إعلان مدفوع',       'banner',   5, true),
  ('غلاف كتاب',      'غلاف أمامي وخلفي وكعب',        'book',     6, true)
on conflict do nothing;

-- ── خطوات العمل ──
insert into public.process_steps (name, description, sort, published) values
  ('نسمعك',       'ترسل طلبك بكل تفاصيل فكرتك ومراجعك.',        1, true),
  ('نبني الفكرة', 'نحوّل ما قلته إلى اتجاه بصري واضح.',          2, true),
  ('نصمم ونلمّس', 'نشتغل على التنفيذ ونراجع معك حتى تُعجبك.',    3, true),
  ('نسلّم ونمضي', 'تستلم الملفات بكل المقاسات وصيغ المصدر.',     4, true)
on conflict do nothing;
