# Uraniborg v1 UAT Plan

Date: 2026-04-24
Status: Draft for execution
Spec baseline: archived change `openspec/changes/archive/2026-04-24-build-uraniborg-v1/`
Canonical specs:

- `openspec/specs/environment-setup/spec.md`
- `openspec/specs/model-selection/spec.md`
- `openspec/specs/iterative-draft-run/spec.md`
- `openspec/specs/run-recovery-and-history/spec.md`

## Current UAT Status

- Current UAT status: blocked for first-run bootstrap success testing
- Reason: the locked spec requires Uraniborg to provision a pinned Feynman runtime under `~/.uraniborg/vendor/feynman`, but the current implementation does not create `runtime.json` or the pinned executable from zero state
- Practical effect: `doctor` can detect the missing runtime, but its remediation path tries to launch a binary that does not exist and fails with `ENOENT`
- Tester guidance: this is a product blocker, not a setup mistake
- Do not manually create `runtime.json` or copy binaries into place as part of normal UAT unless you are explicitly running an unsupported workaround experiment
- Primary blocker reference: `UAT-001` in [uraniborg-v1-uat-bug-inventory.md](./uraniborg-v1-uat-bug-inventory.md)

## Purpose

This UAT plan validates Uraniborg v1 as a usable local-first CLI product rather than only as a passing automated test suite.

It focuses on three areas:

1. User journey hygiene
2. Edge case exploration
3. Failure mode inventory

## Current Execution Status

UAT is currently split into unblocked checks and blocked checks.

Unblocked now:

- build validation
- help output
- `init` UX review
- `doctor` failure clarity
- empty-history behavior
- packaging sanity
- documentation quality
- other non-run flows

Blocked now:

- any UAT case that requires a healthy review-side runtime
- first successful run
- model discovery through the pinned runtime
- run preflight success from zero state
- interruption during a real run
- resume of a real run
- history based on real run artifacts

## If You Are New To This

This document is the high-level test plan.

If you want the practical step-by-step version, start with:

- [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)

Use this plan as the checklist that explains:

- what to test
- why it matters
- what counts as pass or fail

## Plain-English Definitions

- `UAT`
  - User Acceptance Testing
  - This means testing the product like a real user would, not only trusting automated tests.
- `environment`
  - the machine or shell setup you are testing in
  - example: fresh home directory, broken config state, interruptible terminal
- `runtime artifact state`
  - the state of Uraniborg-managed files under `~/.uraniborg/`
  - especially the pinned Feynman runtime under `~/.uraniborg/vendor/feynman`
- `pinned runtime`
  - the exact Feynman runtime Uraniborg is supposed to use
  - Uraniborg should use this instead of silently using some other global `feynman` on your system

## One Important Distinction

The four UAT environments are about the shape of the machine or home directory.

The pinned Feynman runtime under `~/.uraniborg/vendor/feynman` is not a separate environment type.
It is a runtime artifact whose state can vary inside those environments.

Use this mental model:

- environment = where you are testing
- runtime artifact state = what Uraniborg has already created or what is broken inside `~/.uraniborg/`

Examples:

- in `ENV-A`, the pinned runtime may be missing at the start
- in `ENV-B`, the pinned runtime should already exist and work
- in `ENV-C`, the pinned runtime may exist but be broken or mismatched
- in `ENV-D`, the pinned runtime should usually already work because you are testing interruption and resume

## UAT Objectives

- Confirm the first-run and repeat-run journeys are understandable, deterministic, and free of hidden setup assumptions.
- Confirm Uraniborg preserves its ownership boundaries:
  - pinned Feynman runtime for review-side work
  - Uraniborg-owned refine config
  - review does not receive memory
  - refinement does receive memory
- Confirm artifact hygiene:
  - durable local outputs
  - clear run manifests
  - resumable interrupted runs
  - history remains accurate
- Confirm failure paths are explicit, non-silent, and operationally recoverable.

## Entry Criteria

