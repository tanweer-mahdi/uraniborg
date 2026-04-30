## MODIFIED Requirements

### Requirement: Refinement Model Visibility
The system SHALL expose the configured revision runtime identity and refinement model settings that Uraniborg can actually execute for the active revision profile.

#### Scenario: Managed profile revision visibility
- **WHEN** the user runs `uraniborg models` with a valid Pi-managed revision profile
- **THEN** the command displays the active revision profile and the configured default refine model without describing the runtime as merely an endpoint-plus-API-key configuration

#### Scenario: Manual-compatible revision visibility
- **WHEN** the user runs `uraniborg models` with a valid `manual-openai-compatible` revision profile
- **THEN** the command displays the configured compatible endpoint and default refine model information for that profile

## ADDED Requirements

### Requirement: Run-Time Revision Model Selection Eligibility
The system SHALL gate refine-model selection during run creation on executable revision runtime readiness for the active revision profile.

#### Scenario: Managed profile ready for refine selection
- **WHEN** the selected Pi-managed revision profile is runtime-ready
- **THEN** Uraniborg allows the user to confirm or choose the refine model for that profile during run creation

#### Scenario: Managed profile not executable
- **WHEN** the selected Pi-managed revision profile is setup-valid but not executable at runtime
- **THEN** Uraniborg blocks refine-model selection for the run and reports the revision runtime readiness failure before execution starts
