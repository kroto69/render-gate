import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStatic } from '../../src/checks/static.js';
import { GateError } from '../../src/errors.js';

test('static check catches missing assets and passes existing assets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-static-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'src', 'video.js'), `const logo = staticFile('logo.png');`);
  const config = { compositions: { PromoVideo: { expect: { assets: ['public/logo.png'] } } } };
  assert.throws(() => checkStatic({ root, config, composition: 'PromoVideo' }), (error) => error instanceof GateError && error.code === 10);
  fs.writeFileSync(path.join(root, 'public', 'logo.png'), 'fake');
  assert.equal(checkStatic({ root, config, composition: 'PromoVideo' }).ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('audio expectation requires an audio reference', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-audio-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'video.js'), 'export const value = 1;');
  assert.throws(() => checkStatic({ root, config: { compositions: { X: { expect: { audio: true } } } }, composition: 'X' }), /Audio expected/);
  fs.rmSync(root, { recursive: true, force: true });
});
