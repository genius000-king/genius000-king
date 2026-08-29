// media-field.js — حقل وسيط واحد: صورة أو فيديو، برفع وتقدّم ومعاينة.
// يقبل شكل Spec §4.12: { type, url, poster, caption }
// وأيضاً رابطاً نصياً أو قيمة بلا `type` — تُعامَل كصورة (توافق خلفي).
import { el, qs, on } from '../core/dom.js';
import { uploadFile, mediaTypeOf } from '../core/uploader.js';
import { icon } from './icon.js';
import { toast } from '../core/toast.js';

/** يوحّد أي شكل قديم إلى الشكل الكامل. */
export function normalizeMedia(value) {
  if (!value) return null;
  if (typeof value === 'string') return { type: 'image', url: value, poster: '', caption: '' };
  if (!value.url) return null;
  return {
    type: value.type === 'video' ? 'video' : 'image',
    url: value.url,
    poster: value.poster || '',
    caption: value.caption || '',
  };
}

function preview(media) {
  if (!media) {
    return el('div', { class: 'media__empty' }, [
      icon('plus', { size: 22 }),
      el('span', {}, ['أضف صورة أو فيديو']),
    ]);
  }
  if (media.type === 'video') {
    return el('video', { class: 'media__thumb', src: media.url, poster: media.poster || '',
      muted: true, loop: true, playsinline: true, preload: 'metadata' });
  }
  return el('img', { class: 'media__thumb', src: media.url, alt: media.caption || '',
    loading: 'lazy', decoding: 'async' });
}

/**
 * @param {object|string|null} value القيمة الحالية
 * @param {(next:object|null)=>void} onChange يُنادى بالقيمة الجديدة، أو null عند الحذف
 * @param {{folder?:string}} [opts]
 */
export function mediaField(value, onChange, { folder = 'misc' } = {}) {
  let media = normalizeMedia(value);

  const bar = el('span', { class: 'media__bar' });
  const progress = el('div', { class: 'media__progress', hidden: true, role: 'progressbar',
    'aria-label': 'تقدّم الرفع' }, [bar]);

  const input = el('input', { type: 'file', class: 'sr-only',
    accept: 'image/*,video/*,application/pdf', 'aria-label': 'اختر ملفاً',
    onchange: (e) => pick(e.target.files?.[0]) });

  const shell = el('div', { class: 'media' });

  async function pick(file) {
    if (!file) return;
    progress.hidden = false;
    bar.style.inlineSize = '0%';
    try {
      const url = await uploadFile(file, folder, (p) => { bar.style.inlineSize = `${p}%`; });
      media = { type: mediaTypeOf(file), url, poster: '', caption: media?.caption || '' };
      onChange?.(media);
      draw();
    } catch (err) {
      toast(err.message || 'تعذّر الرفع', 'error');
    } finally {
      progress.hidden = true;
      input.value = '';
    }
  }

  function remove() {
    media = null;
    onChange?.(null);
    draw();
  }

  function draw() {
    shell.replaceChildren(
      el('button', {
        class: `media__pick ${media ? 'has-media' : ''}`, type: 'button',
        'aria-label': media ? 'استبدال الوسيط' : 'إضافة وسيط',
        onclick: () => input.click(),
      }, [preview(media)]),
      progress,
      media
        ? el('div', { class: 'media__tools' }, [
            el('input', { type: 'text', class: 'field media__caption', value: media.caption || '',
              placeholder: 'وصف قصير', 'aria-label': 'وصف الوسيط',
              oninput: (e) => { media.caption = e.target.value; onChange?.(media); } }),
            el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'حذف الوسيط',
              onclick: remove }, [icon('close', { size: 16 })]),
          ])
        : null,
      input,
    );
  }

  draw();
  return shell;
}
