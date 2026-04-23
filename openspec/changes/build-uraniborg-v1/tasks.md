## 1. Project Foundations

- [x] 1.1 Create the initial TypeScript module layout for `src/cli`, `src/config`, `src/run`, `src/review`, `src/refine`, `src/memory`, `src/loop`, `src/ui`, and `src/types`
- [x] 1.2 Add or update package dependencies and scripts for the Uraniborg CLI runtime, including prompt, validation, and test tooling
- [x] 1.3 Implement shared path and app-home utilities for resolving `~/.uraniborg/`, vendor storage, and run storage paths

## 2. Environment Setup and Embedded Runtime Primitives

- [x] 2.1 Define the Uraniborg configuration schema and config loader for refine endpoint settings, model defaults, and env-var-backed secrets
- [x] 2.2 Implement bootstrap logic that prepares and validates the `~/.uraniborg/` directory layout and the pinned `~/.uraniborg/vendor/feynman` runtime without deleting prior runs
- [x] 2.3 Implement pinned-runtime version checks, exact-path invocation, and warnings for conflicting global `feynman` installations on `PATH`
- [x] 2.4 Implement pinned Feynman adapter status primitives for `--version`, `model list`, `alpha status`, and `search status`
- [x] 2.5 Implement pinned Feynman remediation and diagnostics primitives for `setup`, `model login <provider>`, `alpha login`, and `doctor` without mutating Feynman-owned state
- [x] 2.6 Implement `uraniborg init` prompts and config persistence for Uraniborg-owned refinement defaults

## 3. Run State and Artifact Storage

- [x] 3.1 Implement run id and slug generation plus creation of timestamped run directories
- [x] 3.2 Define the `run.json` manifest shape for selected models, iteration counters, phase metadata, and allowed statuses
- [x] 3.3 Implement safe manifest read/write and transition helpers that enforce state ownership for `initialized`, `review_running`, `review_complete`, `refine_running`, `refine_complete`, `memory_update`, `iteration_complete`, `finished`, `failed`, and `cancelled`
- [x] 3.4 Implement artifact-store helpers for `original.md`, `current.md`, `final.md`, `information-highway.md`, `iter-N/input.md`, `iter-N/review.md`, `iter-N/refined.md`, `iter-N/changes.md`, and per-step logs
- [x] 3.5 Implement run snapshot creation so each run persists resolved defaults, selected models, input metadata, and iteration count

## 4. Review and Refinement Engine Primitives

- [x] 4.1 Implement the review workspace helper that creates a fresh iteration-local Feynman workdir, deterministic input filename, isolated session directory, and exact `--cwd` / `--session-dir` / `--new-session` invocation contract
- [x] 4.2 Implement Uraniborg-owned iteration input creation by writing `iter-N/input.md` from `current.md` before copying it into the iteration-local Feynman workspace
- [x] 4.3 Implement the review execution primitive so the selected review model runs against only the iteration-local input while capturing process output into `review.log`
- [x] 4.4 Implement candidate review-artifact discovery inside the isolated workspace by attributing newly produced `outputs/*-review.md` files to the current invocation before any normalization step
- [x] 4.5 Make review execution failure-closed on non-zero Feynman exit, missing or unusable review artifact, or ambiguous artifact attribution, and persist the failure state in the manifest
- [x] 4.6 Implement review artifact normalization so the uniquely attributable external review is copied into Uraniborg-owned `iter-N/review.md`
- [x] 4.7 Implement refine prompt assembly using `CURRENT_DRAFT`, `PEER_REVIEW`, and `INFORMATION_HIGHWAY`
- [x] 4.8 Implement the OpenAI-compatible refinement client, response parser, and validation for `=== REFINED_DRAFT ===` and `=== CHANGE_SUMMARY ===`

## 5. Readiness and Model Command Surfaces

- [x] 5.1 Implement reusable readiness classification that separates required pinned-runtime and review-model checks from recommended AlphaXiv and web-search capability checks
- [x] 5.2 Implement shared remediation prompting and launch flows so `doctor`, `models`, and run preflight can invoke Feynman-owned setup and login commands when appropriate
- [x] 5.3 Implement `uraniborg doctor` checks for filesystem readiness, pinned Feynman availability, review-model readiness, AlphaXiv status, web-search status, and refine configuration validity while surfacing richer Feynman diagnostics for humans
- [x] 5.4 Implement `uraniborg models` output for review-model discovery, remediation guidance when review access is missing, and configured refine-model visibility

## 6. Deterministic Run Execution

- [ ] 6.1 Implement `uraniborg run <file>` input validation and input collection for source draft path, iteration count, and non-interactive defaults before model selection
- [ ] 6.2 Implement review/refine model selection and validation so unavailable review models are rejected before run creation and the user is prompted to choose another model or launch the relevant Feynman remediation flow before valid selections are prepared for persistence
- [ ] 6.3 Implement run preflight that evaluates required versus recommended readiness, offers remediation, blocks on required failures, and only permits continuation when required checks pass
- [ ] 6.4 Implement run bootstrap that creates the run directory, initializes `run.json`, writes `original.md` and `current.md`, creates the initial `information-highway.md`, and persists `config.snapshot.json`
- [ ] 6.5 Implement the per-iteration review phase using the isolated workspace and failure-closed artifact discovery and normalization flow, including manifest transitions for `review_running`, `review_complete`, and `failed` when the review phase aborts
- [ ] 6.6 Implement the refine phase to persist `refined.md`, `changes.md`, and `refine.log`, and to fail cleanly on malformed or empty model output while recording `refine_running`, `refine_complete`, and `failed` manifest states
- [ ] 6.7 Implement append-only information-highway updates from validated `changes.md`, keeping initialization at run bootstrap and later writes limited to one structured iteration block per completed refinement while recording `memory_update`
- [ ] 6.8 Implement the multi-iteration loop that promotes `refined.md` to `current.md`, records `iteration_complete` progress in the manifest, and writes `final.md` plus `finished` state after the last successful iteration

## 7. Recovery, History, and Hardening

- [ ] 7.1 Implement cancellation handling so interrupts during review, refine, or memory update persist `cancelled` state, preserve artifacts and logs, and never silently continue on resume
- [ ] 7.2 Implement `uraniborg resume <run-id>` restart or rejection rules for `initialized`, `review_running`, `review_complete`, `refine_running`, `refine_complete`, `memory_update`, `iteration_complete`, `failed`, `cancelled`, and `finished`
- [ ] 7.3 Implement resume-time repair for partial artifacts and manifest transitions, including rebuilding the pending memory append from `changes.md` and re-entering the correct next phase without skipping validation
- [ ] 7.4 Implement `uraniborg history` listing and run summaries for prior runs in any current state, including `initialized`, in-progress phase states, `finished`, `failed`, and `cancelled`, plus the explicit no-runs-available path
- [ ] 7.5 Add unit tests for config loading, adapter status parsing, manifest transitions and ownership, cancellation state changes, terminal-state resume behavior, prompt assembly, refine parsing, and information-highway formatting
- [ ] 7.6 Add integration or smoke coverage for pinned runtime/version checks, doctor/models/remediation flows, required-versus-recommended preflight, Uraniborg-owned iteration input creation, isolated review artifact discovery and normalization, failure-closed review handling, multi-iteration memory carry-forward, resume repair paths for `failed`/`cancelled`/`finished`, empty-history output, and history summaries
