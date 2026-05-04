## MODIFIED Requirements

### Requirement: Run Preflight Readiness Checks
The system SHALL perform a preflight check before a run starts that distinguishes between required review readiness and recommended Feynman research capabilities.

#### Scenario: Required review readiness missing
- **WHEN** Uraniborg preflight detects that no compatible Feynman installation is available, the discovered Feynman installation fails capability checks, or the selected review model is not ready
- **THEN** Uraniborg blocks the run and launches or recommends the relevant Feynman-owned remediation flow or prerequisite guidance

#### Scenario: Out-of-range but compatibility-valid runtime does not block preflight
- **WHEN** Uraniborg preflight detects that the discovered Feynman installation is outside the tested version range but the required compatibility probes passed
- **THEN** Uraniborg warns about the untested version and still allows the run to continue

#### Scenario: Recommended research capabilities missing during preflight
- **WHEN** Uraniborg preflight detects that AlphaXiv auth or web-search provider configuration is missing but required review readiness is satisfied
- **THEN** Uraniborg warns that review quality or freshness may be reduced, offers remediation, and still allows the user to continue the run
