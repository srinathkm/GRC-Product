#!/usr/bin/env python3
"""
GRC Product – Test Document Generator
======================================
Generates a full set of SPECIMEN test documents for end-to-end testing
of the SKM LLC entity across all functional modules.

ALL DOCUMENTS ARE MARKED  *** SPECIMEN – NOT FOR OFFICIAL USE ***
No real government seals, MRZ codes, or security features are included.

Usage:
    python3 generate_test_documents.py
Output:
    SKM_LLC_Test_Documents.zip  (in the same directory)
"""

import os, zipfile, textwrap
from datetime import date

ROOT = "SKM_LLC_Test_Documents"
TODAY = date.today().strftime("%d %B %Y")
SPECIMEN = "=" * 70 + "\n*** SPECIMEN DOCUMENT – FOR TESTING PURPOSES ONLY ***\n*** NOT FOR OFFICIAL USE – CONTAINS NO REAL DATA ***\n" + "=" * 70

# ── Shared master data ────────────────────────────────────────────────────────

COMPANY = {
    "name":         "SKM LLC",
    "trade_name":   "SKM Life Sciences & Technology",
    "cr_ksa":       "TEST-CR-KSA-20240001",
    "cr_oman":      "TEST-CR-OMN-20240002",
    "capital_ksa":  "SAR 5,000,000",
    "capital_oman": "OMR 500,000",
    "address_ksa":  "Level 12, King Fahd Road, Al Olaya, Riyadh 12214, Kingdom of Saudi Arabia",
    "address_oman": "Building 43, Al Khuwair Commercial District, Muscat 130, Sultanate of Oman",
    "email":        "compliance@skmllc-test.example",
    "phone_ksa":    "+966 11 000 9999",
    "phone_oman":   "+968 2400 8888",
    "activity":     "Manufacture and distribution of pharmaceutical products; provision of medical imaging equipment; development of data-processing software algorithms",
    "formed_date":  "01 March 2020",
}

PERSONS = [
    {
        "id":           "P001",
        "name":         "Ahmed Khalid Al-Rashidi",
        "nationality":  "Saudi Arabian",
        "dob":          "15 July 1978",
        "id_number":    "TEST-ID-SA-10012345",
        "id_expiry":    "14 July 2030",
        "address":      "Villa 7, Al-Malqa District, Riyadh, Kingdom of Saudi Arabia",
        "role":         "Chief Executive Officer",
        "shareholding": "40%",
        "shares":       "4,000",
    },
    {
        "id":           "P002",
        "name":         "Sara Mohammed Al-Mahmoud",
        "nationality":  "Omani",
        "dob":          "22 November 1985",
        "id_number":    "TEST-ID-OM-20056789",
        "id_expiry":    "21 November 2031",
        "address":      "House 18, Madinat Al Sultan Qaboos, Muscat, Sultanate of Oman",
        "role":         "Director & Head of Legal",
        "shareholding": "35%",
        "shares":       "3,500",
    },
    {
        "id":           "P003",
        "name":         "Khalid Yusuf Al-Nasser",
        "nationality":  "Saudi Arabian",
        "dob":          "03 April 1980",
        "id_number":    "TEST-ID-SA-30078901",
        "id_expiry":    "02 April 2029",
        "address":      "Apartment 22, Al-Hamra Tower, Jeddah, Kingdom of Saudi Arabia",
        "role":         "Chief Financial Officer",
        "shareholding": "25%",
        "shares":       "2,500",
    },
]

CORP_SHAREHOLDERS = [
    {
        "name":         "Gulf Holdings Group LLC",
        "cr":           "TEST-CR-UAE-GHG-001",
        "jurisdiction": "Dubai, United Arab Emirates",
        "address":      "Office 2104, DIFC Gate Village, Dubai, UAE",
        "shareholding": "40%",
        "rep_name":     "Faisal Al-Tamimi",
        "rep_title":    "Authorised Signatory",
    },
    {
        "name":         "Peninsula Capital Partners WLL",
        "cr":           "TEST-CR-BHR-PCP-002",
        "jurisdiction": "Manama, Kingdom of Bahrain",
        "address":      "Suite 810, Bahrain Financial Harbour, East Tower, Manama",
        "shareholding": "35%",
        "rep_name":     "Nadia Al-Khatib",
        "rep_title":    "Managing Director",
    },
    {
        "name":         "Arabian Investment Fund SAOC",
        "cr":           "TEST-CR-OMN-AIF-003",
        "jurisdiction": "Muscat, Sultanate of Oman",
        "address":      "Floor 6, Capital Market Tower, Muscat, Oman",
        "shareholding": "25%",
        "rep_name":     "Omar Rashid Al-Balushi",
        "rep_title":    "Fund Director",
    },
]

