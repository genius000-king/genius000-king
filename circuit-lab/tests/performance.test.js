import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, profileFor, AdaptiveResolution, PROFILES} from '../engines/performance/index.js';

test('device tiers follow cores, memory, data saver and GPU', () => {
  assert.equal(classify({cores: 2, memory: 8, gpu: 'ANGLE (NVIDIA GeForce RTX 3060)'}).tier, 'low');
  assert.equal(classify({cores: 8, memory: 2, gpu: 'Apple M1'}).tier, 'low');
  assert.equal(classify({cores: 8, memory: 8, saveData: true}).tier, 'low');
  assert.equal(classify({cores: 8, memory: 8, gpu: 'Mali-T720'}).tier, 'low');
  assert.equal(classify({cores: 8, memory: 8, gpu: 'Adreno (TM) 506'}).tier, 'low');
  const swift = classify({cores: 16, memory: 32, gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))'});
  assert.deepEqual(swift, {tier: 'low', software: true});
  assert.equal(classify({cores: 8, memory: 8, mobile: true, gpu: 'Adreno (TM) 740'}).tier, 'medium');
  assert.equal(classify({cores: 4, memory: 8, gpu: 'Intel(R) UHD Graphics 620'}).tier, 'medium');
  assert.equal(classify({cores: 12, memory: 16, gpu: 'ANGLE (Apple M2 Pro)'}).tier, 'high');
});

test('modes pick a profile; software rendering is always capped', () => {
  const fast = {tier: 'high', software: false},
    weak = {tier: 'low', software: false},
    cpu = {tier: 'low', software: true};
  assert.equal(profileFor('auto', fast).tier, 'high');
  assert.equal(profileFor('auto', fast).webgpu, false, 'WebGPU is only downloaded when Quality is chosen');
  assert.equal(profileFor('quality', fast).webgpu, true);
  assert.equal(profileFor('auto', weak).shadows, false);
  assert.equal(profileFor('saver', fast).glass, false);
  assert.equal(profileFor('quality', weak).shadows, true, 'the user can ask a weak device for quality');
  const q = profileFor('quality', cpu);
  assert.equal(q.pixelRatio, 1);
  assert.equal(q.shadowSize, 512);
  assert.ok(q.frameMs >= 48);
  for (const p of Object.values(PROFILES)) assert.ok(p.minPixelRatio <= p.pixelRatio);
});

test('adaptive resolution steps down on late frames and climbs back slowly', () => {
  const changes = [];
  const a = new AdaptiveResolution({max: 2, min: 1, frameMs: 0, onChange: r => changes.push(r)});
  let t = 0;
  const run = (n, dt) => {
    for (let i = 0; i < n; i++) a.frame((t += dt), true);
  };
  run(31, 50); // 20 fps while orbiting
  assert.deepEqual(changes, [1.6]);
  run(30 * 3, 50);
  assert.deepEqual(changes, [1.6, 1.28, 1.02, 1]);
  assert.equal(a.ratio, 1, 'never below the minimum');
  // idle frames (nothing drawn) are not evidence of anything
  for (let i = 0; i < 200; i++) a.frame((t += 200), i % 2 === 0);
  assert.equal(a.ratio, 1);
  run(30 * 4, 16.7);
  assert.equal(a.ratio, 1.12, 'three on-time windows before one step up');
});
