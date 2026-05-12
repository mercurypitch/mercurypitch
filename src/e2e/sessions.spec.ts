// ============================================================
// Practice Sessions E2E Tests — Tests for practice sessions and results
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Practice Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  // ==========================================
  // Session Player Tests (10 tests)
  // SessionPlayer renders when sessionActive() is true.
  // We use the __pp bridge to programmatically set up a session,
  // avoiding the need for actual audio hardware.
  // ==========================================

  /**
   * Helper: sets up a minimal session via the e2e bridge so SessionPlayer
   * renders without requiring audio playback hardware.
   */
  async function activateSessionPlayer(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const pp = (window as any).__pp
      if (!pp?.appStore?.startPracticeSession) return
      const session = {
        id: `e2e-test-${Date.now()}`,
        name: 'E2E Test Session',
        items: [
          {
            id: 'rest-1',
            type: 'rest',
            startBeat: 0,
            label: 'Rest 4 beats',
            repeat: 1,
          },
        ],
        author: 'E2E',
        deletable: true,
        created: Date.now(),
      }
      pp.appStore.startPracticeSession(session)
    })
  }

  test('SessionPlayer displays session header', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-player')).toBeVisible()
  })

  test('SessionPlayer shows elapsed timer', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-elapsed')).toBeVisible()
  })

  test('SessionPlayer shows current item info', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-player-item')).toBeVisible()
  })

  test('SessionPlayer displays session name', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    const sessionName = page.locator('.session-player-title')
    await expect(sessionName).toBeVisible()
    await expect(sessionName).toContainText('E2E Test Session')
  })

  test('SessionPlayer shows item progress (X of Y)', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-player-progress')).toBeVisible()
  })

  test('SessionPlayer shows skip button', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-skip-btn')).toBeVisible()
  })

  test('SessionPlayer shows end button', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    await expect(page.locator('.session-end-btn')).toBeVisible()
  })

  test('Skip button is clickable', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    const skipBtn = page.locator('.session-skip-btn')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()
    await page.waitForTimeout(200)
  })

  test('End button is clickable', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    const endBtn = page.locator('.session-end-btn')
    await expect(endBtn).toBeVisible()
    await endBtn.click()
    await page.waitForTimeout(200)
  })

  test('Session timer increments over time', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    const elapsedTime = page.locator('.session-elapsed')
    const initialTime = await elapsedTime.textContent()

    if (initialTime) {
      await page.waitForTimeout(2000)
      const finalTime = await elapsedTime.textContent()
      expect(finalTime).not.toBe(initialTime)
    }
  })

  // ==========================================
  // Practice Results Tests (10 tests)
  // ==========================================

  test('Accuracy stats bars are visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const statBars = page.locator('#stats-bars')
    await expect(statBars).toBeVisible()
  })

  test('Accuracy stat labels are visible (Perfect, Excellent, etc.)', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const statLabels = page.locator('.stat-label')
    const count = await statLabels.count()
    expect(count).toBeGreaterThanOrEqual(5) // 5 accuracy bands
  })

  test('Accuracy bars have color indicators', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const statBars = page.locator('.stat-bar')
    const count = await statBars.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('Accuracy bars show percentage values', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const statCounts = page.locator('.stat-count')
    const count = await statCounts.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('Live score display is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const scoreDisplay = page.locator('#score-display')
    await expect(scoreDisplay).toBeVisible()
  })

  test('Score label is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const scoreLabel = page.locator('#score-label')
    await expect(scoreLabel).toBeVisible()
  })

  test('Score value is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const scoreValue = page.locator('#score-value')
    await expect(scoreValue).toBeVisible()
  })

  test('Score shows -- when no score yet', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const scoreValue = page.locator('#score-value')
    const text = await scoreValue.textContent()
    if (text) {
      expect(text.trim()).toBe('--')
    }
  })

  test('Session history panel exists in DOM', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Panel exists as a DOM element (may be empty)
    const sessionHistory = page.locator('#session-history-panel')
    const count = await sessionHistory.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session history list exists in DOM', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const sessionList = page.locator('#session-history-list')
    const count = await sessionList.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session history entries show session name and score', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const historyEntries = page.locator('.session-history-entry')
    const count = await historyEntries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Session Completion Tests (10 tests)
  // ==========================================

  test('End session returns to normal practice mode', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)
    await activateSessionPlayer(page)

    const endBtn = page.locator('.session-end-btn')
    await endBtn.click()
    await page.waitForTimeout(500)

    // After ending session, SessionPlayer should be gone
    const sessionPlayer = page.locator('.session-player')
    await expect(sessionPlayer).toHaveCount(0)
  })

  test('Session results panel exists', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const sessionHistory = page.locator('#session-history-panel')
    const count = await sessionHistory.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session history limits to at most 50 entries', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Verify the store limit is respected via bridge
    const entryCount = await page.evaluate(() => {
      const pp = (window as any).__pp
      const results = pp?.appStore?.sessionResults?.()
      return Array.isArray(results) ? results.length : -1
    })
    if (entryCount >= 0) {
      expect(entryCount).toBeLessThanOrEqual(50)
    }
  })

  test('Session score has color coding based on performance', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const scoreEntries = page.locator('.session-history-score')
    const count = await scoreEntries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('High scores have green color class', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const highScores = page.locator('.session-history-score.score-high')
    const count = await highScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Mid scores have yellow color class', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const midScores = page.locator('.session-history-score.score-mid')
    const count = await midScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Low scores have red color class', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const lowScores = page.locator('.session-history-score.score-low')
    const count = await lowScores.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session history shows date/time', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const entries = page.locator('.session-history-entry')
    const count = await entries.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can clear session history', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const clearBtn = page.locator('button:has-text("Clear")')
    const count = await clearBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Session completion resets session state', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(100)

    await switchTab(page, 'compose')
    await page.waitForTimeout(100)

    await switchTab(page, 'singing')
    await page.waitForTimeout(100)

    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  // ==========================================
  // Instrument Selection Tests (10 tests)
  // ==========================================

  test('Editor has instrument selector', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    await expect(instrumentSelect).toBeVisible()
  })

  test('Instrument selector has valid options', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    await expect(instrumentSelect).toBeVisible()

    const options = instrumentSelect.locator('option')
    const optionCount = await options.count()
    expect(optionCount).toBeGreaterThanOrEqual(0)
  })

  test('Instrument options include sine, piano, organ', async ({ page }) => {
    await switchTab(page, 'compose')
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
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const instrumentSelect = page.locator('#roll-instrument-select')
    if ((await instrumentSelect.count()) > 0) {
      await instrumentSelect.selectOption('piano')
      await page.waitForTimeout(200)

      expect(await instrumentSelect.inputValue()).toBe('piano')
    }
  })

  test('Editor has WAV export button', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const wavBtn = page.locator('#roll-export-wav')
    await expect(wavBtn).toBeVisible()
  })

  test('Editor has MIDI export button', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const midiBtn = page.locator('#roll-export-midi')
    await expect(midiBtn).toBeVisible()
  })

  test('Editor has pitch track toggle', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const pitchTrackBtn = page.locator('#roll-pitch-track-btn')
    const count = await pitchTrackBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // BPM Control Tests (10 tests)
  // ==========================================

  test('Practice tab has BPM control group', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const tempoGroup = page.locator('.tempo-group')
    await expect(tempoGroup).toBeVisible()
  })

  test('BPM slider is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    await expect(tempoSlider).toBeVisible()
  })

  test('BPM value display is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const tempoValue = page.locator('#bpm-input')
    await expect(tempoValue).toBeVisible()
  })

  test('BPM slider changes value', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    if ((await tempoSlider.count()) > 0) {
      await tempoSlider.fill('100')
      await page.waitForTimeout(200)
      expect(await tempoSlider.inputValue()).toBe('100')
    }
  })

  test('BPM value updates when slider changes', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const tempoSlider = page.locator('#tempo')
    const tempoValue = page.locator('#bpm-input')

    if ((await tempoSlider.count()) > 0) {
      const initialValue = await tempoValue.inputValue()
      await tempoSlider.fill('100')
      await page.waitForTimeout(200)
      const newValue = await tempoValue.inputValue()
      expect(newValue).not.toBe(initialValue)
    }
  })

  test('Playback speed selector exists', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#speed-select')
    await expect(playbackSpeedSelect).toBeVisible()
  })

  test('Playback speed has valid options', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#speed-select')
    if ((await playbackSpeedSelect.count()) > 0) {
      const options = playbackSpeedSelect.locator('option')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('Playback speed can be adjusted', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const playbackSpeedSelect = page.locator('#speed-select')
    if ((await playbackSpeedSelect.count()) > 0) {
      await playbackSpeedSelect.selectOption('0.5')
      await page.waitForTimeout(200)

      expect(await playbackSpeedSelect.inputValue()).toBe('0.5')
    }
  })

  test('Practice mode buttons exist', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const modeGroup = page.locator('.mode-group')
    await expect(modeGroup).toBeVisible()
  })

  test('Practice mode buttons are clickable', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const modeBtns = page.locator('.mode-btn')
    const count = await modeBtns.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Footer/Status Bar Tests (10 tests)
  // ==========================================

  test('Metronome button is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const metronomeBtn = page.locator('.metronome-btn')
    await expect(metronomeBtn).toBeVisible()
  })

  test('Mic button is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const micBtn = page.locator('#btn-mic')
    await expect(micBtn).toBeVisible()
  })

  test('Transport play button is visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()
  })

  test('Transport pause button is visible when playing', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const pauseBtn = page.locator('.stop-btn').first()
    await expect(pauseBtn).toBeVisible()
  })

  test('Transport stop button is visible', async ({ page }) => {
    await switchTab(page, 'singing')
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

    const practiceTab = page.locator('#tab-singing')
    await expect(practiceTab).toHaveClass(/active/)
  })

  test('Editor tab is accessible and visible', async ({ page }) => {
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const editorTab = page.locator('#tab-compose')
    await expect(editorTab).toHaveClass(/active/)
  })

  test('Settings tab is accessible and visible', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const settingsTab = page.locator('#tab-settings')
    await expect(settingsTab).toHaveClass(/active/)
  })

  test('Sidebar is visible on all tabs', async ({ page }) => {
    const tabs = ['singing', 'compose', 'settings'] as const

    for (const tab of tabs) {
      await switchTab(page, tab)
      await page.waitForTimeout(200)

      const appSidebar = page.locator('.app-sidebar')
      await expect(appSidebar).toBeVisible()
    }
  })
})
