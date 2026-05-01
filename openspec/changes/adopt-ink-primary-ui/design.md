## Context

Uraniborg's core product behavior is now materially ahead of its interaction surface. The current shell is a Commander-driven CLI with Clack prompt chains and transcript-style output. That shell is workable for narrow command execution, but it is a poor fit for Uraniborg's real operator journey:

- bootstrap and inspect revision setup
- inspect environment readiness
- start a run
- observe live iteration progress
- inspect failure artifacts and remediation guidance
- resume interrupted runs
- inspect prior runs and their artifacts

The good news is that Uraniborg already has meaningful core-shell separation. The deterministic run engine, config/runtime/auth logic, review integration, and artifact model live outside the current CLI shell. That means the TUI migration should replace the shell, not rewrite the product core.

The user explicitly chose a full Ink approach rather than a hybrid Ink + Clack transition. This design therefore treats Ink as the primary interactive UI and treats the older prompt-by-prompt shell as a legacy surface to retire from the main journey.

## Goals / Non-Goals

**Goals:**

- Make an Ink-based TUI the primary interactive Uraniborg experience.
- Preserve the high-level existing user journey while replacing prompt chains with persistent screens.
- Keep the core run/review/revision/auth logic intact and move interaction concerns into a new presentation layer.
- Introduce a structured presenter/event boundary so the TUI renders from state and domain events instead of parsing raw terminal strings.
- Keep explicit, scriptable non-interactive execution paths for automation, testing, and direct invocation where interactive TTY behavior is not appropriate.

**Non-Goals:**

- Replacing the Feynman review runtime with a Uraniborg-owned chat runtime.
- Reintroducing Clack as a long-term interactive surface.
- Redesigning provider auth, revision runtime execution, manifest semantics, or artifact layouts.
- Changing the high-level run/review/refine workflow contract.
- Building a browser UI or daemonized background service.

## Decisions

### 1. Ink becomes the primary interactive shell

Uraniborg will adopt a Uraniborg-owned Ink app as the default interactive shell. In an interactive TTY, `uraniborg` without a subcommand will launch the Ink dashboard. Interactive invocations of existing command intents such as `run`, `revision --setup`, `doctor`, `models`, `history`, and `resume` will be treated as route-entry hints into the same Ink shell rather than separate prompt-driven programs.

This preserves the existing journey while making the TUI authoritative.

Alternatives considered:

- Keep Commander + Clack as the main surface and add Ink later.
  Rejected because it preserves the exact interaction model that is now limiting the product.
- Use a Feynman-style shell + Clack + upstream-owned runtime UI split.
  Rejected because Uraniborg does not have an upstream runtime that should own the main UI; Uraniborg itself is the application.

### 2. Full Ink approach, not hybrid prompting

All primary interactive workflows will be expressed as Ink screens and transitions, including setup and remediation journeys that are currently prompt-based. Clack is not part of the target architecture.

Non-interactive execution remains allowed, but that is not a hybrid interactive architecture. It is an automation path.

Alternatives considered:

- Keep Clack for setup and move only long-lived views to Ink.
  Rejected because it creates a dual interactive model that becomes harder to reason about and harder to clean up later.

### 3. Introduce a presenter-event boundary between core and shell

The current shell often renders direct strings such as run progress lines, warning lines, and setup messages. Ink needs structured state instead. Uraniborg will therefore introduce a presentation seam with two complementary outputs:

- structured domain events for lifecycle updates such as run start, iteration phase changes, remediation actions, and artifact availability
- route-specific view models that summarize the current state for screens such as dashboard, doctor, history, run setup, and run detail

The core says what happened. The TUI decides how to render it.

Alternatives considered:

- Keep `writeLine()`-style imperative output and wrap it in Ink.
  Rejected because that would create a prettier transcript, not a real application UI.
- Move rendering logic into the core modules.
  Rejected because it would break the existing core-shell separation.

### 4. Preserve the core execution engine and artifact contract

The run engine, manifest state machine, revision runtime execution, Feynman review integration, and artifact layout remain the source of truth. The TUI is a new shell over the existing core, not a new execution engine.

This keeps the migration bounded and reduces regression risk. Existing tests on pure logic and run semantics should continue to hold after the shell is replaced.

Alternatives considered:

- Redesign the run engine to fit a TUI-first structure.
  Rejected because the core already models deterministic state transitions well.

### 5. Route the old command family into TUI entry states, and keep explicit non-interactive execution

Commander may remain temporarily as a thin route parser and automation launcher. Its job will no longer be to host the interactive experience. Instead:

- interactive command invocations become deep links into TUI routes or initial state
- explicit non-interactive invocations continue to execute without trying to start Ink

This balances the new primary UX with scriptability and operational determinism.

Alternatives considered:

- Remove the command family immediately and require dashboard-only entry.
  Rejected because it would make migration needlessly abrupt and would discard a useful compatibility surface.
- Keep the command family as separate interactive programs.
  Rejected because that would preserve duplicated shell logic.

### 6. Model the TUI around durable workflow screens

The primary screens should map to stable product workflows rather than one-off command implementations. The initial route model is:

- Dashboard
- Doctor
- Models
- Config
- Revision Setup
- Run
- Run Progress
- History
- Run Detail / Resume

Run Progress and Run Detail are distinct because one is live execution state and the other is persistent artifact/history inspection.

