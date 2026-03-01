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

/** True if the value looks like a certificate reference (e.g. DF-UBO-2026-003) rather than an entity name. */
function looksLikeCertificateReference(value) {
  if (!value || typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  if (/DF-UBO-\d{4}-\d{3}/i.test(s)) return true;
  if (/\d{4,}/.test(s) && s.length <= 80) return true;
  if (/\d/.test(s) && s.length <= 50 && !/\s{2,}/.test(s)) return true;
  return false;
}

/** True if certValue is the same as or clearly the organization name (avoid leaking org name into cert number). */
function isSameAsOrganizationName(certValue, orgName) {
  if (!certValue || typeof certValue !== 'string') return false;
  const c = certValue.trim().toLowerCase();
  const o = (orgName && typeof orgName === 'string') ? orgName.trim().toLowerCase() : '';
  if (!o) return false;
  if (c === o) return true;
  if (c.length > 20 && (o.includes(c) || c.includes(o))) return true;
  return false;
}

/** Detect if the document has a Passport column header (e.g. "Passport No", "Passport Number"). */
function detectPassportHeaderFromText(text) {
  if (!text || typeof text !== 'string') return false;
  const upper = text.toUpperCase();
  return /PASSPORT\s*(NO|NUMBER)?/.test(upper);
}

/**
 * Known nationality/country tokens (adjectives and country names) that may be wrongly appended
 * to Full Name by the LLM. Used to strip them from individualFullName and recover for individualNationality.
 */
const NATIONALITY_COUNTRY_TOKENS = new Set([
  'british', 'emirati', 'indian', 'american', 'uae', 'uk', 'usa', 'saudi', 'qatari', 'bahraini',
  'omani', 'kuwaiti', 'pakistani', 'egyptian', 'jordanian', 'lebanese', 'canadian', 'australian',
  'german', 'french', 'spanish', 'italian', 'dutch', 'swiss', 'irish', 'scottish', 'welsh',
  'chinese', 'japanese', 'korean', 'singaporean', 'malaysian', 'indonesian', 'filipino', 'thai',
  'vietnamese', 'russian', 'turkish', 'african', 'nigerian', 'kenyan', 'moroccan', 'tunisian',
  'algerian', 'syrian', 'iraqi', 'iranian', 'israeli', 'palestinian', 'arabian',
  'south african', 'new zealand', 'united kingdom',
]);

/**
 * If the last word(s) of name look like a nationality/country, strip them and return
 * { cleanedName, trailingNationality }. Use this to fix LLM appending Nationality to Full Name.
 */
function stripTrailingNationalityFromName(name) {
  if (!name || typeof name !== 'string') return { cleanedName: (name || '').trim(), trailingNationality: '' };
  const trimmed = name.trim();
  if (!trimmed) return { cleanedName: '', trailingNationality: '' };
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (!words.length) return { cleanedName: trimmed, trailingNationality: '' };
  const normalise = (w) => (w || '').toLowerCase().replace(/[^\w]/g, '');
  let trailing = [];
  while (words.length) {
    const last = normalise(words[words.length - 1]);
    const lastTwo = words.length >= 2 ? normalise(words.slice(-2).join(' ')) : '';
    if (last && NATIONALITY_COUNTRY_TOKENS.has(last)) {
      trailing.unshift(words.pop());
      continue;
    }
    if (words.length >= 2 && NATIONALITY_COUNTRY_TOKENS.has(lastTwo)) {
      trailing.unshift(words.pop());
      trailing.unshift(words.pop());
      continue;
    }
    break;
  }
  const cleanedName = words.join(' ').trim();
  const trailingNationality = trailing.join(' ').trim();
  return { cleanedName, trailingNationality };
}

/**
 * Return true if nationalityValue looks like it was mistakenly taken from the person's name
 * (e.g. last name) rather than from the Nationality column. Clear such values so heuristic or "" is used.
 */
function nationalityLooksLikeNamePart(nationalityValue, fullName) {
  if (!nationalityValue || typeof nationalityValue !== 'string') return false;
  const n = nationalityValue.trim();
  if (!n) return false;
  const f = (fullName && typeof fullName === 'string') ? fullName.trim() : '';
  if (!f) return false;
  const nLower = n.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const fNorm = f.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
  const nameWords = fNorm.split(/\s+/).filter(Boolean);
  if (!nameWords.length) return false;
  if (nLower === fNorm.trim()) return true;
  if (nLower === nameWords[nameWords.length - 1]) return true;
  if (nameWords.length >= 1 && nLower === nameWords[0]) return true;
  if (nameWords.includes(nLower)) return true;
  if (nLower.length >= 2 && nameWords.some((w) => w.includes(nLower) || nLower.includes(w))) return true;
  return false;
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
  // Only set when we find the label and a value that looks like a reference (not the organization name).
  let certificateNumber = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const labelRegex = /(?:UBO\s*Certificate|Certificate\s*Reference|Certificate)\s*(?:Ref(?:erence)?\s*)?(?:No\.?|Number)?\s*[:\-]?\s*(.*)$/i;
    const m = line.match(labelRegex);
    if (!m) continue;
    const inline = m[1]?.trim() || '';
    if (inline) {
      if (!isSameAsOrganizationName(inline, guessedOrgName) && (looksLikeCertificateReference(inline) || inline.length <= 60)) {
        certificateNumber = inline;
      }
      break;
    }
    // If nothing after the label on the same line, use next non-empty line only if it looks like a reference.
    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (looksLikeCertificateReference(nextLine) && !isSameAsOrganizationName(nextLine, guessedOrgName)) {
        certificateNumber = nextLine;
      }
      break;
    }
    if (certificateNumber) break;
  }
  if (certificateNumber && !isSameAsOrganizationName(certificateNumber, guessedOrgName)) {
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
 * Detect whether the document table uses "Entity Name" (corporate) or "Full Name" (member) header.
 * Returns "corporate", "member", or "".
 */
function detectParentRelationshipTypeFromHeaders(text) {
  if (!text || typeof text !== 'string') return '';
  const upper = text.toUpperCase();
  const hasEntityName = /ENTITY\s+NAME/.test(upper);
  const hasFullName = /FULL\s+NAME/.test(upper);
  if (hasEntityName && !hasFullName) return 'corporate';
  if (hasFullName && !hasEntityName) return 'member';
  return '';
}

/**
 * Heuristic: parse a member-style table from text (Full Name, Nationality, Passport No columns)
 * and return an array of { fullName, nationality, idNumber, idType }.
 * Parses row-by-row so each row's full name, nationality and ID stay aligned (full name can span multiple words).
 */
function heuristicExtractMemberTable(text) {
  const rows = [];
  if (!text || typeof text !== 'string') return rows;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const u = line.toUpperCase();
    if (/FULL\s+NAME/.test(u) && (/NATIONALITY|PASSPORT|ID\s*(NO|NUMBER|TYPE)/.test(u) || line.length > 15)) {
      headerLineIndex = i;
      break;
    }
  }
  if (headerLineIndex < 0) return rows;
  const headerLine = lines[headerLineIndex];
  const sep = headerLine.includes('\t') ? '\t' : (headerLine.match(/\s{2,}/) ? /\s{2,}/ : /\s+/);
  const headers = headerLine.split(sep).map((h) => h.trim().toUpperCase());
  const numCols = headers.length;
  const idxFullName = headers.findIndex((h) => /FULL\s+NAME/.test(h));
  const idxNationality = headers.findIndex((h) => /NATIONALITY/.test(h));
  const idxPassport = headers.findIndex((h) => /PASSPORT\s*(NO|NUMBER)?/.test(h) || /ID\s*NO/.test(h) || /ID\s*NUMBER/.test(h));
  const hasMemberCols = idxFullName >= 0 || idxPassport >= 0;
  if (!hasMemberCols) return rows;
  const hasPassportHeader = headers.some((h) => /PASSPORT/.test(h));
  // Order of non-fullName columns by index so we can assign trailing tokens per row
  const otherColIndices = [...Array(numCols).keys()].filter((j) => j !== idxFullName).sort((a, b) => a - b);

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 2) continue;
    if (line.toUpperCase().startsWith('CERTIFICATE') || /^\d+\s*%/.test(line)) break;

    let cells = line.split(sep).map((c) => (c || '').trim());
    // When there are more tokens than columns, the full name column spans multiple words: keep row alignment per row.
    if (idxFullName >= 0 && cells.length > numCols) {
      const numTrailing = numCols - 1;
      const fullNameTokens = cells.slice(0, cells.length - numTrailing);
      const trailing = cells.slice(cells.length - numTrailing);
      cells = [];
      for (let c = 0; c < numCols; c++) {
        if (c === idxFullName) {
          cells[c] = fullNameTokens.join(' ').trim();
        } else {
          const pos = otherColIndices.indexOf(c);
          cells[c] = trailing[pos] !== undefined ? trailing[pos] : '';
        }
      }
    }

    const fullName = idxFullName >= 0 && cells[idxFullName] !== undefined ? cells[idxFullName] : '';
    const nationality = idxNationality >= 0 && cells[idxNationality] !== undefined ? cells[idxNationality] : '';
    const idNumber = idxPassport >= 0 && cells[idxPassport] !== undefined ? cells[idxPassport] : '';
    if (!fullName && !idNumber) continue;
    rows.push({
      fullName,
      nationality,
      idNumber,
      idType: hasPassportHeader ? 'Passport' : '',
    });
  }
  return rows;
}

