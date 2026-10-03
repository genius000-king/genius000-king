'use strict';
// ══════════════════════════════════════════════════════════════
//  Paper — a white sheet rendered in a shader from a mask canvas.
//  mask.R = hole (the tear), mask.G = graphite line / point drawn ON the paper.
//  Mip-mapped samples give soft shadow, rim light and torn-edge relief for free.
//  Achromatic: white paper, graphite ink, grey shadow. Nothing warm.
// ══════════════════════════════════════════════════════════════
const Paper = (() => {
  const prog = frag(`
uniform sampler2D uMask; uniform float uPaperA, uLeak;
void main(){
  vec2 uv=vUv;
  vec2 nz=vec2(vnoise(uv*vec2(70.,40.)),vnoise(uv*vec2(70.,40.)+7.3))-.5;
  vec2 j=nz*.0016;
  float h=texture(uMask,uv+j).r;
  float hb=textureLod(uMask,uv,3.).r, hw=textureLod(uMask,uv,5.5).r;
  vec2 px=2./uRes;
  float gx=texture(uMask,uv+j+vec2(px.x,0.)).r-texture(uMask,uv+j-vec2(px.x,0.)).r;
  float gy=texture(uMask,uv+j+vec2(0.,px.y)).r-texture(uMask,uv+j-vec2(0.,px.y)).r;
  vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  vec3 paper=vec3(.976,.974,.968)*mix(1.,.915,smoothstep(.3,1.0,length(p)*1.1));
  paper*=1.-.030*fbm(uv*vec2(520.,292.));
  paper*=1.-.46*hb*(1.-h);                                   // the void swallows light near the edge
  float rim=clamp(dot(vec2(gx,gy),normalize(vec2(-.6,.8)))*3.,-1.,1.);
  paper+=vec3(1.)*max(rim,0.)*.22*(1.-h)-vec3(.20)*max(-rim,0.)*(1.-h);
  paper*=1.-clamp(hw*uLeak,0.,1.)*.30;                        // broad soft shade around the opening
  float g0=texture(uMask,uv).g, gb=textureLod(uMask,uv,3.).g, gw=textureLod(uMask,uv,5.).g;
  paper*=1.-clamp(gw*.5,0.,.30);                              // ink bleeds a little into the fibres
  paper*=1.-clamp(gb*.35,0.,.35);
  paper=mix(paper,vec3(.035),clamp(g0,0.,1.)*.97);
  fragColor=vec4(paper,(1.-h)*uPaperA);
}`, 'paper');

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const mx = cv.getContext('2d');
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // fn(ctx) draws the mask in virtual 1920×1080 space (additive: use 'lighter' to combine channels)
  function draw(c, fn, opts = {}) {
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'source-over'; mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    mx.setTransform(SCALE, 0, 0, SCALE, 0, 0); mx.globalCompositeOperation = 'lighter';
    fn(mx);
    mx.globalCompositeOperation = 'source-over';
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.useProgram(prog.p); bindTarget(c.tgt);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    setUniforms(prog, { uRes: [c.tgt.w, c.tgt.h], uG: G_TIME, uT: c.lt, uMask: { int: 0 }, uPaperA: opts.alpha ?? 1, uLeak: opts.leak ?? 1 });
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
  return { draw };
})();
