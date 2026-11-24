# render-gate — Product Requirements Document

> Read this file first, then `CLAUDE.md` (rules), `TASKS.md` (what to build, in order),
> `docs/KANE_SPECS.md` (Kane objectives + config) and `docs/DEMO_AND_SUBMISSION.md` (demo + submit).

## 0. Document conventions

- **[VERIFIED]** = confirmed in official docs or by running the command. **[UNVERIFIED]** = assumed from
  secondary sources; you MUST confirm with `--help` or the docs before relying on it, and record the result
  in `NOTES.md`. Never guess a flag, event name, exit code, or output schema.
- **MUST / SHOULD / MAY** follow RFC 2119 meaning.
- Requirement IDs (FR-x, NFR-x) are referenced from `TASKS.md` and tests.

## 1. Overview

**render-gate** is a Node.js CLI that sits between an AI coding agent and an expensive Remotion/ffmpeg render.

Instead of letting the agent render a video and discover bugs afterwards, render-gate:

1. runs fast deterministic checks,
2. starts the Remotion Studio preview,
3. has **Kane CLI** (an AI browser tester that returns pass/fail from a real browser) verify the preview like a
   viewer would,
4. renders the final `.mp4` **only if verification passes**.

On failure the agent receives a short, actionable failure report plus evidence (screenshots/logs), fixes the
composition in the cheap preview loop, and tries again. No render has happened yet.

One-liner for judges:
> Agents write Remotion code fast but can't see the preview. Kane is the agent's eyes: it opens the Studio like
> a viewer, catches broken assets and clipped text, and the agent fixes them before the expensive render runs.

## 2. Context: the hackathon

- Challenge: "Build it with any agent, verify it with Kane." Build an app, agent, or workflow with an AI coding
  agent; verify it with Kane CLI; demo on video; ship by **26 Nov 2026, 11:59 PM IST** (= 27 Nov 01:29 WIB).
  Solo or teams up to 4. We are solo.
- Kane CLI is the verification layer in the agent loop: "describe a flow in plain English, get a pass or fail from
  a real browser". Wiring it into the agent loop (hook, re-prompt, spec) is the headline requirement.
- Judging criteria are not fully known. Optimise for: it runs from a clean clone, the agent loop is real (not
  manual), the demo video is clear, and Kane's role is essential, not decorative. Check the hackathon site for
  submission format and record it in `NOTES.md`.

## 3. Problem

AI agents generate Remotion compositions quickly but cannot see the result. Typical failures:

- an `<Img>`/`staticFile()` path is wrong, so the asset is missing,
- captions overflow the frame,
- the Studio shows an error overlay (runtime exception in a component),
- frames are blank because of a timing/sequence mistake,
- the composition id/duration/aspect ratio does not match what was asked.

Today these are found **after** a slow render, by a human watching the mp4. Every fix costs another render.
The revision loop is expensive exactly where it should be cheap.

## 4. Insight and solution

The Studio preview is a browser app. Anything visible in it can be verified by a browser tester. Moving
verification **before** the render turns the technical revision loop from "minutes per iteration" into
"seconds-to-a-minute per iteration", and makes the render a single closing step.

Honest scope: Kane verifies what is **visible and behavioural in the preview**. It does not judge aesthetics,
pacing, music/audio sync, or animation smoothness. Humans still review the final mp4 for creative quality.

## 5. Goals, non-goals, success metrics

### Goals
- G1. A CLI installable into any Remotion project in one command, idempotently.
- G2. A gate that blocks the render on technical failure and returns evidence the agent can act on.
- G3. A real agent loop with Claude Code (hook + CLAUDE.md) that self-corrects without human help.
- G4. Zero zombie processes: Studio and Kane subprocesses always die.
- G5. A reproducible demo (break → fail → fix → pass → single render) and a README a stranger can follow.

### Non-goals
- Judging visual quality, audio sync, or "is the video good".
- Replacing Remotion's own rendering, or reimplementing ffmpeg.
- Multi-agent orchestration, dashboards, web UI, cloud service.
- Supporting every OS equally. Target macOS + Linux; Windows is best-effort.
- Mobile/emulator testing with Kane.

