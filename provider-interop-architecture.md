# Reference Architecture for Multi-Provider LLM Interfacing on Pi

## Status

This document is a normative reference architecture for integrating the following model provider families into a **Pi-based** agentic runtime:

- OpenAI Codex through the ChatGPT subscription channel
- Anthropic Claude
- Google Gemini

This document is intentionally provider-focused and reusable. It does **not** assume any repository-specific modules, microservices, file layouts, or runtime names beyond the use of Pi as the underlying extension and runtime substrate.

The key words **MUST**, **SHOULD**, **MAY**, and **MUST NOT** are to be interpreted as normative requirements.

## 1. Scope

This architecture covers:

- how to build on top of Pi rather than replacing Pi internals
- provider registration and capability description
- authentication and credential lifecycle management
- request construction and transport selection
- streaming response handling and event normalization
- session continuity and provider-specific state
- security and operational requirements

This architecture does **not** prescribe:

- user interface design
- deployment topology
- business-specific orchestration logic
- repository-specific implementation names

## 1.1 Pi Foundation

This architecture assumes the target project already uses Pi and therefore MUST reuse Pi's existing primitives rather than reimplementing them.

At minimum, a conforming Pi-based implementation SHOULD treat the following Pi constructs as foundational:

| Pi construct | Architectural role |
| --- | --- |
| `AuthStorage` | secure credential persistence and runtime override handling |
| `ModelRegistry` | provider/model catalog, auth-aware model availability, request-time auth/header resolution |
| `createAgentSession()` | runtime session construction and model/tool binding |
| `streamSimple()` / provider adapters from `@mariozechner/pi-ai` | provider-native inference and streaming transport |
| `DefaultResourceLoader` | loading extensions, skills, prompts, themes, and context resources |
| `pi.registerProvider()` | extension-time registration or override of providers and models |
| `pi.unregisterProvider()` | dynamic removal of extension-registered providers |

Accordingly, the target project MUST NOT build a parallel multi-provider substrate from scratch when Pi already provides the relevant capability.

## 2. Architectural Objectives

An implementation conforming to this architecture MUST satisfy the following objectives:

1. Present a unified application-facing contract across multiple providers.
2. Reuse Pi's provider, auth, settings, and extension infrastructure rather than duplicating it.
2. Separate authentication bootstrap from inference transport.
3. Normalize provider-specific wire formats into a canonical event stream.
4. Preserve provider-specific capabilities without leaking provider-specific complexity into application call sites.
5. Support both API-key and OAuth-based providers under one credential model.
6. Support resumable sessions where the provider semantics require session affinity or replay-safe context reconstruction.

## 3. Reference Component Model

The implementation SHOULD be decomposed into the following logical components:

| Component | Responsibility |
| --- | --- |
| `Pi Runtime Shell` | hosts sessions, extension loading, settings, and runtime event flow |
| `ProviderRegistry` | realized primarily through Pi `ModelRegistry`; declares providers, models, capabilities, endpoints, and authentication modes |
| `CredentialResolver` | realized primarily through Pi `AuthStorage` plus provider-specific refresh logic |
| `ProviderBootstrap` | Executes login, consent, API-key capture, token refresh, or project/account discovery |
| `RequestComposer` | Converts canonical conversation state into provider-specific request payloads |
| `TransportDriver` | Executes HTTP, SSE, or WebSocket transport and applies provider-specific headers |
| `StreamNormalizer` | Converts provider-native streaming events into a canonical runtime event protocol |
| `SessionManager` | Maintains session identity, replay state, prompt-cache affinity, and provider continuity metadata |
| `CapabilityPolicy` | Applies provider-specific constraints such as service tier, reasoning mode, or transport eligibility |
| `Extension Layer` | uses Pi extension hooks and `pi.registerProvider()` to add or override providers without modifying Pi internals |

These components MUST remain separable. In particular, `CredentialResolver` MUST NOT be embedded inside `TransportDriver`, and `RequestComposer` MUST NOT depend on user interface state.

## 3.1 Pi Reuse Model

