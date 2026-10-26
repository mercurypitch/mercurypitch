// ============================================================
// Lesson 9 page QA — by keyboard, its targets, its rest, its storage
// ============================================================
//
// WEB-SPEC's end-to-end checks 3, 4, 11 and 12 (Tests), page-wide. One
// keyboard sweep: Tab reaches every control the page shows, from the top;
// free play's rungs play by keyboard and announce their leaps in spoken
// names; Hear it first, Slow and the voice switch toggle `aria-pressed`; no
// live region ever says a sharp or flat sign; and while Step 5's landing
// plays no live region changes at all, so nothing is announced frame by
// frame. Sing it's ladder choice and free play's voice show the button
// pressed, in the kit's pressed ring. At 390 x 844 and at 344 px wide,
// every section's targets, Sing it's in each state a viewer reaches and
// free play's among them, are at least 44 px square, none overlap, and
// nothing scrolls sideways; a take shows none, since nothing changes during
// it. Under reduced motion the page at rest asks for no frame, and a leap
// in free play or Step 5's landing draws whole at once, asking for a frame
// or two, never one a frame. And after a full run, the cold open, the four
// words, every step, a take with a feeling answered, the recall, the quick
// check and free play, storage holds only the keys the Contract names, once
// the microphone has gone and the app's microphone lock with it. The fake
// microphone plays a steady A3 (`writeToneWav(220)`) for the takes.

import type { Locator, Page } from '@playwright/test'
import { prepare, start, status, TAKE_LINE, tap, toSing, } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 150_000 })

/** The Contract's keys: the only ones the page may store. */
const CONTRACT = [
  'fyp-l09-recall-seed',
  'fyp-l09-recall-v1',
  'fyp-l09-seed',
  'fyp-l09-quiz-v1',
  'fyp-done',
  'fyp-voice',
  'fyp-l09-warmup',
  'fyp-motion',
  'fyp-pos',
  'fyp-tour',
]

/**
 * Records every text a live region takes, with when it took it, and
 * counts the frames the page asks for, from before the page's first script.
 */
async function watchPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      said: { at: number; text: string }[]
      frames: number
    }
    w.said = []
    w.frames = 0
    const ask = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => {
      w.frames += 1
      return ask(cb)
    }
    const live = (n: Node | null): Element | null =>
      (n instanceof Element ? n : (n?.parentElement ?? null))?.closest(
        '[aria-live], [role="status"], [role="alert"]',
      ) ?? null
    new MutationObserver((records) => {
      for (const r of records) {
        const region = live(r.target)
        if (region === null) continue
        w.said.push({
          at: performance.now(),
          text: (region.textContent ?? '').replace(/\s+/g, ' ').trim(),
        })
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
}

const said = (page: Page): Promise<{ at: number; text: string }[]> =>
  page.evaluate(
    () => (window as unknown as { said: { at: number; text: string }[] }).said,
  )
const frames = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { frames: number }).frames)
const now = (page: Page): Promise<number> =>
  page.evaluate(() => performance.now())

/** The frames the page asks for over the next second. */
const framesOverASecond = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const w = window as unknown as { frames: number }
        const before = w.frames
        window.setTimeout(() => resolve(w.frames - before), 1000)
      }),
  )

/** Opens Step `n` on the page already open, as a step link does. */
async function goStep(page: Page, n: number): Promise<void> {
  await page.evaluate((step) => {
    window.location.hash = `#step-${step}`
  }, n)
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

interface Box {
  readonly name: string
  /** Its box on the page, px from the document's top left. */
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /**
   * How far a tap lands on it, found as app-check's `hitBox` finds it:
   * `elementFromPoint` in 1 px steps out from its centre, so a link's
   * `::after` counts and anything laid over it does not; 121 at most.
   */
  readonly wide: number
  readonly tall: number
}

/**
 * Every target showing inside `scope`: buttons, inputs and links that are
 * not words inside a line of text, each brought to the screen's middle to
 * be measured.
 */
const targetsIn = (page: Page, scope: string): Promise<Box[]> =>
  page
    .locator(scope)
    .first()
    .evaluate((root) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, input, select, [role="slider"], a[href]',
        ),
      )
        .filter(
          (el) =>
            el.checkVisibility({ visibilityProperty: true }) &&
            !(
              el instanceof HTMLAnchorElement &&
              getComputedStyle(el).display === 'inline'
            ),
        )
        .map((el) => {
          el.scrollIntoView({ block: 'center', behavior: 'instant' })
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const on = (x: number, y: number): boolean => {
            const t = document.elementFromPoint(x, y)
            return t !== null && el.contains(t)
          }
          const reach = (dx: number, dy: number): number => {
            let n = 0
            while (n < 60 && on(cx + dx * (n + 1), cy + dy * (n + 1))) n++
            return n
          }
          const centre = on(cx, cy) ? 1 : 0
          return {
            name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
              .replace(/\s+/g, ' ')
              .trim(),
            x: r.x + window.scrollX,
            y: r.y + window.scrollY,
            w: r.width,
            h: r.height,
            wide: centre === 0 ? 0 : reach(-1, 0) + reach(1, 0) + 1,
            tall: centre === 0 ? 0 : reach(0, -1) + reach(0, 1) + 1,
          }
        }),
    )

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w - 0.5 &&
  b.x < a.x + a.w - 0.5 &&
  a.y < b.y + b.h - 0.5 &&
  b.y < a.y + a.h - 0.5

