import { readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  createRevisionAuthClient,
  type RevisionAuthClient
} from "./revision-auth.js";
import {
  getRevisionProfile,
  supportsRevisionAuthStrategy,
  type UraniborgRevisionAuthAcquisition,
  type UraniborgRevisionAuthClass,
  type UraniborgRevisionProfileId
} from "./revision-profiles.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgConfigLoadError,
  UraniborgConfigReadWriter,
  UraniborgRevisionConfig,
  UraniborgRevisionCredentialBinding,
  UraniborgRevisionDefaults
} from "../types/app-config.js";
import { err, ok, type Result } from "../types/result.js";

interface UraniborgLegacyConfig {
  version: 1;
  refine: {
    endpoint: {
      baseUrl: string;
      timeoutMs: number;
      apiKey?: string | undefined;
      apiKeyEnvVar?: string | undefined;
    };
    defaults: UraniborgRevisionDefaults;
  };
}

type PreviewV2CredentialSource =
  | {
      type: "stored-secret";
      apiKey: string;
    }
  | {
      type: "env-var";
      envVar: string;
    }
  | {
      type: "managed";
      reference: string;
    }
  | {
      type: "adc";
    };

interface PreviewV2RevisionConfig {
  providerFamily: "openai-codex" | "claude" | "gemini" | "openai-compatible";
  profileId:
    | "openai-codex"
    | "claude"
    | "gemini"
    | "manual-openai-compatible";
  authClass: "api-key" | "oauth" | "adc";
  credentialSource: PreviewV2CredentialSource;
  endpoint: {
    timeoutMs: number;
    overrideBaseUrl?: string | undefined;
  };
  defaults: UraniborgRevisionDefaults;
}

interface StoredUraniborgConfigV2Preview {
  version: 2;
  revision: PreviewV2RevisionConfig;
}

interface StoredUraniborgConfigV3 {
  version: 3;
  revision: UraniborgRevisionConfig;
}

const refineDefaultsSchema = z.object({
  model: z.string().trim().min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().positive().optional()
});

const legacyRefineEndpointSchema = z
  .object({
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().positive().default(60000),
    apiKey: z.string().trim().min(1).optional(),
    apiKeyEnvVar: z.string().trim().min(1).optional()
  })
  .superRefine((value, context) => {
    if (
      typeof value.apiKey !== "string" &&
      typeof value.apiKeyEnvVar !== "string"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message:
          "Provide either a stored API key or an environment variable name for the API key."
      });
    }
  });

const legacyConfigSchema = z.object({
  version: z.literal(1),
  refine: z.object({
    endpoint: legacyRefineEndpointSchema,
    defaults: refineDefaultsSchema
  })
});

const previewRevisionCredentialSourceSchema = z.union([
  z.object({
    type: z.literal("stored-secret"),
    apiKey: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("env-var"),
    envVar: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("managed"),
    reference: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("adc")
  })
]);

const previewRevisionConfigSchema = z.object({
  providerFamily: z.enum([
    "openai-codex",
    "claude",
    "gemini",
    "openai-compatible"
  ]),
  profileId: z.enum([
    "openai-codex",
    "claude",
    "gemini",
    "manual-openai-compatible"
  ]),
  authClass: z.enum(["api-key", "oauth", "adc"]),
  credentialSource: previewRevisionCredentialSourceSchema,
  endpoint: z.object({
    timeoutMs: z.number().int().positive().default(60000),
    overrideBaseUrl: z.string().url().optional()
  }),
  defaults: refineDefaultsSchema
});

const storedConfigV2Schema = z.object({
  version: z.literal(2),
  revision: previewRevisionConfigSchema
});

const revisionCredentialBindingSchema = z.union([
  z.object({
    type: z.literal("stored-secret"),
    apiKey: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("env-var"),
    envVar: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("pi-auth-storage"),
    providerId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("adc")
  })
]);

