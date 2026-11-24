// Runs deterministic checks before Studio or Kane can consume time or credits.
// Metadata extraction stays conservative until Remotion APIs are verified locally.
import fs from 'node:fs';
import path from 'node:path';
import { GateError } from '../errors.js';

function literalAssets(source) {
  const assets = [];
  const pattern = /staticFile\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  for (const match of source.matchAll(pattern)) assets.push(match[2]);
  return assets;
}

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : /\.[cm]?jsx?$/.test(entry.name) ? [full] : [];
  });
}

export function checkStatic({ root = process.cwd(), config, composition }) {
  const item = config.compositions[composition];
  if (!item) throw new GateError(1, `Composition "${composition}" not in config.`, `Valid ids: ${Object.keys(config.compositions).join(', ') || '(none)'}.`);
  const missing = [];
  for (const asset of item.expect?.assets ?? []) {
    const relative = asset.startsWith('public/') ? asset : path.join('public', asset);
    if (!fs.existsSync(path.resolve(root, relative))) missing.push(relative);
  }
  const srcRoot = path.resolve(root, 'src');
  for (const file of sourceFiles(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const asset of literalAssets(source)) {
      const full = path.resolve(root, 'public', asset);
      if (!fs.existsSync(full)) missing.push(path.relative(root, full));
    }
  }
  if (item.expect?.audio) {
    const sources = sourceFiles(srcRoot).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    if (!/\bAudio\b|audio\s*:/i.test(sources)) {
      throw new GateError(10, 'Audio expected but no audio reference found.', 'Reference an audio asset in the composition or set expect.audio to false.');
    }
  }
  if (missing.length) {
    const unique = [...new Set(missing)];
    throw new GateError(10, `Asset not found: ${unique.join(', ')}`, 'Fix staticFile paths or add the missing files under public/.');
  }
  return { ok: true, warnings: [] };
}
