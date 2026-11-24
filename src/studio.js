// Starts Remotion Studio in an isolated process group and waits for HTTP readiness.
// The port is selected locally; the documented tiny bind race is handled by startup failure reporting.
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnTracked, cleanup } from './cleanup.js';
import { GateError } from './errors.js';

export async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function httpReady(url, timeout = 1000) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.setTimeout(timeout, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

export async function waitReady(url, timeoutSec = 60, child = null) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new GateError(14, `Studio exited before becoming ready (exit ${child.exitCode}).`, 'See .render-gate/runs/*/studio.log and verify Remotion dependencies.');
    }
    if (await httpReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new GateError(14, `Studio not ready in ${timeoutSec} seconds.`, 'Check entry, Remotion dependencies, browser installation, and studio.log.');
}

export async function startStudio({ entry, port, runDir, timeoutSec = 60, cwd = process.cwd() }) {
  const actualPort = port ?? await findFreePort();
  const url = `http://localhost:${actualPort}`;
  fs.mkdirSync(runDir, { recursive: true });
  const logPath = path.join(runDir, 'studio.log');
  const log = fs.openSync(logPath, 'a');
  const testBin = process.env.RENDER_GATE_STUDIO_BIN;
  const args = testBin
    ? [process.env.RENDER_GATE_STUDIO_SCRIPT, entry, '--port', String(actualPort)]
    : ['remotion', 'studio', entry, '--port', String(actualPort), '--no-open', '--ipv4'];
  let child;
  try {
    child = spawnTracked(testBin || 'npx', args, { cwd, detached: process.platform !== 'win32', stdio: ['ignore', log, log] });
    await waitReady(url, timeoutSec, child);
  } catch (error) {
    if (child) await cleanup({ graceMs: 3000 });
    if (error.code === 'ENOENT') {
      throw new GateError(14, 'Could not start Remotion Studio: npx not found.', 'Install Node.js 18+ and project dependencies.');
    }
    throw error;
  } finally {
    fs.closeSync(log);
  }
  return {
    child,
    port: actualPort,
    url,
    async stop() {
      await cleanup();
    },
  };
}
