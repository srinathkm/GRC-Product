import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getGuardrailResponse } from '../services/guardrails.js';
import { answerWithContext } from '../services/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');

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

    const raw = await readFile(dataPath, 'utf-8');
    const changes = JSON.parse(raw);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentChanges = changes.filter(
      (c) => new Date(c.date) >= thirtyDaysAgo
    );

    const answer = await answerWithContext(text, recentChanges);
    res.json({ answer, guarded: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
