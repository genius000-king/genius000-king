// index.js — سجل المؤثرات. إضافة مؤثر = import + سطر register.
// حذفه = حذف سطرين. صفر أثر على بقية الموقع.
import { register } from './registry.js';

import particles from './particles.js';       // 1
import magnetic from './magnetic.js';         // 2
import tilt from './tilt.js';                 // 4
import gravity from './gravity.js';           // 5
import liquid from './liquid.js';             // 6
import cursor from './cursor.js';             // 7 + 9
import cursorTrail from './cursor-trail.js';  // 8
import reveal from './reveal.js';             // 10
import parallax from './parallax.js';         // 11
import drawLine from './draw-line.js';        // 12
import counter from './counter.js';           // 13
import zoomIn from './zoom-in.js';            // 14
import splitText from './split-text.js';      // 15
import scramble from './scramble.js';         // 16
import sweep from './sweep.js';               // 17
import gridRipple from './grid-ripple.js';    // 18
import starfield from './starfield.js';       // 20
import glassWarp from './glass-warp.js';      // 22
import marquee from './marquee.js';           // 3 + 23
import revealSwap from './reveal-swap.js';    // 24
import shine from './shine.js';               // 25

// 19 الشفق و 21 الحبيبات بـ CSS خالص في base.css — بلا JS.

[particles, magnetic, tilt, gravity, liquid, cursor, cursorTrail, reveal,
 parallax, drawLine, counter, zoomIn, splitText, scramble, sweep, gridRipple,
 starfield, glassWarp, marquee, revealSwap, shine].forEach(register);

export { register };
