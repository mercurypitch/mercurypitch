// ============================================================
// Lesson 4 loads at /learn/04 as its own document, boots, and passes page QA
// ============================================================
//
// As for Lessons 1 and 2: the asset layer must answer the lesson rather than
// the 404 page, and a visitor whose studio service worker is installed must
// get the lesson rather than the cached app shell. Then the module must
// boot, and the page must pass the two checks WEB-SPEC "Contract" adds for
// this lesson: every stair, the start slider and the names switch work by
// keyboard alone and say what the page shows; and at 390 x 844 the
// staircase, its buttons and the keyboard strip fit, overlapping nothing,
// at every start from C4 to B4. A real-mouse drag of the staircase closes
// it, since a drag slides the start and must not land as a tap.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// 60 characters at most (src/tests/lesson-pages.test.ts): the lesson's number is in its kicker
const TITLE = 'The major scale and home · Find Your Pitch | MercuryPitch'

/** The steps' staircase, and its parts. */
const TOY = '#toyStairs'
const slider = (page: Page): Locator =>
  page.locator(`${TOY} [data-start-slider]`)
const said = (page: Page): Locator => page.locator(`${TOY} [data-stairs-said]`)
const stair = (page: Page, i: number): Locator =>
  page.locator(`${TOY} [data-stair="${i}"]`)

async function openStep(page: Page, step: number): Promise<void> {
  await page.goto(`/learn/04#step-${step}`)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Moves the deck on the page already open, as a step link does. */
async function goStep(page: Page, step: number): Promise<void> {
  await page.evaluate((n) => {
    window.location.hash = `#step-${n}`
  }, step)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Slides the steps' staircase to `midi` (C4 60 to B4 71) by keyboard. */
async function startOn(page: Page, midi: number): Promise<void> {
  await slider(page).focus()
  await page.keyboard.press('Home')
  for (let m = 60; m < midi; m++) await page.keyboard.press('ArrowUp')
  await expect(slider(page)).toHaveAttribute('aria-valuenow', String(midi))
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
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('a hard load of /learn/04 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/04')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Why does do-re-mi sound finished when it lands on do',
  )
  await expect(page.locator('#root')).toHaveCount(0)
  // a written lesson: no film, so no Watch section
  await expect(page.locator('#watch')).toHaveCount(0)
})

test('the lesson boots: a guess unlocks Play from D, and Merc stops on ti @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/learn/04')
  await page.locator('#gateBtn').click()

  const fromD = page.locator('#predict [data-play="from-d"]')
  await expect(fromD).toBeDisabled()
  // Play from C works before the guess: orange's line answers it
  await expect(page.locator('#predict [data-play="from-c"]')).toBeEnabled()
  await page.locator('#predict [data-choice="still"]').click()
  await expect(fromD).toBeEnabled()
  await fromD.click()

  // seven notes from D, ti held: then the stop is said and the reveal follows
  await expect(page.locator('#predict [data-cold-said]')).toHaveText(
    'Stopped on ti. Land on do finishes the scale.',
    { timeout: 10_000 },
  )
  await expect(page.locator('#predict .reveal')).toBeVisible()
  await expect(page.locator('#predict .reveal')).toContainText(
    'Still unfinished, and Land on do finishes it on D.',
  )
  // the explorer opens on this lesson: ready to read, with no film to watch
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  const card = page.locator('#exCardHost')
  await expect(card.locator('h3')).toHaveText('The major scale and home')
  await expect(card).toContainText('Ready · read')
  await expect(
    card.getByRole('link', { name: 'Read the lesson' }),
  ).toBeVisible()
  await expect(
    card.getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    async () =>
      (await navigator.serviceWorker.getRegistration('/')) !== undefined,
    undefined,
    { timeout: 20_000 },
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  )

  await page.goto('/learn/04')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the recall sends a viewer to Lesson 2 in a new tab; the quick check marks Lesson 4 done', async ({
  page,
}) => {
  await page.goto('/learn/04')

  // a wrong recall answer links to Lesson 2's own step, keeping this page in place
  const recall = page.locator('#recall-qs .q').nth(0)
  await recall.getByRole('button', { name: '7', exact: true }).click()
  const away = page.locator('#recall-qs a', {
    hasText: 'Try Lesson 2, Step 2 again',
  })
  await expect(away).toHaveAttribute('href', '/learn/02#step-2')
  await expect(away).toHaveAttribute('target', '_blank')

  // the quick check's step links move this page's own deck
  const check = page.locator('#qs .q')
  await check
    .nth(1)
    .getByRole('button', { name: 'D, E, F, G, A, B, C, D', exact: true })
    .click()
  await page.locator('#qs a', { hasText: 'Try Step 3 again' }).click()
  await expect(page.locator('#stepNow')).toHaveText('3')

  // answering all four marks the lesson done in the explorer
  await check
    .nth(0)
    .getByRole('button', {
      name: 'Tone, tone, semitone, tone, tone, tone, semitone',
      exact: true,
    })
    .click()
  await check
    .nth(2)
    .getByRole('button', {
      name: 'It sounds unfinished: ti leans up to do',
      exact: true,
    })
    .click()
  await check
    .nth(3)
    .getByRole('button', { name: 'F sharp', exact: true })
    .click()
  await expect(page.locator('#scoreN')).toHaveText('3')
  await expect(page.locator('#exCardHost')).toContainText('Done')
})