/** Every target in `scope` a tap box at least 44 px square, none overlapping, and the page no wider than the screen. */
async function expectTargets(
  page: Page,
  scope: string,
  what: string,
): Promise<number> {
  const targets = await targetsIn(page, scope)
  const small = targets
    .filter((t) => t.wide < 44 || t.tall < 44)
    .map((t) => `${t.name}: ${t.wide} x ${t.tall}`)
  const overlapping = targets.flatMap((a, i) =>
    targets
      .slice(i + 1)
      .filter((b) => overlap(a, b))
      .map((b) => `${a.name} / ${b.name}`),
  )
  expect(small, `${what}: under 44 px`).toEqual([])
  expect(overlapping, `${what}: overlapping`).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
    `${what}: sideways scroll`,
  ).toBeLessThanOrEqual(0)
  return targets.length
}

const freePlay = (page: Page): Locator => page.locator('#freePlay')
const freeSaid = (page: Page): Locator =>
  freePlay(page).locator('[data-free-status]')

test('one keyboard sweep: Tab reaches every control, free play plays and names its leaps, its switches toggle, and no live region says a sign or speaks frame by frame', async ({
  page,
}) => {
  // Arrange: sound on from the gate, so no hint says it is off, then
  // every control the page shows, tagged in page order
  await watchPage(page)
  await page.goto('/learn/09')
  await page.locator('#gateBtn').click()
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  const tagged = await page.evaluate(() => {
    const all = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]',
      ),
    ).filter(
      (el) =>
        !(el as HTMLButtonElement).disabled &&
        el.tabIndex >= 0 &&
        el.checkVisibility({ visibilityProperty: true }),
    )
    all.forEach((el, i) => el.setAttribute('data-qa-tab', String(i)))
    return all.length
  })

  // Act: Tab from the top until the focus has been round every control
  const reached = new Set<string>()
  for (let i = 0; i < tagged * 2 + 20 && reached.size < tagged; i++) {
    await page.keyboard.press('Tab')
    const at = await page.evaluate(
      () => document.activeElement?.getAttribute('data-qa-tab') ?? null,
    )
    if (at !== null) reached.add(at)
  }

  // Assert
  expect(tagged).toBeGreaterThan(60)
  expect(
    Array.from({ length: tagged }, (_, i) => String(i)).filter(
      (i) => !reached.has(i),
    ),
  ).toEqual([])

  // Act: free play by keyboard, a rung, then the leap to another
  const rung = (name: string): Locator =>
    freePlay(page).getByRole('button', { name, exact: true })
  await rung('do, D3').focus()
  await page.keyboard.press('Enter')
  await expect(freeSaid(page)).toHaveText('Do, D3')
  await rung('so, A3').focus()
  await page.keyboard.press('Enter')

  // Assert
  await expect(freeSaid(page)).toHaveText(
    'Do to so: a perfect fifth, 7 semitones, up',
  )

  // Act: its switches by keyboard, Space and Enter
  const hear = freePlay(page).getByRole('button', {
    name: 'Free play: Hear it first',
  })
  const slow = freePlay(page).getByRole('button', { name: 'Free play: Slow' })
  const higher = freePlay(page).getByRole('button', { name: 'Higher voice' })
  await hear.focus()
  await page.keyboard.press('Space')
  await slow.focus()
  await page.keyboard.press('Enter')
  await higher.focus()
  await page.keyboard.press('Enter')

  // Assert
  await expect(hear).toHaveAttribute('aria-pressed', 'true')
  await expect(slow).toHaveAttribute('aria-pressed', 'true')
  await expect(higher).toHaveAttribute('aria-pressed', 'true')
  await expect(rung('so, A4')).toBeVisible()

  // Act: Step 5's landing played by keyboard, to its end
  await goStep(page, 5)
  const play = page.locator('#toyLadder [data-ladder-play="landing"]')
  await play.focus()
  const from = await now(page)
  await page.keyboard.press('Enter')
  await expect(play.locator('[data-play-word]')).toHaveText('Pause')
  await expect(play.locator('[data-play-word]')).toHaveText('Play', {
    timeout: 10_000,
  })
  const to = await now(page)

  // Assert: nothing said while it played, and no sign said anywhere
  const all = await said(page)
  expect(all.filter((s) => s.at > from && s.at < to)).toEqual([])
  expect(all.filter((s) => /[♯♭]/u.test(s.text))).toEqual([])
  expect(all.map((s) => s.text)).toContain(
    'Do to so: a perfect fifth, 7 semitones, up',
  )
})

