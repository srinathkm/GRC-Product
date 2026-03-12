/**
 * Generate 5-10 sample contract PDFs for testing the Contracts module.
 * Run from server: node scripts/generate-contract-samples.js
 * Output: server/data/contract-samples/*.pdf each containing a Contract ID and exhaustive details.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../data/contract-samples');

function sanitize(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/[^\x20-\x7E\n]/g, ' ');
}

function wrapParagraph(font, text, size, maxWidth) {
  const lines = [];
  const words = text.trim().split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(doc, page, font, text, x, y, size = 10, maxWidth = 500) {
  const safe = sanitize(text);
  const paragraphs = safe.split(/\n/).map((p) => p.trim()).filter(Boolean);
  let currentY = y;
  for (const para of paragraphs) {
    const lines = wrapParagraph(font, para, size, maxWidth);
    for (const ln of lines) {
      page.drawText(ln, { x, y: currentY, size, font, color: rgb(0.1, 0.1, 0.1) });
      currentY -= size * 1.2;
    }
    currentY -= size * 0.5;
  }
  return currentY;
}

const SAMPLES = [
  {
    contractId: 'CON-20250223-001-VENDOR',
    type: 'Vendor',
    title: 'Master Services Agreement - IT Infrastructure',
    partyA: 'Raqib Holdings LLC',
    partyB: 'Gulf Cloud Solutions FZCO',
    effective: '2025-01-15',
    expiry: '2026-01-14',
    value: 'AED 2,400,000',
    content: `CONTRACT ID: CON-20250223-001-VENDOR

MASTER SERVICES AGREEMENT - IT INFRASTRUCTURE

This Agreement is entered into as of 15 January 2025 between Raqib Holdings LLC ("Client") and Gulf Cloud Solutions FZCO ("Vendor").

1. SCOPE: Vendor shall provide managed cloud infrastructure, 24/7 support, and quarterly security assessments across Client's GCC entities.

2. TERM: Initial term 12 months from Effective Date, with automatic renewal for successive 12-month periods unless terminated with 90 days written notice.

3. FEES: Total contract value AED 2,400,000 per annum, invoiced monthly in arrears. Payment terms 30 days from invoice date.

4. OBLIGATIONS: Vendor shall maintain 99.9% uptime SLA; provide incident response within 4 hours; comply with UAE data residency requirements. Client shall provide access to systems and timely payment.

5. RENEWAL WINDOW: Negotiations for renewal or amendment may commence between 90 and 60 days prior to Expiry Date.

6. GOVERNING LAW: DIFC laws. Disputes under DIFC-LCIA arbitration.`,
  },
  {
    contractId: 'CON-20250223-002-NDA',
    type: 'NDA',
    title: 'Mutual Non-Disclosure Agreement',
    partyA: 'Raqib Compliance Intelligence',
    partyB: 'Alpha Advisory Group',
    effective: '2025-02-01',
    expiry: '2027-02-01',
    value: 'N/A',
    content: `CONTRACT ID: CON-20250223-002-NDA

MUTUAL NON-DISCLOSURE AGREEMENT

Effective Date: 1 February 2025. Between Raqib Compliance Intelligence and Alpha Advisory Group ("Parties").

1. PURPOSE: To permit discussion of a potential business collaboration involving regulatory technology and advisory services in the GCC.

2. CONFIDENTIAL INFORMATION: All non-public information disclosed (oral, written, or electronic) including business plans, pricing, client data, and technical specifications.

3. OBLIGATIONS: Each party shall (a) hold Confidential Information in confidence; (b) use it only for the Purpose; (c) disclose only to employees/affiliates with a need to know; (d) return or destroy upon request.

4. EXCLUSIONS: Information that is publicly available, independently developed, or rightfully received from a third party without restriction.

5. TERM: 24 months from Effective Date. Survival: obligations survive for 3 years after termination.

6. GOVERNING LAW: Laws of the Dubai International Financial Centre.`,
  },
  {
    contractId: 'CON-20250223-003-LEASE',
    type: 'Lease',
    title: 'Office Lease - DIFC Gate Avenue',
    partyA: 'Raqib Holdings',
    partyB: 'DIFC Properties Management',
    effective: '2024-06-01',
    expiry: '2027-05-31',
    value: 'AED 485,000/year',
    content: `CONTRACT ID: CON-20250223-003-LEASE

OFFICE LEASE - DIFC GATE AVENUE

Landlord: DIFC Properties Management. Tenant: Raqib Holdings.

PREMISES: Unit 1204, Gate Avenue, DIFC, Dubai, UAE. Approximate area 2,200 sq ft.

TERM: 36 months commencing 1 June 2024, expiring 31 May 2027.

RENT: AED 485,000 per annum, payable in 4 post-dated cheques per year. Security deposit: AED 80,000.

RENEWAL: Tenant may exercise option to renew for one further term of 3 years by written notice not less than 6 months prior to expiry. Rent for renewal term to be agreed or determined by independent valuation.

OBLIGATIONS: Landlord to maintain common areas and structure. Tenant to maintain interior, pay utilities, and comply with DIFC regulations. No subletting without consent.

BREAK CLAUSE: None. Early termination subject to 6 months notice and payment of 3 months rent in lieu.`,
  },
  {
    contractId: 'CON-20250223-004-EMPLOYMENT',
    type: 'Employment',
    title: 'Senior Compliance Officer - Employment Contract',
    partyA: 'Raqib Compliance Intelligence FZ-LLC',
    partyB: 'Employee Name',
    effective: '2025-01-01',
    expiry: '2026-12-31',
    value: 'Confidential',
    content: `CONTRACT ID: CON-20250223-004-EMPLOYMENT

EMPLOYMENT CONTRACT - SENIOR COMPLIANCE OFFICER

Employer: Raqib Compliance Intelligence FZ-LLC. Employee: [Name].

ROLE: Senior Compliance Officer. Location: Dubai, UAE. Reporting to: Head of Legal & Compliance.

TERM: Fixed term 24 months from 1 January 2025 to 31 December 2026.

REMUNERATION: As per offer letter (confidential). Annual leave 30 days. Medical insurance as per company policy.

OBLIGATIONS: Employee shall perform duties diligently; maintain confidentiality; comply with internal policies and applicable regulations including UAE labour law and DIFC employment law. Non-compete: 6 months post-termination within GCC financial services.

NOTICE: 3 months by either party. Employer may pay in lieu. Termination for cause as per law.

INTELLECTUAL PROPERTY: All IP created in course of employment shall belong to Employer.`,
  },
  {
    contractId: 'CON-20250223-005-SERVICE',
    type: 'Service',
    title: 'Regulatory Monitoring and Alert Service',
    partyA: 'Raqib Holdings and Affiliates',
    partyB: 'RegWatch Middle East Ltd',
    effective: '2025-03-01',
    expiry: '2026-02-28',
    value: 'AED 180,000',
    content: `CONTRACT ID: CON-20250223-005-SERVICE

REGULATORY MONITORING AND ALERT SERVICE

Client: Raqib Holdings and Affiliates. Provider: RegWatch Middle East Ltd.

SCOPE: Provider shall deliver regulatory change monitoring across DFSA, SAMA, CMA, CBUAE, ADGM and other GCC regulators; weekly digests; custom alerts for designated frameworks; and quarterly summary reports.

DELIVERABLES: Access to RegWatch portal; email alerts; dedicated account manager. Coverage for up to 15 entities under Client group.

FEES: AED 180,000 for 12 months, payable 50% on signing and 50% at 6 months.

RENEWAL WINDOW: 60 to 30 days before expiry for renewal at then-current pricing.

SLA: Alerts within 24 hours of official publication. Support response within 2 business days.`,
  },
  {
    contractId: 'CON-20250223-006-PARTNERSHIP',
    type: 'Partnership',
    title: 'Strategic Partnership Deed - Distribution',
    partyA: 'Raqib Platform Co',
    partyB: 'Compliance Partners KSA',
    effective: '2025-04-01',
    expiry: '2027-03-31',
    value: 'Revenue share',
    content: `CONTRACT ID: CON-20250223-006-PARTNERSHIP

STRATEGIC PARTNERSHIP DEED - DISTRIBUTION

Parties: Raqib Platform Co ("Licensor") and Compliance Partners KSA ("Partner").

PURPOSE: Non-exclusive right to market, distribute and implement Raqib compliance platform in the Kingdom of Saudi Arabia.

TERM: 24 months from 1 April 2025, renewable by mutual agreement.

REVENUE SHARE: Partner receives 25% of net licence fees from KSA clients introduced by Partner. Licensor retains 75%. Support and implementation billed separately as agreed.

OBLIGATIONS: Partner shall use compliant marketing; not modify the platform; report quarterly. Licensor shall provide training, materials and tier-2 support. Both shall comply with KSA and CMA requirements.

RENEWAL: Parties to discuss renewal and terms no later than 90 days before expiry.

GOVERNING LAW: Saudi law. Disputes: Riyadh Chamber of Commerce arbitration.`,
  },
  {
    contractId: 'CON-20250223-007-VENDOR',
    type: 'Vendor',
    title: 'Legal Counsel Retainer Agreement',
    partyA: 'Raqib Group',
    partyB: 'Baker McKenzie Habib Al Mulla',
    effective: '2025-01-01',
    expiry: '2025-12-31',
    value: 'AED 600,000',
    content: `CONTRACT ID: CON-20250223-007-VENDOR

LEGAL COUNSEL RETAINER AGREEMENT

Client: Raqib Group. Firm: Baker McKenzie Habib Al Mulla.

SCOPE: Retainer for general corporate and regulatory advice across UAE and GCC; contract review; entity governance; and ad hoc litigation support. Excludes M&A and dedicated litigation mandates (separate engagement).

FEES: AED 600,000 per annum, paid monthly. Out-of-pocket and disbursements additional. Rates for matters outside retainer as per fee letter.

NOTICE: Either party may terminate on 60 days written notice. Unused retainer not refundable.

CONFLICTS: Firm shall maintain conflict checks. Client shall disclose related entities.

CONFIDENTIALITY: Subject to professional obligations and law.`,
  },
  {
    contractId: 'CON-20250223-008-SERVICE',
    type: 'Service',
    title: 'Audit and Assurance Services',
    partyA: 'Raqib Holdings',
    partyB: 'Deloitte & Touche (M.E.)',
    effective: '2025-02-15',
    expiry: '2025-12-31',
    value: 'AED 320,000',
    content: `CONTRACT ID: CON-20250223-008-SERVICE

AUDIT AND ASSURANCE SERVICES

Client: Raqib Holdings. Auditor: Deloitte & Touche (M.E.).

ENGAGEMENT: Statutory audit of Raqib Holdings and designated subsidiaries for financial year ending 31 December 2025; management letter; and agreed-upon procedures for regulatory reporting packs as required by DFSA.

FEES: AED 320,000 fixed for audit and standard deliverables. Additional work quoted separately.

DELIVERABLES: Signed audit report by 31 March 2026; management letter within 45 days of report; access to audit files as per regulation.

OBLIGATIONS: Client to provide records, access and representations. Auditor to perform in accordance with UAE standards and DFSA rules.

RENEWAL: Engagement is for one year. Subsequent years subject to separate engagement letter.`,
  },
  {
    contractId: 'CON-20250223-009-NDA',
    type: 'NDA',
    title: 'Unilateral NDA - Technology Evaluation',
    partyA: 'Raqib Platform Co',
    partyB: 'Prospective Licensee',
    effective: '2025-05-01',
    expiry: '2026-05-01',
    value: 'N/A',
    content: `CONTRACT ID: CON-20250223-009-NDA

UNILATERAL NON-DISCLOSURE AGREEMENT - TECHNOLOGY EVALUATION

Disclosing Party: Raqib Platform Co. Receiving Party: [Prospective Licensee].

PURPOSE: To allow Receiving Party to evaluate Raqib platform and related materials for a potential licence in the Receiving Party's jurisdiction.

CONFIDENTIAL INFORMATION: All technical, commercial and product information disclosed by Disclosing Party, including demos, documentation and pricing.

OBLIGATIONS: Receiving Party shall not disclose to third parties; use only for evaluation; not reverse-engineer or copy. Term: 12 months. Survival 2 years.

RETURN: Upon request or end of evaluation, Receiving Party shall return or destroy all materials and certify destruction.`,
  },
  {
    contractId: 'CON-20250223-010-LEASE',
    type: 'Lease',
    title: 'Equipment Lease - Server and Network',
    partyA: 'Raqib IT Operations',
    partyB: 'Gulf Leasing Co',
    effective: '2024-09-01',
    expiry: '2027-08-31',
    value: 'AED 95,000/year',
    content: `CONTRACT ID: CON-20250223-010-LEASE

EQUIPMENT LEASE - SERVER AND NETWORK

Lessor: Gulf Leasing Co. Lessee: Raqib IT Operations.

EQUIPMENT: As per Schedule A (servers, storage, network equipment). Total replacement value AED 380,000.

TERM: 36 months from 1 September 2024. Monthly rent AED 7,916.67. Total lease payments AED 285,000.

OPTIONS: (1) Purchase at end for nominal AED 1. (2) Return equipment in good condition. Lessee to give 90 days notice of intent.

MAINTENANCE: Lessor responsible. Lessee to provide access and power. No modification without consent.

DEFAULT: Late payment interest at 2% per month. Lessor may repossess on 15 days default. Early termination: all remaining payments due unless agreed otherwise.`,
  },
];

async function generateOne(spec) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const margin = 50;
  const maxWidth = 495;
  let y = 800;

  page.drawText('CONTRACT SAMPLE - FOR TESTING', {
    x: margin,
    y,
    size: 14,
    font,
    color: rgb(0.2, 0.3, 0.6),
  });
  y -= 22;

  y = drawText(doc, page, font, spec.content, margin, y, 10, maxWidth);

  const pdfBytes = await doc.save();
  const filename = `${spec.contractId.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
  const path = join(OUT_DIR, filename);
  await writeFile(path, pdfBytes);
  console.log('Wrote', filename);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const spec of SAMPLES) {
    await generateOne(spec);
  }
  console.log('Done. Generated', SAMPLES.length, 'contract samples in', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
