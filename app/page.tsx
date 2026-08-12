"use client";

import { useMemo, useRef, useState } from "react";

type Provider = "openai" | "claude" | "gemini";
type Status = "idle" | "thinking" | "done" | "error";

type Candidate = {
  provider: Provider;
  name: string;
  model: string;
  status: Status;
  answer?: string;
  error?: string;
  elapsed?: number;
};

const PROVIDERS: Array<Omit<Candidate, "status"> & { color: string; mark: string }> = [
  { provider: "openai", name: "OpenAI", model: "gpt-5.2", color: "mint", mark: "O" },
  { provider: "claude", name: "Claude", model: "claude-sonnet-5", color: "coral", mark: "C" },
  { provider: "gemini", name: "Gemini", model: "gemini-3.6-flash", color: "blue", mark: "G" },
];

const STARTER_PROMPT =
  "Explain how a small business can use AI to save time without losing the human touch.";

const EXAMPLES = [
  "Explain quantum computing simply",
  "Design a 30-day learning plan",
  "Compare remote vs. office work",
];

const initialCandidates = (): Candidate[] =>
  PROVIDERS.map(({ provider, name, model }) => ({ provider, name, model, status: "idle" }));

function elapsedLabel(ms?: number) {
  if (!ms) return "";
  return `${(ms / 1000).toFixed(1)}s`;
}

function answerParagraphs(answer: string) {
  return answer.split(/\n\n+/).filter(Boolean);
}

