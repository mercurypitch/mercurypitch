// ============================================================
// Lesson 2 loads at /learn/02 as its own document, boots, and passes page QA
// ============================================================
//
// As for Lesson 1: the asset layer must answer the lesson rather than the
// 404 page, and a visitor whose studio service worker is installed must get
// the lesson rather than the cached app shell. Then the module must boot,
// and the page must pass the three checks WEB-SPEC "Contract" adds for this
// lesson: every black key and tile reachable and named by keyboard in each
// spelling; the ruler's slider operable by keys alone; and, at 390 x 844,
// steps 3 to 5's stages at their measured heights with every key and tile
// that takes taps at least 44 px wide. A real-mouse drag of the ruler's
// marker closes it, since the marker is a custom slider, not a range input.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { filmSources } from '../features/lessons/kit/films'

const TITLE = 'Why twelve notes? Sharps, flats and semitones | MercuryPitch'

/** A2, the kit's lowest note: the canvases' slider values count semitones from it. */
const LO = 45

/** A note's place above the A below it: 0 for an A, 1 for the black key above it. */
const fromA = (midi: number): number => (midi - LO + 48) % 12

/** The page's black keys in each spelling, by their place above A, as the keys' accessible names say them. */
const SPOKEN: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  sharps: {
    1: 'A sharp',
    4: 'C sharp',
    6: 'D sharp',
    9: 'F sharp',
    11: 'G sharp',
  },
  flats: { 1: 'B flat', 4: 'D flat', 6: 'E flat', 9: 'G flat', 11: 'A flat' },
}

/** What a black key's accessible name starts with, in a spelling: "C sharp 4, also D flat 4" in Both. */
function blackName(midi: number, spelling: string): string {
  const pc = fromA(midi)
  const octaveOf = (m: number): number => Math.floor(m / 12) - 1
  const sharp = `${SPOKEN.sharps[pc]} ${octaveOf(midi - 1)}`
  const flat = `${SPOKEN.flats[pc]} ${octaveOf(midi + 1)}`
  if (spelling === 'sharps') return sharp
  if (spelling === 'flats') return flat
  return `${sharp}, also ${flat}`
}

const isBlack = (midi: number): boolean =>
  [1, 4, 6, 9, 11].includes(fromA(midi))

/** Walks a slider canvas from its lowest note to its highest by keyboard, collecting what each note is called. */
async function walk(canvas: Locator, page: Page): Promise<Map<number, string>> {
  await canvas.focus()
  await page.keyboard.press('Home')
  const min = Number(await canvas.getAttribute('aria-valuemin'))
  const max = Number(await canvas.getAttribute('aria-valuemax'))
  const names = new Map<number, string>()
  for (let s = min; s <= max; s++) {
    await expect(canvas).toHaveAttribute('aria-valuenow', String(s))
    names.set(LO + s, (await canvas.getAttribute('aria-valuetext')) ?? '')
    await page.keyboard.press('ArrowRight')
  }
  return names
}

async function spell(page: Page, spelling: string): Promise<void> {
  await page.goto('/learn/02#step-5')
  const toggle = page.locator(`#toyNames [data-names="${spelling}"]`)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
}

