## MODIFIED Requirements

### Requirement: Refinement Model Visibility
The system SHALL expose only the configured supported browser-login-backed revision profile and its executable refine model settings.

#### Scenario: Unsupported manual-compatible revision config not shown as current setup
- **WHEN** the user runs `uraniborg models` with a legacy manual-compatible or API-key-based revision config
- **THEN** the command reports that revision setup must be rerun instead of showing that config as a current executable runtime

### Requirement: Run-Time Revision Model Selection Eligibility
The system SHALL gate refine-model selection during run creation on executable Pi-managed runtime readiness for the supported revision profiles only.

#### Scenario: Unsupported legacy revision config blocks refine-model selection
- **WHEN** the local revision config is from an unsupported legacy contract
- **THEN** Uraniborg blocks refine-model selection and directs the user to rerun revision setup
