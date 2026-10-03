'use strict';
// ══════════════════════════════════════════════════════════════
//  World renderer — one visual language: a seamless grey-white studio and CUBES.
//  · sky + floor : analytic full-screen pass (soft gradient void, bright horizon seam,
//                  glossy floor etched with fine contour lines that "draw themselves")
//  · shadows     : every cube drops a soft gaussian blob into a top-down map (contact shadow / AO)
//  · cubes       : pass 1 evaluates each cube's motion once into float textures (MRT),
//                  pass 2 draws one point per cube and ray-casts the box in the fragment shader
//  · materials   : cls 0 white ceramic → 1 graphite (continuous) · 2 chrome · 3 white spark · 4 cold-blue spark
//  · palette     : achromatic greys. nothing else exists (one cold-blue glint, like an eye).
// ══════════════════════════════════════════════════════════════
const World = (() => {
  // ── one sky for floor, fog and reflections ──
  const SKY_FN = (name, full = false) => `
const vec3 PURP=vec3(.40,.05,1.), REDC=vec3(1.,.06,.12);
uniform float uMood, uTilt, uSeam, uSplit, uSplitD, uSplitX;
vec3 ${name}(vec3 rd){
  float h=rd.y, up=clamp(h,0.,1.);
  float md=clamp(uMood+uSplit*smoothstep(-.10,.10,rd.x-uSplitD),0.,1.);
  float lat=clamp(rd.x,-1.,1.);
  float lg=mix(.962,.585,pow(up,.55));
  lg*=1.-uTilt*.26*smoothstep(-.35,.85,lat);
  vec3 light=vec3(lg)*vec3(.992,1.,1.012);
  float side=smoothstep(-.45,.45,rd.x);
  vec3 pc=mix(PURP,REDC,side);
  vec3 sp=vec3(.003,.0025,.007)+pc*.045*exp(-abs(h)*5.)+pc*.016*up;
  ${full ? `if(md>.01){
    float n1=fbm3(rd*2.1+vec3(3.,1.,7.)), n2=fbm3(rd*3.6+vec3(9.,4.,2.));
    float hh=smoothstep(-.15,.55,h);
    sp+=pc*pow(max(n1-.40,0.),1.5)*4.6*hh+mix(REDC,PURP,side)*pow(max(n2-.47,0.),1.6)*2.6*hh;
    vec2 q=vec2(atan(rd.z,rd.x)*55.,asin(clamp(rd.y,-1.,1.))*110.);
    vec2 id=floor(q), f=fract(q)-.5; float hs=hash21(id);
    float st=step(.972,hs)*smoothstep(.22,0.,length(f-(hash22(id)-.5)*.5));
    sp+=vec3(.9,.85,1.)*st*(.3+hs*3.)*(.65+.35*sin(uG*3.+hs*40.))*smoothstep(-.02,.2,h);
  }` : ''}
  float seam=exp(-abs(h)*mix(55.,150.,md));
  vec3 c=mix(light,sp,md);
  c+=mix(vec3(seam*uSeam*.04),pc*seam*uSeam*1.25+vec3(seam*uSeam*.22),md);
  return c;
}`;

  // ── floor + sky pass ───────────────────────────────────────
  const floorProg = frag(`float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*noise3(p);p=p*2.07+vec3(1.3,2.7,.9);a*=.5;}return s;}
` + SKY_FN('SKY', true) + `
uniform vec3 uCamPos,uFwd,uRight,uUp; uniform float uTanF,uAsp,uY; uniform mat4 uVP;
uniform float uReveal,uLines,uFogD,uPulseR,uPulseA,uMirrorOn,uShK,uFloorDark,uDim;
uniform vec3 uRingC; uniform vec2 uFieldOff; uniform sampler2D uShadow; uniform vec3 uShC;
void main(){
  vec2 px=vUv*2.-1.;
  vec3 rd=normalize(uFwd+uRight*px.x*uTanF*uAsp+uUp*px.y*uTanF);
  float t=(uY-uCamPos.y)/rd.y;
  if(rd.y>-1e-4||t<0.){ fragColor=vec4(SKY(rd)*uDim,1.); gl_FragDepth=1.; return; }
  vec3 p=uCamPos+rd*t;
  float mf=clamp(uMood+uSplit*smoothstep(-2.,2.,p.x-uSplitX),0.,1.);
  vec3 base=vec3(mix(.905,.020,mf))*(1.-uFloorDark);
  vec3 rr=reflect(rd,vec3(0.,1.,0.));
  float fres=.04+.96*pow(1.-clamp(-rd.y,0.,1.),5.);
  vec3 col=base+SKY(rr)*fres;
  // contact shadows from every cube
  vec2 suv=(p.xz-uShC.xy)/uShC.z*.5+.5;
  float sh=(suv.x>0.&&suv.x<1.&&suv.y>0.&&suv.y<1.)?texture(uShadow,suv).r:0.;
  col*=1.-uShK*(1.-exp(-sh));
  // contour lines of a gentle height field — drawn outward from the centre
  float r0=length(p.xz-uRingC.xz);
  float Hf=fbm(p.xz*.09+uFieldOff)*5.+r0*.35;
  float f=Hf*1.6, fw=fwidth(f)+1e-5;
  float dn=abs(fract(f+.5)-.5);
  float ln=(1.-smoothstep(0.,fw*1.5,dn))*clamp(1.-fw*2.4,0.,1.);
  float rv=smoothstep(uReveal,uReveal-2.5,r0)*step(.001,uReveal);
  float lead=exp(-pow((r0-uReveal)*.8,2.))*step(.001,uReveal)*step(.1,uReveal);
  float far=exp(-t*uFogD*.55);
  vec3 neon=mix(PURP,REDC,smoothstep(-4.,4.,p.x))*1.05;
  vec3 lc=mix(vec3(.06),neon,mf);
  col=mix(col,lc,clamp(ln*rv*uLines*mix(.34,.55,mf)*far,0.,1.));
  col+=lead*uLines*mix(vec3(0.),neon*.55,mf)*far;
  col=mix(col,lc,clamp(exp(-pow((r0-uPulseR)*1.5,2.))*uPulseA,0.,1.)*mix(.55,1.,mf));
  // faint fabric grain
  col*=1.+(vnoise(vec2(p.x*160.,p.z*1.7))-.5)*.016*exp(-t*.12);
  float fogk=1.-exp(-t*uFogD);
  col=mix(col,SKY(vec3(rd.x,max(rd.y,0.)+mix(0.,.07,mf),rd.z)),fogk);
  col*=uDim;
  vec4 cp=uVP*vec4(p,1.);
  gl_FragDepth=clamp(cp.z/cp.w*.5+.5,0.,1.);
  fragColor=vec4(col,mix(1.,.80,uMirrorOn));
}`, 'floor');

  // ── cube state pass ────────────────────────────────────────
  const ST_HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
layout(location=0) in vec3 iA;
layout(location=1) in vec3 iB;
layout(location=2) in vec4 iP;     // size, delay, seed, cls
layout(location=3) in vec2 iR;     // ao, extra
uniform vec4 uQ[12]; uniform float uT, uG; uniform vec2 uSdim;
// formation B (baked, K frames stacked vertically) + group transforms
uniform sampler2D uBP, uBQ, uBX; uniform vec4 uBinfo; uniform vec4 uBg0[16], uBg1[16];
// source A = another state (the previous phase evaluated live)
uniform sampler2D uAS0, uAS1, uAS2, uAS3;
flat out vec4 s0; flat out vec4 s1; flat out vec4 s2; flat out vec4 s3; flat out vec4 s4;
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
vec3 h13(float p){vec3 p3=fract(vec3(p)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xxy+p3.yzz)*p3.zyx);}
vec3 h33(vec3 p3){p3=fract(p3*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yzz)*p3.zyx);}
mat3 rotAxis(vec3 ax,float a){ax=normalize(ax);float c=cos(a),s=sin(a),t=1.-c;
  return mat3(t*ax.x*ax.x+c,t*ax.x*ax.y+s*ax.z,t*ax.x*ax.z-s*ax.y,
              t*ax.x*ax.y-s*ax.z,t*ax.y*ax.y+c,t*ax.y*ax.z+s*ax.x,
              t*ax.x*ax.z+s*ax.y,t*ax.y*ax.z-s*ax.x,t*ax.z*ax.z+c);}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0., -s,c,0., 0.,0.,1.);}
