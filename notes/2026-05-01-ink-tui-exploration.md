# Ink TUI Exploration for Uraniborg

## Purpose

This note consolidates two parallel explorations:

1. what Ink currently provides as a terminal UI foundation
2. what it would take to replace Uraniborg's current Commander + Clack CLI shell with an Ink-based TUI

The goal is not to redesign Uraniborg's execution engine. The goal is to replace the current rudimentary command-oriented interaction layer with a proper terminal application while preserving the deterministic run/review/refine core.

## Immediate Conclusion

Ink is a viable fit for Uraniborg.

The codebase is already structured in a way that makes this migration feasible:

- the application core lives outside the CLI shell
- run orchestration is already explicit and file-backed
- config/auth/review/refine modules are largely UI-agnostic

The largest work item is not the Ink dependency itself. The largest work item is extracting the current command-and-prompt orchestration into a stateful presentation layer that Ink can render.

## Important Product / Spec Delta

Older Uraniborg docs explicitly treated React-style terminal frameworks as out of scope for v1:

- [URANIBORG_SPEC.md](/Users/shahmahdihasan/uraniborg/URANIBORG_SPEC.md:787)
- [2026-04-24-build-uraniborg-v1 design](/Users/shahmahdihasan/uraniborg/openspec/changes/archive/2026-04-24-build-uraniborg-v1/design.md:146)

That assumption is now obsolete for the next phase of the product. Ink should be treated as an intentional architecture shift, not as an incidental UI library swap.

## Ink Findings

### Core Model

Ink is a React renderer for terminal apps. It renders a React component tree into a Node.js process and owns terminal output, input, focus, and lifecycle.

What matters for Uraniborg:

- the app is long-lived while the Node event loop has work
- `render()` returns lifecycle controls like rerender, unmount, clear, and wait-for-exit/flush
- Ink is interactive by default, but has distinct non-interactive behavior when not attached to a TTY

### Layout and Rendering

Ink uses Yoga-backed flexbox layout. `Box` is the main layout primitive and `Text` is the main text primitive.

What matters for Uraniborg:

- layout composition is much stronger than the current line-by-line output model
- panels, sidebars, headers, footers, progress views, and drill-down screens become straightforward
- logs and append-only event streams can use `Static` rather than manual stdout writes

### Input and Focus

Ink provides:

- `useInput()` for key handling
- `useStdin()` for raw mode and lower-level input management
- `useFocus()` and `useFocusManager()` for tab/focus driven interfaces
- `useApp()` for exit and flush/lifecycle control

What matters for Uraniborg:

- model selection, remediation choices, navigation, cancellation, and artifact inspection can move from prompt-driven blocking flows into continuous screen interactions
- Uraniborg can support richer keybinds without manually wiring raw stdin handling everywhere

### Lifecycle and Output Control

Ink has explicit lifecycle APIs and supports writing terminal-safe output outside the main render tree when needed.

What matters for Uraniborg:

- long-running review/refine/resume sessions can be modeled as live screens rather than imperative transcripts
- external logs still need disciplined routing to avoid fighting the renderer

### Testing

Ink's standard testing story is render/frame based via `ink-testing-library`.

What matters for Uraniborg:

- existing pure-core tests should remain
- current transcript/assertion heavy CLI tests will need partial replacement with component/state tests
- the TUI shell should be tested as presentation, not as the source of business rules

### Accessibility and Runtime Constraints

Ink has basic screen-reader support, but not browser-level accessibility semantics.

Other practical constraints:

- interactive and non-interactive modes differ materially
- alternate screen mode is available but changes scrollback behavior
- raw mode support is terminal-dependent
- a proper Ink setup requires React and JSX/TSX in the Uraniborg toolchain

## Current Uraniborg CLI Findings

## What Is Already Good

The core architecture is stronger than the current CLI surface suggests.

These areas should be preserved:

