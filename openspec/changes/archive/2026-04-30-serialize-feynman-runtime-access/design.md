## Context

Uraniborg now depends on a discovered compatible `feynman` executable rather than a Uraniborg-owned vendored runtime. That ownership boundary is correct, but it means Uraniborg is calling into an external tool whose startup behavior Uraniborg does not control.

Recent UAT and RCA showed that the installed Feynman runtime performs startup-time self-patching and workspace repair before normal command dispatch. Uraniborg currently fans out multiple Feynman subprocesses in parallel in `doctor`, `models`, and runtime discovery. That makes a self-patching Feynman install unsafe to probe concurrently and can leave the runtime corrupted.

This change therefore needs to tighten three connected surfaces together:

- how Uraniborg launches and serializes Feynman subprocesses
- how Uraniborg collects shared review-runtime facts for CLI reporting
- how default command output communicates those facts without leaking raw subprocess fragments

## Goals / Non-Goals

**Goals:**

- Ensure Uraniborg never launches overlapping Feynman subprocesses during runtime discovery or readiness collection.
- Provide a shared Uraniborg-side runtime snapshot abstraction that `doctor`, `models`, `run`, and `resume` can consume.
- Keep readiness classification pure while moving process orchestration into a dedicated review-side runtime collector.
- Make `doctor` and `models` consistent for shared facts while keeping `models` model-focused.
- Remove raw subprocess fragments from default `doctor` and `models` output.

**Non-Goals:**

- Modifying Feynman itself or taking ownership of Feynman patching behavior.
- Adding a new dedicated command for AlphaXiv/web-search status in this change.
- Persisting a cross-session runtime cache on disk unless implementation proves it is necessary.
- Reworking run execution semantics beyond preflight/runtime access safety.

## Decisions

### 1. Serialize all Uraniborg-initiated Feynman access

Uraniborg will serialize all Feynman subprocess launches inside the current process. Runtime discovery and readiness collection will not use `Promise.all(...)` for Feynman commands.

Rationale:

- directly removes the proven corruption trigger
- requires no cooperation from Feynman itself
- preserves the existing ownership boundary

Alternatives considered:

- rely only on a shared snapshot but keep parallel subprocesses under the hood: rejected because the underlying corruption risk remains
- add only a command-level “don’t call two commands at once” convention: rejected because the observed corruption happened within a single Uraniborg command path

### 2. Introduce a shared Feynman runtime snapshot collector in `src/review/`

Uraniborg will add a runtime collector that:

1. resolves the current compatible Feynman runtime
2. optionally collects review-model, AlphaXiv, and web-search status in a serialized order
3. returns a single snapshot object plus the derived readiness report

`doctor`, `models`, `run`, and `resume` will reuse this collector instead of each open-coding their own readiness collection path.

Rationale:

- keeps process orchestration in one place
- avoids command drift for shared readiness facts
- makes it easier to add targeted regression coverage for serialized access

Alternatives considered:

- put snapshot logic directly in each CLI command: rejected because it duplicates the exact bug-prone path we are trying to control

### 3. Keep readiness classification pure

`classifyFeynmanReadiness(...)` will remain a pure transformation over already-collected runtime/process results. The new collector will orchestrate subprocess execution; the classifier will continue to interpret the resulting data.

Rationale:

- keeps logic testable and deterministic
- preserves the current trust boundary between orchestration and interpretation

### 4. Make `models` model-focused in its default output

`models` will still rely on the shared snapshot path, but its default rendered output will focus on:

- selected/compatible review runtime
- review model availability
- configured refinement endpoint/model readiness

It will not print AlphaXiv/web-search status in the default model-reporting surface.

Rationale:

- aligns the command contract with user expectation
- removes the command-scope confusion observed in UAT

### 5. Remove raw subprocess fragments from default CLI output

Default `doctor` and `models` output will no longer include raw `Exit code`, `stdout`, or `stderr` fragments. Default reporting will be curated and operator-facing.

Rationale:

- directly addresses UAT feedback
- avoids presenting implementation-shaped details as product output
- reduces the chance that incidental subprocess noise is mistaken for the primary status

## Risks / Trade-offs

- `[Slightly slower status collection]` -> accept sequential probing because protecting the external runtime is more important than shaving a small amount of latency off readiness commands.
- `[Less low-level detail in default output]` -> prefer curated output now; deeper diagnostics can be reintroduced later behind an explicit debug or verbose surface.
- `[Snapshot abstraction adds indirection]` -> keep it narrow and review-scoped so command code becomes simpler rather than more complex.

## Migration Plan

1. Add the shared serialized runtime collector in `src/review/`.
2. Replace parallel Feynman probing in runtime discovery, `doctor`, and `models`.
3. Rewire `run` and `resume` preflight to consume the collector.
4. Update command rendering to use curated output.
5. Add regression coverage for serialized probing and command consistency.

Rollback strategy:

- If this change must be rolled back, Uraniborg can return to the previous discovered-runtime behavior, but that would knowingly preserve a runtime-corruption risk against self-patching Feynman installations.