IP_ASSETS = [
    {
        "ref":          "TEST-PAT-KSA-2024-0011",
        "title":        "Sustained-Release Formulation for Multi-Indication Generic Analgesics",
        "category":     "Generic Medicines",
        "filing_date":  "10 January 2024",
        "grant_date":   "09 August 2024",
        "expiry_date":  "09 August 2044",
        "authority":    "Saudi Authority for Intellectual Property (SAIP), Riyadh",
        "ipc_class":    "A61K 9/22 · A61K 31/165 · A61P 29/00",
        "abstract":     (
            "A pharmaceutical composition comprising a core matrix of ibuprofen lysinate "
            "(400 mg) and paracetamol (500 mg) embedded in a hydroxypropyl methylcellulose "
            "sustained-release polymer. The formulation provides a biphasic plasma concentration "
            "profile: rapid initial release within 30 minutes followed by sustained therapeutic "
            "levels over 12 hours, reducing dosing frequency and improving patient adherence."
        ),
    },
    {
        "ref":          "TEST-PAT-OMN-2024-0022",
        "title":        "AI-Assisted Adaptive Imaging Module for Portable MRI Systems",
        "category":     "Medical Imaging Equipment",
        "filing_date":  "22 March 2024",
        "grant_date":   "15 October 2024",
        "expiry_date":  "15 October 2044",
        "authority":    "Intellectual Property Department, Ministry of Commerce, Sultanate of Oman",
        "ipc_class":    "A61B 5/055 · G01R 33/48 · G06N 3/08",
        "abstract":     (
            "A portable magnetic resonance imaging (MRI) apparatus incorporating an on-device "
            "convolutional neural network (CNN) inference engine that dynamically adjusts gradient "
            "pulse sequences based on real-time tissue contrast feedback. The system reduces "
            "acquisition time by 45 % compared to conventional fixed-sequence MRI while maintaining "
            "diagnostic image quality at ≥ 92 % radiologist agreement score."
        ),
    },
    {
        "ref":          "TEST-PAT-KSA-2024-0033",
        "title":        "Privacy-Preserving Federated Learning Algorithm for Clinical Data Aggregation",
        "category":     "Data Processing Algorithm",
        "filing_date":  "05 June 2024",
        "grant_date":   "20 December 2024",
        "expiry_date":  "20 December 2044",
        "authority":    "Saudi Authority for Intellectual Property (SAIP), Riyadh",
        "ipc_class":    "G06F 21/62 · G06N 20/00 · G16H 10/60",
        "abstract":     (
            "A federated learning protocol for multi-site clinical data aggregation that employs "
            "differential privacy noise injection (ε = 0.5, δ = 1×10⁻⁵) combined with secure "
            "multi-party computation (MPC) to train a shared prognostic model without exposing "
            "individual patient records to any participating node. The algorithm achieves model "
            "accuracy within 2 % of centralised training baselines while satisfying HIPAA, "
            "PDPL (KSA), and GDPR data-minimisation requirements."
        ),
    },
]

# ── Helper ────────────────────────────────────────────────────────────────────

def write_file(zip_obj, folder, filename, content):
    path = os.path.join(ROOT, folder, filename)
    zip_obj.writestr(path, content)
    print(f"  + {path}")

# ── 01 UBO ────────────────────────────────────────────────────────────────────

def ubo_individual(c, persons):
    lines = [
        SPECIMEN,
        "",
        "ULTIMATE BENEFICIAL OWNERSHIP DECLARATION",
        "Variant A – Individual Persons as Shareholders",
        "-" * 60,
        f"Entity Name          : {c['name']} ({c['trade_name']})",
        f"Commercial Reg. KSA  : {c['cr_ksa']}",
        f"Commercial Reg. Oman : {c['cr_oman']}",
        f"Registered Address   : {c['address_ksa']}",
        f"Declaration Date     : {TODAY}",
        f"Total Issued Shares  : 10,000  |  Share Value: SAR 500 each",
        "",
        "=" * 60,
        "SECTION 1 – SHAREHOLDER / UBO DETAILS",
        "=" * 60,
    ]
    for i, p in enumerate(persons, 1):
        lines += [
            "",
            f"UBO {i}",
            f"  Full Legal Name       : {p['name']}",
            f"  Nationality           : {p['nationality']}",
            f"  Date of Birth         : {p['dob']}",
            f"  National ID Number    : {p['id_number']}",
            f"  ID Expiry             : {p['id_expiry']}",
            f"  Residential Address   : {p['address']}",
            f"  Role in Company       : {p['role']}",
            f"  Shareholding (%)      : {p['shareholding']}",
            f"  Number of Shares      : {p['shares']}  of  10,000",
            f"  Direct / Indirect     : Direct",
            f"  Nature of Control     : Ownership & Voting Rights",
        ]
    lines += [
        "",
        "=" * 60,
        "SECTION 2 – DECLARATIONS",
        "=" * 60,
        "",
        "Each UBO declared above confirms that:",
        "  1. The information provided is accurate and complete.",
        "  2. No other person holds ≥ 25 % beneficial interest.",
        "  3. They are not a Politically Exposed Person (PEP) unless disclosed.",
        "  4. This declaration will be updated within 30 days of any change.",
        "",
        "AUTHORISED SIGNATORY",
        f"Name    : {persons[0]['name']}",
        f"Role    : {persons[0]['role']}",
        f"Date    : {TODAY}",
        "Signature: ___________________________  [SPECIMEN]",
        "",
        "WITNESSED BY",
        "Name    : Sara Mohammed Al-Mahmoud",
        "Role    : Director & Head of Legal",
        f"Date    : {TODAY}",
        "Signature: ___________________________  [SPECIMEN]",
        "",
        SPECIMEN,
    ]
    return "\n".join(lines)


def ubo_corporate(c, corps):
    lines = [
        SPECIMEN,
        "",
        "ULTIMATE BENEFICIAL OWNERSHIP DECLARATION",
        "Variant B – Corporate Entities as Shareholders",
        "-" * 60,
        f"Entity Name          : {c['name']} ({c['trade_name']})",
        f"Commercial Reg. KSA  : {c['cr_ksa']}",
        f"Commercial Reg. Oman : {c['cr_oman']}",
        f"Registered Address   : {c['address_ksa']}",
        f"Declaration Date     : {TODAY}",
        f"Total Issued Shares  : 10,000  |  Share Value: SAR 500 each",
        "",
        "=" * 60,
        "SECTION 1 – CORPORATE SHAREHOLDER DETAILS",
        "=" * 60,
    ]
    for i, s in enumerate(corps, 1):
        lines += [
            "",
            f"Corporate Shareholder {i}",
            f"  Entity Name               : {s['name']}",
            f"  Commercial Reg. No.       : {s['cr']}",
            f"  Jurisdiction              : {s['jurisdiction']}",
            f"  Registered Address        : {s['address']}",
            f"  Shareholding (%)          : {s['shareholding']}",
            f"  Authorised Representative : {s['rep_name']}  ({s['rep_title']})",
            f"  Nature of Control         : Equity Ownership & Board Nomination Rights",
        ]
    lines += [
        "",
        "=" * 60,
        "SECTION 2 – LOOK-THROUGH ANALYSIS",
        "=" * 60,
        "",
        "Gulf Holdings Group LLC     -> Ultimate individual controller: Faisal Al-Tamimi (TEST-ID-UAE-FT-001)",
        "Peninsula Capital Partners  -> Ultimate individual controller: Nadia Al-Khatib  (TEST-ID-BHR-NK-002)",
        "Arabian Investment Fund     -> Ultimate individual controller: Omar Al-Balushi   (TEST-ID-OMN-OB-003)",
        "",
        "No further layers of beneficial ownership exist beyond those declared above.",
        "",
        "=" * 60,
        "SECTION 3 – DECLARATIONS & SIGNATURES",
        "=" * 60,
        "",
        "Each representative confirms the declared information is accurate.",
        "",
        "Gulf Holdings Group LLC",
        f"Signed : Faisal Al-Tamimi  |  Date : {TODAY}  |  [SPECIMEN]",
        "",
        "Peninsula Capital Partners WLL",
        f"Signed : Nadia Al-Khatib   |  Date : {TODAY}  |  [SPECIMEN]",
        "",
        "Arabian Investment Fund SAOC",
        f"Signed : Omar Al-Balushi   |  Date : {TODAY}  |  [SPECIMEN]",
        "",
        SPECIMEN,
    ]
    return "\n".join(lines)

