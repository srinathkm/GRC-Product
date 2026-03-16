/**
 * documentIntelligence.js
 * =======================
 * Universal AI extraction engine.
 *
 * Extraction uses a two-pass strategy to maximise reliability:
 *
 *  Pass 1 — Structured fields (JSON)
 *    Short, predictable values (names, dates, booleans, reference numbers).
 *    Returned as { fieldName: { value, confidence, label } }.
 *
 *  Pass 2 — Long-text fields (plain text)
 *    Fields like 'scope', 'notes', 'dependencies' that contain multi-paragraph
 *    prose. Extracted as raw text in a separate call so that newlines and
 *    special characters never break JSON parsing.
 *
 * Both passes inject accumulated learning context (from fieldLearningService)
 * as few-shot examples so accuracy improves with every document processed.
 */

import { createChatCompletion, isLlmConfigured } from './llm.js';
import { buildLearningContext } from './fieldLearningService.js';

// ── Module field schemas ──────────────────────────────────────────────────────
// Each value is the plain-English instruction given to the LLM.

export const MODULE_SCHEMAS = {

  poa: {
    // structured
    parent:           'Full legal name of the company or organisation that is GRANTING this Power of Attorney (the principal / grantor). Look for "THIS POWER OF ATTORNEY is made by", "Grantor:", "Principal:", "Company:", or the first legal entity executing the document. This is the organisation name, not the attorney\'s name.',
    opco:             'Name of the specific subsidiary or operating company if the grantor is a subsidiary (e.g. "XYZ Trading LLC" within "ABC Holdings Group"). Return null if the document names only one entity.',
    fileId:           'The unique document reference or notarisation reference number (e.g. TEST-POA-BANK-0001-2024 or DXB/NOT/2024/BPO/009114). Look for labels like "Reference No.", "Ref:", "Notarisation Ref", "File No."',
    holderName:       'Full legal name of the attorney-in-fact, grantee, or power of attorney holder. Look for headings like "ATTORNEY-IN-FACT", "GRANTEE", "Attorney", "Authorised Person", "Part 2 – Full Name"',
    holderRole:       'Job title or designation of the attorney (e.g. Finance Manager, Head of Operations, Legal Counsel). Look near the holder name or after words like "designation:", "title:", "position:", "capacity:".',
    poaType:          'Category of this POA — infer from the title or subject matter. Must be one of: Banking, General, Government, Real Estate, Corporate, Limited, Special',
    jurisdiction:     'The city, emirate, or country where the POA is executed or governing law applies (e.g. Dubai, KSA, Abu Dhabi). Extract ONLY the place name.',
    issuingAuthority: 'The governing law or issuing authority (e.g. "UAE Federal Law — Central Bank of UAE Regulations", "Laws of the Emirate of Dubai")',
    signedOn:         'The date the document was signed or issued (YYYY-MM-DD). Look for "Date:", "Signed On:", "Issue Date:", "Effective:"',
    validFrom:        'The start date of validity (YYYY-MM-DD). Often the same as the signing date.',
    validUntil:       'The expiry or end date of validity (YYYY-MM-DD). Look for "Expiry:", "Valid Until:", "Expiry Date:", "Valid to:"',
    notarised:        'Is the document notarised/notarized? Look for words like "Notary Public", "Notarisation", "Attestation No." Return "true" or "false"',
    mofaStamp:        'Is a MOFA (Ministry of Foreign Affairs) stamp present or mentioned? Return "true" or "false"',
    embassyStamp:     'Is an embassy stamp, apostille, or consular attestation present or mentioned? Return "true" or "false"',
    // scope is a LONG-TEXT field handled in pass 2
  },

  contracts: {
    parent:              'Full legal name of the company that commissioned or is the primary client / first party in this contract (not the vendor or counterparty). Look for "Party 1:", "Client:", "Customer:", "Buyer:", "Company:", or the first entity listed in the parties section.',
    opco:                'Name of the specific subsidiary or operating entity entering into this contract, if different from the parent holding company. Return null if only one entity is named.',
    title:               'Short descriptive title of the contract (e.g. Master Services Agreement – IT Infrastructure)',
    counterparty:        'Name of the vendor, supplier, or counterparty (not the company who commissioned this GRC platform). Look for "Party 2:", "Vendor:", "Supplier:", "Service Provider:".',
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
    parent:           'Full legal name of the company or organisation that owns or applied for this IP right (the applicant / owner / proprietor). Look for "Applicant:", "Owner:", "Proprietor:", "Holder:", "Registered to:", or the entity named as the IP rights holder.',
    opco:             'Name of the specific subsidiary holding this IP right, if different from the parent group. Return null if only one entity is mentioned.',
    mark:             'Trademark name, patent title, or IP asset name exactly as it appears on the certificate. Look for "Mark:", "Trade Mark Name:", "Patent Title:", "IP Name:"',
    ipType:           'Type of IP right — one of: Trademark, Patent, Design Right, Trade Name, Copyright, Domain. Infer from document title or content.',
    class:            'WIPO Nice Classification number or patent classification (e.g. Class 36, IPC A61K). Look for "Class:", "Classes:", "Classification:"',
    jurisdiction:     'Country or territory where the IP is registered. Look for "Territory:", "Country:", "Jurisdiction:", or the name of a national IP office.',
    registrationNo:   'Registration or grant number. Look for "Registration No.", "Grant No.", "Certificate No.", "Reg. No."',
    applicationNo:    'Application number, if different from registration number. Look for "Application No.", "App. No."',
    filingDate:       'Date of filing or application (YYYY-MM-DD). Look for "Filing Date:", "Application Date:", "Date of Filing:"',
    registrationDate: 'Date of registration or grant (YYYY-MM-DD). Look for "Registration Date:", "Date of Grant:", "Issue Date:"',
    renewalDate:      'Renewal or expiry date (YYYY-MM-DD). Look for "Renewal Date:", "Expiry Date:", "Valid Until:", "Next Renewal:"',
    status:           'Status — one of: Active, Pending, Expired, Opposed, Cancelled, Lapsed. Infer from document wording.',
    agent:            'IP agent, attorney, or law firm representing the applicant. Look for "Agent:", "Representative:", "Counsel:"',
  },

  licences: {
    parent:           'Full legal name of the company or entity to whom this licence is granted (the licensee). Look for "Licensed to:", "Licensee:", "Company Name:", "Trading Name:", "Registered Name:", or the entity named on the licence certificate.',
    opco:             'Name of the specific branch, outlet, or operating subsidiary if the licence is issued to a subsidiary of the parent group. Return null if only one entity is named.',
    licenceType:      'Category of licence (e.g. Commercial, Financial Services, Healthcare, Import/Export, Technology). Look for "Licence Type:", "Type of Licence:", or infer from document title.',
    licenceNo:        'Licence or permit number. Look for "Licence No.", "License No.", "Permit No.", "Certificate No.", "Reference No."',
    jurisdiction:     'Country, emirate, or free zone where the licence is issued. Look for "Issued in:", "Jurisdiction:", "Emirate:", or the name of the issuing authority\'s location.',
    issuingAuthority: 'Authority that issued the licence (e.g. DFSA, CBUAE, SAMA, DED, ADGM, Ministry of Commerce).',
    regulatoryBody:   'Relevant regulatory body if different from issuing authority.',
    validFrom:        'Date the licence becomes valid (YYYY-MM-DD). Look for "Issue Date:", "Valid From:", "Commencement Date:"',
    validUntil:       'Expiry or renewal date of the licence (YYYY-MM-DD). Look for "Expiry Date:", "Valid Until:", "Renewal Date:", "Expires:"',
    status:           'Status — one of: Active, Pending Renewal, Under Review, Suspended, Expired, Revoked. Infer from document.',
    renewalFee:       'Renewal fee including currency (e.g. AED 15,000). Look for "Renewal Fee:", "Fee:", "Annual Fee:"',
  },

  litigations: {
    parent:           'Full legal name of the company that is the primary party (client / defendant / respondent) in this litigation — i.e. the entity using this GRC platform. Look for the first party named in the heading, caption, or preamble. Exclude law firm names.',
    opco:             'Name of the specific subsidiary or operating entity involved in this litigation, if different from the parent holding. Return null if only one entity is named.',
    caseId:           'Official court or arbitration reference / case number. Look for "Case No.", "Case Reference:", "Ref:", "Arbitration No.", "Claim No."',
    court:            'Court or arbitration body name (e.g. DIFC Court of First Instance, DIAC, Dubai Courts). Look for "Court:", "Before:", "Forum:", "Tribunal:"',
    jurisdiction:     'Legal jurisdiction where proceedings are taking place.',
    claimType:        'Type of claim — one of: Commercial Dispute, Employment, Regulatory Enforcement, IP Dispute, Contract Breach, Real Estate, Tax/Customs, Other. Infer from subject matter.',
    claimant:         'Party bringing the claim (plaintiff / applicant). Look for "Claimant:", "Plaintiff:", "Applicant:", "Complainant:"',
    respondent:       'Respondent or defendant. Look for "Respondent:", "Defendant:", "Respondents:"',
    claimAmount:      'Claimed amount as stated in the filing, including currency (e.g. AED 2,500,000).',
    expectedExposure: 'Estimated financial exposure or liability noted in the document.',
    status:           'Status — one of: Open, In Progress, Discovery Stage, Awaiting Judgment, Settled, Closed–Won, Closed–Lost, Appeal Filed, Enforcement Stage.',
    filingDate:       'Date case was filed or commenced (YYYY-MM-DD). Look for "Filing Date:", "Commencement Date:", "Date of Claim:"',
    nextHearingDate:  'Next hearing or submission deadline date (YYYY-MM-DD). Look for "Hearing Date:", "Next Hearing:", "Deadline:", "Submission Date:"',
    externalCounsel:  'Name of the law firm handling the case. Look for "Counsel:", "Solicitors:", "Represented by:", "Legal Advisors:"',
    internalOwner:    'Internal legal team member assigned to the case.',
  },

  ubo: {
    parent:                    'Full legal name of the company or entity in which this person is a beneficial owner. Look for the company name at the top of the form or in the preamble.',
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

// ── Long-text fields: extracted as plain text (Pass 2) to avoid JSON issues ──
// These fields contain multi-paragraph prose that breaks JSON encoding.
const LONG_TEXT_FIELDS = {
  poa:        { scope: 'The full list of powers and authorities granted, including all numbered points and any stated limitations or exclusions. Preserve the exact wording and structure.' },
  licences:   { dependencies: 'Any licence conditions, restrictions, prerequisites or dependencies stated in the document.' },
  contracts:  { notes: 'Any special conditions, penalties, or notable clauses mentioned in the document.' },
};

// ── Normalisation helpers ─────────────────────────────────────────────────────

function normDate(v) {
  if (!v || typeof v !== 'string') return v;
  // Try direct ISO parse first
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  // Try common formats: DD/MM/YYYY, DD-MM-YYYY, Month DD YYYY
  const dmy = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d2 = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
  }
  return v;
}

function normBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const l = v.toLowerCase().trim();
    if (['true', 'yes', '1', 'y', 'present', 'stamped', 'notarised', 'notarized'].includes(l)) return true;
    if (['false', 'no', '0', 'n', 'absent', 'not present', 'none'].includes(l)) return false;
  }
  return v;
}

