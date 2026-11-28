// Studio on a tablet in a short window — at a Galaxy Tab S9+'s size in Chrome, a lane header stands its arm, Mute and Solo beside the name, each with a finger's press, and the open Mix keeps every strip control and the whole master inside the desk, at its own height and dragged to its floor.
//
// Reported on the tablet (1344 by 688 here, measured from the owner's
// screenshot): the lane switches took a row of their own in every lane, so
// two tall lanes left Mix 222 px; there each strip's dB reading lay over its
// Mute and Solo, the master's flavours could wrap to a second row and its
// dials fell past the desk's foot, and a desk dragged to its 196 px floor
// pushed the page 18 px past the window.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { hitArea, neighbourAreas, sharePress } from './helpers/hit-area'

test.use({
  viewport: { width: 1344, height: 688 },
  hasTouch: true,
  isMobile: true,
})

interface Layout {
  /** What sticks out of its own box (header, strip or desk). */
  outside: string[]
  /** Pairs of controls or words whose drawn boxes cross. */
  crossing: string[]
}

/**
 * Inside every element matching `scope`: each control (`controls`, by its
 * box) and each word (`words`, by its text as drawn, clipped where an
 * ancestor hides its overflow) that sticks out of the scope's box, and every
 * pair of them that crosses. A pair where one holds the other is not a
 * crossing, nor are two words of one control. Controls matching `ownWords`
 * keep their words in a sibling element: a dial's end words lie in the open
 * foot of its own ring, inside the ring's square box, by design.
 */
async function layout(
  page: Page,
  scope: string,
  controls: string,
  words: string,
  ownWords?: string,
): Promise<Layout> {
  return page.evaluate(
    ({ scope, controls, words, ownWords }) => {
      const theirs = (control: Element, word: Element) =>
        ownWords !== undefined &&
        control.matches(ownWords) &&
        word.parentElement?.parentElement === control.parentElement
      const textBox = (element: Element): DOMRect | null => {
        const range = document.createRange()
        let left = Infinity
        let top = Infinity
        let right = -Infinity
        let bottom = -Infinity
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue
          range.selectNodeContents(node)
          for (const line of range.getClientRects()) {
            if (line.width < 0.5 || line.height < 0.5) continue
            left = Math.min(left, line.left)
            top = Math.min(top, line.top)
            right = Math.max(right, line.right)
            bottom = Math.max(bottom, line.bottom)
          }
        }
        for (let up: Element | null = element; up; up = up.parentElement) {
          const style = getComputedStyle(up)
          const clip = up.getBoundingClientRect()
          if (style.overflowX !== 'visible') {
            left = Math.max(left, clip.left)
            right = Math.min(right, clip.right)
          }
          if (style.overflowY !== 'visible') {
            top = Math.max(top, clip.top)
            bottom = Math.min(bottom, clip.bottom)
          }
        }
        return right - left > 0.5 && bottom - top > 0.5
          ? new DOMRect(left, top, right - left, bottom - top)
          : null
      }
      const name = (element: Element) =>
        element.getAttribute('aria-label') ??
        element.getAttribute('title') ??
        element.textContent?.trim() ??
        element.tagName
      const outside: string[] = []
      const crossing: string[] = []
      for (const host of document.querySelectorAll(scope)) {
        const room = host.getBoundingClientRect()
        const parts = [
          ...[...host.querySelectorAll(controls)].map((element) => ({
            element,
            box: element.getBoundingClientRect() as DOMRect | null,
          })),
          ...[...host.querySelectorAll(words)].map((element) => ({
            element,
            box: textBox(element),
          })),
        ].filter(
          (part) =>
            part.box !== null &&
            part.box.width > 0 &&
            getComputedStyle(part.element).visibility !== 'hidden',
        )
        for (const { element, box } of parts)
          if (
            box!.left < room.left - 0.5 ||
            box!.top < room.top - 0.5 ||
            box!.right > room.right + 0.5 ||
            box!.bottom > room.bottom + 0.5
          )
            outside.push(name(element))
        for (let i = 0; i < parts.length; i++)
          for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i]
            const b = parts[j]
            if (
              a.element.contains(b.element) ||
              b.element.contains(a.element) ||
              theirs(a.element, b.element) ||
              theirs(b.element, a.element)
            )
              continue
            const width =
              Math.min(a.box!.right, b.box!.right) -
              Math.max(a.box!.left, b.box!.left)
            const height =
              Math.min(a.box!.bottom, b.box!.bottom) -
              Math.max(a.box!.top, b.box!.top)
            if (width > 0.5 && height > 0.5)
              crossing.push(`${name(a.element)} / ${name(b.element)}`)
          }
      }
      return { outside, crossing }
    },
    { scope, controls, words, ownWords },
  )
}

