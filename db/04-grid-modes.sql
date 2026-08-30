-- ============================================================
-- 04-grid-modes.sql — أنماط الشبكة المنتظمة لكتل البكجات.
-- شغّله بعد 01-schema.sql. آمن لإعادة التشغيل.
--
-- عمود package_blocks.layout عليه قيد check يعدّد الأنماط المسموحة،
-- فبلا توسيعه تُرفض الأنماط الجديدة عند الحفظ من اللوحة برسالة
-- «new row violates check constraint» — والمشرف لا يفهم لماذا.
-- ============================================================

alter table public.package_blocks
  drop constraint if exists package_blocks_layout_check;

alter table public.package_blocks
  add constraint package_blocks_layout_check
  check (layout in (
    -- بينتو حرّ (كما كان)
    'auto', 'mosaic', 'hero', 'strip', 'pair', 'trio', 'manual',
    -- شبكات منتظمة بخلايا مربّعة متساوية
    'grid2', 'grid3', 'grid4', 'grid5', 'grid6'
  ));

-- المعرض الأفقي أُضيف بعد الشبكات
alter table public.package_blocks
  drop constraint if exists package_blocks_layout_check;

alter table public.package_blocks
  add constraint package_blocks_layout_check
  check (layout in (
    'auto', 'mosaic', 'hero', 'strip', 'pair', 'trio', 'manual',
    'grid2', 'grid3', 'grid4', 'grid5', 'grid6', 'gallery'
  ));
