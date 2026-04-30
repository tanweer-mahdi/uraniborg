## ADDED Requirements

### Requirement: Provider-Neutral Revision Execution
The system SHALL execute iterative refinement through a provider-neutral revision execution layer that accepts Uraniborg's refinement prompt contract and returns normalized model output for Uraniborg-owned parsing.

#### Scenario: Managed profile execution request
- **WHEN** Uraniborg starts a refinement step for a Pi-managed revision profile
- **THEN** it invokes the revision execution layer with the active revision profile identity, selected refine model, provider context, and the full refinement prompt payload instead of directly issuing an OpenAI-compatible HTTP request

#### Scenario: Manual-compatible execution request
- **WHEN** Uraniborg starts a refinement step for the `manual-openai-compatible` revision profile
- **THEN** the revision execution layer uses the explicit endpoint-plus-API-key-compatible transport path while preserving the same Uraniborg prompt and parse contract

### Requirement: Managed Runtime Credential Resolution
The system SHALL resolve executable runtime auth for Pi-managed revision profiles through Pi-managed credential state rather than through raw API-key secret resolution in Uraniborg config.

#### Scenario: Managed credential available
- **WHEN** a run starts with a ready Pi-managed revision profile
- **THEN** the revision execution layer resolves the profile through Pi-managed runtime auth state and proceeds without requiring a raw revision API key in Uraniborg config

#### Scenario: Managed credential missing or unreadable
- **WHEN** a run starts with a Pi-managed revision profile whose runtime credential state is missing, unreadable, or inconsistent with required provider context
- **THEN** the system blocks execution before the refinement request and reports the managed runtime readiness failure with rerun-setup guidance

### Requirement: Sanitized Revision Execution Telemetry
The system SHALL persist refinement execution logs with sanitized request and response metadata that never expose secrets, bearer tokens, refresh tokens, or raw authorization headers.

#### Scenario: Successful managed execution log
- **WHEN** a Pi-managed refinement request succeeds
- **THEN** `refine.log` records the active revision profile, selected model, sanitized execution metadata, parse outcome, and timing details without persisting secret credential material

#### Scenario: Failed managed execution log
- **WHEN** a Pi-managed refinement request fails before producing valid parseable output
- **THEN** `refine.log` records the failure category and sanitized diagnostic detail without persisting raw auth payloads or tokens
