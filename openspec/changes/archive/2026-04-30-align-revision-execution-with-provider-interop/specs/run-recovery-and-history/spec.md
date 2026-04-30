## ADDED Requirements

### Requirement: Provider-Independent Refinement Resume
The system SHALL resume interrupted refinement from local manifest state and Uraniborg-owned artifacts without requiring persisted provider-side conversation or session identifiers.

#### Scenario: Resume managed refinement without remote session state
- **WHEN** a run is resumed from `refine_running` for a Pi-managed revision profile
- **THEN** the system reconstructs the refinement request from local artifacts and manifest state and reruns the refinement step without requiring a previously persisted provider conversation id

#### Scenario: Resume manual-compatible refinement without remote session state
- **WHEN** a run is resumed from `refine_running` for the `manual-openai-compatible` revision profile
- **THEN** the system reconstructs the refinement request from local artifacts and manifest state and reruns the refinement step without relying on transport-specific remote session state
