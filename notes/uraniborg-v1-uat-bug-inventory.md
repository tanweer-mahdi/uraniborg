# Uraniborg v1 UAT Bug Inventory

Date created: 2026-04-24
Purpose: track bugs and notable failures discovered during manual UAT
Related docs:

- [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md)
- [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)

## Session Rule For This File

This file is being used to capture UAT findings and suggested product changes.

For the current session:

- do not treat suggested fixes here as approved code changes
- do not merge or rely on in-session experimental code edits as the accepted fix
- implement fixes later in a dedicated follow-up session or branch

## Overall UAT Program Status

- Status: blocked at first-run bootstrap
- Primary blocker: `UAT-001`
- Blocked test families:
  - run
  - resume
  - real model discovery
  - interruption
  - artifact validation
- Allowed continued work:
  - copy/UX review
  - failure messaging review
  - docs
  - packaging sanity

## Current UAT Status

As of `2026-04-24`, full run-side UAT is blocked by `UAT-001`.

What that means in practice:

- the locked spec expected Uraniborg to provision its own pinned Feynman runtime
- the current implementation creates the runtime directory, but does not populate the runtime files from zero state
- `doctor` then offers remediation by trying to launch a pinned executable that does not exist yet
- because of that, first-run bootstrap UAT cannot progress into a real `run` without an out-of-band workaround

Until that is resolved, UAT can still capture:

- onboarding and prompt-quality problems
- packaging and invocation problems
- design recommendations for follow-up work

But it cannot honestly validate the complete first-run review path end to end.

## How To Use This File

Add one entry per distinct UAT finding.

For each bug, record:

- bug id
- date
- UAT case or journey step
- environment and runtime state
- command run
- expected behavior
- observed behavior
- severity
- current status
- next action

Suggested statuses:

- `open`
- `confirmed`
- `in_progress`
- `fixed_pending_retest`
- `closed`
- `wont_fix`

Suggested severities:

- `P0`
  - blocks first-run use, causes silent fallback, wrong state transitions, or artifact loss
- `P1`
  - major usability or recovery issue, but workaround exists
- `P2`
  - minor clarity or non-blocking UX issue

## Spec Versus Implementation Audit

This section records why the runtime provisioning gap was silent during development.

### What the locked spec said

- The canonical environment spec says:
  - Uraniborg SHALL provision and invoke a pinned standalone Feynman runtime under `~/.uraniborg/vendor/feynman`
  - if the pinned runtime is not present, the system installs or prepares it before continuing with review-side work
- The archived design repeats that contract and explicitly rejects relying on a `PATH`-resolved global install as the main runtime contract.

### What the task list said

- Task `2.2` says:
  - implement bootstrap logic that prepares and validates the `~/.uraniborg/` directory layout and the pinned runtime
- That task was marked complete.
- In hindsight, the wording was broad enough to let directory creation plus runtime inspection be treated as “bootstrap,” even though the spec required actual runtime provisioning.

### What the code does today

- [src/config/app-home.ts](/Users/shahmahdihasan/uraniborg/src/config/app-home.ts:81) creates these directories:
  - `~/.uraniborg/`
  - `~/.uraniborg/vendor/`
  - `~/.uraniborg/vendor/feynman/`
  - `~/.uraniborg/runs/`
- [src/review/feynman-bootstrap.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-bootstrap.ts:196) inspects:
  - whether `runtime.json` exists
  - whether the pinned executable exists
  - whether the executable reports the expected version
- There is no code path that:
  - downloads, copies, or installs the initial pinned runtime
  - writes the first `runtime.json`
  - writes the first pinned executable into `~/.uraniborg/vendor/feynman/`

### What the tests covered

- [tests/config/bootstrap.test.ts](/Users/shahmahdihasan/uraniborg/tests/config/bootstrap.test.ts:11) only verifies directory creation.
- [tests/review/feynman-bootstrap.test.ts](/Users/shahmahdihasan/uraniborg/tests/review/feynman-bootstrap.test.ts:46) assumes the manifest file and executable already exist when testing the ready path.
- [tests/review/feynman-bootstrap.test.ts](/Users/shahmahdihasan/uraniborg/tests/review/feynman-bootstrap.test.ts:125) verifies that a missing manifest becomes a failure status, not that Uraniborg provisions it.
- The higher-level run and resume tests stub runtime readiness as already healthy rather than exercising first-time provisioning.

### Why the gap stayed silent

- The implementation satisfied the narrower interpretation:
  - “make the directories and inspect a pinned runtime if one exists”
- The tests reinforced that narrower interpretation.
- No live first-run acceptance test was executed before the change was archived.
- The latest archival handoff already noted one remaining real-world gap:
  - “live pinned-runtime and remediation flows need execution against a real embedded Feynman install, not only test doubles”

### Conclusion

