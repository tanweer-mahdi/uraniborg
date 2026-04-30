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
  parseRefinementOutput
} from "../../src/refine/index.js";
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
});

describe("refinement execution", () => {
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

    expect(result.value.provider).toBe("anthropic");
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
    expect(completeSimpleMock.mock.calls.at(-1)?.[2]).not.toHaveProperty("temperature");
  });
});
