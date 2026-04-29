## MODIFIED Requirements

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, Uraniborg-owned revision configuration validity, Pi-managed revision credential state, required revision provider context, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, embedded review runtime, review-side readiness, and revision configuration including Pi-managed revision provider readiness

#### Scenario: Pinned runtime not runnable
- **WHEN** the user runs `uraniborg doctor` and the pinned Feynman binary fails the version or runnability check
- **THEN** the command reports the review-runtime failure against the pinned runtime rather than silently falling back to another binary on `PATH`

#### Scenario: Missing revision configuration
- **WHEN** the user runs `uraniborg doctor` without a valid Uraniborg revision configuration
- **THEN** the command reports the revision configuration failure without mutating Feynman-owned settings

#### Scenario: Pi-managed Claude or Gemini login missing
- **WHEN** the active revision provider is `Claude` or `Gemini` and Pi-managed browser-login credential state is missing, unreadable, or stale
- **THEN** `doctor` reports the revision provider as not ready and instructs the user to rerun `uraniborg init` or `uraniborg revision --setup`

#### Scenario: Gemini project context missing
- **WHEN** the active revision provider is `Gemini` and Pi-managed auth exists but required `projectId` context is missing
- **THEN** `doctor` reports a revision provider-context failure rather than a generic healthy Gemini setup

#### Scenario: Recommended research capabilities missing
- **WHEN** the user runs `uraniborg doctor` and Feynman's AlphaXiv auth or web-search provider configuration is missing
- **THEN** the command reports those capabilities as recommended but non-blocking and explains that research/review coverage may be reduced

### Requirement: Guided Refinement Initialization
The system SHALL provide an `init` flow that captures or updates Uraniborg-owned revision defaults and, when the selected revision provider requires browser login, completes the Pi-managed provider bootstrap before writing Uraniborg configuration.

#### Scenario: Initial Claude revision setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration and selects `Claude`
- **THEN** the system launches the Pi-managed `anthropic` browser-login flow and writes a valid Uraniborg config only after login and default-model selection succeed

#### Scenario: Initial Gemini revision setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration and selects `Gemini`
- **THEN** the system launches the Pi-managed `google-gemini-cli` browser-login flow, requires usable Gemini project context, and writes a valid Uraniborg config only after login, context validation, and default-model selection succeed

#### Scenario: Browser login fails during initialization
- **WHEN** Pi-managed Claude or Gemini browser login is cancelled, fails state validation, or cannot produce the required provider context
- **THEN** the system leaves the prior Uraniborg revision configuration unchanged and does not write a partial new revision profile

#### Scenario: Updating revision defaults
- **WHEN** a user runs `uraniborg init` with an existing Uraniborg config
- **THEN** the system updates Uraniborg-owned revision settings while leaving Feynman-owned configuration untouched