/** How much the page's content scrolls up and down: nothing may push it past the window. */
function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('.main-content')
    return main ? main.scrollHeight - main.clientHeight : -1
  })
}

/** Each lane's dB reading: under its fader's cap and clear of its header's foot. */
function gainReadings(
  page: Page,
): Promise<{ belowCap: number; aboveFoot: number }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-studio-lane-head]')].map((head) => {
      const fader = head.querySelector('input[data-studio-fader]')!
      const output = head.querySelector('output')!
      const range = document.createRange()
      range.selectNodeContents(output)
      const text = range.getBoundingClientRect()
      const box = fader.getBoundingClientRect()
      const cap = Number.parseFloat(
        getComputedStyle(fader).getPropertyValue('--cap'),
      )
      return {
        belowCap: text.top - (box.top + box.height / 2 + cap / 2),
        aboveFoot: head.getBoundingClientRect().bottom - text.bottom,
      }
    }),
  )
}

/** The desk's strips and master: nothing out of its box, no two parts crossing. */
async function expectDeskFits(page: Page, desk: Locator, when: string) {
  expect(await pageOverflow(page), `${when}: the page scrolls`).toBeLessThan(1)
  const box = (await desk.boundingBox())!
  expect(box.y + box.height, `${when}: desk foot`).toBeLessThanOrEqual(
    page.viewportSize()!.height + 0.5,
  )
  const strips = await layout(
    page,
    '[data-studio-mix-strip]',
    'button, input[data-studio-fader], [title^="Pan "], [data-studio-strip-meter]',
    'output',
  )
  expect(strips, `${when}: strips`).toEqual({ outside: [], crossing: [] })
  // The flavours, the dials with their words, and the heading's buttons.
  // The output meter beside them is checked for room only: its peak
  // reading takes a finger's press over its own L and R by design.
  const master = await layout(
    page,
    '[data-studio-mix-master] > :first-child',
    'button, [title*="drag up or down"]',
    '[title*="drag up or down"] ~ span > span, [role="group"] > div > span:first-child, h3',
    '[title*="drag up or down"]',
  )
  expect(master, `${when}: master`).toEqual({ outside: [], crossing: [] })
  const all = await layout(
    page,
    '[data-studio-mix-desk]',
    '[data-studio-mix-master] *',
    '[data-studio-mix-master] span',
  )
  expect(all.outside, `${when}: master in the desk`).toEqual([])
  const chips = desk.getByRole('group', { name: 'Flavour', exact: true })
  const rows = await chips
    .getByRole('button')
    .evaluateAll(
      (buttons) =>
        new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)))
          .size,
    )
  expect(rows, `${when}: flavour rows`).toBe(1)
  // Every control keeps a finger's 44 px, as studio-mix-desk.spec.ts asks.
  const small: string[] = []
  for (const target of await desk
    .locator(
      'button, input[aria-label$=" volume"], [title^="Pan "], [title*="drag up or down"]',
    )
    .all()) {
    if (!(await target.isVisible())) continue
    const at = (await target.boundingBox())!
    if (at.width < 44 || at.height < 44)
      small.push(
        `${await target.evaluate((element) => element.getAttribute('aria-label') ?? element.getAttribute('title'))}: ${at.width}x${at.height}`,
      )
  }
  expect(small, `${when}: small targets`).toEqual([])
}

