/**
 * documentIntelligence.js
 * =======================
 * Universal AI extraction engine.
 *
 * For every onboarding module this file defines:
 *   1. MODULE_SCHEMAS  – human-readable field definitions fed to the LLM
 *   2. extractDocumentFields()  – calls the LLM with learning context injected
 *   3. Normalisation helpers   – date / boolean / number cleanup
 *
 * The LLM is asked to return a JSON object:
 *   {
 *     fieldName: { value: "...", confidence: 0.0-1.0, label: "heading in doc" },
 *     ...
 *   }
 *
 * `label` is the document heading or keyword the LLM used to find the value.
 * The learning service stores these labels so future prompts become richer.
 */

import { createChatCompletion, isLlmConfigured } from './llm.js';
import { buildLearningContext } from './fieldLearningService.js';

// ── Module field schemas ──────────────────────────────────────────────────────
// Each value is the instruction given to the LLM for that field.

export const MODULE_SCHEMAS = {

  poa: {
    fileId:           'Notarisation reference number or unique document reference (e.g. DXB/NOT/2024/BPO/009114)',
    holderName:       'Full name of the attorney / grantee / holder of the power of attorney',
    holderRole:       'Job title or designation of the attorney (e.g. Finance Manager)',
    poaType:          'Type of POA — must be one of: Banking, General, Government, Real Estate, Corporate, Limited, Special',
    scope:            'Full numbered list of powers granted and any limitations or exclusions (preserve the original text)',
    jurisdiction:     'City or country where the POA was executed (e.g. Dubai, KSA)',
    issuingAuthority: 'Issuing authority or governing law reference (e.g. UAE Federal Law — Central Bank regulations)',
    signedOn:         'Date the document was signed (format: YYYY-MM-DD)',
    validFrom:        'Start date of validity (format: YYYY-MM-DD)',
    validUntil:       'Expiry or end date (format: YYYY-MM-DD)',
    notarised:        'Whether the document is notarised — return "true" or "false"',
    mofaStamp:        'Whether a MOFA (Ministry of Foreign Affairs) stamp is present — "true" or "false"',
    embassyStamp:     'Whether an embassy or apostille stamp is present — "true" or "false"',
  },

  contracts: {
    title:               'Short descriptive title of the contract (e.g. Master Services Agreement – IT Infrastructure)',
    counterparty:        'Name of the vendor, supplier, or counterparty (not the company who commissioned this GRC platform)',
    contractType:        'Contract type — one of: Vendor, NDA, Lease, Employment, Service, Partnership, Other',
    effectiveDate:       'Contract commencement / effective / start date (YYYY-MM-DD)',
    expiryDate:          'Contract expiry or end date (YYYY-MM-DD)',
    totalAmount:         'Total contract value including all taxes (numeric only, no currency symbol)',
    netAmount:           'Net amount before taxes (numeric only)',
    vatAmount:           'VAT or GST amount (numeric only)',
    taxAmount:           'Any other tax amount (numeric only)',
    renewalWindowStart:  'Date from which renewal discussions should begin (YYYY-MM-DD) — if not stated derive as expiryDate − 3 months',
    renewalWindowEnd:    'Deadline for renewal decision (YYYY-MM-DD) — if not stated derive as expiryDate − 1 month',
    riskLevel:           'Contract risk level — one of: Low, Medium, High',
  },

  ip: {
    mark:             'Trademark name, patent title, or IP asset name exactly as it appears on the certificate',
    ipType:           'Type — one of: Trademark, Patent, Design Right, Trade Name, Copyright, Domain',
    class:            'WIPO Nice Classification number (e.g. Class 36) or patent classification',
    jurisdiction:     'Country or territory where the IP is registered',
    registrationNo:   'Registration or grant number (e.g. GCC/TM/2024/00123)',
    applicationNo:    'Application number if different from registration number',
    filingDate:       'Date of filing or application (YYYY-MM-DD)',
    registrationDate: 'Date of registration or grant (YYYY-MM-DD)',
    renewalDate:      'Renewal or expiry date (YYYY-MM-DD)',
    status:           'Status — one of: Active, Pending, Expired, Opposed, Cancelled, Lapsed',
    agent:            'IP agent or law firm representing the applicant',
  },

  licences: {
    licenceType:      'Category of licence (e.g. Commercial, Financial Services, Healthcare, Import/Export, Technology)',
    licenceNo:        'Licence or permit number',
    jurisdiction:     'Country, emirate, or free zone where the licence is issued',
    issuingAuthority: 'Authority that issued the licence (e.g. DFSA, CBUAE, SAMA, DED, ADGM)',
    regulatoryBody:   'Relevant regulatory body if different from issuing authority',
    validFrom:        'Date the licence becomes valid (YYYY-MM-DD)',
    validUntil:       'Expiry or renewal date of the licence (YYYY-MM-DD)',
    status:           'Status — one of: Active, Pending Renewal, Under Review, Suspended, Expired, Revoked',
    renewalFee:       'Renewal fee including currency (e.g. AED 15,000)',
    dependencies:     'Any conditions, restrictions, or dependent licences noted on the document',
  },

  litigations: {
    caseId:           'Official court or arbitration reference / case number',
    court:            'Court or arbitration body name (e.g. DIFC Court of First Instance, DIAC)',
    jurisdiction:     'Legal jurisdiction',
    claimType:        'Type of claim — one of: Commercial Dispute, Employment, Regulatory Enforcement, IP Dispute, Contract Breach, Real Estate, Tax/Customs, Other',
    claimant:         'Party bringing the claim (plaintiff / applicant)',
    respondent:       'Respondent or defendant',
    claimAmount:      'Claimed amount as stated in the filing (include currency)',
    expectedExposure: 'Estimated financial exposure or liability noted in the document',
    status:           'Status — one of: Open, In Progress, Discovery Stage, Awaiting Judgment, Settled, Closed–Won, Closed–Lost, Appeal Filed, Enforcement Stage',
    filingDate:       'Date case was filed or commenced (YYYY-MM-DD)',
    nextHearingDate:  'Next hearing or submission deadline date (YYYY-MM-DD)',
    externalCounsel:  'Name of the law firm handling the case',
    internalOwner:    'Internal legal team member assigned to the case',
  },

  ubo: {
    fullName:                  'Full legal name of the beneficial owner as on their ID',
    nationality:               'Nationality (full country name, e.g. United Arab Emirates)',
    dateOfBirth:               'Date of birth (YYYY-MM-DD)',
    placeOfBirth:              'City and country of birth',
    idType:                    'Identity document type — Passport or National ID',
    idNumber:                  'Passport or ID card number',
    idCountryOfIssue:          'Country that issued the identity document',
    idExpiry:                  'Expiry date on the identity document (YYYY-MM-DD)',
    address:                   'Full residential or correspondence address',
    countryOfResidence:        'Country of current residence',
    percentageOwnership:       'Percentage ownership or control (e.g. 40%)',
    natureOfControl:           'Nature of control: ownership, voting rights, or other means',
    dateBecameBeneficialOwner: 'Date the person became a beneficial owner (YYYY-MM-DD)',
  },
};

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normDate(v) {
  if (!v || typeof v !== 'string') return v;
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return v;
}

function normBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const l = v.toLowerCase().trim();
    if (['true', 'yes', '1', 'y', 'present', 'stamped', 'notarised', 'notarized'].includes(l)) return true;
    if (['false', 'no', '0', 'n', 'absent', 'not present'].includes(l)) return false;
  }
  return v;
}

function normNumber(v) {
  if (v == null || v === '') return v;
  const n = parseFloat(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? v : n;
}

const DATE_FIELDS   = new Set(['signedOn','validFrom','validUntil','effectiveDate','expiryDate','renewalWindowStart','renewalWindowEnd','filingDate','registrationDate','renewalDate','applicationDate','nextHearingDate','filingDate','dateBecameBeneficialOwner','dateOfBirth','idExpiry','validFrom','validUntil','filingDate']);
const BOOL_FIELDS   = new Set(['notarised','mofaStamp','embassyStamp','provisioned','boardNotified']);
const NUMBER_FIELDS = new Set(['totalAmount','netAmount','vatAmount','taxAmount','renewalFee']);

function normaliseField(fieldName, raw) {
  if (raw == null || raw === '') return raw;
  if (DATE_FIELDS.has(fieldName))   return normDate(raw);
  if (BOOL_FIELDS.has(fieldName))   return normBool(raw);
  if (NUMBER_FIELDS.has(fieldName)) return normNumber(raw);
  return typeof raw === 'string' ? raw.trim() : raw;
}

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * Extract structured fields from document text using the LLM.
 *
 * @param {string} text         - Plain text content of the document
 * @param {string} moduleType   - e.g. 'poa', 'contracts', 'ip'
 * @param {Object} [options]
 * @param {string} [options.filename]  - Original filename (for context)
 * @param {string[]} [options.only]    - Subset of fields to extract (omit = all)
 *
 * @returns {Promise<{ fields: Object, rawResponse: string, error?: string }>}
 *   fields: { fieldName: { value, confidence, label } }
 */
export async function extractDocumentFields(text, moduleType, options = {}) {
  const schema = MODULE_SCHEMAS[moduleType];
  if (!schema) {
    return { fields: {}, rawResponse: '', error: `Unknown module type: ${moduleType}` };
  }

  if (!isLlmConfigured()) {
    return { fields: {}, rawResponse: '', error: 'LLM is not configured' };
  }

  // Limit document text to avoid token overflow (keep ~12 000 chars)
  const docText = (text || '').slice(0, 12000);
  if (!docText.trim()) {
    return { fields: {}, rawResponse: '', error: 'Document text is empty' };
  }

  // Build field list to extract
  const fieldEntries = Object.entries(schema).filter(([k]) =>
    !options.only || options.only.includes(k)
  );

  const fieldDescriptions = fieldEntries
    .map(([k, desc]) => `  "${k}": ${desc}`)
    .join('\n');

  // Inject learned patterns as few-shot context
  const learningContext = await buildLearningContext(moduleType);

  const systemPrompt = [
    `You are an expert legal document parser for a GRC (Governance, Risk, Compliance) platform.`,
    `Your task is to extract specific fields from the following ${moduleType} document.`,
    ``,
    `Return a JSON object where each key is one of the requested field names, and each value is:`,
    `  { "value": <extracted value or null>, "confidence": <0.0-1.0>, "label": "<heading or keyword in the doc>" }`,
    ``,
    `Rules:`,
    `- If a field is not found, return { "value": null, "confidence": 0, "label": "" }`,
    `- Format all dates as YYYY-MM-DD`,
    `- For boolean fields return "true" or "false" (string)`,
    `- For amount fields return numeric digits only (no currency symbol)`,
    `- confidence 1.0 = exact match found; 0.7-0.9 = inferred; below 0.5 = guessed`,
    `- "label" is the exact heading, column header, or keyword in the document where you found the value`,
    `- Do not invent data; prefer null over guessing`,
    learningContext ? `\n${learningContext}` : '',
  ].filter(Boolean).join('\n');

  const userPrompt = [
    `Extract these fields from the document:`,
    `{`,
    fieldDescriptions,
    `}`,
    ``,
    `--- DOCUMENT START ---`,
    docText,
    `--- DOCUMENT END ---`,
    ``,
    `Respond with a single JSON object only.`,
  ].join('\n');

  let rawResponse = '';
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      responseFormat: 'json',
      maxTokens: 2048,
    });

    rawResponse = completion?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(rawResponse);

    // Normalise and validate the response
    const fields = {};
    for (const [fieldName] of fieldEntries) {
      const raw = parsed[fieldName];
      if (raw && typeof raw === 'object' && 'value' in raw) {
        fields[fieldName] = {
          value:      normaliseField(fieldName, raw.value),
          confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
          label:      typeof raw.label === 'string' ? raw.label.trim().slice(0, 80) : '',
        };
      } else {
        // LLM returned a bare value instead of the expected shape
        fields[fieldName] = {
          value:      normaliseField(fieldName, raw ?? null),
          confidence: raw != null ? 0.6 : 0,
          label:      '',
        };
      }
    }

    return { fields, rawResponse };

  } catch (err) {
    return {
      fields: {},
      rawResponse,
      error: `Extraction failed: ${err.message}`,
    };
  }
}

/**
 * Quick field-list for a module (used by API to advertise what can be extracted).
 */
export function getModuleSchema(moduleType) {
  return MODULE_SCHEMAS[moduleType] || null;
}

export function listModules() {
  return Object.keys(MODULE_SCHEMAS);
}
