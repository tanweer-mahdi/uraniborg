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
The system SHALL expose the configured refinement model settings that Uraniborg can use for refinement requests.

#### Scenario: Refinement defaults configured
- **WHEN** the user runs `uraniborg models` with a valid Uraniborg refine configuration
- **THEN** the command displays the configured refine endpoint and default refine model information

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
