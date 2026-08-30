// ============================================================
// packages.js — البكجات ← الكتل ← الصور، مع التحكم الكامل في تقسيمة البينتو.
//
// هذه هي الشاشة التي تتحكّم بما يراه الزبون عند فتح البكج:
//   · نمط التقسيم لكل كتلة (تلقائي · فسيفساء · بطل · شريط …)
//   · عدد الأعمدة وارتفاع الصف والمسافة
//   · مقاس كل صورة على حدة — كبّر أو صغّر بلاطة بعينها
//   · الترتيب بالسحب
// وكلّه بمعاينة حيّة بنفس خوارزمية الموقع تماماً.
// ============================================================
import { el } from '../core/dom.js';
import { get, setAll, blocksOf } from '../core/store.js';
import { insert, remove } from '../core/api.js';
import { save } from '../core/autosave.js';
import { toast } from '../core/toast.js';
import { icon } from '../ui/icon.js';
import { makeSortable } from '../ui/sortable.js';
import { openDrawer, closeDrawer } from '../ui/drawer.js';
import { confirmDelete } from '../ui/modal.js';
import { fld, text, textarea, toggle, select, slider, color, emptyState } from '../ui/fields.js';
import { imageField, dropzone } from '../ui/media.js';
import { record } from '../core/history.js';
import { planBento, PRESETS, PRESET_KEYS, MODES, resolveSpan } from '../core/bento-layout.js';

const sorted = (r) => r.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

/* ============================================================
   معاينة البينتو الحيّة — نفس ما يراه الزبون، وقابلة للنقر للتعديل
   ============================================================ */
function bentoPreview(block, pkg, onPick, selected) {
  const images = Array.isArray(block.images) ? block.images : [];
  const { cells, cols, square } = planBento(images, block.layout || 'auto',
    { fillGaps: block.fill_gaps !== false });

  // الشبكة المنتظمة تفرض أعمدتها ونسبتها المربّعة — والمعاينة هنا يجب
  // أن تُظهر ما يراه الزبون بالضبط، وإلا اختار المشرف نمطاً على غير ما رأى
  const grid = el('div', {
    class: 'bento-prev',
    style: {
      '--cols': String(square ? cols : (block.cols || 12)),
      '--unit': square ? 'auto' : `${block.unit || 54}px`,
      '--gap': `${block.gap || 6}px`,
      ...(square ? { gridAutoRows: 'auto' } : {}),
    },
  }, cells.map((c) => {
    const style = { '--cs': c.cs, '--rs': c.rs, ...(square ? { aspectRatio: '1' } : {}) };
    if (c.kind === 'fill') {
      return el('span', { class: 'bento-prev__cell is-fill', style,
        title: 'بلاطة لون تملأ الفراغ' }, []);
    }
    const i = c.index;
    return el('button', {
      class: `bento-prev__cell ${selected === i ? 'is-sel' : ''}`, type: 'button', style,
      title: `صورة ${i + 1} — ${PRESETS[c.image.span]?.label || 'تلقائي'}`,
      'aria-label': `اختر الصورة ${i + 1}`,
      onclick: () => onPick(i),
    }, [el('img', { src: c.image.url, alt: '', loading: 'lazy' })]);
  }));

  return grid;
}

/* ============================================================
   محرّر كتلة واحدة
   ============================================================ */
