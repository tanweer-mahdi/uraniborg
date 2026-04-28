## Context

Uraniborg already corrected the major first-run contract and serialized-runtime issues, but UAT still exposed four high-signal UX gaps:

- review-side remediation still reports raw process outcomes such as `exit 0`
- missing web-search configuration is routed to generic `feynman setup`
- `init` is still the only guided entry point for revision configuration even though users revisit it after first setup
- operator-facing CLI text still says `refinement` even where the product language should now be `revision`

The current code shape explains the routing bug. `doctor` builds remediation actions from readiness checks, `web_search` currently maps to a generic setup action, and the shared remediation helper prints generic launch/completion messages. Meanwhile, the installed Feynman CLI exposes a dedicated `feynman search set <provider> [api-key]` command, which gives Uraniborg a correct ownership boundary for search-provider setup without mutating Feynman files directly.

This change is cross-cutting but narrow: it touches shared remediation orchestration, review-side command mapping, setup/configuration command registration, and operator-facing copy. It must keep `init` working, keep internal `refine.*` structures stable, and avoid reopening the broader runtime-safety work.

## Goals / Non-Goals

**Goals:**

- Route web-search remediation through a dedicated Feynman-owned search-provider configuration path.
- Keep default remediation output curated for both success and failure without exposing raw process metadata.
- Add a revision-focused command family that supports both guided setup and configuration inspection.
- Keep `init` as a backward-compatible entry point while shifting operator-facing CLI text from `refinement` to `revision`.
- Allow users to manage web-search providers even after one provider is already configured.

**Non-Goals:**

- Renaming internal `refine.*` config schema, modules, or run-state identifiers in this change.
- Building a full verbose/debug diagnostics mode in this change.
- Reworking run execution semantics, Feynman runtime discovery, or serialized access logic.
- Implementing dynamic provider discovery from Feynman if a static provider catalog is sufficient for v1.

## Decisions

### 1. Introduce a dedicated web-search remediation action

Uraniborg will add a distinct remediation kind for web-search provider configuration instead of reusing the generic setup action.

Rationale:

- fixes the current incorrect routing directly
- preserves clear intent through readiness classification, prompting, and launch
- prevents the command label and invoked command from drifting apart again

Alternatives considered:

- keep generic setup but improve wording: rejected because the launched command would still be wrong
- route all optional capability setup through `feynman setup`: rejected because installed Feynman already exposes a dedicated search command

### 2. Collect provider input in Uraniborg, then launch `feynman search set`

For web-search setup, Uraniborg will collect the provider choice and optional API key itself, then invoke Feynman-owned `search set` with those arguments.

Rationale:

- respects the ownership boundary because Feynman still performs the actual configuration mutation
- gives Uraniborg an operator-friendly flow instead of dropping the user into a generic setup path
- supports later add/change-provider flows even after search is already configured

Alternatives considered:

- print command guidance only: rejected because the user explicitly wants an in-flow configuration path
- mutate Feynman configuration files directly: rejected because Uraniborg should not own Feynman internals

### 3. Keep search-provider management available outside failure remediation

Interactive Uraniborg surfaces will support a user-driven search-provider management path even when `doctor` already reports a configured search endpoint.

Rationale:

- Feynman supports more than one search API
- users may want to add or change providers after the first successful setup
- this avoids coupling provider management strictly to failure states

Alternatives considered:

- expose search-provider setup only when readiness fails: rejected because it blocks a legitimate reconfiguration use case

### 4. Add a `revision` command family while keeping `init`

Uraniborg will add:

- `revision --setup` for the guided revision-configuration flow
- `revision --config` for showing current revision configuration

`init` will remain as a compatibility entry point to the same guided setup path.

Rationale:

- `init` is not an intuitive long-term command for changing revision configuration
- keeping `init` avoids breaking established flows and existing docs immediately
- a dedicated `revision` command family gives the product an operator-facing home for ongoing revision settings

Alternatives considered:

- replace `init` entirely: rejected because it creates an unnecessary compatibility break
- add only a `set-revise-model` command: rejected because the existing flow configures more than just the model

### 5. Replace operator-facing `refinement` wording with `revision`

Operator-facing CLI text will use `revision` across setup, readiness, model/config display, and run guidance. Internal names may remain `refine.*`.

Rationale:

- matches the product framing the user expects
- improves consistency across commands that all talk to the same underlying configuration
- avoids paying internal schema migration cost for a copy-only change

Alternatives considered:

- limit wording changes to `init` only: rejected because it would leave the CLI inconsistent
- rename internal schema and modules immediately: rejected because it is larger than the UAT fix requires

### 6. Hide low-level process metadata from default remediation output

Default remediation output will report curated progress and outcomes for both success and failure. Raw exit codes, stdout, and stderr fragments will be deferred to a future verbose mode.

Rationale:

- addresses the UAT complaint directly
- keeps default operator output product-shaped instead of implementation-shaped
- leaves room for a future diagnostics surface without leaking low-level details now

Alternatives considered:

- keep raw exit code on failures only: rejected because the user wants low-level process metadata behind a future verbose mode

## Risks / Trade-offs

- `[Static provider catalog may drift from Feynman reality]` -> keep the provider list narrow and documented, and isolate it behind a small boundary that can be updated independently.
- `[An extra interactive search-management prompt could feel noisy]` -> gate the explicit provider-management offer behind interactive mode and make it clearly optional.
- `[Two setup entry points can confuse maintenance]` -> route `init` and `revision --setup` through one shared implementation path.
- `[Operator wording may diverge from internal naming]` -> treat internal `refine.*` names as implementation detail and enforce `revision` only in user-facing rendering.

## Migration Plan

1. Add the OpenSpec deltas for review-side remediation UX and revision configuration commands.
2. Extend remediation action modeling and Feynman command wrappers for web-search provider setup.
3. Add the `revision` command family and route `revision --setup` and `init` through the same guided setup handler.
4. Implement `revision --config` with redacted secret handling and update operator-facing CLI copy to `revision`.
5. Add focused tests for remediation routing, curated default output, revision command behavior, and terminology consistency.
6. Retest host-shell `doctor`, `init`, `revision --setup`, `revision --config`, and `models`.

Rollback strategy:

- If the new revision command family or search-provider flow needs to be rolled back, Uraniborg can temporarily fall back to `init` plus command guidance for search-provider management, but that would knowingly restore the less intuitive operator contract.

## Open Questions

- Which exact web-search providers should Uraniborg offer in its guided prompt list for v1?
- Should `revision --config` show only endpoint/model plus a redacted secret status, or also expose advanced preserved settings such as timeout and temperature?
