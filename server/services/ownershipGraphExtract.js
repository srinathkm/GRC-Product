import { createChatCompletion, isLlmConfigured } from './llm.js';
import { normalizeOwnershipGraphV1 } from './ownershipGraphModel.js';

const MAX_TEXT = 80000;

const SYSTEM_PROMPT = `You extract beneficial ownership structure from regulatory or corporate documents.
Return ONLY valid JSON, no markdown. The JSON must match this shape:
{
  "schemaVersion": "1",
  "subjectNodeId": "<id of the main operating company or subject entity if identifiable, else null>",
  "nodes": [
    { "id": "stable-id", "label": "Legal name", "type": "person"|"corporate"|"trust"|"fund"|"unknown", "jurisdiction": "optional" }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "<owner id>",
      "target": "<owned entity id>",
      "kind": "owns"|"controls"|"votes",
      "percent": <number 0-100 or omit>,
      "confidence": "high"|"medium"|"low"|omit,
      "citations": [ { "page": "2", "quote": "short verbatim snippet" } ]
    }
  ]
}
Semantics: edge source HOLDS stake in target (ownership flows from upstream owner to downstream company). Use "unknown" type when unclear. If information is missing, omit nodes/edges rather than inventing names. If you cannot extract any structure, return {"schemaVersion":"1","subjectNodeId":null,"nodes":[],"edges":[]}.`;

/**
 * @param {string} text
 * @param {string} [subjectHint] — e.g. organization name from title extraction
 * @returns {Promise<{ graph: object, warnings: string[], extractionMeta: object }>}
 */
export async function extractOwnershipGraphFromText(text, subjectHint = '') {
  const trimmed = (text || '').slice(0, MAX_TEXT);
  const extractionMeta = {
    textLength: trimmed.length,
    truncated: (text || '').length > MAX_TEXT,
    source: 'llm',
    extractedAt: new Date().toISOString(),
  };

  if (!trimmed.trim()) {
    return {
      graph: normalizeOwnershipGraphV1({ schemaVersion: '1', nodes: [], edges: [] }, { subjectHint }).graph,
      warnings: ['No text could be read from this file. Try a text-based PDF or Word document.'],
      extractionMeta: { ...extractionMeta, source: 'empty' },
    };
  }

  if (!isLlmConfigured()) {
    return {
      graph: normalizeOwnershipGraphV1({ schemaVersion: '1', nodes: [], edges: [] }, { subjectHint }).graph,
      warnings: ['Ownership extraction needs an LLM on the server. Your administrator can set LLM_API_KEY.'],
      extractionMeta: { ...extractionMeta, source: 'no_llm' },
    };
  }

  const userContent = `${subjectHint ? `Subject entity hint (from document metadata): "${subjectHint}"\n\n` : ''}Document text:\n${trimmed}`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      maxTokens: 6000,
      responseFormat: 'json',
    });

    const rawText = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const { graph, warnings } = normalizeOwnershipGraphV1(rawText, { subjectHint });
    return {
      graph,
      warnings,
      extractionMeta,
    };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : 'Extraction failed';
    return {
      graph: normalizeOwnershipGraphV1({ schemaVersion: '1', nodes: [], edges: [] }, { subjectHint }).graph,
      warnings: [`We could not build an ownership chart from this document (${msg.slice(0, 200)}). You can try again or use the UBO register table.`],
      extractionMeta: { ...extractionMeta, source: 'llm_error', error: msg.slice(0, 500) },
    };
  }
}
