import { test, expect } from '@playwright/test';

const PARENT = 'E2E_Parent';
const OPCO = 'E2E_OpCo';

test.describe('UBO ownership graph (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/companies/roles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ parents: [PARENT] }),
      });
    });
    await page.route(`**/api/companies/by-parent?parent=${encodeURIComponent(PARENT)}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opcos: [{ name: OPCO, framework: 'DFSA Rulebook' }],
        }),
      });
    });
    await page.route('**/api/companies/parent-opco-counts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ parents: [{ parent: PARENT, opcoCount: 1 }] }),
      });
    });
  });

  test('selects parent, opens UBO, shows ownership graph panel', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-module-org-overview-module').click();
    await page.getByTestId('nav-section-org-dashboard').click();
    await page.getByTestId('org-dash-parent-select').selectOption(PARENT);

    await page.getByTestId('nav-module-ownership-module').click();
    await page.getByTestId('nav-section-ubo').click();

    await expect(page.getByTestId('ubo-tab-ownershipgraph')).toBeVisible();
    await page.getByTestId('ubo-tab-ownershipgraph').click();
    await expect(page.getByTestId('ownership-graph-panel')).toBeVisible();
    await expect(page.getByTestId('ownership-graph-file-input')).toBeVisible();
  });
});
