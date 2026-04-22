## Context

Uraniborg v1 is a new local-first TypeScript CLI that orchestrates an asymmetric research-improvement loop: Feynman performs independent review, while Uraniborg performs memory-aware refinement. The source product spec defines the user journey, run artifacts, command surface, and strong constraints around determinism, artifact durability, and review/refine separation.

The design needs to support several cross-cutting concerns at once:

- bootstrap a self-sufficient app home under `~/.uraniborg/`
- integrate an embedded Feynman runtime without owning Feynman's internals
- manage a separate Uraniborg-owned refinement configuration and prompt contract
- persist append-only run artifacts plus a machine-readable run manifest
- resume reliably from explicit phase/state transitions rather than implicit file inspection

This makes `design.md` necessary before implementation because the change spans CLI UX, subprocess integration, networked refinement calls, filesystem durability, and recovery logic.

## Goals / Non-Goals

**Goals:**

- Provide a one-product install and runtime experience where Uraniborg prepares its own app home and checks embedded review readiness.
- Implement a deterministic `run` path that creates a durable artifact tree and executes `review -> refine -> memory update` for `1..N` iterations.
- Preserve a strict information boundary where review only sees the current draft while refinement sees the current draft, latest review, and information highway.
- Persist enough structured state to support `resume`, `history`, `models`, `doctor`, and `init`.
- Keep the v1 implementation simple, inspectable, and testable with TypeScript modules that map cleanly to the product spec.

**Non-Goals:**

- Building a full-screen TUI, web UI, database, plugin system, or generalized multi-agent platform.
- Re-implementing Feynman authentication, provider management, or review prompt internals inside Uraniborg.
- Supporting refinement OAuth flows, multiple provider families, or speculative v2 features such as plateau detection and manual approval checkpoints.
- Hiding artifacts behind abstractions that prevent users from inspecting run files directly.

## Decisions

### 1. Use a filesystem-first control plane rooted at `~/.uraniborg/`

Uraniborg will store configuration, vendor assets, and all run artifacts under a single app home. Each run will get its own timestamped directory containing `run.json`, `config.snapshot.json`, `original.md`, `current.md`, `information-highway.md`, and per-iteration subdirectories.

Rationale:

- matches the product requirement for local transparency and durable outputs
- keeps recovery and history simple because the artifact tree is the system of record
- avoids introducing a database or hidden runtime state

Alternatives considered:

- storing run metadata in SQLite: rejected because it adds infrastructure and weakens file transparency
- keeping mutable state only in memory and reconstructing later: rejected because it makes resume brittle

### 2. Treat `run.json` as the explicit state machine boundary

Run execution will update manifest state before and after each major phase using the allowed statuses from the product spec (`initialized`, `review_running`, `review_complete`, `refine_running`, `refine_complete`, `memory_update`, `iteration_complete`, `finished`, `failed`, `cancelled`). Resume logic will key off these states rather than inferring progress from files alone.

Rationale:

- produces deterministic restart behavior
- reduces ambiguity when runs are interrupted between writes
- gives `history` and future tooling a single machine-readable source of truth

Alternatives considered:

- infer state by probing iteration directories: rejected because partial writes and repair cases become ambiguous

### 3. Keep Feynman integration behind a thin adapter and black-box contract

The review side will live behind review modules responsible for provisioning a pinned standalone Feynman runtime under `~/.uraniborg/vendor/feynman`, invoking that exact binary path, listing available review models, launching Feynman-owned setup/login flows when needed, invoking `feynman review <file>`, capturing logs, and normalizing the resulting review artifact into Uraniborg's iteration directory. Uraniborg will not mutate Feynman-owned configuration internals.

The adapter contract for v1 is:

- use `feynman --version` against the pinned binary to verify presence and exact version match
- warn if another `feynman` is present on `PATH` with a conflicting version, but continue using the pinned runtime
- use `feynman model list` for machine-readable review-model discovery and readiness checks
- use `feynman alpha status` and `feynman search status` to surface optional-but-recommended research capability status
- use `feynman setup` and `feynman model login <provider>` for remediation when review auth or provider access is missing
- use `feynman alpha login` for optional AlphaXiv remediation when the user wants to improve research/review coverage
- use `feynman doctor` as a user-facing diagnostic surface, not as the primary machine-parsed readiness signal
- run each review in a fresh iteration-local Feynman workspace such as `iter-N/feynman-review/`
- copy the review input into that workspace with a deterministic filename such as `input.md`
- invoke `feynman review input.md --cwd <iteration-workspace> --session-dir <iteration-workspace>/session --new-session`
- treat Feynman's native review outputs as external and copy the final review artifact immediately into Uraniborg-owned iteration paths

Uraniborg should classify Feynman readiness into two tiers:

- **Required**: pinned runtime availability and exact version match, plus review-model readiness for the selected model
- **Recommended**: AlphaXiv auth and web-search provider configuration

Missing required readiness blocks review execution. Missing recommended readiness does not block execution, but Uraniborg should warn during `doctor` and `run` preflight, explain the tradeoff, and offer to launch the relevant Feynman-owned remediation flow.

