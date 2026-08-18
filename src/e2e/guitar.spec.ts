import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { dismissOverlays, openNavTab } from './helpers/ui'

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
// The view switch is a shared SegmentedControl (role=radiogroup) in the song
// status bar; the active segment carries aria-checked, and the Fretboard
// segment has its own data-tour hook.
const viewGroup = '[data-tour="guitar.view-toggle"]'
const fretboardBtn = () => `${viewGroup} button:has-text("Fretboard")`
const practiceBtn = () => `${viewGroup} button:has-text("Practice")`

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

    await openNavTab(page, 'tab-guitar')
    await expect(page.locator('#tab-guitar')).toHaveClass(/active/)
    await expect(page.locator(panel)).toBeVisible()
  })

  test('reaches Guitar Night from the phone bar @smoke', async ({ page }) => {
    // The room used to be three taps down the options sheet — "Options >
    // More > Guitar Night > Open" — while the Singing page put its room-ish
    // door straight in the bar. One tap now, and still in the sheet.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator(panel)).toBeVisible()

    const chip = page.getByTestId('guitar-room-chip')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveAttribute('href', '/guitar-night')

    const options = page.locator('[data-tour="guitar.options"]')
    await expect(options).toBeVisible()

    // Same row as the options button, not stacked below it.
    const [chipBox, optionsBox] = await Promise.all([
      chip.boundingBox(),
      options.boundingBox(),
    ])
    expect(chipBox).not.toBeNull()
    expect(optionsBox).not.toBeNull()
    expect(
      Math.abs((chipBox?.y ?? 0) - (optionsBox?.y ?? 0)),
    ).toBeLessThanOrEqual(2)

    // A thumb, not a 25px sliver — both chips, since they share the rule.
    expect(chipBox?.height ?? 0).toBeGreaterThanOrEqual(34)
    expect(chipBox?.width ?? 0).toBeGreaterThanOrEqual(34)
    expect(optionsBox?.height ?? 0).toBeGreaterThanOrEqual(34)

    // And the taller chips must not have pushed the bar off the screen.
    const sideways = await page.evaluate(() => {
      const doc = document.scrollingElement
      return doc === null ? 0 : doc.scrollWidth - doc.clientWidth
    })
    expect(sideways).toBe(0)

    // The drawer keeps its own entry.
    await options.click()
    await expect(page.getByRole('link', { name: /Open/ }).first()).toBeVisible()
  })

  test('opens on the Practice (hero) view with the fretboard + toolbar', async ({
    page,
  }) => {
    await expect(page.locator(practiceBtn())).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.locator('#guitar-fretboard-container')).toBeVisible()
    // The song status bar (song picker + controls) is present in both views.
    await expect(
      page.locator(`${panel} [data-testid="gp-song-status-bar"]`),
    ).toBeVisible()
  })

  test('switches to the Fretboard (interactive) view and shows mode controls', async ({
    page,
  }) => {
    await page.locator(fretboardBtn()).click()
    await expect(page.locator(fretboardBtn())).toHaveAttribute(
      'aria-checked',
      'true',
    )
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

  // ============================================================
  // On a phone the fretboard comes first
  // ============================================================
  //
  // Each mode hangs its own controls above the fretboard. At 390px that
  // stack pushed the fretboard off the bottom of the screen — the thing the
  // page exists for. The controls collapse to one row now.
  //
  // The desktop case is the test right above this one: every HUD still
  // renders, because the collapse is a media query and nothing else.

  test('collapses the mode controls on a phone @smoke', async ({ page }) => {
    // Reach the view at full width first: the view toggle itself lives in the
    // desktop toolbar, which is a separate gap and not what this covers.
    await page.locator(fretboardBtn()).click()
    await modeSelect(page).selectOption('noteQuiz')
    await expect(page.locator('.gp-quiz-hud')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })

    const toggle = page.getByTestId('guitar-mode-hud-toggle')
    await expect(toggle).toBeVisible()
    await expect(page.locator('.gp-quiz-hud')).toBeHidden()

    // It names the mode it is holding, so it is not a mystery drawer.
    await expect(toggle).toContainText('Note quiz')

    // A thumb-sized target: it is the only way back to the controls.
    const box = await toggle.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)

    // The point of all this: the fretboard is on screen.
    const fretboard = page.locator('#guitar-fretboard-container')
    const top = await fretboard.evaluate(
      (element) => element.getBoundingClientRect().top,
    )
    expect(top).toBeLessThan(844)

    // And the controls are one tap away, not gone.
    await toggle.click()
    await expect(page.locator('.gp-quiz-hud')).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('instrument selector toggles the active sound', async ({ page }) => {
    // Sound is a SegmentedControl (role=radiogroup) in the status bar.
    const electric = page.locator(
      '[data-tour="guitar.instruments"] button:has-text("Electric")',
    )
    await electric.click()
    await expect(electric).toHaveAttribute('aria-checked', 'true')
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
    await openNavTab(page, 'tab-singing')
    await expect(page.locator('#tab-singing')).toHaveClass(/active/)
    await openNavTab(page, 'tab-guitar')
    await expect(page.locator(panel)).toBeVisible()

    // State survived: still Fretboard view, still CAGED mode.
    await expect(page.locator(fretboardBtn())).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.locator('.gp-caged-hud')).toBeVisible()
  })

  test('routes the global mic shortcut through Guitar ownership', async ({
    page,
  }) => {
    const micButton = page.locator('#btn-mic')
    await expect(micButton).toHaveAttribute('aria-pressed', 'false')

    await page.keyboard.press('m')
    await expect(micButton).toHaveAttribute('aria-pressed', 'true')

    await openNavTab(page, 'tab-singing')
    await openNavTab(page, 'tab-guitar')
    await expect(page.locator('#btn-mic')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('@smoke stops the interactive drum loop when its surface is left', async ({
    page,
  }) => {
    await page.locator(fretboardBtn()).click()
    await modeSelect(page).selectOption('jam')
    const drumPlay = page.locator('.dm-btn-play')

    await expect(drumPlay).toBeVisible()
    await drumPlay.click()
    await expect(drumPlay).toHaveText('Stop')

    await page.locator(practiceBtn()).click()
    await expect(drumPlay).toHaveCount(0)
    await page.locator(fretboardBtn()).click()

    await expect(drumPlay).toHaveText('Play')
    await expect(page.locator('.dm-status')).toHaveText('Stopped')

    await drumPlay.click()
    await expect(drumPlay).toHaveText('Stop')
    await openNavTab(page, 'tab-singing')
    await openNavTab(page, 'tab-guitar')

    await expect(page.locator('.dm-btn-play')).toHaveText('Play')
    await expect(page.locator('.dm-status')).toHaveText('Stopped')
  })
})
