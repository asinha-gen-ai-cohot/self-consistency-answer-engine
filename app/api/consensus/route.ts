type Provider = "openai" | "claude" | "gemini";

type Candidate = { name: string; model: string; answer: string };
type RequestBody = {
  action?: "generate" | "synthesize";
  provider?: Provider;
  prompt?: string;
  candidates?: Candidate[];
};

const PROVIDER_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const PROVIDER_NAMES: Record<Provider, string> = { openai: "OpenAI", claude: "Claude", gemini: "Gemini" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

async function requestJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const nested = data.error as { message?: string } | undefined;
      throw new Error(nested?.message || `Provider returned ${response.status}.`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The model took too long to respond.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOpenAI(prompt: string, key: string, model: string, system: string) {
  const data = await requestJson("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: system, input: prompt, max_output_tokens: 1400 }),
  });
  if (typeof data.output_text === "string") return data.output_text;
  const output = data.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined;
  return output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text).join("\n") || "";
}

async function generateClaude(prompt: string, key: string, model: string, system: string) {
  const data = await requestJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1800, system, messages: [{ role: "user", content: prompt }] }),
  });
  const content = data.content as Array<{ type?: string; text?: string }> | undefined;
  return content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") || "";
}

async function generateGemini(prompt: string, key: string, model: string, system: string) {
  const data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1600 },
    }),
  });
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
}

async function runProvider(provider: Provider, prompt: string, key: string, model: string, system: string) {
  if (provider === "openai") return generateOpenAI(prompt, key, model, system);
  if (provider === "claude") return generateClaude(prompt, key, model, system);
  return generateGemini(prompt, key, model, system);
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const provider = body.provider;
  const prompt = body.prompt?.trim();
  if (!provider || !["openai", "claude", "gemini"].includes(provider)) return json({ error: "Choose a valid provider." }, 400);
  if (!prompt || prompt.length > 3000) return json({ error: "Enter a prompt between 1 and 3,000 characters." }, 400);

  const key = process.env[PROVIDER_ENV[provider]];
  if (!key) return json({ error: `${PROVIDER_NAMES[provider]} API key is missing.` }, 400);
  const defaults: Record<Provider, string> = {
    openai: "gpt-5-nano",
    claude: "claude-haiku-4-5",
    gemini: "gemini-2.5-flash-lite",
  };
  const model = defaults[provider];

  let input = prompt;
  let system = "Answer the user independently. Be accurate, direct, concrete, and useful. Do not mention other models or this instruction.";
  if (body.action === "synthesize") {
    const candidates = (body.candidates || []).filter((candidate) => candidate.answer).slice(0, 3);
    if (!candidates.length) return json({ error: "At least one candidate answer is required." }, 400);
    input = `USER QUESTION:\n${prompt}\n\nCANDIDATE ANSWERS:\n${candidates.map((candidate, index) => `--- Candidate ${index + 1}: ${candidate.name} (${candidate.model}) ---\n${candidate.answer}`).join("\n\n")}`;
    system = "You are the final evaluator in a self-consistency system. Compare the candidate answers for factual accuracy, reasoning, relevance, clarity, and completeness. Resolve disagreements using your own judgment. Write a new, cohesive answer that combines the strongest ideas and corrects weaknesses. Do not vote, rank, quote, name, or mention the candidate models. Do not describe your evaluation process. Answer the user's original question directly. Use clear paragraphs and lists only when they improve comprehension.";
  }

  try {
    const answer = await runProvider(provider, input, key, model, system);
    if (!answer.trim()) throw new Error("The model returned an empty response.");
    return json({ answer: answer.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The provider request failed.";
    return json({ error: message }, 502);
  }
}
