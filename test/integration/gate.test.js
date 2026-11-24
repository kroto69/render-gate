import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'bin/render-gate.js');
const fake = path.join(root, 'test/stubs/fake-kane.js');
const studio = path.join(root, 'scripts/studio-stub.js');

function project({ assets = [] } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-flow-'));
  fs.mkdirSync(path.join(cwd, 'src'));
  fs.mkdirSync(path.join(cwd, 'public'));
  fs.writeFileSync(path.join(cwd, 'src', 'index.js'), 'export const entry = true;');
  fs.writeFileSync(path.join(cwd, 'render-gate.config.json'), JSON.stringify({
    entry: 'src/index.js', compositions: { Test: { expect: { assets } } }, cache: { enabled: false },
    studio: { startTimeoutSec: 5 }, kane: { timeoutSec: 2 },
    render: { command: `${process.execPath} ${path.join(cwd, 'spy.js')}` },
  }));
  fs.writeFileSync(path.join(cwd, 'spy.js'), `require('node:fs').writeFileSync(${JSON.stringify(path.join(cwd, 'render-called'))}, 'yes');`);
  return cwd;
}

function invoke(cwd, mode, command = 'render', extra = []) {
  return spawnSync(process.execPath, [cli, command, 'Test', '--json', ...extra], {
    cwd,
    env: { ...process.env, RENDER_GATE_KANE_BIN: process.execPath, RENDER_GATE_KANE_SCRIPT: fake, FAKE_KANE_MODE: mode, RENDER_GATE_STUDIO_BIN: process.execPath, RENDER_GATE_STUDIO_SCRIPT: studio },
    encoding: 'utf8',
    timeout: 10000,
  });
}

test('strict failed gate never starts render command', () => {
  const cwd = project();
  const result = invoke(cwd, 'fail');
  assert.equal(result.status, 11, result.stderr);
  assert.equal(fs.existsSync(path.join(cwd, 'render-called')), false);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('warn mode proceeds to render after failed Kane gate', () => {
  const cwd = project();
  const result = invoke(cwd, 'fail', 'render', ['--warn']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(cwd, 'render-called')), true, `${result.stdout}\n${result.stderr}`);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('warn mode proceeds to render after static failure', () => {
  const cwd = project({ assets: ['public/missing.png'] });
  const result = invoke(cwd, 'pass', 'render', ['--warn']);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(fs.existsSync(path.join(cwd, 'render-called')), true);
  assert.equal(fs.existsSync(path.join(cwd, '.render-gate/runs')), true);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('fake Kane timeout and auth map to stable gate codes', () => {
  for (const [mode, code] of [['timeout', 13], ['auth', 12]]) {
    const cwd = project();
    const result = invoke(cwd, mode, 'check');
    assert.equal(result.status, code, `${result.stdout}\n${result.stderr}`);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
