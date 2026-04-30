## ADDED Requirements

### Requirement: Review Model Discovery
The system SHALL provide a `models` command that exposes the review models currently available through the pinned embedded Feynman runtime using Feynman-owned model-discovery commands.

#### Scenario: Review models available
- **WHEN** the user runs `uraniborg models` and the pinned Feynman runtime can enumerate review models
- **THEN** the command displays the available review model options

#### Scenario: Review model discovery failure
- **WHEN** the user runs `uraniborg models` and review model discovery fails
- **THEN** the command reports the review-side error without fabricating model availability

### Requirement: Review Model Readiness Remediation
The system SHALL route missing review-model access through Feynman-owned remediation commands rather than inventing a Uraniborg-specific recovery path.

#### Scenario: Provider login required for models
- **WHEN** Uraniborg cannot obtain the expected review model list because Feynman provider authentication or setup is incomplete
- **THEN** Uraniborg instructs or launches the relevant Feynman setup or provider-login command

### Requirement: Refinement Model Visibility
The system SHALL expose the configured revision runtime identity and refinement model settings that Uraniborg can actually execute for the active revision profile, without exposing Pi-managed credential material, endpoint internals, or low-level provider bootstrap detail.

#### Scenario: Managed profile revision visibility
- **WHEN** the user runs `uraniborg models` with a valid Pi-managed revision profile
- **THEN** the command displays the active revision profile and the configured default refine model without describing the runtime as merely an endpoint-plus-API-key configuration

#### Scenario: Manual-compatible revision visibility
- **WHEN** the user runs `uraniborg models` with a valid `manual-openai-compatible` revision profile
- **THEN** the command displays the configured compatible endpoint and default refine model information for that profile

#### Scenario: Stale or incomplete revision config is not rendered as healthy current setup
- **WHEN** the user runs `uraniborg models` with a stale pre-correction OpenAI/Codex config or otherwise incomplete provider-bootstrap-aware revision configuration
- **THEN** the command does not present that revision config as healthy current setup and instead directs the operator to complete or rerun revision setup

#### Scenario: Legacy revision config remains visible through normalization
- **WHEN** the user runs `uraniborg models` with a legacy endpoint-centric revision config that can be normalized into the corrected provider-aware contract
- **THEN** the command renders revision visibility from the normalized provider-aware view rather than failing solely because the config predates the new schema

#### Scenario: Browser-login-backed revision setup incomplete
- **WHEN** the user runs `uraniborg models` and the active Claude or Gemini revision profile is missing Pi-managed credential state or required provider context
- **THEN** the command reports that revision setup is incomplete instead of presenting a healthy active revision model configuration

### Requirement: Run-Time Model Selection
The system SHALL collect a review model choice and a refine model choice during run creation and persist those selections into the run manifest and config snapshot.

#### Scenario: Interactive run creation
- **WHEN** the user starts `uraniborg run <file>` without overriding model selections
- **THEN** the system prompts for both the review model and the refine model before execution begins

#### Scenario: Selected models persisted
- **WHEN** a run is created successfully
- **THEN** the chosen review model and refine model are stored in the run manifest and the run's config snapshot

#### Scenario: Selected review model unavailable
- **WHEN** the user selects a review model that is not present in the current Feynman model list
- **THEN** Uraniborg rejects the selection and prompts the user to choose an available model or complete the required Feynman remediation flow

#### Scenario: Recommended Feynman capabilities unavailable during selection
- **WHEN** review-model selection succeeds but AlphaXiv auth or web-search configuration is still missing
- **THEN** Uraniborg allows model selection to continue while warning that review and research breadth may be reduced

### Requirement: Run-Time Revision Model Selection Eligibility
The system SHALL gate refine-model selection during run creation on executable revision runtime readiness for the active revision profile.

#### Scenario: Managed profile ready for refine selection
- **WHEN** the selected Pi-managed revision profile is runtime-ready
- **THEN** Uraniborg allows the user to confirm or choose the refine model for that profile during run creation

#### Scenario: Managed profile not executable
- **WHEN** the selected Pi-managed revision profile is setup-valid but not executable at runtime
- **THEN** Uraniborg blocks refine-model selection for the run and reports the revision runtime readiness failure before execution starts
