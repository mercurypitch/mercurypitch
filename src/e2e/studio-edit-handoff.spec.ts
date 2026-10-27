// Studio edits while playing — an edit the running graph cannot follow (clip gain, a split, fast nudges, a lane's sound role) hands the song to a new run with no dropout.
import { expect, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { importSteady, outputLevel, tapOutput, traceLevel, } from './helpers/studio-output'

// The new run takes over within this long of the edit, warmup and build
// included, and the level after it is read from then on.
const HANDOVER = { settleMs: 1200, endMs: 1800 }

test.describe('Studio edits while playing', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('clip gain, a split, a burst of nudges and a new sound role each hand the song to a new run with no dropout @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // One tone a lane: two close tones beat, and the beat reads as a dip.
    await importSteady(page, 'Pad', [330])
    await importSteady(page, 'Low', [165], 0.1)
    // The fixture's phrase swells; only the steady lanes play.
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await expect
      .poll(() => outputLevel(page), { timeout: 15_000 })
      .toBeGreaterThan(-40)

    const handsOver = async (edit: string, action: () => Promise<unknown>) => {
      const level = await traceLevel(page, action, HANDOVER)
      // A new run starts its own sources: the edit was not played in place.
      expect(level.sources, edit).toBeGreaterThan(0)
      // A restart fell 37 dB for 170 ms here, and 64 dB for a sound role.
      expect(level.dip, edit).toBeLessThan(3)
    }

    const pad = studioClip(page, 'Pad')
    const toolbar = studio.getByRole('toolbar', { name: 'Selected clip' })
    await pad.click()
    await toolbar.getByRole('button', { name: 'Details', exact: true }).click()
    const gain = studio.getByRole('spinbutton', { name: /^Clip gain/ })
    await gain.fill('-3')
    await handsOver('clip gain', () => gain.press('Tab'))
    await studio.getByRole('button', { name: 'Close Clip details' }).click()

    await pad.click()
    await handsOver('split', () =>
      toolbar.getByRole('button', { name: 'Split', exact: true }).click(),
    )
    await expect(pad).toHaveCount(2)

    // Each press is a commit, faster than a run is built: the newest wins.
    // Fine nudges on the clip under the playhead keep it under the playhead.
    const later = pad.last()
    await later.click()
    await handsOver('nudges', async () => {
      for (let press = 0; press < 5; press++)
        await later.press('Alt+ArrowRight')
    })

    await studio
      .getByRole('button', { name: 'Pad details', exact: true })
      .click()
    const role = studio.getByRole('combobox', { name: 'Sound role' })
    const next = (await role.inputValue()) === 'voice' ? 'keys' : 'voice'
    await handsOver('sound role', () => role.selectOption(next))
    await expect(role).toHaveValue(next)
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
  })
})
