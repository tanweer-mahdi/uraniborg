# Uraniborg Product and Architecture Spec

Date: 2026-04-21

## 1. What Is Uraniborg?

Uraniborg is a local-first CLI application for iterative research refinement.

Its core job is to take a research idea or draft in Markdown, run a peer review pass against it, revise the draft in response to that review, record the important changes made, and repeat this loop for a user-defined number of iterations.

The core loop is:

```text
draft -> peer review -> refinement -> memory update -> repeat -> final draft
```

Uraniborg is intentionally asymmetric:

- Peer review is performed by an embedded Feynman-powered review engine.
- Refinement is performed by a Uraniborg-owned refinement engine with its own model config and system prompts.
- Review does not see memory from prior iterations.
- Refinement does see structured memory from prior iterations.

This asymmetry exists to preserve reviewer independence while still allowing the refiner to avoid oscillation and repeated mistakes.

### Product Positioning

Uraniborg is not:

- a general-purpose chat assistant
- a full research IDE
- a framework for arbitrary multi-agent workflows
- a web app

Uraniborg is:

- a focused local CLI workflow
- a deterministic iterative improvement loop
- an artifact-first system with durable outputs
- a tool for converting vague ideas into progressively stronger research drafts

### Design Principles

- Brutally simple over clever
- Strong artifacts over hidden state
- Deterministic orchestration over agent improvisation
- Review/refine separation over blended roles
- Self-sufficient installation over dependency friction
- Local file transparency over database abstraction

## 2. What Is the User Journey We Are Aiming to Achieve?

The intended user journey is:

1. The user installs Uraniborg.
2. The user does not need to separately install or configure Feynman.
3. The user points Uraniborg at a Markdown research idea or draft.
4. The user chooses how many review-refine iterations to run.
5. The user chooses the review model and the refine model.
6. Uraniborg runs the loop, saving every artifact locally.
7. The user can inspect the review, refinement, and memory after every iteration.
8. The user ends with a final improved draft and a durable trail of what changed and why.

### Ideal First-Run Experience

```text
$ uraniborg run idea.md

Uraniborg checks embedded review engine...
Uraniborg checks refinement config...

? How many iterations? 3
? Which review model? openai/gpt-5.4
? Which refine model? gpt-5.4

Starting run: 2026-04-21T18-15-00Z-idea-slug
Iteration 1/3: review
Iteration 1/3: refine
Iteration 1/3: memory updated
...
Run complete.
Final draft: ~/.uraniborg/runs/.../final.md
```

### Journey Stages

#### Stage A: Setup

The user installs one product: Uraniborg.

Uraniborg internally ensures that:

- a pinned embedded Feynman runtime is available
- Feynman review auth is ready, or setup/login is launched
- Uraniborg refinement config is ready

The user should never be told to install Feynman manually as a prerequisite.

#### Stage B: Run Creation

The user provides:

- input Markdown path
- number of iterations
- chosen review model
- chosen refine model

Uraniborg creates a run folder and snapshots the configuration used for that run.

#### Stage C: Iterative Improvement

For each iteration:

- Uraniborg sends the current draft to the review engine
- the review engine writes a review artifact
- Uraniborg sends the current draft, the latest review, and the information highway to the refinement engine
- the refinement engine writes a refined draft and a structured change summary
- Uraniborg appends a new structured memory block to the information highway
- Uraniborg promotes the refined draft to become the next current draft

#### Stage D: Inspection and Recovery

At any point the user can:

- inspect current artifacts on disk
- stop the run
- resume later
- review prior runs from history

#### Stage E: Completion

When all iterations finish:

- Uraniborg writes `final.md`
- the run is marked `finished`
- the full run remains available as a reproducible local artifact tree

## 3. Fully Detailed Spec

## 3.1 Product Scope

### Goal

Provide a local CLI tool that repeatedly improves a research draft through unbiased peer review and memory-aware refinement, while preserving every artifact.

### Non-Goals for v1

- no web UI
- no multi-user collaboration
- no database
- no plugin platform
- no vector store
- no second OAuth/auth platform for refinement
- no direct embedding into Feynman internals
- no generalized agent platform

## 3.2 Architectural Shape