function editBlock(block, pkg, done) {
  let selected = null;
  const host = el('div', { class: 'stack stack--lg' });

  const patch = (k, v) => {
    block[k] = v;
    save('package_blocks', block.id, { [k]: v }).catch(() => {});
    draw();
  };

  /** يضبط مقاس صورة بعينها. */
  const setSpan = (i, span) => {
    const imgs = [...(block.images || [])];
    if (!imgs[i]) return;
    imgs[i] = { ...imgs[i], span: span || undefined };
    block.images = imgs;
    save('package_blocks', block.id, { images: imgs }).catch(() => {});
    draw();
  };

  const removeImage = (i) => {
    const imgs = [...(block.images || [])];
    imgs.splice(i, 1);
    block.images = imgs;
    selected = null;
    save('package_blocks', block.id, { images: imgs }).catch(() => {});
    draw();
  };

  const moveImage = (i, dir) => {
    const imgs = [...(block.images || [])];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    block.images = imgs;
    selected = j;
    save('package_blocks', block.id, { images: imgs }).catch(() => {});
    draw();
  };

  function inspector() {
    const imgs = block.images || [];
    if (selected === null || !imgs[selected]) {
      return el('p', { class: 'fld__hint' },
        ['اضغط على أي صورة في المعاينة لتغيير مقاسها أو حذفها.']);
    }
    const im = imgs[selected];
    const cur = im.span || '';
    return el('div', { class: 'stack' }, [
      el('div', { class: 'row' }, [
        el('img', { class: 'thumb-sm', src: im.url, alt: '',
          style: { inlineSize: '48px', blockSize: '48px' } }),
        el('span', { class: 'grow fld__label' }, [`صورة ${selected + 1} من ${imgs.length}`]),
        el('button', { class: 'btn btn--icon btn--sm', type: 'button', 'aria-label': 'إلى الخلف',
          onclick: () => moveImage(selected, -1) }, [icon('arrow', { size: 14 })]),
        el('button', { class: 'btn btn--icon btn--sm', type: 'button', 'aria-label': 'إلى الأمام',
          onclick: () => moveImage(selected, 1), style: { transform: 'scaleX(-1)' } },
          [icon('arrow', { size: 14 })]),
        el('button', { class: 'btn btn--icon btn--sm btn--danger', type: 'button', 'aria-label': 'حذف',
          onclick: () => removeImage(selected) }, [icon('trash', { size: 14 })]),
      ]),
      fld('مقاس هذه البلاطة',
        el('div', { class: 'span-picker' }, [
          el('button', {
            class: `span-opt ${!cur ? 'is-on' : ''}`, type: 'button',
            onclick: () => setSpan(selected, ''),
          }, ['تلقائي']),
          ...PRESET_KEYS.map((k) => {
            const p = PRESETS[k];
            return el('button', {
              class: `span-opt ${cur === k ? 'is-on' : ''}`, type: 'button',
              title: `${p.cs}×${p.rs}`,
              onclick: () => setSpan(selected, k),
            }, [
              el('span', { class: 'span-opt__box',
                style: { '--w': p.cs, '--h': p.rs } }),
              el('span', {}, [p.label]),
            ]);
          }),
        ]),
        'المقاس التلقائي يُحسب من نسبة الصورة. اختر مقاساً لتثبيته.'),
      fld('تعليق الصورة', text(im.caption, (v) => {
        const arr = [...block.images];
        arr[selected] = { ...arr[selected], caption: v };
        block.images = arr;
        save('package_blocks', block.id, { images: arr }).catch(() => {});
      }, { label: 'تعليق' }), 'يظهر عند مرور المؤشر'),
    ]);
  }

  function draw() {
    const imgs = block.images || [];
    host.replaceChildren(
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, ['المعاينة']),
          el('span', { class: 'card__hint' }, [`${imgs.length} صورة`]),
        ]),
        imgs.length
          ? bentoPreview(block, pkg, (i) => { selected = i; draw(); }, selected)
          : el('p', { class: 'fld__hint' }, ['أضِف صوراً لترى التقسيمة.']),
      ]),

      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['البلاطة المختارة'])]),
        inspector(),
      ]),

      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['تقسيمة الكتلة'])]),
        el('div', { class: 'fld-grid' }, [
          fld('النمط', select(block.layout || 'auto', MODES, (v) => patch('layout', v), { label: 'النمط' }),
            'يحدّد كيف تُوزَّع الصور تلقائياً'),
          fld('', toggle(block.fill_gaps !== false, (v) => patch('fill_gaps', v),
            'املأ الفراغ ببلاطات لون'), 'كما في التصميم المرجعي'),
        ]),
        el('div', { class: 'fld-grid' }, [
          slider(block.cols || 12, (v) => patch('cols', Number(v)),
            { label: 'عدد الأعمدة', min: 4, max: 12, step: 1 }),
          slider(block.unit || 110, (v) => patch('unit', Number(v)),
            { label: 'ارتفاع الصف', min: 60, max: 200, step: 5, unit: 'px' }),
          slider(block.gap || 12, (v) => patch('gap', Number(v)),
            { label: 'المسافة', min: 0, max: 32, step: 2, unit: 'px' }),
        ]),
      ]),

      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['بيانات الكتلة'])]),
        fld('العنوان', text(block.title, (v) => { block.title = v; save('package_blocks', block.id, { title: v }); }, { label: 'العنوان' })),
        fld('ملاحظة', text(block.note, (v) => { block.note = v; save('package_blocks', block.id, { note: v }); }, { label: 'ملاحظة' })),
      ]),

      dropzone(`packages/${pkg.id}`, (items) => {
        block.images = [...(block.images || []), ...items];
        save('package_blocks', block.id, { images: block.images }).catch(() => {});
        draw();
      }, { title: 'أضِف صوراً للكتلة' }),
    );
  }

  draw();
  openDrawer({
    title: block.title || 'كتلة', sub: pkg.name, wide: true,
    body: host,
    back: () => editPackage(pkg, done),
    foot: el('div', { class: 'row grow' }, [
      el('button', { class: 'btn grow', type: 'button', onclick: () => editPackage(pkg, done) }, ['رجوع للبكج']),
      el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
        if (!await confirmDelete(block.title || 'هذه الكتلة')) return;
        await remove('package_blocks', block.id);
        setAll('package_blocks', get('package_blocks').filter((x) => x.id !== block.id));
        toast('حُذفت الكتلة', 'success');
        editPackage(pkg, done);
      } }, [icon('trash', { size: 15 })]),
    ]),
    onClose: done,
  });
}

