## MODIFIED Requirements

### Requirement: Pi-Managed Revision Credential Binding
The system SHALL keep supported revision credentials in Pi `AuthStorage` and SHALL persist only non-secret revision profile and provider-context data in Uraniborg-owned configuration.

#### Scenario: Unsupported non-Pi credential binding rejected
- **WHEN** Uraniborg loads a revision config with stored-secret, env-var, or ADC credential binding
- **THEN** it reports that the revision config is unsupported and directs the user to rerun setup

### Requirement: Browser-Auth Migration And Re-Setup
The system SHALL require rerun setup for any older revision contract that predates the supported browser-login-backed profiles.

#### Scenario: Older Claude or Gemini config rejected for runtime use
- **WHEN** Uraniborg reads an older Claude or Gemini revision config from before the supported browser-login contract
- **THEN** it reports that revision setup must be rerun and does not preserve the config as a supported runtime state
