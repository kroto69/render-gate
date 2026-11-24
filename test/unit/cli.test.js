import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'bin/render-gate.js');

test('help and version are available', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /render-gate <command>/);
  const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+/);
});
