import { err, ok, type Result } from "../types/result.js";
import type { ResolvedUraniborgConfig } from "../types/app-config.js";

export const URANIBORG_REFINEMENT_SYSTEM_PROMPT = `You are revising a research document in response to peer review.

Your job is to produce:
1. A full revised draft.
2. A structured change summary.

You are not the reviewer. You are the author making disciplined revisions.

Inputs you will receive:
- CURRENT_DRAFT: the latest full draft
- PEER_REVIEW: the latest review of that draft
- INFORMATION_HIGHWAY: structured memory of prior accepted changes, rejected suggestions, open issues, and regression guards

Behavior rules:
- Treat the peer review seriously, but do not obey it blindly.
- Apply strong reviewer points when they improve rigor, clarity, calibration, structure, or reproducibility.
- Reject weak, mistaken, redundant, or conflicting reviewer suggestions explicitly in the change summary.
- Never revert a prior accepted change unless the current review gives a strong reason; if you do revert something, explain it explicitly.
- Respect the regression guards in INFORMATION_HIGHWAY.
- Prefer softening unsupported claims over inventing evidence.
- Do not fabricate experiments, citations, numbers, ablations, baselines, or results.
- Keep the document internally consistent after revision.
- Preserve Markdown structure and produce a complete standalone revised draft, not a patch or fragment.
- If the review requests work that cannot honestly be completed from the available material, acknowledge the limitation and revise the draft conservatively.

Output format:
=== REFINED_DRAFT ===
<full revised markdown document>

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- ...

## Rejected reviewer points
- ...
Reason: ...

## Changes made
- ...

## Open issues
- ...

## Regression guards
- ...

Quality bar:
- The revised draft must be publishable-quality relative to the input.
- The change summary must be specific enough to prevent future A -> B -> A oscillation.
- Do not include any text outside the required two sections.`;

export interface RefinePromptInput {
  currentDraft: string;
  peerReview: string;
  informationHighway: string;
}

export interface RefinePrompt {
  systemPrompt: string;
  userPrompt: string;
}

export interface ParsedRefinementOutput {
  refinedDraft: string;
  changeSummary: string;
}

export type RefineErrorCode =
  | "refine_http_error"
  | "refine_cancelled"
  | "refine_output_invalid";

export interface RefineError {
  code: RefineErrorCode;
  message: string;
  details?: readonly string[] | undefined;
  status?: number | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  requestLog?: string | undefined;
  responseLog?: string | undefined;
  responseId?: string | undefined;
  stopReason?: "stop" | "length" | "aborted" | "error" | undefined;
  rawOutput?: string | undefined;
}

export interface ExecuteRefinementInput extends RefinePromptInput {
  config: ResolvedUraniborgConfig;
  model: string;
  signal?: AbortSignal | undefined;
}

export interface ExecutedRefinement {
  provider: string;
  model: string;
  requestLog: string;
  responseLog: string;
  responseId?: string | undefined;
  stopReason?: "stop" | "length" | "aborted" | "error" | undefined;
  parsedOutput: ParsedRefinementOutput;
}

export function buildRefinePrompt(input: RefinePromptInput): RefinePrompt {
  return {
    systemPrompt: URANIBORG_REFINEMENT_SYSTEM_PROMPT,
    userPrompt: [
      "CURRENT_DRAFT",
      input.currentDraft,
      "",
      "PEER_REVIEW",
      input.peerReview,
      "",
      "INFORMATION_HIGHWAY",
      input.informationHighway
    ].join("\n")
  };
}

export function parseRefinementOutput(
  output: string
): Result<ParsedRefinementOutput, RefineError> {
  const trimmedOutput = output.trim();
  const match = trimmedOutput.match(
    /^=== REFINED_DRAFT ===\s*\n([\s\S]*?)\n=== CHANGE_SUMMARY ===\s*\n([\s\S]*)$/
  );

  if (match === null) {
    return err(
      createRefineError({
        code: "refine_output_invalid",
        message:
          "Refinement output did not match the required === REFINED_DRAFT === / === CHANGE_SUMMARY === contract."
      })
    );
  }

  const refinedDraft = match[1]?.trim() ?? "";
  const changeSummary = match[2]?.trim() ?? "";

  if (refinedDraft.length === 0 || changeSummary.length === 0) {
    return err(
      createRefineError({
        code: "refine_output_invalid",
        message:
          "Refinement output matched the section markers but produced an empty refined draft or change summary."
      })
    );
  }

  return ok({
    refinedDraft,
    changeSummary
  });
}

export function createRefineError(input: {
  code: RefineErrorCode;
  message: string;
  details?: readonly string[] | undefined;
  status?: number | undefined;
}): RefineError {
  return {
    code: input.code,
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
    ...(typeof input.status === "number" ? { status: input.status } : {})
  };
}
