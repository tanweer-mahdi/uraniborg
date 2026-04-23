# Repository Guidelines

## Session Management
At the start of a new session look into the notes/session-logs/ directory to find the latest session log and hand-off notes.
Before closing any session/before compaction create a new timestamped session log in notes/session-logs/ directory for the next session to pick up 

## Project Structure & Module Organization
This repository is currently spec-first. The main product definition lives in [URANIBORG_SPEC.md](URANIBORG_SPEC.md). OpenSpec workflow files live under `openspec/`:

- `openspec/config.yaml`: OpenSpec configuration
- `openspec/changes/build-uraniborg-v1/`: active change artifacts (`proposal.md`, `design.md`, `tasks.md`)
- `openspec/specs/`: canonical specs after changes are archived

Repo-local Codex/OpenSpec skills live in `.codex/skills/`. There is no committed `src/` or `tests/` tree yet; implement code only after aligning with the active OpenSpec change.

## Build, Test, and Development Commands
Use OpenSpec commands as the main contributor workflow:

- `openspec validate build-uraniborg-v1` — validate the active change artifacts
- `openspec status --change "build-uraniborg-v1"` — inspect artifact completion
- `openspec instructions apply --change "build-uraniborg-v1" --json` — load implementation context before coding
- `git status --short` — confirm a clean working tree before and after edits

If application code is added later, document its runtime commands in this file alongside the new source tree.

For any implementation plan, task breakdown during the development - do NOT resort to any arbitrary document. Strictly treat the the documents under the openspec directory, especially under the openspec/spec/ directory as the authoritative source of truth.
Use URANIBORG_SPEC.md as the high level product guideline, not a development guideline. 

## TypeScript and Bash Coding Principles

1. **Strict types, no escape hatches.** Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Any `any`, `as`, or `@ts-ignore` requires an inline justification comment or it doesn't ship.

2. **Fail loud, fail early.** Every bash script opens with `set -euo pipefail` and `IFS=$'\n\t'`. TypeScript never swallows errors — no empty catches, no unhandled rejections, no `.catch(() => {})`.

3. **Pure core, effects at the edges.** Business logic is pure and deterministic. Filesystem, network, env reads, and process spawning live in thin boundary modules that can be swapped or mocked.

4. **Scripts are contracts.** Every bash script and CLI entry point validates its inputs up front, is idempotent where possible, and uses meaningful exit codes. Destructive actions require an explicit flag (`--force`, `--apply`), never a default.

5. **One source of truth.** Config, schemas, and shared constants are defined once. Bash reads canonical values via env or `jq` over a config file — it never hardcodes duplicates of TypeScript constants.

### General Development Principles

1. Errors are values, not surprises. Every failure mode is explicit in the signature or exit contract. No hidden control flow, no silent fallbacks, no "it usually works." The caller always knows what can go wrong and is forced to decide.
Boundaries over layers.

2. Separate code by trust and determinism, not by architectural ceremony. Pure, total, deterministic logic in the center; parsing, I/O, and side effects at the perimeter. Data crossing inward is validated once and never re-checked.
Compose small, total functions.

3. Prefer many small units with complete input/output contracts over few large units with implicit preconditions. A function that works for all inputs of its type is infinitely more reusable than one that works for most.
The build is the spec.

4. If a rule matters, encode it mechanically — in types, lints, schemas, tests, or CI gates. Conventions that rely on human vigilance are already broken; only what the toolchain enforces is actually true.

## Testing Guidelines
Before implementation, validation is the test gate: run `openspec validate build-uraniborg-v1`.
After code exists, add unit and integration tests that map directly to scenarios in the active specs and keep test names aligned with the behavior under test.
Testing scripts should stay under the tests/ directory in the repo root. Strictly follow the following testing principles:

1. **Pyramid, weighted right.** Many unit tests on pure logic; fewer integration tests at real boundaries; a thin E2E layer for critical flows.

2. **One behavior per test, named by behavior.** Arrange–Act–Assert. Test public contracts, not internals. If you need `&&` in an assertion, split the test.

3. **Mock only at trust boundaries.** Network, time, randomness, filesystem. Never mock what you own — prefer real implementations or in-memory fakes.

4. **Determinism or it's broken.** Inject clocks, seed RNGs, isolate fixtures. Flaky tests get fixed or deleted, never retried.

5. **Types, lint, tests are one gate.** All block merge. Coverage is a diagnostic, not a target — branch coverage on logic and error paths is what counts.

6. **Properties for invariants, examples for specifics.** Use property-based tests for algebraic laws (round-trips, idempotence); hand-written cases for regressions and edges.

7. **Tests are production code.** Typed, DRY, no `any`. A failure message alone should tell you what broke.

## Commit & Pull Request Guidelines
Recent commits use short imperative subjects, e.g. `Refine Uraniborg OpenSpec task breakdown` and `Add Uraniborg spec`. Follow that style:

- one focused change per commit
- each commit should NOT exceed more than 5 file changes unless otherwise necessary 
- subject line in imperative mood
- avoid bundling unrelated spec and code edits

PRs should describe the affected OpenSpec change, summarize artifact/code updates, and note validation commands run.

## Agent-Specific Instructions
Do not create ad hoc planning docs outside OpenSpec. Update the active change artifacts in `openspec/changes/build-uraniborg-v1/`, then use `openspec-apply-change` only after tasks and design are locked.
