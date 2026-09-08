/* NIDHAM — core: dates, i18n, persistent store. No dependencies. */
(function (root) {
  'use strict';

  /* ---------------- dates (local-time safe, never UTC-shifted) --------------- */
  var D = {
    key: function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    },
    parse: function (k) {
      var p = String(k).split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    },
    today: function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); },
    todayKey: function () { return D.key(D.today()); },
    add: function (d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; },
    addMonths: function (d, n) {
      var c = new Date(d.getFullYear(), d.getMonth() + n, 1);
      c.setDate(Math.min(d.getDate(), D.daysIn(c.getFullYear(), c.getMonth())));
      return c;
    },
    daysIn: function (y, m) { return new Date(y, m + 1, 0).getDate(); },
    startOfWeek: function (d, ws) {
      var c = new Date(d); c.setDate(c.getDate() - ((c.getDay() - ws + 7) % 7)); return c;
    },
    diffDays: function (a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); },
    /* grid of 42 days covering the month of `d` */
    monthGrid: function (d, ws) {
      var first = new Date(d.getFullYear(), d.getMonth(), 1);
      var start = D.startOfWeek(first, ws), out = [];
      for (var i = 0; i < 42; i++) out.push(D.add(start, i));
      return out;
    },
    hhmm: function (t) {
      if (!t) return '';
      var p = t.split(':'), h = +p[0], m = p[1];
      var ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
      return h12 + ':' + m + ' ' + ampm;
    }
  };

  /* ------------------------------- i18n ------------------------------------ */
  var STR = {
    ar: {
      dir: 'rtl', locale: 'ar',
      tagline: 'تقويم ومهام',
      month: 'شهر', week: 'أسبوع', agenda: 'قائمة',
      today: 'اليوم', prev: 'السابق', next: 'التالي',
      addPlaceholder: 'أضف مهمة… "اجتماع 3م غدًا !مهم"',
      hint: 'اختصارات: <code>N</code> مهمة · <code>/</code> بحث · <code>T</code> اليوم · <code>←→</code> تنقل',
      all: 'الكل', open: 'مفتوحة', done: 'منجزة', overdue: 'متأخرة',
      inbox: 'بلا تاريخ', upcoming: 'قادمة',
      tasksFor: 'مهام يوم', noItems: 'لا شيء هنا بعد', noItemsSub: 'اكتب في الشريط بالأعلى لتضيف أول مهمة.',
      task: 'مهمة', event: 'موعد', edit: 'تعديل', del: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      title: 'العنوان', date: 'التاريخ', time: 'الوقت', endTime: 'حتى', notes: 'ملاحظات',
      priority: 'الأولوية', low: 'منخفضة', normal: 'عادية', high: 'مهم',
      repeat: 'التكرار', none: 'بدون', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', weekdays: 'أيام العمل',
      kind: 'النوع', newItem: 'عنصر جديد', editItem: 'تعديل العنصر',
      deleted: 'تم الحذف', undo: 'تراجع', completed: 'أُنجزت', restored: 'استُرجعت',
      moved: 'نُقلت إلى', search: 'ابحث في كل شيء…', results: 'نتيجة',
      progress: 'إنجاز اليوم', doneOf: 'من', tasksWord: 'مهام',
      streak: 'متتالية', weekDone: 'هذا الأسبوع',
      settings: 'الإعدادات', weekStart: 'بداية الأسبوع', sunday: 'الأحد', monday: 'الإثنين', saturday: 'السبت',
      exportJson: 'تصدير نسخة', importJson: 'استيراد', exportIcs: 'تصدير تقويم (ICS)',
      copy: 'نسخ', copied: 'تم النسخ', copyFallback: 'المحتوى في الصندوق — اضغط "نسخ"', close: 'إغلاق', clearDone: 'مسح المنجز',
      dataTitle: 'بياناتك', dataSub: 'كل شيء محفوظ محليًا في متصفحك فقط.',
      importPrompt: 'الصق محتوى النسخة هنا ثم اضغط حفظ',
      imported: 'تم الاستيراد', badJson: 'ملف غير صالح',
      lists: 'التصنيف', general: 'عام', work: 'عمل', study: 'دراسة', personal: 'شخصي',
      more: 'أخرى', quickAdd: 'إضافة سريعة', dayFull: 'اليوم كامل',
      nothingToday: 'لا مهام اليوم — خطط لشيء.',
      dow: ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'],
      months: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    },
    en: {
      dir: 'ltr', locale: 'en',
      tagline: 'calendar + tasks',
      month: 'Month', week: 'Week', agenda: 'Agenda',
      today: 'Today', prev: 'Prev', next: 'Next',
      addPlaceholder: 'Add a task…  "standup 3pm tomorrow !high"',
      hint: 'Keys: <code>N</code> new · <code>/</code> search · <code>T</code> today · <code>←→</code> move',
      all: 'All', open: 'Open', done: 'Done', overdue: 'Overdue',
      inbox: 'No date', upcoming: 'Upcoming',
      tasksFor: 'Plan for', noItems: 'Nothing here yet', noItemsSub: 'Type in the bar above to add your first task.',
      task: 'Task', event: 'Event', edit: 'Edit', del: 'Delete', save: 'Save', cancel: 'Cancel',
      title: 'Title', date: 'Date', time: 'Time', endTime: 'Until', notes: 'Notes',
      priority: 'Priority', low: 'Low', normal: 'Normal', high: 'High',
      repeat: 'Repeat', none: 'None', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', weekdays: 'Weekdays',
      kind: 'Kind', newItem: 'New item', editItem: 'Edit item',
      deleted: 'Deleted', undo: 'Undo', completed: 'Completed', restored: 'Restored',
      moved: 'Moved to', search: 'Search everything…', results: 'results',
      progress: 'Today', doneOf: 'of', tasksWord: 'tasks',
      streak: 'Streak', weekDone: 'This week',
      settings: 'Settings', weekStart: 'Week starts', sunday: 'Sunday', monday: 'Monday', saturday: 'Saturday',
      exportJson: 'Export backup', importJson: 'Import', exportIcs: 'Export calendar (ICS)',
      copy: 'Copy', copied: 'Copied', copyFallback: 'Content is in the box — press "Copy"', close: 'Close', clearDone: 'Clear done',
      dataTitle: 'Your data', dataSub: 'Everything is stored locally in this browser only.',
      importPrompt: 'Paste a backup here, then press save',
      imported: 'Imported', badJson: 'Invalid file',
      lists: 'List', general: 'General', work: 'Work', study: 'Study', personal: 'Personal',
      more: 'more', quickAdd: 'Quick add', dayFull: 'All day',
      nothingToday: 'Nothing today — plan something.',
      dow: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      months: ['January','February','March','April','May','June','July','August','September','October','November','December']
    }
  };

  /* ------------------------------- store ----------------------------------- */
  var KEY = 'nidham.v1';
  var DEFAULTS = {
    version: 1,
    settings: { lang: 'ar', theme: 'day', weekStart: 0, view: 'month' },
    items: [],
    seq: 1
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var Store = {
    data: clone(DEFAULTS),
    subs: [],
    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          this.data = Object.assign(clone(DEFAULTS), parsed);
          this.data.settings = Object.assign(clone(DEFAULTS.settings), parsed.settings || {});
          this.data.items = Array.isArray(parsed.items) ? parsed.items : [];
        }
      } catch (e) { /* corrupted storage: start clean rather than crash */ }
      return this.data;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
      catch (e) { /* private mode / quota: app still works in-memory */ }
      this.subs.forEach(function (f) { f(); });
    },
    on: function (f) { this.subs.push(f); },
    id: function () { return 'i' + (this.data.seq++) + Date.now().toString(36).slice(-4); },

    add: function (patch) {
      var it = Object.assign({
        id: this.id(), kind: 'task', title: '', notes: '',
        date: null, time: null, end: null,
        done: false, doneAt: null, priority: 'normal', list: 'general',
        repeat: 'none', created: Date.now()
      }, patch);
      this.data.items.push(it);
      this.save();
      return it;
    },
    update: function (id, patch) {
      var it = this.get(id);
      if (it) { Object.assign(it, patch); this.save(); }
      return it;
    },
    get: function (id) {
      return this.data.items.filter(function (i) { return i.id === id; })[0] || null;
    },
    remove: function (id) {
      var i = this.data.items.findIndex(function (x) { return x.id === id; });
      if (i < 0) return null;
      var gone = this.data.items.splice(i, 1)[0];
      this.save();
      return { item: gone, index: i };
    },
    insertAt: function (item, index) {
      this.data.items.splice(Math.min(index, this.data.items.length), 0, item);
      this.save();
    },
    /* completing a repeating task spawns its next occurrence */
    toggle: function (id) {
      var it = this.get(id);
      if (!it || it.kind === 'event') return null;
      it.done = !it.done;
      it.doneAt = it.done ? Date.now() : null;
      var spawned = null;
      if (it.done && it.repeat !== 'none' && it.date) {
        var nextKey = Store.nextDate(it.date, it.repeat);
        var exists = this.data.items.some(function (x) {
          return !x.done && x.title === it.title && x.date === nextKey && x.repeat === it.repeat;
        });
        if (!exists) {
          spawned = Object.assign({}, it, {
            id: this.id(), date: nextKey, done: false, doneAt: null, created: Date.now()
          });
          this.data.items.push(spawned);
        }
      }
      this.save();
      return { item: it, spawned: spawned };
    },
    nextDate: function (key, rule) {
      var d = D.parse(key);
      if (rule === 'daily') return D.key(D.add(d, 1));
      if (rule === 'weekly') return D.key(D.add(d, 7));
      if (rule === 'monthly') return D.key(D.addMonths(d, 1));
      if (rule === 'weekdays') {
        do { d = D.add(d, 1); } while (d.getDay() === 5 || d.getDay() === 6);
        return D.key(d);
      }
      return key;
    },
    byDate: function (key) {
      return this.data.items.filter(function (i) { return i.date === key; }).sort(Store.order);
    },
    order: function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      var at = a.time || '99:99', bt = b.time || '99:98';
      if (at !== bt) return at < bt ? -1 : 1;
      var rank = { high: 0, normal: 1, low: 2 };
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      return a.created - b.created;
    },
    stats: function () {
      var t = D.todayKey(), items = this.data.items;
      var todays = items.filter(function (i) { return i.kind === 'task' && i.date === t; });
      var doneToday = todays.filter(function (i) { return i.done; }).length;
      var weekStart = D.key(D.add(D.today(), -6));
      var weekDone = items.filter(function (i) {
        return i.done && i.date && i.date >= weekStart && i.date <= t;
      }).length;
      /* streak: consecutive days back from today with >=1 completed task */
      var streak = 0, cur = D.today();
      for (var n = 0; n < 400; n++) {
        var k = D.key(cur);
        var any = items.some(function (i) { return i.done && i.date === k; });
        if (any) { streak++; cur = D.add(cur, -1); }
        else if (n === 0) { cur = D.add(cur, -1); }   /* today may still be in progress */
        else break;
      }
      return {
        todayTotal: todays.length, todayDone: doneToday,
        pct: todays.length ? Math.round(doneToday / todays.length * 100) : 0,
        weekDone: weekDone, streak: streak,
        overdue: items.filter(function (i) {
          return i.kind === 'task' && !i.done && i.date && i.date < t;
        }).length
      };
    }
  };

  /* ------------------ natural-language quick add ---------------------------- */
  /* "meeting 3pm tomorrow !high #work" / "اجتماع 3م غدا !مهم" -> structured item */
  function parseQuick(text, baseDate, lang) {
    var out = { title: text.trim(), date: baseDate || null, time: null, priority: 'normal',
                list: 'general', kind: 'task', repeat: 'none' };
    var s = ' ' + out.title + ' ';

    /* NOTE: \b is ASCII-only in JS, so Arabic tokens need explicit space lookarounds. */
    var B = '(?:^|\\s)', E = '(?=\\s|$)';
    function rx(body, flags) { return new RegExp(B + body + E, flags === undefined ? 'i' : flags); }
    function eat(re, cb) {
      var m = s.match(re);
      if (m) { s = s.replace(m[0], ' '); cb(m); }
      return !!m;
    }

    eat(rx('!(high|مهم|عاجل)'), function () { out.priority = 'high'; });
    eat(rx('!(low|لاحقا|لاحقًا|بسيط)'), function () { out.priority = 'low'; });
    eat(new RegExp(B + '#([\\p{L}\\w-]+)' + E, 'iu'), function (m) { out.list = m[1].toLowerCase(); });
    eat(rx('(every ?day|daily|يومي(?:ا|ًا)?|يوميا)'), function () { out.repeat = 'daily'; });
    eat(rx('(every ?week|weekly|أسبوعي(?:ا|ًا)?|اسبوعيا?)'), function () { out.repeat = 'weekly'; });
    eat(rx('(monthly|شهري(?:ا|ًا)?)'), function () { out.repeat = 'monthly'; });

    var today = D.today();
    /* order matters: "after tomorrow" must be tried before "tomorrow" */
    if (eat(rx('(after ?tomorrow|بعد ?غد(?:ا|ًا)?)'), function () {})) out.date = D.key(D.add(today, 2));
    else if (eat(rx('(tomorrow|tmrw|غدا|غدًا|غد|بكرة|بكره|باكر)'), function () {})) out.date = D.key(D.add(today, 1));
    else if (eat(rx('(today|اليوم)'), function () {})) out.date = D.key(today);
    else {
      var names = {
        'sunday': 0, 'sun': 0, 'الاحد': 0, 'الأحد': 0,
        'monday': 1, 'mon': 1, 'الاثنين': 1, 'الإثنين': 1,
        'tuesday': 2, 'tue': 2, 'الثلاثاء': 2,
        'wednesday': 3, 'wed': 3, 'الاربعاء': 3, 'الأربعاء': 3,
        'thursday': 4, 'thu': 4, 'الخميس': 4,
        'friday': 5, 'fri': 5, 'الجمعة': 5,
        'saturday': 6, 'sat': 6, 'السبت': 6
      };
      var hit = null;
      Object.keys(names).forEach(function (w) {
        if (hit) return;
        if (eat(rx('(' + w + ')'), function () { hit = names[w]; })) return;
      });
      if (hit !== null) {
        var delta = (hit - today.getDay() + 7) % 7 || 7;   /* always the next one */
        out.date = D.key(D.add(today, delta));
      }
      eat(rx('(\\d{4})-(\\d{2})-(\\d{2})'), function (mm) { out.date = mm[1] + '-' + mm[2] + '-' + mm[3]; });
    }

    /* 3pm · 3:30pm · 15:30 · 3م · ٣م */
    eat(rx('(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm|ص|م)'), function (m) {
      var h = +m[1], min = m[2] || '00', ap = m[3].toLowerCase();
      if ((ap === 'pm' || ap === 'م') && h < 12) h += 12;
      if ((ap === 'am' || ap === 'ص') && h === 12) h = 0;
      out.time = String(h).padStart(2, '0') + ':' + min;
    }) || eat(rx('(ص|م)\\s?(\\d{1,2})(?::(\\d{2}))?'), function (m) {
      var h = +m[2], min = m[3] || '00';
      if (m[1] === 'م' && h < 12) h += 12;
      if (m[1] === 'ص' && h === 12) h = 0;
      out.time = String(h).padStart(2, '0') + ':' + min;
    }) || eat(rx('([01]?\\d|2[0-3]):([0-5]\\d)'), function (m) {
      out.time = String(+m[1]).padStart(2, '0') + ':' + m[2];
    });

    out.title = s.replace(/\s+/g, ' ').trim() || text.trim();
    if (/(?:meeting|call|standup|اجتماع|موعد|مكالمة|محاضرة|لقاء|مقابلة)/i.test(out.title)) out.kind = 'event';
    return out;
  }

  root.NID = { D: D, STR: STR, Store: Store, parseQuick: parseQuick };
})(window);
