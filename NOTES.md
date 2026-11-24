# Verification and unresolved vendor contract

This build intentionally performs **no real Kane runs**. User-confirmed facts only:

| Item | Value | Source | Status |
|---|---|---|---|
| Node target | Node >= 18 | PRD.md | Specified |
| Remotion Studio flags | `--port`, `--no-open`, `--ipv4` | User confirmation | VERIFIED for this task |
| Linux browser path | `/usr/bin/google-chrome` is a symlink to Brave | User confirmation | VERIFIED for this task |
| Kane binary name/default | `kane-cli` | Existing project spec; not re-tested | UNVERIFIED (`src/kane.js`) |
| Kane invocation flags and argument order | All invocation details are provisional constants in `src/kane.js` | No real run permitted | UNVERIFIED (`src/kane.js`) |
| Kane NDJSON event/schema | Parser tolerates malformed, partial, unknown records; terminal event convention remains provisional | Historical fixtures are examples only, not this build's verification | UNVERIFIED (`src/kane.js`) |
| Kane process exit codes | Mapping is provisional and must be confirmed before real use | No real run permitted | UNVERIFIED (`src/kane.js`) |
| Kane artifact/screenshot fields | Parser extracts a narrow set of string file paths from provisional final event | No real run permitted | UNVERIFIED (`src/kane.js`) |
| Claude Code hook | Stop hook template present; exact semantics not verified for this build | No hook execution permitted | UNVERIFIED (`templates/claude-hook.json`) |
| Remotion metadata API | Gate currently checks assets and audio reference; composition metadata extraction not implemented | `PRD.md` marks API assumptions unverified | UNVERIFIED |
| External dependencies | None added to render-gate; built-in Node modules only | `package.json` | VERIFIED |

## Explicit verification backlog

- `src/kane.js`: confirm executable name, invocation flags, URL and objective argument positions, terminal event and fields, exit-code mapping, and evidence path semantics using official Kane docs or a real run. Do not remove `// TODO(verify)` markers until confirmed.
- `src/checks/static.js`: confirm Remotion `bundle()` / `getCompositions()` signatures and resolve packages from the user's project before relying on metadata checks.
- `templates/claude-hook.json`: confirm current Stop hook JSON configuration, stdin payload, continuation guard field, and exact feedback/exit semantics. If those semantics differ, use documented behavior or manual re-prompt; never claim an automatic loop until verified.
- `examples/demo`: do not claim real Studio/Kane/render end-to-end verification. Build tests use fake processes only.

Historical raw fixture files from earlier exploration remain under `test/fixtures/`; their presence is not a claim that the current Kane contract is verified. `npm test` uses only fake Kane and never spends credits.
