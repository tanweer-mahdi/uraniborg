import {
  completeSimple,
  type AssistantMessage,
  type Context
} from "@mariozechner/pi-ai";

import {
  createRevisionAuthClient,
  type RevisionAuthClient
} from "../config/revision-auth.js";
import { getRevisionProfile } from "../config/revision-profiles.js";
import { err, ok, type Result } from "../types/result.js";
import {
  buildRefinePrompt,
  parseRefinementOutput,
  type ExecuteRefinementInput,
  type ExecutedRefinement,
  type RefineError
} from "./refinement.js";

export interface ExecuteRefinementDependencies {
  authClient?: RevisionAuthClient | undefined;
}

export async function executeRefinement(
  input: ExecuteRefinementInput,
  dependencies: ExecuteRefinementDependencies = {}
): Promise<Result<ExecutedRefinement, RefineError>> {
  const authClient = dependencies.authClient ?? createRevisionAuthClient();
  const profile = getRevisionProfile(input.config.revision.profile.id);
  const providerId = input.config.revision.runtime.providerId;
  const resolveManagedModel = authClient.resolveManagedModel;

  if (typeof resolveManagedModel !== "function") {
    return err({
      code: "refine_http_error",
      message: `Revision runtime does not support managed model execution for "${profile.label}".`
    });
  }

  const modelResolutionResult = await resolveManagedModel.call(
    authClient,
    providerId,
    input.model
  );

  if (modelResolutionResult === undefined) {
    return err({
      code: "refine_http_error",
      message: `Revision runtime did not return a managed model resolution for "${profile.label}".`
    });
  }

  if (!modelResolutionResult.ok) {
    return err({
      code: "refine_http_error",
      message: modelResolutionResult.error.message,
      details: modelResolutionResult.error.details
    });
  }

  const modelResolution = modelResolutionResult.value;

  const prompt = buildRefinePrompt({
    currentDraft: input.currentDraft,
    peerReview: input.peerReview,
    informationHighway: input.informationHighway,
    revisionInstruction: input.config.revision.instructionPrompt.effectiveInstruction
  });
  const context: Context = {
    systemPrompt: prompt.systemPrompt,
    messages: [
      {
        role: "user",
        content: prompt.userPrompt,
        timestamp: Date.now()
      }
    ]
  };

  try {
    const requestOptions = buildManagedExecutionOptions(
      providerId,
      modelResolution.apiKey,
      modelResolution.headers,
      input.signal,
      input.config.refine.defaults.temperature,
      input.config.refine.defaults.maxOutputTokens
    );

    const response = await completeSimple(
      modelResolution.model,
      context,
      requestOptions
    );

    const responseText = extractTextContent(response);
    const requestLog = JSON.stringify(
      {
        provider: providerId,
        profileId: profile.id,
        model: input.model,
        timeoutMs: input.config.refine.endpoint.timeoutMs,
        providerContext: input.config.revision.providerContext,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt
      },
      null,
      2
    );
    const responseLog = JSON.stringify(
      {
        provider: response.provider,
        api: response.api,
        model: response.model,
        responseId: response.responseId,
        stopReason: response.stopReason,
        errorMessage: response.errorMessage,
        usage: response.usage,
        text: responseText
      },
      null,
      2
    );
    const normalizedStopReason =
      response.stopReason === "toolUse" ? "stop" : response.stopReason;
    const providerErrorMessage =
      typeof response.errorMessage === "string" &&
      response.errorMessage.trim().length > 0
        ? response.errorMessage.trim()
        : undefined;

    if (
      response.stopReason === "error" &&
      responseText.length === 0
    ) {
      return err({
        code: "refine_http_error",
        message:
          providerErrorMessage ??
          `Refinement request could not be completed for "${profile.label}".`,
        ...(providerErrorMessage === undefined
          ? {}
          : {
              details: [
                `Provider/runtime reported stopReason "${response.stopReason}" without a usable text response.`
              ]
            }),
        provider: providerId,
        model: response.model,
        requestLog,
        responseLog,
        responseId: response.responseId,
        stopReason: normalizedStopReason
      });
    }

    const parsedOutput = parseRefinementOutput(responseText);

    if (!parsedOutput.ok) {
      return err({
        ...parsedOutput.error,
        provider: providerId,
        model: response.model,
        requestLog,
        responseLog,
        responseId: response.responseId,
        stopReason: normalizedStopReason,
        rawOutput: responseText
      });
    }

    return ok({
      provider: providerId,
      model: response.model,
      requestLog,
      responseLog,
      responseId: response.responseId,
      stopReason: normalizedStopReason,
      parsedOutput: parsedOutput.value
    });
  } catch (error) {
    if (input.signal?.aborted) {
      return err({
        code: "refine_cancelled",
        message: "Refinement request was cancelled."
      });
    }

    return err({
      code: "refine_http_error",
      message: `Refinement request could not be completed for "${profile.label}".`,
      details: [error instanceof Error ? error.message : "Unknown provider runtime failure."]
    });
  }
}

function extractTextContent(response: AssistantMessage): string {
  return response.content
    .filter(
      (
        block
      ): block is Extract<AssistantMessage["content"][number], { type: "text" }> =>
        block.type === "text"
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function buildManagedExecutionOptions(
  providerId: string,
  apiKey: string,
  headers: Record<string, string> | undefined,
  signal: AbortSignal | undefined,
  temperature: number,
  maxOutputTokens: number | undefined
) {
  return {
    apiKey,
    ...(headers === undefined ? {} : { headers }),
    ...(signal === undefined ? {} : { signal }),
    ...(providerId === "openai-codex" ? {} : { temperature }),
    ...(typeof maxOutputTokens === "number"
      ? {
          maxTokens: maxOutputTokens
        }
      : {})
  };
}
