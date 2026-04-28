## MODIFIED Requirements

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates review-runtime readiness, Uraniborg-owned refine configuration validity, recommended research-capability status, and filesystem readiness through a serialized Feynman access path.

#### Scenario: Shared runtime facts are collected safely
- **WHEN** the user runs `uraniborg doctor`
- **THEN** Uraniborg probes the discovered Feynman runtime through serialized subprocess access instead of overlapping multiple Feynman launches

#### Scenario: Curated default diagnostics
- **WHEN** the user runs `uraniborg doctor` in the default output mode
- **THEN** the command reports curated readiness information without printing raw `Exit code`, `stdout`, or `stderr` subprocess fragments

#### Scenario: Recommended research capabilities missing
- **WHEN** the user runs `uraniborg doctor` and Feynman's AlphaXiv auth or web-search provider configuration is missing
- **THEN** the command reports those capabilities as recommended but non-blocking through the same serialized runtime snapshot used for review-runtime facts