# ── 02 Identity Documents ─────────────────────────────────────────────────────

def identity_doc(p):
    lines = [
        SPECIMEN,
        "",
        "NATIONAL IDENTITY DOCUMENT  [SPECIMEN – TEST DATA ONLY]",
        "-" * 60,
        "Issuing Authority  : [Fictitious Authority – Test Use Only]",
        "Document Type      : National Identity Card",
        f"Document Number    : {p['id_number']}",
        "-" * 60,
        f"Full Name          : {p['name']}",
        f"Date of Birth      : {p['dob']}",
        f"Nationality        : {p['nationality']}",
        f"Address            : {p['address']}",
        f"Issue Date         : 01 January 2020  [SPECIMEN]",
        f"Expiry Date        : {p['id_expiry']}",
        "-" * 60,
        "  [ PHOTO PLACEHOLDER – SPECIMEN ]",
        "  [ SIGNATURE PLACEHOLDER – SPECIMEN ]",
        "-" * 60,
        "",
        "NOTE: This document contains no machine-readable zone (MRZ),",
        "no biometric data, and no security features. It is a plain-text",
        "test record only.",
        "",
        SPECIMEN,
    ]
    return "\n".join(lines)

# ── 03 POA Documents ──────────────────────────────────────────────────────────

def poa_banking(c, grantor, grantee_name, grantee_id):
    return "\n".join([
        SPECIMEN,
        "",
        "POWER OF ATTORNEY – BANKING OPERATIONS",
        "-" * 60,
        f"Reference No.   : TEST-POA-BANK-{c['cr_ksa'][-4:]}-2024",
        f"Date            : {TODAY}",
        f"Jurisdiction    : Kingdom of Saudi Arabia",
        "",
        "GRANTOR",
        f"  Company : {c['name']}",
        f"  CR No.  : {c['cr_ksa']}",
        f"  Address : {c['address_ksa']}",
        f"  Rep.    : {grantor['name']}  ({grantor['role']})",
        f"  ID No.  : {grantor['id_number']}",
        "",
        "ATTORNEY-IN-FACT (GRANTEE)",
        f"  Name    : {grantee_name}",
        f"  ID No.  : {grantee_id}",
        f"  Address : {c['address_ksa']}",
        "",
        "SCOPE OF AUTHORITY",
        "The Attorney-in-Fact is hereby authorised, on behalf of the Grantor, to:",
        "  1. Open, operate, and close current, savings, and trade-finance accounts.",
        "  2. Sign cheques, demand drafts, and payment instructions up to SAR 500,000",
        "     per transaction without further approval.",
        "  3. Execute wire transfers, SWIFT messages, and SADAD payment orders.",
        "  4. Negotiate and execute Letters of Credit (LC) and Bank Guarantees.",
        "  5. Receive bank statements, SWIFT confirmations, and correspondence.",
        "  6. Represent the Company before any bank or financial institution in KSA.",
        "  7. Delegate specific sub-authorities to named officers in writing.",
        "",
        "LIMITATIONS",
        "  - Does not extend to real estate mortgages or share pledges.",
        "  - Any single transaction exceeding SAR 500,000 requires co-signature of CFO.",
        "",
        "VALIDITY",
        f"  Effective : {TODAY}",
        "  Expiry    : 31 December 2026  [SPECIMEN]",
        "",
        "GRANTOR SIGNATURE",
        f"  {grantor['name']}  |  {grantor['role']}  |  {TODAY}",
        "  [SPECIMEN SIGNATURE]",
        "",
        "NOTARISATION",
        "  Notary Public : [Fictitious Notary – Test Only]",
        "  Notary Seal   : [SPECIMEN SEAL]",
        "  Attestation No.: TEST-NOT-2024-00001",
        "",
        SPECIMEN,
    ])


def poa_government(c, grantor, grantee_name, grantee_id):
    return "\n".join([
        SPECIMEN,
        "",
        "POWER OF ATTORNEY – GOVERNMENT & REGULATORY AFFAIRS",
        "-" * 60,
        f"Reference No.   : TEST-POA-GOVT-{c['cr_ksa'][-4:]}-2024",
        f"Date            : {TODAY}",
        f"Jurisdiction    : Kingdom of Saudi Arabia & Sultanate of Oman",
        "",
        "GRANTOR",
        f"  Company : {c['name']}",
        f"  CR KSA  : {c['cr_ksa']}  |  CR Oman: {c['cr_oman']}",
        f"  Rep.    : {grantor['name']}  ({grantor['role']})",
        "",
        "ATTORNEY-IN-FACT (GRANTEE)",
        f"  Name    : {grantee_name}",
        f"  ID No.  : {grantee_id}",
        "",
        "SCOPE OF AUTHORITY",
        "  1. Submit and collect commercial registration documents from MISA, MCI (KSA),",
        "     and MOCIIP (Oman).",
        "  2. Attend and represent the Company before ZAKAT / Tax Authority (ZATCA).",
        "  3. File annual returns, statistical reports, and ESG disclosures.",
        "  4. Obtain, renew, and surrender operational licences.",
        "  5. Correspond with Ministry of Health for pharmaceutical product approvals.",
        "  6. Sign Memoranda of Understanding with government entities.",
        "  7. Submit and respond to regulatory inquiries on the Company's behalf.",
        "",
        "VALIDITY",
        f"  Effective : {TODAY}",
        "  Expiry    : 31 December 2025  [SPECIMEN]",
        "",
        "GRANTOR SIGNATURE  : [SPECIMEN]",
        "NOTARISATION       : TEST-NOT-2024-00002  [SPECIMEN]",
        "",
        SPECIMEN,
    ])