Pi-based projects SHOULD adopt one of the following extension patterns:

1. **Built-in provider reuse**
   Use Pi's existing providers and configure them through `AuthStorage`, `ModelRegistry`, and optional `models.json` overrides.

2. **Built-in provider override**
   Keep Pi's provider identity, but override base URL, headers, compatibility flags, or model catalog through `pi.registerProvider()` or provider configuration.

3. **Custom provider registration**
   Register a new provider through `pi.registerProvider()` when the provider requires non-standard API behavior, a custom OAuth flow, or a custom `streamSimple` implementation.

The target project SHOULD prefer the least invasive option that satisfies the provider requirements.

## 4. Canonical Contracts

### 4.1 Provider Descriptor

Each provider SHOULD be represented by a descriptor of the following shape:

```ts
type AuthMode = "api-key" | "oauth" | "adc";
type TransportMode = "https" | "sse" | "websocket";

interface ProviderDescriptor {
  providerId: string;
  family: "openai-codex" | "anthropic" | "gemini";
  modelId: string;
  endpointPolicy: EndpointPolicy;
  authPolicy: AuthPolicy;
  transportPolicy: TransportPolicy;
  capabilityPolicy: CapabilityPolicy;
}
```

### 4.2 Credential Record

```ts
interface CredentialRecord {
  mode: "api-key" | "oauth" | "adc";
  secret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  projectId?: string;
  metadata?: Record<string, string>;
}
```

The canonical `CredentialRecord` above is application-facing and provider-neutral. A Pi-based implementation MAY persist an equivalent provider-native record shape in `AuthStorage`, for example Pi's built-in OAuth entries of the form `type: "oauth"` with fields such as `access`, `refresh`, `expires`, `accountId`, `projectId`, or provider-specific metadata.

### 4.3 Canonical Event Stream

The provider output MUST be normalized into an implementation-wide event model such as:

```ts
type AssistantEvent =
  | { type: "start" }
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number }
  | { type: "toolcall_start"; contentIndex: number }
  | { type: "toolcall_delta"; contentIndex: number; partial: unknown }
  | { type: "toolcall_end"; contentIndex: number }
  | { type: "done"; reason: "stop" | "length" | "tool_use" | "error" | "aborted" }
  | { type: "error"; message: string };
```

Application code SHOULD consume only this normalized stream.

## 5. Control Plane Architecture

### 5.1 General Rules

- Authentication bootstrap MUST occur outside the request path.
- The runtime request path MUST receive already-resolved credentials.
- Pi's `AuthStorage` and `ModelRegistry` SHOULD remain the source of truth for credential and provider resolution.
- Credential storage MUST be distinct from session transcript storage.
- Provider configuration MUST be distinct from credential storage.
- Credentials stored on disk MUST use user-restricted permissions.

### 5.2 Resolution Order

The implementation SHOULD resolve credentials in the following order:

1. explicit runtime override
2. secure credential store
3. environment variable mapping
4. provider-specific dynamic secret resolver

This order ensures deterministic override behavior while preserving operational flexibility.

In a Pi-based implementation, this resolution order SHOULD be delegated to Pi's `AuthStorage` and `ModelRegistry` rather than recreated in application code.

When Pi's `AuthStorage` is reused for OAuth providers, a conforming implementation SHOULD rely on Pi's built-in refresh behavior, including request-time refresh of expired credentials and backend locking to prevent concurrent refresh races across multiple runtime instances.

### 5.3 Supported Authentication Classes

| Authentication class | Use cases |
| --- | --- |
| API key | Direct Anthropic API, direct Gemini API, some enterprise Gemini variants |
| OAuth 2.0 with PKCE | OpenAI Codex via ChatGPT subscription channel, Claude subscription flows, Gemini CLI / Cloud Code Assist |
| Application Default Credentials (ADC) or service account | Vertex-style enterprise Gemini deployments |

## 6. Data Plane Architecture

### 6.1 Request Composition

The `RequestComposer` MUST:

