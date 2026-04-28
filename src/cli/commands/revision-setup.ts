import {
  cancel,
  intro,
  isCancel,
  outro,
  select,
  text
} from "@clack/prompts";

import {
  ensureUraniborgAppHome,
  loadParsedUraniborgConfig,
  resolveUraniborgPaths,
  saveUraniborgConfig
} from "../../config/index.js";
import type { UraniborgConfig } from "../../types/app-config.js";

export interface RevisionSetupPrompts {
  intro: typeof intro;
  outro: typeof outro;
  cancel: typeof cancel;
  select: typeof select;
  text: typeof text;
  isCancel: typeof isCancel;
}

export interface RevisionSetupDependencies {
  resolvePaths?: typeof resolveUraniborgPaths;
  ensureAppHome?: typeof ensureUraniborgAppHome;
  loadConfig?: typeof loadParsedUraniborgConfig;
  saveConfig?: typeof saveUraniborgConfig;
  prompts?: RevisionSetupPrompts;
}

export async function runGuidedRevisionSetup(
  dependencies: RevisionSetupDependencies = {}
): Promise<void> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const loadConfig = dependencies.loadConfig ?? loadParsedUraniborgConfig;
  const saveConfig = dependencies.saveConfig ?? saveUraniborgConfig;
  const prompts = dependencies.prompts ?? {
    intro,
    outro,
    cancel,
    select,
    text,
    isCancel
  };
  const paths = resolvePaths();
  await ensureAppHome(paths);

  const existingConfig = await loadExistingConfig(paths.configFile, loadConfig);
  const initialConfig = existingConfig ?? createDefaultConfig();

  prompts.intro("Uraniborg revision setup");

  const provider = await promptRevisionProvider(
    initialConfig.refine.endpoint.baseUrl,
    prompts
  );
  const baseUrl = await resolveRevisionEndpointUrl(
    provider,
    initialConfig.refine.endpoint.baseUrl,
    prompts
  );
  const apiKey = await promptText(
    {
      message: "Revision API key",
      initialValue: initialConfig.refine.endpoint.apiKey ?? "",
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the API key Uraniborg should use for revision.";
      }
    },
    prompts
  );
  const model = await promptText(
    {
      message: "Default revision model",
      initialValue: initialConfig.refine.defaults.model,
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the default revision model name.";
      }
    },
    prompts
  );

  const nextConfig: UraniborgConfig = {
    version: 1,
    refine: {
      endpoint: {
        baseUrl,
        apiKey,
        timeoutMs: initialConfig.refine.endpoint.timeoutMs
      },
      defaults: {
        model,
        temperature: initialConfig.refine.defaults.temperature,
        ...(typeof initialConfig.refine.defaults.maxOutputTokens === "number"
          ? { maxOutputTokens: initialConfig.refine.defaults.maxOutputTokens }
          : {})
      }
    }
  };

  await saveConfig(paths.configFile, nextConfig);
  prompts.outro(`Saved Uraniborg revision config to ${paths.configFile}`);
}

async function loadExistingConfig(
  configFilePath: string,
  loadConfig: typeof loadParsedUraniborgConfig
): Promise<UraniborgConfig | null> {
  const result = await loadConfig(configFilePath);

  if (result.ok) {
    return result.value;
  }

  if (result.error.code === "config_not_found") {
    return null;
  }

  throw new Error(result.error.message);
}

function createDefaultConfig(): UraniborgConfig {
  return {
    version: 1,
    refine: {
      endpoint: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        timeoutMs: 60000
      },
      defaults: {
        model: "gpt-5",
        temperature: 0.2
      }
    }
  };
}

async function promptText(
  options: {
    message: string;
    initialValue: string;
    validate: (value: string) => string | undefined;
  },
  prompts: RevisionSetupPrompts
): Promise<string> {
  const response = await prompts.text({
    message: options.message,
    defaultValue: options.initialValue,
    validate: options.validate
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  return response;
}

type RevisionEndpointProvider =
  | "chatgpt"
  | "gemini"
  | "anthropic"
  | "manual";

const CHATGPT_REVISION_ENDPOINT = "https://api.openai.com/v1";
const GEMINI_REVISION_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const ANTHROPIC_REVISION_ENDPOINT = "https://api.anthropic.com/v1/";

async function promptRevisionProvider(
  initialBaseUrl: string,
  prompts: RevisionSetupPrompts
): Promise<RevisionEndpointProvider> {
  const response = await prompts.select({
    message: "Which revision provider should Uraniborg use?",
    options: [
      {
        value: "chatgpt",
        label: "ChatGPT",
        hint: CHATGPT_REVISION_ENDPOINT
      },
      {
        value: "gemini",
        label: "Gemini",
        hint: GEMINI_REVISION_ENDPOINT
      },
      {
        value: "anthropic",
        label: "Anthropic",
        hint: ANTHROPIC_REVISION_ENDPOINT
      },
      {
        value: "manual",
        label: "Manual OpenAI-compatible endpoint",
        hint: "Enter a custom OpenAI-compatible revision endpoint URL."
      }
    ],
    initialValue: inferRevisionProvider(initialBaseUrl)
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  if (!isRevisionEndpointProvider(response)) {
    throw new Error("Selected revision provider is not supported.");
  }

  return response;
}

async function resolveRevisionEndpointUrl(
  provider: RevisionEndpointProvider,
  initialBaseUrl: string,
  prompts: RevisionSetupPrompts
): Promise<string> {
  switch (provider) {
    case "chatgpt":
      return CHATGPT_REVISION_ENDPOINT;
    case "gemini":
      return GEMINI_REVISION_ENDPOINT;
    case "anthropic":
      return ANTHROPIC_REVISION_ENDPOINT;
    case "manual":
      return promptText(
        {
          message: "OpenAI-compatible revision endpoint URL",
          initialValue: initialBaseUrl,
          validate(value) {
            try {
              new URL(value);
              return undefined;
            } catch {
              return "Enter a valid absolute URL.";
            }
          }
        },
        prompts
      );
  }
}

function inferRevisionProvider(
  baseUrl: string
): RevisionEndpointProvider {
  if (baseUrl === CHATGPT_REVISION_ENDPOINT) {
    return "chatgpt";
  }

  if (baseUrl === GEMINI_REVISION_ENDPOINT) {
    return "gemini";
  }

  if (baseUrl === ANTHROPIC_REVISION_ENDPOINT) {
    return "anthropic";
  }

  return "manual";
}

function isRevisionEndpointProvider(
  value: unknown
): value is RevisionEndpointProvider {
  return (
    value === "chatgpt" ||
    value === "gemini" ||
    value === "anthropic" ||
    value === "manual"
  );
}
