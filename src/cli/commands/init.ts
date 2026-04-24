import {
  cancel,
  intro,
  isCancel,
  outro,
  text
} from "@clack/prompts";
import type { Command } from "commander";

import {
  ensureUraniborgAppHome,
  loadParsedUraniborgConfig,
  resolveUraniborgPaths,
  saveUraniborgConfig
} from "../../config/index.js";
import type { UraniborgConfig } from "../../types/app-config.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Configure Uraniborg-owned refinement defaults.")
    .action(async () => {
      await runInitCommand();
    });
}

export async function runInitCommand(): Promise<void> {
  const paths = resolveUraniborgPaths();
  await ensureUraniborgAppHome(paths);

  const existingConfig = await loadExistingConfig(paths.configFile);
  const initialConfig = existingConfig ?? createDefaultConfig();

  intro("Configure draft revision settings for peer-review-based revisions");

  const baseUrl = await promptText({
    message:
      "Base URL for the OpenAI-compatible API Uraniborg will use to revise drafts from peer reviews (example: https://api.openai.com/v1)",
    initialValue: initialConfig.refine.endpoint.baseUrl,
    validate(value) {
      try {
        new URL(value);
        return undefined;
      } catch {
        return "Enter a valid absolute URL.";
      }
    }
  });
  const apiKeyEnvVar = await promptText({
    message: "Environment variable that stores the refine API key",
    initialValue: initialConfig.refine.endpoint.apiKeyEnvVar,
    validate(value) {
      return value.trim().length > 0
        ? undefined
        : "Enter the environment variable name for the API key.";
    }
  });
  const timeoutMs = await promptText({
    message: "Request timeout in milliseconds",
    initialValue: String(initialConfig.refine.endpoint.timeoutMs),
    validate(value) {
      const parsedValue = Number.parseInt(value, 10);
      return Number.isInteger(parsedValue) && parsedValue > 0
        ? undefined
        : "Enter a positive integer timeout in milliseconds.";
    }
  });
  const model = await promptText({
    message: "Default model for draft revision",
    initialValue: initialConfig.refine.defaults.model,
    validate(value) {
      return value.trim().length > 0
        ? undefined
        : "Enter the default refinement model name.";
    }
  });
  const temperature = await promptText({
    message: "Default refinement temperature",
    initialValue: String(initialConfig.refine.defaults.temperature),
    validate(value) {
      const parsedValue = Number.parseFloat(value);
      return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 2
        ? undefined
        : "Enter a number between 0 and 2.";
    }
  });
  const maxOutputTokens = await promptText({
    message: "Default max output tokens (leave empty to disable)",
    initialValue:
      typeof initialConfig.refine.defaults.maxOutputTokens === "number"
        ? String(initialConfig.refine.defaults.maxOutputTokens)
        : "",
    validate(value) {
      if (value.trim().length === 0) {
        return undefined;
      }

      const parsedValue = Number.parseInt(value, 10);
      return Number.isInteger(parsedValue) && parsedValue > 0
        ? undefined
        : "Enter a positive integer or leave the field empty.";
    }
  });

  const nextConfig: UraniborgConfig = {
    version: 1,
    refine: {
      endpoint: {
        baseUrl,
        apiKeyEnvVar,
        timeoutMs: Number.parseInt(timeoutMs, 10)
      },
      defaults: {
        model,
        temperature: Number.parseFloat(temperature),
        ...(maxOutputTokens.trim().length > 0
          ? { maxOutputTokens: Number.parseInt(maxOutputTokens, 10) }
          : {})
      }
    }
  };

  await saveUraniborgConfig(paths.configFile, nextConfig);
  outro(`Saved Uraniborg config to ${paths.configFile}`);
}

async function loadExistingConfig(
  configFilePath: string
): Promise<UraniborgConfig | null> {
  const result = await loadParsedUraniborgConfig(configFilePath);

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
        apiKeyEnvVar: "OPENAI_API_KEY",
        timeoutMs: 60000
      },
      defaults: {
        model: "gpt-5",
        temperature: 0.2
      }
    }
  };
}

async function promptText(options: {
  message: string;
  initialValue: string;
  validate: (value: string) => string | undefined;
}): Promise<string> {
  const response = await text({
    message: options.message,
    defaultValue: options.initialValue,
    validate: options.validate
  });

  if (isCancel(response)) {
    cancel("Uraniborg init cancelled.");
    throw new Error("Uraniborg init cancelled.");
  }

  return response;
}