- accept canonical conversation state
- emit provider-native payloads
- inject system instructions in a provider-safe manner
- translate tool schemas into provider-specific tool definitions
- preserve replay-safe reasoning and tool-result continuity

In a Pi-based implementation, the application SHOULD reuse Pi's provider adapters and `streamSimple()` call path wherever the provider follows one of Pi's supported API families.

### 6.2 Transport

The `TransportDriver` MUST:

- set provider-required headers
- select the correct transport mode
- perform retries only where the transport semantics support safe retry
- surface raw provider response metadata to observability hooks

Pi's settings layer already models transport preference such as `sse`, `websocket`, and `auto`. Pi-based projects SHOULD use that transport preference model rather than inventing a parallel transport configuration mechanism.

### 6.3 Stream Normalization

The `StreamNormalizer` MUST:

- map provider-native event types to the canonical event model
- compute or capture usage metadata when available
- preserve provider stop reasons where meaningful
- discard transport-only scratch state before persistence

## 7. Provider Family Profiles

### 7.1 OpenAI Codex Through the ChatGPT Subscription Channel

#### 7.1.1 Architectural Role

This provider family represents the ChatGPT subscription-backed Codex path. It is architecturally distinct from the OpenAI Platform API and MUST be treated as a separate provider family.

#### 7.1.2 Authentication

- Authentication MUST use a bearer token obtained through an OAuth-style login flow or equivalent subscription-backed token acquisition mechanism.
- The token MUST carry an account identifier claim that can be extracted and forwarded as a request header.
- This provider family SHOULD be treated as explicit-token or secure-store driven. It SHOULD NOT assume a generic ambient API-key environment variable.

In a Pi-based implementation, this provider SHOULD be integrated as a Pi provider profile that reuses Pi session, transport, and event-normalization behavior while delegating credential bootstrap to Pi-managed OAuth storage.

#### 7.1.3 Endpoints

The canonical base endpoint is:

```text
https://chatgpt.com/backend-api
```

The request endpoint MUST normalize to:

```text
POST /codex/responses
```

If WebSocket transport is used, the same endpoint MUST be protocol-translated to:

```text
wss://.../codex/responses
```

#### 7.1.4 Request Model

The request payload SHOULD follow a Responses-style structure:

- instructions
- input messages
- streaming enabled
- tool choice and parallel tool call policy
- optional reasoning controls
- optional session-affinity key

#### 7.1.5 Required Headers

The transport layer MUST attach:

- `Authorization: Bearer <token>`
- account identifier header
- client identity header set

SSE and WebSocket modes MAY require different beta or transport-negotiation headers.

#### 7.1.6 Transport Modes

This provider family supports:

- SSE / HTTPS
- WebSocket
- an automatic mode that attempts WebSocket before falling back to SSE

The implementation MUST define explicit fallback rules:

- `sse`: use HTTP/SSE only
- `websocket`: use WebSocket only; no downgrade
- `auto`: attempt WebSocket first; fall back to SSE only if the socket fails before streaming has materially started

#### 7.1.7 Session Semantics

- Session identity SHOULD be reused as prompt-cache affinity metadata on SSE.
- Session identity MAY also be used to key a process-local WebSocket cache.
- WebSocket reuse MUST have an idle-expiry policy and MUST NOT be assumed durable across process boundaries.

### 7.2 Anthropic Claude

#### 7.2.1 Architectural Role

Anthropic Claude SHOULD be modeled as one provider family with two authentication modes:

- direct API key
- OAuth-backed bearer token

The runtime contract MUST remain constant across both modes.

In Pi, the built-in provider identity for this family is `anthropic`. A conforming Pi-based implementation SHOULD reuse that provider identity for both API-key and OAuth-backed Claude rather than introducing separate application-defined provider ids.

#### 7.2.2 Authentication

- API-key mode MUST support secure storage and environment-variable resolution.
- OAuth mode MUST use an authorization-code flow with PKCE or an equivalent refreshable token architecture.
- OAuth credentials MUST include access token, refresh token, and expiry.
- The `CredentialResolver` MUST be able to refresh an expired token before inference.