test('a hard load of /learn/02 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/02')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'where do the other five notes come from?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the lesson boots: a guess unlocks the climb, which counts twelve steps to the octave @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/learn/02')
  await page.locator('#gateBtn').click()

  const climb = page.locator('#predict [data-play="climb"]')
  await expect(climb).toBeDisabled()
  await page.locator('#predict [data-choice="some"]').click()
  await expect(climb).toBeEnabled()
  await climb.click()

  // thirteen notes, 0.42 s apart: twelve steps, then the reveal
  const hero = page.locator('#heroSpiral')
  await expect(hero.locator('[data-climb-steps]')).toHaveText('12', {
    timeout: 10_000,
  })
  await expect(hero.locator('[data-climb-x2]')).toBeVisible()
  await expect(page.locator('#predict .reveal')).toBeVisible()
  await expect(page.locator('#predict .reveal')).toContainText(
    'Twelve steps, not fourteen.',
  )
  // the explorer opens on this lesson, to start from the top of the page
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText('Twelve notes')
  await expect(
    page.locator('#exCardHost').getByRole('link', { name: 'Start lesson' }),
  ).toHaveAttribute('href', '#top')

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

  await page.goto('/learn/02')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test.describe('page QA (WEB-SPEC, Contract)', () => {
  // every change lands at once, so a tap or a key press meets the state it changed
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const spelling of ['sharps', 'flats', 'both']) {
    test(`every black key and tile is reachable and named by keyboard, in ${spelling}`, async ({
      page,
    }) => {
      await spell(page, spelling)
      // step 5's tile row: A3 to A4 on this stage
      const tiles = await walk(page.locator('#toyNames canvas'), page)
      expect([...tiles.keys()]).toEqual(
        Array.from({ length: 13 }, (_, k) => 57 + k),
      )
      for (const [midi, said] of tiles)
        if (isBlack(midi)) expect(said).toContain(blackName(midi, spelling))

      // step 3's keyboard, unrolled: all 37 keys, A2 to A5
      await page.locator('#step-3').scrollIntoViewIfNeeded()
      await page.evaluate(() => {
        window.location.hash = '#step-3'
      })
      await page.locator('#toyKeys [data-unroll]').click()
      await expect(page.locator('#toyKeys [data-unroll] span')).toHaveText(
        'Roll it back up',
      )
      const keys = await walk(page.locator('#toyKeys canvas'), page)
      expect(keys.size).toBe(37)
      const blacks = [...keys].filter(([midi]) => isBlack(midi))
      expect(blacks).toHaveLength(15)
      for (const [midi, said] of blacks)
        expect(said).toContain(blackName(midi, spelling))
    })
  }

  test("the ruler's slider is operable by keys alone", async ({ page }) => {
    await page.goto('/learn/02#step-6')
    await expect(page.locator('#stepNow')).toHaveText('6')
    const slider = page.locator('#toyRuler .ruler-slider')
    const note = page.locator('#toyRuler [data-monitor-note]')
    await slider.focus()
    await expect(slider).toBeFocused()

    await page.keyboard.press('ArrowUp')
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    await expect(slider).toHaveAttribute(
      'aria-valuetext',
      'A3 plus 1 cent, 220.13 hertz',
    )
    for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowUp')
    await expect(slider).toHaveAttribute('aria-valuenow', '41')
    for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAttribute('aria-valuenow', '49')
    await expect(note).toHaveText('A3')
    // at 50 cents the nearest note flips to A#3, as the app's monitor does
    await page.keyboard.press('ArrowUp')
    await expect(note).toHaveText('A#3')
    await expect(slider).toHaveAttribute(
      'aria-valuetext',
      'A sharp 3 minus 50 cents, 226.45 hertz',
    )
    await page.keyboard.press('PageUp')
    await expect(slider).toHaveAttribute('aria-valuenow', '150')
    await expect(slider).toBeFocused()
    await page.keyboard.press('PageDown')
    await page.keyboard.press('ArrowDown')
    await expect(slider).toHaveAttribute('aria-valuenow', '49')
    await page.keyboard.press('End')
    await expect(slider).toHaveAttribute(
      'aria-valuetext',
      'A4 exactly, 440.00 hertz',
    )
    await page.keyboard.press('Home')
    await expect(slider).toHaveAttribute(
      'aria-valuetext',
      'A3 exactly, 220.00 hertz',
    )
  })

  test.describe('at 390 x 844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    const HEIGHTS: Readonly<Record<number, number>> = { 3: 478, 4: 478, 5: 738 }

    for (const step of [3, 4, 5]) {
      test(`step ${step}'s stage is ${HEIGHTS[step]} px, every control at least 44 px`, async ({
        page,
      }) => {
        await page.goto(`/learn/02#step-${step}`)
        const card = page.locator('#stepsStage .stage-card')
        await expect(page.locator('#stepNow')).toHaveText(String(step))
        const box = await card.boundingBox()
        expect(box?.height).toBeCloseTo(HEIGHTS[step], 0)
        // the stage fits under the masthead, with no sideways scroll
        expect(box?.height ?? 0).toBeLessThan(786)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(390)
        const controls = await card
          .locator('button:visible')
          .evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect()
              return {
                name: el.textContent?.trim() ?? '',
                w: r.width,
                h: r.height,
              }
            }),
          )
        expect(controls.length).toBeGreaterThan(2)
        for (const c of controls) {
          expect(c.w, c.name).toBeGreaterThanOrEqual(44)
          expect(c.h, c.name).toBeGreaterThanOrEqual(44)
        }
      })
    }

    test("step 3's keys take taps over 44 px each, the black keys' zones never overlapping", async ({
      page,
    }) => {
      await page.goto('/learn/02#step-3')
      const canvas = page.locator('#toyKeys canvas')
      await page.locator('#toyKeys [data-unroll]').click()
      await expect(page.locator('#toyKeys [data-spiral-hint]')).toHaveText(
        'Tap any key to hear it',
      )
      const box = await canvas.boundingBox()
      expect(box?.width).toBe(356)
      // eight white keys of 44.5 px; the black keys' depth ends at y 195 of the 308 px figure
      const at = async (x: number, y: number): Promise<number> => {
        await canvas.click({ position: { x, y } })
        return Number(await canvas.getAttribute('aria-valuenow'))
      }
      const C4 = 60 - LO
      const C_SHARP_4 = 61 - LO
      const D4 = 62 - LO
      const D_SHARP_4 = 63 - LO
      // C♯4 sits on the C4 | D4 edge at x 133.5: its zone runs 111.5 to 155.5
      await expect.poll(() => at(112, 150)).toBe(C_SHARP_4)
      await expect.poll(() => at(111, 150)).toBe(C4)
      await expect.poll(() => at(155, 150)).toBe(C_SHARP_4)
      await expect.poll(() => at(157, 150)).toBe(D_SHARP_4)
      // below the black keys a white key takes its whole width
      await expect.poll(() => at(134, 230)).toBe(D4)
      await expect.poll(() => at(133, 230)).toBe(C4)
    })

    test("step 5's close-up takes a tap on every tile, B3 to F4, each 50.9 px", async ({
      page,
    }) => {
      await page.goto('/learn/02#step-5')
      const canvas = page.locator('#toyNames canvas')
      await expect(page.locator('#stepNow')).toHaveText('5')
      const box = await canvas.boundingBox()
      if (box === null) throw new Error('no canvas')
      const tile = box.width / 7
      expect(tile).toBeGreaterThanOrEqual(44)
      // from F4 back down to B3, so the opening selection (B3) proves nothing by itself
      for (let k = 6; k >= 0; k--) {
        await canvas.click({
          position: { x: tile * (k + 0.5), y: box.height * 0.6 },
        })
        await expect(canvas).toHaveAttribute(
          'aria-valuenow',
          String(59 + k - LO),
        )
      }
    })
  })
})

