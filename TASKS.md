# TASKS.md — build plan for `render-gate`

Work top to bottom. After each phase: run its **Verify** commands, paste real output, commit (`phase N: …`), push.
Priorities: **[MUST]** ships no matter what · **[SHOULD]** if time allows · **[STRETCH]** only if everything else is done.
Requirement IDs refer to `PRD.md`.

Time budget (solo, ~2 days left): Phases 1–5 on day 1–2, Phase 6–7 on the last day. Do not start STRETCH items
before Phase 6 passes.

---

## Phase 1 — Verify reality, repo, skeleton  [MUST]

**T1. Resolve the unknowns (do this before writing real code)**
- [ ] Install and log in: `npm i -g @testmuai/kane-cli`; `kane-cli --help`; `kane-cli run --help`.
      If login needs a browser, **stop and ask the human** to run `kane-cli login`.
- [ ] Read https://www.testmuai.com/kane-cli/agents.md and the Kane docs (introduction, agent mode, exit codes).
- [ ] Run one real objective against a public URL in agent/headless mode. Save raw stdout to
      `test/fixtures/kane-pass.ndjson`. Run one that must fail (objective false on that page) →
      `test/fixtures/kane-fail.ndjson`. Record the exit code of each.
- [ ] Start any Remotion Studio locally (use `npx create-video@latest` in `/tmp` or the demo later) and run Kane
      against `http://localhost:<port>`. **Confirm Kane can reach localhost.** If not → STOP and ask.
- [ ] `npx remotion studio --help`, `npx remotion render --help`: confirm port/no-open flags and arg order.
- [ ] Read current Claude Code hooks docs: event name for "agent finished a turn", config file location, stdin
      payload, and exit-code semantics for feeding feedback back to the model.
- [ ] Write `NOTES.md` with a table: item · value · source (docs URL or command output) · VERIFIED/UNVERIFIED.
- [ ] Write `docs/KANE_OUTPUT.md`: the observed NDJSON event schema and exit-code meanings, with short examples
      copied from the fixtures.

**T2. Repo + skeleton**
- [ ] `git init`; `.gitignore` (`node_modules`, `.env`, `.render-gate/`, `*.mp4`, `out/`).
- [ ] `gh repo create render-gate --private --source=. --push`.
- [ ] `package.json` per CLAUDE.md; `bin/render-gate.js`; `src/cli.js` with `--help`, `--version`, command routing,
      `src/errors.js` (`GateError`).
- [ ] Copy `PRD.md`, `CLAUDE.md`, `TASKS.md`, `docs/` into the repo if not present.

**Verify:** `node bin/render-gate.js --help` prints usage; `npm test` runs (even with 0 tests); `NOTES.md` has no
empty "source" cells; fixtures exist.

---

## Phase 2 — Process lifecycle: Studio + cleanup  [MUST]  (FR-2, FR-11, FR-12, NFR-2)

- [ ] `src/cleanup.js`: registry (`register(child)`), idempotent handlers for `exit`, `SIGINT`, `SIGTERM`, `SIGHUP`,
      `uncaughtException`, `unhandledRejection`; POSIX process-group kill (`-pid`) with SIGTERM→SIGKILL after 3 s;
      Windows `taskkill /T /F`.
- [ ] `src/studio.js`: `findFreePort()`, `startStudio({entry, port})` (detached, no auto-open, logs to
      `.render-gate/runs/<id>/studio.log`), `waitReady(url, timeoutSec)` polling HTTP, `stop()`.
- [ ] Friendly error for missing Chromium / Studio never ready (code 14).
- [ ] `test/integration/cleanup.test.js`: spawn the CLI (a hidden `render-gate _studio-only` dev command or the
      real flow with the fake Kane in `timeout` mode), wait for the port to answer, send SIGINT then (separate
      test) SIGTERM, assert the port is closed and no registered pid is alive.

**Verify:** `npm test` green. Manual: start `render-gate check` on the demo, press Ctrl+C,
`ps aux | grep -Ei "remotion|studio"` shows nothing; `lsof -i :<port>` empty.

---

## Phase 3 — The gate  [MUST]  (FR-1, FR-3–FR-9)

