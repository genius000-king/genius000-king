-- ============================================================
-- 05-order-options.sql — خيارات معالج الطلب: المنصّات وأوجه الاستخدام.
-- شغّله بعد 01-schema.sql و02-security.sql.
-- آمن لإعادة التشغيل: كل شيء IF NOT EXISTS، والقيم الافتراضية
-- تُدرَج مرّة واحدة فقط (شرط أن يكون الجدول فارغاً).
--
-- لماذا هذا الملف: هذان الحقلان كانا مكتوبين يدوياً داخل
-- site/js/panels/order-wizard.js فلا يقدر المشرف تعديلهما. الآن
-- صارا جدولين يديرهما من اللوحة تماماً مثل بنود الطلب (order_items).
-- ============================================================

-- ── منصّات التواصل المعروضة في الخطوة الثالثة من المعالج ──
create table if not exists public.order_platforms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  sort       int  not null default 0,
  published  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── أوجه الاستخدام المعروضة في نفس الخطوة ──
create table if not exists public.order_usages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  sort       int  not null default 0,
  published  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── محفّز updated_at لكل من الجدولين ──
do $$
declare t text;
begin
  foreach t in array array['order_platforms', 'order_usages'] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$I;
       create trigger touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ── تفعيل RLS ──
alter table public.order_platforms enable row level security;
alter table public.order_usages    enable row level security;

-- ── نفس نمط جداول الكتالوج: قراءة عامة للمنشور، وكل شيء للمشرف ──
do $$
declare t text;
begin
  foreach t in array array['order_platforms', 'order_usages'] loop
    execute format('drop policy if exists "read published" on public.%I;', t);
    execute format(
      'create policy "read published" on public.%I
         for select to anon using (published = true);', t);

    execute format('drop policy if exists "admin all" on public.%I;', t);
    execute format(
      'create policy "admin all" on public.%I
         for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ── القيم الحالية الأربع من كل نوع — حتى لا يفقد الموقع خياراته
--    لحظة التحويل من الثوابت المكتوبة في الكود إلى الجدول. تُدرَج
--    مرّة واحدة فقط: فقط إن كان الجدول فارغاً حالياً. ──
insert into public.order_platforms (name, sort, published)
select v.name, v.sort, true
from (values
  ('واتساب',        1),
  ('انستقرام',      2),
  ('سناب شات',      3),
  ('بريد إلكتروني', 4)
) as v(name, sort)
where not exists (select 1 from public.order_platforms);

insert into public.order_usages (name, sort, published)
select v.name, v.sort, true
from (values
  ('تجاري — مشروع أو متجر',    1),
  ('شخصي — هدية أو مناسبة',    2),
  ('فعالية — حفل أو مؤتمر',    3),
  ('محتوى — سوشيال ميديا',     4)
) as v(name, sort)
where not exists (select 1 from public.order_usages);
