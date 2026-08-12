type Provider = "openai" | "claude" | "gemini";

type Candidate = { name: string; model: string; answer: string };
type RequestBody = {
  action?: "generate" | "synthesize";
  provider?: Provider;
  prompt?: string;
  apiKey?: string;
  model?: string;
  demo?: boolean;
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

function topic(prompt: string) {
  return prompt.replace(/[?!.]+$/, "").trim();
}

function demoCandidate(provider: Provider, prompt: string) {
  const subject = topic(prompt);
  if (provider === "openai") {
    return `A practical way to approach “${subject}” is to start with the outcome, not the technology. Identify the repetitive work that consumes attention, then use AI for a small, reversible part of that workflow.\n\nKeep a person responsible for judgment, tone, and final approval. Measure whether the change saves time or improves quality, review the results weekly, and expand only what consistently works. This creates useful leverage without turning the process into a black box.`;
  }
  if (provider === "claude") {
    return `The key distinction is between automating human connection and supporting it. For “${subject},” AI is strongest as a preparation and drafting partner: it can summarize context, surface options, and create a first pass while a person supplies empathy, priorities, and accountability.\n\nUse three guardrails: disclose AI use where it matters, never delegate sensitive decisions, and make every output easy to review. A good system should leave people with more time for the conversations and creative choices only they can make.`;
  }
  return `Treat “${subject}” as a series of experiments. Map the current process, choose one high-frequency bottleneck, and define a baseline such as minutes spent, response time, or error rate. Run a two-week pilot with a clear human checkpoint.\n\nA useful loop is: capture → draft with AI → verify → personalize → learn. Save strong examples, document failures, and update the instructions. The compounding value comes from a better workflow, not from a single clever prompt.`;
}

function demoSynthesis(prompt: string, candidates: Candidate[]) {
  const subject = topic(prompt);
  return `The strongest approach to “${subject}” is to use AI as a capable first-pass partner while keeping people in charge of judgment, relationships, and final decisions. Start with one repetitive, low-risk bottleneck—not a sweeping transformation—and define what success looks like before changing the workflow.\n\nUse a simple operating loop: map the current process, let AI capture or draft, verify the result, add human context and personality, then record what worked. Build in explicit review points for factual accuracy, privacy, tone, and sensitive decisions. When the output affects another person, the human owner should remain visible and accountable.\n\nRun the change as a short pilot. Compare time saved, quality, error rate, and the experience of the people involved against your baseline. Keep the parts that create real leverage, revise weak instructions using good and bad examples, and expand gradually.\n\nThe principle connecting all ${candidates.length} perspectives is simple: the best AI workflow does not remove the human touch—it creates more room for it.`;
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

  if (body.demo) {
    const delay = provider === "openai" ? 520 : provider === "claude" ? 820 : 1080;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return json({ answer: body.action === "synthesize" ? demoSynthesis(prompt, body.candidates || []) : demoCandidate(provider, prompt) });
  }

  const key = body.apiKey?.trim() || process.env[PROVIDER_ENV[provider]];
  if (!key) return json({ error: `${PROVIDER_NAMES[provider]} API key is missing.` }, 400);
  const defaults: Record<Provider, string> = { openai: "gpt-5.2", claude: "claude-sonnet-5", gemini: "gemini-3.6-flash" };
  const model = body.model?.trim() || defaults[provider];

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