test.describe('page QA (WEB-SPEC, Contract)', () => {
  // every move lands at once, so a key press meets the state it changed
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('every stair and the names switch are reached and named by keyboard', async ({
    page,
  }) => {
    await openStep(page, 4)
    await startOn(page, 62)

    // the names switch: three buttons, one pressed, each worked by Enter
    const numbers = page.locator(`${TOY} [data-names="numbers"]`)
    await numbers.focus()
    await page.keyboard.press('Enter')
    await expect(numbers).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`${TOY} [data-names="letters"]`)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const solfege = page.locator(`${TOY} [data-names="solfege"]`)
    await solfege.focus()
    await page.keyboard.press('Enter')
    await expect(solfege).toHaveAttribute('aria-pressed', 'true')

    // Tab walks from the switch onto the eight stairs, do to do, each saying its note
    const names = [
      'Stair 1, do, D4, home',
      'Stair 2, re, E4',
      'Stair 3, mi, F sharp 4',
      'Stair 4, fa, G4',
      'Stair 5, so, A4',
      'Stair 6, la, B4',
      'Stair 7, ti, C sharp 5',
      'Stair 8, do, D5, home',
    ]
    for (const [i, name] of names.entries()) {
      await page.keyboard.press('Tab')
      await expect(stair(page, i)).toBeFocused()
      await expect(stair(page, i)).toHaveAttribute('aria-label', name)
    }
    // a stair plays by keyboard as by tap
    await page.keyboard.press('Enter')
    await expect(stair(page, 7)).toBeFocused()
  })

  test('the start slider moves by keys alone and says the scale it stands on', async ({
    page,
  }) => {
    await openStep(page, 4)
    const s = slider(page)
    await s.focus()
    await expect(s).toHaveAttribute('role', 'slider')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowUp')
    await expect(s).toHaveAttribute('aria-valuenow', '62')
    await expect(s).toHaveAttribute(
      'aria-valuetext',
      'Do is D4: D major, two black keys',
    )
    // the live summary names the scale, its notes and its steps once the slide has settled
    await expect(said(page)).toHaveText(
      'D major: D, E, F sharp, G, A, B, C sharp, D. Tone, tone, semitone, tone, tone, tone, semitone.',
    )
    await page.keyboard.press('End')
    await expect(s).toHaveAttribute(
      'aria-valuetext',
      'Do is B4: B major, five black keys',
    )
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(s).toHaveAttribute('aria-valuenow', '67')
    await page.keyboard.press('ArrowDown')
    await expect(stair(page, 6)).toHaveAttribute(
      'aria-label',
      'Stair 7, ti, E sharp 5',
    )
    await page.keyboard.press('Home')
    await expect(s).toHaveAttribute(
      'aria-valuetext',
      'Do is C4: C major, no black keys',
    )
    await expect(s).toBeFocused()
  })

  test('White keys only says the steps from D, and is off on a black key', async ({
    page,
  }) => {
    await openStep(page, 3)
    await startOn(page, 62)
    const white = page.locator(`${TOY} [data-stairs-white]`)

    await white.focus()
    await page.keyboard.press('Space')
    await expect(said(page)).toHaveText(
      'White keys from D: tone, semitone, tone, tone, tone, semitone, tone. Not a major scale.',
    )
    await expect(white).toHaveAttribute('aria-pressed', 'true')

    await slider(page).focus()
    await page.keyboard.press('ArrowUp')
    await expect(white).toHaveAttribute('aria-disabled', 'true')
    await expect(white).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator(`${TOY} [data-white-hint]`)).toBeVisible()
    await white.focus()
    await expect(white).toBeFocused()
  })

  test('Stop on ti says where it stopped, and Land on do follows', async ({
    page,
  }) => {
    await openStep(page, 5)
    await startOn(page, 62)
    const stop = page.locator(`${TOY} [data-stairs-play="stop"]`)

    await stop.focus()
    await page.keyboard.press('Enter')

    await expect(said(page)).toHaveText(
      'Stopped on ti, C sharp 5. Land on do finishes the scale.',
      { timeout: 10_000 },
    )
    await expect(page.locator(`${TOY} [data-stairs-play="land"]`)).toBeVisible()
  })

  // the polish audit's landscape budget: the whole sticky stage keeps to
  // about 550 px at 1024 px wide, and every control stays on screen
  test.describe('at 1024 x 640, an iPad in Safari with its tab bar', () => {
    test.use({ viewport: { width: 1024, height: 640 }, hasTouch: true })

    test("every step's stage keeps to 550 px, every control on screen", async ({
      page,
    }) => {
      await openStep(page, 1)
      for (const step of [1, 2, 3, 4, 5]) {
        await goStep(page, step)
        const card = await page.locator('#stepsStage .stage-card').boundingBox()
        expect(card?.height ?? 0, `step ${step}`).toBeLessThanOrEqual(550)
        const mast = await page.locator('#mast').boundingBox()
        const controls = await boxesOf(
          page.locator(`${TOY} button:visible, ${TOY} [role="slider"]:visible`),
        )
        for (const c of controls) {
          expect(c.y, `step ${step} ${c.name}`).toBeGreaterThanOrEqual(
            (mast?.y ?? 0) + (mast?.height ?? 0) - 0.5,
          )
          expect(c.y + c.h, `step ${step} ${c.name}`).toBeLessThanOrEqual(640.5)
        }
      }
    })
  })

  test.describe('at 390 x 844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    for (const step of [1, 2, 3, 4, 5]) {
      test(`step ${step}'s stage fits under the masthead, every control at least 44 px`, async ({
        page,
      }) => {
        await openStep(page, step)
        const card = page.locator('#stepsStage .stage-card')
        const box = await card.boundingBox()
        // the masthead is 58 px: the stage fits the 786 px below it
        expect(box?.height ?? 0).toBeLessThan(786)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(390)
        const controls = await boxesOf(card.locator('button:visible'))
        expect(controls.length).toBeGreaterThan(9)
        for (const c of controls) {
          expect(c.w, c.name).toBeGreaterThanOrEqual(44)
          expect(c.h, c.name).toBeGreaterThanOrEqual(44)
        }
      })
    }

    test('the staircase, its readout and the strip fit, overlapping nothing, at every start from C4 to B4', async ({
      page,
    }) => {
      await openStep(page, 5)
      const viz = page.locator(`${TOY} [data-stairs-viz]`)
      const fig = await viz.boundingBox()
      if (fig === null) throw new Error('no staircase')
      // inside the 16 px gutters and the card's padding
      expect(fig.x).toBeGreaterThanOrEqual(16)
      expect(fig.x + fig.width).toBeLessThanOrEqual(374)

      for (let start = 60; start <= 71; start++) {
        await startOn(page, start)
        const stairs = await boxesOf(page.locator(`${TOY} [data-stair]`))
        const [readout] = await boxesOf(
          page.locator(`${TOY} [data-stairs-readout]`),
        )
        expect(stairs).toHaveLength(8)
        for (const s of stairs) {
          expect(s.w, `${start} ${s.name}`).toBeGreaterThanOrEqual(44)
          expect(s.h, `${start} ${s.name}`).toBeGreaterThanOrEqual(44)
          expect(s.x).toBeGreaterThanOrEqual(fig.x - 0.5)
          expect(s.x + s.w).toBeLessThanOrEqual(fig.x + fig.width + 0.5)
          expect(s.y).toBeGreaterThanOrEqual(fig.y)
          // every stair stands above the keyboard strip, the bottom 84 px of the figure
          expect(s.y + s.h).toBeLessThanOrEqual(fig.y + fig.height - 84)
          // the readout, one line in the top margin, clears every stair and its name
          expect(overlap(readout, s), `${start} ${s.name}`).toBe(false)
        }
        expect(readout.h).toBeLessThan(30)
        stairs.forEach((a, i) =>
          stairs.forEach((b, j) => {
            if (i < j)
              expect(overlap(a, b), `${start}: ${a.name} and ${b.name}`).toBe(
                false,
              )
          }),
        )
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(390)
    })

    test("a tap on the strip's key plays it in step 1, and makes it do from step 3", async ({
      page,
    }) => {
      await openStep(page, 1)
      const viz = page.locator(`${TOY} [data-stairs-viz]`)
      const fig = await viz.boundingBox()
      if (fig === null) throw new Error('no staircase')
      // the strip shows C4 to C5 in eight white keys of 44.5 px; D4's lower half is clear of the black keys
      const onD = { x: 44.5 * 1.5, y: fig.height - 8 - 14 }

      await viz.click({ position: onD })
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '60')

      await goStep(page, 3)
      await viz.click({ position: onD })
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '62')
      await expect(stair(page, 2)).toHaveAttribute(
        'aria-label',
        'Stair 3, mi, F sharp 4',
      )
    })
  })
})

