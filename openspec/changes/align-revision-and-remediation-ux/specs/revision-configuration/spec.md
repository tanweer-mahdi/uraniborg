## ADDED Requirements

### Requirement: Revision Command Family
The system SHALL provide a `revision` command family for viewing and updating Uraniborg-owned revision configuration without taking ownership of Feynman internals.

#### Scenario: Guided revision setup
- **WHEN** a user runs `uraniborg revision --setup`
- **THEN** the system launches the same guided revision-configuration flow that Uraniborg exposes through `uraniborg init`

#### Scenario: Revision configuration visible
- **WHEN** a user runs `uraniborg revision --config` and Uraniborg has a readable revision configuration
- **THEN** the system displays the current endpoint and default model settings in operator-facing form without exposing raw secret values

#### Scenario: Revision configuration missing
- **WHEN** a user runs `uraniborg revision --config` and Uraniborg does not yet have a valid revision configuration
- **THEN** the system reports that revision setup is incomplete and directs the user to `uraniborg revision --setup` or `uraniborg init`

### Requirement: Operator-Facing Revision Terminology
The system SHALL use `revision` terminology across operator-facing CLI text while leaving internal implementation naming unchanged where necessary.

#### Scenario: Setup flow uses revision language
- **WHEN** Uraniborg renders the guided setup flow for revision configuration
- **THEN** the intro text, prompt labels, validation messages, and completion messages use `revision` terminology rather than `refinement`

#### Scenario: Readiness and model surfaces use revision language
- **WHEN** Uraniborg renders operator-facing readiness, model, and configuration output
- **THEN** it refers to revision setup, revision defaults, and revision models rather than refinement setup, refinement defaults, or refinement models

#### Scenario: Run guidance uses revision language
- **WHEN** Uraniborg blocks or guides a run because revision configuration is missing or incomplete
- **THEN** the operator-facing guidance refers to revision setup and points to the supported revision configuration commands
