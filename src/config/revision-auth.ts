import { spawn } from "node:child_process";

import type { Api, Model } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { OAuthLoginCallbacks } from "@mariozechner/pi-ai";

import type { UraniborgConfigLoadError } from "../types/app-config.js";
import { err, ok, type Result } from "../types/result.js";

export interface UraniborgRevisionManagedCredentialState {
  providerId: string;
  accountId?: string | undefined;
  projectId?: string | undefined;
}

export interface UraniborgRevisionManagedModelResolution {
  providerId: string;
  model: Model<Api>;
  apiKey: string;
  headers?: Record<string, string> | undefined;
  accountId?: string | undefined;
  projectId?: string | undefined;
}

export interface RevisionBrowserLauncher {
  open(url: string): Promise<void>;
}

export interface RevisionAuthClient {
  loginManagedCredential(
    providerId: string,
    callbacks: OAuthLoginCallbacks
  ): Promise<UraniborgRevisionManagedCredentialState>;
  resolveManagedCredential(
    providerId: string
  ): Promise<
    Result<UraniborgRevisionManagedCredentialState, UraniborgConfigLoadError>
  >;
  resolveManagedModel?(
    providerId: string,
    modelId: string
  ): Promise<
    Result<UraniborgRevisionManagedModelResolution, UraniborgConfigLoadError>
  > | undefined;
  listAvailableModelIds?(providerId: string): readonly string[];
}

class PiRevisionAuthClient implements RevisionAuthClient {
  constructor(
    private readonly authStorage: AuthStorage,
    private readonly modelRegistry: ModelRegistry
  ) {}

  async loginManagedCredential(
    providerId: string,
    callbacks: OAuthLoginCallbacks
  ): Promise<UraniborgRevisionManagedCredentialState> {
    await this.authStorage.login(providerId, callbacks);

    const credentialState = await this.resolveManagedCredential(providerId);

    if (!credentialState.ok) {
      throw new Error(credentialState.error.message);
    }

    return credentialState.value;
  }

  async resolveManagedCredential(
    providerId: string
  ): Promise<
    Result<UraniborgRevisionManagedCredentialState, UraniborgConfigLoadError>
  > {
    const initialErrors = this.authStorage.drainErrors();

    if (initialErrors.length > 0) {
      return err(
        createUnreadableManagedCredentialError(providerId, initialErrors)
      );
    }

    const credential = this.authStorage.get(providerId);

    if (credential === undefined) {
      return err(createMissingManagedCredentialError(providerId));
    }

    if (credential.type !== "oauth") {
      return err(
        createUnreadableManagedCredentialError(providerId, [
          new Error(
            `Expected OAuth credential state for "${providerId}", found "${credential.type}".`
          )
        ])
      );
    }

    const apiKey = await this.modelRegistry.getApiKeyForProvider(providerId);
    const followUpErrors = this.authStorage.drainErrors();

    if (followUpErrors.length > 0) {
      return err(
        createUnreadableManagedCredentialError(providerId, followUpErrors)
      );
    }

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return err({
        code: "managed_credential_unreadable",
        message: `Pi-managed credential state for "${providerId}" is not currently usable.`,
        details: [
          "Run `uraniborg revision --setup` again to refresh the managed browser-login credential."
        ]
      });
    }

    return ok({
      providerId,
      accountId: readOptionalCredentialField(credential, "accountId"),
      projectId: readOptionalCredentialField(credential, "projectId")
    });
  }

  async resolveManagedModel(
    providerId: string,
    modelId: string
  ): Promise<
    Result<UraniborgRevisionManagedModelResolution, UraniborgConfigLoadError>
  > {
    const credentialState = await this.resolveManagedCredential(providerId);

    if (!credentialState.ok) {
      return credentialState;
    }

    const model = this.modelRegistry.find(providerId, modelId);

    if (model === undefined) {
      return err({
        code: "model_unavailable",
        message: `Revision model "${modelId}" is not available for provider "${providerId}".`,
        details: [
          "Run `uraniborg models` to inspect the revision models available for the active profile."
        ]
      });
    }

    const requestAuth = await this.modelRegistry.getApiKeyAndHeaders(model);
    const followUpErrors = this.authStorage.drainErrors();

    if (followUpErrors.length > 0) {
      return err(
        createUnreadableManagedCredentialError(providerId, followUpErrors)
      );
    }

    if (!requestAuth.ok || typeof requestAuth.apiKey !== "string" || requestAuth.apiKey.length === 0) {
      return err({
        code: "managed_credential_unreadable",
        message: `Pi-managed credential state for "${providerId}" is not currently usable for model "${modelId}".`,
        details: [
          ...(requestAuth.ok ? [] : [requestAuth.error]),
          "Run `uraniborg revision --setup` again to refresh the managed browser-login credential."
        ]
      });
    }

    return ok({
      providerId,
      model,
      apiKey: requestAuth.apiKey,
      headers: requestAuth.headers,
      accountId: credentialState.value.accountId,
      projectId: credentialState.value.projectId
    });
  }

  listAvailableModelIds(providerId: string): readonly string[] {
    return this.modelRegistry
      .getAvailable()
      .filter((model) => model.provider === providerId)
      .map((model) => model.id);
  }
}

export function createRevisionAuthClient(): RevisionAuthClient {
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  return new PiRevisionAuthClient(authStorage, modelRegistry);
}

export function createNodeRevisionBrowserLauncher(): RevisionBrowserLauncher {
  return {
    async open(url: string): Promise<void> {
      const { command, args } = resolveBrowserOpenCommand(url);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
          detached: true,
          stdio: "ignore"
        });

        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
    }
  };
}

function readOptionalCredentialField(
  credential: {
    type: "oauth";
    [key: string]: unknown;
  },
  fieldName: "accountId" | "projectId"
): string | undefined {
  const fieldValue = credential[fieldName];

  return typeof fieldValue === "string" && fieldValue.length > 0
    ? fieldValue
    : undefined;
}

function resolveBrowserOpenCommand(url: string): {
  command: string;
  args: string[];
} {
  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url]
    };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "start", "", url]
    };
  }

  return {
    command: "xdg-open",
    args: [url]
  };
}

function createMissingManagedCredentialError(
  providerId: string
): UraniborgConfigLoadError {
  return {
    code: "managed_credential_missing",
    message: `Pi-managed credential state for "${providerId}" was not found.`,
    details: [
      "Run `uraniborg revision --setup` to complete browser login for this revision profile."
    ]
  };
}

function createUnreadableManagedCredentialError(
  providerId: string,
  errors: readonly Error[]
): UraniborgConfigLoadError {
  return {
    code: "managed_credential_unreadable",
    message: `Pi-managed credential state for "${providerId}" could not be read.`,
    details: [
      ...errors.map((error) => error.message),
      "Run `uraniborg revision --setup` to refresh or recreate the managed browser-login credential."
    ]
  };
}