- Current repo state is built from the archived v1 spec set.
- `npm run typecheck` passes.
- `npm test` passes.
- Original live-run criterion: a healthy pinned runtime available in at least one execution environment for live run/resume UAT.
- A valid Uraniborg refine configuration can be supplied for at least one provider.

Important clarification:

- You do not need the pinned runtime to already exist in every environment before UAT starts.
- For bootstrap testing, one of the things you are validating is whether Uraniborg can prepare or repair that runtime state.
- For successful run/resume testing, you do need at least one environment where the pinned runtime is present and healthy.
- Current reality: this criterion is not satisfiable through the normal first-run product flow.
- Therefore, live run/resume UAT cannot proceed until either:
  - the product provisions the pinned runtime correctly, or
  - an explicitly approved temporary test strategy is defined

Current live-UAT note:

- the current implementation has now been shown to create the app-home directories but not to provision the pinned runtime from zero state
- it also does not currently reuse an already-installed healthy Feynman binary when the pinned runtime is absent
- treat this as an active product defect during UAT, not as an operator mistake

## Exit Criteria

- All P0 and P1 UAT cases pass.
- No silent fallback, destructive mutation, or artifact-loss bug remains open.
- All failed cases are triaged into:
  - product defect
  - expected limitation
  - environment/setup issue
- Failure-mode inventory is updated with observed behavior deltas from real runs.

## UAT Stop Conditions

- Stop immediately if `doctor` reports a missing pinned runtime manifest or executable and remediation fails with `ENOENT`.
- Do not continue trying `run` or `resume` cases after this point.
- Record the terminal output and mark the session as blocked at first-run bootstrap.
- Continue only with non-runtime-dependent checks.

## Test Environments

Use at least these four environments:

| Env ID | Shape | Purpose |
|---|---|---|
| `ENV-A` | Fresh machine or fresh home directory with no `~/.uraniborg/` | Validate bootstrap and first-run hygiene |
| `ENV-B` | Existing valid app home with completed prior runs | Validate reuse, history, and repeatability |
| `ENV-C` | Existing app home with broken runtime or config | Validate failure clarity and remediation |
| `ENV-D` | Interrupt-capable environment where runs can be stopped mid-phase | Validate cancellation and resume |

## Runtime Artifact State Matrix

This is separate from the environment list above.

| State ID | Meaning | Typical environment |
|---|---|---|
| `RT-1` | pinned runtime missing | `ENV-A` |
| `RT-2` | pinned runtime present and healthy | `ENV-B`, `ENV-D` |
| `RT-3` | pinned runtime present but broken, mismatched, or unreadable | `ENV-C` |

This is the easiest way to avoid confusion:

- `ENV-A` asks: can Uraniborg create and bootstrap what it needs?
- `ENV-B` asks: can Uraniborg reuse a healthy installation cleanly?
- `ENV-C` asks: can Uraniborg fail clearly and help the user recover?
- `ENV-D` asks: can Uraniborg stop and resume safely under interruption?

## Test Fixtures

Prepare these fixtures before execution:

- `fixture-idea-minimal.md`
  - short Markdown idea with no references
- `fixture-draft-medium.md`
  - 2-4 page Markdown draft with sections and claims that can be revised
- `fixture-non-markdown.txt`
  - invalid run input
- `fixture-bad-config.json`
  - malformed Uraniborg config
- `fixture-missing-env`
  - valid config pointing at an unset API key env var
- `fixture-runtime-conflict`
  - pinned runtime valid, conflicting global `feynman` on `PATH`

If this is your first package test pass, do not try to prepare every fixture up front.

Start with only:

- `fixture-idea-minimal.md`
- one real medium draft if you have it
- one non-Markdown invalid file

You can create the more advanced broken-state fixtures later.

## Evidence To Capture

For every UAT case, capture:

- terminal transcript or command log
- resulting files under `~/.uraniborg/`
- `run.json` when a run exists
- `review.log` and `refine.log` when relevant
- exact user-facing error or warning text
- pass/fail decision and defect reference if failed

If this is your first pass, a simple text file or note is enough.

Example:

