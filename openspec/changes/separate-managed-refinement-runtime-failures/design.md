## Context

The current managed refinement execution flow already distinguishes transport setup from output parsing, but its failure taxonomy is too coarse.

Observed UAT evidence:

- the run reached `Iteration 1/1: refine`
- `refine.log` recorded:
  - `Provider: openai-codex`
  - `Model: gpt-5.2`
  - `Stop reason: error`
  - empty response text
  - zero usage
- `refine.response.txt` was empty
- Uraniborg surfaced a parse-contract error anyway

This means the provider/runtime failed before producing a usable final response body, but the current Uraniborg path collapsed that state into `refine_output_invalid`.

The problem is not the strict contract itself. The problem is that the contract parser is currently being applied even when the upstream managed runtime never produced a parseable text candidate.

## Goals / Non-Goals

**Goals:**

- Distinguish provider/runtime execution failure from malformed refinement output in Pi-managed revision execution.
- Preserve Pi/provider-authored error details such as `errorMessage` when available.
- Keep malformed-output artifact preservation only for non-empty text that actually failed the parser.
- Keep the strict two-section refinement contract unchanged.

**Non-Goals:**

- Relax the parser.
- Change review-model selection.
- Change provider entitlements or retry policy.
- Add provider-specific heuristics beyond relaying Pi/provider error signals faithfully.

## Decisions

### 1. Managed runtime `stopReason: "error"` is a provider/runtime failure first

If Pi returns a terminal assistant message with:

- `stopReason: "error"` or `stopReason: "aborted"` as applicable
- optional `errorMessage`
- no usable final text

then Uraniborg should classify that as a refinement execution failure, not a parser failure.

This applies even if an empty string would also fail the parser. The parser should not be the primary classifier when the provider/runtime already signaled execution failure.

### 2. `errorMessage` is the highest-signal operator message for managed runtime failures

Pi’s assistant message contract includes `errorMessage` on error-stopped results. Uraniborg should preserve that field into its own refinement error/logging surface.

Priority order for surfaced managed runtime failures:

1. provider-authored `errorMessage`
2. generic managed runtime failure copy
3. low-level stop metadata in logs

This keeps provider semantics provider-owned while still giving Uraniborg a stable fallback.

### 3. `refine.response.txt` remains a malformed-text artifact only

`refine.response.txt` should continue to mean:

- “this is the actual non-empty text Uraniborg tried to parse”

It should not be the primary diagnosis artifact for empty managed runtime failures.

For empty managed runtime failures:

- `refine.log` should carry the provider/runtime failure details
- a saved raw response artifact is optional, but if written it must not imply that a malformed text body existed

### 4. Failed-run diagnostics should branch by failure class

Two refinement failure classes now matter:

- managed runtime execution failure
- malformed refinement text

Both must remain diagnosable from local artifacts, but the relevant evidence differs:

- execution failure: stop reason, provider error message, request/response metadata
- malformed text: raw text artifact plus parser failure context

## Risks / Trade-offs

- [Risk] Some providers may report `stopReason: "error"` with partial text. → Mitigation: branch on both stop reason and whether usable text exists; malformed-text classification remains available when text is present.
- [Risk] Pi/provider error payloads may vary in quality. → Mitigation: prefer `errorMessage` when present, but keep generic fallback copy.
- [Trade-off] The failure taxonomy becomes more explicit, which may add one more error path to tests and logs. → This is acceptable because the current taxonomy is semantically wrong.

## Migration Plan

1. Update managed refinement execution to preserve `errorMessage`.
2. Reclassify empty managed error-stopped responses as runtime execution failures.
3. Keep parser-based malformed-output handling only for non-empty text responses.
4. Add regression tests for:
   - managed runtime error with empty text
   - malformed non-empty text still using `refine.response.txt`

Rollback strategy:

- revert to the previous coarse classification and retain the current malformed-output artifact flow
- no config/schema rollback is required