- This was not a case where the spec omitted the requirement.
- The requirement existed in the spec and design.
- The silent gap came from:
  - ambiguous task wording
  - implementation drifting to validation-only behavior
  - test coverage that validated inspection/remediation prompts instead of zero-state provisioning
  - archival before live bootstrap UAT had been completed

## Current UAT Execution Status

As of the latest live UAT pass:

- first-run bootstrap UAT is blocked by a product defect
- Uraniborg creates the `~/.uraniborg/` directory layout
- Uraniborg does not currently provision the pinned Feynman runtime from zero state
- Uraniborg also does not currently reuse an already-installed healthy Feynman binary such as `/Users/shahmahdihasan/.local/bin/feynman`
- this means a tester cannot reach a real `run` or `resume` flow from a true first-run setup using Uraniborg alone

Important interpretation:

- this is not a tester mistake
- this is not just missing documentation
- this is a spec-to-implementation gap in a core bootstrap requirement

## Bug Template

```markdown
## UAT-XXX - Short title

- Date:
- Status:
- Severity:
- UAT case:
- Environment:
- Runtime state:
- Command:

### Expected

-

### Observed

-

### Evidence

- Terminal output:
- Files/artifacts:

### Notes

-

### Next action

-
```

## Active Bugs

## UAT-001 - First-run doctor remediation tries to launch a missing pinned executable

- Date: 2026-04-24
- Status: confirmed
- Severity: P0
- UAT case: `UJ-01` first-time bootstrap / doctor remediation path
- Environment: `ENV-A` fresh home
- Runtime state: `RT-1` pinned runtime missing
- Command: `node dist/src/cli/main.js doctor`

### Expected

- `doctor` should handle first-run pinned-runtime absence in a way that matches the product intent.
- If Uraniborg offers remediation, that remediation should be executable and should move the system toward a usable pinned runtime state.
- At minimum, the failure message should accurately explain that the pinned runtime itself is not yet installed and therefore cannot be launched.

### Observed

- `doctor` reports:
  - app home layout ready
  - pinned runtime manifest missing
  - refine config missing
- after choosing `Yes` for:
  - `Repair or install the pinned Feynman runtime. Launch feynman setup now?`
- Uraniborg attempts to spawn:
  - `/Users/shahmahdihasan/.uraniborg/vendor/feynman/bin/feynman`
- the process fails with:
  - `spawn /Users/shahmahdihasan/.uraniborg/vendor/feynman/bin/feynman ENOENT`
- rerunning `doctor` produces the same result because no runtime was provisioned.

### Evidence

- Terminal output:
  - `Pinned Feynman runtime manifest is missing.`
  - `Launch feynman setup now?`
  - `Launching feynman setup via pinned runtime...`
  - `spawn /Users/shahmahdihasan/.uraniborg/vendor/feynman/bin/feynman ENOENT`
- Files/artifacts:
  - `~/.uraniborg/vendor/feynman/` directory exists
  - `~/.uraniborg/vendor/feynman/runtime.json` is missing
  - `~/.uraniborg/vendor/feynman/bin/feynman` is missing

### Notes

- This is expected from the current implementation, but not from the intended first-run product behavior.
- The current remediation path assumes the pinned executable already exists, which is incompatible with the zero-state bootstrap case.
- This blocks meaningful first-run review-side UAT until the runtime is provisioned by some other means or the product behavior is fixed.
- Root-cause clarification:
  - the current implementation creates the runtime directory path under `~/.uraniborg/vendor/feynman`
  - but it does not actually provision the pinned runtime files into that directory
  - there is currently no implementation path that writes the initial `runtime.json` or pinned `bin/feynman` executable into place from zero state
  - `doctor` and other commands only inspect those files if present, then try to invoke the pinned executable path
- Spec/task/process clarification:
  - spec baseline: `environment-setup` required Uraniborg to provision the pinned runtime before review-side operations
  - task baseline: the archived task list marked runtime bootstrap and remediation as completed
  - implementation reality: current code only inspects manifest/executable if present and then invokes the pinned path
  - test coverage gap: current tests cover ready-runtime inspection and missing-manifest failure, but do not cover first-time runtime provisioning from zero state
  - conclusion: this was a silent spec-to-implementation gap, not a UAT misunderstanding
- Spec/task/source trace:
  - canonical spec explicitly requires first-time pinned-runtime provisioning before continuing with review-side operations
  - archived task `2.2` explicitly says bootstrap should prepare and validate the pinned runtime, not just the directory layout
  - archived design section `3` says review modules are responsible for provisioning a pinned standalone Feynman runtime
  - current source does not contain any download, copy, extract, or manifest-write path for the initial runtime
- Most plausible reason the gap stayed silent:
  - implementation and tests converged on the assumption that the pinned runtime already exists
  - bootstrap work was effectively reduced to directory creation plus readiness inspection
  - tests heavily covered ready-runtime, version-check, and remediation-on-existing-runtime paths, but not real zero-state provisioning

### Next action

- Fix the product so first-run runtime remediation does one of the following:
  - actually provisions the pinned runtime before attempting `feynman setup`, or
  - fails with a precise message that the runtime binary itself is not installed yet and cannot be launched