/* ============================================================
   محرّر بكج
   ============================================================ */
function editPackage(pkg, done) {
  const patch = (k, v) => { pkg[k] = v; save('packages', pkg.id, { [k]: v }).catch(() => {}); };
  const list = el('div', { class: 'sortable' });

  const drawBlocks = () => {
    const blocks = blocksOf(pkg.id);
    list.replaceChildren(...blocks.map((b) => {
      const n = (b.images || []).length;
      return el('div', { class: 'sort-row', 'data-id': b.id }, [
        el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
        el('button', { class: 'link grow', type: 'button', style: { textAlign: 'start' },
          onclick: () => editBlock(b, pkg, done) }, [b.title || 'كتلة بلا عنوان']),
        el('span', { class: 'fld__hint nowrap' }, [`${n} صورة · ${MODES.find(([m]) => m === (b.layout || 'auto'))?.[1].split(' —')[0] || 'تلقائي'}`]),
        el('button', { class: 'btn btn--icon btn--sm', type: 'button', 'aria-label': 'فتح',
          onclick: () => editBlock(b, pkg, done) }, [icon('grid', { size: 14 })]),
      ]);
    }));
    makeSortable(list, (ids) => {
      ids.forEach((id, i) => save('package_blocks', id, { sort: i + 1 }));
      setAll('package_blocks', get('package_blocks').map((b) =>
        ids.includes(b.id) ? { ...b, sort: ids.indexOf(b.id) + 1 } : b));
      toast('حُفظ الترتيب', 'success');
    });
  };
  drawBlocks();

  openDrawer({
    title: pkg.name || 'بكج', sub: 'الحفظ تلقائي', wide: true,
    body: el('div', { class: 'stack stack--lg' }, [
      el('div', { class: 'fld-grid' }, [
        fld('الاسم', text(pkg.name, (v) => patch('name', v), { label: 'الاسم' })),
        fld('الوصف', text(pkg.description, (v) => patch('description', v), { label: 'الوصف' })),
      ]),
      el('div', { class: 'fld-grid' }, [
        fld('الشعار', imageField(pkg.logo_url, `packages/${pkg.id}`, (v) => patch('logo_url', v), 'شعار البكج')),
        fld('صورة الغلاف', imageField(pkg.cover_url, `packages/${pkg.id}`, (v) => patch('cover_url', v), 'غلاف'),
          'تظهر خافتة عند مرور المؤشر'),
      ]),
      el('div', { class: 'fld-grid' }, [
        fld('لون البلاطات الأول', color(pkg.color_a, (v) => patch('color_a', v), { label: 'اللون الأول', fallback: '#3B6EF6' })),
        fld('لون البلاطات الثاني', color(pkg.color_b, (v) => patch('color_b', v), { label: 'اللون الثاني', fallback: '#7C5CFF' })),
      ]),
      toggle(pkg.published !== false, (v) => patch('published', v), 'منشور في الموقع'),

      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, ['الكتل']),
          el('span', { class: 'card__hint' }, ['اسحب لإعادة الترتيب']),
        ]),
        list,
        el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
          const row = await insert('package_blocks', {
            package_id: pkg.id, title: 'كتلة جديدة', images: [],
            layout: 'auto', fill_gaps: true, cols: 12, cols_m: 4, unit: 110, gap: 12,
            sort: blocksOf(pkg.id).length + 1,
          });
          setAll('package_blocks', [...get('package_blocks'), row]);
          drawBlocks();
          editBlock(row, pkg, done);
        } }, [icon('plus', { size: 16 }), 'أضف كتلة']),
      ]),
    ]),
    foot: el('div', { class: 'row grow' }, [
      el('button', { class: 'btn grow', type: 'button', onclick: () => closeDrawer() }, ['تم']),
      el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
        const n = blocksOf(pkg.id).length;
        if (!await confirmDelete(pkg.name, n ? `يحتوي ${n} كتلة ستُحذف معه.` : '')) return;
        await remove('packages', pkg.id);
        setAll('packages', get('packages').filter((x) => x.id !== pkg.id));
        setAll('package_blocks', get('package_blocks').filter((b) => b.package_id !== pkg.id));
        closeDrawer();
        toast('حُذف البكج', 'success');
        done();
      } }, [icon('trash', { size: 15 })]),
    ]),
    onClose: done,
  });
}

