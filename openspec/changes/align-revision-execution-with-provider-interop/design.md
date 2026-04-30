## Context

The repository has already completed the revision configuration and auth/bootstrap half of provider interop:

- `OpenAI/Codex` is modeled as a Pi-backed ChatGPT/Codex browser-login profile.
- `Claude` is modeled as Pi provider `anthropic`.
- `Gemini` is modeled as Pi provider `google-gemini-cli`.
- revision readiness already understands managed credential state and required provider context.

The remaining mismatch is execution. The current refinement runtime still assumes a single transport contract:

- build one refinement prompt
- POST it to `<baseUrl>/chat/completions`
- attach `Authorization: Bearer <apiKey>`
- parse an OpenAI-compatible response envelope

That worked for the original v1 manual-compatible path, but it is now the wrong abstraction for managed `OpenAI/Codex`, `Claude`, and `Gemini` profiles. The product loop itself is still correct: Uraniborg should remain artifact-driven, deterministic, resumable from local state, and strict about parse failures. What must change is the boundary between the loop and the model runtime.

This design therefore focuses on the execution seam, not on reworking the run state machine or the refine prompt contract.

## Goals / Non-Goals

**Goals:**

- Introduce a provider-neutral revision execution seam for iterative refinement.
- Reuse Pi-managed auth and provider/runtime resolution for managed revision profiles instead of recreating provider-specific HTTP logic inside Uraniborg.
- Preserve the existing Uraniborg responsibilities:
  - refinement prompt assembly
  - refinement output parsing
  - artifact writes
  - manifest/state-machine transitions
  - deterministic local resume behavior
- Keep `manual-openai-compatible` as the explicit direct API-key fallback path.
- Make run snapshots, diagnostics, and model selection reflect the active revision profile and execution path.

**Non-Goals:**

- Redesign the review side or Feynman-owned runtime.
- Add tool-calling, multi-turn agent behavior, or provider-side conversation persistence to the refinement loop.
- Expose multiple saved revision accounts or profile switching UX.
- Implement every future Gemini variant such as Vertex or `google-antigravity`.
- Make provider-side session continuity part of correctness for v1 runtime resume.

## Decisions

### 1. Uraniborg keeps the orchestration loop; Pi owns provider-specific execution details

The run loop in `src/loop/run-execution.ts` remains the control-plane source of truth. Uraniborg continues to:

- read `current.md`, `review.md`, and `information-highway.md`
- build the refinement prompt
- execute one refinement attempt per step
- parse the returned model output against the strict `REFINED_DRAFT` / `CHANGE_SUMMARY` contract
- write `refine.log`, `refined.md`, and `changes.md`
- advance or fail the manifest state machine

Pi becomes the data-plane/runtime seam for managed profiles:

- resolve runtime auth state for the selected revision profile
- apply provider-specific transport/auth/header/session shaping
- surface normalized execution output back to Uraniborg

Alternatives considered:

- Move prompt assembly and output parsing into Pi.
  - Rejected because Uraniborg owns the refinement contract and anti-oscillation memory semantics.
- Keep provider-specific HTTP logic inside Uraniborg for each managed profile.
  - Rejected because it duplicates exactly the provider/runtime surface the architecture intends Pi to own.

### 2. Introduce a dedicated revision execution adapter layer with one Uraniborg-facing contract

Execution should be split into:

- transport-agnostic Uraniborg refinement contract
- provider/runtime adapter implementation

The Uraniborg-facing request should include:

- selected revision profile id
- selected refine model
- revision auth/acquisition mode
- provider context if required
- prompt payload:
  - system prompt
  - current draft
  - peer review
  - information highway
- execution options such as timeout and optional temperature/max tokens

The Uraniborg-facing result should include:

- normalized output text for parsing
- sanitized execution metadata for `refine.log`
- provider/model identity actually used
- raw timing/stop/usage data if available and safe to persist

Alternatives considered:

- Continue calling `executeRefinement()` directly and branch inside it by profile.
  - Rejected because the current module is shaped around one HTTP schema and would become a brittle mixed abstraction.
- Put adapter selection directly in `run-execution.ts`.
  - Rejected because it would spread execution policy into the loop orchestration file.

### 3. Managed profiles are resolved at runtime through Pi; manual-compatible remains the only direct API-key transport

The execution resolver should distinguish:

