## ADDED Requirements

### Requirement: Selected Run HTML Snapshot
The system SHALL generate a self-contained local HTML snapshot for one selected Uraniborg run.

#### Scenario: Snapshot is generated for selected run
- **WHEN** the user requests browser exploration for a specific run id
- **THEN** the system generates an HTML snapshot scoped to that run id
- **AND** the snapshot includes the selected run's curated Summary and primary reader navigation

#### Scenario: Snapshot is self-contained
- **WHEN** the selected run snapshot is generated
- **THEN** the snapshot includes the runtime CSS, metadata, navigation structure, and preview content required for browser exploration
- **AND** the snapshot does not require a local HTTP server or additional local fetches to remain usable
- **AND** the snapshot does not require external scripts, stylesheets, fonts, images, CDNs, or network resources to render its embedded content

#### Scenario: Snapshot remains usable after Uraniborg exits
- **WHEN** the generated snapshot is open in the browser and the Uraniborg process exits
- **THEN** the already-open snapshot remains usable for reading and navigating the selected run content embedded in that snapshot

#### Scenario: Snapshot path is reported
- **WHEN** the selected run snapshot is generated
- **THEN** the system reports the snapshot file path or `file://` URL to the user

#### Scenario: Missing run is reported
- **WHEN** the user requests browser exploration for a run id that does not exist
- **THEN** the system reports that the run was not found rather than generating an unrelated snapshot

#### Scenario: Snapshot contains only selected run content
- **WHEN** the system generates a snapshot for a selected run id
- **THEN** the snapshot includes only metadata and artifacts from that selected run
- **AND** the snapshot does not include a browser index of all runs
- **AND** the snapshot does not include adjacent-run navigation
- **AND** the snapshot does not embed artifacts from any other run

### Requirement: Browser Launch
The system SHALL open generated run snapshots in the user's browser without requiring a local server.

#### Scenario: Snapshot opens in browser
- **WHEN** snapshot generation succeeds
- **THEN** the system attempts to open the generated snapshot using a `file://` URL

#### Scenario: Browser open failure is non-fatal
- **WHEN** snapshot generation succeeds but automatic browser opening fails
- **THEN** the system keeps the snapshot file available
- **AND** the system reports the snapshot path or `file://` URL so the user can open it manually

### Requirement: Read-Only Selected Run Boundary
The snapshot generator SHALL read only the selected run's manifest and artifacts, and SHALL NOT mutate run history.

#### Scenario: Snapshot generation is read-only
- **WHEN** the system generates a selected run snapshot
- **THEN** no run manifest or source artifact is modified

#### Scenario: Artifact reads are confined to selected run
- **WHEN** the snapshot generator reads an artifact
- **THEN** it resolves the artifact path against the selected run directory
- **AND** it reads the artifact only when the normalized real path remains under that selected run directory

#### Scenario: Symlink escape is rejected
- **WHEN** a selected run artifact path resolves through a symlink outside the selected run directory
- **THEN** the snapshot generator rejects that artifact
- **AND** no file outside the selected run directory is embedded in the snapshot

#### Scenario: Path traversal is rejected
- **WHEN** a candidate artifact path would escape the selected run directory
- **THEN** the snapshot generator rejects that artifact
- **AND** no file outside the selected run directory is read

#### Scenario: Snapshot does not upload data
- **WHEN** the system generates or opens a selected run snapshot
- **THEN** Uraniborg does not upload run data or artifact content to any remote service

### Requirement: Primary Reader Content
The selected run snapshot SHALL present a curated primary reader for interruption-free reading rather than a generic artifact dump.

#### Scenario: Snapshot shows manifest summary
- **WHEN** the selected run snapshot is opened
- **THEN** it shows the run id, title, status, phase, progress, created time, updated time, source input path, selected review model, and selected refinement model

#### Scenario: Snapshot shows failure diagnostics
- **WHEN** the selected run manifest contains a last error
- **THEN** the snapshot shows the error code, message, and timestamp

#### Scenario: Snapshot uses primary reader navigation
- **WHEN** the selected run contains the corresponding reader documents
- **THEN** the snapshot navigation is ordered as Summary, Original, each Iteration with nested Review and Refined entries, and final Refined