/* ============================================================
   العرض
   ============================================================ */
export function render(host, { id } = {}) {
  const wrap = el('div');

  const draw = () => {
    const pkgs = sorted(get('packages'));
    const list = el('div', { class: 'sortable' });

    list.replaceChildren(...pkgs.map((p) => {
      const blocks = blocksOf(p.id);
      const shots = blocks.reduce((n, b) => n + (b.images || []).length, 0);
      return el('div', { class: 'sort-row', 'data-id': p.id }, [
        el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
        p.logo_url
          ? el('img', { class: 'thumb-sm', src: p.logo_url, alt: '', loading: 'lazy' })
          : el('span', { class: 'thumb-sm' }),
        el('button', { class: 'link grow', type: 'button', style: { textAlign: 'start' },
          onclick: () => editPackage(p, draw) }, [p.name || 'بلا اسم']),
        el('span', { class: 'fld__hint nowrap' }, [`${blocks.length} كتل · ${shots} صورة`]),
        toggle(p.published !== false, (v) => { p.published = v; save('packages', p.id, { published: v }); }),
      ]);
    }));

    makeSortable(list, (ids) => {
      ids.forEach((pid, i) => save('packages', pid, { sort: i + 1 }));
      setAll('packages', get('packages').map((p) => ({ ...p, sort: ids.indexOf(p.id) + 1 })));
      toast('حُفظ الترتيب', 'success');
    });

    wrap.replaceChildren(el('div', { class: 'view' }, [
      el('div', { class: 'view__head' }, [
        el('div', {}, [
          el('h1', { class: 'view__title' }, ['البكجات']),
          el('p', { class: 'view__sub' }, ['التقسيمة التي يراها الزبون عند فتح البكج تُضبط من هنا']),
        ]),
        el('div', { class: 'view__actions' }, [
          el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
            const row = await insert('packages', {
              name: 'بكج جديد', description: '', logo_url: '', cover_url: '',
              color_a: '#3B6EF6', color_b: '#7C5CFF',
              sort: get('packages').length + 1, published: false,
            });
            setAll('packages', [...get('packages'), row]);
            draw();
            editPackage(row, draw);
          } }, [icon('plus', { size: 16 }), 'أضف بكجاً']),
        ]),
      ]),
      pkgs.length ? list : emptyState('لا توجد بكجات بعد', 'أضِف بكجاً وابدأ برفع صوره.'),
    ]));
  };

  draw();
  host.replaceChildren(wrap);

  if (id) {
    const p = get('packages').find((x) => x.id === id);
    if (p) editPackage(p, draw);
  }
}
