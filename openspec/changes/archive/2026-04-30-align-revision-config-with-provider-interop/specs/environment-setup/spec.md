## MODIFIED Requirements

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, Uraniborg-owned revision configuration validity, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, embedded review runtime, review-side readiness, and provider-bootstrap-aware revision configuration readiness

#### Scenario: Pinned runtime not runnable
- **WHEN** the user runs `uraniborg doctor` and the pinned Feynman binary fails the version or runnability check
- **THEN** the command reports the review-runtime failure against the pinned runtime rather than silently falling back to another binary on `PATH`

#### Scenario: Missing revision provider configuration
- **WHEN** the user runs `uraniborg doctor` without an active provider-bootstrap-aware Uraniborg revision configuration
- **THEN** the command reports revision setup as incomplete without mutating Feynman-owned settings

#### Scenario: Missing managed revision credential state
- **WHEN** the user runs `uraniborg doctor` with a configured revision provider/profile and auth class but the required managed credential reference or secret binding cannot be resolved
- **THEN** the command reports the credential-resolution failure as a revision-readiness problem without invoking inference execution

#### Scenario: Missing required provider context
- **WHEN** the user runs `uraniborg doctor` with a revision profile whose auth/bootstrap contract requires account or project context metadata and that metadata is absent
- **THEN** the command reports the missing provider-context requirement as a revision-readiness problem

#### Scenario: Stale OpenAI/Codex preview config detected
- **WHEN** the user runs `uraniborg doctor` with a pre-correction `version: 2` OpenAI/Codex revision config that still uses the OpenAI Platform API or API-key auth
- **THEN** the command reports that revision setup must be rerun because the configured OpenAI/Codex provider contract is stale

#### Scenario: Recommended research capabilities missing
- **WHEN** the user runs `uraniborg doctor` and Feynman's AlphaXiv auth or web-search provider configuration is missing
- **THEN** the command reports those capabilities as recommended but non-blocking and explains that research/review coverage may be reduced

### Requirement: Guided Refinement Initialization
The system SHALL provide a guided revision-configuration flow through `uraniborg init` and `uraniborg revision --setup` that captures or updates Uraniborg-owned provider-bootstrap-aware revision defaults while leaving Feynman-owned configuration untouched.

#### Scenario: Initial revision setup through init
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration
- **THEN** the system asks for the provider-aware revision settings required by the selected revision provider/profile, including any guided auth/bootstrap steps, default revision model, and any permitted provider-scoped endpoint override before writing a valid Uraniborg config file

#### Scenario: Initial revision setup through revision command
- **WHEN** a user runs `uraniborg revision --setup` with no prior Uraniborg revision configuration
- **THEN** the system runs the same guided provider-aware setup flow and writes a valid Uraniborg config file

#### Scenario: OpenAI/Codex setup requires browser login
- **WHEN** a user selects `OpenAI/Codex` during guided revision setup
- **THEN** the system initiates Pi-backed browser login for that provider and does not offer an API-key prompt

#### Scenario: Pi auth storage is reused for browser-login-backed revision providers
- **WHEN** guided revision setup completes browser-login-backed auth for a Pi-backed revision provider
- **THEN** the system stores OAuth credential material in Pi `AuthStorage` rather than a separate Uraniborg-owned credential store

#### Scenario: Unsupported auth acquisition path not offered as runnable setup
- **WHEN** the selected revision provider/profile has auth-class combinations that Uraniborg cannot acquire through guided setup
- **THEN** the guided setup flow does not present those auth-class combinations as runnable setup options

#### Scenario: Updating revision defaults
- **WHEN** a user runs either `uraniborg init` or `uraniborg revision --setup` with an existing Uraniborg config
- **THEN** the system updates Uraniborg-owned revision settings while leaving Feynman-owned configuration untouched

#### Scenario: Guided setup rewrites older config into corrected provider-aware config
- **WHEN** a user runs the guided revision setup flow with a legacy `version: 1` or compatible pre-correction `version: 2` revision config already present
- **THEN** Uraniborg rewrites the config into the corrected current revision schema on successful completion

#### Scenario: Setup completion reflects operational reality
- **WHEN** the guided revision setup flow completes without collecting the information required to make revision runnable for the chosen provider/profile and auth/bootstrap contract
- **THEN** the system does not present revision setup as complete