- Retest `UJ-01` after the fix.

## UAT-006 - Existing working Feynman installation is ignored even when it could unblock first-run use

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-run bootstrap on a machine that already has a working Feynman installation
- Environment: `ENV-A` or mixed first-run environment with an existing non-Uraniborg Feynman install
- Runtime state:
  - `RT-1` pinned runtime missing under `~/.uraniborg/vendor/feynman`
  - separate healthy Feynman install already exists elsewhere, for example under `~/.local/bin/feynman`
- Command:
  - `node dist/src/cli/main.js doctor`
  - `node dist/src/cli/main.js run ...`

### Expected

- A machine that already has a healthy Feynman installation should offer a smoother onboarding path than a machine with no Feynman at all.
- At minimum, Uraniborg should detect the existing install and explain whether it can:
  - use it to seed the pinned runtime, or
  - use it directly as a temporary fallback
- The user should not be blocked without any use of an already-working local Feynman install.

### Observed

- Uraniborg checks only the pinned runtime location under `~/.uraniborg/vendor/feynman`.
- If the pinned runtime manifest is missing, Uraniborg fails the readiness check and does not use the existing healthy installation elsewhere on the machine.
- This creates a poor user journey on machines that already have a usable Feynman setup.

### Evidence

- Terminal output:
  - `Pinned Feynman runtime manifest is missing. [required]`
  - `Executable: /Users/shahmahdihasan/.uraniborg/vendor/feynman/bin/feynman`
- Files/artifacts:
  - healthy existing installation available outside the pinned runtime path
  - Uraniborg does not currently accept or import it

### Notes

- This finding splits into two different follow-up options:
  - `Option A: spec-preserving correction`
    - detect an existing healthy Feynman installation and use it only to seed or repair the pinned runtime under `~/.uraniborg/vendor/feynman`
    - this keeps the pinned-runtime contract intact
  - `Option B: spec-changing fallback`
    - if the pinned runtime is absent, allow Uraniborg to run directly against an existing healthy Feynman installation outside `~/.uraniborg/vendor/feynman`
    - this contradicts the currently locked pinned-runtime-only spec
- Based on the locked spec, direct fallback to an existing install is a product-spec change, not merely an implementation correction.
- Based on the current UAT pain, `Option A` looks like the lowest-risk correction and `Option B` looks like a legitimate follow-up product decision if the team wants less friction than strict pinning.

### Risks and tradeoffs

- Benefits of accepting an existing install:
  - much smoother first-run journey
  - unblocks UAT and real user adoption on machines that already use Feynman
  - reduces artificial setup friction
- Risks of direct fallback:
  - runtime behavior may vary across machines
  - support/debugging gets harder because Uraniborg no longer controls the exact runtime version
  - subtle drift in CLI flags or outputs could break Uraniborg later
  - the pinned-runtime contract becomes weaker and less deterministic
- Middle-ground tradeoff:
  - use an existing install only as a bootstrap source to create the pinned runtime, preserving determinism while reducing friction

### Recommendation text for follow-up docs or spec discussion

- `Recommendation: If Uraniborg starts on a machine where the pinned runtime is missing but a healthy Feynman installation already exists, Uraniborg should detect it and offer to use it to seed or repair the pinned runtime under ~/.uraniborg/vendor/feynman. This preserves the pinned-runtime contract while removing unnecessary first-run friction. If the product instead wants to run directly against an existing installation without pinning, that should be treated as an explicit spec change because it contradicts the current pinned-runtime-only requirement.`

### Next action

- Decide explicitly between:
  - preserving the pinned-runtime contract while importing from an existing install, or
  - changing the spec to allow direct fallback to an existing install
- Reflect that choice in a follow-up OpenSpec change before implementation.

## UAT-007 - Core runtime provisioning requirement was archived as complete without a real first-run acceptance pass

- Date: 2026-04-24
- Status: confirmed
- Severity: P0
- UAT case: process audit after first-run bootstrap failure
- Environment: repository audit against canonical specs, archived tasks, current code, and current tests
- Runtime state: not applicable
- Command:
  - repo inspection only

### Expected

- A core first-run requirement should not be marked complete unless:
  - the implementation actually exists, and
  - at least one realistic acceptance path validates the intended zero-state behavior

### Observed

- The spec required runtime provisioning.
- The code implements directory creation plus runtime inspection, but not actual zero-state provisioning.
- The tests cover directory creation, ready-runtime inspection, and failure classification, but not first-time runtime provisioning.
- The archived handoff still notes live pinned-runtime/remediation validation as an open real-world gap.
- Despite that, the archived task list records the bootstrap/runtime tasks as complete and the change was archived.

### Evidence

- Canonical spec:
  - [openspec/specs/environment-setup/spec.md](/Users/shahmahdihasan/uraniborg/openspec/specs/environment-setup/spec.md:15)
