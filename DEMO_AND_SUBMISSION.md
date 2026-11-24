# DEMO_AND_SUBMISSION.md

Deadline: **26 Nov 2026, 11:59 PM IST** (= 27 Nov 01:29 WIB). Plan to submit **≥ 3 hours early** (≈ 22:30 WIB on
26 Nov at the latest). Hackathon page: https://www.kaneclihack.sh/ — re-read its submission section and copy the
exact required fields into `NOTES.md` before the last day.

## 1. What the demo must prove

1. The agent loop is **real**: the agent (Claude Code) writes/edits, the hook runs the gate, failure output goes
   back to the agent, the agent fixes without human help.
2. Kane's role is **essential**: it is the only thing that checks what a viewer sees in the preview.
3. The payoff is **visible**: a bug is caught with **zero renders**; after the fix there is **exactly one render**.
4. It is a **shipped tool**: installable from a clean clone.

## 2. Video script (target 2:30–3:00)

| Time | On screen | Voice-over (short, plain) |
|---|---|---|
| 0:00–0:15 | Title + split: agent terminal / preview | "Agents write Remotion code fast, but they can't see the preview. Bugs show up only after a slow render." |
| 0:15–0:40 | Prompt to Claude Code: "Make a 15s 9:16 promo for a 20 Mbps plan with animated headline and logo." Agent works | "I ask Claude Code for a promo video." |
| 0:40–1:10 | `npm run demo:break` (or the agent's own mistake). Hook fires: `render-gate check` runs; Studio starts; Kane window/terminal shows the objective running | "Before any render, render-gate opens the Studio preview and Kane verifies it like a viewer." |
| 1:10–1:40 | Report: `RENDER-GATE FAILED … Logo image did not load at frame 60; caption clipped at frame 90`. Counter: renders avoided 1 | "Kane fails it with a specific reason and evidence. No render has run." |
| 1:40–2:10 | Agent reads the report, edits the logo path and caption size, hook re-runs the gate → PASS | "The agent reads Kane's verdict, fixes the code, and the gate passes." |
| 2:10–2:30 | Single `remotion render` runs once → mp4 plays | "Only now the render runs — once." |
| 2:30–2:50 | Show Ctrl+C mid-run + `ps` showing no leftover processes (optional 10 s) | "No zombie Studio processes, even on Ctrl+C." |
| 2:50–3:00 | Repo URL, `npx github:<user>/render-gate init` | "Install it into any Remotion project in one command." |

Recording tips:
- Pre-run everything once (warm caches, logged-in Kane) so the video has no dead time. Speed up long waits 4–8×
  and say "sped up" on screen.
- Terminal font large; split-screen agent terminal + Studio/Kane output.
- Keep the failing report on screen long enough to read.
- Record the real run; do not fake output. If a Kane run is slow, cut with a visible "sped up" label.

## 3. Demo setup checklist (day before recording)

- [ ] Kane logged in; credits available (check dashboard); one dry run of the full flow succeeded.
- [ ] `examples/demo` in the fixed state; `demo:break` and `demo:fix` both verified.
- [ ] Claude Code hook active in the demo project (run `init`); loop guard default 3.
- [ ] Terminal clean; no secrets on screen (tokens, `.env`).
- [ ] Screen recorder tested with audio; 1080p.
- [ ] Backup plan if the live hook misbehaves: run the loop with a manual re-prompt ("the gate failed, fix it")
      and say so honestly in the video.

## 4. README outline (`README.md`)

1. **Title + one-liner** (the judge sentence from PRD §1) and a short GIF/screenshot of fail → pass.
2. **Problem** (3 sentences) and **How it works** (the ASCII diagram from PRD §7).
3. **Requirements**: Node ≥ 18, a Remotion project, Kane CLI installed and logged in (`npm i -g @testmuai/kane-cli`,
   `kane-cli login`), Chrome/Chromium, a coding agent (Claude Code shown).
4. **Quickstart** (copy-pasteable, ≤ 5 commands):
   ```
   npx github:<user>/render-gate init
   npx render-gate check PromoVideo
   npx render-gate render PromoVideo
   ```
5. **Commands & options** (table from PRD §8) and **exit codes** (render-gate's own + Kane mapping, marked
   with what was verified).
6. **Config** reference (PRD §9).
7. **Agent loop**: what `init` installs (CLAUDE.md snippet + hook), loop guard, how to use with other agents
   (re-prompt fallback).
8. **What Kane verifies / does not** (honesty table from KANE_SPECS §1).
9. **Cost & time**: Kane uses credits and takes tens of seconds to minutes; cache and static checks reduce it.
10. **Demo project**: `cd examples/demo`, `npm run demo:break`, gate fails, `npm run demo:fix`, gate passes.
11. **Troubleshooting**: Kane not logged in (12), Studio not ready (14), Chromium missing, port in use,
    Kane cannot reach localhost.
12. **Limitations & roadmap** (aesthetics/audio sync not judged; "renders avoided" is an estimate; Windows
    best-effort).
13. **License** (MIT unless the human says otherwise) and credits (Kane CLI by TestMu AI, Remotion).

## 5. Submission checklist

- [ ] Repo **public**; default branch has everything; no secrets in history (`git log -p | grep -i token` sanity
      check; rotate anything leaked).
- [ ] Clean-clone test passes from the **public** URL.
- [ ] README complete; demo video link included; a short "How Kane is used" section included.
- [ ] Video uploaded (unlisted/public as required) and playable while logged out.
- [ ] Which agent was used is stated (Claude Code) and where the loop is wired (hook + CLAUDE.md).
- [ ] Submission form fields filled exactly as the hackathon page requires (copy them into `NOTES.md` first).
- [ ] Submitted ≥ 3 hours before the deadline; confirmation screenshot saved.

### "About your app" text (adapt)

> **What I built.** render-gate is a CLI that puts Kane between an AI coding agent and an expensive Remotion/ffmpeg
> render. It starts the Studio preview, has Kane verify it like a viewer (composition present, no error overlay,
> assets visible, captions inside the frame), and only renders the mp4 when verification passes. On failure the agent
> gets a specific reason plus evidence and fixes the composition before any render has run.
> **Which agent.** Claude Code writes the Remotion compositions and fixes them; a Stop hook runs the gate after each
> edit and feeds failures back (with a loop guard).
> **What Kane does.** Kane CLI is the verification layer: plain-English objectives, executed in a real browser,
> returning pass/fail with evidence that drives the agent's next edit.
> **Limits.** Kane checks the technical state of the preview, not aesthetics or audio sync.

## 6. If something blocks (fallbacks)

| Problem | Fallback |
|---|---|
| Kane cannot reach `localhost` | (a) Check Kane docs for local-URL support; (b) expose the preview via a tunnel tool (e.g. a Cloudflare/ngrok-style tunnel) and pass the public URL to Kane; (c) serve a built `remotion bundle` over a public static host. Document which you used. Ask the human before adding any tool. |
| Hook event/exit semantics differ from the plan | Use the documented behaviour; if feedback to the model is impossible, run the loop by re-prompt ("run `render-gate check`, fix failures, repeat") and state it honestly. |
| Kane too slow/flaky for a live loop | Keep one objective, 3 frame checks; cache passes; record the video in cut segments with "sped up" labels. |
| Credits run out | Rely on static checks + cache while iterating; run real Kane only for the final takes. |
| Time is running out | Cut stretch items, README polish, extra checks. Never cut cleanup, clean-clone test, the demo, or the submission. |

## 7. Likely judge questions — honest answers

**Why Kane and not just `remotion still` or Playwright?**
`remotion still` can catch some static bugs (missing asset, clipped text in one frame) and we do cheap
deterministic checks for those. Kane adds behavioural checks in the real Studio — selecting the composition,
pressing play, seeking frames, spotting error overlays — written in plain English with no brittle selectors, and
returning evidence the agent can act on. The agent can also write and edit these objectives itself.

**Why not a unit test?**
Unit tests cannot tell whether the preview actually shows the logo or whether a caption is clipped in the browser.

**Does Kane judge if the video is good?**
No. It verifies technical correctness of the preview. Humans review creative quality of the final mp4.

**What do you save?**
Technical revision loops move to the cheap preview; the expensive render runs once after a pass. "Renders avoided"
is an estimate: failed gates since the last successful render.

**What if Kane is wrong?**
`--warn` mode logs without blocking; evidence is stored per run; objectives are plain text anyone can read and fix.

**Is it only for Remotion?**
The pattern (verify the cheap preview before the expensive build) generalises, but the shipped tool targets
Remotion. Say this as roadmap, not as a feature.

**What happens when the gate fails forever?**
A loop guard stops blocking after N attempts and asks for human review.

## 8. Final-day timeline (WIB, deadline 27 Nov 01:29 WIB)

| When | Do |
|---|---|
| Morning | Phase 6: clean-clone test, README, public repo |
| Midday | Dry-run the whole demo twice |
| Afternoon | Record video, trim, upload |
| Evening (≤ 22:30) | Fill the form, submit, save confirmation |
| After | Buffer only. No new features |