/**
 * Heuristic: parse a corporate-style table (Entity Name, Jurisdiction of Incorporation, Registered Address, etc.)
 * and return an array of { entityName, jurisdictionOfIncorporation, registeredAddress, registrationNumber }.
 * Row-based so each row's entity name and other columns stay aligned.
 */
function heuristicExtractCorporateTable(text) {
  const rows = [];
  if (!text || typeof text !== 'string') return rows;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const u = line.toUpperCase();
    if (/ENTITY\s+NAME/.test(u) && (/JURISDICTION|REGISTERED\s+ADDRESS|INCORPORATION/.test(u) || line.length > 20)) {
      headerLineIndex = i;
      break;
    }
  }
  if (headerLineIndex < 0) return rows;
  const headerLine = lines[headerLineIndex];
  const sep = headerLine.includes('\t') ? '\t' : (headerLine.match(/\s{2,}/) ? /\s{2,}/ : /\s+/);
  const headers = headerLine.split(sep).map((h) => h.trim().toUpperCase());
  const numCols = headers.length;
  const idxEntityName = headers.findIndex((h) => /ENTITY\s+NAME/.test(h) || /SHAREHOLDER\s+NAME/.test(h));
  const idxJurisdiction = headers.findIndex((h) => /JURISDICTION/.test(h) || /INCORPORATION|PLACE\s+OF\s+INCORPORATION|COUNTRY\s+OF\s+INCORPORATION/.test(h));
  const idxRegisteredAddress = headers.findIndex((h) => /REGISTERED\s+ADDRESS|REGISTERED\s+OFFICE|OFFICE\s+ADDRESS|ADDRESS|BUSINESS\s+ADDRESS/.test(h));
  const idxRegistrationNumber = headers.findIndex((h) => /REG(?:ISTRATION)?\s*(?:NO|NUMBER)?/.test(h) || /CR\s*NO/.test(h));
  if (idxEntityName < 0) return rows;
  const otherColIndices = [...Array(numCols).keys()].filter((j) => j !== idxEntityName).sort((a, b) => a - b);

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 2) continue;
    if (line.toUpperCase().startsWith('CERTIFICATE') || /^\d+\s*%/.test(line)) break;

    let cells = line.split(sep).map((c) => (c || '').trim());
    if (idxEntityName >= 0 && cells.length > numCols) {
      const numTrailing = numCols - 1;
      const entityNameTokens = cells.slice(0, cells.length - numTrailing);
      const trailing = cells.slice(cells.length - numTrailing);
      cells = [];
      for (let c = 0; c < numCols; c++) {
        if (c === idxEntityName) {
          cells[c] = entityNameTokens.join(' ').trim();
        } else {
          const pos = otherColIndices.indexOf(c);
          cells[c] = trailing[pos] !== undefined ? trailing[pos] : '';
        }
      }
    }

    const entityName = idxEntityName >= 0 && cells[idxEntityName] !== undefined ? cells[idxEntityName] : '';
    const jurisdictionOfIncorporation = idxJurisdiction >= 0 && cells[idxJurisdiction] !== undefined ? cells[idxJurisdiction] : '';
    const registeredAddress = idxRegisteredAddress >= 0 && cells[idxRegisteredAddress] !== undefined ? cells[idxRegisteredAddress] : '';
    const registrationNumber = idxRegistrationNumber >= 0 && cells[idxRegistrationNumber] !== undefined ? cells[idxRegistrationNumber] : '';
    if (!entityName) continue;
    rows.push({
      entityName,
      jurisdictionOfIncorporation,
      registeredAddress,
      registrationNumber,
    });
  }
  return rows;
}

