## ADDED Requirements

### Requirement: Interactive Environment Diagnostics Screen
The system SHALL expose environment readiness, review-side health, and revision-side readiness through an Ink-driven diagnostics workflow in addition to any compatible non-interactive command output.

#### Scenario: Doctor route shows grouped readiness state
- **WHEN** the user opens the doctor workflow from the Ink application or via an interactive `uraniborg doctor` route entry
- **THEN** the system displays required and recommended checks with their current status, summaries, and remediation affordances in a persistent diagnostics screen

#### Scenario: Doctor remediation refreshes readiness
- **WHEN** the user launches a remediation action from the interactive diagnostics workflow and control returns to Uraniborg
- **THEN** the doctor workflow refreshes the relevant readiness state instead of leaving the screen in a stale pre-remediation view

#### Scenario: Doctor remediation cancellation preserves context
- **WHEN** the user cancels a remediation action launched from the interactive diagnostics workflow
- **THEN** the doctor workflow preserves the current diagnostics context and surfaces a non-fatal cancellation status

#### Scenario: Doctor remediation failure preserves retry context
- **WHEN** a remediation action launched from the interactive diagnostics workflow fails or times out
- **THEN** the doctor workflow preserves the current diagnostics context, surfaces an inline failure state, and keeps the relevant remediation affordance available for retry

### Requirement: Interactive Setup Entry Points
The system SHALL expose the same revision-setup and readiness-remediation journeys through Ink-driven workflow entry points.

#### Scenario: Init route enters interactive revision setup
- **WHEN** the user launches `uraniborg init` in an interactive TTY
- **THEN** the system enters the Ink-hosted revision setup workflow rather than a separate prompt-chain experience

#### Scenario: Revision setup route remains operator-guided
- **WHEN** the user launches `uraniborg revision --setup` in an interactive TTY
- **THEN** the system enters the same Ink-hosted guided setup workflow that is available from the dashboard

### Requirement: Interactive Config Workflow Covers Feynman-Side Configuration
The system SHALL expose configuration-oriented Feynman capabilities through the Ink-hosted `Config` workflow in addition to the diagnostics-first `Doctor` workflow.

#### Scenario: Config route surfaces review runtime, AlphaXiv, and web search configuration
- **WHEN** the user opens the `Config` workflow from the Ink dashboard
- **THEN** the system displays configuration-oriented sections for review runtime/model readiness, AlphaXiv, and web search
- **AND** it allows the user to launch the relevant remediation or configuration action from that workflow when one is available
