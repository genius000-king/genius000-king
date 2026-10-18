import * as THREE from 'three';
import {makeComponent} from '../catalog/types.js';
import {componentModel} from './components.js';
import {loadModels} from './models/index.js';

export const cache = new Map();

export const waiting = new Map();

export const queue = [];

export let renderer = null;

export let scene = null;

export let camera = null;

export let busy = false;

export let failed = false;

export function setup() {
  renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.setSize(144, 144);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#5c5c66', 1.8));
  const sun = new THREE.DirectionalLight('#fff7ee', 2.6);
  sun.position.set(-50, 120, 80);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#dbe6f5', 0.9);
  fill.position.set(80, 40, -60);
  scene.add(fill);
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 3000);
}

export function render(type) {
  if (!renderer) setup();
  const g = componentModel(makeComponent(type, [0, 0, 0], 'thumb'));
  scene.add(g);
  const b = new THREE.Box3().setFromObject(g),
    sphere = b.getBoundingSphere(new THREE.Sphere());
  camera.position
    .copy(sphere.center)
    .add(
      new THREE.Vector3(0.55, 0.95, 1)
        .normalize()
        .multiplyScalar((sphere.radius / Math.sin((14 * Math.PI) / 180)) * 1.02)
    );
  camera.lookAt(sphere.center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(g);
  g.traverse(o => o.geometry?.dispose());
  return url;
}

export function pump() {
  if (busy || !queue.length || failed) return;
  busy = true;
  const next = window.requestIdleCallback ?? (f => setTimeout(f, 16));
  next(async () => {
    const type = queue.shift();
    try {
      await loadModels([type]);
      const url = render(type);
      cache.set(type, url);
      for (const cb of waiting.get(type) ?? []) cb(url);
    } catch (e) {
      failed = true;
      console.info('Thumbnails unavailable:', e.message);
    }
    waiting.delete(type);
    busy = false;
    pump();
  });
}

export function thumb(type, cb) {
  if (cache.has(type)) return cache.get(type);
  if (cb) {
    if (!waiting.has(type)) {
      waiting.set(type, []);
      queue.push(type);
    }
    waiting.get(type).push(cb);
    pump();
  }
  return null;
}