def poa_legal(c, grantor, grantee_name, grantee_id):
    return "\n".join([
        SPECIMEN,
        "",
        "POWER OF ATTORNEY – LEGAL PROCEEDINGS",
        "-" * 60,
        f"Reference No.   : TEST-POA-LEGAL-{c['cr_ksa'][-4:]}-2024",
        f"Date            : {TODAY}",
        f"Jurisdiction    : Kingdom of Saudi Arabia",
        "",
        "GRANTOR",
        f"  Company : {c['name']}",
        f"  CR No.  : {c['cr_ksa']}",
        f"  Rep.    : {grantor['name']}  ({grantor['role']})",
        "",
        "ATTORNEY-IN-FACT (GRANTEE / LEGAL COUNSEL)",
        f"  Name         : {grantee_name}",
        f"  Bar Reg. No. : TEST-BAR-KSA-20240055  [SPECIMEN]",
        "",
        "SCOPE OF AUTHORITY",
        "  1. Appear, plead, and act before all courts, tribunals, and arbitration panels.",
        "  2. File, withdraw, and settle civil, commercial, and IP proceedings.",
        "  3. Accept service of process on behalf of the Company.",
        "  4. Engage expert witnesses and forensic consultants.",
        "  5. Execute settlement agreements up to SAR 2,000,000 with Board ratification.",
        "  6. Apply for and oppose injunctions and interim relief measures.",
        "",
        "VALIDITY",
        f"  Effective : {TODAY}",
        "  Expiry    : 31 December 2026  [SPECIMEN]",
        "",
        "GRANTOR SIGNATURE  : [SPECIMEN]",
        "NOTARISATION       : TEST-NOT-2024-00003  [SPECIMEN]",
        "",
        SPECIMEN,
    ])

# ── 04 MOA ────────────────────────────────────────────────────────────────────

def moa(c, persons):
    preamble = textwrap.dedent(f"""
        {SPECIMEN}

        MEMORANDUM OF ASSOCIATION
        {c['name']} ({c['trade_name']})
        {"─" * 60}
        Document Ref.  : TEST-MOA-{c['cr_ksa'][-4:]}-2024
        Date           : {TODAY}
        Governing Law  : Companies Law, KSA (Royal Decree M/3, 1437H)

        PREAMBLE
        The undersigned parties hereby agree to form a Limited Liability Company (LLC)
        under the laws of the Kingdom of Saudi Arabia with the following terms.

        {"=" * 60}
        ARTICLE 1 – COMPANY NAME & TRADE NAME
        {"=" * 60}
        1.1  Legal Name  : {c['name']}
        1.2  Trade Name  : {c['trade_name']}
        1.3  The Company shall conduct business under the trade name registered
             with the Ministry of Commerce and Investment (MCI).

        {"=" * 60}
        ARTICLE 2 – HEAD OFFICE & BRANCHES
        {"=" * 60}
        2.1  Head Office (KSA) : {c['address_ksa']}
        2.2  Branch (Oman)     : {c['address_oman']}
        2.3  The Board of Directors may establish additional branches by resolution.

        {"=" * 60}
        ARTICLE 3 – OBJECTS & ACTIVITIES
        {"=" * 60}
        3.1  The primary objects of the Company are:
             (a) Research, development, manufacture, and distribution of generic
                 pharmaceutical products including analgesics, anti-infectives,
                 and cardiovascular agents.
             (b) Import, supply, and maintenance of medical imaging equipment
                 including MRI, CT, and ultrasound systems.
             (c) Development and licensing of proprietary data-processing algorithms
                 for clinical decision support and health informatics.
             (d) Any ancillary or incidental activity necessary to achieve the above.

        {"=" * 60}
        ARTICLE 4 – SHARE CAPITAL
        {"=" * 60}
        4.1  Authorised Capital : SAR 10,000,000
        4.2  Issued Capital     : {c['capital_ksa']}
        4.3  Total Shares       : 10,000 ordinary shares at SAR 500 each
        4.4  Shares are fully paid-up at incorporation.
        4.5  Share transfer requires consent of all shareholders per Article 9.

        {"=" * 60}
        ARTICLE 5 – SHAREHOLDERS & SHAREHOLDING
        {"=" * 60}
    """).strip()

    sh_block = ""
    for i, p in enumerate(persons, 1):
        sh_block += (
            f"\n  Shareholder {i}: {p['name']}\n"
            f"    ID           : {p['id_number']}\n"
            f"    Nationality  : {p['nationality']}\n"
            f"    Shares       : {p['shares']}  ({p['shareholding']})\n"
            f"    Contribution : SAR {int(p['shares'].replace(',', '')) * 500:,}\n"
        )

    rest = textwrap.dedent(f"""

        {"=" * 60}
        ARTICLE 6 – MANAGEMENT & DIRECTORS
        {"=" * 60}
        6.1  The Company shall be managed by a Board of Directors of not fewer
             than three (3) and not more than seven (7) members.
        6.2  First Board Composition:
             - {persons[0]['name']}   – Chief Executive Officer
             - {persons[1]['name']}   – Director & Head of Legal
             - {persons[2]['name']}   – Chief Financial Officer
        6.3  Board term: three (3) years, renewable.
        6.4  Quorum for Board meetings: majority of members present in person or
             via approved electronic means.

        {"=" * 60}
        ARTICLE 7 – FINANCIAL YEAR & ACCOUNTS
        {"=" * 60}
        7.1  Financial Year: 1 January to 31 December.
        7.2  Accounts shall be audited annually by a registered external auditor.
        7.3  Statutory reserve: 10 % of net profit until reserve equals 30 % of capital.

        {"=" * 60}
        ARTICLE 8 – PROFIT & LOSS DISTRIBUTION
        {"=" * 60}
        8.1  After statutory reserve, remaining profits distributed pro-rata to shares.
        8.2  Losses absorbed pro-rata to shareholding.

        {"=" * 60}
        ARTICLE 9 – SHARE TRANSFER
        {"=" * 60}
        9.1  No shareholder may transfer shares to a third party without first offering
             them pro-rata to existing shareholders (right of first refusal, 30 days).
        9.2  Any transfer must be registered with MCI within 30 days of completion.

        {"=" * 60}
        ARTICLE 10 – DISSOLUTION & LIQUIDATION
        {"=" * 60}
        10.1 The Company may be dissolved by unanimous shareholder resolution or
             by court order.
        10.2 Liquidator to be appointed by shareholders; surplus distributed pro-rata.

        {"=" * 60}
        SIGNATURES
        {"=" * 60}
        {persons[0]['name']}   – {TODAY}  [SPECIMEN]
        {persons[1]['name']}   – {TODAY}  [SPECIMEN]
        {persons[2]['name']}   – {TODAY}  [SPECIMEN]

        NOTARISATION : TEST-NOT-2024-00004  |  [SPECIMEN SEAL]

        {SPECIMEN}
    """).strip()

    return preamble + sh_block + rest

