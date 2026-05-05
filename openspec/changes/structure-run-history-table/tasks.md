## 1. Rendering Contract

- [ ] 1.1 Confirm the Run History screen consumes `HistoryEntry` records without changing manifest storage or collection.
- [ ] 1.2 Add deterministic layout utilities for truncating and distributing history fields across wide and compact layouts.
- [ ] 1.3 Keep the implementation dependency-free unless the focused implementation shows a clear need for an external Ink table package.

## 2. Interactive History UI

- [ ] 2.1 Replace the Run History screen's pipe-delimited menu labels with a structured responsive history renderer.
- [ ] 2.2 Render wide terminals as table-like rows with distinct status, progress, creation time, title, and run id fields.
- [ ] 2.3 Render narrow terminals as compact rows/cards that preserve all required fields without horizontal scrolling.
- [ ] 2.4 Preserve up/down selection and Enter-to-open behavior for the selected run.
- [ ] 2.5 Preserve loading, error, and empty history states.

## 3. Regression Coverage

- [ ] 3.1 Add or update TUI tests proving wide Run History output is structured and not pipe-delimited.
- [ ] 3.2 Add or update TUI tests proving narrow Run History output remains readable and includes all required fields.
- [ ] 3.3 Add or update TUI tests proving Enter opens the selected run id after navigation.

## 4. Validation

- [ ] 4.1 Run focused TUI history tests.
- [ ] 4.2 Run `npm run typecheck`.
- [ ] 4.3 Run `openspec validate structure-run-history-table`.