const revisionConfigSchema = z
  .object({
    profile: z.object({
      id: z.enum([
        "openai-codex-chatgpt",
        "claude-browser",
        "gemini-cloud-code-assist",
        "manual-openai-compatible",
        "claude-api",
        "gemini-direct",
      ]),
      family: z.enum([
        "openai-codex",
        "claude",
        "gemini",
        "openai-compatible"
      ]),
      label: z.string().trim().min(1)
    }),
    auth: z.object({
      class: z.enum(["api-key", "oauth", "adc"]),
      acquisition: z.enum([
        "prompt-secret",
        "env-var",
        "browser-login",
        "ambient"
      ])
    }),
    credentialBinding: revisionCredentialBindingSchema,
    providerContext: z
      .object({
        accountId: z.string().trim().min(1).optional(),
        projectId: z.string().trim().min(1).optional()
      })
      .optional(),
    endpoint: z.object({
      baseUrl: z.string().url(),
      overrideAllowed: z.boolean(),
      timeoutMs: z.number().int().positive().default(60000)
    }),
    defaults: refineDefaultsSchema
  })
  .superRefine((value, context) => {
    const profile = getRevisionProfile(value.profile.id);

    if (value.profile.family !== profile.family) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profile", "family"],
        message: `Provider family must match the "${profile.label}" revision profile.`
      });
    }

    if (value.profile.label !== profile.label) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profile", "label"],
        message: `Profile label must match "${profile.label}".`
      });
    }

    if (!supportsRevisionAuthStrategy(profile, value.auth.class, value.auth.acquisition)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auth", "class"],
        message: `The "${profile.label}" revision profile does not support ${value.auth.class}/${value.auth.acquisition}.`
      });
    }

    if (value.endpoint.overrideAllowed !== profile.allowsEndpointOverride) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endpoint", "overrideAllowed"],
        message: `Endpoint override policy must match the "${profile.label}" revision profile.`
      });
    }

    if (
      !profile.allowsEndpointOverride &&
      normalizeUrlForComparison(value.endpoint.baseUrl) !==
        normalizeUrlForComparison(profile.canonicalBaseUrl)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endpoint", "baseUrl"],
        message: `Base URL must match the canonical "${profile.label}" endpoint.`
      });
    }

    validateCredentialBinding(value, profile.id, context);

    for (const requiredField of profile.requiredProviderContext) {
      const providerContext = value.providerContext;
      const fieldValue = providerContext?.[requiredField];

      if (typeof fieldValue !== "string" || fieldValue.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["providerContext", requiredField],
          message: `The "${profile.label}" revision profile requires provider context "${requiredField}".`
        });
      }
    }
  });

const storedConfigV3Schema = z.object({
  version: z.literal(3),
  revision: revisionConfigSchema
});

export function parseUraniborgConfig(
  input: unknown
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  return parseUraniborgConfigInternal(input, false);
}

export async function loadSetupSeedUraniborgConfig(
  configFilePath: string,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  const fileContentsResult = await readConfigFile(configFilePath, readWriter);

  if (!fileContentsResult.ok) {
    return fileContentsResult;
  }

  const parsedJsonResult = parseConfigJson(fileContentsResult.value);

  if (!parsedJsonResult.ok) {
    return parsedJsonResult;
  }

  return parseUraniborgConfigInternal(parsedJsonResult.value, true);
}

export function resolveUraniborgConfigSecrets(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv
): Result<ResolvedUraniborgConfig, UraniborgConfigLoadError> {
  if (config.revision.auth.class !== "api-key") {
    return err({
      code: "unsupported_auth_class",
      message: `Revision auth class "${config.revision.auth.class}" is not runnable through Uraniborg runtime execution yet.`,
      details: [
        "Revision setup is valid, but Uraniborg's revision execution path still only runs API-key-backed compatible endpoints."
      ]
    });
  }

  const credentialBinding = config.revision.credentialBinding;

  if (credentialBinding.type === "stored-secret") {
    return ok({
      ...config,
      revision: {
        ...config.revision,
        runtime: {
          kind: "manual-compatible",
          apiKey: credentialBinding.apiKey
        }
      },
      refine: {
        ...config.refine,
        endpoint: {
          ...config.refine.endpoint,
          apiKey: credentialBinding.apiKey
        }
      }
    });
  }

  if (credentialBinding.type === "env-var") {
    const apiKey = environment[credentialBinding.envVar];

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return err({
        code: "secret_missing",
        message: `Environment variable "${credentialBinding.envVar}" is not set.`,
        details: [
          "Set the configured revision API key environment variable before running revision."
        ]
      });
    }

    return ok({
      ...config,
      revision: {
        ...config.revision,
        runtime: {
          kind: "manual-compatible",
          apiKey
        }
      },
      refine: {
        ...config.refine,
        endpoint: {
          ...config.refine.endpoint,
          apiKey
        }
      }
    });
  }

  return err({
    code: "unsupported_auth_class",
    message: `Revision auth class "${config.revision.auth.class}" is not runnable through Uraniborg runtime execution yet.`,
    details: [
      "Run `uraniborg revision --config` or `uraniborg doctor` to inspect revision setup readiness instead."
    ]
  });
}