- [src/loop/run-execution.ts](/Users/shahmahdihasan/uraniborg/src/loop/run-execution.ts)
- [src/run/manifest.ts](/Users/shahmahdihasan/uraniborg/src/run/manifest.ts)
- [src/config/app-config.ts](/Users/shahmahdihasan/uraniborg/src/config/app-config.ts)
- [src/config/revision-profiles.ts](/Users/shahmahdihasan/uraniborg/src/config/revision-profiles.ts)
- [src/config/revision-auth.ts](/Users/shahmahdihasan/uraniborg/src/config/revision-auth.ts)
- [src/refine/execution.ts](/Users/shahmahdihasan/uraniborg/src/refine/execution.ts)
- [src/refine/refinement.ts](/Users/shahmahdihasan/uraniborg/src/refine/refinement.ts)
- `src/review/*`
- `src/memory/*`

These modules already own the right responsibilities:

- deterministic run state transitions
- artifact creation and persistence
- configuration and auth resolution
- provider execution
- refinement parsing
- memory trail updates

This is the main reason an Ink migration is feasible without destabilizing the core product.

## What Is Too CLI-Centric Today

These modules are the main replacement targets:

- [src/cli/program.ts](/Users/shahmahdihasan/uraniborg/src/cli/program.ts)
- [src/cli/main.ts](/Users/shahmahdihasan/uraniborg/src/cli/main.ts)
- [src/ui/output.ts](/Users/shahmahdihasan/uraniborg/src/ui/output.ts)
- [src/cli/commands/run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts)
- [src/cli/commands/resume.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/resume.ts)
- [src/cli/commands/revision-setup.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/revision-setup.ts)
- [src/cli/commands/revision.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/revision.ts)
- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts)
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts)
- [src/cli/commands/history.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/history.ts)
- [src/cli/commands/shared.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/shared.ts)

These files currently mix:

- command parsing
- prompt orchestration
- textual rendering
- remediation interaction
- long-running execution narration

The biggest example is [run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts), which currently handles:

- preflight
- readiness reporting
- remediation prompting
- iteration count prompting
- review model selection
- revision model selection
- cancellation UX
- lifecycle launch

That is too much command-local interaction logic for a real TUI.

## Migration Scope

## Workstream 1: Shell Replacement

Replace the Commander-first shell with an Ink app host.

Likely result:

- Commander becomes a thin bootstrap or disappears entirely
- `uraniborg` launches the TUI shell by default
- optional compatibility subcommands can be retained temporarily if needed

Concrete tasks:

- add React + Ink + testing dependencies
- enable JSX/TSX in [tsconfig.json](/Users/shahmahdihasan/uraniborg/tsconfig.json)
- introduce a TUI entrypoint, likely under `src/tui/`
- decide whether `src/cli/main.ts` becomes a compatibility launcher or delegates immediately to Ink

## Workstream 2: Presentation Boundary

Uraniborg needs a structured presenter/event boundary instead of raw `writeLine()` calls.

Right now many flows emit strings directly:

- [src/loop/run-execution.ts](/Users/shahmahdihasan/uraniborg/src/loop/run-execution.ts)
- [src/cli/commands/run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts)
- [src/cli/commands/resume.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/resume.ts)
- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts)

That should evolve into structured UI events such as:

- `runtime_check_started`
- `runtime_check_passed`
- `revision_readiness_failed`
- `iteration_started`
- `review_started`
- `review_completed`
- `refine_started`
- `refine_failed`
- `artifact_available`
- `run_finished`

This is the most important architectural seam for the TUI.

Without it, the Ink app will just become a prettier wrapper around imperative string output.

## Workstream 3: Screen / Route Design

The TUI should not mirror one-off CLI commands mechanically. It should expose stable screens.

A sensible first map is:

- `DashboardScreen`
- `RunSetupScreen`
- `RunProgressScreen`
- `ResumeScreen`
- `RevisionSetupScreen`
- `RevisionConfigScreen`
- `DoctorScreen`
- `ModelsScreen`
- `HistoryScreen`
- `RunDetailScreen`

Shared primitives likely needed:

- `StatusHeader`
- `KeybindFooter`
- `LogStreamPane`
- `ProgressTimeline`
- `ArtifactList`
- `ModalPrompt`
- `ConfirmDialog`
- `SelectionList`

## Workstream 4: Long-Running Run UX

`run` and `resume` are the hard part.

These flows need:

- real-time phase updates
- cancellation that maps to the existing abort semantics
- error surfacing with log/artifact pointers
- completed artifact discovery
- a stable way to inspect the current iteration and historical iterations