/** Normalise for matching: lowercase, collapse spaces, trim. */
function normaliseForMatch(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * True if two names likely refer to the same person (exact match, or one contains the other, or same last name + first name overlap).
 */
function namesLikelyMatch(a, b) {
  const an = normaliseForMatch(a);
  const bn = normaliseForMatch(b);
  if (!an || !bn) return false;
  if (an === bn) return true;
  if (an.includes(bn) || bn.includes(an)) return true;
  const aWords = an.split(/\s+/).filter(Boolean);
  const bWords = bn.split(/\s+/).filter(Boolean);
  const lastA = aWords[aWords.length - 1];
  const lastB = bWords[bWords.length - 1];
  if (lastA && lastB && lastA === lastB && aWords.some((w) => bWords.includes(w))) return true;
  return false;
}

/**
 * Find the best heuristic row for this holding: by index, then by fullName or idNumber match
 * so we get the correct Nationality from the document even when row order differs.
 * Uses fuzzy name matching so small variations (e.g. "Sara Khan" vs "Sara Ahmed Khan") still match.
 */
function findHeuristicRowForHolding(ph, heuristicMemberRows, memberRowIndex) {
  const byIndex = heuristicMemberRows[memberRowIndex];
  const holdingName = ph?.individualFullName || ph?.fullName || ph?.name || '';
  const nameNorm = normaliseForMatch(holdingName);
  const idNorm = normaliseForMatch(ph?.individualIdNumber || ph?.idNumber || ph?.passportNumber || ph?.passportNo || '');
  if (byIndex && (byIndex.nationality || !nameNorm)) return byIndex;
  if (!nameNorm && !idNorm) return byIndex || null;
  for (let i = 0; i < heuristicMemberRows.length; i++) {
    const hr = heuristicMemberRows[i];
    if (!hr) continue;
    if (idNorm && normaliseForMatch(hr.idNumber) === idNorm) return hr;
    if (nameNorm && (normaliseForMatch(hr.fullName) === nameNorm || namesLikelyMatch(holdingName, hr.fullName))) return hr;
  }
  return byIndex || null;
}

/**
 * Normalise parentHoldings: strip nationality from full name, reject nationality when it's a name part,
 * enrich from heuristic table when provided. Uses index and name/ID match so nationality from the
 * document is never dropped when the document has a Nationality column and a value for that person.
 */
function normalizeParentHoldings(parentHoldings, options = {}) {
  const {
    heuristicMemberRows = [],
    heuristicCorporateRows = [],
    headerRelationshipType = '',
    hasPassportHeader = false,
  } = options;
  if (!Array.isArray(parentHoldings)) return parentHoldings;
  let memberRowIndex = 0;
  let corporateRowIndex = 0;
  return parentHoldings.map((ph) => {
    const relationshipType = ph?.relationshipType || ph?.type || headerRelationshipType || '';
    const rawEntityName =
      ph?.corporateName ||
      ph?.individualFullName ||
      ph?.fullName ||
      ph?.name ||
      '';
    const cleanedName = cleanParentEntityName(rawEntityName);

    let individualFullName =
      ph?.individualFullName || ph?.fullName || ph?.name || '';
    if (!individualFullName && relationshipType === 'member') {
      individualFullName = cleanedName;
    }
    let individualNationality =
      ph?.individualNationality || ph?.nationality || '';

    // Fix 1: Strip any nationality/country token wrongly appended to Full Name (e.g. "John Carter British" -> "John Carter").
    if (relationshipType === 'member' && individualFullName) {
      const { cleanedName: nameOnly, trailingNationality: recoveredNationality } = stripTrailingNationalityFromName(individualFullName);
      individualFullName = nameOnly || individualFullName;
      if (recoveredNationality && (!individualNationality || nationalityLooksLikeNamePart(individualNationality, nameOnly))) {
        individualNationality = recoveredNationality;
      }
    }

    // Fix 2: Reject nationality when it is actually the last/first name (e.g. "Carter" from Full Name).
    const nationalityIsNamePart = individualNationality && nationalityLooksLikeNamePart(individualNationality, individualFullName);
    if (nationalityIsNamePart) {
      individualNationality = '';
    }

    let individualIdNumber =
      ph?.individualIdNumber ||
      ph?.idNumber ||
      ph?.passportNumber ||
      ph?.passportNo ||
      ph?.PassportNumber ||
      (typeof ph?.passport_number === 'string' ? ph.passport_number : '') ||
      '';
    if (individualIdNumber && typeof individualIdNumber !== 'string') {
      individualIdNumber = String(individualIdNumber).trim();
    } else {
      individualIdNumber = (individualIdNumber || '').trim();
    }

    let individualIdType =
      (ph?.individualIdType || ph?.idType || '').trim();
    if (!individualIdType && relationshipType === 'member' && hasPassportHeader) {
      individualIdType = 'Passport';
    }

    // Enrich from heuristic table: use row matched by index or by name/ID so we get the right Nationality from the document.
    // Only leave individualNationality blank when the document has no Nationality column or that cell was blank.
    if (relationshipType === 'member') {
      const hr = findHeuristicRowForHolding(
        { ...ph, individualFullName, individualIdNumber },
        heuristicMemberRows,
        memberRowIndex,
      );
      if (hr) {
        if (hr.fullName && !individualFullName) individualFullName = hr.fullName;
        const heuristicNat = (hr.nationality || '').trim();
        // Use document nationality only when present and not a name part (e.g. never use "Khan" as nationality).
        if (heuristicNat && !nationalityLooksLikeNamePart(heuristicNat, individualFullName || hr.fullName)) {
          if (!individualNationality || nationalityIsNamePart) individualNationality = heuristicNat;
        }
        if (hr.idNumber && !individualIdNumber) individualIdNumber = (hr.idNumber || '').trim();
        if (hr.idType && !individualIdType) individualIdType = (hr.idType || '').trim();
      }
      memberRowIndex += 1;
    }

    // Enrich corporate holdings from heuristic table (Entity Name, Jurisdiction of Incorporation, Registered Address).
    let corporateName = (ph?.corporateName || ph?.name || '').trim();
    let corporateJurisdictionOfIncorporation = (ph?.corporateJurisdictionOfIncorporation || '').trim();
    let corporateRegisteredAddress = (ph?.corporateRegisteredAddress || '').trim();
    let corporateRegistrationNumber = (ph?.corporateRegistrationNumber || ph?.registrationNumber || '').trim();
    if (relationshipType === 'corporate') {
      const cr = heuristicCorporateRows[corporateRowIndex] || heuristicCorporateRows.find(
        (r) => normaliseForMatch(r.entityName) === normaliseForMatch(corporateName || rawEntityName) ||
          (ph?.registrationNumber && normaliseForMatch(r.registrationNumber) === normaliseForMatch(ph.registrationNumber))
      );
      if (cr) {
        if ((cr.entityName || '').trim() && !corporateName) corporateName = (cr.entityName || '').trim();
        if ((cr.jurisdictionOfIncorporation || '').trim()) corporateJurisdictionOfIncorporation = (cr.jurisdictionOfIncorporation || '').trim();
        if ((cr.registeredAddress || '').trim()) corporateRegisteredAddress = (cr.registeredAddress || '').trim();
        if ((cr.registrationNumber || '').trim() && !corporateRegistrationNumber) corporateRegistrationNumber = (cr.registrationNumber || '').trim();
      }
      // Do NOT use certificate.jurisdiction or certificate.registeredAddress here; only table columns "Jurisdiction of Incorporation" and "Registered Address" per row.
      corporateRowIndex += 1;
    }

    const displayName = relationshipType === 'member' && (individualFullName || '').trim()
      ? (individualFullName || '').trim()
      : (relationshipType === 'corporate' && corporateName ? corporateName : cleanedName);
    return {
      ...ph,
      name: displayName,
      relationshipType,
      individualFullName: (individualFullName || '').trim(),
      individualNationality: (individualNationality || '').trim(),
      individualIdType: (individualIdType || '').trim(),
      individualIdNumber: (individualIdNumber || '').trim(),
      corporateName: corporateName || (relationshipType === 'corporate' ? (ph?.name || '').trim() : ''),
      corporateJurisdictionOfIncorporation,
      corporateRegisteredAddress,
      corporateRegistrationNumber,
    };
  });
}

/**
 * Use the LLM to resolve nationality values to full country-of-origin names.
 * Handles both abbreviations (e.g. UAE, UK, USA, KSA) and adjectives (e.g. British, American, Emirati).
 * Returns a Map of input term -> full country name. Empty Map if LLM unavailable or on error.
 */
async function resolveNationalitiesToCountries(nationalityValues) {
  const map = new Map();
  const unique = [...new Set((nationalityValues || []).map((v) => String(v).trim()).filter(Boolean))];
  if (!unique.length || !isLlmConfigured()) return map;

  const prompt = `You are given a list of values from a "Nationality" column in a document. Each value may be:
1) A country abbreviation (e.g. UK, UAE, USA, KSA, AE, GB, IN, SA) – expand it to the official full country name.
2) A nationality adjective (e.g. British, American, Emirati, Indian, Saudi) – convert it to the official full country name (country of origin).
3) Already a full country name – use it unchanged as the value.

Your task: for each input term, determine the correct full country name. Examples:
- UK, GB, British -> United Kingdom
- USA, US, American -> United States of America
- UAE, AE, Emirati -> United Arab Emirates
- KSA, SA, Saudi -> Saudi Arabia
- IN, Indian -> India

Return ONLY a JSON object. Each key must be exactly one of the input terms below (same spelling and capitalisation as given). The value is the full country name. For unknown or ambiguous terms use empty string "".
Input terms (one per line):\n${unique.join('\n')}`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You expand country abbreviations and convert nationality adjectives to official full country names. Reply only with a valid JSON object, no other text.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 500,
      responseFormat: 'json',
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      const parsedKeysLower = Object.keys(parsed).reduce((acc, k) => {
        acc[k.trim().toLowerCase()] = parsed[k];
        return acc;
      }, {});
      for (const term of unique) {
        const v = parsed[term] ?? parsedKeysLower[term.toLowerCase()];
        if (v != null && String(v).trim()) map.set(term, String(v).trim());
      }
    }
  } catch (e) {
    console.error('resolveNationalitiesToCountries:', e.message);
  }
  return map;
}

