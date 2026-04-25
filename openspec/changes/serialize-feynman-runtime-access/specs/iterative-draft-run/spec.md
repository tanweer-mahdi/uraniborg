## MODIFIED Requirements

### Requirement: Run Preflight Readiness Checks
The system SHALL perform run and resume preflight through a serialized Feynman runtime access path so Uraniborg does not overlap Feynman startup mutations during runtime discovery, model discovery, or recommended-capability checks.

#### Scenario: Serialized preflight probing
- **WHEN** Uraniborg prepares a run or resume operation
- **THEN** it collects review-runtime compatibility, review-model discovery, and recommended research-capability facts without launching overlapping Feynman subprocesses

#### Scenario: Shared preflight readiness interpretation
- **WHEN** Uraniborg evaluates run or resume readiness after collecting the serialized runtime snapshot
- **THEN** it uses that shared snapshot to decide whether required review readiness is missing or recommended research capabilities are degraded
