# TUI Architecture Comparison for Uraniborg

## Purpose

This note compares two architecture directions for Uraniborg's future terminal UI:

1. an Ink-based first-party TUI, as explored in [2026-05-01-ink-tui-exploration.md](/Users/shahmahdihasan/uraniborg/notes/2026-05-01-ink-tui-exploration.md)
2. a Feynman-style shell + Clack + Pi-runtime pattern, as documented in [feynman-pi-clack-architecture.md](/Users/shahmahdihasan/uraniborg/notes/feynman-pi-clack-architecture.md)

This document starts by defining two terms that are central to the trade-off:

- `core-shell separation`
- `presenter-event boundary`

Those two concepts are the key to understanding why the two approaches are not interchangeable, even though both are “terminal UX” strategies.

## Definitions

## 1. Core-Shell Separation

`Core-shell separation` means splitting the application into:

- a `core`, which owns the real business logic and durable state transitions
- a `shell`, which owns user interaction, launch mechanics, and presentation

The shell asks questions, renders state, and turns user intent into calls into the core.

The core:

- should not depend on terminal widgets
- should not depend on prompt libraries
- should not depend on how the UI is rendered
- should remain valid whether the app is invoked from:
  - a CLI
  - a TUI
  - a test harness
  - another programmatic surface later

### Why Uraniborg already has this

Uraniborg already exhibits this pattern reasonably well.

The current `core` is largely here:

- [src/loop/run-execution.ts](/Users/shahmahdihasan/uraniborg/src/loop/run-execution.ts)
- [src/run/manifest.ts](/Users/shahmahdihasan/uraniborg/src/run/manifest.ts)
- [src/config/app-config.ts](/Users/shahmahdihasan/uraniborg/src/config/app-config.ts)
- [src/config/revision-auth.ts](/Users/shahmahdihasan/uraniborg/src/config/revision-auth.ts)
- [src/refine/execution.ts](/Users/shahmahdihasan/uraniborg/src/refine/execution.ts)
- [src/refine/refinement.ts](/Users/shahmahdihasan/uraniborg/src/refine/refinement.ts)
- `src/review/*`
- `src/memory/*`

These modules own:

- run creation
- manifest transitions
- iteration execution
- review/refine integration
- artifact persistence
- config parsing and readiness
- provider auth/runtime resolution

The current `shell` is largely here:

- [src/cli/program.ts](/Users/shahmahdihasan/uraniborg/src/cli/program.ts)
- [src/cli/commands/run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts)
- [src/cli/commands/revision-setup.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/revision-setup.ts)
- [src/cli/commands/doctor.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/doctor.ts)
- [src/cli/commands/models.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/models.ts)
- [src/ui/output.ts](/Users/shahmahdihasan/uraniborg/src/ui/output.ts)

Those files currently own:

- command parsing
- prompt orchestration
- text output
- remediation interaction
- translation of user input into core execution

### Why this matters for TUI design

Because Uraniborg already has meaningful core-shell separation, it does not need to rebuild its run engine in order to gain a TUI.

That is a major advantage.

It means the TUI effort should focus on:

- replacing the shell
- not rewriting the core

This is one of the strongest arguments in favor of Ink for Uraniborg.

## 2. Presenter-Event Boundary

`Presenter-event boundary` is the seam between:

- the core producing meaningful state transitions or execution events
- the UI deciding how those events should be rendered or reacted to

In plain terms:

- the core should say `what happened`
- the UI should decide `how to show it`

### Current Uraniborg state

Right now Uraniborg often collapses those two things into plain text:

- the core or near-core path emits strings like:
  - `Starting run: ...`
  - `Iteration 1/2: review`
  - `Run complete.`
- the shell prints them via `writeLine()` / `writeInfo()`

Relevant files:

- [src/loop/run-execution.ts](/Users/shahmahdihasan/uraniborg/src/loop/run-execution.ts)
- [src/cli/commands/run.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/run.ts)
- [src/cli/commands/resume.ts](/Users/shahmahdihasan/uraniborg/src/cli/commands/resume.ts)
- [src/ui/output.ts](/Users/shahmahdihasan/uraniborg/src/ui/output.ts)

That is workable for a plain CLI, but weak for a real TUI.

### What it should become

