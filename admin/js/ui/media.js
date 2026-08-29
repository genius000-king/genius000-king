// media.js — رفع الصور: منطقة إفلات + شبكة مصغّرات + تقدّم حقيقي.
import { el, on } from '../core/dom.js';
import { upload } from '../core/upload.js';
import { toast } from '../core/toast.js';
import { icon } from './icon.js';

export const MAX_SIZE = 8 * 1024 * 1024;
const OK = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$|^video\/(mp4|webm)$/i;

export function validate(file) {
  if (!OK.test(file.type)) return 'الملفات المقبولة: صور أو فيديو mp4/webm';
  if (file.size > MAX_SIZE) return `حجم الملف أكبر من ${Math.round(MAX_SIZE / 1048576)}MB`;
  return null;
}

/**
 * منطقة إفلات ترفع مباشرة وتعيد {url, w, h} لكل ملف.
 * @param {Function} onDone (items) => void
 */
export function dropzone(folder, onDone, o = {}) {
  const input = el('input', {
    type: 'file', hidden: true, multiple: o.multiple !== false,
    accept: o.accept || 'image/*,video/mp4,video/webm',
    onchange: (e) => { take([...e.target.files]); e.target.value = ''; },
  });

  const zone = el('div', {
    class: 'drop', role: 'button', tabindex: '0',
    'aria-label': o.label || 'رفع ملفات',
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); zone.classList.add('is-over'); },
    ondragleave: () => zone.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); zone.classList.remove('is-over'); take([...(e.dataTransfer?.files || [])]); },
  }, [
    el('span', { style: { color: 'var(--a-accent)' } }, [icon('upload', { size: 22 })]),
    el('span', { class: 'drop__t' }, [o.title || 'اسحب الملفات هنا أو اضغط للاختيار']),
    el('span', { class: 'drop__h' }, [o.hint || `صور أو فيديو · حتى ${Math.round(MAX_SIZE / 1048576)}MB`]),
    input,
  ]);

  const bar = el('div', { class: 'media__bar', hidden: true });
  zone.append(bar);

  async function take(files) {
    const ok = [];
    for (const f of files) {
      const msg = validate(f);
      if (msg) { toast(msg, 'warn'); continue; }
      ok.push(f);
    }
    if (!ok.length) return;

    bar.hidden = false;
    zone.setAttribute('aria-busy', 'true');
    const out = [];
    for (let i = 0; i < ok.length; i++) {
      try {
        const dims = await measure(ok[i]);
        const { url } = await upload(ok[i], folder, (p) => {
          bar.style.setProperty('--p', `${Math.round(((i + p) / ok.length) * 100)}%`);
        });
        out.push({ url, ...dims, type: ok[i].type.startsWith('video') ? 'video' : 'image', caption: '' });
      } catch (e) {
        console.error('[upload]', e);
        toast(`تعذّر رفع ${ok[i].name}`, 'error');
      }
    }
    bar.hidden = true;
    bar.style.setProperty('--p', '0%');
    zone.removeAttribute('aria-busy');
    if (out.length) { onDone(out); toast(`رُفع ${out.length} ملف`, 'success'); }
  }

  return zone;
}

/** يقرأ أبعاد الصورة قبل الرفع — تحتاجها خوارزمية البينتو. */
export function measure(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve({ w: 0, h: 0 });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }); };
    img.src = url;
  });
}

/** بلاطة وسائط واحدة مع زر حذف. */
export function mediaTile(item, onRemove, extra) {
  return el('div', { class: 'media', 'data-id': item.url }, [
    item.type === 'video'
      ? el('video', { src: item.url, muted: true, playsinline: true, preload: 'metadata' })
      : el('img', { src: item.url, alt: item.caption || '', loading: 'lazy' }),
    onRemove ? el('button', { class: 'media__x', type: 'button', 'aria-label': 'حذف',
      onclick: (e) => { e.stopPropagation(); onRemove(item); } }, [icon('close', { size: 13 })]) : null,
    extra || null,
  ]);
}

/** حقل صورة مفردة (لوجو، غلاف). */
export function imageField(value, folder, onChange, label) {
  const box = el('div', { class: 'stack' });
  const draw = () => {
    box.replaceChildren(
      value
        ? el('div', { class: 'row' }, [
            el('img', { class: 'thumb-sm', src: value, alt: '', style: { inlineSize: '54px', blockSize: '54px' } }),
            el('input', { class: 'field mono grow', value, readonly: true, 'aria-label': label || 'الرابط' }),
            el('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': 'حذف',
              onclick: () => { value = ''; onChange(''); draw(); } }, [icon('close', { size: 15 })]),
          ])
        : dropzone(folder, (items) => { value = items[0].url; onChange(value); draw(); },
            { multiple: false, title: label || 'اختر صورة' }),
    );
  };
  draw();
  return box;
}
