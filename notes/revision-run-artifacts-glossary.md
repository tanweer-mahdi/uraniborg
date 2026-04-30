# Revision Run Artifacts Glossary

This document explains the filesystem artifacts Uraniborg creates for each iterative revision run under `~/.uraniborg/runs/<run-id>/`.

It is based on the current implementation in:

- [src/loop/run-execution.ts](/Users/shahmahdihasan/uraniborg/src/loop/run-execution.ts)
- [src/run/artifact-store.ts](/Users/shahmahdihasan/uraniborg/src/run/artifact-store.ts)
- [src/run/manifest.ts](/Users/shahmahdihasan/uraniborg/src/run/manifest.ts)
- [src/review/feynman-review.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-review.ts)
- [src/memory/information-highway.ts](/Users/shahmahdihasan/uraniborg/src/memory/information-highway.ts)

## Scope

Each run gets a dedicated directory:

```text
~/.uraniborg/runs/<run-id>/
```

Example:

```text
/Users/shahmahdihasan/.uraniborg/runs/2026-04-30T04-59-32Z-associative-memory-for-reasoning-trace-synthesis/
```

Uraniborg owns the run directory and its normalized artifacts. The nested `feynman-review/` subtree is a review workspace used by Feynman during the review phase.

## Lifecycle Summary

At a high level, a run proceeds like this:

1. Uraniborg creates the run directory and top-level control artifacts.
2. For each iteration, Uraniborg creates `iter-N/`.
3. Uraniborg copies the current draft into the iteration review input.
4. Feynman runs review in an isolated `feynman-review/` workspace.
5. Uraniborg normalizes the produced review into `iter-N/review.md`.
6. Uraniborg sends `current.md + review.md + information-highway.md` to the revision model.
7. Uraniborg writes `iter-N/refined.md` and `iter-N/changes.md`.
8. Uraniborg appends the change summary to `information-highway.md`.
9. Uraniborg promotes the refined draft into `current.md`.
10. On the final iteration, Uraniborg writes `final.md`.

## Top-Level Run Artifacts

### `run.json`

Purpose:
- Primary run manifest and resume control file.

Created by:
- Uraniborg at run initialization.

Updated by:
- Uraniborg throughout the run as phase/state changes happen.

Contains:
- `runId`, title, slug
- source input path
- selected review/refine models
- iteration counts
- current status and phase
- artifact path references
- last error metadata when a run fails or is cancelled

Typical uses:
- `history`
- `resume`
- run-status inspection

### `config.snapshot.json`

Purpose:
- Frozen snapshot of the effective run configuration at start time.

Created by:
- Uraniborg at run initialization.

Contains:
- input metadata
- planned iteration count
- selected models
- resolved refinement defaults
- revision runtime metadata such as profile id, auth class, acquisition mode, base URL, timeout, and provider context

Why it exists:
- preserves the effective runtime context used for the run
- helps debug later environment or config changes

### `original.md`

Purpose:
- Immutable copy of the source draft as it existed when the run started.

Created by:
- Uraniborg at run initialization.

Updated by:
- never

Why it exists:
- gives a stable baseline for comparison against later iterations

### `current.md`

Purpose:
- The latest working draft that the next iteration will review.

Created by:
- Uraniborg at run initialization as a copy of `original.md`.

Updated by:
- Uraniborg after every successful memory-update phase.

Why it exists:
- this is the draft state that advances across iterations

### `final.md`

Purpose:
- Final promoted draft after the last successful iteration.

Created by:
- Uraniborg only on the final successful iteration.

Updated by:
- only once at terminal completion of the run

Why it exists:
- gives a stable final output without requiring consumers to infer it from `current.md`

Important:
- this file may be absent if the run fails or is cancelled before completion

### `information-highway.md`

Purpose:
- Persistent cross-iteration memory ledger.

Created by:
- Uraniborg at run initialization, initially empty.

Updated by:
- Uraniborg after each successful refine step during the memory-update phase.

Contents:
- one block per iteration
- each block is derived from the structured sections inside `iter-N/changes.md`

Required iteration sections:
- `Accepted reviewer points`
- `Rejected reviewer points`
- `Changes made`
- `Open issues`
- `Regression guards`

Why it exists:
- carries forward what changed and why
- gives the next refinement step condensed iteration history

## Per-Iteration Artifacts

Each iteration gets its own directory:

```text
iter-1/
iter-2/
...
iter-N/
```

### `iter-N/input.md`

Purpose:
- Snapshot of the draft that was sent into the review phase for this iteration.

Created by:
- Uraniborg at the start of the review phase.

Source:
- copied from top-level `current.md`

Why it exists:
- preserves the exact review input for that iteration even after later iterations mutate `current.md`

### `iter-N/review.md`

Purpose:
- Uraniborg-normalized review artifact for the iteration.

Created by:
- Uraniborg after Feynman finishes review successfully.

Source:
- normalized from the one newly produced Feynman `outputs/*-review.md` artifact

