'use strict';
// ─────────────────────────────────────────────────────────────
//  Engine — WebGL2 HDR pipeline + Canvas2D overlay layers + post FX
//  Everything is a pure function of time, so every frame is deterministic.
// ─────────────────────────────────────────────────────────────
const Q = new URLSearchParams(location.search);
const SCALE = parseFloat(Q.get('scale') || '1');
const W = Math.round(1920 * SCALE), H = Math.round(1080 * SCALE);

const glc = document.getElementById('gl');
glc.width = W; glc.height = H;
const gl = glc.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
if (!gl) throw new Error('WebGL2 unavailable');
gl.getExtension('EXT_color_buffer_float');
gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');

// ── GLSL ─────────────────────────────────────────────────────
const VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;

const GLSL_HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uRes; uniform float uT; uniform float uG;
#define PI 3.14159265359
#define TAU 6.28318530718
// THE palette — a white world. Achromatic greys + ONE accent (red), nothing else exists.
const vec3 IVORY=vec3(0.970,0.968,0.960), INK=vec3(0.045,0.045,0.050), RED=vec3(0.90,0.17,0.13);
const vec3 GOLD=vec3(0.50), GOLD2=vec3(0.62), CYAN=vec3(0.50), TEAL=CYAN, MAG=RED, BLUE=INK, CREAM=IVORY;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
vec3 hash32(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yzz)*p3.zyx);}
float hash31(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
vec3 pal(float t,vec3 a,vec3 b,vec3 c,vec3 d){return a+b*cos(TAU*(c*t+d));}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float sdBox2(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
// deep-space void with drifting dust; uv 0..1
vec3 bgVoid(vec2 uv,float t,vec3 tint,float dustAmt){
  vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  float r=length(p);
  vec3 c=mix(vec3(.012,.017,.046),vec3(.002,.003,.010),smoothstep(0.,.95,r));
  float n=fbm(p*1.7+vec2(t*.02,-t*.015));
  c+=tint*.06*n*n*(1.-r*.9);
  for(int l=0;l<3;l++){
    float sc=16.+float(l)*11.;
    vec2 q=p*sc+vec2(t*.22*float(l+1),t*.06+float(l)*7.3);
    vec2 id=floor(q), f=fract(q)-.5, h=hash22(id);
    float dd=length(f-(h-.5)*.72);
    float tw=.55+.45*sin(t*(1.+h.x*3.)+h.y*20.);
    c+=tint*smoothstep(.07,.0,dd)*tw*(.5/float(l+1))*step(.62,h.x)*dustAmt;
  }
  return c;
}
`;

// ── program / target plumbing ────────────────────────────────
const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO);
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

function compile(type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(`[${label}] shader error:\n${log}\n${lines.split('\n').slice(0, 400).join('\n')}`);
    throw new Error(`Shader compile failed: ${label}\n${log}`);
  }
  return s;
}
function makeProgram(vsSrc, fsSrc, label) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc, label + '.vs'));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc, label + '.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed ' + label + ': ' + gl.getProgramInfoLog(p));
  return { p, loc: {}, label };
}
const frag = (src, label = 'frag') => makeProgram(VS, GLSL_HEAD + src, label);
function uloc(prog, name) {
  if (!(name in prog.loc)) prog.loc[name] = gl.getUniformLocation(prog.p, name);
  return prog.loc[name];
}
function setUniforms(prog, u) {
  let unit = 0;
  for (const k in u) {
    const v = u[k], loc = uloc(prog, k);
    if (loc == null) { if (v && v.tex) unit++; continue; }
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (typeof v === 'boolean') gl.uniform1f(loc, v ? 1 : 0);
    else if (Array.isArray(v) || v instanceof Float32Array) {
      switch (v.length) {
        case 2: gl.uniform2fv(loc, v); break;
        case 3: gl.uniform3fv(loc, v); break;
        case 4: gl.uniform4fv(loc, v); break;
        case 9: gl.uniformMatrix3fv(loc, false, v); break;
        case 16: gl.uniformMatrix4fv(loc, false, v); break;
        default: gl.uniform1fv(loc, v);
      }
    } else if (v && v.tex) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex);
      gl.uniform1i(loc, unit++);
    } else if (v && v.int != null) gl.uniform1i(loc, v.int);
    else if (v && v.v4) gl.uniform4fv(loc, v.v4);
    else if (v && v.v3) gl.uniform3fv(loc, v.v3);
  }
}
function makeTarget(w, h, depth = false) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (depth) {
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  }
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}
function bindTarget(t) {
  if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.w, t.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
}
let G_TIME = 0;
function run(prog, target, uniforms = {}) {
  gl.useProgram(prog.p);
  bindTarget(target);
  const w = target ? target.w : W, h = target ? target.h : H;
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  setUniforms(prog, { uRes: [w, h], uG: G_TIME, ...uniforms });
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function runBlend(prog, target, uniforms = {}) {
  gl.useProgram(prog.p);
  bindTarget(target);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  setUniforms(prog, { uRes: [target.w, target.h], uG: G_TIME, ...uniforms });
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.disable(gl.BLEND);
}
function clearTarget(t, r = 0, g = 0, b = 0, a = 1) {
  bindTarget(t); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

// ── overlay layers (Canvas2D → texture) ──────────────────────
function makeLayer(additive = false) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { alpha: true });
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const L = {
    c, x, tex, additive, used: false,
    begin() {
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none';
      x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0;
      x.clearRect(0, 0, W, H); x.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      if (additive) x.globalCompositeOperation = 'lighter';
      this.used = false;
    },
    ctx() { this.used = true; return x; },
    upload() {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    },
  };
  return L;
}
// a blank 1×1 transparent texture for unused layers
const BLANK = (() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return { tex: t }; })();

// ── shared passes ────────────────────────────────────────────
const P = {};
P.compose = frag(`
uniform sampler2D uScene, uOver, uAdd;
float lum(vec3 c){ c=min(c,vec3(2.)); return dot(c,vec3(.299,.587,.114)); }
vec3 fxaa(sampler2D tex, vec2 uv, vec2 px){
  vec3 nw=texture(tex,uv+vec2(-1.,-1.)*px).rgb, ne=texture(tex,uv+vec2(1.,-1.)*px).rgb;
  vec3 sw=texture(tex,uv+vec2(-1.,1.)*px).rgb,  se=texture(tex,uv+vec2(1.,1.)*px).rgb;
  vec3 m=texture(tex,uv).rgb;
  float lnw=lum(nw),lne=lum(ne),lsw=lum(sw),lse=lum(se),lm=lum(m);
  float lmin=min(lm,min(min(lnw,lne),min(lsw,lse))), lmax=max(lm,max(max(lnw,lne),max(lsw,lse)));
  if(lmax-lmin<max(.03,lmax*.10)) return m;                     // flat area: leave untouched
  vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),((lnw+lsw)-(lne+lse)));
  float red=max((lnw+lne+lsw+lse)*.03125,1./128.);
  float rcp=1./(min(abs(dir.x),abs(dir.y))+red);
  dir=clamp(dir*rcp,vec2(-6.),vec2(6.))*px;
  vec3 a=.5*(texture(tex,uv+dir*(1./3.-.5)).rgb+texture(tex,uv+dir*(2./3.-.5)).rgb);
  vec3 b=a*.5+.25*(texture(tex,uv+dir*-.5).rgb+texture(tex,uv+dir*.5).rgb);
  float lb=lum(b);
  return (lb<lmin||lb>lmax)?a:b;
}
void main(){
  vec3 s=fxaa(uScene,vUv,1./uRes); vec4 o=texture(uOver,vUv); vec3 a=texture(uAdd,vUv).rgb;
  fragColor=vec4(o.rgb + s*(1.-o.a) + a,1.);
}`, 'compose');

P.mix = frag(`
uniform sampler2D uA, uB; uniform float uP; uniform int uType;
vec3 tex2(sampler2D s, vec2 uv){ return texture(s, clamp(uv,0.,1.)).rgb; }
void main(){
  vec2 uv=vUv; vec3 col;
  float p=uP;
  if(uType==0){ col=mix(tex2(uA,uv),tex2(uB,uv),smoothstep(0.,1.,p)); }
  else if(uType==1){ // whip pan: both slide left with heavy directional blur
    float e=p*p*(3.-2.*p); vec3 c=vec3(0.);
    float bl=sin(p*PI)*.18;
    for(int i=0;i<24;i++){
      float s=(float(i)/23.-.5)*bl;
      vec2 ua=uv+vec2(e+s,0.), ub=uv+vec2(e-1.+s,0.);
      vec3 ca=(ua.x<1.)?tex2(uA,ua):vec3(0.); vec3 cb=(ub.x>=0.)?tex2(uB,ub):vec3(0.);
      c+= (ua.x<1.)?ca:cb;
    }
    col=c/24.;
  } else if(uType==2){ // zoom-through
    vec2 c0=uv-.5; float k=p*p;
    vec3 a=tex2(uA,.5+c0/(1.+k*3.)), b=tex2(uB,.5+c0*(1.+(1.-p)*(1.-p)*2.5)/1.);
    col=mix(a,b,smoothstep(.35,.65,p));
  } else if(uType==3){ // glitch slices
    float row=floor(uv.y*28.); float h=hash21(vec2(row,floor(p*9.)));
    float sel=step(h,p*1.15);
    vec2 uo=uv+vec2((h-.5)*.12*sin(p*PI),0.);
    col=mix(tex2(uA,uo),tex2(uB,uo),sel);
  } else { col = p<.5?tex2(uA,uv):tex2(uB,uv); }
  fragColor=vec4(col,1.);
}`, 'mix');

// bloom
P.bloomDown = frag(`
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst; uniform float uThresh;
vec3 S(vec2 uv){ return texture(uTex,uv).rgb; }
void main(){
  vec2 t=uTexel; vec2 uv=vUv;
  vec3 a=S(uv+t*vec2(-2,-2)),b=S(uv+t*vec2(0,-2)),c=S(uv+t*vec2(2,-2));
  vec3 d=S(uv+t*vec2(-2,0)),e=S(uv),f=S(uv+t*vec2(2,0));
  vec3 g=S(uv+t*vec2(-2,2)),h=S(uv+t*vec2(0,2)),i=S(uv+t*vec2(2,2));
  vec3 j=S(uv+t*vec2(-1,-1)),k=S(uv+t*vec2(1,-1)),l=S(uv+t*vec2(-1,1)),m=S(uv+t*vec2(1,1));
  vec3 col=e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;
  if(uFirst>.5){ float br=max(col.r,max(col.g,col.b)); float soft=clamp(br-uThresh+.35,0.,.7); soft=soft*soft/(2.8); float w=max(soft,br-uThresh)/max(br,1e-4); col*=max(w,0.); }
  fragColor=vec4(col,1.);
}`, 'bloomDown');
P.bloomUp = frag(`
uniform sampler2D uTex, uPrev; uniform vec2 uTexel; uniform float uW;
void main(){
  vec2 t=uTexel; vec2 uv=vUv;
  vec3 c=texture(uTex,uv+t*vec2(-1,-1)).rgb+texture(uTex,uv+t*vec2(0,-1)).rgb*2.+texture(uTex,uv+t*vec2(1,-1)).rgb
        +texture(uTex,uv+t*vec2(-1,0)).rgb*2.+texture(uTex,uv).rgb*4.+texture(uTex,uv+t*vec2(1,0)).rgb*2.
        +texture(uTex,uv+t*vec2(-1,1)).rgb+texture(uTex,uv+t*vec2(0,1)).rgb*2.+texture(uTex,uv+t*vec2(1,1)).rgb;
  fragColor=vec4(c/16.*uW+texture(uPrev,uv).rgb,1.);
}`, 'bloomUp');

// final composite / post
P.final = frag(`
uniform sampler2D uMain, uBloom, uStreak, uHud;
uniform float uBloomAmt, uStreakAmt, uCA, uGlitch, uFlash, uFade, uGrain, uVig, uZoomBlur, uWhip, uExposure, uSat, uLens;
uniform vec2 uShake, uZoomC; uniform vec3 uFlashCol, uTint, uLift;
vec3 samp(vec2 uv){ return texture(uMain, uv).rgb; }
vec3 tone(vec3 c){ // soft shoulder above .9, identity below
  vec3 over=max(c-.9,0.); return min(c,vec3(.9))+.1*(1.-exp(-over/.1)); }
