/* NIDHAM — dates, strings, storage, quick-add parsing. No dependencies. */
(function (root) {
  'use strict';

  /* ------------------------------ dates --------------------------------- */
  var D = {
    key: function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    },
    parse: function (k) { var p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    today: function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); },
    todayKey: function () { return D.key(D.today()); },
    add: function (d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; },
    addMonths: function (d, n) {
      var c = new Date(d.getFullYear(), d.getMonth() + n, 1);
      c.setDate(Math.min(d.getDate(), new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()));
      return c;
    },
    startOfWeek: function (d, ws) { var c = new Date(d); c.setDate(c.getDate() - ((c.getDay() - ws + 7) % 7)); return c; },
    diff: function (a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); },
    grid: function (d, ws) {
      var start = D.startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1), ws), out = [];
      for (var i = 0; i < 42; i++) out.push(D.add(start, i));
      var tail = out.slice(35);
      return tail.every(function (x) { return x.getMonth() !== d.getMonth(); }) ? out.slice(0, 35) : out;
    },
    clock: function (t) {
      if (!t) return '';
      var p = t.split(':'), h = +p[0];
      return (h % 12 || 12) + ':' + p[1] + (h >= 12 ? ' م' : ' ص');
    },
    clockEn: function (t) {
      if (!t) return '';
      var p = t.split(':'), h = +p[0];
      return (h % 12 || 12) + ':' + p[1] + (h >= 12 ? ' PM' : ' AM');
    }
  };

  /* ------------------------------ strings -------------------------------- */
  var STR = {
    ar: {
      dir: 'rtl', code: 'ar',
      today: 'اليوم', tomorrow: 'غدًا', yesterday: 'أمس',
      add: 'اكتب مهمة…', empty: 'يوم فارغ.',
      view: 'العرض', month: 'شهر', list: 'قائمة',
      search: 'بحث في المهام', lang: 'اللغة', theme: 'المظهر', light: 'فاتح', dark: 'داكن',
      weekStart: 'يبدأ الأسبوع', sun: 'أحد', mon: 'إثنين', sat: 'سبت',
      data: 'البيانات', exportJ: 'تصدير نسخة', importJ: 'استيراد نسخة', ics: 'ملف تقويم (ICS)', clearDone: 'مسح المنجز',
      title: 'اكتب المهمة…', date: 'التاريخ', time: 'الوقت', until: 'حتى', note: 'ملاحظة',
      important: 'مهم', repeat: 'تكرار',
      none: 'بدون', daily: 'يومي', workdays: 'أيام العمل', weekly: 'أسبوعي', monthly: 'شهري',
      save: 'حفظ', del: 'حذف', close: 'تم',
      undo: 'تراجع', deleted: 'حُذفت', moved: 'نُقلت', copied: 'نُسخ',
      inBox: 'المحتوى في الصندوق — انسخه', bad: 'ملف غير صالح', done: 'تم',
      searchGo: 'ابحث…', nores: 'لا نتائج',
      dow: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
      dow1: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
               'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    },
    en: {
      dir: 'ltr', code: 'en',
      today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday',
      add: 'Write a task…', empty: 'Empty day.',
      view: 'View', month: 'Month', list: 'List',
      search: 'Search tasks', lang: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark',
      weekStart: 'Week starts', sun: 'Sun', mon: 'Mon', sat: 'Sat',
      data: 'Data', exportJ: 'Export a backup', importJ: 'Import a backup', ics: 'Calendar file (ICS)', clearDone: 'Clear done',
      title: 'Write the task…', date: 'Date', time: 'Time', until: 'Until', note: 'Note',
      important: 'Important', repeat: 'Repeat',
      none: 'None', daily: 'Daily', workdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly',
      save: 'Save', del: 'Delete', close: 'Done',
      undo: 'Undo', deleted: 'Deleted', moved: 'Moved', copied: 'Copied',
      inBox: 'Content is in the box — copy it', bad: 'Invalid file', done: 'Done',
      searchGo: 'Search…', nores: 'No results',
      dow: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      dow1: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December']
    }
  };

  /* ------------------------------- store --------------------------------- */
  var KEY = 'nidham.v1';
  var BASE = { version: 2, settings: { lang: 'ar', theme: 'light', weekStart: 0, view: 'month' }, items: [], seq: 1 };

  var Store = {
    data: JSON.parse(JSON.stringify(BASE)),
    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var p = JSON.parse(raw);
          this.data.settings = Object.assign({}, BASE.settings, p.settings || {});
          this.data.seq = p.seq || 1;
          this.data.items = (Array.isArray(p.items) ? p.items : []).map(function (i) {
            /* v1 carried kind/priority/list; fold them into the simpler shape */
            return {
              id: i.id, title: i.title || '', note: i.note || i.notes || '',
              date: i.date || D.todayKey(), time: i.time || null, end: i.end || null,
              done: !!i.done, doneAt: i.doneAt || null,
              big: i.big !== undefined ? !!i.big : i.priority === 'high',
              repeat: i.repeat === 'weekdays' ? 'workdays' : (i.repeat || 'none'),
              created: i.created || Date.now()
            };
          });
        }
      } catch (e) { /* unreadable storage: start clean instead of crashing */ }
      if (this.data.settings.view === 'week') this.data.settings.view = 'month';
      return this.data;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    id: function () { return 'i' + (this.data.seq++) + Date.now().toString(36).slice(-3); },
    add: function (patch) {
      var it = Object.assign({
        id: this.id(), title: '', note: '', date: D.todayKey(), time: null, end: null,
        done: false, doneAt: null, big: false, repeat: 'none', created: Date.now()
      }, patch);
      this.data.items.push(it); this.save(); return it;
    },
    get: function (id) { for (var i = 0; i < this.data.items.length; i++) if (this.data.items[i].id === id) return this.data.items[i]; return null; },
    update: function (id, patch) { var it = this.get(id); if (it) { Object.assign(it, patch); this.save(); } return it; },
    remove: function (id) {
      for (var i = 0; i < this.data.items.length; i++) {
        if (this.data.items[i].id === id) { var g = this.data.items.splice(i, 1)[0]; this.save(); return { item: g, at: i }; }
      }
      return null;
    },
    put: function (item, at) { this.data.items.splice(Math.min(at, this.data.items.length), 0, item); this.save(); },
    toggle: function (id) {
      var it = this.get(id); if (!it) return null;
      it.done = !it.done; it.doneAt = it.done ? Date.now() : null;
      var next = null;
      if (it.done && it.repeat !== 'none') {
        var k = Store.nextKey(it.date, it.repeat), self = this;
        var exists = this.data.items.some(function (x) { return !x.done && x.title === it.title && x.date === k; });
        if (!exists) {
          next = Object.assign({}, it, { id: self.id(), date: k, done: false, doneAt: null, created: Date.now() });
          this.data.items.push(next);
        }
      }
      this.save(); return { item: it, next: next };
    },
    nextKey: function (key, rule) {
      var d = D.parse(key);
      if (rule === 'daily') return D.key(D.add(d, 1));
      if (rule === 'weekly') return D.key(D.add(d, 7));
      if (rule === 'monthly') return D.key(D.addMonths(d, 1));
      if (rule === 'workdays') { do { d = D.add(d, 1); } while (d.getDay() === 5 || d.getDay() === 6); return D.key(d); }
      return key;
    },
    onDay: function (key) { return this.data.items.filter(function (i) { return i.date === key; }).sort(Store.order); },
    order: function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      var at = a.time || '99:99', bt = b.time || '99:98';
      if (at !== bt) return at < bt ? -1 : 1;
      if (a.big !== b.big) return a.big ? -1 : 1;
      return a.created - b.created;
    }
  };

  /* -------------------- quick add: plain sentence in ---------------------- */
  /* "اجتماع 3م غدا !مهم"  ·  "gym 7am daily"  -> {title, date, time, big, repeat} */
  function parseQuick(text, fallbackDate) {
    var out = { title: text.trim(), date: fallbackDate || D.todayKey(), time: null, big: false, repeat: 'none' };
    var s = ' ' + out.title + ' ';
    var B = '(?:^|\\s)', E = '(?=\\s|$)';
    function rx(body) { return new RegExp(B + body + E, 'i'); }
    function eat(re, cb) { var m = s.match(re); if (m) { s = s.replace(m[0], ' '); cb(m); } return !!m; }

    eat(rx('[!*](high|مهم|عاجل)'), function () { out.big = true; });
    eat(new RegExp(B + '#[\\p{L}\\w-]+' + E, 'iu'), function () {});   /* legacy #tag: strip, do not show */
    eat(rx('(every ?day|daily|يومي(?:ا|ًا)?|يوميا)'), function () { out.repeat = 'daily'; });
    eat(rx('(every ?week|weekly|أسبوعي(?:ا|ًا)?|اسبوعيا?)'), function () { out.repeat = 'weekly'; });
    eat(rx('(monthly|شهري(?:ا|ًا)?)'), function () { out.repeat = 'monthly'; });

    var today = D.today();
    if (eat(rx('(after ?tomorrow|بعد ?غد(?:ا|ًا)?)'), function () {})) out.date = D.key(D.add(today, 2));
    else if (eat(rx('(tomorrow|tmrw|غدا|غدًا|غد|بكرة|بكره|باكر)'), function () {})) out.date = D.key(D.add(today, 1));
    else if (eat(rx('(today|اليوم)'), function () {})) out.date = D.key(today);
    else {
      var names = { 'sunday': 0, 'sun': 0, 'الاحد': 0, 'الأحد': 0, 'monday': 1, 'mon': 1, 'الاثنين': 1, 'الإثنين': 1,
        'tuesday': 2, 'tue': 2, 'الثلاثاء': 2, 'wednesday': 3, 'wed': 3, 'الاربعاء': 3, 'الأربعاء': 3,
        'thursday': 4, 'thu': 4, 'الخميس': 4, 'friday': 5, 'fri': 5, 'الجمعة': 5, 'saturday': 6, 'sat': 6, 'السبت': 6 };
      var hit = null;
      Object.keys(names).forEach(function (w) { if (hit === null) eat(rx('(' + w + ')'), function () { hit = names[w]; }); });
      if (hit !== null) out.date = D.key(D.add(today, (hit - today.getDay() + 7) % 7 || 7));
      eat(rx('(\\d{4})-(\\d{2})-(\\d{2})'), function (m) { out.date = m[1] + '-' + m[2] + '-' + m[3]; });
    }

    eat(rx('(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm|ص|م)'), function (m) {
      var h = +m[1], mi = m[2] || '00', ap = m[3].toLowerCase();
      if ((ap === 'pm' || ap === 'م') && h < 12) h += 12;
      if ((ap === 'am' || ap === 'ص') && h === 12) h = 0;
      out.time = String(h).padStart(2, '0') + ':' + mi;
    }) || eat(rx('(ص|م)\\s?(\\d{1,2})(?::(\\d{2}))?'), function (m) {
      var h = +m[2], mi = m[3] || '00';
      if (m[1] === 'م' && h < 12) h += 12;
      if (m[1] === 'ص' && h === 12) h = 0;
      out.time = String(h).padStart(2, '0') + ':' + mi;
    }) || eat(rx('([01]?\\d|2[0-3]):([0-5]\\d)'), function (m) {
      out.time = String(+m[1]).padStart(2, '0') + ':' + m[2];
    });

    out.title = s.replace(/\s+/g, ' ').trim() || text.trim();
    return out;
  }

  root.NID = { D: D, STR: STR, Store: Store, parseQuick: parseQuick };
})(window);
