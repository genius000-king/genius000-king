// مدير البكجات — مستويان: قائمة البكجات ← محرر كتلات بكج واحد.
// يُفتح من ⚙ في شريط البكجات داخل المعاينة.
import { el, qs, on, published } from '../core/dom.js';
import { get, setAll, blocksOf } from '../core/store.js';
import { insert, update, remove } from '../core/api.js';
import { confirmModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { icon } from '../components/icon.js';
import { makeSortable } from '../core/sortable.js';
import { mediaField } from '../components/media-field.js';

let side = null;

const save = async (table, id, patch) => {
  document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'saving' } }));
  try {
    await update(table, id, patch);
    document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'saved' } }));
  } catch {
    document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'error' } }));
  }
};

/* ---------- المستوى 1: قائمة البكجات ---------- */
function listView() {
  const list = el('div', { class: 'mgr__list' });

  const draw = () => {
    const rows = get('packages').slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    list.replaceChildren(...rows.map((p) => el('div', { class: 'mgr__row', 'data-id': p.id }, [
      el('span', { class: 'mgr__handle', 'aria-hidden': 'true' }, ['⠿']),
      p.logo_url ? el('img', { class: 'mgr__thumb', src: p.logo_url, alt: '' }) : null,
      el('button', { class: 'link mgr__name', type: 'button',
        onclick: () => blocksView(p) }, [p.name || 'بلا اسم']),
      el('label', { class: 'ctrl--row' }, [
        el('span', { class: 'sr-only' }, ['منشور']),
        el('input', { type: 'checkbox', class: 'ctrl__toggle', checked: p.published !== false,
          'aria-label': `نشر ${p.name}`,
          onchange: (e) => { p.published = e.target.checked; save('packages', p.id, { published: p.published }); } }),
      ]),
      el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `حذف ${p.name}`,
        onclick: async () => {
          if (!await confirmModal({ title: 'حذف البكج؟', body: `سيُحذف «${p.name}» وكل كتله.` })) return;
          await remove('packages', p.id);
          setAll('packages', get('packages').filter((x) => x.id !== p.id));
          toast('حُذف البكج', 'success');
          draw();
        } }, [icon('close', { size: 16 })]),
    ])));

    makeSortable(list, async (ids) => {
      ids.forEach((id, i) => save('packages', id, { sort: i + 1 }));
    });
  };

  draw();
  return el('div', {}, [
    el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const row = await insert('packages', { name: 'بكج جديد', logo_url: '', cover_url: '',
        sort: get('packages').length + 1, published: false });
      setAll('packages', [...get('packages'), row]);
      draw();
    } }, [icon('plus', { size: 16 }), 'أضف بكجاً']),
    list,
  ]);
}

/* ---------- المستوى 2: محرر الكتل ---------- */
function blocksView(pkg) {
  const list = el('div', { class: 'mgr__list' });

  const draw = () => {
    list.replaceChildren(...blocksOf(pkg.id).map((b) => el('div',
      { class: 'card mgr__block', 'data-id': b.id }, [
      el('div', { class: 'mgr__block-head' }, [
        el('span', { class: 'mgr__handle', 'aria-hidden': 'true' }, ['⠿']),
        el('input', { type: 'text', class: 'field', value: b.title || '',
          'aria-label': 'عنوان الكتلة', placeholder: 'عنوان حر — عربي أو إنجليزي',
          oninput: (e) => save('package_blocks', b.id, { title: e.target.value }) }),
        el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'حذف الكتلة',
          onclick: async () => {
            if (!await confirmModal({ title: 'حذف الكتلة؟' })) return;
            await remove('package_blocks', b.id);
            setAll('package_blocks', get('package_blocks').filter((x) => x.id !== b.id));
            draw();
          } }, [icon('close', { size: 16 })]),
      ]),
      el('div', { class: 'mgr__media' }, [
        ...(b.images || []).map((im, i) => mediaField(im, (val) => {
          const images = [...(b.images || [])];
          val ? (images[i] = val) : images.splice(i, 1);
          b.images = images;
          save('package_blocks', b.id, { images });
          if (!val) draw();
        })),
        mediaField(null, (val) => {
          if (!val) return;
          b.images = [...(b.images || []), val];
          save('package_blocks', b.id, { images: b.images });
          draw();
        }),
      ]),
    ])));

    makeSortable(list, (ids) => ids.forEach((id, i) => save('package_blocks', id, { sort: i + 1 })));
  };

  draw();
  qs('.side__body', side).replaceChildren(
    el('button', { class: 'btn', type: 'button', onclick: () => open() }, ['رجوع للقائمة']),
    el('h3', { class: 'side__title' }, [pkg.name]),
    el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const row = await insert('package_blocks', { package_id: pkg.id, title: 'كتلة جديدة',
        images: [], sort: blocksOf(pkg.id).length + 1 });
      setAll('package_blocks', [...get('package_blocks'), row]);
      draw();
    } }, [icon('plus', { size: 16 }), 'أضف كتلة']),
    list,
  );
}

export function open() {
  if (!side) {
    side = el('div', { class: 'side side--wide', role: 'dialog', 'aria-label': 'إدارة البكجات' }, [
      el('div', { class: 'side__head' }, [
        el('span', { class: 'side__title' }, ['إدارة البكجات']),
        el('button', { class: 'btn btn--icon side__close', type: 'button', 'aria-label': 'إغلاق',
          onclick: () => side.classList.remove('is-open') }, [icon('close')]),
      ]),
      el('div', { class: 'side__body' }),
    ]);
    document.body.append(side);
  }
  qs('.side__body', side).replaceChildren(listView());
  requestAnimationFrame(() => side.classList.add('is-open'));
}

on(document, 'leader:packages', open);
