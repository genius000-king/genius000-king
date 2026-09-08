/* NIDHAM — wiring: events, modals, keyboard, drag & drop, backup. */
(function (root) {
  'use strict';
  var N = root.NID, D = N.D, Store = N.Store, UI = N.UI, V = UI.V;
  var $ = function (id) { return document.getElementById(id); };
  var editing = null;   /* id being edited, or a draft object */

  /* ------------------------------ toasts ---------------------------------- */
  function toast(msg, actionLabel, action) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + UI.esc(msg) + '</span>';
    if (action) {
      var b = document.createElement('button');
      b.textContent = actionLabel;
      b.onclick = function () { action(); el.remove(); };
      el.appendChild(b);
    }
    $('toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, action ? 6000 : 2600);
  }

  /* ---------------------------- theme / lang ------------------------------ */
  function applyShell() {
    var s = Store.data.settings, str = N.STR[s.lang];
    document.documentElement.lang = s.lang;
    document.documentElement.dir = str.dir;
    document.documentElement.dataset.theme = s.theme === 'night' ? 'night' : 'day';
    $('btnLang').textContent = s.lang === 'ar' ? 'EN' : 'ع';
    $('btnTheme').classList.toggle('on', s.theme === 'night');
  }

  /* ------------------------------- editor --------------------------------- */
  function openEditor(idOrDraft) {
    var s = UI.t();
    var it = typeof idOrDraft === 'string' ? Store.get(idOrDraft) : idOrDraft;
    if (!it) return;
    editing = it;
    var isNew = !it.id;
    $('edTitleH').textContent = isNew ? s.newItem : s.editItem;
    $('edTitle').value = it.title || '';
    $('edDate').value = it.date || '';
    $('edTime').value = it.time || '';
    $('edEnd').value = it.end || '';
    $('edNotes').value = it.notes || '';
    $('edList').value = it.list || 'general';
    $('edRepeat').value = it.repeat || 'none';
    paintSeg('edKind', it.kind || 'task');
    paintSeg('edPrio', it.priority || 'normal');
    $('edDel').style.display = isNew ? 'none' : '';
    $('edEndWrap').style.display = (it.kind === 'event') ? '' : 'none';
    labelEditor();
    $('editVeil').hidden = false;
    setTimeout(function () { $('edTitle').focus(); }, 30);
  }
  function labelEditor() {
    var s = UI.t();
    [['lTitle', s.title], ['lDate', s.date], ['lTime', s.time], ['lEnd', s.endTime], ['lNotes', s.notes],
     ['lPrio', s.priority], ['lList', s.lists], ['lRepeat', s.repeat], ['lKind', s.kind]]
      .forEach(function (p) { $(p[0]).textContent = p[1]; });
    $('edKind').innerHTML = seg([['task', s.task], ['event', s.event]], currentSeg('edKind') || 'task');
    $('edPrio').innerHTML = seg([['low', s.low], ['normal', s.normal], ['high', s.high]], currentSeg('edPrio') || 'normal');
    $('edRepeat').innerHTML = [['none', s.none], ['daily', s.daily], ['weekdays', s.weekdays], ['weekly', s.weekly], ['monthly', s.monthly]]
      .map(function (p) { return '<option value="' + p[0] + '">' + UI.esc(p[1]) + '</option>'; }).join('');
    $('edSave').textContent = s.save; $('edCancel').textContent = s.cancel; $('edDel').textContent = s.del;
  }
  function seg(pairs, cur) {
    return pairs.map(function (p) {
      return '<button type="button" data-v="' + p[0] + '" class="' + (p[0] === cur ? 'on' : '') + '">' + UI.esc(p[1]) + '</button>';
    }).join('');
  }
  function currentSeg(id) {
    var on = $(id) && $(id).querySelector('.on');
    return on ? on.dataset.v : null;
  }
  function paintSeg(id, val) {
    var host = $(id);
    if (!host.children.length) return;
    Array.prototype.forEach.call(host.children, function (b) { b.classList.toggle('on', b.dataset.v === val); });
  }
  function closeEditor() { $('editVeil').hidden = true; editing = null; }

  function saveEditor() {
    if (!editing) return;
    var patch = {
      title: $('edTitle').value.trim(),
      date: $('edDate').value || null,
      time: $('edTime').value || null,
      end: $('edEnd').value || null,
      notes: $('edNotes').value.trim(),
      list: ($('edList').value || 'general').trim().toLowerCase(),
      repeat: $('edRepeat').value,
      kind: currentSeg('edKind') || 'task',
      priority: currentSeg('edPrio') || 'normal'
    };
    if (!patch.title) { $('edTitle').focus(); return; }
    if (patch.kind === 'event' && !patch.date) patch.date = V.selected;
    if (editing.id) Store.update(editing.id, patch);
    else Store.add(patch);
    if (patch.date) { V.selected = patch.date; V.cursor = D.parse(patch.date); V.filter = 'day'; }
    closeEditor(); UI.render();
  }

  /* ------------------------------ quick add -------------------------------- */
  function quickAdd() {
    var input = $('quick'), text = input.value.trim();
    if (!text) return;
    var base = V.filter === 'inbox' ? null : V.selected;
    var parsed = N.parseQuick(text, base, Store.data.settings.lang);
    var it = Store.add(parsed);
    input.value = '';
    if (it.date) { V.selected = it.date; V.cursor = D.parse(it.date); if (V.filter !== 'day') V.filter = 'day'; }
    UI.render();
  }

  /* -------------------------------- search --------------------------------- */
  var searchCur = 0;
  function runSearch() {
    var q = $('searchInput').value.trim().toLowerCase();
    var host = $('searchResults');
    if (!q) { host.innerHTML = ''; return; }
    var hits = Store.data.items.filter(function (i) {
      return (i.title + ' ' + (i.notes || '') + ' ' + (i.list || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; }).slice(0, 20);
    searchCur = 0;
    host.innerHTML = hits.length ? hits.map(function (i, n) {
      return '<button class="res' + (n === 0 ? ' cur' : '') + '" data-id="' + i.id + '">' +
        '<span>' + (i.done ? '✓ ' : '') + UI.esc(i.title) + '</span>' +
        '<small>' + (i.date ? UI.esc(UI.fmtDay(i.date)) : '—') + '</small></button>';
    }).join('') : '<div class="empty">' + UI.esc(UI.t().noItems) + '</div>';
  }
  function jumpTo(id) {
    var it = Store.get(id);
    if (!it) return;
    $('searchVeil').hidden = true;
    if (it.date) { V.selected = it.date; V.cursor = D.parse(it.date); V.filter = 'day'; }
    else V.filter = 'inbox';
    UI.render(); openEditor(it.id);
  }

  /* --------------------------- backup / export ----------------------------- */
  function icsEscape(s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
  function toICS() {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIDHAM//EN', 'CALSCALE:GREGORIAN'];
    Store.data.items.filter(function (i) { return i.date; }).forEach(function (i) {
      var d = i.date.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:' + i.id + '@nidham');
      if (i.time) {
        var st = d + 'T' + i.time.replace(':', '') + '00';
        var en = i.end ? d + 'T' + i.end.replace(':', '') + '00'
                       : d + 'T' + String(Math.min(23, +i.time.slice(0, 2) + 1)).padStart(2, '0') + i.time.slice(3) + '00';
        lines.push('DTSTART:' + st, 'DTEND:' + en);
      } else {
        lines.push('DTSTART;VALUE=DATE:' + d);
      }
      lines.push('SUMMARY:' + icsEscape(i.title));
      if (i.notes) lines.push('DESCRIPTION:' + icsEscape(i.notes));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function offerFile(name, text) {
    $('dataBox').value = text;
    $('dataBox').dataset.name = name;
    try {
      var url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      var a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* sandboxed viewers: the textarea + copy button is the fallback */ }
  }

  /* ------------------------------ first run -------------------------------- */
  function seed() {
    if (Store.data.items.length || localStorage.getItem('nidham.seeded')) return;
    var ar = Store.data.settings.lang === 'ar';
    var tk = D.todayKey(), tm = D.key(D.add(D.today(), 1));
    Store.add({ title: ar ? 'راجع خطة اليوم' : 'Review today’s plan', date: tk, time: '09:00', priority: 'high' });
    Store.add({ title: ar ? 'ساعة رياضيات' : 'One hour of math', date: tk, time: '20:00', repeat: 'daily', list: 'study' });
    Store.add({ title: ar ? 'اجتماع المشروع' : 'Project sync', kind: 'event', date: tm, time: '15:00', end: '16:00', list: 'work' });
    try { localStorage.setItem('nidham.seeded', '1'); } catch (e) {}
  }

  /* ------------------------------- events ---------------------------------- */
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act, s = UI.t();

    if (act === 'day') { V.selected = el.dataset.key; V.filter = 'day'; UI.render(); return; }
    if (act === 'view') { V.view = el.dataset.v; Store.data.settings.view = V.view; Store.save(); UI.render(); return; }
    if (act === 'filter') { V.filter = el.dataset.f; UI.render(); return; }
    if (act === 'edit') { openEditor(el.dataset.id); return; }

    if (act === 'toggle') {
      var r = Store.toggle(el.dataset.id);
      if (r) {
        UI.render();
        if (r.item.done) toast(s.completed + (r.spawned ? ' · ↻ ' + UI.fmtDay(r.spawned.date) : ''), s.undo, function () {
          if (r.spawned) Store.remove(r.spawned.id);
          Store.update(r.item.id, { done: false, doneAt: null });
          UI.render();
        });
      }
      return;
    }
    if (act === 'del') {
      var g = Store.remove(el.dataset.id);
      if (g) {
        UI.render();
        toast(s.deleted, s.undo, function () { Store.insertAt(g.item, g.index); UI.render(); });
      }
      return;
    }
    if (act === 'prev') { V.cursor = V.view === 'week' ? D.add(V.cursor, -7) : D.addMonths(V.cursor, -1); UI.render(); return; }
    if (act === 'next') { V.cursor = V.view === 'week' ? D.add(V.cursor, 7) : D.addMonths(V.cursor, 1); UI.render(); return; }
    if (act === 'today') { V.cursor = D.today(); V.selected = D.todayKey(); V.filter = 'day'; UI.render(); return; }
  }

  function bind() {
    document.addEventListener('click', onClick);

    $('quickGo').onclick = quickAdd;
    $('quick').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); quickAdd(); }
    });

    $('btnLang').onclick = function () {
      Store.data.settings.lang = Store.data.settings.lang === 'ar' ? 'en' : 'ar';
      Store.save(); applyShell(); labelEditor(); UI.render();
    };
    $('btnTheme').onclick = function () {
      Store.data.settings.theme = Store.data.settings.theme === 'night' ? 'day' : 'night';
      Store.save(); applyShell();
    };
    $('btnSearch').onclick = function () {
      $('searchVeil').hidden = false; $('searchInput').value = ''; $('searchResults').innerHTML = '';
      $('searchInput').placeholder = UI.t().search;
      setTimeout(function () { $('searchInput').focus(); }, 30);
    };
    $('btnData').onclick = function () {
      var s = UI.t();
      $('dataTitleH').textContent = s.dataTitle;
      $('dataSubP').textContent = s.dataSub;
      $('dataBox').value = JSON.stringify(Store.data, null, 2);
      $('btnExport').textContent = s.exportJson; $('btnIcs').textContent = s.exportIcs;
      $('btnImport').textContent = s.importJson; $('btnCopy').textContent = s.copy;
      $('btnClearDone').textContent = s.clearDone; $('dataClose').textContent = s.close;
      $('wsLabel').textContent = s.weekStart;
      $('wsSel').innerHTML = [[0, s.sunday], [1, s.monday], [6, s.saturday]].map(function (p) {
        return '<option value="' + p[0] + '"' + (Store.data.settings.weekStart === p[0] ? ' selected' : '') + '>' + UI.esc(p[1]) + '</option>';
      }).join('');
      $('dataVeil').hidden = false;
    };
    $('wsSel').onchange = function () {
      Store.data.settings.weekStart = +this.value; Store.save(); UI.render();
    };
    $('btnExport').onclick = function () { offerFile('nidham-backup-' + D.todayKey() + '.json', JSON.stringify(Store.data, null, 2)); };
    $('btnIcs').onclick = function () { offerFile('nidham-' + D.todayKey() + '.ics', toICS()); };
    $('btnCopy').onclick = function () {
      $('dataBox').select();
      try { document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText($('dataBox').value).catch(function () {});
      toast(UI.t().copied);
    };
    $('btnImport').onclick = function () {
      try {
        var parsed = JSON.parse($('dataBox').value);
        if (!parsed || !Array.isArray(parsed.items)) throw new Error('shape');
        Store.data = Object.assign(Store.data, parsed);
        Store.save(); applyShell(); UI.render();
        $('dataVeil').hidden = true; toast(UI.t().imported);
      } catch (e) { toast(UI.t().badJson); }
    };
    $('btnClearDone').onclick = function () {
      Store.data.items = Store.data.items.filter(function (i) { return !i.done; });
      Store.save(); UI.render();
    };

    /* editor */
    $('edSave').onclick = saveEditor;
    $('edCancel').onclick = closeEditor;
    $('edDel').onclick = function () {
      if (editing && editing.id) { Store.remove(editing.id); closeEditor(); UI.render(); }
    };
    $('edKind').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      paintSeg('edKind', b.dataset.v);
      $('edEndWrap').style.display = b.dataset.v === 'event' ? '' : 'none';
    };
    $('edPrio').onclick = function (e) {
      var b = e.target.closest('button'); if (b) paintSeg('edPrio', b.dataset.v);
    };
    $('edTitle').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveEditor(); }
    });

    /* search */
    $('searchInput').addEventListener('input', runSearch);
    $('searchInput').addEventListener('keydown', function (e) {
      var res = Array.prototype.slice.call($('searchResults').querySelectorAll('.res'));
      if (!res.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        res[searchCur].classList.remove('cur');
        searchCur = (searchCur + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length;
        res[searchCur].classList.add('cur');
        res[searchCur].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); jumpTo(res[searchCur].dataset.id); }
    });
    $('searchResults').addEventListener('click', function (e) {
      var b = e.target.closest('.res'); if (b) jumpTo(b.dataset.id);
    });

    /* veils close on backdrop click */
    ['editVeil', 'searchVeil', 'dataVeil'].forEach(function (id) {
      $(id).addEventListener('mousedown', function (e) { if (e.target === this) this.hidden = true; });
    });
    $('dataClose').onclick = function () { $('dataVeil').hidden = true; };

    /* drag & drop: move an item to another day */
    var dragId = null;
    document.addEventListener('dragstart', function (e) {
      var it = e.target.closest('.item,.chip-item'); if (!it) return;
      dragId = it.dataset.id; it.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
    });
    document.addEventListener('dragend', function (e) {
      var it = e.target.closest('.item,.chip-item'); if (it) it.classList.remove('dragging');
      dragId = null;
      Array.prototype.forEach.call(document.querySelectorAll('.drop'), function (n) { n.classList.remove('drop'); });
    });
    document.addEventListener('dragover', function (e) {
      var zone = e.target.closest('[data-act="day"],[data-act="dayzone"]');
      if (!zone || !dragId) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (!zone.classList.contains('drop')) {
        Array.prototype.forEach.call(document.querySelectorAll('.drop'), function (n) { n.classList.remove('drop'); });
        zone.classList.add('drop');
      }
    });
    document.addEventListener('drop', function (e) {
      var zone = e.target.closest('[data-act="day"],[data-act="dayzone"]');
      var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (!zone || !id) return;
      e.preventDefault();
      var it = Store.get(id), from = it && it.date;
      if (!it || from === zone.dataset.key) return;
      Store.update(id, { date: zone.dataset.key });
      V.selected = zone.dataset.key;
      UI.render();
      toast(UI.t().moved + ' ' + UI.fmtDay(zone.dataset.key), UI.t().undo, function () {
        Store.update(id, { date: from }); UI.render();
      });
    });

    /* keyboard */
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape') {
        ['editVeil', 'searchVeil', 'dataVeil'].forEach(function (id) { $(id).hidden = true; });
        if (typing) document.activeElement.blur();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('btnSearch').click(); }
        return;
      }
      var k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); openEditor({ kind: 'task', date: V.filter === 'inbox' ? null : V.selected, priority: 'normal', list: 'general', repeat: 'none' }); }
      else if (k === '/') { e.preventDefault(); $('btnSearch').click(); }
      else if (k === 't') { V.cursor = D.today(); V.selected = D.todayKey(); V.filter = 'day'; UI.render(); }
      else if (k === 'm') { V.view = 'month'; UI.render(); }
      else if (k === 'w') { V.view = 'week'; UI.render(); }
      else if (k === 'a') { V.view = 'agenda'; UI.render(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var rtl = document.documentElement.dir === 'rtl';
        var fwd = (e.key === 'ArrowRight') !== rtl;
        V.cursor = V.view === 'week' ? D.add(V.cursor, fwd ? 7 : -7) : D.addMonths(V.cursor, fwd ? 1 : -1);
        UI.render();
      }
    });

    /* a session left open overnight should not keep yesterday as "today" */
    var boot = D.todayKey();
    setInterval(function () { if (D.todayKey() !== boot) { boot = D.todayKey(); UI.render(); } }, 60000);
  }

  /* --------------------------------- init ---------------------------------- */
  function init() {
    Store.load();
    V.view = Store.data.settings.view || 'month';
    applyShell();
    seed();
    bind();
    labelEditor();
    UI.render();
    if (location.protocol.indexOf('http') === 0 && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})(window);
