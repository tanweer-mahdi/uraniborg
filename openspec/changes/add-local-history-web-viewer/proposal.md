## Why

Serious run artifact exploration is a core Uraniborg utility, and reading generated Markdown/log artifacts inside a terminal is clanky. The TUI should remain the quick run selector, while the selected run opens as a self-contained local HTML snapshot that stays usable after Uraniborg exits.

## What Changes

- Keep the TUI History menu as the list of all historical runs.
- When the user selects a run in TUI History, immediately generate and open a self-contained HTML snapshot for that selected run.
- Add `uraniborg history --web <runId>` for generating/opening a selected run snapshot without entering the TUI.
- Render the selected run as a focused reader with Summary, Original, per-iteration Review/Refined sections, and final Refined content.
- Exclude raw manifest/config JSON, logs, change summaries, information-highway memory, and other diagnostics from the primary reader.
- Keep Markdown artifacts as the source of truth and render them into sanitized HTML for browser reading.
- Disable raw HTML embedded inside Markdown for the MVP and sanitize generated HTML before it enters the snapshot.
- Avoid a local HTTP server, `127.0.0.1`, ports, background daemons, CORS, and server lifetime concerns.

## Capabilities

### New Capabilities

- `local-history-web-viewer`: Self-contained local HTML snapshot viewer for one selected run's artifacts.

### Modified Capabilities

- `run-recovery-and-history`: Keep terminal/TUI history as run discovery, and change selected-run exploration to open a browser snapshot for the selected run.

## Impact

- Affects TUI History selection behavior, CLI history/viewer options, run manifest/artifact read paths, Markdown rendering, packaging, and tests.
- Adds snapshot generation code and explicit Markdown rendering/sanitization dependencies.
- Does not upload data, require a cloud service, start a local server, mutate run history, delete artifacts, resume runs, or expose a network surface.
