# CLAUDE.md — rules for building `render-gate`

You are building `render-gate`. Read in this order: `PRD.md` → this file → `TASKS.md` →
`docs/KANE_SPECS.md` → `docs/DEMO_AND_SUBMISSION.md`.

## Mission in one paragraph
A Node.js CLI that verifies a Remotion Studio preview with Kane CLI before the expensive render. Fail → no render,
evidence returns to the agent. Pass → render once. Hackathon deadline: **26 Nov 2026 23:59 IST**. Ship a working,
clean-clone-installable tool with a real agent loop and a clear demo. Correctness and honesty beat feature count.

## Hard rules (never break)
1. **Never guess.** Flags, event names, exit codes, output schemas, and Remotion/Claude Code APIs marked
   `[UNVERIFIED]` in the PRD must be confirmed via `--help`, official docs, or a real run. Record every confirmation
   (or remaining uncertainty) in `NOTES.md`.
2. **Never claim a thing works until you ran it** and saw real output. Paste real terminal output in your report.
3. **Plain JavaScript, ESM, no TypeScript.** Node ≥ 18. Prefer built-ins. Every new dependency needs a one-line
   justification in `NOTES.md`. No postinstall scripts.
4. **All Kane-specific knowledge lives in `src/kane.js`.** Nothing else may know Kane flags or the NDJSON schema.
5. **In strict mode a failing gate must never start the render process.** Add a test that proves it.
6. **No orphan processes.** Every spawned child is registered with `cleanup.js` the moment it is spawned.
7. **Never commit secrets** (Kane tokens, `.env`). `.render-gate/` is git-ignored.
8. **Stop and ask the human** if: Kane cannot reach localhost; Kane auth needs the human's browser; a documented
   flag contradicts the PRD; a phase will take much longer than planned; you want to add a dependency or feature
   not in the PRD.
9. **Do not weaken tests or specs to make something pass.** If a Kane objective fails, fix the cause or report it.
10. **Cut scope in this order:** stretch items → README polish → extra specs. Never cut: cleanup, the cleanup test,
    the clean-clone test, the real agent loop.

## Working method
- Work phase by phase as in `TASKS.md`. After each phase: run the phase's verification commands, show the real
  output, commit, push.
- Commit messages: `phase N: <what>` (imperative, specific). Small commits are fine inside a phase.
- Before writing a module, write its test or a runnable example. Prefer the **fake Kane stub** (see below) for
  tests so tests cost no credits and run offline.
- Keep functions small and pure where possible; side effects (spawn, fs, network) live at the edges.
- Errors: throw `GateError(code, message, remediation)` (define once in `src/errors.js`); the CLI top level prints
  `message` + `remediation` and exits with the mapped code. No raw stack traces unless `--verbose`.
- Logging: human text → stderr; machine output (`--json`) → stdout only. Never mix.

## Project layout (do not reorganize without asking)
```
bin/render-gate.js
src/{cli.js, errors.js, commands/{render.js,init.js}, checks/static.js,
     studio.js, kane.js, cache.js, cleanup.js, report.js}
templates/{specs/, render-gate.config.json, claude-hook.json, CLAUDE.md.snippet}
examples/demo/        # tiny Remotion project, plain JS
test/{unit/, integration/, fixtures/, stubs/fake-kane.js}
docs/{KANE_SPECS.md, DEMO_AND_SUBMISSION.md, KANE_OUTPUT.md}   # KANE_OUTPUT.md is created by you in T1
NOTES.md  README.md  PRD.md  TASKS.md  CLAUDE.md  .gitignore  package.json
```
`package.json` MUST have a correct `"bin": {"render-gate": "bin/render-gate.js"}`, `"files"`, `"type": "module"`,
`"engines": {"node": ">=18"}`, and a `"test": "node --test"` script. `bin/render-gate.js` MUST start with
`#!/usr/bin/env node` and be executable.

## Fake Kane stub (for tests)
`test/stubs/fake-kane.js` is an executable Node script that imitates `kane-cli` using env vars:
`FAKE_KANE_MODE=pass|fail|timeout|auth|garbage`. It prints NDJSON shaped like the **real captured fixtures**
(from T1) and exits with the real exit codes. `src/kane.js` reads `RENDER_GATE_KANE_BIN` to override the binary
path (default `kane-cli`). This lets integration tests cover every branch without credits.

## Commands you will use
```
npm test                          # unit + integration (fake Kane)
node bin/render-gate.js --help
node bin/render-gate.js check <Composition> --json
node bin/render-gate.js render <Composition> --strict
ps aux | grep -Ei "remotion|kane" # after Ctrl+C: must show nothing from us
```

## Definition of done (project)
- [ ] `NOTES.md` has every UNVERIFIED item resolved or explicitly flagged.
- [ ] `npm test` is green, including the cleanup test and the init-idempotency test.
- [ ] Clean-clone test passes in `/tmp` (TASKS Phase 6).
- [ ] Real Kane run on `examples/demo`: broken → fails with a specific reason and **no render**; fixed → passes and
      **one** render.
- [ ] Hook-based loop demonstrated with Claude Code at least once (or the documented manual re-prompt fallback).
- [ ] README lets a stranger go from clone to first gate in under 5 minutes.
- [ ] Repo public, demo video recorded, submission checklist done (`docs/DEMO_AND_SUBMISSION.md`).

## Style
- 2-space indent, semicolons, single quotes, `const` by default, no default exports in `src/`.
- Comments explain *why*, not *what*. Each file starts with a 2–3 line purpose comment.
- Messages to users are short, specific, and say what to do next.

## Honesty clauses (for README and demo)
- State plainly that Kane verifies the preview's technical state, not aesthetics or audio sync.
- Label "renders avoided" as an estimate.
- Note Kane run time (tens of seconds to minutes) and credit use.
