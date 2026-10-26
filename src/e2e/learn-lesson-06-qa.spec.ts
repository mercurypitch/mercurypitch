// ============================================================
// Lesson 6 page QA — the tune line by keyboard, the games, and the layouts
// ============================================================
//
// WEB-SPEC's end-to-end checks 3, 4 and 9 and its page QA (Contract), with
// reduced motion emulated so every move lands at once and a key press meets
// the state it changed: Tab enters Step 2's line once, a grid whose arrows,
// Home and End reach every bead and gap, each named in spoken names, and Tab
// comes back to the button last focused; the start slider moves by keys
// alone and the words follow it; the names switch and Swap sizes toggle and
// say so; Step 4's predict waits for both versions, and holds Swap sizes,
// the mix-up card, the Try and the Notice until then; Step 5's brackets and
// anchor board play; the two games answer by keys, and Space replays only
// off a button. At 390 x 844, 375 and 360 px wide, every step's stage fits
// with every target at least 44 px square and none overlapping, free play
// at every start from C4 to B4; at 390 and 360 px the hero's compact line,
// which has no buttons, draws all seven notes from C and from F sharp, and
// the cold open's sharp sign stays beside its F, in Play from F sharp and
// in every lock hint; at 320 px the start slider, Step 3's and free play's,
// holds its words at every start between two arrow buttons that keep their
// names, and from 360 px the buttons show their words again; at 1024 x 640
// the stage fits the screen under the masthead. A window narrowed from 1280
// px to 320, or a phone turned from landscape to portrait, lays every tune
// line's buttons out again, on screen and off, with nothing past the
// window's edge, and Step 3 keeps its start, names, Slow and the line it is
// playing, and the cold open its answer. Two real-mouse drags of the line
// close it: a drag slides the start and must not land as a tap, and a drag
// let go off the line leaves Enter and Space pressing a bead.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** The steps' tune line, and its parts. */
const TOY = '#toyTune'
const slider = (page: Page, root = TOY): Locator =>
  page.locator(`${root} [data-start-slider]`)
const said = (page: Page): Locator => page.locator(`${TOY} [data-tune-said]`)
const bead = (page: Page, g: number): Locator =>
  page.locator(`${TOY} [data-note="${g}"]`)

