import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the AI Answer Council product", async () => {
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /AI Answer Council — Three perspectives\. One better answer\./);
  assert.match(html, /Three perspectives/);
  assert.match(html, /Ask the council/);
  assert.match(html, /OpenAI/);
  assert.match(html, /Claude/);
  assert.match(html, /Gemini/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton|Demo mode|Configure/);
});
