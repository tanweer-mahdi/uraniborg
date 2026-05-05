## Context

Feynman is an external prerequisite. Uraniborg must not bundle or install it automatically, but `doctor` should tell users exactly how to install the expected npm package when no `feynman` executable is discoverable on `PATH`.

Current doctor output is assembled from Feynman runtime/readiness checks. The safest implementation is to add the exact command to the missing-runtime diagnostic detail or remediation text, then ensure the doctor renderer surfaces it.

## Goals / Non-Goals

**Goals:**
- Render `npm install -g @companion-ai/feynman@latest` when `uraniborg doctor` reports that Feynman is missing from `PATH`.
- Keep missing-runtime guidance deterministic and test-covered.
- Avoid changing behavior for incompatible discovered runtimes or optional readiness warnings.

**Non-Goals:**
- Automatically install Feynman.
- Change Feynman compatibility checks or supported version ranges.
- Change npm package publication behavior.

## Decisions

- Define the exact install command once in the review/remediation layer or another shared constant near existing Feynman remediation text.
- Preserve existing doctor output structure and append the command as a visible detail under the failing review runtime check.
- Add tests at the doctor rendering level, and optionally the readiness/remediation level if the command is produced there.

## Risks / Trade-offs

- If the install command is hardcoded in multiple places, future package-name changes can drift -> centralize the string.
- If the command is hidden by doctor detail filtering, users still will not see it -> update the visible-detail filter or render path with regression coverage.