```text
uraniborg
  -> Bootstrapper
  -> Config Manager
  -> TUI / Prompt Layer
  -> Run Orchestrator
  -> Review Engine Adapter -> embedded feynman
  -> Refine Engine -> uraniborg-native LLM call
  -> Memory Builder
  -> Artifact Store
  -> Run Manifest
```

### Core Separation

#### Review Side

- Engine: embedded Feynman subprocess
- Auth: Feynman-owned
- Model selection: Feynman-owned
- Review workflow/prompt: Feynman-owned
- Input: current draft only
- Output: review artifact

#### Refine Side

- Engine: Uraniborg-native LLM caller
- Auth/config: Uraniborg-owned
- Prompting behavior: Uraniborg-owned
- Input: current draft, latest review, information highway
- Output: refined draft and structured change summary

This boundary is intentional and should remain strict.

## 3.3 Core Components and Roles

### Bootstrapper

Purpose:

- make Uraniborg self-sufficient to install and run

Responsibilities:

- prepare private app directories under `~/.uraniborg/`
- ensure embedded Feynman exists and is runnable
- initialize vendor paths
- check whether review auth is available
- launch embedded Feynman login/setup when needed
- validate refine config presence

Out of scope:

- inventing a new auth workflow for review
- downloading arbitrary external toolchains at runtime unless explicitly designed

### Config Manager

Purpose:

- load and validate Uraniborg-owned configuration

Responsibilities:

- load `~/.uraniborg/config.json`
- validate refine endpoint configuration
- define defaults
- resolve env vars for secrets
- snapshot config into each run directory

Important rule:

- Uraniborg config must not attempt to rewrite or own Feynman's config internals

### TUI / Prompt Layer

Purpose:

- collect user inputs and show progress with minimal complexity

Responsibilities:

- gather file path
- gather iteration count
- gather review model choice
- gather refine model choice
- confirm start/resume actions
- display phase progress

v1 implementation posture:

- use `@clack/prompts` for setup interaction
- use plain terminal progress output during execution

### Run Orchestrator

Purpose:

- own the deterministic loop and state transitions

Responsibilities:

- create run
- update run manifest
- dispatch review step
- dispatch refine step
- dispatch memory update step
- advance iteration counter
- stop on failure
- resume incomplete runs

This is the core of the product and should be written as a state machine, not as a free-form agent.

### Review Engine Adapter

Purpose:

- wrap embedded Feynman as a stable Uraniborg-facing interface

Responsibilities:

- invoke embedded `feynman review <file>`
- pass selected review model
- capture stdout/stderr
- locate produced review artifact
- normalize result into Uraniborg iteration paths

Boundary rule:

- treat Feynman as a black box for v1

### Refine Engine

Purpose:

- execute Uraniborg-owned revision behavior

Responsibilities:

- build refinement prompt payload
- call configured OpenAI-compatible endpoint
- parse the returned structured output
- save `refined.md`
- save `changes.md`
- fail if format contract is violated

### Memory Builder

Purpose:

- maintain anti-oscillation structured memory

Responsibilities:

- initialize `information-highway.md`
- append a structured block after each iteration
- preserve accepted changes
- preserve rejected suggestions
- preserve open issues
- preserve regression guards

Important rule:

- memory must be structured enough that future refine iterations can reliably use it

### Artifact Store

Purpose:

- provide durable local storage for every run

Responsibilities:

- create run directories
- create iteration directories
- write all artifacts
- write logs
- expose paths for history and resume

### Run Manifest

Purpose:

- act as the machine-readable source of truth for run state

Responsibilities:

- store run metadata
- store current phase
- store iteration counters
- store selected models
- store latest error if any
- make resume possible

## 3.4 Execution Model

### Core Loop

```text
original.md copied to current.md

for iteration in 1..N:
  review(current.md) -> review.md
  refine(current.md + review.md + information-highway.md) -> refined.md + changes.md
  append changes.md summary to information-highway.md
  current.md = refined.md

final.md = current.md
```

### Why This Is Not Recursion

This is an iterative stateful loop, not recursion.

There is no nested self-invocation. There is a repeated transformation pipeline applied to evolving artifacts.

## 3.5 Run States

Allowed states:

- `initialized`
- `review_running`
- `review_complete`
- `refine_running`
- `refine_complete`
- `memory_update`
- `iteration_complete`
- `finished`
- `failed`
- `cancelled`

