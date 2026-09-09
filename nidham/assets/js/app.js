/* NIDHAM — render + wiring. */
(function (root) {
  'use strict';
  var N = root.NID, D = N.D, Store = N.Store;
  var $ = function (id) { return document.getElementById(id); };

  var V = { cursor: D.today(), sel: D.todayKey(), view: 'month' };
  var editing = null;

  function s() { return N.STR[Store.data.settings.lang] || N.STR.ar; }
  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clock(t) { return Store.data.settings.lang === 'ar' ? D.clock(t) : D.clockEn(t); }
  function dayName(key) { return s().dow[D.parse(key).getDay()]; }
  function longDate(key) {
    var d = D.parse(key);
    return Store.data.settings.lang === 'ar'
      ? d.getDate() + ' ' + s().months[d.getMonth()]
      : s().months[d.getMonth()] + ' ' + d.getDate();
  }
  function rel(key) {
    var n = D.diff(D.todayKey(), key);
    if (n === 0) return s().today;
    if (n === 1) return s().tomorrow;
    if (n === -1) return s().yesterday;
    return longDate(key);
  }

  var I = {
    check: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M14 6 8 12l6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M4 9a6 6 0 0 1 6-6h10M20 15a6 6 0 0 1-6 6H4"/><path d="M17 1l3 2-3 2M7 19l-3 2 3 2"/></svg>'
  };

  /* ------------------------------- render -------------------------------- */
  function rowHTML(it, showDate) {
    var late = !it.done && it.date < D.todayKey();
    var when = it.time ? clock(it.time) + (it.end ? ' – ' + clock(it.end) : '') : '';
    if (showDate) when = (when ? when + ' · ' : '') + rel(it.date);
    else if (late) when = (when ? when + ' · ' : '') + longDate(it.date);
    return '<div class="row' + (it.done ? ' done' : '') + (it.big ? ' big' : '') + '" draggable="true" data-id="' + it.id + '">' +
      '<button class="mark-btn" data-act="toggle" data-id="' + it.id + '" aria-label="' + esc(s().done) + '">' + I.check + '</button>' +
      '<button class="t" dir="auto" data-act="open" data-id="' + it.id + '">' + esc(it.title) + '</button>' +
      (it.repeat !== 'none' ? '<span class="rep">' + I.repeat + '</span>' : '') +
      (when ? '<span class="when' + (late ? ' late' : '') + '">' + esc(when) + '</span>' : '') +
      '</div>';
  }

  function renderMonth() {
    var ws = Store.data.settings.weekStart, tk = D.todayKey(), cm = V.cursor.getMonth();
    var days = D.grid(V.cursor, ws);
    var dow = '', order = days.slice(0, 7);
    order.forEach(function (d) { dow += '<span>' + esc(s().dow1[d.getDay()]) + '</span>'; });

    var cells = days.map(function (d) {
      var k = D.key(d), items = Store.onDay(k);
      var pips = items.slice(0, 3).map(function (i) {
        return '<i class="' + (i.done ? 'done' : '') + '"></i>';
      }).join('');
      return '<button class="cell' + (d.getMonth() !== cm ? ' out' : '') + (k === tk ? ' today' : '') +
        (k === V.sel ? ' sel' : '') + '" data-act="day" data-key="' + k + '">' +
        '<span class="n">' + d.getDate() + '</span><span class="pips">' + pips + '</span></button>';
    }).join('');

    $('board').innerHTML = '<div class="dow">' + dow + '</div><div class="grid">' + cells + '</div>';
  }

  function renderAgenda() {
    var tk = D.todayKey();
    var up = Store.data.items.filter(function (i) { return !i.done && i.date >= tk; });
    var groups = {};
    up.forEach(function (i) { (groups[i.date] = groups[i.date] || []).push(i); });
    var keys = Object.keys(groups).sort().slice(0, 30);
    $('board').innerHTML = keys.length
      ? '<div class="agenda">' + keys.map(function (k) {
          return '<h3><b>' + esc(rel(k)) + '</b>' + esc(dayName(k)) + '</h3>' +
                 groups[k].sort(Store.order).map(function (i) { return rowHTML(i); }).join('');
        }).join('') + '</div>'
      : '<div class="empty">' + esc(s().empty) + '</div>';
  }

  function render() {
    var st = Store.data.settings, tk = D.todayKey();
    document.documentElement.lang = st.lang;
    document.documentElement.dir = s().dir;
    document.documentElement.dataset.theme = st.theme;

    $('month').innerHTML = esc(s().months[V.cursor.getMonth()]) + '<span>' + V.cursor.getFullYear() + '</span>';
    var offMonth = !(V.cursor.getFullYear() === D.today().getFullYear() && V.cursor.getMonth() === D.today().getMonth());
    $('todayPill').hidden = !offMonth;
    $('todayPill').textContent = s().today;

    if (V.view === 'month') renderMonth(); else renderAgenda();

    var items = Store.onDay(V.sel);
    var open = items.filter(function (i) { return !i.done; });
    /* anything still open from earlier days belongs on today's plan */
    var late = V.sel === tk
      ? Store.data.items.filter(function (i) { return !i.done && i.date < tk; }).sort(Store.order)
      : [];

    $('dayName').textContent = dayName(V.sel);
    $('dayDate').textContent = longDate(V.sel) + (V.sel === tk ? ' · ' + s().today : '');
    $('count').textContent = items.length ? (items.length - open.length) + '/' + items.length : '—';

    var body = late.map(function (i) { return rowHTML(i, false); }).join('') +
               items.map(function (i) { return rowHTML(i); }).join('');
    $('list').innerHTML = body || '<div class="empty">' + esc(s().empty) + '</div>';
    $('quick').placeholder = s().add;
  }

  /* -------------------------------- toast -------------------------------- */
  function toast(msg, label, undo) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(msg) + '</span>';
    if (undo) {
      var b = document.createElement('button');
      b.textContent = label;
      b.onclick = function () { undo(); el.remove(); };
      el.appendChild(b);
    }
    $('toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, undo ? 5500 : 2400);
  }

  /* ------------------------------- editor -------------------------------- */
  function openEditor(item) {
    editing = item;
    $('eTitle').value = item.title || '';
    $('eDate').value = item.date || V.sel;
    $('eTime').value = item.time || '';
    $('eEnd').value = item.end || '';
    $('eNote').value = item.note || '';
    $('eBig').classList.toggle('on', !!item.big);
    $('eTitle').placeholder = s().title;
    $('endWrap').hidden = !item.time;
    $('eRepeat').value = item.repeat || 'none';
    $('eDel').hidden = !item.id;
    ['lTitle', 'lDate', 'lTime', 'lEnd', 'lNote', 'lRepeat'].forEach(function (id, n) {
      $(id).textContent = [s().title, s().date, s().time, s().until, s().note, s().repeat][n];
    });
    $('eBig').textContent = s().important;
    $('eSave').textContent = s().save;
    $('eDel').textContent = s().del;
    $('eRepeat').innerHTML = ['none', 'daily', 'workdays', 'weekly', 'monthly'].map(function (r) {
      return '<option value="' + r + '">' + esc(s()[r]) + '</option>';
    }).join('');
    $('eRepeat').value = item.repeat || 'none';
    $('editVeil').hidden = false;
    setTimeout(function () { $('eTitle').focus(); }, 30);
  }
  function saveEditor() {
    if (!editing) return;
    var patch = {
      title: $('eTitle').value.trim(),
      date: $('eDate').value || V.sel,
      time: $('eTime').value || null,
      end: $('eEnd').value || null,
      note: $('eNote').value.trim(),
      big: $('eBig').classList.contains('on'),
      repeat: $('eRepeat').value
    };
    if (!patch.title) { $('eTitle').focus(); return; }
    if (editing.id) Store.update(editing.id, patch); else Store.add(patch);
    V.sel = patch.date; V.cursor = D.parse(patch.date);
    $('editVeil').hidden = true; editing = null; render();
  }

  /* -------------------------------- menu --------------------------------- */
  function seg(name, opts, cur) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button data-set="' + name + '" data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' +
        esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function openMenu() {
    var st = Store.data.settings;
    $('menuBody').innerHTML =
      '<div class="opt"><label>' + esc(s().view) + '</label>' +
        seg('view', [['month', s().month], ['list', s().list]], V.view) + '</div>' +
      '<div class="opt"><label>' + esc(s().weekStart) + '</label>' +
        seg('weekStart', [[0, s().sun], [1, s().mon], [6, s().sat]], st.weekStart) + '</div>' +
      '<div class="opt"><label>' + esc(s().theme) + '</label>' +
        seg('theme', [['light', s().light], ['dark', s().dark]], st.theme) + '</div>' +
      '<div class="opt"><label>' + esc(s().lang) + '</label>' +
        seg('lang', [['ar', 'ع'], ['en', 'EN']], st.lang) + '</div>' +
      [['search', s().search], ['export', s().exportJ], ['import', s().importJ],
       ['ics', s().ics], ['clear', s().clearDone]].map(function (r) {
        return '<button class="optrow" data-do="' + r[0] + '">' + esc(r[1]) + '</button>';
      }).join('');
    $('menuClose').textContent = s().close;
    $('menuVeil').hidden = false;
  }

  /* ------------------------------ backup --------------------------------- */
  function icsEsc(x) { return String(x).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
  function toICS() {
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIDHAM//EN'];
    Store.data.items.forEach(function (i) {
      var d = i.date.replace(/-/g, '');
      out.push('BEGIN:VEVENT', 'UID:' + i.id + '@nidham');
      if (i.time) {
        out.push('DTSTART:' + d + 'T' + i.time.replace(':', '') + '00');
        out.push('DTEND:' + d + 'T' + (i.end || i.time).replace(':', '') + '00');
      } else out.push('DTSTART;VALUE=DATE:' + d);
      out.push('SUMMARY:' + icsEsc(i.title));
      if (i.note) out.push('DESCRIPTION:' + icsEsc(i.note));
      out.push('END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n');
  }
  function offer(name, text) {
    $('dataBox').value = text;
    $('dataVeil').hidden = false;
    $('dataCopy').textContent = s().copied.replace(/.$/, '') && s().exportJ;
    var ok = false;
    try {
      var url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      var a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 800);
      ok = true;
    } catch (e) {}
    if (!ok) toast(s().inBox);
  }

  /* ------------------------------- events -------------------------------- */
  function onClick(e) {
    var el = e.target.closest('[data-act],[data-set],[data-do]');
    if (!el) return;

    if (el.dataset.act === 'day') { V.sel = el.dataset.key; render(); return; }
    if (el.dataset.act === 'prev') { V.cursor = D.addMonths(V.cursor, -1); render(); return; }
    if (el.dataset.act === 'next') { V.cursor = D.addMonths(V.cursor, 1); render(); return; }
    if (el.dataset.act === 'today') { V.cursor = D.today(); V.sel = D.todayKey(); render(); return; }
    if (el.dataset.act === 'open') { openEditor(Store.get(el.dataset.id)); return; }
    if (el.dataset.act === 'toggle') {
      var r = Store.toggle(el.dataset.id);
      render();
      if (r && r.item.done && r.next) toast(rel(r.next.date), s().undo, function () {
        Store.remove(r.next.id); Store.update(r.item.id, { done: false, doneAt: null }); render();
      });
      return;
    }

    if (el.dataset.set) {                                   /* menu segments */
      var k = el.dataset.set, v = el.dataset.v;
      if (k === 'view') { V.view = v; Store.data.settings.view = v; }
      else Store.data.settings[k] = (k === 'weekStart') ? +v : v;
      Store.save(); openMenu(); render(); return;
    }

    if (el.dataset.do) {
      var d = el.dataset.do;
      $('menuVeil').hidden = true;
      if (d === 'search') { $('searchVeil').hidden = false; $('searchInput').value = ''; $('hits').innerHTML = '';
        $('searchInput').placeholder = s().searchGo; setTimeout(function () { $('searchInput').focus(); }, 30); }
      if (d === 'export') offer('nidham-' + D.todayKey() + '.json', JSON.stringify(Store.data, null, 2));
      if (d === 'ics') offer('nidham-' + D.todayKey() + '.ics', toICS());
      if (d === 'import') { $('dataBox').value = ''; $('dataVeil').hidden = false; setTimeout(function(){ $('dataBox').focus(); }, 30); }
      if (d === 'clear') {
        Store.data.items = Store.data.items.filter(function (i) { return !i.done; });
        Store.save(); render();
      }
      return;
    }
  }

  function quickAdd() {
    var t = $('quick').value.trim();
    if (!t) return;
    var it = Store.add(N.parseQuick(t, V.sel));
    $('quick').value = '';
    V.sel = it.date; V.cursor = D.parse(it.date);
    render();
  }

  var hitIdx = 0;
  function search() {
    var q = $('searchInput').value.trim().toLowerCase();
    if (!q) { $('hits').innerHTML = ''; return; }
    var found = Store.data.items.filter(function (i) {
      return (i.title + ' ' + i.note).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 15);
    hitIdx = 0;
    $('hits').innerHTML = found.length ? found.map(function (i, n) {
      return '<button class="hit' + (n === 0 ? ' on' : '') + '" data-id="' + i.id + '">' +
        '<span dir="auto">' + (i.done ? '· ' : '') + esc(i.title) + '</span><small>' + esc(rel(i.date)) + '</small></button>';
    }).join('') : '<div class="empty">' + esc(s().nores) + '</div>';
  }
  function jump(id) {
    var it = Store.get(id); if (!it) return;
    $('searchVeil').hidden = true;
    V.sel = it.date; V.cursor = D.parse(it.date);
    render(); openEditor(it);
  }

  function bind() {
    document.addEventListener('click', onClick);
    $('menuBtn').onclick = openMenu;
    $('menuClose').onclick = function () { $('menuVeil').hidden = true; };
    $('addForm').onsubmit = function (e) { e.preventDefault(); quickAdd(); };
    $('addBtn').onclick = function () { openEditor({ date: V.sel, repeat: 'none' }); };

    $('eSave').onclick = saveEditor;
    $('eBig').onclick = function () { this.classList.toggle('on'); };
    $('eTime').addEventListener('input', function () { $('endWrap').hidden = !this.value; });
    $('eDel').onclick = function () {
      if (editing && editing.id) {
        var g = Store.remove(editing.id);
        $('editVeil').hidden = true; editing = null; render();
        toast(s().deleted, s().undo, function () { Store.put(g.item, g.at); render(); });
      }
    };
    $('eTitle').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveEditor(); } });

    $('searchInput').addEventListener('input', search);
    $('searchInput').addEventListener('keydown', function (e) {
      var hits = [].slice.call($('hits').querySelectorAll('.hit'));
      if (!hits.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); hits[hitIdx].classList.remove('on');
        hitIdx = (hitIdx + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
        hits[hitIdx].classList.add('on'); hits[hitIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); jump(hits[hitIdx].dataset.id); }
    });
    $('hits').addEventListener('click', function (e) {
      var b = e.target.closest('.hit'); if (b) jump(b.dataset.id);
    });

    $('dataSave').onclick = function () {
      try {
        var p = JSON.parse($('dataBox').value);
        if (!p || !Array.isArray(p.items)) throw 0;
        localStorage.setItem('nidham.v1', JSON.stringify(p));
        Store.load(); $('dataVeil').hidden = true; render();
      } catch (e) { toast(s().bad); }
    };
    $('dataCopy').onclick = function () {
      $('dataBox').select();
      try { document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText($('dataBox').value).catch(function () {});
      toast(s().copied);
    };
    $('dataClose').onclick = function () { $('dataVeil').hidden = true; };

    ['menuVeil', 'editVeil', 'searchVeil', 'dataVeil'].forEach(function (id) {
      $(id).addEventListener('mousedown', function (e) { if (e.target === this) this.hidden = true; });
    });

    /* drag a task onto another day */
    var dragId = null;
    document.addEventListener('dragstart', function (e) {
      var r = e.target.closest('.row'); if (!r) return;
      dragId = r.dataset.id; r.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
    });
    document.addEventListener('dragend', function () {
      dragId = null;
      [].forEach.call(document.querySelectorAll('.dragging,.drop'), function (n) { n.classList.remove('dragging', 'drop'); });
    });
    document.addEventListener('dragover', function (e) {
      var c = e.target.closest('.cell'); if (!c || !dragId) return;
      e.preventDefault();
      if (!c.classList.contains('drop')) {
        [].forEach.call(document.querySelectorAll('.drop'), function (n) { n.classList.remove('drop'); });
        c.classList.add('drop');
      }
    });
    document.addEventListener('drop', function (e) {
      var c = e.target.closest('.cell');
      var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (!c || !id) return;
      e.preventDefault();
      var it = Store.get(id), from = it && it.date;
      if (!it || from === c.dataset.key) return;
      Store.update(id, { date: c.dataset.key });
      V.sel = c.dataset.key; render();
      toast(s().moved + ' · ' + rel(c.dataset.key), s().undo, function () {
        Store.update(id, { date: from }); render();
      });
    });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape') {
        ['menuVeil', 'editVeil', 'searchVeil', 'dataVeil'].forEach(function (id) { $(id).hidden = true; });
        if (typing) document.activeElement.blur();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); $('searchVeil').hidden = false; $('searchInput').value = ''; $('hits').innerHTML = '';
        setTimeout(function () { $('searchInput').focus(); }, 20); return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); openEditor({ date: V.sel, repeat: 'none' }); }
      else if (k === 't') { V.cursor = D.today(); V.sel = D.todayKey(); render(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var fwd = (e.key === 'ArrowRight') !== (document.documentElement.dir === 'rtl');
        V.cursor = D.addMonths(V.cursor, fwd ? 1 : -1); render();
      }
    });

    var boot = D.todayKey();
    setInterval(function () { if (D.todayKey() !== boot) { boot = D.todayKey(); render(); } }, 60000);
  }

  function seed() {
    if (Store.data.items.length || localStorage.getItem('nidham.seeded')) return;
    var ar = Store.data.settings.lang === 'ar', t = D.todayKey();
    Store.add({ title: ar ? 'ساعة رياضيات' : 'One hour of math', date: t, time: '20:00', repeat: 'daily' });
    Store.add({ title: ar ? 'مراجعة خطة الأسبوع' : 'Review the week', date: D.key(D.add(D.today(), 1)), time: '09:00', big: true });
    try { localStorage.setItem('nidham.seeded', '1'); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    Store.load();
    V.view = Store.data.settings.view || 'month';
    $('prevBtn').innerHTML = I.left; $('nextBtn').innerHTML = I.right;
    $('menuBtn').innerHTML = I.more; $('addBtn').innerHTML = I.plus;
    seed(); bind(); render();
    if (location.protocol.indexOf('http') === 0 && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  });
})(window);
