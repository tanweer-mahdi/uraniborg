## MODIFIED Requirements

### Requirement: Review Auth Orchestration
The system SHALL use Feynman-owned setup, login, and search-configuration commands to establish review readiness and SHALL NOT implement a separate Uraniborg-managed review auth flow.

#### Scenario: Review setup required
- **WHEN** Uraniborg detects that review-side setup or provider login is required before review commands can succeed
- **THEN** the system launches the appropriate Feynman-owned setup or login command rather than mutating Feynman configuration files directly

#### Scenario: Web-search provider configuration required
- **WHEN** Uraniborg detects that Feynman web-search provider configuration is missing and the operator accepts setup
- **THEN** Uraniborg collects the provider choice and optional API key, then launches the Feynman-owned search-provider configuration command rather than generic `feynman setup`

#### Scenario: Default remediation output stays curated
- **WHEN** Uraniborg launches or completes a review-side remediation command in the default CLI mode
- **THEN** it reports operator-facing progress and outcome messages without printing raw `Exit code`, `stdout`, or `stderr` fragments

#### Scenario: Doctor surfaces rich Feynman diagnostics
- **WHEN** the user requests diagnostics for a review-side failure
- **THEN** Uraniborg surfaces Feynman doctor information for the user without relying on that output as its sole machine-readiness signal

### Requirement: Optional Feynman Capability Guidance
The system SHALL surface Feynman-owned AlphaXiv and web-search capability status as optional but recommended enhancements rather than as mandatory prerequisites for Uraniborg runs, while keeping explicit search-provider management available after setup.

#### Scenario: AlphaXiv missing
- **WHEN** Uraniborg detects that Feynman AlphaXiv auth is not configured
- **THEN** Uraniborg warns that latest-paper and paper-metadata access may be weaker and offers to launch the Feynman-owned AlphaXiv login flow without blocking the run

#### Scenario: Web search configuration missing
- **WHEN** Uraniborg detects that Feynman web-search provider configuration is missing
- **THEN** Uraniborg warns that access to the latest web research may be weaker and offers to launch the dedicated Feynman-owned search-provider configuration flow without blocking the run

#### Scenario: Existing web-search provider can be changed or extended
- **WHEN** a compatible Feynman runtime is available and the operator wants to add or change a web-search provider even though one is already configured
- **THEN** Uraniborg offers the dedicated Feynman-owned search-provider configuration flow without requiring a failing health check first

### Requirement: Guided Refinement Initialization
The system SHALL provide a guided revision-configuration flow that captures or updates Uraniborg-owned revision defaults through `uraniborg init` and `uraniborg revision --setup`, stores them in Uraniborg configuration, and leaves Feynman-owned configuration untouched.

#### Scenario: Initial revision setup through init
- **WHEN** a user runs `uraniborg init` with no prior Uraniborg revision configuration
- **THEN** the system asks only for an OpenAI-compatible base URL, an API key, and a revision model name before writing a valid Uraniborg config file

#### Scenario: Initial revision setup through revision command
- **WHEN** a user runs `uraniborg revision --setup` with no prior Uraniborg revision configuration
- **THEN** the system runs the same guided setup flow and writes a valid Uraniborg config file

#### Scenario: Updating revision defaults
- **WHEN** a user runs either `uraniborg init` or `uraniborg revision --setup` with an existing Uraniborg config
- **THEN** the system updates Uraniborg-owned revision settings while leaving Feynman-owned configuration untouched

#### Scenario: Setup completion reflects operational reality
- **WHEN** the guided revision setup flow completes without collecting the information required to make revision runnable
- **THEN** the system does not present revision setup as complete
