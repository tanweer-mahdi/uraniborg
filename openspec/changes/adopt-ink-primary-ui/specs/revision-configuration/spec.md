## ADDED Requirements

### Requirement: Interactive Revision Configuration Screen
The system SHALL expose revision configuration state through an Ink-hosted workflow in addition to any compatible non-interactive command output.

#### Scenario: Revision config route shows active configuration state
- **WHEN** the user opens the `Config` workflow from the Ink dashboard or via an interactive `uraniborg revision --config` route entry
- **THEN** the system displays the active revision provider/profile, default revision model, and setup completeness state in operator-facing form

#### Scenario: Incomplete revision configuration offers setup action
- **WHEN** the interactive `Config` workflow determines that revision setup is incomplete
- **THEN** the system surfaces an action that enters the interactive revision setup workflow instead of treating the configuration as complete

### Requirement: Interactive Revision Setup Workflow
The system SHALL expose provider-aware revision setup through an Ink-hosted workflow while preserving the same provider/bootstrap/auth rules as the current revision contract.

#### Scenario: Dashboard and command entry share one setup workflow
- **WHEN** the user enters revision setup from the dashboard, `uraniborg init`, or an interactive `uraniborg revision --setup` route entry
- **THEN** the system uses the same Ink-hosted guided setup workflow for all of those entry points

#### Scenario: Browser-login handoff returns to setup workflow
- **WHEN** the interactive revision setup workflow launches a provider browser-login step and the external login flow exits
- **THEN** the system returns to the Ink-hosted setup workflow, refreshes the relevant provider state, and only completes setup after the required revision config is valid

#### Scenario: Cancelled browser-login handoff preserves setup context
- **WHEN** the user cancels a provider browser-login step launched from the interactive revision setup workflow
- **THEN** the system returns to the Ink-hosted setup workflow, preserves the existing setup context, and surfaces a non-fatal cancellation status

#### Scenario: Failed browser-login handoff preserves retry context
- **WHEN** a provider browser-login step launched from the interactive revision setup workflow fails or times out
- **THEN** the system returns to the Ink-hosted setup workflow, preserves the existing setup context, surfaces an inline failure state, and keeps the login action available for retry
