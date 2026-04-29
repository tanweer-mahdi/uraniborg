import {
  cancel,
  intro,
  isCancel,
  outro,
  select,
  text
} from "@clack/prompts";

import {
  createNodeRevisionBrowserLauncher,
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  loadSetupSeedUraniborgConfig,
  resolveUraniborgPaths,
  saveUraniborgConfig,
  type RevisionAuthClient,
  type RevisionBrowserLauncher
} from "../../config/index.js";
import {
  getGuidedRevisionAuthStrategies,
  getRevisionProfile,
  getRevisionProfileOptions,
  type UraniborgRevisionAuthStrategy,
  type UraniborgRevisionProfileId
} from "../../config/revision-profiles.js";
import type {
  UraniborgConfig,
  UraniborgRevisionCredentialBinding
} from "../../types/app-config.js";
import { writeInfo } from "../../ui/output.js";

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
  loadConfig?: typeof loadSetupSeedUraniborgConfig;
  saveConfig?: typeof saveUraniborgConfig;
  prompts?: RevisionSetupPrompts;
  authClient?: RevisionAuthClient;
  browserLauncher?: RevisionBrowserLauncher;
  writeLine?: (message: string) => void;
}

interface RevisionCredentialSetupResult {
  credentialBinding: UraniborgRevisionCredentialBinding;
  providerContext?: UraniborgConfig["revision"]["providerContext"];
}

export async function runGuidedRevisionSetup(
  dependencies: RevisionSetupDependencies = {}
): Promise<void> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const loadConfig = dependencies.loadConfig ?? loadSetupSeedUraniborgConfig;
  const saveConfig = dependencies.saveConfig ?? saveUraniborgConfig;
  const authClient = dependencies.authClient ?? createRevisionAuthClient();
  const browserLauncher =
    dependencies.browserLauncher ?? createNodeRevisionBrowserLauncher();
  const writeLine = dependencies.writeLine ?? writeInfo;
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

  const profileId = await promptRevisionProfile(
    initialConfig.revision.profile.id,
    prompts
  );
  const authStrategy = await promptRevisionAuthStrategy(
    profileId,
    initialConfig,
    prompts
  );
  const endpointBaseUrl = await promptRevisionEndpointBaseUrl(
    profileId,
    initialConfig.revision.endpoint.baseUrl,
    prompts
  );
  const credentialResult = await setupRevisionCredentialBinding(
    profileId,
    authStrategy,
    initialConfig,
    prompts,
    authClient,
    browserLauncher,
    writeLine
  );
  const defaultModel = await promptText(
    {
      message: "Default revision model",
      initialValue:
        initialConfig.revision.profile.id === profileId
          ? initialConfig.revision.defaults.model
          : getRevisionProfile(profileId).defaultModel,
      validate(value) {
        return value.trim().length > 0
          ? undefined
          : "Enter the default revision model name.";
      }
    },
    prompts
  );

  const profile = getRevisionProfile(profileId);
  const nextConfig: UraniborgConfig = createConfig({
    profileId,
    authStrategy,
    credentialBinding: credentialResult.credentialBinding,
    endpointBaseUrl,
    timeoutMs: initialConfig.revision.endpoint.timeoutMs,
    providerContext: credentialResult.providerContext,
    defaults: {
      model: defaultModel,
      temperature: initialConfig.revision.defaults.temperature,
      ...(typeof initialConfig.revision.defaults.maxOutputTokens === "number"
        ? {
            maxOutputTokens: initialConfig.revision.defaults.maxOutputTokens
          }
        : {})
    }
  });

  await saveConfig(paths.configFile, nextConfig);
  prompts.outro(
    `Saved Uraniborg revision config for ${profile.label} to ${paths.configFile}`
  );
}

async function loadExistingConfig(
  configFilePath: string,
  loadConfig: typeof loadSetupSeedUraniborgConfig
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
  const profile = getRevisionProfile("openai-codex-chatgpt");

  return createConfig({
    profileId: profile.id,
    authStrategy: {
      authClass: "oauth",
      acquisition: "browser-login",
      guided: true
    },
    credentialBinding: {
      type: "pi-auth-storage",
      providerId: profile.piProviderId ?? "openai-codex"
    },
    endpointBaseUrl: profile.canonicalBaseUrl,
    timeoutMs: 60000,
    defaults: {
      model: profile.defaultModel,
      temperature: 0.2
    }
  });
}