export function resolveRevisionSetupReadiness(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv,
  authClient: RevisionAuthClient
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  return resolveRevisionSetupReadinessInternal(config, environment, authClient);
}

export async function loadUraniborgConfig(
  configFilePath: string,
  environment: NodeJS.ProcessEnv = process.env,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter(),
  authClient: RevisionAuthClient = createRevisionAuthClient()
): Promise<Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>> {
  const parsedConfigResult = await loadParsedUraniborgConfig(
    configFilePath,
    readWriter
  );

  if (!parsedConfigResult.ok) {
    return parsedConfigResult;
  }

  return resolveExecutableUraniborgConfig(
    parsedConfigResult.value,
    environment,
    authClient
  );
}

export async function loadParsedUraniborgConfig(
  configFilePath: string,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  const fileContentsResult = await readConfigFile(configFilePath, readWriter);

  if (!fileContentsResult.ok) {
    return fileContentsResult;
  }

  const parsedJsonResult = parseConfigJson(fileContentsResult.value);

  if (!parsedJsonResult.ok) {
    return parsedJsonResult;
  }

  return parseUraniborgConfig(parsedJsonResult.value);
}

export async function loadRevisionSetupReadiness(
  configFilePath: string,
  environment: NodeJS.ProcessEnv = process.env,
  authClient: RevisionAuthClient = createRevisionAuthClient(),
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  const parsedConfigResult = await loadParsedUraniborgConfig(
    configFilePath,
    readWriter
  );

  if (!parsedConfigResult.ok) {
    return parsedConfigResult;
  }

  return resolveRevisionSetupReadinessInternal(
    parsedConfigResult.value,
    environment,
    authClient
  );
}