Why it exists:
- gives the refine phase a stable and predictable review input path
- separates Uraniborg’s normalized contract from Feynman’s internal workspace layout

### `iter-N/refined.md`

Purpose:
- Refined draft produced by the revision model for that iteration.

Created by:
- Uraniborg after a successful refine phase.

Source:
- extracted from the `=== REFINED_DRAFT ===` section of the revision model response

Why it exists:
- preserves the per-iteration revised draft before it is promoted into `current.md`

### `iter-N/changes.md`

Purpose:
- Structured change summary produced by the revision model for that iteration.

Created by:
- Uraniborg after a successful refine phase.

Source:
- extracted from the `=== CHANGE_SUMMARY ===` section of the revision model response

Why it exists:
- drives the update to `information-highway.md`
- preserves the model’s structured reasoning about accepted/rejected feedback and open issues

### `iter-N/review.log`

Purpose:
- Execution log for the Feynman review phase.

Created by:
- Uraniborg after the review subprocess returns
- or by Uraniborg on cancellation during review

Typically contains:
- executed review command contract
- stdout/stderr from the Feynman process
- failure details if review failed

Why it exists:
- first diagnostic file for review failures

### `iter-N/refine.log`

Purpose:
- Execution log for the refine phase.

Created by:
- Uraniborg after refine success
- or after refine failure
- or on cancellation during refinement

Typically contains:
- provider
- model
- response id
- stop reason
- request log
- response log
- surfaced refinement error details on failure

Why it exists:
- first diagnostic file for refine failures

### `iter-N/refine.response.txt`

Purpose:
- Raw malformed refinement response text.

Created by:
- Uraniborg only when the revision model returns non-empty text that fails the strict output contract

Not created when:
- the refine step succeeds
- the provider/runtime fails before usable text is produced

Why it exists:
- preserves the exact bad model output for debugging malformed responses

Important:
- this is a conditional artifact, not a guaranteed file in every iteration

## Feynman Review Workspace Artifacts

Each iteration also contains a Feynman review workspace:

```text
iter-N/feynman-review/
```

This subtree is used during the review phase and is not the same as Uraniborg’s normalized artifact contract.

### `iter-N/feynman-review/input.md`

Purpose:
- copy of `iter-N/input.md` placed into Feynman’s isolated workspace

Created by:
- Uraniborg before invoking Feynman

Why it exists:
- lets Feynman operate in an isolated workspace rather than directly against Uraniborg’s canonical artifacts

### `iter-N/feynman-review/session/`

Purpose:
- Feynman session state and transcripts

Created by:
- Feynman during review execution

Typical contents:
- one or more session `.jsonl` files

Why it exists:
- preserves Feynman conversation/runtime trace for the review run

### `iter-N/feynman-review/outputs/`

Purpose:
- Feynman-generated review outputs

Created by:
- Feynman during review execution

Important:
- Uraniborg expects exactly one newly created `*-review.md` file in this directory for successful normalization into `iter-N/review.md`

Common contents in current runs:
- `input-review.md`
- `.plans/`
- `.drafts/`

Interpretation:
- `outputs/input-review.md` is the review artifact Uraniborg typically normalizes into `iter-N/review.md`
- `.plans/` and `.drafts/` are Feynman-owned supporting artifacts, not Uraniborg contract files

Why this matters:
- if Feynman changes its own workspace internals, Uraniborg should still rely on normalized `iter-N/review.md`, not on these internal paths

## Which Files Are Contractual vs Diagnostic

These are the most important contractual artifacts for Uraniborg itself:

- `run.json`
- `config.snapshot.json`
- `original.md`
- `current.md`
- `final.md` on successful completion
- `information-highway.md`
- `iter-N/input.md`
- `iter-N/review.md`
- `iter-N/refined.md`
- `iter-N/changes.md`

These are primarily diagnostic:

- `iter-N/review.log`
- `iter-N/refine.log`
- `iter-N/refine.response.txt` when present
- everything under `iter-N/feynman-review/`

## Resume Semantics

If a run fails or is cancelled, Uraniborg uses:

- `run.json`
- the current phase/status fields inside it
- the already written iteration artifacts

to determine where resume should continue.

In practice:

- `iter-N/input.md`, `review.md`, `refined.md`, and `changes.md` can be resume-relevant
- `information-highway.md` and `current.md` represent the last committed cross-iteration state

## Example Successful Run Layout

From a successful two-iteration run:

```text
<run-id>/
  config.snapshot.json
  current.md
  final.md
  information-highway.md
  original.md
  run.json
  iter-1/
    changes.md
    input.md
    refine.log
    refined.md
    review.log
    review.md
    feynman-review/
      input.md
      outputs/
      session/
  iter-2/
    changes.md
    input.md
    refine.log
    refined.md
    review.log
    review.md
    feynman-review/
      input.md
      outputs/
      session/
```

`refine.response.txt` is absent in that successful run because no malformed refinement response occurred.