async function openStep(page: Page, step: number): Promise<void> {
  await page.goto(`/learn/06#step-${step}`)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Moves the deck on the page already open, as a step link does. */
async function goStep(page: Page, step: number): Promise<void> {
  await page.evaluate((n) => {
    window.location.hash = `#step-${n}`
  }, step)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Slides a tune line to `midi` (C4 60 to B4 71) by keyboard. */
async function startOn(page: Page, midi: number, root = TOY): Promise<void> {
  await slider(page, root).focus()
  await page.keyboard.press('Home')
  for (let m = 60; m < midi; m++) await page.keyboard.press('ArrowUp')
  await expect(slider(page, root)).toHaveAttribute(
    'aria-valuenow',
    String(midi),
  )
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

/** Every target over a tune line: at least 44 px square, and no two overlapping. */
async function expectTargets(root: Locator, what: string): Promise<void> {
  const targets = await boxesOf(root.locator('.tune-hit:visible'))
  expect(targets.length, what).toBeGreaterThan(0)
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
  page.evaluate(() => document.documentElement.scrollWidth)

/** How far a start slider's words run past its pill, px: 0 when they fit inside it. */
const wordsPast = (row: Locator): Promise<number> =>
  row.evaluate((el) => {
    const box = (part: string): DOMRect => {
      const found = el.querySelector(part)
      if (found === null) throw new Error(`the slide row has no ${part}`)
      return found.getBoundingClientRect()
    }
    const words = box('[data-start-value]')
    const pill = box('[data-start-slider]')
    return Math.max(0, words.right - pill.right, pill.left - words.left)
  })

/** Every shown button of a tune line that is not wholly inside its line's layer, which covers the drawing. */
const strays = (page: Page, root: string): Promise<string[]> =>
  page.locator(`${root} [data-tune-hits]`).evaluate((layer) => {
    const f = layer.getBoundingClientRect()
    return Array.from(layer.querySelectorAll<HTMLElement>('.tune-hit'))
      .filter((b) => b.getClientRects().length > 0)
      .filter((b) => {
        const r = b.getBoundingClientRect()
        return (
          r.left < f.left - 0.5 ||
          r.right > f.right + 0.5 ||
          r.top < f.top - 0.5 ||
          r.bottom > f.bottom + 0.5
        )
      })
      .map((b) => b.getAttribute('aria-label') ?? '')
  })

interface Drawn {
  /** The canvas's width, px. */
  readonly width: number
  /** Each bead's left and right edge, px, left to right. */
  readonly beads: readonly { readonly from: number; readonly to: number }[]
}

/**
 * The hero's compact line as its canvas draws it. Its beads are not
 * buttons, so the pixels are the only record of where each one lands: a
 * bead is filled at 82 % (kit/tune-line-draw.ts), and the rows and the
 * line through the beads are fainter, so every run of columns holding a
 * near-solid pixel is one bead.
 */
function heroBeads(page: Page): Promise<Drawn> {
  return page.locator('#heroTune canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const { width, height } = canvas
    const data = canvas.getContext('2d')?.getImageData(0, 0, width, height).data
    const beads: { from: number; to: number }[] = []
    if (data === undefined) return { width, beads }
    let from = -1
    for (let x = 0; x <= width; x++) {
      let solid = false
      for (let y = 0; x < width && y < height && !solid; y++)
        solid = data[(y * width + x) * 4 + 3] > 190
      if (solid && from < 0) from = x
      if (!solid && from >= 0) {
        beads.push({ from, to: x })
        from = -1
      }
    }
    return { width, beads }
  })
}

/** All seven of the hero line's notes drawn, the last ending inside the line. */
async function expectWholeLine(page: Page, when: string): Promise<void> {
  await page.locator('#heroTune').scrollIntoViewIfNeeded()
  // a lit bead's glow joins it to its neighbours: wait for the light to go
  await expect
    .poll(async () => (await heroBeads(page)).beads.length, {
      message: `${when}: seven beads drawn`,
      timeout: 5_000,
    })
    .toBe(7)
  const { width, beads } = await heroBeads(page)
  expect(beads[0].from, `${when}: the first bead`).toBeGreaterThan(0)
  expect(
    beads[6].to,
    `${when}: the last bead ends inside the line`,
  ).toBeLessThan(width)
}

/**
 * Every ♯ and ♭ in an element sits on its letter's line, touching it: the
 * letter is the last character of the text just before the sign's span. A
 * flex row's gap between the two shows as space between them, and a wrap
 * as a different line.
 */
async function expectSignsOnTheirLines(
  loc: Locator,
  when: string,
): Promise<void> {
  const found = await loc.evaluate((el) => {
    const apart: string[] = []
    let signs = 0
    for (const sign of Array.from(
      el.querySelectorAll('span[aria-hidden="true"]'),
    )) {
      if (!/^[♯♭]$/.test(sign.textContent ?? '')) continue
      signs++
      const before = sign.previousSibling
      const text = before?.nodeType === Node.TEXT_NODE ? before.textContent : ''
      if (before === null || text === null || text === '') {
        apart.push(`${sign.textContent}: no letter just before it`)
        continue
      }
      const range = document.createRange()
      range.setStart(before, text.length - 1)
      range.setEnd(before, text.length)
      const l = range.getBoundingClientRect()
      const s = sign.getBoundingClientRect()
      if (Math.abs(l.top - s.top) > 2 || Math.abs(s.left - l.right) > 1)
        apart.push(
          `${text.slice(-1)} ends at ${Math.round(l.right)}, ${Math.round(l.top)}; ` +
            `${sign.textContent} starts at ${Math.round(s.left)}, ${Math.round(s.top)}`,
        )
    }
    return { signs, apart }
  })
  expect(found.signs, `${when}: a sign to check`).toBeGreaterThan(0)
  expect(found.apart, `${when}: every sign beside its letter`).toEqual([])
}

test.describe('page QA (WEB-SPEC, Tests and Contract)', () => {
  // every move lands at once, so a key press meets the state it changed
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('Tab walks Play, Slow, then one stop into the line, a grid whose arrows reach every bead and gap, each named, with a visible focus ring', async ({
    page,
  }) => {
    await openStep(page, 2)
    const notes = [
      'C 4, twin',
      'C 4, kle',
      'G 4, twin',
      'G 4, kle',
      'A 4, lit',
      'A 4, tle',
      'G 4, star',
      'F 4, How',
      'F 4, I',
      'E 4, won',
      'E 4, der',
      'D 4, what',
      'D 4, you',
      'C 4, are',
    ].map((n, g) => `Note ${g + 1} of 14, ${n}`)
    // each gap's name starts with what it draws: its size over its word
    const gaps = [
      ['0, same', 'the same note again'],
      ['7, leap', 'up 7 semitones'],
      ['0, same', 'the same note again'],
      ['2, step', 'up 2 semitones'],
      ['0, same', 'the same note again'],
      ['\u22122, step', 'down 2 semitones'],
      ['\u22122, step', 'down 2 semitones'],
      ['0, same', 'the same note again'],
      ['\u22121, step', 'down 1 semitone'],
      ['0, same', 'the same note again'],
      ['\u22122, step', 'down 2 semitones'],
      ['0, same', 'the same note again'],
      ['\u22122, step', 'down 2 semitones'],
    ].map(([drawn, n], g) => `${drawn}: gap ${g + 1}, ${n}`)

    const grid = page.locator(`${TOY} [data-tune-hits]`)
    const focused = (): Promise<string> =>
      page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') ?? '',
      )

    // Act: Tab from Play, then a walk of the grid, row by row
    await page.locator(`${TOY} [data-tune-play]`).focus()
    await page.keyboard.press('Tab')
    await expect(page.locator(`${TOY} [data-tune-slow]`)).toBeFocused()
    await page.keyboard.press('Tab')
    const first = await focused()
    const met: string[] = []
    for (let row = 0; row < 4; row++) {
      if (row > 0) await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Home')
      met.push(await focused())
      // Right walks the row, and stays on its last
      for (;;) {
        await page.keyboard.press('ArrowRight')
        const name = await focused()
        if (name === met.at(-1)) break
        met.push(name)
      }
    }

    // Assert: one Tab stop, on the first bead; four rows, each line's
    // beads and then its gaps, every button named as before
    expect(first).toBe(notes[0])
    await expect(grid).toHaveAttribute('role', 'grid')
    await expect(grid.locator('[role="row"]')).toHaveCount(4)
    await expect(grid.locator('[role="gridcell"] > button')).toHaveCount(27)
    await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1)
    expect(met).toEqual([
      ...notes.slice(0, 7),
      ...gaps.slice(0, 7),
      ...notes.slice(7),
      ...gaps.slice(7),
    ])
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element)
      return `${s.outlineStyle} ${s.outlineWidth}`
    })
    expect(ring).toBe('solid 2px')
  })

  test("Step 2's grid: the arrows move by rows and columns, Home and End to a row's ends, and Tab returns to the button last focused", async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 2)
    const grid = page.locator(`${TOY} [data-tune-hits]`)
    const focused = (): Promise<string> =>
      page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') ?? '',
      )
    await page.locator(`${TOY} [data-tune-slow]`).focus()
    await page.keyboard.press('Tab')
    await expect(page.locator(`${TOY} [data-note="0"]`)).toBeFocused()

    // Act and Assert: End, then down the last column to the shorter row
    await page.keyboard.press('End')
    expect(await focused()).toBe('Note 7 of 14, G 4, star')
    await page.keyboard.press('ArrowDown')
    expect(await focused()).toBe('\u22122, step: gap 7, down 2 semitones')
    await page.keyboard.press('ArrowDown')
    expect(await focused()).toBe('Note 14 of 14, C 4, are')
    await page.keyboard.press('ArrowDown')
    expect(await focused()).toBe('\u22122, step: gap 13, down 2 semitones')
    // the last row has nowhere below, and Home and End stay in it
    await page.keyboard.press('ArrowDown')
    expect(await focused()).toBe('\u22122, step: gap 13, down 2 semitones')
    await page.keyboard.press('Home')
    expect(await focused()).toBe('0, same: gap 8, the same note again')
    await page.keyboard.press('ArrowLeft')
    expect(await focused()).toBe('0, same: gap 8, the same note again')
    await page.keyboard.press('ArrowUp')
    expect(await focused()).toBe('Note 8 of 14, F 4, How')
    await page.keyboard.press('Control+End')
    expect(await focused()).toBe('\u22122, step: gap 13, down 2 semitones')
    await page.keyboard.press('Control+Home')
    expect(await focused()).toBe('Note 1 of 14, C 4, twin')
    await page.keyboard.press('ArrowUp')
    expect(await focused()).toBe('Note 1 of 14, C 4, twin')

    // Act: on to a gap, out of the grid by Tab, and back by Shift+Tab
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    const gap = page.locator(`${TOY} [data-gap="1"]`)
    await expect(gap).toBeFocused()
    await page.keyboard.press('Tab')
    const inside = await grid.evaluate((el) =>
      el.contains(document.activeElement),
    )
    await page.keyboard.press('Shift+Tab')

    // Assert: the grid is one Tab stop, and it keeps the button last focused
    expect(inside).toBe(false)
    await expect(gap).toBeFocused()
    await expect(gap).toHaveAttribute('tabindex', '0')
    await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1)

    // Act: Enter and Space press the focused gap, as before
    await gap.evaluate((b) => {
      const w = window as unknown as { gapPresses: number }
      w.gapPresses = 0
      b.addEventListener('click', () => {
        w.gapPresses += 1
      })
    })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')

    // Assert
    expect(
      await page.evaluate(
        () => (window as unknown as { gapPresses: number }).gapPresses,
      ),
    ).toBe(2)
    await expect(gap).toBeFocused()
  })

  test('the start slider moves by keys alone, and the words follow it in spoken names', async ({
    page,
  }) => {
    await openStep(page, 3)
    const s = slider(page)
    await s.focus()
    await expect(s).toHaveAttribute('role', 'slider')

    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
    await expect(s).toHaveAttribute('aria-valuenow', '62')
    await expect(s).toHaveAttribute(
      'aria-valuetext',
      'Starts on D 4: every interval the same',
    )
    await expect(said(page)).toHaveText(
      'Twinkle from D 4: do do so so la la so',
    )
    await expect(page.locator(`${TOY} [data-tune-summary]`)).toHaveText(
      'Twinkle from D 4: D, D, A, A, B, B, A. Same, up 7, same, up 2, same, down 2.',
    )
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowDown')
    await expect(s).toHaveAttribute(
      'aria-valuetext',
      'Starts on B flat 4: every interval the same',
    )
    // the gaps read the same from B flat; the letters follow its key
    await expect(page.locator(`${TOY} [data-tune-summary]`)).toHaveText(
      'Twinkle from B flat 4: B flat, B flat, F, F, G, G, F. Same, up 7, same, up 2, same, down 2.',
    )
    await page.keyboard.press('End')
    await expect(page.locator(`${TOY} [data-slide="1"]`)).toBeDisabled()
    await page.keyboard.press('Home')
    await expect(s).toHaveAttribute('aria-valuenow', '60')
    await expect(page.locator(`${TOY} [data-slide="-1"]`)).toBeDisabled()
    await expect(s).toBeFocused()
  })

  test('the names switch shows do-re-mi in the letters’ place, by keyboard', async ({
    page,
  }) => {
    await openStep(page, 3)
    const solfege = page.locator(`${TOY} [data-names="solfege"]`)

    await solfege.focus()
    await page.keyboard.press('Enter')

    await expect(solfege).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`${TOY} [data-names="letters"]`)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(bead(page, 2)).toHaveAttribute(
      'aria-label',
      'Note 3 of 7, so, G 4',
    )
  })

  test('Swap sizes toggles, and says what it changed', async ({ page }) => {
    await openStep(page, 4)
    const swap = page.locator(`${TOY} [data-tune-swap]`)
    // it plays the predict's answer, so it waits for a guess
    await page.locator('#predictSwap [data-choice="changes"]').click()

    await swap.focus()
    await page.keyboard.press('Space')
    await expect(swap).toHaveAttribute('aria-pressed', 'true')
    await expect(said(page)).toHaveText(
      'Swapped: up 2, then up 7. Same ups and downs, two intervals changed.',
    )
    await page.keyboard.press('Space')

    await expect(swap).toHaveAttribute('aria-pressed', 'false')
    await expect(said(page)).toHaveText('The tune as it was: up 7, then up 2.')
  })

  test("Step 4's predict reveals only once both versions are heard", async ({
    page,
  }) => {
    await openStep(page, 4)
    const predict = page.locator('#predictSwap')
    const reveal = predict.locator('.reveal')

    await predict.locator('[data-choice="changes"]').click()
    await predict.locator('[data-play="line"]').click()
    await expect(predict.locator('.lock-hint')).toHaveText(
      'Now play the other one.',
      { timeout: 15_000 },
    )
    await expect(reveal).toBeHidden()
    await predict.locator('[data-play="swapped"]').click()

    await expect(reveal).toBeVisible({ timeout: 15_000 })
    await expect(reveal.locator('.mono')).toHaveText('You said: no, it changes')
  })

  test("Step 4's predict locks Swap sizes, and keeps back all that answers it until the reveal", async ({
    page,
  }) => {
    await openStep(page, 4)
    const predict = page.locator('#predictSwap')
    const swap = page.locator(`${TOY} [data-tune-swap]`)
    // the mix-up card, the Try and the Notice
    const answers = page.locator('#step-4').locator('.mixup, .try, .notice')
    const allHidden = async (): Promise<void> => {
      for (const a of await answers.all()) await expect(a).toBeHidden()
    }
    await expect(answers).toHaveCount(3)

    // Before a guess: Swap sizes shows, locked, and nothing answers
    await expect(swap).toBeVisible()
    await expect(swap).toBeDisabled()
    await allHidden()

    // A guess unlocks Swap sizes, and still nothing answers
    await predict.locator('[data-choice="same"]').click()
    await expect(swap).toBeEnabled()
    await allHidden()
    await predict.locator('[data-play="line"]').click()
    await expect(predict.locator('.lock-hint')).toHaveText(
      'Now play the other one.',
      { timeout: 15_000 },
    )
    await allHidden()

    // Both versions heard: the reveal, then the rest
    await predict.locator('[data-play="swapped"]').click()
    await expect(predict.locator('.reveal')).toBeVisible({ timeout: 15_000 })
    for (const a of await answers.all()) await expect(a).toBeVisible()
    await expect(predict.locator('.reveal .mono')).toHaveText(
      'You said: yes, most notes are the same',
    )
  })

  test("Step 5 names its brackets in words, and its board's five rows each play", async ({
    page,
  }) => {
    await openStep(page, 5)
    const brackets = await page
      .locator(`${TOY} [data-bracket]`)
      .evaluateAll((els) => els.map((b) => b.getAttribute('aria-label')))
    expect(brackets).toEqual([
      'P5, 7 semitones: play C 4 up to G 4, a perfect fifth',
      'M2, 2 semitones: play A 4 down to G 4, a major second',
      'm2, 1 semitone: play F 4 down to E 4, a minor second',
    ])

    const rows = page.locator('#anchorBoard [data-anchor]')
    await expect(rows).toHaveCount(5)
    expect(
      await rows.evaluateAll((els) =>
        els.map((r) => (r as HTMLElement).dataset.anchor),
      ),
    ).toEqual(['m2', 'M2', 'P4', 'P5', 'P8'])
    const fifth = page.locator('#anchorBoard [data-anchor="P5"]')
    await fifth.locator('[data-anchor-play="interval"]').click()
    await expect(fifth).toHaveClass(/\bis-on\b/)
    await expect(fifth).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
  })

  for (const [step, id, rounds, keys, more] of [
    [2, '#stepLeapGame', 10, ['1', '2'], 'Play ten more'],
    [5, '#nameItGame', 8, ['1', '2', '3', '4'], 'Play eight more'],
  ] as const) {
    test(`${id}: keys answer ${rounds} rounds, a round once each, and the end reads "N of ${rounds}"`, async ({
      page,
    }) => {
      await openStep(page, step)
      const game = page.locator(id)
      const play = game.locator('[data-eg-play]')

      for (let r = 1; r <= rounds; r++) {
        await play.click()
        await expect(game.locator('[data-eg-round]')).toHaveText(
          `Round ${r} of ${rounds}`,
        )
        await page.keyboard.press(keys[r % keys.length])
        await expect(game.locator('[data-eg-feedback]')).toHaveText(
          /^(Yes\.|Here it is again, slower\.) /,
        )
        // a missed round is not asked again: the button moves on. A string,
        // not a pattern, because the button's markup puts whitespace around
        // its label and only a string expectation normalises it
        await expect(play).toHaveText(r < rounds ? 'Next round' : more)
      }

      await expect(game.locator('[data-eg-round]')).toHaveText(
        new RegExp(`^\\d+ of ${rounds}$`),
      )
      await expect(game.locator('[data-eg-feedback] b')).toHaveText(
        new RegExp(`^\\d+ of ${rounds}$`),
      )
    })
  }

  test('Space replays the pair on the card, and presses a focused button instead', async ({
    page,
  }) => {
    await openStep(page, 2)
    const game = page.locator('#stepLeapGame')
    const play = game.locator('[data-eg-play]')
    await play.click()
    await expect(play).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })

    await game.focus()
    await page.keyboard.press('Space')
    await expect(play).toHaveClass(/\bis-on\b/)
    await expect(game.locator('[data-eg-feedback]')).toHaveText('')

    await game.locator('[data-eg-answer="leap"]').focus()
    await page.keyboard.press('Space')
    await expect(game.locator('[data-eg-answer="leap"]')).toHaveClass(
      /\bpicked\b/,
    )
    await expect(game.locator('[data-eg-feedback]')).not.toHaveText('')
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
        expect(await sideways(page)).toBe(390)
        const controls = await boxesOf(card.locator('button:visible'))
        expect(controls.length).toBeGreaterThan(7)
        for (const c of controls) {
          expect(c.w, c.name).toBeGreaterThanOrEqual(44)
          expect(c.h, c.name).toBeGreaterThanOrEqual(44)
        }
        await expectTargets(page.locator(TOY), `step ${step}`)
      })
    }

    test('free play fits every bead, gap and bracket, none overlapping, at every start from C4 to B4', async ({
      page,
    }) => {
      await page.goto('/learn/06#freePlay')
      const free = page.locator('#freePlay')
      for (let start = 60; start <= 71; start++) {
        await startOn(page, start, '#freePlay')
        await expectTargets(free, `free play from ${start}`)
      }
      expect(await sideways(page)).toBe(390)
    })
  })

  // the hero's compact line has no buttons, so it keeps no 44 px column and fits a phone
  for (const width of [360, 390]) {
    test(`at ${width} px the hero's line shows all seven notes, from C and from F sharp`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/learn/06')
      await expectWholeLine(page, 'from C')

      const fromFs = page.locator('#predict [data-play="fs"]')
      await page.locator('#predict [data-choice="gaps"]').click()
      await fromFs.click()
      await expect(page.locator('#heroTune [data-hero-said]')).toHaveText(
        'Twinkle from F sharp',
      )
      await expect(fromFs).not.toHaveClass(/\bis-on\b/, { timeout: 15_000 })

      await expectWholeLine(page, 'from F sharp')
      expect(await sideways(page)).toBe(width)
    })

    // the button's and the hint's words are each one span, so no flex gap parts the F from its sign
    test(`at ${width} px the cold open's ♯ stays on its letter's line, in the button and in every hint`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/learn/06')
      const fromFs = page.locator('#predict [data-play="fs"]')
      const hint = page.locator('#predict .lock-hint')
      await expectSignsOnTheirLines(fromFs, 'Play from F sharp')
      await expectSignsOnTheirLines(hint, 'the lock hint')

      await page.locator('#predict [data-choice="notes"]').click()
      await expect(hint).toContainText('Locked in.')
      await expectSignsOnTheirLines(hint, 'the hint after a guess')

      // the switch turns sound on from unset, then off
      await page.locator('#soundSwitch').click()
      await page.locator('#soundSwitch').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      await fromFs.click()
      await expect(hint).toContainText('Sound is off, so nothing played.', {
        timeout: 15_000,
      })
      await expectSignsOnTheirLines(hint, 'the hint with sound off')
    })
  }

  test.describe('at 320 px', () => {
    test.use({ viewport: { width: 320, height: 800 } })

    for (const [where, root, at] of [
      ['free play', '#freePlay', '/learn/06#freePlay'],
      ['Step 3', TOY, '/learn/06#step-3'],
    ] as const) {
      test(`${where}'s start slider holds its words at every start from C4 to B4, between two 44 px arrows that keep their names`, async ({
        page,
      }) => {
        // Arrange
        await page.goto(at)
        const row = page.locator(`${root} [data-slide-row]`)
        const past: string[] = []

        // Act: every start, the widest words (D♭4) among them
        for (let start = 60; start <= 71; start++) {
          await startOn(page, start, root)
          const by = await wordsPast(row)
          if (by > 0.5) past.push(`${start}: ${by.toFixed(1)} px`)
        }

        // Assert
        expect(past).toEqual([])
        for (const name of ['Start lower', 'Start higher']) {
          const box = await row.getByRole('button', { name }).boundingBox()
          expect(box?.width, name).toBe(44)
          expect(box?.height, name).toBeGreaterThanOrEqual(44)
        }
        expect(await sideways(page)).toBe(320)
      })
    }
  })

  // from 360 px the buttons show their words again, as they always did
  for (const width of [360, 390]) {
    test(`at ${width} px the start slider's buttons show their words`, async ({
      page,
    }) => {
      // Arrange + Act
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/learn/06#freePlay')

      // Assert
      const row = page.locator('#freePlay [data-slide-row]')
      await expect(row.getByText('Start lower')).toBeVisible()
      await expect(row.getByText('Start higher')).toBeVisible()
    })
  }

  for (const width of [360, 375]) {
    test(`at ${width} px wide nothing scrolls sideways, and every target keeps 44 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await openStep(page, 2)
      await expectTargets(page.locator(TOY), `step 2 at ${width}`)
      await goStep(page, 5)
      await expectTargets(page.locator(TOY), `step 5 at ${width}`)
      expect(await sideways(page)).toBe(width)
    })
  }

  // A window that narrows, or a phone that turns: every tune line lays its
  // buttons out again at the new width, the one off screen as well, and the
  // step keeps all it holds. Free play's buttons, laid out at 1280 px and
  // left there, scrolled a 320 px window 873 px sideways.
  for (const [from, to] of [
    [
      { width: 1280, height: 800 },
      { width: 320, height: 800 },
    ],
    [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ],
  ] as const) {
    test(`from ${from.width} x ${from.height} to ${to.width} x ${to.height}, every bead and gap stays on its line, and the step keeps its state`, async ({
      page,
    }) => {
      // Arrange: Step 3 from E4, in do-re-mi, slow, the line playing, and the cold open answered
      await page.setViewportSize(from)
      await openStep(page, 3)
      await page.locator('#predict [data-choice="gaps"]').click()
      await startOn(page, 64)
      await page.locator(`${TOY} [data-names="solfege"]`).click()
      await page.locator(`${TOY} [data-tune-slow]`).click()
      const readout = page.locator(`${TOY} [data-tune-readout]`)
      const before = await readout.textContent()
      const play = page.locator(`${TOY} [data-tune-play]`)
      await play.click()
      await expect(play).toHaveClass(/\bis-on\b/)

      // Act
      await page.setViewportSize(to)

      // Assert: nothing past the window's edge, and every button on its own line
      await expect.poll(() => sideways(page)).toBe(to.width)
      for (const root of [TOY, '#freePlay'])
        expect(await strays(page, root), root).toEqual([])
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '64')
      await expect(
        page.locator(`${TOY} [data-names="solfege"]`),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator(`${TOY} [data-tune-slow]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(readout).toHaveText(before ?? '')
      await expect(play).toHaveClass(/\bis-on\b/)
      await expect(
        page.locator('#predict [data-choice="gaps"]'),
      ).toHaveAttribute('aria-pressed', 'true')
    })
  }

  // the polish audit's landscape budget: an iPad in Safari with its tab bar
  test.describe('at 1024 x 640, an iPad in Safari with its tab bar', () => {
    test.use({ viewport: { width: 1024, height: 640 }, hasTouch: true })

    test("every step's stage fits the screen under the masthead, every control on it", async ({
      page,
    }) => {
      await openStep(page, 1)
      for (const step of [1, 2, 3, 4, 5]) {
        await goStep(page, step)
        const card = await page.locator('#stepsStage .stage-card').boundingBox()
        const fig = await page.locator(`${TOY} .tune-viz`).boundingBox()
        // 640 less the 58 px masthead and the stage's margins
        expect(card?.height ?? 0, `step ${step}`).toBeLessThanOrEqual(564)
        // what the stage holds besides its figure (WEB-SPEC, Layout)
        expect(
          (card?.height ?? 0) - (fig?.height ?? 0),
          `step ${step}: the chrome`,
        ).toBeLessThanOrEqual(375)
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
})

test('dragging the line with a real mouse slides its start, and the drag presses no bead @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openStep(page, 3)
  const viz = page.locator(`${TOY} .tune-viz`)
  await viz.scrollIntoViewIfNeeded()
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '60')
  // count the presses every bead button takes
  await page.evaluate(() => {
    const w = window as unknown as { beadPresses: number }
    w.beadPresses = 0
    for (const b of document.querySelectorAll('#toyTune [data-note]'))
      b.addEventListener('click', () => {
        w.beadPresses += 1
      })
  })
  const presses = (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { beadPresses: number }).beadPresses,
    )
  const box = await bead(page, 3).boundingBox()
  if (box === null) throw new Error('no bead')
  // grab the fourth bead's column, and drag up a little over half the figure
  const x = box.x + box.width / 2
  const y = box.y + box.height * 0.75

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - box.height / 2, { steps: 12 })
  await page.mouse.up()

  const now = Number(await slider(page).getAttribute('aria-valuenow'))
  expect(now).toBeGreaterThan(60)
  expect(await presses()).toBe(0)
  // a plain click on a bead is a press, and moves nothing
  await bead(page, 3).click()
  expect(await presses()).toBe(1)
  await expect(slider(page)).toHaveAttribute('aria-valuenow', String(now))
})

