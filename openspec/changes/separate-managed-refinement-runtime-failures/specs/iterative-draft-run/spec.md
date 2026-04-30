## MODIFIED Requirements

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Managed refinement runtime failure without usable text
- **WHEN** the Pi-managed refinement runtime returns a terminal execution error or equivalent error stop without a usable final text payload
- **THEN** Uraniborg surfaces that as a refinement execution failure instead of a malformed output contract failure
- **AND** Uraniborg preserves the provider/runtime error details in local logs when available

#### Scenario: Malformed refinement response
- **WHEN** the refinement execution layer returns non-empty final text that omits either required section or produces empty parsed section content
- **THEN** the system marks the run as failed for that phase instead of guessing how to recover the response

#### Scenario: Malformed refinement response is preserved for inspection
- **WHEN** the refinement execution layer returns non-empty final text but that text fails Uraniborg's required parse contract
- **THEN** the system writes the raw refinement response text to an iteration-local artifact before failing the phase
- **AND** the system surfaces a concise parse-contract failure message that points to the saved malformed output artifact
