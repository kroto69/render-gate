# KANE_SPECS.md — how render-gate talks to Kane

Kane executes **plain-English objectives** in a real browser and returns pass/fail with evidence. This file defines
how to write objectives for the Remotion Studio preview, the default templates, and rules to keep them reliable.

> Flags and output schema are `[UNVERIFIED]` until confirmed in `NOTES.md` (task T1). Treat the command shapes
> below as illustrations; the authoritative source is `kane-cli run --help` and
> https://www.testmuai.com/kane-cli/agents.md.

## 1. What Kane can and cannot verify here

| Can verify (visible / behavioural in the preview) | Cannot verify reliably |
|---|---|
| Composition appears in the Studio sidebar | Whether the video is "good", pretty, on-brand |
| Pressing play runs without an error overlay | Audio presence/sync (Studio UI does not prove it) |
| Images/logo are visible on screen at given frames | Exact pixel-perfect layout |
| Caption/text is fully inside the visible canvas | Animation smoothness / easing quality |
| Canvas is not blank/black at given frames | Anything not visible in the browser |
| Timeline duration / frame counter shows expected values | Rendered mp4 internals |

Therefore: **audio, durations, dimensions, asset existence** are checked by deterministic Node code
(`src/checks/static.js`). **Kane checks only what a viewer would see in the preview.** This split is a feature:
the cheap deterministic checks run first and can short-circuit Kane (saves credits and time).

## 2. Rules for writing objectives (follow strictly)

1. **One objective = one clear outcome**, but a small ordered list of steps is fine.
2. **Be concrete about UI**: say "the left sidebar", "the Play button below the canvas", "the timeline",
   "the current frame number". Name the composition id exactly.
3. **State the pass condition explicitly** and the failure condition ("if X, the check fails").
4. **Use frame numbers** (30, 60, 90) instead of vague words like "later".
5. **Ask Kane to report the specific observation** when failing ("describe what is wrong and at which frame").
   Specific reasons are what make the agent's fix possible.
6. **No subjective words** ("nice", "good looking", "smooth").
7. **Keep it short** (≤ ~12 lines). Long objectives are slower, costlier, and flakier.
8. **Do not mention secrets**, tokens, or local file paths.
9. **Budget**: 1 objective per composition per gate run (3–5 checks inside it). Do not create dozens of specs.

## 3. Default objective template (`templates/specs/default.md`)

Placeholders in `{{double braces}}` are filled by `render-gate` from the config.

```
You are verifying a Remotion Studio preview.
Composition id: {{COMPOSITION_ID}}   Canvas: {{WIDTH}}x{{HEIGHT}}   Duration: {{DURATION_SECONDS}}s at {{FPS}} fps

Steps:
1. Open the page. In the left sidebar find the composition named "{{COMPOSITION_ID}}" and select it.
   If it is not in the sidebar, fail and say so.
2. Check that no red/black error overlay or error message is shown on the page. If there is one, fail and copy
   the visible error text.
3. Press Play and let the preview run for about 3 seconds, then pause. If an error overlay appears at any point,
   fail and describe it.
4. Go to frame 30, frame 60, and frame 90 (use the frame counter or the timeline). At each frame check that:
   a) the canvas is not blank or entirely black,
   b) every image that should be visible is actually displayed (no broken-image icon or empty box),
   c) all visible text/captions are fully inside the canvas edges (nothing cut off at the left, right, top or bottom).
5. Pass only if every check above holds. If anything fails, state exactly which check failed, at which frame,
   and what you saw (for example: "logo image missing at frame 60", "caption clipped on the right at frame 90").
{{EXTRA_CHECKS}}
```

`{{EXTRA_CHECKS}}` is the per-composition line(s) from the spec file, e.g.:
`6. At frame 120 the company logo is visible in the bottom-right area.`

## 4. Per-composition spec file (`specs/PromoVideo.md`)

