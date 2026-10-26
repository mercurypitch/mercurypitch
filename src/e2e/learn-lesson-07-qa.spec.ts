// ============================================================
// Lesson 7 page QA — the chart by keyboard, by touch, and the layouts
// ============================================================
//
// WEB-SPEC's end-to-end checks 3, 4 and 5 (Tests), with reduced motion
// emulated so every move lands at once and a key press meets the state it
// changed: Tab walks Step 1's controls, each named; the scrub bar and the
// push note move by arrows and Page keys, and Home and End jump; Start
// lower and Start higher move "Twinkle" and the readout follows; the
// sounds, the singers, the voice switch and free play's state switch toggle
// `aria-pressed`; each band plays and names its span; the push buttons and
// the voice switch carry their names; and every announcement uses spoken
// names. At 390 x 844 and at 344 px wide every target on every step's stage
// is at least 44 px square, none overlap, and nothing scrolls sideways; at
// 390 and 360 px the hero's column fits its stage, every bead of "Twinkle"
// drawn inside it; at 320, 360 and 390 px the predict's play on the column
// fits inside its card, its words wrapping at 320 and on one line from 360.
// On a phone with touch, a long press on Higher climbs the note to the
// column's top without scrolling, selecting or opening a menu; a swipe
// elsewhere on the stage scrolls the page; and a drag that starts on the
// note's handle moves the note.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** The steps' chart, and its parts. */
const TOY = '#toyRange'
const part = (page: Page, selector: string): Locator =>
  page.locator(`${TOY} ${selector}`)
const said = (page: Page): Locator => part(page, '[data-range-said]')
const readout = (page: Page): Locator => part(page, '[data-range-readout]')

async function openStep(page: Page, step: number): Promise<void> {
  await page.goto(`/learn/07#step-${step}`)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Moves the deck on the page already open, as a step link does. */
async function goStep(page: Page, step: number): Promise<void> {
  await page.evaluate((n) => {
    window.location.hash = `#step-${n}`
  }, step)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Presses a control by keyboard: focus, then Enter. */
async function pressKey(loc: Locator): Promise<void> {
  await loc.focus()
  await loc.press('Enter')
}

interface Box {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

const boxesOf = (loc: Locator): Promise<Box[]> =>
  loc.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
      }
    }),
  )

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w - 0.5 &&
  b.x < a.x + a.w - 0.5 &&
  a.y < b.y + b.h - 0.5 &&
  b.y < a.y + a.h - 0.5

/** Every control on the chart: at least 44 px square, and no two overlapping. */
async function expectTargets(page: Page, what: string): Promise<void> {
  const targets = await boxesOf(
    page.locator(`${TOY} button:visible, ${TOY} [role="slider"]:visible`),
  )
  expect(targets.length, what).toBeGreaterThan(2)
  for (const t of targets) {
    expect(t.w, `${what}: ${t.name}`).toBeGreaterThanOrEqual(44)
    expect(t.h, `${what}: ${t.name}`).toBeGreaterThanOrEqual(44)
  }
  targets.forEach((a, i) =>
    targets.forEach((b, j) => {
      if (i < j)
        expect(overlap(a, b), `${what}: ${a.name} and ${b.name}`).toBe(false)
    }),
  )
}

