## 1. Project Foundations

- [ ] 1.1 Create the initial TypeScript module layout for `src/cli`, `src/config`, `src/run`, `src/review`, `src/refine`, `src/memory`, `src/loop`, `src/ui`, and `src/types`
- [ ] 1.2 Add or update package dependencies and scripts for the Uraniborg CLI runtime, including prompt, validation, and test tooling
- [ ] 1.3 Implement shared path and app-home utilities for resolving `~/.uraniborg/`, vendor storage, and run storage paths

## 2. Environment Setup and Configuration

- [ ] 2.1 Define the Uraniborg configuration schema and config loader for refine endpoint settings, model defaults, and env-var-backed secrets
- [ ] 2.2 Implement bootstrap logic that prepares and validates the `~/.uraniborg/` directory layout and the pinned `~/.uraniborg/vendor/feynman` runtime without deleting prior runs
- [ ] 2.3 Implement pinned-runtime version checks, exact-path invocation, and warnings for conflicting global `feynman` installations on `PATH`
- [ ] 2.4 Implement `uraniborg doctor` checks for filesystem readiness, pinned Feynman availability, review-side readiness, AlphaXiv status, web-search status, and refine configuration validity while surfacing richer Feynman diagnostics for humans
- [ ] 2.5 Implement optional-capability guidance for AlphaXiv and search configuration without turning them into blocking prerequisites
- [ ] 2.6 Implement `uraniborg init` prompts and config persistence for Uraniborg-owned refinement defaults

## 3. Run State and Artifact Storage

- [ ] 3.1 Implement run id and slug generation plus creation of timestamped run directories
- [ ] 3.2 Implement the `run.json` manifest model, status transitions, and safe read/write helpers
- [ ] 3.3 Implement artifact-store helpers for `original.md`, `current.md`, `final.md`, `information-highway.md`, iteration directories, and per-step logs
- [ ] 3.4 Implement config snapshot creation so each run persists resolved defaults, selected models, and iteration count

## 4. Review and Refinement Engines

- [ ] 4.1 Implement the embedded Feynman bootstrap and adapter layer for `--version`, `model list`, `setup`, `model login`, and `review` commands against the pinned runtime
- [ ] 4.2 Implement `uraniborg models` output for review-model discovery, remediation guidance when review access is missing, and configured refine-model visibility
- [ ] 4.3 Implement the review workspace helper that creates a fresh iteration-local Feynman workdir, deterministic input filename, isolated session directory, and `--cwd` / `--new-session` invocation contract
- [ ] 4.4 Implement refine prompt assembly using `CURRENT_DRAFT`, `PEER_REVIEW`, and `INFORMATION_HIGHWAY`
- [ ] 4.5 Implement the OpenAI-compatible refinement client, response parser, and validation for `=== REFINED_DRAFT ===` and `=== CHANGE_SUMMARY ===`

## 5. Deterministic Run Execution

- [ ] 5.1 Implement `uraniborg run <file>` input validation, prompt flow, model selection, and run initialization
- [ ] 5.2 Implement the review step to execute review against the current draft only inside the iteration-local Feynman workspace and normalize the resulting external review output into Uraniborg-owned `review.md` plus `review.log`
- [ ] 5.3 Implement candidate review-artifact discovery inside the isolated workspace by diffing or otherwise attributing new `outputs/*-review.md` files to the current invocation and failing on ambiguity
- [ ] 5.4 Implement run preflight that blocks on missing required review readiness and warns on missing recommended AlphaXiv/search capabilities while allowing the user to continue
- [ ] 5.5 Implement the refine step to persist `refined.md`, `changes.md`, and `refine.log`, and to fail cleanly on malformed model output
- [ ] 5.6 Implement information-highway initialization and append-only memory updates from validated `changes.md`
- [ ] 5.7 Implement the multi-iteration loop that promotes `refined.md` to `current.md`, tracks iteration progress, and writes `final.md` on completion

## 6. Recovery, History, and Hardening

- [ ] 6.1 Implement `uraniborg resume <run-id>` using state-driven restart rules for `review_running`, `refine_running`, and `memory_update`
- [ ] 6.2 Implement `uraniborg history` listing for prior local runs with run id, timestamp, and status
- [ ] 6.3 Add unit tests for config loading, path generation, manifest transitions, prompt assembly, refine parsing, and information-highway formatting
- [ ] 6.4 Add integration or smoke coverage for pinned Feynman version checks, review-model discovery/remediation, AlphaXiv/search status warnings, isolated review workspace creation, review artifact normalization, multi-iteration memory carry-forward, and resume behavior
