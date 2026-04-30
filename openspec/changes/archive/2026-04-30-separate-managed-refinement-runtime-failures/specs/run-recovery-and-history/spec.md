## MODIFIED Requirements

### Requirement: State-Driven Resume
The system SHALL resume interrupted runs from explicit manifest state rather than inferring state solely from artifact presence.

#### Scenario: Failed managed refinement run remains locally diagnosable
- **WHEN** a run fails during Pi-managed refinement because the provider/runtime reports an execution failure before yielding usable final text
- **THEN** the run directory preserves enough local evidence to diagnose the provider/runtime failure without rerunning the provider call
- **AND** that evidence includes the corresponding refine log with provider/runtime failure details

#### Scenario: Failed malformed refinement run remains locally diagnosable
- **WHEN** a run fails during refinement because non-empty returned text violates the required output contract
- **THEN** the run directory preserves enough local evidence to diagnose the parser failure without rerunning the provider call
- **AND** that evidence includes the saved malformed refinement response artifact and the corresponding refine log
