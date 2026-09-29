'use strict';
// ══════════════════════════════════════════════════════════════
//  ٧ · سرعة — after the rewind snaps shut, everything is released at once:
//  an endless tunnel of eight-pointed star rings, the lattice etched on its walls,
//  words that punch through the lens. Speed doubles on bar 13; the last beat
//  inhales the entire picture into a single point (which is where we began).
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  const prog = frag(ENV_GLSL + `
uniform float uZ, uRoll, uKick, uHue, uCollapse, uSpeed, uBoost;
float starD(vec2 q){
  float a=abs(sdBox2(q,vec2(.7071)));
  float b=abs(sdBox2(rot(.785398)*q,vec2(.7071)));
  return min(a,b);
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  p=rot(uRoll)*p;
  float r=length(p), ang=atan(p.y,p.x);
  const float F=1.05, Rw=2.3, SP=2.2;
  float sc=1.-uCollapse; sc=sc*sc;
  vec3 col=mix(vec3(.004,.004,.016),vec3(.06,.02,.10),exp(-r*2.5))*(1.+uKick*.6);

  // wall lattice, bent into the tunnel
  float depthW=F*Rw*sc/max(r,1e-3);
  vec2 wuv=vec2(ang/TAU*14.,(depthW+uZ)/SP*.9);
  col+=GOLD*lattE(wuv)*.16*exp(-depthW*.05)*smoothstep(.02,.25,r)*(.5+uKick);

  // star rings
  const int N=30;
  float z0=uZ/SP, fz=fract(z0), base=floor(z0);
  for(int k=0;k<N;k++){
    float fk=float(k);
    float dk=(fk+1.-fz)*SP;
    float idx=base+fk;
    float s=F/dk*sc*(1.+.05*uKick);
    vec2 q=rot(idx*.13+uG*.25)*p/s/Rw;
    float sd=starD(q)*Rw*s;                          // screen-space distance to the outline
    float sd2=starD(q*1.85)/1.85*Rw*s;              // inner star
    float fog=exp(-dk*.052)*smoothstep(0.,1.4,dk-1.);
    float ct=fract(idx*.047+uHue);
    vec3 VIO=vec3(.52,.30,1.);
    vec3 cc = ct<.25 ? mix(GOLD,MAG,ct*4.) : ct<.5 ? mix(MAG,VIO,(ct-.25)*4.) : ct<.75 ? mix(VIO,CYAN,(ct-.5)*4.) : mix(CYAN,GOLD,(ct-.75)*4.);
    float lw=.0026+.0011*uBoost;
    float ln=smoothstep(lw,0.,sd)+exp(-sd*70.)*.28;
    float ln2=(smoothstep(lw,0.,sd2)+exp(-sd2*70.)*.2)*step(.5,fract(idx*.5));
    col+=cc*(ln+ln2*.7)*fog*(.95+uKick*.8);
    // faint filled face on the nearest rings
    float ins=smoothstep(0.,-.01,min(sdBox2(q,vec2(.7071)),sdBox2(rot(.785398)*q,vec2(.7071))));
    col+=cc*ins*.012*fog*(.5+uKick);
  }
  // radial star-streaks
  for(int L=0;L<3;L++){
    float n=90.+float(L)*47.;
    float sa=ang/TAU*n; float sec=floor(sa); float h=hash11(sec*1.7+float(L)*13.7);
    float perp=abs(fract(sa)-.5)*TAU*r/n;
    float sp=.35+h*1.3;
    float rho=pow(fract(h*5.3+uZ*.028*sp),2.4)*1.5;
    float len=.04+.30*rho;
    float band=smoothstep(rho-len,rho,r)*step(r,rho);
    vec3 sc3=mix(mix(CYAN,GOLD2,step(.5,h)),vec3(1.),step(.85,h));
    col+=sc3*band*smoothstep(.0028,0.,perp)*(0.5+1.4*h)*(.7+uBoost*.8)*sc;
  }
  // the vanishing-point core
  col+=vec3(1.,.86,.62)*exp(-r*(38.-24.*uCollapse))*(.22+uKick*.40+uCollapse*2.6);
  col+=vec3(1.)*exp(-r*90.)*uCollapse*3.;
  col*=1.-smoothstep(.98,1.,uCollapse);
  fragColor=vec4(col,1.);
}`, 's7');

  // distance travelled: speed doubles on bar 13, then everything is sucked in
  const speedAt = s => {
    let v = 13 + 3 * Math.sin(s * 3);
    if (s > 1.875) v = 30 + 6 * Math.sin(s * 5);
    if (s > 3.15) v = 30 + 260 * E.inCubic(lin(3.15, 3.75, s));
    return v * lin(0, .12, s + .12);
  };
  const ZT = []; { let z = 0; for (let i = 0; i <= 3800; i++) { ZT.push(z); z += speedAt(i * .001) * .001; } }
  const zAt = s => { const f = clamp(s, 0, 3.75) * 1000, i = Math.floor(f); return mix(ZT[i], ZT[Math.min(i + 1, 3800)], f - i); };

  registerScene(6, {
    trans: { dur: 0.0, type: 4 },
    render(c) {
      const { lt: s0, o, a, fx } = c;
      const s = Math.max(s0, 0);
      const bt = c.t / B, bi = Math.floor(bt), kick = Math.exp(-(bt - bi) * 4.2);
      const boost = s > 1.875 ? 1 : 0;
      const roll = .12 * Math.sin(s * 1.3) + (s > 1.875 ? 1.5708 * E.outBack(lin(1.875, 2.25, s)) : 0) + 0.5 * pulse(s, 1.875, .08) * 0;
      const collapse = E.inCubic(lin(3.15, 3.75, s));
      c.run(prog, c.tgt, { uT: s, uZ: zAt(s), uRoll: roll, uKick: kick, uHue: Math.floor(bt / 2) * .21, uCollapse: collapse, uSpeed: speedAt(s), uBoost: boost });

      // words that pass through the lens (drawn on the crisp layer so the zoom blur never smears them)
      const words = [['سرعة', 0.0, 0.85], ['أسرع', 1.875, 2.7]];
      for (const [w, t0, t1] of words) {
        const k = lin(t0, t1, s); if (k <= 0 || k >= 1) continue;
        const sc = mix(.5, 9, E.inQuart(k)), al = Math.sin(Math.PI * Math.pow(k, .45)) * (1 - E.inQuad(k));
        fx.crisp.push(x => {
          text(x, w, 960, 540, { font: F.kufi(430, 900), fill: `rgba(255,190,90,${.20 * al})`, stroke: [`rgba(255,244,225,${.95 * al})`, 6 / Math.max(1, sc * .4)], sx: sc, sy: sc, shadow: [`rgba(255,180,80,${.8 * al})`, 30] });
        });
      }
      // reticle
      const ra = (1 - collapse) * .55;
      a.save(); a.strokeStyle = `rgba(255,236,200,${ra})`; a.lineWidth = 1.5;
      for (const R of [74, 118]) { a.beginPath(); a.arc(960, 540, R * (1 + .06 * kick), 0, TAU); a.stroke(); }
      for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + roll; a.beginPath(); a.moveTo(960 + Math.cos(an) * 128, 540 + Math.sin(an) * 128); a.lineTo(960 + Math.cos(an) * 170, 540 + Math.sin(an) * 170); a.stroke(); }
      a.restore();
      const sp = speedAt(s);
      fx.zoomBlur += Math.min(.30, sp * .006) * (1 - collapse * .5);
      fx.ca += .004 + sp * .00025 + .01 * collapse;
      fx.streak = .5;
      fx.bloom += .1 + .5 * collapse; fx.thresh = .78;
      fx.vig = .38;
    },
  });
})();