mat3 quatMat(vec4 q){float x=q.x,y=q.y,z=q.z,w=q.w;
  return mat3(1.-2.*(y*y+z*z),2.*(x*y+z*w),2.*(x*z-y*w), 2.*(x*y-z*w),1.-2.*(x*x+z*z),2.*(y*z+x*w), 2.*(x*z+y*w),2.*(y*z-x*w),1.-2.*(x*x+y*y));}
mat3 orth(mat3 M){vec3 a=normalize(M[0]);vec3 b=M[1]-a*dot(M[1],a);b=normalize(b+vec3(0.,1e-6,0.));return mat3(a,b,cross(a,b));}
float eOut(float x){return 1.-pow(1.-x,3.);}
float eIn(float x){return x*x*x;}
float eInOut(float x){return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.;}
float eBack(float x){float c1=1.70158,c3=c1+1.;return 1.+c3*pow(x-1.,3.)+c1*pow(x-1.,2.);}
struct Pose{ vec3 c; mat3 R; float sz; float cls; vec3 rel; float hs; float glow; };
// ── formation B for cube id (position, size, rotation, aux = cls, delay, duration, group) ──
void fetchForm(int id, out vec3 pos, out float sz, out mat3 R, out vec4 aux){
  int sw=int(uSdim.x); int sh=int(uBinfo.z); int K=int(uBinfo.x+.5);
  float ph=uBinfo.y; float fl=floor(ph); float a=ph-fl;
  int f0=int(mod(fl,float(K))); int f1=(f0+1)%K;
  ivec2 t0=ivec2(id%sw,id/sw+f0*sh), t1=ivec2(id%sw,id/sw+f1*sh);
  vec4 p0=texelFetch(uBP,t0,0), p1=texelFetch(uBP,t1,0);
  vec4 q0=texelFetch(uBQ,t0,0), q1=texelFetch(uBQ,t1,0);
  if(dot(q0,q1)<0.) q1=-q1;
  vec4 q=normalize(mix(q0,q1,a));
  pos=mix(p0.xyz,p1.xyz,a); sz=mix(p0.w,p1.w,a); R=quatMat(q);
  aux=texelFetch(uBX,ivec2(id%sw,id/sw),0);
  int g=int(aux.w+.5); vec4 g0=uBg0[g], g1=uBg1[g];
  mat3 Rg=rotY(g0.w)*rotX(g1.y)*rotZ(g1.z);
  pos=g0.xyz+Rg*(pos*g1.x); R=Rg*R; sz*=g1.x;
}
// ── morph A → B with per-cube delay, arcing/swirling flight, tumble that settles ──
//   uQ[8]=(t0, ease(0 inOut,1 out,2 in), spin, shrink)  uQ[9]=(arc, bulge, swirl, glowBoost)  uQ[10]=(swirl centre.xyz, 0)
Pose morphPose(Pose A, vec3 pB, mat3 RB, float szB, float clsB, vec4 aux, float seed){
  float e=clamp((uT-uQ[8].x-aux.y)/max(aux.z,1e-3),0.,1.);
  float es=(uQ[8].y<.5)?eInOut(e):((uQ[8].y<1.5)?eOut(e):eIn(e));
  vec3 sd=h13(seed*91.7+3.1);
  float sn=sin(3.14159*e);
  vec3 base=mix(A.c,pB,es);
  vec3 d=pB-A.c; float L=length(d);
  vec3 pr=cross(d,sd-.5); pr=(length(pr)<1e-4)?vec3(0.,0.,1.):normalize(pr);
  base+=pr*sn*uQ[9].y*L*.25*(sd.z*2.-1.)+vec3(0.,1.,0.)*sn*uQ[9].x*(.4+sd.x);
  float sw=uQ[9].z*sn*(sd.y-.2);
  vec3 cc=uQ[10].xyz; vec3 v=base-cc; base=cc+rotY(sw)*v;
  Pose P;
  P.c=base;
  mat3 Rm=orth(mat3(mix(A.R[0],RB[0],es),mix(A.R[1],RB[1],es),vec3(0.)));
  P.R=rotAxis(sd-.5+vec3(.01),sn*uQ[8].z*(sd.y*2.-1.))*Rm;
  P.sz=mix(A.sz,szB,es)*(1.-uQ[8].w*sn);
  P.cls=(max(A.cls,clsB)<1.5)?mix(A.cls,clsB,smoothstep(.25,.75,e)):((e<.5)?A.cls:clsB);
  P.rel=mix(A.rel,vec3(0.),es); P.hs=mix(A.hs,1.,es);
  P.glow=A.glow*(1.-es)+uQ[9].w*sn;
  return P;
}
Pose readA(ivec2 tc){
  vec4 a0=texelFetch(uAS0,tc,0), a1=texelFetch(uAS1,tc,0), a2=texelFetch(uAS2,tc,0), a3=texelFetch(uAS3,tc,0);
  Pose A; A.c=a0.xyz; A.sz=a0.w; A.R=mat3(a1.xyz,a2.xyz,cross(a1.xyz,a2.xyz)); A.cls=a2.w; A.rel=a3.xyz; A.hs=a3.w; A.glow=a1.w; return A;
}
`;
  const ST_TAIL = `
