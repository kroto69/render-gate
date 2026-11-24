import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashInputs, cacheHit, writeCache, guardHook } from '../../src/cache.js';

test('input hash stable and changes with source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-cache-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/a.js'), 'one');
  const config = { compositions: { X: { expect: {} } } };
  const a = hashInputs({ root, composition: 'X', config });
  assert.equal(hashInputs({ root, composition: 'X', config }), a);
  fs.writeFileSync(path.join(root, 'src/a.js'), 'two');
  assert.notEqual(hashInputs({ root, composition: 'X', config }), a);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cache records only passing hashes and hook guard stops at configured limit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-guard-'));
  writeCache(root, 'X', 'abc', true, 'run-1');
  assert.equal(cacheHit(root, 'X', 'abc'), true);
  assert.equal(cacheHit(root, 'X', 'different'), false);
  assert.equal(guardHook(root, 'X', 'abc', 'broken', 3).giveUp, false);
  assert.equal(guardHook(root, 'X', 'abc', 'broken', 3).giveUp, false);
  assert.equal(guardHook(root, 'X', 'abc', 'broken', 3).giveUp, true);
  assert.equal(guardHook(root, 'X', 'different', 'broken', 3).giveUp, false);
  fs.rmSync(root, { recursive: true, force: true });
});