The dashboard order is intentional and product-facing:

- Doctor
- Models
- Config
- Run
- History

`Config` is the umbrella route for configuration-oriented tasks. It surfaces:

- review runtime / review-model readiness and its launchable remediation
- AlphaXiv readiness and login/remediation
- web-search readiness and provider configuration
- revision provider/model visibility and entry into revision setup

### 7. Interactive `run <file>` always lands in Run Setup

When `uraniborg run <file>` is launched in an interactive TTY, Uraniborg will always enter the Ink-hosted Run Setup route with the file preselected and will require an explicit start action before execution begins.

This preserves one deterministic interactive launch path and gives the operator a clear checkpoint for readiness, iteration count, and model selection before any review/revision work starts.

Non-interactive execution remains direct and does not enter Ink.

Alternatives considered:

- Auto-start execution when all required selections are already resolvable.
  Rejected because it introduces surprising route-skipping behavior into a stateful TUI.

### 8. Feynman remediation remains external, but Uraniborg owns the orchestration screen

Feynman-owned setup/login/remediation commands remain the operational way to establish review readiness. Uraniborg should still launch them when needed, but the user should enter and return through Ink-owned screens. After an external remediation flow exits, the TUI refreshes readiness state and keeps the user inside the Uraniborg journey.

This borrows Feynman's seam discipline without borrowing its Pi-owned main TUI model.

The return contract is:

- success returns to the originating screen and refreshes the affected state in place
- cancellation returns to the originating screen, preserves user input, and surfaces a non-fatal cancelled status
- failure or timeout returns to the originating screen, preserves context, surfaces an inline retryable error state, and does not redirect the user to the dashboard

### 9. Use a canonical readiness-state taxonomy across the TUI

Interactive readiness-driven surfaces will share one canonical state taxonomy:

- `ready`
- `action-required`
- `stale`
- `warning`

State precedence is:

- `stale`
- `action-required`
- `warning`
- `ready`

This keeps `doctor`, `models`, `revision config`, and `run setup` aligned and preserves the important distinction between stale contract data and merely missing current setup.

### 10. Ink is the default interactive shell, but `--no-ui` is the explicit bypass

Ink launches only when Uraniborg is running in an interactive TTY and the operator has not explicitly requested non-interactive behavior.

Ink is bypassed when any of the following are true:

- stdin or stdout is not attached to an interactive TTY
- `--help` or `--version` is requested
- the command is running in a scripted or piped context where TUI rendering is inappropriate
- the operator passes `--non-interactive` for a workflow that supports it
- the operator passes `--no-ui`

`--no-ui` exists as the explicit escape hatch for automation, scripting, parallel experiment launches, and UI fallback/debugging.

### 11. Run Detail is a summary and artifact index, not a TUI file explorer

The Run Detail route will provide summary state and artifact indexing, not a Uraniborg-owned file explorer. This is not just a first-milestone limitation; it is the intended scope boundary for this TUI direction unless product requirements change later.

Required Run Detail content includes:

- run identity and status summary
- selected review and revision models
- iteration progress summary
- resumability status and resume action when applicable
- top-level run artifact index
- per-iteration artifact index

It does not include a full in-TUI browser for arbitrary file traversal or deep file-viewing workflows.

### 12. Run failures must remain semantically distinct in the TUI

The TUI must render at least these failure classes distinctly:

- review failure
- refinement execution failure
- refinement output contract failure
- memory update failure

Each class must preserve the appropriate diagnostic pointer rather than collapsing all terminal failures into one generic “run failed” state.

## Risks / Trade-offs

- [Large shell refactor] -> Mitigation: preserve the core modules and introduce the presentation seam incrementally around existing orchestration functions.
- [Event/view-model boundary drifts into a second business layer] -> Mitigation: keep events descriptive and route-local, and keep durable rules in the existing core modules.
- [Interactive TTY handling differs across terminals] -> Mitigation: keep a clear non-interactive bypass path and test TTY/non-TTY behavior explicitly.
- [Commander compatibility becomes a second-class fork of the UI] -> Mitigation: restrict Commander to route selection and non-interactive automation rather than letting it keep bespoke interactive logic.
- [TUI state and long-running execution become hard to test] -> Mitigation: keep the run engine pure and test the Ink layer through component/view-model tests plus a small integration layer.
- [Review-side external remediation flows can disrupt Ink rendering] -> Mitigation: treat remediation launch as a controlled escape hatch, suspend the relevant screen state, then refresh on return.

## Migration Plan

1. Add the new TUI shell capability and define the route/screen contract in specs.
2. Introduce the presenter/event boundary and move direct shell output behind it.
3. Build the Ink app shell and dashboard-level navigation.
4. Move revision setup/config, doctor, models, history, and run setup into Ink screens.
5. Move live run/resume progress into Ink using the structured execution seam.
6. Retire Clack-driven interactive flows and reduce Commander to route/bootstrap and explicit non-interactive execution.

Rollback strategy:

- because the core execution engine remains intact, the project can temporarily re-enable the old Commander/Clack shell while the Ink shell stabilizes
- the migration should therefore land in shell-focused increments rather than mixed core-shell rewrites

## Open Questions

- Should alternate-screen mode be used for the main app, or should Uraniborg prefer standard scrollback-preserving rendering in the first milestone?
