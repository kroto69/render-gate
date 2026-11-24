import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../examples/demo');
const video = path.join(root, 'src/video.js');
const initial = fs.readFileSync(video, 'utf8');
test('demo break and fix scripts are idempotent and reversible', () => {
  try {
    const broken = spawnSync(process.execPath, ['scripts/break.js'], { cwd: root, encoding: 'utf8' });
    assert.equal(broken.status, 0);
    const brokenSource = fs.readFileSync(video, 'utf8');
    assert.match(brokenSource, /brand\/absent-logo\.png/);
    assert.match(brokenSource, /longest demo caption/);
    assert.equal(spawnSync(process.execPath, ['scripts/break.js'], { cwd: root }).status, 0);
    assert.equal(fs.readFileSync(video, 'utf8'), brokenSource);
    assert.equal(spawnSync(process.execPath, ['scripts/fix.js'], { cwd: root }).status, 0);
    const fixed = fs.readFileSync(video, 'utf8');
    assert.match(fixed, /logo\.svg/);
    assert.doesNotMatch(fixed, /longest demo caption/);
    assert.equal(spawnSync(process.execPath, ['scripts/fix.js'], { cwd: root }).status, 0);
    assert.equal(fs.readFileSync(video, 'utf8'), fixed);
  } finally {
    fs.writeFileSync(video, initial);
  }
});