void main(){
  int id=gl_VertexID; int sw=int(uSdim.x); ivec2 tc=ivec2(id%sw,id/sw);
  vec3 center=vec3(0.); float size=iP.x; mat3 R=mat3(1.); vec3 relN=vec3(0.); float hstep=1.; float glow=0.; float cls=iP.w; float aoV=iR.x;
  @@BODY@@
  vec2 tcn=(vec2(tc)+.5)/uSdim;
  gl_Position=vec4(tcn*2.-1.,0.,1.); gl_PointSize=1.;
  s0=vec4(center,size); s1=vec4(R[0],glow); s2=vec4(R[1],cls); s3=vec4(relN,hstep); s4=vec4(aoV,iP.z,0.,0.);
}`;
  const ST_FS = `#version 300 es
precision highp float;
flat in vec4 s0; flat in vec4 s1; flat in vec4 s2; flat in vec4 s3; flat in vec4 s4;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2; layout(location=3) out vec4 o3; layout(location=4) out vec4 o4;
void main(){ o0=s0; o1=s1; o2=s2; o3=s3; o4=s4; }`;

  // hierarchical subdivision of one big cube (N³ cubes; iA = integer cell coordinate)
  //   uQ[0] = (N, level, edge, wobble)  uQ[1] = g1..g4  uQ[2] = (g5, g6, spinPerLevel, 0)
  //   uQ[3].x = visible core layers      uQ[4] = (origin.xyz, scale)
  //   uQ[5] = (axis.xyz, angle)          uQ[6] = (glow, glowFlicker, 0, 0)
  const SUBDIV = `
      float N=uQ[0].x; int Lc=int(uQ[0].y+.5); float edge=uQ[0].z;
      vec3 p=(iA+.5)/N-.5;
      float g[6]; g[0]=uQ[1].x;g[1]=uQ[1].y;g[2]=uQ[1].z;g[3]=uQ[1].w;g[4]=uQ[2].x;g[5]=uQ[2].y;
      vec3 disp=vec3(0.); vec3 cprev=vec3(0.); vec3 cl=vec3(0.); float sL=1.;
      for(int l=1;l<=6;l++){
        if(l>Lc) break;
        sL=1./pow(2.,float(l));
        cl=(floor((p+.5)/sL)+.5)*sL-.5;
        disp+=(cl-cprev)*g[l-1];
        cprev=cl;
      }
      vec3 rel=p-cl;
      vec3 hh=h33(cl*37.1+float(Lc));
      float wob=uQ[0].w*g[max(Lc-1,0)];
      mat3 RC=(Lc>0)?rotAxis(hh-.5+vec3(.02),wob*(hh.z*2.-1.)*uQ[2].z):mat3(1.);
      vec3 pos=cl+disp+RC*rel;
      mat3 MR=rotAxis(uQ[5].xyz+vec3(1e-4),uQ[5].w);
      center=uQ[4].xyz+MR*(pos*edge*uQ[4].w);
      R=MR*RC;
      size=edge*uQ[4].w/N*.5;
      float hs=(Lc>0)?sL:1.;
      float dd=(hs*.5-max(abs(rel.x),max(abs(rel.y),abs(rel.z))))*N-.5;
      if(dd>uQ[3].x) size=0.;
      relN=rel/(hs*.5); hstep=(.5/N)/(hs*.5);
      glow=uQ[6].x+uQ[6].y*h11(dot(cl,vec3(12.9,78.2,37.7))+floor(uG*2.));
      cls=iP.w;`;
  const POSE_OUT = `center=P.c; R=P.R; size=P.sz; cls=P.cls; relN=P.rel; hstep=P.hs; glow=P.glow; aoV=1.;`;
  const BODIES = {
    static: `center=iB;`,
    subdiv: SUBDIV,
    // the big cube subdivides AND pieces leave toward formation B (per-cube delay/duration from aux)
    split: SUBDIV + `
      Pose A; A.c=center; A.R=R; A.sz=size; A.cls=cls; A.rel=relN; A.hs=hstep; A.glow=glow;
      aoV=mix(iR.x,1.,clamp((uT-15.)*2.,0.,1.));
      vec3 pB; float szB; mat3 RB; vec4 aux; fetchForm(id,pB,szB,RB,aux);
      float e0=clamp((uT-uQ[8].x-aux.y)/max(aux.z,1e-3),0.,1.);
      if(e0>0.){ Pose P=morphPose(A,pB,RB,szB,aux.x,aux,iP.z); ${POSE_OUT} }`,
    // A (live state of the previous phase) → B (formation)
    swarm: `
      Pose A=readA(tc);
      vec3 pB; float szB; mat3 RB; vec4 aux; fetchForm(id,pB,szB,RB,aux);
      Pose P=morphPose(A,pB,RB,szB,aux.x,aux,iP.z);
      ${POSE_OUT}`,
    // B only
    form: `
      vec3 pB; float szB; mat3 RB; vec4 aux; fetchForm(id,pB,szB,RB,aux);
      center=pB; R=RB; size=szB; cls=aux.x; relN=vec3(0.); hstep=1.; glow=0.; aoV=1.;`,
  };
  const EXTRA_BODIES = {};

  // ── cube draw: one point per cube; the fragment shader ray-casts the box ──
  const CVS = `#version 300 es
