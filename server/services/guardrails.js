import { ALLOWED_TOPICS, GUARDRAIL_MESSAGE } from '../constants.js';

/**
 * Simple guardrail: check if the user message is related to the allowed
 * regulatory frameworks and their changes. Returns true if on-topic.
 */
export function isOnTopic(message) {
  if (!message || typeof message !== 'string') return false;
  const lower = message.toLowerCase().trim();
  if (lower.length < 3) return false;

  const topicLower = ALLOWED_TOPICS.map((t) => t.toLowerCase());
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  const hasTopic = words.some((w) =>
    topicLower.some((t) => t.includes(w) || w.includes(t))
  );

  if (hasTopic) return true;

  const phrases = [
    'dfsa', 'sama', 'cma', 'dubai 2040', 'saudi 2030', 'sdaia',
    'regulation', 'regulatory', 'framework', 'compliance', 'rulebook',
    'change', 'amendment', 'disclosure', 'capital', 'conduct',
  ];
  return phrases.some((p) => lower.includes(p));
}

/**
 * If the question is off-topic, returns the guardrail message; otherwise null.
 */
export function getGuardrailResponse(message) {
  return isOnTopic(message) ? null : GUARDRAIL_MESSAGE;
}
