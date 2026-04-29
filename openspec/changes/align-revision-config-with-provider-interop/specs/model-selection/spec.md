## MODIFIED Requirements

### Requirement: Refinement Model Visibility
The system SHALL expose the configured revision model settings that Uraniborg can use for revision requests through a provider-aware revision configuration view.

#### Scenario: Provider-aware revision defaults configured
- **WHEN** the user runs `uraniborg models` with a valid provider-bootstrap-aware Uraniborg revision configuration
- **THEN** the command displays only the configured revision provider/profile identity and default revision model information

#### Scenario: Advanced defaults remain hidden from models output
- **WHEN** the user runs `uraniborg models` with a valid provider-bootstrap-aware Uraniborg revision configuration that also preserves timeout, temperature, or other advanced defaults
- **THEN** the command does not display those advanced preserved defaults in the revision section

#### Scenario: Stale or incomplete revision config is not rendered as healthy current setup
- **WHEN** the user runs `uraniborg models` with a stale pre-correction OpenAI/Codex config or otherwise incomplete provider-bootstrap-aware revision configuration
- **THEN** the command does not present that revision config as healthy current setup and instead directs the operator to complete or rerun revision setup

#### Scenario: Legacy revision config remains visible through normalization
- **WHEN** the user runs `uraniborg models` with a legacy endpoint-centric revision config that can be normalized into the corrected provider-aware contract
- **THEN** the command renders revision visibility from the normalized provider-aware view rather than failing solely because the config predates the new schema
