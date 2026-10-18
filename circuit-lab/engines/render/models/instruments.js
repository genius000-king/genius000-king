import * as THREE from 'three';
import {
  screen,
  box,
  mat,
  text,
  black,
  gold,
  cyl,
  silver,
  glow,
  sphere,
  pcbBoard,
  mountingHoles,
  tactile,
  chip,
  smdR,
  smdC,
} from '../geo.js';
import {
  instrumentBox,
  placeOnFront,
  knob,
  post,
  frontLabel,
  halo,
  standing,
  rbox,
  pad,
  pinUp,
} from './kit.js';

export const instrumentsModels = {
  psu(g, c) {
    instrumentBox(g, 100, 65, 70, '#3b3e44');
    g.userData.display = screen(g, 46, 18, -14, 0, 0, 256, 100);
    placeOnFront(g.userData.display.mesh, -14, 46, 35.05);
    knob(g, 22, 46, 35);
    knob(g, 38, 46, 35);
    post(g, -14, 22, 35, '#c8302a');
    post(g, 14, 22, 35, '#1d1d1f');
    frontLabel(g, 'BENCH POWER SUPPLY 0–30 V / 0–5 A', 0, 60, 35.05, 80, 3);
  },
  fgen(g, c) {
    instrumentBox(g, 100, 65, 70, '#2f3238');
    g.userData.display = screen(g, 50, 20, -16, 0, 0, 256, 100);
    placeOnFront(g.userData.display.mesh, -16, 46, 35.05);
    knob(g, 26, 46, 35);
    post(g, -12, 22, 35, '#c8302a');
    post(g, 12, 22, 35, '#1d1d1f');
    frontLabel(g, 'FUNCTION GENERATOR', 0, 60, 35.05, 60, 3);
  },
  scope(g, c) {
    instrumentBox(g, 120, 70, 70, '#2b2d33');
    g.userData.display = screen(g, 70, 40, -18, 0, 0, 320, 180);
    placeOnFront(g.userData.display.mesh, -18, 44, 35.05);
    for (const [x, col] of [
      [-25, '#f2d235'],
      [0, '#3ac0e8'],
    ]) {
      post(g, x, 22, 35, col, true);
    }
    post(g, 25, 22, 35, '#1d1d1f');
    knob(g, 34, 50, 35);
    knob(g, 46, 50, 35);
    knob(g, 34, 36, 35);
    knob(g, 46, 36, 35);
    frontLabel(g, 'DIGITAL OSCILLOSCOPE · 2 CH', 0, 66, 35.05, 80, 3);
  },
  logic(g, c) {
    box(g, 44, 10, 44, 0, 5, 0, mat('#8a8f96', 0.8, 0.35));
    text(g, 'LOGIC 8', 0, 10.05, -8, 20, 4, '#1d1f24', 36, 0, 800, 'sans-serif');
    box(g, 24, 2.5, 2.5, 0, 2.5, 24, black());
    for (let i = 0; i < 9; i++) box(g, 0.64, 0.64, 5, -10.16 + i * 2.54, 2.5, 25, gold());
  },
  multimeter(g, c) {
    box(g, 80, 26, 150, 0, 13, 0, mat('#e8a91c', 0.05, 0.6));
    box(g, 70, 1, 136, 0, 26.2, 0, mat('#26282c', 0.05, 0.5));
    g.userData.display = screen(g, 60, 26, 0, 26.8, -45, 256, 110);
    const dial = new THREE.Group();
    dial.position.set(0, 27, 10);
    cyl(dial, 18, 2.5, 0, 1.2, 0, mat('#1a1a1c', 0.05, 0.5), 40);
    box(dial, 4, 1.5, 22, 0, 2.8, -4, mat('#d8d8de'));
    g.add(dial);
    g.userData.dial = dial;
    for (const [i, l] of ['DCV', 'A', 'Ω', '·))'].entries()) {
      const a = -Math.PI / 2 + i * 0.55 - 0.8;
      text(g, l, Math.cos(a) * 25, 26.75, 10 + Math.sin(a) * 25, 7, 3, '#e6e6ea');
    }
    for (const [x, col, l] of [
      [-22, '#e8e8ec', '10A'],
      [0, '#1d1d1f', 'COM'],
      [22, '#c8302a', 'VΩ'],
    ]) {
      cyl(g, 4.5, 1, x, 26.4, 55, mat(col, 0.1, 0.5), 24);
      cyl(g, 2, 1.2, x, 26.6, 55, mat('#08080a'), 16);
      text(g, l, x, 26.75, 62, 8, 3, '#e6e6ea');
    }
  },
  acsource(g, c) {
    /* Isolated variable AC bench source, same bench scale as the PSU */ instrumentBox(
      g,
      100,
      65,
      70,
      '#3a3d43'
    );
    g.userData.display = screen(g, 44, 16, 0, 0, 0, 256, 96);
    placeOnFront(g.userData.display.mesh, -20, 47, 35.05);
    const bez = cyl(g, 4.2, 1.4, 8, 47, 36.5, silver(), 28);
    bez.rotation.x = Math.PI / 2;
    const lamp = glow('#ff2a1a', 0);
    lamp.color.set('#5a1410');
    const dome = sphere(g, 3.1, 8, 47, 37.2, lamp, 20, 12);
    dome.scale.z = 0.6;
    g.userData.acLamp = lamp;
    g.userData.acHalo = halo(g, '#ff3020', 8, 47, 39, 20);
    standing(text(g, '> 50 V~', 8, 40.6, 35.95, 10, 2.2, '#ff6a50', 36, 0, 700, 'sans-serif'));
    const ring = new THREE.Group();
    ring.position.set(32, 36, 35.9);
    g.add(ring);
    const skirt = cyl(ring, 13.5, 1, 0, 0, 0.5, mat('#c9ccd0', 0.8, 0.35), 40);
    skirt.rotation.x = Math.PI / 2;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 1.25 - (i / 10) * Math.PI * 1.5,
        t = box(
          ring,
          0.5,
          i % 2 ? 1.6 : 2.6,
          0.2,
          Math.cos(a) * 15.5,
          Math.sin(a) * 15.5,
          0.1,
          mat('#e6e6ea')
        );
      t.rotation.z = a - Math.PI / 2;
      if (i % 2 === 0)
        standing(
          text(
            ring,
            String(i * 25),
            Math.cos(a) * 19.6,
            Math.sin(a) * 19.6,
            0.12,
            5,
            2.2,
            '#d8dae0',
            36,
            0,
            700,
            'sans-serif'
          )
        );
    }
    const kn = new THREE.Group();
    kn.position.set(32, 36, 36);
    g.add(kn);
    const body = cyl(kn, 9.5, 9, 0, 0, 5.5, mat('#1b1b1e', 0.05, 0.5), 36);
    body.rotation.x = Math.PI / 2;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2,
        r = box(kn, 1.1, 1.1, 8, Math.cos(a) * 9.5, Math.sin(a) * 9.5, 5.5, mat('#151517', 0.05, 0.6));
      r.rotation.z = a;
    }
    const cap = cyl(kn, 8, 0.6, 0, 0, 10.2, mat('#a9adb2', 0.85, 0.3), 36);
    cap.rotation.x = Math.PI / 2;
    box(kn, 1.2, 6, 0.4, 0, 4.6, 10.6, mat('#f2f2f4'));
    g.userData.acKnob = kn;
    post(g, -14, 22, 35, '#c8302a');
    post(g, 14, 22, 35, '#1d1d1f');
    for (const [x, l] of [
      [-14, 'L'],
      [14, 'N'],
    ])
      standing(text(g, l, x, 30, 35.95, 4, 3.2, '#e8e8ec', 36, 0, 700, 'sans-serif'));
    box(g, 7, 11, 2, -40, 22, 36.6, mat('#151517', 0.05, 0.5));
    box(g, 5.6, 4.6, 1.4, -40, 24.4, 37.9, mat('#c8302a', 0.05, 0.45));
    standing(text(g, 'POWER', -40, 14.5, 35.95, 8, 2, '#c9cbd2', 36, 0, 700, 'sans-serif'));
    frontLabel(g, 'ISOLATED AC SOURCE  0–250 V~  50/60 Hz', 0, 60, 35.05, 80, 3);
    standing(
      text(
        g,
        'ISOLATED OUTPUT · NO EARTH REFERENCE',
        0,
        10,
        35.95,
        52,
        2,
        '#9a9ca4',
        36,
        0,
        600,
        'sans-serif'
      )
    );
  },
  pwmgen(g, c) {
    /* XY-LPWM: 50 × 31 PCB, segment LCD 27 × 15 in a grey bezel, four tactile keys */ const top = pcbBoard(
      g,
      50,
      31,
      '#1f6b3d',
      {
        y: 1,
        r: 1,
        holes: [
          [-22.5, -13, 1.4],
          [22.5, -13, 1.4],
        ],
      }
    );
    mountingHoles(g, top, [
      [-22.5, -13, 1.4],
      [22.5, -13, 1.4],
    ]);
    rbox(g, 31, 2.4, 19.5, 0, top + 1.2, -4, mat('#8e9398', 0.3, 0.45), 0.5);
    box(g, 28.4, 0.2, 16.4, 0, top + 2.42, -4, mat('#0d0f12', 0.1, 0.3));
    g.userData.display = screen(g, 27, 15, 0, top + 2.55, -4, 256, 142);
    for (const [i, l] of ['FREQ+', 'FREQ-', 'DUTY+', 'DUTY-'].entries()) {
      const x = -12 + i * 8;
      tactile(g, x, top, 10.6, 4.5, '#1d1d20');
      text(g, l, x, top + 0.02, 14, 6.6, 1.2, '#eef4ee', 36, 0, 700, 'sans-serif');
    }
    for (const [x, l] of [
      [-21.59, 'V+'],
      [-19.05, 'V-'],
      [19.05, 'PWM'],
      [21.59, 'GND'],
    ]) {
      pad(g, x, 8.89, top, 0.95, 0.5);
      pinUp(g, x, 8.89, top + 1.4);
      text(g, l, x, top + 0.02, 6.7, 2.4, 1, '#eef4ee', 36, 0, 700, 'sans-serif');
    }
    chip(g, 4.9, 3.9, 1.5, -20.5, top, -4, 'N76E003', {
      legs: 4,
      legSide: 'x',
      pitch: 1.27,
      rot: Math.PI / 2,
      textColor: '#8c8c96',
    });
    chip(g, 2.9, 1.6, 1, 20.5, top, -6, '662K', {legs: 3, legSide: 'z', pitch: 0.95});
    smdR(g, 20.5, top, -1.5);
    smdC(g, 20.5, top, 1.2);
    text(g, 'XY-LPWM', 20.4, top + 0.02, -11.5, 7, 1.4, '#eef4ee', 36, 0, 700, 'sans-serif');
  },
};
