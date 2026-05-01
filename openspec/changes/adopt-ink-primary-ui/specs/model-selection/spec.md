## ADDED Requirements

### Requirement: Interactive Models Workflow
The system SHALL expose review-model visibility and active revision-model visibility through an Ink-hosted models workflow in addition to any compatible non-interactive command output.

#### Scenario: Models route shows review and revision model state
- **WHEN** the user opens the models workflow from the Ink dashboard or via an interactive `uraniborg models` route entry
- **THEN** the system displays the currently discoverable review models and the active revision profile's revision-model state in a persistent screen

#### Scenario: Models workflow preserves incomplete setup guidance
- **WHEN** the active revision setup is incomplete or stale
- **THEN** the interactive models workflow surfaces the relevant setup guidance instead of presenting the revision model state as healthy current configuration

## MODIFIED Requirements

### Requirement: Run-Time Model Selection
The system SHALL collect a review model choice and a refine model choice during run creation and persist those selections into the run manifest and config snapshot.

#### Scenario: Interactive run creation
- **WHEN** the user starts `uraniborg run <file>` in an interactive TTY without overriding model selections
- **THEN** the system collects both the review model and the refine model as part of the Ink-hosted run-setup workflow before execution begins

#### Scenario: Selected models persisted
- **WHEN** a run is created successfully
- **THEN** the chosen review model and refine model are stored in the run manifest and the run's config snapshot

#### Scenario: Selected review model unavailable
- **WHEN** the user selects a review model that is not present in the current Feynman model list
- **THEN** Uraniborg rejects the selection and prompts the user to choose an available model or complete the required Feynman remediation flow

#### Scenario: Recommended Feynman capabilities unavailable during selection
- **WHEN** review-model selection succeeds but AlphaXiv auth or web-search configuration is still missing
- **THEN** Uraniborg allows model selection to continue while warning that review and research breadth may be reduced
