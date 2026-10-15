// ============================================================
// Find my key from the rail's key panel
// ============================================================
//
// With no range to fit to, Find my key asks which voice is the singer's.
// That question is a dialog over the stage, so it has to be solid (the
// stage's glass made it hard to read over a photo) and it has to sit above
// the key panel that opened it. Once a voice is picked, asking again does
// not end on "already fits": the dialog comes back, says so, and offers
// the other voices and the song's own key.

import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openSeededSong } from './helpers/mixer-song'

/** The background's alpha, 1 for an opaque colour. */
function backgroundAlpha(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const color = getComputedStyle(node).backgroundColor
    const slash = /\/\s*([\d.]+%?)\s*\)$/.exec(color)
    if (slash !== null) {
      const value = slash[1]!
      return value.endsWith('%')
        ? Number.parseFloat(value) / 100
        : Number(value)
    }
    const rgba = /^rgba\(.*,\s*([\d.]+)\)$/.exec(color)
    return rgba === null ? 1 : Number(rgba[1])
  })
}

/** Labels of the dialog's buttons that something else covers. */
function coveredButtons(dialog: Locator): Promise<string[]> {
  return dialog.evaluate((node) =>
    Array.from(node.querySelectorAll('button, a'))
      .filter((button) => {
        const r = button.getBoundingClientRect()
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        )
        return hit === null || !node.contains(hit)
      })
      .map((button) => (button.textContent ?? '').trim()),
  )
}

for (const size of [
  { width: 1280, height: 800 },
  { width: 800, height: 1280 },
]) {
  test.describe(`Find my key at ${size.width}x${size.height}`, () => {
    test('asks for a voice on a solid dialog above the key panel', async ({
      page,
    }) => {
      await openSeededSong(page, size)
      await page.getByTestId('key-chip').click()
      await page
        .getByTestId('key-chip-popover')
        .getByRole('button', { name: 'Find my key' })
        .click()

      const picker = page.getByRole('dialog', { name: 'Which is your voice?' })
      await expect(picker).toBeVisible()
      expect(await backgroundAlpha(picker)).toBe(1)
      expect(await coveredButtons(picker)).toEqual([])
      // The panel that opened it waits under the dialog's shade.
      const panelOnTop = await page
        .getByTestId('key-chip-popover')
        .evaluate((panel) => {
          const r = panel.getBoundingClientRect()
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          )
          return hit !== null && panel.contains(hit)
        })
      expect(panelOnTop).toBe(false)
    })
  })
}
