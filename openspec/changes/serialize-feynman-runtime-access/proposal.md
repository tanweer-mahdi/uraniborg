## Why

UAT and RCA showed that Uraniborg can corrupt an externally installed Feynman runtime by launching multiple Feynman subprocesses in parallel while Feynman is still performing startup-time self-patching. That creates torn install files, inconsistent `doctor`/`models` outcomes, and a hard blocker on the review side even when the underlying Feynman installation was healthy before Uraniborg touched it.

The next change needs to make Uraniborg safe around a self-mutating external runtime. Uraniborg must serialize all Feynman access, collect runtime facts through a shared snapshot path, and present curated status output instead of raw subprocess fragments that blur command scope and readiness truth.

## What Changes

- Add a Uraniborg-owned serialized Feynman runtime snapshot path in `src/review/` and route `doctor`, `models`, `run`, and `resume` through it.
- Remove parallel Feynman probing in runtime discovery and command readiness collection.
- Make `doctor` and `models` consume the same runtime facts for shared readiness information so they cannot drift on the same invocation path.
- Tighten default CLI output so `doctor` and `models` present curated status rather than raw `Exit code`, `stdout`, and `stderr` fragments.
- Narrow `models` back to model-focused reporting while leaving optional research-capability checks to broader readiness flows.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `environment-setup`: serialize Feynman runtime discovery and readiness probing so Uraniborg does not overlap startup-time Feynman mutations.
- `model-selection`: make `models` consume the same serialized readiness source of truth while remaining model-focused in its default output.
- `iterative-draft-run`: make run and resume preflight reuse the serialized Feynman runtime access path before review execution begins.

## Impact

- Affects review/runtime probing in `doctor`, `models`, `run`, and `resume`.
- Adds a shared review-side runtime snapshot abstraction under `src/review/`.
- Requires regression tests for serialized Feynman access and command-output consistency.
- Requires updated UAT notes and session handoff context for the corruption RCA.
