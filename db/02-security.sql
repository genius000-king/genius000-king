-- ============================================================
-- 02-security.sql — سياسات الأمان (RLS).
-- شغّله بعد 01-schema.sql.
--
-- القاعدة: الزائر يقرأ المحتوى المنشور فقط، ويستطيع إنشاء طلب،
--          ولا يستطيع قراءة الطلبات ولا تعديل أي شيء.
--          المشرف (مستخدم مسجَّل الدخول) يفعل كل شيء.
--
-- ⚠️ هذه السياسات هي الحماية الحقيقية — لا إخفاء المفتاح anon،
--    فهو مفتاح عام مصمَّم ليعيش في المتصفح.
-- ============================================================

-- تفعيل RLS على كل الجداول
do $$
declare t text;
begin
  foreach t in array array[
    'site_content','theme','overrides','layout','collections','works',
    'packages','package_blocks','services','process_steps',
    'payment_methods','testimonials','order_items','orders'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ── 1) جداول المحتوى: قراءة عامة للمنشور، وكل شيء للمشرف ──
do $$
declare t text;
begin
  -- جداول عليها عمود published
  foreach t in array array[
    'collections','works','packages','services',
    'process_steps','payment_methods','testimonials','order_items'
  ] loop
    execute format('drop policy if exists "read published" on public.%I;', t);
    execute format(
      'create policy "read published" on public.%I
         for select to anon using (published = true);', t);

    execute format('drop policy if exists "admin all" on public.%I;', t);
    execute format(
      'create policy "admin all" on public.%I
         for all to authenticated using (true) with check (true);', t);
  end loop;

  -- جداول بلا published: قراءة عامة كاملة
  foreach t in array array['site_content','theme','overrides','layout','package_blocks'] loop
    execute format('drop policy if exists "read all" on public.%I;', t);
    execute format(
      'create policy "read all" on public.%I for select to anon using (true);', t);

    execute format('drop policy if exists "admin all" on public.%I;', t);
    execute format(
      'create policy "admin all" on public.%I
         for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ── 2) الطلبات: الزائر ينشئ فقط ولا يقرأ ──
drop policy if exists "anon can create order" on public.orders;
create policy "anon can create order" on public.orders
  for insert to anon with check (
    char_length(name) between 1 and 120
    and char_length(contact) between 1 and 160
    and char_length(description) <= 2000
    and status = 'new'
    and read = false
  );

drop policy if exists "admin reads orders" on public.orders;
create policy "admin reads orders" on public.orders
  for all to authenticated using (true) with check (true);

-- ── 3) حاوية الملفات ──
-- أنشئ حاوية عامة اسمها media من: Storage ← New bucket ← Public
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

-- الزائر يرفع مرفقات الطلب فقط، داخل مجلد orders/
drop policy if exists "anon upload order files" on storage.objects;
create policy "anon upload order files" on storage.objects
  for insert to anon with check (
    bucket_id = 'media' and (storage.foldername(name))[1] = 'orders'
  );

drop policy if exists "admin manages media" on storage.objects;
create policy "admin manages media" on storage.objects
  for all to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
