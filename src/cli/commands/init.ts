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

export interface InitCommandDependencies {
  resolvePaths?: typeof resolveUraniborgPaths;
  ensureAppHome?: typeof ensureUraniborgAppHome;
  loadConfig?: typeof loadParsedUraniborgConfig;
  saveConfig?: typeof saveUraniborgConfig;
  prompts?: {
    intro: typeof intro;
    outro: typeof outro;
    cancel: typeof cancel;
    text: typeof text;
    isCancel: typeof isCancel;
  };
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Configure Uraniborg-owned refinement defaults.")
    .action(async () => {
      await runInitCommand();
    });
}

export async function runInitCommand(
  dependencies: InitCommandDependencies = {}
): Promise<void> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const loadConfig = dependencies.loadConfig ?? loadParsedUraniborgConfig;
  const saveConfig = dependencies.saveConfig ?? saveUraniborgConfig;
  const prompts = dependencies.prompts ?? {
    intro,
    outro,
    cancel,
    text,
    isCancel
  };
  const paths = resolvePaths();
  await ensureAppHome(paths);

  const existingConfig = await loadExistingConfig(paths.configFile, loadConfig);
  const initialConfig = existingConfig ?? createDefaultConfig();

  prompts.intro("Uraniborg refinement setup");

  const baseUrl = await promptText(
    {
      message: "OpenAI-compatible refine endpoint URL",
      initialValue: initialConfig.refine.endpoint.baseUrl,
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
  const apiKey = await promptText(
    {
      message: "Refine API key",
      initialValue: initialConfig.refine.endpoint.apiKey ?? "",
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the API key Uraniborg should use for refinement.";
      }
    },
    prompts
  );
  const model = await promptText(
    {
      message: "Default refinement model",
      initialValue: initialConfig.refine.defaults.model,
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the default refinement model name.";
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
  prompts.outro(`Saved Uraniborg config to ${paths.configFile}`);
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
  prompts: NonNullable<InitCommandDependencies["prompts"]>
): Promise<string> {
  const response = await prompts.text({
    message: options.message,
    defaultValue: options.initialValue,
    validate: options.validate
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg init cancelled.");
    throw new Error("Uraniborg init cancelled.");
  }

  return response;
}
