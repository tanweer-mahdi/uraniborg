# Uraniborg v1 UAT Observations

Date created: 2026-04-25
Purpose: track notable UAT observations, strengths, and improvement opportunities that are not necessarily bugs
Related docs:

- [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md)
- [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)
- [uraniborg-v1-uat-resume-instructions.md](./uraniborg-v1-uat-resume-instructions.md)
- [uraniborg-v1-uat-bug-inventory.md](./uraniborg-v1-uat-bug-inventory.md)

## Session Rule For This File

This file captures UAT observations and product-improvement scope.

For the current session:

- do not treat entries here as approved code changes
- do not treat every entry here as a bug
- use this file to preserve both successful outcomes and UX polish candidates

## Current UAT Context

Observed from host-shell execution of:

```bash
node dist/src/cli/main.js doctor
```

Observed status summary:

- Filesystem readiness: passed
- Review runtime discovery: passed
- Review model discovery: passed
- AlphaXiv readiness: passed
- Web search readiness: passed
- Refinement readiness: failed because `OPENAI_API_KEY` was not set

Interpretation:

- first-run review-runtime discovery now works in the real host environment
- UAT is no longer blocked by the prior vendored-runtime contract issue
- remaining blocker in this specific run is refinement-side configuration, not review-runtime setup

## How To Use This File

Add one entry per distinct UAT observation.

Suggested categories:

- `strength`
- `improvement`
- `copy`
- `ux`
- `follow_up`

Suggested statuses:

- `noted`
- `confirmed`
- `deferred`
- `ready_for_follow_up`
- `closed`

## Observation Template

```markdown
## UAT-OBS-XXX - Short title

- Date:
- Category:
- Status:
- UAT case:
- Command:

### Observation

-

### Evidence

-

### Recommendation

-
```

## Active Observations

## UAT-OBS-001 - Review model discovery is a strong doctor outcome

- Date: 2026-04-25
- Category: strength
- Status: confirmed
- UAT case: host-shell `doctor` readiness review
- Command: `node dist/src/cli/main.js doctor`

### Observation

- Showing review model discovery in `doctor` is a strong addition.
- The surfaced model count and resolved runtime path make the review side feel concrete and verifiable.
- This improves operator confidence compared with a purely implicit runtime check.

### Evidence

- `doctor` reported a compatible Feynman runtime at `/Users/shahmahdihasan/.local/bin/feynman`
- `doctor` reported `23 available models`

### Recommendation

- Preserve model discovery visibility in `doctor`
- Later iteration can refine wording and presentation without removing the capability

## UAT-OBS-002 - Raw exit-code lines reduce doctor output quality

- Date: 2026-04-25
- Category: ux
- Status: confirmed
- UAT case: host-shell `doctor` readiness review
- Command: `node dist/src/cli/main.js doctor`

### Observation

- Repeated lines such as `Exit code: 0` should not be shown in normal successful `doctor` output.
- They read like internal diagnostic leakage rather than polished operator-facing status.

### Evidence

- `AlphaXiv is ready` was followed by `Exit code: 0`
- `Web search is ready` was followed by `Exit code: 0`

### Recommendation

- Hide successful exit-code details from the standard `doctor` view
- Reserve low-level process metadata for verbose or debug-oriented output paths

## UAT-OBS-003 - Raw stdout fragments should be formalized in doctor output

- Date: 2026-04-25
- Category: improvement
- Status: confirmed
- UAT case: host-shell `doctor` readiness review
- Command: `node dist/src/cli/main.js doctor`

### Observation

- Several `stdout` fragments are currently printed as raw runtime output.
- This weakens the presentation quality of `doctor` and exposes implementation-shaped details instead of product-shaped readiness information.

### Evidence

- `AlphaXiv is ready` was followed by `stdout: alphaXiv logged in as Tanweer Mahdi Hasan`
- `Web search is ready` was followed by a raw multi-field runtime summary beginning with `Managed by: pi-web-access`

