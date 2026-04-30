## ADDED Requirements

### Requirement: Run Creation and Artifact Snapshot
The system SHALL validate the input Markdown file, collect run parameters, create a new run directory, and snapshot the source draft and resolved configuration before the first iteration starts.

#### Scenario: Valid run initialization
- **WHEN** the user runs `uraniborg run <file>` with an existing Markdown file and valid parameters
- **THEN** the system creates a timestamped run directory with `run.json`, `config.snapshot.json`, `original.md`, `current.md`, and `information-highway.md`

#### Scenario: Invalid input rejected
- **WHEN** the user starts a run with a missing file, a non-Markdown file, or an out-of-range iteration count
- **THEN** the system rejects the run before creating iteration artifacts

### Requirement: Run Preflight Readiness Checks
The system SHALL perform a preflight check before a run starts that distinguishes between required review readiness and recommended Feynman research capabilities.

#### Scenario: Required review readiness missing
- **WHEN** Uraniborg preflight detects that the pinned Feynman runtime is unavailable, the pinned version check fails, or the selected review model is not ready
- **THEN** Uraniborg blocks the run and launches or recommends the relevant Feynman-owned remediation flow

#### Scenario: Recommended research capabilities missing during preflight
- **WHEN** Uraniborg preflight detects that AlphaXiv auth or web-search provider configuration is missing but required review readiness is satisfied
- **THEN** Uraniborg warns that review quality or freshness may be reduced, offers remediation, and still allows the user to continue the run

### Requirement: Review Step Isolation
The system SHALL execute each review step against the current draft only, using the selected review model, and SHALL persist the normalized review artifact and logs in the current iteration directory.

#### Scenario: Successful review step
- **WHEN** an iteration enters the review phase and the embedded review runtime succeeds
- **THEN** the system writes `iter-N/input.md`, `iter-N/review.md`, and `iter-N/review.log`

#### Scenario: Review step memory boundary
- **WHEN** the review step runs for any iteration
- **THEN** the system does not provide `information-highway.md` to the review engine

#### Scenario: Review step failure surfaces provider-authored error
- **WHEN** an iteration enters the review phase, the embedded review runtime exits non-zero, and the runtime exposes a meaningful provider-authored failure message
- **THEN** Uraniborg surfaces that provider-authored message directly to the user instead of leading with a generic process-exit wrapper
- **AND** Uraniborg still preserves subprocess exit metadata and raw stderr in `iter-N/review.log`

### Requirement: Iteration-Local Review Workspace
The system SHALL execute each Feynman review inside a fresh iteration-local workspace so Feynman's native `outputs/` directory and session state cannot collide with outputs from other runs or iterations.

#### Scenario: Isolated review workspace created
- **WHEN** Uraniborg starts a review for iteration `N`
- **THEN** it creates a fresh iteration-local review workspace and copies the current draft into it using a deterministic local filename before invoking Feynman

#### Scenario: Review runs with isolated file and session state
- **WHEN** Uraniborg invokes Feynman review for an iteration
- **THEN** it runs Feynman with the iteration-local workspace as `--cwd` and an iteration-local session directory so the review writes only inside that isolated workspace

#### Scenario: Review artifact normalization
- **WHEN** Feynman completes a review run and produces a usable review artifact inside the iteration-local workspace `outputs/` directory
- **THEN** Uraniborg copies or promotes the final review artifact into `iter-N/review.md` immediately and treats the Uraniborg-owned copy as the source of truth for later steps

#### Scenario: Missing normalized review artifact
- **WHEN** the Feynman review process exits without a usable review artifact that Uraniborg can normalize into `iter-N/review.md`
- **THEN** the system marks the review step as failed instead of proceeding with refinement

#### Scenario: Ambiguous review artifact discovery
- **WHEN** Uraniborg finds multiple candidate `outputs/*-review.md` files in the iteration-local workspace after a single review invocation
- **THEN** it selects only a uniquely attributable new artifact from that invocation and fails the review step if the result remains ambiguous