const sideways = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('page QA (WEB-SPEC, Tests and Contract)', () => {
  // every move lands at once, so a key press meets the state it changed
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test("Tab walks Step 1's controls in order, each named", async ({ page }) => {
    await openStep(page, 1)
    await part(page, '[data-chart-voice="lower"]').focus()

    const names: string[] = []
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      names.push(
        await page.evaluate(() => {
          const el = document.activeElement
          return (
            el?.getAttribute('aria-label') ??
            el?.textContent?.replace(/\s+/g, ' ').trim() ??
            ''
          )
        }),
      )
    }

    expect(names).toEqual([
      'Higher voice',
      'Play',
      'Slow',
      'Where the siren is',
    ])
  })

  test('the scrub bar moves by arrows, a second by Page keys, and jumps by Home and End, in spoken names', async ({
    page,
  }) => {
    await openStep(page, 1)
    const scrub = part(page, '[data-siren-scrub]')
    await scrub.focus()

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(scrub).toHaveAttribute('aria-valuenow', '0.2')
    await page.keyboard.press('PageUp')
    await expect(scrub).toHaveAttribute('aria-valuenow', '1.2')
    await page.keyboard.press('End')
    await expect(scrub).toHaveAttribute('aria-valuenow', '6.0')
    await page.keyboard.press('Home')
    await expect(scrub).toHaveAttribute('aria-valuenow', '0.0')

    await expect(scrub).toHaveAttribute('aria-valuetext', /^0\.0 seconds of 6/)
    await expect(scrub).not.toHaveAttribute('aria-valuetext', /[♯♭]/)
  })

  test('the sounds and the voice switch toggle aria-pressed, and the live line names the siren in words', async ({
    page,
  }) => {
    await openStep(page, 2)

    await pressKey(part(page, '[data-sound="trill"]'))

    await expect(part(page, '[data-sound="trill"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(part(page, '[data-sound="ng"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(said(page)).toHaveText(
      "Merc's siren on a lip trill, from E 3 up to C sharp 4 and back",
    )

    await pressKey(part(page, '[data-chart-voice="higher"]'))
    await expect(part(page, '[data-chart-voice="higher"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(part(page, '[data-chart-voice="lower"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(
      page.getByRole('button', { name: 'Lower voice', exact: true }).first(),
    ).toBeVisible()
  })

  test('Start lower and Start higher move "Twinkle", and the readout follows', async ({
    page,
  }) => {
    await openStep(page, 3)
    const higher = part(page, '[data-slide="1"]')

    for (let i = 0; i < 3; i++) await pressKey(higher)

    await expect(readout(page)).toHaveText(
      'Moved up 3 semitones: reaching into the dimmed top end',
    )
    await expect(said(page)).toHaveText(
      'Twinkle, moved up 3 semitones: reaching into the dimmed top end',
    )
    await pressKey(part(page, '[data-slide="-1"]'))
    await expect(readout(page)).toHaveText(
      'Moved up 2 semitones: all of it in the lit middle',
    )
  })

  test('the push note moves by arrows and jumps to the column’s ends, its buttons named Lower note and Higher note', async ({
    page,
  }) => {
    await openStep(page, 4)
    await expect(
      page.getByRole('button', { name: 'Lower note', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Higher note', exact: true }),
    ).toBeVisible()
    const handle = part(page, '[data-push-handle]')
    await handle.focus()

    await page.keyboard.press('ArrowUp')
    await expect(handle).toHaveAttribute('aria-valuenow', '46')
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '69')
    await expect(readout(page)).toHaveText('A4: much more push')
    await page.keyboard.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '45')
    await expect(handle).not.toHaveAttribute('aria-valuetext', /[♯♭]/)
  })

  test("Step 5's singers wait for a guess, then toggle; each band plays and names its span", async ({
    page,
  }) => {
    await openStep(page, 5)
    await expect(part(page, '[data-singer="a"]')).toBeDisabled()

    await pressKey(page.locator('#predictTypes [data-choice="not-always"]'))
    await expect(page.locator('#predictTypes .reveal')).toBeVisible()
    await pressKey(part(page, '[data-singer="a"]'))
    await expect(part(page, '[data-singer="a"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await pressKey(part(page, '[data-show-types]'))
    await expect(part(page, '[data-show-types]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(part(page, '[data-singer="a"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const tenor = page.getByRole('button', {
      name: 'Tenor, C 3 to C 5: play its middle note, C 4',
      exact: true,
    })
    await expect(part(page, '[data-band]')).toHaveCount(6)
    await pressKey(tenor)
    await expect(said(page)).toContainText('Tenor')
    await expect(said(page)).not.toHaveText(/[♯♭]/)
  })

  test("free play's state switch toggles aria-pressed, three a row then two", async ({
    page,
  }) => {
    await page.goto('/learn/07#wrap')
    const states = page.locator('#freePlay [data-free-state]')
    await expect(states).toHaveCount(5)

    await pressKey(page.locator('#freePlay [data-free-state="push"]'))

    await expect(
      page.locator('#freePlay [data-free-state="push"]'),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.locator('#freePlay [data-free-state="siren"]'),
    ).toHaveAttribute('aria-pressed', 'false')
    const rows = await boxesOf(states)
    const tops = [...new Set(rows.map((r) => Math.round(r.y)))]
    expect(tops).toHaveLength(2)
  })

  for (const [width, height] of [
    [390, 844],
    [344, 740],
  ] as const) {
    test.describe(`at ${width} x ${height}`, () => {
      test.use({ viewport: { width, height } })

      test('every step keeps every target 44 px square, none overlapping, and nothing scrolls sideways', async ({
        page,
      }) => {
        await openStep(page, 1)
        for (const step of [1, 2, 3, 4, 5]) {
          if (step > 1) await goStep(page, step)
          if (step === 5)
            await pressKey(page.locator('#predictTypes [data-choice="same"]'))
          if (step === 5) await pressKey(part(page, '[data-show-types]'))
          await expectTargets(page, `step ${step}`)
          expect(await sideways(page), `step ${step}`).toBeLessThanOrEqual(0)
        }
      })
    })
  }

  // "Play “Twinkle” on the column" asks 288 px on one line, and at 320 px the
  // predict card has 254 inside it: its words wrap there, and from 360 px
  // they keep their one line, the button 44 px tall as before.
  for (const width of [320, 360, 390]) {
    test(`at ${width} px the predict's play on the column fits inside its card`, async ({
      page,
    }) => {
      // Arrange
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/learn/07')
      const play = page.locator('#predict [data-play="column"]')
      await expect(play).toBeVisible()

      // Act: how far inside the card's padding the button stays on each side
      const fit = await play.evaluate((el) => {
        const card = el.closest('.card')
        if (card === null) return null
        const c = card.getBoundingClientRect()
        const cs = getComputedStyle(card)
        const b = el.getBoundingClientRect()
        return {
          left:
            b.left -
            (c.left +
              parseFloat(cs.borderLeftWidth) +
              parseFloat(cs.paddingLeft)),
          right:
            c.right -
            parseFloat(cs.borderRightWidth) -
            parseFloat(cs.paddingRight) -
            b.right,
          height: b.height,
        }
      })

      // Assert
      expect(fit).not.toBeNull()
      expect(fit?.left ?? -1).toBeGreaterThanOrEqual(0)
      expect(fit?.right ?? -1).toBeGreaterThanOrEqual(0)
      expect(fit?.height ?? 0).toBeGreaterThanOrEqual(44)
      if (width >= 360) expect(fit?.height).toBe(44)
      expect(await sideways(page)).toBeLessThanOrEqual(0)
    })
  }

  // the hero's column has no buttons, so it keeps no 44 px column and fits a phone
  for (const width of [390, 360]) {
    test(`at ${width} px the hero's column fits its stage, every bead of "Twinkle" inside it`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/learn/07')
      await page.locator('#predict [data-choice="less"]').click()
      await page.locator('#predict [data-play="column"]').click()
      await expect(page.locator('#predict .reveal')).toBeVisible({
        timeout: 20_000,
      })
      await page.locator('#heroRange').scrollIntoViewIfNeeded()

      const fit = await page.evaluate(() => {
        const canvas =
          document.querySelector<HTMLCanvasElement>('#heroRange canvas')
        const stage = document.querySelector('#heroStage')
        if (canvas === null || stage === null) return null
        const c = canvas.getBoundingClientRect()
        const s = stage.getBoundingClientRect()
        const { width: w, height: h } = canvas
        const data = canvas.getContext('2d')?.getImageData(0, 0, w, h).data
        // the drawn part's box: every pixel with any ink in it
        let x0 = w
        let x1 = -1
        let y0 = h
        let y1 = -1
        // the beads: near-solid pixels, the rightmost the last bead's edge
        let solidRight = -1
        let solid = 0
        if (data !== undefined)
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const a = data[(y * w + x) * 4 + 3]
              if (a > 40) {
                x0 = Math.min(x0, x)
                x1 = Math.max(x1, x)
                y0 = Math.min(y0, y)
                y1 = Math.max(y1, y)
              }
              if (a > 245) {
                solid++
                solidRight = Math.max(solidRight, x)
              }
            }
        return {
          canvas: {
            left: c.left,
            right: c.right,
            top: c.top,
            bottom: c.bottom,
          },
          stage: { left: s.left, right: s.right, top: s.top, bottom: s.bottom },
          vw: window.innerWidth,
          w,
          h,
          drawn: { x0, x1, y0, y1 },
          solid,
          solidRight,
        }
      })

      expect(fit).not.toBeNull()
      if (fit === null) return
      // the canvas inside its stage and the screen
      expect(fit.canvas.left).toBeGreaterThanOrEqual(fit.stage.left)
      expect(fit.canvas.right).toBeLessThanOrEqual(fit.stage.right)
      expect(fit.canvas.top).toBeGreaterThanOrEqual(fit.stage.top)
      expect(fit.canvas.bottom).toBeLessThanOrEqual(fit.stage.bottom)
      expect(fit.canvas.right).toBeLessThanOrEqual(fit.vw)
      // the whole column drawn, its outline inside the canvas on every side
      expect(fit.drawn.x0).toBeGreaterThan(0)
      expect(fit.drawn.y0).toBeGreaterThan(0)
      expect(fit.drawn.x1).toBeLessThan(fit.w - 1)
      expect(fit.drawn.y1).toBeLessThan(fit.h - 1)
      // the beads drawn, the last one ending inside the canvas
      expect(fit.solid).toBeGreaterThan(0)
      expect(fit.solidRight).toBeLessThan(fit.w - 1)
    })
  }
})

test.describe('Step 4 on a phone, with touch', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  /** The centre of an element, in the page's CSS px. */
  async function centre(loc: Locator): Promise<{ x: number; y: number }> {
    const box = await loc.boundingBox()
    if (box === null) throw new Error('no box')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  test('a long press on Higher climbs to the column’s top, scrolling, selecting and opening nothing @smoke', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // sound on first, as a reader has it by Step 4; the gate in the hero
    // keeps its height as sound comes on, so nothing above the step moves
    await page.goto('/learn/07')
    await page.locator('#gateBtn').tap()
    await goStep(page, 4)
    await page.evaluate(() => {
      const w = window as unknown as { menus: number }
      w.menus = 0
      window.addEventListener('contextmenu', () => (w.menus += 1), true)
    })
    const higher = part(page, '[data-push="1"]')
    await higher.scrollIntoViewIfNeeded()
    const scrolled = await page.evaluate(() => window.scrollY)
    const at = await centre(higher)
    const cdp = await page.context().newCDPSession(page)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: at.x, y: at.y }],
    })
    // held: 400 ms, then a semitone every 150 ms, the column's 24 in about 4 s
    const handle = part(page, '[data-push-handle]')
    await expect(handle).toHaveAttribute('aria-valuenow', '69', {
      timeout: 8_000,
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect(handle).toHaveAttribute('aria-valuenow', '69')
    await expect(readout(page)).toHaveText('A4: much more push')
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled)
    expect(
      await page.evaluate(() => window.getSelection()?.toString() ?? ''),
    ).toBe('')
    expect(
      await page.evaluate(() => (window as unknown as { menus: number }).menus),
    ).toBe(0)
  })

  test('a swipe anywhere else on the stage scrolls the page, and moves no note', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/learn/07')
    await page.locator('#gateBtn').tap()
    await goStep(page, 4)
    const viz = part(page, '[data-range-viz]')
    const box = await viz.boundingBox()
    if (box === null) throw new Error('no chart')
    const before = await page.evaluate(() => window.scrollY)
    const x = box.x + 40
    const y = box.y + box.height - 30
    const cdp = await page.context().newCDPSession(page)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    for (let dy = 10; dy <= 200; dy += 10)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - dy }],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before + 100)
    await expect(part(page, '[data-push-handle]')).toHaveAttribute(
      'aria-valuenow',
      '45',
    )
  })

  test("a drag that starts on the note's handle moves the note up", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openStep(page, 4)
    const handle = part(page, '[data-push-handle]')
    await handle.scrollIntoViewIfNeeded()
    const before = Number(await handle.getAttribute('aria-valuenow'))
    const at = await centre(handle)
    const cdp = await page.context().newCDPSession(page)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: at.x, y: at.y }],
    })
    for (let dy = 8; dy <= 80; dy += 8)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: at.x, y: at.y - dy }],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect
      .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
      .toBeGreaterThan(before)
  })
})