### Recommendation

- Reframe successful readiness details into formal, curated fields
- Avoid printing raw command output directly in the default `doctor` experience
- Keep implementation-level fragments available only in a more diagnostic mode if needed

## UAT-OBS-004 - `models` currently includes non-model capability status

- Date: 2026-04-25
- Category: ux
- Status: confirmed
- UAT case: host-shell `models` command review
- Command: `node dist/src/cli/main.js models`

### Observation

- The `models` command currently reports AlphaXiv and web-search status even though neither capability is itself a model inventory.
- This makes the command boundary feel unclear.
- From a UAT perspective, the operator expectation is that `models` should primarily answer model-related questions, not broader research-tool readiness.

### Evidence

- `models` surfaced AlphaXiv and web-search readiness information
- the same session expectation was that these should remain under a broader environment or connectivity-oriented command

### Recommendation

- Treat this as a product-scope issue in command design
- a follow-up command surface should distinguish:
  - model inventory
  - general Feynman capability/configuration status

## UAT-OBS-005 - `models` output still leaks internal runtime fragments

- Date: 2026-04-25
- Category: improvement
- Status: confirmed
- UAT case: host-shell `models` command review
- Command: `node dist/src/cli/main.js models`

### Observation

- The same UX issue seen in `doctor` also appears in `models`: raw runtime fragments such as `Exit code` and `stderr` are being surfaced directly.
- This lowers output quality and makes the command feel implementation-shaped instead of operator-shaped.

### Evidence

- `models` output exposed low-level runtime/code fragments rather than only curated status information

### Recommendation

- Keep default `models` output formal and product-facing
- move low-level process details to a verbose or diagnostic path only

## UAT-OBS-006 - `models` and `doctor` have an unclear contract boundary

- Date: 2026-04-25
- Category: follow_up
- Status: confirmed
- UAT case: cross-command behavior review
- Command: `node dist/src/cli/main.js doctor`

### Observation

- `doctor` and `models` currently overlap in ways that make their responsibilities unclear.
- `doctor` is presenting environment readiness, while `models` is also pulling in non-model capability checks.
- This creates a user-visible sense of inconsistency and weakens confidence in the command model.

### Evidence

- `doctor` already showed review model discovery, AlphaXiv readiness, and web-search readiness
- `models` then also surfaced non-model capability status instead of remaining narrowly model-focused

### Recommendation

- separate command responsibilities more cleanly
- one command should remain broad environment/readiness validation
- one command should remain narrowly focused on model inventory and selection
- a separate capability-status command would better fit AlphaXiv and web-search checks

## UAT-OBS-007 - Code-level explanation for the observed `doctor`/`models` overlap

- Date: 2026-04-25
- Category: follow_up
- Status: confirmed
- UAT case: source-level explanation for observed CLI behavior
- Command: source inspection only

### Observation

- The overlap is not accidental in the current implementation.
- `models` reuses the same Feynman readiness pipeline as `doctor`, so it is intentionally collecting and rendering AlphaXiv and web-search status in addition to review-model discovery.
- This explains why `models` can show non-model capability state at all.
- This explanation does **not** by itself explain a true ready/not-ready mismatch between the two commands.

### Evidence

- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts:89) initializes `classifyFeynmanReadiness(...)`
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts:115) calls `listModels(...)`, `getAlphaStatus(...)`, and `getSearchStatus(...)` together
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts:190) renders a `Recommended Capabilities` section from those readiness checks
- [src/review/feynman-readiness.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-readiness.ts:246) defines AlphaXiv and web search as `recommended` readiness checks inside the shared classifier
- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts:103) uses the same underlying readiness classification path for `doctor`

### Recommendation

- Treat the current behavior as a command-design issue rather than only a copy issue
- if the intended operator contract is “`models` shows models only,” the implementation needs a narrower reporting path than the current shared readiness report
- if a broader capability view is still useful, expose it under a dedicated command that clearly communicates scope

