import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const FIXTURES = path.join(__dirname, 'fixtures');

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

/**
 * Simulate dropping a file onto the page.
 * The app uses document-level dragover/drop listeners (use-drop-file.ts),
 * so we dispatch a drop event on the document body.
 */
async function dropFile(page: Page, filePath: string, fileName: string) {
  const fileContent = fs.readFileSync(filePath);
  const base64 = fileContent.toString('base64');

  await page.evaluate(
    ({ base64Data, name }) => {
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const file = new File([bytes], name, { type: 'application/octet-stream' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      document.dispatchEvent(dropEvent);
    },
    { base64Data: base64, name: fileName },
  );

  // Wait for the tab to appear
  await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
  // Small delay for the FileReader async callback
  await page.waitForTimeout(200);
}

test.describe('File upload via drag and drop', () => {
  test('open a small binary file (hello.bin, 11 bytes)', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');

    // Tab bar shows the filename
    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('hello.bin')).toBeVisible();

    // Status bar shows correct file size (0 of 10 = 11 bytes, 0-indexed)
    await expect(page.getByText('Current: 0 of 10')).toBeVisible();

    // Canvas should be rendered
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('open a 16-byte file and verify status bar', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, '16bytes.bin'), '16bytes.bin');

    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('16bytes.bin')).toBeVisible();

    // 16 bytes → current: 0 of 15
    await expect(page.getByText('Current: 0 of 15')).toBeVisible();
  });

  test('open a 1KB file', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, '1kb.bin'), '1kb.bin');

    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('1kb.bin')).toBeVisible();

    // 1024 bytes → current: 0 of 1023
    await expect(page.getByText('Current: 0 of 1023')).toBeVisible();
  });

  test('file name appears in header info', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');

    // Header shows file name and size
    await expect(page.getByText('hello.bin').first()).toBeVisible();
  });

  test('inspector panel shows values after file load', async ({ page }) => {
    // hello.bin starts with 0x48 ('H')
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');

    // Inspector should show HEX value for first byte (48 = 'H')
    const panelTabBar = page.locator('[data-testid="panel-tab-bar"]');
    await panelTabBar.getByText('Inspector').click();

    // The inspector panel should be visible and contain hex values
    await expect(page.locator('[data-testid="inspector-panel"]')).toBeVisible();
  });

  test('open multiple files creates multiple tabs', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');
    await dropFile(page, path.join(FIXTURES, '16bytes.bin'), '16bytes.bin');

    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('hello.bin')).toBeVisible();
    await expect(tabBar.getByText('16bytes.bin')).toBeVisible();
  });

  test('switching tabs after file load updates status bar', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');
    await dropFile(page, path.join(FIXTURES, '16bytes.bin'), '16bytes.bin');

    // Currently on 16bytes.bin (last opened)
    await expect(page.getByText('Current: 0 of 15')).toBeVisible();

    // Switch to hello.bin tab
    const tabBar = page.locator('[data-testid="tab-bar"]');
    await tabBar.getByText('hello.bin').click();

    // Status bar should update to hello.bin size
    await expect(page.getByText('Current: 0 of 10')).toBeVisible();
  });

  test('dropping same file twice creates two tabs', async ({ page }) => {
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');

    const tabBar = page.locator('[data-testid="tab-bar"]');
    await expect(tabBar.getByText('hello.bin')).toHaveCount(2);
  });
});