Resume logic should be based on these states rather than inferred from raw files alone.

## 3.6 Command Surface

### Required v1 Commands

- `uraniborg run <file>`
- `uraniborg resume <run-id>`
- `uraniborg history`
- `uraniborg models`
- `uraniborg doctor`
- `uraniborg init`

### Command Intent

#### `uraniborg run <file>`

Creates a new run and executes the loop.

#### `uraniborg resume <run-id>`

Resumes a failed or cancelled run from the last known state.

#### `uraniborg history`

Lists local runs with status, date, and slug.

#### `uraniborg models`

Shows:

- available review models from embedded Feynman
- configured refine model settings from Uraniborg

#### `uraniborg doctor`

Checks:

- vendor Feynman availability
- Feynman auth/model readiness
- Uraniborg refine config validity
- filesystem layout readiness

#### `uraniborg init`

Optional guided setup for refinement config and defaults.

## 3.7 File and Directory Layout

### App Home

```text
~/.uraniborg/
  config.json
  vendor/
    feynman/
  runs/
```

### Run Tree

```text
~/.uraniborg/runs/
  2026-04-21T18-15-00Z-scaling-laws/
    run.json
    config.snapshot.json
    original.md
    current.md
    information-highway.md
    final.md
    iter-01/
      input.md
      review.md
      refined.md
      changes.md
      review.log
      refine.log
      decision.json
    iter-02/
    iter-03/
```

### File Rules

- `original.md` is immutable
- `current.md` is always the latest accepted draft
- `final.md` exists only when finished
- completed iteration directories are append-only
- every execution step writes its own log

## 3.8 Data Contracts

### `run.json`

Purpose:

- canonical machine-readable run metadata

Required fields:

- run id
- slug
- title
- status
- phase
- created/updated timestamps
- source input path
- iterations planned/completed
- selected review model
- selected refine model
- key artifact paths
- last error

### `config.snapshot.json`

Purpose:

- freeze the config used for the run

Contents:

- resolved defaults
- selected refine endpoint config
- selected models
- iteration count

### `review.md`

Purpose:

- latest unbiased peer review artifact for the current iteration

Source:

- produced by embedded Feynman

### `refined.md`

Purpose:

- fully revised draft candidate for the next iteration

Important:

- this must be a full document, not a patch fragment

### `changes.md`

Purpose:

- capture a structured summary of the refinement just performed

Required sections:

- `Accepted reviewer points`
- `Rejected reviewer points`
- `Changes made`
- `Open issues`
- `Regression guards`

This file is critical. If it is weak, the system will drift or oscillate.

### `information-highway.md`

Purpose:

- provide accumulated structured memory to refinement only

It must be composed of per-iteration appended blocks and nothing else.

## 3.9 Model and Auth Strategy

### Review Model Strategy

- owned by Feynman
- uses Feynman model login and provider configuration
- selected from what embedded Feynman exposes as available

### Refinement Model Strategy

- owned by Uraniborg
- separate config
- separate prompts
- separate endpoint selection

### v1 Refinement Support

Only support:

- OpenAI-compatible HTTP endpoint
- API key via env var

Do not support in v1:

- refinement OAuth
- a custom provider marketplace
- complex multi-provider abstractions

This keeps the refine side simple without re-implementing a second full model/auth platform.

## 3.10 Review Step Contract

### Inputs

- `current.md`
- selected review model

### Process

- copy `current.md` into `iter-N/input.md`
- call embedded `feynman review`
- collect review logs
- locate final review artifact
- copy/promote it into `iter-N/review.md`

### Success Criteria

- `iter-N/review.md` exists
- `iter-N/review.md` is non-empty
- process exited successfully, or artifact still exists in a tolerable partial-success case

### Failure Criteria

- no review artifact produced
- execution error without usable review output

## 3.11 Refine Step Contract

### Inputs

- current draft
- latest review
- information highway
- Uraniborg refinement system prompt
- selected refine model

### Outputs

- `iter-N/refined.md`
- `iter-N/changes.md`
- `iter-N/refine.log`

### Hard Rules

- produce a full revised draft
- preserve Markdown structure
- do not fabricate evidence, citations, numbers, or experiments
- explicitly reject bad reviewer suggestions when necessary
- do not silently revert earlier accepted changes
- obey regression guards unless explicitly overriding them with justification

