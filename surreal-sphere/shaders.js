// GLSL sources for the film. Everything stays HDR-linear until the grade pass.

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const SKY = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uZen;
uniform vec3 uHor;
vec3 skyCol(vec3 rd){
  vec3 c = mix(uHor, uZen, pow(smoothstep(-0.03, 0.42, rd.y), 0.7));
  float s = max(dot(rd, uSun), 0.0);
  c += uSunCol * (0.06 * pow(s, 3.0) + 0.5 * pow(s, 14.0) + 0.9 * pow(s, 80.0));
  return c;
}
vec3 skySoft(vec3 rd){
  vec3 c = mix(uHor, uZen, smoothstep(-0.1, 0.9, rd.y));
  float s = max(dot(rd, uSun), 0.0);
  c += uSunCol * (0.3 * pow(s, 3.0) + 0.5 * pow(s, 10.0));
  return c;
}
vec3 skyIrr(vec3 n){
  vec3 up = 0.5 * (uZen + uHor);
  vec3 dn = uHor * 0.5;
  vec3 c = mix(dn, up, n.y * 0.5 + 0.5) + uHor * 0.22 * (1.0 - abs(n.y));
  c += uSunCol * 0.25 * max(dot(n, uSun), 0.0);
  return c;
}
`;

export const quadVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------
// The world: an infinite glossy white liquid floor that can be warped, pulled
// into a column, pinched into a living glass sphere and pulled up into sleeves
// around every arm — one signed-distance field, so every change is continuous.
// ---------------------------------------------------------------------------
export const worldFrag = /* glsl */ `
#define NSL 18
#define NCAP 48
uniform mat4 uCamWorld;
uniform mat4 uProjInv;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;
uniform vec4 uSph;   // center.xyz, radius
uniform vec4 uSphA;  // displacement amp, noise freq, noise time, colour amount
uniform vec4 uSphB;  // vertical stretch, glow, tail length, interior time
uniform vec4 uFlA;   // dimple depth, dimple width, inward ripple amp, inward ripple phase
uniform vec4 uFlB;   // column radius (<=0 off), column top y, k floor/column, k world/sphere
uniform vec4 uFlC;   // remnant height, remnant width, shock radius, shock amp
uniform vec4 uFlD;   // outward ripple amp, outward ripple phase, lipschitz scale, white-hot
uniform vec4 uSlA[NSL];   // sleeve base xyz, radius (<=0 off)
uniform vec4 uSlB[NSL];   // sleeve top xyz, blend k
uniform vec4 uCapA[NCAP];
uniform vec4 uCapB[NCAP];
uniform float uEnv;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform vec3 uCol3;
uniform float uStrange;
uniform vec3 uLightCol;
uniform float uTension;
uniform float uFogD;
uniform float uColPhase;
uniform vec2 uDune;      // amplitude, time
uniform vec3 uKey;       // front-left key light (world)
uniform float uSphEmis;
uniform float uLipNear;
varying vec2 vUv;

${NOISE}
${SKY}

uint gMask;
float gSlTop;

