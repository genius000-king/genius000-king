'use strict';
// ══════════════════════════════════════════════════════════════
//  The star-lattice plane, shared by chapters 2 and 3.
//  Chapter 2: flat lines on the floor, seen from above (matches the 2D overlay 1:1).
//  Chapter 3: the very same plane, but every star rises into a lit octagram tower.
//  World unit: one star has circumradius 1, lattice spacing 2.
// ══════════════════════════════════════════════════════════════
const CITY = frag(`
uniform vec3 uCam, uTgt;
uniform float uRoll, uFocal;
uniform float uRise;       // seconds since the drop; <0 = flat plane
uniform float uReveal;     // lattice reveal radius (world units)
uniform float uCenterOn;   // 1 = shader draws the centre star as well
uniform float uKick;       // beat envelope 0..1
uniform float uBeatI;      // beat index
uniform float uHmax;
uniform float uAvenue;
uniform float uExpo;
uniform float uWarm;       // 0 = cool teal world, 1 = warm gold world
uniform float uFogD;
uniform float uBgMix;      // 1 = floor shows chapter-1 void (dust), 0 = dark glass

const float SQ=.66;        // prism half-side (slightly inset from the line star .7071)
const float LSQ=.7071;
const float ROT45=.785398;

float cellH(vec2 id){
  float d=length(id);
  float av=smoothstep(-1.5,-3.2,id.y)*(1.-smoothstep(.4,2.2,abs(id.x)));   // an avenue opens down -z
  float avM=1.-.93*av*uAvenue;
  float r=hash21(id+3.7);
  float x=clamp((uRise-d*.05)/.55,0.,1.);
  float g=(uRise<=0.||x<=0.)?0.:1.-exp(-6.5*x)*cos(x*10.);
  float wave=.5+.5*sin(d*.85-uG*2.3);
  float base=.55+1.7*r*r+1.5*wave*wave;
  float kick=uKick*(.3+.55*sin(d*1.15+uBeatI*1.9));
  return max(0.,g*(base+kick)*avM);
}
float ext(float d2,float y,float h){
  vec2 w=vec2(d2,abs(y-h*.5)-h*.5);
  return min(max(w.x,w.y),0.)+length(max(w,0.));
}
float towers(vec3 p,vec2 id){
  vec2 q=p.xz-2.*id;
  float h=cellH(id);
  if(h<.002) return 1e3;
  float a=sdBox2(q,vec2(SQ));
  float b=sdBox2(rot(ROT45)*q,vec2(SQ));
  return min(ext(a,p.y,h*.62),ext(b,p.y,h));
}
float map(vec3 p){
  float d=p.y;
  vec2 pp=(p.xz+1.)*.5; vec2 id0=floor(pp); vec2 f=pp-id0;
  vec2 s=step(.5,f)*2.-1.;
  d=min(d,towers(p,id0));
  d=min(d,towers(p,id0+vec2(s.x,0.)));
  d=min(d,towers(p,id0+vec2(0.,s.y)));
  d=min(d,towers(p,id0+s));
  return d;
}
vec3 calcN(vec3 p){
  vec2 e=vec2(.0018,0.);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
}
// line work of one star (returns 0..1 intensity), q = local xz
float starLines(vec2 q,float w){
  float dA=abs(sdBox2(q,vec2(LSQ)));
  float dB=abs(sdBox2(rot(ROT45)*q,vec2(LSQ)));
  float dC=abs(length(q)-.30);
  float d=min(min(dA,dB),dC);
  return smoothstep(w,w*.25,d)+exp(-d*26.)*.22;
}
float cornerLines(vec2 q,float w){
  float dA=abs(sdBox2(q,vec2(.22)));
  float dB=abs(sdBox2(rot(ROT45)*q,vec2(.22)));
  float d=min(dA,dB);
  return smoothstep(w,w*.25,d)+exp(-d*30.)*.18;
}
vec3 SUN=normalize(vec3(.06,.085,-1.));
vec3 skyBase(vec3 rd){
  float h=clamp(rd.y,0.,1.);
  vec3 zen=vec3(.006,.008,.03);
  vec3 mid=mix(vec3(.05,.03,.14),vec3(.16,.05,.20),uWarm);       // violet band
  vec3 hor=mix(vec3(.10,.10,.30),vec3(.85,.34,.16),uWarm);       // hot horizon line
  vec3 c=mix(zen,mid,exp(-h*4.2));
  c=mix(c,hor,exp(-h*24.)*.75);
  float sd=max(dot(rd,SUN),0.);
  c+=vec3(1.,.45,.18)*pow(sd,18.)*.5+vec3(1.,.70,.38)*pow(sd,90.)*.5+vec3(1.,.93,.78)*pow(sd,1600.)*1.7;
  return c;
}
vec3 sky(vec3 rd){
  vec3 c=skyBase(rd);
  vec2 sp=rd.xz/(rd.y+.35)*30.; vec2 id=floor(sp); vec2 hh=hash22(id);
  c+=vec3(.8,.9,1.)*smoothstep(.08,0.,length(fract(sp)-.5-(hh-.5)*.6))*step(.93,hh.x)*smoothstep(.05,.3,rd.y)*.6;
  return c;
}
vec3 palA(float k){ return mix(GOLD,GOLD2,k); }

void main(){
  vec2 px=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 fwd=normalize(uTgt-uCam);
  vec3 right=normalize(cross(fwd,vec3(0.,1.,0.)));
  vec3 up=cross(right,fwd);
  px=rot(uRoll)*px;
  vec3 rd=normalize(fwd*uFocal+right*px.x+up*px.y);
  vec3 ro=uCam;

  // march
  float t=0.; float hit=0.;
  bool above=ro.y>uHmax;
  if(above){ if(rd.y>=0.) t=1e4; else t=(ro.y-uHmax)/(-rd.y); }
  for(int i=0;i<110;i++){
    if(t>90.) break;
    vec3 p=ro+rd*t;
    if(p.y>uHmax+.02 && rd.y>0.) break;
    float d=map(p);
    if(d<.0016*t+.0008){ hit=1.; break; }
    t+=d*.92;
  }
  vec3 col;
  vec3 tealC=mix(TEAL,CYAN,.3);
  if(hit<.5){
    col=sky(rd);
    // the void glow must match chapter 1's void when nothing is up yet
  } else {
    vec3 p=ro+rd*t; vec3 n=calcN(p);
    vec2 id=floor((p.xz+1.)*.5); vec2 q=p.xz-2.*id;
    float eps=.0016*t+.0008;
    bool floorHit=(p.y<eps*2.5+.003)&&(n.y>.97);
    float dist0=length(2.*id);
    if(floorHit){
      // ── floor: dark glass with etched gold star lines ──
      col=mix(vec3(.010,.014,.034),bgVoid(vUv,uG,vec3(.55,.65,1.),1.),uBgMix);
      float prog=clamp((uReveal-dist0)/1.5,0.,1.);
      float cen=(id==vec2(0.))?uCenterOn:1.;
      float ang=atan(q.y,q.x)/TAU+.5;
      float vis=smoothstep(prog*1.03+.03,prog*1.03,ang)*step(.001,prog)*cen;
      float lead=exp(-abs(ang-prog)*45.)*step(.001,prog)*step(prog,.999)*cen;
      float w=.011+t*.0009;
      float L=starLines(q,w);
      vec2 cq=p.xz-(2.*floor(p.xz*.5)+1.);
      vec2 cid=floor(p.xz*.5);
      float cprog=clamp((uReveal-length(2.*cid+1.))/1.2,0.,1.);
      float C1=cornerLines(cq,w)*cprog;
      float par=mod(id.x+id.y,2.);
      vec3 lc=mix(palA(hash21(id)),tealC,par*uWarm*.0);
      // faint fill of the star faces, pulsing outward on each beat
      float inside=smoothstep(.01,-.01,min(sdBox2(q,vec2(LSQ)),sdBox2(rot(ROT45)*q,vec2(LSQ))));
      float wave=.5+.5*sin(dist0*.8-uG*2.);
      vec3 fill=mix(tealC,GOLD,uWarm)*inside*(.03+.05*wave+.5*uKick*exp(-dist0*.22)*.3)*prog;
      col+=fill;
      col+=lc*L*vis*1.25*uExpo+GOLD2*lead*1.2*vis*0.0+GOLD2*lead*.9*step(.0001,prog);
      col+=tealC*C1*.9*uExpo;
      // beat ring on the floor
      float rr=fract(uBeatI*.0+uG*.0)*0.;
      col+=vec3(.9,.7,.4)*exp(-abs(length(p.xz)-(uKick>.02?(1.-uKick)*18.:0.))*3.)*uKick*.35*step(.001,uRise);
    } else {
      // ── towers: near-black glass, neon edges that spell the star ──
      float h=cellH(id);
      float hA=h*.62, hB=h;
      vec3 base=vec3(.006,.010,.026);
      vec3 L1=normalize(vec3(.10,.45,-.85));
      vec3 L2=normalize(vec3(-.5,.30,.8));
      float dif1=max(dot(n,L1),0.), dif2=max(dot(n,L2),0.);
      float fres=pow(1.-max(dot(n,-rd),0.),4.);
      col=base+vec3(.9,.45,.25)*dif1*.10+tealC*dif2*.05+tealC*fres*.35;
      float grad=smoothstep(0.,4.5,p.y);
      col+=mix(vec3(.0,.02,.07),vec3(.02,.09,.16),grad)*.9;                 // deep-blue → cyan body
      col*=.30+.70*smoothstep(0.,1.2,p.y);                                  // occlusion at the base
      float topN=smoothstep(.90,.98,n.y);
      float sideN=1.-topN;
      vec2 qa=q, qb=rot(ROT45)*q;
      float dA=sdBox2(qa,vec2(SQ)), dB=sdBox2(qb,vec2(SQ));
      // which square owns this pixel?
      bool isB=abs(dB)<abs(dA)||(abs(p.y-hB)<abs(p.y-hA)&&topN>.5&&dB<.02);
      float hh2=isB?hB:hA;
      vec2 qq=isB?qb:qa;
      float dd=isB?dB:dA;
      vec3 edgeC=isB?GOLD2:tealC;
      // top-face outline + inset second line
      if(topN>.05){
        float e=exp(-abs(dd+.045)*70.)*1.1+exp(-abs(dd+.20)*90.)*.35;
        col+=edgeC*e*topN*1.7;
        col+=edgeC*.05*topN*(isB?1.:.8);
        // etched inner ring like the floor pattern
        col+=edgeC*exp(-abs(length(qq)-.30)*80.)*topN*.5;
      }
      // vertical corner edges + top rim on the walls
      float cornerD=length(abs(qq)-vec2(SQ));
      float ce=exp(-cornerD*26.)*smoothstep(0.,.25,hh2-p.y+.02);
      float rim=exp(-abs(hh2-p.y)*38.);
      col+=sideN*(edgeC*ce*1.5+edgeC*rim*1.8);
      // lit windows climbing the walls
      vec2 wuv=vec2((p.x+p.z)*4.+id.x*3.1,p.y*3.6)+vec2(0.,id.y*1.7);
      vec2 wi=floor(wuv), wf=fract(wuv);
      float wh=hash21(wi+id*11.);
      float win=step(.74,wh)*smoothstep(.10,.2,wf.x)*smoothstep(.90,.8,wf.x)*smoothstep(.18,.28,wf.y)*smoothstep(.82,.72,wf.y);
      float flick=.65+.35*sin(uG*(2.+wh*7.)+wh*30.);
      col+=sideN*win*mix(GOLD2,tealC,step(.55,hash21(wi+7.)))*flick*smoothstep(.2,1.,p.y/max(hh2,.1))*1.15;
      // slow scan band travelling up each tower on the beat
      float scan=exp(-abs(p.y-fract(uG*.35+hash21(id))*hB)*10.)*.22;
      col+=sideN*edgeC*scan;
      col+=edgeC*uKick*.05*smoothstep(0.,hB,p.y);
    }
    // fog
    float fog=1.-exp(-t*uFogD);
    col=mix(col,skyBase(vec3(rd.x,max(rd.y,0.),rd.z)),fog);
  }
  fragColor=vec4(col,1.);
}
`, 'city');