test('dragging the staircase with a real mouse slides its start, and the drag presses no stair @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openStep(page, 3)
  const viz = page.locator(`${TOY} [data-stairs-viz]`)
  await viz.scrollIntoViewIfNeeded()
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '60')
  // count the presses every stair button takes
  await page.evaluate(() => {
    const w = window as unknown as { stairPresses: number }
    w.stairPresses = 0
    for (const b of document.querySelectorAll('#toyStairs [data-stair]'))
      b.addEventListener('click', () => {
        w.stairPresses += 1
      })
  })
  const presses = (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { stairPresses: number }).stairPresses,
    )
  const box = await stair(page, 3).boundingBox()
  const ti = await stair(page, 6).boundingBox()
  const top = await stair(page, 7).boundingBox()
  if (box === null || ti === null || top === null) throw new Error('no stairs')
  // ti's tap zone starts a row below the top do's: a row is that far
  const row = ti.y - top.y
  // grab fa's block, and drag up a little over two rows
  const x = box.x + box.width / 2
  const y = box.y + box.height - 20

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 2.2 * row, { steps: 10 })
  await page.mouse.up()

  await expect(slider(page)).toHaveAttribute('aria-valuenow', '62')
  await expect(slider(page)).toHaveAttribute(
    'aria-valuetext',
    'Do is D4: D major, two black keys',
  )
  expect(await presses()).toBe(0)
  // a plain click on the same stair is a press
  await stair(page, 3).click()
  expect(await presses()).toBe(1)
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '62')
})