### Success metrics (for the demo)
- M1. On the demo project, a planted bug is caught by the gate and **no render runs**.
- M2. After the agent fixes it, the gate passes and **exactly one render** runs.
- M3. Zero orphan processes after Ctrl+C at any stage (verified by test).
- M4. Clean-clone install-to-first-gate in under 5 minutes following the README.
- M5. "Renders avoided" counter shown in the report (estimate, defined in §15).

## 6. Users

- **P1 — Creator using an agent.** Prompts Claude Code: "make a 15s 9:16 promo video with animated text and a
  logo". Wants a correct mp4 without babysitting renders.
- **P2 — The agent itself (primary consumer of our output).** Reads stderr/JSON from the gate, fixes code, reruns.
  Therefore output MUST be short, specific, and machine-friendly. Treat the agent as a first-class user.

### User stories
- US1. As a creator, when my agent finishes editing a composition, the gate runs automatically.
- US2. As an agent, when the gate fails I get the stage, the reason, and where the evidence is.
- US3. As a creator, I can run `render-gate render PromoVideo` and be sure ffmpeg does not start if the preview
  is broken.
- US4. As a creator, I can choose `--warn` to log problems without blocking.
- US5. As a creator, I can install the gate into an existing project with `init` and undo/see what changed.
- US6. As a creator, I never end up with a stuck Studio process on my machine.
- US7. As a creator, unchanged compositions that already passed are not re-verified (credits and time saved).

## 7. System architecture

```
 user prompt
     |
     v
 Claude Code (agent)  --edits-->  Remotion composition (src/, public/)
     ^                                   |
     | failure report (stderr / JSON)    | Stop hook / manual call
     |                                   v
     |                         render-gate check|render
     |                                   |
     |        1. static checks (Node, no LLM)  --fail--> report
     |        2. cache lookup (hash) ----hit(pass)----> skip to 6
     |        3. spawn Remotion Studio (random port)
     |        4. kane-cli run --url http://localhost:PORT  (browser verifies preview)
     |        5. parse NDJSON + exit code --fail--> report
     |        6. (render only) npx remotion render  -> .mp4
     +-----------------------------------+
```

### Components (one responsibility each)
| File | Responsibility |
|---|---|
| `bin/render-gate.js` | Shebang entry; calls `src/cli.js`. |
| `src/cli.js` | Parse argv, route commands, `--help`, version. |
| `src/commands/render.js` | Orchestrates gate + render (`check` = same without step 6). |
| `src/commands/init.js` | Idempotent project setup. |
| `src/checks/static.js` | Deterministic checks. No Kane, no LLM. |
| `src/studio.js` | Start/ready-poll/stop Remotion Studio. |
| `src/kane.js` | **The only file that knows Kane's CLI details** (adapter). |
| `src/cache.js` | Content hashing + pass records. |
| `src/cleanup.js` | Process registry + kill on every exit path. |
| `src/report.js` | Human report (stderr), JSON result (stdout with `--json`), stats. |

Design rule: all Kane-specific assumptions live in `src/kane.js` so a flag/schema difference is a one-file fix.

## 8. CLI specification

```
render-gate <command> [options]

Commands
  render <composition>   Gate, then render the mp4 if the gate passes.
  check  [<composition>] Gate only (no render). With --all, every configured composition.
  init                   Install into the current Remotion project (idempotent).
  --help, --version

Options (render/check)
  --strict               Block on any failure (DEFAULT).
  --warn                 Log failures, do not block (render proceeds).
  --only-changed         Skip compositions whose content hash already passed.
  --all                  (check) All compositions in config.
  --hook                 Hook mode: on failure exit 2 and write feedback to stderr (see §14).
  --json                 Print a final JSON result object to stdout; human text goes to stderr.
  --no-cache             Ignore and do not write the cache.
  --config <path>        Default: ./render-gate.config.json
  --out <path>           (render) output file; default as Remotion's default.
  --verbose              Stream Studio/Kane logs.
```

### render-gate exit codes (own table; stable contract)
| Code | Meaning |
|---|---|
| 0 | Gate passed (and render succeeded, for `render`). In `--warn`, also 0 even on gate failure (logged). |
| 1 | Usage/config error (bad args, missing config, unknown composition). |
| 2 | Hook mode only: gate failed, feedback written to stderr for the agent (§14). |
| 10 | Static check failed. |
| 11 | Kane verification failed. |
| 12 | Kane setup/auth error (not installed, not logged in, no credits). |
| 13 | Kane timeout. |
| 14 | Remotion Studio failed to start or never became ready. |
| 15 | Render command failed after a passing gate. |

