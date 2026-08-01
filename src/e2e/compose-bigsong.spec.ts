import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test('a 267-bar import renders, scrolls and stays clickable @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)
  await switchTab(page, 'compose')
  await page.waitForTimeout(500)

  // Inject a 267-bar / 498-note song exactly like the reported MIDI import.
  await page.evaluate(() => {
    const items = Array.from({ length: 498 }, (_, i) => {
      const midi = 48 + (i % 25)
      return {
        id: i + 1,
        note: {
          midi,
          name: [
            'C',
            'C#',
            'D',
            'D#',
            'E',
            'F',
            'F#',
            'G',
            'G#',
            'A',
            'A#',
            'B',
          ][midi % 12],
          octave: Math.floor(midi / 12) - 1,
          freq: 440 * Math.pow(2, (midi - 69) / 12),
        },
        startBeat: i * 2,
        duration: 1,
      }
    })
    const pp = (window as any).__pp
    pp?.melodyStore?.setMelody?.(items)
  })
  await page.waitForTimeout(1200)

  const grid = page.locator('.roll-grid')
  await expect(grid).toBeVisible()

  // The canvas must be viewport-sized (the old full-song canvas silently
  // failed to allocate past 65,535 device px and rendered nothing).
  const info = await page.evaluate(() => {
    const c = document.querySelector('.roll-grid') as HTMLCanvasElement
    const layer = document.querySelector('.roll-grid-layer') as HTMLElement
    const sc = document.querySelector('.roll-grid-container') as HTMLElement
    return {
      canvasW: c.width,
      layerW: layer.getBoundingClientRect().width,
      scrollW: sc.scrollWidth,
      clientW: sc.clientWidth,
    }
  })
  expect(info.canvasW).toBeLessThanOrEqual(16384)
  expect(info.layerW).toBeGreaterThan(40000)
  expect(info.scrollW).toBeGreaterThan(info.clientW + 1000)

  // Actually paints something (not a blank canvas).
  const painted = await page.evaluate(() => {
    const c = document.querySelector('.roll-grid') as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(
      0,
      0,
      Math.min(c.width, 600),
      Math.min(c.height, 300),
    ).data
    const first = [d[0], d[1], d[2]]
    for (let i = 4; i < d.length; i += 4) {
      if (d[i] !== first[0] || d[i + 1] !== first[1] || d[i + 2] !== first[2])
        return true
    }
    return false
  })
  expect(painted).toBe(true)

  // Scrolling works and the view follows.
  await page.evaluate(() => {
    const sc = document.querySelector('.roll-grid-container') as HTMLElement
    sc.scrollLeft = 20000
    sc.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => {
    const sc = document.querySelector('.roll-grid-container') as HTMLElement
    const c = document.querySelector('.roll-grid') as HTMLCanvasElement
    return { scrollLeft: sc.scrollLeft, canvasLeft: c.style.left }
  })
  expect(after.scrollLeft).toBeGreaterThan(10000)
  expect(parseFloat(after.canvasLeft)).toBeGreaterThan(10000)

  expect(errors).toEqual([])
})
