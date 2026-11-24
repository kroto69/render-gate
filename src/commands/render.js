// Orchestrates static checks, preview verification, reporting, and optional render.
// Strict gate failure returns before render spawn; warn mode is the explicit override.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GateError } from '../errors.js';
import { checkStatic } from '../checks/static.js';
import { startStudio, findFreePort } from '../studio.js';
import { runKane } from '../kane.js';
import { report, writeSummary } from '../report.js';
import { register } from '../cleanup.js';
import { hashInputs, cacheHit, writeCache, updateStats, guardHook, resetHook } from '../cache.js';

function parseArgs(command, args) {
  const options = { strict: true, json: false, hook: false, noCache: false, onlyChanged: false, all: false, verbose: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--strict') options.strict = true;
    else if (arg === '--warn') options.strict = false;
    else if (arg === '--json') options.json = true;
    else if (arg === '--hook') options.hook = true;
    else if (arg === '--no-cache') options.noCache = true;
    else if (arg === '--only-changed') options.onlyChanged = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--config' || arg === '--out') options[arg.slice(2)] = args[++i];
    else if (arg.startsWith('-')) throw new GateError(1, `Unknown option: ${arg}`, 'Run render-gate --help.');
    else positional.push(arg);
  }
  if (command === 'render' && !positional[0]) throw new GateError(1, 'render requires a composition id.', 'Run render-gate render <Composition>.');
  if (command === 'check' && !positional[0] && !options.all) throw new GateError(1, 'check requires a composition id or --all.', 'Run render-gate check <Composition>.');
  options.composition = positional[0];
  options.command = command;
  return options;
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) throw new GateError(1, 'Config not found.', 'Run render-gate init.');
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) { throw new GateError(1, `Invalid config: ${error.message}`, 'Fix render-gate.config.json syntax.'); }
}

