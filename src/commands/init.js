// Installs config and agent instructions idempotently without running install scripts.
// Add registers a composition and creates its spec using native filesystem operations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GateError } from '../errors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const templates = path.join(root, 'templates');
const START = '<!-- render-gate:start -->';
const END = '<!-- render-gate:end -->';

function diff(before, after, filename) {
  if (before === after) return '';
  return `--- a/${filename}\n+++ b/${filename}\n-${before.split('\n').join('\n-')}\n+${after.split('\n').join('\n+')}`;
}

function parseOptions(args) {
  const options = { yes: !process.stdin.isTTY };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--yes' || args[i] === '-y') options.yes = true;
    else if (!args[i].startsWith('-')) options.positional = [...(options.positional ?? []), args[i]];
    else if (['--width', '--height', '--fps', '--seconds'].includes(args[i])) options[args[i].slice(2)] = Number(args[++i]);
    else if (args[i] === '--audio') options.audio = true;
    else throw new GateError(1, `Unknown option: ${args[i]}`, 'Run render-gate init --help or render-gate add --help.');
  }
  return options;
}

function applyFile(changes, filename, content) {
  const before = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  if (before === content) return;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
  changes.push(diff(before, content, path.relative(process.cwd(), filename)));
}

export async function initCommand(args) {
  const options = parseOptions(args);
  if (!options.yes) throw new GateError(1, 'Interactive setup is not supported.', 'Run render-gate init --yes.');
  const cwd = process.cwd();
  const changes = [];
  const configPath = path.join(cwd, 'render-gate.config.json');
  const templateConfig = JSON.parse(fs.readFileSync(path.join(templates, 'render-gate.config.json'), 'utf8'));
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : templateConfig;
  applyFile(changes, configPath, `${JSON.stringify(config, null, 2)}\n`);
  const defaultSpec = fs.readFileSync(path.join(templates, 'specs/default.md'), 'utf8');
  applyFile(changes, path.join(cwd, 'specs/default.md'), defaultSpec);
  const claudePath = path.join(cwd, 'CLAUDE.md');
  const snippet = fs.readFileSync(path.join(templates, 'CLAUDE.md.snippet'), 'utf8').trim();
  const current = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : '';
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  const replacement = start >= 0 && end >= start
    ? `${current.slice(0, start)}${snippet}${current.slice(end + END.length)}`
    : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${snippet}\n`;
  applyFile(changes, claudePath, replacement);
  const hookTemplate = JSON.parse(fs.readFileSync(path.join(templates, 'claude-hook.json'), 'utf8'));
  const settingsPath = path.join(cwd, '.claude/settings.json');
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
  const mergedHooks = { ...(settings.hooks ?? {}), ...hookTemplate.hooks };
  applyFile(changes, settingsPath, `${JSON.stringify({ ...settings, hooks: mergedHooks }, null, 2)}\n`);
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.scripts?.render !== 'render-gate render') {
      const updated = { ...pkg, scripts: { ...(pkg.scripts ?? {}), render: 'render-gate render' } };
      applyFile(changes, pkgPath, `${JSON.stringify(updated, null, 2)}\n`);
    }
  }
  process.stderr.write(changes.length ? `${changes.join('\n')}\n` : 'render-gate init: nothing to change\n');
  return 0;
}

export async function addCommand(args) {
  const options = parseOptions(args);
  const [composition] = options.positional ?? [];
  if (!composition || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(composition)) {
    throw new GateError(1, 'Valid composition id required.', 'Usage: render-gate add <Composition> --width N --height N --fps N --seconds N [--audio].');
  }
  const fields = ['width', 'height', 'fps', 'seconds'];
  for (const field of fields) {
    if (!Number.isFinite(options[field]) || options[field] <= 0) throw new GateError(1, `Missing or invalid --${field}.`, `Supply --${field} with a positive number.`);
  }
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'render-gate.config.json');
  if (!fs.existsSync(configPath)) throw new GateError(1, 'Config not found.', 'Run render-gate init --yes first.');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const spec = `specs/${composition}.md`;
  const candidate = {
    spec,
    expect: { width: options.width, height: options.height, fps: options.fps, durationInSeconds: options.seconds, audio: Boolean(options.audio), assets: [] },
  };
  const existing = config.compositions?.[composition];
  const changes = [];
  if (JSON.stringify(existing) !== JSON.stringify(candidate)) {
    config.compositions ??= {};
    config.compositions[composition] = candidate;
    applyFile(changes, configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  const specPath = path.join(cwd, spec);
  if (!fs.existsSync(specPath)) applyFile(changes, specPath, `# ${composition} — extra checks\n\n<!-- Add concrete, visible preview checks below. Do not weaken checks just to pass. -->\n`);
  process.stderr.write(changes.length ? `${changes.join('\n')}\n` : `render-gate add ${composition}: nothing to change\n`);
  return 0;
}