## 9. Configuration — `render-gate.config.json`

```json
{
  "entry": "src/index.ts",
  "mode": "strict",
  "compositions": {
    "PromoVideo": {
      "spec": "specs/PromoVideo.md",
      "expect": {
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "durationInSeconds": 15,
        "audio": false,
        "assets": ["public/logo.png"]
      }
    }
  },
  "studio": { "startTimeoutSec": 60 },
  "kane": { "timeoutSec": 180, "extraArgs": [] },
  "cache": { "enabled": true, "dir": ".render-gate" },
  "render": { "command": "npx remotion render", "extraArgs": [] },
  "loopGuard": { "maxAutoFixAttempts": 3 }
}
```
- `entry` MAY be auto-detected (Remotion config / `src/index.*`); explicit value wins.
- Unknown keys MUST produce a warning, not a crash. Missing required keys produce exit 1 with a fix hint.

## 10. Functional requirements

### Gate
- **FR-1 Static checks.** Before any Kane run, verify for the target composition: (a) declared `expect.assets`
  exist on disk; (b) heuristically scan `src/**` for `staticFile("…")` string literals and verify they exist under
  `public/`; (c) if `expect.audio` is true, an audio asset is referenced; (d) composition metadata (id, width,
  height, fps, durationInFrames) from Remotion matches `expect`. Any failure → exit 10, Kane NOT run (saves credits).
  Metadata SHOULD come from `@remotion/bundler` + `@remotion/renderer` `getCompositions` resolved from the user's
  project (`createRequire`). [UNVERIFIED: confirm API signatures in Remotion docs.]
- **FR-2 Studio lifecycle.** Start `remotion studio` on a random free port without auto-opening a browser, in its
  own process group. Wait until `http://localhost:PORT` answers, with timeout → exit 14. Stop it afterwards.
- **FR-3 Kane verification.** Run Kane against `http://localhost:PORT` with the composition-specific objective
  (see `docs/KANE_SPECS.md`). Capture full stdout/stderr to `.render-gate/runs/<id>/kane.ndjson`.
- **FR-4 Evidence parsing.** Parse NDJSON line by line, tolerating non-JSON lines. Produce `summary.json` with:
  verdict, failed step (if any), reason text, screenshot/artifact paths, duration. Do NOT rely on Kane's exit code
  alone; use both and prefer the more severe interpretation if they disagree.
- **FR-5 Exit-code mapping.** Map Kane exit codes to our codes (§12). The mapping table lives in README and
  `NOTES.md`. [UNVERIFIED until confirmed.]
- **FR-6 Strict/warn.** `--strict` (default): any failure blocks. `--warn`: print the same report, then continue.
- **FR-7 Render step.** Only after pass (or in `--warn`), run the configured render command and stream its output.
  Failure → exit 15. In strict mode a failing gate MUST NEVER start the render process.
- **FR-8 Cache.** See §15. A passing hash MAY skip Studio+Kane. `--no-cache` disables.
- **FR-9 Reporting.** Failure report format in §17. `--json` emits a stable result object (§8, §17).
- **FR-10 Stats.** Maintain `.render-gate/stats.json` (renders avoided, gate runs, pass/fail counts) and print the
  estimate in the report.

### Lifecycle & safety
- **FR-11 Cleanup.** Kill Studio and Kane process trees on every exit path (§16).
- **FR-12 Chromium check.** If Studio/Kane cannot launch a browser, print an actionable message (how to install,
  what flag/env to use) rather than a stack trace.

### Install & agent loop
- **FR-13 init.** Idempotent; creates `specs/`, `render-gate.config.json`, adds agent instructions to `CLAUDE.md`
  (once, delimited by markers), installs the Claude Code hook config, rewrites the project's `render` npm script
  to call `render-gate render` only if not already done, and prints a unified diff of everything changed.
  Running it twice changes nothing. No postinstall scripts.
- **FR-14 Hook mode.** `--hook` behaviour and loop guard in §14.
- **FR-15 Demo scripts.** `examples/demo` provides `demo:break` and `demo:fix` (§19).

## 11. Non-functional requirements

