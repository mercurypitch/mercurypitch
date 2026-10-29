// Studio playhead motion — a playing song's line runs on the compositor with the audio clock, the readouts move ten times a second, and a seek or Pause stands it where the song is.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openArrangement, setStudioZoom, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { importWav, noiseWav } from './helpers/studio-output-capture'

const ZOOM = 20

/** The line: its running animations, where it is drawn, and whether its own style places it. */
async function line(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-studio-playhead="line"]',
    )!
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return {
      animations: element.getAnimations().length,
      x: matrix.m41,
      inline: element.style.transform,
    }
  })
}

/** Style and attribute writes on the line, the clock and the ruler over `ms`. */
async function writesOver(page: Page, ms: number) {
  return page.evaluate(async (wait) => {
    const playhead = document.querySelector('[data-studio-playhead="line"]')!
    const clock = document.querySelector<HTMLInputElement>(
      'input[aria-label="Playhead in seconds"]',
    )!
    const ruler = document.querySelector('[aria-label="Song playhead"]')!
    const counts = { line: 0, clock: 0, ruler: 0 }
    const watch = (target: Element, key: keyof typeof counts) =>
      new MutationObserver((records) => {
        counts[key] += records.length
      }).observe(target, { attributes: true })
    watch(playhead, 'line')
    watch(clock, 'clock')
    watch(ruler, 'ruler')
    let values = 0
    let last = clock.value
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const frame = () => {
        if (clock.value !== last) values++
        last = clock.value
        if (performance.now() - started < wait) requestAnimationFrame(frame)
        else resolve()
      }
      requestAnimationFrame(frame)
    })
    return { ...counts, values }
  }, ms)
}

test.describe('Studio playhead motion', () => {
  test('moves a playing song’s line with the clock off the main thread, and stands it where Pause leaves the song', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    // Every animation the page starts, to tell a line that follows the clock
    // from one that keeps starting over.
    await page.addInitScript(() => {
      const animate = Element.prototype.animate
      const counted = window as unknown as { animations: number }
      counted.animations = 0
      Element.prototype.animate = function (
        this: Element,
        ...args: Parameters<Element['animate']>
      ) {
        counted.animations++
        return animate.apply(this, args)
      }
    })
    await openArrangement(page)
    const studio = studioRegion(page)
    await importWav(page, 'Air', noiseWav(30, 0.05, 3))
    await setStudioZoom(page, ZOOM)
    const ruler = studio.getByRole('slider', { name: 'Song playhead' })
    const shown = async () => Number(await ruler.getAttribute('aria-valuenow'))

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await expect.poll(shown, { timeout: 15_000 }).toBeGreaterThan(1)
    await expect.poll(async () => (await line(page)).animations).toBe(1)

    // Drawn where the song is, and moving at the song's rate.
    const first = await line(page)
    expect(first.inline).toBe('')
    const at = await shown()
    expect(Math.abs(first.x - at * ZOOM)).toBeLessThan(0.3 * ZOOM)
    await expect.poll(shown).toBeGreaterThan(at + 0.5)
    const second = await line(page)
    const moved = (second.x - first.x) / ZOOM
    // The readout trails the song by up to a tenth of a second each time.
    expect(Math.abs(moved - ((await shown()) - at))).toBeLessThan(0.3)

    // Over a second nothing restyles the line, and the readouts move about ten times.
    const started = () =>
      page.evaluate(
        () => (window as unknown as { animations: number }).animations,
      )
    const before = await started()
    const writes = await writesOver(page, 1000)
    // The line and its cap, started again at most twice: headless audio
    // runs about 0.5 % fast, so its clock and the animation part slowly.
    expect((await started()) - before).toBeLessThanOrEqual(4)
    expect(writes.line).toBe(0)
    expect(writes.values).toBeGreaterThanOrEqual(6)
    expect(writes.values).toBeLessThanOrEqual(12)
    expect(writes.ruler).toBeLessThanOrEqual(2 * 12)

    // A seek on the ruler moves it there.
    const box = (await ruler.boundingBox())!
    await page.mouse.move(box.x + 20 * ZOOM, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await expect
      .poll(async () => (await line(page)).x, { timeout: 2000 })
      .toBeGreaterThan(19.9 * ZOOM)
    expect((await line(page)).x).toBeLessThan(21 * ZOOM)

    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
    await expect.poll(async () => (await line(page)).animations).toBe(0)
    const paused = await line(page)
    expect(paused.inline).toContain('translateX')
    expect(Math.abs(paused.x - (await shown()) * ZOOM)).toBeLessThan(1)
  })
})
