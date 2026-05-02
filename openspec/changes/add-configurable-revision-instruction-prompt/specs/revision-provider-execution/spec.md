## MODIFIED Requirements

### Requirement: Provider-Neutral Revision Execution
The system SHALL execute iterative refinement through a provider-neutral revision execution layer that accepts Uraniborg's refinement prompt contract and returns normalized model output for Uraniborg-owned parsing.

#### Scenario: Managed profile execution request
- **WHEN** Uraniborg starts a refinement step for a Pi-managed revision profile
- **THEN** it invokes the revision execution layer with the active revision profile identity, selected refine model, provider context, and the full refinement prompt payload instead of directly issuing an OpenAI-compatible HTTP request

#### Scenario: Custom revision guidance supplied
- **WHEN** Uraniborg has a configured custom revision-instruction markdown file for the active revision configuration
- **THEN** the revision execution layer uses the contents of that file as the configurable core revision guidance for refinement prompt assembly

#### Scenario: Default revision guidance supplied
- **WHEN** Uraniborg does not have a configured custom revision-instruction markdown file
- **THEN** the revision execution layer uses the built-in Uraniborg revision instruction as the configurable core revision guidance

#### Scenario: Structural prompt contract remains Uraniborg-owned
- **WHEN** Uraniborg assembles a refinement prompt from either the default instruction or a user-provided instruction file
- **THEN** it still appends or preserves Uraniborg-owned structural/output-format instructions that require the exact `=== REFINED_DRAFT ===` and `=== CHANGE_SUMMARY ===` response contract
- **AND** the user-provided instruction source is not allowed to replace that structural contract