## UAT-OBS-008 - A real status mismatch between `doctor` and `models` is not explained by the current code structure alone

- Date: 2026-04-25
- Category: follow_up
- Status: confirmed
- UAT case: source-level reasoning about conflicting command outcomes
- Command: source inspection only

### Observation

- If `doctor` truly reports AlphaXiv and web search as ready while `models` reports them as not configured, that mismatch is not explained by different readiness logic.
- Both commands gather those statuses through the same execution path and the same classifier.
- That means the remaining plausible causes sit outside the high-level reporting structure itself.

### Evidence

- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts:123) and [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts:115) both run the same three Feynman subprocesses:
  - `model list`
  - `alpha status`
  - `search status`
- [src/review/feynman-readiness.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-readiness.ts:53) is the shared classifier used by both commands
- [src/review/feynman-readiness.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-readiness.ts:245) uses the same `interpretCapabilityStatus(...)` logic for both commands

### Interpretation

- The codebase does not currently show a separate branch where `doctor` and `models` would intentionally disagree on AlphaXiv or web-search readiness.
- If the commands genuinely disagree in the same host environment, the more likely explanations are:
  - the underlying Feynman subprocess output changed between invocations
  - the exact observed `models` output included diagnostic fragments that were interpreted as the primary status
  - there is another execution-context issue not visible from static inspection alone

### Recommendation

- Treat the command-scope problem and the status-mismatch problem as two separate UAT findings
- do not mark the true mismatch as root-caused yet
- preserve the stronger current conclusion:
  - the implementation explains why `models` includes non-model capabilities
  - it does not yet fully explain why the two commands would disagree on their ready/not-ready result

## UAT-OBS-009 - Root cause of the Feynman corruption incident

- Date: 2026-04-25
- Category: follow_up
- Status: confirmed
- UAT case: host-shell sequence `build -> doctor -> init -> models -> doctor`
- Command: source inspection plus local runtime file inspection

### Observation

- The observed runtime corruption is consistent with Uraniborg launching multiple Feynman subprocesses in parallel while the discovered Feynman install performs startup-time self-patching.
- `init` did not mutate Feynman.
- The highest-risk Uraniborg paths were the parallel Feynman probes in `doctor`, `models`, and PATH-candidate runtime inspection.

### Evidence

- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts:123) previously used `Promise.all(...)` for `model list`, `alpha status`, and `search status`
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts:115) previously used the same parallel probing pattern
- [src/review/feynman-bootstrap.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-bootstrap.ts:178) previously probed discovered runtime candidates in parallel
- the affected Feynman install was observed with torn/truncated files under its own install tree after the incident

### Recommendation

- Uraniborg should serialize all Feynman subprocess access on its side
- Uraniborg should collect shared runtime facts through one review-side snapshot path instead of duplicating probe orchestration across commands

## UAT-OBS-010 - Uraniborg-side mitigation implemented for self-patching Feynman installs

- Date: 2026-04-25
- Category: follow_up
- Status: ready_for_follow_up
- UAT case: post-RCA mitigation
- Command: implementation follow-up

### Observation

- Uraniborg has been updated to:
  - serialize Feynman subprocess access
  - collect shared runtime facts through a common review-side snapshot path
  - remove raw subprocess fragments from default `doctor` and `models` output
  - narrow `models` back to model-focused reporting

### Evidence

- shared runtime collector added in [src/review/feynman-runtime.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-runtime.ts:1)
- `doctor`, `models`, `run`, and `resume` now use serialized Feynman access via the shared review-side path
- regression coverage added for serialized runner behavior and curated command output

### Recommendation

- retest `doctor`, `models`, and the broader first-run UAT flow against a repaired Feynman installation
- confirm that the previous corruption sequence cannot be reproduced from Uraniborg alone