- managed Pi-backed profiles:
  - `openai-codex-chatgpt`
  - `claude-browser`
  - `gemini-cloud-code-assist`
- direct fallback profile:
  - `manual-openai-compatible`

For managed profiles:

- runtime must not require a raw API key in Uraniborg config
- runtime must use Pi-managed credential state and provider-specific runtime wiring
- required provider context must already be validated before execution starts

For `manual-openai-compatible`:

- keep the existing endpoint-plus-API-key execution path
- retain operator override semantics

Alternatives considered:

- Remove `manual-openai-compatible` from runtime support once managed profiles exist.
  - Rejected because it is still the explicit escape hatch and compatibility path.
- Treat managed and manual paths identically after “secret resolution”.
  - Rejected because managed profiles do not reduce to one bearer token plus one endpoint contract.

### 4. Provider-side session continuity is optional optimization, not correctness state

The local run manifest and artifact tree remain the only required correctness boundary for resume. Provider-side conversation or session state may be created internally by Pi-backed execution, but Uraniborg must not depend on it to resume a run.

Implications:

- rerunning a `refine_running` step must be valid without a saved remote conversation id
- the manifest does not need to persist provider session identifiers for correctness
- provider-side session affinity can be internal and ephemeral

Alternatives considered:

- Persist provider conversation/session ids into the manifest and require them for resume.
  - Rejected because it would make local recovery dependent on opaque remote state and violate the artifact-driven run model.

### 5. Run snapshots and diagnostics must become revision-profile-aware

Current snapshot and doctor semantics are API-key-era:

- endpoint base URL
- `apiKeyConfigured`
- default model string

The updated runtime needs to surface:

- active revision profile id and label
- auth class and acquisition mode
- credential binding type
- provider context summary where relevant
- endpoint details only when meaningful, especially for manual-compatible
- runtime readiness/executability status distinct from setup-readiness wording

Alternatives considered:

- Keep existing snapshot fields and add only a note for managed profiles.
  - Rejected because it would continue to imply API-key readiness as the runtime truth.

## Risks / Trade-offs

- [Risk] Pi runtime helpers may expose provider-specific output shapes that are not fully uniform. → Mitigation: keep one normalization boundary between adapter output and Uraniborg parsing/logging.
- [Risk] OpenAI/Codex, Claude, and Gemini may differ in streaming and completion-stop semantics. → Mitigation: define a minimal normalized result contract around final text output first; defer richer provider-specific telemetry unless stable.
- [Risk] The manual-compatible path could regress while managed profiles are added. → Mitigation: preserve it as an explicit adapter path with regression coverage.
- [Risk] Doctor and model-selection output may become noisier once provider/runtime details are exposed. → Mitigation: keep operator-facing reporting concise and profile-centric, with deeper detail only in logs or `--config`.
- [Trade-off] Not persisting provider-side session identity keeps resume simple and robust, but may sacrifice some remote continuity optimizations. → Mitigation: allow adapters to use ephemeral continuity internally without making it part of correctness.
- [Trade-off] A provider-neutral Uraniborg contract may flatten some provider-specific richness. → Mitigation: include optional metadata fields in the normalized execution result without leaking provider-specific control flow into the loop.

## Migration Plan

1. Add the new revision execution seam and preserve the current manual-compatible HTTP path as one adapter implementation.
2. Move managed profile runtime resolution from “unsupported auth class” to Pi-backed execution adapters.
3. Update run snapshots, doctor, and models output to reflect revision-profile-aware runtime state.
4. Add regression coverage for:
   - managed profile runtime readiness
   - manual-compatible fallback
   - resume after `refine_running`
   - malformed refinement output handling
5. Keep old config compatibility paths intact; this change does not remove legacy parse/migration behavior.

Rollback strategy:

- revert the execution adapter integration and fall back to the existing manual-compatible-only runtime behavior
- because auth/bootstrap state stays in Pi and config schema stays unchanged, rollback does not need config migration

## Open Questions

- Which exact Pi execution primitive should be the first runtime seam: `streamSimple()`, `createAgentSession()`, or a thinner provider call helper?
- Should `models` expose only configured/default refine model values for managed profiles, or should it also show Pi-visible available models when runtime discovery is cheap and deterministic?
- How much execution metadata is stable enough across providers to persist into `refine.log` without overfitting to one provider’s event schema?