```
# PromoVideo — extra checks
6. By frame 120 the logo image is visible near the bottom-right. If it is not visible, fail and say
   "logo missing".
7. The headline text appears before frame 45 and stays readable (not overlapping the logo).
```
The agent MAY edit these extra checks when the creative brief changes (new scenes, new assets). The agent MUST NOT
loosen a check merely to make a failing gate pass (see CLAUDE.md rule 9).

## 5. Example: expected Kane outcomes on the demo

| State | Expected verdict | Expected reason (specific) |
|---|---|---|
| Demo fixed | pass | — |
| `demo:break` (logo path wrong + long caption) | fail | mentions missing logo and/or clipped caption with a frame number |

If Kane's failure reason is vague ("page looks wrong"), improve **objective wording** (more concrete UI terms,
explicit frame checks, explicit "describe what you saw"), not the thresholds.

## 6. Invocation shape (illustrative — verify!)

```
kane-cli run --url http://localhost:<PORT>/<CompositionId> --agent --headless "<objective text>"
```
- Pass the objective as an argument or via file/stdin **as the CLI supports**; prefer a file/stdin if available to
  avoid shell-quoting problems with multi-line text.
- `render-gate` sets a hard timeout (`kane.timeoutSec`, default 180). On timeout: kill the Kane process tree and
  return code 13.
- The binary path can be overridden by `RENDER_GATE_KANE_BIN` (used by the fake Kane stub in tests).

## 7. Output handling (illustrative — real schema comes from fixtures)

- Treat stdout as NDJSON; each line is a JSON object; ignore non-JSON lines.
- Store everything in `kane.ndjson`. Extract: final verdict, failed step, human-readable reason, artifact paths.
- If the stream says "pass" but the exit code says failure (or the reverse), report the more severe outcome and
  note the disagreement in `summary.json`.
- Document the real schema in `docs/KANE_OUTPUT.md` after T1.

## 8. Fake Kane stub behaviour (`test/stubs/fake-kane.js`)

| `FAKE_KANE_MODE` | Behaviour |
|---|---|
| `pass` | Emits the pass fixture's events, exit code = real "pass" code (0) |
| `fail` | Emits the fail fixture's events, exit code = real "verification failed" code |
| `timeout` | Sleeps longer than `kane.timeoutSec` (to test kill + code 13) |
| `auth` | Prints an auth error, exits with the real "setup/auth" code |
| `garbage` | Prints non-JSON noise and a truncated JSON line |

## 9. Credit and time hygiene

- Static checks first; if they fail, Kane is not run.
- Cache hit (same hash that already passed) → no Kane run.
- One objective per composition. Avoid re-running the whole suite on each tiny edit; use `--only-changed`.
- Expect a Kane run to take tens of seconds up to a couple of minutes. Say so in the README.

## 10. Config example (`render-gate.config.json`) for the demo

```json
{
  "entry": "src/index.js",
  "mode": "strict",
  "compositions": {
    "PromoVideo": {
      "spec": "specs/PromoVideo.md",
      "expect": { "width": 1080, "height": 1920, "fps": 30, "durationInSeconds": 15, "audio": false,
                  "assets": ["public/logo.png"] }
    }
  },
  "studio": { "startTimeoutSec": 60 },
  "kane": { "timeoutSec": 180, "extraArgs": [] },
  "cache": { "enabled": true, "dir": ".render-gate" },
  "render": { "command": "npx remotion render", "extraArgs": [] },
  "loopGuard": { "maxAutoFixAttempts": 3 }
}
```

## 11. Snippet shipped to users (`templates/CLAUDE.md.snippet`)

```
<!-- render-gate:start -->
## Video rendering rules
- Never run `remotion render` directly. Always run `npx render-gate render <Composition>`.
- After editing any composition, asset, or spec, run `npx render-gate check <Composition> --json`.
- If it fails, read `reason`, `stage`, and `evidence`, fix the composition, and rerun.
  Do not render until `check` passes. Do not loosen specs/ just to make a failing check pass.
- Creative decisions (hook, copy, pacing) are yours; technical correctness is verified by the gate.
<!-- render-gate:end -->
```
