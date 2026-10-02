export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response: unknown };
}
export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface GenerateRequest {
  system: string;
  contents: GeminiContent[];
  tools?: FunctionDeclaration[];
  /** Ask for a JSON-only reply. Gemini does not allow this together with tools. */
  json?: boolean;
}
export type GenerateFn = (request: GenerateRequest) => Promise<GeminiContent>;

export class AiProviderError extends Error {
  constructor(message: string, public status: 502 | 504) {
    super(message);
  }
}

const TIMEOUT_MS = 45_000;

function config() {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !baseUrl || !model) {
    throw new AiProviderError("The AI provider is not configured.", 502);
  }
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

/** Server-only Gemini call. Key, base URL and model all come from environment variables. */
export const generateContent: GenerateFn = async ({ system, contents, tools, json }) => {
  const { apiKey, baseUrl, model } = config();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
        generationConfig: { temperature: 0.1, ...(json && !tools?.length ? { responseMimeType: "application/json" } : {}) },
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new AiProviderError(timedOut ? "The AI provider timed out." : "The AI provider could not be reached.", timedOut ? 504 : 502);
  }
  if (!response.ok) throw new AiProviderError("The AI provider returned an error.", 502);

  const data = (await response.json()) as { candidates?: Array<{ content?: GeminiContent }> };
  const content = data.candidates?.[0]?.content;
  if (!content?.parts) throw new AiProviderError("The AI provider returned an empty response.", 502);
  return { role: "model", parts: content.parts };
};

export function textOf(content: GeminiContent): string {
  return content.parts.map((p) => p.text ?? "").join("");
}
