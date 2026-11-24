// Routes CLI commands and formats top-level failures.
// Keeping dispatch small makes help usable without project setup.
import { GateError } from './errors.js';
import { runGateCommand } from './commands/render.js';
import { initCommand, addCommand } from './commands/init.js';
import { startStudio } from './studio.js';

export const VERSION = '0.1.0';
export const USAGE = `render-gate <command> [options]

Commands:
  render <Composition>   Verify preview, then render on pass
  check [Composition]   Verify preview only (--all checks configured compositions)
  init [--yes]           Install render-gate into this project
  add <Composition>      Register composition and create its spec
  --help, --version      Show help or version

Options (check/render):
  --strict               Block render on any gate failure (default)
  --warn                 Report failures but allow render
  --json                 Emit one JSON result on stdout
  --hook                 Apply hook retry guard
  --only-changed         Skip unchanged passing compositions
  --no-cache             Disable cache
  --all                  Check all configured compositions
  --config <path>        Config path (default: render-gate.config.json)
  --out <path>           Render output path
  --verbose              Show subprocess output`;

export async function dispatch(args) {
  const [command, ...rest] = args;
  if (command === '_studio-only' && process.env.RENDER_GATE_TEST_MODE === '1') {
    const port = Number(rest[rest.indexOf('--port') + 1]);
    const studio = await startStudio({ entry: 'entry.js', port, runDir: '.render-gate/test-studio', timeoutSec: 10 });
    process.stdout.write(`${studio.url}\n`);
    await new Promise(() => {});
  }
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (command === 'check' || command === 'render') return runGateCommand(command, rest);
  if (command === 'init') return initCommand(rest);
  if (command === 'add') return addCommand(rest);
  throw new GateError(1, `Unknown command: ${command}`, 'Run render-gate --help.');
}

export async function main(args) {
  try {
    const code = await dispatch(args);
    if (Number.isInteger(code)) process.exitCode = code;
  } catch (error) {
    if (error instanceof GateError) {
      process.stderr.write(`${error.message}${error.remediation ? `\n${error.remediation}` : ''}\n`);
      process.exitCode = error.code;
      return;
    }
    process.stderr.write(`Unexpected error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
