// لوحة البكج — جدار بينتو لكل كتلة. صفر عنوان مكتوب في الكود.
import { el } from '../core/dom.js';
import { get, blocksOf, content } from '../core/store.js';
import { openLightbox } from '../core/lightbox.js';
import { icon } from '../components/icon.js';
import { planBento } from './bento-layout.js';

function media(item) {
  if (item.type === 'video') {
    return el('video', { src: item.url, poster: item.poster || '',
      muted: true, loop: true, autoplay: true, playsinline: true, preload: 'metadata' });
  }
  return el('img', { src: item.url, alt: item.caption || '',
    loading: 'lazy', decoding: 'async' });
}

/** لون بلاطة الفجوة — يدور بين لوني الهوية ولون البكج إن وُجد. */
function fillStyle(pkg, i) {
  const a = pkg.color_a || 'var(--c-accent)';
  const b = pkg.color_b || 'var(--c-accent-2)';
  return i % 2 ? { '--fill-a': b, '--fill-b': a } : { '--fill-a': a, '--fill-b': b };
}

function wall(block, pkg) {
  const images = Array.isArray(block.images) ? block.images : [];
  const { cells, cols, square, gallery } = planBento(images, block.layout || 'auto', {
    fillGaps: block.fill_gaps !== false,
  });
  const openable = cells.filter((c) => c.kind === 'media').map((c) => c.image);

  /* المعرض: شريط واحد يتولّاه marquee — يمشي وحده، يقف عند المرور،
     ويُسحب باليد بقصور ذاتي. النقر بعد سحب يُبتلع فلا تفتح صورةٌ
     لم يقصدها الزائر. */
  if (gallery) {
    return el('div', {
      class: 'pkg-strip', 'data-fx': 'marquee',
      'data-fx-speed': '22', 'aria-label': 'معرض صور — اسحب للتصفّح',
    }, [
      el('div', { class: 'pkg-strip__track' }, cells.map((c) => el('button', {
        class: 'pkg-strip__cell', type: 'button',
        'data-cursor': 'كبّر',
        'aria-label': `تكبير ${c.image.caption || 'الصورة'}`,
        onclick: () => openLightbox(openable, Math.max(0, openable.indexOf(c.image))),
      }, [
        media(c.image),
        c.image.caption ? el('span', { class: 'pkg-cell__cap' }, [c.image.caption]) : null,
      ]))),
    ]);
  }

  return el('div', {
    // الشبكة المنتظمة تفرض عدد أعمدتها (grid5 يحتاج عشرة)، فتتجاوز
    // ما اختاره المشرف — وإلا خرجت خمس صور في صفّ من اثني عشر عموداً
    class: `pkg-bento ${square ? 'pkg-bento--square' : ''}`,
    style: {
      '--cols': String(square ? cols : (block.cols || 12)),
      '--cols-m': String(square ? 2 : (block.cols_m || 4)),
      '--unit': block.unit ? `${block.unit}px` : null,
      '--gap': block.gap ? `${block.gap}px` : null,
    },
  }, cells.map((c, i) => {
    const style = { '--cs': c.cs, '--rs': c.rs, '--cs-m': c.csM, '--rs-m': c.rsM };

    if (c.kind === 'fill') {
      return el('div', {
        class: 'pkg-cell pkg-cell--fill', 'aria-hidden': 'true',
        style: { ...style, ...fillStyle(pkg, i) },
      }, [el('span', {}, [pkg.name || ''])]);
    }

    const idx = openable.indexOf(c.image);
    return el('button', {
      class: 'pkg-cell', type: 'button', style,
      'data-cursor': 'كبّر',
      'aria-label': `تكبير ${c.image.caption || 'الصورة'}`,
      onclick: () => openLightbox(openable, Math.max(0, idx)),
    }, [
      media(c.image),
      c.image.caption ? el('span', { class: 'pkg-cell__cap' }, [c.image.caption]) : null,
    ]);
  }));
}

function block(b, pkg) {
  return el('section', { class: 'pkg-block', 'data-edit-id': `package.block.${b.id}` }, [
    (b.title || b.note)
      ? el('div', { class: 'pkg-block__head' }, [
          b.title ? el('h3', { class: 'pkg-block__title' }, [b.title]) : null,
          b.note ? el('span', { class: 'pkg-block__note' }, [b.note]) : null,
        ])
      : null,
    wall(b, pkg),
  ]);
}

export default function render({ id }) {
  const pkg = get('packages').find((p) => p.id === id);
  if (!pkg) return el('p', { class: 'glass-panel__error' }, ['البكج غير موجود.']);

  const blocks = blocksOf(id);

  return el('div', { class: 'pkg-detail' }, [
    el('header', { class: 'pkg-detail__head' }, [
      pkg.logo_url
        ? el('img', { class: 'pkg-detail__logo', src: pkg.logo_url, alt: '', decoding: 'async' })
        : null,
      el('div', { class: 'pkg-detail__titles' }, [
        el('h2', { class: 'pkg-detail__title' }, [pkg.name || '']),
        pkg.description ? el('p', { class: 'pkg-detail__sub' }, [pkg.description]) : null,
      ]),
      el('button', {
        class: 'btn btn--primary pkg-detail__cta', type: 'button', 'data-fx': 'magnetic',
        onclick: () => document.dispatchEvent(new CustomEvent('order:open', {
          detail: { preset: { name: `بكج ${pkg.name}`, qty: 1 } },
        })),
      }, [content('package_cta', 'اطلب هذا البكج'), icon('arrow', { size: 18 })]),
    ]),
    ...(blocks.length
      ? blocks.map((b) => block(b, pkg))
      : [el('p', { class: 'card__text' }, ['لا توجد كتل في هذا البكج بعد.'])]),
  ]);
}