/**
 * When corporate holdings have empty corporateJurisdictionOfIncorporation or corporateRegisteredAddress,
 * ask the LLM to extract from the document table columns "Jurisdiction of Incorporation" and "Registered Address"
 * for each entity name. documentSnippet: raw text from the uploaded document.
 */
async function fillMissingCorporateJurisdictionAndAddress(parentHoldings, documentSnippet) {
  if (!Array.isArray(parentHoldings) || !documentSnippet || !documentSnippet.trim() || !isLlmConfigured()) {
    return parentHoldings;
  }
  const needFill = parentHoldings.filter(
    (ph) => ph?.relationshipType === 'corporate' &&
      (!(ph?.corporateJurisdictionOfIncorporation || '').trim() || !(ph?.corporateRegisteredAddress || '').trim())
  );
  if (!needFill.length) return parentHoldings;
  const entityNames = needFill.map((ph) => (ph?.corporateName || ph?.name || '').trim()).filter(Boolean);
  if (!entityNames.length) return parentHoldings;

  const prompt = `Document content:\n${documentSnippet.slice(0, 7000)}\n\n---
The document contains a table with corporate/shareholder entities. You must:
1) Locate the column whose header is "Jurisdiction of Incorporation" (or "Jurisdiction", "Place of Incorporation", "Country of Incorporation").
2) Locate the column whose header is "Registered Address" (or "Registered Office", "Address").
3) For each entity name listed below, find the ROW that contains that entity and read the cell value from the "Jurisdiction of Incorporation" column and the cell value from the "Registered Address" column for that same row.

Return ONLY a JSON object. Each key is exactly one of the entity names below. The value is an object with two keys: "jurisdictionOfIncorporation" (string) and "registeredAddress" (string). Use "" for missing values.
Example: { "Evergreen Capital Group Ltd. Singapore": { "jurisdictionOfIncorporation": "Singapore", "registeredAddress": "123 Orchard Road, Singapore" } }

Entity names (one per line):\n${entityNames.join('\n')}`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You extract table data by column. Find the "Jurisdiction of Incorporation" column and "Registered Address" column in the document table. For each entity name, return that row\'s cell values for those two columns. Reply only with valid JSON: { "Entity Name": { "jurisdictionOfIncorporation": "...", "registeredAddress": "..." } }.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 600,
      responseFormat: 'json',
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return parentHoldings;

    const nameNormToResult = new Map();
    for (const [key, val] of Object.entries(parsed)) {
      if (!val || typeof val !== 'object') continue;
      const jur = (val.jurisdictionOfIncorporation ?? val.jurisdiction ?? '').trim();
      const addr = (val.registeredAddress ?? val.registered_address ?? val.address ?? '').trim();
      const k = (key || '').trim();
      if (k) nameNormToResult.set(k.toLowerCase(), { jurisdictionOfIncorporation: jur, registeredAddress: addr });
    }
    if (!nameNormToResult.size) return parentHoldings;

    return parentHoldings.map((ph) => {
      if (ph?.relationshipType !== 'corporate') return ph;
      const name = (ph?.corporateName || ph?.name || '').trim();
      if (!name) return ph;
      const nameLower = name.toLowerCase();
      let result = nameNormToResult.get(nameLower);
      if (!result && parsed[name]) result = { jurisdictionOfIncorporation: (parsed[name].jurisdictionOfIncorporation ?? parsed[name].jurisdiction ?? '').trim(), registeredAddress: (parsed[name].registeredAddress ?? parsed[name].registered_address ?? '').trim() };
      if (!result) {
        const key = Object.keys(parsed).find((k) => k.trim().toLowerCase() === nameLower || normaliseForMatch(k) === normaliseForMatch(name));
        if (key && parsed[key]) result = { jurisdictionOfIncorporation: (parsed[key].jurisdictionOfIncorporation ?? parsed[key].jurisdiction ?? '').trim(), registeredAddress: (parsed[key].registeredAddress ?? parsed[key].registered_address ?? '').trim() };
      }
      if (!result) return ph;
      const jur = (result.jurisdictionOfIncorporation || '').trim();
      const addr = (result.registeredAddress || '').trim();
      const updated = { ...ph };
      if (jur && !(ph?.corporateJurisdictionOfIncorporation || '').trim()) updated.corporateJurisdictionOfIncorporation = jur;
      if (addr && !(ph?.corporateRegisteredAddress || '').trim()) updated.corporateRegisteredAddress = addr;
      return updated;
    });
  } catch (e) {
    // LLM request failed (e.g. fetch failed, network unreachable, timeout). Continue without corporate jurisdiction/address.
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Corporate jurisdiction/address extraction skipped (LLM unavailable):', e.message || e);
    }
    return parentHoldings;
  }
}

