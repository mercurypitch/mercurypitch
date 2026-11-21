// Studio mix desk dials — the value in a dial's face stays centred on it whatever its sign, and its minus sign never touches the pointer mark on the cap.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

/** Every value a dial can show, -100 to 100. */
const VALUES = Array.from({ length: 201 }, (_, at) => at - 100)

interface DialReading {
  value: number
  /** The face's width, in CSS px. */
  face: number
  text: string
  /** The digits' centre against the face's, in CSS px. */
  digitsDx: number
  digitsDy: number
  /** Clearance from the pointer mark's stroke to the minus sign's box, and to the whole value's; negative when they meet. */
  minusGap: number | null
  textGap: number
}

async function openDesk(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Mix', exact: true })
    .click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  await desk.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
  return desk
}

/**
 * Every dial on the desk at each of `values`, read from its drawing and its
 * value's glyphs: each character's box from a Range, the pointer from its
 * line, stroke and the dial's angle.
 */
async function readDials(
  desk: Locator,
  values: readonly number[],
): Promise<DialReading[]> {
  return desk.evaluate((element, values) => {
    const faces = [
      ...element.querySelectorAll<HTMLElement>('[title*="drag up or down"]'),
    ]
    const round = (n: number) => Math.round(n * 100) / 100
    type Box = { left: number; right: number; top: number; bottom: number }
    const union = (boxes: readonly Box[]): Box => ({
      left: Math.min(...boxes.map((each) => each.left)),
      right: Math.max(...boxes.map((each) => each.right)),
      top: Math.min(...boxes.map((each) => each.top)),
      bottom: Math.max(...boxes.map((each) => each.bottom)),
    })
    return values.flatMap((value) =>
      faces.map((face) => {
        const input = face.querySelector<HTMLInputElement>(
          'input[type="range"]',
        )!
        input.value = String(value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        const box = face.getBoundingClientRect()
        const cx = box.left + box.width / 2
        const cy = box.top + box.height / 2
        const unit = box.width / 48
        // Each printed character and its box.
        const label = face.lastElementChild as HTMLElement
        const glyphs: { char: string; box: DOMRect }[] = []
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? ''
          for (let at = 0; at < text.length; at++) {
            const range = document.createRange()
            range.setStart(node, at)
            range.setEnd(node, at + 1)
            glyphs.push({ char: text[at], box: range.getBoundingClientRect() })
          }
        }
        const text = glyphs.map((glyph) => glyph.char).join('')
        const digits = union(
          glyphs.filter((glyph) => /\d/.test(glyph.char)).map((g) => g.box),
        )
        const minus = glyphs.find((glyph) => /[−-]/.test(glyph.char))
        // The pointer: its line turned clockwise by the dial's angle, as a
        // round-capped stroke of its own width.
        const line = [...face.querySelectorAll('svg line')].at(-1)!
        const reach = (name: string) => 24 - Number(line.getAttribute(name))
        const half = Number.parseFloat(getComputedStyle(line).strokeWidth) / 2
        const angle = ((value / 100) * 135 * Math.PI) / 180
        const at = (out: number) => ({
          x: cx + Math.sin(angle) * out * unit,
          y: cy - Math.cos(angle) * out * unit,
        })
        const ends = [at(reach('y1')), at(reach('y2'))]
        const gap = (rect: Box) => {
          let nearest = Infinity
          for (let step = 0; step <= 64; step++) {
            const x = ends[0].x + ((ends[1].x - ends[0].x) * step) / 64
            const y = ends[0].y + ((ends[1].y - ends[0].y) * step) / 64
            const dx = Math.max(rect.left - x, 0, x - rect.right)
            const dy = Math.max(rect.top - y, 0, y - rect.bottom)
            nearest = Math.min(nearest, Math.hypot(dx, dy))
          }
          return round(nearest - half * unit)
        }
        return {
          value,
          face: round(box.width),
          text,
          digitsDx: round((digits.left + digits.right) / 2 - cx),
          digitsDy: round((digits.top + digits.bottom) / 2 - cy),
          minusGap: minus === undefined ? null : gap(minus.box),
          textGap: gap(union(glyphs.map((glyph) => glyph.box))),
        }
      }),
    )
  }, values)
}

/** The worst of `readings`: the furthest the digits sit off centre, and the least room the pointer leaves. */
function worst(readings: readonly DialReading[]) {
  const minus = readings.filter((reading) => reading.minusGap !== null)
  const least = (list: readonly DialReading[], key: 'minusGap' | 'textGap') =>
    list.reduce((low, each) =>
      (each[key] ?? 0) < (low[key] ?? 0) ? each : low,
    )
  return {
    faces: [...new Set(readings.map((reading) => reading.face))],
    digitsDx: Math.max(
      ...readings.map((reading) => Math.abs(reading.digitsDx)),
    ),
    digitsDy: Math.max(
      ...readings.map((reading) => Math.abs(reading.digitsDy)),
    ),
    minusGap: least(minus, 'minusGap'),
    textGap: least(readings, 'textGap'),
    meeting: readings.filter((reading) => reading.textGap <= 0).length,
  }
}

function expectClear(readings: readonly DialReading[]): void {
  for (const reading of readings) {
    const said = JSON.stringify(reading)
    // Centred within half a pixel across, so a sign never pulls the digits aside.
    expect(Math.abs(reading.digitsDx), said).toBeLessThanOrEqual(0.5)
    expect(Math.abs(reading.digitsDy), said).toBeLessThanOrEqual(1)
    // The pointer's stroke clears every character, the minus sign included.
    expect(reading.textGap, said).toBeGreaterThan(0)
    if (reading.minusGap !== null)
      expect(reading.minusGap, said).toBeGreaterThan(0)
  }
}

for (const size of [
  { name: 'computer', width: 1440, height: 900 },
  { name: 'short computer', width: 1280, height: 720 },
  { name: 'narrow computer', width: 1024, height: 768 },
]) {
  test(`Mix desk dial values sit centred and clear of the pointer on a ${size.name}`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: size.width, height: size.height })
    await openArrangement(page)
    const readings = await readDials(await openDesk(page), VALUES)
    console.log(`${size.name}: ${JSON.stringify(worst(readings))}`)
    expectClear(readings)
  })
}

test.describe('on a tablet', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('Mix desk dial values sit centred and clear of the pointer on a finger-sized face', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 820, height: 1180 })
    await openArrangement(page)
    const readings = await readDials(await openDesk(page), VALUES)
    console.log(`tablet: ${JSON.stringify(worst(readings))}`)
    expectClear(readings)
  })
})
