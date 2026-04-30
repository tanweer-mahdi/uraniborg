## ADDED Requirements

### Requirement: Revision Command Family
The system SHALL provide a `revision` command family for viewing and updating Uraniborg-owned provider-bootstrap-aware revision configuration without taking ownership of Feynman internals or provider-registry definitions.

#### Scenario: Guided provider-aware revision setup
- **WHEN** a user runs `uraniborg revision --setup`
- **THEN** the system launches the same guided revision-configuration flow that Uraniborg exposes through `uraniborg init`

#### Scenario: Provider-aware revision configuration visible
- **WHEN** a user runs `uraniborg revision --config` and Uraniborg has a readable complete revision configuration
- **THEN** the system displays only the active revision provider/profile and default revision model in operator-facing form

#### Scenario: Revision configuration incomplete
- **WHEN** a user runs `uraniborg revision --config` and Uraniborg does not yet have a complete provider-bootstrap-aware revision configuration
- **THEN** the system reports that revision setup is incomplete and directs the user to `uraniborg revision --setup` or `uraniborg init`

### Requirement: Provider-Bootstrap-Aware Revision Configuration
The system SHALL persist Uraniborg-owned revision defaults as a provider-bootstrap-aware durable contract that separates provider identity, auth class, credential binding, and default revision model instead of treating endpoint URL or API-key presence as the primary revision identity.

#### Scenario: Guided setup persists provider-aware revision defaults
- **WHEN** a user completes guided revision setup successfully
- **THEN** Uraniborg writes a revision configuration that records provider family or provider profile identity, auth class, credential binding metadata, and default revision model

#### Scenario: OpenAI/Codex uses managed browser-login credentials
- **WHEN** a user completes guided revision setup for the `OpenAI/Codex` profile successfully
- **THEN** Uraniborg writes revision configuration that references Pi-managed OAuth credential state and required account-context metadata rather than storing an API key in the main config file

#### Scenario: Endpoint override remains subordinate to provider identity
- **WHEN** the selected revision provider/profile supports an operator-managed endpoint override
- **THEN** Uraniborg stores that endpoint override as subordinate provider metadata rather than as the primary user-facing revision identity

### Requirement: Provider-Specific Revision Auth Bootstrap
The system SHALL treat provider-specific revision auth/bootstrap as part of the revision-configuration flow when the selected revision profile requires it, and SHALL reuse Pi's built-in auth/bootstrap primitives instead of building a parallel Uraniborg-owned OAuth implementation.

#### Scenario: OpenAI/Codex setup initiates browser login
- **WHEN** a user selects the `OpenAI/Codex` revision profile during guided revision setup
- **THEN** Uraniborg initiates a browser-based login flow for the ChatGPT subscription-backed Codex provider contract instead of asking for an API key

#### Scenario: OpenAI/Codex setup requires managed credential persistence
- **WHEN** the browser-login flow for `OpenAI/Codex` completes successfully
- **THEN** Pi `AuthStorage` persists the resulting credential material and Uraniborg stores only the resulting Pi-aligned credential binding plus required account-context metadata in the main config file

#### Scenario: Pi auth primitives are the credential system of record
- **WHEN** Uraniborg implements revision auth/bootstrap for a Pi-backed revision provider profile
- **THEN** Uraniborg uses Pi `AuthStorage` and the corresponding Pi OAuth provider as the system of record for OAuth credentials rather than introducing a second Uraniborg-owned credential store

#### Scenario: Incomplete browser login does not complete revision setup
- **WHEN** the browser-login flow for `OpenAI/Codex` is cancelled, fails callback validation, or otherwise does not produce a valid managed credential reference
- **THEN** Uraniborg does not report revision setup as complete and does not write partial current revision configuration

### Requirement: Legacy And Interim Revision Config Compatibility
The system SHALL continue to read existing revision configuration generations and classify them into the corrected provider-aware revision contract without silently treating stale incompatible configs as valid current setup.

#### Scenario: Legacy inline-secret config remains readable
- **WHEN** Uraniborg loads an existing endpoint-centric `version: 1` revision config that stores an inline API key
- **THEN** Uraniborg normalizes it into the corrected provider-aware revision view without rewriting the config file during passive reads

#### Scenario: Legacy environment-variable config remains readable
- **WHEN** Uraniborg loads an existing endpoint-centric `version: 1` revision config that references an API-key environment variable
- **THEN** Uraniborg normalizes it into the corrected provider-aware revision view and preserves the environment-variable-based credential binding

#### Scenario: Legacy custom endpoint maps to manual provider profile
- **WHEN** Uraniborg loads an existing endpoint-centric `version: 1` revision config whose endpoint does not match a first-party preset
- **THEN** Uraniborg treats it as a compatible manual provider profile rather than rejecting the config solely because it predates the corrected schema

#### Scenario: Pre-correction OpenAI/Codex preview config is classified as stale
- **WHEN** Uraniborg loads a pre-correction `version: 2` revision config whose `OpenAI/Codex` profile still points at the OpenAI Platform API or uses API-key auth
- **THEN** Uraniborg classifies that config as stale/incompatible and requires guided re-setup rather than silently treating it as valid current `OpenAI/Codex` revision configuration

### Requirement: Operator-Facing Revision Terminology
The system SHALL use `revision` terminology across operator-facing setup, config, and readiness text while leaving internal implementation naming unchanged where necessary.

#### Scenario: Provider-aware setup flow uses revision language
- **WHEN** Uraniborg renders the guided revision-configuration flow
- **THEN** the intro text, prompt labels, validation messages, and completion messages use `revision` terminology rather than `refinement`

#### Scenario: Provider-aware config and readiness surfaces use revision language
- **WHEN** Uraniborg renders operator-facing revision configuration or readiness output
- **THEN** it refers to revision setup, revision provider defaults, and revision models rather than refinement setup, refinement defaults, or refinement models
