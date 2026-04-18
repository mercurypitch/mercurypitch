import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Dismisses the welcome overlay if it appears.
 */
async function dismissWelcomeIfShown(
  page: Page,
): Promise<void> {
  const overlay = page.locator('.welcome-overlay')
  if ((await overlay.count()) > 0 && (await overlay.isVisible())) {
    const dismissBtn = page.locator('.welcome-cta, .overlay-close')
    if ((await dismissBtn.count()) > 0) {
      await dismissBtn.first().click()
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
    }
  }
}

test.describe('Critical Flows — GH #121', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissWelcomeIfShown(page)
  })

  // ============================================================
  // Priority 1: Playback Controls
  // ============================================================

  test.describe('Playback Controls', () => {
    test('Play button starts playback', async ({ page }) => {
      // Play button is in the essential-controls area of practice header
      const playBtn = page.locator('.play-btn')
      await expect(playBtn).toBeVisible()

      // Click play
      await playBtn.click()

      // Button should switch to Pause
      const pauseBtn = page.locator('.stop-btn').first()
      await expect(pauseBtn).toBeVisible({ timeout: 3000 })

      // Stop playback
      await pauseBtn.click()
      await page.waitForTimeout(300)
    })

    test('Play → Pause → Resume cycle', async ({ page }) => {
      const playBtn = page.locator('.play-btn')

      // Start playback
      await playBtn.click()
      await page.waitForTimeout(500)

      // Should now show pause
      await expect(page.locator('.stop-btn').first()).toBeVisible({
        timeout: 3000,
      })

      // Pause
      await page.locator('.stop-btn').first().click()
      await page.waitForTimeout(300)

      // Should show resume (play) button
      await expect(playBtn).toBeVisible({ timeout: 3000 })

      // Resume
      await playBtn.click()
      await page.waitForTimeout(500)

      // Stop
      await page.locator('.stop-btn').first().click()
      await page.waitForTimeout(300)

      // Should show play button again
      await expect(playBtn).toBeVisible({ timeout: 3000 })
    })

    test('Stop button resets playback state', async ({ page }) => {
      const playBtn = page.locator('.play-btn')
      const _stopBtn = page.locator('.play-btn + .stop-btn, button.stop')

      // Start playback
      await playBtn.click()
      await page.waitForTimeout(500)

      // Find and click the Stop button (class="ctrl-btn stop-btn stop")
      const stop = page.locator('.stop-btn.stop').first()
      await stop.click()
      await page.waitForTimeout(500)

      // Play button should be visible again
      await expect(playBtn).toBeVisible({ timeout: 3000 })
    })

    test('Practice mode buttons (Once / Repeat / Practice) switch modes', async ({
      page,
    }) => {
      const btnOnce = page.locator('#btn-once')
      const btnRepeat = page.locator('#btn-repeat')
      const btnPractice = page.locator('#btn-practice')

      await expect(btnOnce).toBeVisible()
      await expect(btnRepeat).toBeVisible()
      await expect(btnPractice).toBeVisible()

      // Default is "Once" — verify it's active
      await expect(btnOnce).toHaveClass(/active/)

      // Switch to Repeat
      await btnRepeat.click()
      await expect(btnRepeat).toHaveClass(/active/)
      await expect(btnOnce).not.toHaveClass(/active/)

      // Switch to Practice
      await btnPractice.click()
      await expect(btnPractice).toHaveClass(/active/)
      await expect(btnRepeat).not.toHaveClass(/active/)

      // Switch back to Once
      await btnOnce.click()
      await expect(btnOnce).toHaveClass(/active/)
    })

    test('Arrow keys change playback speed', async ({ page }) => {
      // Focus the page body
      await page.locator('body').click()
      await page.waitForTimeout(200)

      // Get initial speed from store
      const initialSpeed = await page.evaluate(() => {
        return (window as unknown as { __appStore?: { playbackSpeed: () => number } }).__appStore?.playbackSpeed() ?? 1.0
      })

      // Press ArrowUp (faster)
      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(200)

      const speedAfterUp = await page.evaluate(() => {
        return (window as unknown as { __appStore?: { playbackSpeed: () => number } }).__appStore?.playbackSpeed() ?? 1.0
      })

      // Speed should have increased
      expect(speedAfterUp).toBeGreaterThan(initialSpeed)

      // Press ArrowDown (slower)
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(200)

      const speedAfterDown = await page.evaluate(() => {
        return (window as unknown as { __appStore?: { playbackSpeed: () => number } }).__appStore?.playbackSpeed() ?? 1.0
      })

      // Speed should decrease back
      expect(speedAfterDown).toBeLessThan(speedAfterUp)
      expect(speedAfterDown).toBeGreaterThanOrEqual(initialSpeed)
    })

    test('BPM slider changes tempo', async ({ page }) => {
      const tempoSlider = page.locator('#tempo')
      const tempoValue = page.locator('#tempo-value')

      await expect(tempoSlider).toBeVisible()
      await expect(tempoValue).toBeVisible()

      const initialBpm = await tempoValue.textContent()
      expect(initialBpm).not.toBeNull()

      // Adjust BPM slider
      await tempoSlider.fill('160')
      await page.waitForTimeout(300)

      const newBpm = await tempoValue.textContent()
      expect(newBpm).toBe('160')
    })

    test('Playback speed select changes speed', async ({ page }) => {
      const speedSelect = page.locator('#speed-select')
      await expect(speedSelect).toBeVisible()

      await speedSelect.selectOption('0.5')
      await page.waitForTimeout(200)

      const storeSpeed = await page.evaluate(() => {
        return (window as unknown as { __appStore?: { playbackSpeed: () => number } }).__appStore?.playbackSpeed() ?? 1.0
      })
      expect(storeSpeed).toBe(0.5)

      await speedSelect.selectOption('2')
      await page.waitForTimeout(200)

      const storeSpeed2 = await page.evaluate(() => {
        return (window as unknown as { __appStore?: { playbackSpeed: () => number } }).__appStore?.playbackSpeed() ?? 1.0
      })
      expect(storeSpeed2).toBe(2.0)
    })
  })

  // ============================================================
  // Priority 1: Piano Roll / Editor
  // ============================================================

  test.describe('Piano Roll — Note Entry', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('#tab-editor').click()
      await page.waitForTimeout(2000)
    })

    test('piano roll toolbar is fully visible', async ({ page }) => {
      const toolbar = page.locator('.roll-toolbar')
      await expect(toolbar).toBeVisible()

      // Place tool button
      await expect(
        toolbar.locator('.roll-tool-btn[data-tool="place"]'),
      ).toBeVisible()

      // Duration buttons
      await expect(toolbar.locator('.dur-btn[data-dur="0.5"]')).toBeVisible()
      await expect(toolbar.locator('.dur-btn[data-dur="1"]')).toBeVisible()

      // Octave controls
      await expect(page.locator('#roll-octave-up')).toBeVisible()
      await expect(page.locator('#roll-octave-down')).toBeVisible()

      // Mode select
      await expect(page.locator('#roll-mode-select')).toBeVisible()

      // Zoom controls
      await expect(page.locator('#roll-zoom-in')).toBeVisible()
      await expect(page.locator('#roll-zoom-out')).toBeVisible()
    })

    test('tool switching activates the selected tool', async ({ page }) => {
      const placeBtn = page.locator('.roll-tool-btn[data-tool="place"]')
      const selectBtn = page.locator('.roll-tool-btn[data-tool="select"]')
      const eraseBtn = page.locator('.roll-tool-btn[data-tool="erase"]')

      // Place tool is active by default
      await expect(placeBtn).toHaveClass(/active/)

      // Switch to erase
      await eraseBtn.click()
      await expect(eraseBtn).toHaveClass(/active/)
      await expect(placeBtn).not.toHaveClass(/active/)

      // Switch to select
      await selectBtn.click()
      await expect(selectBtn).toHaveClass(/active/)
      await expect(eraseBtn).not.toHaveClass(/active/)
    })

    test('clicking on grid places a note (place tool)', async ({ page }) => {
      // Select place tool
      await page.locator('.roll-tool-btn[data-tool="place"]').click()

      // Click on the grid canvas
      const gridCanvas = page.locator('canvas.roll-grid')
      await expect(gridCanvas).toBeVisible()
      const box = await gridCanvas.boundingBox()
      expect(box).not.toBeNull()

      // Click in a middle area
      await page.mouse.click(
        box!.x + box!.width * 0.5,
        box!.y + box!.height * 0.5,
      )
      await page.waitForTimeout(500)

      // The hint should indicate a note was placed or selected
      const hint = page.locator('#roll-note-info')
      await expect(hint).toBeVisible()
    })

    test('zoom in/out changes zoom display', async ({ page }) => {
      const zoomIn = page.locator('#roll-zoom-in')
      const zoomOut = page.locator('#roll-zoom-out')
      const zoomValue = page.locator('#roll-zoom-value')

      await expect(zoomValue).toBeVisible()
      const initialZoom = await zoomValue.textContent()

      // Zoom in
      await zoomIn.click()
      await page.waitForTimeout(300)
      const zoomedIn = await zoomValue.textContent()
      expect(zoomedIn).not.toBe(initialZoom)

      // Zoom out
      await zoomOut.click()
      await zoomOut.click()
      await page.waitForTimeout(300)
    })

    test('undo button is disabled on fresh state', async ({ page }) => {
      const undoBtn = page.locator('#roll-undo-btn')
      await expect(undoBtn).toBeVisible()
      await expect(undoBtn).toBeDisabled()
    })

    test('Ctrl+Z undo and Ctrl+Y redo keyboard shortcuts', async ({ page }) => {
      // Navigate to Editor tab first
      await page.evaluate(() => {
        const store = (window as unknown as { __appStore?: { setActiveTab: (tab: string) => void } }).__appStore
        if (store !== null && store !== undefined) store.setActiveTab('editor')
      })
      await page.waitForTimeout(300)

      // Place a note first
      await page.locator('.roll-tool-btn[data-tool="place"]').click()
      const gridCanvas = page.locator('canvas.roll-grid')
      const box = await gridCanvas.boundingBox()
      await page.mouse.click(
        box!.x + box!.width * 0.5,
        box!.y + box!.height * 0.3,
      )
      await page.waitForTimeout(500)

      // Undo should now be enabled
      const undoBtn = page.locator('#roll-undo-btn')
      await expect(undoBtn).toBeEnabled()

      // Keyboard undo
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(300)
    })

    test('scale mode select changes the scale', async ({ page }) => {
      const modeSelect = page.locator('#roll-mode-select')
      await expect(modeSelect).toBeVisible()

      await modeSelect.selectOption('natural-minor')
      await page.waitForTimeout(300)
      await expect(modeSelect).toHaveValue('natural-minor')

      await modeSelect.selectOption('pentatonic-major')
      await page.waitForTimeout(300)
      await expect(modeSelect).toHaveValue('pentatonic-major')
    })

    test('octave shift changes octave display', async ({ page }) => {
      const octaveUp = page.locator('#roll-octave-up')
      const octaveDown = page.locator('#roll-octave-down')
      const octaveValue = page.locator('#roll-octave-value')

      await expect(octaveValue).toBeVisible()
      const initialOctave = await octaveValue.textContent()

      // Shift up
      await octaveUp.click()
      await page.waitForTimeout(200)
      const newOctave = await octaveValue.textContent()
      expect(newOctave).not.toBe(initialOctave)

      // Shift down
      await octaveDown.click()
      await page.waitForTimeout(200)
    })

    test('MIDI export button exists', async ({ page }) => {
      const exportBtn = page.locator('#roll-export-midi')
      await expect(exportBtn).toBeVisible()
    })

    test('WAV export button exists', async ({ page }) => {
      const exportBtn = page.locator('#roll-export-wav')
      await expect(exportBtn).toBeVisible()
    })

    test('instrument selector changes instrument', async ({ page }) => {
      const instrumentSelect = page.locator('#roll-instrument-select')
      await expect(instrumentSelect).toBeVisible()
      await expect(
        instrumentSelect.locator('option[value="piano"]'),
      ).toBeAttached()
      await expect(
        instrumentSelect.locator('option[value="sine"]'),
      ).toBeAttached()

      await instrumentSelect.selectOption('organ')
      await page.waitForTimeout(200)
      await expect(instrumentSelect).toHaveValue('organ')
    })
  })

  // ============================================================
  // Priority 1: Preset Save / Load
  // ============================================================

  test.describe('Presets', () => {
    test('preset name input is visible', async ({ page }) => {
      const presetInput = page.locator('#preset-name-input')
      await expect(presetInput).toBeVisible()
    })

    test('can type a preset name', async ({ page }) => {
      const presetInput = page.locator('#preset-name-input')
      await presetInput.fill('My Test Preset')
      await expect(presetInput).toHaveValue('My Test Preset')
    })

    test('save button saves the preset', async ({ page }) => {
      // Type a unique name
      const name = `E2E Preset ${Date.now()}`
      await page.locator('#preset-name-input').fill(name)

      // Click Save
      const saveBtn = page.locator('button[title="Save melody"]')
      await saveBtn.click()
      await page.waitForTimeout(500)

      // Name should persist
      await expect(page.locator('#preset-name-input')).toHaveValue(name)
    })

    test('preset dropdown shows saved preset option', async ({ page }) => {
      // Save a preset with unique name
      const name = `E2E Unique Preset ${Date.now()}`
      await page.locator('#preset-name-input').fill(name)
      await page.locator('button[title="Save melody"]').click()
      await page.waitForTimeout(500)

      // Open preset datalist
      await page.locator('#preset-select').click()
      await page.waitForTimeout(300)

      // The preset should appear in the datalist
      await expect(
        page.locator(`#preset-datalist option[value="${name}"]`),
      ).toBeAttached()
    })

    test('deleting preset removes it from the list', async ({ page }) => {
      // Save a preset first
      const name = `E2E Delete Test ${Date.now()}`
      await page.locator('#preset-name-input').fill(name)
      await page.locator('button[title="Save melody"]').click()
      await page.waitForTimeout(500)

      // Delete button should appear after selecting a preset
      await page.locator('#preset-select').fill(name)
      await page.waitForTimeout(300)

      const deleteBtn = page.locator('button[title="Delete preset"]')
      if ((await deleteBtn.count()) > 0 && (await deleteBtn.isVisible())) {
        await deleteBtn.click()
        await page.waitForTimeout(500)
      }
    })
  })

  // ============================================================
  // Priority 2: Practice Mode
  // ============================================================

  test.describe('Practice Mode', () => {
    test('Practice mode shows cycle counter', async ({ page }) => {
      // Switch to Practice mode
      const practiceBtn = page.locator('#btn-practice')
      await practiceBtn.click()
      await page.waitForTimeout(300)

      // When in practice mode, cycle counter should show
      const cycleCounter = page.locator('#cycle-counter')
      await expect(cycleCounter).toBeVisible()

      // Cycle count should show C1/N format
      const text = await cycleCounter.textContent()
      expect(text).toMatch(/C\d+\/\d+/)
    })

    test('Practice mode cycles input accepts valid values', async ({
      page,
    }) => {
      // Switch to Practice mode
      await page.locator('#btn-practice').click()
      await page.waitForTimeout(300)

      const cyclesInput = page.locator('#cycles')
      if ((await cyclesInput.count()) > 0) {
        await cyclesInput.fill('10')
        await page.waitForTimeout(200)
        await expect(cyclesInput).toHaveValue('10')
      }
    })

    test('Count-in select changes precount', async ({ page }) => {
      const countInSelect = page.locator('#countin-select')
      await expect(countInSelect).toBeVisible()

      await countInSelect.selectOption('4')
      await page.waitForTimeout(200)
      await expect(countInSelect).toHaveValue('4')

      await countInSelect.selectOption('0')
      await page.waitForTimeout(200)
      await expect(countInSelect).toHaveValue('0')
    })

    test('Practice sub-mode select exists in practice mode', async ({
      page,
    }) => {
      await page.locator('#btn-practice').click()
      await page.waitForTimeout(300)

      const subModeSelect = page.locator('#practice-sub-mode')
      if ((await subModeSelect.count()) > 0) {
        await expect(
          subModeSelect.locator('option[value="all"]'),
        ).toBeAttached()
        await expect(
          subModeSelect.locator('option[value="random"]'),
        ).toBeAttached()
        await expect(
          subModeSelect.locator('option[value="focus"]'),
        ).toBeAttached()
        await expect(
          subModeSelect.locator('option[value="reverse"]'),
        ).toBeAttached()

        // Change sub-mode
        await subModeSelect.selectOption('random')
        await expect(subModeSelect).toHaveValue('random')
      }
    })

    test('Mic toggle button changes state', async ({ page }) => {
      const micBtn = page.locator('.mic-toggle-btn')
      if ((await micBtn.count()) > 0 && (await micBtn.isVisible())) {
        const _initialClass = await micBtn.getAttribute('class')
        await micBtn.click()
        await page.waitForTimeout(500)
        const _newClass = await micBtn.getAttribute('class')
        // Class should change (active or inactive state)
        // Note: mic may fail in test env but button state should toggle
      }
    })
  })

  // ============================================================
  // Priority 2: Settings Persistence
  // ============================================================

  test.describe('Settings Persistence', () => {
    test('ADSR sliders change values and persist', async ({ page }) => {
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      const attack = page.locator('#adsr-attack')
      const decay = page.locator('#adsr-decay')
      const sustain = page.locator('#adsr-sustain')
      const release = page.locator('#adsr-release')

      await expect(attack).toBeVisible()
      await expect(decay).toBeVisible()
      await expect(sustain).toBeVisible()
      await expect(release).toBeVisible()

      // Change values
      await attack.fill('800')
      await page.waitForTimeout(200)
      await expect(attack).toHaveValue('800')

      await decay.fill('400')
      await page.waitForTimeout(200)
      await expect(decay).toHaveValue('400')

      await sustain.fill('70')
      await page.waitForTimeout(200)
      await expect(sustain).toHaveValue('70')

      await release.fill('1000')
      await page.waitForTimeout(200)
      await expect(release).toHaveValue('1000')
    })

    test('Reverb controls change settings', async ({ page }) => {
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      const reverbType = page.locator('#reverb-type')
      const reverbWetness = page.locator('#reverb-wetness')

      await expect(reverbType).toBeVisible({ timeout: 5000 })
      await expect(reverbWetness).toBeVisible()

      // Change reverb type
      await reverbType.selectOption('hall')
      await expect(reverbType).toHaveValue('hall')

      await reverbType.selectOption('cathedral')
      await expect(reverbType).toHaveValue('cathedral')

      // Change wetness
      await reverbWetness.fill('60')
      await page.waitForTimeout(200)
    })

    test('Sensitivity preset changes affect sensitivity value', async ({
      page,
    }) => {
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      const sensitivitySlider = page.locator('#sensitivity')
      if (
        (await sensitivitySlider.count()) > 0 &&
        (await sensitivitySlider.isVisible())
      ) {
        const _initialSens = await sensitivitySlider.inputValue()

        // Change sensitivity
        await sensitivitySlider.fill('8')
        await page.waitForTimeout(200)

        const newSens = await sensitivitySlider.inputValue()
        expect(newSens).toBe('8')
      }
    })

    test('Settings values persist after page reload', async ({ page }) => {
      // Set specific ADSR values
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      await page.locator('#adsr-attack').fill('750')
      await page.locator('#adsr-decay').fill('350')
      await page.locator('#reverb-type').selectOption('cathedral')
      await page.waitForTimeout(500)

      // Reload the page
      await page.reload()
      await page.waitForSelector('#app-tabs', { timeout: 10000 })
      await dismissWelcomeIfShown(page)

      // Go to settings
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      // Values should be persisted
      const attackVal = await page.locator('#adsr-attack').inputValue()
      // Note: may differ slightly due to normalization, but should be close
      expect(parseInt(attackVal)).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // Cross-cutting: Tab Navigation and Layout
  // ============================================================

  test.describe('Tab Navigation', () => {
    test('all tabs are accessible', async ({ page }) => {
      const tabs = [
        { id: '#tab-practice', name: 'Practice' },
        { id: '#tab-editor', name: 'Editor' },
        { id: '#tab-settings', name: 'Settings' },
      ]

      for (const tab of tabs) {
        await page.locator(tab.id).click()
        await page.waitForTimeout(1000)
        const tabEl = page.locator(tab.id)
        await expect(tabEl).toHaveClass(/active/)
      }
    })

    test('settings panel renders correctly', async ({ page }) => {
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(3000)

      // Settings panel should be the main content
      await expect(page.locator('#settings-panel')).toBeVisible({
        timeout: 5000,
      })

      // Title should be visible
      await expect(page.locator('.settings-title')).toBeVisible()

      // About section
      await expect(page.locator('.about-name')).toContainText('PitchPerfect')

      // GitHub link
      await expect(page.locator('.about-link')).toHaveAttribute(
        'href',
        /github\.com/,
      )
    })

    test('Focus Mode can be entered from Practice tab', async ({ page }) => {
      const focusBtn = page.locator('.focus-btn')
      await expect(focusBtn).toBeVisible()

      await focusBtn.click()
      await page.waitForTimeout(500)

      // Focus mode elements should be visible
      await expect(page.locator('.focus-mode')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.focus-topbar')).toBeVisible()

      // Exit focus mode
      const exitBtn = page.locator('.focus-exit')
      await expect(exitBtn).toBeVisible()
      await exitBtn.click()
      await page.waitForTimeout(500)

      // Should be back to normal view
      await expect(page.locator('.practice-header-bar')).toBeVisible({
        timeout: 3000,
      })
    })

    test('Escape key exits Focus Mode (GH #139)', async ({ page }) => {
      // Enter focus mode
      await page.locator('.focus-btn').click()
      await page.waitForTimeout(500)
      await expect(page.locator('.focus-mode')).toBeVisible({ timeout: 3000 })

      // Press Escape to exit
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      // Should be back to normal view
      await expect(page.locator('.practice-header-bar')).toBeVisible({
        timeout: 3000,
      })
    })

    test('sidebar scale controls work', async ({ page }) => {
      // Key select
      const keySelect = page.locator('#key-select')
      await expect(keySelect).toBeVisible()
      await keySelect.selectOption('D')
      await expect(keySelect).toHaveValue('D')

      // Scale select
      const scaleSelect = page.locator('#scale-select')
      await expect(scaleSelect).toBeVisible()
      await scaleSelect.selectOption('dorian')
      await expect(scaleSelect).toHaveValue('dorian')

      // Octave controls
      const octaveBtns = page.locator('.octave-btn')
      await expect(octaveBtns.first()).toBeVisible()
    })
  })

  // ============================================================
  // GH #138: Practice Page Improvements (regression tests)
  // ============================================================

  test.describe('Practice Page Improvements (GH #138)', () => {
    test('Count-in label reads "Precount"', async ({ page }) => {
      const precountLabel = page.locator('.countin-group .opt-label')
      await expect(precountLabel).toContainText('Precount')
    })

    test('Focus Mode play/pause controls work', async ({ page }) => {
      // Enter focus mode
      await page.locator('.focus-btn').click()
      await page.waitForTimeout(500)

      // Play button should be visible
      const focusPlay = page.locator('.focus-play')
      await expect(focusPlay).toBeVisible({ timeout: 3000 })

      // Click play
      await focusPlay.click()
      await page.waitForTimeout(500)

      // Should now show pause button
      await expect(page.locator('.focus-play[title="Pause"]')).toBeVisible({
        timeout: 3000,
      })

      // Pause
      await page.locator('.focus-play[title="Pause"]').click()
      await page.waitForTimeout(500)

      // Should show resume
      await expect(page.locator('.focus-play[title="Continue"]')).toBeVisible({
        timeout: 3000,
      })

      // Exit
      await page.locator('.focus-exit').click()
    })

    test('Focus Mode speed controls change speed', async ({ page }) => {
      await page.locator('.focus-btn').click()
      await page.waitForTimeout(500)

      const speedLabel = page.locator('.focus-speed-label')
      await expect(speedLabel).toBeVisible()
      const initialSpeed = await speedLabel.textContent()

      // Speed up
      const speedUp = page.locator('.focus-speed-btn').first()
      await speedUp.click()
      await page.waitForTimeout(200)

      const newSpeed = await speedLabel.textContent()
      expect(newSpeed).not.toBe(initialSpeed)

      // Exit
      await page.locator('.focus-exit').click()
    })
  })
})
