## Context

The current refinement prompt is assembled in one place and owned completely by Uraniborg. The current setup is simple:

- the system prompt contains both the revision behavior guidance and the fixed structural/output-format contract
- the user prompt contains the current draft, peer review, and information highway
- the parse layer rejects any response that does not preserve the exact required two-section output

This feature must introduce configurability without weakening the parser contract or making resumed runs silently depend on a later-edited prompt file.

## Goals / Non-Goals

**Goals**

- Allow the operator to configure custom revision guidance through a markdown file.
- Preserve the current Uraniborg revision instruction as the default when no custom file is configured.
- Keep structural/output-format instructions fully Uraniborg-owned and non-overridable.
- Make run snapshots capture prompt provenance strongly enough for replay/debugging.
- Surface the configured prompt source and effective custom revision guidance in the TUI `Config` flow.

**Non-Goals**

- Allowing the user to replace the full refinement prompt template.
- Allowing the user to change required output markers or change-summary structure.
- Adding per-run ad hoc prompt overrides in this change.
- Turning config into an embedded prompt-document store as the primary source of truth.

## Decisions

### 1. Split the prompt into configurable guidance and fixed structural contract

Refinement prompt assembly will be split into two layers:

- `core revision guidance`
  - default: the current Uraniborg revision instruction text
  - override: user-provided markdown file contents
- `fixed structural contract`
  - Uraniborg-owned output-format and parsing requirements
  - never replaced by the user

This means the user's file changes how the model should revise, but it does not change the parse-critical format contract.

`Custom instruction` in this change always means this configurable `core revision guidance` layer only. It does not include Uraniborg's fixed structural/output-format instructions.

### 2. The custom revision instruction is configured by file path

The operator will point Uraniborg at a markdown file. Uraniborg stores the canonical absolute path in revision config.

Why path-based storage:

- keeps the operator's prompt in a real markdown file they own
- keeps config small and legible
- matches the repo's existing preference for filesystem-owned documents over large config blobs

### 3. The feature is global revision configuration, not per-run input

The configured prompt file belongs to revision configuration and is surfaced through the `Config` workflow. It is not part of `Run Setup` in this change.

This keeps the user journey simpler and preserves the current run-setup scope.

### 4. Readiness must fail loudly when a configured prompt file is missing or unreadable

If a custom prompt file path is configured, Uraniborg must verify that the file:

- exists
- is readable
- is a markdown file

If not, revision readiness becomes incomplete/action-required and run launch is blocked until the prompt source is fixed or cleared.

### 5. Run snapshots store effective prompt provenance, not just source path

`config.snapshot.json` will include a `revisionPrompt` block with:

- `source`: `default` or `file`
- `configuredPath`: absolute path when file-backed
- `effectiveInstruction`: the exact core revision instruction text used at launch time

This is intentionally stronger than just storing a path. It allows run inspection and resume behavior to remain reproducible even when the source markdown file is edited later.

### 6. Resume uses the snapshotted effective instruction

When a run is resumed, Uraniborg should continue using the prompt content that was captured at run creation time rather than silently switching to the current contents of the configured file.

This preserves run continuity and makes prompt provenance auditable.

## Prompt Assembly Model

The refinement prompt will move from one monolithic constant to a structured assembly model:

1. Resolve the effective core revision instruction:
   - configured file contents if configured and readable
   - otherwise Uraniborg default instruction
2. Append Uraniborg-owned invariant rules that must not be user-editable:
   - section-marker requirements
   - change-summary structure
   - no extra text outside the required sections
   - any other parse-critical output requirements
3. Preserve the existing labeled user-prompt inputs:
   - `CURRENT_DRAFT`
   - `PEER_REVIEW`
   - `INFORMATION_HIGHWAY`

This keeps user control where it is useful and product ownership where it is necessary.

## Config Model

Add an optional field under `revision`, for example:

- `revision.instructionPrompt.sourceFile`

Validation requirements:

- must end in `.md`
- must resolve to a readable file
- must be omitted when the operator wants the default prompt

Operator-facing rendering should show:

- default prompt in use
- or configured prompt path in use
- and, when file-backed, a preview of the effective custom revision guidance text that will be used as the configurable core instruction

## Risks / Trade-offs

- **User prompt weakens revision quality**: accepted risk; the operator owns the custom guidance.
- **User prompt attempts to override structure**: mitigated by keeping the structural contract outside the configurable layer.
- **Prompt file changes mid-run create drift**: mitigated by snapshotting the effective instruction text.
- **Large prompt text in JSON snapshot**: accepted trade-off for reproducibility; the prompt is not secret and is operationally useful.

## Open Questions

- Should the TUI offer a quick `clear custom prompt` action, or is overwriting/removing the configured path sufficient for the first pass?