# ── 05 Registration & Operation Certificates ─────────────────────────────────

def reg_cert_ksa(c):
    return "\n".join([
        SPECIMEN,
        "",
        "COMMERCIAL REGISTRATION CERTIFICATE",
        "Ministry of Commerce – Kingdom of Saudi Arabia",
        "[SPECIMEN – NOT AN OFFICIAL GOVERNMENT DOCUMENT]",
        "-" * 60,
        f"CR Number          : {c['cr_ksa']}",
        f"Company Name       : {c['name']}",
        f"Trade Name         : {c['trade_name']}",
        f"Legal Form         : Limited Liability Company (LLC)",
        f"Date of Formation  : {c['formed_date']}",
        f"Registered Capital : {c['capital_ksa']}",
        f"Head Office        : {c['address_ksa']}",
        f"Business Activity  : {c['activity']}",
        f"CR Issue Date      : 01 March 2020  [SPECIMEN]",
        f"CR Expiry Date     : 28 February 2026  [SPECIMEN]",
        f"CR Renewal Due     : 01 December 2025",
        "",
        "Authorised Activities (ISIC Codes – SPECIMEN):",
        "  2100 – Manufacture of pharmaceuticals",
        "  2660 – Manufacture of irradiation & electromedical equipment",
        "  6201 – Computer programming activities",
        "",
        "Issuing Officer : [Fictitious Registrar – SPECIMEN]",
        "Official Stamp  : [SPECIMEN STAMP]",
        "",
        SPECIMEN,
    ])


def reg_cert_oman(c):
    return "\n".join([
        SPECIMEN,
        "",
        "COMMERCIAL REGISTRATION CERTIFICATE",
        "Ministry of Commerce, Industry and Investment Promotion – Sultanate of Oman",
        "[SPECIMEN – NOT AN OFFICIAL GOVERNMENT DOCUMENT]",
        "-" * 60,
        f"CR Number          : {c['cr_oman']}",
        f"Company Name       : {c['name']} (Branch)",
        f"Trade Name         : {c['trade_name']}",
        f"Legal Form         : Branch of Foreign Company",
        f"Head Office        : {c['address_ksa']}",
        f"Branch Address     : {c['address_oman']}",
        f"Registered Capital : {c['capital_oman']}",
        f"Business Activity  : {c['activity']}",
        f"CR Issue Date      : 15 September 2021  [SPECIMEN]",
        f"CR Expiry Date     : 14 September 2026  [SPECIMEN]",
        "",
        "Wilayat (Governorate) : Muscat",
        "Branch Manager        : Sara Mohammed Al-Mahmoud",
        "",
        "Issuing Officer : [Fictitious Registrar – SPECIMEN]",
        "Official Stamp  : [SPECIMEN STAMP]",
        "",
        SPECIMEN,
    ])


def op_cert_ksa(c):
    return "\n".join([
        SPECIMEN,
        "",
        "MUNICIPAL OPERATING LICENCE",
        "Amanah (Municipality) – Riyadh Region – Kingdom of Saudi Arabia",
        "[SPECIMEN – NOT AN OFFICIAL GOVERNMENT DOCUMENT]",
        "-" * 60,
        f"Licence No.        : TEST-OL-RUH-2024-0055",
        f"Company            : {c['name']}",
        f"CR Reference       : {c['cr_ksa']}",
        f"Licensed Premises  : {c['address_ksa']}",
        f"Licensed Activities:",
        "  - Pharmaceutical product distribution (wholesale)",
        "  - Medical imaging equipment sales & service",
        "  - Software development office",
        f"Issue Date         : 01 June 2024  [SPECIMEN]",
        f"Expiry Date        : 31 May 2026  [SPECIMEN]",
        "",
        "Health & Safety Compliance : Verified  [SPECIMEN]",
        "Fire Safety Clearance      : Approved  [SPECIMEN]",
        "",
        "Issuing Authority : [Fictitious Municipal Officer – SPECIMEN]",
        "Official Stamp    : [SPECIMEN STAMP]",
        "",
        SPECIMEN,
    ])