precision highp float;
uniform mat4 uVP; uniform float uMirror, uFloorY, uProj; uniform int uSW; uniform vec3 uRight, uUp;
uniform sampler2D uS0, uS1, uS2, uS3, uS4;
flat out vec4 fC; flat out vec3 fR0; flat out vec3 fR1; flat out vec3 fR2; flat out vec4 fInfo; flat out vec4 fS3;
void main(){
  int id=gl_VertexID; ivec2 tc=ivec2(id%uSW, id/uSW);
  vec4 s0=texelFetch(uS0,tc,0), s1=texelFetch(uS1,tc,0), s2=texelFetch(uS2,tc,0), s3=texelFetch(uS3,tc,0), s4=texelFetch(uS4,tc,0);
  vec3 c=s0.xyz; vec3 c0=s1.xyz, c1=s2.xyz; vec3 c2=cross(c0,c1);
  if(uMirror>.5){ c.y=2.*uFloorY-c.y; c0.y=-c0.y; c1.y=-c1.y; c2.y=-c2.y; }
  vec4 clip=uVP*vec4(c,1.);
  float ex=s0.w*(abs(dot(c0,uRight))+abs(dot(c1,uRight))+abs(dot(c2,uRight)));
  float ey=s0.w*(abs(dot(c0,uUp))+abs(dot(c1,uUp))+abs(dot(c2,uUp)));
  float ps=2.*max(ex,ey)*uProj/max(clip.w,1e-3)+2.5;
  fC=vec4(c,s0.w); fR0=c0; fR1=c1; fR2=c2; fInfo=vec4(s2.w,s4.x,s1.w,s4.y); fS3=s3;
  gl_Position=clip; gl_PointSize=clamp(ps,2.,1000.);
  if(s0.w<=0.||clip.w<.05||ps<1.6) gl_Position=vec4(2.,2.,2.,1.);
}`;

  const FS = `#version 300 es