export async function saveUraniborgConfig(
  configFilePath: string,
  config: UraniborgConfig,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<void> {
  const serializedConfig = JSON.stringify(
    {
      version: 3,
      revision: config.revision
    } satisfies StoredUraniborgConfigV3,
    null,
    2
  );

  await readWriter.writeFile(configFilePath, `${serializedConfig}\n`);
}

export function createNodeConfigReadWriter(): UraniborgConfigReadWriter {
  return {
    async readFile(configFilePath: string): Promise<string> {
      return readFile(configFilePath, "utf8");
    },
    async writeFile(configFilePath: string, contents: string): Promise<void> {
      const temporaryPath = `${configFilePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, contents, "utf8");
      await rename(temporaryPath, configFilePath);
    }
  };
}

function parseUraniborgConfigInternal(
  input: unknown,
  allowStaleSetupSeed: boolean
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (!isRecord(input)) {
    return err(
      createInvalidSchemaError(["Uraniborg config schema validation failed."])
    );
  }

  const version = input["version"];

  if (version === 1) {
    const parsedLegacy = legacyConfigSchema.safeParse(input);

    if (!parsedLegacy.success) {
      return err(
        createInvalidSchemaError(formatZodIssues(parsedLegacy.error.issues))
      );
    }

    return normalizeLegacyConfig(parsedLegacy.data, allowStaleSetupSeed);
  }

  if (version === 2) {
    const parsedV2 = storedConfigV2Schema.safeParse(input);

    if (!parsedV2.success) {
      return err(createInvalidSchemaError(formatZodIssues(parsedV2.error.issues)));
    }

    return normalizePreviewRevisionConfig(
      parsedV2.data.revision,
      allowStaleSetupSeed
    );
  }

  if (version === 3) {
    const parsedV3 = storedConfigV3Schema.safeParse(input);

    if (!parsedV3.success) {
      return err(createInvalidSchemaError(formatZodIssues(parsedV3.error.issues)));
    }

    return normalizeStoredRevision(parsedV3.data.revision, allowStaleSetupSeed);
  }

  return err(
    createInvalidSchemaError([
      'version: Expected config version "1" (legacy), "2" (preview), or "3" (current).'
    ])
  );
}

async function resolveRevisionSetupReadinessInternal(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv,
  authClient: RevisionAuthClient
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  const profile = getRevisionProfile(config.revision.profile.id);
  const binding = config.revision.credentialBinding;

  if (binding.type === "stored-secret") {
    return ok(config);
  }

  if (binding.type === "env-var") {
    const apiKey = environment[binding.envVar];

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return err({
        code: "secret_missing",
        message: `Environment variable "${binding.envVar}" is not set.`,
        details: [
          "Set the configured revision API key environment variable before relying on this revision setup."
        ]
      });
    }

    return ok(config);
  }

  if (binding.type === "pi-auth-storage") {
    const credentialState = await authClient.resolveManagedCredential(
      binding.providerId
    );

    if (!credentialState.ok) {
      return credentialState;
    }

    for (const requiredField of profile.requiredProviderContext) {
      const configuredValue = config.revision.providerContext?.[requiredField];

      if (typeof configuredValue !== "string" || configuredValue.length === 0) {
        return err({
          code: "provider_context_missing",
          message: `Revision provider context "${requiredField}" is missing for "${profile.label}".`,
          details: [
            "Run `uraniborg revision --setup` again to refresh the Pi-backed revision login state."
          ]
        });
      }

      const observedValue = credentialState.value[requiredField];

      if (
        typeof observedValue === "string" &&
        observedValue.length > 0 &&
        observedValue !== configuredValue
      ) {
        return err({
          code: "provider_context_missing",
          message: `Revision provider context "${requiredField}" no longer matches the current Pi-managed credential state.`,
          details: [
            "Run `uraniborg revision --setup` again so Uraniborg can refresh the stored revision provider context."
          ]
        });
      }
    }

    return ok(config);
  }

  return err({
    code: "unsupported_auth_class",
    message: `Revision auth class "${config.revision.auth.class}" is not supported by Uraniborg readiness checks yet.`,
    details: [
      `The "${profile.label}" revision profile is configured with an auth path that this change does not bootstrap automatically.`
    ]
  });
}

async function resolveExecutableUraniborgConfig(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv,
  authClient: RevisionAuthClient
): Promise<Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>> {
  const readinessResult = await resolveRevisionSetupReadinessInternal(
    config,
    environment,
    authClient
  );

  if (!readinessResult.ok) {
    return readinessResult;
  }

  const credentialBinding = config.revision.credentialBinding;

  if (credentialBinding.type === "stored-secret") {
    return ok({
      ...config,
      revision: {
        ...config.revision,
        runtime: {
          kind: "manual-compatible",
          apiKey: credentialBinding.apiKey
        }
      },
      refine: {
        ...config.refine,
        endpoint: {
          ...config.refine.endpoint,
          apiKey: credentialBinding.apiKey
        }
      }
    });
  }

  if (credentialBinding.type === "env-var") {
    const apiKey = environment[credentialBinding.envVar];

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return err({
        code: "secret_missing",
        message: `Environment variable "${credentialBinding.envVar}" is not set.`,
        details: [
          "Set the configured revision API key environment variable before running revision."
        ]
      });
    }

    return ok({
      ...config,
      revision: {
        ...config.revision,
        runtime: {
          kind: "manual-compatible",
          apiKey
        }
      },
      refine: {
        ...config.refine,
        endpoint: {
          ...config.refine.endpoint,
          apiKey
        }
      }
    });
  }

  if (credentialBinding.type === "pi-auth-storage") {
    return ok({
      ...config,
      revision: {
        ...config.revision,
        runtime: {
          kind: "pi-managed",
          providerId: credentialBinding.providerId
        }
      }
    });
  }

  return err({
    code: "unsupported_auth_class",
    message: `Revision auth class "${config.revision.auth.class}" is not runnable through Uraniborg runtime execution yet.`,
    details: [
      `The "${config.revision.profile.label}" revision profile is configured with an unsupported runtime auth path.`
    ]
  });
}

function normalizeLegacyConfig(
  config: UraniborgLegacyConfig,
  allowStaleSetupSeed: boolean
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (isLegacyClaudeBaseUrl(config.refine.endpoint.baseUrl)) {
    return normalizeStaleBrowserAuthProfile({
      profileId: "claude-browser",
      label: "Claude",
      defaults: config.refine.defaults,
      timeoutMs: config.refine.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  if (isLegacyGeminiBaseUrl(config.refine.endpoint.baseUrl)) {
    return normalizeStaleBrowserAuthProfile({
      profileId: "gemini-cloud-code-assist",
      label: "Gemini",
      defaults: config.refine.defaults,
      timeoutMs: config.refine.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  const profileId: UraniborgRevisionProfileId = "manual-openai-compatible";
  const profile = getRevisionProfile(profileId);

  const credentialBinding: UraniborgRevisionCredentialBinding =
    typeof config.refine.endpoint.apiKey === "string"
      ? {
          type: "stored-secret",
          apiKey: config.refine.endpoint.apiKey
        }
      : {
          type: "env-var",
          envVar: config.refine.endpoint.apiKeyEnvVar ?? "OPENAI_API_KEY"
        };

  const acquisition =
    credentialBinding.type === "stored-secret" ? "prompt-secret" : "env-var";

  const baseUrl =
    profile.allowsEndpointOverride
      ? config.refine.endpoint.baseUrl
      : profile.canonicalBaseUrl;

  return ok(
    createVersion3Config({
      profileId,
      authClass: "api-key",
      acquisition,
      credentialBinding,
      endpointBaseUrl: baseUrl,
      timeoutMs: config.refine.endpoint.timeoutMs,
      defaults: config.refine.defaults
    })
  );
}

function normalizePreviewRevisionConfig(
  revision: PreviewV2RevisionConfig,
  allowStaleSetupSeed: boolean
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (revision.profileId === "openai-codex") {
    return normalizeStaleBrowserAuthProfile({
      profileId: "openai-codex-chatgpt",
      label: "OpenAI/Codex",
      defaults: revision.defaults,
      timeoutMs: revision.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  if (revision.profileId === "claude") {
    return normalizeStaleBrowserAuthProfile({
      profileId: "claude-browser",
      label: "Claude",
      defaults: revision.defaults,
      timeoutMs: revision.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  if (revision.profileId === "gemini") {
    return normalizeStaleBrowserAuthProfile({
      profileId: "gemini-cloud-code-assist",
      label: "Gemini",
      defaults: revision.defaults,
      timeoutMs: revision.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  const profileId: UraniborgRevisionProfileId = "manual-openai-compatible";
  const profile = getRevisionProfile(profileId);
  const credentialBinding = mapPreviewCredentialBinding(
    revision.credentialSource,
    profileId
  );
  const acquisition = inferAcquisitionFromCredentialBinding(
    credentialBinding,
    revision.authClass
  );
  const endpointBaseUrl = profile.allowsEndpointOverride
    ? revision.endpoint.overrideBaseUrl ?? profile.canonicalBaseUrl
    : profile.canonicalBaseUrl;

  return ok(
    createVersion3Config({
      profileId,
      authClass: revision.authClass,
      acquisition,
      credentialBinding,
      endpointBaseUrl,
      timeoutMs: revision.endpoint.timeoutMs,
      defaults: revision.defaults
    })
  );
}

function normalizeStoredRevision(
  revision: UraniborgRevisionConfig,
  allowStaleSetupSeed: boolean
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (revision.profile.id === "claude-api") {
    return normalizeStaleBrowserAuthProfile({
      profileId: "claude-browser",
      label: "Claude",
      defaults: revision.defaults,
      timeoutMs: revision.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  if (revision.profile.id === "gemini-direct") {
    return normalizeStaleBrowserAuthProfile({
      profileId: "gemini-cloud-code-assist",
      label: "Gemini",
      defaults: revision.defaults,
      timeoutMs: revision.endpoint.timeoutMs,
      allowStaleSetupSeed
    });
  }

  return ok({
    version: 3,
    revision,
    refine: {
      endpoint: {
        baseUrl: revision.endpoint.baseUrl,
        timeoutMs: revision.endpoint.timeoutMs,
        ...deriveCompatibilitySecretFields(revision.credentialBinding)
      },
      defaults: revision.defaults
    }
  });
}

function createVersion3Config(options: {
  profileId: UraniborgRevisionProfileId;
  authClass: UraniborgRevisionAuthClass;
  acquisition: UraniborgRevisionAuthAcquisition;
  credentialBinding: UraniborgRevisionCredentialBinding;
  endpointBaseUrl: string;
  timeoutMs: number;
  defaults: UraniborgRevisionDefaults;
  providerContext?: UraniborgRevisionConfig["providerContext"];
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
        class: options.authClass,
        acquisition: options.acquisition
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

function mapPreviewCredentialBinding(
  credentialSource: PreviewV2CredentialSource,
  profileId: UraniborgRevisionProfileId
): UraniborgRevisionCredentialBinding {
  switch (credentialSource.type) {
    case "stored-secret":
      return {
        type: "stored-secret",
        apiKey: credentialSource.apiKey
      };
    case "env-var":
      return {
        type: "env-var",
        envVar: credentialSource.envVar
      };
    case "managed":
      return {
        type: "pi-auth-storage",
        providerId:
          credentialSource.reference.length > 0
            ? credentialSource.reference
            : getRevisionProfile(profileId).piProviderId ?? "openai-codex"
      };
    case "adc":
      return {
        type: "adc"
      };
  }
}

function inferAcquisitionFromCredentialBinding(
  credentialBinding: UraniborgRevisionCredentialBinding,
  authClass: UraniborgRevisionAuthClass
): UraniborgRevisionAuthAcquisition {
  if (authClass === "oauth") {
    return "browser-login";
  }

  if (authClass === "adc") {
    return "ambient";
  }

  return credentialBinding.type === "env-var" ? "env-var" : "prompt-secret";
}

function validateCredentialBinding(
  revision: Pick<UraniborgRevisionConfig, "auth" | "credentialBinding" | "profile">,
  profileId: UraniborgRevisionProfileId,
  context: z.RefinementCtx
): void {
  const profile = getRevisionProfile(profileId);
  const { auth, credentialBinding } = revision;

  if (auth.class === "api-key" && auth.acquisition === "prompt-secret") {
    if (credentialBinding.type !== "stored-secret") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "type"],
        message: "Prompt-secret API-key auth requires a stored secret credential binding."
      });
    }

    return;
  }

  if (auth.class === "api-key" && auth.acquisition === "env-var") {
    if (credentialBinding.type !== "env-var") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "type"],
        message: "Environment-variable API-key auth requires an env-var credential binding."
      });
    }

    return;
  }

  if (auth.class === "oauth" && auth.acquisition === "browser-login") {
    if (credentialBinding.type !== "pi-auth-storage") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "type"],
        message: "Browser-login OAuth requires a Pi auth-storage credential binding."
      });
      return;
    }

    if (
      typeof profile.piProviderId === "string" &&
      credentialBinding.providerId !== profile.piProviderId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "providerId"],
        message: `Pi credential binding must use provider "${profile.piProviderId}" for "${profile.label}".`
      });
    }

    return;
  }

  if (auth.class === "adc" && auth.acquisition === "ambient") {
    if (credentialBinding.type !== "adc") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "type"],
        message: "Ambient ADC auth requires an ADC credential binding."
      });
    }

    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["auth", "class"],
    message: `Unsupported auth/acquisition pairing for "${profile.label}".`
  });
}

async function readConfigFile(
  configFilePath: string,
  readWriter: UraniborgConfigReadWriter
): Promise<Result<string, UraniborgConfigLoadError>> {
  try {
    return ok(await readWriter.readFile(configFilePath));
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return err({
        code: "config_not_found",
        message: `Uraniborg config was not found at "${configFilePath}".`
      });
    }

    return err({
      code: "config_not_readable",
      message: `Uraniborg config could not be read from "${configFilePath}".`,
      details: [error instanceof Error ? error.message : "Unknown read failure."]
    });
  }
}

function parseConfigJson(
  fileContents: string
): Result<unknown, UraniborgConfigLoadError> {
  try {
    return ok(JSON.parse(fileContents) as unknown);
  } catch (error) {
    return err({
      code: "config_invalid_json",
      message: "Uraniborg config is not valid JSON.",
      details: [error instanceof Error ? error.message : "Unknown JSON failure."]
    });
  }
}

function createInvalidSchemaError(
  details: readonly string[]
): UraniborgConfigLoadError {
  return {
    code: "config_invalid_schema",
    message: "Uraniborg config schema validation failed.",
    details: [...details]
  };
}

function createStaleOpenAICodexPreviewError(): UraniborgConfigLoadError {
  return {
    code: "config_stale_revision_setup",
    message:
      "OpenAI/Codex revision setup is stale and must be rerun against the Pi-backed browser-login contract.",
    details: [
      "This preview config was created against the older OpenAI Platform API / API-key contract.",
      "Run `uraniborg revision --setup` or `uraniborg init` to migrate to the ChatGPT subscription-backed OpenAI/Codex setup."
    ]
  };
}

function normalizeStaleBrowserAuthProfile(options: {
  profileId:
    | "openai-codex-chatgpt"
    | "claude-browser"
    | "gemini-cloud-code-assist";
  label: "OpenAI/Codex" | "Claude" | "Gemini";
  defaults: UraniborgRevisionDefaults;
  timeoutMs: number;
  allowStaleSetupSeed: boolean;
}): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (!options.allowStaleSetupSeed) {
    return err(createStaleBrowserAuthProfileError(options.label));
  }

  const profile = getRevisionProfile(options.profileId);

  return ok(
    createVersion3Config({
      profileId: profile.id,
      authClass: "oauth",
      acquisition: "browser-login",
      credentialBinding: {
        type: "pi-auth-storage",
        providerId: profile.piProviderId ?? "openai-codex"
      },
      endpointBaseUrl: profile.canonicalBaseUrl,
      timeoutMs: options.timeoutMs,
      defaults: options.defaults
    })
  );
}

function createStaleBrowserAuthProfileError(
  label: "OpenAI/Codex" | "Claude" | "Gemini"
): UraniborgConfigLoadError {
  if (label === "OpenAI/Codex") {
    return createStaleOpenAICodexPreviewError();
  }

  return {
    code: "config_stale_revision_setup",
    message: `${label} revision setup is stale and must be rerun against the Pi-backed browser-login contract.`,
    details: [
      `This stored ${label} config was created against the older API-key-based revision setup contract.`,
      "Run `uraniborg revision --setup` or `uraniborg init` to migrate to the current Pi-managed browser-login setup."
    ]
  };
}

function isLegacyClaudeBaseUrl(baseUrl: string): boolean {
  const normalizedBaseUrl = normalizeUrlForComparison(baseUrl);

  return (
    normalizedBaseUrl === "https://api.anthropic.com" ||
    normalizedBaseUrl === "https://api.anthropic.com/v1"
  );
}

function isLegacyGeminiBaseUrl(baseUrl: string): boolean {
  const normalizedBaseUrl = normalizeUrlForComparison(baseUrl);

  return (
    normalizedBaseUrl ===
      "https://generativelanguage.googleapis.com/v1beta/openai" ||
    normalizedBaseUrl === "https://generativelanguage.googleapis.com/v1beta"
  );
}

function formatZodIssues(issues: readonly z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const joinedPath = issue.path.map(String).join(".");
    return joinedPath.length > 0
      ? `${joinedPath}: ${issue.message}`
      : issue.message;
  });
}

function normalizeUrlForComparison(url: string): string {
  return url.replace(/\/+$/u, "");
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
