## MODIFIED Requirements

### Requirement: Run History Listing
The system SHALL provide history surfaces for prior local runs. The plain `history` command SHALL keep listing prior runs in the terminal, while interactive TUI History SHALL list all historical runs and open a selected run as a self-contained local HTML snapshot for deep artifact exploration.

#### Scenario: History command with existing runs
- **WHEN** the user runs `uraniborg history` and prior runs exist in `~/.uraniborg/runs/`
- **THEN** the command lists the available runs with their run id, creation time, and status

#### Scenario: History command with no runs
- **WHEN** the user runs `uraniborg history` and no prior runs exist
- **THEN** the command reports that no runs are available rather than failing

#### Scenario: History command opens selected run snapshot when requested
- **WHEN** the user runs `uraniborg history --web <runId>` with a valid run id
- **THEN** the system generates a self-contained local HTML snapshot for that run
- **AND** the system attempts to open the snapshot in the user's browser via `file://`
- **AND** the system reports the snapshot file location if automatic browser opening fails

#### Scenario: Interactive History lists all runs
- **WHEN** the user selects History from the interactive TUI menu and prior runs exist
- **THEN** the TUI lists all available historical runs for selection

#### Scenario: Interactive History opens selected run snapshot
- **WHEN** the user selects a run from interactive TUI History
- **THEN** the TUI shows that snapshot generation or opening is in progress
- **AND** the system immediately generates a self-contained local HTML snapshot for that selected run
- **AND** the system attempts to open the snapshot in the user's browser via `file://`

#### Scenario: Interactive History reports successful snapshot generation
- **WHEN** the user selects a run from interactive TUI History and snapshot generation succeeds
- **THEN** the TUI shows the generated snapshot file path or `file://` URL

#### Scenario: Interactive History with no runs
- **WHEN** the user selects History from the interactive TUI menu and no prior runs exist
- **THEN** the TUI reports that no Uraniborg runs are available rather than failing

#### Scenario: Interactive History handles browser-open failure
- **WHEN** the user selects a run from interactive TUI History and snapshot generation succeeds but automatic browser opening fails
- **THEN** the TUI reports the snapshot file path or `file://` URL for manual opening
- **AND** the TUI does not report snapshot generation as failed

#### Scenario: Interactive History handles snapshot failure
- **WHEN** the user selects a run from interactive TUI History and snapshot generation fails
- **THEN** the TUI reports the failure rather than silently returning to the dashboard
