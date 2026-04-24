## MODIFIED Requirements

### Requirement: Run Preflight Readiness Checks
The system SHALL perform a preflight check before a run starts that distinguishes between required review readiness, required refinement readiness, and recommended Feynman research capabilities.

#### Scenario: Required review readiness missing
- **WHEN** Uraniborg preflight detects that no compatible Feynman runtime is available, the discovered Feynman installation is incompatible, or the selected review model is not ready
- **THEN** Uraniborg blocks the run and launches or recommends the relevant Feynman-owned remediation flow

#### Scenario: Required refinement readiness missing
- **WHEN** Uraniborg preflight detects that the configured refinement base URL, selected refine model, or required API key is not ready
- **THEN** Uraniborg blocks the run and directs the user to complete refinement setup before execution begins

#### Scenario: Recommended research capabilities missing during preflight
- **WHEN** Uraniborg preflight detects that AlphaXiv auth or web-search provider configuration is missing but required review readiness and required refinement readiness are satisfied
- **THEN** Uraniborg warns that review quality or freshness may be reduced, offers remediation, and still allows the user to continue the run
