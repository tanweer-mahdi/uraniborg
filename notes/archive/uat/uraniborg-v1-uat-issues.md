# Uraniborg v1 UAT Issues

Date created: 2026-04-25
Purpose: track concrete UAT defects discovered during manual testing
Related docs:

- [uraniborg-v1-uat-plan.md](./uraniborg-v1-uat-plan.md)
- [uraniborg-v1-uat-instructions.md](./uraniborg-v1-uat-instructions.md)
- [uraniborg-v1-uat-resume-instructions.md](./uraniborg-v1-uat-resume-instructions.md)
- [uraniborg-v1-uat-observations.md](./uraniborg-v1-uat-observations.md)
- [uraniborg-v1-uat-bug-inventory.md](./archive/uat/uraniborg-v1-uat-bug-inventory.md)

## Session Rule For This File

This file captures concrete UAT issues.

For the current session:

- do not treat entries here as approved code changes
- keep issues here separate from broader observations and improvement ideas
- prefer one entry per distinct operator-visible defect

## How To Use This File

Add one entry per distinct UAT issue.

Suggested statuses:

- `open`
- `confirmed`
- `in_progress`
- `fixed_pending_retest`
- `closed`

Suggested severities:

- `P0`
  - blocks first-run use, corrupts state, or prevents progression
- `P1`
  - major UX or workflow defect with workaround
- `P2`
  - non-blocking but visible product-quality issue

## Issue Template

```markdown
## UAT-ISSUE-XXX - Short title

- Date:
- Status:
- Severity:
- UAT case:
- Command:

### Expected

-

### Observed

-

### Evidence

-

### Notes

-
```

## Active Issues

## UAT-ISSUE-001 - Fresh setup completion message leaks raw exit-code detail

- Date: 2026-04-25
- Status: confirmed
- Severity: P2
- UAT case: first-run review-side setup via `doctor`
- Command: `node dist/src/cli/main.js doctor`

### Expected

- After Feynman setup completes successfully, Uraniborg should show a polished operator-facing success message.
- The message should not expose low-level process artifacts such as `exit 0`.

### Observed

- Uraniborg reported: `Finished feynman setup with exit 0`.
- The phrasing reads like an internal process result rather than a finished product message.

### Evidence

- Host-shell UAT output after completing the surfaced Feynman setup flow included:
  - `Finished feynman setup with exit 0`

### Notes

- This is consistent with the broader UAT theme that raw execution fragments should not appear in default CLI UX.

## UAT-ISSUE-002 - Selecting web-search setup does not launch the web-search config flow

- Date: 2026-04-25
- Status: confirmed
- Severity: P1
- UAT case: recommended web-search capability remediation from `doctor`
- Command: `node dist/src/cli/main.js doctor`

### Expected

- If the operator selects `Yes` to configure Feynman web search, Uraniborg should launch the specific Feynman flow needed to configure web-search providers.
- The launched flow should match the remediation text and user intent.

### Observed

- Uraniborg offered:
  - `Configure web-search providers for fresher web research coverage. Launch feynman setup now?`
- After selecting `Yes`, it launched a generic Feynman setup screen instead of the web-search configuration wizard.

### Evidence

- Prompt shown:
  - `Configure web-search providers for fresher web research coverage. Launch feynman setup now?`
- Resulting screen:

```text
Launching feynman setup via the selected Feynman runtime...
┌  Feynman setup
  Model: openai-codex/gpt-5.4

◆ Packages
  No additional package install required.
│
◆  Optional packages
│  ◻ generative-ui (Interactive Glimpse UI widgets.)
└
```

### Notes

- This appears to be a remediation-routing defect: the operator selected a web-search-specific action, but Uraniborg launched a broader generic setup flow instead.
- This is not just copy quality; the launched recovery path does not match the user-selected capability.