#### Scenario: Original maps to original Markdown
- **WHEN** the selected run contains `original.md`
- **THEN** the snapshot exposes it as the Original reader section

#### Scenario: Iteration review maps to review Markdown
- **WHEN** iteration N contains `review.md`
- **THEN** the snapshot exposes it as Iteration N Review

#### Scenario: Iteration refined maps to refined Markdown
- **WHEN** iteration N contains `refined.md`
- **THEN** the snapshot exposes it as Iteration N Refined

#### Scenario: Final refined maps to final Markdown
- **WHEN** the selected run contains `final.md`
- **THEN** the snapshot exposes it as the final Refined reader section

#### Scenario: Primary reader excludes implementation artifacts
- **WHEN** the selected run contains `run.json`, `config.snapshot.json`, `input.md`, `current.md`, `information-highway.md`, `review.log`, `changes.md`, `refine.log`, or `refine.response.txt`
- **THEN** the snapshot does not expose those files as primary reader sections

#### Scenario: Missing optional artifacts are handled
- **WHEN** an expected optional artifact is absent
- **THEN** the snapshot either omits that reader section or marks it unavailable without failing the whole snapshot generation

#### Scenario: Primary reader uses user-facing labels
- **WHEN** the selected run snapshot is opened
- **THEN** the primary navigation and reader panels use user-facing labels such as Summary, Original, Iteration N, Review, and Refined
- **AND** the primary reader does not show raw file paths or labels such as Original draft, Input draft, Final draft, or Top-level artifacts

#### Scenario: Only selected reader panel is visible
- **WHEN** the selected run snapshot is opened
- **THEN** the Summary panel is visible by default
- **AND** non-selected reader panels are hidden until selected from the navigation

### Requirement: Markdown Artifact Rendering
The selected run snapshot SHALL render Markdown artifacts into safe browser-readable HTML while preserving the Markdown files as source artifacts.

#### Scenario: Markdown renders as formatted HTML
- **WHEN** the selected run contains a Markdown artifact
- **THEN** the snapshot renders Markdown syntax such as headings, lists, links, code fences, and tables as formatted browser content using `markdown-it`

#### Scenario: Raw HTML inside Markdown is disabled
- **WHEN** a Markdown artifact contains raw HTML tags or script-like content
- **THEN** the Markdown renderer treats that raw HTML as text or removes it by using `markdown-it` with raw HTML disabled
- **AND** artifact-provided HTML does not become live browser DOM

#### Scenario: Rendered Markdown is sanitized
- **WHEN** Markdown content is converted into HTML for the snapshot
- **THEN** the generated HTML is sanitized with `sanitize-html` before it is embedded in the snapshot

#### Scenario: Markdown source remains unchanged
- **WHEN** the snapshot renders a Markdown artifact
- **THEN** the original Markdown artifact on disk remains unchanged

### Requirement: Reader Preview Boundaries
The selected run snapshot SHALL preview supported primary reader documents safely and handle unsupported or large reader documents explicitly.

#### Scenario: Text reader document preview
- **WHEN** the selected run contains a supported primary reader document such as Markdown or plain text
- **THEN** the snapshot includes a readable preview for that reader document

#### Scenario: Unsupported reader document preview
- **WHEN** a primary reader document is unsupported or binary
- **THEN** the snapshot reports that preview is unavailable rather than rendering unsafe or unreadable content

#### Scenario: Large reader document preview remains bounded
- **WHEN** the selected run contains a primary reader document larger than the configured preview limit
- **THEN** the snapshot truncates or summarizes the preview
- **AND** the snapshot communicates that the reader document preview was limited

### Requirement: Package-Safe Snapshot Assets
The selected run snapshot generator SHALL include all runtime templates/assets required by the published npm package.

#### Scenario: Build includes snapshot assets
- **WHEN** the package build runs
- **THEN** the compiled package output includes the templates or static assets required to generate selected run snapshots

#### Scenario: Package validation checks snapshot assets
- **WHEN** package validation runs
- **THEN** it fails if required selected run snapshot templates or assets are missing from the package output