```text
Case: UJ-01
Env: ENV-A / RT-1
Command: node dist/src/cli/main.js doctor
Result: pass
Notes: Created ~/.uraniborg. Reported missing refine config clearly.
Artifacts: none yet
```

## User Journey Hygiene

The priority here is not just functional success. The flow must be legible, non-confusing, and operationally clean.

### Hygiene Standards

- No command should rely on undocumented manual Feynman installation.
- Required failures must block clearly.
- Recommended-but-missing capabilities must warn clearly without pretending they are blockers.
- User-visible messages must explain what to do next.
- Existing runs and prior artifacts must never be deleted as part of normal setup or recovery.
- Resumes must be state-driven and must never silently skip unfinished work.

### User Journey Matrix

| ID | Priority | Journey | Action | Expected result |
|---|---|---|---|---|
| `UJ-01` | P0 | First-time bootstrap | Run `uraniborg doctor` in `ENV-A` | Should create `~/.uraniborg/` layout, provision pinned runtime, and report refine readiness clearly; currently expected to fail in implementation |
| `UJ-02` | P0 | Initial refine setup | Run `uraniborg init` with no existing config | Prompts only for Uraniborg-owned refine settings and writes a valid config |
| `UJ-03` | P0 | First successful run | Run `uraniborg run fixture-draft-medium.md` | Blocked by `UAT-001` until a healthy pinned runtime can be reached |
| `UJ-04` | P0 | Run preflight clarity | Start run with missing recommended capabilities only | Only partially testable because successful readiness cannot currently be reached from zero state |
| `UJ-05` | P0 | Required review failure clarity | Start run with pinned runtime mismatch or unavailable review model | Blocks before run execution and offers the relevant remediation path |
| `UJ-06` | P1 | Model visibility | Run `uraniborg models` | Only failure-path messaging is testable right now; real model discovery is blocked |
| `UJ-07` | P0 | Artifact inspection | After a successful 2-iteration run, inspect run directory | `original.md`, `current.md`, `final.md`, `information-highway.md`, per-iteration files, and `run.json` all exist and are coherent |
| `UJ-08` | P0 | Cancellation and resume | Interrupt a run during review, refine, and memory in separate executions | Blocked until a real run can start |
| `UJ-09` | P0 | History discoverability | Run `uraniborg history` with multiple prior runs | Only empty-history path is currently testable without workaround seeding |
| `UJ-10` | P1 | Repeat-run hygiene | Run a second successful draft through the same app home | Reuses app home cleanly without mutating or deleting prior runs |

Recommended beginner order:

1. `UJ-01`
2. `UJ-02`
3. `UJ-06`
4. `UJ-03`
5. `UJ-09`
6. `UJ-08`

That gets you to a useful first pass without needing the full matrix immediately.

### Explicit Hygiene Checks

Run these checks during every P0 journey:

- Confirm the review step only receives `iter-N/input.md` and not `information-highway.md`.
- Confirm the refine step receives current draft, latest review, and accumulated information highway.
- Confirm the run manifest phase/status matches what the terminal just reported.
- Confirm warnings are warnings, not disguised hard failures.
- Confirm errors identify the failing surface:
  - app home
  - pinned runtime
  - review model discovery
  - refine config
  - review execution
  - refine parsing
  - memory update

## Edge Case Exploration

This section is intentionally exploratory. The goal is to surface brittle assumptions before users do.

If you are new to UAT, do not start here.

First get one clean successful run working.
Then come back to the edge cases one group at a time.

## What Can Still Be Validated Now

- build, typecheck, and test pass/fail behavior
- CLI help and command discoverability
- `doctor` messaging for missing runtime and missing refine secret
- `init` copy, terminology, and setup expectations
- whether `init` falsely implies setup is complete
- `history` behavior when no runs exist
- packaging/bin-path correctness
- documentation quality and beginner usability

## What Is Blocked Now

- successful bootstrap of the review runtime
- review model discovery through the pinned runtime
- first complete run
- artifact tree creation from a real run
- interruption during review/refine
- resume of cancelled or failed real runs
- history summaries for real runs

### Input And Setup Edge Cases

