## Why

The Run History screen currently presents each run as unstructured pipe-delimited text, which makes it hard to scan status, progress, timestamps, and titles. History is a core recovery/navigation surface, so it should present the same run metadata in a structured, responsive layout.

## What Changes

- Replace the Run History screen's pipe-delimited labels with structured rows that expose run id, creation time, status, progress, and title as distinct fields.
- Make the history layout responsive so wide terminals use a table-like presentation and narrow terminals preserve readability with a compact row/card layout.
- Preserve existing history behavior for empty states, loading/errors, selection, and opening a selected run.
- Evaluate Ink table package options, but prefer an in-repo renderer unless an external package provides a clear maintenance and UX advantage.

## Capabilities

### New Capabilities

### Modified Capabilities

- `run-recovery-and-history`: Strengthen run history listing requirements to require structured, responsive presentation in the interactive Run History screen.

## Impact

- Affects the Ink Run History screen and its test coverage.
- May add a small reusable TUI table/row component if the existing component set is not sufficient.
- Does not change persisted run manifests, run recovery semantics, or history data collection.
- Does not require a new npm runtime dependency unless implementation analysis proves the in-repo renderer is worse than a focused Ink table package.