float smin(float a, float b, float k){
  if(k < 1e-4) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float floorH(vec2 q){
  float r2 = dot(q, q);
  float r = sqrt(r2);
  float w = uFlA.y;
  float h = -uFlA.x * exp(-r2 / (w * w));
  h += uFlA.z * sin(r * 3.1 + uFlA.w) * exp(-r * 0.42) * smoothstep(0.15, 1.3, r);
  h += uFlD.x * sin(r * 2.6 - uFlD.y) * exp(-r * 0.30) * smoothstep(0.3, 1.5, r);
  h += uFlC.x * exp(-r2 / (uFlC.y * uFlC.y));
  float dr = r - uFlC.z;
  h += uFlC.w * sin(dr * 3.2) * exp(-dr * dr * 0.55);
  // broad cream dunes once the floor has come alive
  if(uDune.x > 0.0){
    float tt = uDune.y;
    vec2 w = q + vec2(sin(q.y * 0.31 + tt * 0.11), sin(q.x * 0.27 - tt * 0.09)) * 1.6;
    h += uDune.x * (0.13 * sin(w.x * 0.62 + tt * 0.21) * sin(w.y * 0.47 - tt * 0.17) + 0.07 * sin(w.x * 1.31 - w.y * 0.93 + tt * 0.3));
  }
  return h;
}

// slow flowing streaks in the liquid surface (normals only)
float flowDetail(vec2 q){
  vec2 w = q + 0.7 * vec2(sin(q.y * 0.83 + uTime * 0.13), sin(q.x * 0.71 - uTime * 0.11));
  float a = sin(w.x * 2.1 + w.y * 0.9) * sin(w.y * 2.6 - w.x * 0.6 + uTime * 0.18);
  float b = sin(w.x * 5.3 + w.y * 3.9 + a * 1.5) * 0.4;
  float h = 0.012 * (a + b);
  for(int i = 0; i < NSL; i++){
    if((gMask & (1u << uint(i))) == 0u) continue;
    vec2 c = uSlA[i].xz + (uSlB[i].xz - uSlA[i].xz) * 0.5;
    vec2 d = q - c;
    float r = length(d) + 1e-3;
    float th = atan(d.y, d.x);
    float fall = exp(-r / (0.8 + 2.5 * uSlA[i].w)) * smoothstep(uSlA[i].w * 0.6, uSlA[i].w * 1.6, r);
    h += fall * (0.03 * sin(th * 9.0 + log(r) * 6.0 - uTime * 0.7 + float(i)) + 0.012 * sin(th * 21.0 - log(r) * 13.0));
  }
  return h;
}

float lipK(vec3 p){
  float r = length(p.xz);
  return mix(uLipNear, 1.0, smoothstep(4.5, 8.0, r)) * uFlD.z;
}

float sdCol(vec3 p){
  float yb = -1.2;
  float yt = uFlB.y;
  float y = clamp(p.y, yb, yt);
  float s = clamp(y / max(yt, 0.01), 0.0, 1.0);
  float r = uFlB.x * (1.0 - 0.5 * pow(sin(3.14159 * s), 2.0));
  return length(p - vec3(0.0, y, 0.0)) - r;
}

float sdSleeve(vec3 p, int i, bool detail){
  vec3 a = uSlA[i].xyz, b = uSlB[i].xyz;
  vec3 ba = b - a, pa = p - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec3 rv = pa - ba * h;
  float r = uSlA[i].w * mix(1.15, 0.78, h);
  float d = length(rv) - r;
  if(detail){
    vec3 ax = normalize(ba);
    vec3 b1 = normalize(cross(ax, vec3(0.0, 0.0, 1.0)));
    vec3 b2 = cross(ax, b1);
    float th = atan(dot(rv, b2), dot(rv, b1));
    float hh = dot(pa, ax);
    d += 0.014 * sin(th * 7.0 + hh * 5.5 - uTime * 1.3 + float(i) * 2.3) + 0.006 * sin(th * 15.0 - hh * 9.0 + uTime * 0.8);
  }
  return d;
}

float mapWorldK(vec3 p, bool detail){
  float fh = floorH(p.xz);
  if(detail) fh += flowDetail(p.xz);
#ifndef NO_SWIRL
  if(detail && gMask != 0u && p.y < gSlTop){
    for(int i = 0; i < NSL; i++){
      if((gMask & (1u << uint(i))) == 0u) continue;
      vec2 d = p.xz - uSlA[i].xz - (uSlB[i].xz - uSlA[i].xz) * 0.35;
      float r = length(d) + 1e-3;
      float rs = uSlA[i].w;
      float th = atan(d.y, d.x);
      float env = smoothstep(rs * 0.8, rs * 2.2, r) * exp(-r / (0.4 + 1.8 * rs)) * (1.0 - smoothstep(rs * 2.2 + 1.2, rs * 2.2 + 2.2, r));
      fh += env * rs * (0.32 * sin(th * 3.0 + log(r) * 5.0 - uTime * 0.9 + float(i)) + 0.12 * sin(th * 7.0 - log(r) * 9.0 + uTime * 0.6));
    }
  }
#endif
  float d = (p.y - fh) * lipK(p);
  if(uFlB.x > 0.0) d = smin(d, sdCol(p), uFlB.z);
  if(gMask != 0u && p.y < gSlTop){
    for(int i = 0; i < NSL; i++){
      if((gMask & (1u << uint(i))) == 0u) continue;
      d = smin(d, sdSleeve(p, i, detail) * 0.8, uSlB[i].w);
    }
  }
  return d;
}

float sdSph(vec3 p){
  vec3 q = p - uSph.xyz;
  q.y /= uSphB.x;
  float R = uSph.w;
  float d0 = length(q) - R;
  float bound = uSphA.x * 1.7 + 0.08;
  float lk = 0.72 * min(uSphB.x, 1.0);
  if(uSphB.z > 0.001){
    float ty = clamp(q.y, -R - uSphB.z, -R * 0.6);
    float tr = mix(0.05, 0.22, smoothstep(-R - uSphB.z, -R * 0.6, ty));
    float dt = length(q - vec3(0.0, ty, 0.0)) - tr;
    d0 = smin(d0, dt, 0.32);
  }
  if(d0 > bound + 0.25) return (d0 - bound) * lk;
  vec3 nq = q * uSphA.y;
  float t = uSphA.z;
  float n1 = snoise(nq + vec3(0.0, t, t * 0.5));
  float n2 = snoise(nq * 2.3 + vec3(t * 0.8, -t * 0.3, -t));
  float disp = uSphA.x * (0.68 * n1 + 0.32 * n2);
  return (d0 - disp) * lk;
}

float map(vec3 p){ return smin(mapWorldK(p, false), sdSph(p), uFlB.w); }

float marchStep(vec3 p, vec3 rd){
  float r = length(p.xz);
  float other = length(p - uSph.xyz) - uSph.w * max(uSphB.x, 1.0) - uSphA.x * 2.0 - uSphB.z - 0.35;
  if(uFlB.x > 0.0) other = min(other, sdCol(p) - uFlB.z - 0.2);
  if(gMask != 0u){
    for(int i = 0; i < NSL; i++){
      if((gMask & (1u << uint(i))) == 0u) continue;
      vec3 a = uSlA[i].xyz, b = uSlB[i].xyz, ba = b - a, pa = p - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      other = min(other, length(pa - ba * h) - uSlA[i].w * 3.4 - uSlB[i].w - 2.2);
    }
  }
  bool steep = r < 4.8 || uFlC.w > 0.005 || other < 0.05;
  if(steep) return map(p);
  float y = p.y - floorH(p.xz);
  float hs = rd.y < 0.0 ? y / (-rd.y + 0.3) : y;
  return min(hs, other + 0.04);
}
float mapDetail(vec3 p){ return smin(mapWorldK(p, true), sdSph(p), uFlB.w); }

vec3 calcNormal(vec3 p, float eps){
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapDetail(p + k.xyy * eps) + k.yyx * mapDetail(p + k.yyx * eps) +
                   k.yxy * mapDetail(p + k.yxy * eps) + k.xxx * mapDetail(p + k.xxx * eps));
}