test("step 5's Sharp, Flat and Show the rare ones wait for the predict and look it; one box says why, then what to do", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/02#step-5')
  await expect(page.locator('#stepNow')).toHaveText('5')
  const stage = page.locator('#toyNames')
  // the step opens on its signature, C sharp and D flat on one key: it has
  // landed before the switch is pressed, or its line would replace the switch's
  const said = stage.locator('[data-tiles-said]')
  await expect(said).toHaveText('One key, two names: C sharp 4 and D flat 4.')
  const rare = stage.locator('[data-rare]')
  const locked = [
    stage.locator('[data-sharp]'),
    stage.locator('[data-flat]'),
    rare,
  ]
  const lock = stage.locator('[data-names-lock]')
  const why = lock.locator('[data-names-locked]')
  const next = lock.locator('[data-names-open]')
  for (const b of locked) await expect(b).toBeDisabled()
  // the switch is dimmed as the two buttons beside it are, and the stage says why
  await expect(rare).toHaveCSS('opacity', '0.42')
  await expect(why).toBeVisible()
  await expect(why).toHaveText(
    'Answer the predict to unlock Sharp, Flat and the rare ones.',
  )
  await expect(next).toBeHidden()
  const tall = (await lock.boundingBox())?.height

  await page.locator('#predictE [data-choice="white"]').click()
  for (const b of locked) await expect(b).toBeEnabled()
  await expect(rare).toHaveCSS('opacity', '1')
  // the line says what to do now, in the same box: nothing under the stage moves
  await expect(why).toBeHidden()
  await expect(next).toBeVisible()
  await expect(next).toHaveText(
    'Unlocked: pick a white tile, then press Sharp or Flat.',
  )
  expect((await lock.boundingBox())?.height).toBe(tall)

  // the switch writes the rare names on the tiles: the figure changes once it has come to rest
  const canvas = stage.locator('canvas')
  let before = await canvas.screenshot()
  await expect
    .poll(async () => {
      const now = await canvas.screenshot()
      const still = now.equals(before)
      before = now
      return still
    })
    .toBe(true)
  await rare.click()
  await expect(rare).toHaveAttribute('aria-pressed', 'true')
  await expect(said).toHaveText(/^The rare names show/)
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false)
})

