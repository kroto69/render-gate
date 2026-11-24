# render-gate

> Agents write Remotion code quickly but cannot see the preview. Kane is their eyes: it verifies the Studio preview before the expensive render.

[Agent instructions](AGENTS.md) · [Kane spec guidance](docs/KANE_SPECS.md)

## Why

A missing asset, Studio error, or clipped caption should fail before ffmpeg renders a video. render-gate runs deterministic checks first, starts Remotion Studio, asks Kane CLI to inspect the preview, then renders only when the strict gate passes.

```text
source + assets -> static checks -> Studio -> Kane -> report/evidence -> render once on pass
```

Kane verifies visible technical state, not aesthetics, pacing, animation smoothness, or audio sync. Humans still review final output.

## Requirements

- Node.js >= 18 and an installed Remotion project.
- Kane CLI installed and authenticated by the human. Install/login commands below are for human use only.
- Chrome/Chromium discoverable by Kane. On Linux Kane may require `/usr/bin/google-chrome`. If Brave is installed and this path is missing, a human may create symlink: `sudo ln -s /usr/bin/brave /usr/bin/google-chrome`. This machine used Brave successfully through that path.

## Quickstart

From your Remotion project:

```sh
npx github:kroto69/render-gate init --yes
npx github:kroto69/render-gate add PromoVideo --width 1080 --height 1920 --fps 30 --seconds 15
npx github:kroto69/render-gate check PromoVideo --json
npx github:kroto69/render-gate render PromoVideo
```

For a project already configured, omit `add`. Check result must show `"ok":true` before render. `init` installs config, spec template, agent instructions, hook, and `render` npm script; it does not install dependencies or run postinstall scripts.

## Commands

| Command | Behavior |
|---|---|
| `render-gate init --yes` | Idempotently configure project; non-TTY implies `--yes`. |
| `render-gate add <Composition> --width N --height N --fps N --seconds N [--audio]` | Register composition and create spec. |
| `render-gate check <Composition> [--all]` | Run gate only. |
| `render-gate render <Composition>` | Gate then render on pass. |

`check`/`render` options: `--strict` (default), `--warn`, `--json`, `--hook`, `--only-changed`, `--no-cache`, `--config <path>`, `--out <path>` (render only), `--verbose`.

`--warn` deliberately allows render despite gate failure. Do not use for the normal agent loop. `--json` writes one result object to stdout; human diagnostics go to stderr. Result fields: `ok`, `stage`, `code`, `reason`, `evidence`, `cached`, `rendered`, `durationMs`, `rendersAvoidedEstimate` (estimate).

### Exit codes

| render-gate code | Meaning |
|---:|---|
| 0 | Gate passed and requested render succeeded; also warn-mode completion or hook loop give-up. |
| 1 | Usage/configuration error. |
| 2 | Hook gate failure, feedback returned to agent. |
| 10 | Static checks failed. |
| 11 | Kane verification failed. |
| 12 | Kane setup/auth/unknown error (provisional; verify vendor behavior). |
| 13 | Kane timeout (provisional). |
| 14 | Studio failed or not ready. |
| 15 | Render failed. |

Kane CLI exit mapping and NDJSON assumptions are unverified for this build. See `NOTES.md` and `src/kane.js`; run against fake Kane with tests. Do not treat the table as verified vendor semantics.

## Configuration

`render-gate.config.json` selects entry, compositions/specs/expectations, Studio/Kane timeouts, cache, render command, and loop guard. Start from `templates/render-gate.config.json`. Composition metadata currently uses declared `expect` only; Remotion bundle metadata API remains unverified. Static checks verify configured assets, literal `staticFile()` references under `src/`, and audio reference when requested.

## Agent loop

`init` adds bounded render rules to `CLAUDE.md` and a Claude Code `Stop` hook template. Exact hook feedback semantics remain unverified; inspect `NOTES.md`. Other agents can use manual loop: run `check --json`, read `reason`/`evidence`, fix code (not specs), retry. After 3 failures, stop and report for human review. Never install/log in to Kane as an agent.

## Time, cost, and limitations

Kane runs consume credits and can take tens of seconds to minutes. Static checks and passing-hash cache avoid unnecessary runs. `rendersAvoidedEstimate` estimates failures since last successful render; it is not a measured count of actual renders. Preview checks cannot establish aesthetics, audio sync, or final MP4 correctness. macOS/Linux are target; Windows is best-effort.

## Demo

```sh
cd examples/demo
npm install
npm run demo:break
# Run render-gate check PromoVideo --json: static missing-logo check fails before Kane.
npm run demo:fix
# Run check again. Human may then run render.
```

`demo:break`/`demo:fix` are idempotent. No demo or real Kane/render was run while building this release.

## Troubleshooting

- Kane auth error (provisional code 12): ask human to authenticate Kane; agent must not log in.
- Studio not ready (14): inspect `.render-gate/runs/*/studio.log`, entry path, project dependencies, and browser availability.
- Linux Chrome path missing: human can install supported browser or create documented Brave symlink.
- Port conflict: Studio uses a random free port; retry after stopping stale process.
- Kane cannot reach localhost: stop and ask human; no tunnel is added automatically.

## Development

```sh
npm test
```

Tests use Node's built-in `node:test` and fake Kane only. They cover strict render blocking, fake result handling, init/add idempotency, loop guard, and Studio cleanup on SIGINT/SIGTERM.

MIT license. Kane CLI by TestMu AI; Remotion by Remotion.
