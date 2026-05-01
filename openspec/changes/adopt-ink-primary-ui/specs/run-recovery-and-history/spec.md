## ADDED Requirements

### Requirement: Interactive History Workflow
The system SHALL expose prior local runs through an Ink-hosted history workflow in addition to any compatible non-interactive command output.

#### Scenario: History route lists local runs
- **WHEN** the user opens the history workflow from the Ink dashboard or via an interactive `uraniborg history` route entry
- **THEN** the system displays the available runs with their identifiers, timestamps, and current status in a persistent history screen

#### Scenario: Empty history route is explicit
- **WHEN** the user opens the history workflow and no prior runs exist
- **THEN** the system reports that no runs are available rather than rendering an ambiguous blank state

### Requirement: Interactive Run Detail And Resume Workflow
The system SHALL expose run inspection and resume entry through an Ink-hosted run-detail workflow while preserving manifest-driven recovery behavior.

#### Scenario: History selection opens run detail
- **WHEN** the user selects a run from the interactive history workflow
- **THEN** the system opens a run-detail workflow that shows the run status and relevant artifact context for that run

#### Scenario: Run detail shows summary and artifact index
- **WHEN** the user opens the interactive run-detail workflow for an existing run
- **THEN** the system shows the run summary, resumability state, top-level run artifacts, and per-iteration artifact index for that run

#### Scenario: Run detail is not a file explorer
- **WHEN** the user opens the interactive run-detail workflow
- **THEN** Uraniborg does not present the workflow as a general-purpose in-TUI file explorer for arbitrary run-directory traversal

#### Scenario: Resume route enters matching run detail
- **WHEN** the user launches an interactive `uraniborg resume <run-id>` route entry
- **THEN** the system opens the run-detail workflow for that run and exposes the relevant resume action when the run state is resumable
