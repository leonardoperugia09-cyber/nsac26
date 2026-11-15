export type ModelOptions = {
  provider?: "openai" | "azure";
  apiKey?: string;
  /** OpenAI model ID, or the Azure deployment name (not its underlying model ID). */
  model?: string;
  azureEndpoint?: string;
};

export class ModelConfigurationError extends Error {
  constructor(
    readonly status: "not_configured" | "invalid_configuration",
    message: string,
  ) {
    super(message);
  }
}

export function modelOptionsFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelOptions {
  const provider = env.AI_PROVIDER?.trim() || "openai";
  if (provider !== "openai" && provider !== "azure") {
    throw new ModelConfigurationError(
      "invalid_configuration",
      "AI_PROVIDER must be openai or azure.",
    );
  }
  // Never send an OpenAI key to Azure, or an Azure key to OpenAI, as an implicit fallback.
  return provider === "azure"
    ? {
        provider,
        apiKey: env.AZURE_OPENAI_API_KEY?.trim(),
        model: env.AZURE_OPENAI_DEPLOYMENT?.trim(),
        azureEndpoint: env.AZURE_OPENAI_ENDPOINT?.trim(),
      }
    : {
        provider,
        apiKey: env.AI_API_KEY?.trim(),
        model: env.HALO_MODEL?.trim(),
      };
}

export function azureBaseUrl(endpoint: string) {
  try {
    const url = new URL(endpoint);
    // Server-only resource endpoints. Reject project URLs, arbitrary gateways,
    // query credentials and misleading host suffixes before attaching a key.
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.(?:openai\.azure\.com|services\.ai\.azure\.com)$/i.test(
        url.hostname,
      ) ||
      !["", "/", "/openai/v1", "/openai/v1/"].includes(url.pathname)
    )
      throw Error();
    return `${url.origin}/openai/v1/`;
  } catch {
    // Never echo an endpoint that might contain a misplaced credential.
    throw new ModelConfigurationError(
      "invalid_configuration",
      "AZURE_OPENAI_ENDPOINT must be the HTTPS Azure resource root or /openai/v1/ URL, without credentials, query parameters or a project path.",
    );
  }
}

export function resolveModelConfig(options: ModelOptions) {
  const provider = options.provider ?? "openai";
  if (provider !== "openai" && provider !== "azure")
    throw new ModelConfigurationError(
      "invalid_configuration",
      "AI_PROVIDER must be openai or azure.",
    );
  const missing =
    provider === "azure"
      ? [
          [options.apiKey, "AZURE_OPENAI_API_KEY"],
          [options.model, "AZURE_OPENAI_DEPLOYMENT"],
          [options.azureEndpoint, "AZURE_OPENAI_ENDPOINT"],
        ]
      : [
          [options.apiKey, "AI_API_KEY"],
          [options.model, "HALO_MODEL"],
        ];
  const names = missing
    .filter(([value]) => !value?.trim())
    .map(([, name]) => name);
  if (names.length)
    throw new ModelConfigurationError(
      "not_configured",
      `Hosted AI is not configured. Set ${names.join(", ")} on the API server.`,
    );
  const url =
    provider === "azure"
      ? `${azureBaseUrl(options.azureEndpoint!)}chat/completions`
      : "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider === "azure") headers["api-key"] = options.apiKey!.trim();
  else headers.Authorization = `Bearer ${options.apiKey!.trim()}`;
  return { provider, url, headers, model: options.model!.trim() };
}
