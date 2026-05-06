## Context

### Hard Constraints

- The TUI History menu MUST still list all historical runs and preserve keyboard selection.
- Selecting a run from TUI History MUST immediately open a browser window for that selected run.
- The browser artifact explorer MUST be scoped to the selected run only.
- The viewer MUST be a self-contained local HTML snapshot opened via `file://`; it MUST NOT require `127.0.0.1`, a local HTTP server, a port, or a background process.
- The generated snapshot MUST remain usable after the Uraniborg process exits.
- The selected-run snapshot MUST NOT include a browser index of all runs, adjacent-run navigation, or artifacts from other runs.
- The primary reader MUST use a curated reading sequence rather than an artifact inventory dump.
- The primary reader MUST exclude raw `run.json`, raw `config.snapshot.json`, logs, `changes.md`, `input.md`, `current.md`, `information-highway.md`, and `refine.response.txt` from the visible reading flow.
- The primary reader MUST show only the currently selected reader panel instead of dumping all readable text into one long scroll.
- The viewer MUST be read-only: no delete, edit, resume, rerun, rename, import, export, or filesystem mutation actions.
- The snapshot generator MUST read only files rooted under the selected run directory after path normalization and realpath/path-prefix validation.
- The viewer MUST NOT upload run data, call remote services, or require a network connection.
- Markdown artifacts MUST remain the source of truth. The snapshot is a generated viewing artifact, not a replacement for run artifacts.
- Raw HTML embedded inside Markdown MUST be disabled for the MVP. Markdown syntax should render as HTML, but artifact-provided HTML tags/scripts must not become live browser DOM.
- Rendered artifact content MUST be escaped or sanitized before entering the HTML snapshot.
- Required runtime templates/assets MUST be included in `dist` and package validation.

The existing History implementation can collect run summaries and support keyboard selection. That is the right terminal-level responsibility. The missing product surface is interruption-free reading: curated manifest context, the original draft, per-iteration review/refined documents, and the final refined draft need browser-native reading affordances.

## Goals / Non-Goals

**Goals:**

- Keep terminal History as the run index.
- Generate a selected-run HTML snapshot from local run manifest/artifacts.
- Open the snapshot in the user's browser and show the file path/URL if automatic browser opening fails.
- Render Markdown artifacts into safe, browser-readable HTML while preserving the original Markdown files.
- Present a navigable primary reader with Summary, Original, per-iteration Review/Refined sections, and final Refined content.
- Keep the snapshot usable after Uraniborg exits.
- Keep the existing plain `uraniborg history` listing behavior for scripts and quick terminal checks.

**Non-Goals:**

- Local HTTP server, background daemon, port management, CORS, or API routes.
- Browser index of all runs, keyword/status filtering across runs, adjacent-run navigation, or a generic artifact browser.
- Primary-reader diagnostics for logs, changes, information-highway memory, raw manifest JSON, or raw config JSON.
- Remote hosting, sync, sharing, collaboration, or cloud access.
- Authentication, accounts, permissions, or multi-user access controls.
- Editing run manifests or artifacts from the browser.
- Resuming/retrying runs from the browser.
- Deleting runs or cleaning artifacts.

## Decisions

- Add a dedicated `src/history-viewer/` boundary for selected-run data loading, reader section preparation, Markdown rendering, safe HTML assembly, snapshot writing, and browser launch orchestration.
- Generate snapshots under a Uraniborg-owned cache/output directory, for example `~/.uraniborg/viewer-snapshots/`, with deterministic enough names to identify the run and avoid collisions.
- Open snapshots with the existing `RevisionBrowserLauncher` / `createNodeRevisionBrowserLauncher` abstraction by passing a `file://` URL. Browser-launch failure is non-fatal: report the snapshot path/URL for manual opening.
- Keep the snapshot self-contained for MVP: embed CSS, minimal JavaScript if needed, rendered artifact content, and run metadata in one HTML file. This avoids `file://` cross-file loading issues and removes server lifetime concerns.
- Scope snapshot generation to exactly one selected run. The TUI decides which run; the browser focuses on reading that run's artifacts.
- Use a reader-section model rather than a generic artifact-preview model. The primary section mapping is: Summary from curated manifest metadata, Original from `original.md`, per-iteration Review from `iter-N/review.md`, per-iteration Refined from `iter-N/refined.md`, and final Refined from `final.md`.
- Do not render raw `run.json` or `config.snapshot.json` as reader documents. The manifest may supply curated Summary metadata, but raw implementation JSON is not part of the interruption-free reader.
- Do not render logs, `changes.md`, `input.md`, `current.md`, `information-highway.md`, or `refine.response.txt` in the primary reader. A later change can add a separate diagnostics surface if needed.
- Render all reader sections into the self-contained file but show only one active panel at a time. Prefer CSS-only radio/tab controls to avoid JavaScript; if JavaScript is used, it must be inline, minimal, and must not call `fetch` or inject unsanitized content.
- Use user-facing navigation labels only: Summary, Original, Iteration N, Review, Refined. Do not show file paths or implementation labels like "Original draft", "Input draft", or "Final draft" in the primary reader.
- Render Markdown during snapshot generation. HTML does not natively render Markdown; the generation pipeline is: Markdown file -> bounded read -> `markdown-it` with `html: false` -> `sanitize-html` -> safe HTML fragment -> snapshot.
- Add `markdown-it` and `sanitize-html` as explicit runtime dependencies, with TypeScript type packages where required. A plaintext escaped fallback is acceptable for unsupported/oversized artifacts, but the MVP must render supported Markdown richly because Markdown readability is the product point.
- Bound reader document previews to avoid generating unreasonably large snapshots. Oversized reader documents should be truncated or summarized with a clear notice.
- Keep package runtime explicit: any templates/assets required for snapshot generation must be copied/built into package output and checked by package validation.

## Risks / Trade-offs

- [Risk] A snapshot can become stale if run artifacts change after it is opened -> Mitigation: make the snapshot visibly timestamped and treat it as a generated view; reopening from History regenerates it.
- [Risk] Large reader documents can create huge HTML files -> Mitigation: apply artifact size limits/truncation and communicate truncation in the UI.
- [Risk] Markdown-to-HTML rendering can introduce XSS if raw HTML is trusted -> Mitigation: configure raw HTML disabled, sanitize generated HTML, avoid artifact-provided scripts, and test malicious Markdown.
- [Risk] Symlinks inside run directories can bypass naive path checks -> Mitigation: realpath every artifact and require it to remain under the selected run root.
- [Risk] `file://` browser behavior can restrict cross-file requests -> Mitigation: produce a self-contained HTML file instead of relying on additional local fetches.
- [Risk] Generated snapshots duplicate run content -> Mitigation: store them under a clear Uraniborg-owned snapshot directory and consider cleanup policy in a later change.

## Migration Plan

- Keep existing terminal `uraniborg history` output unchanged.
- Keep the TUI History list as the user-facing run selector.
- Replace selected-run TUI detail as the primary artifact-reading path with browser snapshot generation/opening.
- Keep or de-emphasize `RunDetailScreen` only as a fallback/resume context if still needed elsewhere.
- Supersede the network-server assumptions in the earlier draft of this change; no loopback server is part of this MVP.
