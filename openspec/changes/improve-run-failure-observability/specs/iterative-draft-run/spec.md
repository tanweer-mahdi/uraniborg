## MODIFIED Requirements

### Requirement: Review Step Isolation
The system SHALL execute each review step against the current draft only, using the selected review model, and SHALL persist the normalized review artifact and logs in the current iteration directory.

#### Scenario: Review step failure surfaces provider-authored error
- **WHEN** an iteration enters the review phase, the embedded review runtime exits non-zero, and the runtime exposes a meaningful provider-authored failure message
- **THEN** Uraniborg surfaces that provider-authored message directly to the user instead of leading with a generic process-exit wrapper
- **AND** Uraniborg still preserves subprocess exit metadata and raw stderr in `iter-N/review.log`

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Malformed refinement response
- **WHEN** the refinement execution layer returns output that omits either required section or produces empty parsed content
- **THEN** the system marks the run as failed for that phase instead of guessing how to recover the response

#### Scenario: Malformed refinement response is preserved for inspection
- **WHEN** the refinement execution layer returns final text but that text fails Uraniborg's required parse contract
- **THEN** the system writes the raw refinement response text to an iteration-local artifact before failing the phase
- **AND** the system surfaces a concise parse-contract failure message that points to the saved malformed output artifact