### Parse Contract

The model response must contain:

```text
=== REFINED_DRAFT ===
...

=== CHANGE_SUMMARY ===
...
```

Anything outside this contract should fail parsing in v1.

## 3.12 Information Highway Contract

The information highway is the memory system.

It exists to reduce the risk of:

- A -> B -> A oscillation
- reintroducing previously removed claims
- re-accepting previously rejected reviewer suggestions
- losing track of open limitations

Each iteration appends:

```md
## Iteration N
### Accepted reviewer points
- ...

### Rejected reviewer points
- ...
Reason: ...

### Changes made
- ...

### Open issues
- ...

### Regression guards
- ...
```

The review engine never receives this file.

## 3.13 Validation Rules

### Input Validation

- input file must exist
- input file must be Markdown
- iterations must be between `1` and `10` in v1

### Review Validation

- review model must be available in Feynman
- review output must exist and be non-empty

### Refine Validation

- refine config must resolve
- refine endpoint must be reachable
- refine output must include both required output sections
- parsed `refined.md` must be non-empty
- parsed `changes.md` must be non-empty

### Memory Validation

- appended iteration block must contain all required headings

## 3.14 Resume Behavior

Resume must be deterministic and simple.

Rules:

- if state was `review_running`, rerun review for that iteration
- if state was `refine_running`, rerun refine for that iteration
- if state was `memory_update`, rebuild memory append from the existing `changes.md`
- completed iteration directories are not rewritten unless repair is needed for manifest consistency

## 3.15 TUI Scope for v1

Uraniborg does not need a sophisticated full-screen terminal app in v1.

Use:

- `@clack/prompts` for guided setup inputs
- plain status streaming for run progress

The v1 UI should answer:

- what run is this?
- what iteration is currently running?
- what phase is currently running?
- where are the artifacts?
- did anything fail?

Not more.

## 3.16 Acceptance Criteria

Uraniborg v1 is successful if:

- a user can install it without separately installing Feynman
- a user can run a 3-iteration loop from one command
- all iteration artifacts are saved locally
- review never sees memory
- refine always sees memory
- runs can be resumed after interruption
- every completed run yields a final draft plus a trace of why it changed

## 4. Implementation Plan

## 4.1 Technology Choices

### Primary Language

- TypeScript

Rationale:

- Feynman is already a Node/TypeScript CLI
- subprocess integration is straightforward
- packaging remains in one runtime family
- local CLI/TUI libraries are good enough for v1
- typed config and manifest handling are valuable

### Runtime

- Node.js 20+

### Libraries

- built-in `fs/promises`, `path`, `child_process`
- `@clack/prompts` for guided terminal prompts
- `zod` or `@sinclair/typebox` for schema validation
- `fetch` for OpenAI-compatible API calls

Avoid for v1:

- databases
- job queues
- React-style terminal frameworks unless needed later
- LangChain-style orchestration stacks

## 4.2 Source Layout

```text
src/
  cli/
  config/
  loop/
  review/
  refine/
  memory/
  run/
  ui/
  types/
```

### Module Breakdown

#### `src/config/`

- `app-config.ts`
- `paths.ts`

Purpose:

- load config
- resolve user directories
- centralize path logic

#### `src/run/`

- `manifest.ts`
- `artifact-store.ts`
- `state-machine.ts`
- `slug.ts`

Purpose:

- define the durable run model
- create and update run files safely

#### `src/review/`

- `feynman-bootstrap.ts`
- `feynman-models.ts`
- `feynman-review.ts`

Purpose:

- own all interaction with embedded Feynman

#### `src/refine/`

- `provider.ts`
- `models.ts`
- `prompt.ts`
- `parser.ts`
- `refine.ts`

Purpose:

- own refinement model calls, prompt assembly, and output parsing

#### `src/memory/`

- `information-highway.ts`
- `changes.ts`

Purpose:

- initialize and append structured memory

#### `src/loop/`

- `run-loop.ts`
- `review-step.ts`
- `refine-step.ts`
- `memory-step.ts`
- `resume.ts`
- `validators.ts`

Purpose:

- implement the deterministic loop

#### `src/cli/`

