// Studio clock — on the web the first Play makes one 48 kHz clock with playback buffers, every later Play keeps it, and leaving the Studio closes it.
import { expect, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { switchTab } from './helpers/ui'

declare global {
  interface Window {
    __madeClocks?: {
      options: AudioContextOptions | null
      context: AudioContext
    }[]
  }
}

test.describe('Studio clock', () => {
  test('plays on a 48 kHz clock of its own, kept across plays and closed when the Studio closes', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const made: NonNullable<Window['__madeClocks']> = []
      window.__madeClocks = made
      const Native = window.AudioContext
      window.AudioContext = class extends Native {
        constructor(options?: AudioContextOptions) {
          super(options)
          made.push({ options: options ?? null, context: this })
        }
      }
    })
    await openArrangement(page)
    const studio = studioRegion(page)
    const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
    await expect(toggle).toBeEnabled({ timeout: 60_000 })
    const clocks = () =>
      page.evaluate(() =>
        window.__madeClocks!.map(({ options, context }) => ({
          options,
          sampleRate: context.sampleRate,
          state: context.state,
        })),
      )
    const before = (await clocks()).length

    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    // One clock, made by the press, and nothing else started for it.
    expect((await clocks()).slice(before)).toEqual([
      {
        options: { sampleRate: 48000, latencyHint: 'playback' },
        sampleRate: 48000,
        state: 'running',
      },
    ])

    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Play song')
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    expect((await clocks()).length).toBe(before + 1)

    await switchTab(page, 'singing')
    await expect.poll(async () => (await clocks())[before].state).toBe('closed')
  })
})
