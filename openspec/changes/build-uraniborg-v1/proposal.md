## Why

Uraniborg needs a clear v1 contract for its core value: a local-first CLI that improves a Markdown research draft through repeated independent review and memory-aware refinement. The product spec is already detailed enough to justify implementation now, but the repo still needs proposal, spec, design, and task artifacts that turn that vision into an executable build plan.

## What Changes

- Add a self-sufficient Uraniborg CLI with local app-home bootstrapping, configuration loading, and environment health checks.
- Add guided run creation for Markdown inputs, iteration count, review model selection, and refine model selection.
- Add the deterministic review -> refine -> memory-update loop with durable per-run and per-iteration artifacts.
- Add strict review/refine separation so review remains blind to memory while refinement consumes structured memory from prior iterations.
- Add run manifests, validation rules, and append-only artifact storage to support reproducibility and recovery.
- Add resume, history, and model-listing commands needed to inspect, continue, and operate Uraniborg runs.

## Capabilities

### New Capabilities
- `environment-setup`: Initialize `~/.uraniborg`, validate Uraniborg-owned configuration, verify embedded Feynman availability, and expose setup and health-check commands.
- `model-selection`: Let users inspect available review and refine models and choose them when creating a run.
- `iterative-draft-run`: Execute the deterministic multi-iteration review/refine loop, persist all run artifacts, and enforce the review/refine memory boundary.
- `run-recovery-and-history`: Resume interrupted runs from explicit manifest state and list prior runs with status and timestamps.

### Modified Capabilities
- None.

## Impact

- Adds a new TypeScript CLI surface under Uraniborg source modules for config, run state, review integration, refinement, memory, and terminal UX.
- Introduces durable filesystem structures under `~/.uraniborg/` for config, embedded runtime assets, manifests, logs, and run artifacts.
- Depends on an embedded Feynman runtime for review operations and an OpenAI-compatible HTTP endpoint for refinement.
- Defines user-facing command behavior for `run`, `resume`, `history`, `models`, `doctor`, and `init`.
