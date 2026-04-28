## MODIFIED Requirements

### Requirement: Review Model Discovery
The system SHALL provide a `models` command that exposes review models through the same serialized Feynman runtime snapshot used by other Uraniborg readiness flows while keeping the default output model-focused.

#### Scenario: Model-focused reporting
- **WHEN** the user runs `uraniborg models`
- **THEN** the command shows discovered review-model availability and configured refinement model readiness without surfacing unrelated AlphaXiv or web-search status in the default output

#### Scenario: Shared readiness facts stay consistent
- **WHEN** `uraniborg doctor` and `uraniborg models` are run against the same healthy Feynman/runtime state
- **THEN** both commands reflect the same review-runtime and review-model readiness facts because they consume the same serialized runtime collection path
