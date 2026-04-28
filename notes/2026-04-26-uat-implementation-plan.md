# Uraniborg UAT Implementation Plan - 2026-04-26

Purpose: consolidate the current implementation plan for the critical UAT fixes and the adjacent setup UX work.

Important: this note is a planning memo, not the implementation authority. Before coding, the authoritative task and scope control should be captured in OpenSpec change artifacts.

## Planning Inputs

- Latest authoritative handoff used for scope: [2026-04-25T22-02-39+1000-session-handoff.md](./session-logs/2026-04-25T22-02-39+1000-session-handoff.md)
- UAT issues: [uraniborg-v1-uat-issues.md](./uraniborg-v1-uat-issues.md)
- UAT observations: [uraniborg-v1-uat-observations.md](./uraniborg-v1-uat-observations.md)
- Existing completed OpenSpec changes that touch this surface:
  - [openspec/changes/fix-first-run-setup-contract/proposal.md](/Users/shahmahdihasan/uraniborg/openspec/changes/fix-first-run-setup-contract/proposal.md)
  - [openspec/changes/serialize-feynman-runtime-access/proposal.md](/Users/shahmahdihasan/uraniborg/openspec/changes/serialize-feynman-runtime-access/proposal.md)

## Scope To Address

Critical:

1. `UAT-ISSUE-001`
   - replace `Finished feynman setup with exit 0` with a polished success message
   - suppress raw successful process artifacts in the default remediation flow
2. `UAT-ISSUE-002`
   - when `doctor` offers web-search remediation, route to the dedicated Feynman web-search command path instead of generic `feynman setup`

High-priority UX follow-up:

3. `UAT-OBS-011`
   - provide a clearer command surface than `init` for updating revision defaults
4. `UAT-OBS-012`
   - replace user-facing `refinement` terminology with `revision` in setup-oriented CLI copy

## Complexity Assessment

### UAT-ISSUE-001

- Complexity: low
- Reason:
  - the defect sits in the shared remediation presenter, not in readiness classification
  - current leak source is [src/cli/commands/shared.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/shared.ts)
- Expected effort:
  - small code change
  - targeted test updates
  - shared-path regression pass because `doctor`, `models`, and run preflight reuse the helper

### UAT-ISSUE-002

- Complexity: medium to high
- Reason:
  - current remediation model has no distinct web-search action kind
  - `web_search` readiness currently emits generic setup remediation in [src/review/feynman-readiness.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-readiness.ts)
  - generic setup is hard-mapped to `feynman setup` in [src/review/feynman-remediation.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-remediation.ts)
  - installed Feynman exposes `feynman search set <provider> [api-key]`, which requires more than a blind launch if Uraniborg wants a good operator flow
- Expected effort:
  - remediation contract extension
  - command wrapper and launcher changes
  - prompt design for any required provider or API-key collection
  - dedicated tests

### UAT-OBS-011

- Complexity: low to medium
- Reason:
  - `init` should remain supported because the existing spec explicitly requires an `init` flow
  - the likely fix is additive, not a rename-in-place
  - current handler already supports updating an existing config
- Expected effort:
  - add a clearer sibling command or alias
  - keep `init` backward compatible
  - update command registration and tests

### UAT-OBS-012

- Complexity: low
- Reason:
  - this is mainly a user-facing terminology sweep
  - internal config and type names can remain `refine.*`
- Expected effort:
  - copy updates in setup-oriented CLI surfaces
  - regression tests for prompt labels and user-facing messages

## Recommended OpenSpec Boundary

Do not treat this note as the implementation ledger.

Recommended next authoritative step:

- Create a new focused OpenSpec follow-up change rather than reopening completed changes.
- Proposed change theme:
  - setup/remediation UX alignment
  - revision terminology and discoverability alignment

Recommended split inside that follow-up:

1. Environment/setup remediation slice
   - covers `UAT-ISSUE-001`
   - covers `UAT-ISSUE-002`
