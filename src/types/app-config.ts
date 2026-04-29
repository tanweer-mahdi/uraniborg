import type {
  UraniborgRevisionAuthAcquisition,
  UraniborgRevisionAuthClass,
  UraniborgRevisionProfileId,
  UraniborgRevisionProviderFamily
} from "../config/revision-profiles.js";

export interface UraniborgRefineEndpointConfig {
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string | undefined;
  apiKeyEnvVar?: string | undefined;
}

export interface UraniborgRevisionDefaults {
  model: string;
  temperature: number;
  maxOutputTokens?: number | undefined;
}

export interface UraniborgRevisionProfileSelection {
  id: UraniborgRevisionProfileId;
  family: UraniborgRevisionProviderFamily;
  label: string;
}

export interface UraniborgRevisionAuthConfig {
  class: UraniborgRevisionAuthClass;
  acquisition: UraniborgRevisionAuthAcquisition;
}

export type UraniborgRevisionCredentialBinding =
  | {
      type: "stored-secret";
      apiKey: string;
    }
  | {
      type: "env-var";
      envVar: string;
    }
  | {
      type: "pi-auth-storage";
      providerId: string;
    }
  | {
      type: "adc";
    };

export interface UraniborgRevisionProviderContext {
  accountId?: string | undefined;
  projectId?: string | undefined;
}

export interface UraniborgRevisionEndpointConfig {
  baseUrl: string;
  overrideAllowed: boolean;
  timeoutMs: number;
}

export interface UraniborgRevisionConfig {
  profile: UraniborgRevisionProfileSelection;
  auth: UraniborgRevisionAuthConfig;
  credentialBinding: UraniborgRevisionCredentialBinding;
  providerContext?: UraniborgRevisionProviderContext | undefined;
  endpoint: UraniborgRevisionEndpointConfig;
  defaults: UraniborgRevisionDefaults;
}

export interface UraniborgConfig {
  version: 3;
  revision: UraniborgRevisionConfig;
  refine: {
    endpoint: UraniborgRefineEndpointConfig;
    defaults: UraniborgRevisionDefaults;
  };
}

export interface ResolvedUraniborgRefineEndpointConfig
  extends UraniborgRefineEndpointConfig {
  apiKey: string;
}

export interface ResolvedUraniborgConfig {
  version: 3;
  revision: UraniborgRevisionConfig;
  refine: {
    endpoint: ResolvedUraniborgRefineEndpointConfig;
    defaults: UraniborgRevisionDefaults;
  };
}

export type UraniborgConfigLoadErrorCode =
  | "config_not_found"
  | "config_not_readable"
  | "config_invalid_json"
  | "config_invalid_schema"
  | "config_stale_revision_setup"
  | "secret_missing"
  | "managed_credential_missing"
  | "managed_credential_unreadable"
  | "provider_context_missing"
  | "unsupported_auth_class";

export interface UraniborgConfigLoadError {
  code: UraniborgConfigLoadErrorCode;
  message: string;
  details?: string[];
}

export interface UraniborgConfigReadWriter {
  readFile: (configFilePath: string) => Promise<string>;
  writeFile: (configFilePath: string, contents: string) => Promise<void>;
}
