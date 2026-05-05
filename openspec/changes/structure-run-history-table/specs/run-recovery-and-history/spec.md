## MODIFIED Requirements

### Requirement: Run History Listing
The system SHALL provide history surfaces that list prior local runs with identifiers, timestamps, current status, progress, and title.

#### Scenario: History command with existing runs
- **WHEN** the user runs `uraniborg history` and prior runs exist in `~/.uraniborg/runs/`
- **THEN** the command lists the available runs with their run id, creation time, and status

#### Scenario: History command with no runs
- **WHEN** the user runs `uraniborg history` and no prior runs exist
- **THEN** the command reports that no runs are available rather than failing

#### Scenario: Interactive history renders structured wide rows
- **WHEN** the user opens the interactive Run History screen in a terminal wide enough for tabular presentation and prior runs exist
- **THEN** the screen presents each run as a structured row with distinct status, progress, creation time, title, and run id fields
- **AND** the screen does not collapse those fields into a single pipe-delimited string

#### Scenario: Interactive history remains readable in narrow terminals
- **WHEN** the user opens the interactive Run History screen in a narrow terminal and prior runs exist
- **THEN** the screen uses a compact responsive layout that keeps status, progress, creation time, title, and run id readable without horizontal scrolling

#### Scenario: Interactive history preserves run selection
- **WHEN** the user selects a run in the interactive Run History screen and presses Enter
- **THEN** the system opens the selected run detail using that run id

#### Scenario: Interactive history with no runs
- **WHEN** the user opens the interactive Run History screen and no prior runs exist
- **THEN** the screen reports that no Uraniborg runs are available rather than failing