precision highp float; precision highp int;
flat in vec4 fC; flat in vec3 fR0; flat in vec3 fR1; flat in vec3 fR2; flat in vec4 fInfo; flat in vec4 fS3;
uniform vec3 uCam, uFwd, uRight, uUp; uniform vec2 uRes; uniform mat4 uVP;
uniform float uFog, uExpo, uG, uMirror, uFloorY, uMirrorK, uTanF, uAsp, uFlat;
out vec4 fragColor;
${SKY_FN('skyLite', false)}
vec3 envL(vec3 r, float mo){
  vec3 s=skyLite(vec3(r.x,max(r.y,0.),r.z));
  vec3 f=vec3(mix(.80,.02,mo))+skyLite(vec3(0.,0.,1.))*.25*(1.-mo);
  return mix(f,s,smoothstep(-.06,.06,r.y));
}
void main(){
  vec2 ndc=gl_FragCoord.xy/uRes*2.-1.;
  vec3 rd=normalize(uFwd+uRight*ndc.x*uTanF*uAsp+uUp*ndc.y*uTanF);
  mat3 R=mat3(fR0,fR1,fR2);
  vec3 ro=(uCam-fC.xyz)*R/fC.w;               // Rᵀ·v
  vec3 rl=rd*R;
  vec3 inv=1./(rl+vec3(1e-9));
  vec3 t1=(-1.-ro)*inv, t2=(1.-ro)*inv;
  vec3 tmin=min(t1,t2), tmax=max(t1,t2);
  float tn=max(max(tmin.x,tmin.y),tmin.z), tf=min(min(tmax.x,tmax.y),tmax.z);
  if(tn>tf||tn<0.) discard;
  vec3 pl=ro+rl*tn;
  vec3 nl=(tmin.x>tmin.y&&tmin.x>tmin.z)?vec3(-sign(rl.x),0.,0.):((tmin.y>tmin.z)?vec3(0.,-sign(rl.y),0.):vec3(0.,0.,-sign(rl.z)));
  vec3 n=R*nl;
  float tw=tn*fC.w;
  vec3 hit=uCam+rd*tw;
  vec4 cp=uVP*vec4(hit,1.); gl_FragDepth=clamp(cp.z/cp.w*.5+.5,0.,1.);
  vec3 V=-rd;
  float cls=fInfo.x, ao=fInfo.y, glow=fInfo.z;
  vec3 vLocal=fS3.xyz+pl*fS3.w;
  vec3 a=abs(vLocal); float m=max(a.x,max(a.y,a.z));
  vec2 uv=(a.x>=m-.02)?a.yz:((a.y>=m-.02)?a.xz:a.xy);
  float e=max(uv.x,uv.y);
  float pxl=tw*2.*uTanF/uRes.y/fC.w*fS3.w;      // pixel footprint in coarse-local units
  float w=clamp(pxl*1.9,.05,.5);
  float edge=smoothstep(1.-w,1.-w*.35,e);
  float tiny=smoothstep(.18,.5,w);
  float mood=clamp(uMood+uSplit*smoothstep(-1.5,1.5,hit.x-uSplitX),0.,1.);
  vec3 keyC=mix(vec3(1.),PURP*.85+vec3(.30),mood), rimC=mix(vec3(1.),REDC*1.0+vec3(.22),mood);
  vec3 K=normalize(vec3(-.45,.80,.55)), Rm=normalize(vec3(.55,.25,-.80));
  float dk=max(dot(n,K),0.), dr=max(dot(n,Rm),0.);
  float hemi=.5+.5*n.y;
  float fres=pow(1.-max(dot(n,V),0.),3.);
  vec3 refl=reflect(-V,n);
  float low=smoothstep(0.,.9,hit.y-uFloorY);                       // ground occlusion: darker toward the floor
  vec3 col;
  if(cls<1.5){
    float blk=clamp(cls,0.,1.);
    // white ceramic
    vec3 wc=vec3(.97)*(mix(.88,.20,mood)*(.66+.34*hemi)*mix(vec3(1.),vec3(.75,.6,1.),mood)+mix(.30,.72,mood)*dk*keyC+mix(.05,.45,mood)*dr*rimC);
    wc+=envL(refl,mood)*(.05+.14*fres);
    wc*=mix(.50,1.,ao); wc*=1.-edge*mix(.20,.06,mood)*(1.-tiny);
    // graphite
    vec3 gc=vec3(.022+.05*dk);
    vec3 hv=normalize(K+V);
    gc+=keyC*pow(max(dot(n,hv),0.),70.)*.85+rimC*pow(max(dot(n,normalize(Rm+V)),0.),40.)*.7*dr;
    gc+=envL(refl,mood)*(.05+.62*fres);
    gc*=mix(.45,1.,ao);
    gc+=vec3(.30,.31,.33)*edge*(1.-.55*tiny)*mix(.8,1.,mood);
    col=mix(wc,gc,blk);
    col*=mix(.74,1.,low);
  } else if(cls<2.5){                                              // chrome
    col=pow(envL(refl,mood),vec3(2.0))*(.95+.2*dk)+vec3(pow(max(dot(n,normalize(K+V)),0.),90.))*.8;
    col+=vec3(.28)*edge*(1.-.6*tiny);
    col*=mix(.8,1.,low);
  } else if(cls<3.5){                                              // white spark
    col=vec3(1.9+glow*1.2)*(.78+.22*(1.-edge*.6));
  } else if(cls<4.5){                                              // cold-blue glint
    col=vec3(.62,.80,1.0)*(2.0+glow*1.2)*(.75+.25*(1.-edge*.5));
  } else if(cls<6.5){                                              // energy: dark glass body, glowing skin (purple → red)
    vec3 EC=mix(PURP,REDC,clamp(cls-5.,0.,1.));
    float eg=.26+.70*fres+edge*1.7*(1.-.5*tiny)+glow*1.1;
    col=vec3(.012+.04*dk)+EC*eg*mix(.55,1.,ao)+envL(refl,mood)*.12*fres;
    col*=mix(.8,1.,low);
  } else {                                                         // spark (purple → red)
    vec3 EC=mix(PURP,REDC,clamp(cls-7.,0.,1.));
    col=EC*(1.5+glow*1.1)*(.75+.25*(1.-edge*.5));
  }
  col+=vec3(glow)*.10;
  // flat "drawing" look: white paper + ink edges, before it becomes a solid
  vec3 flatc=mix(vec3(.972),vec3(.05),edge*.92);
  col=mix(col,flatc,uFlat);
  if(uMirror>.5){ float hgt=max(uFloorY-hit.y,0.); col*=exp(-hgt*.55)*uMirrorK; }
  float fogk=1.-exp(-tw*uFog);
  col=mix(col,skyLite(normalize(vec3(hit.x-uCam.x,.04,hit.z-uCam.z))),fogk);
  fragColor=vec4(col*uExpo,1.);
}`;

  // ── shadow-map pass: each cube drops a soft gaussian into a top-down map ──
  const SHV = `#version 300 es
