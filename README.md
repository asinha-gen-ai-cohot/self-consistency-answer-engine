# Consensus

Consensus is a self-consistency answer engine. It asks OpenAI, Claude, and Gemini the same question in parallel, displays each independent response, and then asks an evaluator model (Claude by default) to write a new answer from the strongest ideas.

## What it includes

- Parallel, independently tracked model requests
- Progressive loading and provider-level errors
- Claude-first synthesis with OpenAI/Gemini fallback
- Editable model IDs and bring-your-own API keys
- Server-side provider calls so keys are not exposed to third-party browser scripts
- A no-key demo mode for exploring the complete workflow
- Responsive, accessible UI and production Cloudflare Worker output

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Demo mode is enabled initially. Open **Configure** to use live APIs.

You can either enter keys in the interface for the current run or copy `.env.example` to `.env` and set server-side keys. Keys entered in the interface are held in page memory and sent only to this app's API route; they are not stored by the application.

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

The app also works without hosted secrets through demo mode or per-session key entry.
