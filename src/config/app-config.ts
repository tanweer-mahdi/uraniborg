import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgConfigLoadError,
  UraniborgConfigReadWriter
} from "../types/app-config.js";
import { err, ok, type Result } from "../types/result.js";

const refineDefaultsSchema = z.object({
  model: z.string().trim().min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().int().positive().optional()
});

const refineEndpointSchema = z.object({
  baseUrl: z.string().url(),
  timeoutMs: z.number().int().positive().default(60000),
  apiKey: z.string().trim().min(1).optional(),
  apiKeyEnvVar: z.string().trim().min(1).optional()
}).superRefine((value, context) => {
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

const uraniborgConfigSchema = z.object({
  version: z.literal(1),
  refine: z.object({
    endpoint: refineEndpointSchema,
    defaults: refineDefaultsSchema
  })
});

export function parseUraniborgConfig(
  input: unknown
): Result<UraniborgConfig, UraniborgConfigLoadError> {
  const parsed = uraniborgConfigSchema.safeParse(input);

  if (!parsed.success) {
    return err({
      code: "config_invalid_schema",
      message: "Uraniborg config schema validation failed.",
      details: parsed.error.issues.map((issue) => {
        const joinedPath = issue.path.map(String).join(".");
        return joinedPath.length > 0
          ? `${joinedPath}: ${issue.message}`
          : issue.message;
      })
    });
  }

  return ok(parsed.data);
}

export function resolveUraniborgConfigSecrets(
  config: UraniborgConfig,
  environment: NodeJS.ProcessEnv
): Result<ResolvedUraniborgConfig, UraniborgConfigLoadError> {
  const configuredApiKey = config.refine.endpoint.apiKey;

  if (typeof configuredApiKey === "string" && configuredApiKey.length > 0) {
    return ok({
      ...config,
      refine: {
        ...config.refine,
        endpoint: {
          ...config.refine.endpoint,
          apiKey: configuredApiKey
        }
      }
    });
  }

  const apiKeyEnvVar = config.refine.endpoint.apiKeyEnvVar;
  const apiKey =
    typeof apiKeyEnvVar === "string" ? environment[apiKeyEnvVar] : undefined;

  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return err({
      code: "secret_missing",
      message:
        typeof apiKeyEnvVar === "string"
          ? `Environment variable "${apiKeyEnvVar}" is not set.`
          : "Refinement API key is not configured.",
      details: [
        typeof apiKeyEnvVar === "string"
          ? "Set the configured API key environment variable before running refinement."
          : "Run `uraniborg init` to provide a refine API key."
      ]
    });
  }

  return ok({
    ...config,
    refine: {
      ...config.refine,
      endpoint: {
        ...config.refine.endpoint,
        apiKey
      }
    }
  });
}

export async function loadUraniborgConfig(
  configFilePath: string,
  environment: NodeJS.ProcessEnv = process.env,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>> {
  const parsedConfigResult = await loadParsedUraniborgConfig(
    configFilePath,
    readWriter
  );

  if (!parsedConfigResult.ok) {
    return parsedConfigResult;
  }

  return resolveUraniborgConfigSecrets(parsedConfigResult.value, environment);
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

export async function saveUraniborgConfig(
  configFilePath: string,
  config: UraniborgConfig,
  readWriter: UraniborgConfigReadWriter = createNodeConfigReadWriter()
): Promise<void> {
  const serializedConfig = JSON.stringify(config, null, 2);
  await readWriter.writeFile(configFilePath, `${serializedConfig}\n`);
}

export function createNodeConfigReadWriter(): UraniborgConfigReadWriter {
  return {
    async readFile(configFilePath: string): Promise<string> {
      return readFile(configFilePath, "utf8");
    },
    async writeFile(configFilePath: string, contents: string): Promise<void> {
      await writeFile(configFilePath, contents, "utf8");
    }
  };
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

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
