import 'dotenv/config';

const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

export function isLlmConfigured() {
  return !!API_KEY && !!BASE_URL;
}

function buildChatCompletionsUrl() {
  // If BASE_URL already ends with /chat/completions, use as-is; otherwise append it.
  if (/\/chat\/completions$/i.test(BASE_URL)) return BASE_URL;
  return `${BASE_URL}/chat/completions`;
}

/**
 * Generic chat completion call against an OpenAI-compatible endpoint.
 * Falls back to DEFAULT_MODEL if no model provided.
 *
 * @param {Object} opts
 * @param {Array}  opts.messages - OpenAI-style messages array
 * @param {string} [opts.model]  - Model/deployment name
 * @param {number} [opts.maxTokens]
 * @param {'json'|'text'} [opts.responseFormat]
 */
export async function createChatCompletion({ messages, model, maxTokens, responseFormat = 'text' }) {
  if (!isLlmConfigured()) {
    throw new Error('LLM is not configured. Set LLM_BASE_URL and LLM_API_KEY (or OPENAI_API_KEY).');
  }
  const url = buildChatCompletionsUrl();
  const body = {
    model: model || DEFAULT_MODEL,
    messages: messages || [],
  };
  if (typeof maxTokens === 'number') {
    body.max_tokens = maxTokens;
  }
  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  // Default header (OpenAI-compatible). Many providers also accept this.
  headers.Authorization = `Bearer ${API_KEY}`;
  // Some providers (e.g. Azure OpenAI) expect api-key instead; we set both to be safe.
  headers['api-key'] = API_KEY;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM request failed with status ${res.status}: ${text || res.statusText}`);
  }

  const json = await res.json();
  return json;
}

