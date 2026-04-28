# Uraniborg v1 Revision Flow UAT Observations

Date created: 2026-04-28
Purpose: track revision-flow UAT observations, strengths, and improvement opportunities that are not necessarily bugs
Related docs:

- [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md)
- [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)
- [uraniborg-v1-uat-resume-instructions.md](./uraniborg-v1-uat-resume-instructions.md)
- [uraniborg-v1-uat-observations.md](./uraniborg-v1-uat-observations.md)
- [uraniborg-v1-uat-issues.md](./uraniborg-v1-uat-issues.md)

## Session Rule For This File

This file captures revision-flow UAT observations and related product-improvement scope.

For the current session:

- do not treat entries here as approved code changes
- do not treat every entry here as a bug
- use this file to preserve both revision-flow-specific observations and adjacent operator-facing findings discovered during the same UAT path

## Current UAT Context

Observed from host-shell execution of:

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js run draft.md --iterations 1
```

Observed status summary:

- Filesystem readiness: passed
- Review runtime discovery: passed
- Review model discovery: passed
- AlphaXiv readiness: passed
- Web search readiness: passed
- Revision readiness: passed with model `gpt-5.4-2026-03-05`

Interpretation:

- Uraniborg reports a fully ready environment before the revision-flow UAT run begins
- the observations below come from the actual `run` path after both `doctor` and `revision --setup` reported readiness
- these notes may include non-revision-flow observations when they materially affect the operator's ability to understand the run lifecycle

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

## UAT-OBS-001 - Run still prompts for a revision model after revision readiness is already confirmed

- Date: 2026-04-28
- Category: ux
- Status: confirmed
- UAT case: single-iteration run start after successful `revision --setup` and healthy `doctor`
- Command: `node dist/src/cli/main.js run draft.md --iterations 1`

### Observation

- Uraniborg still asks the operator to choose a revision model during `run` even though revision setup was already completed and `doctor` reported revision readiness with a configured default model.
- From the operator perspective, this weakens the meaning of "Revision setup is ready" and makes it unclear whether the configured default is actually being used.
- This may be acceptable as an override flow, but the current UX does not make that contract explicit.

### Evidence

- `doctor` reported:
  - `Revision setup is ready. Model: gpt-5.4-2026-03-05. Endpoint: https://api.openai.com/v1`
- `run` then showed:

```text
Uraniborg checks the discovered review runtime...
Using Feynman runtime: /Users/shahmahdihasan/.local/bin/feynman (version 0.2.40).
Uraniborg checks revision setup...
│
◇  Which review model?
│  openai-codex/gpt-5.4
│
◆  Which revision model?
│  _
└
```

### Recommendation

- Clarify whether the configured revision model is meant to be a default, a required confirmation step, or an override prompt at run time.
- If the prompt remains, explain why the operator is being asked again despite revision readiness already being reported as complete.

## UAT-OBS-002 - Review phase does not surface live progress signals

- Date: 2026-04-28
- Category: ux
- Status: confirmed
- UAT case: live review execution during a single-iteration run
- Command: `node dist/src/cli/main.js run draft.md --iterations 1`

### Observation

- Once the review phase starts, Uraniborg gives no visible indication that work is actively progressing.
- The terminal remains parked on the review phase banner without any heartbeat, sub-step status, elapsed progress, or indication that Feynman is still running.
- This creates ambiguity between "review is working normally" and "the command is stalled."

### Evidence

- Uraniborg showed:

```text
Starting run: 2026-04-28T05-58-11Z-draft
Iteration 1/1: review
```

- No further progress text, intermediate status, or review-specific activity indicator was visible while the review process was running.

### Recommendation

- Add operator-facing progress signals during the review phase so a long-running review does not look stalled.
- At minimum, the review step should communicate that Feynman review is actively running and that Uraniborg is waiting for its output.

## UAT-OBS-003 - Review completion leaves artifact creation and output paths unclear

- Date: 2026-04-28
- Category: follow_up
- Status: confirmed
- UAT case: post-review inspection after a single-iteration run
- Command: `node dist/src/cli/main.js run draft.md --iterations 1`

### Observation

- After the review process completed, Uraniborg did not make it clear what review artifacts had been created or where they were written.
- From the operator perspective, the result is ambiguous: either the review finished without generating review artifacts, or the artifacts were generated but never surfaced clearly enough to inspect.
- This ambiguity is amplified by the lack of visible progress during the review step.

### Evidence

- The operator could not identify any created review artifacts after the review process completed.
- Uraniborg did not print the file names or paths of review outputs created during the review phase.
- Because the review phase itself exposed no intermediate status, it remained unclear whether the review actually executed correctly or silently failed to materialize artifacts.

### Recommendation

- Surface the review artifacts created by the run, including their paths, once the review phase completes.
- If no review artifact is available, report that state explicitly so the operator can distinguish "no artifact produced" from "artifact produced but not shown."
