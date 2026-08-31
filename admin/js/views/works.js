// works.js — المعارض والأعمال: إضافة، ترتيب بالسحب، نشر، رفع صور.
import { el } from '../core/dom.js';
import { get, setAll, reload } from '../core/store.js';
import { insert, update, remove } from '../core/api.js';
import { save } from '../core/autosave.js';
import { toast } from '../core/toast.js';
import { icon } from '../ui/icon.js';
import { makeSortable } from '../ui/sortable.js';
import { openDrawer, closeDrawer } from '../ui/drawer.js';
import { confirmDelete, confirmModal } from '../ui/modal.js';
import { fld, text, textarea, toggle, select, emptyState } from '../ui/fields.js';
import { imageField, dropzone, mediaTile } from '../ui/media.js';
import { record } from '../core/history.js';

const sorted = (rows) => rows.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

/* ── محرّر عمل واحد ── */
function editWork(work, done) {
  const w = { ...work };
  const patch = (k, v) => { w[k] = v; save('works', w.id, { [k]: v }).catch((e) => toast(`تعذّر الحفظ: ${e.message}`, 'error')); Object.assign(work, { [k]: v }); };

  const gallery = el('div', { class: 'media-grid' });
  const drawGallery = () => {
    const list = Array.isArray(w.gallery) ? w.gallery : [];
    gallery.replaceChildren(...list.map((g) => mediaTile(g, (item) => {
      w.gallery = list.filter((x) => x !== item);
      patch('gallery', w.gallery);
      drawGallery();
    })));
  };
  drawGallery();

  const collections = sorted(get('collections'));

  openDrawer({
    title: work.title || 'عمل جديد',
    sub: 'الحفظ تلقائي',
    body: el('div', { class: 'stack stack--lg' }, [
      fld('العنوان', text(w.title, (v) => patch('title', v), { label: 'العنوان' })),
      fld('سطر فرعي', text(w.subtitle, (v) => patch('subtitle', v), { label: 'سطر فرعي' }), 'سنة أو نوع المشروع'),
      fld('المعرض', select(w.collection_id, collections.map((c) => [c.id, c.name]),
        (v) => patch('collection_id', v), { label: 'المعرض' })),
      fld('الوصف', textarea(w.description, (v) => patch('description', v), { rows: 3, label: 'الوصف' })),
      fld('الصورة الرئيسية', imageField(w.image_url, 'works', (v) => patch('image_url', v), 'صورة العمل')),
      fld('صورة التبديل عند المرور', imageField(w.image_hover_url, 'works',
        (v) => patch('image_hover_url', v), 'صورة ثانية'), 'اختيارية — تظهر عند مرور المؤشر'),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [el('span', { class: 'card__title grow' }, ['صور إضافية']),
          el('span', { class: 'card__hint' }, ['تظهر داخل لوحة العمل'])]),
        gallery,
        dropzone('works', (items) => {
          w.gallery = [...(w.gallery || []), ...items];
          patch('gallery', w.gallery);
          drawGallery();
        }),
      ]),
      el('div', { class: 'row' }, [
        toggle(w.published !== false, (v) => patch('published', v), 'منشور'),
        el('span', { class: 'spacer' }),
        toggle(!!w.featured, (v) => patch('featured', v), 'مميّز — يظهر في الجدار الأعلى'),
      ]),
    ]),
    foot: el('div', { class: 'row grow' }, [
      el('button', { class: 'btn grow', type: 'button', onclick: () => closeDrawer() }, ['تم']),
      el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
        if (!await confirmDelete(work.title || 'هذا العمل')) return;
        await remove('works', work.id);
        setAll('works', get('works').filter((x) => x.id !== work.id));
        record(`حذف العمل «${work.title}»`, async () => {
          const back = await insert('works', { ...work, id: undefined });
          setAll('works', [...get('works'), back]);
          done();
        });
        closeDrawer();
        toast('حُذف العمل', 'success');
        done();
      } }, [icon('trash', { size: 15 })]),
    ]),
    onClose: done,
  });
}