Instead of the core emitting pre-rendered strings, it should emit structured events or state updates, for example:

- `run_started`
- `iteration_started`
- `phase_changed`
- `review_completed`
- `refine_failed`
- `artifact_written`
- `run_finished`

Each event would include structured data, for example:

- run id
- iteration number
- phase name
- manifest status
- artifact paths
- error details

Then the Ink layer can decide how to present that:

- timeline row
- progress pane
- status badge
- log line
- modal
- artifact drawer

### Why this is specifically important for Ink

Ink is not a line printer. It is a stateful renderer.

Ink works best when the UI can maintain view state such as:

- selected pane
- focused control
- active route
- current run summary
- visible logs
- expanded error details

That means the UI needs structured state, not just terminal strings.

So a presenter-event boundary is the thing that converts Uraniborg from:

- “print messages to a terminal”

into:

- “maintain application state and render terminal screens”

### Simple mental model

Bad boundary:

- core says: `Iteration 2/3: refine`
- UI can only print that line

Good boundary:

- core says:
  - event type: `phase_started`
  - run id: `...`
  - iteration: `2`
  - phase: `refine`
  - timestamp: `...`
- Ink can render:
  - progress bar
  - timeline marker
  - header badge
  - side panel update
  - or a textual transcript if desired

That is the difference.

## The Two Architecture Directions

## Option A: Ink-Based Uraniborg-Owned TUI

This is the direction described in [2026-05-01-ink-tui-exploration.md](/Users/shahmahdihasan/uraniborg/notes/2026-05-01-ink-tui-exploration.md).

### Shape

- Uraniborg owns the long-lived UI directly
- Ink is the renderer
- Uraniborg core remains in place
- Commander becomes either:
  - a thin bootstrap layer
  - or an optional compatibility shell

Likely new structure:

- `src/core/` in spirit, though current modules can remain where they are
- `src/tui/` for screens, components, navigation, and state wiring
- `src/cli/` shrunk to launch/compatibility responsibilities

### Strengths

- Best fit for Uraniborg's actual workflow-oriented product
- Uraniborg can design purpose-built screens:
  - dashboard
  - run setup
  - run progress
  - history
  - doctor
  - models
  - revision setup/config
  - artifact inspection
- No dependency on a foreign runtime owning the main UI
- Stronger control over:
  - layout
  - screen transitions
  - progress presentation
  - domain-specific navigation
  - artifact-centric workflows
- Aligns naturally with Uraniborg's file-backed, deterministic run model

### Weaknesses

- Higher implementation cost up front
- Requires React/Ink/TSX adoption
- Requires a new testing layer for component/screen behavior
- Forces Uraniborg to design its own TUI conventions instead of borrowing an upstream one
- Requires a real presenter-event boundary, not just nicer printing

### Best use case

Use this when the product itself is the application and needs its own durable workflow screens.

That is exactly Uraniborg's situation.

## Option B: Feynman-Style Shell + Clack + Pi-Owned TUI

This is the direction described in [feynman-pi-clack-architecture.md](/Users/shahmahdihasan/uraniborg/notes/feynman-pi-clack-architecture.md).

### Shape

- shell owns setup, routing, diagnostics, launch, env wiring
- Clack owns bounded setup/login/config prompts
- Pi child process owns the persistent interactive TUI

In Feynman, this works because the main UI already exists upstream in Pi.

### Strengths

- Clean separation between:
  - shell/bootstrap
  - bounded prompts
  - persistent runtime UI
- Great pattern when the main interactive experience is already implemented elsewhere
- Lets the host app avoid building its own persistent TUI
- Good for:
  - auth setup
  - model/provider selection
  - environment prep
  - doctor/status flows
- Preserves a strong process boundary

### Weaknesses

- Much less suitable when your application itself needs a bespoke persistent UI
- Depends on the child runtime already having the UI you want
- In Feynman, this comes with meaningful complexity:
  - patching embedded runtime files
  - branding patches
  - path/config-dir rewrites
  - env ABI maintenance
  - wrapper lifecycle maintenance
- Harder to shape the live UI around domain-specific workflows unless the embedded runtime already supports them
- If adopted literally, Uraniborg would end up building a shell around someone else's TUI instead of owning its own workflow application

### Best use case

Use this when your product is primarily:

