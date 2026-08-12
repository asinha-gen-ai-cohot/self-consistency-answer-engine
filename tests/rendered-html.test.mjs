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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton|Demo mode|Configure/);
});

test("live orchestration requires server-managed provider credentials", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/consensus", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "generate", provider: "openai", prompt: "How can a team use AI well?" }),
  }), env, ctx);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /API key is missing/i);
});
