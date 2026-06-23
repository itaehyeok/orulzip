# AGENTS.md

## Development Workflow

- Prefer reading and editing the smallest relevant file. `src/public/app.js` and `src/public/styles.css` are legacy entry shims; do not add application code there.
- New frontend behavior should go into the split files under `src/public/js/` and `src/public/css/`.
- Keep files focused by feature. If a file grows past roughly 1,200 lines, split it before adding more unrelated behavior.
- Preserve script and stylesheet order in `src/public/index.html` unless you have verified that the moved code has no order dependency.
- For map work, start in `src/public/js/app-map.js`, `src/public/js/app-map-popup.js`, `src/public/js/app-marker-utils.js`, and `src/public/css/app-map.css`.
- For marker design work, start in `src/public/js/markers/`, `src/public/css/markers/`, and `src/public/css/app-design.css`.
- For broader design-tab work outside markers, start in `src/public/js/app-design.js` and `src/public/css/app-design.css`.
- For table/ranking/chart work, start in `src/public/js/app-rankings.js`.
- For shared formatting, API calls, and HTML escaping, start in `src/public/js/app-utils.js`.
- Avoid broad searches over generated logs, `node_modules`, or legacy monolith files unless the targeted split files are insufficient.
- Before implementing code changes, if the user has not already received a concise explanation of the intended approach in the current thread, explain the approach first and wait for confirmation.
- When a command is known to require network access or local port binding in this Codex sandbox, request escalated execution from the start instead of first trying the sandboxed command. This includes local dev servers, Playwright browser launches, GitHub pushes/fetches, Docker commands, SSH commands, and commands that listen on `127.0.0.1`/`localhost`.
- Before starting a requested coding task, create a baseline commit when the current worktree contains approved/user-visible work that should be preserved. After finishing and verifying the task, create a completion commit. Do not include unrelated user changes in either commit.
- When local coding work is completed, push the resulting commits to the remote `develop` branch by default. Do not push local feature work to `main` unless the user explicitly asks for a production/main release.
- Backend files are not split as aggressively yet. If a task requires repeatedly opening or editing `src/server.js` or `src/services/map-growth-cache.js`, pause after the immediate task and tell the user that backend refactoring is now worth considering.
- Suggest backend refactoring when the same backend file must be read in broad chunks more than twice for one task, when a backend change crosses routing/cache/detail-building boundaries, or when new backend code would push a file past roughly 1,200 lines.

## Growth Rate Color Standard

- Use one shared growth-rate color language across map markers, map ranking lists, apartment ranking tables, and any other user-facing growth-rate display.
- Growth-rate bands are based on the actual rate value, not ranking percentile.
- The default user-facing mode is 3 bands:
  - `rate <= 0%`: blue `#2563eb`
  - `0% < rate < 10%`: green `#16a34a`
  - `10% <= rate`: red `#dc2626`
- The optional 4-band display setting is:
  - `rate <= 0%`: blue `#2563eb`
  - `0% < rate < 10%`: green `#16a34a`
  - `10% <= rate < 20%`: orange `#d97706`
  - `20% <= rate`: red `#dc2626`
- Default marker/list/table treatment is the "white background with colored line" style: keep main marker and chip backgrounds white, use the band color for borders and primary growth-rate text, and keep rank boxes as the only lightly tinted areas.
- Do not introduce another growth-rate palette or percentile-based growth-rate coloring unless the user explicitly asks for it.

## Verification

- After frontend changes, rebuild the web container so split static files are copied into the image:
  `docker compose up -d --build web`
- Use `npm run check` when the local/compose PostgreSQL service is available.
- Use Playwright for browser-level checks when visual state, design-tab behavior, or map marker rendering changes.
