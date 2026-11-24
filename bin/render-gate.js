#!/usr/bin/env node
// Executable entry point for render-gate.
// Delegates command behavior to the ESM CLI module.
import { main } from '../src/cli.js';

main(process.argv.slice(2));
