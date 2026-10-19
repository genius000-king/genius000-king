import * as THREE from 'three';
import {
  cyl,
  mat,
  box,
  silver,
  text,
  tin,
  line,
  black,
  sphere,
  glow,
  polyline,
  plate,
  gold,
  dip,
  pcbBoard,
  smdR,
  screen,
  ledSmd,
  maleHeader,
} from '../geo.js';
import {roundLead, halo, lead, rbox, pinUp, lathe} from './kit.js';

export const outputsModels = {
  led(g, c) {
    for (const x of [-1.27, 1.27])
      roundLead(g, [
        [x, 1, 0],
        [x, 3.2, 0],
        [x * 0.8, 3.8, 0],
      ]);
    cyl(g, 2.9, 0.8, 0, 4.1, 0, null);
    g.children.at(-1).material = mat('#e0dccb', 0.1, 0.3, {
      transmission: 0.4,
      transparent: true,
      opacity: 0.92,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(c.params.color).multiplyScalar(0.35),
      transparent: true,
      opacity: 0.9,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      emissive: c.params.color,
      emissiveIntensity: 0,
    });
    box(g, 1.6, 1.1, 0.45, -0.55, 5.6, 0, silver());
    box(g, 0.45, 2, 0.45, 0.75, 5.5, 0, silver());
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      lensMat
    );
    lens.position.y = 7.1;
    g.add(lens);
    cyl(g, 2.5, 2.6, 0, 5.8, 0, lensMat);
    g.userData.ledMaterial = lensMat;
    g.userData.halo = halo(g, c.params.color, 0, 6.8, 0, 22);
  },
  rgbled(g, c) {
    const xs = [-3.81, -1.27, 1.27, 3.81];
    for (const x of xs)
      roundLead(g, [
        [x, 1, 0],
        [x, 3, 0],
        [x * 0.35, 4, 0],
      ]);
    const m = new THREE.MeshPhysicalMaterial({
      color: '#f2f2f2',
      transparent: true,
      opacity: 0.9,
      roughness: 0.55,
      emissive: '#000000',
      emissiveIntensity: 1,
    });
    cyl(g, 2.5, 5, 0, 6.5, 0, m);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m);
    top.position.y = 9;
    g.add(top);
    cyl(g, 2.9, 0.8, 0, 4.2, 0, m);
    g.userData.rgbMaterial = m;
    g.userData.halo = halo(g, '#ffffff', 0, 8, 0, 18);
  },
  relay(g, c) {
    for (const [x, z] of [
      [-7.62, 0],
      [-5.08, -5.08],
      [-5.08, 5.08],
      [7.62, -5.08],
      [7.62, 5.08],
    ])
      lead(g, x, z, 1, 2);
    box(g, 19, 15, 15.5, 0, 9.5, 0, mat('#2a63c4', 0.05, 0.35));
    text(g, 'SONGLE', 0, 17.05, -4, 12, 2.4, '#eef2ff', 36, 0, 700, 'sans-serif');
    text(g, 'SRD-05VDC-SL-C', 0, 17.05, 0, 15, 1.6, '#eef2ff');
    text(g, '10A 250VAC', 0, 17.05, 3.3, 11, 1.4, '#eef2ff');
    const arm = new THREE.Group();
    arm.position.set(4, 17.2, 5.5);
    /* The SRD case is sealed: the armature moves but cannot be seen */ arm.visible = false;
    g.add(arm);
    g.userData.armature = arm;
  },
  relaymodule(g, c) {
    /* KY-019: 34 × 27 black PCB; 3-pin header (S + −) at one end, blue Songle SRD-05VDC-SL-C in the middle,
       3-way 5.0 mm screw terminal (NO COM NC) at the other; S8050, 1N4007 (M7) and a red LED on the board */
    const top = pcbBoard(g, 34, 27, '#18181b', {y: 1, r: 1.2});
    maleHeader(
      g,
      [
        [-14.5, -2.54],
        [-14.5, 0],
        [-14.5, 2.54],
      ],
      top
    );
    for (const [z, l] of [
      [-2.54, 'S'],
      [0, '+'],
      [2.54, '−'],
    ]) {
      pinUp(g, -14.5, z, top + 2.5 + 5.8);
      text(g, l, -11.6, top + 0.02, z, 2, 2, '#eeeeee', 36, 0, 700, 'sans-serif');
    }
    // relay body: 19.2 × 15.6 footprint, 15.5 tall, lid printing like the real part
    box(g, 19.2, 15.5, 15.6, -0.6, top + 7.75, 0, mat('#2a63c4', 0.05, 0.35));
    text(g, 'SONGLE', -0.6, top + 15.52, -4.6, 12, 2.4, '#eef2ff', 36, 0, 700, 'sans-serif');
    text(g, 'SRD-05VDC-SL-C', -0.6, top + 15.52, -1.2, 15, 1.6, '#eef2ff');
    text(g, '10A 250VAC  10A 30VDC', -0.6, top + 15.52, 1.6, 15, 1.3, '#eef2ff');
    text(g, '10A 125VAC  10A 28VDC', -0.6, top + 15.52, 3.8, 15, 1.3, '#eef2ff');
    // screw terminal: blue PA66 body, wire entries facing outwards, brass screws on top
    box(g, 7.6, 10, 15.2, 13.3, top + 5, 0, mat('#1f5fd0', 0.05, 0.45));
    for (const z of [-5, 0, 5]) {
      box(g, 0.2, 3.6, 3.6, 17.12, top + 3.2, z, mat('#0b0b0c', 0, 0.9));
      cyl(g, 1.55, 0.6, 13.3, top + 10.3, z, mat('#c9a14c', 0.9, 0.28), 20);
      box(g, 3, 0.25, 0.45, 13.3, top + 10.65, z, mat('#3b2f14', 0.3, 0.7));
    }
    text(g, 'NO', 8.6, top + 0.02, -5, 3.2, 1.6, '#eeeeee', 36, Math.PI / 2, 700, 'sans-serif');
    text(g, 'COM', 8.6, top + 0.02, 0, 4.2, 1.6, '#eeeeee', 36, Math.PI / 2, 700, 'sans-serif');
    text(g, 'NC', 8.6, top + 0.02, 5, 3.2, 1.6, '#eeeeee', 36, Math.PI / 2, 700, 'sans-serif');
    // driver: S8050 (SOT-23 "J3Y"), 1N4007 (SMA "M7"), resistors, power LED
    box(g, 2.9, 1, 1.3, -11.5, top + 0.5, -8.6, mat('#1b1b1d', 0.05, 0.6));
    text(g, 'J3Y', -11.5, top + 1.02, -8.6, 2.4, 1, '#c9c9cf');
    box(g, 4.3, 2.1, 2.6, -11.3, top + 1.05, 9.2, mat('#202022', 0.05, 0.55));
    box(g, 0.6, 0.03, 2.4, -9.6, top + 2.12, 9.2, mat('#c9c9cf'));
    text(g, 'M7', -11.6, top + 2.13, 9.2, 2.4, 1, '#c9c9cf');
    smdR(g, -7.3, top, -10.6);
    smdR(g, -7.3, top, 10.6);
    const led = ledSmd(g, -11.2, top, -11.4, '#ff2a1f', 1.6);
    text(g, 'KY-019', 4, top + 0.02, 11.6, 9, 1.8, '#eeeeee', 36, 0, 700, 'sans-serif');
    for (const [x, z] of [
      [-14.2, -10.6],
      [14.4, 10.6],
    ])
      cyl(g, 1.3, 0.1, x, top + 0.01, z, mat('#c7c9cc', 0.9, 0.3), 20);
    g.userData.relayLed = led;
  },
  solenoid(g, c) {
    /* JF-0530B: zinc-plated U frame 30 × 15.5 × 13, taped coil, Ø6 plunger with return spring, E-ring and
       rubber washer on the push side; red and black flying leads */
    const steel = mat('#b9bec4', 0.85, 0.32),
      base = 1;
    box(g, 30, 1.2, 15.5, 0, base + 0.6, 0, steel);
    for (const x of [-14.4, 14.4]) box(g, 1.2, 13, 15.5, x, base + 6.5, 0, steel);
    const coil = cyl(g, 6.2, 26.6, 0, base + 7, 0, mat('#e8c34a', 0.05, 0.55), 40);
    coil.rotation.z = Math.PI / 2;
    for (const x of [-12.9, 12.9]) {
      const flange = cyl(g, 6.5, 1.2, x, base + 7, 0, mat('#1b1b1d', 0.05, 0.6), 40);
      flange.rotation.z = Math.PI / 2;
    }
    text(g, 'JF-0530B', 0, base + 13.25, 0, 14, 2.4, '#3a3220', 36, 0, 700, 'sans-serif');
    text(g, 'DC12V', 0, base + 13.25, 3, 8, 1.8, '#3a3220');
    // the plunger moves along x: pulled in when energized, pushed back out by the spring
    const plunger = new THREE.Group();
    plunger.position.set(0, base + 7, 0);
    g.add(plunger);
    const rod = cyl(plunger, 3, 46, 6, 0, 0, mat('#d4d8dc', 0.9, 0.22), 28);
    rod.rotation.z = Math.PI / 2;
    const tip = cyl(plunger, 3, 2, -17.5, 0, 0, mat('#d4d8dc', 0.9, 0.22), 28, 2.4);
    tip.rotation.z = Math.PI / 2;
    const washer = cyl(plunger, 4.2, 1.2, 25.5, 0, 0, mat('#151517', 0.0, 0.85), 28);
    washer.rotation.z = Math.PI / 2;
    const ring = cyl(plunger, 3.6, 0.6, 27, 0, 0, mat('#2b2b2e', 0.7, 0.4), 28);
    ring.rotation.z = Math.PI / 2;
    const spring = new THREE.Group();
    spring.position.set(15.1, base + 7, 0);
    g.add(spring);
    const turns = 7,
      pts = [];
    for (let i = 0; i <= turns * 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(new THREE.Vector3((i / (turns * 24)) * 10, Math.cos(a) * 3.9, Math.sin(a) * 3.9));
    }
    spring.add(
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.35, 6), steel)
    );
    // leads leave the coil at the back and end at the two pin positions
    for (const [z, col] of [
      [-2.54, '#c8332b'],
      [2.54, '#1d1d20'],
    ]) {
      polyline(
        g,
        [
          [-12, base + 12.2, z * 0.5],
          [-15.5, base + 13.5, z],
          [-18.5, 4, z],
          [-19, 1, z],
        ],
        mat(col, 0.05, 0.55),
        0.55
      );
      box(g, 0.6, 2, 0.6, -19, 1, z, tin());
    }
    g.userData.plunger = {plunger, spring};
  },
  motor(g, c) {
    /* FA-130 can: Ø20.1 with two flats 15.1 apart, 25 long, Ø2 brass shaft */ const can = new THREE.Shape();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2,
        y = Math.max(-7.55, Math.min(7.55, Math.sin(a) * 10));
      i ? can.lineTo(Math.cos(a) * 10, y) : can.moveTo(Math.cos(a) * 10, y);
    }
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(can, {
        depth: 24,
        bevelEnabled: true,
        bevelSize: 0.3,
        bevelThickness: 0.3,
        bevelSegments: 2,
        curveSegments: 48,
      }),
      silver()
    );
    body.rotation.y = Math.PI / 2;
    body.position.set(-12, 10, 0);
    body.castShadow = true;
    g.add(body);
    for (const s of [-1, 1])
      for (const x of [-6, 6]) box(g, 1.6, 0.25, 4, x, 10 + s * 7.6, 0, mat('#9fa4a8', 0.8, 0.35));
    const end = cyl(g, 9.3, 3, -13.3, 10, 0, mat('#ececec', 0.02, 0.6), 32);
    end.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      box(g, 3, 4.5, 0.5, -15, 8, s * 2.5, tin());
    }
    box(g, 20, 2, 8, 0, 1, 0, mat('#d8d8da', 0.4, 0.5));
    const shaft = new THREE.Group();
    shaft.position.set(12, 10, 0);
    const s = cyl(shaft, 1, 9, 4.5, 0, 0, mat('#c9a35a', 0.85, 0.3), 12);
    s.rotation.z = Math.PI / 2;
    const flag = new THREE.Group();
    flag.position.x = 8.5;
    box(flag, 1, 16, 3, 0, 0, 0, mat('#d63a2f', 0.05, 0.5));
    shaft.add(flag);
    g.add(shaft);
    g.userData.motorShaft = flag;
    const ring = cyl(g, 3.5, 1, 12.3, 10, 0, mat('#b9bec0', 0.8, 0.35), 24);
    ring.rotation.z = Math.PI / 2;
  },
  servo(g, c) {
    const blue = mat('#2c5fd2', 0.05, 0.25, {transmission: 0.25, transparent: true, opacity: 0.92});
    box(g, 23, 22.5, 12.5, 0, 11.25, 0, blue);
    box(g, 32.5, 2.5, 12.5, 0, 15.7, 0, blue);
    cyl(g, 5.9, 4, -5.9, 24.5, 0, blue, 24);
    cyl(g, 2.4, 3, -5.9, 27, 0, mat('#e8e8e8', 0.05, 0.6), 16);
    text(g, 'TowerPro SG90', 0, 8, 6.3, 18, 3, '#f2f4ff').rotation.set(0, 0, 0);
    const horn = new THREE.Group();
    horn.position.set(-5.9, 28.8, 0);
    box(horn, 4.5, 1.4, 18, 0, 0, -6, mat('#f5f5f5', 0.02, 0.6));
    cyl(horn, 3.5, 1.6, 0, 0, 0, mat('#f5f5f5', 0.02, 0.6), 20);
    g.add(horn);
    g.userData.horn = horn;
    for (const [x, col] of [
      [-2.54, '#5a3a22'],
      [0, '#c8302a'],
      [2.54, '#e8862a'],
    ])
      line(
        g,
        [
          [11.5, 4, x * 0.6],
          [16, 3, x * 0.6 + 2],
          [12, 2, 18],
          [x, 2, 22.8],
        ],
        mat(col, 0.05, 0.5),
        0.45
      );
    box(g, 7.6, 2.5, 4, 0, 1.25, 25, black());
  },
  buzzer(g, c) {
    for (const x of [-3.81, 3.81]) lead(g, x, 0, 1, 1.5);
    cyl(g, 6, 8, 0, 5.5, 0, mat('#1a1a1c', 0.05, 0.4), 32);
    cyl(g, 1.4, 0.15, 0, 9.55, 0, mat('#050506'), 16);
    text(g, '+', 3.2, 9.6, 2, 1.4, 1.4, '#e0e0e6');
    if (!c.params.active) box(g, 1, 0.05, 1, -3, 9.6, -3, mat('#d9a23a'));
  },
  lamp(g, c) {
    for (const x of [-2.54, 2.54]) lead(g, x, 0, 1, 2);
    cyl(g, 7, 5, 0, 4.5, 0, mat('#eaeaec', 0.02, 0.6), 28);
    cyl(g, 4, 4, 0, 9, 0, mat('#bfc2c4', 0.8, 0.3), 20);
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 6, 20), mat('#bfc2c4', 0.8, 0.3));
      r.rotation.x = Math.PI / 2;
      r.position.y = 7.6 + i * 0.7;
      g.add(r);
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#fff6e0',
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      transmission: 0.6,
      emissive: '#ffb347',
      emissiveIntensity: 0,
    });
    sphere(g, 5.5, 0, 16, 0, glass, 24, 16);
    const fil = glow('#ffb347', 0);
    polyline(
      g,
      [
        [-1.6, 13, 0],
        [-1.6, 16, 0],
        [1.6, 16, 0],
        [1.6, 13, 0],
      ],
      fil,
      0.15
    );
    g.userData.lamp = {glass, fil};
    g.userData.halo = halo(g, '#ffb347', 0, 15, 0, 34);
  },
  neopixel(g, c) {
    plate(g, 51, 10, 1.6, 0.8, mat('#151517', 0.1, 0.4), 0.6);
    g.userData.pixels = [];
    for (let i = 0; i < c.params.count; i++) {
      const x = -19.6 + i * 5.6;
      box(g, 5, 1.6, 5, x, 3.2, 0, mat('#f2f2ee', 0.02, 0.5));
      const m = glow('#000000', 0);
      box(g, 3.6, 0.1, 3.6, x, 4.05, 0, m);
      g.userData.pixels.push(m);
    }
    for (const [x, z, l] of [
      [-24.13, -2.54, 'DIN'],
      [-24.13, 0, '5V'],
      [-24.13, 2.54, 'GND'],
      [24.13, -2.54, 'DOUT'],
      [24.13, 0, '5V'],
      [24.13, 2.54, 'GND'],
    ]) {
      box(g, 1.4, 0.08, 1.4, x, 2.47, z, gold());
    }
    text(g, 'WS2812B · 8', 0, 2.5, 4, 12, 1.3, '#d7d7de');
  },
  ledbar(g, c) {
    dip(g, 20, 0, 0, 0, '').children.forEach(() => 0);
    g.children.at(-1).children[0].material = mat('#2a2a2e', 0.05, 0.6);
    g.userData.bars = [];
    for (let i = 0; i < 10; i++) {
      const m = glow(c.params.color, 0);
      m.color.set('#4a1d18');
      box(g, 1.6, 0.1, 6, (i - 4.5) * 2.54, 4.25, 0, m);
      g.userData.bars.push(m);
    }
  },
  sevenseg(g, c) {
    box(g, 12.7, 7.5, 19, 0, 4.6, 0, mat('#ebe9df'));
    box(g, 12.1, 0.3, 18.4, 0, 8.5, 0, mat('#222a25'));
    g.userData.segments = {};
    for (const [key, x, z, w, d] of [
      ['A', 0, -6, 5.7, 1.1],
      ['B', 3.2, -3, 1.1, 4.8],
      ['C', 3.2, 3, 1.1, 4.8],
      ['D', 0, 6, 5.7, 1.1],
      ['E', -3.2, 3, 1.1, 4.8],
      ['F', -3.2, -3, 1.1, 4.8],
      ['G', 0, 0, 5.7, 1.1],
      ['DP', 5, 6, 1, 1],
    ]) {
      const material = new THREE.MeshStandardMaterial({
        color: '#5b2720',
        emissive: '#ff301d',
        emissiveIntensity: 0,
        roughness: 0.5,
      });
      box(g, w, 0.12, d, x, 8.72, z, material);
      g.userData.segments[key] = material;
    }
    for (const x of [-5.08, -2.54, 0, 2.54, 5.08]) for (const z of [-7.62, 7.62]) lead(g, x, z, 1, 1.9);
  },
  stepper(g, c) {
    /* 28BYJ-48: Ø28 × 19 steel can, ears with Ø4.2 holes 35 apart, Ø5 output shaft with 3 mm flats offset 8 mm, blue cover with 5-wire lead to a JST-XH housing */ const steel =
      mat('#b8bcbf', 0.85, 0.36);
    cyl(g, 14, 18.2, 0, 9.3, 0, steel, 48);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(13.85, 0.35, 8, 48), mat('#a2a6a9', 0.85, 0.4));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    g.add(rim);
    cyl(g, 14.25, 0.8, 0, 18.6, 0, mat('#c6c9cc', 0.85, 0.3), 48);
    plate(g, 42, 7, 0.7, 18.2, mat('#c2c6c9', 0.85, 0.32), 3.5, [
      [-17.5, 0, 2.1],
      [17.5, 0, 2.1],
    ]);
    for (const s of [-1, 1]) {
      const h = cyl(g, 2.1, 0.1, s * 17.5, 18.35, 0, mat('#0b0b0c', 0, 0.9), 20);
    }
    cyl(g, 4.6, 1.3, 0, 19.65, -8, mat('#c6c9cc', 0.85, 0.3), 32);
    cyl(g, 3.1, 0.4, 0, 20.45, -8, mat('#9ea2a5', 0.85, 0.4), 24);
    for (const [x, z] of [
      [-7.5, -3],
      [7.5, -3],
      [0, 6.5],
    ])
      cyl(g, 0.9, 0.35, x, 19.1, z, mat('#9ea2a5', 0.85, 0.4), 12);
    const shaft = new THREE.Group();
    shaft.position.set(0, 20.6, -8);
    g.add(shaft);
    const brass = mat('#c9a35a', 0.85, 0.3);
    cyl(shaft, 2.5, 3, 0, 1.5, 0, brass, 24);
    const s = new THREE.Shape(),
      a = Math.acos(1.5 / 2.5);
    s.moveTo(1.5, -2);
    s.lineTo(1.5, 2);
    s.absarc(0, 0, 2.5, a, Math.PI - a, false);
    s.lineTo(-1.5, -2);
    s.absarc(0, 0, 2.5, Math.PI + a, Math.PI * 2 - a, false);
    const f = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, {
        depth: 7,
        bevelEnabled: true,
        bevelThickness: 0.2,
        bevelSize: 0.15,
        bevelSegments: 1,
        curveSegments: 12,
      }),
      brass
    );
    f.rotation.x = -Math.PI / 2;
    f.position.y = 3;
    f.castShadow = true;
    shaft.add(f);
    g.userData.stepShaft = shaft;
    text(g, '28BYJ-48', 0, 19.06, 5.6, 13, 2.4, '#3a3d40', 36, 0, 800, 'sans-serif');
    text(g, '5V DC', 0, 19.06, 9.4, 8, 2, '#3a3d40', 36, 0, 700, 'sans-serif');
    rbox(g, 16.5, 16.8, 6, 0, 9, 15.2, mat('#2a62c8', 0.05, 0.42), 0.8);
    const gr = cyl(g, 2.6, 1.6, 0, 8, 18.6, mat('#2a62c8', 0.05, 0.42), 20);
    gr.rotation.x = Math.PI / 2;
    const cols = ['#2a5bd7', '#f29ab8', '#f2d235', '#f0862a', '#d42a2a'];
    cols.forEach((col, i) => {
      const x = -5.08 + i * 2.54;
      line(
        g,
        [
          [x * 0.25, 8, 18.8],
          [x * 0.45, 7.2, 23],
          [x * 0.9, 9.5, 29.5],
          [x, 11.2, 32.6],
          [x, 10.6, 34],
        ],
        mat(col, 0.05, 0.5),
        0.5
      );
    });
    rbox(g, 15.1, 8, 5.75, 0, 5.8, 34, mat('#efeee6', 0.02, 0.55), 0.3);
    box(g, 4.2, 2.6, 0.8, 0, 6.6, 37.1, mat('#efeee6', 0.02, 0.55));
    for (let i = 0; i < 5; i++) box(g, 1.2, 0.06, 1.2, -5.08 + i * 2.54, 9.82, 34, mat('#c9c8c0', 0.02, 0.6));
    for (let i = 0; i < 5; i++) pinUp(g, -5.08 + i * 2.54, 34, 2.2);
  },
  speaker(g, c) {
    /* 40 mm 8 Ω 0.5 W: Ø40 steel frame 5 deep, black paper cone, dust cap, magnet cup at the back */ const frameM =
      new THREE.MeshStandardMaterial({
        color: '#9aa0a5',
        metalness: 0.8,
        roughness: 0.38,
        side: THREE.DoubleSide,
      });
    cyl(g, 8.5, 3, 0, 1.5, 0, mat('#3a3c40', 0.75, 0.4), 32);
    cyl(g, 9, 0.6, 0, 3.2, 0, mat('#7f8488', 0.8, 0.4), 32);
    lathe(
      g,
      [
        [8.6, 3.3],
        [12, 4.4],
        [17.6, 6.7],
        [20, 7.3],
        [20, 8],
        [18.7, 8],
      ],
      frameM,
      48
    );
    const sur = new THREE.Mesh(
      new THREE.TorusGeometry(17.9, 0.85, 8, 64, Math.PI * 2),
      mat('#1b1b1d', 0.02, 0.75)
    );
    sur.rotation.x = Math.PI / 2;
    sur.position.y = 7.6;
    sur.scale.z = 0.7;
    g.add(sur);
    const cone = new THREE.Group();
    g.add(cone);
    lathe(
      cone,
      [
        [17.2, 7.7],
        [12, 6.3],
        [7.5, 5.1],
        [5.5, 4.75],
      ],
      new THREE.MeshStandardMaterial({
        color: '#18181a',
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      56
    );
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(8 + i * 2.4, 0.06, 4, 48), mat('#222225', 0, 0.9));
      r.rotation.x = Math.PI / 2;
      r.position.y = 5.2 + i * 0.62;
      cone.add(r);
    }
    const capG = new THREE.Mesh(
      new THREE.SphereGeometry(6.2, 28, 8, 0, Math.PI * 2, 0, 1.13),
      mat('#141416', 0.1, 0.35)
    );
    capG.scale.y = 0.5;
    capG.position.y = 3.42;
    cone.add(capG);
    g.userData.cone = cone;
    box(g, 9, 0.9, 3.4, 0, 6.3, 20.2, mat('#7a5a32', 0.05, 0.6));
    for (const [x, l] of [
      [-2.54, '+'],
      [2.54, '−'],
    ]) {
      box(g, 1.3, 0.3, 3, x, 6.9, 20.6, tin());
      text(g, l, x, 6.78, 18.9, 1.2, 1.2, '#f2e6c8', 36, 0, 700, 'sans-serif');
    }
    text(g, '8Ω 0.5W', 0, 8.02, 19.35, 5, 0.9, '#3b3f42', 36, 0, 700, 'sans-serif');
    for (const [x, col] of [
      [-2.54, '#c8302a'],
      [2.54, '#1d1d1f'],
    ]) {
      line(
        g,
        [
          [x, 7.05, 21.6],
          [x, 6.4, 22.9],
          [x, 3.2, 23.8],
          [x, 1.6, 24],
        ],
        mat(col, 0.05, 0.5),
        0.45
      );
      roundLead(g, [
        [x, 1.7, 24],
        [x, 0, 24],
      ]);
    }
  },
  trafficlight(g, c) {
    /* Traffic-light LED module: black 20 × 56 PCB, three 8 mm LEDs with 220 Ω 0805 resistors, 4-pin header */ const top =
      pcbBoard(g, 20, 56, '#151517', {y: 1, r: 1.2});
    g.children.slice(-2).forEach(m => (m.position.z = 2.5));
    g.userData.tlLeds = [];
    for (const [key, z, col, l] of [
      ['red', -16, '#ff2a1a', 'R'],
      ['yellow', -2, '#ffc21a', 'Y'],
      ['green', 12, '#2bff5a', 'G'],
    ]) {
      cyl(g, 4.5, 1, 0, top + 0.8, z, null, 32);
      g.children.at(-1).material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(col).multiplyScalar(0.3),
        transparent: true,
        opacity: 0.92,
        roughness: 0.18,
      });
      const lens = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(col).multiplyScalar(0.32),
        transparent: true,
        opacity: 0.9,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        emissive: col,
        emissiveIntensity: 0,
      });
      cyl(g, 4, 6.3, 0, top + 4.45, z, lens, 32);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), lens);
      dome.position.set(0, top + 7.6, z);
      g.add(dome);
      box(g, 1.6, 1.2, 0.5, -0.6, top + 3.4, z, silver());
      g.userData.tlLeds.push({key, material: lens, color: col, halo: halo(g, col, 0, top + 9, z, 30)});
      smdR(g, 6.6, top, z, Math.PI / 2);
      text(g, l, -7.5, top + 0.02, z, 2.2, 2.2, '#eef0f2', 36, 0, 800, 'sans-serif');
    }
    box(g, 10.16 + 0.2, 2.5, 2.5, 0, top + 1.25, 29, black());
    for (const [i, l] of ['GND', 'R', 'Y', 'G'].entries()) {
      const x = -3.81 + i * 2.54;
      pinUp(g, x, 29, top + 2.5 + 5.8);
      text(g, l, x, top + 0.02, 26, 2.4, 1.1, '#eef0f2', 36, 0, 700, 'sans-serif');
    }
    text(g, 'TRAFFIC LIGHT', 0, top + 0.02, -23, 15, 1.5, '#eef0f2', 36, 0, 700, 'sans-serif');
  },
  panelmeter(g, c) {
    /* 0.56" 3-digit panel voltmeter: 48 × 29 bezel, 21 deep case, red 7-segment window 39 × 15, three 26 AWG leads */ const k =
      mat('#121214', 0.05, 0.5);
    rbox(g, 45.5, 19, 26, 0, 9.5, 0, k, 0.6);
    rbox(g, 48, 2, 29, 0, 20, 0, mat('#18181b', 0.05, 0.42), 0.6);
    box(g, 39.6, 0.3, 15.6, 0, 20.9, 0, mat('#050506', 0.05, 0.3));
    g.userData.display = screen(g, 39, 15, 0, 21.02, 0, 384, 148);
    const filt = new THREE.Mesh(
      new THREE.PlaneGeometry(39, 15),
      new THREE.MeshPhysicalMaterial({
        color: '#ff2a1a',
        transparent: true,
        opacity: 0.08,
        roughness: 0.05,
        clearcoat: 1,
        depthWrite: false,
      })
    );
    filt.rotation.x = -Math.PI / 2;
    filt.position.y = 21.08;
    g.add(filt);
    text(g, 'V', 21.9, 21.02, 4.8, 2.2, 2.2, '#d14a3a', 36, 0, 800, 'sans-serif');
    text(g, 'DC 0-100V', 0, 21.02, 11, 12, 1.4, '#8a8a92', 36, 0, 600, 'sans-serif');
    for (const [x, col] of [
      [-2.54, '#c8302a'],
      [0, '#e8c42a'],
      [2.54, '#1d1d1f'],
    ]) {
      line(
        g,
        [
          [x, 1.6, 12.5],
          [x, 1.2, 15],
          [x, 1, 19],
          [x, 1, 20.4],
        ],
        mat(col, 0.05, 0.5),
        0.42
      );
      polyline(
        g,
        [
          [x, 1, 20.3],
          [x, 1, 22],
        ],
        tin(),
        0.2
      );
    }
    box(g, 9, 2.2, 1.4, 0, 1.5, 13.2, mat('#0d0d0f', 0.05, 0.6));
  },
};
