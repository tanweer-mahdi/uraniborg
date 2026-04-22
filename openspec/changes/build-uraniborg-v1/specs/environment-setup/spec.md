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
The system SHALL provide a `doctor` command that validates embedded Feynman availability, review-side readiness, Uraniborg-owned refine configuration validity, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, embedded review runtime, review-side readiness, and refine configuration

#### Scenario: Pinned runtime not runnable
- **WHEN** the user runs `uraniborg doctor` and the pinned Feynman binary fails the version or runnability check
- **THEN** the command reports the review-runtime failure against the pinned runtime rather than silently falling back to another binary on `PATH`

#### Scenario: Missing refine configuration
- **WHEN** the user runs `uraniborg doctor` without a valid Uraniborg refine configuration
- **THEN** the command reports the refine configuration failure without mutating Feynman-owned settings

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

### Requirement: Guided Refinement Initialization
The system SHALL provide an `init` flow that captures or updates Uraniborg-owned refinement defaults and stores them in Uraniborg configuration without taking ownership of Feynman internals.

#### Scenario: Initial refine setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg refinement configuration
- **THEN** the system prompts for the required refinement settings and writes a valid Uraniborg config file

#### Scenario: Updating refine defaults
- **WHEN** a user runs `uraniborg init` with an existing Uraniborg config
- **THEN** the system updates Uraniborg-owned refinement settings while leaving Feynman-owned configuration untouched
