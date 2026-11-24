import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'bin/render-gate.js');
function run(cwd, ...args) { return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', input: '' }); }

test('init and add are idempotent; init/add/check work without a TTY', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-init-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"scripts":{}}\n');
  assert.equal(run(cwd, 'init', '--yes').status, 0);
  const snapshot = ['render-gate.config.json', 'CLAUDE.md', '.claude/settings.json', 'specs/default.md', 'package.json']
    .map((file) => fs.readFileSync(path.join(cwd, file), 'utf8'));
  const second = run(cwd, 'init', '--yes');
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /nothing to change/);
  assert.deepEqual(['render-gate.config.json', 'CLAUDE.md', '.claude/settings.json', 'specs/default.md', 'package.json']
    .map((file) => fs.readFileSync(path.join(cwd, file), 'utf8')), snapshot);
  assert.equal(run(cwd, 'add', 'PromoVideo', '--width', '1080', '--height', '1920', '--fps', '30', '--seconds', '15').status, 0);
  const addAgain = run(cwd, 'add', 'PromoVideo', '--width', '1080', '--height', '1920', '--fps', '30', '--seconds', '15');
  assert.equal(addAgain.status, 0, addAgain.stderr);
  assert.match(addAgain.stderr, /nothing to change/);
  assert.match(fs.readFileSync(path.join(cwd, 'render-gate.config.json'), 'utf8'), /PromoVideo/);
  assert.equal(fs.existsSync(path.join(cwd, 'specs/PromoVideo.md')), true);
  fs.rmSync(cwd, { recursive: true, force: true });
});
