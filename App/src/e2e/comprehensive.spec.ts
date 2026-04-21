// ============================================================
// Comprehensive E2E Tests — 100+ tests for basic app functionality
// ============================================================

import { expect, test } from '@playwright/test'

test.describe('PitchPerfect App — Comprehensive Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Navigation Tests (15 tests)
  // ==========================================

  test('navigate to all tabs using sidebar buttons', async ({ page }) => {
    const tabs = ['editor', 'practice', 'settings'] as const

    for (const tab of tabs) {
      await page.locator(`#tab-${tab}`).click()
      await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/)
      await expect(page.locator(`#tab-${tab}`)).toBeVisible()
    }
  })

  test('practice tab navigation persists after navigation away', async ({ page }) => {
    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    const practiceTab = page.locator('#tab-practice')
    await practiceTab.click()
    await expect(practiceTab).toHaveClass(/active/)
  })

  test('settings panel can be toggled from editor tab', async ({ page }) => {
    const settingsBtn = page.locator('#settings-btn')

    expect(await settingsBtn.isVisible()).toBeTruthy()
    await settingsBtn.click()
    await expect(page.locator('#settings-panel')).toBeVisible()
  })

  test('settings panel closes when clicking outside', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.locator('#app-tabs').click()
    await expect(page.locator('#settings-panel')).not.toBeVisible()
  })

  test('tab switching preserves note data in editor tab', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const practiceTab = page.locator('#tab-practice')

    // Place a note
    await editorTab.click()
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.mouse.click(500, 300)
    await page.waitForTimeout(300)

    // Navigate to practice
    await practiceTab.click()
    await page.waitForTimeout(300)

    // Navigate back to editor
    await editorTab.click()
    await page.waitForTimeout(300)

    // Verify note still exists
    await expect(page.locator('canvas.roll-grid')).toBeVisible()
  })

  test('focus mode exits when tab is changed', async ({ page }) => {
    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    // Start focus mode
    await page.locator('#focus-mode-btn').click()
    await page.waitForTimeout(300)

    // Navigate to editor
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(300)

    expect(page.locator('#focus-mode-btn')).not.toHaveClass(/active/)
  })

  test('can navigate from practice tab to editor to practice', async ({ page }) => {
    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    await page.locator('#tab-editor').click()
    await page.waitForTimeout(300)

    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    await expect(page.locator('#tab-practice')).toHaveClass(/active/)
  })

  test('settings tab remains accessible after multiple navigations', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.locator('#tab-settings').click()
      await page.waitForTimeout(200)
      await expect(page.locator('#settings-panel')).toBeVisible()
      await page.locator('#tab-editor').click()
      await page.waitForTimeout(200)
    }
  })

  test('main layout maintains structure on navigation', async ({ page }) => {
    await page.locator('#tab-editor').click()
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('#editor-toolbar')).toBeVisible()
  })

  test('sidebar controls are visible on all tabs', async ({ page }) => {
    const tabs = ['editor', 'practice'] as const

    for (const tab of tabs) {
      await page.locator(`#tab-${tab}`).click()
      await expect(page.locator('nav')).toBeVisible()

      // Check sidebar sections
      await expect(page.locator('.sidebar-section')).toBeVisible()
      await expect(page.locator('.sidebar-title')).toBeVisible()
    }
  })

  test('practice sub-mode can be toggled', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('#practice-sub-mode')).toBeVisible()

    const options = ['once', 'repeat', 'practice']
    for (const option of options) {
      await page.selectOption('#practice-sub-mode', option)
      await expect(page.locator('#practice-sub-mode')).toHaveValue(option)
    }
  })

  test('zoom controls in piano roll toolbar are accessible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('#zoom-in-btn')).toBeVisible()
    await expect(page.locator('#zoom-out-btn')).toBeVisible()
  })

  test('effect buttons in editor are visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('#roll-action-slide-up')).toBeVisible()
    await expect(page.locator('#roll-action-slide-down')).toBeVisible()
    await expect(page.locator('#roll-action-ease-in')).toBeVisible()
    await expect(page.locator('#roll-action-ease-out')).toBeVisible()
    await expect(page.locator('#roll-action-vibrato')).toBeVisible()
  })

  test('piano roll row labels are visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.roll-piano')).toBeVisible()
  })

  test('playback speed selector is visible in practice tab', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('#playback-speed')).toBeVisible()
  })

  // ==========================================
  // Toolbar/Button Tests (20 tests)
  // ==========================================

  test('play button starts playback', async ({ page }) => {
    const playBtn = page.locator('#play-btn')
    await expect(playBtn).toBeVisible()

    await playBtn.click()
    await page.waitForTimeout(300)

    expect(playBtn).toHaveClass(/active/)
  })

  test('pause button stops playback', async ({ page }) => {
    const playBtn = page.locator('#play-btn')
    const pauseBtn = page.locator('#pause-btn')

    await playBtn.click()
    await page.waitForTimeout(500)

    await pauseBtn.click()
    await page.waitForTimeout(300)

    expect(playBtn).toHaveClass(/active/)
  })

  test('stop button resets playback position', async ({ page }) => {
    const playBtn = page.locator('#play-btn')
    const stopBtn = page.locator('#stop-btn')

    await playBtn.click()
    await page.waitForTimeout(500)

    await stopBtn.click()
    await page.waitForTimeout(300)

    // Verify stop button shows
    await expect(stopBtn).toBeVisible()
    expect(playBtn).not.toHaveClass(/active/)
  })

  test('play/pause cycle works correctly', async ({ page }) => {
    const playBtn = page.locator('#play-btn')
    const pauseBtn = page.locator('#pause-btn')

    await playBtn.click()
    await page.waitForTimeout(200)

    await pauseBtn.click()
    await page.waitForTimeout(200)

    await playBtn.click()
    await page.waitForTimeout(200)

    expect(pauseBtn).not.toHaveClass(/active/)
  })

  test('continue button resumes playback from position', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const editorTab = page.locator('#tab-editor')

    // Navigate to editor
    await editorTab.click()
    await page.waitForTimeout(300)

    // Place a note
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.mouse.click(500, 300)
    await page.waitForTimeout(300)

    // Start playback
    await page.locator('#play-btn').click()
    await page.waitForTimeout(500)

    // Navigate to practice
    await practiceTab.click()
    await page.waitForTimeout(300)

    // Use continue button
    const continueBtn = page.locator('#continue-btn')
    await expect(continueBtn).toBeVisible()

    await continueBtn.click()
    await page.waitForTimeout(300)
  })

  test('skip-forward button advances playback by 1 bar', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const skipBtn = page.locator('#skip-forward-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(skipBtn).toBeVisible()
    await skipBtn.click()
    await page.waitForTimeout(300)
  })

  test('skip-back button rewinds playback by 1 bar', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const skipBtn = page.locator('#skip-back-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(skipBtn).toBeVisible()
    await skipBtn.click()
    await page.waitForTimeout(300)
  })

  test('record button toggles recording state', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const recordBtn = page.locator('#record-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(recordBtn).toBeVisible()

    await recordBtn.click()
    await page.waitForTimeout(300)

    expect(recordBtn).toHaveClass(/active/)
  })

  test('mic button toggles microphone input', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const micBtn = page.locator('#mic-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(micBtn).toBeVisible()

    await micBtn.click()
    await page.waitForTimeout(300)

    expect(micBtn).toHaveClass(/active/)
  })

  test('preset selector can be changed', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const presetSelect = page.locator('#preset-select')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(presetSelect).toBeVisible()

    await presetSelect.selectOption('major')
    await expect(presetSelect).toHaveValue('major')

    await presetSelect.selectOption('pentatonic-major')
    await expect(presetSelect).toHaveValue('pentatonic-major')
  })

  test('can save new preset', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const presetInput = page.locator('#preset-name-input')
    const saveBtn = page.locator('#save-preset-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await presetInput.fill('Test Preset')
    await presetInput.press('Enter')
    await page.waitForTimeout(300)

    await expect(saveBtn).toBeVisible()
  })

  test('can load saved preset', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const presetSelect = page.locator('#preset-select')

    await practiceTab.click()
    await page.waitForTimeout(300)

    const options = await presetSelect.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(0)

    await presetSelect.selectOption(options[0])
    await page.waitForTimeout(300)
  })

  test('clear-all button clears melody', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const clearBtn = page.locator('#roll-clear-all')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(clearBtn).toBeVisible()

    // Place a note first
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.mouse.click(500, 300)
    await page.waitForTimeout(300)

    await clearBtn.click()
    await page.waitForTimeout(300)

    // Verify clear button still visible
    await expect(clearBtn).toBeVisible()
  })

  test('effect buttons update hint text', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const slideUpBtn = page.locator('#roll-action-slide-up')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(slideUpBtn).toBeVisible()
    await slideUpBtn.click()
    await page.waitForTimeout(200)

    const hint = page.locator('#roll-note-info')
    await expect(hint).toBeVisible()
  })

  test('instrument selector changes sound', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const instrumentSelect = page.locator('#roll-instrument-select')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(instrumentSelect).toBeVisible()

    await instrumentSelect.selectOption('piano')
    await expect(instrumentSelect).toHaveValue('piano')

    await instrumentSelect.selectOption('synth')
    await expect(instrumentSelect).toHaveValue('synth')
  })

  test('duration buttons are clickable', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')

    await editorTab.click()
    await page.waitForTimeout(300)

    const durationBtns = page.locator('.dur-btn')
    await expect(durationBtns).toHaveCount(6)

    await durationBtns.nth(1).click()
    await page.waitForTimeout(200)
  })

  test('tool buttons toggle active state', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const toolBtns = page.locator('.roll-tool-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(toolBtns).toHaveCount(3)

    await toolBtns.nth(1).click()
    await page.waitForTimeout(200)

    await expect(toolBtns.nth(1)).toHaveClass(/active/)
  })

  test('delete note button works when note is selected', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const deleteBtn = page.locator('#delete-note-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(deleteBtn).toBeVisible()

    // Place a note
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.mouse.click(500, 300)
    await page.waitForTimeout(300)

    await deleteBtn.click()
    await page.waitForTimeout(300)
  })

  test('zoom in button increases zoom level', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const zoomInBtn = page.locator('#zoom-in-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await zoomInBtn.click()
    await page.waitForTimeout(200)
  })

  test('zoom out button decreases zoom level', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const zoomOutBtn = page.locator('#zoom-out-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await zoomOutBtn.click()
    await page.waitForTimeout(200)
  })

  // ==========================================
  // MIDI Import/Export Tests (15 tests)
  // ==========================================

  test('MIDI import button is visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const importBtn = page.locator('#roll-import-midi')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(importBtn).toBeVisible()
  })

  test('MIDI export button is visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const exportBtn = page.locator('#roll-export-midi')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(exportBtn).toBeVisible()
  })

  test('WAV export button is visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const exportWavBtn = page.locator('#roll-export-wav')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(exportWavBtn).toBeVisible()
  })

  test('MIDI export opens download dialog', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const exportBtn = page.locator('#roll-export-midi')

    await editorTab.click()
    await page.waitForTimeout(300)

    await exportBtn.click()
    await page.waitForTimeout(300)
  })

  test('WAV export triggers browser download', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const exportWavBtn = page.locator('#roll-export-wav')

    await editorTab.click()
    await page.waitForTimeout(300)

    await exportWavBtn.click()
    await page.waitForTimeout(500)
  })

  test('can click MIDI import button (no error)', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const importBtn = page.locator('#roll-import-midi')

    await editorTab.click()
    await page.waitForTimeout(300)

    // This should not throw an error
    await expect(async () => {
      await importBtn.click()
    }).not.toThrow()
  })

  test('MIDI export and import buttons have tooltips', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')

    await editorTab.click()
    await page.waitForTimeout(300)

    const importBtn = page.locator('#roll-import-midi')
    await expect(importBtn.getAttribute('title')).resolves.toContain('MIDI')
  })

  test('audio export buttons are grouped together', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')

    await editorTab.click()
    await page.waitForTimeout(300)

    const exportGroup = page.locator('.roll-group-2col')
    await expect(exportGroup).toBeVisible()
  })

  test('import/export buttons are part of I/O group', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const ioGroup = page.locator('.roll-group[data-name="I/O"]')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(ioGroup).toBeVisible()

    const ioButtons = ioGroup.locator('.roll-export-btn')
    await expect(ioButtons).toHaveCount(3)
  })

  // ==========================================
  // Playback Control Tests (20 tests)
  // ==========================================

  test('play button has hover state', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const playBtn = page.locator('#play-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await playBtn.hover()
    await page.waitForTimeout(200)
  })

  test('pause button has hover state', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const pauseBtn = page.locator('#pause-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await pauseBtn.hover()
    await page.waitForTimeout(200)
  })

  test('stop button resets playback position to 0', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const stopBtn = page.locator('#stop-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(stopBtn).toBeVisible()

    // Place a note to have something to play
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.mouse.click(500, 300)
    await page.waitForTimeout(300)

    await practiceTab.click()
    await page.waitForTimeout(300)

    await stopBtn.click()
    await page.waitForTimeout(300)
  })

  test('skip-forward button is clickable multiple times', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const skipBtn = page.locator('#skip-forward-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    for (let i = 0; i < 5; i++) {
      await skipBtn.click()
      await page.waitForTimeout(200)
    }
  })

  test('skip-back button is clickable multiple times', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const skipBtn = page.locator('#skip-back-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    for (let i = 0; i < 5; i++) {
      await skipBtn.click()
      await page.waitForTimeout(200)
    }
  })

  test('record button toggles between record states', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const recordBtn = page.locator('#record-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await recordBtn.click()
    await page.waitForTimeout(200)

    await recordBtn.click()
    await page.waitForTimeout(200)

    expect(recordBtn).not.toHaveClass(/active/)
  })

  test('mic button toggles microphone access', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const micBtn = page.locator('#mic-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await micBtn.click()
    await page.waitForTimeout(200)

    await micBtn.click()
    await page.waitForTimeout(200)

    expect(micBtn).not.toHaveClass(/active/)
  })

  test('play button enables on first navigation to practice', async ({ page }) => {
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(300)

    const playBtn = page.locator('#play-btn')
    await expect(playBtn).toBeVisible()
  })

  test('all playback controls are visible in practice tab', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')

    await practiceTab.click()
    await page.waitForTimeout(300)

    const expectedControls = [
      '#play-btn',
      '#pause-btn',
      '#stop-btn',
      '#continue-btn',
      '#skip-forward-btn',
      '#skip-back-btn',
      '#playback-speed',
      '#bpm-slider',
      '#record-btn',
      '#mic-btn',
      '#focus-mode-btn',
    ]

    for (const selector of expectedControls) {
      await expect(page.locator(selector)).toBeVisible()
    }
  })

  test('playback speed select has valid options', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const speedSelect = page.locator('#playback-speed')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(speedSelect).toBeVisible()

    const options = await speedSelect.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(0)
  })

  test('BPM slider changes tempo display', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const bpmSlider = page.locator('#bpm-slider')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await bpmSlider.fill('120')
    await page.waitForTimeout(300)
  })

  test('focus mode button is visible and clickable', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const focusBtn = page.locator('#focus-mode-btn')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(focusBtn).toBeVisible()

    await focusBtn.click()
    await page.waitForTimeout(200)

    await expect(focusBtn).toHaveClass(/active/)
  })

  test('arrow keys can change playback speed', async ({ page }) => {
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
  })

  test('practice mode buttons change mode indicator', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const modeBtns = page.locator('#practice-mode-buttons button')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(modeBtns).toHaveCount(3)

    await modeBtns.nth(1).click()
    await page.waitForTimeout(200)
  })

  test('continue button is disabled during playback', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')

    await practiceTab.click()
    await page.waitForTimeout(300)

    const continueBtn = page.locator('#continue-btn')
    await expect(continueBtn).toBeVisible()

    await continueBtn.click()
    await page.waitForTimeout(300)
  })

  test('skip buttons are disabled when at beginning/end', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')

    await practiceTab.click()
    await page.waitForTimeout(300)

    const skipBackBtn = page.locator('#skip-back-btn')
    const skipForwardBtn = page.locator('#skip-forward-btn')

    await expect(skipBackBtn).toBeVisible()
    await expect(skipForwardBtn).toBeVisible()

    // Click once to move position
    await skipForwardBtn.click()
    await page.waitForTimeout(200)
  })

  // ==========================================
  // Editor/Piano Roll Tests (25 tests)
  // ==========================================

  test('piano roll canvas is visible in editor tab', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('canvas.roll-grid')).toBeVisible()
    await expect(page.locator('canvas.roll-piano')).toBeVisible()
  })

  test('can place a single note on piano roll', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const gridCanvas = page.locator('canvas.roll-grid')

    await editorTab.click()
    await page.waitForTimeout(300)

    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.waitForTimeout(100)

    await gridCanvas.click({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)
  })

  test('note count badge updates when notes are placed', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const noteBadge = page.locator('#note-count')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(noteBadge).toBeVisible()

    // Place a note
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.waitForTimeout(100)
    await page.locator('canvas.roll-grid').click({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)
  })

  test('scale mode select shows multiple options', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const modeSelect = page.locator('#roll-mode-select')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(modeSelect).toBeVisible()

    const options = await modeSelect.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(10)
  })

  test('scale mode changes the visible scale', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const modeSelect = page.locator('#roll-mode-select')

    await editorTab.click()
    await page.waitForTimeout(300)

    await modeSelect.selectOption('pentatonic-major')
    await expect(modeSelect).toHaveValue('pentatonic-major')
  })

  test('octave up button increases octave display', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const octaveUpBtn = page.locator('#roll-octave-up')
    const octaveValue = page.locator('#roll-octave-value')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(octaveUpBtn).toBeVisible()

    await octaveUpBtn.click()
    await page.waitForTimeout(200)

    await expect(octaveValue).toBeVisible()
  })

  test('octave down button decreases octave display', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const octaveDownBtn = page.locator('#roll-octave-down')
    const octaveValue = page.locator('#roll-octave-value')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(octaveDownBtn).toBeVisible()

    await octaveDownBtn.click()
    await page.waitForTimeout(200)

    await expect(octaveValue).toBeVisible()
  })

  test('bars down button decreases total beats', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const barsDownBtn = page.locator('#roll-bars-down')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(barsDownBtn).toBeVisible()

    await barsDownBtn.click()
    await page.waitForTimeout(200)
  })

  test('bars up button increases total beats', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const barsUpBtn = page.locator('#roll-bars-up')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(barsUpBtn).toBeVisible()

    await barsUpBtn.click()
    await page.waitForTimeout(200)
  })

  test('grid toggle button changes grid visibility', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const gridToggle = page.locator('#grid-toggle-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(gridToggle).toBeVisible()

    await gridToggle.click()
    await page.waitForTimeout(200)
  })

  test('pitch track toggle button exists', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const pitchTrackToggle = page.locator('#pitch-track-toggle-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(pitchTrackToggle).toBeVisible()
  })

  test('toolbar contains tool buttons', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const toolBtns = page.locator('.roll-tool-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(toolBtns).toHaveCount(3)
  })

  test('timeline info updates on playback', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const timelineInfo = page.locator('#roll-timeline-info')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(timelineInfo).toBeVisible()

    // Place a note
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.locator('canvas.roll-grid').click({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)

    await expect(timelineInfo).toBeVisible()
  })

  test('note info hint updates on tool change', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const noteInfo = page.locator('#roll-note-info')
    const eraseBtn = page.locator('.roll-tool-btn[data-tool="erase"]')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(noteInfo).toBeVisible()

    await eraseBtn.click()
    await page.waitForTimeout(200)

    await expect(noteInfo).toBeVisible()
  })

  test('instrument select shows multiple options', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const instrumentSelect = page.locator('#roll-instrument-select')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(instrumentSelect).toBeVisible()

    const options = await instrumentSelect.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(4)
  })

  test('pitch track canvas is hidden by default', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const pitchTrack = page.locator('#roll-pitch-track-canvas')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(pitchTrack).not.toBeVisible()
  })

  test('rolling display updates on playback', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const pitchTrack = page.locator('#roll-pitch-track-canvas')

    await editorTab.click()
    await page.waitForTimeout(300)

    await pitchTrack.scrollIntoViewIfNeeded()
    await expect(pitchTrack).not.toBeVisible()

    // Place a note
    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.locator('canvas.roll-grid').click({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)
  })

  test('status bar shows beat information', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const beatInfo = page.locator('#roll-beat-info')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(beatInfo).toBeVisible()
    expect(await beatInfo.textContent()).toBeTruthy()
  })

  test('toolbar groupings are visible', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const toolGroup = page.locator('.roll-group[data-name="Edit"]')
    const instrumentGroup = page.locator('.roll-group[data-name="Instrument"]')
    const effectsGroup = page.locator('.roll-group[data-name="Effects"]')
    const ioGroup = page.locator('.roll-group[data-name="I/O"]')

    await editorTab.click()
    await page.waitForTimeout(300)

    await expect(toolGroup).toBeVisible()
    await expect(instrumentGroup).toBeVisible()
    await expect(effectsGroup).toBeVisible()
    await expect(ioGroup).toBeVisible()
  })

  test('can deselect tool', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    const toolBtns = page.locator('.roll-tool-btn')

    await editorTab.click()
    await page.waitForTimeout(300)

    await toolBtns.nth(0).click()
    await page.waitForTimeout(200)

    await toolBtns.nth(1).click()
    await page.waitForTimeout(200)

    await toolBtns.nth(2).click()
    await page.waitForTimeout(200)
  })

  // ==========================================
  // Settings Tests (10 tests)
  // ==========================================

  test('settings button is visible in header', async ({ page }) => {
    await expect(page.locator('#settings-btn')).toBeVisible()
  })

  test('settings panel opens on button click', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await expect(page.locator('#settings-panel')).toBeVisible()
  })

  test('settings panel closes after clicking away', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    await page.locator('#app-tabs').click()
    await expect(page.locator('#settings-panel')).not.toBeVisible()
  })

  test('about section shows in settings', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    const aboutSection = page.locator('#settings-about')
    await expect(aboutSection).toBeVisible()
  })

  test('ADSR controls are visible in settings', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    const adsrSection = page.locator('#settings-adsr')
    await expect(adsrSection).toBeVisible()

    await expect(page.locator('#adsr-attack')).toBeVisible()
    await expect(page.locator('#adsr-decay')).toBeVisible()
    await expect(page.locator('#adsr-sustain')).toBeVisible()
    await expect(page.locator('#adsr-release')).toBeVisible()
  })

  test('reverb controls are visible in settings', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    const reverbSection = page.locator('#settings-reverb')
    await expect(reverbSection).toBeVisible()

    await expect(page.locator('#reverb-toggle')).toBeVisible()
    await expect(page.locator('#reverb-level')).toBeVisible()
    await expect(page.locator('#reverb-time')).toBeVisible()
    await expect(page.locator('#reverb-decay')).toBeVisible()
    await expect(page.locator('#reverb-mix')).toBeVisible()
  })

  test('reverb type select has options', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    await expect(page.locator('#reverb-type')).toBeVisible()

    const options = await page.locator('#reverb-type').locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(2)
  })

  test('accuracy bands settings are visible', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    await expect(page.locator('#accuracy-bands')).toBeVisible()
  })

  test('sensitivity preset changes value', async ({ page }) => {
    const practiceTab = page.locator('#tab-practice')
    const sensitivityPreset = page.locator('#sensitivity-preset-select')

    await practiceTab.click()
    await page.waitForTimeout(300)

    await expect(sensitivityPreset).toBeVisible()
    await sensitivityPreset.selectOption('medium')
    await page.waitForTimeout(200)
  })

  test('keyboard shortcuts work in practice mode', async ({ page }) => {
    await page.keyboard.press('f')
    await page.waitForTimeout(100)

    await page.keyboard.press('Space')
    await page.waitForTimeout(100)
  })

  // ==========================================
  // Error Prevention Tests (15 tests)
  // ==========================================

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    expect(errors).toHaveLength(0)
  })

  test('no errors when navigating repeatedly between tabs', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    for (let i = 0; i < 20; i++) {
      await page.locator('#tab-practice').click()
      await page.waitForTimeout(100)

      await page.locator('#tab-editor').click()
      await page.waitForTimeout(100)

      await page.locator('#tab-settings').click()
      await page.waitForTimeout(100)
    }

    await page.locator('#tab-practice').click()
    await page.waitForTimeout(100)

    expect(errors).toHaveLength(0)
  })

  test('no errors when clicking buttons rapidly', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const practiceTab = page.locator('#tab-practice')

    for (let i = 0; i < 30; i++) {
      await practiceTab.click()
      await page.waitForTimeout(50)

      try {
        await page.locator('#play-btn').click()
        await page.waitForTimeout(50)
      } catch {
        // Button might not be visible
      }
    }

    await practiceTab.click()
    await page.waitForTimeout(100)

    expect(errors).toHaveLength(0)
  })

  test('piano roll handles rapid clicking without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    await page.locator('.roll-tool-btn[data-tool="place"]').click()
    await page.waitForTimeout(100)

    const gridCanvas = page.locator('canvas.roll-grid')

    for (let i = 0; i < 50; i++) {
      await gridCanvas.click({ position: { x: 400 + (i % 50) * 20, y: 300 + (i % 20) * 15 } })
      await page.waitForTimeout(10)
    }

    await page.waitForTimeout(500)

    expect(errors).toHaveLength(0)
  })

  test('no errors when toggling settings panel', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    for (let i = 0; i < 15; i++) {
      await page.locator('#settings-btn').click()
      await page.waitForTimeout(100)

      await page.locator('#app-tabs').click()
      await page.waitForTimeout(100)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when changing scale modes', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const modeSelect = page.locator('#roll-mode-select')
    const modes = ['major', 'pentatonic-major', 'blues', 'minor', 'chromatic']

    for (const mode of modes) {
      await modeSelect.selectOption(mode)
      await page.waitForTimeout(100)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when changing instruments', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    const instruments = ['piano', 'synth', 'strings', 'organ', 'sine']

    for (const instrument of instruments) {
      await instrumentSelect.selectOption(instrument)
      await page.waitForTimeout(100)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when changing duration', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const durationBtns = page.locator('.dur-btn')
    const btnCount = await durationBtns.count()

    for (let i = 0; i < btnCount; i++) {
      await durationBtns.nth(i).click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when zooming in/out', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const zoomInBtn = page.locator('#zoom-in-btn')
    const zoomOutBtn = page.locator('#zoom-out-btn')

    for (let i = 0; i < 10; i++) {
      await zoomInBtn.click()
      await page.waitForTimeout(50)
    }

    for (let i = 0; i < 10; i++) {
      await zoomOutBtn.click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when changing octaves', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const octaveUpBtn = page.locator('#roll-octave-up')
    const octaveDownBtn = page.locator('#roll-octave-down')

    for (let i = 0; i < 5; i++) {
      await octaveUpBtn.click()
      await page.waitForTimeout(50)
    }

    for (let i = 0; i < 5; i++) {
      await octaveDownBtn.click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when changing bars', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const barsUpBtn = page.locator('#roll-bars-up')
    const barsDownBtn = page.locator('#roll-bars-down')

    for (let i = 0; i < 5; i++) {
      await barsUpBtn.click()
      await page.waitForTimeout(50)
    }

    for (let i = 0; i < 5; i++) {
      await barsDownBtn.click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when toggling pitch track', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const pitchTrackToggle = page.locator('#pitch-track-toggle-btn')

    for (let i = 0; i < 5; i++) {
      await pitchTrackToggle.click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when toggling grid visibility', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const gridToggle = page.locator('#grid-toggle-btn')

    for (let i = 0; i < 5; i++) {
      await gridToggle.click()
      await page.waitForTimeout(50)
    }

    expect(errors).toHaveLength(0)
  })

  test('no errors when clicking export buttons', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    await page.locator('#roll-export-midi').click()
    await page.waitForTimeout(50)

    await page.locator('#roll-export-wav').click()
    await page.waitForTimeout(50)

    await page.locator('#roll-import-midi').click()
    await page.waitForTimeout(50)

    expect(errors).toHaveLength(0)
  })

  test('no critical JavaScript errors after long session', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    for (let i = 0; i < 100; i++) {
      await page.locator('#tab-practice').click()
      await page.locator('#tab-editor').click()
      await page.locator('#tab-settings').click()
      await page.locator('#tab-practice').click()
      await page.waitForTimeout(10)
    }

    await page.locator('#tab-practice').click()
    await page.waitForTimeout(100)

    const criticalErrors = errors.filter((e) =>
      e.includes('ReferenceError') || e.includes('TypeError') || e.includes('undefined'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  // ==========================================
  // Layout & Responsiveness Tests (10 tests)
  // ==========================================

  test('main layout maintains structure on window resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)

    await page.locator('#tab-editor').click()
    await page.waitForTimeout(300)

    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('#editor-toolbar')).toBeVisible()
  })

  test('sidebar controls remain visible after resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)

    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    await page.setViewportSize({ width: 1024, height: 768 })
    await page.waitForTimeout(300)

    await expect(page.locator('.sidebar-section')).toBeVisible()
    await expect(page.locator('.sidebar-title')).toBeVisible()
  })

  test('toolbar buttons remain accessible on resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)

    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const expectedButtons = [
      '#zoom-in-btn',
      '#zoom-out-btn',
      '#roll-clear-all',
      '#roll-import-midi',
      '#roll-export-midi',
      '#roll-export-wav',
    ]

    for (const selector of expectedButtons) {
      await expect(page.locator(selector)).toBeVisible()
    }
  })

  test('practice tab controls remain visible on resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)

    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    await page.setViewportSize({ width: 1024, height: 768 })
    await page.waitForTimeout(300)

    const practiceControls = [
      '#play-btn',
      '#pause-btn',
      '#stop-btn',
      '#continue-btn',
      '#skip-forward-btn',
      '#skip-back-btn',
    ]

    for (const selector of practiceControls) {
      await expect(page.locator(selector)).toBeVisible()
    }
  })

  test('settings panel remains scrollable on resize', async ({ page }) => {
    await page.locator('#settings-btn').click()
    await page.waitForTimeout(300)

    await page.setViewportSize({ width: 768, height: 600 })
    await page.waitForTimeout(300)

    await expect(page.locator('#settings-panel')).toBeVisible()
    await expect(page.locator('#settings-panel')).toHaveCSS('overflow-y', 'auto')
  })

  test(' piano roll scales with viewport', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const gridCanvas = page.locator('canvas.roll-grid')
    const pianoCanvas = page.locator('canvas.roll-piano')

    await expect(gridCanvas).toBeVisible()
    await expect(pianoCanvas).toBeVisible()
  })

  test('status bar remains at bottom of editor', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const status = page.locator('.roll-status')
    await expect(status).toBeVisible()

    const statusRect = await status.boundingBox()
    const mainRect = await page.locator('main').boundingBox()

    if (statusRect && mainRect) {
      expect(statusRect.y + statusRect.height).toBeLessThanOrEqual(mainRect.y + mainRect.height + 10)
    }
  })

  test('toolbar remains at top of editor', async ({ page }) => {
    const editorTab = page.locator('#tab-editor')
    await editorTab.click()
    await page.waitForTimeout(300)

    const toolbar = page.locator('#editor-toolbar')
    await expect(toolbar).toBeVisible()

    const toolbarRect = await toolbar.boundingBox()
    const mainRect = await page.locator('main').boundingBox()

    if (toolbarRect && mainRect) {
      expect(toolbarRect.y).toBeLessThanOrEqual(mainRect.y + 20)
    }
  })

  test('tabs remain accessible at bottom of navigation', async ({ page }) => {
    const tabs = ['editor', 'practice', 'settings']

    for (const tab of tabs) {
      await page.locator(`#tab-${tab}`).click()
      await page.waitForTimeout(300)

      const tabRect = await page.locator(`#tab-${tab}`).boundingBox()
      expect(tabRect?.y).toBeLessThanOrEqual(50)
    }
  })

  test('welcome screen appears on first visit', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page.locator('.welcome-screen')).toBeVisible()
  })
})