| ID | Priority | Edge case | Expected behavior |
|---|---|---|---|
| `EC-01` | P0 | Missing input file | Reject before run creation with a clear read failure |
| `EC-02` | P0 | Non-Markdown input path | Reject before artifact creation |
| `EC-03` | P1 | Iteration count below range | Reject with range-specific validation message |
| `EC-04` | P1 | Iteration count above range | Reject with range-specific validation message |
| `EC-05` | P0 | Missing `config.json` | `doctor` reports refine config failure; `run` directs user to `uraniborg init` |
| `EC-06` | P0 | Invalid config JSON | Fails loudly with config parse/schema error |
| `EC-07` | P0 | Missing refine API key env var | Fails loudly before refinement begins |

### Runtime And Model Edge Cases

| ID | Priority | Edge case | Expected behavior |
|---|---|---|---|
| `EC-08` | P0 | Pinned runtime manifest missing | Report pinned-runtime failure, no `PATH` fallback |
| `EC-09` | P0 | Pinned executable not runnable | Report executable failure, offer setup remediation |
| `EC-10` | P0 | Global `feynman` conflicts with pinned version | Warn but continue using pinned runtime |
| `EC-11` | P0 | Review model discovery fails | `models` and `run` surface review-side failure without fabricating models |
| `EC-12` | P0 | Selected review model unavailable | Reject selection and require valid choice or remediation |
| `EC-13` | P1 | AlphaXiv missing | Warn as recommended-only, do not block |
| `EC-14` | P1 | Web search missing | Warn as recommended-only, do not block |

### Iteration And Artifact Edge Cases

| ID | Priority | Edge case | Expected behavior |
|---|---|---|---|
| `EC-15` | P0 | Review exits non-zero | Run moves to `failed`, review log preserved |
| `EC-16` | P0 | Review produces no usable artifact | Run fails closed, no refinement attempt |
| `EC-17` | P0 | Multiple candidate review artifacts | Run fails closed on ambiguity |
| `EC-18` | P0 | Empty normalized review artifact | Fail closed |
| `EC-19` | P0 | Refine response missing `REFINED_DRAFT` or `CHANGE_SUMMARY` | Fail closed, write `refine.log`, set `failed` |
| `EC-20` | P0 | Refine output contains empty parsed sections | Fail closed |
| `EC-21` | P0 | `changes.md` missing required information-highway headings | Fail memory update loudly instead of guessing |
| `EC-22` | P1 | Multi-iteration run with prior memory | Next refinement includes prior `Iteration N` blocks and does not regress accepted changes silently |

### Recovery And History Edge Cases

| ID | Priority | Edge case | Expected behavior |
|---|---|---|---|
| `EC-23` | P0 | Resume `finished` run | Reject resume explicitly |
| `EC-24` | P0 | Resume `failed`/`cancelled` run without `resumeFromStatus` | Reject resume explicitly |
| `EC-25` | P0 | Resume from `review_running` | Re-run review phase for that iteration |
| `EC-26` | P0 | Resume from `refine_running` | Re-run refine phase for that iteration |
| `EC-27` | P0 | Resume from `memory_update` with valid `changes.md` | Rebuild memory append without rerunning review or refine |
| `EC-28` | P0 | Resume from `memory_update` with missing required artifacts | Fail loudly, preserve current state |
| `EC-29` | P1 | Empty history | Return explicit "no runs" message |
| `EC-30` | P1 | History with mixed states | Order and summarize runs correctly |

## Failure Mode Inventory

This inventory is the operator-facing failure map. Every item should be observed in either automated tests, manual UAT, or both.