def op_cert_oman(c):
    return "\n".join([
        SPECIMEN,
        "",
        "COMMERCIAL OPERATING CERTIFICATE",
        "Ministry of Commerce, Industry and Investment Promotion – Sultanate of Oman",
        "[SPECIMEN – NOT AN OFFICIAL GOVERNMENT DOCUMENT]",
        "-" * 60,
        f"Certificate No.    : TEST-OC-MCT-2024-0088",
        f"Company            : {c['name']} (Branch)",
        f"CR Reference       : {c['cr_oman']}",
        f"Licensed Premises  : {c['address_oman']}",
        f"Licensed Activities:",
        "  - Import and distribution of registered pharmaceutical products",
        "  - Sale and technical support of medical imaging equipment",
        f"Issue Date         : 20 November 2021  [SPECIMEN]",
        f"Expiry Date        : 19 November 2026  [SPECIMEN]",
        "",
        "Issuing Authority : [Fictitious Registrar – SPECIMEN]",
        "Official Stamp    : [SPECIMEN STAMP]",
        "",
        SPECIMEN,
    ])

# ── 06 IP / Patent Documents ──────────────────────────────────────────────────

def patent_doc(asset, c):
    return "\n".join([
        SPECIMEN,
        "",
        "PATENT GRANT CERTIFICATE",
        f"Category : {asset['category']}",
        f"Issuing Authority : {asset['authority']}",
        "[SPECIMEN – NOT AN OFFICIAL GOVERNMENT DOCUMENT]",
        "-" * 60,
        f"Patent Reference No.  : {asset['ref']}",
        f"Title                 : {asset['title']}",
        f"IPC Classification    : {asset['ipc_class']}",
        "-" * 60,
        "",
        "PATENT OWNER (ASSIGNEE)",
        f"  Name      : {c['name']} ({c['trade_name']})",
        f"  CR No.    : {c['cr_ksa']}",
        f"  Address   : {c['address_ksa']}",
        "",
        "INVENTORS",
        f"  1. Ahmed Khalid Al-Rashidi  –  Riyadh, KSA  (TEST ID: TEST-ID-SA-10012345)",
        f"  2. Sara Mohammed Al-Mahmoud  –  Muscat, Oman  (TEST ID: TEST-ID-OM-20056789)",
        "",
        "KEY DATES",
        f"  Filing Date  : {asset['filing_date']}",
        f"  Grant Date   : {asset['grant_date']}",
        f"  Expiry Date  : {asset['expiry_date']}  (20 years from filing)",
        "",
        "ABSTRACT",
        textwrap.fill(asset['abstract'], width=70),
        "",
        "CLAIMS (ABBREVIATED – SPECIMEN)",
        "  Claim 1 (Independent): A composition / apparatus / method as defined",
        "    in the Abstract above, characterised by the novel combination of",
        "    elements described in the detailed description.",
        "  Claim 2 (Dependent): The subject matter of Claim 1, further comprising",
        "    optional feature A.",
        "  Claim 3 (Dependent): The subject matter of Claim 1, wherein parameter B",
        "    falls within the range specified.",
        "  [Full claim set available in the detailed specification – SPECIMEN]",
        "",
        "ASSIGNMENT RECORD",
        f"  Assigned to : {c['name']}",
        f"  Assignment Date : {asset['filing_date']}",
        "  Assignment Recorded : Yes  [SPECIMEN]",
        "",
        "MAINTENANCE FEES",
        "  Year 1-4  : SAR 2,000 / OMR 200  – PAID [SPECIMEN]",
        "  Year 5+   : Due annually on grant anniversary",
        "",
        "GRANT AUTHORISATION",
        f"  Registrar : [Fictitious IP Registrar – SPECIMEN]",
        "  Seal      : [SPECIMEN SEAL]",
        "",
        SPECIMEN,
    ])

# ── 07 Contracts ──────────────────────────────────────────────────────────────

def contract_software_support(c, signatory):
    return "\n".join([
        SPECIMEN,
        "",
        "SERVICE AGREEMENT – THIRD-PARTY SOFTWARE SUPPORT",
        "-" * 60,
        f"Contract Ref.    : TEST-CTR-SW-{c['cr_ksa'][-4:]}-2024",
        f"Agreement Date   : {TODAY}",
        "",
        "PARTY A  (CLIENT)",
        f"  Name    : {c['name']}",
        f"  CR No.  : {c['cr_ksa']}",
        f"  Address : {c['address_ksa']}",
        f"  Rep.    : {signatory['name']}  ({signatory['role']})",
        "",
        "PARTY B  (SERVICE PROVIDER)",
        "  Name    : TechSolve Arabia LLC  [FICTITIOUS]",
        "  CR No.  : TEST-CR-KSA-TS-99001",
        "  Address : Office 610, Al Faisaliah Tower, Riyadh, KSA",
        "  Rep.    : Mohammed Al-Harbi  (Managing Director)  [FICTITIOUS]",
        "",
        "SCOPE OF SERVICES",
        "  1. 24×7 technical support for Enterprise Resource Planning (ERP) system.",
        "  2. Application patch management and quarterly security updates.",
        "  3. Database performance tuning and backup verification (monthly).",
        "  4. Helpdesk ticket resolution: P1 < 2 hrs, P2 < 8 hrs, P3 < 48 hrs.",
        "  5. Annual disaster recovery drill and report.",
        "",
        "COMMERCIAL TERMS",
        "  Annual Fee        : SAR 480,000 (exclusive of VAT)",
        "  Payment Schedule  : Quarterly in advance (SAR 120,000 per quarter)",
        "  VAT (15%)         : SAR 72,000 per annum",
        "  Late Payment      : 2 % per month on overdue balance",
        "",
        "SERVICE LEVELS (SLA)",
        "  System Uptime     : 99.5 % per calendar month",
        "  Penalty           : 5 % fee credit per 0.5 % breach below SLA",
        "",
        "CONTRACT TERM",
        f"  Start Date : {TODAY}",
        "  End Date   : 31 March 2027  [SPECIMEN]",
        "  Renewal    : Automatic 12-month renewal unless 90-day notice given",
        "",
        "GOVERNING LAW : Kingdom of Saudi Arabia",
        "DISPUTE RESOLUTION : SCCA Arbitration, Riyadh  [SPECIMEN]",
        "",
        "SIGNATURES",
        f"  Party A : {signatory['name']}  |  {TODAY}  [SPECIMEN]",
        "  Party B : Mohammed Al-Harbi     |  [DATE]  [SPECIMEN]",
        "",
        SPECIMEN,
    ])