test("Sing it's ladder choice and free play's voice show the button pressed, in the kit's pressed ring", async ({
  page,
}) => {
  // Act
  await toSing(page)

  // Assert: the pressed button ringed and tinted, the other not
  for (const group of [
    prepare(page).locator('.ladder-choice'),
    freePlay(page).locator('.free-voice'),
  ]) {
    const look = (pressed: boolean): Promise<string[]> =>
      group.locator(`.btn[aria-pressed="${pressed}"]`).evaluate((b) => {
        const s = getComputedStyle(b)
        return [s.boxShadow, s.backgroundColor]
      })
    const [on, off] = [await look(true), await look(false)]
    expect(on[0]).toContain('inset')
    expect(off[0]).toBe('none')
    expect(on[1]).not.toBe(off[1])
  }
})

for (const [width, height] of [
  [390, 844],
  [344, 740],
] as const) {
  test.describe(`at ${width} x ${height}`, () => {
    test.use({ viewport: { width, height } })

    test('every section keeps its targets 44 px square, none overlapping, and nothing scrolls sideways', async ({
      page,
    }) => {
      // Arrange: no voice stored, so Sing it shows its voice choice
      await page.goto('/learn/09')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const counted: Record<string, number> = {}
      const check = async (scope: string, what: string): Promise<void> => {
        counted[what] = await expectTargets(page, scope, what)
      }

      // Act and Assert: section by section
      await check('section.hero', 'the cold open')
      await check('#recall', 'the recall')
      await check('#words', 'the four words')
      for (const n of [1, 2, 3, 4, 5]) {
        await goStep(page, n)
        await check('#lesson', `step ${n}`)
      }
      await check('#sing', 'Sing it: the comfort check')
      await page.locator('[data-comfort="sing"]').click()
      await check('#sing', 'Sing it: the voice choice')
      await page.locator('#singCard [data-voice="lower"]').click()
      await check('#sing', 'Sing it: the briefing, the warm-up open')
      await tap(start(page))
      await expect(status(page)).toHaveText(TAKE_LINE, { timeout: 20_000 })
      // nothing changes during a take (Sing it, 5), so it shows no control
      expect(await expectTargets(page, '#sing', 'Sing it: the take')).toBe(0)
      await expect(status(page)).toHaveText('How did that feel?', {
        timeout: 30_000,
      })
      await check('#sing', 'Sing it: the feeling question')
      await page.locator('[data-feel="easy"]').click()
      await check('#sing', 'Sing it: the count and Again')
      await check('#check', 'the quick check')
      await freePlay(page).locator('[data-free-rung="so"]').click()
      await check('#wrap', 'the Wrap and free play')
      await check('#explorer', 'the season map')

      // the listen path, on a fresh visit
      await page.reload()
      await page.locator('[data-comfort="listen"]').click()
      await check('#sing', 'Sing it: just listen')

      expect(
        Object.values(counted).every((n) => n > 0),
        JSON.stringify(counted),
      ).toBe(true)
    })
  })
}

