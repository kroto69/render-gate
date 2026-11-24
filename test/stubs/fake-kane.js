#!/usr/bin/env node
// Fake Kane adapter for offline contract and failure-path tests.
// Each mode emits deterministic output without account or browser access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.env.FAKE_KANE_MODE || 'pass';
if (mode === 'timeout') {
  setInterval(() => {}, 1000);
} else {
if (mode === 'garbage') {
  process.stdout.write('not json\n{"type":"run_end"\n');
  process.exit(1);
}
if (mode === 'auth') {
  process.stderr.write('authentication required\n');
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = path.join(root, 'test/fixtures', mode === 'fail' ? 'kane-fail.ndjson' : 'kane-pass.ndjson');
process.stdout.write(fs.readFileSync(fixture, 'utf8'));
process.exit(mode === 'fail' ? 1 : 0);
}
