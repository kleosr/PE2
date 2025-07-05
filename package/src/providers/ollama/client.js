// Node 18+ has a global `fetch` implementation; no extra dependency required.

/**
 * Minimal Ollama client wrapper that exposes a subset of the
 * `chat.completions.create` signature expected by the CLI.
 *
 * Ollama runs locally (default base URL http://localhost:11434) and has a
 * single `/api/chat` endpoint that accepts `{ model, messages }`.
 */
export function createOllamaClient(baseURL = 'http://localhost:11434') {
  async function create({ model, messages, max_tokens = 2048, stream = false }) {
    const res = await fetch(`${baseURL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream,
        options: { num_predict: max_tokens }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = data?.message?.content ?? '';

    return {
      choices: [
        {
          message: { content }
        }
      ]
    };
  }

  return {
    chat: {
      completions: {
        create
      }
    }
  };
} 