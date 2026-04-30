## MODIFIED Requirements

### Requirement: Review Model Discovery
The system SHALL provide a `models` command that exposes the review models currently available through the compatible discovered Feynman runtime using Feynman-owned model-discovery commands.

#### Scenario: Review models available
- **WHEN** the user runs `uraniborg models` and the discovered compatible Feynman runtime can enumerate review models
- **THEN** the command displays the available review model options

#### Scenario: Review model discovery failure
- **WHEN** the user runs `uraniborg models` and review model discovery fails
- **THEN** the command reports the review-side error without fabricating model availability

### Requirement: Review Model Readiness Remediation
The system SHALL route missing review-model access through Feynman-owned remediation commands rather than inventing a Uraniborg-specific recovery path.

#### Scenario: Provider login required for models
- **WHEN** Uraniborg cannot obtain the expected review model list because Feynman provider authentication or setup is incomplete
- **THEN** Uraniborg instructs or launches the relevant Feynman setup or provider-login command

#### Scenario: Feynman runtime missing for model discovery
- **WHEN** Uraniborg cannot run review model discovery because no compatible Feynman installation is available
- **THEN** Uraniborg reports the missing runtime condition and directs the user to install or expose a compatible Feynman runtime

#### Scenario: Feynman runtime incompatible for model discovery
- **WHEN** Uraniborg discovers a `feynman` installation but it does not satisfy Uraniborg's compatibility requirements for review model discovery
- **THEN** Uraniborg reports the compatibility failure against that installation and directs the user to the required remediation

### Requirement: Refinement Model Visibility
The system SHALL expose the configured refinement base URL and model settings that Uraniborg can use for refinement requests.

#### Scenario: Refinement defaults configured
- **WHEN** the user runs `uraniborg models` with a valid Uraniborg refine configuration
- **THEN** the command displays the configured refine base URL and default refine model information

#### Scenario: Refinement defaults incomplete
- **WHEN** the user runs `uraniborg models` and refinement setup is incomplete
- **THEN** the command reports which refine setup inputs are still missing instead of presenting refinement as ready

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

## ADDED Requirements

### Requirement: Minimal Refinement Setup Inputs
The system SHALL keep the normal first-run refinement setup path limited to an OpenAI-compatible base URL, an API key, and a model name.

#### Scenario: Minimal inputs collected during init
- **WHEN** a user configures refinement during `uraniborg init`
- **THEN** the system collects a base URL, an API key, and a model name for refinement

#### Scenario: No provider-routing required in v1 setup
- **WHEN** a user follows the normal first-run refinement setup path
- **THEN** the system does not require provider selection or provider-specific routing inputs before refinement can be configured

#### Scenario: No advanced refinement knobs required in v1 setup
- **WHEN** a user follows the normal first-run refinement setup path
- **THEN** the system does not require timeout, temperature, max-output-token, or similar advanced tuning fields before refinement can be configured