float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for(int i = 0; i < 5; i++){
    float h = 0.02 + 0.09 * float(i);
    float d = map(p + n * h);
    occ += max(h - d, 0.0) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - 1.6 * occ, 0.35, 1.0);
}

float sphSoftShadow(vec3 ro, vec3 rd, vec4 sph, float k){
  vec3 oc = ro - sph.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - sph.w * sph.w;
  float h = b * b - c;
  float d = sqrt(max(0.0, sph.w * sph.w - h)) - sph.w;
  float t = -b - sqrt(max(h, 0.0));
  return (t < 0.0) ? 1.0 : smoothstep(0.0, 1.0, 2.5 * k * d / t);
}

vec2 sphHit(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  if(h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void armOcclusion(vec3 p, vec3 n, out float ao, out float sh){
  ao = 1.0; sh = 1.0;
  for(int i = 0; i < NCAP; i++){
    vec4 A = uCapA[i];
    vec4 B = uCapB[i];
    if(B.w <= 0.0) continue;
    vec3 ba = B.xyz - A.xyz;
    float h = clamp(dot(p - A.xyz, ba) / dot(ba, ba), 0.0, 1.0);
    vec3 c = A.xyz + ba * h;
    vec3 dv = c - p;
    float d = length(dv);
    float r = A.w;
    if(d > r * 9.0) continue;
    float inside = smoothstep(r * 1.3, r * 2.8, d);
    float o = clamp(dot(n, dv / d) * 0.5 + 0.5, 0.0, 1.0) * (r * r) / (d * d) * inside;
    ao *= 1.0 - B.w * clamp(o * 1.3, 0.0, 0.7);
    vec3 w0 = A.xyz - p;
    float bb = dot(ba, uKey);
    float aa = dot(ba, ba);
    float dd = dot(ba, w0);
    float ee = dot(uKey, w0);
    float den = aa - bb * bb;
    float sc = den > 1e-5 ? clamp((bb * ee - dd) / den, 0.0, 1.0) : 0.0;
    vec3 cp = A.xyz + ba * sc;
    sh *= mix(1.0, sphSoftShadow(p, uKey, vec4(cp, r), 1.0), B.w * inside);
  }
}

vec3 halo(vec3 ro, vec3 rd, float tmax){
  vec3 oc = uSph.xyz - ro;
  float tc = dot(oc, rd);
  float h2 = dot(oc, oc) - tc * tc;
  float h = sqrt(max(h2, 0.02));
  float a0 = atan((0.0 - tc) / h);
  float a1 = atan((tmax - tc) / h);
  return uLightCol * (a1 - a0) / h;
}

// three-hue marbled field used for the sphere interior
vec3 marble(vec3 q, out float veins){
  vec3 wq = q * 0.75 + vec3(0.0, uSphB.w * 0.22, uSphB.w * 0.11);
  float w = snoise(wq * 0.6 - uSphB.w * 0.12);
  float a = snoise(wq + vec3(w * 1.1));
  veins = pow(1.0 - smoothstep(0.0, 0.1, abs(a)), 3.0);
  // three hue territories drifting across the sphere
  float b = snoise(q * 0.55 + vec3(7.1, -3.3, uSphB.w * 0.05)) * 0.6 + q.x * 0.9;
  vec3 alt = b < 0.0 ? mix(uCol1, uCol3, smoothstep(-0.45, 0.0, b)) : mix(uCol3, uCol2, smoothstep(0.0, 0.45, b));
  return mix(uCol1, alt, uStrange);
}

vec3 shadeSphere(vec3 p, vec3 n, vec3 rd){
  vec3 q = (p - uSph.xyz) / uSph.w;
  vec3 v = -rd;
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 rr = refract(rd, n, 0.8);
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  vec3 pp = q;
#ifdef NO_MARBLE
  for(int i = 0; i < 0; i++){
#else
  for(int i = 0; i < 7; i++){
#endif
    pp += rr * 0.2;
    if(dot(pp, pp) > 1.05) break;
    float veins;
    vec3 hue = marble(pp, veins);
    float depthW = 1.0 - 0.6 * length(pp);
    acc += hue * (veins * 4.2 + 0.16 * depthW) * trans;
    trans *= 0.72;
  }
  acc *= 0.24;
  vec3 emis = acc * uSphEmis;
  emis += mix(uCol1, vec3(1.0), 0.5) * pow(ndv, 6.0) * uSphEmis * 0.2 * uTension;
  vec3 body = vec3(0.008, 0.007, 0.01);
  vec3 refl = skySoft(reflect(rd, n));
  refl += uLightCol * 3.0;
  float spec = pow(max(dot(reflect(rd, n), uSun), 0.0), 220.0) * 4.0 * (uEnv + 0.2)
             + pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.8, 0.3))), 0.0), 90.0) * 1.2 * (uEnv + 0.1);
  vec3 col = body + emis;
  col = mix(col, refl, fres * 0.55);
  col += uHor * 2.2 * pow(max(dot(reflect(rd, n), uKey), 0.0), 160.0);
  col += spec * vec3(1.0, 0.98, 0.95);
  // thin bright rim, glass-like
  col += skySoft(n) * pow(1.0 - ndv, 3.0) * 0.18;
  col = mix(col, vec3(1.0) * (2.0 + 6.0 * uFlD.w), clamp(uFlD.w, 0.0, 1.0));
  return col;
}

