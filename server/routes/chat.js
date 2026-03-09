import { Router } from 'express';
import { getGuardrailResponse } from '../services/guardrails.js';
import { answerWithAppContext } from '../services/ai.js';

export const chatRouter = Router();

chatRouter.post('/', async (req, res) => {
  try {
    const { message } = req.body || {};
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const guardrail = getGuardrailResponse(text);
    if (guardrail) {
      return res.json({ answer: guardrail, guarded: true });
    }

    const answer = await answerWithAppContext(text);
    res.json({ answer, guarded: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
