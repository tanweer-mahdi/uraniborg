export interface UraniborgRefineEndpointConfig {
  baseUrl: string;
  apiKeyEnvVar: string;
  timeoutMs: number;
}

export interface UraniborgRefineDefaults {
  model: string;
  temperature: number;
  maxOutputTokens?: number | undefined;
}

export interface UraniborgConfig {
  version: 1;
  refine: {
    endpoint: UraniborgRefineEndpointConfig;
    defaults: UraniborgRefineDefaults;
  };
}

export interface ResolvedUraniborgRefineEndpointConfig
  extends UraniborgRefineEndpointConfig {
  apiKey: string;
}

export interface ResolvedUraniborgConfig {
  version: 1;
  refine: {
    endpoint: ResolvedUraniborgRefineEndpointConfig;
    defaults: UraniborgRefineDefaults;
  };
}

export type UraniborgConfigLoadErrorCode =
  | "config_not_found"
  | "config_not_readable"
  | "config_invalid_json"
  | "config_invalid_schema"
  | "secret_missing";

export interface UraniborgConfigLoadError {
  code: UraniborgConfigLoadErrorCode;
  message: string;
  details?: string[];
}

export interface UraniborgConfigReadWriter {
  readFile: (configFilePath: string) => Promise<string>;
  writeFile: (configFilePath: string, contents: string) => Promise<void>;
}