In Pi-based projects, these two modes SHOULD remain one provider family with mode-aware credential resolution rather than two unrelated application integrations.

For Pi built-in reuse, the preferred OAuth bootstrap sequence is:

1. Call `AuthStorage.login("anthropic", callbacks)` or the equivalent built-in provider login path.
2. Let Pi start its built-in localhost callback server on `127.0.0.1:53692` with redirect URI `http://localhost:53692/callback`.
3. Let Pi open or display the authorization URL for the browser flow.
4. If `onManualCodeInput` is available, race the browser callback against a user-pasted redirect value.
5. If neither path yields a code, prompt the user to paste either the raw authorization code or the full redirect URL.
6. Let Pi perform token exchange and persist the resulting OAuth credential through `AuthStorage`.

Pi's built-in Anthropic parser accepts either a raw code or a full redirect value containing `code` and `state`. An implementation SHOULD preserve that flexibility rather than narrowing the manual fallback to one input shape.

The implementation MUST NOT reimplement PKCE, callback handling, state validation, token exchange, or token refresh when Pi's built-in `anthropic` OAuth provider is available.

The built-in Pi Anthropic OAuth path is Node/Bun CLI-oriented. It uses a localhost callback server plus manual paste fallback; it does not provide a device-code flow.

When Pi's built-in `anthropic` OAuth provider is reused, the browser consent screen branding is owned by the OAuth client registration behind that provider, not by the embedding application. A Pi-based application SHOULD therefore expect provider-native or upstream-tool branding such as `Claude Code` on the consent screen unless it deliberately stops reusing the built-in provider and registers its own first-party OAuth client.

For Pi's built-in `anthropic` OAuth path, the persisted credential contract is effectively:

```ts
{
  type: "oauth";
  access: string;
  refresh: string;
  expires: number;
}
```

Anthropic does not require additional tenant, account, or project context in the credential object.

Pi's refresh behavior SHOULD be treated as authoritative:

- expired Anthropic OAuth credentials SHOULD be refreshed lazily at request time
- refreshed expiry SHOULD use a safety buffer before the server-advertised absolute expiry
- application code SHOULD consume Pi's resolved auth result rather than refreshing tokens independently

If environment fallback is in play, Pi's Anthropic resolution prefers `ANTHROPIC_OAUTH_TOKEN` ahead of `ANTHROPIC_API_KEY`. An implementation that documents environment resolution SHOULD reflect that actual precedence.

#### 7.2.3 Base URL Semantics

The canonical base URL MUST be the API root, not the `/v1` subpath. The transport layer SHOULD append the correct path segments internally.

For compatibility with proxies, the implementation MAY permit a root base URL override and MAY optionally duplicate bearer authentication in addition to the native key header model.

When Pi's built-in Anthropic adapter is reused, the application SHOULD pass the API root or proxy root only. Pi passes `model.baseUrl` through to the Anthropic SDK, and the SDK itself appends `/v1/messages` and related API paths. Application code SHOULD NOT append `/v1` manually.

#### 7.2.4 Request Model

The `RequestComposer` MUST produce Anthropic Messages API payloads.

It SHOULD support:

- system prompt injection
- tool use encoding
- streaming
- reasoning or thinking blocks
- cache-control markers where the provider supports them

#### 7.2.5 Required Headers

API-key mode SHOULD attach:

- `x-api-key`
- explicit version header

OAuth mode MAY require additional identity headers such as:

- client identity
- beta feature declarations
- user-agent or application identity

These mode-specific headers MUST be encapsulated inside `TransportDriver`, not application logic.

When Pi's built-in Anthropic adapter is reused, the explicit version header and SDK-required request wiring SHOULD remain SDK-owned or provider-owned behavior, not application-owned behavior.

#### 7.2.6 Session and Caching Semantics

Anthropic caching SHOULD be modeled as transport-level cache control, not transcript-level session state.

The implementation MAY mark selected prompt segments as cacheable or ephemeral where the provider supports explicit cache directives.

