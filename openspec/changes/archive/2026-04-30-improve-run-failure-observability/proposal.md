## Why

UAT exposed two failure modes where Uraniborg’s current operator-facing signals are too weak even though the underlying systems are behaving correctly:

- a provider or embedded review runtime can reject a selected model with a high-signal account or subscription error, but Uraniborg currently collapses that into a low-signal wrapper like `Pinned Feynman review exited with code 1 during iteration 1.`
- a revision model can execute successfully but violate Uraniborg’s strict `=== REFINED_DRAFT ===` / `=== CHANGE_SUMMARY ===` output contract, and Uraniborg currently fails closed without preserving enough raw response evidence for the operator to diagnose the malformed output

Uraniborg should not attempt to own provider subscription semantics or second-guess provider-side entitlement rules. It should surface those provider-authored errors clearly. It should also keep its strict refinement contract while making malformed responses debuggable from local run artifacts.

## What Changes

- Improve review-step failure surfacing so provider-authored runtime errors are shown directly to the user when available, while process exit codes remain secondary diagnostic detail in logs.
- Improve malformed refinement failure observability by persisting the raw revision response text when parse-contract validation fails.
- Update run-phase failure copy and artifacts so the user gets a concise actionable message plus a pointer to the saved malformed output artifact.
- Extend failed-run artifact requirements so local run directories remain sufficient for post-failure diagnosis without re-executing the provider call.

## Capabilities

### Modified Capabilities
- `iterative-draft-run`: review and refinement failures should preserve high-signal operator-facing messages and refinement parse failures should persist inspectable raw output artifacts.
- `run-recovery-and-history`: failed runs should preserve enough local evidence to diagnose the last run-phase failure from artifacts alone.

## Impact

- Affected code:
  - `src/review/feynman-review.ts`
  - `src/loop/run-execution.ts`
  - `src/refine/`
  - `src/run/`
  - `src/cli/commands/run.ts`
  - `src/cli/commands/resume.ts`
- Affected operator behavior:
  - review failures expose provider-authored model/account errors directly
  - malformed refinement failures remain strict but become inspectable from local artifacts
