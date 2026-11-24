You are verifying a Remotion Studio preview.
Composition id: {{COMPOSITION_ID}}   Canvas: {{WIDTH}}x{{HEIGHT}}   Duration: {{DURATION_SECONDS}}s at {{FPS}} fps

Steps:
1. Open the page. Find and select composition "{{COMPOSITION_ID}}" in the left sidebar. If absent, fail.
2. Check for red/black error overlays or visible error text. Fail and copy the text if present.
3. Play preview for about 3 seconds, pause. Fail if an error appears.
4. Inspect frames 30, 60, and 90. Canvas must not be blank/black; expected images must display; visible text/captions must stay inside canvas.
5. Pass only if every check holds. On failure name exact observation and frame.
{{EXTRA_CHECKS}}
