# Uraniborg v1 UAT Plan

Date: 2026-04-24
Status: Updated for `fix-first-run-setup-contract`
Spec baseline:

- `openspec/changes/fix-first-run-setup-contract/specs/environment-setup/spec.md`
- `openspec/changes/fix-first-run-setup-contract/specs/model-selection/spec.md`
- `openspec/changes/fix-first-run-setup-contract/specs/iterative-draft-run/spec.md`
- `openspec/specs/run-recovery-and-history/spec.md`

## Purpose

This UAT plan validates Uraniborg v1 as a usable local-first CLI under the revised first-run contract:

- Uraniborg discovers a compatible `feynman` on `PATH` for review-side work.
- `uraniborg init` asks only for a refine base URL, API key, and model.
- `doctor`, `models`, and `run` report operational readiness instead of vendored-path compliance.

## Current UAT Status

- Bootstrap is no longer blocked on `~/.uraniborg/vendor/feynman`.
- The main prerequisite is now a compatible `feynman` executable already available on `PATH`.
- Live run/resume UAT is unblocked when:
  - `doctor` reports a compatible Feynman runtime
  - refinement setup is complete
  - review-side providers and refine credentials are available

## Entry Criteria

- `npm run validate` passes.
- A compatible `feynman` executable is available on `PATH`.
- A real refine endpoint and API key are available for `uraniborg init`.
- At least one Markdown draft fixture is available for live run testing.

## Exit Criteria

- First-run `doctor`, `init`, `models`, `run`, `history`, and `resume` journeys have been exercised.
- No blocking issue remains for:
  - discovered Feynman runtime readiness
  - runnable refinement setup
  - run preflight clarity
  - interrupt/resume correctness
- Any remaining failures are classified as:
  - product defect
  - expected limitation
  - environment issue

## Environments

Use at least these four environments:

| Env ID | Shape | Purpose |
|---|---|---|
| `ENV-A` | Fresh home directory with no `~/.uraniborg/` | Validate first-run doctor/init/models clarity |
| `ENV-B` | Existing healthy app home with prior runs | Validate reuse, history, and repeatability |
| `ENV-C` | Existing app home with broken config or missing credentials | Validate failure clarity and remediation |
| `ENV-D` | Interrupt-capable terminal with healthy review/refine setup | Validate cancellation and resume |

## Runtime States

| State ID | Meaning |
|---|---|
| `FR-1` | No compatible `feynman` on `PATH` |
| `FR-2` | Compatible `feynman` on `PATH` and review models available |
| `FR-3` | `feynman` discovered but incompatible or review-model access incomplete |
| `RF-1` | Refinement setup incomplete |
| `RF-2` | Refinement setup ready |

## Evidence To Capture

For every UAT case, capture:

- command invoked
- terminal transcript
- resulting files under `~/.uraniborg/`
- `run.json` and `config.snapshot.json` when a run exists
- exact user-visible warning or error text
- pass/fail decision

## User Journey Matrix

| ID | Priority | Journey | Action | Expected result |
|---|---|---|---|---|
| `UJ-01` | P0 | First-time environment check | Run `uraniborg doctor` in `ENV-A` | Creates app-home layout, reports discovered Feynman readiness, and reports refine readiness clearly |
| `UJ-02` | P0 | Minimal refine setup | Run `uraniborg init` with no existing config | Prompts only for base URL, API key, and model; saves runnable refine config |
| `UJ-03` | P0 | Review/refine visibility | Run `uraniborg models` after `init` | Shows selected/discovered review runtime and refine base URL/model readiness |
| `UJ-04` | P0 | First successful run | Run `uraniborg run fixture-draft-medium.md` | Preflight blocks only on required issues, warns on recommended gaps, and writes canonical artifacts |
| `UJ-05` | P1 | Empty history | Run `uraniborg history` before any run exists | Reports no runs clearly |
| `UJ-06` | P0 | Resume after interruption | Interrupt a live run in `ENV-D`, then run `uraniborg resume <run-id>` | Run resumes from persisted state without losing artifacts |

## Failure Journey Matrix

| ID | Priority | Scenario | Expected result |
|---|---|---|---|
| `FJ-01` | P0 | No `feynman` on `PATH` | `doctor`, `models`, and `run` report missing compatible Feynman without trying to launch a nonexistent Uraniborg-managed binary |
| `FJ-02` | P0 | Incompatible discovered `feynman` | Commands report the discovered executable and why it is incompatible |
| `FJ-03` | P0 | Missing refine API key | `doctor`, `models`, and `run` report incomplete refinement setup and direct the tester back to `uraniborg init` |
| `FJ-04` | P1 | Missing AlphaXiv or web-search support | `doctor` and `run` warn but do not block when required review/refine readiness is otherwise satisfied |
| `FJ-05` | P1 | Invalid config JSON | `doctor` and `run` fail loudly with parse guidance and no silent fallback |

## Acceptance Notes

- Do not treat `~/.uraniborg/vendor/feynman` as a product requirement.
- Do treat the exact selected `feynman` executable reported by Uraniborg as part of the acceptance evidence.
- `init` acceptance should fail if the default path asks for:
  - env-var naming
  - timeout
  - temperature
  - max output tokens
- `run` acceptance should fail if recommended research warnings become hard blockers after review/runtime and refine setup are ready.
