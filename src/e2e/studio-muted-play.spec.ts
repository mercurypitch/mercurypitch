// Studio Play with nothing heard — with every lane muted, or Solo on a lane with no clips, Play runs the song silently as REAPER does: the playhead moves, Space pauses and plays it, the run stops at the song's end, no notice says anything, and a lane unmuted meanwhile is heard at once without a restart. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { tapOutput, traceLevel } from './helpers/studio-output'

test.use({ viewport: { width: 1440, height: 900 } })

/** The playhead, in seconds, as the transport's clock states it. */
async function playheadSeconds(page: Page): Promise<number> {
  return Number(
    await studioRegion(page)
      .getByRole('spinbutton', { name: 'Playhead in seconds', exact: true })
      .getAttribute('aria-valuenow'),
  )
}

function notices(page: Page) {
  return page.getByRole('region', { name: 'Notifications' }).getByRole('alert')
}

test.describe('Studio Play with nothing heard', () => {
  test('with every lane muted, Play runs silently: the playhead moves, Space pauses and plays, the song stops at its end, and no notice shows @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()

    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
    await expect.poll(() => playheadSeconds(page)).toBeGreaterThan(0.5)
    await expect(notices(page)).toHaveCount(0)
    await expect(studio.getByRole('alert')).toHaveCount(0)

    // Space pauses where it is, and plays on from there.
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Space')
    await expect(
      studio.getByRole('button', { name: 'Play song', exact: true }),
    ).toBeVisible()
    const paused = await playheadSeconds(page)
    expect(paused).toBeGreaterThan(0.5)
    await page.keyboard.press('Space')
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
    await expect.poll(() => playheadSeconds(page)).toBeGreaterThan(paused)

    // The muted take still sets where the song ends: four seconds.
    await expect(
      studio.getByRole('button', { name: 'Play song', exact: true }),
    ).toBeVisible({ timeout: 10_000 })
    expect(await playheadSeconds(page)).toBeCloseTo(4, 1)
    await expect(notices(page)).toHaveCount(0)
  })

  test('with Solo on a lane that has no clips, Play runs silently and shows no notice @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Solo Lane 2', exact: true })
      .click()

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()

    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
    await expect.poll(() => playheadSeconds(page)).toBeGreaterThan(0.5)
    await expect(notices(page)).toHaveCount(0)
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
  })

  test('a lane unmuted during a silent run is heard at once, without a restart', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await tapOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    const lane = studio.locator('[data-studio-track]')
    await lane.getByRole('button', { name: 'Mute Phrase', exact: true }).click()
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
    await expect.poll(() => playheadSeconds(page)).toBeGreaterThan(0.2)

    const trace = await traceLevel(page, () =>
      lane.getByRole('button', { name: 'Unmute Phrase', exact: true }).click(),
    )

    expect(trace.before).toBeLessThan(-60)
    expect(trace.after).toBeGreaterThan(-40)
    // No new buffer sources: the run brought the lane in, it did not restart.
    expect(trace.sources).toBe(0)
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
  })
})
