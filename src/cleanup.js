// Tracks spawned process groups so every CLI exit path can stop its children.
// Signal handlers wait for graceful termination before forcing remaining processes down.
import { spawn } from 'node:child_process';

const children = new Set();
let handlersInstalled = false;
let shuttingDown = false;

export function register(child) {
  children.add(child);
  child.once('exit', () => children.delete(child));
  child.once('error', () => children.delete(child));
  installHandlers();
  return child;
}

export function spawnTracked(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
    ...options,
  });
  return register(child);
}

function signalTree(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.unref();
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

export async function cleanup({ graceMs = 3000 } = {}) {
  const active = [...children];
  for (const child of active) signalTree(child, 'SIGTERM');
  if (!active.length) return;
  await Promise.race([
    Promise.all(active.map((child) => new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve);
      child.once('error', resolve);
    }))),
    new Promise((resolve) => setTimeout(resolve, graceMs)),
  ]);
  for (const child of active) signalTree(child, 'SIGKILL');
}

function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  process.on('exit', () => {
    for (const child of children) signalTree(child, 'SIGKILL');
  });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      await cleanup();
      process.exit(128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1));
    });
  }
  process.on('uncaughtException', async (error) => {
    process.stderr.write(`Unexpected error: ${error.message}\n`);
    if (!shuttingDown) {
      shuttingDown = true;
      await cleanup();
    }
    process.exit(1);
  });
  process.on('unhandledRejection', async (error) => {
    process.stderr.write(`Unexpected error: ${error?.message ?? error}\n`);
    if (!shuttingDown) {
      shuttingDown = true;
      await cleanup();
    }
    process.exit(1);
  });
}

export function activeChildren() {
  return [...children];
}
