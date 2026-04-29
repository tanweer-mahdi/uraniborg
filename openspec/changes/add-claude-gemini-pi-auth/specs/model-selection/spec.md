## MODIFIED Requirements

### Requirement: Refinement Model Visibility
The system SHALL expose the configured revision provider/profile and default revision model that Uraniborg can use for refinement requests, without exposing Pi-managed credential material, endpoint internals, or low-level provider bootstrap detail.

#### Scenario: Claude revision profile configured
- **WHEN** the user runs `uraniborg models` with a valid `Claude` revision configuration
- **THEN** the command displays the active Claude revision provider/profile and the configured default revision model

#### Scenario: Gemini revision profile configured
- **WHEN** the user runs `uraniborg models` with a valid `Gemini` revision configuration
- **THEN** the command displays the active Gemini revision provider/profile and the configured default revision model

#### Scenario: Browser-login-backed revision setup incomplete
- **WHEN** the user runs `uraniborg models` and the active Claude or Gemini revision profile is missing Pi-managed credential state or required provider context
- **THEN** the command reports that revision setup is incomplete instead of presenting a healthy active revision model configuration
