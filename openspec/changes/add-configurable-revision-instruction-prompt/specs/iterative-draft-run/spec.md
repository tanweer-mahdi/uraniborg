## MODIFIED Requirements

### Requirement: Run Creation and Artifact Snapshot
The system SHALL validate the input Markdown file, collect run parameters, create a new run directory, and snapshot the source draft and resolved configuration before the first iteration starts.

#### Scenario: Valid run initialization
- **WHEN** the user runs `uraniborg run <file>` with an existing Markdown file and valid parameters
- **THEN** the system creates a timestamped run directory with `run.json`, `config.snapshot.json`, `original.md`, `current.md`, and `information-highway.md`

#### Scenario: Prompt provenance captured in config snapshot
- **WHEN** Uraniborg creates `config.snapshot.json` for a run
- **THEN** the snapshot records revision-prompt provenance including:
  - whether the run used the built-in default revision instruction or a configured file
  - the configured prompt-file path when file-backed
  - the effective core revision instruction text used at launch time

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Resumed run keeps original prompt provenance
- **WHEN** Uraniborg resumes a previously created run
- **THEN** it continues using the effective revision instruction that was captured for that run at launch time instead of silently re-reading a later-edited configured prompt file
