import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  GeneratedAnswer,
  ModelFailure,
  parseGenerated,
  providerAnswerSchema,
  SYSTEM_PROMPT,
  type ModelOptions,
} from "./assistant-model.ts";
import { resolveModelConfig } from "./model-config.ts";

const TIMEOUT_MS = 30000;

/** Same input and return shape as generateAnswer in assistant-model.ts. */
export async function generateAnthropicAnswer(
  payload: unknown,
  options: ModelOptions,
): Promise<z.infer<typeof GeneratedAnswer>> {
  const config = resolveModelConfig(options);
  const client =
    (options.anthropicClient as Anthropic | undefined) ??
    new Anthropic({
      apiKey: options.apiKey!.trim(),
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });
  try {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 8000,
      // Thinking cannot be disabled on this model; effort is the only control.
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: providerAnswerSchema() },
      },
      // Server-side refusal fallback: a declined request is re-run on the model Anthropic names.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    if (response.stop_reason === "refusal")
      throw new ModelFailure("provider_refusal");
    if (response.stop_reason !== "end_turn")
      throw new ModelFailure("invalid_output");
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new ModelFailure("invalid_output");
    return parseGenerated(JSON.parse(text.text));
  } catch (error) {
    if (error instanceof ModelFailure) throw error;
    if (error instanceof Anthropic.APIConnectionTimeoutError)
      throw new ModelFailure("timeout");
    if (error instanceof Anthropic.AuthenticationError)
      throw new ModelFailure("authentication_error");
    if (error instanceof Anthropic.PermissionDeniedError)
      throw new ModelFailure("access_denied");
    if (error instanceof Anthropic.NotFoundError)
      throw new ModelFailure("deployment_not_found");
    if (error instanceof Anthropic.RateLimitError)
      throw new ModelFailure("rate_limit_or_quota");
    if (error instanceof Anthropic.BadRequestError)
      throw new ModelFailure("unsupported_request");
    if (error instanceof Anthropic.APIError)
      throw new ModelFailure("provider_error");
    throw new ModelFailure("invalid_output");
  }
}
