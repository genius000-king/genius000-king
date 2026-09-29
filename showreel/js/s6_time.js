'use strict';
// ══════════════════════════════════════════════════════════════
//  ٦ · زمن — the orb shatters into ~2000 glass shards and time itself is
//  the animated parameter: burst → slow-motion → near-freeze (the camera keeps
//  moving: bullet-time) → RE-WIND, snapping the shards back into the orb.
//  τ(u) comes from TL.tau — the very same curve the soundtrack is warped by.
//  Motion blur is real: several sub-frame samples of τ are accumulated.
// ══════════════════════════════════════════════════════════════
(() => {
  // ── tiny mat4 toolkit (column-major) ─────────────────────
  const m4 = {
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    look(e, c, up = [0, 1, 0]) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; const zl = Math.hypot(...z); z = z.map(v => v / zl);
      let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]; const xl = Math.hypot(...x); x = x.map(v => v / xl);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
    mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; },
  };

  // ── shard mesh: a flat triangular prism, 8 triangles ─────
  const TRI = [[0, 1], [-.72, -.58], [.86, -.42]];
  const HT = .5;
  const verts = [], bary = [], mask = [];
  const bc = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function tri(p0, p1, p2, m) { [p0, p1, p2].forEach((p, i) => { verts.push(...p); bary.push(...bc[i]); mask.push(...m); }); }
  const top = TRI.map(p => [p[0], p[1], HT]), bot = TRI.map(p => [p[0], p[1], -HT]);
  tri(top[0], top[1], top[2], [0, 0, 0]);
  tri(bot[0], bot[2], bot[1], [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    tri(bot[i], bot[j], top[j], [0, 1, 0]);
    tri(bot[i], top[j], top[i], [0, 0, 1]);
  }

  // ── instances ────────────────────────────────────────────
  const N_BIG = 360, N_DUST = 800, N = N_BIG + N_DUST;
  const R = rng(20260929);
  const inst = new Float32Array(N * 24);   // pos0(3) vel(3) r0a(3) r0b(3) r0c(3) axis(3) scale(3) rot(2) seed(1)
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  function rodrigues(ax, ang) {
    const [x, y, z] = ax, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
  }
  const mm = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  for (let i = 0; i < N; i++) {
    const big = i < N_BIG;
    const dir = norm([R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]);
    const rad = big ? 1.02 + .05 * R() : .3 + .8 * R();
    const p0 = dir.map(v => v * rad);
    // align local +z with the radial direction (so the orb starts as a faceted ball), random spin
    const zc = cross([0, 0, 1], dir); const zl = Math.hypot(...zc);
    let Ra = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (zl > 1e-4) Ra = rodrigues(zc.map(v => v / zl), Math.acos(dir[2]));
    const R0 = mm(rodrigues(dir, R() * TAU), Ra);
    const spd = big ? .5 + 2.7 * Math.pow(R(), 1.4) : .9 + 3.4 * Math.pow(R(), 1.2);
    const tang = [R() - .5, R() - .5, R() - .5].map(v => v * .5);
    const vel = dir.map((v, k) => v * spd + tang[k]);
    const sz = big ? .16 + .30 * Math.pow(R(), 1.6) : .014 + .038 * R();
    const asp = .6 + .9 * R();
    const o = i * 24;
    inst.set(p0, o); inst.set(vel, o + 3);
    inst.set([R0[0][0], R0[1][0], R0[2][0]], o + 6); inst.set([R0[0][1], R0[1][1], R0[2][1]], o + 9); inst.set([R0[0][2], R0[1][2], R0[2][2]], o + 12);
    inst.set(norm([R() - .5, R() - .5, R() - .5]), o + 15);
    inst.set([sz, sz * asp, big ? sz * .16 : sz * .5], o + 18);
    inst.set([R() * TAU, (R() - .5) * (big ? 3.2 : 9)], o + 21);
    // seed goes in slot 23 (rot has 2 floats: 21,22)
    inst[o + 23] = big ? R() : 2 + R();          // <2 : big shard palette pick, ≥2 : spark dust
  }

  const shardProg = makeProgram(`#version 300 es
precision highp float;
in vec3 aVert; in vec3 aBary; in vec3 aMask;
in vec3 iPos0; in vec3 iVel; in vec3 iR0a; in vec3 iR0b; in vec3 iR0c; in vec3 iAxis; in vec3 iScale; in vec2 iRot; in float iSeed;
uniform mat4 uVP; uniform float uTau; uniform float uDrag;
out vec3 vBary; out vec3 vMask; out vec3 vWorld; out float vSeed;
mat3 rodr(vec3 ax,float a){ float c=cos(a),s=sin(a),t=1.-c; vec3 u=ax;
  return mat3(t*u.x*u.x+c, t*u.x*u.y+s*u.z, t*u.x*u.z-s*u.y,
              t*u.x*u.y-s*u.z, t*u.y*u.y+c, t*u.y*u.z+s*u.x,
              t*u.x*u.z+s*u.y, t*u.y*u.z-s*u.x, t*u.z*u.z+c); }
void main(){
  float tau=uTau;
  vec3 pos=iPos0+iVel*(1.-exp(-uDrag*tau))/uDrag;
  mat3 R0=mat3(iR0a,iR0b,iR0c);
  mat3 Rt=rodr(normalize(iAxis),iRot.y*tau*min(1.,1.+tau*.0));
  vec3 wp=pos+Rt*(R0*(aVert*iScale));
  vWorld=wp; vBary=aBary; vMask=aMask; vSeed=iSeed;
  gl_Position=uVP*vec4(wp,1.);
}`, `#version 300 es
precision highp float;
in vec3 vBary; in vec3 vMask; in vec3 vWorld; in float vSeed;
uniform vec3 uCam; uniform float uGlow; uniform float uG;
out vec4 fragColor;
${ENV_GLSL}
void main(){
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  vec3 V=normalize(uCam-vWorld);
  if(dot(n,V)<0.) n=-n;
  float pick=fract(vSeed*7.31+.13);
  vec3 tint = pick<.66 ? vec3(.50,.86,1.) : pick<.84 ? vec3(1.,.74,.28) : pick<.93 ? vec3(1.,.30,.66) : vec3(.92,.97,1.);
  vec3 col;
  if(vSeed>=2.){                       // spark dust: pure emission
    col=tint*(1.6+uGlow*1.4);
  } else {
    vec3 r=reflect(-V,n);
    float ndv=max(dot(n,V),0.);
    float fres=pow(1.-ndv,3.);
    vec3 film=.5+.5*cos(TAUC*(vec3(1.,1.,1.)*(ndv*1.3+vSeed*2.)+vec3(0.,.33,.67)));
    col=envE(r,uG)*mix(vec3(.35),tint*.9,.55)*(.55+.45*film)+tint*fres*.55;
    float e=min(min(vBary.x+vMask.x,vBary.y+vMask.y),vBary.z+vMask.z);
    float edge=smoothstep(.075,.0,e);
    col+=tint*edge*(.5+2.3*uGlow)+vec3(1.)*smoothstep(.02,.0,e)*.5*(uGlow+.3);
  }
  float fogk=exp(-length(uCam-vWorld)*.115);
  col=mix(vec3(.008,.012,.034),col,fogk);
  fragColor=vec4(col,1.);
}`.replace('TAUC', '6.28318'), 'shard');

  // VAO
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  function attr(name, data, size, div = 0, stride = 0, offset = 0, buf = null) {
    const loc = gl.getAttribLocation(shardProg.p, name); if (loc < 0) return;
    if (!buf) { buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); }
    else gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset); gl.vertexAttribDivisor(loc, div);
    return buf;
  }
  attr('aVert', new Float32Array(verts), 3); attr('aBary', new Float32Array(bary), 3); attr('aMask', new Float32Array(mask), 3);
  const ib = attr('iPos0', inst, 3, 1, 96, 0);
  attr('iVel', null, 3, 1, 96, 12, ib); attr('iR0a', null, 3, 1, 96, 24, ib); attr('iR0b', null, 3, 1, 96, 36, ib); attr('iR0c', null, 3, 1, 96, 48, ib);
  attr('iAxis', null, 3, 1, 96, 60, ib); attr('iScale', null, 3, 1, 96, 72, ib); attr('iRot', null, 2, 1, 96, 84, ib);
  attr('iSeed', null, 1, 1, 96, 92, ib);
  gl.bindVertexArray(null);
  const VCOUNT = verts.length / 3;

  // background of the chapter: cold void, a hot core light and drifting motes
  const bg = frag(`
    uniform float uCore, uWarp;
    void main(){
      vec3 c=bgVoid(vUv,uT*.6,vec3(.45,.65,1.),1.);
      vec2 p=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
      float r=length(p);
      c+=vec3(.20,.32,.62)*exp(-r*2.6)*.35;
      c+=vec3(1.,.85,.6)*uCore*exp(-r*7.)*1.4;
      // faint light shafts
      float an=atan(p.y,p.x);
      c+=vec3(.5,.6,1.)*pow(max(sin(an*7.+uT*.2),0.),8.)*exp(-r*3.)*.05*(1.+uCore);
      fragColor=vec4(c,1.);
    }`, 's6.bg');
  const acc = frag(`uniform sampler2D uTex; uniform float uW; void main(){ fragColor=vec4(texture(uTex,vUv).rgb*uW,1.); }`, 's6.acc');

  function camAt(u) {
    const k = clamp(u / 3.75);
    const yaw = .25 + 1.85 * E.inOutSine(k) + .3 * Math.sin(u * .8);
    const pitch = .10 + .30 * Math.sin(k * Math.PI * .9) + .05;
    let dist = mix(6.6, 4.5, E.inOutCubic(lin(.35, 2.0, u)));
    dist = mix(dist, 5.4, E.inCubic(lin(2.5, 3.75, u)));
    return { pos: [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)], dist, yaw, pitch };
  }

  function drawShards(c, tau, cam, glow) {
    bindTarget(TMP_DEPTH);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shardProg.p);
    const P = m4.persp(0.78, W / H, 0.05, 60), V = m4.look(cam.pos, [0, 0, 0]);
    setUniforms(shardProg, { uVP: m4.mul(P, V), uTau: tau, uDrag: 0.55, uCam: cam.pos, uGlow: glow, uG: G_TIME });
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, VCOUNT, N);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  }

  registerScene(5, {
    trans: { dur: 0.0, type: 4 },
    render(c) {
      const { lt: u0, o, a, fx } = c;
      const u = clamp(u0, 0, 3.75);
      const tau = TL.tau(u), v = TL.tauSpeed(u);
      const cam = camAt(u);
      const core = pulse(u, 0, .09) * .7 + E.inCubic(lin(3.3, 3.75, u)) * .9;
      const glow = .22 + 1.0 * pulse(u, 0, .5) + .9 * E.inCubic(lin(2.9, 3.75, u));

      // ── motion-blurred accumulation of τ sub-samples ──
      const shutter = 0.5 / 60;
      const nS = clamp(Math.ceil(Math.abs(v) * 0.012 * 60 * 2.2 + 1), 1, 9);
      for (let i = 0; i < nS; i++) {
        const uu = u - shutter * (nS > 1 ? i / (nS - 1) : 0);
        c.run(bg, TMP_DEPTH, { uT: u, uCore: core, uWarp: 0 });
        drawShards(c, TL.tau(Math.max(uu, 0)), cam, glow);
        runBlend(acc, c.tgt, { uTex: TMP_DEPTH, uW: 1 / nS });
      }

      // ── overlay ─────────────────────────────────────────
      // shockwave at the burst
      if (u < 1.1) {
        const k = u / 1.1;
        a.strokeStyle = `rgba(190,225,255,${.9 * (1 - k) * (1 - k)})`; a.lineWidth = 6 * (1 - k) + 1;
        a.beginPath(); a.arc(960, 540, 60 + 1500 * E.outExpo(k), 0, TAU); a.stroke();
        a.strokeStyle = `rgba(255,220,170,${.6 * (1 - k)})`; a.lineWidth = 2;
        a.beginPath(); a.arc(960, 540, 30 + 900 * E.outExpo(clamp(k * 1.2)), 0, TAU); a.stroke();
      }
      // the stopwatch: its hand IS τ(u)
      const R = 470, cy = 540, ringA = .55;
      a.save(); a.strokeStyle = `rgba(230,240,255,${ringA})`; a.lineWidth = 1.6;
      a.beginPath(); a.arc(960, cy, R, 0, TAU); a.stroke();
      a.beginPath(); a.arc(960, cy, R - 34, 0, TAU); a.globalAlpha = .35; a.stroke(); a.globalAlpha = 1;
      for (let i = 0; i < 96; i++) {
        const an = i / 96 * TAU - Math.PI / 2, l = i % 8 ? 9 : 26;
        a.beginPath(); a.moveTo(960 + Math.cos(an) * (R - l), cy + Math.sin(an) * (R - l)); a.lineTo(960 + Math.cos(an) * R, cy + Math.sin(an) * R); a.stroke();
      }
      const hand = tau * TAU - Math.PI / 2;
      const hp = () => { a.beginPath(); a.moveTo(960 - Math.cos(hand) * 40, cy - Math.sin(hand) * 40); a.lineTo(960 + Math.cos(hand) * (R - 6), cy + Math.sin(hand) * (R - 6)); };
      glowStroke(a, hp, v < 0 ? [255, 90, 160] : [255, 200, 120], 2.4, 1);
      glowDot(a, 960 + Math.cos(hand) * (R - 6), cy + Math.sin(hand) * (R - 6), 30, v < 0 ? [255, 90, 160] : [255, 200, 120], .9);
      a.restore();

      // speed read-out (like a video player's rate)
      captionShade(o, sstep(.1, .35, u) * (1 - sstep(3.55, 3.72, u)), 820);
      const speedStr = '×' + (v < 0 ? '−' : '') + AR(Math.abs(v).toFixed(Math.abs(v) < .1 ? 3 : 2));
      const rA = sstep(.1, .35, u) * (1 - sstep(3.55, 3.72, u));
      text(o, 'سرعة الزمن', 960, 905, { font: F.ruqaa(34, 700), fill: C.cream, alpha: .75 * rA });
      text(o, speedStr, 960, 975, { font: F.reem(84, 700), fill: v < 0 ? '#ff5aa0' : (Math.abs(v) < .3 ? '#8fe9ff' : C.cream), alpha: rA, dir: 'ltr', shadow: ['rgba(0,0,0,.7)', 20] });
      // caption in the frozen moment
      const capIn = E.outCubic(lin(1.25, 1.85, u)), capOut = 1 - sstep(2.3, 2.6, u);
      if (capIn > 0 && capOut > 0) {
        const w = 460;
        o.save(); o.beginPath(); o.rect(960 + w / 2 - w * capIn, 180, w * capIn + 2, 110); o.clip();
        text(o, 'حتى الزمن ينحني', 960, 230, { font: F.ruqaa(62, 700), fill: C.cream, alpha: capOut, shadow: ['rgba(0,0,0,.7)', 22] });
        o.restore();
      }

      // grading follows the speed
      fx.ca += Math.min(.014, Math.abs(v) * .0012);
      fx.zoomBlur += .06 * E.inCubic(lin(3.3, 3.75, u)) + (v > 3 ? .03 : 0);
      fx.sat = mix(1, .6, sstep(.6, 1.3, u)) * mix(1, 1, 0) + 0.0;
      fx.sat = 1 - .35 * (1 - Math.min(1, Math.abs(v) / 2)) * sstep(.5, 1.2, u) * (v >= 0 ? 1 : 0) + .35 * (v < 0 ? 0 : 0);
      fx.tint = v < 0 ? [1.0, .93, 1.05] : [1, 1, 1];
      fx.vig = .42; fx.bloom += .15;
    },
  });
  window.__S6 = { camAt };
})();
