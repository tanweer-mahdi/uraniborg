## ADDED Requirements

### Requirement: State-Driven Resume
The system SHALL resume interrupted runs from explicit manifest state rather than inferring state solely from artifact presence.

#### Scenario: Resume after review interruption
- **WHEN** a run is resumed from a manifest state of `review_running`
- **THEN** the system reruns the review step for that iteration

#### Scenario: Resume after refine interruption
- **WHEN** a run is resumed from a manifest state of `refine_running`
- **THEN** the system reruns the refine step for that iteration

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
