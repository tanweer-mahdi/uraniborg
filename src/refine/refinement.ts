import { z } from "zod";

import type { ResolvedUraniborgConfig } from "../types/app-config.js";
import { err, ok, type Result } from "../types/result.js";

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

export interface RefineApiResponse {
  id?: string | undefined;
  model?: string | undefined;
  content: string;
}

export type RefineErrorCode =
  | "refine_http_error"
  | "refine_cancelled"
  | "refine_response_invalid_json"
  | "refine_response_invalid_schema"
  | "refine_response_missing_content"
  | "refine_output_invalid";

export interface RefineError {
  code: RefineErrorCode;
  message: string;
  details?: readonly string[] | undefined;
  status?: number | undefined;
}

export interface RefineHttpResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface RefineHttpClient {
  fetch: (
    requestUrl: string,
    init: {
      method: "POST";
      headers: Record<string, string>;
      body: string;
      signal: AbortSignal;
    }
  ) => Promise<RefineHttpResponse>;
}

export interface ExecuteRefinementInput extends RefinePromptInput {
  config: ResolvedUraniborgConfig;
  model: string;
  signal?: AbortSignal | undefined;
}

export interface ExecutedRefinement {
  requestUrl: string;
  requestBody: string;
  responseBody: string;
  apiResponse: RefineApiResponse;
  parsedOutput: ParsedRefinementOutput;
}

const textContentPartSchema = z.object({
  text: z.string()
});

const chatCompletionResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([z.string(), z.array(textContentPartSchema)])
        })
      })
    )
    .min(1)
});

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

export async function executeRefinement(
  input: ExecuteRefinementInput,
  httpClient: RefineHttpClient = createFetchRefineHttpClient()
): Promise<Result<ExecutedRefinement, RefineError>> {
  const prompt = buildRefinePrompt(input);
  const requestUrl = buildChatCompletionsUrl(input.config.refine.endpoint.baseUrl);
  const requestBody = JSON.stringify(
    {
      model: input.model,
      temperature: input.config.refine.defaults.temperature,
      ...(typeof input.config.refine.defaults.maxOutputTokens === "number"
        ? { max_tokens: input.config.refine.defaults.maxOutputTokens }
        : {}),
      messages: [
        {
          role: "system",
          content: prompt.systemPrompt
        },
        {
          role: "user",
          content: prompt.userPrompt
        }
      ]
    },
    null,
    2
  );
  const abortController = new AbortController();
  let timedOut = false;
  const externalAbortListener = (): void => {
    abortController.abort();
  };

  if (input.signal?.aborted) {
    return err(
      createRefineError({
        code: "refine_cancelled",
        message: "Refinement request was cancelled."
      })
    );
  }

  input.signal?.addEventListener("abort", externalAbortListener, { once: true });
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, input.config.refine.endpoint.timeoutMs);

  try {
    const response = await httpClient.fetch(requestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.config.refine.endpoint.apiKey}`
      },
      body: requestBody,
      signal: abortController.signal
    });
    const responseBody = await response.text();

    if (!response.ok) {
      return err(
        createRefineError({
          code: "refine_http_error",
          message: `Refinement request failed with HTTP status ${response.status}.`,
          details: responseBody.trim().length > 0 ? [responseBody.trim()] : undefined,
          status: response.status
        })
      );
    }

    const parsedApiResponse = parseRefineApiResponse(responseBody);

    if (!parsedApiResponse.ok) {
      return parsedApiResponse;
    }

    const parsedOutput = parseRefinementOutput(parsedApiResponse.value.content);

    if (!parsedOutput.ok) {
      return parsedOutput;
    }

    return ok({
      requestUrl,
      requestBody,
      responseBody,
      apiResponse: parsedApiResponse.value,
      parsedOutput: parsedOutput.value
    });
  } catch (error) {
    if (input.signal?.aborted) {
      return err(
        createRefineError({
          code: "refine_cancelled",
          message: "Refinement request was cancelled."
        })
      );
    }

    if (timedOut) {
      return err(
        createRefineError({
          code: "refine_http_error",
          message: "Refinement request timed out."
        })
      );
    }

    return err(
      createRefineError({
        code: "refine_http_error",
        message: "Refinement request could not be completed.",
        details: [error instanceof Error ? error.message : "Unknown HTTP failure."]
      })
    );
  } finally {
    clearTimeout(timeoutHandle);
    input.signal?.removeEventListener("abort", externalAbortListener);
  }
}

export function parseRefineApiResponse(
  responseBody: string
): Result<RefineApiResponse, RefineError> {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseBody) as unknown;
  } catch (error) {
    return err(
      createRefineError({
        code: "refine_response_invalid_json",
        message: "Refinement endpoint returned invalid JSON.",
        details: [error instanceof Error ? error.message : "Unknown JSON failure."]
      })
    );
  }

  const parsedResponse = chatCompletionResponseSchema.safeParse(parsedJson);

  if (!parsedResponse.success) {
    return err(
      createRefineError({
        code: "refine_response_invalid_schema",
        message: "Refinement endpoint returned a response outside the expected chat-completions schema.",
        details: parsedResponse.error.issues.map((issue) => issue.message)
      })
    );
  }

  const firstChoice = parsedResponse.data.choices[0];

  if (firstChoice === undefined) {
    return err(
      createRefineError({
        code: "refine_response_missing_content",
        message: "Refinement endpoint returned no completion choices."
      })
    );
  }

  const content = extractResponseContent(firstChoice.message.content);

  if (content.length === 0) {
    return err(
      createRefineError({
        code: "refine_response_missing_content",
        message: "Refinement endpoint returned an empty message content payload."
      })
    );
  }

  return ok({
    id: parsedResponse.data.id,
    model: parsedResponse.data.model,
    content
  });
}

export function createFetchRefineHttpClient(
  fetchImplementation: typeof fetch = fetch
): RefineHttpClient {
  return {
    async fetch(requestUrl, init): Promise<RefineHttpResponse> {
      const response = await fetchImplementation(requestUrl, init);

      return {
        ok: response.ok,
        status: response.status,
        async text(): Promise<string> {
          return response.text();
        }
      };
    }
  };
}

function extractResponseContent(
  content: string | Array<{ text: string }>
): string {
  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .map((part) => part.text)
    .join("")
    .trim();
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalizedBaseUrl).toString();
}

function createRefineError(input: RefineError): RefineError {
  return {
    code: input.code,
    message: input.message,
    ...(input.details !== undefined ? { details: input.details } : {}),
    ...(input.status !== undefined ? { status: input.status } : {})
  };
}
