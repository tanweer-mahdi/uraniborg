## ADDED Requirements

### Requirement: State-Driven Resume
The system SHALL resume interrupted runs from explicit manifest state rather than inferring state solely from artifact presence.

#### Scenario: Resume after review interruption
- **WHEN** a run is resumed from a manifest state of `review_running`
- **THEN** the system reruns the review step for that iteration

#### Scenario: Resume after refine interruption
- **WHEN** a run is resumed from a manifest state of `refine_running`
- **THEN** the system reruns the refine step for that iteration

#### Scenario: Failed managed refinement run remains locally diagnosable
- **WHEN** a run fails during Pi-managed refinement because the provider/runtime reports an execution failure before yielding usable final text
- **THEN** the run directory preserves enough local evidence to diagnose the provider/runtime failure without rerunning the provider call
- **AND** that evidence includes the corresponding refine log with provider/runtime failure details

#### Scenario: Failed malformed refinement run remains locally diagnosable
- **WHEN** a run fails during refinement because non-empty returned text violates the required output contract
- **THEN** the run directory preserves enough local evidence to diagnose the parser failure without rerunning the provider call
- **AND** that evidence includes the saved malformed refinement response artifact and the corresponding refine log

### Requirement: Provider-Independent Refinement Resume
The system SHALL resume interrupted refinement from local manifest state and Uraniborg-owned artifacts without requiring persisted provider-side conversation or session identifiers.

#### Scenario: Resume managed refinement without remote session state
- **WHEN** a run is resumed from `refine_running` for a Pi-managed revision profile
- **THEN** the system reconstructs the refinement request from local artifacts and manifest state and reruns the refinement step without requiring a previously persisted provider conversation id

#### Scenario: Resume manual-compatible refinement without remote session state
- **WHEN** a run is resumed from `refine_running` for the `manual-openai-compatible` revision profile
- **THEN** the system reconstructs the refinement request from local artifacts and manifest state and reruns the refinement step without relying on transport-specific remote session state

### Requirement: Memory Repair on Resume
The system SHALL rebuild the memory append from existing iteration artifacts when resuming from the `memory_update` state.

#### Scenario: Resume during memory update
- **WHEN** a run is resumed from the `memory_update` state and `changes.md` already exists for that iteration
- **THEN** the system rebuilds the information-highway append from `changes.md` instead of rerunning review or refinement

### Requirement: Run History Listing
The system SHALL provide a `history` command that lists prior local runs with identifiers, timestamps, and current status.

#### Scenario: History with existing runs
- **WHEN** the user runs `uraniborg history` and prior runs exist in `~/.uraniborg/runs/`
- **THEN** the command lists the available runs with their run id, creation time, and status

#### Scenario: History with no runs
- **WHEN** the user runs `uraniborg history` and no prior runs exist
- **THEN** the command reports that no runs are available rather than failing
