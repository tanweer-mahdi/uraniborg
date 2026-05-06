## 1. Snapshot Boundary and Safety

- [x] 1.1 Create a `src/history-viewer/` module boundary for selected-run loading, reader-section preparation, Markdown rendering, HTML snapshot assembly, snapshot writing, and browser launch orchestration.
- [x] 1.2 Implement selected-run lookup by run id without changing existing history collection or manifest storage.
- [x] 1.3 Implement path normalization and realpath/path-prefix checks so reader document reads cannot escape the selected run directory.
- [x] 1.4 Ensure snapshot generation is read-only for source run manifests and artifacts.
- [x] 1.5 Add safety tests for missing runs, path traversal rejection, symlink escape rejection, selected-run-only content, and read-only source artifacts.

## 2. Primary Reader View Model

- [x] 2.1 Build a selected-run Summary panel from curated manifest fields: run id, title, status, phase, progress, created time, updated time, source input path, selected review model, selected refinement model, and last-error diagnostics when present.
- [x] 2.2 Build an Original reader section from `original.md` when present.
- [x] 2.3 Build per-iteration reader sections from `iter-N/review.md` as Iteration N Review and `iter-N/refined.md` as Iteration N Refined when present.
- [x] 2.4 Build the final Refined reader section from `final.md` when present.
- [x] 2.5 Exclude raw `run.json`, raw `config.snapshot.json`, `input.md`, `current.md`, `information-highway.md`, `review.log`, `changes.md`, `refine.log`, and `refine.response.txt` from the visible primary reader.
- [x] 2.6 Add tests for exact reader-section mapping, Summary fields without raw manifest JSON, excluded implementation artifacts, and missing optional reader documents.

## 3. Markdown Rendering and Self-Contained Reader HTML

- [x] 3.1 Add `markdown-it` and `sanitize-html` as explicit runtime dependencies, with TypeScript type packages where required.
- [x] 3.2 Add an explicit Markdown rendering implementation that keeps Markdown artifacts as source-of-truth files.
- [x] 3.3 Configure `markdown-it` with raw HTML disabled so embedded Markdown HTML does not become live browser DOM.
- [x] 3.4 Sanitize generated Markdown HTML with `sanitize-html` before embedding it in the snapshot.
- [x] 3.5 Replace the long-page artifact dump with a self-contained primary-reader template that renders only one selected reader panel at a time.
- [x] 3.6 Implement CSS-only reader tab/panel controls for Summary, Original, per-iteration Review/Refined, and final Refined.
- [x] 3.7 Use only user-facing labels in navigation and panels: Summary, Original, Iteration N, Review, and Refined.
- [x] 3.8 Write snapshots under a Uraniborg-owned snapshot directory, for example `~/.uraniborg/viewer-snapshots/`, using names that include the run id and avoid collisions.
- [x] 3.9 Ensure generated snapshots contain no required sidecar assets, `fetch` calls, remote script/style/font/image URLs, external network resource references, or visible implementation file paths.
- [x] 3.10 Add tests for formatted Markdown output, raw-HTML disabling, sanitizer behavior, CSS-only selected-panel behavior, self-containment, no-network-resource assertions, no visible implementation labels/paths, and original Markdown preservation.

## 4. Browser Launch Integration

- [x] 4.1 Reuse the existing browser launcher abstraction to open generated snapshots via `file://` URLs.
- [x] 4.2 Surface browser-open failure as a manual snapshot path/URL fallback rather than a fatal generation failure.
- [x] 4.3 Add `uraniborg history --web <runId>` for selected-run snapshot launch while preserving existing plain `uraniborg history` output.
- [x] 4.4 Update TUI History so it still lists all runs and immediately generates/opens the selected run snapshot on selection.
- [x] 4.5 Add visible TUI states for generating/opening snapshot, successful snapshot path/URL display, browser-open fallback, and snapshot-generation failure without silent route changes.
- [x] 4.6 Add CLI/TUI tests for `uraniborg history --web <runId>`, selected-run snapshot launch, manual fallback, missing-run handling, no-runs handling, TUI launch state, and unchanged plain history listing.

## 5. Packaging and Release Safety

- [x] 5.1 Ensure snapshot code and Markdown rendering dependencies are included in package runtime output.
- [x] 5.2 Update package validation to fail when required snapshot runtime output is missing.
- [x] 5.3 Add package tests covering snapshot runtime inclusion and Markdown dependency classification.
- [x] 5.4 Confirm packaging and release checks still pass after the primary-reader rewrite.

## 6. Validation

- [x] 6.1 Run focused history-viewer snapshot, reader-section, and Markdown rendering tests.
- [x] 6.2 Run focused CLI/TUI history snapshot launch tests.
- [x] 6.3 Run `npm run typecheck`.
- [x] 6.4 Run `npm run test`.
- [x] 6.5 Run `npm run build`.
- [x] 6.6 Run `npm run package:check`.
- [x] 6.7 Run `npm run pack:dry-run`.
- [x] 6.8 Run `npm run release:ci`.
- [x] 6.9 Run `openspec validate add-local-history-web-viewer`.