- **NFR-1 Performance.** Static checks < 5 s. Studio ready < 30 s typical. Kane run typically 30–120 s (it uses an
  LLM; document this honestly). Cache hit path < 2 s.
- **NFR-2 Reliability.** No orphan processes after normal exit, Ctrl+C, SIGTERM, crash. Verified by test.
- **NFR-3 Portability.** Node ≥ 18, plain ESM JavaScript (no TypeScript), minimal deps (prefer built-ins:
  `child_process`, `net`, `http`, `crypto`, `fs`, `path`). macOS/Linux first.
- **NFR-4 Security.** Never log or commit Kane credentials/tokens. `.render-gate/` is git-ignored. No telemetry.
- **NFR-5 Clarity.** Every error has a code, a one-line cause, and a one-line remediation. No raw stack traces
  unless `--verbose`.
- **NFR-6 Idempotency.** `init` and cache writes are safe to repeat.
- **NFR-7 Cost awareness.** Kane runs consume credits (free tier ≈ 10,000 credits / 30 days [UNVERIFIED]). Skip Kane
  when static checks fail or the hash already passed.

## 12. Kane integration contract

Everything here is the **assumed** contract; confirm and record in `NOTES.md` (task T1).

| Topic | Assumption | Status |
|---|---|---|
| Install | `npm install -g @testmuai/kane-cli` | UNVERIFIED |
| Auth | `kane-cli login` (may open a browser; the human does this once) | UNVERIFIED |
| Invocation | `kane-cli run --url <URL> "<plain-English objective>"` | UNVERIFIED |
| Agent mode | `--agent` (structured output) and `--headless` | UNVERIFIED |
| Output | NDJSON events on stdout in agent mode; schema unknown until captured | UNVERIFIED |
| Exit codes | 0–3 exist. Working hypothesis: 0 pass, 1 verification failed, 2 setup/auth, 3 timeout | UNVERIFIED |
| Agent docs | https://www.testmuai.com/kane-cli/agents.md | URL from vendor materials |
| Targets | Browser (any OS). Emulators/simulators need macOS Apple Silicon (irrelevant to us) | UNVERIFIED |

Mapping (apply only after verification):

| Kane exit | Meaning (hypothesis) | render-gate exit |
|---|---|---|
| 0 | pass | continue |
| 1 | verification failed | 11 |
| 2 | setup / auth error | 12 |
| 3 | timeout | 13 |
| other | unknown | 12 with raw code in message |

Parsing rules:
- Never assume a schema. Capture a real run into `test/fixtures/kane-pass.ndjson` and `kane-fail.ndjson` (fail one
  by pointing Kane at a page where the objective is false). Write the observed schema to `docs/KANE_OUTPUT.md`.
- Keep the raw stream. Derive `summary.json` defensively: unknown event types are ignored, not fatal.
- If localhost is unreachable from Kane (e.g. Kane runs remotely), STOP and ask. Fallbacks are in
  `docs/DEMO_AND_SUBMISSION.md` §6.

## 13. Remotion integration contract

| Topic | Assumption | Status |
|---|---|---|
| Studio | `npx remotion studio [entry] --port <n> --no-open` | UNVERIFIED (check flags) |
| Deep link | `http://localhost:<port>/<CompositionId>` opens that composition | UNVERIFIED |
| Render | `npx remotion render [entry] <CompositionId> [out]` | UNVERIFIED (check arg order) |
| Metadata | `getCompositions(bundleLocation)` from `@remotion/renderer`; `bundle()` from `@remotion/bundler` | UNVERIFIED |
| ffmpeg | Remotion invokes/bundles ffmpeg itself; we never call ffmpeg directly | UNVERIFIED |
| Static files | `staticFile("name")` resolves to `public/name` | VERIFIED (common knowledge, still confirm) |

Resolve Remotion packages from the **user's** project, not from render-gate's own `node_modules`.

## 14. Claude Code integration

### 14.1 Agent instructions (`templates/CLAUDE.md.snippet`, injected by `init` between markers)
```
<!-- render-gate:start -->
## Video rendering rules
- Never run `remotion render` directly. Always run `npx render-gate render <Composition>`.
- After editing any composition, asset, or spec, run `npx render-gate check <Composition> --json`.
- If it fails, read the `reason`, `stage`, and `evidence` fields, fix the composition, and rerun.
  Do not render until `check` passes. Do not edit specs/ just to make a failing check pass.
- Creative decisions (hook, copy, pacing) are yours; technical correctness is verified by the gate.
<!-- render-gate:end -->
```

