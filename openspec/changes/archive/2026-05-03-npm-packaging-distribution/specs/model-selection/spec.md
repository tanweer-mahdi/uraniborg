## MODIFIED Requirements

### Requirement: Review Model Discovery
The system SHALL provide a `models` command that exposes the review models currently available through a compatible external Feynman installation using Feynman-owned model-discovery commands.

#### Scenario: Review models available
- **WHEN** the user runs `uraniborg models` and a compatible external Feynman installation can enumerate review models
- **THEN** the command displays the available review model options

#### Scenario: Review model discovery failure
- **WHEN** the user runs `uraniborg models` and review model discovery fails
- **THEN** the command reports the review-side error without fabricating model availability

#### Scenario: Compatibility-valid runtime can still have model-readiness failure
- **WHEN** Uraniborg can invoke and parse the Feynman model-discovery command successfully but the returned model state does not satisfy review readiness
- **THEN** Uraniborg reports a review-model readiness problem rather than a Feynman compatibility failure

### Requirement: Review Model Readiness Remediation
The system SHALL route missing review-model access through Feynman-owned remediation commands or explicit prerequisite guidance rather than inventing a Uraniborg-specific recovery path.

#### Scenario: Provider login or prerequisite install required for models
- **WHEN** Uraniborg cannot obtain the expected review model list because Feynman provider authentication or setup is incomplete, or because no compatible Feynman installation is available
- **THEN** Uraniborg instructs or launches the relevant Feynman setup, provider-login, or install/expose guidance
