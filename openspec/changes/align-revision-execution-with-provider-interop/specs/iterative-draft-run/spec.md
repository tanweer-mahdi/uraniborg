## MODIFIED Requirements

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Successful managed refinement step
- **WHEN** an iteration enters the refinement phase for a Pi-managed revision profile and the revision execution layer returns output that matches the required parse contract
- **THEN** the system writes `iter-N/refined.md`, `iter-N/changes.md`, and `iter-N/refine.log`

#### Scenario: Successful manual-compatible refinement step
- **WHEN** an iteration enters the refinement phase for the `manual-openai-compatible` revision profile and the revision execution layer returns output that matches the required parse contract
- **THEN** the system writes `iter-N/refined.md`, `iter-N/changes.md`, and `iter-N/refine.log`

#### Scenario: Malformed refinement response
- **WHEN** the refinement execution layer returns output that omits either required section or produces empty parsed content
- **THEN** the system marks the run as failed for that phase instead of guessing how to recover the response

## ADDED Requirements

### Requirement: Revision Runtime Snapshot
The system SHALL snapshot the active revision runtime identity for each run in a way that distinguishes provider profile, auth path, and runtime context from legacy API-key-endpoint-only reporting.

#### Scenario: Managed profile run snapshot
- **WHEN** a run is created with a Pi-managed revision profile
- **THEN** the run snapshot records the active revision profile identity, auth/acquisition mode, selected refine model, and any non-secret required provider context without pretending that `apiKeyConfigured` is the runtime truth

#### Scenario: Manual-compatible run snapshot
- **WHEN** a run is created with the `manual-openai-compatible` revision profile
- **THEN** the run snapshot records the explicit endpoint override state and API-key-based runtime configuration for that profile