function runId(composition) {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${composition}`;
}

function objectiveFor(root, config, composition) {
  const item = config.compositions[composition];
  const expect = item.expect ?? {};
  const spec = item.spec && fs.existsSync(path.resolve(root, item.spec)) ? fs.readFileSync(path.resolve(root, item.spec), 'utf8') : '';
  const templatePath = path.resolve(root, 'specs/default.md');
  const template = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : `Verify Remotion Studio preview for ${composition}. Confirm composition selected, no error overlay, canvas nonblank, images visible, and captions inside canvas. Fail with specific observation.\n{{EXTRA_CHECKS}}`;
  return template
    .replaceAll('{{COMPOSITION_ID}}', composition)
    .replaceAll('{{WIDTH}}', String(expect.width ?? 'configured'))
    .replaceAll('{{HEIGHT}}', String(expect.height ?? 'configured'))
    .replaceAll('{{DURATION_SECONDS}}', String(expect.durationInSeconds ?? 'configured'))
    .replaceAll('{{FPS}}', String(expect.fps ?? 'configured'))
    .replaceAll('{{EXTRA_CHECKS}}', spec.replace(/^#.*$/gm, '').trim() || '');
}

async function renderMedia(config, composition, output, cwd, verbose) {
  // Config is trusted project-local data; split only on whitespace; no shell evaluation.
  const command = config.render?.command || 'npx remotion render';
  const [bin, ...base] = command.trim().split(/\s+/);
  const args = [...base, config.entry, composition, ...(output ? [output] : []), ...(config.render?.extraArgs ?? [])];
  const child = register(spawn(bin, args, { cwd, detached: process.platform !== 'win32', stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'] }));
  if (!verbose) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
}

async function runOne(command, composition, options, cwd, config, configPath) {
  const start = Date.now();
  const runDir = path.resolve(cwd, '.render-gate', 'runs', runId(composition));
  const result = { composition, ok: false, stage: 'config', code: 1, reason: '', evidence: [], cached: false, rendered: false, durationMs: 0, rendersAvoidedEstimate: 0 };
  let studio;
  try {
    checkStatic({ root: cwd, config, composition });
    result.stage = 'static';
    result.code = 10;
    const hash = hashInputs({ root: cwd, composition, config });
    if (!options.noCache && config.cache?.enabled !== false && cacheHit(cwd, composition, hash)) {
      result.ok = true;
      result.code = 0;
      result.stage = 'cache';
      result.cached = true;
      result.reason = 'Unchanged composition already passed; verification skipped.';
      result.durationMs = Date.now() - start;
      const stats = updateStats(cwd, composition, { passed: true });
      result.rendersAvoidedEstimate = stats.rendersAvoidedEstimate;
      if (command === 'render') {
        result.stage = 'render';
        const renderCode = await renderMedia(config, composition, options.out, cwd, options.verbose);
        if (renderCode !== 0) throw new GateError(15, `Remotion render exited ${renderCode}.`, 'Review render output.');
        result.rendered = true;
        result.stage = 'done';
      }
      writeSummary(runDir, result);
      return result;
    }
    const port = await findFreePort();
    studio = await startStudio({ entry: config.entry, port, runDir, timeoutSec: config.studio?.startTimeoutSec ?? 60, cwd });
    result.stage = 'studio';
    result.code = 14;
    const kane = await runKane({ url: `${studio.url}/${encodeURIComponent(composition)}`, objective: objectiveFor(cwd, config, composition), timeoutSec: config.kane?.timeoutSec ?? 180, runDir, extraArgs: config.kane?.extraArgs ?? [] });
    result.stage = 'kane-verification';
    result.code = kane.code;
    result.ok = kane.ok;
    result.reason = kane.reason || (kane.ok ? 'Preview passed.' : 'Kane verification failed without a specific reason.');
    result.evidence = kane.artifacts;
    writeCache(cwd, composition, hash, result.ok, path.basename(runDir));
    if (result.ok) resetHook(cwd, composition);
    if (!result.ok && options.hook) {
      const hookInput = process.env.RENDER_GATE_HOOK_INPUT ? JSON.parse(process.env.RENDER_GATE_HOOK_INPUT) : {};
      const continuationActive = hookInput.stop_hook_active === true || hookInput.continuation_active === true;
      const guard = guardHook(cwd, composition, hash, result.reason, config.loopGuard?.maxAutoFixAttempts ?? 3, continuationActive);
      if (guard.giveUp) {
        result.code = 0;
        result.reason = `${guard.message}. Last failure: ${result.reason}`;
      } else result.code = 2;
    }
    const stats = updateStats(cwd, composition, { passed: result.ok });
    result.rendersAvoidedEstimate = stats.rendersAvoidedEstimate;
    if (!result.ok && options.strict && command === 'render') {
      result.stage = 'kane-verification';
    } else if (command === 'render') {
      result.stage = 'render';
      result.code = 15;
      const renderCode = await renderMedia(config, composition, options.out, cwd, options.verbose);
      if (renderCode !== 0) throw new GateError(15, `Remotion render exited ${renderCode}.`, 'Review render output and project dependencies.');
      result.rendered = true;
      result.code = 0;
      result.stage = 'done';
      result.reason = result.ok ? 'Preview passed and render completed.' : 'Gate failed; render continued because --warn was set.';
    }
  } catch (error) {
    if (error instanceof GateError && error.code === 1) throw error;
    result.ok = false;
    result.code = error.code ?? 14;
    result.stage = result.code === 10 ? 'static' : result.code === 14 ? 'studio' : result.code === 15 ? 'render' : 'config';
    result.reason = error.message;
    if (error.remediation) result.reason += ` ${error.remediation}`;
  } finally {
    await studio?.stop();
  }
  result.durationMs = Date.now() - start;
  writeSummary(runDir, result);
  return result;
}

export async function runGateCommand(command, args) {
  const options = parseArgs(command, args);
  const cwd = process.cwd();
  const configPath = path.resolve(cwd, options.config || 'render-gate.config.json');
  const config = loadConfig(configPath);
  const compositions = options.all ? Object.keys(config.compositions ?? {}) : [options.composition];
  if (!compositions.length) throw new GateError(1, 'No configured compositions.', 'Run render-gate add <Composition> first.');
  let last = { ok: true, code: 0 };
  for (const composition of compositions) {
    const result = await runOne(command, composition, options, cwd, config, configPath);
    report(result, options);
    if (!result.ok) last = result;
    if (!result.ok && options.strict) {
      if (options.hook && result.code === 2) return 2;
      return result.code;
    }
  }
  return last.ok || !options.strict ? 0 : last.code;
}
