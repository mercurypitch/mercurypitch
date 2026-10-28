// Studio mixing desk details — every pixel of a dial face turns it, its focus ring clears the end words, faders read in dB, strips line up on their axis, light strip edges hold 1.3:1, the title row is slim, a tap leaves no hover behind, and the meter prints no mark over another while its peak reading takes a finger without taking travel.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

async function openDesk(page: Page, tap = false): Promise<Locator> {
  const mix = studioRegion(page).getByRole('button', {
    name: 'Mix',
    exact: true,
  })
  if (tap) await mix.tap()
  else await mix.click()
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
 * The desk meter's marks top to bottom, and the height between its rails and
 * the loudness under them: `spent`, against the peak reading's words and the
 * column's two gaps, `allowed`.
 */
async function deskMeter(desk: Locator) {
  return desk.evaluate((element) => {
    const meter = element.querySelector('[role="meter"]')!
    const scale = meter.querySelector('[aria-hidden="true"]')!.lastElementChild!
    const marks = [...scale.children]
      .filter((mark) => mark.getClientRects().length > 0)
      .map((mark) => {
        const box = mark.getBoundingClientRect()
        return { text: mark.textContent, top: box.top, bottom: box.bottom }
      })
      .sort((above, below) => above.top - below.top)
    const reading = element.querySelector('button[title="Reset peak hold"]')!
    const words = [...reading.children].map((part) =>
      part.getBoundingClientRect(),
    )
    const loudness = element.querySelector('[title^="Short-term loudness"]')!
    const gap = Number.parseFloat(getComputedStyle(meter.parentElement!).rowGap)
    return {
      marks: marks.map((mark) => mark.text),
      gaps: marks.slice(1).map((mark, index) => mark.top - marks[index].bottom),
      spent:
        loudness.getBoundingClientRect().top -
        meter.getBoundingClientRect().bottom,
      allowed:
        Math.max(...words.map((part) => part.bottom)) -
        Math.min(...words.map((part) => part.top)) +
        2 * gap,
    }
  })
}

test('Mix desk dials turn from every pixel of their face and draw focus clear of their end words @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const desk = await openDesk(page)
  const faces = desk.locator('[title*="drag up or down"]')
  expect(await faces.count()).toBe(5)

  // What a press 3 px above the bottom of each face lands on.
  const missed = await faces.evaluateAll((elements) =>
    elements
      .filter((face) => {
        const box = face.getBoundingClientRect()
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.bottom - 3,
        )
        return !face.contains(hit)
      })
      .map((face) => face.getAttribute('title')),
  )
  expect(missed).toEqual([])

  // The end words look the same with the dial focused as without.
  const space = desk.getByRole('slider', { name: 'Space', exact: true })
  const words = faces.first().locator('xpath=following-sibling::*[1]/span')
  const resting = [
    await words.nth(0).screenshot(),
    await words.nth(1).screenshot(),
  ]
  const face = await faces.first().screenshot()
  await page.mouse.move(0, 0)
  await page.keyboard.press('Shift')
  await space.focus()
  await expect(space).toBeFocused()
  expect(await faces.first().screenshot()).not.toEqual(face)
  expect(await words.nth(0).screenshot()).toEqual(resting[0])
  expect(await words.nth(1).screenshot()).toEqual(resting[1])
})