- [ ] `src/checks/static.js`: asset existence (config + `staticFile("…")` regex scan), metadata vs `expect` via
      `getCompositions` (resolve Remotion from the user's project with `createRequire`), audio expectation.
- [ ] `src/kane.js` (the only Kane-aware file): `runKane({url, objective, timeoutSec, runDir})` →
      `{ verdict, reason, failedStep, artifacts[], exitCode, durationMs }`. Uses `RENDER_GATE_KANE_BIN`. Captures
      raw NDJSON to `kane.ndjson`. Defensive parser (garbage lines OK). Exit-code mapping per verified table.
- [ ] `test/stubs/fake-kane.js` + parser/mapping unit tests using the real fixtures.
- [ ] `src/commands/render.js`: flow = config → static → (cache) → studio → kane → report → (render).
      `check` = same without render. Strict (default) and `--warn`.
- [ ] `src/report.js`: human report (≤ 12 lines) and `--json` result per PRD §17; run folder + `summary.json`.
- [ ] Render step: spawn configured render command, stream output, code 15 on failure.
- [ ] Integration tests (fake Kane): pass → render command invoked once; fail (strict) → render command **never**
      invoked (assert via a spy script); fail (warn) → render invoked; timeout → 13; auth → 12; static fail → 10
      and Kane never invoked.

**Verify:** `npm test` green. Real run on the demo (after Phase 5 scaffold, or on any Remotion project): a pass and
a planted failure, both showing the report and exit codes.

---

## Phase 4 — Cache, init, agent loop  [MUST]  (FR-8, FR-10, FR-13, FR-14, §14, §15)

- [ ] `src/cache.js`: hash per PRD §15; read/write `cache.json`; `--no-cache`; `--only-changed`.
- [ ] Stats: `stats.json` with renders-avoided estimate; included in report and JSON.
- [ ] `src/commands/init.js`: idempotent; creates `specs/` (from `templates/specs/`) and
      `render-gate.config.json`; injects the CLAUDE.md snippet between `<!-- render-gate:start/end -->` markers;
      installs the hook config using the **verified** hook format; rewrites the `render` npm script only if not
      already done; prints a unified diff. Second run: "nothing to change", exit 0.
- [ ] `--hook` mode: on failure exit 2 + concise stderr feedback; **loop guard** (`state.json`, default max 3
      attempts, reset on pass, give-up message).
- [ ] Tests: init twice → second diff empty; hash stability/sensitivity; loop guard reaches give-up and exits 0;
      `--hook` exit codes.

**Verify:** `npm test` green. In a scratch Remotion project: `npx render-gate init` twice (2nd = no-op); the hook is
present in the Claude Code settings file; a real Claude Code session triggers the gate after an edit (or document
the fallback if hooks differ).

---

## Phase 5 — Demo project  [MUST]  (§19)

- [ ] `examples/demo/`: Remotion project (plain JS) with 15 s, 1080×1920, 30 fps composition `PromoVideo`:
      animated headline, `<Img src={staticFile('logo.png')}/>`, caption element. Own `package.json`.
- [ ] `scripts/break.js` plants: wrong logo path + caption too long to fit. `scripts/fix.js` restores. Both
      idempotent, both print what changed. Wire as `npm run demo:break` / `demo:fix`.
- [ ] `examples/demo/render-gate.config.json` and `specs/PromoVideo.md` from `docs/KANE_SPECS.md`.
- [ ] Real Kane runs: fixed demo → pass; broken demo → fail with a **specific** reason naming the logo and/or
      caption. If Kane's reason is vague, improve the objective wording (not the thresholds) and re-run.
- [ ] Save one passing and one failing run summary under `docs/examples/` for the README.

**Verify:** the sequence break → check (fail, exit 11, no render) → fix → check (pass) → render (exactly one render)
works end to end with real Kane. Paste the terminal output.

---

## Phase 6 — Clean-clone test, README, public  [MUST]

- [ ] Push everything. In `/tmp`: `git clone <repo> rg-test && cd rg-test/examples/demo && npm install`.
- [ ] `npx github:<user>/render-gate init` (use the real GitHub path) then `npx render-gate check PromoVideo`.
      Fix whatever breaks (missing `bin`/`files`, executable bit, undeclared deps, paths).
- [ ] Repeat once from a different directory/machine if possible.
- [ ] `README.md` per outline in `docs/DEMO_AND_SUBMISSION.md` §4 (problem, install, quickstart, commands,
      exit-code table, config, how the agent loop works, limitations, credits, demo instructions).
- [ ] Make the repo **public**. Re-run the clean-clone test against the public URL.

**Verify:** a stranger can follow the README from zero to a first gate in < 5 minutes. All checkboxes in
CLAUDE.md "Definition of done" ticked except the video.

---

## Phase 7 — Demo video and submission  [MUST]

- [ ] Follow `docs/DEMO_AND_SUBMISSION.md` §2–§3. Record, trim, upload.
- [ ] Complete the submission checklist (§5). Submit **at least 3 hours before** the deadline.

---

## Stretch (only after Phase 6 is green)

- [ ] **[STRETCH]** Node API wrapper around `renderMedia()` from `@remotion/renderer` so the gate can wrap
      programmatic renders (`import { gate } from 'render-gate'`).
- [ ] **[STRETCH]** `render-gate doctor`: checks Node version, Kane install/login, Chromium, Remotion, hook.
- [ ] **[STRETCH]** `render-gate stats`: prints runs, passes, fails, estimated renders avoided.
- [ ] **[STRETCH]** Second agent template (`AGENTS.md` snippet for Codex/Cursor) in `templates/`.

## Reporting format after each phase (send this to the human)

```
PHASE N DONE
What I built: …
What I ran (real output): …
Test results: …
UNVERIFIED items still open: …
Problems / questions: …
Next phase: …
```
