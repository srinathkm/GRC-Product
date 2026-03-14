import { Router } from 'express';
import { answerGlobal } from '../services/ai.js';

export const assistantRouter = Router();

assistantRouter.post('/', async (req, res) => {
  try {
    const { message, history = [], currentModule, persona, parentHolding } = req.body || {};
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return res.status(400).json({ error: 'Message is required' });

    const response = await answerGlobal({
      message: text,
      history: Array.isArray(history) ? history.slice(-8) : [], // last 8 turns for context
      currentModule: currentModule || 'overview',
      persona: persona || 'c-level',
      parentHolding: parentHolding || '',
    });
    res.json(response);
  } catch (e) {
    console.error('Assistant error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