Rationale:

- preserves the hard ownership boundary from the product spec
- isolates any embedded runtime drift to one area of the codebase
- keeps Uraniborg focused on orchestration rather than review-engine reimplementation

Alternatives considered:

- deep integration with Feynman internals: rejected because it increases coupling and makes pinning/upgrades harder
- shelling out from many modules: rejected because it spreads subprocess assumptions across the codebase
- relying on a `PATH`-resolved global Feynman install: rejected because it weakens version control and makes drift harder to diagnose
- parsing `feynman doctor` as the primary readiness API: rejected because it is a richer human report than the narrower machine checks Uraniborg needs
- predicting Feynman's output slug ahead of time: rejected because the slug is not a stable Uraniborg contract
- searching a shared repo-level `outputs/` directory for the latest review: rejected because it is vulnerable to cross-run ambiguity and stale artifacts

### 4. Keep refinement fully Uraniborg-owned with a strict parser contract

The refinement engine will assemble a prompt from `CURRENT_DRAFT`, `PEER_REVIEW`, and `INFORMATION_HIGHWAY`, call an OpenAI-compatible endpoint, and reject outputs that do not include exactly the required `=== REFINED_DRAFT ===` and `=== CHANGE_SUMMARY ===` sections. Successful responses will be split into `refined.md` and `changes.md`.

Rationale:

- protects the anti-oscillation system because weak or malformed `changes.md` output is a direct product risk
- keeps the refine side separate from review auth and provider concerns
- creates clear validation and testing seams

Alternatives considered:

- accepting loosely structured model output: rejected because parsing ambiguity weakens determinism
- sharing provider logic with Feynman: rejected because the spec requires separate ownership and config

### 5. Build the information highway as structured append-only memory

Memory will be initialized as `information-highway.md` and appended once per completed iteration using headings required by the product spec: accepted reviewer points, rejected reviewer points, changes made, open issues, and regression guards. The append step will derive its content from validated `changes.md`, not from ad hoc free-text summaries.

Rationale:

- directly addresses oscillation and regression risks
- creates a stable format for future refine prompts
- keeps the review path blind because only the refine step consumes memory

Alternatives considered:

- storing memory in JSON only: rejected for v1 because the primary artifact trail is Markdown-first
- summarizing memory with another model: rejected because it adds complexity and potential drift

### 6. Separate CLI interaction from orchestration and persistence

Command handlers under `src/cli/commands/` will gather validated user input and delegate to modules in `src/config/`, `src/run/`, `src/review/`, `src/refine/`, `src/memory/`, and `src/loop/`. `@clack/prompts` will only be used for guided inputs, while execution progress remains plain terminal output.

Rationale:

- keeps orchestration testable without interactive terminal dependencies
- matches the v1 posture of minimal UI complexity
- makes it easier to add non-interactive defaults and scripted usage later

Alternatives considered:

- mixing prompts directly into run-loop code: rejected because it tangles UX with control flow
- using a React-style TUI framework: rejected because it adds complexity without advancing v1 goals

## Risks / Trade-offs

- `[Embedded Feynman output drift]` -> Pin the embedded version, isolate review artifact discovery in one adapter, and copy normalized outputs into Uraniborg iteration paths immediately.
- `[Malformed or weak refine output]` -> Enforce the parser contract, validate non-empty `refined.md` and `changes.md`, and fail the refine step instead of guessing.
- `[Interrupted writes leave inconsistent runs]` -> Persist manifest phase transitions eagerly, write step-local logs, and make resume repair behavior state-driven.
- `[Large drafts create context pressure]` -> Keep the information highway compact and structured in v1, and defer trimming/summarization strategies to later versions.
- `[Dual config surfaces confuse users]` -> Keep review readiness checks descriptive in `doctor`, keep Uraniborg refine config in its own config file, and avoid mutating Feynman internals.
- `[Too-broad initial scope]` -> Constrain v1 to the six required commands and a simple command-line UX, leaving richer inspection and provider diversity out of scope.

## Migration Plan

This is a net-new product surface, so there is no production migration from an older Uraniborg implementation. Implementation should proceed in layers:

1. Establish config/path utilities plus app-home bootstrap and doctor/init flows.
2. Add run manifest and artifact-store primitives.
3. Add review adapter and model-listing support.
4. Add refine provider, prompt assembly, and response parsing.
5. Implement single-iteration run execution, then extend to multi-iteration memory-aware looping.
6. Add resume/history behavior and harden validations and logs.

Rollback strategy:

- Because the change is local-first and file-based, rollback is primarily code rollback; existing run artifacts remain inspectable on disk.
- New commands should avoid mutating prior run directories outside the active run being resumed.

## Open Questions

No questions remain that block implementation of the full v1 user journey.

Follow-up details to settle during implementation:

- What exact file-discovery logic should Uraniborg use inside the iteration-local workspace if more than one `outputs/*-review.md` file appears unexpectedly?
- What is the final field-level shape of `~/.uraniborg/config.json` for refinement defaults, endpoint URL, env-var secret references, and timeouts?