function normNumber(v) {
  if (v == null || v === '') return v;
  const n = parseFloat(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? v : n;
}

const DATE_FIELDS   = new Set(['signedOn','validFrom','validUntil','effectiveDate','expiryDate','renewalWindowStart','renewalWindowEnd','filingDate','registrationDate','renewalDate','nextHearingDate','dateBecameBeneficialOwner','dateOfBirth','idExpiry','applicationDate']);
const BOOL_FIELDS   = new Set(['notarised','mofaStamp','embassyStamp','provisioned','boardNotified']);
const NUMBER_FIELDS = new Set(['totalAmount','netAmount','vatAmount','taxAmount']);

function normaliseField(fieldName, raw) {
  if (raw == null || raw === '') return raw;
  if (DATE_FIELDS.has(fieldName))   return normDate(raw);
  if (BOOL_FIELDS.has(fieldName))   return normBool(raw);
  if (NUMBER_FIELDS.has(fieldName)) return normNumber(raw);
  return typeof raw === 'string' ? raw.trim() : raw;
}

// ── Pass 1: Structured fields extracted as JSON ───────────────────────────────

async function extractStructuredFields(docText, moduleType, fieldEntries, learningContext) {
  if (fieldEntries.length === 0) return {};

  const fieldDescriptions = fieldEntries
    .map(([k, desc]) => `  "${k}": ${desc}`)
    .join('\n');

  const systemPrompt = [
    `You are an expert legal document parser for a GRC (Governance, Risk, Compliance) platform.`,
    `Extract the requested fields from the document and return a single JSON object.`,
    ``,
    `For each field return:`,
    `  { "value": <extracted value or null>, "confidence": <0.0–1.0>, "label": "<exact heading/keyword from doc where found>" }`,
    ``,
    `Rules:`,
    `- Search the ENTIRE document — values may appear anywhere, under any heading style`,
    `- If a field cannot be found, return { "value": null, "confidence": 0, "label": "" }`,
    `- Dates: always output as YYYY-MM-DD. Convert DD/MM/YYYY, "15 March 2026", etc.`,
    `- Booleans: output the string "true" or "false"`,
    `- Amounts: numeric digits only, no currency symbols`,
    `- confidence: 1.0 = explicitly stated; 0.7–0.9 = clearly implied; <0.5 = uncertain guess`,
    `- "label" = the exact heading, label, or keyword in the document where the value was found`,
    `- Do NOT invent data; prefer null over guessing`,
    learningContext ? `\n${learningContext}` : '',
  ].filter(Boolean).join('\n');

  const userPrompt = [
    `Extract these fields from the document below. Return only a JSON object with no extra text.`,
    ``,
    `Fields to extract:`,
    `{`,
    fieldDescriptions,
    `}`,
    ``,
    `--- DOCUMENT ---`,
    docText.slice(0, 14000),
    `--- END OF DOCUMENT ---`,
  ].join('\n');

  const completion = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    responseFormat: 'json',
    maxTokens: 3500,
  });

  const raw = completion?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  const fields = {};
  for (const [fieldName] of fieldEntries) {
    const entry = parsed[fieldName];
    if (entry && typeof entry === 'object' && 'value' in entry) {
      fields[fieldName] = {
        value:      normaliseField(fieldName, entry.value),
        confidence: typeof entry.confidence === 'number' ? Math.min(1, Math.max(0, entry.confidence)) : 0.5,
        label:      typeof entry.label === 'string' ? entry.label.trim().slice(0, 100) : '',
      };
    } else if (entry !== undefined) {
      // LLM returned a bare value
      fields[fieldName] = {
        value:      normaliseField(fieldName, entry ?? null),
        confidence: entry != null ? 0.6 : 0,
        label:      '',
      };
    }
  }
  return fields;
}

