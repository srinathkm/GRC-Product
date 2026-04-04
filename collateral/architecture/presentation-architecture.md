# Regulation Changes Dashboard — End-to-End Architecture (Client & Prospect Deck)

**Purpose:** Single reference for **presentation slides** — system context, major components, data flows, and external dependencies.  
**Audience:** Clients, prospects, security reviewers (high level, not implementation detail).

---

## 1. One-page system context

Who touches the system and what sits outside the product boundary.

```mermaid
flowchart LR
  subgraph users [Users]
    U1[Legal & Compliance]
    U2[Governance & Risk]
    U3[Data Security]
    U4[Executive / Board]
  end

  subgraph product [Product boundary]
    WEB[GRC Web Application]
  end

  subgraph external [External services optional]
    LLM[LLM API<br/>OpenAI-compatible]
    SMTP[Email SMTP]
    SP[SharePoint optional]
  end

  subgraph data [Enterprise data]
    JSON[(JSON registers<br/>& feeds)]
    UP[Uploaded documents<br/>PDF Word images]
  end

  users --> WEB
  WEB --> JSON
  WEB --> UP
  WEB -.->|extract enrich assist| LLM
  WEB -.-> SMTP
  WEB -.-> SP
```

---

## 2. Application architecture (containers)

**Runtime:** Browser SPA talks to a **Node.js REST API**. Development uses Vite proxy; production can serve the built SPA from the same origin.

```mermaid
flowchart TB
  subgraph browser [Browser]
    SPA[React SPA<br/>Vite build]
  end

  subgraph api [API server Node.js]
    EXP[Express HTTP]
    subgraph routes [REST modules]
      R1[Governance & changes]
      R2[Legal registers]
      R3[UBO & ownership graph]
      R4[Data compliance]
      R5[Dashboard & dependency intelligence]
      R6[Tasks audit board pack]
    end
    EXP --> routes
  end

  subgraph services [Domain services]
    FEED[Regulatory feed scheduler]
    AI[AI assistant & extraction]
    DEP[Dependency intelligence engine]
    MA[M&A scenario engine]
  end

  subgraph persistence [Persistence]
    FS[(server/data JSON)]
    UP2[(Uploads & extracts)]
    OG[(Ownership graphs store)]
  end

  SPA -->|HTTPS /api| EXP
  routes --> services
  services --> FS
  routes --> UP2
  routes --> OG
  AI -.->|optional| LLM2[LLM provider]
```

---

## 3. Domain map (what the product covers)

Groupings align with navigation and API routes — useful for **capability slides**.

```mermaid
flowchart LR
  subgraph g [Governance & regulatory]
    GF[Governance framework]
    RC[Regulatory changes feed]
    MJ[Multi-jurisdiction]
  end

  subgraph l [Legal & entity]
    POA[POA IP Licences]
    LIT[Litigations contracts]
    UBO[UBO register]
    OG2[Ownership graph]
  end

  subgraph d [Data & security]
    DS[Data sovereignty]
    DC[Data compliance governance]
    DF[Defender integration]
  end

  subgraph i [Intelligence & ops]
    MD[Management dashboard]
    DI[Dependency intelligence]
    AN[Analysis & M&A]
    TK[Tasks & audit]
  end

  g --- l
  l --- d
  d --- i
```

---

## 4. Request path (typical user action)

**Example:** Open Management Dashboard → aggregated KPIs from stored JSON and computed metrics.

```mermaid
sequenceDiagram
  participant User
  participant SPA as React SPA
  participant API as Express /api
  participant Dash as Dashboard route
  participant Data as server/data JSON

  User->>SPA: Navigate to view
  SPA->>API: GET /api/dashboard/...
  API->>Dash: Load handlers
  Dash->>Data: Read JSON stores
  Data-->>Dash: Registers metrics
  Dash-->>API: JSON response
  API-->>SPA: 200 + payload
  SPA-->>User: Render dashboard
```

---

## 5. AI-assisted flows (optional)

When `LLM_API_KEY` is configured, document extraction, ownership graph parsing, and the global assistant use the same LLM abstraction.

```mermaid
flowchart LR
  DOC[Uploaded PDF or Word]
  TE[Text extraction]
  LLM[LLM completion]
  OUT[Structured JSON to UI]

  DOC --> TE --> LLM --> OUT
```

If the key is absent, those features **degrade gracefully** (empty graph, message to enable LLM, etc.) — important for **on-prem or air-gapped** discussions.

---

## 6. Deployment shapes (talk track)

| Shape | Description |
|--------|-------------|
| **Local dev** | `client` Vite :5173 → proxy → `server` :3001 |
| **Single host** | Build client to `client/dist`, copy to `server/public`, one Node process |
| **Container** | Optional Docker: same image serves API + static UI |

---

## 7. Using this in slides

1. **Slide 1 — Context:** Section 1 diagram (who + boundary).  
2. **Slide 2 — Architecture:** Section 2 (containers).  
3. **Slide 3 — Capabilities:** Section 3 (domain map).  
4. **Slide 4 — Data & AI:** Sections 4–5 (optional second slide for AI).  
5. **Slide 5 — Deployment:** Section 6 table.

**Export:** Copy Mermaid into [Mermaid Live Editor](https://mermaid.live), export **PNG/SVG** for PowerPoint/Keynote/Google Slides.  
**Vector:** Use [`architecture-e2e.svg`](architecture-e2e.svg) in this folder for a single sharp slide graphic.

---

## Disclaimer

Diagrams reflect the **current codebase shape** (Express + React + JSON stores + optional LLM). Integrations (SharePoint, email) and feed sources are **configurable**; adjust the talk track if your deployment differs.
