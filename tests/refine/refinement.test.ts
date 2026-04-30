import { describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-ai", async () => {
  const actual = await vi.importActual<typeof import("@mariozechner/pi-ai")>(
    "@mariozechner/pi-ai"
  );

  return {
    ...actual,
    completeSimple: vi.fn()
  };
});

import {
  URANIBORG_REFINEMENT_SYSTEM_PROMPT,
  buildRefinePrompt,
  executeRefinement,
  parseRefineApiResponse,
  parseRefinementOutput,
  type RefineHttpClient
} from "../../src/refine/index.js";
import type { ResolvedUraniborgConfig } from "../../src/types/app-config.js";
import { createResolvedTestUraniborgConfig } from "../helpers/uraniborg-config.js";
import { completeSimple } from "@mariozechner/pi-ai";

describe("refinement prompt assembly", () => {
  it("assembles the Uraniborg-owned system prompt and user payload", () => {
    const prompt = buildRefinePrompt({
      currentDraft: "# Draft\n",
      peerReview: "Needs more evidence.\n",
      informationHighway: "## Iteration 1\n"
    });

    expect(prompt.systemPrompt).toBe(URANIBORG_REFINEMENT_SYSTEM_PROMPT);
    expect(prompt.userPrompt).toContain("CURRENT_DRAFT\n# Draft\n");
    expect(prompt.userPrompt).toContain("PEER_REVIEW\nNeeds more evidence.\n");
    expect(prompt.userPrompt).toContain("INFORMATION_HIGHWAY\n## Iteration 1\n");
  });
});

describe("refinement output parser", () => {
  it("parses the required refined draft and change summary sections", () => {
    const result = parseRefinementOutput(`=== REFINED_DRAFT ===
# Revised draft

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Tightened claims
`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected refinement output parsing to succeed.");
    }

    expect(result.value).toEqual({
      refinedDraft: "# Revised draft",
      changeSummary: "## Accepted reviewer points\n- Tightened claims"
    });
  });

  it("fails when content exists outside the required two sections", () => {
    const result = parseRefinementOutput(`Preface
=== REFINED_DRAFT ===
# Revised draft

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Tightened claims
`);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected refinement output parsing to fail.");
    }
    expect(result.error.code).toBe("refine_output_invalid");
  });

  it("fails when either required section is empty", () => {
    const result = parseRefinementOutput(`=== REFINED_DRAFT ===
# Revised draft

=== CHANGE_SUMMARY ===
`);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected refinement output parsing to fail.");
    }
    expect(result.error.code).toBe("refine_output_invalid");
  });
});

