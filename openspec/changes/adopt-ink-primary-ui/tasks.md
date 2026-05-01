## 1. TUI Foundation

- [x] 1.1 Add React, Ink, and Ink testing dependencies and update the TypeScript/tooling configuration for TSX-based terminal rendering
- [x] 1.2 Introduce a thin interactive bootstrap that can launch the Ink shell without yet migrating any command-specific workflows
- [x] 1.3 Define the shared route model, command-intent entry model, and presenter/event contracts that separate core lifecycle state from terminal rendering concerns
- [x] 1.4 Define the canonical interactive readiness-state taxonomy (`ready`, `action-required`, `stale`, `warning`) and shared precedence rules for TUI surfaces
- [x] 1.5 Define the explicit UI-bypass contract, including `--no-ui`, TTY detection, and help/version bypass behavior

## 2. Shell, Navigation, And External Flow Return

- [x] 2.1 Implement the Ink app shell, shared layout primitives, and navigation state
- [x] 2.2 Implement the dashboard route and its primary workflow entry points
- [x] 2.3 Implement interactive CLI command-intent deep links into TUI routes while preserving explicit non-interactive bypass behavior
- [x] 2.4 Implement keybind, focus, and non-destructive route-transition behavior for the primary shell
- [x] 2.5 Implement the shared external-flow return controller for browser-login and Feynman remediation flows, including success refresh, cancellation preservation, and retryable failure states

## 3. Setup, Diagnostics, And Visibility Workflows

- [x] 3.1 Implement the Config route with Feynman-side configuration sections, revision provider visibility, setup completeness rendering, and setup-entry action
- [x] 3.2 Implement the revision setup route, including browser-login launch, return handling, and preserved user context on cancel/failure
- [x] 3.3 Implement the doctor route with grouped required/recommended checks, remediation affordances, and refreshed post-remediation state
- [x] 3.4 Implement the models route with review-model visibility, revision-model visibility, and incomplete/stale setup guidance

## 4. History, Run Detail, And Resume Workflows

- [x] 4.1 Implement the history route with populated and empty-state rendering
- [x] 4.2 Implement the run-detail route with run summary, resumability state, top-level run artifact index, and per-iteration artifact index
- [x] 4.3 Implement the resume entry flow so interactive `resume <run-id>` lands in run detail with the correct resume affordance

## 5. Run Setup And Live Run Progress

- [x] 5.1 Refactor run and resume orchestration to publish structured lifecycle updates that the TUI can render without parsing terminal strings
- [x] 5.2 Implement the Ink run-setup route with preselected source-file support for interactive `run <file>` entry
- [x] 5.3 Implement iteration-count and model-selection controls inside run setup
- [x] 5.4 Implement run-setup gating for required readiness failures and recommended warnings
- [x] 5.5 Require an explicit launch action from run setup even when all required selections are already resolvable
- [x] 5.6 Implement the run-progress route with live run id, iteration, phase, and status updates
- [x] 5.7 Implement distinct run-progress failure states for review failure, refinement execution failure, refinement output contract failure, and memory update failure
- [x] 5.8 Surface the correct artifact/log pointers from each run-progress failure state and surface final artifact location on successful completion

## 6. Compatibility Cleanup, Validation, And Documentation

- [x] 6.1 Remove Clack-driven primary interactive flows and reduce Commander to route/bootstrap and explicit non-interactive execution responsibilities
- [x] 6.2 Add tests for interactive bootstrap, TTY and `--no-ui` bypass behavior, and route-entry deep links
- [x] 6.3 Add tests for revision setup return handling, doctor remediation refresh, and models/revision-config readiness rendering
- [x] 6.4 Add tests for history empty state, run-detail artifact indexing, resume entry, and explicit run-setup launch behavior
- [x] 6.5 Add tests for run-progress live rendering and distinct failure-state presentation while preserving existing core behavior tests
- [x] 6.6 Update operator-facing help and project notes to reflect Ink as the primary interactive Uraniborg UI
