import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNdjson, mapKaneExit } from '../../src/kane.js';

for (const [code, verdict, expected] of [[0, 'pass', 0], [1, 'fail', 11], [2, 'unknown', 12], [3, 'unknown', 13], [9, 'unknown', 12]]) {
  test(`maps provisional Kane exit ${code}`, () => {
    assert.equal(mapKaneExit(code, { verdict }).code, expected);
  });
}

test('parser ignores garbage and truncated records', () => {
  const parsed = parseNdjson('noise\n{"type":"run_end"\n{"type":"run_end","status":"failed","reason":"broken"}\n');
  assert.equal(parsed.verdict, 'fail');
  assert.equal(parsed.reason, 'broken');
});
