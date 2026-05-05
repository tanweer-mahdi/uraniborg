## Context

History data is already collected as structured `HistoryEntry` objects with `runId`, `createdAt`, `status`, `progress`, and `title`. The current CLI formatter collapses those fields into a pipe-delimited string, and the Ink Run History screen reuses the same shape as a two-line menu label/hint. That keeps the implementation simple, but it makes the interactive screen hard to scan.

The current dependency set already includes Ink and custom TUI primitives. `ink-table` exists and advertises compatibility with Ink 3+, but it adds a runtime dependency and is optimized for static tables rather than Uraniborg's selected-row navigation. `@inkjs/ui` is compatible with Ink 5+, but it is a broader UI toolkit and does not remove the need for custom responsive selection behavior.

## Goals / Non-Goals

**Goals:**

- Present Run History entries as structured fields in the interactive Ink screen.
- Use a responsive layout: wide terminals render a table-like view, narrow terminals render compact readable rows.
- Preserve selection and Enter-to-open behavior.
- Keep run manifest storage and history collection unchanged.
- Keep the dependency surface stable unless a table package demonstrably improves maintainability.

**Non-Goals:**

- Redesign run detail, run recovery, or persisted manifest schemas.
- Add sorting/filtering/search to history.
- Change the meaning of status or progress values.
- Require terminal mouse support or horizontal scrolling.

## Decisions

- Implement an in-repo history table renderer first. The table needs row selection, field-specific truncation, and a compact fallback; these are small enough to own locally and safer than adapting a generic table package.
- Use the terminal width as an input to the renderer. In production the screen can read width from Ink/stdout; tests can pass an explicit width so truncation and responsive behavior stay deterministic.
- Keep `collectHistoryEntries` as the data boundary. The renderer will consume `HistoryEntry` records and will not read manifests or filesystem state.
- Use stable columns for the wide layout: status, progress, created time, title, and run id. The title may receive the most flexible width; run id and timestamp should truncate only when necessary.
- Use compact rows for narrow layouts. Each row should still expose status, progress, title, created time, and run id, but it may split those fields across multiple lines.
- Preserve the existing CLI `uraniborg history` contract unless implementation reveals a low-risk shared formatter. The user's stated pain is the interactive Run History screen, and changing CLI output can affect scripts.

## Risks / Trade-offs

- Wide titles can overflow the terminal -> truncate field values with deterministic ellipsis behavior and test narrow/wide rendering.
- A local table component can become another one-off primitive -> keep it focused on History unless a second screen needs tabular rendering.
- Terminal width APIs can be awkward in tests -> allow an optional width override on the screen/component.
- Avoiding `ink-table` means owning layout code -> acceptable because selection and responsiveness are Uraniborg-specific.