- Archived tasks:
  - [tasks.md](/Users/shahmahdihasan/uraniborg/openspec/changes/archive/2026-04-24-build-uraniborg-v1/tasks.md:10)
- Directory-only bootstrap code:
  - [app-home.ts](/Users/shahmahdihasan/uraniborg/src/config/app-home.ts:81)
- Validation-only runtime inspection:
  - [feynman-bootstrap.ts](/Users/shahmahdihasan/uraniborg/src/review/feynman-bootstrap.ts:196)
- Handoff note that live runtime/remediation flows still needed real execution:
  - [2026-04-24T11-51-33+1000-session-handoff.md](/Users/shahmahdihasan/uraniborg/notes/session-logs/2026-04-24T11-51-33+1000-session-handoff.md:92)

### Notes

- This is a process-quality failure as much as a product bug.
- The main silent-failure mechanism was that task wording and tests allowed “inspection and validation” to stand in for “actual provisioning.”
- This should be treated as a hard lesson for future OpenSpec changes:
  - first-run bootstrap requirements need explicit exit criteria tied to a real zero-state test

### Next action

- In the next change, add explicit tasking and acceptance criteria for:
  - zero-state runtime provisioning
  - real first-run doctor/bootstrap verification
  - proof that remediation changes disk state when it claims to install or repair something
- Do not archive the follow-up change until that path has been exercised outside test doubles.

## UAT-002 - `init` intro and prompt wording is too internal for a first-time user

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-time configuration / `init`
- Environment: `ENV-A` fresh home
- Runtime state: `RT-1` pinned runtime missing
- Command: `node dist/src/cli/main.js init`

### Expected

- A first-time user should understand immediately what the setup flow is configuring.
- Prompt wording should describe the user-facing purpose:
  - choosing how Uraniborg revises drafts after peer review
  - selecting the model and API used for draft revision
- The wording should avoid internal architecture terms unless they are explained.

### Observed

- The intro uses:
  - `Uraniborg refinement setup`
- The first prompt uses:
  - `OpenAI-compatible refine endpoint URL`
- A first-time user would not naturally know what “Uraniborg refinement” or “refine endpoint” means in this context.

### Evidence

- Terminal output:
  - `Uraniborg refinement setup`
  - `OpenAI-compatible refine endpoint URL`
- Files/artifacts:
  - none yet; this is a wording/UX issue before config is written

### Notes

- This is not a core logic failure, but it weakens first-run usability and increases confusion during UAT.
- The product language should anchor on draft revision from peer reviews, not on internal subsystem naming.

### Next action

- Reword the `init` intro and prompts so they explain the user-facing purpose.
- Suggested direction:
  - intro similar to:
    - `Configure how Uraniborg revises drafts from peer reviews`
  - model prompt similar to:
    - `Default model for draft revision`
- Retest the `init` flow with a first-time user after the copy update.

## UAT-003 - `init` endpoint prompt does not explain what kind of URL is expected

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-time configuration / `init`
- Environment: `ENV-A` fresh home
- Runtime state: `RT-1` pinned runtime missing
- Command: `node dist/src/cli/main.js init`

### Expected

- The endpoint prompt should tell the user:
  - what the field is for
  - whether a base URL or full endpoint URL is expected
  - at least one concrete example
- A new user should not have to infer API shape from the codebase.

### Observed

- The prompt asks for:
  - `OpenAI-compatible refine endpoint URL`
- It does not explain:
  - that Uraniborg expects the base API URL
  - that Uraniborg internally appends the chat completions path
  - an example such as `https://api.openai.com/v1`

### Evidence

- Terminal output:
  - `OpenAI-compatible refine endpoint URL`
- Files/artifacts:
  - none yet; this is a prompt guidance issue

### Notes

- This creates avoidable user confusion.
- A likely user mistake is entering the full completions path instead of the base URL.
- Based on the current implementation, the intended value is the base URL, for example:
  - `https://api.openai.com/v1`

### Next action

- Update the prompt copy to say that the field is the base URL for the OpenAI-compatible API used for draft revision.
- Include a concrete example:
  - `https://api.openai.com/v1`
- Explicitly clarify that the full `/chat/completions` path should not be entered.

## UAT-004 - Packaged CLI bin path does not match the built artifact path

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: local execution and packaging sanity check
- Environment: development environment after `npm run build`
- Runtime state: not applicable
- Command:
  - `npm run build`
  - attempted CLI execution using the packaged bin expectation

### Expected

- The package metadata should point to the actual built CLI entrypoint.
- A user should not need to inspect `dist/` manually to discover how to launch the built CLI.

### Observed

- `package.json` advertises the bin path as:
  - `./dist/cli/main.js`
- The current build emits:
  - `dist/src/cli/main.js`
- For local UAT, the working command is:
  - `node dist/src/cli/main.js ...`

### Evidence

- Files/artifacts:
  - `package.json` bin points at `./dist/cli/main.js`
  - built artifact exists at `dist/src/cli/main.js`