/**
 * Replace individualNationality with full country-of-origin name using LLM mapping.
 * Modifies and returns the same array (with updated individualNationality where mapping exists).
 */
async function applyCountryOfOriginToParentHoldings(parentHoldings) {
  if (!Array.isArray(parentHoldings)) return parentHoldings;
  const nationalities = parentHoldings
    .map((ph) => (ph?.individualNationality || '').trim())
    .filter(Boolean);
  const mapping = await resolveNationalitiesToCountries(nationalities);
  if (!mapping.size) return parentHoldings;
  return parentHoldings.map((ph) => {
    const current = (ph?.individualNationality || '').trim();
    const country = current ? mapping.get(current) : '';
    if (!country) return ph;
    return { ...ph, individualNationality: country };
  });
}

/**
 * When some members still have empty individualNationality, ask the LLM to extract nationality
 * for those names from the document text. Used as fallback when heuristic table missed a row.
 * documentSnippet: raw text from the uploaded document (e.g. first 6000 chars).
 */
async function fillMissingNationalitiesFromDocument(parentHoldings, documentSnippet) {
  if (!Array.isArray(parentHoldings) || !documentSnippet || !documentSnippet.trim() || !isLlmConfigured()) {
    return parentHoldings;
  }
  const missing = parentHoldings.filter(
    (ph) => ph?.relationshipType === 'member' && !(ph?.individualNationality || '').trim()
  );
  if (!missing.length) return parentHoldings;
  const names = missing.map((ph) => (ph?.individualFullName || ph?.name || '').trim()).filter(Boolean);
  if (!names.length) return parentHoldings;
  const prompt = `Document excerpt:\n${documentSnippet.slice(0, 6000)}\n\nFor each of these persons, what is their nationality as stated in the document (e.g. British, Emirati, UAE, Indian)? Return ONLY a JSON object: each key is the person's full name exactly as written below, value is the nationality string from the document (or "" if not found).\nNames:\n${names.join('\n')}`;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You extract nationality from documents. Reply only with valid JSON: { "Full Name": "nationality" }.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 400,
      responseFormat: 'json',
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return parentHoldings;
    const nameToNationality = new Map();
    const nameLowerToNationality = new Map();
    for (const [key, val] of Object.entries(parsed)) {
      const k = (key || '').trim();
      if (val != null && String(val).trim()) {
        nameToNationality.set(k, String(val).trim());
        nameLowerToNationality.set(k.toLowerCase(), String(val).trim());
      }
    }
    if (!nameToNationality.size) return parentHoldings;
    return parentHoldings.map((ph) => {
      if ((ph?.individualNationality || '').trim()) return ph;
      const name = (ph?.individualFullName || ph?.name || '').trim();
      if (!name) return ph;
      const nat = nameToNationality.get(name) ?? nameLowerToNationality.get(name.toLowerCase());
      if (!nat) return ph;
      // Never set nationality to a name part (e.g. "Khan" from "Sara Ahmed Khan").
      if (nationalityLooksLikeNamePart(nat, name)) return ph;
      return { ...ph, individualNationality: nat };
    });
  } catch (e) {
    console.error('fillMissingNationalitiesFromDocument:', e.message);
    return parentHoldings;
  }
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
    '    // Optional individual-specific fields (for relationshipType = "member"). Use the column headers to pick the right cell:',
    '    "individualFullName": string,   // Value from the column headed "Full Name" only (proper noun / person name).',
    '    "individualNationality": string, // Value from the column headed "Nationality" only (country or adjective, e.g. UAE, British). Not from Full Name.',
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
    '',
    'COLUMN-BASED EXTRACTION FOR INDIVIDUAL/MEMBER ROWS:',
    '1) Identify the table in the document and locate the column headers separately:',
    '   - Find the column whose header is "Full Name" (or "Full name", "Name of beneficial owner", or equivalent).',
    '   - Find the column whose header is "Nationality" (or "Country of Nationality", "Citizenship", or equivalent).',
    '2) Extract values only from the correct column for each field:',
    '   - "individualFullName": use ONLY the cell value in the row that lies under the "Full Name" column. Do not take any value from the Nationality column.',
    '   - "individualNationality": use ONLY the cell value in the row that lies under the "Nationality" column. Do not take any value from the Full Name column.',
    '3) Use linguistic understanding to verify:',
    '   - Full Name column contains proper nouns (a person\'s name, e.g. "John Smith", "Ahmed Ali Hassan").',
    '   - Nationality column contains adjectives or country names (e.g. "British", "Emirati", "UAE", "Indian", "American").',
    '   - If you see a proper noun (person name), it belongs in individualFullName. If you see a country or nationality adjective, it belongs in individualNationality. This ensures the OpCo drawer shows the correct name and nationality for each row.',
    '4) Other member fields: "individualIdNumber" from the Passport/ID Number column; "individualIdType" as "Passport" or "National ID" based on the column header.',
    '',
    'COLUMN-BASED EXTRACTION FOR CORPORATE ROWS (when relationshipType = "corporate"):',
    '1) Locate the table that lists corporate entities. Identify the header row.',
    '2) Find the column whose header is exactly or very similar to "Jurisdiction of Incorporation" (or "Jurisdiction", "Place of Incorporation"). For each data row, the value in that column goes to "corporateJurisdictionOfIncorporation" for that row\'s entity.',
    '3) Find the column whose header is exactly or very similar to "Registered Address" (or "Registered Office", "Address"). For each data row, the value in that column goes to "corporateRegisteredAddress" for that row\'s entity.',
    '4) "corporateName" from the Entity Name column; "corporateRegistrationNumber"/"registrationNumber" from the Registration/CR column if present.',
    '5) One document row = one parentHoldings object. You MUST populate corporateJurisdictionOfIncorporation and corporateRegisteredAddress for every corporate entity by reading the cell in the same row under the "Jurisdiction of Incorporation" column and under the "Registered Address" column respectively.',
  ].join(' ');

  try {
    // 1) Image branch: use vision when LLM is configured.
    if (isImage && hasLlm) {
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;
      const completion = await createChatCompletion({
        messages: [
          { role: 'system', content: 'You extract UBO and shareholder data from documents. Reply only with valid JSON. For individual rows: (1) Locate the "Full Name" and "Nationality" columns; put values only from the correct column. (2) Never put a name in Nationality. For corporate rows: (3) corporateJurisdictionOfIncorporation must come ONLY from the table column "Jurisdiction of Incorporation" (or Jurisdiction/Place of Incorporation) for that row. corporateRegisteredAddress must come ONLY from the table column "Registered Address" (or Registered Office/Address) for that row. Do NOT use certificate-level or document-level Jurisdiction/Registered Address for these two fields.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptIntro },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        maxTokens: 800,
        responseFormat: 'json',
      });
      const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
      const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          // Apply same name/nationality fixes (image path has no heuristic; corporate jurisdiction/address from table only).
          parsed.parentHoldings = normalizeParentHoldings(parsed.parentHoldings || [], {
            heuristicMemberRows: [],
            heuristicCorporateRows: [],
            headerRelationshipType: '',
            hasPassportHeader: false,
          });
          return parsed;
        }
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
            { role: 'system', content: 'You extract UBO and shareholder data from documents. Reply only with valid JSON. For individual rows: (1) Locate the "Full Name" and "Nationality" columns; put values only from the correct column. (2) Never put a name in Nationality. For corporate rows: (3) corporateJurisdictionOfIncorporation must come ONLY from the table column "Jurisdiction of Incorporation" (or Jurisdiction/Place of Incorporation) for that row. corporateRegisteredAddress must come ONLY from the table column "Registered Address" (or Registered Office/Address) for that row. Do NOT use certificate-level or document-level Jurisdiction/Registered Address for these two fields.' },
            {
              role: 'user',
              content: `${promptIntro}\n\nDocument content (may be truncated):\n${snippet}`,
            },
          ],
          maxTokens: 800,
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
      const result = heuristicExtractFromText(snippet || rawText, guessed);
      result.defaultRelationshipType = detectParentRelationshipTypeFromHeaders(rawText);
      const heuristicMemberRows = heuristicExtractMemberTable(rawText);
      const heuristicCorporateRows = heuristicExtractCorporateTable(rawText);
      if (result.parentHoldings?.length && result.defaultRelationshipType === 'member') {
        result.parentHoldings = result.parentHoldings.map((ph, i) => {
          const hr = heuristicMemberRows[i];
          if (!hr) return { ...ph, relationshipType: 'member' };
          return {
            ...ph,
            relationshipType: 'member',
            name: ph.name || hr.fullName,
            individualFullName: hr.fullName || ph.name || '',
            individualNationality: hr.nationality || '',
            individualIdType: hr.idType || '',
            individualIdNumber: hr.idNumber || '',
          };
        });
      }
      if (result.parentHoldings?.length && result.defaultRelationshipType === 'corporate' && heuristicCorporateRows.length) {
        result.parentHoldings = result.parentHoldings.map((ph, i) => {
          const cr = heuristicCorporateRows[i];
          if (!cr) return { ...ph, relationshipType: 'corporate' };
          return {
            ...ph,
            relationshipType: 'corporate',
            name: ph.name || cr.entityName,
            corporateName: cr.entityName || ph.name || '',
            corporateJurisdictionOfIncorporation: cr.jurisdictionOfIncorporation || '',
            corporateRegisteredAddress: cr.registeredAddress || '',
            corporateRegistrationNumber: cr.registrationNumber || ph.registrationNumber || '',
          };
        });
      }
      if (Array.isArray(result.parentHoldings)) {
        result.parentHoldings = normalizeParentHoldings(result.parentHoldings, {
          heuristicMemberRows,
          heuristicCorporateRows,
          headerRelationshipType: result.defaultRelationshipType || '',
          hasPassportHeader: detectPassportHeaderFromText(rawText),
        });
      }
      return result;
    }

    // Merge: heuristic baseline + model output, with model taking precedence,
    // but always ensure organizationName is populated from model or heuristic.
    const baseline = heuristicExtractFromText(snippet || rawText, guessed);
    const merged = {
      ...baseline,
      ...extracted,
      organizationName: guessed || extracted.organizationName || baseline.organizationName || '',
    };

    // Only populate UBO Certificate Number when "Certificate Reference No" (or equivalent)
    // was found in the document. If the heuristic did not find it, leave blank.
    if (!baseline.uboCertificateNumber) {
      merged.uboCertificateNumber = '';
    } else {
      // Prefer the heuristic value when the model's value looks generic or wrong.
      const fromModel = (extracted && extracted.uboCertificateNumber) ? String(extracted.uboCertificateNumber).trim() : '';
      const looksGeneric =
        !fromModel ||
        /^certificate\s*$/i.test(fromModel) ||
        /^ubo\s*certificate\s*$/i.test(fromModel) ||
        !/[A-Za-z0-9]/.test(fromModel.replace(/certificate|ref(erence)?|number|no\.?/gi, ''));
      if (looksGeneric) {
        merged.uboCertificateNumber = baseline.uboCertificateNumber;
      }
      // Normalise so that only the actual reference/id value remains.
      merged.uboCertificateNumber = cleanCertificateNumber(merged.uboCertificateNumber);
    }
    // Never use organization name as certificate number (LLM or heuristic may have leaked it).
    if (isSameAsOrganizationName(merged.uboCertificateNumber, merged.organizationName)) {
      merged.uboCertificateNumber = '';
    }

    const headerRelationshipType = detectParentRelationshipTypeFromHeaders(rawText);
    const hasPassportHeader = detectPassportHeaderFromText(rawText);
    const heuristicMemberRows = heuristicExtractMemberTable(rawText);
    const heuristicCorporateRows = heuristicExtractCorporateTable(rawText);

    // Normalise and rebuild parent holding names; enrich member/corporate fields from document table per row.
    if (Array.isArray(merged.parentHoldings)) {
      merged.parentHoldings = normalizeParentHoldings(merged.parentHoldings, {
        heuristicMemberRows,
        heuristicCorporateRows,
        headerRelationshipType,
        hasPassportHeader,
      });
    }
    // parentHoldings[].individualNationality is returned by extract-org-from-file and flows to
    // Onboarding → UBO register details.nationality → OpCo Mandatory Details Nationality column.

    merged.defaultRelationshipType = headerRelationshipType;
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

    let parentHoldings = Array.isArray(extracted?.parentHoldings) ? extracted.parentHoldings : [];
    parentHoldings = normalizeParentHoldings(parentHoldings, {
      heuristicMemberRows: [],
      heuristicCorporateRows: [],
      headerRelationshipType: extracted?.defaultRelationshipType || '',
      hasPassportHeader: false,
    });
    parentHoldings = await applyCountryOfOriginToParentHoldings(parentHoldings);
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
      defaultRelationshipType: extracted?.defaultRelationshipType || '',
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
    const mime = (mimetype || 'application/octet-stream').toLowerCase();
    const extracted = await extractOrganizationNameFromBuffer(buffer, mime);
    const organizationName =
      extracted && typeof extracted.organizationName === 'string'
        ? extracted.organizationName.trim()
        : '';

    // Use document text when available to fill member nationalities and corporate fields from document table.
    let heuristicMemberRows = [];
    let heuristicCorporateRows = [];
    let headerRelationshipType = extracted?.defaultRelationshipType || '';
    let hasPassportHeader = false;
    let rawText = '';
    try {
      rawText = (await extractTextFromBuffer(buffer, mime)) || '';
      if (rawText.trim()) {
        heuristicMemberRows = heuristicExtractMemberTable(rawText);
        heuristicCorporateRows = heuristicExtractCorporateTable(rawText);
        headerRelationshipType = detectParentRelationshipTypeFromHeaders(rawText) || headerRelationshipType;
        hasPassportHeader = detectPassportHeaderFromText(rawText);
      }
    } catch (_) {
      // ignore text extraction errors
    }

    // Normalize and enrich from document table: member nationalities and corporate (Entity Name, Jurisdiction of Incorporation, Registered Address from table columns only).
    let parentHoldings = Array.isArray(extracted?.parentHoldings) ? extracted.parentHoldings : [];
    parentHoldings = normalizeParentHoldings(parentHoldings, {
      heuristicMemberRows,
      heuristicCorporateRows,
      headerRelationshipType,
      hasPassportHeader,
    });
    // If any corporate holding is missing Jurisdiction of Incorporation or Registered Address, ask LLM to extract from table columns.
    parentHoldings = await fillMissingCorporateJurisdictionAndAddress(parentHoldings, rawText);
    // If any member still has no nationality and we have document text, ask LLM to extract it from the document.
    parentHoldings = await fillMissingNationalitiesFromDocument(parentHoldings, rawText);
    // Map nationality terms to full country-of-origin names (e.g. British -> United Kingdom) via LLM.
    parentHoldings = await applyCountryOfOriginToParentHoldings(parentHoldings);
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
      defaultRelationshipType: extracted?.defaultRelationshipType || '',
      fromDocument: !!organizationName,
      message: organizationName
        ? 'Organization name extracted from document title.'
        : 'Could not confidently extract organization name from document.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});