Pi ownership boundaries for Claude SHOULD be explicit:

- Pi owns OAuth plumbing, token exchange, refresh, env precedence, and request-time auth/header synthesis
- application code owns UI presentation, optional persistence only if it bypasses `AuthStorage`, and transcript/session state
- transcript/session state MUST remain separate from OAuth credential state

### 7.3 Google Gemini

#### 7.3.1 Architectural Role

Gemini MUST be modeled as a provider family with multiple credential and endpoint variants rather than a single integration.

At minimum, the architecture SHOULD distinguish:

- direct Gemini API
- Gemini CLI / Cloud Code Assist style OAuth path
- Vertex-style enterprise deployment

For Pi-based reuse, these SHOULD map to explicit Pi provider identities rather than one overloaded `gemini` implementation:

| Variant | Pi provider id | Primary auth class | Default endpoint family | Project context source |
| --- | --- | --- | --- | --- |
| direct Gemini API | `google` | API key | `https://generativelanguage.googleapis.com/v1beta` | none in credential |
| Gemini CLI / Cloud Code Assist | `google-gemini-cli` | OAuth 2.0 with PKCE | `https://cloudcode-pa.googleapis.com` | `projectId` stored in OAuth credential |
| Google Antigravity variant | `google-antigravity` | OAuth 2.0 with PKCE | sandbox or Google-managed Cloud Code Assist endpoints | `projectId` stored in OAuth credential |
| Vertex AI | `google-vertex` | ADC, service account, or enterprise API key | `https://{location}-aiplatform.googleapis.com` | runtime config or env, not OAuth credential state |

An implementation SHOULD expose `google-gemini-cli` as the default browser-login Gemini path unless it intentionally offers `google-antigravity` as a distinct advanced or experimental variant. It MUST NOT silently substitute one for the other.

#### 7.3.2 Authentication

Direct Gemini API:

- API-key based
- suitable for standard developer access

Gemini CLI / Cloud Code Assist:

- OAuth-based
- token acquisition SHOULD also resolve provider-owned project context where required

Vertex-style enterprise deployment:

- ADC or service account credentials
- MAY also support API-key variants depending on deployment mode

Pi-based projects SHOULD represent these as distinct Pi provider identities or variants where the account-context contract differs materially.

For Pi built-in reuse, the preferred browser-login recipe for `google-gemini-cli` is:

1. Call `AuthStorage.login("google-gemini-cli", callbacks)` or the equivalent built-in provider login path.
2. Let Pi start its built-in localhost callback server on `127.0.0.1:8085` with redirect URI `http://localhost:8085/oauth2callback`.
3. Let Pi drive the PKCE authorization-code flow in the browser.
4. If `onManualCodeInput` is available, race the browser callback against a user-pasted redirect URL.
5. Let Pi exchange the code for refreshable credentials, fetch optional user email, and discover or provision the Cloud Code Assist project context.
6. Persist the resulting OAuth credential through `AuthStorage`.

The manual path for Pi's Gemini OAuth flows is a pasted redirect URL, not a device-code flow. The built-in implementation validates returned state against the PKCE verifier and fails closed on mismatch.

When Pi's built-in Gemini OAuth providers are reused, the browser consent screen branding is owned by the underlying OAuth client registration, not by the embedding application. A Pi-based application SHOULD expect provider-native or upstream-tool branding such as `Gemini CLI`, `Cloud Code Assist`, or other Google-owned client identity on the consent screen unless it deliberately registers and maintains its own first-party OAuth client instead of reusing Pi built-ins.

For Pi's built-in `google-gemini-cli` OAuth path, the persisted credential contract is effectively:

```ts
{
  type: "oauth";
  access: string;
  refresh: string;
  expires: number;
  projectId: string;
  email?: string;
}
```

The provider-owned `projectId` is mandatory. Login MUST fail if required project context cannot be discovered or provisioned.