def contract_pro_services(c, signatory):
    return "\n".join([
        SPECIMEN,
        "",
        "SERVICE AGREEMENT – PUBLIC RELATIONS OFFICER (PRO) SERVICES",
        "-" * 60,
        f"Contract Ref.    : TEST-CTR-PRO-{c['cr_ksa'][-4:]}-2024",
        f"Agreement Date   : {TODAY}",
        "",
        "PARTY A  (CLIENT)",
        f"  Name    : {c['name']}",
        f"  CR No.  : {c['cr_ksa']}  |  CR Oman: {c['cr_oman']}",
        f"  Address : {c['address_ksa']}",
        f"  Rep.    : {signatory['name']}  ({signatory['role']})",
        "",
        "PARTY B  (PRO SERVICE PROVIDER)",
        "  Name    : Gulf Business Services FZE  [FICTITIOUS]",
        "  CR No.  : TEST-CR-KSA-GBS-88002",
        "  Address : Suite 201, Al Olaya District, Riyadh, KSA",
        "  PRO     : Tariq Al-Dosari  (Senior PRO)  [FICTITIOUS]",
        "",
        "SCOPE OF SERVICES",
        "  1. Visa processing: employee, dependent, and visit visas (KSA & Oman).",
        "  2. Work permit applications, renewals, and cancellations (QIWA / MOL).",
        "  3. Iqama (residency permit) issuance, renewal, and exit/re-entry permits.",
        "  4. Commercial registration renewals with MCI (KSA) and MOCIIP (Oman).",
        "  5. Municipality licence renewals and Baladiya inspections.",
        "  6. Chamber of Commerce membership renewal and certificate of origin.",
        "  7. Attestation and legalisation of corporate documents.",
        "",
        "COMMERCIAL TERMS",
        "  Monthly Retainer  : SAR 15,000  (inclusive of up to 20 transactions/month)",
        "  Excess Transaction : SAR 300 each above 20/month",
        "  Government Fees   : Charged at cost + 5 % handling fee",
        "  Payment           : 1st of each month",
        "",
        "CONTRACT TERM",
        f"  Start Date : {TODAY}",
        "  End Date   : 31 December 2026  [SPECIMEN]",
        "",
        "GOVERNING LAW : Kingdom of Saudi Arabia",
        "",
        "SIGNATURES",
        f"  Party A : {signatory['name']}  |  {TODAY}  [SPECIMEN]",
        "  Party B : Tariq Al-Dosari      |  [DATE]  [SPECIMEN]",
        "",
        SPECIMEN,
    ])

# ── 08 Litigation ─────────────────────────────────────────────────────────────