### 14.2 Hook (`templates/claude-hook.json`)
Intent: after the agent finishes a turn, run `render-gate check --all --only-changed --hook`. On failure, exit 2 and
write feedback to stderr so the agent continues and fixes it. [UNVERIFIED: confirm in current Claude Code docs the
event name (likely `Stop`), the config location (`.claude/settings.json`), the stdin JSON payload (including a flag
that indicates the hook already forced a continuation), and that exit code 2 feeds stderr back to the model.]

### 14.3 Loop guard (REQUIRED)
A failing gate must not trap the agent in an infinite loop.
- Keep `attempts` per (composition, hash-of-failure-reason) in `.render-gate/state.json`.
- If attempts ≥ `loopGuard.maxAutoFixAttempts` (default 3), stop blocking: exit 0, print
  "render-gate: giving up after N attempts; human review needed" plus the last report.
- If the hook payload says a continuation is already active, apply the guard immediately.
- Reset attempts when a gate passes.

## 15. Caching and stats

- **Key:** `sha256` over: sorted contents of `src/**`, referenced `public/**` assets, the composition's spec file,
  `render-gate.config.json`, and the render-gate version. Include the composition id.
- **Store:** `.render-gate/cache.json`: `{ "<comp>": { "hash": "...", "passedAt": "ISO", "runId": "..." } }`.
- **Use:** if the stored hash equals the current hash and the last result was pass → skip Studio+Kane.
- **Invalidate:** any change to the inputs above, or `--no-cache`.
- **Renders avoided (estimate):** number of gate failures for a composition since its last successful render.
  Label it "estimated" everywhere. Stored in `.render-gate/stats.json`.

## 16. Cleanup design

- Spawn Studio and Kane with `detached: true` on POSIX so each has its own process group; kill with
  `process.kill(-pid, 'SIGTERM')`, then `SIGKILL` after a 3 s grace. On Windows use `taskkill /pid <pid> /T /F`.
- `cleanup.js` keeps a registry of child pids and registers handlers once for: `exit`, `SIGINT`, `SIGTERM`,
  `SIGHUP`, `uncaughtException`, `unhandledRejection`. Handlers MUST be idempotent and MUST re-raise the correct
  exit code. The synchronous `exit` handler can only do sync kills; do the main work in the signal handlers.
- Also kill children when the parent is killed with SIGKILL where feasible (document the limit honestly).
- Free-port selection: listen on port 0, read the port, close, then pass it to Studio (accept the tiny race;
  retry once on `EADDRINUSE`).
- **Test (required):** spawn the CLI as a child, wait until Studio is up, send SIGINT/SIGTERM, assert that no
  process from the registry (and nothing listening on the port) remains. Run on both signals.

## 17. Output contracts

### 17.1 Human report (stderr), on failure
```
RENDER-GATE FAILED  composition=PromoVideo  stage=kane-verification  code=11
Reason:   Logo image did not load in the last scene (frame 60 shows an empty area).
Evidence: .render-gate/runs/2026-11-25T10-02-11Z-PromoVideo/screenshot-2.png
          .render-gate/runs/2026-11-25T10-02-11Z-PromoVideo/kane.ndjson
Next:     Check that staticFile("logo.png") exists in public/ and the <Img> src is correct.
Renders avoided (estimated): 2
```
Rules: ≤ 12 lines; first line always `RENDER-GATE FAILED`; `Reason` must be specific (never just "failed").
`Next` is a hint generated from simple heuristics per stage; if unknown, omit it.

### 17.2 JSON result (stdout with `--json`)
```json
{
  "composition": "PromoVideo",
  "ok": false,
  "stage": "kane-verification",
  "code": 11,
  "reason": "Logo image did not load in the last scene.",
  "evidence": [".render-gate/runs/<id>/screenshot-2.png", ".render-gate/runs/<id>/kane.ndjson"],
  "cached": false,
  "rendered": false,
  "durationMs": 74211,
  "rendersAvoidedEstimate": 2
}
```
`stage` ∈ `config | static | cache | studio | kane-verification | render | done`.

