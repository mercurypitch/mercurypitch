// ============================================================
// Compose drum kit mode + clickable keys + hover hints E2E
// ============================================================
//
// Real-mouse coverage for the pointer-driven compose additions: the
// Melody/Drums preset toggle, grid placement on drum lanes, the playable
// left keyboard, and the hover-hint tooltip. Selectors like
// [data-testid="compose-kind-drums"] only exist with the feature — the
// suite is inherently red on any build without it.

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

interface EditorBridge {
  getKind: () => 'melody' | 'drums'
  getScale: () => { midi: number; name: string; octave: number }[]
  getMelody: () => { note: { midi: number }; startBeat: number }[]
}

function editor(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const ed = (window as unknown as { pianoRollEditor?: EditorBridge })
      .pianoRollEditor
    if (!ed) return null
    return {
      kind: ed.getKind(),
      rows: ed.getScale().map((s) => s.midi),
      melody: ed.getMelody().map((n) => ({
        midi: n.note.midi,
        startBeat: n.startBeat,
      })),
    }
  })
}

test.describe('Compose drum kit mode', () => {
  const pageErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0
    page.on('pageerror', (err) => pageErrors.push(String(err)))
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    await switchTab(page, 'compose')
    await page.waitForTimeout(500)
    // Fresh melody state per test
    await page.evaluate(() => {
      const win = window as unknown as {
        pianoRollEditor?: { clearMelody?: () => void }
      }
      win.pianoRollEditor?.clearMelody?.()
    })
  })

  test('preset toggle swaps to 12 GM drum lanes and back @smoke', async ({
    page,
  }) => {
    const drumsBtn = page.locator('[data-testid="compose-kind-drums"]')
    const melodyBtn = page.locator('[data-testid="compose-kind-melody"]')
    await expect(drumsBtn).toBeVisible()
    await expect(melodyBtn).toHaveAttribute('aria-selected', 'true')

    await drumsBtn.click()
    await page.waitForTimeout(300)
    await expect(drumsBtn).toHaveAttribute('aria-selected', 'true')

    const state = await editor(page)
    expect(state?.kind).toBe('drums')
    expect(state?.rows).toEqual([
      51, 50, 49, 47, 46, 45, 44, 42, 39, 38, 37, 36,
    ])

    await melodyBtn.click()
    await page.waitForTimeout(300)
    const back = await editor(page)
    expect(back?.kind).toBe('melody')
    expect(back?.rows.length).toBeGreaterThan(12)
    expect(pageErrors).toEqual([])
  })

  test('real mouse places a snare hit on the snare lane @smoke', async ({
    page,
  }) => {
    await page.locator('[data-testid="compose-kind-drums"]').click()
    await page.waitForTimeout(300)

    const grid = page.locator('.roll-grid')
    await expect(grid).toBeVisible()
    const box = await grid.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    // Row 9 (0-based) of the 12 lanes = snare (midi 38); rowHeight 22.
    const x = box.x + 24 // first beat
    const y = box.y + 9 * 22 + 11
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(200)

    const state = await editor(page)
    expect(state?.melody).toHaveLength(1)
    expect(state?.melody[0]?.midi).toBe(38)
    expect(pageErrors).toEqual([])
  })

  test('left keyboard press auditions a lane without errors @smoke', async ({
    page,
  }) => {
    await page.locator('[data-testid="compose-kind-drums"]').click()
    await page.waitForTimeout(300)

    const keys = page.locator('.roll-piano')
    await expect(keys).toBeVisible()
    const box = await keys.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    // Press the kick lane (bottom), then drag up two lanes (glissando path)
    const x = box.x + box.width / 2
    await page.mouse.move(x, box.y + 11 * 22 + 11)
    await page.mouse.down()
    await page.mouse.move(x, box.y + 9 * 22 + 11, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(200)
    expect(pageErrors).toEqual([])
  })

  test('hover hints name the drum piece and can be toggled off @smoke', async ({
    page,
  }) => {
    await page.locator('[data-testid="compose-kind-drums"]').click()
    await page.waitForTimeout(300)

    const grid = page.locator('.roll-grid')
    const box = await grid.boundingBox()
    if (!box) return

    // Place a snare hit, then hover it
    const x = box.x + 24
    const y = box.y + 9 * 22 + 11
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(200)
    await page.mouse.move(box.x + 300, box.y + 5) // leave the note
    await page.mouse.move(x + 4, y, { steps: 3 }) // hover the placed note
    const tip = page.locator('#roll-hover-tip')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Snare')

    // Off the note -> hidden
    await page.mouse.move(box.x + 400, box.y + 5, { steps: 3 })
    await expect(tip).toBeHidden()

    // Toggle hints off; hovering shows nothing; setting persists
    await page.locator('#roll-hint-toggle').click()
    await page.mouse.move(x + 4, y, { steps: 3 })
    await expect(tip).toBeHidden()
    const persisted = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_compose_hints'),
    )
    expect(persisted).toBe('false')
    expect(pageErrors).toEqual([])
  })

  test('record button disables in drum mode and notes survive the round-trip', async ({
    page,
  }) => {
    const record = page.locator('[data-testid="record-btn"]')
    await expect(record).toBeEnabled()

    await page.locator('[data-testid="compose-kind-drums"]').click()
    await page.waitForTimeout(300)
    await expect(record).toBeDisabled()

    // Place a kick, flip back to melody, note must survive
    const grid = page.locator('.roll-grid')
    const box = await grid.boundingBox()
    if (!box) return
    await page.mouse.move(box.x + 24, box.y + 11 * 22 + 11)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(200)

    await page.locator('[data-testid="compose-kind-melody"]').click()
    await page.waitForTimeout(300)
    await expect(record).toBeEnabled()
    const state = await editor(page)
    expect(state?.kind).toBe('melody')
    expect(state?.melody).toHaveLength(1)
    expect(state?.melody[0]?.midi).toBe(36)
    expect(pageErrors).toEqual([])
  })

  test('scale type survives Rows + (store/editor scale sync) @smoke', async ({
    page,
  }) => {
    const modeSelect = page.locator('#roll-mode-select')
    await modeSelect.selectOption('harmonic-minor')
    await page.waitForTimeout(400)

    // C harmonic minor carries Ab/G# (midi % 12 === 8) and no E natural (4).
    let state = await editor(page)
    expect(state?.rows.some((m) => m % 12 === 8)).toBe(true)

    await page.locator('#roll-octaves-plus').click()
    await page.waitForTimeout(400)

    // The regression rebuilt the grid in C major here: naturals only,
    // select still claiming harmonic minor.
    state = await editor(page)
    expect(state?.rows.some((m) => m % 12 === 8)).toBe(true)
    expect(state?.rows.some((m) => m % 12 === 4)).toBe(false)
    await expect(modeSelect).toHaveValue('harmonic-minor')
    expect(pageErrors).toEqual([])
  })

  test('split view score stretches to the bottom of the panel', async ({
    page,
  }) => {
    await page.locator('[data-testid="view-split"]').click()
    const strip = page.getByTestId('sheet-split-strip')
    await expect(strip).toBeVisible({ timeout: 10000 })
    const sb = await strip.boundingBox()
    const vp = page.viewportSize()
    expect(sb).not.toBeNull()
    expect(vp).not.toBeNull()
    if (!sb || !vp) return
    // The strip used to be capped at 240px with dead space below; now it
    // flexes to the panel bottom — its lower edge must sit near the
    // viewport's, whatever the screen height.
    expect(sb.y + sb.height).toBeGreaterThan(vp.height - 60)
    expect(pageErrors).toEqual([])
  })

  test('sheet view shows a dashed ghost preview before placing @smoke', async ({
    page,
  }) => {
    // The sheet shows an empty state without notes — place one first.
    const grid = page.locator('.roll-grid')
    const box = await grid.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    await page.mouse.move(box.x + 24, box.y + 5 * 22 + 11)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(200)

    await page.locator('[data-testid="view-sheet-music"]').click()
    const layer = page.getByTestId('sheet-click-layer')
    await expect(layer).toBeVisible({ timeout: 10000 })
    const lb = await layer.boundingBox()
    expect(lb).not.toBeNull()
    if (!lb) return

    // Hover empty staff → ghost note + name label appear at the snap position
    await page.mouse.move(lb.x + lb.width * 0.55, lb.y + 60, { steps: 4 })
    const ghost = page.getByTestId('sheet-ghost-note')
    await expect(ghost).toBeVisible()

    // Leaving the staff hides the ghost
    await page.mouse.move(lb.x + lb.width / 2, lb.y - 60, { steps: 3 })
    await expect(ghost).toBeHidden()
    expect(pageErrors).toEqual([])
  })

  test('sheet Scrub mode seeks instead of placing notes', async ({ page }) => {
    // Seed a note so the score renders, then open the sheet view.
    const grid = page.locator('.roll-grid')
    const box = await grid.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    await page.mouse.move(box.x + 24, box.y + 5 * 22 + 11)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(200)

    await page.locator('[data-testid="view-sheet-music"]').click()
    const layer = page.getByTestId('sheet-click-layer')
    await expect(layer).toBeVisible({ timeout: 10000 })

    await page.getByTestId('sheet-mode-scrub').click()
    await expect(page.getByTestId('sheet-mode-scrub')).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const before = await editor(page)
    const lb = await layer.boundingBox()
    if (!lb) return

    // Hovering shows no ghost in scrub mode; clicking seeks, never places.
    await page.mouse.move(lb.x + lb.width * 0.6, lb.y + 60, { steps: 3 })
    await expect(page.getByTestId('sheet-ghost-note')).toBeHidden()
    await page.mouse.click(lb.x + lb.width * 0.6, lb.y + 60)
    await page.waitForTimeout(200)

    const after = await editor(page)
    expect(after?.melody.length).toBe(before?.melody.length)

    // Back to Edit (persisted setting — leave the default for other tests)
    await page.getByTestId('sheet-mode-edit').click()
    await expect(page.getByTestId('sheet-mode-edit')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(pageErrors).toEqual([])
  })
})