describe("refinement API response parsing", () => {
  it("extracts content from a chat-completions style payload", () => {
    const result = parseRefineApiResponse(
      JSON.stringify({
        id: "chatcmpl-1",
        model: "gpt-5.4",
        choices: [
          {
            message: {
              content:
                "=== REFINED_DRAFT ===\n# Revised draft\n\n=== CHANGE_SUMMARY ===\n## Accepted reviewer points\n- Tightened claims\n"
            }
          }
        ]
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected API response parsing to succeed.");
    }

    expect(result.value.id).toBe("chatcmpl-1");
    expect(result.value.model).toBe("gpt-5.4");
    expect(result.value.content).toContain("=== REFINED_DRAFT ===");
  });

  it("extracts concatenated content from structured text parts", () => {
    const result = parseRefineApiResponse(
      JSON.stringify({
        choices: [
          {
            message: {
              content: [
                {
                  text: "=== REFINED_DRAFT ===\n# Revised draft\n\n"
                },
                {
                  text: "=== CHANGE_SUMMARY ===\n## Accepted reviewer points\n- Tightened claims\n"
                }
              ]
            }
          }
        ]
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected API response parsing to succeed.");
    }

    expect(result.value.content).toContain("=== CHANGE_SUMMARY ===");
  });

  it("fails when the API response is invalid JSON or has no usable content", () => {
    const invalidJsonResult = parseRefineApiResponse("{invalid");
    const emptyContentResult = parseRefineApiResponse(
      JSON.stringify({
        choices: [
          {
            message: {
              content: []
            }
          }
        ]
      })
    );

    expect(invalidJsonResult.ok).toBe(false);
    if (!invalidJsonResult.ok) {
      expect(invalidJsonResult.error.code).toBe("refine_response_invalid_json");
    }

    expect(emptyContentResult.ok).toBe(false);
    if (!emptyContentResult.ok) {
      expect(emptyContentResult.error.code).toBe("refine_response_missing_content");
    }
  });
});

describe("refinement execution", () => {
  it("posts to the configured OpenAI-compatible endpoint and parses the response", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> | undefined;
    let capturedBody = "";

    const httpClient: RefineHttpClient = {
      async fetch(requestUrl, init) {
        capturedUrl = requestUrl;
        capturedHeaders = init.headers;
        capturedBody = init.body;

        return {
          ok: true,
          status: 200,
          async text(): Promise<string> {
            return JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      "=== REFINED_DRAFT ===\n# Revised draft\n\n=== CHANGE_SUMMARY ===\n## Accepted reviewer points\n- Tightened claims\n"
                  }
                }
              ]
            });
          }
        };
      }
    };

    const result = await executeRefinement(
      {
        config: createResolvedConfig(),
        model: "gpt-5.4",
        currentDraft: "# Draft\n",
        peerReview: "Needs more evidence.\n",
        informationHighway: "## Iteration 1\n"
      },
      {
        httpClient
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected refinement execution to succeed.");
    }

    expect(capturedUrl).toBe("https://example.com/v1/chat/completions");
    expect(capturedHeaders).toEqual({
      "content-type": "application/json",
      authorization: "Bearer secret"
    });
    expect(capturedBody).toContain("\"model\": \"gpt-5.4\"");
    expect(capturedBody).toContain("\"max_tokens\": 1200");
    expect(result.value.parsedOutput.refinedDraft).toBe("# Revised draft");
  });

  it("fails closed on a non-OK refinement response", async () => {
    const httpClient: RefineHttpClient = {
      async fetch() {
        return {
          ok: false,
          status: 503,
          async text(): Promise<string> {
            return "service unavailable";
          }
        };
      }
    };

    const result = await executeRefinement(
      {
        config: createResolvedConfig(),
        model: "gpt-5.4",
        currentDraft: "# Draft\n",
        peerReview: "Needs more evidence.\n",
        informationHighway: "## Iteration 1\n"
      },
      {
        httpClient
      }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected refinement execution to fail.");
    }
    expect(result.error.code).toBe("refine_http_error");
    expect(result.error.status).toBe(503);
  });

  it("treats an already-aborted signal as a cancelled refinement request", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const result = await executeRefinement(
      {
        config: createResolvedConfig(),
        model: "gpt-5.4",
        currentDraft: "# Draft\n",
        peerReview: "Needs more evidence.\n",
        informationHighway: "## Iteration 1\n",
        signal: abortController.signal
      },
      {
        httpClient: {
          async fetch() {
            throw new Error("Fetch should not be called for an aborted signal.");
          }
        }
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("refine_cancelled");
    }
  });

  it("executes a Pi-managed refinement request through the managed model adapter", async () => {
    const completeSimpleMock = vi.mocked(completeSimple);

    completeSimpleMock.mockResolvedValueOnce({
      role: "assistant",
      content: [
        {
          type: "text",
          text: `=== REFINED_DRAFT ===
# Revised draft

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Tightened claims`
        }
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      responseId: "msg_123",
      usage: {
        input: 10,
        output: 20,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 30,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0
        }
      },
      stopReason: "stop",
      timestamp: Date.now()
    });

    const result = await executeRefinement(
      {
        config: createResolvedTestUraniborgConfig({
          profileId: "claude-browser",
          binding: {
            type: "pi-auth-storage",
            providerId: "anthropic"
          },
          model: "claude-sonnet-4-5"
        }),
        model: "claude-sonnet-4-5",
        currentDraft: "# Draft\n",
        peerReview: "Tighten the claim.\n",
        informationHighway: "## Iteration 1\n"
      },
      {
        authClient: {
          async loginManagedCredential() {
            throw new Error("Login should not run during managed execution.");
          },
          async resolveManagedCredential() {
            throw new Error("Managed credential state should not be resolved directly in this test.");
          },
          async resolveManagedModel(providerId, modelId) {
            expect(providerId).toBe("anthropic");
            expect(modelId).toBe("claude-sonnet-4-5");

            return {
              ok: true,
              value: {
                providerId,
                model: {
                  id: modelId,
                  name: modelId,
                provider: providerId,
                api: "anthropic-messages",
                baseUrl: "https://api.anthropic.com",
                input: ["text"],
                reasoning: true,
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0
                  },
                  contextWindow: 200000,
                  maxTokens: 8192
                },
                apiKey: "oauth-token",
                headers: {
                  "x-test": "managed"
                }
              }
            };
          },
          listAvailableModelIds() {
            return ["claude-sonnet-4-5"];
          }
        }
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected managed refinement execution to succeed.");
    }

    expect(completeSimpleMock).toHaveBeenCalledTimes(1);
    expect(result.value.provider).toBe("anthropic");
    expect(result.value.requestLog).toContain("\"profileId\": \"claude-browser\"");
    expect(result.value.responseLog).toContain("\"provider\": \"anthropic\"");
    expect(result.value.parsedOutput.refinedDraft).toBe("# Revised draft");
    expect(completeSimpleMock.mock.calls.at(-1)?.[2]).toMatchObject({
      apiKey: "oauth-token",
      headers: {
        "x-test": "managed"
      },
      temperature: 0.2
    });
  });

  it("surfaces empty Pi-managed error-stopped responses as execution failures", async () => {
    const completeSimpleMock = vi.mocked(completeSimple);

    completeSimpleMock.mockResolvedValueOnce({
      role: "assistant",
      content: [],
      api: "openai-codex-responses",
      provider: "openai-codex",
      model: "gpt-5.2",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0
        }
      },
      stopReason: "error",
      errorMessage:
        "Codex runtime could not complete the request for this account.",
      timestamp: Date.now()
    });

    const result = await executeRefinement(
      {
        config: createResolvedTestUraniborgConfig({
          profileId: "openai-codex-chatgpt",
          binding: {
            type: "pi-auth-storage",
            providerId: "openai-codex"
          },
          providerContext: {
            accountId: "acct_123"
          },
          model: "gpt-5.2"
        }),
        model: "gpt-5.2",
        currentDraft: "# Draft\n",
        peerReview: "Tighten the claim.\n",
        informationHighway: "## Iteration 1\n"
      },
      {
        authClient: {
          async loginManagedCredential() {
            throw new Error("Login should not run during managed execution.");
          },
          async resolveManagedCredential() {
            throw new Error("Managed credential state should not be resolved directly in this test.");
          },
          async resolveManagedModel(providerId, modelId) {
            expect(providerId).toBe("openai-codex");
            expect(modelId).toBe("gpt-5.2");

            return {
              ok: true,
              value: {
                providerId,
                model: {
                  id: modelId,
                  name: modelId,
                  provider: providerId,
                  api: "openai-codex-responses",
                  baseUrl: "https://chatgpt.com/backend-api",
                  input: ["text"],
                  reasoning: true,
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0
                  },
                  contextWindow: 200000,
                  maxTokens: 32768
                },
                apiKey: "oauth-token"
              }
            };
          },
          listAvailableModelIds() {
            return ["gpt-5.2"];
          }
        }
      }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected managed refinement execution to fail.");
    }

    expect(result.error.code).toBe("refine_http_error");
    expect(result.error.message).toBe(
      "Codex runtime could not complete the request for this account."
    );
    expect(result.error.rawOutput).toBeUndefined();
    expect(result.error.responseLog).toContain("\"stopReason\": \"error\"");
    expect(result.error.responseLog).toContain(
      "\"errorMessage\": \"Codex runtime could not complete the request for this account.\""
    );
    expect(completeSimpleMock.mock.calls.at(-1)?.[2]).not.toHaveProperty("temperature");
  });
});

function createResolvedConfig(): ResolvedUraniborgConfig {
  return createResolvedTestUraniborgConfig({
    profileId: "manual-openai-compatible",
    binding: {
      type: "env-var",
      envVar: "OPENAI_API_KEY",
      resolvedApiKey: "secret"
    },
    model: "gpt-5.4",
    temperature: 0.2,
    maxOutputTokens: 1200,
    timeoutMs: 30_000,
    baseUrl: "https://example.com/v1"
  });
}