2. Revision setup UX slice
   - covers `UAT-OBS-011`
   - covers `UAT-OBS-012`

Reason for a new follow-up:

- `fix-first-run-setup-contract` and `serialize-feynman-runtime-access` are already complete
- these UAT items are narrower polish and routing corrections, not a reopening of the earlier runtime-corruption work
- the command-surface and terminology work deserves explicit spec language before code changes

## Proposed Implementation Direction

### Track A - Remediation Flow Corrections

#### A1. Curate remediation completion output

Goal:

- replace raw exit-code phrasing in the shared remediation flow with operator-facing success language

Recommended behavior:

- on success:
  - `Finished feynman setup with exit code 0.` becomes a curated success message such as `Feynman setup completed successfully.`
- on non-zero exit:
  - preserve failure visibility
  - include actionable guidance without leaking unnecessary raw fragments by default

Primary files:

- [src/cli/commands/shared.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/shared.ts)

Test scope:

- add or extend CLI coverage for successful remediation completion messaging
- confirm raw `exit code` text is absent from default successful output
- verify shared behavior does not regress `doctor` and run preflight flows

#### A2. Split web-search remediation from generic setup

Goal:

- stop representing web-search remediation as the same action as generic setup

Required code changes:

1. Introduce a distinct remediation kind for web-search configuration
2. Update readiness generation so `web_search` emits that dedicated kind
3. Add a dedicated command mapping for the web-search action
4. Update action dedupe logic if it keys only on `kind`

Primary files:

- [src/review/feynman-readiness.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-readiness.ts)
- [src/review/feynman-remediation.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-remediation.ts)
- [src/review/feynman-models.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-models.ts)
- [src/cli/commands/shared.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/shared.ts)

#### A3. Web-search operator flow

Observed external contract:

- installed Feynman exposes `feynman search status`
- installed Feynman exposes `feynman search set <provider> [api-key]`
- installed Feynman help does not expose a separate guided web-search wizard

Approved implementation direction:

- add a Uraniborg prompt flow that:
  - offers web-search configuration even when a search provider is already configured
  - collects the provider value
  - optionally collects an API key when the chosen provider requires it
  - launches the Feynman-owned `search set` command rather than mutating config directly

Design implication:

- the remediation surface should not be limited to a missing-search-only recovery path
- Uraniborg should support both:
  - recommended remediation from `doctor` when no provider is configured
  - an explicit user-driven path to add or change search providers later

Test scope:

- readiness test proving `web_search` produces the dedicated remediation kind
- remediation command test proving the dedicated kind maps to the web-search command path
- CLI prompt/launcher test proving `doctor` no longer launches generic `feynman setup` for web-search remediation

### Track B - Revision Setup UX Alignment

#### B1. Keep `init` but add a clearer revision-facing command surface

Goal:

- improve discoverability without breaking the required `init` flow

Approved direction:

- keep `init` supported for backward compatibility
- add a `revision` command with:
  - `revision --setup`
  - `revision --config`

Expected behavior:

- `revision --setup`
  - runs the same guided flow currently handled by `init`
- `revision --config`
  - shows the current Uraniborg revision configuration

Command-model implication:

- `init` is no longer the only discoverable entry point for revision configuration
- `revision` becomes the operator-facing command family for ongoing revision configuration work

Primary files:

- [src/cli/commands/init.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/init.ts)
- [src/cli/program.ts](/Users/shahmahdihasan/uraniborg/src/cli/program.ts)

Test scope:

- command-registration coverage if a new alias or sibling command is added
- guarantee both entry points hit the same underlying handler
- keep existing config-preservation behavior intact

#### B2. Replace operator-facing `refinement` copy with `revision`

Goal:

- replace `refinement` with `revision` across operator-facing CLI text while leaving internal names unchanged where possible

Required copy sweep scope:

