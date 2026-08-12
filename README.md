# Consensus

Consensus is a self-consistency answer engine. It asks OpenAI, Claude, and Gemini the same question in parallel, displays each independent response, and then asks an evaluator model (Claude by default) to write a new answer from the strongest ideas.

## What it includes

- Parallel, independently tracked model requests
- Progressive loading and provider-level errors
- Claude-first synthesis with OpenAI/Gemini fallback
- Fixed, server-managed model configuration
- Server-side provider calls so keys are never exposed to browsers
- Responsive, accessible UI and production Cloudflare Worker output

The cost-conscious defaults are `gpt-5-nano`, `claude-haiku-4-5`, and `gemini-2.5-flash-lite`. Claude Haiku also performs the final synthesis.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env`, add all three provider credentials, then open `http://localhost:3000`.

## Orchestration flow

1. The browser dispatches three `/api/consensus` generation requests concurrently.
2. Each provider response updates its own card as soon as it settles; one failure does not cancel the others.
3. Successful answers are sent to a separate synthesis request.
4. Claude evaluates accuracy, reasoning, relevance, clarity, and completeness, resolves disagreements, and writes a new answer without naming or quoting the candidates.
5. When Claude is unavailable, the configured OpenAI or Gemini model can perform synthesis.

## Commands

```bash
npm run lint
npm test
npm run build
```

## Environment variables

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

All three values are required for the complete consensus flow. Production credentials must be stored as hosting secrets, never committed to source.
