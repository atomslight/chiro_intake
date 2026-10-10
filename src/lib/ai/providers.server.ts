/**
 * Provider adapters (server-only). Model IDs verified against each provider's /models listing on 2026-10-06.
 * Groq: fast edits + transcription. Gemini: whole-intake understanding (story extraction, report review).
 */
export const MODELS = {
  groqText: "openai/gpt-oss-120b",
  groqAudio: "whisper-large-v3-turbo",
  gemini: "gemini-3.8-flash",
} as const;

export class AiError extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}

const TIMEOUT_MS = 45_000;

async function call(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      if (attempt === 0) continue;
      throw new AiError("The AI service didn't respond in time.", true);
    }
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt === 0) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    if (res.status === 401 || res.status === 403) throw new AiError("The AI service rejected the API key.");
    throw new AiError(`The AI service returned an error (${res.status}).`, retryable);
  }
  throw new AiError("The AI service is unavailable.", true);
}

function key(name: "GROQ_API_KEY" | "GEMINI_API_KEY") {
  const k = process.env[name];
  if (!k) throw new AiError(`${name} is not configured on the server.`);
  return k;
}

function parseJson(text: string | undefined): unknown {
  if (!text) throw new AiError("The AI returned an empty answer.", true);
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try { return JSON.parse(cleaned); } catch { throw new AiError("The AI returned an unreadable answer.", true); }
}

export async function groqJson(system: string, user: string): Promise<unknown> {
  const res = await call("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key("GROQ_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.groqText,
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(data.choices?.[0]?.message?.content);
}

export async function geminiJson(system: string, user: string): Promise<unknown> {
  const res = await call(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key("GEMINI_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return parseJson(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(""));
}

/** Try the primary provider, fall back to the other (both support JSON text tasks). */
export async function jsonWithFallback(primary: "groq" | "gemini", system: string, user: string) {
  const order = primary === "groq" ? [groqJson, geminiJson] : [geminiJson, groqJson];
  try { return await order[0]!(system, user); }
  catch (e) {
    if (e instanceof AiError && !e.retryable && e.message.includes("not configured")) throw e;
    return await order[1]!(system, user);
  }
}

export async function groqTranscribe(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", MODELS.groqAudio);
  form.append("response_format", "json");
  form.append("language", "en");
  const res = await call("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key("GROQ_API_KEY")}` }, body: form,
  });
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
