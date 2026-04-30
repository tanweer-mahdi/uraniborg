## ADDED Requirements

### Requirement: App Home Bootstrap
The system SHALL prepare and validate a Uraniborg app home rooted at `~/.uraniborg/` that contains configuration, vendor runtime assets, and run storage paths before any command depends on them.

#### Scenario: First-time bootstrap
- **WHEN** a user runs a Uraniborg command on a machine without an existing `~/.uraniborg/` directory
- **THEN** the system creates the required application directories for config, vendor assets, and runs

#### Scenario: Existing app home reuse
- **WHEN** a user runs a Uraniborg command and `~/.uraniborg/` already exists
- **THEN** the system validates the required layout and reuses it without deleting prior runs

### Requirement: Pinned Feynman Runtime Provisioning
The system SHALL provision and invoke a pinned standalone Feynman runtime under `~/.uraniborg/vendor/feynman` and SHALL use that runtime for review-side commands instead of depending on a `PATH`-resolved global installation.

#### Scenario: First-time runtime provisioning
- **WHEN** a user runs a Uraniborg command and the pinned Feynman runtime is not yet present under `~/.uraniborg/vendor/feynman`
- **THEN** the system installs or prepares the pinned Feynman runtime before continuing with review-side operations

#### Scenario: Global version conflict
- **WHEN** a different `feynman` installation is also available on `PATH` with a version that differs from Uraniborg's pinned version
- **THEN** the system warns the user about the version conflict and continues using the pinned runtime

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, Uraniborg-owned revision configuration validity, revision runtime executability for the active profile, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, embedded review runtime, review-side readiness, and executable revision runtime state for the active profile

#### Scenario: Pinned runtime not runnable
- **WHEN** the user runs `uraniborg doctor` and the pinned Feynman binary fails the version or runnability check
- **THEN** the command reports the review-runtime failure against the pinned runtime rather than silently falling back to another binary on `PATH`

#### Scenario: Missing revision configuration
- **WHEN** the user runs `uraniborg doctor` without a valid Uraniborg revision configuration
- **THEN** the command reports the revision configuration failure without mutating Feynman-owned settings

#### Scenario: Missing managed revision credential state
- **WHEN** the user runs `uraniborg doctor` with a configured revision provider/profile and auth class but the required managed credential reference or secret binding cannot be resolved
- **THEN** the command reports the credential-resolution failure as a revision-readiness problem without invoking inference execution

#### Scenario: Missing required provider context
- **WHEN** the user runs `uraniborg doctor` with a revision profile whose auth/bootstrap contract requires account or project context metadata and that metadata is absent
- **THEN** the command reports the missing provider-context requirement as a revision-readiness problem

#### Scenario: Pi-managed Claude or Gemini login missing
- **WHEN** the active revision provider is `Claude` or `Gemini` and Pi-managed browser-login credential state is missing, unreadable, or stale
- **THEN** `doctor` reports the revision provider as not ready and instructs the user to rerun `uraniborg init` or `uraniborg revision --setup`

#### Scenario: Gemini project context missing
- **WHEN** the active revision provider is `Gemini` and Pi-managed auth exists but required `projectId` context is missing
- **THEN** `doctor` reports a revision provider-context failure rather than a generic healthy Gemini setup

#### Scenario: Stale OpenAI/Codex preview config detected
- **WHEN** the user runs `uraniborg doctor` with a pre-correction `version: 2` OpenAI/Codex revision config that still uses the OpenAI Platform API or API-key auth
- **THEN** the command reports that revision setup must be rerun because the configured OpenAI/Codex provider contract is stale

#### Scenario: Managed revision runtime not executable
- **WHEN** the user runs `uraniborg doctor` with a Pi-managed revision profile whose runtime credential state or required provider context is not executable
- **THEN** the command reports the revision runtime failure against the active profile without reducing the issue to generic endpoint or API-key messaging

#### Scenario: Manual-compatible runtime not executable
- **WHEN** the user runs `uraniborg doctor` with a `manual-openai-compatible` revision profile whose required endpoint configuration or API-key state is missing
- **THEN** the command reports the compatible runtime failure for that profile

#### Scenario: Recommended research capabilities missing
- **WHEN** the user runs `uraniborg doctor` and Feynman's AlphaXiv auth or web-search provider configuration is missing
- **THEN** the command reports those capabilities as recommended but non-blocking and explains that research/review coverage may be reduced

