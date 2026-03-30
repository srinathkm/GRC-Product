# Frontend Style Governance Checklist

Use this checklist in every UI pull request.

## Design token compliance
- Use semantic tokens from `client/src/styles/index.css` for colors, spacing, shadows, radius, and z-index.
- Avoid hardcoded visual values unless there is no suitable token.
- Reuse shared utility classes (`.btn-*`, shared modal/input primitives) before adding new variants.

## Accessibility checks
- Every custom interactive element is keyboard operable (`Enter` and `Space` where applicable).
- Focus states are visible and use `:focus-visible` patterns.
- Dialogs include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Motion-heavy UI has a `prefers-reduced-motion` fallback.

## Responsive checks
- Prefer shared breakpoints (`1200`, `1024`, `768`, `640`) over ad-hoc cutoffs.
- Avoid nested primary scroll containers in main workflows.
- Verify key flows on desktop, tablet, and mobile widths.

## Quality gates
- Run lint on changed files.
- Spot-check high-traffic modules: dashboard, onboarding, AML checklist, task tracker, assistant panel.
- Include before/after screenshots for significant visual updates.