test('a real-mouse drag let go off the line leaves Enter and Space pressing a bead @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openStep(page, 1)
  await page.locator(`${TOY} .tune-viz`).scrollIntoViewIfNeeded()
  // count the presses every bead button takes
  await page.evaluate(() => {
    const w = window as unknown as { beadPresses: number }
    w.beadPresses = 0
    for (const b of document.querySelectorAll('#toyTune [data-note]'))
      b.addEventListener('click', () => {
        w.beadPresses += 1
      })
  })
  const presses = (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { beadPresses: number }).beadPresses,
    )
  const box = await bead(page, 3).boundingBox()
  const line = await page.locator(`${TOY} [data-tune-hits]`).boundingBox()
  if (box === null || line === null) throw new Error('no bead')
  const x = box.x + box.width / 2

  // grab the fourth bead, drag it up off the line, and let go above it:
  // Step 1 slides nothing, so the line never holds the pointer
  await page.mouse.move(x, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, line.y - 24, { steps: 8 })
  await page.mouse.up()
  expect(await presses()).toBe(0)

  // every key press on a bead is a press of it
  await bead(page, 3).focus()
  await page.keyboard.press('Enter')
  expect(await presses()).toBe(1)
  await page.keyboard.press('Space')
  expect(await presses()).toBe(2)
})
