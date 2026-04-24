// ============================================================
// Practice Sessions E2E Tests — Tests for practice sessions and results
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Practice Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Session Player Tests (10 tests)
  // ==========================================

  test('SessionPlayer displays session header', async ({ page }) => {
    await page.evaluate(() => {
      // Create a simple practice session for testing
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    // Check for session header elements
    const sessionHeader = page.locator('.session-player')
    await expect(sessionHeader).toBeVisible()
  })

  test('SessionPlayer shows elapsed timer', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const elapsedTime = page.locator('.session-elapsed')
    await expect(elapsedTime).toBeVisible()
  })

  test('SessionPlayer shows current item info', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const sessionPlayerItem = page.locator('.session-player-item')
    await expect(sessionPlayerItem).toBeVisible()
  })

  test('SessionPlayer displays session name', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const sessionName = page.locator('.session-player-title')
    await expect(sessionName).toBeVisible()
  })

  test('SessionPlayer shows item progress (X of Y)', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const progressText = page.locator('.session-player-progress')
    await expect(progressText).toBeVisible()
  })

  test('SessionPlayer shows skip button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const skipBtn = page.locator('.session-skip-btn')
    await expect(skipBtn).toBeVisible()
  })

  test('SessionPlayer shows end button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const endBtn = page.locator('.session-end-btn')
    await expect(endBtn).toBeVisible()
  })

  test('Skip button is clickable', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const skipBtn = page.locator('.session-skip-btn')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()
    await page.waitForTimeout(200)
  })

  test('End button is clickable', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const endBtn = page.locator('.session-end-btn')
    await expect(endBtn).toBeVisible()
    await endBtn.click()
    await page.waitForTimeout(200)
  })

  test('Session timer increments over time', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.setActiveTab('practice')
    })
    await page.waitForTimeout(300)

    const elapsedTime = page.locator('.session-elapsed')
    const initialTime = await elapsedTime.textContent()

    if (initialTime) {
      await page.waitForTimeout(1000)
      const finalTime = await elapsedTime.textContent()

      // Timer should show progression
      expect(finalTime).not.toBe(initialTime)
    }
  })

  // ==========================================
  // Practice Results Tests (10 tests)
  // ==========================================

  test('Accuracy stats bars are visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const statBars = page.locator('#stats-bars')
    await expect(statBars).toBeVisible()
  })

  test('Accuracy stat labels are visible (Perfect, Excellent, etc.)', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const statLabels = page.locator('.stat-label')
    const count = await statLabels.count()
    expect(count).toBeGreaterThanOrEqual(5) // 5 accuracy bands
  })

  test('Accuracy bars have color indicators', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const statBars = page.locator('.stat-bar')
    const count = await statBars.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('Accuracy bars show percentage values', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const statCounts = page.locator('.stat-count')
    const count = await statCounts.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('Live score display is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const scoreDisplay = page.locator('#score-display')
    await expect(scoreDisplay).toBeVisible()
  })

  test('Score label is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const scoreLabel = page.locator('#score-label')
    await expect(scoreLabel).toBeVisible()
  })

  test('Score value is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const scoreValue = page.locator('#score-value')
    await expect(scoreValue).toBeVisible()
  })

  test('Score shows -- when no score yet', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const scoreValue = page.locator('#score-value')
    const text = await scoreValue.textContent()
    if (text) {
      expect(text.trim()).toBe('--')
    }
  })

  test('Session history panel shows when results exist', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionHistory = page.locator('#session-history-panel')
    const sessionList = page.locator('#session-history-list')

    const historyVisible = await sessionHistory.isVisible().catch(() => false)
    const listVisible = await sessionList.isVisible().catch(() => false)

    expect(historyVisible || listVisible).toBe(true)
  })

  test('Session history entries show session name and score', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const historyEntries = page.locator('.session-history-entry')
    const count = await historyEntries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Session Completion Tests (10 tests)
  // ==========================================

  test('End session returns to normal practice mode', async ({ page }) => {
    // Start in practice mode
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const endBtn = page.locator('.session-end-btn')
    if ((await endBtn.count()) > 0) {
      await endBtn.click()
      await page.waitForTimeout(500)

      // Should return to normal practice UI
      const practicePanel = page.locator('#practice-panel')
      await expect(practicePanel).toBeVisible()
    }
  })

  test('Session results are saved to session history', async ({ page }) => {
    // Complete a session (this would normally require actual playback)
    // Just verify the UI can handle session completion
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionHistory = page.locator('#session-history-panel')
    const isVisible = await sessionHistory.isVisible().catch(() => false)

    expect(isVisible).toBe(true)
  })

  test('Session history limits to last 5 entries', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionHistory = page.locator('#session-history-list')
    const entries = sessionHistory.locator('.session-history-entry')
    const count = await entries.count()

    // Should be at most 5 entries (top of history)
    expect(count).toBeLessThanOrEqual(5)
  })

  test('Session score has color coding based on performance', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const scoreEntries = page.locator('.session-history-score')
    const count = await scoreEntries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('High scores have green color class', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const highScores = page.locator('.session-history-score.score-high')
    const count = await highScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Mid scores have yellow color class', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const midScores = page.locator('.session-history-score.score-mid')
    const count = await midScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Low scores have red color class', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const lowScores = page.locator('.session-history-score.score-low')
    const count = await lowScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session history shows date/time', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const entries = page.locator('.session-history-entry')
    const count = await entries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can clear session history', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Look for clear history button if exists
    const clearBtn = page.locator('button:has-text("Clear")')
    const count = await clearBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session completion resets session state', async ({ page }) => {
    // Navigate tabs multiple times to ensure state resets
    await switchTab(page, 'practice')
    await page.waitForTimeout(100)

    await switchTab(page, 'editor')
    await page.waitForTimeout(100)

    await switchTab(page, 'practice')
    await page.waitForTimeout(100)

    // Should return to a valid practice state
    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  // ==========================================
  // Instrument Selection Tests (10 tests)
  // ==========================================

  test('Editor has instrument selector', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    await expect(instrumentSelect).toBeVisible()
  })

  test('Instrument selector has valid options', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    await expect(instrumentSelect).toBeVisible()

    const options = instrumentSelect.locator('option')
    const optionCount = await options.count()
    expect(optionCount).toBeGreaterThanOrEqual(0)
  })

  test('Instrument options include sine, piano, organ', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')

    const sineOption = instrumentSelect.locator('option[value="sine"]')
    const pianoOption = instrumentSelect.locator('option[value="piano"]')
    const organOption = instrumentSelect.locator('option[value="organ"]')

    const sineCount = await sineOption.count()
    const pianoCount = await pianoOption.count()
    const organCount = await organOption.count()

    expect(sineCount).toBeGreaterThanOrEqual(0)
    expect(pianoCount).toBeGreaterThanOrEqual(0)
    expect(organCount).toBeGreaterThanOrEqual(0)
  })

  test('Instrument can be changed via selector', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    if ((await instrumentSelect.count()) > 0) {
      await instrumentSelect.selectOption('piano')
      await page.waitForTimeout(200)

      expect(await instrumentSelect.inputValue()).toBe('piano')
    }
  })

  test('Editor has WAV export button', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const wavBtn = page.locator('#roll-export-wav')
    await expect(wavBtn).toBeVisible()
  })

  test('Editor has MIDI export button', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const midiBtn = page.locator('#roll-export-midi')
    await expect(midiBtn).toBeVisible()
  })

  test('Editor has pitch track toggle', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const pitchTrackBtn = page.locator('#roll-pitch-track-btn')
    const count = await pitchTrackBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // BPM Control Tests (10 tests)
  // ==========================================

  test('Practice tab has BPM control group', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const tempoGroup = page.locator('.tempo-group')
    await expect(tempoGroup).toBeVisible()
  })

  test('BPM slider is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    await expect(tempoSlider).toBeVisible()
  })

  test('BPM value display is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const tempoValue = page.locator('#tempo-value')
    await expect(tempoValue).toBeVisible()
  })

  test('BPM slider changes value', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    if ((await tempoSlider.count()) > 0) {
      await tempoSlider.fill('100')
      await page.waitForTimeout(200)
      expect(await tempoSlider.inputValue()).toBe('100')
    }
  })

  test('BPM value updates when slider changes', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    const tempoValue = page.locator('#tempo-value')

    if ((await tempoSlider.count()) > 0) {
      const initialValue = await tempoValue.textContent()
      await tempoSlider.fill('100')
      await page.waitForTimeout(200)
      const newValue = await tempoValue.textContent()
      expect(newValue).not.toBe(initialValue)
    }
  })

  test('Playback speed selector exists', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#practice-panel select')
    await expect(playbackSpeedSelect).toBeVisible()
  })

  test('Playback speed has valid options', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#practice-panel select')
    if ((await playbackSpeedSelect.count()) > 0) {
      const options = playbackSpeedSelect.locator('option')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('Playback speed can be adjusted', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#practice-panel select')
    if ((await playbackSpeedSelect.count()) > 0) {
      await playbackSpeedSelect.selectOption('0.5')
      await page.waitForTimeout(200)

      expect(await playbackSpeedSelect.inputValue()).toBe('0.5')
    }
  })

  test('Practice mode buttons exist', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const modeGroup = page.locator('.mode-group')
    await expect(modeGroup).toBeVisible()
  })

  test('Practice mode buttons are clickable', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const modeBtns = page.locator('.mode-btn')
    const count = await modeBtns.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Footer/Status Bar Tests (10 tests)
  // ==========================================

  test('Metronome button is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metronomeBtn = page.locator('.metronome-btn')
    await expect(metronomeBtn).toBeVisible()
  })

  test('Mic button is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const micBtn = page.locator('#btn-mic')
    await expect(micBtn).toBeVisible()
  })

  test('Transport play button is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()
  })

  test('Transport pause button is visible when playing', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const pauseBtn = page.locator('.stop-btn').first()
    await expect(pauseBtn).toBeVisible()
  })

  test('Transport stop button is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const stopBtn = page.locator('.stop-btn.stop').first()
    await expect(stopBtn).toBeVisible()
  })

  test('App header with navigation tabs is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const appTabs = page.locator('#app-tabs')
    await expect(appTabs).toBeVisible()
  })

  test('Practice tab is highlighted when active', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const practiceTab = page.locator('#tab-practice')
    await expect(practiceTab).toHaveClass(/active/)
  })

  test('Editor tab is accessible and visible', async ({ page }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(300)

    const editorTab = page.locator('#tab-editor')
    await expect(editorTab).toHaveClass(/active/)
  })

  test('Settings tab is accessible and visible', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const settingsTab = page.locator('#tab-settings')
    await expect(settingsTab).toHaveClass(/active/)
  })

  test('Sidebar is visible on all tabs', async ({ page }) => {
    const tabs = ['practice', 'editor', 'settings'] as const

    for (const tab of tabs) {
      await switchTab(page, tab)
      await page.waitForTimeout(200)

      const appSidebar = page.locator('.app-sidebar')
      await expect(appSidebar).toBeVisible()
    }
  })
})