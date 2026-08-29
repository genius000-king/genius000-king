// block-list.js — الكتل المخصّصة داخل قسم واحد، كما تظهر في لوح التخطيط.
// كل تعديل يُحفظ تلقائياً بعد أن يهدأ الإدخال، وتُعاد بناء المعاينة بعده.
import { el, debounce } from '../core/dom.js';
import * as api from '../core/api.js';
import { get, setAll, blocksIn } from '../core/store.js';
import { blockEditor } from '../components/custom-block.js';
import { saveNow as autosave } from '../core/autosave.js';
import { confirmModal } from '../core/modal.js';

const TABLE = 'custom_blocks';

function replaceRow(row) {
  const list = get(TABLE);
  const i = list.findIndex((b) => b.id === row.id);
  setAll(TABLE, i === -1 ? [...list, row] : list.map((b, j) => (j === i ? row : b)));
}

function dropRow(id) { setAll(TABLE, get(TABLE).filter((b) => b.id !== id)); }

/** يبثّ طلب إعادة رسم المعاينة — يلتقطه `main.js` أو من يعنيه. */
function refresh() { document.dispatchEvent(new CustomEvent('leader:refresh')); }

function card(block, onGone) {
  const save = debounce((next) => autosave(async () => {
    replaceRow(next);
    await api.update(TABLE, next.id, { type: next.type, content: next.content });
    refresh();
  }), 400);

  const del = el('button', {
    class: 'lt__icon', type: 'button', title: 'حذف الكتلة', 'aria-label': 'حذف الكتلة',
    onclick: async () => {
      const yes = await confirmModal({ title: 'حذف الكتلة؟', body: 'لا يمكن التراجع.' });
      if (!yes) return;
      await autosave(async () => { dropRow(block.id); await api.remove(TABLE, block.id); refresh(); });
      onGone?.();
    },
  }, ['✕']);

  return el('li', { class: 'lt-block', 'data-block': block.id }, [
    el('div', { class: 'lt-block__head' }, [
      el('span', { class: 'lt-block__tag' }, [`كتلة ${block.sort ?? ''}`]), del,
    ]),
    blockEditor(block, save),
  ]);
}

/**
 * قائمة كتل قسم مع زر الإضافة.
 * @param {string} sectionKey مفتاح القسم
 */
export function blockList(sectionKey) {
  const list = el('ul', { class: 'lt-blocks' });

  const draw = () => list.replaceChildren(
    ...blocksIn(sectionKey).map((b) => card(b, draw)),
  );
  draw();

  const add = el('button', {
    class: 'lt__icon lt__icon--wide', type: 'button', title: 'أضف كتلة',
    onclick: () => autosave(async () => {
      const sort = blocksIn(sectionKey).reduce((m, b) => Math.max(m, Number(b.sort) || 0), 0) + 1;
      const row = await api.insert(TABLE, {
        section_key: sectionKey, type: 'text', content: { text: 'نص جديد' },
        sort, visible: true,
      });
      if (row) { replaceRow(row); draw(); refresh(); }
    }),
  }, ['⊕ أضف كتلة']);

  return el('div', { class: 'lt-blocks__wrap' }, [list, add]);
}