export default function Home() {
  const [prompt, setPrompt] = useState(STARTER_PROMPT);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalStatus, setFinalStatus] = useState<Status>("idle");
  const [finalError, setFinalError] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keys, setKeys] = useState<Record<Provider, string>>({ openai: "", claude: "", gemini: "" });
  const [models, setModels] = useState<Record<Provider, string>>({
    openai: "gpt-5.2",
    claude: "claude-sonnet-5",
    gemini: "gemini-3.6-flash",
  });
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const completedCount = useMemo(
    () => candidates.filter((candidate) => candidate.status === "done").length,
    [candidates],
  );
  const running = candidates.some((candidate) => candidate.status === "thinking") || finalStatus === "thinking";

  async function callEngine(body: unknown) {
    const response = await fetch("/api/consensus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { answer?: string; error?: string };
    if (!response.ok || !data.answer) throw new Error(data.error || "The model did not return an answer.");
    return data.answer;
  }

  async function runConsensus() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || running) return;

    const currentRun = ++runId.current;
    setFinalAnswer("");
    setFinalError("");
    setFinalStatus("idle");
    setCopied(false);
    setCandidates(
      PROVIDERS.map(({ provider, name }) => ({
        provider,
        name,
        model: models[provider],
        status: "thinking",
      })),
    );

    const responses = await Promise.all(
      PROVIDERS.map(async ({ provider, name }) => {
        const started = performance.now();
        try {
          const answer = await callEngine({
            action: "generate",
            provider,
            prompt: cleanPrompt,
            apiKey: keys[provider],
            model: models[provider],
            demo: demoMode,
          });
          const candidate: Candidate = {
            provider,
            name,
            model: models[provider],
            status: "done",
            answer,
            elapsed: performance.now() - started,
          };
          if (runId.current === currentRun) {
            setCandidates((items) => items.map((item) => (item.provider === provider ? candidate : item)));
          }
          return candidate;
        } catch (error) {
          const candidate: Candidate = {
            provider,
            name,
            model: models[provider],
            status: "error",
            error: error instanceof Error ? error.message : "Request failed.",
            elapsed: performance.now() - started,
          };
          if (runId.current === currentRun) {
            setCandidates((items) => items.map((item) => (item.provider === provider ? candidate : item)));
          }
          return candidate;
        }
      }),
    );

    if (runId.current !== currentRun) return;
    const successful = responses.filter((item) => item.status === "done" && item.answer);
    if (!successful.length) {
      setFinalStatus("error");
      setFinalError("None of the models completed. Check your API keys or switch on demo mode.");
      return;
    }

    setFinalStatus("thinking");
    const evaluator: Provider = demoMode || keys.claude ? "claude" : keys.openai ? "openai" : "gemini";
    try {
      const answer = await callEngine({
        action: "synthesize",
        provider: evaluator,
        prompt: cleanPrompt,
        candidates: successful.map(({ name, model, answer }) => ({ name, model, answer })),
        apiKey: keys[evaluator],
        model: models[evaluator],
        demo: demoMode,
      });
      if (runId.current === currentRun) {
        setFinalAnswer(answer);
        setFinalStatus("done");
      }
    } catch (error) {
      setFinalStatus("error");
      setFinalError(error instanceof Error ? error.message : "Synthesis failed.");
    }
  }

  async function copyAnswer() {
    if (!finalAnswer) return;
    await navigator.clipboard.writeText(finalAnswer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Consensus home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>consensus</span>
        </a>
        <div className="top-actions">
          <span className={`mode-pill ${demoMode ? "demo" : "live"}`}>
            <span /> {demoMode ? "Demo mode" : "Live APIs"}
          </span>
          <button className="settings-button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>
            <span aria-hidden="true">⚙</span> Configure
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>✦</span> MULTI-MODEL INTELLIGENCE</div>
        <h1>Three perspectives.<br /><em>One better answer.</em></h1>
        <p className="hero-copy">
          Ask once. Consensus consults leading AI models in parallel, then uses an independent evaluator to combine their strongest ideas.
        </p>

        {settingsOpen && (
          <section className="settings-panel" aria-label="API configuration">
            <div className="settings-heading">
              <div>
                <h2>Model configuration</h2>
                <p>Keys are sent only with your request and are never stored by this site.</p>
              </div>
              <label className="switch-row">
                <input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />
                <span className="switch" />
                Demo mode
              </label>
            </div>
            <div className="settings-grid">
              {PROVIDERS.map((provider) => (
                <div className="setting" key={provider.provider}>
                  <label htmlFor={`${provider.provider}-key`}>{provider.name} API key</label>
                  <input
                    id={`${provider.provider}-key`}
                    type="password"
                    value={keys[provider.provider]}
                    placeholder={provider.provider === "openai" ? "sk-…" : "Paste key"}
                    autoComplete="off"
                    onChange={(event) => setKeys((current) => ({ ...current, [provider.provider]: event.target.value }))}
                  />
                  <label className="model-label" htmlFor={`${provider.provider}-model`}>Model</label>
                  <input
                    id={`${provider.provider}-model`}
                    value={models[provider.provider]}
                    onChange={(event) => setModels((current) => ({ ...current, [provider.provider]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
            {!demoMode && !Object.values(keys).some(Boolean) && (
              <p className="settings-note">Add at least one key to run live. For full consensus, add all three.</p>
            )}
          </section>
        )}

        <div className="prompt-shell">
          <label htmlFor="question">What would you like to understand?</label>
          <textarea
            id="question"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runConsensus();
            }}
            maxLength={3000}
            rows={4}
            placeholder="Ask a complex question, request a plan, compare ideas…"
          />
          <div className="prompt-footer">
            <span>{prompt.length.toLocaleString()} / 3,000</span>
            <button className="run-button" onClick={runConsensus} disabled={!prompt.trim() || running}>
              {running ? <><span className="spinner" /> Thinking together…</> : <>Get consensus <span>→</span></>}
            </button>
          </div>
        </div>
        <div className="example-row" aria-label="Example prompts">
          <span>Try asking</span>
          {EXAMPLES.map((example) => <button key={example} onClick={() => setPrompt(example)}>{example}</button>)}
        </div>
      </section>

      <section className="process-section" aria-labelledby="process-title">
        <div className="section-heading">
          <div>
            <span className="kicker">THE DELIBERATION</span>
            <h2 id="process-title">Independent thinking, visible.</h2>
          </div>
          {running && <span className="progress-label">{completedCount} of 3 perspectives ready</span>}
        </div>

        <div className="model-grid">
          {candidates.map((candidate, index) => {
            const visual = PROVIDERS[index];
            return (
              <article className={`model-card ${visual.color} ${candidate.status}`} key={candidate.provider}>
                <div className="card-topline" />
                <header>
                  <span className="model-mark">{visual.mark}</span>
                  <div><h3>{candidate.name}</h3><p>{candidate.model}</p></div>
                  <span className={`status ${candidate.status}`}>
                    {candidate.status === "idle" && "Waiting"}
                    {candidate.status === "thinking" && "Thinking"}
                    {candidate.status === "done" && `Ready · ${elapsedLabel(candidate.elapsed)}`}
                    {candidate.status === "error" && "Unavailable"}
                  </span>
                </header>
                <div className="card-body">
                  {candidate.status === "idle" && <p className="empty-copy">This model’s perspective will appear here.</p>}
                  {candidate.status === "thinking" && <div className="skeleton"><i /><i /><i /><i /></div>}
                  {candidate.status === "error" && <div className="error-copy"><strong>Couldn’t complete</strong><p>{candidate.error}</p></div>}
                  {candidate.status === "done" && candidate.answer && (
                    <div className="answer-copy">{answerParagraphs(candidate.answer).map((paragraph, p) => <p key={p}>{paragraph}</p>)}</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className={`synthesis-bridge ${finalStatus !== "idle" ? "active" : ""}`} aria-hidden="true">
          <span /><div><i>✦</i> Evaluator synthesis</div><span />
        </div>

        <article className={`final-card ${finalStatus}`}>
          <div className="final-head">
            <div className="final-icon">✦</div>
            <div>
              <span>CONSENSUS ANSWER</span>
              <h2>The strongest answer, synthesized.</h2>
            </div>
            {finalStatus === "done" && <button onClick={copyAnswer}>{copied ? "Copied!" : "Copy answer"}</button>}
          </div>
          <div className="final-body">
            {finalStatus === "idle" && (
              <div className="final-empty"><span>✦</span><p>Your synthesized answer will appear after the models deliberate.</p></div>
            )}
            {finalStatus === "thinking" && (
              <div className="evaluating"><span className="spinner dark" /><div><strong>Finding the common ground</strong><p>Claude is comparing accuracy, clarity, and useful detail.</p></div></div>
            )}
            {finalStatus === "error" && <div className="final-error"><strong>Synthesis paused</strong><p>{finalError}</p></div>}
            {finalStatus === "done" && (
              <div className="final-copy">{answerParagraphs(finalAnswer).map((paragraph, p) => <p key={p}>{paragraph}</p>)}</div>
            )}
          </div>
          {finalStatus === "done" && (
            <footer><span><i /> Synthesized from {completedCount} independent responses</span><span>Evaluated for accuracy · clarity · completeness</span></footer>
          )}
        </article>
      </section>

      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark small"><i /><i /><i /></span> consensus</div>
        <p>Better answers emerge when ideas meet.</p>
        <span>Built with thoughtful AI orchestration</span>
      </footer>
    </main>
  );
}
