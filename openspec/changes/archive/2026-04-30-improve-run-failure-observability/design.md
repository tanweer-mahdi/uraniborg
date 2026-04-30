## Context

The current iterative run implementation already fails closed in the right places:

- review subprocess failures stop the run
- malformed refinement output stops the run instead of guessing how to recover

The issue is not correctness. The issue is observability and copy quality.

Two UAT outcomes define the scope:

1. A selected review model can appear in discovery and still be rejected later by the provider/runtime due to account-specific entitlements. Uraniborg must not try to predict those provider semantics, but it must surface the provider-authored error instead of burying it behind an exit-code wrapper.
2. A refinement request can execute successfully but return text that violates Uraniborg’s strict parse contract. Uraniborg should continue failing closed, but it must preserve the offending raw output so the operator can inspect what the model actually returned.

This design therefore focuses on failure surfacing and artifact preservation, not on changing model-selection semantics, provider-runtime ownership, or the strict refinement contract.

## Goals / Non-Goals

**Goals:**

- Surface provider-authored review/runtime failures directly when stderr or equivalent error detail is available.
- Preserve low-level process metadata in logs without making it the primary user-facing error message.
- Persist malformed raw refinement output locally when parse validation fails.
- Point the operator to the saved malformed output artifact in the surfaced failure message.
- Keep failed-run diagnosis possible from local artifacts alone.

**Non-Goals:**

- Predict or pre-filter provider subscription or entitlement behavior.
- Relax the strict `REFINED_DRAFT` / `CHANGE_SUMMARY` contract.
- Add automatic repair or fallback parsing for malformed refinement responses in this change.
- Redesign review-model discovery.

## Decisions

### 1. Provider-authored review failures take precedence over generic process wrappers

When the embedded review runtime exits non-zero, Uraniborg currently records the subprocess exit code and throws a wrapper failure message. That wrapper is useful for logs, but weak for operators.

The new rule is:

- if the subprocess exposes a meaningful provider-authored error message in stderr, Uraniborg surfaces that message directly to the user
- exit code and raw stderr remain in the saved review log as diagnostics
- if stderr is empty or unusable, Uraniborg falls back to the current generic wrapper

This keeps provider semantics where they belong:

- provider defines the entitlement rule and exact reason
- Uraniborg relays it faithfully

Alternatives considered:

- Maintain the current generic wrapper only.
  - Rejected because UAT showed the provider message was the actual actionable signal.
- Add Uraniborg-owned entitlement heuristics for specific providers.
  - Rejected because provider subscription behavior changes over time and should not be reimplemented in Uraniborg.

### 2. Malformed refinement output must be preserved as a first-class failed-run artifact

The refinement parser should remain strict. If the response does not match the two-section contract, Uraniborg must fail the phase. However, the raw output must be preserved in an operator-owned artifact so the failure can be inspected without re-running the model.

The new rule is:

- when refinement execution returns final text but parse validation fails
- Uraniborg writes that raw text to an iteration-local artifact
- the refine log and surfaced error message point to that artifact

Recommended artifact:

- `iter-N/refine.response.txt`

This is intentionally local and deterministic:

- it does not require provider-side session replay
- it preserves exactly what Uraniborg attempted to parse

Alternatives considered:

- Store malformed output only inside `refine.log`.
  - Rejected because logs are optimized for mixed metadata + diagnostics, while the malformed output needs to be directly inspectable as standalone text.
- Attempt heuristic cleanup and reparsing before failing.
  - Rejected because this change is about observability, not relaxation of the product contract.

### 3. The CLI must couple concise failure copy with artifact pointers

The user journey should not require scanning code or guessing artifact names.

For malformed refinement output:

- the surfaced error remains concise and contract-based
- the message also points to the saved malformed output artifact path

For provider-authored review errors:

- the surfaced error should lead with the provider-authored message
- the saved `review.log` remains the durable diagnostic record

This balances:

- concise terminal output
- debuggable artifact preservation

### 4. Failed-run local artifacts remain the recovery boundary

This change reinforces the repository’s existing local-first runtime stance:

- diagnosis must come from the run directory
- no provider-side session or replay state is required to understand the failure

That means the new malformed refinement artifact becomes part of the expected failed-run evidence set for the refinement phase.

## Risks / Trade-offs

- [Risk] Some provider/runtime stderr may be noisy or structured as JSON rather than a single clean sentence. → Mitigation: prefer the highest-signal extracted message when possible, but retain the full raw log on disk.
- [Risk] Persisting raw malformed refinement output may include long text. → Mitigation: persist only the model text Uraniborg attempted to parse, not request auth material or unrelated runtime metadata.
- [Trade-off] Surfacing provider-authored errors means some user-facing copy will vary by provider. → This is acceptable because Uraniborg is intentionally not normalizing provider subscription semantics into its own taxonomy.

## Migration Plan

1. Update review failure handling so surfaced run errors prefer provider-authored stderr/detail messages over generic exit-code wrappers.
2. Add a dedicated malformed refinement output artifact for parse failures.
3. Update refine failure logging and terminal copy to point to the saved artifact.
4. Extend tests for:
   - provider-authored review error surfacing
   - malformed refinement artifact persistence
   - failed-run artifact expectations

Rollback strategy:

- revert to the generic wrapper copy and remove the extra malformed-output artifact
- no config or schema rollback is required
