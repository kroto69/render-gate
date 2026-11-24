// Parses top-level commands and owns process exit behavior.
// Keeps help and version available without project configuration.
import { GateError } from './errors.js';

const usage = `render-gate <command> [options]

Commands:
  render <composition>   Verify preview, then render if it passes
  check [composition]   Verify preview without rendering
  init                  Install render-gate into this project
  --help                Show help
  --version             Show version`;

export function main(args) {
  try {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      process.stdout.write(`${usage}\n`);
      return;
    }
    if (args[0] === '--version' || args[0] === '-v') {
      process.stdout.write('0.1.0\n');
      return;
    }
    throw new GateError(1, `Command not implemented: ${args[0]}`, 'Run render-gate --help.');
  } catch (error) {
    if (error instanceof GateError) {
      process.stderr.write(`${error.message}\n${error.remediation}\n`);
      process.exitCode = error.code;
      return;
    }
    process.stderr.write(`Unexpected error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
