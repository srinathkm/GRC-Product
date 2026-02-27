import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract plain text from a PDF buffer.
 */
async function extractPdfText(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
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

/**
 * Extract text from an arbitrary document buffer based on mimetype.
 * Supports:
 * - PDF (application/pdf)
 * - DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 * - Plain text (text/plain, text/*)
 * For unsupported types, returns an empty string.
 */
export async function extractTextFromBuffer(buffer, mimetype = 'application/octet-stream') {
  const type = mimetype.toLowerCase();
  if (type === 'application/pdf') {
    return extractPdfText(buffer);
  }
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxText(buffer);
  }
  if (type.startsWith('text/')) {
    return buffer.toString('utf8');
  }
  return '';
}

