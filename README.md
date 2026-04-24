# Uraniborg

Uraniborg is a local-first CLI for deterministic draft improvement loops.

It takes a Markdown research draft, runs an independent review pass, revises the draft against that review, records structured memory about what changed, and repeats for a fixed number of iterations.

Core loop:

```text
draft -> peer review -> refinement -> memory update -> repeat -> final draft
```

## Status

The v1 implementation is complete against the locked OpenSpec change and the canonical specs now live under:

- [openspec/specs/environment-setup/spec.md](openspec/specs/environment-setup/spec.md)
- [openspec/specs/model-selection/spec.md](openspec/specs/model-selection/spec.md)
- [openspec/specs/iterative-draft-run/spec.md](openspec/specs/iterative-draft-run/spec.md)
- [openspec/specs/run-recovery-and-history/spec.md](openspec/specs/run-recovery-and-history/spec.md)

Automated validation is in place, but live UAT against a real embedded Feynman runtime and real provider credentials is still required.

## What The CLI Supports

The current CLI surface is:

- `init`
  - configure Uraniborg-owned refinement settings
- `doctor`
  - validate environment readiness
- `models`
  - inspect review and refine model availability
- `run <file>`
  - create and execute a new run
- `resume <run-id>`
  - resume an interrupted run
- `history`
  - list prior runs

## Project Layout

- `src/`
  - CLI, orchestration, review, refine, memory, config, and run state code
- `tests/`
  - automated unit and smoke coverage
- `openspec/specs/`
  - canonical locked specs
- `openspec/changes/archive/2026-04-24-build-uraniborg-v1/`
  - archived implementation change record
- `notes/uraniborg-v1-uat-plan.md`
  - structured UAT plan
- `notes/uraniborg-v1-uat-instructions.md`
  - step-by-step UAT execution guide

## Requirements

- Node.js `>= 20`
- npm
- a real pinned Feynman runtime available under `~/.uraniborg/vendor/feynman`
- credentials for the Uraniborg-owned refine endpoint you configure during `init`

## Local Development

Install dependencies:

```bash
npm install
```

Validate the codebase:

```bash
npm run validate
```

Build the project:

```bash
npm run build
```

Run the built CLI locally:

```bash
node dist/src/cli/main.js --help
```

## Quickstart

1. Build the CLI:

```bash
npm run build
```

2. Configure refinement:

```bash
node dist/src/cli/main.js init
```

3. Check readiness:

```bash
node dist/src/cli/main.js doctor
node dist/src/cli/main.js models
```

4. Run a draft:

```bash
node dist/src/cli/main.js run path/to/draft.md --iterations 1
```

5. Inspect prior runs:

```bash
node dist/src/cli/main.js history
```

6. Resume an interrupted run:

```bash
node dist/src/cli/main.js resume <run-id>
```

## Run Artifacts

Uraniborg stores app state under `~/.uraniborg/`.

Each run persists local artifacts including:

- `run.json`
- `config.snapshot.json`
- `original.md`
- `current.md`
- `final.md`
- `information-highway.md`
- `iter-N/input.md`
- `iter-N/review.md`
- `iter-N/refined.md`
- `iter-N/changes.md`
- per-step logs

## UAT

For structured acceptance testing:

- read the plan: [notes/uraniborg-v1-uat-plan.md](notes/uraniborg-v1-uat-plan.md)
- follow the execution guide: [notes/uraniborg-v1-uat-instructions.md](notes/uraniborg-v1-uat-instructions.md)

## Known Packaging Gap

The current build emits the CLI entrypoint at `dist/src/cli/main.js`.

`package.json` currently advertises the bin as `./dist/cli/main.js`, which does not match the emitted path. For local use, run the built file directly with:

```bash
node dist/src/cli/main.js ...
```

This is a packaging/product issue to fix in the codebase, not just a one-off UAT workaround.