vec3 shadeFloor(vec3 p, vec3 n, vec3 rd, float t){
#ifdef NO_AO
  float ao = 1.0, aao = 1.0, ash = 1.0;
#else
  float ao = calcAO(p, n);
  float aao, ash;
  armOcclusion(p, n, aao, ash);
#endif
  vec3 dc = uSph.xyz - p;
  float dl = length(dc);
  vec3 L = dc / dl;
  float sphAO = 1.0 - clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0) * pow(uSph.w / dl, 2.0) * 0.9;
  float sh = sphSoftShadow(p + n * 0.01, uKey, vec4(uSph.xyz, uSph.w * 0.95), 1.4) * ash;
  float occ = ao * aao * sphAO;
  vec3 alb = vec3(0.88, 0.875, 0.87);
  float kd = max(dot(n, uKey), 0.0);
  vec3 col = alb * (skyIrr(n) * occ * 0.72 + uHor * 0.42 * kd * sh * mix(1.0, occ, 0.4));
  // satin liquid gloss
  vec3 r = reflect(rd, n);
  float ndv = max(dot(n, -rd), 0.0);
  float F = 0.04 + 0.8 * pow(1.0 - ndv, 4.0);
  vec3 refl = skySoft(r);
  vec2 hs = sphHit(p, r, uSph.xyz, uSph.w);
  if(hs.x > 0.0){
    vec3 hn = normalize(p + r * hs.x - uSph.xyz);
    float edge = pow(1.0 - abs(dot(hn, r)), 2.0);
    vec3 sc = uLightCol * 9.0 + mix(uCol1, uCol2, 0.3) * (0.25 + uSphB.y * 0.25);
    refl = mix(sc, refl, edge * 0.6);
  }
  float so = mix(occ, 1.0, 0.25) * mix(sh, 1.0, 0.6);
  col += refl * F * so;
  col += uSunCol * pow(max(dot(r, uSun), 0.0), 40.0) * 1.2 + uHor * 0.35 * pow(max(dot(r, normalize(vec3(uSun.x, 0.05, uSun.z))), 0.0), 12.0) * so;
  col += uHor * (0.9 * pow(max(dot(r, uKey), 0.0), 70.0) + 0.25 * pow(max(dot(r, uKey), 0.0), 12.0)) * sh;
  float dif = max(dot(n, L), 0.0);
  col += alb * uLightCol * dif / (1.0 + 0.3 * dl * dl) * mix(1.0, aao, 0.6) * 1.5;
  return col;
}

