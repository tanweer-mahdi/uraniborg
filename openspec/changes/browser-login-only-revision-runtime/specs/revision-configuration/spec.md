## MODIFIED Requirements

### Requirement: Provider-Bootstrap-Aware Revision Configuration
The system SHALL persist Uraniborg-owned revision defaults only for the supported browser-login-backed provider profiles and SHALL treat provider identity plus Pi-managed credential binding as the revision contract.

#### Scenario: Revision config stores only supported browser-login profiles
- **WHEN** Uraniborg writes a revision configuration
- **THEN** the stored profile is one of `openai-codex-chatgpt`, `claude-browser`, or `gemini-cloud-code-assist`

#### Scenario: Revision config does not store arbitrary endpoint identity
- **WHEN** Uraniborg writes or displays revision configuration
- **THEN** it does not model custom revision endpoint selection as part of the supported contract

### Requirement: Unsupported Legacy Revision Config Rejection
The system SHALL reject unsupported older revision config contracts instead of passively normalizing them into the current runtime.

#### Scenario: Version 1 endpoint config rejected
- **WHEN** Uraniborg loads an older endpoint-centric `version: 1` revision config
- **THEN** it reports that revision setup must be rerun and does not normalize the config into current supported runtime state

#### Scenario: Version 2 preview config rejected
- **WHEN** Uraniborg loads a preview-era `version: 2` revision config
- **THEN** it reports that revision setup must be rerun and does not treat the preview contract as supported current config

#### Scenario: Deprecated revision profile id rejected
- **WHEN** Uraniborg loads a stored revision config containing deprecated profile ids such as `claude-api`, `gemini-direct`, or `manual-openai-compatible`
- **THEN** it reports that revision setup must be rerun instead of passively remapping the profile