- `index.ts`
- `commands/run.ts`
- `commands/resume.ts`
- `commands/history.ts`
- `commands/models.ts`
- `commands/doctor.ts`
- `commands/init.ts`

Purpose:

- expose the product interface

#### `src/ui/`

- `prompts.ts`
- `progress.ts`
- `errors.ts`

Purpose:

- keep terminal interaction isolated from orchestration logic

## 4.3 Implementation Milestones

### Milestone 1: Bootstrap and Doctor

Deliverables:

- app home path resolution
- config loading
- embedded Feynman bootstrap check
- `uraniborg doctor`
- `uraniborg init`

Why first:

- nothing else is stable until runtime and config assumptions are verified

### Milestone 2: Single-Iteration Path

Deliverables:

- `uraniborg run <file>`
- run directory creation
- manifest creation
- review step
- refine step
- output parsing
- final artifact persistence

Constraint:

- allow `N=1` only at first

### Milestone 3: Multi-Iteration Loop

Deliverables:

- iteration loop
- information highway append logic
- `current.md` promotion between iterations
- manifest iteration accounting

### Milestone 4: Resume and History

Deliverables:

- `uraniborg resume <run-id>`
- `uraniborg history`
- state-based restart behavior

### Milestone 5: Hardening

Deliverables:

- stronger validation
- clearer errors
- artifact discovery hardening around Feynman output
- better logging and model reporting

## 4.4 Recommended Build Order

1. Path utilities and config schema
2. Run manifest and artifact store
3. Feynman bootstrap and model listing
4. Refine provider and parser
5. Single iteration execution
6. Looping and memory append
7. Resume/history
8. UX polish

## 4.5 Testing Strategy

### Unit Tests

Test:

- manifest transitions
- path generation
- slug generation
- refine prompt assembly
- refine response parser
- information highway append formatter

### Integration Tests

Test with fakes/mocks:

- one complete iteration
- two complete iterations with memory carry-forward
- resume after review failure
- resume after refine failure

### Smoke Tests

Test with real tooling where available:

- embedded Feynman launches
- review model list can be resolved
- refine endpoint can be reached

## 4.6 Proposed Refinement System Prompt

This should be Uraniborg-owned and versioned.

### System Prompt

```text
You are revising a research document in response to peer review.

Your job is to produce:
1. A full revised draft.
2. A structured change summary.

You are not the reviewer. You are the author making disciplined revisions.

Inputs you will receive:
- CURRENT_DRAFT: the latest full draft
- PEER_REVIEW: the latest review of that draft
- INFORMATION_HIGHWAY: structured memory of prior accepted changes, rejected suggestions, open issues, and regression guards

Behavior rules:
- Treat the peer review seriously, but do not obey it blindly.
- Apply strong reviewer points when they improve rigor, clarity, calibration, structure, or reproducibility.
- Reject weak, mistaken, redundant, or conflicting reviewer suggestions explicitly in the change summary.
- Never revert a prior accepted change unless the current review gives a strong reason; if you do revert something, explain it explicitly.
- Respect the regression guards in INFORMATION_HIGHWAY.
- Prefer softening unsupported claims over inventing evidence.
- Do not fabricate experiments, citations, numbers, ablations, baselines, or results.
- Keep the document internally consistent after revision.
- Preserve Markdown structure and produce a complete standalone revised draft, not a patch or fragment.
- If the review requests work that cannot honestly be completed from the available material, acknowledge the limitation and revise the draft conservatively.

Output format:
=== REFINED_DRAFT ===
<full revised markdown document>

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- ...

## Rejected reviewer points
- ...
Reason: ...

## Changes made
- ...

## Open issues
- ...

## Regression guards
- ...

Quality bar:
- The revised draft must be publishable-quality relative to the input.
- The change summary must be specific enough to prevent future A -> B -> A oscillation.
- Do not include any text outside the required two sections.
```

### Prompt Assembly Rule

At runtime the user prompt should contain:

- `CURRENT_DRAFT`
- `PEER_REVIEW`
- `INFORMATION_HIGHWAY`

Each should be clearly delimited and passed as full text.

## 5. v2.0 Targets

v2.0 should extend the system only after v1 proves the core loop is valuable.

### Product Targets

