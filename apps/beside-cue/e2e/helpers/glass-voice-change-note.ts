// Change-note regression — engaged recalibration retains the exhibit and microphone through fresh PCM.
import { expect, test, type Page } from '@playwright/test'

interface ChangeNoteFixtures {
  openMuseum(page: Page): Promise<void>
  setVoice(page: Page, midi: number, amplitude: number): Promise<void>
  expectMicrophoneOff(page: Page): Promise<void>
}

export function registerChangeNoteTest(fixtures: ChangeNoteFixtures): void {
  test('Change note recalibrates inside the same singing stage and keeps its microphone @smoke', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('beside-cue:glass-adventure:comfortable-note', '61')
    })
    await fixtures.openMuseum(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await fixtures.setVoice(page, 61, 0)
    const adventure = page.getByTestId('glass-adventure')
    const panel = page.getByRole('region', { name: 'Voice challenge' })
    await page.getByRole('button', { name: 'Sing to the glass' }).click()
    await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
      timeout: 12_000,
    })
    await expect(
      panel.getByRole('img', { name: 'Target note: C♯4' }),
    ).toBeVisible()
    await expect(adventure).toHaveAttribute(
      'data-challenge-camera-encounter',
      'glassworks.first-goblet',
    )
    const mountedPanel = await panel.elementHandle()
    const microphone = await page.evaluate(() => ({
      id: window.glassVoiceFixture.sources[0].track.id,
      count: window.glassVoiceFixture.sources.length,
      references: window.glassVoiceFixture.referenceStarts,
    }))

    await panel
      .getByRole('button', { name: 'Change note', exact: true })
      .click()
    await expect(panel).toHaveAttribute('data-voice-mode', 'finding')
    await expect(
      panel.getByRole('heading', { name: 'Hum an easy note.' }),
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Hear example' }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Sing to the glass' }),
    ).toBeHidden()
    await expect(adventure).toHaveAttribute(
      'data-challenge-camera-encounter',
      'glassworks.first-goblet',
    )
    expect(await mountedPanel!.evaluate((element) => element.isConnected)).toBe(
      true,
    )

    await fixtures.setVoice(page, 62, 0.1)
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
          ),
        { timeout: 12_000 },
      )
      .toBe('62')
    await fixtures.setVoice(page, 62, 0)
    await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
    await expect(
      panel.getByRole('img', { name: 'Target note: D4' }),
    ).toBeVisible()
    await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
      timeout: 12_000,
    })
    expect(await mountedPanel!.evaluate((element) => element.isConnected)).toBe(
      true,
    )
    expect(
      await page.evaluate(() => ({
        id: window.glassVoiceFixture.sources[0].track.id,
        count: window.glassVoiceFixture.sources.length,
        live: window.glassVoiceFixture.sources[0].track.readyState,
        references: window.glassVoiceFixture.referenceStarts,
      })),
    ).toEqual({
      ...microphone,
      live: 'live',
      references: microphone.references + 1,
    })

    await fixtures.setVoice(page, 62, 0.1)
    await expect(
      panel.getByRole('progressbar', { name: 'Glass resonance' }),
    ).toHaveAttribute('aria-valuenow', /^[1-9]\d?$/)
    await fixtures.setVoice(page, 62, 0)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(panel).toBeHidden()
    await fixtures.expectMicrophoneOff(page)
    await expect(
      page.getByRole('button', { name: 'Sing to the glass' }),
    ).toBeVisible()
    await expect(adventure).toHaveAttribute('data-completed', '0')
    expect(errors).toEqual([])
  })
}
