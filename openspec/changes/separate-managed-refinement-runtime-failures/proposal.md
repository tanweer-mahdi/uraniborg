## Why

UAT showed that the recent failure-observability improvement is only partially correct for Pi-managed revision execution.

Uraniborg now preserves malformed refinement output and points the user to `refine.response.txt`, which is the right behavior when the model returns non-empty text that violates the strict `=== REFINED_DRAFT ===` / `=== CHANGE_SUMMARY ===` contract.

However, a later UAT run showed a different failure mode:

- Pi/OpenAI-Codex returned `stopReason: "error"`
- no usable text content was returned
- the saved `refine.response.txt` artifact was empty
- Uraniborg still classified the failure as `refine_output_invalid`

That is semantically wrong. A provider/runtime execution failure with no usable text payload is not the same as a malformed refinement-output contract violation.

## What Changes

- Separate managed revision runtime failures from refinement parse-contract failures.
- Update the managed execution path so provider/runtime error stops and empty-text error responses are surfaced as execution failures, not malformed output failures.
- Preserve provider-authored error details from Pi when available.
- Keep the strict refinement-output contract unchanged for cases where non-empty final text exists but fails the two-section parser.
- Refine failed-run artifact behavior so `refine.response.txt` remains the malformed-text artifact, not the primary diagnosis artifact for empty provider/runtime failures.

## Capabilities

### Modified Capabilities
- `iterative-draft-run`: managed revision runtime failures and malformed refinement-output failures become separate user-visible failure classes.
- `run-recovery-and-history`: failed refinement runs must preserve the right local evidence depending on whether the failure was provider/runtime execution or malformed output parsing.

## Impact

- Affected code:
  - `src/refine/execution.ts`
  - `src/refine/refinement.ts`
  - `src/loop/run-execution.ts`
  - tests for managed refinement execution and run failures
- Affected operator behavior:
  - provider/runtime failures surface provider-authored revision error details directly
  - malformed-output failures continue to point to `refine.response.txt`
