// Isolates Kane flags, NDJSON assumptions, and process result interpretation.
// Vendor contract stays explicitly provisional until human permits a verified run.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from './cleanup.js';

// TODO(verify): binary name, run flags, and objective argument position.
export const KANE_BIN = process.env.RENDER_GATE_KANE_BIN || 'kane-cli';
export const KANE_RUN_ARGS = Object.freeze(['run', '--agent', '--headless', '--timeout']);
// TODO(verify): observed event names/fields may change across Kane CLI versions.
export const KANE_TERMINAL_EVENT = 'run_end';
// TODO(verify): process exit codes; do not treat this provisional mapping as vendor truth.
export const KANE_EXIT_CODES = Object.freeze({ pass: 0, failed: 11, auth: 12, timeout: 13, unknown: 12 });

export function parseNdjson(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object' && !Array.isArray(value)) events.push(value);
    } catch { /* partial and non-JSON records are retained in raw output, ignored here */ }
  }
  const terminal = [...events].reverse().find((event) => event.type === KANE_TERMINAL_EVENT);
  const status = terminal?.status ?? terminal?.verdict;
  return {
    events,
    verdict: status === 'passed' || status === 'pass' ? 'pass' : status === 'failed' || status === 'fail' ? 'fail' : 'unknown',
    reason: terminal?.reason || terminal?.summary || '',
    failedStep: terminal?.failed_step ?? terminal?.failedStep ?? null,
    artifacts: collectArtifacts(terminal),
  };
}

function collectArtifacts(value) {
  if (!value || typeof value !== 'object') return [];
  const result = [];
  const visit = (item) => {
    if (typeof item === 'string' && /\.(png|jpe?g|webp|evidence)(?:$|[?#])/i.test(item)) result.push(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return [...new Set(result)];
}

function mappedExit(code, parsed) {
  if (parsed.verdict === 'pass' && code === KANE_EXIT_CODES.pass) return { ok: true, code: 0 };
  if (code === 3) return { ok: false, code: KANE_EXIT_CODES.timeout };
  if (code === 2) return { ok: false, code: KANE_EXIT_CODES.auth };
  if (code === 1 || parsed.verdict === 'fail') return { ok: false, code: KANE_EXIT_CODES.failed };
  if (code === 0 && parsed.verdict === 'unknown') return { ok: false, code: KANE_EXIT_CODES.failed };
  return { ok: false, code: KANE_EXIT_CODES.unknown };
}

export function mapKaneExit(code, parsed = { verdict: 'unknown' }) {
  return mappedExit(code, parsed);
}

export async function runKane({ url, objective, timeoutSec = 180, runDir, extraArgs = [] }) {
  fs.mkdirSync(runDir, { recursive: true });
  const rawPath = `${runDir}/kane.ndjson`;
  const args = [...KANE_RUN_ARGS, String(timeoutSec), '--url', url, ...extraArgs, objective];
  const bin = process.env.RENDER_GATE_KANE_BIN || KANE_BIN;
  const actualArgs = process.env.RENDER_GATE_KANE_SCRIPT ? [process.env.RENDER_GATE_KANE_SCRIPT, ...args] : args;
  const started = Date.now();
  const child = register(spawn(bin, actualArgs, { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }));
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); } catch { /* exited */ }
  }, timeoutSec * 1000);
  const [code] = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status) => resolve([status]));
  }).finally(() => clearTimeout(timer));
  fs.writeFileSync(rawPath, stdout);
  if (stderr) fs.appendFileSync(rawPath, `\n# stderr\n${stderr}`);
  const parsed = parseNdjson(stdout);
  const mapped = timedOut ? { ok: false, code: KANE_EXIT_CODES.timeout } : mappedExit(code ?? 1, parsed);
  return {
    ...mapped,
    verdict: mapped.ok ? 'pass' : 'fail',
    reason: parsed.reason || (timedOut ? `Kane timed out after ${timeoutSec}s.` : stderr.trim() || `Kane exited ${code}.`),
    failedStep: parsed.failedStep,
    artifacts: [...parsed.artifacts, rawPath],
    exitCode: code,
    durationMs: Date.now() - started,
    rawPath,
    events: parsed.events,
  };
}
