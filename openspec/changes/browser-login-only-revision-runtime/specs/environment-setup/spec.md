## MODIFIED Requirements

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, Uraniborg-owned revision configuration validity, revision runtime executability for the active browser-login-backed revision profile, and filesystem readiness.

#### Scenario: Unsupported legacy revision config
- **WHEN** the user runs `uraniborg doctor` with a revision config from a no-longer-supported legacy contract
- **THEN** the command reports that revision setup must be rerun instead of treating the config as passively normalizable

#### Scenario: Manual-compatible runtime not supported
- **WHEN** the local Uraniborg config references a manual-compatible or API-key-based revision runtime
- **THEN** `doctor` reports that the configured revision contract is unsupported and directs the user to rerun `uraniborg revision --setup`

### Requirement: Guided Revision Initialization
The system SHALL provide guided revision-configuration flows through `uraniborg init` and `uraniborg revision --setup` that capture or update Uraniborg-owned revision defaults and complete Pi-managed browser login for the supported revision providers.

#### Scenario: Revision setup offers only supported browser-login profiles
- **WHEN** a user starts guided revision setup
- **THEN** the flow offers only the supported browser-login-backed revision provider profiles for `OpenAI/Codex`, `Claude`, and `Gemini`

#### Scenario: Guided setup does not offer API-key or endpoint configuration
- **WHEN** a user runs guided revision setup
- **THEN** the flow does not prompt for API keys, API-key environment variables, ADC, or custom revision endpoints

#### Scenario: Unsupported existing revision config is replaced through rerun setup
- **WHEN** a user reruns guided revision setup while an unsupported older revision config is present
- **THEN** Uraniborg writes the current supported revision contract on successful completion instead of preserving the unsupported contract