test('a short tablet window keeps lane switches beside the name with a finger’s press, and fits Mix inside its desk down to the floor @smoke', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => {
    localStorage.setItem('mercurypitch.studio.lane-height', 'tall')
  })
  await openArrangement(page)
  // The last lane's name is too long for its line beside the switches.
  for (const name of ['Harmony', 'Bass', 'Acoustic guitar room mic'])
    await importStudioAudio(page, name, 2)
  const studio = studioRegion(page)

  // Lane headers: one row for the name and its switches, one for the sound.
  const heads = studio.locator('[data-studio-lane-head]')
  await expect(heads).toHaveCount(4)
  for (const head of await heads.all()) {
    const box = (await head.boundingBox())!
    expect(box.height, 'a tall lane stands two rows high').toBeLessThanOrEqual(
      104,
    )
  }
  expect(
    await layout(
      page,
      '[data-studio-lane-head]',
      'button, input[data-studio-fader], [title^="Pan "]',
      '[data-studio-track-name], [data-studio-track-source]',
    ),
  ).toEqual({ outside: [], crossing: [] })
  // A name shows whole lines, one or two: no sliver of a second line.
  const nameLines = await studio
    .locator('[data-studio-track-name]')
    .evaluateAll((names) =>
      names.map(
        (name) =>
          Math.round(
            (name.getBoundingClientRect().height * 100) /
              Number.parseFloat(getComputedStyle(name).lineHeight),
          ) / 100,
      ),
    )
  expect(nameLines).toEqual([1, 1, 1, 2])
  for (const reading of await gainReadings(page)) {
    expect(reading.belowCap, 'the dB reading clears the cap').toBeGreaterThan(0)
    expect(
      reading.aboveFoot,
      'the dB reading clears the header foot',
    ).toBeGreaterThanOrEqual(2)
  }
  // The switches are drawn small, but each takes a 48 px press of its own.
  for (const label of [
    'Arm Harmony for recording',
    'Mute Harmony',
    'Solo Harmony',
  ]) {
    const control = studio.getByRole('button', { name: label, exact: true })
    const own = await hitArea(control)
    expect(own.hit[0], `${label} press width`).toBeGreaterThanOrEqual(48)
    expect(own.hit[1], `${label} press height`).toBeGreaterThanOrEqual(48)
    expect(own.ownsItsBox, `${label} owns its drawing`).toBe(true)
    for (const near of await neighbourAreas(control))
      expect(
        sharePress(own.rect, near.rect),
        `${label} shares a neighbour's press`,
      ).toBe(false)
  }

  // Mix at its own height: two lanes stay in view, and it fits.
  await studio.getByRole('button', { name: 'Mix', exact: true }).tap()
  const desk = studio.getByRole('region', { name: 'Mix', exact: true })
  await expect(desk).toBeVisible()
  await desk.evaluate((element) =>
    Promise.all(
      element.getAnimations().map((each) => each.finished.catch(() => null)),
    ),
  )
  expect((await desk.boundingBox())!.height).toBeGreaterThanOrEqual(290)
  await expectDeskFits(page, desk, 'automatic height')

  // Dragged down to its floor, it still fits: the knobs stand beside the faders.
  await desk.getByRole('separator', { name: 'Mix height' }).focus()
  await page.keyboard.press('Home')
  await expect
    .poll(async () => Math.round((await desk.boundingBox())!.height))
    .toBe(196)
  await expectDeskFits(page, desk, 'floor')
  const fader = desk.getByRole('slider', {
    name: 'Acoustic guitar room mic volume',
    exact: true,
  })
  expect((await fader.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})