void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uProjInv * vec4(ndc, 1.0, 1.0);
  vec3 rdv = normalize(vp.xyz / vp.w);
  vec3 rd = normalize((uCamWorld * vec4(rdv, 0.0)).xyz);
  vec3 ro = uCamPos;

  // which arm sleeves can this ray touch?
  gMask = 0u;
  gSlTop = -10.0;
  for(int i = 0; i < NSL; i++){
    if(uSlA[i].w <= 0.0) continue;
    vec3 a = uSlA[i].xyz, b = uSlB[i].xyz;
    vec3 m = 0.5 * (a + b);
    float rb = 0.5 * length(b - a) + uSlA[i].w * 1.2 + uSlB[i].w + 0.1;
    vec2 hh = sphHit(ro, rd, m, rb);
    if(hh.y > 0.0){
      gMask |= (1u << uint(i));
      gSlTop = max(gSlTop, max(a.y, b.y) + uSlA[i].w + uSlB[i].w);
    }
  }

  float yTop = max(uSph.y + uSph.w * uSphB.x + uSphA.x * 2.0 + 0.4, 0.8 + max(uFlC.x, 0.0) + abs(uFlC.w));
  yTop = max(yTop, gSlTop + 0.1);
  float t = 0.0;
  bool hit = false;
  bool skip = false;
  if(ro.y > yTop){
    if(rd.y >= 0.0) skip = true;
    else t = (ro.y - yTop) / (-rd.y);
  }
  float tmax = 90.0;
  if(!skip){
    for(int i = 0; i < 170; i++){
      vec3 p = ro + rd * t;
      float d = map(p);
      if(abs(d) < 0.0005 * (1.0 + t)) { hit = true; break; }
      t += d;
      if(t > tmax || (p.y > yTop && rd.y > 0.0)) break;
    }
  }

  vec3 col;
  float depth = 1.0;
  vec3 bg = skyCol(rd);
  if(hit){
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p, 0.0012 * (1.0 + t * 0.5));
    float dw = mapWorldK(p, false);
    float ds = sdSph(p);
    float ws = clamp(0.5 + 0.5 * (dw - ds) / max(uFlB.w * 0.5, 0.025), 0.0, 1.0);
    ws *= uSphA.w * smoothstep(0.1, 1.2, p.y + 0.4 * uSphA.w);
    vec3 cf = shadeFloor(p, n, rd, t);
    if(ws > 0.001){
      vec3 cs = shadeSphere(p, n, rd);
      col = mix(cf, cs, ws);
    } else col = cf;
    col = mix(bg, col, exp(-t * uFogD));
    vec4 clip = uViewProj * vec4(p, 1.0);
    depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  } else {
    col = bg;
    t = 200.0;
  }
  col += halo(ro, rd, min(t, 60.0)) * 0.3;
  vec3 oc = uSph.xyz - ro;
  float tc = max(dot(oc, rd), 0.0);
  float dd = length(oc - rd * tc);
  if(t > tc) col += (uHor * 0.5 + uLightCol * 2.0) * exp(-max(dd - uSph.w, 0.0) * 2.2) * 0.35 * uEnv;
  gl_FragColor = vec4(col, 1.0);
  gl_FragDepth = depth;
}
`;

// ---------------------------------------------------------------------------
// Particles: each point sprite ray-casts a small 3D solid (bevelled cube, tile,
// tetrahedron, octahedron, triangle tile, shard, liquid droplet).
// ---------------------------------------------------------------------------
export const partVert = /* glsl */ `
attribute vec4 iDyn;   // tumble angle, energy, size multiplier, sphere-light factor
attribute vec4 iQuat;
attribute vec4 iInfo;  // shape, size, seed, albedo (droplets: 2 + hue index)
attribute vec3 iAxis;
uniform float uViewH;
uniform float uP11;
flat varying mat3 vM;
flat varying vec3 vC;
flat varying float vHalf;
flat varying vec4 vInfo;
flat varying vec2 vE;

