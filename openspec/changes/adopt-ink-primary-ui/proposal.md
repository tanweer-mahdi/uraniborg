## Why

Uraniborg's current command-and-prompt shell is sufficient for basic execution, but it is a weak fit for the actual product shape: a long-lived, stateful revision workflow centered on setup, readiness, run progress, resume, history, and artifact inspection. Now that the core review/revision/auth/runtime paths are in place, the next limiting factor is the interaction surface itself.

The project should adopt an Ink-based first-party TUI as the primary interactive UI so Uraniborg can preserve its existing high-level user journey while replacing linear prompt chains and transcript-style output with persistent application screens.

## What Changes

- Introduce an Ink-based primary terminal UI that becomes Uraniborg's default interactive surface.
- Add a Uraniborg-owned TUI shell capability that defines screen navigation, route entry, keybind-driven interaction, and non-destructive screen transitions.
- Present the primary dashboard in the ordered workflow sequence `Doctor`, `Models`, `Config`, `Run`, and `History` without development-only shell copy.
- Make interactive `uraniborg run <file>` enter an Ink-hosted Run Setup workflow with the file preselected and require an explicit start action before execution begins.
- Replace prompt-by-prompt interactive flows with screen/state-driven workflows for revision setup, doctor, models, history, run setup, run progress, run recovery, and artifact inspection.
- Standardize interactive readiness rendering across the TUI with the canonical states `ready`, `action-required`, `stale`, and `warning`.
- Define `--no-ui` as the explicit Ink bypass for automation, scripts, parallel experiment runs, and UI fallback/debugging, while preserving non-interactive execution for non-TTY and help/version contexts.
- Make external browser-login and Feynman remediation flows return to the originating Ink screen, refresh on success, and preserve context on cancellation or retryable failure.
- Define Run Detail as a summary plus artifact index workflow rather than a Uraniborg-owned in-TUI file explorer.
- Introduce a structured presenter/event boundary between the core execution engine and the TUI so run state, readiness state, and artifact availability are rendered from structured state instead of ad hoc terminal strings.
- Keep run failure classes semantically distinct in the TUI, including review failure, refinement execution failure, refinement output contract failure, and memory update failure.
- Preserve the existing high-level user journey and core business logic rather than redesigning the run engine, auth contract, or artifact model.
- **BREAKING**: Interactive use of `uraniborg` SHALL no longer be defined primarily by Commander/Clack prompt flows; the Ink TUI becomes the authoritative interactive UX.
- **BREAKING**: Operator-facing interactive journeys SHALL be specified in terms of TUI screens and transitions rather than command-local prompt sequences.

## Capabilities

### New Capabilities
- `terminal-ui-shell`: The primary Ink-based Uraniborg shell, including default interactive launch, screen routing, navigation, and presenter-driven rendering.

### Modified Capabilities
- `environment-setup`: Setup, doctor, and readiness journeys move from prompt/transcript-oriented interaction to Ink-driven screens while preserving the same operational checks and remediation intent, with configuration-oriented Feynman actions exposed through the `Config` workflow.
- `iterative-draft-run`: Run creation, progress reporting, failure surfacing, and artifact visibility move to an Ink-driven workflow while preserving deterministic run behavior.
- `model-selection`: Review-model and revision-model selection move from blocking prompts to TUI selection flows while preserving the same selection and gating rules.
- `revision-configuration`: Revision setup and revision config visibility move to TUI screens while preserving the same provider/auth/runtime contract, with revision provider configuration exposed through the broader `Config` workflow.
- `run-recovery-and-history`: Resume and history flows move to TUI navigation and detail views while preserving manifest-driven recovery and local run history semantics.

## Impact

- Affected code: `src/cli/*`, `src/ui/*`, run/resume presentation seams, and any core modules that currently emit direct terminal strings instead of structured events/state.
- New dependency surface: React, Ink, and Ink-oriented component testing.
- User-facing shell behavior: the primary interactive contract changes from command-local prompts to a persistent TUI with explicit UI bypass behavior for automation-oriented use cases.
- Specs: adds a new canonical terminal UI capability and modifies existing workflow capabilities to define the TUI-first journey.
