import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { dismissOverlays } from './helpers/ui'

// Fake mic/camera so the modes that acquire the microphone (singToFretboard,
// hero gameplay) don't prompt or hang in headless Chromium.
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

// Each interactive fretboard mode and the HUD it should render.
const MODE_HUDS: Array<{ mode: string; hud: string }> = [
  { mode: 'noteQuiz', hud: '.gp-quiz-hud' },
  { mode: 'earTraining', hud: '.gp-ear-panel' },
  { mode: 'melodyTranscription', hud: '.gp-transcription-hud' },
  { mode: 'callResponse', hud: '.gp-callresponse-hud' },
  { mode: 'cagedTrainer', hud: '.gp-caged-hud' },
  { mode: 'chordProgression', hud: '.gp-chordprog-hud' },
  { mode: 'singToFretboard', hud: '.gp-singtofret-hud' },
  { mode: 'transcriptionTrainer', hud: '.gp-tt-hud' },
  { mode: 'adaptiveJam', hud: '.gp-aj-hud' },
]

const panel = '#guitar-practice-panel'
const fretboardBtn = () =>
  `${panel} .gp-view-toggle button:has-text("Fretboard")`
const practiceBtn = () => `${panel} .gp-view-toggle button:has-text("Practice")`

/** The mode <select> — the only key/scale select that offers fretboard modes. */
function modeSelect(page: import('@playwright/test').Page) {
  return page.locator('select.gp-key-scale-select', {
    has: page.locator('option[value="noteQuiz"]'),
  })
}

test.describe('Guitar tab', () => {
  test.beforeEach(async ({ page }) => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { version: string }
    await page.addInitScript((version) => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_active_tab', 'singing')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
    }, pkg.version)
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    await page.locator('#tab-guitar').click()
    await expect(page.locator('#tab-guitar')).toHaveClass(/active/)
    await expect(page.locator(panel)).toBeVisible()
  })

  test('opens on the Practice (hero) view with the fretboard + toolbar', async ({
    page,
  }) => {
    await expect(page.locator(practiceBtn())).toHaveClass(/gp-view-tab-active/)
    await expect(page.locator('#guitar-fretboard-container')).toBeVisible()
    // Toolbar + song picker are present in both views.
    await expect(page.locator(`${panel} .gp-header-controls`)).toBeVisible()
  })

  test('switches to the Fretboard (interactive) view and shows mode controls', async ({
    page,
  }) => {
    await page.locator(fretboardBtn()).click()
    await expect(page.locator(fretboardBtn())).toHaveClass(/gp-view-tab-active/)
    await expect(modeSelect(page)).toBeVisible()
    await expect(page.locator('#guitar-fretboard-container')).toBeVisible()
  })

  test('every interactive mode renders its HUD', async ({ page }) => {
    await page.locator(fretboardBtn()).click()
    const select = modeSelect(page)
    for (const { mode, hud } of MODE_HUDS) {
      await select.selectOption(mode)
      await expect(page.locator(hud)).toBeVisible()
    }
  })

  test('instrument selector toggles the active sound', async ({ page }) => {
    const electric = page.locator(`${panel} .gp-instrument-btn`, {
      hasText: 'Electric',
    })
    await electric.click()
    await expect(electric).toHaveClass(/gp-instrument-active/)
  })

  test('key and scale selectors are usable in the Fretboard view', async ({
    page,
  }) => {
    await page.locator(fretboardBtn()).click()
    // KeyScaleSelector renders key + scale selects alongside the mode select.
    const selects = page.locator(`${panel} select.gp-key-scale-select`)
    await expect(selects).not.toHaveCount(0)
  })

  test('preserves guitar state across tab switches (GuitarContext)', async ({
    page,
  }) => {
    // Set a distinctive state: interactive view + CAGED mode.
    await page.locator(fretboardBtn()).click()
    await modeSelect(page).selectOption('cagedTrainer')
    await expect(page.locator('.gp-caged-hud')).toBeVisible()

    // Leave to Singing, then return to Guitar.
    await page.locator('#tab-singing').click()
    await expect(page.locator('#tab-singing')).toHaveClass(/active/)
    await page.locator('#tab-guitar').click()
    await expect(page.locator(panel)).toBeVisible()

    // State survived: still Fretboard view, still CAGED mode.
    await expect(page.locator(fretboardBtn())).toHaveClass(/gp-view-tab-active/)
    await expect(page.locator('.gp-caged-hud')).toBeVisible()
  })
})
