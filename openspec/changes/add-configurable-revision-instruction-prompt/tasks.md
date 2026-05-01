## 1. Config Contract And Validation

- [x] 1.1 Extend the revision config types and durable schema to support an optional custom revision-instruction markdown file path
- [x] 1.2 Validate the configured path as markdown and readable revision guidance
- [x] 1.3 Surface custom-prompt readiness failures through revision-config readiness and executable-config loading
- [x] 1.4 Update revision-config reporting so operator-facing config output shows whether the default prompt or a configured file is active, plus the canonical path and effective custom revision-guidance preview when file-backed

## 2. Prompt Resolution And Execution

- [x] 2.1 Refactor refinement prompt assembly so configurable core revision guidance is separate from Uraniborg-owned structural/output-format instructions
- [x] 2.2 Add prompt-resolution logic that loads the configured markdown file or falls back to the built-in default instruction
- [x] 2.3 Ensure the user-provided guidance cannot replace or suppress the fixed structural prompt contract
- [x] 2.4 Thread the resolved effective revision instruction through managed revision execution without changing provider/runtime ownership boundaries

## 3. Run Snapshot And Resume Determinism

- [x] 3.1 Extend `config.snapshot.json` to record revision-prompt provenance, including source kind, configured path when present, and the effective instruction text
- [x] 3.2 Ensure resumed runs continue using the snapshotted effective instruction rather than silently re-reading a later-edited prompt file
- [x] 3.3 Update run/history inspection surfaces as needed so prompt provenance remains operator-visible

## 4. TUI Configuration Flow

- [x] 4.1 Add a `Revision Prompt` configuration surface under the Ink `Config` workflow
- [x] 4.2 Allow the operator to set or replace the custom markdown path through the TUI
- [x] 4.3 Render the active prompt source in the TUI, including default-vs-file-backed state, canonical configured path, effective custom revision-guidance preview, and invalid-path guidance

## 5. Validation

- [x] 5.1 Add config/schema tests for default fallback, valid custom prompt path, missing custom prompt path, and unreadable prompt file handling
- [x] 5.2 Add refinement prompt tests proving the configurable guidance changes the core instruction while Uraniborg-owned structural markers remain fixed
- [x] 5.3 Add snapshot/resume tests proving the effective instruction is captured and reused deterministically
- [x] 5.4 Add TUI tests for configured/default prompt visibility and prompt-path editing behavior
