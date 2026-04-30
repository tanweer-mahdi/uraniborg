## ADDED Requirements

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

### Requirement: Claude Revision Browser Login
The system SHALL implement the product-facing `Claude` revision setup flow through Pi's built-in `anthropic` OAuth provider and SHALL treat Pi-managed browser login as the required auth regime for the active Claude revision profile.

#### Scenario: Successful Claude browser-login setup
- **WHEN** the user selects `Claude` in `uraniborg init` or `uraniborg revision --setup` and completes the Pi-managed `anthropic` browser-login flow successfully
- **THEN** Uraniborg persists a Claude browser-login revision profile with a Pi-managed credential binding and the chosen default revision model

#### Scenario: Cancelled Claude browser login
- **WHEN** the user cancels the Pi-managed `anthropic` browser-login flow or the flow fails callback validation
- **THEN** Uraniborg does not write a partial Claude revision profile and leaves any prior revision config unchanged

#### Scenario: Stale API-key-based Claude revision config
- **WHEN** Uraniborg reads an older Claude revision config that targets the pre-browser-auth API-key contract
- **THEN** Uraniborg classifies that Claude setup as stale and instructs the user to rerun revision setup instead of treating it as healthy current configuration

### Requirement: Gemini Revision Browser Login
The system SHALL implement the product-facing `Gemini` revision setup flow through Pi's built-in `google-gemini-cli` OAuth provider and SHALL require provider-owned Gemini project context as part of usable revision readiness.

#### Scenario: Successful Gemini browser-login setup
- **WHEN** the user selects `Gemini` in `uraniborg init` or `uraniborg revision --setup` and completes the Pi-managed `google-gemini-cli` browser-login flow successfully
- **THEN** Uraniborg persists a Gemini browser-login revision profile with a Pi-managed credential binding, the required `projectId` provider context, and the chosen default revision model

#### Scenario: Gemini browser login lacks project context
- **WHEN** the Pi-managed `google-gemini-cli` login flow returns auth state without the required Gemini `projectId`
- **THEN** Uraniborg rejects the setup as incomplete and does not write a completed Gemini revision profile

#### Scenario: Cancelled Gemini browser login
- **WHEN** the user cancels the Pi-managed `google-gemini-cli` browser-login flow or the flow fails callback validation
- **THEN** Uraniborg does not write a partial Gemini revision profile and leaves any prior revision config unchanged

### Requirement: Pi-Managed Revision Credential Binding
The system SHALL keep Claude and Gemini browser-login credentials in Pi `AuthStorage` and SHALL persist only non-secret revision profile, credential-binding, and provider-context data in Uraniborg-owned configuration.

#### Scenario: Claude or Gemini config written after successful login
- **WHEN** Uraniborg writes revision config after a successful Claude or Gemini browser-login setup
- **THEN** the Uraniborg config contains no access token, refresh token, or raw bearer credential material

#### Scenario: Doctor checks Pi-managed credential state
- **WHEN** a Claude or Gemini revision profile exists in Uraniborg config but the corresponding Pi-managed credential binding cannot be resolved
- **THEN** Uraniborg reports revision readiness failure against the missing or unreadable Pi-managed credential state

### Requirement: Browser-Auth Migration And Re-Setup
The system SHALL preserve passive read compatibility for older Claude and Gemini revision records while requiring re-setup before those records can be treated as healthy browser-login-backed revision configuration.

#### Scenario: Passive read of older Claude or Gemini config
- **WHEN** Uraniborg reads an older Claude or Gemini revision config from before the browser-login contract
- **THEN** Uraniborg preserves the data for migration and reporting purposes without silently upgrading it to a healthy browser-login-backed profile

#### Scenario: Successful re-setup upgrades stale config
- **WHEN** the user reruns revision setup successfully for a stale Claude or Gemini config
- **THEN** Uraniborg writes the current revision profile contract and replaces the stale record with the new browser-login-backed configuration