def litigation_patent(c, signatory, ip):
    return "\n".join([
        SPECIMEN,
        "",
        "NOTICE OF PATENT INFRINGEMENT CLAIM",
        "& STATEMENT OF CASE",
        "-" * 60,
        f"Case Reference   : TEST-LIT-PAT-{c['cr_ksa'][-4:]}-2024-001",
        f"Date Filed       : {TODAY}",
        "Forum            : Commercial Court – Riyadh  [SPECIMEN]",
        "",
        "CLAIMANT",
        f"  Name    : {c['name']} ({c['trade_name']})",
        f"  CR No.  : {c['cr_ksa']}",
        f"  Address : {c['address_ksa']}",
        f"  Counsel : [Fictitious Law Firm – SPECIMEN]",
        f"  POA Ref.: TEST-POA-LEGAL-{c['cr_ksa'][-4:]}-2024",
        "",
        "RESPONDENT",
        "  Name    : MediTech Innovations Co. LLC  [FICTITIOUS]",
        "  CR No.  : TEST-CR-KSA-MTI-77003",
        "  Address : Building 9, King Abdullah Financial District, Riyadh, KSA",
        "",
        "PATENT IN SUIT",
        f"  Patent No. : {ip['ref']}",
        f"  Title      : {ip['title']}",
        f"  Grant Date : {ip['grant_date']}",
        f"  Owner      : {c['name']}",
        "",
        "STATEMENT OF FACTS",
        "  1. The Claimant is the registered owner of Patent No. " + ip['ref'] + ",",
        "     duly granted by " + ip['authority'] + ".",
        "  2. The Respondent has, without licence or authority, manufactured and",
        "     commercially distributed a product designated 'MTI-ImagePro v3.0'",
        "     which embodies each element of Claims 1, 2, and 3 of the Patent.",
        "  3. The Claimant first became aware of the infringing product on",
        "     01 October 2024 following market surveillance.",
        "  4. A cease-and-desist letter was dispatched on 15 October 2024.",
        "     The Respondent failed to respond within the stipulated 14-day period.",
        "",
        "HEADS OF CLAIM",
        "  A. Declaration of infringement of Patent " + ip['ref'] + ".",
        "  B. Permanent injunction restraining further manufacture, sale, or offer",
        "     for sale of the infringing product.",
        "  C. Delivery up or destruction of infringing stock.",
        "  D. Account of profits or damages (to be assessed), estimated at",
        "     SAR 3,500,000 based on market analysis.",
        "  E. Costs and legal fees.",
        "",
        "EVIDENCE BUNDLE INDEX  [SPECIMEN]",
        "  Exhibit A : Patent Grant Certificate " + ip['ref'],
        "  Exhibit B : Assignment record confirming ownership",
        "  Exhibit C : Market surveillance report (01 Oct 2024)",
        "  Exhibit D : Cease-and-desist letter (15 Oct 2024) & delivery receipt",
        "  Exhibit E : Technical comparison report by independent expert",
        "  Exhibit F : Sales data and lost-profit analysis",
        "",
        "RELIEF SOUGHT",
        "  The Claimant respectfully requests the Court to:",
        "  1. Issue an interim injunction pending full hearing.",
        "  2. Order the Respondent to disclose all infringement-related accounts.",
        "  3. Grant the reliefs listed under Heads of Claim above.",
        "",
        "CERTIFICATION",
        "  I, the undersigned, certify that the facts stated herein are true",
        "  to the best of my knowledge.",
        "",
        f"  {signatory['name']}  |  {signatory['role']}  |  {TODAY}",
        "  [SPECIMEN SIGNATURE]",
        "",
        "FILED BY COUNSEL : [Fictitious Law Firm – SPECIMEN]",
        "COURT STAMP      : [SPECIMEN STAMP]",
        "",
        SPECIMEN,
    ])

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    zip_path = "SKM_LLC_Test_Documents.zip"
    print(f"\nGenerating test documents → {zip_path}\n")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:

        # 01 UBO
        write_file(zf, "01_UBO", "UBO_A_Individual_Shareholders.txt",
                   ubo_individual(COMPANY, PERSONS))
        write_file(zf, "01_UBO", "UBO_B_Corporate_Shareholders.txt",
                   ubo_corporate(COMPANY, CORP_SHAREHOLDERS))

        # 02 Identity Documents
        for p in PERSONS:
            fname = f"ID_{p['name'].replace(' ', '_')}.txt"
            write_file(zf, "02_Identity_Documents", fname, identity_doc(p))

        # 03 POA
        ceo, director, cfo = PERSONS
        write_file(zf, "03_POA", "POA_Banking.txt",
                   poa_banking(COMPANY, ceo, director['name'], director['id_number']))
        write_file(zf, "03_POA", "POA_Government_Regulatory.txt",
                   poa_government(COMPANY, ceo, director['name'], director['id_number']))
        write_file(zf, "03_POA", "POA_Legal_Proceedings.txt",
                   poa_legal(COMPANY, ceo, "Abdullah Al-Qahtani [FICTITIOUS]",
                              "TEST-BAR-KSA-20240055"))

        # 04 MOA
        write_file(zf, "04_MOA", "MOA_SKM_LLC.txt", moa(COMPANY, PERSONS))

        # 05 Registration & Operation Certificates
        write_file(zf, "05_Registration_Certificates", "Registration_KSA.txt",
                   reg_cert_ksa(COMPANY))
        write_file(zf, "05_Registration_Certificates", "Registration_Oman.txt",
                   reg_cert_oman(COMPANY))
        write_file(zf, "05_Registration_Certificates", "Operating_Licence_KSA.txt",
                   op_cert_ksa(COMPANY))
        write_file(zf, "05_Registration_Certificates", "Operating_Certificate_Oman.txt",
                   op_cert_oman(COMPANY))

        # 06 IP / Patents
        for asset in IP_ASSETS:
            fname = f"Patent_{asset['category'].replace(' ', '_')}.txt"
            write_file(zf, "06_IP_Patents", fname, patent_doc(asset, COMPANY))

        # 07 Contracts
        write_file(zf, "07_Contracts", "Contract_3rd_Party_Software_Support.txt",
                   contract_software_support(COMPANY, PERSONS[0]))
        write_file(zf, "07_Contracts", "Contract_PRO_Services.txt",
                   contract_pro_services(COMPANY, PERSONS[0]))

        # 08 Litigation
        write_file(zf, "08_Litigation", "Litigation_Patent_Infringement.txt",
                   litigation_patent(COMPANY, PERSONS[0], IP_ASSETS[1]))

        # README
        readme = "\n".join([
            "SKM LLC – GRC APPLICATION TEST DOCUMENT PACK",
            "=" * 50,
            "",
            "IMPORTANT: ALL DOCUMENTS ARE SPECIMEN/TEST DATA",
            "No real persons, companies, or government records are represented.",
            "Generated by: generate_test_documents.py",
            f"Generated on: {TODAY}",
            "",
            "FOLDER STRUCTURE",
            "  01_UBO/                      – UBO declarations (2 variants)",
            "  02_Identity_Documents/       – National ID specimens for 3 individuals",
            "  03_POA/                      – Powers of Attorney (Banking/Govt/Legal)",
            "  04_MOA/                      – Memorandum of Association",
            "  05_Registration_Certificates/ – CR & Operating licences (KSA + Oman)",
            "  06_IP_Patents/               – Patent grants (3 assets)",
            "  07_Contracts/                – Vendor contracts (SW support + PRO)",
            "  08_Litigation/               – Patent infringement case filing",
            "",
            "KEY TEST PERSONAS",
            "  CEO : Ahmed Khalid Al-Rashidi  (40 % shareholder)",
            "  Dir : Sara Mohammed Al-Mahmoud (35 % shareholder)",
            "  CFO : Khalid Yusuf Al-Nasser  (25 % shareholder)",
            "",
            "All document cross-references (POA refs, CR numbers, patent nos.)",
            "are consistent across the pack for realistic end-to-end testing.",
        ])
        write_file(zf, "", "README.txt", readme)

    print(f"\n✓ Created {zip_path}")
    size = os.path.getsize(zip_path)
    print(f"  Size : {size:,} bytes  ({size // 1024} KB)")
    print("\nFolder summary:")
    print("  01_UBO                      – 2 files")
    print("  02_Identity_Documents       – 3 files")
    print("  03_POA                      – 3 files")
    print("  04_MOA                      – 1 file")
    print("  05_Registration_Certificates – 4 files")
    print("  06_IP_Patents               – 3 files")
    print("  07_Contracts                – 2 files")
    print("  08_Litigation               – 1 file")
    print("  README.txt                  – 1 file")
    print(f"\nTotal: 20 documents across 9 folders\n")


if __name__ == "__main__":
    main()