### Notes

- This is a packaging/product correctness issue, not just a documentation gap.
- It does not block code-level UAT if the tester runs the emitted file directly, but it does make the product packaging story incorrect.

### Next action

- Align package metadata and build output so the advertised bin path matches the emitted CLI artifact.
- Possible fix directions:
  - update the `bin` path to match the current emitted file, or
  - introduce a cleaner build layout so the distributable CLI lands at the expected path
- Retest build and packaged invocation after the fix.

## UAT-005 - `init` asks low-level API details that many users will not understand

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-time configuration / `init`
- Environment: `ENV-A` fresh home
- Runtime state: `RT-1` pinned runtime missing
- Command: `node dist/src/cli/main.js init`

### Expected

- A first-time user should be guided through a task-oriented setup flow.
- The product should primarily ask for choices a normal user understands:
  - which model provider they want to use for draft revision
  - which available model they want to use from that provider
- If advanced API parameters are needed, they should either:
  - be hidden behind an advanced mode, or
  - be explained with defaults and clear examples

### Observed

- The `init` flow asks for several low-level fields directly:
  - endpoint URL
  - environment variable name for the API key
  - timeout in milliseconds
  - model name
  - temperature
  - max output tokens
- A new user is unlikely to know what values to enter for:
  - timeout
  - temperature
  - max output tokens
- The phrase:
  - `Environment variable that stores the refine API key`
  is also ambiguous to a beginner.

### Evidence

- Terminal output:
  - `OpenAI-compatible refine endpoint URL`
  - `Environment variable that stores the refine API key`
  - `Request timeout in milliseconds`
  - `Default refinement temperature`
  - `Default max output tokens (leave empty to disable)`
- Files/artifacts:
  - resulting config saved to `~/.uraniborg/config.json`

### Notes

- Based on the current implementation, the prompt is asking for the **name of the environment variable**, not the API key value itself.
- The product currently never asks the user to type the API key into `init`; instead it expects the actual secret to already exist in the shell environment when `doctor` or `run` loads config.
- That behavior may be valid architecturally, but it is not obvious in the current UX.
- During UAT, this also caused a concrete journey break:
  - after completing `init`, the user ran `doctor`
  - `doctor` then failed with:
    - `Environment variable "OPENAI_API_KEY" is not set.`
  - so the user had completed setup without actually being guided to provide the secret needed for refinement

### Follow-up user feedback

- The `init` flow should be a one-stop setup path for refinement.
- The product should not ask a user to choose the name of an environment variable.
- The user expectation is:
  - Uraniborg asks directly for the API key
  - Uraniborg stores or wires it appropriately
  - the user is not forced to understand env-var naming as part of first-run setup

### Next action

- Redesign the `init` flow to be more user-centered.
- Suggested direction:
  - ask for provider first
  - then help the user choose a model from the provider
  - keep advanced options behind an explicit advanced step
  - ask for the actual API key value during first-run setup rather than asking the user to invent or supply an env-var name
  - if the product still wants env-var-backed secrets internally, hide that implementation detail from the user
- Retest with a first-time user after the copy and flow changes.

## Recommendation Notes From Web Research

These are recommendations captured during UAT research.
They are not approved implementation decisions yet.

### Summary

- No strong evidence was found for a mainstream Node package that specifically provides an out-of-the-box “LLM provider picker + model picker” CLI flow.
- The strongest options are generic prompt libraries that support:
  - searchable selection
  - grouped choices
  - dynamic option loading
  - multi-step CLI/TUI flows

### Recommended packages to evaluate later

#### 1. `@inquirer/prompts` plus `@inquirer/search`

Why it looks promising:

- modern maintained prompt toolkit
- supports standard selects and interactive search
- good fit for:
  - pick provider
  - search/filter available models
  - optionally separate basic and advanced setup steps

Sources:

- `@inquirer/prompts`: https://www.npmjs.com/package/%40inquirer/prompts
- `@inquirer/search`: https://www.npmjs.com/package/%40inquirer/search

#### 2. `inquirer-autocomplete-prompt`

Why it looks promising:

- adds autocomplete/search behavior on top of Inquirer flows
- useful if the model list is long and should be filtered as the user types

Source:

- `inquirer-autocomplete-prompt`: https://www.npmjs.com/package/inquirer-autocomplete-prompt

#### 3. `enquirer`

Why it looks promising:

- flexible prompt library with built-in `AutoComplete`, `Select`, and `MultiSelect`
- good candidate if Uraniborg needs more custom prompt behavior than the current prompt stack provides

Source:

- `enquirer`: https://www.npmjs.com/package/enquirer

#### 4. Keep `@clack/prompts` if only simple guided selection is needed

Why it is still relevant:

- the project already uses it
- it provides clean `select` and `multiselect` flows
- it may remain sufficient if provider selection is small and model lists are short

Limitation:

- it does not appear to provide the richer searchable selection flow that would help with long or dynamic model lists