precision highp float;
uniform sampler2D uS0; uniform int uSW; uniform vec3 uShC; uniform float uFloorY, uPx;
flat out float fStr;
void main(){
  int id=gl_VertexID; ivec2 tc=ivec2(id%uSW,id/uSW);
  vec4 s0=texelFetch(uS0,tc,0); float size=s0.w; vec3 c=s0.xyz;
  float h=max(c.y-uFloorY-size,0.);
  float r=size*1.7+h*.30+.05;
  fStr=3.0*size*size/(r*r)*exp(-h*.26);
  vec2 q=(c.xz-uShC.xy)/uShC.z;
  gl_Position=vec4(q,0.,1.);
  gl_PointSize=clamp(r/uShC.z*uPx,2.,240.);
  if(size<=0.||h>7.||abs(q.x)>1.4||abs(q.y)>1.4) gl_Position=vec4(2.,2.,2.,1.);
}`;
  const SHF = `#version 300 es
precision highp float;
flat in float fStr; out vec4 o;
void main(){ vec2 d=gl_PointCoord*2.-1.; o=vec4(fStr*exp(-4.*dot(d,d)),0.,0.,1.); }`;

  const progs = {};
  function stateProg(mode) {
    if (progs['s.' + mode]) return progs['s.' + mode];
    const body = BODIES[mode] || EXTRA_BODIES[mode];
    if (!body) throw new Error('unknown cube mode ' + mode);
    progs['s.' + mode] = makeProgram(ST_HEAD + ST_TAIL.replace('@@BODY@@', body), ST_FS, 'state.' + mode);
    return progs['s.' + mode];
  }
  let cubeProgram = null, shadowProgram = null;
  const getCubeProg = () => cubeProgram || (cubeProgram = makeProgram(CVS, FS, 'cubes'));
  const getShadowProg = () => shadowProgram || (shadowProgram = makeProgram(SHV, SHF, 'shadow'));
  const emptyVAO = gl.createVertexArray();
  const SHP = 1024;
  const shadowTgt = makeTarget(SHP, SHP);

  const SW = 256;
  // state textures (5 MRT) that a cube set — or a spare "source" — renders into
  class StateTex {
    constructor(sw, sh) {
      this.sw = sw; this.sh = sh; this.tex = []; this.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      for (let k = 0; k < 5; k++) {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, sw, sh);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0); this.tex.push(t);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('state FBO incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }
  class CubeSet extends StateTex {
    constructor(data) {                    // data: Float32Array(12*n) → iA(3) iB(3) iP(4) iR(2)
      const n = data.length / 12;
      super(SW, Math.ceil(n / SW));
      this.n = n;
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (const [loc, size, off] of [[0, 3, 0], [1, 3, 12], [2, 4, 24], [3, 2, 40]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 48, off); }
      gl.bindVertexArray(null);
      this.scratch = [new StateTex(this.sw, this.sh), new StateTex(this.sw, this.sh), new StateTex(this.sw, this.sh)];
    }
  }
  // baked formation: K animation frames of (pos,size) + quaternion per cube, plus aux (cls, delay, dur, group)
  class Form {
    constructor(n, K, pos, quat, aux) {
      this.n = n; this.K = K; this.sh = Math.ceil(n / SW);
      const mk = (h, data) => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SW, h, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return t;
      };
      const need = SW * this.sh * 4;
      const pad = (a, len) => { if (a.length >= len) return a; const o = new Float32Array(len); o.set(a); return o; };
      this.P = mk(this.sh * K, pad(pos, need * K)); this.Q = mk(this.sh * K, pad(quat, need * K)); this.X = mk(this.sh, pad(aux, need));
    }
    // dynamic formations (K=1): re-upload positions/rotations every frame (pure function of t, so still deterministic)
    update(pos, quat) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, this.P); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SW, this.sh, gl.RGBA, gl.FLOAT, pos);
      gl.bindTexture(gl.TEXTURE_2D, this.Q); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SW, this.sh, gl.RGBA, gl.FLOAT, quat);
    }
  }

  // ── drawing ────────────────────────────────────────────────
  function camUniforms(cam) {
    const { fwd, right, up } = cam.basis();
    return { uCamPos: cam.pos, uFwd: fwd, uRight: right, uUp: up, uTanF: Math.tan(cam.fov / 2), uAsp: 16 / 9 };
  }
  const DEF = {
    mood: 0, tilt: 0.55, seam: 0.5, floorY: 0, fogD: 0.03, lines: 0, reveal: 0, ringC: [0, 0, 0], fieldOff: [0, 0],
    pulseR: 0, pulseA: 0, shK: 0.62, shC: [0, 0, 9], mirrorK: 0.4, flat: 0, floorDark: 0, dim: 1, split: 0, splitD: 0, splitX: 0,
  };
  let ST = { ...DEF };

  function begin(c, cam, opts = {}) {
    ST = { ...DEF, ...opts };
    bindTarget(c.tgt);
    gl.clearColor(0, 0, 0, 1); gl.clearDepth(1);
    gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    ST.cam = cam; ST.vp = cam.vp(W / H);
    gl.disable(gl.CULL_FACE);
    // clear the shadow map; shadow() adds to it
    bindTarget(shadowTgt); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  const skyUniforms = () => ({ uMood: ST.mood, uTilt: ST.tilt, uSeam: ST.seam, uSplit: ST.split, uSplitD: ST.splitD, uSplitX: ST.splitX });

  function shadow(c, sets) {
    const pr = getShadowProg();
    gl.useProgram(pr.p); bindTarget(shadowTgt);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (const set of [].concat(sets)) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, set.tex[0]);
      setUniforms(pr, { uS0: { int: 0 }, uSW: { int: set.sw }, uShC: ST.shC, uFloorY: ST.floorY, uPx: SHP });
      gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.POINTS, 0, set.n); gl.bindVertexArray(null);
    }
    gl.disable(gl.BLEND);
  }

  function drawFloor(c, mirrorOn = 0) {
    const cam = ST.cam;
    gl.useProgram(floorProg.p); bindTarget(c.tgt);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
    if (mirrorOn) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    setUniforms(floorProg, {
      uRes: [c.tgt.w, c.tgt.h], uG: G_TIME, uT: c.lt, ...camUniforms(cam), ...skyUniforms(), uY: ST.floorY, uVP: ST.vp,
      uReveal: ST.reveal, uLines: ST.lines, uFogD: ST.fogD, uPulseR: ST.pulseR, uPulseA: ST.pulseA, uMirrorOn: mirrorOn,
      uRingC: ST.ringC, uFieldOff: ST.fieldOff, uShK: ST.shK, uShC: [ST.shC[0], ST.shC[1], ST.shC[2]], uFloorDark: ST.floorDark, uDim: ST.dim,
      uShadow: { tex: shadowTgt.tex },
    });
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
  const DRAWBUFS = [0, 1, 2, 3, 4].map(k => gl.COLOR_ATTACHMENT0 + k);
  const IDENT_G = (() => { const a = new Float32Array(64), b = new Float32Array(64); for (let g = 0; g < 16; g++) { b[g * 4] = 1; } return { g0: a, g1: b }; })();
  // q: { Q:[48], form:{F:Form, phase, g0:Float32Array(32), g1:Float32Array(32)}, src: StateTex }
  function computeState(c, set, mode, q, target = set) {
    const pr = stateProg(mode);
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, set.sw, set.sh);
    gl.drawBuffers(DRAWBUFS);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const Q = new Float32Array(48); (q.Q || []).forEach((v, i) => { Q[i] = v; });
    const u = { uQ: { v4: Q }, uT: c.lt, uG: G_TIME, uSdim: [set.sw, set.sh] };
    let unit = 0;
    const bind = (name, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); u[name] = { int: unit }; unit++; };
    if (q.form) {
      const F = q.form;
      bind('uBP', F.F.P); bind('uBQ', F.F.Q); bind('uBX', F.F.X);
      u.uBinfo = [F.F.K, F.phase || 0, F.F.sh, F.F.n];
      u.uBg0 = { v4: F.g0 || IDENT_G.g0 }; u.uBg1 = { v4: F.g1 || IDENT_G.g1 };
    }
    if (q.src) { bind('uAS0', q.src.tex[0]); bind('uAS1', q.src.tex[1]); bind('uAS2', q.src.tex[2]); bind('uAS3', q.src.tex[3]); }
    setUniforms(pr, u);
    gl.bindVertexArray(set.vao);
    gl.drawArrays(gl.POINTS, 0, set.n);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function drawCubes(c, set, o = {}) {
    const pr = getCubeProg(), cam = ST.cam, bs = cam.basis();
    gl.useProgram(pr.p); bindTarget(c.tgt);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    for (let k = 0; k < 5; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, set.tex[k]); }
    setUniforms(pr, {
      uVP: ST.vp, uCam: cam.pos, uG: G_TIME, uMirror: o.mirror ? 1 : 0, uFloorY: ST.floorY, uSW: { int: set.sw },
      uProj: (c.tgt.h / 2) / Math.tan(cam.fov / 2), uRes: [c.tgt.w, c.tgt.h], uFwd: bs.fwd, uRight: bs.right, uUp: bs.up, uTanF: Math.tan(cam.fov / 2), uAsp: 16 / 9,
      uS0: { int: 0 }, uS1: { int: 1 }, uS2: { int: 2 }, uS3: { int: 3 }, uS4: { int: 4 },
      uFog: o.fog ?? ST.fogD, uExpo: o.expo ?? 1, uMirrorK: ST.mirrorK, uFlat: o.flat ?? ST.flat, ...skyUniforms(),
    });
    gl.bindVertexArray(emptyVAO);
    gl.drawArrays(gl.POINTS, 0, Math.min(set.n, o.count ?? set.n));
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  }
  function addMode(name, body) { EXTRA_BODIES[name] = body; }
  // CPU readback of one state attachment (k=0: centre+size) — used once to pair cubes with their next bodies
  function readState(set, k = 0) {
    const out = new Float32Array(set.sw * set.sh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, set.fbo); gl.readBuffer(gl.COLOR_ATTACHMENT0 + k);
    gl.readPixels(0, 0, set.sw, set.sh, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }
  return { CubeSet, StateTex, Form, readState, begin, shadow, drawFloor, computeState, drawCubes, camUniforms, addMode, ST: () => ST, SW };
})();