The existing engine already emits deterministic artifacts and manifest transitions. That is good.

What is missing is a structured, in-process live state feed for the UI.

## Workstream 5: Revision Setup UX

The current setup flow uses Clack prompts and browser-login callbacks.

That interaction can map well to Ink, but it still needs careful design for:

- profile selection
- browser-login launch status
- callback/code-paste fallback prompts
- failure and retry flows
- final save confirmation

This area is bounded and is a good early migration target after read-only screens.

## Workstream 6: Test Migration

The current test architecture is mostly command-and-transcript oriented.

Examples:

- `tests/cli/*.test.ts`

A TUI migration should preserve pure-core tests and add:

- component render tests
- keyboard interaction tests
- route/screen transition tests
- presenter/event translation tests

The test strategy should become:

- core logic remains unit/integration tested without Ink
- TUI layer is tested as a renderer + interaction shell

## Recommended Migration Sequence

1. Add Ink/React/TSX infrastructure without changing behavior.
2. Introduce a dedicated `src/tui/` tree and a root `AppShell`.
3. Start with read-only screens:
   - `doctor`
   - `models`
   - `history`
4. Extract a presentation/event boundary from `run.ts` and `run-execution.ts`.
5. Build `revision --setup` as the first interactive stateful screen.
6. Build `run` setup and `run progress` screens.
7. Build `resume` and run detail/drill-down screens.
8. Decide whether to:
   - retire Commander entirely
   - or keep a thin compatibility shell for scripting and direct command invocation

## Main Risks

## 1. State Duplication

If Ink state and application state are both allowed to model the run lifecycle independently, the TUI will drift from the manifest-driven truth.

Rule:

- manifest + core runtime remain the source of truth
- Ink renders projected state and dispatches intent

## 2. Output Model Mismatch

The current system is line-output oriented.

Ink wants:

- state
- rerenders
- focus
- structured panes

If Uraniborg keeps emitting only strings, the TUI will remain shallow.

## 3. Non-Interactive Mode

Uraniborg still benefits from automation and direct invocation.

Questions that need explicit policy:

- should `uraniborg run ...` still work non-interactively as a classic CLI?
- should the TUI be default only for `uraniborg` with no args?
- should there be a dual mode, e.g. `uraniborg tui` and `uraniborg run`?

This is not just a technical detail. It is a product contract decision.

## 4. Terminal Capability Differences

Ink behavior differs depending on:

- TTY vs non-TTY
- raw mode support
- alternate screen usage
- screen reader mode

Uraniborg should not assume every environment supports a full-screen TUI equally well.

## 5. Test Churn

A meaningful share of the current CLI tests will need replacement rather than simple edits.

This is manageable, but it should be budgeted explicitly.

## Recommended Architecture Direction

The right target architecture is:

- `src/core/` behavior remains where it is today in `config/`, `loop/`, `review/`, `refine/`, `memory/`, and `run/`
- `src/tui/` becomes the interactive application shell
- `src/cli/` either:
  - shrinks to a bootstrap/compatibility layer
  - or becomes a narrow adapter into `src/tui/`

The key new seam should be a presenter/controller boundary with structured events and intents.

Examples of intent-level actions:

- `start_run`
- `resume_run`
- `retry_revision_setup`
- `launch_web_search_remediation`
- `select_review_model`
- `select_refine_model`
- `cancel_active_run`
- `open_artifact_view`

Examples of presentation state:

- runtime readiness
- revision readiness
- active route
- focused control
- active run summary
- active iteration state
- artifact availability
- remediation options

## Recommended Next Step

Before implementation, create a new OpenSpec change specifically for the TUI migration.

That change should answer these decisions explicitly:

1. Is Ink the default Uraniborg entry surface, or an alternate one?
2. Does Commander remain for scriptable subcommands?
3. What is the first TUI milestone:
   - read-only dashboard
   - setup + doctor + models
   - full run/resume execution
4. What structured event/presenter contract will replace `writeLine()`?
5. What is the policy for non-TTY environments?

## External References

- Ink repository: https://github.com/vadimdemedes/ink
- Ink README: https://github.com/vadimdemedes/ink/blob/master/readme.md

