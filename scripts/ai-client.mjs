export const DEFAULT_WIKI_API_URL = "https://api.deepseek.com/chat/completions";
export const DEFAULT_WIKI_MODEL = "deepseek-flash";

export function resolveWikiAIConfig(environment = process.env) {
  const url = environment.WIKI_API_URL?.trim() || DEFAULT_WIKI_API_URL;
  const model = environment.WIKI_MODEL?.trim() || DEFAULT_WIKI_MODEL;
  let endpoint;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("WIKI_API_URL must be a valid HTTPS URL");
  }
  if (endpoint.protocol !== "https:")
    throw new Error("WIKI_API_URL must use HTTPS");
  const key =
    environment.WIKI_API_KEY?.trim() ||
    (endpoint.hostname === "api.deepseek.com"
      ? environment.DEEPSEEK_API_KEY?.trim()
      : "") ||
    "";
  return { url, model, key, enabled: Boolean(key) };
}

export async function requestWikiJSON(
  messages,
  configuration = resolveWikiAIConfig(),
  { purpose = "architecture", timeout = 240000 } = {},
) {
  if (!configuration.key) return null;
  const deepseek = new URL(configuration.url).hostname === "api.deepseek.com";
  const body = {
    model: configuration.model,
    messages,
    response_format: { type: "json_object" },
    max_tokens: purpose === "planning" ? 8000 : deepseek ? 32000 : 24000,
    stream: false,
  };
  if (deepseek) {
    body.thinking = { type: purpose === "planning" ? "disabled" : "enabled" };
    if (purpose !== "planning") body.reasoning_effort = "low";
    else body.temperature = 0.2;
  }
  const started = Date.now();
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(configuration.url, {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${configuration.key}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = new Error(
          `Wiki ${purpose} API returned HTTP ${response.status}`,
        );
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const result = await response.json();
      const choice = result.choices?.[0];
      if (choice?.finish_reason === "length")
        throw new Error(`Wiki ${purpose} output was truncated`);
      if (typeof choice?.message?.content !== "string")
        throw new Error(`Wiki ${purpose} API returned no final content`);
      const raw = choice.message.content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error(`Wiki ${purpose} API returned invalid JSON`);
      }
      if (!value || Array.isArray(value) || typeof value !== "object")
        throw new Error(`Wiki ${purpose} API returned a non-object JSON value`);
      return {
        value,
        actualModel:
          typeof result.model === "string" ? result.model : configuration.model,
        usage: result.usage
          ? {
              prompt_tokens: result.usage.prompt_tokens ?? 0,
              completion_tokens: result.usage.completion_tokens ?? 0,
            }
          : null,
        durationMs: Date.now() - started,
        formatRetries: attempt,
      };
    } catch (error) {
      const timeoutError =
        error.name === "TimeoutError" || error.name === "AbortError";
      const retryable =
        error.retryable ||
        timeoutError ||
        /truncated|invalid JSON|no final content/.test(error.message);
      if (attempt === 0 && retryable) {
        // A new complete JSON response is required; never publish a salvaged fragment.
        // Keep the same source evidence, but reserve the retry's budget for final output.
        if (deepseek) {
          body.thinking = { type: "disabled" };
          delete body.reasoning_effort;
          body.temperature = 0.2;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      if (timeoutError)
        throw new Error(`Wiki ${purpose} request exceeded ${timeout / 1000}s`);
      throw error;
    }
  }
}
