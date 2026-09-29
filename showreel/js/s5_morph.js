'use strict';
// ══════════════════════════════════════════════════════════════
//  ٥ · تحوّل — a liquid-chrome body morphs beat by beat:
//  sphere → cube → ring → octahedron → the eight-pointed star → twist → sphere,
//  then cracks with light (charging the shatter in chapter 6).
//  It reflects a dome etched with the same star lattice we built in chapter 2.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  const SEQ = [0, 1, 2, 3, 4, 5, 6, 0, 0];
  const TILT = [0.35, 0.35, 1.05, 0.35, 1.25, 0.35, 0.35];

  const prog = frag(ENV_GLSL + `
uniform float uShapeA, uShapeB, uMorph, uKick, uScale, uWob, uCharge, uRotY, uRotX, uYaw, uDolly, uFade;
const float ROT45=.785398;

float shapeSDF(int id, vec3 p){
  if(id==1) return sdBox(p,vec3(.70))-.28;
  if(id==2){ vec2 q=vec2(length(p.xz)-.84,p.y); return length(q)-.33; }
  if(id==3) return (abs(p.x)+abs(p.y)+abs(p.z)-1.32)*.57735-.05;
  if(id==4){
    float a=sdBox2(p.xz,vec2(.60)), b=sdBox2(rot(ROT45)*p.xz,vec2(.60));
    float d2=min(a,b); vec2 w=vec2(d2,abs(p.y)-.30);
    return min(max(w.x,w.y),0.)+length(max(w,0.))-.07;
  }
  if(id==5){ vec3 q=p; q.xz*=rot(p.y*2.3); return sdBox(q,vec3(.36,.92,.36))-.13; }
  if(id==6) return length(p)-1.0+.16*(noise3(p*2.4+uG*.7)-.5)*2.;
  return length(p)-1.05;
}
vec3 satPos(int i,float t){
  float fi=float(i);
  float a=t*(.8+.23*fi)+fi*1.9, b=t*(.5+.17*fi)+fi*2.7;
  float r=1.45+.28*sin(t*.9+fi*3.);
  return r*vec3(cos(a)*cos(b), sin(b)*.9, sin(a)*cos(b));
}
float map(vec3 p){
  vec3 q=p;
  q.xz*=rot(uRotY); q.yz*=rot(uRotX);
  q/=uScale;
  float d=mix(shapeSDF(int(uShapeA+.5),q),shapeSDF(int(uShapeB+.5),q),uMorph)*uScale;
  d+=uWob*.05*sin(p.x*6.+uG*4.)*sin(p.y*6.+uG*3.1)*sin(p.z*6.-uG*2.);
  for(int i=0;i<4;i++){
    float rs=(.12+.03*float(i))*uScale;
    d=smin(d,length(p-satPos(i,uG))-rs,.42*uWob+.12);
  }
  return d*.82;
}
vec3 calcN(vec3 p){
  vec2 e=vec2(.0012,0.);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
}
vec3 env(vec3 r){ return envE(r,uG); }
void main(){
  vec2 px=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=vec3(sin(uYaw)*uDolly,.25+.25*sin(uG*.4),-cos(uYaw)*uDolly);
  vec3 fwd=normalize(-ro+vec3(0.,.05,0.));
  vec3 right=normalize(cross(fwd,vec3(0,1,0))); vec3 up=cross(right,fwd);
  vec3 rd=normalize(fwd*1.55+right*px.x+up*px.y);

  // backdrop: moving lattice in perspective + bokeh
  vec3 bg=env(rd)*.55;
  vec2 bp=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
  bg=mix(bg,vec3(.01,.012,.03),.45);
  for(int i=0;i<7;i++){
    float fi=float(i);
    vec2 c=vec2(sin(uG*.13*(fi+1.)+fi*2.1)*.8,cos(uG*.11*(fi+2.)+fi*1.3)*.4);
    float r=.10+.06*hash11(fi*3.7);
    float dd=length(bp-c);
    vec3 bc=mix(mix(MAG,CYAN,hash11(fi*7.1)),GOLD,step(.6,hash11(fi*1.9)));
    bg+=bc*smoothstep(r,r*.55,dd)*.05+bc*smoothstep(r*1.05,r*.95,dd)*smoothstep(r*.85,r,dd)*.06;
  }
  bg+=vec3(.02,.01,.04)*(1.-length(bp));

  float t=0.; float minD=1e3; bool hit=false;
  for(int i=0;i<96;i++){
    vec3 p=ro+rd*t; float d=map(p);
    minD=min(minD,d);
    if(d<.0009){ hit=true; break; }
    t+=d;
    if(t>14.) break;
  }
  vec3 col=bg;
  vec3 aura=mix(mix(MAG,CYAN,.5+.5*sin(uG*.9)),GOLD,.5+.5*sin(uG*.6+1.));
  col+=aura*exp(-minD*6.)*.42*(1.+uKick*.8);
  if(hit){
    vec3 p=ro+rd*t; vec3 n=calcN(p);
    vec3 r=reflect(rd,n);
    float ndv=max(dot(n,-rd),0.);
    float fres=pow(1.-ndv,3.);
    // thin-film iridescence
    vec3 film=pal(ndv*1.4+n.y*.35+uG*.08,vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67));
    vec3 E=env(r);
    // crude AO
    float ao=1.; for(int k=1;k<4;k++){ float h=.07*float(k); ao-=(h-map(p+n*h))*.5/float(k); }
    ao=clamp(ao,.25,1.);
    col=E*mix(vec3(.92),film*1.25,.62)*ao;
    col+=film*fres*.75+aura*fres*.25;
    // inner light cracks (charge)
    float cr=smoothstep(.06,.0,abs(noise3(p*3.6+3.)-.5)-.0)*uCharge;
    cr+=smoothstep(.05,.0,abs(noise3(p*7.+9.)-.5))*uCharge*.6;
    col+=vec3(1.,.82,.55)*cr*1.35+vec3(1.,.4,.7)*uCharge*fres*.55;
  }
  col*=1.-uFade;
  fragColor=vec4(col,1.);
}`, 's5');

  registerScene(4, {
    trans: { dur: 0.0, type: 4 },
    render(c) {
      const { lt: z0, o, a, fx } = c;
      const z = Math.max(z0, 0);
      const b = Math.min(7, Math.floor(z / B)), fr = z / B - b;
      const A = SEQ[b], Bn = SEQ[b + 1];
      const morph = E.inOutCubic(lin(.30, .86, fr));
      const kickE = Math.exp(-fr * 4);
      const scaleIn = spring(z - .02, 13, .5);
      const charge = sstep(2.55, 3.65, z);
      const sc = scaleIn * (1 + .07 * kickE) * (1 + .12 * charge * Math.sin(z * 90) * 0.15);
      c.run(prog, c.tgt, {
        uT: z, uShapeA: A, uShapeB: Bn, uMorph: morph, uKick: kickE, uScale: Math.max(sc, 0.001),
        uWob: 0.35 + 0.9 * Math.sin(morph * Math.PI) + 0.6 * pulse(z, 0, .3), uCharge: charge,
        uRotY: z * 1.05 + 0.4, uRotX: mix(TILT[A], TILT[Bn], morph) + 0.10 * Math.sin(z * 1.1), uYaw: 0.5 * Math.sin(z * .6) - .1 + z * .12, uDolly: mix(6.0, 4.3, E.outCubic(lin(0, 1.2, z))), uFade: 0,
      });

      // overlay: orbiting instrument rings in perspective
      for (let k = 0; k < 3; k++) {
        const rr = 380 + k * 120, an = z * (.6 - k * .22) + k * 1.3;
        a.save(); a.translate(960, 500); a.rotate(-.35 + k * .55); a.scale(1, .26 + .08 * k);
        a.strokeStyle = `rgba(255,214,140,${.32 - k * .07})`; a.lineWidth = 1.6;
        a.beginPath(); a.arc(0, 0, rr, 0, TAU); a.stroke();
        for (let i = 0; i < 72; i++) {
          const ang = i / 72 * TAU + an, l = i % 6 ? 6 : 16;
          a.beginPath(); a.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); a.lineTo(Math.cos(ang) * (rr + l), Math.sin(ang) * (rr + l)); a.stroke();
        }
        a.fillStyle = 'rgba(255,240,210,.95)'; a.beginPath(); a.arc(Math.cos(an * 1.7) * rr, Math.sin(an * 1.7) * rr, 5, 0, TAU); a.fill();
        a.restore();
      }
      // caption
      const capIn = E.outCubic(lin(.6, 1.3, z)), capOut = 1 - sstep(3.0, 3.3, z);
      if (capIn > 0 && capOut > 0) {
        captionShade(o, capIn * capOut, 840);
        const w = 640;
        o.save(); o.beginPath(); o.rect(960 + w / 2 - w * capIn, 900, w * capIn + 2, 110); o.clip();
        text(o, 'لا شيء يبقى على حاله', 960, 950, { font: F.ruqaa(60, 700), fill: C.cream, alpha: capOut, shadow: ['rgba(0,0,0,.7)', 20] });
        o.restore();
      }
      fx.bloom += .18; fx.streak = .25 * charge; fx.exposure = 1 - .12 * charge;
      fx.ca += .003 * charge;
    },
  });
})();