- richer terminal run inspection
- run diff views between iterations
- selective early stop when changes plateau
- iteration scoring and convergence heuristics
- better per-step metrics
- export summaries for sharing

### Model Targets

- broader refinement provider support
- multi-model refinement experiments
- optional fallback refine model on failure
- controlled model ensembles for refine-only experimentation

### Workflow Targets

- manual approval gate between iterations
- optional human edit injection before the next iteration
- optional reviewer diversity by rotating review models
- compare two refinement strategies on the same input

### Artifact Targets

- richer provenance
- run-level summary reports
- machine-readable change metadata beyond Markdown
- side-by-side render of draft deltas

### Packaging Targets

- standalone platform bundles for Uraniborg itself
- tighter embedded Feynman packaging
- in-app update checks

### Explicit v2 Boundary

Do not pursue v2 features until:

- v1 run loop is stable
- resume works reliably
- artifact paths are trustworthy
- refinement prompt quality is acceptable

## 6. Risks and Potential Remediation

## 6.1 Product Risks

### Risk: The loop produces oscillation instead of progress

Why:

- weak memory structure
- vague change summaries
- overly obedient refinement

Remediation:

- require structured `changes.md`
- require regression guards
- pass memory only to refinement
- keep review blind to prior memory

### Risk: The refinement engine starts gaming the reviewer

Why:

- repeated exposure to the review format can create shallow compliance

Remediation:

- enforce conservative revision rules
- prefer explicit unresolved issues over pretending fixes
- rotate review models in v2 if needed

### Risk: The tool feels too complex for first-time users

Why:

- too much setup
- too many choices
- too much TUI ambition

Remediation:

- one-command run path
- sensible defaults
- minimal prompt flow
- no full-screen UI in v1

## 6.2 Technical Risks

### Risk: Feynman output path assumptions drift across versions

Why:

- Uraniborg depends on stable review artifact handling

Remediation:

- pin embedded Feynman version
- isolate all Feynman assumptions in one adapter
- normalize/copy review artifacts immediately into Uraniborg iteration paths

### Risk: Split ownership between review and refine becomes messy

Why:

- two model/config systems can confuse the implementation

Remediation:

- define a hard ownership boundary
- keep review config entirely Feynman-side
- keep refine config entirely Uraniborg-side
- avoid shared mutable config files

### Risk: Resume becomes unreliable

Why:

- insufficient state tracking
- implicit phase inference

Remediation:

- use explicit manifest states
- persist phase updates before and after every major step
- rely on run manifest as the control plane

### Risk: Model/provider setup for refinement becomes a second auth platform

Why:

- temptation to support many providers too early

Remediation:

- limit v1 refine support to OpenAI-compatible endpoints
- use env-based API key config
- postpone OAuth and provider-specific flows

### Risk: TUI scope explodes

Why:

- interactive terminal products often over-invest in UI before core correctness

Remediation:

- use `@clack/prompts` only for structured input collection
- use plain output for run status
- defer paneled/full-screen interfaces to v2

## 6.3 Operational Risks

### Risk: Interrupted runs leave inconsistent artifacts

Why:

- abrupt process termination

Remediation:

- write phase transitions eagerly
- isolate iteration artifacts per folder
- make resume rebuild from explicit state

### Risk: Large drafts or reviews exceed practical token limits

Why:

- later iterations can grow in context size

Remediation:

- keep information highway compressed and structured
- limit v1 input size expectations
- introduce summarization/trimming strategies in v2 if necessary

### Risk: Users cannot understand what changed across iterations

Why:

- opaque outputs
- poor change summaries

Remediation:

- enforce high-quality `changes.md`
- keep iteration folders first-class
- add diff tooling in v2

## 6.4 Strategic Risk

### Risk: Uraniborg becomes a wrapper with unclear value beyond Feynman

Why:

- if refinement is under-specified, the product becomes "just run Feynman multiple times"

Remediation:

- make the asymmetric loop the core identity
- make structured memory a first-class feature
- make refinement prompts and contracts strong and distinct
- keep artifact and convergence discipline as Uraniborg-owned differentiation

## Closing Position

The correct v1 bias is:

- strong orchestration
- strong artifact discipline
- simple install experience
- strict review/refine separation
- weak UI complexity

If those are done well, Uraniborg will be coherent from day one and extensible in v2 without needing to be rewritten.