### 17.3 Run folder layout
```
.render-gate/
  cache.json  stats.json  state.json
  runs/<ISO>-<Composition>/
     summary.json  kane.ndjson  studio.log  screenshot-*.png  (whatever Kane provides)
```

## 18. Error catalogue (message + remediation)

| Situation | Code | Message | Remediation |
|---|---|---|---|
| No config | 1 | Config not found | Run `render-gate init` |
| Unknown composition | 1 | Composition "X" not in config | List valid ids |
| Missing asset | 10 | Asset not found: public/logo.png | Fix path or add file |
| Kane not installed | 12 | `kane-cli` not found | `npm i -g @testmuai/kane-cli` |
| Kane not logged in | 12 | Kane auth required | Run `kane-cli login` yourself |
| Studio never ready | 14 | Studio not ready in 60 s | Check entry, port, deps; see studio.log |
| No Chromium | 14/12 | Browser not available | Install Chromium/Chrome; see docs |
| Kane timeout | 13 | Kane exceeded 180 s | Raise `kane.timeoutSec` or simplify objective |
| Render failed | 15 | Remotion render exited N | See render output |

## 19. Demo project requirements (`examples/demo`)

- Tiny Remotion project: 15 s, 1080×1920, 30 fps, animated headline text, an `<Img>` logo via `staticFile`, and a
  caption element. Plain JS.
- `npm run demo:break` plants **two** bugs: logo path wrong (missing asset) and caption text too long/clipped.
  `npm run demo:fix` restores the working version. Both are idempotent and print what they changed.
- Must work with the gate's default objective (`docs/KANE_SPECS.md`).

## 20. Testing strategy

| Area | Test |
|---|---|
| CLI parsing | unit: flags, unknown command, `--help` |
| Static checks | unit: missing asset, wrong dimensions, audio expectation |
| Hashing/cache | unit: same input → same hash; any change → different |
| Kane parser | unit: fixtures `kane-pass/fail.ndjson`, garbage lines, empty stream |
| Exit mapping | unit: table-driven |
| Cleanup | integration: SIGINT/SIGTERM mid-run leaves no processes (REQUIRED) |
| init | integration: run twice, second run is a no-op (diff empty) |
| Gate flow | integration with a **fake kane-cli** script (env var points to a stub) for pass/fail/timeout/auth |
| End-to-end | manual with real Kane on `examples/demo`, plus clean-clone test (TASKS Phase 6) |

Use Node's built-in `node:test` (no extra dependency). The fake Kane stub makes CI-free, credit-free tests.

## 21. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Kane cannot reach localhost | Blocks core flow | Verify in T1 first. Fallbacks in DEMO doc §6 |
| Kane flags/schema differ from assumptions | Rework | Adapter isolation in `kane.js`; fixtures from a real run |
| Kane run is slow/flaky (LLM) | Poor UX | Static checks first, cache, specific objectives, timeout, retry-once on flake only for timeout |
| Credits exhausted | Gate unusable | Skip Kane on static fail/cache hit; few specs |
| Zombie processes | Judges notice | Cleanup design + tests (NFR-2) |
| Hook infinite loop | Agent stuck | Loop guard (§14.3) |
| Hook semantics differ | Loop not wired | Read current docs (T4); manual re-prompt fallback documented |
| Scope creep | Misses deadline | Stretch list is last; see TASKS priorities |

## 22. Open questions (resolve in NOTES.md, in this order)

1. Does Kane CLI work against `http://localhost:PORT` from this machine? (If not, what is the supported way?)
2. Exact `kane-cli run` flags for URL, objective, agent mode, headless, timeout.
3. Real NDJSON schema and the true meaning of exit codes 0–3.
4. Does Kane return screenshot paths/URLs? Where do they live?
5. Remotion Studio flags (`--port`, `--no-open`) and composition deep-link format.
6. Claude Code hook event name/config/payload/exit-code semantics.
7. Hackathon submission format (repo link? video link? form fields?).

## 23. Glossary

- **Composition** — a Remotion video definition (id, size, fps, duration, React component).
- **Studio** — Remotion's browser preview/editor.
- **Gate** — the verification step before rendering.
- **Kane CLI** — TestMu AI's CLI that executes plain-English objectives in a real browser and returns pass/fail.
- **Objective/spec** — the plain-English instruction given to Kane.
- **Evidence** — screenshots/logs produced by a run.
