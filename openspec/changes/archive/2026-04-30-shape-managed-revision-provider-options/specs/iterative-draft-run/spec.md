## MODIFIED Requirements

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Managed provider option shaping
- **WHEN** Uraniborg invokes Pi-managed refinement execution for a provider with known runtime option incompatibilities
- **THEN** Uraniborg sends only the provider-compatible subset of managed execution options instead of a single unfiltered option set

#### Scenario: OpenAI/Codex managed refinement omits temperature
- **WHEN** Uraniborg invokes Pi-managed refinement execution for the `openai-codex` provider
- **THEN** it does not send `temperature` in the managed provider call options