- a launcher
- an orchestrator
- a branded host around an existing interactive runtime

That matches Feynman much better than Uraniborg.

## Direct Comparison for Uraniborg

## 1. Product Fit

`Ink`
- Strong fit
- Uraniborg needs application screens for runs, manifests, artifacts, provider readiness, and resume flows

`Pi-Clack`
- Weak-to-moderate fit
- Good as a pattern for setup boundaries
- Poor as the main UI ownership model

Why:

Uraniborg is not a general-purpose interactive assistant shell. It is a deterministic workflow tool with domain-specific state.

## 2. Reuse of Current Architecture

`Ink`
- Reuses Uraniborg's existing core-shell separation very well
- The core can mostly stay intact

`Pi-Clack`
- Reuses only part of the architecture
- The shell/setup ideas are useful
- But the main runtime-ownership model does not map well because Uraniborg does not already have a Pi-like upstream TUI to delegate to

## 3. Complexity Profile

`Ink`
- Higher UI implementation cost
- Lower “foreign runtime maintenance” cost

`Pi-Clack`
- Lower cost only if the persistent UI already exists upstream
- Higher integration/patching cost when adapting someone else's runtime

For Uraniborg specifically, the Pi-Clack style would likely create unnecessary indirection without actually saving the main UI work.

## 4. Control Over UX

`Ink`
- Very high
- Uraniborg can shape the exact experience around:
  - iteration progress
  - artifact drill-down
  - resume recovery
  - readiness diagnostics

`Pi-Clack`
- Lower
- The main UI is constrained by the embedded runtime's capabilities and assumptions

## 5. Testing Implications

`Ink`
- Requires component/screen testing
- But core tests remain valid

`Pi-Clack`
- Requires shell/runtime seam testing
- Often also requires testing patches and launch ABI behavior

For Uraniborg, Ink testing is more directly aligned with the product itself.

## What Uraniborg Should Borrow from Feynman

The right lesson from Feynman is not “copy the architecture wholesale.”

The right lessons are:

- keep bounded setup flows separate from the long-lived UI
- keep state ownership explicit
- keep the launcher thin
- keep the runtime contract explicit
- do not mix environment/bootstrap logic into the persistent UI

Those are good architecture habits and should be reused.

## What Uraniborg Should Not Copy from Feynman

Uraniborg should not copy:

- the child-process-owned main TUI model
- the embedded-runtime patching pattern as the primary UX strategy
- the idea that the app shell is mostly there to launch another interactive runtime

That would solve Feynman's problem, not Uraniborg's.

## Recommendation

My recommendation for Uraniborg is:

1. `Choose Ink as the primary long-lived TUI architecture.`
2. `Keep the current core modules and strengthen core-shell separation instead of rewriting the execution engine.`
3. `Introduce a presenter-event boundary before or alongside the TUI work.`
4. `Borrow Feynman's bounded-prompt discipline, but not Feynman's Pi-owned runtime model.`
5. `Keep Commander only as a thin compatibility/bootstrap surface at first, if needed.`
6. `Treat Clack as optional transitional infrastructure, not as the long-term main UI strategy.`

## Why this recommendation is stronger

This recommendation matches all three realities:

- Uraniborg already has a separable execution core
- Uraniborg needs domain-specific screens
- Uraniborg does not have an upstream runtime TUI that already solves its product UI problem

So the best architecture is:

- Uraniborg-owned core
- Uraniborg-owned Ink TUI
- thin launch/bootstrap shell
- explicit presenter-event seam

## Practical Next Step

The next step should be a dedicated OpenSpec change that decides:

1. whether Ink becomes the default `uraniborg` experience
2. whether Commander remains as compatibility-only
3. whether Clack remains temporarily for setup flows
4. the first presenter-event contract
5. the first milestone:
   - read-only dashboard
   - setup + doctor + models
   - or full run/resume progress UI

## Final Short Form

If the question is:

- `Which architecture is more aligned with Uraniborg's actual product?`

The answer is:

- `Ink`

If the question is:

- `What should Uraniborg still learn from Feynman?`

The answer is:

- `bounded setup prompts, thin shell discipline, and explicit state/runtime seams`

If the question is:

- `Should Uraniborg make Pi the owner of its main UI in the way Feynman does?`

The answer is:

- `No`
