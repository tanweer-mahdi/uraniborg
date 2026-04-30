## 1. Review Failure Copy

- [x] 1.1 Update review-step failure handling to prefer provider-authored stderr/detail messages over generic exit-code-only wrapper copy when surfacing the error to the user.
- [x] 1.2 Preserve low-level execution metadata in `review.log` while keeping the primary terminal error concise and actionable.

## 2. Malformed Refinement Observability

- [x] 2.1 Persist the raw refinement response text to an iteration-local artifact when parse-contract validation fails after model execution succeeds.
- [x] 2.2 Update refinement failure surfacing to include a pointer to the saved malformed output artifact while keeping the strict contract failure intact.
- [x] 2.3 Ensure failed refinement runs remain diagnosable from local artifacts without requiring provider-side replay.

## 3. Verification

- [x] 3.1 Add tests for provider-authored review error surfacing.
- [x] 3.2 Add tests for malformed refinement output artifact persistence and user-facing failure copy.
- [x] 3.3 Run `npm run typecheck`, `npm test`, and `openspec validate improve-run-failure-observability`.
