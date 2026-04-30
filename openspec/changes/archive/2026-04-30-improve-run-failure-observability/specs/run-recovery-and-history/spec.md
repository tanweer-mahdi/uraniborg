## MODIFIED Requirements

### Requirement: State-Driven Resume
The system SHALL resume interrupted runs from explicit manifest state rather than inferring state solely from artifact presence.

#### Scenario: Failed refinement run remains locally diagnosable
- **WHEN** a run fails during refinement because the model response violates the required output contract
- **THEN** the run directory preserves enough local evidence to diagnose the failure without rerunning the provider call
- **AND** that evidence includes the saved malformed refinement response artifact and the corresponding refine log