mat3 quatMat(vec4 q){
  float x = q.x, y = q.y, z = q.z, w = q.w;
  return mat3(1.0 - 2.0*(y*y + z*z), 2.0*(x*y + z*w), 2.0*(x*z - y*w),
              2.0*(x*y - z*w), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z + x*w),
              2.0*(x*z + y*w), 2.0*(y*z - x*w), 1.0 - 2.0*(x*x + y*y));
}
mat3 axisAngle(vec3 a, float ang){
  float c = cos(ang), s = sin(ang), t = 1.0 - c;
  return mat3(t*a.x*a.x + c, t*a.x*a.y + s*a.z, t*a.x*a.z - s*a.y,
              t*a.x*a.y - s*a.z, t*a.y*a.y + c, t*a.y*a.z + s*a.x,
              t*a.x*a.z + s*a.y, t*a.y*a.z - s*a.x, t*a.z*a.z + c);
}

void main(){
  if(iDyn.z <= 0.001){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }
  vec4 mv = viewMatrix * vec4(position, 1.0);
  float z = -mv.z;
  if(z < 0.25){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }
  vC = mv.xyz;
  float s = iInfo.y * iDyn.z;
  mat3 Rw = axisAngle(iAxis, iDyn.x) * quatMat(iQuat);
  vM = transpose(mat3(viewMatrix) * Rw);
  float k = uP11 * uViewH * 0.5 / z;
  float ext = iInfo.x > 4.5 && iInfo.x < 5.5 ? 1.3 : 0.95;
  float halfPx = s * ext * k + 1.0;
  gl_PointSize = clamp(2.0 * halfPx, 1.0, 640.0);
  vHalf = gl_PointSize * 0.5 / k;
  gl_Position = projectionMatrix * mv;
  vInfo = vec4(iInfo.x, s, iInfo.z, iInfo.w);
  vE = iDyn.yw;
}
`;

export const partFrag = /* glsl */ `
uniform vec3 uUpV;
uniform vec3 uSunV;
uniform vec3 uSunCol;
uniform vec3 uZen;
uniform vec3 uHor;
uniform vec3 uSphV;
uniform vec3 uLightCol;
uniform vec3 uEmisCol;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uDropGlow;
uniform float uEnv;
uniform vec3 uFogCol;
uniform float uFogD;
flat varying mat3 vM;
flat varying vec3 vC;
flat varying float vHalf;
flat varying vec4 vInfo;
flat varying vec2 vE;

float tN, tF; vec3 nN;
void slab(vec3 n, float e, vec3 ro, vec3 rd){
  float dn = dot(rd, n), on = dot(ro, n);
  if(abs(dn) < 1e-7){ if(abs(on) > e) tN = 1e9; return; }
  float t1 = (-e - on) / dn, t2 = (e - on) / dn;
  float ta = min(t1, t2), tb = max(t1, t2);
  if(ta > tN){ tN = ta; nN = n * -sign(dn); }
  tF = min(tF, tb);
}
void hsp(vec3 n, float e, vec3 ro, vec3 rd){
  float dn = dot(rd, n), on = dot(ro, n);
  if(abs(dn) < 1e-7){ if(on > e) tN = 1e9; return; }
  float t = (e - on) / dn;
  if(dn < 0.0){ if(t > tN){ tN = t; nN = n; } }
  else tF = min(tF, t);
}
vec3 bevel(vec3 hp, vec3 e, float b, vec3 nf){
  vec3 q = abs(hp) - (e - b);
  if(max(q.x, max(q.y, q.z)) <= 0.0) return nf;
  return normalize(sign(hp) * max(q, 0.0));
}