/* ── محرّر المعارض ── */
function editCollections(done) {
  const list = el('div', { class: 'sortable' });

  const draw = () => {
    const rows = sorted(get('collections'));
    list.replaceChildren(...rows.map((c) => el('div', { class: 'sort-row', 'data-id': c.id }, [
      el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
      text(c.name, (v) => { c.name = v; save('collections', c.id, { name: v }); }, { label: 'اسم المعرض' }),
      toggle(c.published !== false, (v) => { c.published = v; save('collections', c.id, { published: v }); }),
      el('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': `حذف ${c.name}`,
        onclick: async () => {
          const n = get('works').filter((w) => w.collection_id === c.id).length;
          if (!await confirmDelete(c.name, n ? `يحتوي ${n} عملاً سيبقى بلا معرض.` : '')) return;
          await remove('collections', c.id);
          setAll('collections', get('collections').filter((x) => x.id !== c.id));
          draw(); done();
        } }, [icon('trash', { size: 15 })]),
    ])));
    makeSortable(list, (ids) => {
      ids.forEach((id, i) => save('collections', id, { sort: i + 1 }));
      setAll('collections', get('collections').map((c) => ({ ...c, sort: ids.indexOf(c.id) + 1 })));
    });
  };
  draw();

  openDrawer({
    title: 'المعارض', sub: 'اسحب لإعادة الترتيب',
    body: el('div', { class: 'stack' }, [
      list,
      el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
        const row = await insert('collections', {
          name: 'معرض جديد', sort: get('collections').length + 1, published: false });
        setAll('collections', [...get('collections'), row]);
        draw(); done();
      } }, [icon('plus', { size: 16 }), 'أضف معرضاً']),
    ]),
    onClose: done,
  });
}

/* ── العرض ── */
export function render(host) {
  const wrap = el('div');
  const draw = () => {
    const works = sorted(get('works'));
    const cols = Object.fromEntries(get('collections').map((c) => [c.id, c.name]));
    const list = el('div', { class: 'sortable' });

    list.replaceChildren(...works.map((w) => el('div', { class: 'sort-row', 'data-id': w.id }, [
      el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
      w.image_url
        ? el('img', { class: 'thumb-sm', src: w.image_url, alt: '', loading: 'lazy' })
        : el('span', { class: 'thumb-sm' }),
      el('button', { class: 'link grow', type: 'button', style: { textAlign: 'start' },
        onclick: () => editWork(w, draw) }, [w.title || 'بلا عنوان']),
      el('span', { class: 'fld__hint nowrap' }, [cols[w.collection_id] || '—']),
      w.featured ? el('span', { class: 'badge badge--new' }, ['مميّز']) : null,
      toggle(w.published !== false, (v) => { w.published = v; save('works', w.id, { published: v }); }),
    ])));

    makeSortable(list, (ids) => {
      ids.forEach((id, i) => save('works', id, { sort: i + 1 }));
      setAll('works', get('works').map((w) => ({ ...w, sort: ids.indexOf(w.id) + 1 })));
      toast('حُفظ الترتيب', 'success');
    });

    wrap.replaceChildren(el('div', { class: 'view' }, [
      el('div', { class: 'view__head' }, [
        el('div', {}, [
          el('h1', { class: 'view__title' }, ['الأعمال']),
          el('p', { class: 'view__sub' }, [`${works.length} عملاً · ${get('collections').length} معارض`]),
        ]),
        el('div', { class: 'view__actions' }, [
          el('button', { class: 'btn', type: 'button', onclick: () => editCollections(draw) },
            [icon('list', { size: 15 }), 'المعارض']),
          el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
            if (!get('collections').length) {
              await confirmModal({ title: 'أنشئ معرضاً أولاً', body: 'كل عمل يجب أن ينتمي إلى معرض.', confirm: 'حسناً', cancel: '' });
              return editCollections(draw);
            }
            const row = await insert('works', {
              title: 'عمل جديد', collection_id: sorted(get('collections'))[0].id,
              image_url: '', sort: get('works').length + 1, published: false, featured: false, gallery: [],
            });
            setAll('works', [...get('works'), row]);
            draw();
            editWork(row, draw);
          } }, [icon('plus', { size: 16 }), 'أضف عملاً']),
        ]),
      ]),
      works.length ? list : emptyState('لا توجد أعمال بعد',
        'أضِف أول عمل ليظهر في الموقع.', null),
    ]));
  };
  draw();
  host.replaceChildren(wrap);
}
