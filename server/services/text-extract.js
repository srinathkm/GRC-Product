import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createChatCompletion, isLlmConfigured } from './llm.js';

/**
 * Extract plain text from a PDF buffer.
 */
async function extractPdfText(buffer) {
  try {
    const result = await pdfParse(buffer);
    return typeof result.text === 'string' ? result.text : '';
  } catch (e) {
    console.error('PDF text extract error:', e.message);
    return '';
  }
}

/**
 * Extract plain text from a DOCX buffer.
 */
async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return typeof result.value === 'string' ? result.value : '';
  } catch (e) {
    console.error('DOCX text extract error:', e.message);
    return '';
  }
}

function inferTypeFromFilename(filename = '') {
  const lower = String(filename).toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  return '';
}

async function extractImageText(buffer, mimetype) {
  if (!isLlmConfigured()) return '';
  try {
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;
    const completion = await createChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are an OCR assistant for legal/compliance documents. Extract visible text exactly as-is. Return plain text only, no markdown.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all readable text from this document image. Keep line breaks.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      maxTokens: 2500,
    });
    return (completion?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('Image OCR extract error:', e.message);
    return '';
  }
}

/**
 * Extract text from an arbitrary document buffer based on mimetype.
 * Supports:
 * - PDF (application/pdf)
 * - DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 * - Plain text (text/plain, text/*)
 * For unsupported types, returns an empty string.
 */
export async function extractTextFromBuffer(buffer, mimetype = 'application/octet-stream', filename = '') {
  const declared = String(mimetype || '').toLowerCase();
  const inferred = inferTypeFromFilename(filename);
  const type =
    !declared || declared === 'application/octet-stream'
      ? inferred || 'application/octet-stream'
      : declared;

  if (type === 'application/pdf') {
    const text = await extractPdfText(buffer);
    return text.trim();
  }
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const text = await extractDocxText(buffer);
    return text.trim();
  }
  if (type === 'application/msword') {
    // Legacy .doc parsing fallback (best effort only).
    return buffer.toString('utf8').replace(/\0/g, ' ').trim();
  }
  if (type.startsWith('text/')) {
    return buffer.toString('utf8').trim();
  }
  if (type.startsWith('image/')) {
    return extractImageText(buffer, type);
  }
  return '';
}