### Requirement: Review Auth Orchestration
The system SHALL use Feynman-owned setup and login commands to establish review readiness and SHALL NOT implement a separate Uraniborg-managed review auth flow.

#### Scenario: Review setup required
- **WHEN** Uraniborg detects that review-side setup or provider login is required before review commands can succeed
- **THEN** the system launches the appropriate Feynman-owned setup or login command rather than mutating Feynman configuration files directly

#### Scenario: Doctor surfaces rich Feynman diagnostics
- **WHEN** the user requests diagnostics for a review-side failure
- **THEN** Uraniborg surfaces Feynman doctor information for the user without relying on that output as its sole machine-readiness signal

### Requirement: Optional Feynman Capability Guidance
The system SHALL surface Feynman-owned AlphaXiv and web-search capability status as optional but recommended enhancements rather than as mandatory prerequisites for Uraniborg runs.

#### Scenario: AlphaXiv missing
- **WHEN** Uraniborg detects that Feynman AlphaXiv auth is not configured
- **THEN** Uraniborg warns that latest-paper and paper-metadata access may be weaker and offers to launch the Feynman-owned AlphaXiv login flow without blocking the run

#### Scenario: Web search configuration missing
- **WHEN** Uraniborg detects that Feynman web-search provider configuration is missing
- **THEN** Uraniborg warns that access to the latest web research may be weaker and offers to launch the Feynman-owned setup flow without blocking the run

### Requirement: Guided Revision Initialization
The system SHALL provide guided revision-configuration flows through `uraniborg init` and `uraniborg revision --setup` that capture or update Uraniborg-owned revision defaults and, when required by the selected provider, complete Pi-managed provider bootstrap before writing configuration.

#### Scenario: Initial revision setup through init
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration
- **THEN** the system asks for the provider-aware revision settings required by the selected revision provider/profile, including any guided auth/bootstrap steps, default revision model, and any permitted provider-scoped endpoint override before writing a valid Uraniborg config file

#### Scenario: Initial revision setup through revision command
- **WHEN** a user runs `uraniborg revision --setup` with no prior Uraniborg revision configuration
- **THEN** the system runs the same guided provider-aware setup flow and writes a valid Uraniborg config file

#### Scenario: OpenAI/Codex setup requires browser login
- **WHEN** a user selects `OpenAI/Codex` during guided revision setup
- **THEN** the system initiates Pi-backed browser login for that provider and does not offer an API-key prompt

#### Scenario: Initial Claude revision setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration and selects `Claude`
- **THEN** the system launches the Pi-managed `anthropic` browser-login flow and writes a valid Uraniborg config only after login and default-model selection succeed

#### Scenario: Initial Gemini revision setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration and selects `Gemini`
- **THEN** the system launches the Pi-managed `google-gemini-cli` browser-login flow, requires usable Gemini project context, and writes a valid Uraniborg config only after login, context validation, and default-model selection succeed

#### Scenario: Pi auth storage is reused for browser-login-backed revision providers
- **WHEN** guided revision setup completes browser-login-backed auth for a Pi-backed revision provider
- **THEN** the system stores OAuth credential material in Pi `AuthStorage` rather than a separate Uraniborg-owned credential store

#### Scenario: Browser login fails during initialization
- **WHEN** Pi-managed Claude or Gemini browser login is cancelled, fails state validation, or cannot produce the required provider context
- **THEN** the system leaves the prior Uraniborg revision configuration unchanged and does not write a partial new revision profile

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

### Requirement: Run Preflight Revision Runtime Check
The system SHALL perform a revision-runtime executability check before a run starts and SHALL block the run when the active revision profile is not executable.

#### Scenario: Managed profile preflight failure
- **WHEN** Uraniborg preflight detects that the selected Pi-managed revision profile is not executable for runtime use
- **THEN** Uraniborg blocks the run before iteration creation and reports the managed revision runtime remediation guidance

#### Scenario: Manual-compatible preflight failure
- **WHEN** Uraniborg preflight detects that the selected `manual-openai-compatible` revision profile is not executable because endpoint or API-key requirements are unresolved
- **THEN** Uraniborg blocks the run before iteration creation and reports the compatible runtime remediation guidance
