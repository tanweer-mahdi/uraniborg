## ADDED Requirements

### Requirement: Ink Is The Primary Interactive Surface
The system SHALL use a Uraniborg-owned Ink application as the default interactive UI surface instead of treating command-local prompts and transcript-style terminal output as the primary operator experience.

#### Scenario: Default interactive launch opens dashboard
- **WHEN** the user launches `uraniborg` in an interactive TTY without an explicit non-interactive execution request
- **THEN** the system opens the Uraniborg Ink dashboard as the primary interactive surface

#### Scenario: Interactive command intent opens matching route
- **WHEN** the user launches an interactive command intent such as `uraniborg run <file>`, `uraniborg revision --setup`, `uraniborg doctor`, `uraniborg models`, `uraniborg history`, or `uraniborg resume <run-id>`
- **THEN** the system opens the Ink application in the route or initial state that matches that workflow instead of running a separate prompt-local interactive program

#### Scenario: TTY-less invocation bypasses Ink
- **WHEN** stdin or stdout is not attached to an interactive TTY
- **THEN** the system bypasses the Ink shell and uses the compatible non-interactive execution path for that invocation

#### Scenario: Help and version bypass Ink
- **WHEN** the user requests `--help` or `--version`
- **THEN** the system returns the corresponding command-line output without launching the Ink shell

#### Scenario: Explicit UI bypass flag bypasses Ink
- **WHEN** the user passes `--no-ui`
- **THEN** the system bypasses the Ink shell even if the invocation is attached to an interactive TTY

### Requirement: TUI Workflow Navigation
The system SHALL provide stable workflow routes inside the Ink application for the primary Uraniborg operator journeys.

#### Scenario: Dashboard navigation exposes primary workflows
- **WHEN** the user opens the Ink dashboard
- **THEN** the system provides primary navigation in the order `Doctor`, `Models`, `Config`, `Run`, and `History`
- **AND** it does not render development-only shell copy as part of the finished dashboard surface

#### Scenario: Route transitions are non-destructive
- **WHEN** the user moves between TUI workflow routes before committing a destructive action or launching execution
- **THEN** the system preserves the surrounding application shell and navigates between routes without restarting the process

### Requirement: Canonical Interactive Readiness States
The system SHALL use one canonical readiness-state taxonomy across Ink-driven operator workflows that surface health, setup completeness, or launch eligibility.

#### Scenario: Readiness state taxonomy is shared
- **WHEN** Uraniborg renders interactive readiness-driven views such as doctor, models, revision config, or run setup
- **THEN** it classifies the visible state using only `ready`, `action-required`, `stale`, or `warning`

#### Scenario: Readiness state precedence is deterministic
- **WHEN** more than one readiness condition could apply to the same workflow state
- **THEN** Uraniborg resolves the rendered state using the precedence `stale`, then `action-required`, then `warning`, then `ready`

### Requirement: TUI Screen Context Persists During Long-Running Work
The system SHALL preserve route context while reflecting long-running workflow updates inside the Ink application.

#### Scenario: Run progress updates inside the active shell
- **WHEN** a run starts from the Ink application and iteration state changes over time
- **THEN** the active Ink shell remains in place and updates the visible run state without reducing progress visibility to detached terminal transcript lines

#### Scenario: External remediation returns to Uraniborg shell
- **WHEN** the user launches a Feynman-owned remediation flow from the Ink application and that remediation process exits
- **THEN** the system returns control to the Uraniborg Ink shell and refreshes the affected workflow state

#### Scenario: External remediation cancellation preserves screen context
- **WHEN** the user cancels an external browser-login or remediation flow that was launched from the Ink application
- **THEN** the system returns to the originating screen, preserves the existing workflow context, and surfaces a non-fatal cancellation status

#### Scenario: External remediation failure preserves retry context
- **WHEN** an external browser-login or remediation flow fails or times out after being launched from the Ink application
- **THEN** the system returns to the originating screen, preserves the workflow context, surfaces an inline failure state, and keeps the relevant retry action available