test('Mix desk faders read in dB at 0 and every 12 dB, on the ladder marks, with name, knob and fader on one axis', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const desk = await openDesk(page)
  const strip = desk.locator('[data-studio-mix-strip]').first()
  const layout = await strip.evaluate((element) => {
    const fader = element.querySelector<HTMLInputElement>(
      'input[aria-label$=" volume"]',
    )!
    const box = fader.getBoundingClientRect()
    const cap = Number.parseFloat(
      getComputedStyle(fader).getPropertyValue('--cap'),
    )
    const scale = fader.parentElement!.querySelector('[aria-hidden="true"]')
    const marks = [...(scale?.children ?? [])]
      .filter((mark) => mark.getClientRects().length > 0)
      .map((mark) => {
        const at = mark.getBoundingClientRect()
        const db = Number(mark.textContent!.replace('−', '-'))
        const travel = box.height - cap
        const expected = box.bottom - cap / 2 - (travel * (db + 60)) / 72
        return {
          text: mark.textContent,
          off:
            Math.round(Math.abs(at.top + at.height / 2 - expected) * 10) / 10,
          size: Number.parseFloat(getComputedStyle(mark).fontSize),
          leftOfFader: at.right <= box.left,
        }
      })
    const axis = box.left + box.width / 2
    const dial = element.querySelector('[title^="Pan "] svg')!
    const knob = dial.getBoundingClientRect()
    const name = element.querySelector('button')!
    const text = document.createRange()
    text.selectNodeContents(name)
    const words = text.getBoundingClientRect()
    return {
      marks,
      knobOff: Math.abs(knob.left + knob.width / 2 - axis),
      nameOff: Math.abs(words.left + words.width / 2 - axis),
    }
  })
  expect(layout.marks.map((mark) => mark.text)).toEqual([
    '+12',
    '0',
    '−12',
    '−24',
    '−36',
    '−48',
    '−60',
  ])
  for (const mark of layout.marks) {
    expect(mark.off, mark.text!).toBeLessThanOrEqual(1)
    expect(mark.size, mark.text!).toBeGreaterThanOrEqual(11)
    expect(mark.leftOfFader, mark.text!).toBe(true)
  }
  expect(layout.knobOff).toBeLessThanOrEqual(1)
  expect(layout.nameOff).toBeLessThanOrEqual(1.5)

  // The title row costs no more than its Close button.
  const title = desk.getByRole('heading', { name: 'Mix', exact: true })
  const row = (await title.locator('..').boundingBox())!
  expect(row.height).toBeLessThanOrEqual(32)
})

test('in light, a Mix desk strip edge holds 1.3:1 against the desk', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_theme', 'light')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  await importStudioAudio(page, 'Harmony', 2)
  const desk = await openDesk(page)
  // The second strip: the first lane is selected and framed in the accent.
  const contrast = await desk
    .locator('[data-studio-mix-strip]:not([data-selected])')
    .first()
    .evaluate((strip) => {
      const canvas = document.createElement('canvas').getContext('2d')!
      const rgb = (color: string) => {
        canvas.clearRect(0, 0, 1, 1)
        canvas.fillStyle = color
        canvas.fillRect(0, 0, 1, 1)
        return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const luminance = (color: number[]) =>
        color
          .map((value) => {
            const channel = value / 255
            return channel <= 0.03928
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4
          })
          .reduce(
            (sum, channel, index) =>
              sum + channel * [0.2126, 0.7152, 0.0722][index],
            0,
          )
      const desk = strip.closest('[data-studio-mix-desk]')!
      const edge = luminance(rgb(getComputedStyle(strip).borderTopColor))
      const ground = luminance(rgb(getComputedStyle(desk).backgroundColor))
      return (Math.max(edge, ground) + 0.05) / (Math.min(edge, ground) + 0.05)
    })
  expect(contrast).toBeGreaterThanOrEqual(1.3)
})

test('on a laptop, the Mix desk meter prints its four marks clear of each other, and its peak reading takes only the height of its words', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await openArrangement(page)
  const meter = await deskMeter(await openDesk(page))

  expect(meter.marks).toEqual(['0', '−12', '−24', '−48'])
  for (const gap of meter.gaps) expect(gap).toBeGreaterThanOrEqual(2)
  expect(meter.spent).toBeLessThanOrEqual(meter.allowed + 1)
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  })

  test('a zoom button under a finger keeps no hover fill', async ({ page }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    expect(
      await page.evaluate(() => matchMedia('(hover: hover)').matches),
    ).toBe(false)
    const fit = studioRegion(page).getByRole('button', {
      name: 'Fit song to width',
      exact: true,
    })
    const resting = await fit.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    // A touch browser leaves :hover on the last element tapped; a pointer
    // resting there is the same state.
    const box = (await fit.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect
      .poll(() => fit.evaluate((element) => element.matches(':hover')))
      .toBe(true)
    expect(
      await fit.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe(resting)
  })

  test('in light, the flavour row fades out at the edge where more flavours wait', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => {
      localStorage.setItem('pitchperfect_theme', 'light')
    })
    await openArrangement(page)
    const desk = await openDesk(page, true)
    const row = desk.getByRole('group', { name: 'Flavour', exact: true })
    const edges = () =>
      row.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          scrolls: element.scrollWidth > element.clientWidth + 1,
          before: element.hasAttribute('data-more-before'),
          after: element.hasAttribute('data-more-after'),
          faded: (style.maskImage || style.webkitMaskImage) !== 'none',
        }
      })
    // A short tablet desk keeps the flavours to one row that scrolls.
    await expect
      .poll(edges)
      .toEqual({ scrolls: true, before: false, after: true, faded: true })

    await row.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await expect
      .poll(edges)
      .toEqual({ scrolls: true, before: true, after: false, faded: true })

    // Back at the start, Tab to the first chip the fade reaches: it comes
    // out from under the fade.
    const reached = await row.evaluate((element) => {
      element.scrollLeft = 0
      const fade = element.getBoundingClientRect().right - 32
      const chips = [...element.querySelectorAll('button')]
      const first = chips.findIndex(
        (chip) => chip.getBoundingClientRect().right > fade + 1,
      )
      chips[first - 1].focus()
      return chips[first].textContent
    })
    await expect.poll(edges).toMatchObject({ before: false, after: true })
    await page.keyboard.press('Tab')
    await expect
      .poll(() =>
        row.evaluate((element) => {
          const chip = document.activeElement!
          const box = chip.getBoundingClientRect()
          const shown = element.getBoundingClientRect()
          return {
            chip: chip.textContent,
            underFade:
              (element.hasAttribute('data-more-after') &&
                box.right > shown.right - 31) ||
              (element.hasAttribute('data-more-before') &&
                box.left < shown.left + 31),
          }
        }),
      )
      .toEqual({ chip: reached, underFade: false })
  })
})

