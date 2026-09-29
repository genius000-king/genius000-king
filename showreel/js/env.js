'use strict';
// Shared GLSL: a studio dome etched with the star lattice (used for chrome in ch.5 and glass in ch.6)
const ENV_GLSL = `
const float ROT45E=.785398;
float lattE(vec2 u){
  float c=cos(ROT45E),s=sin(ROT45E);
  float g1=min(abs(fract(u.x)-.5),abs(fract(u.y)-.5));
  vec2 v=mat2(c,-s,s,c)*u*.7071; float g2=min(abs(fract(v.x)-.5),abs(fract(v.y)-.5));
  return exp(-min(g1,g2)*46.);
}
vec3 envE(vec3 r,float t){
  float h=r.y*.5+.5;
  vec3 c=mix(vec3(.010,.012,.035),vec3(.05,.03,.11),h);
  vec2 uv=r.xz/(abs(r.y)+.55);
  c+=vec3(1.,.72,.20)*lattE(uv*1.6+vec2(0.,t*.05))*.30*smoothstep(-.2,.6,r.y);
  vec3 l1=normalize(vec3(-.9,.35,.55)), l2=normalize(vec3(.95,.2,.4)), l3=normalize(vec3(.1,.95,-.2)), l4=normalize(vec3(0.,.15,-1.));
  c+=vec3(1.,.18,.53)*pow(max(dot(r,l1),0.),24.)*2.4;
  c+=vec3(0.,.72,1.)*pow(max(dot(r,l2),0.),24.)*2.4;
  c+=vec3(1.,.93,.82)*smoothstep(.55,.96,dot(r,l3))*1.6;
  c+=vec3(1.,.72,.20)*pow(max(dot(r,l4),0.),18.)*1.8;
  c+=vec3(1.)*smoothstep(.022,.0,abs(r.x-r.z*.35-.08))*smoothstep(.2,.7,r.y+.2)*.9;
  return c;
}`;