At request time, Pi's built-in `google-gemini-cli` provider treats the resolved auth material as an opaque provider payload rather than a raw bearer token. Its `getApiKey()` contract serializes the credential as JSON containing both token and project id. Application code SHOULD treat that Pi-resolved value as opaque and MUST NOT assume that a Gemini OAuth credential resolves to a bare access token string.

If Google does not return a new refresh token during refresh, the built-in Pi Gemini OAuth helpers preserve the existing refresh token. Application code SHOULD NOT treat refresh-token rotation as guaranteed on every refresh response.

`google-antigravity` SHOULD be documented as a separate Pi-managed OAuth variant, not as an alias for `google-gemini-cli`. It uses its own client credentials, callback server on `127.0.0.1:51121` with redirect URI `http://localhost:51121/oauth-callback`, and endpoint defaults, while still following the same high-level Pi ownership model of PKCE, callback-server handling, refresh, and `projectId`-bearing OAuth credentials.

#### 7.3.3 Project and Account Context

For OAuth-based Gemini variants, the credential object SHOULD include both:

- access token
- project identifier or equivalent tenant context

The transport path MUST reject credentials that are missing mandatory project context.

The architecture MUST distinguish two different forms of Gemini project context:

- for `google-gemini-cli` and `google-antigravity`, `projectId` is credential state discovered or confirmed during OAuth bootstrap and persisted with the OAuth record
- for `google-vertex`, project and location are runtime/provider configuration, not OAuth credential state

For `google-gemini-cli`, Pi's built-in bootstrap MAY consult `GOOGLE_CLOUD_PROJECT` or `GOOGLE_CLOUD_PROJECT_ID` when the account tier requires caller-supplied project selection.

#### 7.3.4 Endpoints

Direct Gemini API SHOULD use a Generative AI endpoint family and MAY allow explicit base URL override for custom or proxied deployments.

Gemini CLI / Cloud Code Assist SHOULD be treated as provider-owned endpoints with limited or no application-managed base URL responsibility.

Vertex deployments MUST carry project and location context and SHOULD be treated as enterprise cloud endpoints rather than consumer API endpoints.

If Pi's built-in providers are reused, the default endpoint expectations are:

- `google`: Generative AI base URL family
- `google-gemini-cli`: `https://cloudcode-pa.googleapis.com`
- `google-antigravity`: provider-managed Google Cloud Code Assist endpoint family, with sandbox-oriented defaults
- `google-vertex`: `https://{location}-aiplatform.googleapis.com`

Application code SHOULD NOT normalize these variants into one endpoint template.

#### 7.3.5 Request and Stream Model

The runtime contract SHOULD remain provider-neutral:

- canonical context in
- normalized stream of assistant events out

The application MUST NOT branch on Gemini sub-variant inside ordinary message orchestration code.

The built-in Pi Cloud Code Assist Gemini paths are currently SSE-over-HTTPS transports. An implementation that reuses Pi built-ins SHOULD document them as SSE-based today and MUST NOT claim built-in WebSocket transport support unless it has registered a custom provider that actually implements it.

Pi ownership boundaries for Gemini SHOULD be explicit:

- Pi owns OAuth callback handling, token exchange, refresh, auth-file persistence, project discovery or provisioning where built-in providers support it, and request-time auth/header synthesis
- application code owns UX, profile or variant selection, and transcript/session state
- transcript/session state MUST remain separate from OAuth credential state such as `projectId`

## 8.1 OAuth Branding Trade-off

When a Pi-based implementation reuses Pi's built-in OAuth providers, it is reusing the OAuth client registrations, redirect-uri registrations, and provider-approved app identities attached to those providers. The consent-screen branding seen by the user therefore comes from those upstream OAuth clients rather than from the embedding application.

Consequently:

- Pi built-in reuse SHOULD be understood as a deliberate trade-off: fastest path to working browser login, but consent screens may show provider-native or upstream-tool branding rather than the embedding application's name
- an application that requires first-party consent branding MUST register and maintain its own OAuth clients and redirect URIs instead of relying exclusively on Pi's built-in provider registrations
- this trade-off applies independently to Claude, OpenAI/Codex, Gemini, and any other Pi-managed OAuth provider

