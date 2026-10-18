import * as THREE from 'three';
import {loadModels, missingModels} from './models/index.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {MM} from '../catalog/types.js';
import {AdaptiveResolution, PROFILES} from '../performance/index.js';
import {mixin} from '../shared/mixin.js';
import {cameraMethods} from './camera.js';
import {geometryKey, componentModel} from './components.js';
import {mat} from './geo.js';
import {interactionMethods} from './interaction.js';
import {visualsMethods} from './visuals.js';
import {wiresMethods} from './wires.js';

export class LabScene {
  /** `profile` is a performance profile (engines/performance); it is fixed for the life of the scene. */
  constructor(container, callbacks, profile = {...PROFILES.medium, tier: 'medium'}) {
    this.container = container;
    this.cb = callbacks;
    this.profile = profile;
    this.objects = new Map();
    this.wires = new Map();
    this.selection = [];
    this.mode = 'select';
    this.dirty = true;
    this.disposed = false;
    this.ready = this.init();
  }
  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e9ece7');
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 4000);
    this.camera.position.set(85, 105, 130);
    this.renderer = null;
    const profile = this.profile;
    if (profile.webgpu && navigator.gpu && !sessionStorage.getItem('circuit-lab-force-webgl')) {
      try {
        const adapter = await navigator.gpu.requestAdapter({powerPreference: 'high-performance'});
        if (!adapter) throw Error('No WebGPU adapter');
        const {WebGPURenderer} = await import('three/webgpu');
        const r = new WebGPURenderer({antialias: profile.antialias, alpha: false});
        await r.init();
        if (!r.backend.isWebGPUBackend) {
          r.dispose();
          throw Error('WebGPU device unavailable');
        }
        this.renderer = r;
        this.backend = 'WebGPU';
      } catch (e) {
        console.info('WebGPU unavailable; using WebGL2', e.message);
      }
    }
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: profile.antialias,
        alpha: false,
        // on laptops with two GPUs, battery saver keeps the integrated one
        powerPreference: profile.tier === 'low' ? 'low-power' : 'high-performance',
        preserveDrawingBuffer: false,
      });
      this.backend = 'WebGL2';
    }
    this.software = false;
    if (this.renderer.getContext) {
      const gl = this.renderer.getContext(),
        debug = gl.getExtension('WEBGL_debug_renderer_info');
      this.software =
        !!debug && /SwiftShader|llvmpipe|Software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    }
    const maxRatio = Math.min(devicePixelRatio, this.software ? 1 : profile.pixelRatio);
    this.renderer.setPixelRatio(maxRatio);
    this.adaptive = new AdaptiveResolution({
      max: maxRatio,
      min: Math.min(maxRatio, profile.minPixelRatio),
      frameMs: profile.frameMs,
      onChange: ratio => {
        this.renderer.setPixelRatio(ratio);
        this.resize();
        this.cb.onResolution?.(ratio);
      },
    });
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);
    this.cb.onBackend?.(this.backend);
    // the reflection map is drawn at 1024 × 512 and scaled to the profile's size
    const envCanvas = document.createElement('canvas'),
      envScale = profile.environmentSize / 1024;
    envCanvas.width = profile.environmentSize;
    envCanvas.height = profile.environmentSize / 2;
    const ec = envCanvas.getContext('2d'),
      eg = ec.createLinearGradient(0, 0, 0, 512);
    ec.scale(envScale, envScale);
    eg.addColorStop(0, '#d3dbd9');
    eg.addColorStop(0.48, '#84928c');
    eg.addColorStop(0.52, '#4b5550');
    eg.addColorStop(1, '#b3bbae');
    ec.fillStyle = eg;
    ec.fillRect(0, 0, 1024, 512);
    ec.filter = `blur(${12 * envScale}px)`;
    ec.fillStyle = '#ffffff';
    ec.fillRect(100, 90, 220, 110);
    ec.fillStyle = '#dde7ed';
    ec.fillRect(640, 60, 120, 220);
    ec.filter = 'none';
    const environment = new THREE.CanvasTexture(envCanvas);
    environment.mapping = THREE.EquirectangularReflectionMapping;
    environment.colorSpace = THREE.SRGBColorSpace;
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.9;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8b9684', 1.5));
    const sun = new THREE.DirectionalLight('#fffaf2', 2.8);
    sun.position.set(-55, 140, 60);
    sun.castShadow = profile.shadows;
    const shadowSize = this.software ? Math.min(512, profile.shadowSize) : profile.shadowSize;
    if (profile.shadows) sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, {left: -180, right: 180, top: 180, bottom: -180, near: 1, far: 500});
    sun.shadow.normalBias = 0.35;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.sun = sun;
    const fill = new THREE.DirectionalLight('#d6e3f0', 0.8);
    fill.position.set(80, 70, -90);
    this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat('#e3e6df', 0, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    this.surface = floor;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(1000, 200, '#c8d0c1', '#d1d8ca');
    grid.position.y = -1.97;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    this.scene.add(grid);
    this.grid = grid;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 3000;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.addEventListener('change', () => {
      this.dirty = true;
    });
    this.controls.addEventListener('end', () => this.cb.onCamera?.(this.getCamera()));
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setSize(0.8);
    this.transform.addEventListener('dragging-changed', e => {
      this.controls.enabled = !e.value;
      if (!e.value && this.transform.object) {
        const g = this.transform.object;
        g.position.y = Math.max(0, g.position.y);
        this.cb.onTransform?.(
          g.userData.component,
          g.position.toArray().map(v => v / MM),
          [g.rotation.x, g.rotation.y, g.rotation.z]
        );
      }
    });
    this.transform.addEventListener('objectChange', () => {
      this.updateWires();
      this.dirty = true;
    });
    this.scene.add(this.transform.getHelper());
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.events = [];
    for (const [event, handler] of [
      ['pointerdown', e => this.down(e)],
      ['pointermove', e => this.move(e)],
      ['pointerup', e => this.up(e)],
      ['pointercancel', e => this.up(e)],
      ['dblclick', () => this.focus()],
      [
        'touchend',
        e => {
          /* no synthetic click after a tap: it would land on whatever panel the tap just opened (e.g. Duplicate) */ if (
            e.cancelable
          )
            e.preventDefault();
        },
      ],
      ['contextmenu', e => e.preventDefault()],
    ]) {
      this.renderer.domElement.addEventListener(event, handler, {passive: false});
      this.events.push([event, handler]);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    let frames = 0,
      then = performance.now(),
      lastFrame = 0;
    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      const stamp = performance.now();
      const minGap = this.software ? Math.max(48, profile.frameMs) : profile.frameMs;
      if (minGap && stamp - lastFrame < minGap) return;
      lastFrame = stamp;
      /* ResizeObserver can miss a layout change (e.g. a drawer opening mid-frame); never leave a stale or cleared canvas */ const el =
        this.renderer.domElement;
      if (el.clientWidth !== this.container.clientWidth || el.clientHeight !== this.container.clientHeight)
        this.resize();
      const changed = this.controls.update(),
        rendered = this.dirty || changed;
      if (rendered) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
        frames++;
      }
      this.adaptive.frame(stamp, rendered);
      const now = performance.now();
      if (now - then > 1500) {
        this.cb.onPerformance?.(Math.round((frames * 1000) / (now - then)));
        frames = 0;
        then = now;
      }
    });
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.cb.onRecover?.('Graphics context lost. Restoring your workspace.');
    });
    if (this.renderer.backend?.device?.lost)
      this.renderer.backend.device.lost.then(() => {
        if (!this.disposed) {
          sessionStorage.setItem('circuit-lab-force-webgl', '1');
          this.cb.onRecover?.('WebGPU device lost. Restoring the workspace with WebGL2.');
        }
      });
  }
  resize() {
    if (!this.renderer) return;
    const {width, height} = this.container.getBoundingClientRect();
    if (width && height) {
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      const wasCompact = this.compact;
      this.compact = width < 700 || this.camera.aspect < 0.9;
      /* keep a sane lens on tall phone screens; fit() then frames the circuit */ this.camera.fov =
        (2 *
          Math.atan(Math.tan((17 * Math.PI) / 180) * Math.min(1.9, Math.max(1, 1.4 / this.camera.aspect))) *
          180) /
        Math.PI;
      this.camera.updateProjectionMatrix();
      this.dirty = true;
      const portrait = this.camera.aspect < 0.9;
      if (
        wasCompact !== undefined &&
        (wasCompact !== this.compact || portrait !== this.portrait) &&
        this.objects.size
      )
        this.phoneView();
      this.portrait = portrait;
    }
  }
  update(project) {
    this.project = project;
    /* models arrive per category on first use; build once they are here */ const types =
      project.components.map(c => c.type);
    if (missingModels(types).length) {
      loadModels(types).then(() => {
        this.visualSignature = null;
        if (!this.disposed) this.update(this.project);
      });
      return;
    }
    const signature = JSON.stringify([project.components, project.wires]);
    if (signature === this.visualSignature) return;
    this.visualSignature = signature;
    const wanted = new Set(project.components.map(c => c.id));
    for (const [id, g] of this.objects)
      if (!wanted.has(id)) {
        this.scene.remove(g);
        this.disposeGroup(g);
        this.objects.delete(id);
      }
    for (const c of project.components) {
      let g = this.objects.get(c.id);
      if (g && g.userData.geomKey !== geometryKey(c)) {
        this.scene.remove(g);
        this.disposeGroup(g);
        this.objects.delete(c.id);
        g = null;
      }
      if (!g) {
        g = componentModel(c);
        this.scene.add(g);
        this.objects.set(c.id, g);
        if (this.mode === 'wire') this.showTerminals(g, true);
      }
      g.position.fromArray(c.position).multiplyScalar(MM);
      g.scale.setScalar(MM);
      g.rotation.set(...c.rotation);
      const ud = g.userData,
        p = c.params;
      if (ud.ledMaterial) {
        ud.ledMaterial.emissive.set(p.color);
        ud.halo?.material.color.set(p.color);
      }
      if (ud.knob) ud.knob.rotation.y = (p.value - 0.5) * Math.PI * 1.6;
      if (ud.button)
        ud.button.position.y = p.pressed
          ? c.type === 'button'
            ? 4.95
            : 3.8
          : c.type === 'button'
            ? 5.4
            : 4.25;
      if (ud.slider) ud.slider.position.x = p.position ? 1.8 : -1.8;
      if (ud.stick) {
        ud.stick.rotation.x = (p.y - 0.5) * 0.7;
        ud.stick.rotation.z = -(p.x - 0.5) * 0.7;
      }
      if (ud.encoderKnob) ud.encoderKnob.rotation.y = (-(p.target ?? 0) * Math.PI) / 10;
      if (ud.keys) for (const [k, m] of Object.entries(ud.keys)) m.position.y = p.key === k ? 0.95 : 1.15;
      if (ud.dial) ud.dial.rotation.y = -({V: 0, A: 0.55, Ω: 1.1, continuity: 1.65}[p.mode] ?? 0) + 0.8;
      g.updateMatrixWorld();
    }
    this.updateWires();
    this.select(this.selection, this.selectedWire);
    this.dirty = true;
    if (this.pendingFit) {
      const {t} = this.pendingFit;
      this.pendingFit = null;
      if (performance.now() - t < 1500) this.phoneView();
    }
  }
  setTheme(theme) {
    if (this.theme === theme) return;
    this.theme = theme;
    this.scene.background.set(theme === 'dark' ? '#151519' : '#ebebef');
    this.surface?.material.color.set(theme === 'dark' ? '#202025' : '#e5e5e9');
    this.grid.material.opacity = theme === 'dark' ? 0.035 : 0.12;
    this.scene.environmentIntensity = theme === 'dark' ? 0.6 : 0.9;
    this.dirty = true;
  }
  capture() {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
  disposeGroup(g) {
    g.traverse(o => {
      o.geometry?.dispose();
    });
  }
  dispose() {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.renderer?.setAnimationLoop(null);
    this.events?.forEach(([e, h]) => this.renderer.domElement.removeEventListener(e, h));
    this.controls?.dispose();
    this.transform?.dispose();
    this.scene?.traverse(o => o.geometry?.dispose());
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

mixin(LabScene, cameraMethods, wiresMethods, interactionMethods, visualsMethods);