void main(){
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  pc.y = -pc.y;
  vec3 ps = vC + vec3(pc * vHalf, 0.0);
  vec3 rd = normalize(ps);
  vec3 ro = vM * (-vC);
  vec3 rl = vM * rd;
  float a = vInfo.y * 0.5;
  int shape = int(vInfo.x + 0.5);
  tN = -1e9; tF = 1e9; nN = vec3(0.0, 0.0, 1.0);
  vec3 V = -normalize(vC);
  vec3 n;
  if(shape == 6){
    // liquid droplet: glossy glowing bead
    float b = dot(ro, rl);
    float h = b * b - dot(ro, ro) + a * a;
    if(h < 0.0) discard;
    vec3 hp = ro + rl * (-b - sqrt(h));
    n = normalize(transpose(vM) * (hp / a));
    float ndv = max(dot(n, V), 0.0);
    float F = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);
    int hi = int(vInfo.w - 2.0 + 0.5);
    vec3 hue = hi == 0 ? uC1 : (hi == 1 ? uC2 : uC3);
    vec3 col = hue * (0.35 + 0.65 * pow(ndv, 0.7)) * uDropGlow * (0.6 + vE.x);
    vec3 r = reflect(-V, n);
    col = mix(col, mix(uHor, uZen, r.y * 0.5 + 0.5) * 1.1, F * 0.7);
    col += uSunCol * pow(max(dot(r, uSunV), 0.0), 60.0) * 2.0 + pow(max(dot(r, normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 80.0) * 1.5 * (0.4 + uEnv);
    float fog = 1.0 - exp(-length(vC) * uFogD);
    gl_FragColor = vec4(mix(col, uFogCol, fog), 1.0);
    return;
  }
  if(shape == 0){            // bevelled cube
    slab(vec3(1,0,0), a, ro, rl); slab(vec3(0,1,0), a, ro, rl); slab(vec3(0,0,1), a, ro, rl);
  } else if(shape == 1){     // square tile
    slab(vec3(1,0,0), a, ro, rl); slab(vec3(0,1,0), a, ro, rl); slab(vec3(0,0,1), a * 0.22, ro, rl);
  } else if(shape == 2){     // tetrahedron
    float e = a * 0.75;
    hsp(normalize(vec3(-1,-1,-1)), e, ro, rl); hsp(normalize(vec3(-1,1,1)), e, ro, rl);
    hsp(normalize(vec3(1,-1,1)), e, ro, rl);   hsp(normalize(vec3(1,1,-1)), e, ro, rl);
  } else if(shape == 3){     // octahedron
    float e = a * 0.82;
    slab(normalize(vec3(1,1,1)), e, ro, rl); slab(normalize(vec3(1,1,-1)), e, ro, rl);
    slab(normalize(vec3(1,-1,1)), e, ro, rl); slab(normalize(vec3(-1,1,1)), e, ro, rl);
  } else if(shape == 4){     // triangle tile
    float e = a * 0.55;
    hsp(vec3(0,1,0), e, ro, rl); hsp(vec3(-0.8660254,-0.5,0), e, ro, rl); hsp(vec3(0.8660254,-0.5,0), e, ro, rl);
    slab(vec3(0,0,1), a * 0.2, ro, rl);
  } else {                   // shard
    slab(vec3(1,0,0), a * 0.36, ro, rl); slab(vec3(0,1,0), a * 1.25, ro, rl); slab(vec3(0,0,1), a * 0.24, ro, rl);
  }
  if(tN > tF || tF < 0.0) discard;
  vec3 hp = ro + rl * tN;
  vec3 nl = nN;
  if(shape == 0) nl = bevel(hp, vec3(a), a * 0.32, nN);
  else if(shape == 1) nl = bevel(hp, vec3(a, a, a * 0.22), a * 0.2, nN);
  else if(shape == 5) nl = bevel(hp, vec3(a * 0.36, a * 1.25, a * 0.24), a * 0.15, nN);
  n = normalize(transpose(vM) * nl);
  if(dot(n, rd) > 0.0) n = -n;

  float alb = vInfo.w;
  float up = dot(n, uUpV);
  // matte ceramic: sky dome + soft front fill + backlight + sphere light
  vec3 col = mix(uHor * 0.22, 0.42 * (uZen + uHor), up * 0.5 + 0.5) + uHor * 0.1 * (1.0 - abs(up));
  float key = max(dot(n, normalize(vec3(-0.5, 0.55, 0.68))), 0.0);
  col += uHor * 0.95 * key * key;
  col += uSunCol * 0.8 * max(dot(n, uSunV), 0.0);
  vec3 L = uSphV - vC;
  float dl = length(L);
  L /= dl;
  float att = 1.0 / (1.0 + 0.30 * dl * dl);
  col += uLightCol * 9.0 * (max(dot(n, L), 0.0) * 0.8 + 0.2) * vE.y * att;
  col *= alb;
  float ndv = max(dot(n, V), 0.0);
  col += uSunCol * pow(1.0 - ndv, 4.0) * 0.35 * max(dot(-V, uSunV) * 0.5 + 0.5, 0.0);
  vec3 H = normalize(uSunV + V);
  col += uSunCol * 0.18 * pow(max(dot(n, H), 0.0), 40.0);
  vec3 H2 = normalize(L + V);
  col += uLightCol * 9.0 * vE.y * att * 0.5 * pow(max(dot(n, H2), 0.0), 30.0);
  col += vE.x * uEmisCol;
  float fog = 1.0 - exp(-length(vC) * uFogD);
  col = mix(col, uFogCol, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Depth of field (half-res gather) and its full-res recombination.
// ---------------------------------------------------------------------------
const DOF_COMMON = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAper;
uniform float uMaxCoc;
varying vec2 vUv;
float linZ(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float coc(float z){ return clamp(uAper * abs(1.0 - uFocus / z), 0.0, uMaxCoc); }
`;

export const dofFrag = /* glsl */ `
${DOF_COMMON}
void main(){
  float zc = linZ(texture2D(tDepth, vUv).r);
  float cc = coc(zc);
  vec3 col = texture2D(tColor, vUv).rgb;
  float tot = 1.0;
  float ang = 0.0;
  for(int i = 0; i < 44; i++){
    float rr = uMaxCoc * sqrt((float(i) + 0.5) / 44.0);
    ang += 2.39996323;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * rr * uTexel;
    vec3 sc = texture2D(tColor, tc).rgb;
    float zs = linZ(texture2D(tDepth, tc).r);
    float cs = coc(zs);
    if(zs > zc) cs = clamp(cs, 0.0, cc * 2.0);
    float m = smoothstep(rr - 1.5, rr + 1.5, cs);
    col += mix(col / tot, sc, m);
    tot += 1.0;
  }
  gl_FragColor = vec4(col / tot, cc);
}
`;

export const dofCombineFrag = /* glsl */ `
${DOF_COMMON}
uniform sampler2D tBlur;
void main(){
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec3 blur = texture2D(tBlur, vUv).rgb;
  float c = coc(linZ(texture2D(tDepth, vUv).r));
  gl_FragColor = vec4(mix(sharp, blur, smoothstep(0.7, 2.6, c)), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Final grade: shockwave refraction, chromatic aberration, filmic tone map,
// vignette, flash, fade, grain, and the 1.5x supersample resolve.
// ---------------------------------------------------------------------------
export const gradeFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uSrcRes;
uniform float uExposure;
uniform float uFlash;
uniform float uFade;
uniform float uVig;
uniform float uCA;
uniform float uGrain;
uniform float uTime;
uniform vec4 uShock;
uniform vec3 uTint;
uniform float uContrast;
varying vec2 vUv;

vec3 samp(vec2 uv){
  vec2 px = 1.0 / uSrcRes;
  return 0.25 * (texture2D(tDiffuse, uv + px * vec2(-0.5, -0.5)).rgb + texture2D(tDiffuse, uv + px * vec2(0.5, -0.5)).rgb +
                 texture2D(tDiffuse, uv + px * vec2(-0.5, 0.5)).rgb + texture2D(tDiffuse, uv + px * vec2(0.5, 0.5)).rgb);
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main(){
  vec2 uv = vUv;
  vec2 d = uv - uShock.xy;
  d.x *= 16.0 / 9.0;
  float r = length(d);
  float ring = exp(-pow((r - uShock.z) / (0.035 + 0.06 * uShock.z), 2.0)) * uShock.w;
  uv -= (d / (r + 1e-4)) * vec2(9.0 / 16.0, 1.0) * ring * 0.03;
  vec2 cd = uv - 0.5;
  float ca = uCA * (0.3 + dot(cd, cd) * 3.0);
  vec3 col = vec3(samp(uv + cd * ca).r, samp(uv).g, samp(uv - cd * ca).b);
  col *= uExposure;
  col += uFlash + ring * 0.6;
  col = aces(col);
  col *= uTint;
  float vig = smoothstep(1.15, 0.2, length(cd * vec2(1.0, 0.82)) * 1.35);
  col *= mix(1.0, vig, uVig);
  col = toSRGB(clamp(col, 0.0, 1.0));
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
  col = mix(col, vec3(1.0), uFade);
  float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`;
