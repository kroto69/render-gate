# render-gate agent instructions

render-gate gates Remotion previews with deterministic checks and Kane CLI before video render. It checks technical preview state, not aesthetics or audio sync.

## Prerequisites
- Node.js >= 18 and an installed Remotion project.
- `kane-cli` installed and logged in by the human. Never install Kane or run `kane-cli login` yourself.
- Browser available at `/usr/bin/google-chrome` on Linux. Brave users may use the documented symlink workaround in `README.md`.

## Exact command order
1. `npx render-gate init --yes`
2. `npx render-gate add PromoVideo --width 1080 --height 1920 --fps 30 --seconds 15`
3. `npx render-gate check PromoVideo --json`
4. Only after `ok: true`: `npx render-gate render PromoVideo`

Never run `remotion render` directly. Never loosen specs just to pass. After 3 failed attempts, stop and report failure plus evidence to the human.

## JSON result
`ok` is gate success; `stage` identifies `config`, `static`, `studio`, `kane-verification`, `render`, or `done`; `code` is render-gate exit code; `reason` explains result; `evidence` lists run artifacts.

## Failure response
- `config`: inspect config and composition ID; fix input/config, not spec thresholds.
- `static`: fix missing asset, audio reference, or expected metadata in project.
- `studio`: inspect `.render-gate/runs/*/studio.log`, entry path, project dependencies, and browser availability.
- `kane-verification`: inspect `reason` and `evidence`; fix visible preview defect, then rerun `check`.
- `render`: gate passed; inspect Remotion render output and fix render error.

Kane runs use credits and may take tens of seconds to minutes. Ask human to handle Kane installation/auth and any browser login.
