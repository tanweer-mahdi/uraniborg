## ADDED Requirements

### Requirement: Doctor Missing Feynman Install Command
The system SHALL include the exact Feynman npm install command in `uraniborg doctor` output when no Feynman executable is discoverable on `PATH`.

#### Scenario: Doctor reports exact install command when Feynman is missing
- **WHEN** the user runs `uraniborg doctor` and no `feynman` executable is found on `PATH`
- **THEN** the doctor output reports the missing external Feynman prerequisite
- **AND** the same output includes the exact command `npm install -g @companion-ai/feynman@latest`

#### Scenario: Incompatible runtime guidance remains separate
- **WHEN** the user runs `uraniborg doctor` and a discovered Feynman executable fails compatibility checks
- **THEN** the doctor output reports the compatibility failure for that executable
- **AND** the output does not misclassify the executable as missing from `PATH`
