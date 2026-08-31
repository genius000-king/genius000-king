// nav-map.js — خريطة التنقّل. مصدر واحد للشريط الجانبي والتبويب السفلي.
export const NAV = [
  { group: 'الرئيسية', items: [
    { path: '/',           label: 'لوحة القيادة', icon: 'home',   tab: true },
    { path: '/orders',     label: 'الطلبات',      icon: 'inbox',  tab: true, badge: 'orders' },
  ] },
  { group: 'المحتوى', items: [
    { path: '/content',    label: 'نصوص الموقع',  icon: 'pencil', tab: true },
    { path: '/works',      label: 'الأعمال',      icon: 'image' },
    { path: '/packages',   label: 'البكجات',      icon: 'package', tab: true },
    { path: '/catalog',    label: 'الكتالوج',     icon: 'list' },
  ] },
  { group: 'المظهر', items: [
    /* الاسم يدلّ على ما بالداخل: هذه الشاشة تضمّ الزجاج والشفافية
       والخلفية وإضاءة الشعار، لا الألوان والخطّ وحدهما — و«الألوان
       والخط» كان يخفيها عمّن يبحث عنها. */
    { path: '/appearance', label: 'المظهر والخلفية', icon: 'palette' },
    { path: '/layout',     label: 'تخطيط الصفحة',   icon: 'layout' },
    { path: '/preview',    label: 'معاينة الموقع', icon: 'eye', tab: true },
  ] },
  { group: 'الإعدادات', items: [
    { path: '/settings',   label: 'الإعدادات',    icon: 'settings' },
  ] },
];

export const ALL = NAV.flatMap((g) => g.items);
export const TABS = ALL.filter((i) => i.tab);
export const titleOf = (path) => ALL.find((i) => i.path === path)?.label || '';