Source:

- `@clack/prompts`: https://www.npmjs.com/package/%40clack/prompts

### Recommendation For Follow-Up Design

If Uraniborg wants a more beginner-friendly `init` flow later, the strongest design direction is:

1. Ask for provider first
2. Load provider-specific model choices
3. Use a searchable select for model selection
4. Hide timeout/temperature/token knobs behind an advanced settings step

This recommendation should be revisited in a dedicated implementation branch after UAT findings are triaged.

### Additional local-repo design recommendation

- The user noted that the locally available Feynman repository already handles:
  - vendor selection
  - model selection
  in a more elegant way than Uraniborg currently does
- This should be treated as a design reference during follow-up implementation work
- Recommended follow-up:
  - inspect the local Feynman provider/model routing UX before redesigning Uraniborg `init`
  - prefer reusing or closely mirroring proven Feynman interaction patterns where they fit Uraniborg’s product boundaries

## UAT-006 - Existing healthy Feynman installation is not reused

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-run bootstrap and readiness
- Environment: local machine with existing working Feynman installation
- Runtime state:
  - pinned runtime missing under `~/.uraniborg/vendor/feynman`
  - separate working installation exists at `/Users/shahmahdihasan/.local/bin/feynman`
- Command:
  - `node dist/src/cli/main.js doctor`

### Expected

- From a user-journey perspective, if a working Feynman installation already exists, Uraniborg should be able to use it or offer to adopt it instead of fully blocking the user.

### Observed

- Uraniborg insists on the pinned path under `~/.uraniborg/vendor/feynman`.
- A separate working installation does not unblock the product.

### Evidence

- Existing working installation raised during UAT:
  - `/Users/shahmahdihasan/.local/bin/feynman`
- Current failure still references:
  - missing pinned manifest
  - missing pinned executable

### Notes

- This is partly a product-direction question because it relaxes the pinned-runtime posture from the locked spec.
- While the locked spec preferred pinned-runtime use, the current behavior creates an artificial blocker when zero-state provisioning is also broken.

### Next action

- Treat this as follow-up product feedback for onboarding and runtime policy.
- Decide later whether Uraniborg should:
  - strictly provision and require the pinned runtime, or
  - adopt or temporarily use an existing healthy installation with explicit warning/consent

## Process Findings

## PF-001 - Spec coverage gap escaped into completed implementation status

- Date: 2026-04-24
- Status: confirmed
- Related areas:
  - `environment-setup` spec
  - archived tasks `2.2`, `2.5`, `5.2`, `5.3`
- Finding:
  - the provisioning requirement existed in the spec and task list
  - the implementation and tests focused on validation and invocation, not creation of the pinned runtime from zero state
  - the work was still marked complete
- Why this matters:
  - a core first-run requirement silently slipped from “required behavior” into “assumed precondition”
- Follow-up:
  - future changes should tighten traceability between required bootstrap capabilities and tests that prove zero-state behavior

## Supporting Detail For UAT-005

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-time configuration / `init`
- Environment: `ENV-A` fresh home
- Runtime state: `RT-1` pinned runtime missing
- Command: `node dist/src/cli/main.js init`

### Expected

- A first-time user should be able to complete setup without already understanding OpenAI-style API settings.
- The setup flow should start with the user-facing choice:
  - which model provider they want to use
  - which model they want Uraniborg to use for draft revision
- Advanced settings such as timeout, temperature, max output tokens, or custom base URL should either:
  - be optional and clearly labeled as advanced, or
  - be hidden behind a separate advanced-configuration step
- If Uraniborg asks for an environment variable, the flow should clearly explain:
  - whether it wants the variable name or the secret value itself
  - where and when the actual API key must be provided

### Observed

- `init` asks for:
  - OpenAI-compatible refine endpoint URL
  - environment variable that stores the refine API key
  - request timeout in milliseconds
  - default refinement model
  - default refinement temperature
  - default max output tokens
- This requires the user to understand low-level API concepts before they have even selected a provider.
- The prompt:
  - `Environment variable that stores the refine API key`
- is ambiguous for a first-time user because it is not obvious whether Uraniborg wants:
  - the API key itself, or
  - the name of the environment variable that will later hold the key
- The flow shown during UAT did not explain where the actual secret value should be set.

### Evidence

- Terminal output:
  - `OpenAI-compatible refine endpoint URL`
  - `Environment variable that stores the refine API key`
  - `Request timeout in milliseconds`
  - `Default refinement temperature`
- Files/artifacts:
  - `~/.uraniborg/config.json` stores config after the prompt flow completes

### Notes

- This is primarily a user-journey hygiene issue.
- The current flow appears optimized for an already-technical operator rather than a first-time Uraniborg user.
- The likely better product direction is:
  - first ask for provider
  - then show available models for that provider
  - keep advanced networking/tuning fields optional
  - explicitly separate secret-entry guidance from config selection

### Next action