test('dragging the ruler marker with a real mouse slides the pitch up @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/learn/02#step-6')
  const slider = page.locator('#toyRuler .ruler-slider')
  const note = page.locator('#toyRuler [data-monitor-note]')
  await expect(slider).toHaveAttribute('aria-valuenow', '0')
  // the strip that takes the drag moves onto the ruler's axis once the ruler has drawn
  await expect(slider).toHaveAttribute('style', /left: \d+px/)
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  if (box === null) throw new Error('no slider')
  const x = box.x + box.width / 2

  // the ruler runs from 24 px above the figure's foot (A3) to 24 px below its top (A4)
  await page.mouse.move(x, box.y + box.height - 24)
  await page.mouse.down()
  await page.mouse.move(x, box.y + box.height / 2, { steps: 12 })
  const middle = Number(await slider.getAttribute('aria-valuenow'))
  expect(middle).toBeGreaterThan(550)
  expect(middle).toBeLessThan(650)
  await expect(note).toHaveText(/^(D#4|E4)$/)
  await page.mouse.move(x, box.y + 10, { steps: 12 })
  await page.mouse.up()

  await expect(slider).toHaveAttribute('aria-valuenow', '1200')
  await expect(note).toHaveText('A4')
  await expect(page.locator('#toyRuler [data-ruler-hz]')).toHaveText('440.00Hz')
})

// As for Lesson 1: until the film's MP4s are uploaded (kit/films.ts) the
// page offers nothing to watch, and the masthead is numbered without a gap.
test('offers nothing to watch while the film has no sources @smoke', async ({
  page,
}) => {
  test.skip(
    filmSources(2) !== null,
    "Lesson 2's film has its sources in kit/films.ts: the page shows it",
  )
  await page.goto('/learn/02')
  // the module has run: the explorer opened on this lesson's card
  await expect(page.locator('#exCardHost h3')).toHaveText('Twelve notes')

  await expect(page.locator('#watch')).toBeHidden()
  await expect(page.getByRole('link', { name: /watch/i })).toHaveCount(0)
  await expect(
    page.locator('#mastNav a:visible b').filter({ hasText: /^[IVX]+$/ }),
  ).toHaveText(['I', 'II'])
})
