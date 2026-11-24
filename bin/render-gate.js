#!/usr/bin/env node
// Executable entry point for render-gate.
// Keeps CLI startup separate from command behavior.
import { main } from '../src/cli.js';

main(process.argv.slice(2));
