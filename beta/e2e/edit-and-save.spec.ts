import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const FIXTURES = path.join(__dirname, 'fixtures');

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

async function dropFile(page: Page, filePath: string, fileName: string) {
  const fileContent = fs.readFileSync(filePath);
  const base64 = fileContent.toString('base64');

  await page.evaluate(
    ({ base64Data, name }) => {
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const file = new File([bytes], name, { type: 'application/octet-stream' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    },
    { base64Data: base64, name: fileName },
  );

  await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
  await page.waitForTimeout(200);
}

/**
 * Click on byte at position 0 in the hex view canvas, then type hex keys.
 * Each pair of hex chars writes one byte and advances the cursor.
 */
async function typeHexAtStart(page: Page, hexString: string) {
  // Click the first canvas (hex view) to focus it and enter edit mode.
  // Click near the top-left of the hex area (after the address column).
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 80, y: 8 } });

  // Small delay for focus + edit mode activation
  await page.waitForTimeout(100);

  // Type the hex string character by character
  for (const ch of hexString) {
    await page.keyboard.press(ch);
  }
}

/**
 * Trigger Save and capture the downloaded file.
 * The app creates an <a download="..."> blob link.
 */
async function saveAndGetDownload(page: Page): Promise<Buffer> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Save', { exact: true }).click();
  const download = await downloadPromise;

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  return fs.readFileSync(downloadPath!);
}

test.describe('Edit and save', () => {
  test('edit first 16 bytes of a file and verify saved output', async ({ page }) => {
    // Load the 16-byte fixture file (00 01 02 ... 0F)
    await dropFile(page, path.join(FIXTURES, '16bytes.bin'), '16bytes.bin');

    // Verify file loaded
    await expect(page.getByText('Current: 0 of 15')).toBeVisible();

    // Type 32 hex chars to overwrite all 16 bytes with: AA BB CC DD EE FF 00 11 22 33 44 55 66 77 88 99
    const newHex = 'AABBCCDDEEFF00112233445566778899';
    await typeHexAtStart(page, newHex);

    // Save the file and capture the download
    const savedData = await saveAndGetDownload(page);

    // Verify the saved file has exactly 16 bytes
    expect(savedData.length).toBe(16);

    // Verify each byte matches what we typed
    const expected = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11,
                      0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99];
    for (let i = 0; i < expected.length; i++) {
      expect(savedData[i]).toBe(expected[i]);
    }
  });

  test('edit first 4 bytes and verify rest is unchanged', async ({ page }) => {
    // Load hello.bin: 48 65 6C 6C 6F 20 57 6F 72 6C 64 ("Hello World")
    await dropFile(page, path.join(FIXTURES, 'hello.bin'), 'hello.bin');
    await expect(page.getByText('Current: 0 of 10')).toBeVisible();

    // Overwrite first 4 bytes with DE AD BE EF
    await typeHexAtStart(page, 'DEADBEEF');

    const savedData = await saveAndGetDownload(page);

    expect(savedData.length).toBe(11);

    // First 4 bytes should be our edits
    expect(savedData[0]).toBe(0xDE);
    expect(savedData[1]).toBe(0xAD);
    expect(savedData[2]).toBe(0xBE);
    expect(savedData[3]).toBe(0xEF);

    // Remaining bytes should be untouched ("o World" = 6F 20 57 6F 72 6C 64)
    const originalTail = Buffer.from('o World', 'ascii');
    for (let i = 0; i < originalTail.length; i++) {
      expect(savedData[4 + i]).toBe(originalTail[i]);
    }
  });

  test('edit a new file and download', async ({ page }) => {
    // Create a new 4096-byte file (all zeros)
    await page.getByText('New', { exact: true }).click();
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();

    // Write FF at the first byte
    await typeHexAtStart(page, 'FF');

    const savedData = await saveAndGetDownload(page);

    expect(savedData.length).toBe(4096);
    expect(savedData[0]).toBe(0xFF);
    // Rest should be zeros
    expect(savedData[1]).toBe(0x00);
    expect(savedData[100]).toBe(0x00);
  });
});
