import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'bin/render-gate.js');
const stub = path.join(root, 'scripts/studio-stub.js');

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForPort(port, open) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    const socket = net.connect(port, '127.0.0.1');
    const ready = await new Promise((resolve) => {
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (ready === open) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`port ${port} did not become ${open ? 'open' : 'closed'}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`cleanup kills Studio process group on ${signal}`, async () => {
    const port = await availablePort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gate-cleanup-'));
    const child = spawn(process.execPath, [cli, '_studio-only', '--port', String(port)], {
      cwd: dir, env: { ...process.env, RENDER_GATE_TEST_MODE: '1', RENDER_GATE_STUDIO_BIN: process.execPath, RENDER_GATE_STUDIO_SCRIPT: stub },
      stdio: 'ignore',
    });
    await waitForPort(port, true);
    child.kill(signal);
    await once(child, 'exit');
    await waitForPort(port, false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
