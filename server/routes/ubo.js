import { Router } from 'express';
import multer from 'multer';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';
import { extractTextFromBuffer } from '../services/text-extract.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    const allowed = /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(file.originalname) ||
      ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only PDF and image files (PNG, JPG, GIF, WebP) are allowed'), false);
  },
});

/**
 * Extract UBO-related fields from an uploaded image using vision.
 * PDFs are accepted but extraction runs only on images unless we add PDF text parsing.
 */
async function extractUboFromImage(buffer, mimetype) {
  if (!isLlmConfigured()) return null;
  const isImage = /^image\//.test(mimetype);
  if (!isImage) return null;
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimetype};base64,${base64}`;
  const prompt = `Extract Ultimate Beneficial Owner (UBO) details from this document. Return a JSON object only, no other text. Use empty string "" for any field not found. Keys: fullName, nationality, dateOfBirth, placeOfBirth, idType, idNumber, idCountryOfIssue, idExpiry, address, countryOfResidence, percentageOwnership, natureOfControl, dateBecameBeneficialOwner.`;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You extract structured data from identity or UBO documents. Reply only with valid JSON.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      maxTokens: 800,
      responseFormat: 'json',
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('UBO extract error:', e.message);
    return null;
  }
}

function guessOrganizationNameFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length < 3 || line.length > 200) continue;
    const lower = line.toLowerCase();
    // Skip boilerplate / headings that are unlikely to be the entity name.
    if (
      lower.includes('ultimate beneficial owner') ||
      lower.includes('ubo register') ||
      lower.includes('ubo declaration') ||
      lower.includes('certificate') ||
      lower.includes('declaration') ||
      lower.includes('register') ||
      lower.includes('form') ||
      lower.startsWith('page ') ||
      lower.startsWith('date:')
    ) {
      continue;
    }
    if (/[a-zA-Z]/.test(line)) return line;
  }
  return '';
}

function cleanCertificateNumber(raw) {
  if (!raw && raw !== 0) return '';
  const str = String(raw).trim();
  if (!str) return '';
  // Strip leading label like "Certificate Reference No:", "UBO Certificate Number:", etc.
  const m = str.match(
    /(?:UBO\s*Certificate|Certificate\s*Reference|Certificate)\s*(?:Ref(?:erence)?\s*)?(?:No\.?|Number)?\s*[:\-]?\s*(.*)$/i,
  );
  if (m && m[1] && m[1].trim()) {
    return m[1].trim();
  }
  return str;
}

function cleanParentEntityName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let name = raw.trim();
  if (!name) return '';

  // Strip anything in parentheses at the end, e.g. "Alpha Holdings (Cayman Islands)".
  const parenIndex = name.indexOf('(');
  if (parenIndex > 0) {
    name = name.slice(0, parenIndex).trim();
  }

  // Normalise whitespace and remove trailing jurisdiction/location phrases so that
  // only the legal entity name remains. We ignore case and basic punctuation.
  const jurisTokens = [
    'DIFC',
    'ADGM',
    'MAINLAND UAE',
    'UAE',
    'KSA',
    'SAUDI ARABIA',
    'QATAR',
    'BAHRAIN',
    'OMAN',
    'KUWAIT',
    'CAYMAN ISLANDS',
    'CAYMAN',
    'BRITISH VIRGIN ISLANDS',
    'BVI',
    'DUBAI',
    'ABU DHABI',
    'SAUDI',
    'EMIRATES',
    'FREE ZONE',
  ].map((t) => t.toUpperCase());

  // Helper to strip non-alphanumeric characters for comparison.
  const normalise = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1) Handle hyphen-separated suffixes first, e.g. "Alpha Holdings - DIFC".
  let hyphenParts = name.split(/\s*[-–]\s*/);
  if (hyphenParts.length > 1) {
    const lastNorm = normalise(hyphenParts[hyphenParts.length - 1]);
    if (jurisTokens.includes(lastNorm) || /^[A-Z]{2,5}$/.test(lastNorm)) {
      hyphenParts.pop();
      name = hyphenParts.join(' - ').trim();
    }
  }

  // 2) Token-based stripping from the end, e.g.
  // "Alpha Holdings Limited Cayman Islands" → "Alpha Holdings Limited".
  const words = name.split(/\s+/);
  while (words.length) {
    const lastOne = normalise(words[words.length - 1]);
    const lastTwo = words.length >= 2 ? normalise(words.slice(-2).join(' ')) : '';

    if (lastTwo && jurisTokens.includes(lastTwo)) {
      words.splice(-2, 2);
      continue;
    }
    if (lastOne && jurisTokens.includes(lastOne)) {
      words.pop();
      continue;
    }
    break;
  }

  name = words.join(' ').trim();
  return name;
}

function heuristicExtractFromText(text, guessedOrgName) {
  const result = {
    organizationName: guessedOrgName || '',
    uboCertificateNumber: '',
    dateOfIssue: '',
    registeredAddress: '',
    tradeLicenceNumber: '',
    jurisdiction: '',
    parentHoldings: [],
  };

  if (!text || typeof text !== 'string') {
    return result;
  }

  const lines = text.split(/\r?\n/);

  // Certificate / reference number (e.g. "Certificate Reference No", "UBO Certificate No").
  // First, try to capture value on the same line; if not present, use the next
  // non-empty line as the value.
  let certificateNumber = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const labelRegex = /(?:UBO\s*Certificate|Certificate\s*Reference|Certificate)\s*(?:Ref(?:erence)?\s*)?(?:No\.?|Number)?\s*[:\-]?\s*(.*)$/i;
    const m = line.match(labelRegex);
    if (!m) continue;
    const inline = m[1]?.trim() || '';
    if (inline) {
      certificateNumber = inline;
      break;
    }
    // If nothing after the label on the same line, look at the next non-empty line.
    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      certificateNumber = nextLine;
      break;
    }
    if (certificateNumber) break;
  }
  if (certificateNumber) {
    result.uboCertificateNumber = cleanCertificateNumber(certificateNumber);
  }

  // Date of issue
  const doiMatch = text.match(/Date of Issue\s*[:\-]?\s*([^\n\r]+)/i);
  if (doiMatch && doiMatch[1]) {
    result.dateOfIssue = doiMatch[1].trim();
  }

  // Registered address
  const addrMatch = text.match(/Registered Address\s*[:\-]?\s*([^\n\r]+)/i);
  if (addrMatch && addrMatch[1]) {
    result.registeredAddress = addrMatch[1].trim();
  }

  // Trade licence number (capture full token or rest of line after label)
  const tradeMatch =
    text.match(/(?:Trade\s+Licence|Trade\s+License)\s*(?:Number|No\.?)?\s*[:\-]?\s*([^\n\r]+)/i) ||
    text.match(/(?:Licence\s+No\.?|License\s+No\.?)\s*[:\-]?\s*([^\n\r]+)/i);
  if (tradeMatch && tradeMatch[1]) {
    result.tradeLicenceNumber = tradeMatch[1].trim();
  }

  // Jurisdiction
  const jurisMatch = text.match(/(?:Jurisdiction|Place of Incorporation)\s*[:\-]?\s*([^\n\r]+)/i);
  if (jurisMatch && jurisMatch[1]) {
    result.jurisdiction = jurisMatch[1].trim();
  }

  // Heuristic parent holdings: lines that include a % and some text.
  const parentHoldings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    if (!/%/.test(line)) continue;
    if (!/[A-Za-z]/.test(line)) continue;
    const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!pctMatch) continue;
    const ownershipPercent = `${pctMatch[1]}%`;

    // Use text before the percentage as the "name" heuristic, then clean it so
    // trailing jurisdiction markers are not included in the entity name.
    const rawNamePart = line.slice(0, pctMatch.index).trim();
    const namePart = cleanParentEntityName(rawNamePart);
    if (!namePart) continue;

    // Try to heuristically capture a registration number either on the same
    // line or the immediate next line.
    let registrationNumber = '';

    // Same-line patterns like "Reg. No 12345", "Registration Number: 12345", etc.
    const sameLineRegMatch =
      line.match(/Reg(?:istration)?(?:\s+No\.?|\s+Number)?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i) ||
      line.match(/CR\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i);
    if (sameLineRegMatch && sameLineRegMatch[1]) {
      registrationNumber = sameLineRegMatch[1].trim();
    }

    // If not found, look at the tail after the percentage for an ID-like token.
    if (!registrationNumber) {
      const tail = line.slice(pctMatch.index + pctMatch[0].length).trim();
      const idLikeMatch = tail.match(/([A-Za-z0-9]{4,}[-\/]?[A-Za-z0-9]*)/);
      if (idLikeMatch && idLikeMatch[1]) {
        registrationNumber = idLikeMatch[1].trim();
      }
    }

    // If still not found, peek at the next line for registration clues.
    if (!registrationNumber && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextRegMatch =
        nextLine.match(/Reg(?:istration)?(?:\s+No\.?|\s+Number)?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i) ||
        nextLine.match(/CR\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i);
      if (nextRegMatch && nextRegMatch[1]) {
        registrationNumber = nextRegMatch[1].trim();
      }
    }
    parentHoldings.push({
      name: namePart,
      ownershipPercent,
      registrationNumber,
      relationshipType: '',
    });
  }

  if (parentHoldings.length) {
    result.parentHoldings = parentHoldings;
  }

  return result;
}

/**
 * Given a document buffer (image/PDF/DOCX/text), extract organization name and certificate
 * details. Uses LLM when configured; otherwise falls back to simple text heuristics.
 * Returns a JSON object (e.g. { organizationName, uboCertificateNumber, ..., parentHoldings })
 * or null when nothing can be determined.
 */
async function extractOrganizationNameFromBuffer(buffer, contentType) {
  const mime = (contentType || 'application/octet-stream').toLowerCase();
  const isImage = /^image\//.test(mime);
  const hasLlm = isLlmConfigured();
  const promptIntro = [
    'You are given the full text of a UBO / shareholding / corporate registry document.',
    'Your task is to extract ALL Ultimate Beneficial Owner / shareholder entities and certificate details.',
    '',
    'CRITICAL JSON RULES (follow exactly):',
    '- Return a SINGLE JSON object. No comments, no trailing commas, no extra text before or after the JSON.',
    '- Use double quotes for all keys and string values.',
    '- Use empty string "" when you cannot find a value.',
    '',
    'The JSON MUST have these top-level keys:',
    '"organizationName": string        // Entity / company name taken from the MAIN title or heading of the document.',
    '"uboCertificateNumber": string    // Value from any "Certificate Reference No", "Certificate Ref No", "UBO Certificate No/Number" label.',
    '"dateOfIssue": string             // Date of issue as written in the document.',
    '"registeredAddress": string       // Registered address of the entity.',
    '"tradeLicenceNumber": string      // Trade licence or similar registration/license number.',
    '"jurisdiction": string            // Jurisdiction (e.g. DIFC, ADGM, Mainland UAE, KSA).',
    '"parentHoldings": [               // ALL parent/shareholder entities appearing in the document.',
    '  {',
    '    "name": string,               // Entity / Parent / Full Name taken from the "Entity Name" or "Full Name" column for this row only (do NOT append jurisdiction).',
    '    "ownershipPercent": string,   // Exact percentage (e.g. "40%", "40.0"). Do NOT round or drop the percent sign.',
    '    "registrationNumber": string, // Registration or licence number for this parent entity, if shown.',
    '    "relationshipType": string,   // "corporate" if the owner is a company, "member" if an individual, or "" if unclear.',
    '',
    '    // Optional corporate-specific fields (sourced from the "Entity Name" / corporate details column):',
    '    "corporateName": string,',
    '    "corporateJurisdictionOfIncorporation": string,',
    '    "corporateRegisteredAddress": string,',
    '    "corporateRegistrationNumber": string,',
    '',
    '    // Optional individual-specific fields (for relationshipType = "member", from "Full Name" and ID sections):',
    '    "individualFullName": string,',
    '    "individualNationality": string,',
    '    "individualDateOfBirth": string,',
    '    "individualPlaceOfBirth": string,',
    '    "individualIdType": string,',
    '    "individualIdNumber": string',
    '  }',
    ']',
    '',
    'VERY IMPORTANT:',
    '- If the document lists MULTIPLE entities in any table (e.g. "Entity Name", "Shareholder", "Full Name"), include EVERY such entity as a separate object in "parentHoldings".',
    '- Do NOT collapse multiple entities into one object. One row / entity in the document = one object in "parentHoldings".',
  ].join(' ');

  try {
    // 1) Image branch: use vision when LLM is configured.
    if (isImage && hasLlm) {
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;
      const completion = await createChatCompletion({
        messages: [
          { role: 'system', content: 'You extract organization names from document titles. Reply only with valid JSON.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptIntro },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        maxTokens: 400,
        responseFormat: 'json',
      });
      const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
      const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // fall through to heuristic below
      }
    }

    // 2) Non-image (or LLM unavailable / failed): use text extraction + optional LLM + heuristic.
    const rawText = await extractTextFromBuffer(buffer, mime);
    if (!rawText || !rawText.trim()) return null;
    const snippet = rawText.slice(0, 8000);

    let extracted = null;

    // 2a) Try structured extraction via LLM when available.
    if (hasLlm) {
      try {
        const completion = await createChatCompletion({
          messages: [
            { role: 'system', content: 'You extract organization names from document titles. Reply only with valid JSON.' },
            {
              role: 'user',
              content: `${promptIntro}\n\nDocument content (may be truncated):\n${snippet}`,
            },
          ],
          maxTokens: 400,
          responseFormat: 'json',
        });
        const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
        const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
        extracted = JSON.parse(jsonStr);
      } catch {
        extracted = null;
      }
    }

    // 2b) Ensure organizationName is populated from either LLM or heuristic.
    const fromModel =
      extracted && typeof extracted.organizationName === 'string'
        ? extracted.organizationName.trim()
        : '';
    const guessed = fromModel || guessOrganizationNameFromText(snippet);

    // If LLM gave nothing usable, fall back entirely to heuristics on the text.
    if (!extracted || typeof extracted !== 'object') {
      if (!guessed && !snippet) return null;
      return heuristicExtractFromText(snippet || rawText, guessed);
    }

    // Merge: heuristic baseline + model output, with model taking precedence,
    // but always ensure organizationName is populated from model or heuristic.
    const baseline = heuristicExtractFromText(snippet || rawText, guessed);
    const merged = {
      ...baseline,
      ...extracted,
      organizationName: guessed || extracted.organizationName || baseline.organizationName || '',
    };

    // Prefer the heuristic "Certificate Reference No" value for the
    // UBO Certificate Number when the model's value looks generic or
    // clearly wrong (e.g. just "certificate" or contains no real id).
    if (baseline.uboCertificateNumber) {
      const fromModel = (extracted && extracted.uboCertificateNumber) ? String(extracted.uboCertificateNumber).trim() : '';
      const looksGeneric =
        !fromModel ||
        /^certificate\s*$/i.test(fromModel) ||
        /^ubo\s*certificate\s*$/i.test(fromModel) ||
        !/[A-Za-z0-9]/.test(fromModel.replace(/certificate|ref(erence)?|number|no\.?/gi, ''));
      if (looksGeneric) {
        merged.uboCertificateNumber = baseline.uboCertificateNumber;
      }
    }

    // Always normalise the final uboCertificateNumber so that only the actual
    // reference/id value remains (without the "Certificate Reference No:" text).
    merged.uboCertificateNumber = cleanCertificateNumber(merged.uboCertificateNumber);

    // Normalise and rebuild parent holding names so that the "Parent Holding Name"
    // column shows only the legal entity / person name, NOT the jurisdiction or
    // concatenated labels. Prefer dedicated fields (corporateName / individualFullName)
    // over the generic `name` field that the model may build by concatenation.
    if (Array.isArray(merged.parentHoldings)) {
      merged.parentHoldings = merged.parentHoldings.map((ph) => {
        const rawEntityName =
          ph?.corporateName ||
          ph?.individualFullName ||
          ph?.fullName ||
          ph?.name ||
          '';
        const cleanedName = cleanParentEntityName(rawEntityName);
        return {
          ...ph,
          name: cleanedName,
        };
      });
    }

    return merged;
  } catch {
    return null;
  }
}

/**
 * Fetch a remote document by URL and ask the model to extract the organization name
 * from the title/header. Returns a JSON object (e.g. { organizationName: '...' }) or null.
 */
async function extractOrganizationNameFromLink(url) {
  if (!isLlmConfigured()) return null;
  if (!url || typeof url !== 'string') return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return await extractOrganizationNameFromBuffer(buffer, contentType);
  } catch (e) {
    console.error('Org name extract (link) error:', e.message);
    return null;
  }
}

export const uboRouter = Router();

uboRouter.post('/extract', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { buffer, mimetype } = req.file;
    const extracted = await extractUboFromImage(buffer, mimetype);
    const defaults = {
      fullName: '',
      nationality: '',
      dateOfBirth: '',
      placeOfBirth: '',
      idType: '',
      idNumber: '',
      idCountryOfIssue: '',
      idExpiry: '',
      address: '',
      countryOfResidence: '',
      percentageOwnership: '',
      natureOfControl: '',
      dateBecameBeneficialOwner: '',
    };
    if (extracted && typeof extracted === 'object') {
      Object.keys(defaults).forEach((k) => {
        if (extracted[k] !== undefined && extracted[k] !== null) defaults[k] = String(extracted[k]);
      });
    }
    res.json({
      extracted: defaults,
      fromDocument: !!extracted,
      message: extracted
        ? 'Details extracted from document. Review and edit as needed.'
        : 'Document received. Configure OPENAI_API_KEY for auto-extraction from images, or enter details manually.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});

/**
 * POST /api/ubo/extract-org-from-link
 * Body: { url }
 * Fetches the remote document and extracts the organization name from the title/header.
 */
uboRouter.post('/extract-org-from-link', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'url is required' });
    }
    const extracted = await extractOrganizationNameFromLink(url.trim());
    const organizationName =
      extracted && typeof extracted.organizationName === 'string'
        ? extracted.organizationName.trim()
        : '';

    const parentHoldings = Array.isArray(extracted?.parentHoldings) ? extracted.parentHoldings : [];
    res.json({
      organizationName,
      certificate: {
        uboCertificateNumber: extracted?.uboCertificateNumber || '',
        dateOfIssue: extracted?.dateOfIssue || '',
        registeredAddress: extracted?.registeredAddress || '',
        tradeLicenceNumber: extracted?.tradeLicenceNumber || '',
        jurisdiction: extracted?.jurisdiction || '',
      },
      parentHoldings,
      fromDocument: !!organizationName,
      message: organizationName
        ? 'Organization name extracted from document title.'
        : 'Could not confidently extract organization name from document.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});

/**
 * POST /api/ubo/extract-org-from-file
 * Multipart: file
 * Extracts the organization name from an uploaded document.
 */
uboRouter.post('/extract-org-from-file', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { buffer, mimetype } = req.file;
    const extracted = await extractOrganizationNameFromBuffer(buffer, mimetype || 'application/octet-stream');
    const organizationName =
      extracted && typeof extracted.organizationName === 'string'
        ? extracted.organizationName.trim()
        : '';

    const parentHoldings = Array.isArray(extracted?.parentHoldings) ? extracted.parentHoldings : [];
    res.json({
      organizationName,
      certificate: {
        uboCertificateNumber: extracted?.uboCertificateNumber || '',
        dateOfIssue: extracted?.dateOfIssue || '',
        registeredAddress: extracted?.registeredAddress || '',
        tradeLicenceNumber: extracted?.tradeLicenceNumber || '',
        jurisdiction: extracted?.jurisdiction || '',
      },
      parentHoldings,
      fromDocument: !!organizationName,
      message: organizationName
        ? 'Organization name extracted from document title.'
        : 'Could not confidently extract organization name from document.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});