## 8. Cross-Provider Design Rules

1. A provider family MUST be identified by both protocol and credential regime.
2. Authentication mode MUST NOT alter the application-facing inference contract.
3. Endpoint normalization MUST be owned by provider metadata and transport code.
4. Session state MUST be explicit, not implicit.
5. Provider-native replay constraints MUST be handled in request transformation, not in business logic.
6. Provider-specific headers MUST remain encapsulated.
7. Catalog overlays MUST be additive. They MUST enrich model metadata rather than fork provider logic.
8. Pi extension APIs SHOULD be the primary mechanism for provider addition or override.
9. Application code SHOULD sit above Pi's runtime and provider layers, not beside them.

## 9. Security Requirements

- Credentials at rest MUST use least-privilege filesystem permissions.
- Refresh tokens MUST be stored separately from session transcripts.
- Account identifiers and project identifiers SHOULD be treated as sensitive metadata.
- OAuth callback handlers MUST validate state and SHOULD use PKCE.
- Transport drivers MUST avoid logging bearer tokens, refresh tokens, API keys, or full authorization headers.
- Optional secret resolvers MAY be supported, but they MUST be resolved before request dispatch and MUST expose deterministic failure modes.

## 10. Operational Requirements

- Retry policy MUST be transport-aware.
- WebSocket reuse MUST have bounded lifetime.
- Provider capability metadata SHOULD include reasoning support, service-tier constraints, transport support, and caching support.
- Observability hooks SHOULD receive provider response status and headers in sanitized form.
- A conformance suite SHOULD validate request composition, transport selection, header policy, replay behavior, and credential refresh behavior independently.

For Pi-based projects, the conformance suite SHOULD also verify:

- correct `pi.registerProvider()` behavior for custom or overridden providers
- `AuthStorage` and `ModelRegistry` interoperability
- extension reload safety and provider re-registration behavior

## 11. Recommended Implementation Sequence

1. Implement `ProviderRegistry`.
2. Map `ProviderRegistry` and `CredentialResolver` onto Pi `ModelRegistry` and `AuthStorage`.
3. Implement provider registration and override policy through Pi extensions and `pi.registerProvider()`.
4. Implement `RequestComposer` and `StreamNormalizer` only where Pi's built-in adapters are insufficient.
5. Implement one `TransportDriver` per provider family only when Pi does not already supply the required transport behavior.
6. Add `SessionManager` semantics only after transport behavior is stable.
7. Add capability policies such as reasoning mode, service tier, and prompt caching.

## 12. Conformance Summary

An implementation conforms to this reference architecture if it:

- is explicitly Pi-based and reuses Pi runtime primitives
- exposes a unified runtime contract for OpenAI Codex, Anthropic Claude, and Google Gemini
- keeps authentication bootstrap outside the request path
- normalizes provider-native streams into one canonical event model
- models provider families and authentication modes explicitly
- preserves provider-specific endpoint and header semantics inside transport adapters
- treats session continuity as an explicit architectural concern rather than an incidental implementation detail

## Appendix A. Pi Primitives

This appendix makes the document self-contained for implementers who are not already familiar with Pi.

### A.1 `AuthStorage`

`AuthStorage` is Pi's credential persistence and resolution primitive. It is responsible for storing API keys and OAuth credentials, supporting runtime-only credential overrides, and participating in the final credential lookup order used by inference requests.

In a Pi-based implementation, `AuthStorage` SHOULD be treated as the system of record for provider credentials. Application code SHOULD NOT implement a parallel credential store unless there is an external secret-management requirement that cannot be mediated through Pi.

### A.2 `ModelRegistry`

`ModelRegistry` is Pi's provider and model catalog. It combines built-in provider definitions with custom provider configuration, determines which models are available under the current credential state, and resolves request-time authentication material and headers for a given provider or model.

In a Pi-based implementation, `ModelRegistry` SHOULD be the authoritative source for provider descriptors, availability, and per-request auth/header resolution. Projects SHOULD extend or override provider behavior through Pi-compatible registry mechanisms rather than inventing a separate provider catalog.

