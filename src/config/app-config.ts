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
  type UraniborgRevisionProfileId
} from "./revision-profiles.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgConfigLoadError,
  UraniborgConfigReadWriter,
  UraniborgRevisionConfig,
  UraniborgRevisionDefaults
} from "../types/app-config.js";
import { err, ok, type Result } from "../types/result.js";

interface StoredUraniborgConfigV3 {
  version: 3;
  revision: UraniborgRevisionConfig;
}

const refineDefaultsSchema = z.object({
  model: z.string().trim().min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().positive().optional()
});

const revisionConfigSchema = z
  .object({
    profile: z.object({
      id: z.enum([
        "openai-codex-chatgpt",
        "claude-browser",
        "gemini-cloud-code-assist"
      ]),
      family: z.enum(["openai-codex", "claude", "gemini"]),
      label: z.string().trim().min(1)
    }),
    auth: z.object({
      class: z.literal("oauth"),
      acquisition: z.literal("browser-login")
    }),
    credentialBinding: z.object({
      type: z.literal("pi-auth-storage"),
      providerId: z.string().trim().min(1)
    }),
    providerContext: z
      .object({
        accountId: z.string().trim().min(1).optional(),
        projectId: z.string().trim().min(1).optional()
      })
      .optional(),
    endpoint: z.object({
      baseUrl: z.string().url(),
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

    if (
      !supportsRevisionAuthStrategy(
        profile,
        value.auth.class,
        value.auth.acquisition
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auth", "class"],
        message: `The "${profile.label}" revision profile does not support ${value.auth.class}/${value.auth.acquisition}.`
      });
    }

    if (
      normalizeUrlForComparison(value.endpoint.baseUrl) !==
      normalizeUrlForComparison(profile.canonicalBaseUrl)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endpoint", "baseUrl"],
        message: `Base URL must match the canonical "${profile.label}" endpoint.`
      });
    }

    if (value.credentialBinding.providerId !== profile.piProviderId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialBinding", "providerId"],
        message: `Pi credential binding must use provider "${profile.piProviderId}" for "${profile.label}".`
      });
    }

    for (const requiredField of profile.requiredProviderContext) {
      const fieldValue = value.providerContext?.[requiredField];

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
  return parseUraniborgConfigInternal(input);
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

  return parseUraniborgConfigInternal(parsedJsonResult.value);
}

export function resolveRevisionSetupReadiness(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv,
  authClient: RevisionAuthClient
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  void environment;
  return resolveRevisionSetupReadinessInternal(config, authClient);
}

export async function loadUraniborgConfig(
  configFilePath: string,
  environment: NodeJS.ProcessEnv = process.env,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter(),
  authClient: RevisionAuthClient = createRevisionAuthClient()
): Promise<Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>> {
  void environment;

  const parsedConfigResult = await loadParsedUraniborgConfig(
    configFilePath,
    readWriter
  );

  if (!parsedConfigResult.ok) {
    return parsedConfigResult;
  }

  return resolveExecutableUraniborgConfig(parsedConfigResult.value, authClient);
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
  void environment;

  const parsedConfigResult = await loadParsedUraniborgConfig(
    configFilePath,
    readWriter
  );

  if (!parsedConfigResult.ok) {
    return parsedConfigResult;
  }

  return resolveRevisionSetupReadinessInternal(parsedConfigResult.value, authClient);
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
  input: unknown
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  if (!isRecord(input)) {
    return err(
      createInvalidSchemaError(["Uraniborg config schema validation failed."])
    );
  }

  const version = input["version"];

  if (version === 1) {
    return err(createUnsupportedLegacyConfigError("version: 1"));
  }

  if (version === 2) {
    return err(createUnsupportedLegacyConfigError("version: 2"));
  }

  if (version !== 3) {
    return err(
      createInvalidSchemaError(['version: Expected config version "3".'])
    );
  }

  if (looksLikeUnsupportedLegacyRevisionConfig(input)) {
    return err(
      createUnsupportedLegacyConfigError(
        describeUnsupportedLegacyRevisionConfig(input)
      )
    );
  }

  const parsedV3 = storedConfigV3Schema.safeParse(input);

  if (!parsedV3.success) {
    return err(createInvalidSchemaError(formatZodIssues(parsedV3.error.issues)));
  }

  return ok({
    version: 3,
    revision: parsedV3.data.revision,
    refine: {
      endpoint: {
        baseUrl: parsedV3.data.revision.endpoint.baseUrl,
        timeoutMs: parsedV3.data.revision.endpoint.timeoutMs
      },
      defaults: parsedV3.data.revision.defaults
    }
  });
}

async function resolveRevisionSetupReadinessInternal(
  config: UraniborgConfig,
  authClient: RevisionAuthClient
): Promise<Result<UraniborgConfig, UraniborgConfigLoadError>> {
  const profile = getRevisionProfile(config.revision.profile.id);
  const credentialState = await authClient.resolveManagedCredential(
    config.revision.credentialBinding.providerId
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

async function resolveExecutableUraniborgConfig(
  config: UraniborgConfig,
  authClient: RevisionAuthClient
): Promise<Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>> {
  const readinessResult = await resolveRevisionSetupReadinessInternal(
    config,
    authClient
  );

  if (!readinessResult.ok) {
    return readinessResult;
  }

  return ok({
    ...config,
    revision: {
      ...config.revision,
      runtime: {
        kind: "pi-managed",
        providerId: config.revision.credentialBinding.providerId
      }
    }
  });
}

function looksLikeUnsupportedLegacyRevisionConfig(input: Record<string, unknown>): boolean {
  const revision = input["revision"];

  if (!isRecord(revision)) {
    return false;
  }

  const profile = revision["profile"];
  if (isRecord(profile)) {
    const profileId = profile["id"];
    if (
      profileId === "manual-openai-compatible" ||
      profileId === "claude-api" ||
      profileId === "gemini-direct"
    ) {
      return true;
    }
  }

  const auth = revision["auth"];
  if (isRecord(auth)) {
    if (auth["class"] !== "oauth" || auth["acquisition"] !== "browser-login") {
      return true;
    }
  }

  const credentialBinding = revision["credentialBinding"];
  if (isRecord(credentialBinding)) {
    if (credentialBinding["type"] !== "pi-auth-storage") {
      return true;
    }
  }

  return false;
}

function describeUnsupportedLegacyRevisionConfig(
  input: Record<string, unknown>
): string {
  const revision = input["revision"];

  if (!isRecord(revision)) {
    return "legacy or unsupported revision config";
  }

  const profile = revision["profile"];
  if (isRecord(profile) && typeof profile["id"] === "string") {
    return `unsupported revision profile "${profile["id"]}"`;
  }

  return "legacy or unsupported revision config";
}

function createUnsupportedLegacyConfigError(
  description: string
): UraniborgConfigLoadError {
  return {
    code: "config_stale_revision_setup",
    message:
      "Revision setup is from an unsupported older Uraniborg contract and must be rerun.",
    details: [
      `Detected ${description}.`,
      "Uraniborg now supports only browser-login-backed OpenAI/Codex, Claude, and Gemini revision providers.",
      "Run `uraniborg revision --setup` or `uraniborg init` to create a supported revision configuration."
    ]
  };
}

function readConfigFile(
  configFilePath: string,
  readWriter: UraniborgConfigReadWriter
): Promise<Result<string, UraniborgConfigLoadError>> {
  return (async () => {
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
  })();
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

function formatZodIssues(issues: readonly z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function normalizeUrlForComparison(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
