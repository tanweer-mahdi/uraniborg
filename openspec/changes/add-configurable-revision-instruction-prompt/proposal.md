## Why

Uraniborg currently owns the full revision instruction prompt as a hardcoded constant. That is safe, but it is too rigid for operators who want to tune the revision behavior for their own writing and research style.

The product needs a controlled configuration seam:

- keep the current Uraniborg instruction as the default
- allow the user to point Uraniborg at a markdown file containing custom revision guidance
- keep Uraniborg-owned structural/output-format requirements non-overridable so parsing and run determinism remain intact
- capture prompt provenance in run snapshots so runs remain inspectable and reproducible

## What Changes

- Add an optional revision-instruction source to Uraniborg revision configuration.
- Keep the current hardcoded revision instruction as the default fallback when no custom instruction file is configured.
- Allow the operator to configure a markdown file path for the custom revision instruction through the `Config` workflow.
- Store that configured markdown path as a canonical absolute path.
- Split refinement prompt assembly into:
  - operator-configurable core revision guidance
  - Uraniborg-owned fixed structural/output-format contract
- Require Uraniborg to continue owning the parse-critical instruction tail, including the required `=== REFINED_DRAFT ===` and `=== CHANGE_SUMMARY ===` sections.
- Capture prompt provenance in `config.snapshot.json`, including the effective instruction source and the effective snapshotted instruction text used for the run.
- Surface both the configured prompt path and the effective custom revision guidance preview in operator-facing config views.

## Capabilities

### Modified Capabilities
- `revision-configuration`: revision config can optionally reference a user-owned markdown file for custom revision guidance, with default fallback semantics and config-surface visibility.
- `revision-provider-execution`: refinement prompt assembly accepts a user-configurable revision instruction while preserving Uraniborg-owned structural prompt invariants.
- `iterative-draft-run`: run snapshots capture effective revision-instruction provenance for reproducibility and debugging.

## Impact

- Affected code: `src/config/*`, `src/refine/*`, run snapshot generation, and the Ink `Config` / revision setup surface.
- New validation surface: markdown-path validation, unreadable/missing prompt-file handling, and prompt-assembly invariants.
- User-facing behavior: operators can tune revision guidance without being able to break Uraniborg's output parser contract.

## Assumptions

- The configured prompt file is a global revision configuration setting, not a per-run override.
- Uraniborg stores the configured prompt-file path as a canonical absolute path in config.
- `config.snapshot.json` stores the effective instruction text used at launch time so resumed runs can stay reproducible even if the source file changes later.
- `custom instruction` refers only to the configurable core revision guidance; Uraniborg-owned structural/output-format instructions remain outside that configurable text.
