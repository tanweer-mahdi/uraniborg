---
name: session-handover
description: Create a time-stamped session handover note that is self-sufficient and authoritative. Use when the user asks to prepare session handoff notes, write session logs, checkpoint progress for the next session, or capture the exact resume point for ongoing development work.
---

Create a time-stamped session handover note that contains the authoritative truth for the current development state.

The note must be self-sufficient. The next session should not need to reconstruct context from memory.
The note must also be extremely high signal. Prefer implementation reality over process commentary.

## When To Use

Use this skill when the user asks to:

- prepare a session handoff
- write a session log for the next session
- checkpoint current implementation progress
- capture the exact resume point before stopping or compaction

## Required Workflow

1. Read the repository instructions first.
   - Always read `AGENTS.md` when present.
   - Follow any repo-specific rules about session-log location and handoff requirements.

2. Read the latest existing handoff note before writing a new one.
   - If the repo has a session-log directory, inspect the newest handoff/log files there.
   - Treat the latest valid handoff note as prior context, not as the source of truth over the current repo state.

3. Reconstruct the current authoritative state from artifacts, not memory.
   - Inspect locked specs and planning artifacts explicitly.
   - Inspect git state.
   - Inspect current task/progress artifacts.
   - Inspect current test results and validation status.
   - Inspect the working tree for uncommitted files relevant to handoff.

4. Write a new timestamped handoff note.
   - Use the repo’s required location and naming convention when one exists.
   - If the repo has no convention, prefer `notes/session-logs/<timestamp>-session-handoff.md`.

5. Make the new note supersede the previous one explicitly.
   - Name the prior handoff file if one exists.

## High-Signal Rules

Apply these rules aggressively:

- Prefer concrete resume information over process commentary.
- Prefer implementation facts over workflow narration.
- Do not restate the skill’s own rules inside the handoff note.
- Do not list an artifact unless it will help the next session resume work.
- Do not treat operational commands as planning artifacts unless the repo truly uses their output as the active planning surface.
- Do not list workflow-only files as planning artifacts unless they materially changed development behavior for the project itself.
- Do not add sections full of negative inventory. If nothing happened, say so in one line.
- When a prior note contains stronger implementation detail than the current draft, preserve that detail instead of replacing it with process metadata.
- Do not omit commits created earlier in the same working session just because they predate the latest handoff note or checkpoint.
- If forced to choose, keep:
  - exact resume seam
  - completed implementation facts
  - remaining task order
  - current validation counts
  - critical risks/blockers
  over:
  - exhaustive process provenance
  - repeated meta-rules
  - administrative commentary

## Authoritative Inputs Checklist

The handoff note must explicitly reference the authoritative sources of truth used in the session.

Always include:

1. Locked spec sources
   - List every locked or authoritative spec/planning artifact that governs implementation.
   - Refer to them explicitly in the note.
   - If ordering matters, state the order of precedence.

2. Session commit references
   - Include the HEAD commit at handoff time.
   - Include every commit created during the current working session when the user asked for commits or when commits materially changed the implementation state.
   - Do not narrow "this session" to "since the previous handoff note" unless the user explicitly asks for that scope.

3. Planning artifacts
   - Reference any implementation plan, ordered task list, dependency-aware task list, OpenSpec task file, or equivalent planning artifact updated or created during the session.
   - State the exact resume point inside that artifact.
   - Only include artifacts that actively guide implementation resumption.

4. Remaining work
   - List the remaining tasks required to complete the project or current change.
   - Preserve task order when the planning artifact is ordered.

5. Critical learnings
   - Capture anti-patterns, failed attempts, failed tests, blocked experiments, surprising environment facts, and any other detail that would change how the next session should proceed.

6. User interventions
   - Inventory any user intervention during agent execution.
   - Only include interventions that materially changed implementation trajectory, architecture, requirements, process constraints, or deliverables.
   - For each intervention, capture:
     - what the user changed or requested
     - the context in which it happened
     - whether it changed trajectory or not
     - any architectural rule, feature request, service request, or imperative development principle introduced by that intervention

7. Test and validation status
   - Report current test status numerically when possible, for example `53 / 56 tests passed`.
   - Include failed tests, skipped tests, flaky tests, or validations that must be retried later.
   - If validation commands emitted noisy but non-blocking errors, record that clearly.

## Required Handoff Sections

Use this structure unless the repo has a stricter mandated format:

1. `# Session Handoff - <timestamp>`
2. Supersession statement
3. `## State Snapshot`
4. `## Authoritative Sources Of Truth`
5. `## Commits Created This Session`
6. `## Planning Artifacts`
7. `## What Was Completed This Session`
8. `## Validation Run`
9. `## Important Findings`
10. `## User Interventions`
11. `## Exact Resume Point`
12. `## Remaining Task Order`
13. `## Current Working Tree`

Compression rule:

- If a section would be empty or purely ceremonial, compress it to one sentence.
- If a section would repeat another section, merge or trim instead of duplicating.

## State Snapshot Requirements

At minimum include:

- branch
- HEAD commit hash
- HEAD subject
- working tree status
- current date
- active change/spec identifier when applicable
- planning/progress status
- first incomplete task or next resume seam

## Planning Artifacts Section Requirements

This section must:

- name each planning artifact updated or relied on in the session
- describe its role
- point to the exact resume point in that artifact
- identify whether any new planning artifact was created during the session

If no planning artifact exists, say that explicitly and name the operational substitute used instead.

Do not include:

- workflow skills
- handoff notes
- validation commands
- generic repo docs

unless they are themselves the active implementation control surface for the next session.

## Validation Run Requirements

Always include:

- commands actually run
- whether they passed or failed
- exact counts when known
- any failed or deferred validations still relevant to the next session

Examples:

- `npm test` -> `56 / 56 tests passed`
- `pytest` -> `182 passed, 3 failed`
- `openspec validate build-uraniborg-v1` -> passed, emitted non-blocking telemetry/network noise

## User Interventions Section Requirements

If there were no user interventions that altered execution, say:

- `No user interventions changed the implementation trajectory in this session.`

Do not omit the section.

If the user asked for something that only affected handoff formatting and did not alter implementation work, keep that mention brief.

## Quality Bar

The note must be:

- authoritative over anecdotal
- explicit over implied
- resume-oriented rather than retrospective
- complete enough that the next session can continue without guesswork
- denser on implementation state than on process mechanics

Do not write vague summaries like `worked on run flow`.
Name the exact tasks, files, commands, outcomes, and resume seam.

When summarizing completed work, prefer this order:

1. exact planning tasks completed
2. exact files/modules changed
3. exact commands run and test counts
4. critical findings that affect the next implementation move

Avoid:

- congratulatory language
- generic “best practices” reminders
- restating obvious repo conventions already captured in `AGENTS.md`
- padding the note just to satisfy section count