void main(){
  vec2 uv=vUv+uShake;
  // lens barrel
  vec2 cc=uv-.5; float r2=dot(cc*vec2(uRes.x/uRes.y,1.),cc*vec2(uRes.x/uRes.y,1.)); uv=.5+cc*(1.+uLens*r2);
  // glitch slices
  if(uGlitch>.001){
    float tt=floor(uG*30.);
    float row=floor(uv.y*36.); float h=hash21(vec2(row,tt));
    if(h<uGlitch*.55) uv.x+=(hash21(vec2(row+9.,tt))-.5)*.18*uGlitch;
    float row2=floor(uv.y*7.); if(hash21(vec2(row2,tt+3.))<uGlitch*.3) uv.x+=(hash21(vec2(row2,tt+5.))-.5)*.35*uGlitch;
  }
  vec2 dirc=(uv-.5)*vec2(1.,1.);
  vec3 col=vec3(0.);
  int N=1; if(uZoomBlur>.001||uWhip>.001) N=14;
  for(int i=0;i<14;i++){
    if(i>=N) break;
    float s=(N>1)?float(i)/float(N-1):0.;
    vec2 u2=uv;
    if(uZoomBlur>.001) u2=uZoomC+(u2-uZoomC)*(1.-uZoomBlur*s);
    if(uWhip>.001) u2.x+=(s-.5)*uWhip;
    vec2 ca=(u2-.5)*uCA;
    col+=vec3(samp(u2+ca).r, samp(u2).g, samp(u2-ca).b);
  }
  col/=float(N);
  vec3 bl=texture(uBloom,uv).rgb;
  // horizontal anamorphic streak (from a low-res bloom level)
  vec3 st=vec3(0.);
  if(uStreakAmt>.001){
    for(int i=-10;i<=10;i++){ float w=exp(-float(i*i)/40.); st+=texture(uStreak,uv+vec2(float(i)*.0125,0.)).rgb*w; }
    st/=8.;
  }
  col+=bl*uBloomAmt+st*uStreakAmt*vec3(.6,.8,1.);
  col*=uExposure;
  col=tone(col);
  float l=dot(col,vec3(.299,.587,.114)); col=mix(vec3(l),col,uSat);
  col=col*uTint+uLift*(1.-col);
  // vignette
  vec2 vv=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
  col*=1.-uVig*smoothstep(.35,1.15,length(vv));
  // grain + dither
  float g=hash21(vUv*uRes+fract(uG*7.13)*173.)-.5;
  col+=g*uGrain*(.4+.6*(1.-l))+ (hash21(vUv*uRes*1.7+9.)-.5)/255.;
  col=mix(col,uFlashCol,clamp(uFlash,0.,1.));
  col*=1.-clamp(uFade,0.,1.);
  vec4 h=texture(uHud,vUv);
  col=h.rgb+col*(1.-h.a);
  fragColor=vec4(clamp(col,0.,1.),1.);
}`, 'final');

// ── resources ────────────────────────────────────────────────
const T = {
  scene: [makeTarget(W, H, true), makeTarget(W, H, true)],
  comp: [makeTarget(W, H), makeTarget(W, H)],
  mix: makeTarget(W, H),
  down: [], up: [],
};
for (let i = 0, w = W, h = H; i < 6; i++) {
  w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
  T.down.push(makeTarget(w, h)); T.up.push(makeTarget(w, h));
}
const TMP_DEPTH = makeTarget(W, H, true);
const LAY = { over: [makeLayer(), makeLayer()], add: [makeLayer(true), makeLayer(true)], hud: makeLayer() };

function bloomChain(src, thresh) {
  let prev = src;
  for (let i = 0; i < T.down.length; i++) {
    const d = T.down[i];
    run(P.bloomDown, d, { uTex: prev, uTexel: [1 / prev.w, 1 / prev.h], uFirst: i === 0 ? 1 : 0, uThresh: thresh });
    prev = d;
  }
  // upsample
  const n = T.down.length;
  run(P.bloomUp, T.up[n - 1], { uTex: T.down[n - 1], uPrev: BLANK, uTexel: [1 / T.down[n - 1].w, 1 / T.down[n - 1].h], uW: 1 });
  for (let i = n - 2; i >= 0; i--) {
    run(P.bloomUp, T.up[i], { uTex: T.up[i + 1], uPrev: T.down[i], uTexel: [1 / T.up[i + 1].w, 1 / T.up[i + 1].h], uW: 0.85 });
  }
  return T.up[0];
}

// ── scene registry & frame loop ──────────────────────────────
const SCENES = [];
function registerScene(idx, def) {
  const ch = TL.chapters[idx];
  SCENES[idx] = Object.assign({ idx, t0: ch.t0, t1: ch.t1, dur: ch.t1 - ch.t0, trans: null }, def);
}
function defaultFX() {
  return { bloom: 0.6, thresh: 0.62, streak: 0, ca: 0.0018, glitch: 0, flash: 0, flashCol: [1, 1, 1], fade: 0, grain: 0.028,
    vig: 0.32, crisp: [], zoomBlur: 0, zoomC: [.5, .5], whip: 0, exposure: 1, sat: 1.0, lens: 0, shake: [0, 0], tint: [1, 1, 1], lift: [0, 0, 0] };
}
function impactFX(fx, t) {
  for (const im of TL.impacts) {
    const d = t - im.t;
    if (d < 0 || d > 1.2) continue;
    const a = im.a;
    fx.ca += a * 0.016 * Math.exp(-d / 0.16);
    fx.flash = Math.max(fx.flash, a > 0.6 ? a * 0.40 * Math.exp(-d / 0.06) : 0);
    fx.zoomBlur += a * 0.05 * Math.exp(-d / 0.12);
    const s = a * 0.012 * Math.exp(-d / 0.14);
    fx.shake[0] += s * Math.sin(d * 90 + im.t * 13); fx.shake[1] += s * Math.cos(d * 77 + im.t * 7);
    fx.bloom += a * 0.5 * Math.exp(-d / 0.2);
  }
}

function sceneWindow(s) {
  const nxt = SCENES[s.idx + 1];
  const w0 = s.t0 - (s.trans ? s.trans.dur / 2 : 0);
  const w1 = s.t1 + (nxt && nxt.trans ? nxt.trans.dur / 2 : 0);
  return [w0, w1];
}

function renderScene(s, t, slot, fx) {
  const ov = LAY.over[slot], ad = LAY.add[slot];
  const tgt = T.scene[slot];
  clearTarget(tgt);
  ov.begin(); ad.begin();
  const ctx = {
    t, lt: t - s.t0, dur: s.dur, tgt, fx, slot, s,
    get o() { return ov.ctx(); }, get a() { return ad.ctx(); },
    run, clear: (r, g, b) => clearTarget(tgt, r, g, b),
  };
  s.render(ctx);
  const uO = ov.used, uA = ad.used;
  if (uO) ov.upload(); if (uA) ad.upload();
  run(P.compose, T.comp[slot], { uScene: tgt, uOver: uO ? ov : BLANK, uAdd: uA ? ad : BLANK });
  return T.comp[slot];
}

let LAST_FX = null;
function renderAt(t) {
  G_TIME = t;
  t = Math.min(Math.max(t, 0), TL.DUR - 1e-4);
  const fx = defaultFX();
  impactFX(fx, t);
  const act = SCENES.filter(s => { const [a, b] = sceneWindow(s); return t >= a && t < b; });
  let main;
  if (act.length === 0) { clearTarget(T.comp[0]); main = T.comp[0]; }
  else if (act.length === 1) main = renderScene(act[0], t, 0, fx);
  else {
    const A = act[0], B = act[1];
    const oa = renderScene(A, t, 0, fx), ob = renderScene(B, t, 1, fx);
    const tr = B.trans;
    const p = clamp((t - (B.t0 - tr.dur / 2)) / tr.dur);
    run(P.mix, T.mix, { uA: oa, uB: ob, uP: p, uType: { int: tr.type ?? 0 } });
    main = T.mix;
    if (tr.fx) tr.fx(fx, p, t);
  }
  const bl = bloomChain(main, fx.thresh);
  // HUD
  LAY.hud.begin();
  const hudUsed = fx.crisp.length > 0;
  if (hudUsed) { for (const fn of fx.crisp) fn(LAY.hud.ctx()); LAY.hud.upload(); }
  LAST_FX = fx;
  run(P.final, null, {
    uMain: main, uBloom: bl, uStreak: T.up[2], uHud: hudUsed ? LAY.hud : BLANK,
    uBloomAmt: fx.bloom, uStreakAmt: fx.streak, uCA: fx.ca, uGlitch: fx.glitch, uFlash: fx.flash, uFlashCol: fx.flashCol,
    uFade: fx.fade, uGrain: fx.grain, uVig: fx.vig, uZoomBlur: fx.zoomBlur, uZoomC: fx.zoomC, uWhip: fx.whip,
    uExposure: fx.exposure, uSat: fx.sat, uLens: fx.lens, uShake: fx.shake, uTint: fx.tint, uLift: fx.lift,
  });
}

window.renderFrame = (f) => { renderAt(f / TL.FPS); return true; };
window.renderTime = (t) => { renderAt(t); return true; };
window.grab = (q = 0.96) => glc.toDataURL('image/jpeg', q);
window.grabPNG = () => glc.toDataURL('image/png');