test('under reduced motion the page rests, and a leap or the landing draws whole at once, asking for a frame or two, never one a frame', async ({
  page,
}) => {
  // Arrange
  await watchPage(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/09')
  await freePlay(page).scrollIntoViewIfNeeded()
  await expect.poll(() => framesOverASecond(page), { timeout: 20_000 }).toBe(0)
  await freePlay(page).locator('[data-free-rung="do"]').click()
  await expect(freePlay(page).locator('.is-on')).toHaveCount(0, {
    timeout: 5_000,
  })

  // Act: the leap to so, its two notes, 2.0 s
  const leapFrom = await frames(page)
  await freePlay(page).locator('[data-free-rung="so"]').click()
  await expect(freePlay(page).locator('.is-on')).toHaveCount(1)
  await expect(freePlay(page).locator('.is-on')).toHaveCount(0, {
    timeout: 5_000,
  })
  const leapFrames = (await frames(page)) - leapFrom

  // Act: Step 5's landing, 3.0 s
  await goStep(page, 5)
  const play = page.locator('#toyLadder [data-ladder-play="landing"]')
  await play.scrollIntoViewIfNeeded()
  await expect.poll(() => framesOverASecond(page), { timeout: 20_000 }).toBe(0)
  const landingFrom = await frames(page)
  await play.click()
  await expect(play.locator('[data-play-word]')).toHaveText('Play', {
    timeout: 10_000,
  })
  const landingFrames = (await frames(page)) - landingFrom

  // Assert: a frame per change, never one a frame, and the page at rest after
  expect(leapFrames).toBeLessThan(12)
  expect(landingFrames).toBeLessThan(12)
  await expect.poll(() => framesOverASecond(page), { timeout: 20_000 }).toBe(0)
})

test('after a full run, storage holds only the keys the Contract names', async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/09')
  await page.locator('#gateBtn').click()

  // Act: the cold open, a choice and Merc's leap
  await page.locator('#predict [data-choice="mi"]').click()
  await page.locator('#heroPlay').click()
  // the four words
  for (const w of ['leap', 'third', 'arpeggio', 'zone'])
    await page.locator(`[data-word-play="${w}"]`).click()
  // every step, with Slow and its main play
  for (const [n, id] of [
    [1, 'step'],
    [2, 'hear'],
    [3, 'climb'],
    [4, 'five'],
    [5, 'landing'],
  ] as const) {
    await goStep(page, n)
    await page.locator(`#toyLadder [data-ladder-play="${id}"]`).click()
  }
  await page.locator('#toyLadder [data-ladder-slow]').click()
  // Sing it: the voice chosen, a take, and how it felt
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('#singCard [data-voice="lower"]').click()
  await tap(start(page))
  await expect(status(page)).toHaveText('How did that feel?', {
    timeout: 50_000,
  })
  await page.locator('[data-feel="workable"]').click()
  // the recall and the quick check
  const answer = (quiz: string, option: string): Promise<void> =>
    page
      .locator(quiz)
      .getByRole('button', { name: option, exact: true })
      .click()
  await answer('#rc-qs', '7 semitones: a perfect fifth')
  await answer('#rc-qs', 'A leap')
  await answer('#qs', "They're right: a leap is too quick to aim")
  await answer('#qs', 'A major third, then a minor third: 4 and 3')
  await answer('#qs', 'The minor and major thirds')
  await answer('#qs', "Listen, then slide up into so's band")
  // free play, its switches and its voice
  for (const r of ['do', 'so', 'top'])
    await freePlay(page).locator(`[data-free-rung="${r}"]`).click()
  await freePlay(page).locator('[data-free-hear]').click()
  await freePlay(page).locator('[data-free-voice="higher"]').click()
  // the masthead's Pause animations
  await page.locator('#motionSwitch').click()

  // the microphone let go: while it is held, and for the manager's linger
  // after, the app's one-tab microphone lock keeps a record
  // (src/lib/mic-lock.ts), which goes with it
  await expect
    .poll(
      () =>
        page.evaluate(() => localStorage.getItem('mercurypitch_mic_holder')),
      { timeout: 10_000 },
    )
    .toBeNull()

  // Assert
  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
  }))
  expect(stored.local.filter((k) => !CONTRACT.includes(k))).toEqual([])
  expect(stored.session).toEqual([])
  expect(stored.local).toEqual(
    expect.arrayContaining([
      'fyp-done',
      'fyp-voice',
      'fyp-l09-seed',
      'fyp-l09-quiz-v1',
      'fyp-l09-recall-seed',
      'fyp-l09-recall-v1',
      'fyp-motion',
    ]),
  )
  expect(await page.evaluate(() => localStorage.getItem('fyp-voice'))).toBe(
    '"lower"',
  )
})