### Requirement: Refinement Step Contract
The system SHALL execute refinement with the current draft, the latest review, and the information highway through the revision execution layer, and SHALL reject responses that do not contain both the refined draft section and the change summary section.

#### Scenario: Successful managed refinement step
- **WHEN** an iteration enters the refinement phase for a Pi-managed revision profile and the revision execution layer returns output that matches the required parse contract
- **THEN** the system writes `iter-N/refined.md`, `iter-N/changes.md`, and `iter-N/refine.log`

#### Scenario: Successful manual-compatible refinement step
- **WHEN** an iteration enters the refinement phase for the `manual-openai-compatible` revision profile and the revision execution layer returns output that matches the required parse contract
- **THEN** the system writes `iter-N/refined.md`, `iter-N/changes.md`, and `iter-N/refine.log`

#### Scenario: Managed refinement runtime failure without usable text
- **WHEN** the Pi-managed refinement runtime returns a terminal execution error or equivalent error stop without a usable final text payload
- **THEN** Uraniborg surfaces that as a refinement execution failure instead of a malformed output contract failure
- **AND** Uraniborg preserves the provider/runtime error details in local logs when available

#### Scenario: Malformed refinement response
- **WHEN** the refinement execution layer returns non-empty final text that omits either required section or produces empty parsed section content
- **THEN** the system marks the run as failed for that phase instead of guessing how to recover the response

#### Scenario: Malformed refinement response is preserved for inspection
- **WHEN** the refinement execution layer returns non-empty final text but that text fails Uraniborg's required parse contract
- **THEN** the system writes the raw refinement response text to an iteration-local artifact before failing the phase
- **AND** the system surfaces a concise parse-contract failure message that points to the saved malformed output artifact

#### Scenario: Managed provider option shaping
- **WHEN** Uraniborg invokes Pi-managed refinement execution for a provider with known runtime option incompatibilities
- **THEN** Uraniborg sends only the provider-compatible subset of managed execution options instead of a single unfiltered option set

#### Scenario: OpenAI/Codex managed refinement omits temperature
- **WHEN** Uraniborg invokes Pi-managed refinement execution for the `openai-codex` provider
- **THEN** it does not send `temperature` in the managed provider call options

### Requirement: Revision Runtime Snapshot
The system SHALL snapshot the active revision runtime identity for each run in a way that distinguishes provider profile, auth path, and runtime context from legacy API-key-endpoint-only reporting.

#### Scenario: Managed profile run snapshot
- **WHEN** a run is created with a Pi-managed revision profile
- **THEN** the run snapshot records the active revision profile identity, auth/acquisition mode, selected refine model, and any non-secret required provider context without pretending that `apiKeyConfigured` is the runtime truth

#### Scenario: Manual-compatible run snapshot
- **WHEN** a run is created with the `manual-openai-compatible` revision profile
- **THEN** the run snapshot records the explicit endpoint override state and API-key-based runtime configuration for that profile

### Requirement: Structured Memory Updates
The system SHALL append one structured memory block to `information-highway.md` after each successful refinement using the accepted points, rejected points, changes made, open issues, and regression guards from that iteration's `changes.md`.

#### Scenario: Memory appended after iteration
- **WHEN** an iteration completes refinement successfully
- **THEN** the system appends an `Iteration N` block with all required memory headings to `information-highway.md`

#### Scenario: Refinement sees accumulated memory
- **WHEN** the system starts refinement for iteration `N > 1`
- **THEN** the refinement prompt includes the memory blocks accumulated from prior completed iterations

### Requirement: Deterministic Run Completion
The system SHALL promote each successful `refined.md` to become the next `current.md`, and after the final planned iteration it SHALL write `final.md` and mark the run as finished.

#### Scenario: Intermediate iteration promotion
- **WHEN** an iteration completes its memory update and more iterations remain
- **THEN** the system updates `current.md` to the accepted refined draft for the next iteration

#### Scenario: Final iteration completion
- **WHEN** the last planned iteration completes successfully
- **THEN** the system writes `final.md` from the final accepted draft and records the run status as `finished`
