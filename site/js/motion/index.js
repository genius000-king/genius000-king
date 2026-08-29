// index.js — سجل المؤثرات. إضافة مؤثر = import + إدخال في المصفوفة.
//
// الميزانية: 14 مؤثراً (كانت 21) · لوحة رسم واحدة كحدّ أقصى (كانت 4).
// المحذوفة: الجاذبية · السائل · تشويه الزجاج · موجة الشبكة · أثر المؤشر ·
// التشويش · حقل النجوم — سبعة مؤثرات تستهلك أداءً ولا تضيف قيمة في البينتو.
import { register } from './registry.js';

import magnetic from './magnetic.js';
import tilt from './tilt.js';
import glass from './glass.js';
import cursor from './cursor.js';
import { reveal, reveal3d } from './reveal.js';
import parallax from './parallax.js';
import counter from './counter.js';
import zoomIn from './zoom-in.js';
import splitText from './split-text.js';
import marquee from './marquee.js';
import swap from './swap.js';
import shine from './shine.js';
import drawLine from './draw-line.js';
import logoMark from './logo-mark.js';
import liquidGlass from './liquid-glass.js';

[
  magnetic, tilt, glass, cursor, reveal, reveal3d, parallax, counter,
  zoomIn, splitText, marquee, swap, shine, drawLine, logoMark, liquidGlass,
].forEach(register);

export { register };
