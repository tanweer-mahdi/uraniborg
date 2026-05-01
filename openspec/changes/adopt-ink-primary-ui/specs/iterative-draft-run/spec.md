## ADDED Requirements

### Requirement: Interactive Run Setup Workflow
The system SHALL expose run creation through an Ink-hosted run-setup workflow that preserves the same input validation, readiness checks, and model-selection gates as the current run contract.

#### Scenario: Run route preselects source file in setup workflow
- **WHEN** the user launches `uraniborg run <file>` in an interactive TTY with a valid Markdown source path
- **THEN** the system opens the Ink run-setup workflow with that file preselected instead of starting a prompt-by-prompt command flow

#### Scenario: Interactive run launch requires explicit confirmation
- **WHEN** the user reaches the Ink run-setup workflow with a valid source file and all required selections are resolvable
- **THEN** the system still requires an explicit launch action from that workflow instead of auto-starting execution

#### Scenario: Run setup blocks launch until required state is ready
- **WHEN** the user is in the interactive run-setup workflow and required review or revision readiness is not satisfied
- **THEN** the system blocks run launch and surfaces the relevant remediation or setup guidance before execution begins

### Requirement: Interactive Run Progress Workflow
The system SHALL expose live run execution through an Ink-hosted progress workflow while preserving the same deterministic review/refine execution behavior and artifact writes.

#### Scenario: Run progress route shows live iteration state
- **WHEN** a run starts from the interactive run workflow
- **THEN** the Ink application displays the run id, current iteration, current phase, and current status inside a persistent progress route while execution is active

#### Scenario: Review failure remains semantically distinct
- **WHEN** a run fails during the review phase
- **THEN** the interactive progress workflow identifies the failure as a review failure and surfaces the relevant diagnostic pointer needed for local diagnosis

#### Scenario: Refinement execution failure remains semantically distinct
- **WHEN** a run fails because refinement execution ended without usable final text
- **THEN** the interactive progress workflow identifies the failure as a refinement execution failure and surfaces the relevant diagnostic pointer needed for local diagnosis

#### Scenario: Refinement output contract failure remains semantically distinct
- **WHEN** a run fails because refinement returned non-empty text that violated Uraniborg's required parse contract
- **THEN** the interactive progress workflow identifies the failure as a refinement output contract failure and surfaces the relevant malformed-output artifact and log pointers needed for diagnosis

#### Scenario: Memory update failure remains semantically distinct
- **WHEN** a run fails during the memory update phase
- **THEN** the interactive progress workflow identifies the failure as a memory update failure and surfaces the relevant diagnostic pointer needed for local diagnosis

#### Scenario: Run completion exposes final output
- **WHEN** the final planned iteration completes successfully
- **THEN** the interactive progress workflow surfaces the successful completion state and the resulting final run artifact location