### A.3 `createAgentSession()`

`createAgentSession()` is Pi's main runtime session constructor. It assembles a working agent session from model state, auth state, session management, tool bindings, and resource loading, and exposes a programmatic session interface for prompting, streaming, and session lifecycle management.

In a Pi-based project, `createAgentSession()` SHOULD be treated as the boundary between platform wiring and application orchestration. Projects SHOULD build their domain logic on top of Pi sessions rather than bypassing Pi's runtime construction path.

### A.4 `streamSimple()`

`streamSimple()` is the Pi AI abstraction that invokes provider-specific streaming adapters while exposing a uniform interface to the caller. It delegates provider-specific payload shaping, transport behavior, and auth-aware request dispatch to the selected model provider implementation.

In this architecture, `streamSimple()` is the preferred entry point whenever the provider is already covered by Pi's supported API families. A project SHOULD only implement a custom streaming adapter when the provider uses a non-standard wire protocol or a materially different authentication and transport contract.

### A.5 `pi.registerProvider()`

`pi.registerProvider()` is Pi's extension-time mechanism for registering, overriding, or augmenting model providers dynamically. It supports endpoint overrides, custom headers, model catalog replacement, OAuth-capable providers, and fully custom streaming implementations.

In a Pi-based project, `pi.registerProvider()` SHOULD be the primary extensibility surface for provider customization. Projects SHOULD prefer provider registration or override through extensions before considering direct modification of Pi internals.

### A.6 `DefaultResourceLoader`

`DefaultResourceLoader` is Pi's discovery and loading mechanism for extensions, skills, prompt templates, themes, and related context resources. It provides the standard way for a Pi runtime to locate and bind extension code and associated assets.

In a Pi-based provider architecture, `DefaultResourceLoader` matters because provider registration often happens through Pi extensions. A project SHOULD use Pi's resource loading model so that provider registration, prompt loading, and extension reload behavior remain aligned with the runtime.

## Appendix B. Authoritative References

The following references are the recommended grounding sources for an implementing model or engineer.

### B.1 Pi SDK

- Local path: [sdk.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md`

### B.2 Pi Extensions

- Local path: [extensions.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md`

### B.3 Pi Custom Providers

- Local path: [custom-provider.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/custom-provider.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/custom-provider.md`

### B.4 Pi Provider Configuration and Authentication

- Local path: [providers.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/providers.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/providers.md`

### B.5 Pi Model Configuration

- Local path: [models.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/docs/models.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md`

### B.6 Pi AI Provider Overview

- Local path: [README.md](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/README.md)
- Canonical upstream URL: `https://github.com/badlogic/pi-mono/blob/main/packages/ai/README.md`

### B.7 Installed Package Metadata

- Local path: [pi-coding-agent package.json](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/package.json)
- Local path: [pi-ai package.json](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/package.json)

These package manifests record the upstream repository coordinates used by the installed packages:

- repository: `https://github.com/badlogic/pi-mono.git`
- coding-agent directory: `packages/coding-agent`
- ai directory: `packages/ai`

### B.8 Pi OAuth Built-ins Referenced by This Architecture

- Claude / Anthropic OAuth provider: [anthropic.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/dist/utils/oauth/anthropic.js)
- Gemini CLI / Cloud Code Assist OAuth provider: [google-gemini-cli.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/dist/utils/oauth/google-gemini-cli.js)
- Google Antigravity OAuth provider: [google-antigravity.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/dist/utils/oauth/google-antigravity.js)
- OAuth provider registry helpers: [index.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-ai/dist/utils/oauth/index.js)

### B.9 Pi Auth and Provider Resolution Implementations

- Auth persistence and refresh locking: [auth-storage.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/dist/core/auth-storage.js)
- Model and provider resolution: [model-registry.js](/Users/shahmahdihasan/feynman/node_modules/@mariozechner/pi-coding-agent/dist/core/model-registry.js)
