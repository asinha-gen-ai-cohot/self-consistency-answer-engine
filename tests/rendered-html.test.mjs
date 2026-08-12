import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the Consensus product", async () => {
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Consensus — Three perspectives\. One better answer\./);
  assert.match(html, /Three perspectives/);
  assert.match(html, /Get consensus/);
  assert.match(html, /OpenAI/);
  assert.match(html, /Claude/);
  assert.match(html, /Gemini/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("demo orchestration returns a model answer", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/consensus", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "generate", provider: "openai", prompt: "How can a team use AI well?", demo: true }),
  }), env, ctx);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.answer, /start with the outcome/i);
});

test("demo evaluator synthesizes candidate responses", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/consensus", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "synthesize",
      provider: "claude",
      prompt: "How can a team use AI well?",
      demo: true,
      candidates: [
        { name: "OpenAI", model: "test", answer: "Start small." },
        { name: "Claude", model: "test", answer: "Keep human review." },
        { name: "Gemini", model: "test", answer: "Measure results." },
      ],
    }),
  }), env, ctx);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.answer, /people in charge of judgment/i);
  assert.match(body.answer, /all 3 perspectives/i);
});
