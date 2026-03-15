import { test, expect, Page } from '@playwright/test';

// Ensure each test starts with a clean IndexedDB
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const dbs = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
    return dbs.then((databases: IDBDatabaseInfo[]) =>
      Promise.all(databases.map((db: IDBDatabaseInfo) => {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }))
    );
  });
  await page.reload();
});

/** Click "New" and wait for the tab to appear */
async function createNewFile(page: Page) {
  await page.getByText('New', { exact: true }).click();
  await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
}

test.describe('App launch', () => {
  test('renders header with title and buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Hex Works')).toBeVisible();
    await expect(page.getByText('New', { exact: true })).toBeVisible();
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
    await expect(page.getByText('Save', { exact: true })).toBeVisible();
  });

  test('renders right panel tabs', async ({ page }) => {
    await page.goto('/');
    const panelTabBar = page.locator('[data-testid="panel-tab-bar"]');
    await expect(panelTabBar.getByText('Inspector')).toBeVisible();
    await expect(panelTabBar.getByText('Search')).toBeVisible();
    await expect(panelTabBar.getByText('Script')).toBeVisible();
  });

  test('renders help button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('?')).toBeVisible();
  });
});

test.describe('New file', () => {
  test('clicking New creates a buffer and tab', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    // Tab bar should show the file name
    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('untitled.bin')).toBeVisible();
  });

  test('hex view canvas renders after creating file', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    const canvases = page.locator('canvas');
    await expect(canvases.first()).toBeVisible();
  });
});

test.describe('Color picker', () => {
  test('color buttons are visible after creating file', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    await expect(page.getByLabel('Red')).toBeVisible();
    await expect(page.getByLabel('Blue')).toBeVisible();
    await expect(page.getByLabel('White')).toBeVisible();
  });
});

test.describe('Panel switching', () => {
  test('clicking Search tab shows search panel', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    const panelTabBar = page.locator('[data-testid="panel-tab-bar"]');
    await panelTabBar.getByText('Search').click();

    // Search panel has a specific input or heading
    await expect(page.locator('[data-testid="search-panel"]')).toBeVisible();
  });

  test('clicking Script tab shows script panel', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    const panelTabBar = page.locator('[data-testid="panel-tab-bar"]');
    await panelTabBar.getByText('Script').click();

    await expect(page.locator('[data-testid="script-panel"]')).toBeVisible();
  });

  test('clicking Inspector tab returns to inspector', async ({ page }) => {
    await page.goto('/');
    await createNewFile(page);

    const panelTabBar = page.locator('[data-testid="panel-tab-bar"]');

    // Switch to Search, then back to Inspector
    await panelTabBar.getByText('Search').click();
    await panelTabBar.getByText('Inspector').click();

    await expect(page.locator('[data-testid="inspector-panel"]')).toBeVisible();
  });
});

test.describe('Help modal', () => {
  test('opens and closes help modal', async ({ page }) => {
    await page.goto('/');

    await page.getByText('?').click();
    await expect(page.getByText('Hex Works Help')).toBeVisible();
    await expect(page.getByText('Keyboard Shortcuts:')).toBeVisible();

    await page.getByText('Close', { exact: true }).click();
    await expect(page.getByText('Hex Works Help')).not.toBeVisible();
  });
});

test.describe('Multi-tab', () => {
  test('can create multiple tabs', async ({ page }) => {
    await page.goto('/');

    await createNewFile(page);
    await createNewFile(page);

    const tabBar = page.locator('[data-testid="tab-bar"]');
    const tabNames = tabBar.getByText('untitled.bin');
    await expect(tabNames).toHaveCount(2);
  });

  test('can close a tab', async ({ page }) => {
    await page.goto('/');

    await createNewFile(page);
    await createNewFile(page);

    const tabBar = page.locator('[data-testid="tab-bar"]');

    // Close first tab via the × button inside the tab bar
    const closeButtons = tabBar.locator('text=×');
    await closeButtons.first().click();

    await expect(tabBar.getByText('untitled.bin')).toHaveCount(1);
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('/');

    await createNewFile(page);
    await createNewFile(page);

    const tabBar = page.locator('[data-testid="tab-bar"]');
    const tabs = tabBar.getByText('untitled.bin');

    // Click first tab
    await tabs.first().click();
    // Canvas should still be visible
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
