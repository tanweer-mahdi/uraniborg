## MODIFIED Requirements

### Requirement: Provider-Neutral Revision Execution
The system SHALL execute iterative refinement only through the Pi-managed provider execution path for the supported revision providers.

#### Scenario: Supported managed profile execution request
- **WHEN** Uraniborg starts a refinement step for a supported revision profile
- **THEN** it invokes the Pi-managed revision execution layer with the active profile identity, selected refine model, provider context, and the full refinement prompt payload

#### Scenario: Unsupported manual-compatible execution request
- **WHEN** Uraniborg encounters a config that would require manual-compatible endpoint-plus-API-key execution
- **THEN** it rejects that config as unsupported instead of attempting manual transport execution
