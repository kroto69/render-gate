// Hashes gate inputs and tracks pass records, estimates, and hook retry state.
// Writes are atomic so interruption cannot leave partial JSON state behind.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function hashInputs({ root = process.cwd(), composition, config, version = '0.1.0' }) {
  const source = walk(path.resolve(root, 'src'));
  const referenced = source.flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return [...text.matchAll(/staticFile\(\s*(['\"])([^'\"]+)\1\s*\)/g)].map((match) => path.resolve(root, 'public', match[2]));
  });
  const files = [
    ...source,
    ...referenced,
    ...(config.compositions[composition].expect?.assets ?? []).map((asset) => path.resolve(root, asset.startsWith('public/') ? asset : path.join('public', asset))),
    ...(config.compositions[composition].spec ? [path.resolve(root, config.compositions[composition].spec)] : []),
    path.resolve(root, 'render-gate.config.json'),
  ].filter((file) => fs.existsSync(file)).sort();
  const hash = crypto.createHash('sha256');
  hash.update(`${composition}\0${version}\0`);
  for (const file of files) hash.update(path.relative(root, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
}

export function cacheHit(root, composition, hash) {
  const cache = readJson(path.resolve(root, '.render-gate/cache.json'), {});
  return cache[composition]?.hash === hash && cache[composition]?.passed === true;
}

export function writeCache(root, composition, hash, passed, runId) {
  const file = path.resolve(root, '.render-gate/cache.json');
  const cache = readJson(file, {});
  cache[composition] = { hash, passed, passedAt: passed ? new Date().toISOString() : null, runId };
  atomicJson(file, cache);
}

export function updateStats(root, composition, { passed, rendered = false }) {
  const file = path.resolve(root, '.render-gate/stats.json');
  const stats = readJson(file, { gateRuns: 0, passes: 0, failures: 0, rendersAvoidedEstimate: 0, sinceLastRenderFailures: {} });
  stats.gateRuns++;
  if (passed) stats.passes++;
  else {
    stats.failures++;
    stats.sinceLastRenderFailures[composition] = (stats.sinceLastRenderFailures[composition] ?? 0) + 1;
  }
  if (rendered) stats.sinceLastRenderFailures[composition] = 0;
  stats.rendersAvoidedEstimate = Object.values(stats.sinceLastRenderFailures).reduce((sum, value) => sum + value, 0);
  atomicJson(file, stats);
  return stats;
}

export function guardHook(root, composition, hash, reason, maxAttempts = 3, continuationActive = false) {
  const file = path.resolve(root, '.render-gate/state.json');
  const state = readJson(file, { attempts: {} });
  const key = `${composition}:${crypto.createHash('sha256').update(`${hash}\0${reason}`).digest('hex')}`;
  const attempts = (state.attempts[key] ?? 0) + 1;
  if (attempts >= maxAttempts || continuationActive) {
    return { giveUp: true, attempts: state.attempts[key] ?? maxAttempts, message: `render-gate: giving up after ${maxAttempts} attempts; human review needed` };
  }
  state.attempts[key] = attempts;
  atomicJson(file, state);
  return { giveUp: false, attempts };
}

export function resetHook(root, composition) {
  const file = path.resolve(root, '.render-gate/state.json');
  const state = readJson(file, { attempts: {} });
  for (const key of Object.keys(state.attempts)) {
    if (key.startsWith(`${composition}:`)) delete state.attempts[key];
  }
  for (const key of Object.keys(state.attempts)) {
    if (key.startsWith(`${composition}:`)) delete state.attempts[key];
  }
  atomicJson(file, state);
}