| Area | Trigger | Expected system behavior | Severity | Evidence required |
|---|---|---|---|---|
| App home bootstrap | Missing `~/.uraniborg/` | Create required directories without deleting prior runs | P0 | directory tree before/after |
| App home validation | Corrupt or unreadable required path | Fail with specific filesystem message | P0 | terminal output |
| Pinned runtime manifest | Missing or invalid manifest | Report pinned-runtime failure, no silent fallback | P0 | `doctor`/`run` output |
| Pinned runtime version | `--version` unreadable or mismatched | Block required readiness and offer remediation | P0 | version output, terminal output |
| Review model discovery | `feynman model list` fails | Surface failure and remediation guidance | P0 | `models` output |
| Recommended capability absence | AlphaXiv or web search missing | Warn only, allow continuation when required checks pass | P1 | `doctor` or preflight output |
| Review process failure | Review subprocess exits non-zero | Persist `failed`, preserve `review.log`, stop loop | P0 | manifest and log |
| Review artifact ambiguity | Multiple new review artifacts | Fail closed, do not guess | P0 | workspace outputs and manifest |
| Refinement HTTP failure | Network or API failure | Persist failure log, do not fabricate draft updates | P0 | `refine.log` |
| Refinement parse failure | Missing or malformed required sections | Persist failure, do not continue to memory update | P0 | response body and manifest |
| Memory update failure | Invalid `changes.md` headings | Persist failure, no guessed memory append | P0 | `changes.md`, manifest |
| Cancellation | SIGINT/SIGTERM during review/refine/memory | Persist `cancelled`, preserve partial artifacts/logs, print resume guidance | P0 | manifest plus phase log |
| Resume state mismatch | Terminal state not resumable | Reject explicitly with reason | P0 | terminal output |
| History inspection | No runs or corrupt run entries | Empty case must not crash; corrupt entries should be triaged if observed | P1 | command output |

For a beginner-friendly first pass, focus first on these failure modes:

1. missing refine config
2. missing or broken pinned runtime
3. non-Markdown input
4. failed review-model discovery
5. interruption and resume

## Manual UAT Execution Order

Run the plan in this order:

1. `UJ-01` to `UJ-05`
   - validates setup, preflight, and first-run quality
2. `UJ-06` to `UJ-10`
   - validates models, artifacts, repeatability, cancellation, and history
3. `EC-01` to `EC-14`
   - validates input, config, runtime, and readiness edges
4. `EC-15` to `EC-22`
   - validates execution and artifact integrity edges
5. `EC-23` to `EC-30`
   - validates recovery and history behavior
6. Failure-mode review
   - map observed results back into the inventory above

If this is your very first run through the product, use this simpler order instead:

1. Build and basic validation
2. `doctor`
3. `init`
4. `models`
5. one successful `run`
6. `history`
7. one interruption and one `resume`
8. one invalid-input case
9. one broken-runtime case

## Defect Triage Rules

- `P0`
  - silent fallback
  - artifact loss
  - wrong resume behavior
  - review/refine boundary violation
  - malformed success state
- `P1`
  - misleading warnings
  - incomplete remediation guidance
  - incorrect history summaries
  - non-blocking UX confusion
- `P2`
  - formatting or copy issues that do not affect correctness

## Recommended Sign-Off Questions

- Can a new user reach a successful first run without hidden prerequisites?
- Are required failures clearly distinguished from recommended warnings?
- Does every interrupted or failed run leave enough evidence for diagnosis and recovery?
- Are local artifacts trustworthy enough to debug the system without internal tooling?
- Does the end-to-end journey feel deterministic rather than agentic or surprising?

## Immediate Gaps To Watch During UAT

- Real pinned-runtime validation still needs live confirmation because current automated coverage uses test doubles rather than a real embedded Feynman install.
- Real provider-login and remediation launches need human verification for UX quality, not just command correctness.
- Large-draft behavior and long-running interruption timing should be exercised manually, because automated tests currently cover behavior shape rather than latency/stress characteristics.

## Product Feedback Outside The Locked Spec

- The locked spec required pinned-runtime provisioning and pinned-runtime use.
- Separate product feedback from UAT: Uraniborg should also consider reusing an existing healthy local Feynman installation when present.
- Example local installation raised during UAT:
  - `/Users/shahmahdihasan/.local/bin/feynman`
- This is not the current spec baseline, but it is strong user-journey feedback and should be tracked as a follow-up product decision.

## Best Next Step

If you have never tested a Node package before, do this:

1. open [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)
2. follow it exactly through the first successful run
3. only after that, come back to this plan and mark off additional cases
