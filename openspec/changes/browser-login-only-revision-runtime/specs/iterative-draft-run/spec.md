## MODIFIED Requirements

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the Pi-managed revision execution layer for the supported browser-login-backed providers.

#### Scenario: Supported browser-login-backed refinement step
- **WHEN** an iteration enters the refinement phase for `OpenAI/Codex`, `Claude`, or `Gemini`
- **THEN** the system executes refinement through the Pi-managed revision execution layer and writes the normal iteration artifacts on success

### Requirement: Revision Runtime Snapshot
The system SHALL snapshot the active supported browser-login-backed revision runtime identity for each run without recording manual-compatible endpoint/API-key runtime state.

#### Scenario: Run snapshot contains only supported managed runtime identity
- **WHEN** a run is created successfully
- **THEN** the run snapshot records the active supported revision profile, selected refine model, auth/acquisition mode, and any non-secret provider context
- **AND** it does not record legacy manual-compatible runtime fields
