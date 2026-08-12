# AI Answer Council

AI Answer Council is a **UI-based web application** that improves answers by comparing multiple AI-generated perspectives. It is not a CLI application.

## How it works

The user enters a question in the browser. The application sends that question to three providers in parallel and displays each response as soon as it finishes:

- OpenAI — `gpt-5-nano`
- Anthropic — `claude-haiku-4-5`
- Google Gemini — `gemini-2.5-flash-lite`

The provider requests run through a server-side API route, keeping API keys out of the browser. The interface shows loading progress and handles individual provider failures without cancelling the other requests.

To control cost, each visitor can start one complete council request per minute. The three provider calls and final synthesis share a server-issued run token and count as one user request.

## Self-consistency flow

1. Send the same prompt independently to OpenAI, Claude, and Gemini.
2. Collect all successful candidate answers.
3. Send the original prompt and candidates to Claude Haiku as the evaluator.
4. Ask the evaluator to compare accuracy, reasoning, relevance, clarity, and completeness.
5. Return a new synthesized answer that combines the strongest ideas and resolves disagreements instead of copying one candidate.

## Run locally

Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` to `.env`, then run:

```bash
npm install
npm run dev
```
