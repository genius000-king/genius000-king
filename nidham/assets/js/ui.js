/* NIDHAM — rendering layer. Pure: reads Store + view state, writes DOM. */
(function (root) {
  'use strict';
  var D = root.NID.D, Store = root.NID.Store, STR = root.NID.STR;

  var V = {
    cursor: D.today(),          /* month/week being looked at */
    selected: D.todayKey(),     /* day whose plan is in the panel */
    view: 'month',
    filter: 'day'               /* day | upcoming | overdue | inbox | done */
  };

  function t() { return STR[Store.data.settings.lang] || STR.ar; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>'
  };

  function fmtDay(key) {
    var s = t(), d = D.parse(key);
    return s.dow[d.getDay()] + ' ' + d.getDate() + ' ' + s.months[d.getMonth()];
  }

  function relLabel(key) {
    var s = t(), n = D.diffDays(D.todayKey(), key);
    if (n === 0) return s.today;
    if (n === 1) return s.locale === 'ar' ? 'غدًا' : 'Tomorrow';
    if (n === -1) return s.locale === 'ar' ? 'أمس' : 'Yesterday';
    if (n === 2) return s.locale === 'ar' ? 'بعد يومين' : 'in 2 days';
    if (n > 0) return s.locale === 'ar' ? ('بعد ' + n + ' أيام') : ('in ' + n + ' days');
    return s.locale === 'ar' ? ('قبل ' + (-n) + ' أيام') : (-n + ' days ago');
  }

  /* ------------------------------- items ---------------------------------- */
  function itemHTML(it, opts) {
    opts = opts || {};
    var s = t(), tags = [];
    if (it.kind === 'event') tags.push('<span class="tag ev">' + esc(s.event) + '</span>');
    if (it.time) tags.push('<span class="tag"><bdi>' + esc(D.hhmm(it.time)) + (it.end ? ' – ' + esc(D.hhmm(it.end)) : '') + '</bdi></span>');
    if (it.priority === 'high') tags.push('<span class="tag p-high">' + esc(s.high) + '</span>');
    if (it.priority === 'low') tags.push('<span class="tag p-low">' + esc(s.low) + '</span>');
    if (it.list && it.list !== 'general') tags.push('<span class="tag"><bdi>#' + esc(it.list) + '</bdi></span>');
    if (it.repeat && it.repeat !== 'none') tags.push('<span class="tag rep"><bdi>' + esc(s[it.repeat] || it.repeat) + '</bdi></span>');
    if (opts.showDate && it.date) tags.push('<span class="tag"><bdi>' + esc(fmtDay(it.date)) + '</bdi></span>');
    if (!it.done && it.kind === 'task' && it.date && it.date < D.todayKey())
      tags.push('<span class="tag over">' + esc(s.overdue) + '</span>');

    var tick = it.kind === 'event'
      ? '<span class="tick" style="border-style:dashed" aria-hidden="true"></span>'
      : '<button class="tick" data-act="toggle" data-id="' + it.id + '" aria-label="' + esc(s.done) + '" aria-pressed="' + (it.done ? 'true' : 'false') + '">' + ICON.check + '</button>';

    return '<article class="item' + (it.done ? ' done' : '') + '" draggable="true" data-id="' + it.id + '">' +
      '<span class="grab" aria-hidden="true">' + ICON.grip + '</span>' + tick +
      '<div class="body"><button class="title" dir="auto" data-act="edit" data-id="' + it.id + '" style="text-align:start;width:100%">' + esc(it.title) + '</button>' +
      (tags.length ? '<div class="meta">' + tags.join('') + '</div>' : '') +
      (it.notes ? '<div class="meta"><span class="tag" dir="auto" style="text-transform:none;font-weight:600">' + esc(it.notes.slice(0, 60)) + '</span></div>' : '') +
      '</div>' +
      '<button class="kill" data-act="del" data-id="' + it.id + '" aria-label="' + esc(s.del) + '">' + ICON.x + '</button>' +
      '</article>';
  }

  function chipHTML(it) {
    var cls = 'chip-item' + (it.done ? ' done' : '') + (it.kind === 'event' ? ' ev' : '');
    return '<article class="' + cls + '" draggable="true" data-id="' + it.id + '">' +
      (it.kind === 'event'
        ? '<span class="dot ev" aria-hidden="true"></span>'
        : '<button class="dot" data-act="toggle" data-id="' + it.id + '" aria-label="done"></button>') +
      '<span class="cbody"><button class="ct" dir="auto" data-act="edit" data-id="' + it.id + '">' +
      esc(it.title) + '</button>' +
      (it.time ? '<bdi class="ctm">' + esc(D.hhmm(it.time)) + '</bdi>' : '') + '</span>' +
      '</article>';
  }

  /* ------------------------------ calendar -------------------------------- */
  function renderMonth(host) {
    var s = t(), ws = Store.data.settings.weekStart;
    var grid = D.monthGrid(V.cursor, ws), tk = D.todayKey(), cm = V.cursor.getMonth();
    var lastWeek = grid.slice(35);
    if (lastWeek.every(function (d) { return d.getMonth() !== cm; })) grid = grid.slice(0, 35);

    var dow = '<div class="dow">' + grid.slice(0, 7).map(function (d) {
      return '<span>' + esc(s.dow[d.getDay()]) + '</span>';
    }).join('') + '</div>';

    var cells = grid.map(function (d) {
      var k = D.key(d), items = Store.byDate(k);
      var cls = 'day' + (d.getMonth() !== cm ? ' out' : '') + (k === tk ? ' today' : '') + (k === V.selected ? ' sel' : '');
      var shown = items.slice(0, 3).map(function (i) {
        return '<div class="mini-row' + (i.done ? ' done' : '') + '" dir="auto"><i class="bar"></i>' +
               '<bdi class="n">' + esc(i.title) + '</bdi>' +
               (i.time ? '<bdi class="t">' + esc(i.time) + '</bdi>' : '') + '</div>';
      }).join('');
      var dots = items.slice(0, 4).map(function () { return '<i></i>'; }).join('');
      var more = items.length > 3 ? '<div class="more"><bdi>+' + (items.length - 3) + ' ' + esc(s.more) + '</bdi></div>' : '';
      return '<button class="' + cls + '" data-act="day" data-key="' + k + '" aria-label="' + esc(fmtDay(k)) + '">' +
        '<span class="num">' + d.getDate() + '</span>' +
        '<span class="mini">' + shown + more + '</span>' +
        '<span class="dots">' + dots + '</span></button>';
    }).join('');

    host.innerHTML = dow + '<div class="month">' + cells + '</div>';
  }

  function renderWeek(host) {
    var s = t(), ws = Store.data.settings.weekStart;
    var start = D.startOfWeek(V.cursor, ws), tk = D.todayKey();
    var cols = '';
    for (var i = 0; i < 7; i++) {
      var d = D.add(start, i), k = D.key(d), items = Store.byDate(k);
      cols += '<div class="wcol' + (k === tk ? ' today' : '') + (k === V.selected ? ' sel' : '') +
        '" data-act="dayzone" data-key="' + k + '">' +
        '<button class="whead" data-act="day" data-key="' + k + '">' +
        '<h4>' + esc(s.dow[d.getDay()]) + '</h4><div class="num">' + d.getDate() + '</div></button>' +
        '<div class="wbody">' + (items.length
          ? items.map(chipHTML).join('')
          : '<div class="wempty">—</div>') + '</div></div>';
    }
    host.innerHTML = '<div class="week">' + cols + '</div>';
  }

  function renderAgenda(host) {
    var s = t(), tk = D.todayKey();
    var upcoming = Store.data.items.filter(function (i) { return i.date && i.date >= tk; });
    var groups = {};
    upcoming.forEach(function (i) { (groups[i.date] = groups[i.date] || []).push(i); });
    var keys = Object.keys(groups).sort().slice(0, 30);
    if (!keys.length) {
      host.innerHTML = '<div class="empty"><b>' + esc(s.noItems) + '</b>' + esc(s.noItemsSub) + '</div>';
      return;
    }
    host.innerHTML = keys.map(function (k) {
      var rel = relLabel(k);
      return '<div class="agenda-day" data-act="dayzone" data-key="' + k + '">' +
        '<h3 class="display">' + esc(fmtDay(k)) + ' <em>' + esc(rel) + '</em></h3>' +
        groups[k].sort(Store.order).map(function (i) { return itemHTML(i); }).join('') + '</div>';
    }).join('');
  }

  /* -------------------------------- panel --------------------------------- */
  function panelItems() {
    var tk = D.todayKey(), all = Store.data.items;
    switch (V.filter) {
      case 'upcoming': return all.filter(function (i) { return !i.done && i.date && i.date > tk; }).sort(byDateThen);
      case 'overdue': return all.filter(function (i) { return !i.done && i.kind === 'task' && i.date && i.date < tk; }).sort(byDateThen);
      case 'inbox': return all.filter(function (i) { return !i.done && !i.date; }).sort(Store.order);
      case 'done': return all.filter(function (i) { return i.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
      default: return Store.byDate(V.selected);
    }
  }
  function byDateThen(a, b) { return a.date === b.date ? Store.order(a, b) : (a.date < b.date ? -1 : 1); }

  function renderPanel() {
    var s = t(), tk = D.todayKey(), st = Store.stats();
    var counts = {
      day: Store.byDate(V.selected).length,
      upcoming: Store.data.items.filter(function (i) { return !i.done && i.date && i.date > tk; }).length,
      overdue: st.overdue,
      inbox: Store.data.items.filter(function (i) { return !i.done && !i.date; }).length,
      done: Store.data.items.filter(function (i) { return i.done; }).length
    };
    var order = [['day', fmtDay(V.selected)], ['upcoming', s.upcoming], ['overdue', s.overdue], ['inbox', s.inbox], ['done', s.done]];
    document.getElementById('filters').innerHTML = order.map(function (p) {
      return '<button class="chip' + (V.filter === p[0] ? ' on' : '') + '" data-act="filter" data-f="' + p[0] + '">' +
        esc(p[1]) + '<span class="count">' + counts[p[0]] + '</span></button>';
    }).join('');

    var titleMap = { day: fmtDay(V.selected), upcoming: s.upcoming, overdue: s.overdue, inbox: s.inbox, done: s.done };
    document.getElementById('dayTitle').textContent = titleMap[V.filter];
    document.getElementById('daySub').textContent = V.filter === 'day'
      ? relLabel(V.selected) : (counts[V.filter] + ' · ' + s.tasksWord);

    var items = panelItems();
    var host = document.getElementById('list');
    if (!items.length) {
      host.innerHTML = '<div class="empty"><b>' + esc(s.noItems) + '</b>' + esc(s.noItemsSub) + '</div>';
    } else {
      var open = items.filter(function (i) { return !i.done; });
      var closed = items.filter(function (i) { return i.done; });
      host.innerHTML =
        open.map(function (i) { return itemHTML(i, { showDate: V.filter !== 'day' }); }).join('') +
        (closed.length && V.filter !== 'done'
          ? '<div class="sect-label">' + esc(s.done) + ' · ' + closed.length + '</div>' : '') +
        closed.map(function (i) { return itemHTML(i, { showDate: V.filter !== 'day' }); }).join('');
    }
  }

  function renderStats() {
    var s = t(), st = Store.stats();
    var R = 36, C = 2 * Math.PI * R, off = C * (1 - st.pct / 100);
    document.getElementById('statsCard').innerHTML =
      '<div class="stats">' +
        '<div class="ring"><svg width="84" height="84" viewBox="0 0 84 84">' +
          '<circle class="bg" cx="42" cy="42" r="' + R + '"></circle>' +
          '<circle class="fg" cx="42" cy="42" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
        '</svg><b>' + st.pct + '%</b></div>' +
        '<div class="stat-lines">' +
          '<strong><bdi>' + st.todayDone + '</bdi> ' + esc(s.doneOf) + ' <bdi>' + st.todayTotal + '</bdi> ' + esc(s.tasksWord) + '</strong>' +
          '<span><bdi>' + esc(s.streak) + ': ' + st.streak + '</bdi> · <bdi>' + esc(s.weekDone) + ': ' + st.weekDone + '</bdi></span>' +
          (st.overdue ? '<span style="font-weight:800"><bdi>⚠ ' + st.overdue + ' ' + esc(s.overdue) + '</bdi></span>' : '') +
        '</div>' +
      '</div>';
  }

  function renderChrome() {
    var s = t();
    document.getElementById('monthTitle').innerHTML =
      esc(s.months[V.cursor.getMonth()]) + ' <span>' + V.cursor.getFullYear() + '</span>';
    document.getElementById('tagline').textContent = s.tagline;
    document.getElementById('hint').innerHTML = s.hint;
    document.getElementById('quick').placeholder = s.addPlaceholder;
    document.getElementById('views').innerHTML = [['month', s.month], ['week', s.week], ['agenda', s.agenda]]
      .map(function (p) {
        return '<button data-act="view" data-v="' + p[0] + '" class="' + (V.view === p[0] ? 'on' : '') + '">' + esc(p[1]) + '</button>';
      }).join('');
    document.getElementById('notchToday').textContent = s.today;
  }

  function render() {
    var host = document.getElementById('calBody');
    renderChrome();
    if (V.view === 'month') renderMonth(host);
    else if (V.view === 'week') renderWeek(host);
    else renderAgenda(host);
    renderPanel();
    renderStats();
  }

  root.NID.UI = { V: V, chipHTML: chipHTML, render: render, t: t, esc: esc, ICON: ICON, fmtDay: fmtDay, relLabel: relLabel, itemHTML: itemHTML };
})(window);
