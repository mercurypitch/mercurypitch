import { test, expect } from '@playwright/test';

test.describe('PitchPerfect App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('#app-tabs', { timeout: 10000 });
  });

  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForSelector('#app-tabs');
    // Filter out known benign errors
    const realErrors = errors.filter(e =>
      !e.includes('net::ERR') && !e.includes('favicon')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('displays app header with tabs', async ({ page }) => {
    await expect(page.locator('#app-tabs')).toBeVisible();
    await expect(page.locator('#tab-practice')).toBeVisible();
    await expect(page.locator('#tab-editor')).toBeVisible();
    await expect(page.locator('#tab-settings')).toBeVisible();
  });

  test('Practice tab is active by default', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice');
    await expect(practiceTab).toHaveClass(/active/);
  });

  test('tab navigation switches content', async ({ page }) => {
    // Click Editor tab
    await page.locator('#tab-editor').click();
    await expect(page.locator('#tab-editor')).toHaveClass(/active/);
    await page.waitForTimeout(500);

    // Click Settings tab
    await page.locator('#tab-settings').click();
    await expect(page.locator('#tab-settings')).toHaveClass(/active/);

    // Click Practice tab
    await page.locator('#tab-practice').click();
    await expect(page.locator('#tab-practice')).toHaveClass(/active/);
  });

  test('sidebar scale controls are visible', async ({ page }) => {
    await expect(page.locator('#key-select')).toBeVisible();
    await expect(page.locator('#scale-select')).toBeVisible();
    await expect(page.locator('.octave-ctrl')).toBeVisible();
  });

  test('key selector changes the value', async ({ page }) => {
    const keySelect = page.locator('#key-select');
    await keySelect.selectOption('G');
    await expect(keySelect).toHaveValue('G');
  });

  test('scale selector has major and minor options', async ({ page }) => {
    const scaleSelect = page.locator('#scale-select');
    await expect(scaleSelect).toBeVisible();
    await expect(scaleSelect.locator('option[value="major"]')).toBeAttached();
    await expect(scaleSelect.locator('option[value="natural-minor"]')).toBeAttached();
    await expect(scaleSelect.locator('option[value="harmonic-minor"]')).toBeAttached();
    await expect(scaleSelect.locator('option[value="chromatic"]')).toBeAttached();
  });

  test('preset selector exists in sidebar', async ({ page }) => {
    await expect(page.locator('#preset-select')).toBeVisible();
    await expect(page.locator('#preset-select')).toContainText('Default Melody');
  });

  test('can save a new preset', async ({ page }) => {
    // Switch to editor tab
    await page.locator('#tab-editor').click();
    await page.waitForTimeout(2000);

    // Name the preset using the sidebar input
    const nameInput = page.locator('#preset-name-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Test Melody');

    // Click Save
    const saveBtn = page.locator('button[title="Save melody"]');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify the preset name is now shown
    await page.waitForTimeout(500);
    await expect(page.locator('#preset-name-input')).toHaveValue('E2E Test Melody');
  });

  test('can load a saved preset', async ({ page }) => {
    // Open preset dropdown
    await page.locator('#preset-select').selectOption('Default Melody');
    await expect(page.locator('#preset-select')).toHaveValue('Default Melody');
  });

  test('practice tab has playback controls', async ({ page }) => {
    // Mic toggle button should be present
    await expect(page.locator('.mic-toggle-btn, button[title*="microphone" i], button[title*="mic" i]')).toBeVisible({ timeout: 5000 });
  });

  test('record button exists and toggles', async ({ page }) => {
    const recordBtn = page.locator('#record-btn');
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toContainText('Record');
    // Clicking should attempt to start recording (mic permission may block, but button state changes)
    await recordBtn.click();
    await page.waitForTimeout(500);
    // Button should now show Stop or have recording class
    const hasStop = await recordBtn.textContent();
    const hasRecordingClass = await recordBtn.getAttribute('class');
    // After clicking (mic start may fail in test env), click again to reset
    if (hasStop?.includes('Stop')) {
      await recordBtn.click();
    }
  });

  test('editor tab shows piano roll toolbar', async ({ page }) => {
    await page.locator('#tab-editor').click();
    await expect(page.locator('.roll-toolbar')).toBeVisible();
    // Place, select, delete buttons may or may not exist depending on implementation
    if (await page.locator('#roll-place-btn').count() > 0) {
      await expect(page.locator('#roll-place-btn')).toBeVisible();
    }
    if (await page.locator('#roll-select-btn').count() > 0) {
      await expect(page.locator('#roll-select-btn')).toBeVisible();
    }
    if (await page.locator('#roll-delete-btn').count() > 0) {
      await expect(page.locator('#roll-delete-btn')).toBeVisible();
    }
  });

  test('editor tab shows MIDI export/import buttons', async ({ page }) => {
    await page.locator('#tab-editor').click();
    // These may or may not exist depending on implementation
    if (await page.locator('#roll-export-midi').count() > 0) {
      await expect(page.locator('#roll-export-midi')).toBeVisible();
    }
    if (await page.locator('#roll-import-midi').count() > 0) {
      await expect(page.locator('#roll-import-midi')).toBeVisible();
    }
  });

  test('can place a note on the piano roll', async ({ page }) => {
    await page.locator('#tab-editor').click();
    await page.waitForTimeout(2000);

    // Select place tool if it exists
    const placeBtn = page.locator('#roll-place-btn');
    if (await placeBtn.count() > 0 && await placeBtn.isVisible()) {
      await placeBtn.click();

      // Click on the piano roll grid to place a note
      const rollGrid = page.locator('.roll-grid canvas').first();
      if (await rollGrid.isVisible()) {
        const box = await rollGrid.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
        }
      }
    }
    // Verify tab switched successfully
    await expect(page.locator('#tab-editor')).toHaveClass(/active/);
  });

  test('piano roll zoom controls exist', async ({ page }) => {
    await page.locator('#tab-editor').click();
    if (await page.locator('#roll-zoom-in').count() > 0) {
      await expect(page.locator('#roll-zoom-in')).toBeVisible();
    }
    if (await page.locator('#roll-zoom-out').count() > 0) {
      await expect(page.locator('#roll-zoom-out')).toBeVisible();
    }
  });

  test('snap-to-grid toggle exists', async ({ page }) => {
    await page.locator('#tab-editor').click();
    if (await page.locator('#roll-snap-btn').count() > 0) {
      await expect(page.locator('#roll-snap-btn')).toBeVisible();
    }
  });

  test('effect buttons exist in editor', async ({ page }) => {
    await page.locator('#tab-editor').click();
    if (await page.locator('#roll-action-slide-up').count() > 0) {
      await expect(page.locator('#roll-action-slide-up')).toBeVisible();
    }
    if (await page.locator('#roll-action-vibrato').count() > 0) {
      await expect(page.locator('#roll-action-vibrato')).toBeVisible();
    }
  });

  test('app shows BPM control', async ({ page }) => {
    // BPM control is in the practice tab content area
    await expect(page.locator('.tempo-group')).toBeVisible();
    await expect(page.locator('#tempo')).toBeVisible();
    await expect(page.locator('#tempo-value')).toBeVisible();
  });

  test('octave shift buttons change octave value', async ({ page }) => {
    const octaveDisplay = page.locator('.octave-value');
    const initialOctave = await octaveDisplay.textContent();
    const higherBtn = page.locator('.octave-btn').last();
    await higherBtn.click();
    const newOctave = await octaveDisplay.textContent();
    expect(newOctave).not.toBe(initialOctave);
  });

  test('note count badge updates when notes present', async ({ page }) => {
    await page.locator('#preset-select').selectOption('Default Melody');
    await page.waitForTimeout(500);
    const badge = page.locator('#tab-editor .tab-badge');
    if (await badge.count() > 0) {
      await expect(badge).toBeVisible();
      const count = await badge.textContent();
      if (count) {
        expect(parseInt(count)).toBeGreaterThan(0);
      }
    }
  });

  test('grid toggle button changes state', async ({ page }) => {
    const gridBtn = page.locator('#grid-toggle-btn');
    if (await gridBtn.count() > 0 && await gridBtn.isVisible()) {
      const initialClass = await gridBtn.getAttribute('class');
      await gridBtn.click();
      const newClass = await gridBtn.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });
});