// ── Pass 2: Long-text fields extracted as plain text ─────────────────────────

async function extractLongTextField(docText, fieldName, description) {
  const systemPrompt =
    `You are a legal document analyst. Extract the requested text section from the document exactly as written. ` +
    `Return ONLY the extracted text — no commentary, no JSON, no labels. ` +
    `If the section is not present in the document, reply with exactly: [NOT FOUND]`;

  const userPrompt = [
    `Extract the following from the document:`,
    description,
    ``,
    `Important: return the full text of this section, preserving numbering and structure. ` +
    `If it is genuinely absent, reply [NOT FOUND].`,
    ``,
    `--- DOCUMENT ---`,
    docText.slice(0, 14000),
    `--- END OF DOCUMENT ---`,
  ].join('\n');

  const completion = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    maxTokens: 2500,
  });

  const result = (completion?.choices?.[0]?.message?.content || '').trim();
  if (!result || result === '[NOT FOUND]') return null;
  return result;
}

// ── Public extraction API ─────────────────────────────────────────────────────

/**
 * Extract all fields for a module from document text.
 * Uses two-pass strategy: structured fields via JSON, long-text via plain text.
 *
 * @returns {{ fields: Object, error?: string }}
 *   fields: { fieldName: { value, confidence, label } }
 */