test("on a laptop, each dial's end words stand 8 px apart and clear of the next dial's", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await openArrangement(page)
  const desk = await openDesk(page)
  const layout = await desk
    .getByRole('group', { name: 'Adjust', exact: true })
    .evaluate((group) => {
      const column = group.getBoundingClientRect()
      return {
        left: column.left,
        right: column.right,
        dials: [...group.children].map((dial) =>
          [...dial.lastElementChild!.children].map((word) => {
            const box = word.getBoundingClientRect()
            return { text: word.textContent, left: box.left, right: box.right }
          }),
        ),
      }
    })
  expect(layout.dials).toHaveLength(5)
  layout.dials.forEach(([low, high], index) => {
    expect(
      high.left - low.right,
      `${low.text} / ${high.text}`,
    ).toBeGreaterThanOrEqual(8)
    const next = layout.dials[index + 1]
    if (next)
      expect(
        next[0].left - high.right,
        `${high.text} / ${next[0].text}`,
      ).toBeGreaterThanOrEqual(8)
  })
  expect(layout.dials[0][0].left).toBeGreaterThanOrEqual(layout.left)
  expect(layout.dials[4][1].right).toBeLessThanOrEqual(layout.right)
})

test.describe('on a tablet held upright', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  })

  test('the desk meter drops the marks it has no room for, and its peak reading takes a 44 px press without taking travel', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    const desk = await openDesk(page, true)
    // The desk scrolls on an upright tablet: bring the meter's foot into view.
    await desk
      .getByTitle('Short-term loudness, 3 seconds', { exact: true })
      .scrollIntoViewIfNeeded()
    const meter = await deskMeter(desk)

    expect(meter.marks[0]).toBe('0')
    expect(meter.marks.length).toBeGreaterThanOrEqual(3)
    for (const gap of meter.gaps) expect(gap).toBeGreaterThanOrEqual(2)
    expect(meter.spent).toBeLessThanOrEqual(meter.allowed + 1)

    // The run of the reading's centre line a press lands on. The reading
    // names the button; its title says what a press does.
    const reset = desk.getByTitle('Reset peak hold', { exact: true })
    const reach = await reset.evaluate((button) => {
      const box = button.getBoundingClientRect()
      const x = box.left + box.width / 2
      const hits: number[] = []
      for (let y = Math.floor(box.top) - 40; y <= box.bottom + 40; y++)
        if (button.contains(document.elementFromPoint(x, y))) hits.push(y)
      return { x, first: Math.min(...hits), last: Math.max(...hits) }
    })
    expect(reach.last - reach.first + 1).toBeGreaterThanOrEqual(44)

    // Real taps down that run. A phone moves a tap near an edge to the
    // nearest words, so these stop 4 px short of each end.
    await reset.evaluate((button) => {
      const counted = window as unknown as { presses: number }
      counted.presses = 0
      button.addEventListener('click', () => counted.presses++)
    })
    let taps = 0
    for (const offset of [4, 10, 16, 22, 28, 34, 40]) {
      await page.touchscreen.tap(reach.x, reach.first + offset)
      taps++
      await expect
        .poll(
          () =>
            page.evaluate(
              () => (window as unknown as { presses: number }).presses,
            ),
          { message: `a tap ${offset} px into the press` },
        )
        .toBe(taps)
    }
  })
})
