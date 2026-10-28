// Studio seek while playing — a press on the ruler moves the playing song there at once, with no dip, no gap and no sources left behind.
import { expect, test } from '@playwright/test'
import { openArrangement, setStudioZoom, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, importWav, liveSources, noiseWav, readClicks, readSeek, twoPartWav, untilAudioClock, } from './helpers/studio-output-capture'

// At 20 pixels a second the ruler shows the whole 40 second song.
const ZOOM = 20

test.describe('Studio seek while playing', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a press on the ruler moves a playing song there at once with no dip or gap, and fifty more leave no sources behind @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // The pad's pitch tells the song's halves apart; the noise makes any two
    // places in it unrelated, as two places in a song are.
    await importWav(page, 'Pad', twoPartWav(40, 20, [330, 990], 0.3))
    await importWav(page, 'Air', noiseWav(40, 0.05, 7))
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await setStudioZoom(page, ZOOM)
    const ruler = studio.getByRole('slider', { name: 'Song playhead' })
    const box = (await ruler.boundingBox())!
    const press = async (seconds: number) => {
      await page.mouse.move(box.x + seconds * ZOOM, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }
    const playhead = async () =>
      Number(await ruler.getAttribute('aria-valuenow'))

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    // A full capture of steady playback before the press.
    await expect.poll(playhead, { timeout: 15_000 }).toBeGreaterThan(1.5)

    await clearClicks(page)
    await press(25)
    const down = (await readClicks(page)).find(({ kind }) => kind === 'down')!
    await untilAudioClock(page, down.contextTime + 0.47)
    const seek = readSeek(await captureOutput(page), down, 990, 300)
    // A seek that stopped and rebuilt the song fell 37 dB here, stayed
    // 20 dB down for over 100 ms, and the new place came 206 ms or more
    // after the press.
    expect(seek.dipDb['30']).toBeLessThan(2)
    expect(seek.silentMs).toBe(0)
    expect(seek.clickToSoundMs).not.toBeNull()
    expect(seek.clickToSoundMs!).toBeLessThan(100)
    expect(await playhead()).toBeGreaterThanOrEqual(25)

    const before = await liveSources(page)
    for (let index = 0; index < 50; index++) await press(4 + ((index * 7) % 30))
    // A retired source plays out its 10 ms fade, then ends.
    await untilAudioClock(page, (await audioClock(page)) + 1)
    const after = await liveSources(page)
    expect(after.created).toBeGreaterThan(before.created)
    expect(after.live).toBeLessThanOrEqual(before.live)
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
  })
})