- Redesign the `init` flow for first-run usability.
- Suggested direction:
  - Step 1: choose provider
  - Step 2: choose model from provider-specific options
  - Step 3: explain where to set the API key
  - Step 4: optionally expose advanced settings
- Evaluate established Node CLI prompt packages and model-registry libraries before implementing the redesign.

## UAT-006 - Uraniborg does not reuse an existing healthy Feynman installation when the pinned runtime is absent

- Date: 2026-04-24
- Status: confirmed
- Severity: P1
- UAT case: first-run bootstrap / existing-install reuse
- Environment: `ENV-A` fresh Uraniborg home on a machine that already has Feynman installed
- Runtime state:
  - `RT-1` pinned runtime missing under `~/.uraniborg/vendor/feynman`
  - existing non-pinned Feynman installation available at `/Users/shahmahdihasan/.local/bin/feynman`
- Command:
  - `node dist/src/cli/main.js doctor`
  - `node dist/src/cli/main.js init`

### Expected

- Uraniborg should not create an artificial blocker when a healthy existing Feynman installation is already available on the machine.
- Acceptable product directions would include one of these:
  - detect and reuse the existing Feynman installation directly
  - detect the existing installation and adopt/copy/link it into the pinned runtime location
  - offer a clear one-step migration or adoption path into Uraniborg-managed state
- The first-run experience should not require extra manual steps if the machine already has a working Feynman installation.

### Observed

- Uraniborg insists on the pinned runtime path under `~/.uraniborg/vendor/feynman`
- when that pinned runtime is absent, Uraniborg blocks on missing manifest/executable
- Uraniborg does not appear to inspect or offer to use the already-installed Feynman binary at `/Users/shahmahdihasan/.local/bin/feynman`
- the result is that a machine with a healthy Feynman setup still cannot proceed through Uraniborg bootstrap

### Evidence

- Existing installation available on machine:
  - `/Users/shahmahdihasan/.local/bin/feynman`
- Terminal behavior:
  - `doctor` continues to fail on missing pinned manifest and missing pinned executable
  - no visible path is offered to reuse the existing install

### Notes

- The locked spec preferred a pinned runtime to avoid drift, but the current product behavior turns that preference into a hard bootstrap blocker.
- User feedback from UAT:
  - version drift risk is likely lower than the cost of blocking first-run use
  - if occasional drift happens, Uraniborg/Feynman can be kept aligned through normal maintenance
- This should be treated as a product-design review item, not just a local workaround question.
- Even if Uraniborg keeps pinning as the long-term strategy, it should still consider an adoption path from an already-working Feynman install.

### Next action

- Re-evaluate the bootstrap policy for machines with an existing Feynman installation.
- During follow-up design/implementation, explicitly compare these options:
  - strict pinned-runtime only
  - fallback to existing install when pinned runtime is missing
  - adopt existing install into the pinned runtime location
- Inspect the local Feynman repo and current local installation workflow before choosing the final approach.

## Silent Gap Analysis

This section answers the direct review questions raised during UAT.

### 1. Was the missing behavior explicit in the locked spec?

Yes.

The canonical spec in `openspec/specs/environment-setup/spec.md` is explicit:

- requirement:
  - `The system SHALL provision and invoke a pinned standalone Feynman runtime under ~/.uraniborg/vendor/feynman`
- scenario:
  - when the pinned runtime is not yet present
  - the system `installs or prepares the pinned Feynman runtime before continuing`

This was not implied or optional. It was a direct requirement.

### 2. Was the missing behavior explicitly represented in tasks?

Yes, but incompletely enforced.

The archived task list includes:

- `2.2`
  - `Implement bootstrap logic that prepares and validates the ~/.uraniborg/ directory layout and the pinned ~/.uraniborg/vendor/feynman runtime without deleting prior runs`
- `2.3`
  - version checks, exact-path invocation, and warnings for conflicting global installs
- `2.5`
  - remediation and diagnostics primitives for setup/login/doctor
- `7.6`
  - smoke coverage for pinned runtime/version checks and doctor/models/remediation flows

The problem is that the task list did not force a distinct, testable sub-task for:

- materializing the initial runtime files from zero state
- writing the first valid `runtime.json`
- ensuring remediation works when no pinned executable exists yet

So the tasks did mention the behavior, but they were still broad enough that implementation could satisfy the surrounding readiness work while silently missing true first-time provisioning.

### 3. Most plausible reason the implementation drifted without surfacing earlier

The most plausible explanation is this combination:

- bootstrap was implemented as directory bootstrap, not runtime bootstrap
- readiness/remediation work was built around an assumed existing pinned executable
- the automated tests mostly used fake ready-runtime inputs or version-mismatch scenarios, not live zero-state provisioning
- the completion process appears to have treated “pinned path exists and can be inspected” as sufficient evidence for “pinned runtime bootstrap is done”

Concrete signs of this in the source and tests:

- `src/config/app-home.ts`
  - creates directories only
