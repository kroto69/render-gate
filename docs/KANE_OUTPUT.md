# Observed Kane CLI output

Captured with Kane CLI `0.10.8` on 2026-11-24 using `kane-cli run --agent --headless --timeout 180 --url <URL> '<objective>'`.

## Stream

`--agent` writes newline-delimited JSON objects to stdout. Observed events:

- `stream_start`: `{ "type": "stream_start", "cli_version": "0.10.8", "surface": "run", "pid": 123, "v": 1, "ts": "..." }`
- `recording_state`: `{ "type": "recording_state", "enabled": true, "session_id": "...", "persist": false, "v": 1, "ts": "..." }`
- Progress: `{ "step": 2, "status": "done", "remark": "...", "v": 1, "ts": "..." }` (`status` observed: `running`, `done`, `failed`)
- `coverage`: `{ "type": "coverage", "status": "skipped", "reason": "not_assurance_project", "pack": "...evidence", "v": 1, "ts": "..." }`
- `run_end`: terminal event. Observed fields include `status`, `summary`, `one_liner`, `final_state`, `reason`, `duration`, `total_runs`, `context`, `variables`, `session_dir`, `run_dir`, `result_code`, `reason_code`, and optional `verdict`, `test_url`, `coverage`.

Unknown/future fields and event types must remain tolerated. Raw examples stay in `test/fixtures/kane-pass.ndjson` and `test/fixtures/kane-fail.ndjson`.

## Captured examples

Pass fixture final event (abridged here; use fixture for full raw line):

```json
{"type":"run_end","status":"passed","summary":"Opened the requested webpage at example.com.\nThe Example Domain page loaded successfully with no network or navigation error.","one_liner":"opened the requested webpage on example.com","final_state":{"url":"https://example.com/","page_title":"Example Domain","network_or_navigation_error_absent":"false"},"reason":"Objective completed","result_code":100,"reason_code":"success.complete"}
```

Fail fixture final event (abridged):

```json
{"type":"run_end","status":"failed","summary":"The run loaded example.com successfully, but the configured heading ... was not on the page.","reason":"Checkpoint assertion failed: ...","result_code":720,"reason_code":"assertion_error.checkpoint_failed"}
```

## Exit codes

Verified by real runs plus current vendor docs:

| Kane process exit | Meaning |
|---|---|
| `0` | Run passed |
| `1` | Run failed; vendor docs also list upload failure |
| `2` | Error, including auth, TMS credential exchange, configuration, Chrome, unknown subcommand, or unhandled exception |
| `3` | Run cancelled or hit `--timeout` |

Real captured fixtures: pass exit `0`, fail exit `1`. Do not infer meaning from `run_end.result_code` (e.g. `100` or `720`) as a process exit code; use `run_end.status` and process exit status together.

Evidence recorded in observed runs as `.evidence` packs (`coverage.pack`, `session_dir`, `run_dir`) and described via stderr `evidence: view locally with kane-cli evidence serve <path>`. Individual screenshot paths were not present in captured final events.

Source: https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/running-tests.md