function createConfig(options: {
  profileId: UraniborgRevisionProfileId;
  authStrategy: UraniborgRevisionAuthStrategy;
  credentialBinding: UraniborgRevisionCredentialBinding;
  endpointBaseUrl: string;
  timeoutMs: number;
  defaults: UraniborgConfig["revision"]["defaults"];
  providerContext?: UraniborgConfig["revision"]["providerContext"];
}): UraniborgConfig {
  const profile = getRevisionProfile(options.profileId);

  return {
    version: 3,
    revision: {
      profile: {
        id: profile.id,
        family: profile.family,
        label: profile.label
      },
      auth: {
        class: options.authStrategy.authClass,
        acquisition: options.authStrategy.acquisition
      },
      credentialBinding: options.credentialBinding,
      ...(options.providerContext === undefined
        ? {}
        : {
            providerContext: options.providerContext
          }),
      endpoint: {
        baseUrl: options.endpointBaseUrl,
        overrideAllowed: profile.allowsEndpointOverride,
        timeoutMs: options.timeoutMs
      },
      defaults: options.defaults
    },
    refine: {
      endpoint: {
        baseUrl: options.endpointBaseUrl,
        timeoutMs: options.timeoutMs,
        ...deriveCompatibilitySecretFields(options.credentialBinding)
      },
      defaults: options.defaults
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

async function promptRevisionProfile(
  initialProfileId: UraniborgRevisionProfileId,
  prompts: RevisionSetupPrompts
): Promise<UraniborgRevisionProfileId> {
  const response = await prompts.select({
    message: "Which revision provider profile should Uraniborg use?",
    options: getRevisionProfileOptions().map((profile) => ({
      value: profile.id,
      label: profile.label,
      hint:
        profile.canonicalBaseUrl.length > 0
          ? profile.canonicalBaseUrl
          : "Enter a custom OpenAI-compatible endpoint."
    })),
    initialValue: initialProfileId
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  return response;
}

async function promptRevisionAuthStrategy(
  profileId: UraniborgRevisionProfileId,
  initialConfig: UraniborgConfig,
  prompts: RevisionSetupPrompts
): Promise<UraniborgRevisionAuthStrategy> {
  const strategies = getGuidedRevisionAuthStrategies(profileId);
  const initialStrategy =
    initialConfig.revision.profile.id === profileId
      ? strategies.find(
          (strategy) =>
            strategy.authClass === initialConfig.revision.auth.class &&
            strategy.acquisition === initialConfig.revision.auth.acquisition
        )
      : undefined;

  if (strategies.length === 0) {
    throw new Error(
      `No guided revision auth strategies are configured for "${getRevisionProfile(profileId).label}".`
    );
  }

  if (strategies.length === 1) {
    const onlyStrategy = strategies[0];

    if (onlyStrategy === undefined) {
      throw new Error("Expected a guided revision auth strategy.");
    }

    return onlyStrategy;
  }

  const response = await prompts.select({
    message: "How should Uraniborg read the revision API key?",
    options: strategies.map((strategy) => ({
      value: strategy.acquisition,
      label:
        strategy.acquisition === "env-var"
          ? "Use environment variable"
          : "Store API key"
    })),
    initialValue: (initialStrategy ?? strategies[0])?.acquisition
  });

  if (prompts.isCancel(response)) {
    prompts.cancel("Uraniborg revision setup cancelled.");
    throw new Error("Uraniborg revision setup cancelled.");
  }

  const selectedStrategy = strategies.find(
    (strategy) => strategy.acquisition === response
  );

  if (selectedStrategy === undefined) {
    throw new Error("Expected a selected guided revision auth strategy.");
  }

  return selectedStrategy;
}

async function promptRevisionEndpointBaseUrl(
  profileId: UraniborgRevisionProfileId,
  initialBaseUrl: string,
  prompts: RevisionSetupPrompts
): Promise<string> {
  const profile = getRevisionProfile(profileId);

  if (!profile.allowsEndpointOverride) {
    return profile.canonicalBaseUrl;
  }

  return promptText(
    {
      message: "OpenAI-compatible revision endpoint URL",
      initialValue:
        initialBaseUrl.length > 0 ? initialBaseUrl : "https://api.example.com/v1",
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

async function setupRevisionCredentialBinding(
  profileId: UraniborgRevisionProfileId,
  authStrategy: UraniborgRevisionAuthStrategy,
  initialConfig: UraniborgConfig,
  prompts: RevisionSetupPrompts,
  authClient: RevisionAuthClient,
  browserLauncher: RevisionBrowserLauncher,
  writeLine: (message: string) => void
): Promise<RevisionCredentialSetupResult> {
  if (
    authStrategy.authClass === "api-key" &&
    authStrategy.acquisition === "prompt-secret"
  ) {
    return {
      credentialBinding: {
        type: "stored-secret",
        apiKey: await promptText(
          {
            message: "Revision API key",
            initialValue:
              initialConfig.revision.credentialBinding.type === "stored-secret"
                ? initialConfig.revision.credentialBinding.apiKey
                : "",
            validate(value) {
              return value.trim().length > 0
                ? undefined
                : "Enter the revision API key.";
            }
          },
          prompts
        )
      }
    };
  }

  if (
    authStrategy.authClass === "api-key" &&
    authStrategy.acquisition === "env-var"
  ) {
    return {
      credentialBinding: {
        type: "env-var",
        envVar: await promptText(
          {
            message: "Revision API key environment variable",
            initialValue:
              initialConfig.revision.credentialBinding.type === "env-var"
                ? initialConfig.revision.credentialBinding.envVar
                : DEFAULT_REVISION_API_KEY_ENV_VAR,
            validate(value) {
              return value.trim().length > 0
                ? undefined
                : "Enter the environment variable name for the revision API key.";
            }
          },
          prompts
        )
      }
    };
  }

  if (
    authStrategy.authClass === "oauth" &&
    authStrategy.acquisition === "browser-login"
  ) {
    const profile = getRevisionProfile(profileId);
    const providerId = profile.piProviderId;

    if (typeof providerId !== "string" || providerId.length === 0) {
      throw new Error(
        `Expected a Pi provider id for "${profile.label}" browser login setup.`
      );
    }

    const loginResult = await authClient.loginManagedCredential(providerId, {
      onAuth: (info) => {
        writeLine(
          info.instructions ??
            `Complete the ${profile.label} login flow in your browser.`
        );

        void browserLauncher.open(info.url).catch(() => {
          writeLine(`Open this URL to continue login: ${info.url}`);
        });
        writeLine(`${profile.label} login URL: ${info.url}`);
      },
      onPrompt: async (prompt) =>
        promptText(
          {
            message: prompt.message,
            initialValue: "",
            validate(value) {
              return value.trim().length > 0
                ? undefined
                : "Paste the authorization code or redirect URL.";
            }
          },
          prompts
        ),
      onProgress: (message) => {
        writeLine(message);
      }
    });

    const providerContext =
      profileId === "openai-codex-chatgpt"
        ? loginResult.accountId === undefined
          ? undefined
          : {
              accountId: loginResult.accountId
            }
        : profileId === "gemini-cloud-code-assist"
          ? loginResult.projectId === undefined
            ? undefined
            : {
                projectId: loginResult.projectId
              }
          : undefined;

    for (const requiredField of profile.requiredProviderContext) {
      const fieldValue = providerContext?.[requiredField];

      if (typeof fieldValue !== "string" || fieldValue.length === 0) {
        throw new Error(
          `Pi login for "${providerId}" did not produce the required provider context "${requiredField}".`
        );
      }
    }

    return {
      credentialBinding: {
        type: "pi-auth-storage",
        providerId: loginResult.providerId
      },
      ...(providerContext === undefined ? {} : { providerContext })
    };
  }

  throw new Error(
    `Guided revision setup does not support ${authStrategy.authClass}/${authStrategy.acquisition} for "${getRevisionProfile(profileId).label}".`
  );
}

function deriveCompatibilitySecretFields(
  credentialBinding: UraniborgRevisionCredentialBinding
): Partial<{
  apiKey: string;
  apiKeyEnvVar: string;
}> {
  switch (credentialBinding.type) {
    case "stored-secret":
      return {
        apiKey: credentialBinding.apiKey
      };
    case "env-var":
      return {
        apiKeyEnvVar: credentialBinding.envVar
      };
    default:
      return {};
  }
}

const DEFAULT_REVISION_API_KEY_ENV_VAR = "OPENAI_API_KEY";
