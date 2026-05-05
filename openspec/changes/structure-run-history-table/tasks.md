## 1. Rendering Contract

- [x] 1.1 Confirm the Run History screen consumes `HistoryEntry` records without changing manifest storage or collection.
- [x] 1.2 Add deterministic layout utilities for truncating and distributing history fields across wide and compact layouts.
- [x] 1.3 Keep the implementation dependency-free unless the focused implementation shows a clear need for an external Ink table package.

## 2. Interactive History UI

- [x] 2.1 Replace the Run History screen's pipe-delimited menu labels with a structured responsive history renderer.
- [x] 2.2 Render wide terminals as table-like rows with distinct status, progress, creation time, title, and run id fields.
- [x] 2.3 Render narrow terminals as compact rows/cards that preserve all required fields without horizontal scrolling.
- [x] 2.4 Preserve up/down selection and Enter-to-open behavior for the selected run.
- [x] 2.5 Preserve loading, error, and empty history states.

## 3. Regression Coverage

- [x] 3.1 Add or update TUI tests proving wide Run History output is structured and not pipe-delimited.
- [x] 3.2 Add or update TUI tests proving narrow Run History output remains readable and includes all required fields.
- [x] 3.3 Add or update TUI tests proving Enter opens the selected run id after navigation.

## 4. Validation

- [x] 4.1 Run focused TUI history tests.
- [x] 4.2 Run `npm run typecheck`.
- [x] 4.3 Run `openspec validate structure-run-history-table`.