- `init` command description
- `init` intro text
- `init` prompt labels
- `init` validation messages
- `run` guidance that tells the user to configure defaults
- config validation errors that currently say `refinement`
- `doctor` and `models` section headers and readiness summaries
- top-level CLI description and adjacent user-facing help text

Primary files:

- [src/cli/commands/init.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/init.ts)
- [src/cli/commands/run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts)
- [src/config/app-config.ts](/Users/shahmahdihasan/uraniborg/src/config/app-config.ts)
- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts)
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts)
- [src/cli/program.ts](/Users/shahmahdihasan/uraniborg/src/cli/program.ts)

Out of scope:

- internal module names under `src/refine/`
- config schema field names under `refine.*`
- run-state machine names such as `refinement`

Test scope:

- [tests/cli/init.test.ts](/Users/shahmahdihasan/uraniborg/tests/cli/init.test.ts)
- [tests/cli/doctor.test.ts](/Users/shahmahdihasan/uraniborg/tests/cli/doctor.test.ts)
- [tests/cli/models.test.ts](/Users/shahmahdihasan/uraniborg/tests/cli/models.test.ts)
- any focused config validation tests affected by wording changes

## Concrete File-Level Scope

Required change candidates:

- `src/cli/commands/shared.ts`
- `src/review/feynman-readiness.ts`
- `src/review/feynman-remediation.ts`
- `src/review/feynman-models.ts`
- `src/cli/commands/init.ts`
- `src/cli/program.ts`
- `src/cli/commands/run.ts`
- `src/config/app-config.ts`
- `src/cli/commands/doctor.ts`
- `src/cli/commands/models.ts`

Required test candidates:

- `tests/cli/doctor.test.ts`
- `tests/cli/init.test.ts`
- `tests/cli/models.test.ts`
- `tests/review/feynman-readiness.test.ts`
- `tests/review/feynman-models.test.ts`
- `tests/cli/run.test.ts` if shared remediation messaging is already asserted there

## Suggested Task Order

1. Open the new follow-up OpenSpec change and lock the scope.
2. Finalize the web-search remediation contract.
   - decide whether Uraniborg will gather provider and optional API key before launching `feynman search set`
   - if not, explicitly accept the weaker guidance-only fallback
3. Implement Track A first.
   - remediation success copy
   - distinct web-search remediation kind
   - dedicated web-search routing
   - tests
4. Re-run focused UAT for `doctor` remediation flows.
5. Implement Track B second.
   - add clearer revision-facing command surface while keeping `init`
   - sweep setup-oriented `revision` copy
   - tests
6. Re-run focused UAT for `init`, `doctor`, `models`, and run guidance output.

## Validation Plan

Minimum:

- `npm run test`
- `npm run typecheck`
- focused host-shell retest of:
  - `node dist/src/cli/main.js doctor`
  - `node dist/src/cli/main.js init`
  - `node dist/src/cli/main.js models`

Acceptance checks:

- successful remediation no longer prints raw `exit 0`
- web-search remediation no longer launches generic `feynman setup`
- `init` remains valid and backward compatible
- the new revision-facing entry point, if added, exercises the same config path
- user-facing setup copy says `revision` rather than `refinement` where intended

## Resolved Decisions

1. Uraniborg should collect a web-search provider and optional API key itself, then launch `feynman search set`.
2. Uraniborg should add a `revision` command family with `revision --setup` and `revision --config`.
3. `revision` wording should replace `refinement` across all operator-facing CLI text.
4. Low-level process metadata should move behind a future verbose mode rather than appearing in default remediation output.

## Remaining Design Detail

1. Which specific web-search providers should Uraniborg present in its prompt flow, and should that list be static or discovered elsewhere?
2. How should `doctor` expose the explicit "change or add web-search provider" flow when a provider is already configured and health checks pass?
3. Should `revision --config` redact secrets fully, partially, or show only non-secret endpoint/model state?
