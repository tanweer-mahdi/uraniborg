## MODIFIED Requirements

### Requirement: Provider-Independent Refinement Resume
The system SHALL resume interrupted refinement from local manifest state and Uraniborg-owned artifacts only for the supported Pi-managed browser-login-backed revision providers.

#### Scenario: Legacy manual-compatible runtime state not resumable as supported contract
- **WHEN** Uraniborg encounters a run whose revision config reflects an unsupported manual-compatible or legacy endpoint contract
- **THEN** it reports that revision setup must be rerun instead of treating that contract as a supported resumable runtime
