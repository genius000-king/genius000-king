-- ============================================================
-- 01-schema.sql — الجداول.
-- شغّله أولاً في: Supabase ← SQL Editor ← New query ← Run
-- آمن لإعادة التشغيل: كل شيء IF NOT EXISTS.
-- ============================================================

create extension if not exists "pgcrypto";

-- دالة تحديث updated_at تلقائياً
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── نصوص الموقع: مفتاح ← قيمة ──
create table if not exists public.site_content (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ── الثيم: متغيّرات CSS يتجاوز بها المشرف القيم الافتراضية ──
create table if not exists public.theme (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ── تجاوزات بصرية لكل عنصر ولكل نقطة توقف ──
create table if not exists public.overrides (
  id         uuid primary key default gen_random_uuid(),
  target     text not null,
  prop       text not null,
  value      text not null,
  breakpoint text not null default 'all'
             check (breakpoint in ('all','mobile','tablet','desktop')),
  updated_at timestamptz not null default now(),
  unique (target, prop, breakpoint)
);

-- ── ترتيب الأقسام وإظهارها ──
create table if not exists public.layout (
  id          uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  sort        int  not null default 99,
  columns     int  not null default 2 check (columns between 1 and 6),
  align       text not null default 'stretch',
  gap         text not null default '',
  bg_type     text not null default 'none'
              check (bg_type in ('none','color','gradient','image')),
  bg_value    text not null default '',
  visible     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ── المعارض ──
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  sort       int  not null default 0,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── الأعمال ──
create table if not exists public.works (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid references public.collections(id) on delete set null,
  title           text not null default '',
  subtitle        text not null default '',
  description     text not null default '',
  alt             text not null default '',
  image_url       text not null default '',
  image_hover_url text not null default '',
  gallery         jsonb not null default '[]'::jsonb,
  featured        boolean not null default false,
  sort            int  not null default 0,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists works_collection_idx on public.works (collection_id, sort);

-- ── البكجات ──
create table if not exists public.packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  logo_url    text not null default '',
  cover_url   text not null default '',
  color_a     text not null default '#3B6EF6',
  color_b     text not null default '#7C5CFF',
  sort        int  not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── كتل البكج: هنا تعيش تقسيمة البينتو ──
create table if not exists public.package_blocks (
  id         uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  title      text not null default '',
  note       text not null default '',
  images     jsonb not null default '[]'::jsonb,   -- [{url,w,h,caption,span,type}]
  layout     text not null default 'auto'
             check (layout in ('auto','mosaic','hero','strip','pair','trio','manual')),
  fill_gaps  boolean not null default true,
  cols       int not null default 12 check (cols between 4 and 12),
  cols_m     int not null default 4  check (cols_m between 2 and 6),
  unit       int not null default 110 check (unit between 40 and 300),
  gap        int not null default 12 check (gap between 0 and 48),
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists package_blocks_pkg_idx on public.package_blocks (package_id, sort);

-- ── الخدمات ──
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  price       text not null default '',
  icon        text not null default 'sparkle',
  sort        int  not null default 0,
  published   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ── خطوات العمل ──
create table if not exists public.process_steps (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  sort        int  not null default 0,
  published   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ── طرق الدفع (عرض فقط — لا معالجة دفع) ──
create table if not exists public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  logo_url   text not null default '',
  sort       int  not null default 0,
  published  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── الآراء ──
create table if not exists public.testimonials (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  role       text not null default '',
  text       text not null default '',
  rating     int  not null default 5 check (rating between 1 and 5),
  sort       int  not null default 0,
  published  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── بنود الطلب (كتالوج المعالج) ──
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  description text not null default '',
  icon        text not null default 'sparkle',
  sort        int  not null default 0,
  published   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ── الطلبات ──
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique,
  service             text not null default '',
  items_json          jsonb not null default '{}'::jsonb,
  name                text not null default '',
  contact             text not null default '',
  contact_normalized  text not null default '',
  platform            text not null default '',
  usage               text not null default '',
  description         text not null default '',
  attachments         jsonb not null default '[]'::jsonb,
  total_units         int  not null default 0,
  channel             text not null default 'whatsapp',
  status              text not null default 'new'
                      check (status in ('new','in_progress','done','cancelled')),
  read                boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx  on public.orders (status);

-- ── محفّزات updated_at لكل جدول ──
do $$
declare t text;
begin
  foreach t in array array[
    'site_content','theme','overrides','layout','collections','works',
    'packages','package_blocks','services','process_steps',
    'payment_methods','testimonials','order_items','orders'
  ] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$I;
       create trigger touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;