// Camera helper: orbit-style rig around a target.
function cityCam(tgt, dist, yaw, pitch) {
  const cp = Math.cos(pitch);
  return [tgt[0] + dist * cp * Math.sin(yaw), tgt[1] + dist * Math.sin(pitch), tgt[2] + dist * cp * Math.cos(yaw)];
}
const CITY_FOCAL = 1.5;                       // → world-scale S (virtual px/unit) = 1.5*1080/dist for top-down
const cityDistFor = S => CITY_FOCAL * 1080 / S;

function runCity(c, o) {
  // beat envelope from the global time
  const bt = c.t / TL.BEAT, bi = Math.floor(bt), bp = bt - bi;
  const kick = Math.exp(-bp * 4.5);
  const cam = o.camPos || cityCam(o.tgt || [0, 0, 0], o.dist, o.yaw || 0, o.pitch ?? Math.PI / 2 - 0.0008);
  c.run(CITY, c.tgt, {
    uT: c.lt, uCam: cam, uTgt: o.lookAt || o.tgt || [0, 0, 0], uRoll: o.roll || 0, uFocal: o.focal || CITY_FOCAL,
    uRise: o.rise ?? -1, uReveal: o.reveal ?? 0, uCenterOn: o.centerOn ?? 0, uKick: (o.kick ?? 1) * kick, uBeatI: bi,
    uBgMix: o.bgMix ?? 0, uAvenue: o.avenue ?? 0, uHmax: o.hmax ?? 4.5, uExpo: o.expo ?? 1, uWarm: o.warm ?? 0.6, uFogD: o.fog ?? 0.028,
  });
}
