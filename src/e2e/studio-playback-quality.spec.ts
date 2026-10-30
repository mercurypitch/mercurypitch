// Studio playback quality — a tier chosen while stopped plays from the next Play and stays on this device.
import { expect, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, clearClicks, importWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { captureSpan, readStart } from './helpers/studio-output-span'
import { steadyWav } from './helpers/studio-output'

const CHOICE_KEY = 'mercurypitch.studio.playbackQuality'

test.describe('Studio playback quality', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a tier chosen while stopped plays from the next Play, and stays on this device', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importWav(page, 'Pad', steadyWav(30, [330], 0.3))
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Sound', exact: true }).click()
    const quality = studio.getByRole('group', { name: 'Playback quality' })
    const choice = (label: string) =>
      quality.getByRole('radio', { name: new RegExp(`^${label}`) })
    await expect(choice('Auto')).toBeChecked()
    await expect(quality).toContainText('Export always uses Best.')

    const toggle = studio.getByRole('button', {
      name: /^(Play|Pause) song$/,
    })
    const pressToggle = async () => {
      const box = (await toggle.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }
    // The first Play makes the audio context the capture listens to.
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await pressToggle()
    await expect(toggle).toHaveAccessibleName('Play song')

    for (const tier of ['Light', 'Best', 'Balanced']) {
      await choice(tier).check()
      await expect(choice(tier)).toBeChecked()
      expect(
        await page.evaluate((key) => localStorage.getItem(key), CHOICE_KEY),
      ).toBe(tier.toLowerCase())
      await untilAudioClock(page, (await audioClock(page)) + 0.5)
      await clearClicks(page)
      await pressToggle()
      const down = (await readClicks(page)).find(({ kind }) => kind === 'down')!
      const start = readStart(
        await captureSpan(page, down.contextTime - 0.1, down.contextTime + 1),
        down,
        330,
        900,
      )
      console.log(
        `[studio-playback-quality] ${JSON.stringify({ tier, ...start })}`,
      )
      // Silence, then the tone: the new tier's graph starts clean.
      expect(start.beforeDb).toBeLessThan(start.settledDb - 40)
      expect(start.firstSoundMs).not.toBeNull()
      await expect(toggle).toHaveAccessibleName('Pause song')
      await untilAudioClock(page, (await audioClock(page)) + 0.5)
      await pressToggle()
      await expect(toggle).toHaveAccessibleName('Play song')
    }

    // Back to Auto, which the device keeps by storing nothing.
    await choice('Auto').check()
    expect(
      await page.evaluate((key) => localStorage.getItem(key), CHOICE_KEY),
    ).toBeNull()
    await expect(choice('Auto')).toBeChecked()
  })
})