export async function extractDocumentFields(text, moduleType, options = {}) {
  const schema = MODULE_SCHEMAS[moduleType];
  if (!schema) return { fields: {}, error: `Unknown module type: ${moduleType}` };
  if (!isLlmConfigured()) return { fields: {}, error: 'LLM is not configured' };

  const docText = (text || '').trim();
  if (!docText) return { fields: {}, error: 'Document text is empty after extraction' };

  const longTextDefs = LONG_TEXT_FIELDS[moduleType] || {};
  const only = options.only;

  // Partition fields
  const structuredEntries = Object.entries(schema).filter(([k]) =>
    !longTextDefs[k] && (!only || only.includes(k))
  );
  const longTextEntries = Object.entries(longTextDefs).filter(([k]) =>
    !only || only.includes(k)
  );

  const learningContext = await buildLearningContext(moduleType);

  // Run both passes concurrently
  const [structuredFields, ...longTextResults] = await Promise.all([
    extractStructuredFields(docText, moduleType, structuredEntries, learningContext).catch((e) => {
      console.error(`[documentIntelligence] structured pass failed for ${moduleType}:`, e.message);
      return {};
    }),
    ...longTextEntries.map(([fieldName, desc]) =>
      extractLongTextField(docText, fieldName, desc).catch(() => null)
    ),
  ]);

  // Merge long-text results
  const longTextFields = {};
  for (let i = 0; i < longTextEntries.length; i++) {
    const [fieldName] = longTextEntries[i];
    const value = longTextResults[i];
    if (value) {
      longTextFields[fieldName] = { value, confidence: 0.85, label: 'scope/notes section' };
    }
  }

  return { fields: { ...structuredFields, ...longTextFields } };
}

export function getModuleSchema(moduleType) {
  return MODULE_SCHEMAS[moduleType] || null;
}

export function listModules() {
  return Object.keys(MODULE_SCHEMAS);
}