- `src/review/feynman-bootstrap.ts`
  - reads `runtime.json`, resolves the executable path, checks executability, and runs `--version`
  - it does not create the runtime from zero state
- `src/review/feynman-remediation.ts`
  - launches `setup` through the pinned executable path
  - that only works if the pinned executable already exists
- `tests/review/feynman-bootstrap.test.ts`
  - covers ready runtime, version parsing, and missing manifest detection
  - does not cover creating runtime artifacts from zero state
- `tests/cli/doctor.test.ts`
  - covers a healthy ready-runtime path with optional capability gaps
  - does not cover first-run provisioning
- `tests/cli/run.test.ts`
  - remediation coverage focuses on version mismatch and retry with an already-addressable pinned binary

In blunt terms:

- the implementation was strong on runtime inspection
- it was weak on runtime creation
- and the test suite reinforced the inspection-centric interpretation

### 4. Concrete wording to keep in UAT docs

Recommended wording for future triage and stakeholder communication:

- `Uraniborg v1 currently does not meet the locked first-run bootstrap requirement for Feynman runtime provisioning.`
- `The canonical spec requires Uraniborg to install or prepare the pinned runtime before continuing with review-side operations when the runtime is missing.`
- `The current implementation only creates the runtime directory, then inspects for a manifest and executable that it never materializes from zero state.`
- `As a result, live UAT for first-run review execution is blocked unless the runtime is provisioned by some external/manual means.`
- `This is a core spec-to-implementation gap, not a tester setup mistake.`

## Implementation Research Recommendations

These are implementation recommendations captured during UAT. They are not approved changes for this session.

### Best-fit combination for Uraniborg

- `@inquirer/prompts` with `@inquirer/search` and `@inquirer/select`
  - Why it fits:
    - strong fit for TypeScript CLIs
    - supports single-select, multi-select, separators, and searchable lists
    - a good match for provider-first then model-search flows in a terminal
  - Direct LLM provider/model support:
    - no; this is a generic prompt toolkit
  - Sources:
    - https://www.npmjs.com/package/@inquirer/select
    - https://www.npmjs.com/package/@inquirer/search
    - https://www.npmjs.com/package/@inquirer/checkbox

- Pair it with `@anolilab/ai-model-registry` if Uraniborg wants provider/model metadata instead of hardcoded lists
  - Why it fits:
    - exposes provider lists and provider-specific model lists
    - includes model metadata and search/filter capabilities
    - useful if Uraniborg wants provider-aware model choices without manually curating model IDs
  - Direct LLM provider/model support:
    - yes for provider/model metadata
    - no built-in terminal UI
  - Source:
    - https://www.npmjs.com/package/@anolilab/ai-model-registry

### Strong alternatives

- `enquirer`
  - Why it fits:
    - mature prompt library with `AutoComplete`, `Select`, and `MultiSelect`
    - supports grouped or nested choices and custom filtering
    - good if Uraniborg wants more control over custom prompt behavior
  - Direct LLM provider/model support:
    - no; generic prompt building only
  - Source:
    - https://www.npmjs.com/package/enquirer

- `prompts`
  - Why it fits:
    - lightweight and straightforward
    - includes `autocomplete`, `autocompleteMultiselect`, `select`, and `multiselect`
    - a reasonable option if Uraniborg wants a simpler dependency
  - Direct LLM provider/model support:
    - no; generic prompt building only
  - Source:
    - https://www.npmjs.com/package/prompts

- `@clack/prompts`
  - Why it fits:
    - polished, beginner-friendly terminal UX
    - well suited for guided setup flows with concise prompts and clear visual feedback
    - especially good for provider selection and confirmation-style setup
  - Limitation:
    - no built-in searchable select on the package page, so it is weaker for long model lists unless combined with a second step or custom logic
  - Direct LLM provider/model support:
    - no; generic prompt building only
  - Source:
    - https://www.npmjs.com/package/@clack/prompts

### Richer custom-TUI option

- `Ink` with `@inkjs/ui` or `ink-select-input`
  - Why it fits:
    - best option if Uraniborg eventually wants a richer app-like terminal UI rather than a simple prompt sequence
    - useful for searchable pickers, richer layouts, and step-by-step onboarding screens
  - Limitation:
    - heavier than a prompt library and likely unnecessary for a simple setup wizard
  - Direct LLM provider/model support:
    - no; generic terminal UI only
  - Sources:
    - https://www.npmjs.com/package/@inkjs/ui
    - https://www.npmjs.com/package/ink-select-input

### Research conclusion

- I did not find a widely adopted Node package that directly provides an end-to-end "LLM provider picker + model picker" CLI experience out of the box.
- The clearest implementation direction is:
  - use a generic terminal prompt library for the UX
  - pair it with a model-registry package if dynamic provider/model catalogs are needed
- For Uraniborg specifically, the strongest current recommendation is:
  - `@inquirer/prompts` plus `@inquirer/search`
  - optionally combined with `@anolilab/ai-model-registry`
