// Character selection uses native pointer and keyboard activation for every preview.
import { expect, test } from '@playwright/test'

test('replays each character tap and keeps radio keyboard activation working @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.addInitScript(() => {
    const previews: {
      bufferId: number
      source: AudioBufferSourceNode
      startedAt: number
      ended: boolean
    }[] = []
    const buffers = new Map<AudioBuffer, number>()
    Object.assign(window, { characterPreviews: previews })
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      // Character previews are one-shots; the onboarding ambience loops.
      // Observe real decoded playback without replacing its audio graph.
      if (!this.loop && this.buffer !== null) {
        if (!buffers.has(this.buffer)) buffers.set(this.buffer, buffers.size)
        const preview = {
          bufferId: buffers.get(this.buffer)!,
          source: this,
          startedAt: this.context.currentTime,
          ended: false,
        }
        this.addEventListener('ended', () => {
          preview.ended = true
        })
        previews.push(preview)
      }
      return start.apply(this, args)
    }
  })

  await page.goto('/?devSeed')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: /Change this plan/ }).click()
  const scroll = page.getByRole('radio', {
    name: 'Endless scrolling',
    exact: true,
  })
  const snack = page.getByRole('radio', {
    name: 'Automatic snacking',
    exact: true,
  })
  const previewSources = () =>
    page.evaluate(() =>
      (
        window as unknown as { characterPreviews: { bufferId: number }[] }
      ).characterPreviews.map((preview) => preview.bufferId),
    )

  // A card tap activates the native radio, including when it is already checked.
  for (const [radio, count] of [
    [scroll, 1],
    [scroll, 2],
    [snack, 3],
  ] as const) {
    await radio.locator('..').click()
    await expect(radio).toBeChecked()
    await expect.poll(previewSources).toHaveLength(count)
  }

  await snack.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(scroll).toBeChecked()
  await expect(scroll).toBeFocused()
  await expect.poll(previewSources).toHaveLength(4)
  await page.keyboard.down('Space')
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  await expect.poll(previewSources).toHaveLength(5)

  const sources = await previewSources()
  expect(sources[0]).toBe(sources[1])
  expect(sources[2]).not.toBe(sources[0])
  expect(sources[3]).toBe(sources[0])
  expect(sources[4]).toBe(sources[0])
  await expect
    .poll(() =>
      page.evaluate(() => {
        const latest = (
          window as unknown as {
            characterPreviews: {
              source: AudioBufferSourceNode
              startedAt: number
              ended: boolean
            }[]
          }
        ).characterPreviews.at(-1)
        return (
          latest !== undefined &&
          !latest.ended &&
          latest.source.context.state === 'running' &&
          latest.source.context.currentTime > latest.startedAt
        )
      }),
    )
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            characterPreviews: { ended: boolean }[]
          }
        ).characterPreviews
          .slice(0, -1)
          .every((preview) => preview.ended),
      ),
    )
    .toBe(true)

  await page.getByRole('button', { name: 'Go back', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            characterPreviews: { ended: boolean }[]
          }
        ).characterPreviews.every((preview) => preview.ended),
      ),
    )
    .toBe(true)
})
