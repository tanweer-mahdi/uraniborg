## MODIFIED Requirements

### Requirement: App Home Bootstrap
The system SHALL prepare and validate a Uraniborg app home rooted at `~/.uraniborg/` that contains Uraniborg-owned configuration and run storage paths before any command depends on them.

#### Scenario: First-time bootstrap
- **WHEN** a user runs a Uraniborg command on a machine without an existing `~/.uraniborg/` directory
- **THEN** the system creates the required application directories for configuration and runs

#### Scenario: Existing app home reuse
- **WHEN** a user runs a Uraniborg command and `~/.uraniborg/` already exists
- **THEN** the system validates the required layout and reuses it without deleting prior runs

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates Feynman runtime availability and compatibility, review-side readiness, Uraniborg-owned refine configuration validity, refinement credential readiness, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, compatible Feynman runtime discovery, review-side readiness, and refinement configuration readiness

#### Scenario: Feynman runtime missing
- **WHEN** the user runs `uraniborg doctor` and Uraniborg cannot discover a compatible `feynman` installation
- **THEN** the command reports that Feynman is missing and explains how the user can install or expose a compatible Feynman runtime without attempting to launch a nonexistent Uraniborg-managed binary

#### Scenario: Feynman runtime incompatible
- **WHEN** the user runs `uraniborg doctor` and Uraniborg finds a `feynman` installation that does not satisfy Uraniborg's compatibility requirements
- **THEN** the command reports the compatibility failure against the discovered installation and explains the required remediation

#### Scenario: Missing refine configuration
- **WHEN** the user runs `uraniborg doctor` without a valid Uraniborg refine configuration
- **THEN** the command reports the refine configuration failure without mutating Feynman-owned settings

#### Scenario: Missing refine credential
- **WHEN** the user runs `uraniborg doctor` with refine base URL and model configured but the required API key is still unavailable
- **THEN** the command reports refinement as not ready and tells the user how to complete credential setup

#### Scenario: Recommended research capabilities missing
- **WHEN** the user runs `uraniborg doctor` and Feynman's AlphaXiv auth or web-search provider configuration is missing
- **THEN** the command reports those capabilities as recommended but non-blocking and explains that research/review coverage may be reduced

### Requirement: Guided Refinement Initialization
The system SHALL provide an `init` flow that captures or updates Uraniborg-owned refinement defaults through a user-centered setup journey, stores them in Uraniborg configuration, and leaves Feynman-owned configuration untouched.

#### Scenario: Initial refine setup
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg refinement configuration
- **THEN** the system asks only for an OpenAI-compatible base URL, an API key, and a refinement model name before writing a valid Uraniborg config file

#### Scenario: Updating refine defaults
- **WHEN** a user runs `uraniborg init` with an existing Uraniborg config
- **THEN** the system updates Uraniborg-owned refinement settings while leaving Feynman-owned configuration untouched

#### Scenario: Basic setup hides internal secret plumbing
- **WHEN** a first-time user completes the normal `uraniborg init` flow
- **THEN** the system does not require the user to invent or supply the name of an environment variable as part of basic setup

#### Scenario: Basic setup excludes advanced refinement knobs
- **WHEN** a first-time user completes the normal `uraniborg init` flow
- **THEN** the system does not require timeout, temperature, max-output-token, or provider-routing inputs as part of basic setup

#### Scenario: Setup completion reflects operational reality
- **WHEN** `uraniborg init` completes without collecting the information required to make refinement runnable
- **THEN** the system does not present refinement setup as complete

## REMOVED Requirements

### Requirement: Pinned Feynman Runtime Provisioning
**Reason**: UAT showed that requiring Uraniborg to provision and invoke Feynman only from `~/.uraniborg/vendor/feynman` created an artificial first-run blocker and encoded unnecessary runtime ownership constraints into the product contract.

**Migration**: Uraniborg now relies on discovery and compatibility checks for a user-available `feynman` installation. `doctor`, `models`, and `run` preflight must validate that discovered runtime instead of requiring a Uraniborg-managed runtime location.

## ADDED Requirements

### Requirement: Feynman Runtime Discovery and Compatibility
The system SHALL discover and use a compatible user-available `feynman` runtime for review-side commands instead of requiring a Uraniborg-managed installation directory.

#### Scenario: Compatible Feynman discovered
- **WHEN** Uraniborg finds a `feynman` installation that satisfies its compatibility requirements
- **THEN** Uraniborg uses that installation for review-side commands

#### Scenario: Existing healthy Feynman installation available
- **WHEN** Uraniborg starts on a machine where a compatible `feynman` installation already exists outside `~/.uraniborg/`
- **THEN** Uraniborg treats that installation as sufficient for review-side readiness instead of blocking only because a Uraniborg-managed runtime directory is absent

#### Scenario: Multiple Feynman installations available
- **WHEN** Uraniborg can discover more than one `feynman` installation on the machine
- **THEN** Uraniborg deterministically selects one compatible installation and reports which runtime it will use

### Requirement: Refinement Setup Readiness
The system SHALL treat refinement setup as ready only when Uraniborg has enough information to execute refinement requests successfully for the configured OpenAI-compatible endpoint, API key, and model.

#### Scenario: Refinement setup ready
- **WHEN** Uraniborg has a configured OpenAI-compatible base URL, a configured refinement model, and access to the required API key
- **THEN** Uraniborg reports refinement as ready

#### Scenario: Refinement setup incomplete
- **WHEN** any required base URL, API key, or model information for refinement is still missing
- **THEN** Uraniborg reports refinement setup as incomplete and identifies the missing input
