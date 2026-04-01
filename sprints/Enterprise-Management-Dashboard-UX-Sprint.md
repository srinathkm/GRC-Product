# Enterprise Management Dashboard UX Sprint

**Sprint theme:** Replace generic “template dashboard” visuals with an **enterprise-grade** Management Dashboard experience aligned with security / GRC consoles: restrained palette, human typography, clear hierarchy (posture → attention → detail), and progressive disclosure so users are not overwhelmed.

**Source:** UX review and plan (Cursor: Enterprise Management Dashboard UX).

**Repository:** https://github.com/srinathkm/GRC-Product

**Primary files:** [`client/src/components/ManagementDashboard.jsx`](client/src/components/ManagementDashboard.jsx), [`client/src/components/ManagementDashboard.css`](client/src/components/ManagementDashboard.css), [`client/index.html`](client/index.html), [`client/src/styles/index.css`](client/src/styles/index.css) (tokens only if needed).

---

## Objective

- Remove emoji-forward KPI chrome and **rainbow per-tile accents**; use **semantic color** (severity / state) and neutral surfaces.
- Establish **information architecture**: executive posture first, **items requiring attention** second, exploratory charts and intelligence **third** (collapsible or de-emphasized).
- Adopt **enterprise typography** (tabular numerals, restrained weights; optional Source Sans 3 / IBM Plex Sans scoped to `.mgmt-dash`).
- Calm interaction patterns (no playful lift); respect **reduced motion**.

---

## Success criteria (release gate)

- No emoji in Management Dashboard production UI; icons are **monochrome SVG** or omitted.
- KPI row does not use arbitrary multi-hue decoration; risk/state uses a **small, consistent** semantic system.
- At least **three visual bands** (summary → attention → activity/detail) are obvious in the layout.
- `npm run build` (client) passes; spot-check **keyboard focus** and **WCAG AA** contrast on primary text.
- Stakeholder sign-off: dashboard “reads” as operations / security console, not marketing.

---

## Ticket index (GitHub)

| ID | Issue | Title | Priority |
|----|--------|--------|----------|
| UX-01 | [#39](https://github.com/srinathkm/GRC-Product/issues/39) | IA: posture / attention / activity / detail bands | P0 |
| UX-02 | [#40](https://github.com/srinathkm/GRC-Product/issues/40) | Typography: enterprise sans, tabular nums, weight discipline | P1 |
| UX-03 | [#41](https://github.com/srinathkm/GRC-Product/issues/41) | KPI tiles: SVG icons, semantic color only | P1 |
| UX-04 | [#42](https://github.com/srinathkm/GRC-Product/issues/42) | CSS: neutral enterprise shell, calm hover, desaturated charts | P1 |
| UX-05 | [#43](https://github.com/srinathkm/GRC-Product/issues/43) | Attention queues: table/list patterns, column clarity | P2 |
| UX-06 | [#44](https://github.com/srinathkm/GRC-Product/issues/44) | QA gate: a11y, build, visual regression checklist | P0 |

**Automation:** `GITHUB_TOKEN=... node scripts/create-github-issues-from-manifest.mjs sprints/enterprise-dashboard-ux-issues.manifest.json`

---

## Phases

### Phase 1 — Structure (UX-01)
Restructure JSX into bands; optional `<details>` / accordion for lower panels on small viewports.

### Phase 2 — Typography (UX-02)
Font loading and `.mgmt-dash` overrides; numeric presentation.

### Phase 3 — Components (UX-03, UX-05)
KpiTile refactor; expiry and driver lists as scannable rows.

### Phase 4 — Visual system (UX-04)
Single pass on `ManagementDashboard.css`; scoped CSS variables under `.mgmt-dash`.

### Phase 5 — Release (UX-06)
Checklist execution, sign-off.

---

## References

- Enterprise UX plan (internal Cursor plan): `enterprise_management_dashboard_ux`
- NIST-style readability: avoid decorative gauges if they reduce scan speed; prefer clear labels and trends.

