## MODIFIED Requirements

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, revision runtime executability for the active Uraniborg revision profile, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, embedded review runtime, review-side readiness, and executable revision runtime state for the active profile

#### Scenario: Managed revision runtime not executable
- **WHEN** the user runs `uraniborg doctor` with a Pi-managed revision profile whose runtime credential state or required provider context is not executable
- **THEN** the command reports the revision runtime failure against the active profile without reducing the issue to generic endpoint or API-key messaging

#### Scenario: Manual-compatible runtime not executable
- **WHEN** the user runs `uraniborg doctor` with a `manual-openai-compatible` revision profile whose required endpoint configuration or API-key state is missing
- **THEN** the command reports the compatible runtime failure for that profile

## ADDED Requirements

### Requirement: Run Preflight Revision Runtime Check
The system SHALL perform a revision-runtime executability check before a run starts and SHALL block the run when the active revision profile is not executable.

#### Scenario: Managed profile preflight failure
- **WHEN** Uraniborg preflight detects that the selected Pi-managed revision profile is not executable for runtime use
- **THEN** Uraniborg blocks the run before iteration creation and reports the managed revision runtime remediation guidance

#### Scenario: Manual-compatible preflight failure
- **WHEN** Uraniborg preflight detects that the selected `manual-openai-compatible` revision profile is not executable because endpoint or API-key requirements are unresolved
- **THEN** Uraniborg blocks the run before iteration creation and reports the compatible runtime remediation guidance
