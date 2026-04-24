## Context

The archived v1 contract assumed that Uraniborg would provision and invoke a pinned Feynman runtime under `~/.uraniborg/vendor/feynman`. UAT showed that this requirement added first-run friction, created a hard blocker when zero-state provisioning failed, and conflicted with a realistic local workflow where the user may already have a healthy Feynman installation outside Uraniborg's app home.

UAT also showed that `init` currently models refinement setup as low-level config entry rather than as a working first-run journey. The flow asks for internal API details too early, asks for the name of an environment variable instead of leading the user to a usable credential path, and can end in a state that looks configured while refinement is still not runnable.

This change therefore needs to revise three connected surfaces together:

- runtime discovery and compatibility checks for Feynman
- first-run refinement setup and readiness semantics
- `models` and `run` preflight behavior that depend on both of those contracts

## Goals / Non-Goals

**Goals:**

- Replace the pinned-runtime-only contract with a compatible-runtime discovery contract.
- Make `doctor` report operational readiness rather than file-location compliance.
- Redefine `init` so the normal path configures refinement with only three required inputs: OpenAI-compatible base URL, API key, and model name.
- Ensure Uraniborg never reports refinement as ready when required base URL, API key, or model inputs are still missing.
- Keep Uraniborg out of Feynman-owned internals while still using Feynman-owned setup and login flows for review-side remediation.

**Non-Goals:**

- Implementing the code changes in this spec change.
- Defining a new secret-storage backend in this design; the requirement is about user-facing setup semantics and readiness, not a specific storage mechanism.
- Solving packaging/bin-path issues, run execution bugs, or resume/history correctness beyond what must change in setup and preflight contracts.
- Reworking the review/refine artifact model or memory model.

## Decisions

### 1. Resolve Feynman by compatibility, not Uraniborg-owned location

Uraniborg will stop treating `~/.uraniborg/vendor/feynman` as the normal runtime contract. Instead it will discover a user-available `feynman` installation and validate that it satisfies Uraniborg's compatibility requirements before using it for review-side commands.

Rationale:

- matches the practical user requirement: Uraniborg needs usable Feynman, not a specific installation directory
- removes artificial first-run blockers on machines that already have a healthy Feynman install
- avoids making Uraniborg responsible for Feynman installation behavior in a non-standard location

Alternatives considered:

- keep pinned-runtime-only behavior and fix provisioning: rejected because it preserves a heavy ownership model for a risk the user explicitly judged as over-hedged
- allow arbitrary runtime fallback with no compatibility check: rejected because Uraniborg still needs deterministic validation of the runtime it uses

Runtime resolution order for v1 will be:

1. a user-configured explicit Feynman executable path, if Uraniborg supports that configuration surface
2. otherwise the first compatible `feynman` discovered on the effective `PATH`

If multiple candidates are discovered while scanning `PATH`, Uraniborg will choose the first compatible candidate in path order and report the exact executable it selected.

### 2. Treat readiness as operational, not declarative

`doctor`, `models`, and run preflight will report readiness based on whether Uraniborg can actually use the discovered review runtime and the configured refinement settings, not on whether a specific directory structure or partial config file exists.

Rationale:

- aligns product status with user reality
- prevents “setup complete” states that still fail immediately on the next command
- turns UAT findings into explicit readiness contracts

Alternatives considered:

- keep current field-presence checks and improve wording only: rejected because UAT showed the underlying completion semantics are wrong, not just the prompt copy

### 3. Make `init` a minimal runnable refinement setup journey

The normal `init` path will ask only for the OpenAI-compatible base URL, the API key, and the model name needed for refinement. Timeout, temperature, max-output-token, provider-routing, and env-var-name details are out of the normal v1 setup contract.

Rationale:

- matches the immediate product goal of getting refinement runnable with the smallest workable contract
- removes the low-level prompts that UAT showed were blocking or misleading in first-run setup
- directly addresses UAT findings that the current flow is too internal and leaves core setup incomplete

Alternatives considered:

- keep the current field-by-field form and add examples: rejected because it still exposes internal plumbing and leaves the setup contract broader than needed for v1
- build a provider-picker and model-routing TUI now: rejected because that is a v2 simplification goal, not part of the current bottleneck-removal change

### 4. Remove env-var naming and advanced refinement knobs from the basic setup contract

The basic refinement setup contract will no longer require the user to choose the name of an environment variable or provide advanced transport/tuning fields. Uraniborg may still use internal configuration structure behind the scenes, but those details must not be required concepts in the first-run path.

Rationale:

- directly addresses the UAT finding that setup can complete without the user ever being guided to provide the actual credential
- keeps v1 focused on the minimum information required to make refinement runnable

Alternatives considered:

- keep env-var naming as a required prompt: rejected because it makes the user solve an internal configuration problem instead of completing setup
- keep timeout, temperature, and token limits in the normal path: rejected because they do not remove the UAT bottleneck and add first-run ambiguity

### 5. Keep review-side remediation Feynman-owned

Even after removing the pinned-runtime-only contract, Uraniborg will still use Feynman-owned setup/login/remediation commands for review-side auth and provider access.

Rationale:

- preserves the intended ownership boundary
- avoids duplicating review-provider logic inside Uraniborg
- keeps the change focused on runtime discovery and setup contract, not on taking over Feynman internals

## Risks / Trade-offs

- `[More runtime ambiguity than pinned-only installs]` -> Require explicit compatibility checks and report the exact discovered runtime being used.
- `[Secret-entry expectations may force design trade-offs later]` -> Keep the spec focused on collecting an API key in the normal path and leave storage mechanics flexible.
- `[Minimal v1 setup may need redesign in v2]` -> Explicitly defer richer provider/vendor routing and model-selection TUI work to a later version.
- `[Existing tests and docs will become stale immediately]` -> Treat docs, readiness checks, and UAT expectations as part of the implementation tasks for this change.

## Migration Plan

1. Replace the pinned-runtime contract in setup and preflight surfaces with discovered-runtime compatibility checks.
2. Redesign `init` around minimal runnable refinement setup and operational readiness.
3. Update `models` and `run` preflight to reflect the new readiness model.
4. Update UAT documents and tests so first-run acceptance tracks the new setup contract.

Rollback strategy:

- If the implementation needs to be rolled back before release, Uraniborg can keep using the archived v1 contract, but that would knowingly preserve the UAT-discovered first-run issues.

## Open Questions

- What exact OpenAI-compatible base URL default, if any, should Uraniborg present during `init`?
- How should Uraniborg persist the API key collected during `init` while keeping the first-run flow simple?
