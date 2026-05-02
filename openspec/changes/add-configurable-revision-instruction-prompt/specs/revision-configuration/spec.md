## MODIFIED Requirements

### Requirement: Provider-Bootstrap-Aware Revision Configuration
The system SHALL persist Uraniborg-owned revision defaults as a provider-bootstrap-aware durable contract that separates provider identity, auth class, credential binding, default revision model, and optional custom revision-instruction source instead of treating endpoint URL or API-key presence as the primary revision identity.

#### Scenario: Guided setup persists provider-aware revision defaults
- **WHEN** a user completes guided revision setup successfully
- **THEN** Uraniborg writes a revision configuration that records provider family or provider profile identity, auth class, credential binding metadata, default revision model, and any configured custom revision-instruction source

#### Scenario: No custom prompt configured
- **WHEN** Uraniborg loads a readable complete revision configuration that does not specify a custom revision-instruction markdown file
- **THEN** it treats the built-in Uraniborg revision instruction as the active default

#### Scenario: Custom revision-instruction file configured
- **WHEN** Uraniborg loads a readable complete revision configuration that specifies a custom revision-instruction markdown file
- **THEN** it treats that file as the active source of configurable revision guidance
- **AND** it still preserves Uraniborg-owned structural/output-format prompt requirements outside the user-configurable file
- **AND** it stores the configured prompt path as a canonical absolute path

#### Scenario: Custom revision-instruction file missing or unreadable
- **WHEN** Uraniborg loads a revision configuration whose configured revision-instruction markdown file is missing, unreadable, or invalid
- **THEN** it marks revision setup as incomplete/action-required instead of silently falling back to the default prompt

### Requirement: Revision Command Family
The system SHALL provide a `revision` command family for viewing and updating Uraniborg-owned provider-bootstrap-aware revision configuration without taking ownership of Feynman internals or provider-registry definitions.

#### Scenario: Provider-aware revision configuration visible
- **WHEN** a user runs `uraniborg revision --config` and Uraniborg has a readable complete revision configuration
- **THEN** the system displays the active revision provider/profile, default revision model, and whether the active revision instruction comes from the default Uraniborg prompt or a configured markdown file

#### Scenario: Custom revision guidance visible
- **WHEN** a user views operator-facing revision configuration and a custom revision-instruction markdown file is active
- **THEN** the system displays both the canonical configured file path and a preview of the effective custom revision guidance text
- **AND** it does not present Uraniborg-owned structural/output-format instructions as part of that preview
