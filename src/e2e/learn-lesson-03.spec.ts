// ============================================================
// Lesson 3 loads at /learn/03 as its own document, and its checkpoint listens
// ============================================================
//
// A draft until the vocal coach signs it off: the e2e bundle shows drafts
// (`build:e2e` sets VITE_DRAFT_LESSONS=1), the production build leaves the
// document out (scripts/assert-draft-lessons.mjs). Like Lesson 1 it must load
// as itself, never as the 404 page or the studio's cached app shell, and its
// module must boot.
//
// Sing it runs on Chromium's fake microphone, a steady A3 (220 Hz) looped
// from a file (helpers/tone-wav.ts). Against the lower voice's notes that is
// right on A3, two semitones above G3 and two below B3; against the higher
// voice it is A4 an octave lower, and two semitones from G4. The checks are
// WEB-SPEC's (Toys 7, Tests): the lines each take earns, the three-try
// limit, what each answer to "How did that feel?" still shows and offers,
// the Wrap's practise card it picks, and that listening only never asks for
// the microphone.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TITLE = 'Match a note: Find Your Pitch, Lesson 3 | MercuryPitch'
const TONE_WAV = writeToneWav(220)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

/** Opens Sing it with a voice already chosen (Step 4's `fyp-voice`), past the comfort check. */
async function startSinging(
  page: Page,
  voice: 'lower' | 'higher',
): Promise<void> {
  await page.addInitScript((v) => {
    localStorage.setItem('fyp-voice', JSON.stringify(v))
  }, voice)
  await page.goto('/learn/03#sing')
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-sing="start"]').click()
}

/** The line the next take earns: waits out Merc's note and the three seconds of the take. */
async function nextReading(page: Page): Promise<string> {
  const box = page.locator('[data-reading]')
  await expect(box).toBeVisible({ timeout: 25_000 })
  return (await page.locator('[data-reading-line]').textContent()) ?? ''
}

/** Presses a note's button, then waits for that take's reading. */
async function press(page: Page, action: 'again' | 'next'): Promise<string> {
  await page.locator(`[data-sing="${action}"]`).click()
  await expect(page.locator('[data-reading]')).toBeHidden()
  return nextReading(page)
}

/** Three notes of the lower voice, one take each, then the answer to "How did that feel?". */
async function runAndFeel(page: Page, feeling: string): Promise<void> {
  await startSinging(page, 'lower')
  await nextReading(page)
  await press(page, 'next')
  await press(page, 'next')
  await page.locator('[data-sing="done"]').click()
  await page.locator(`[data-feel="${feeling}"]`).click()
}

test('a hard load of /learn/03 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/03')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    "Tested, most could. So what's going on?",
  )
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the lesson boots: the predict reveals, a step unlocks its sound, the explorer opens on Lesson 3 @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/learn/03')

  // the cold open's predict needs no sound: a choice brings the three cards, then the answer
  await page.locator('#predict [data-choice="most"]').click()
  await expect(page.locator('#answer')).toBeVisible()
  await expect(page.locator('#revealCards .rcard').first()).toContainText(
    "Saying so didn't predict how they sang.",
  )

  // an address that names a step opens the deck there; Step 4's plays wait for a committed guess
  await page.goto('/learn/03#step-4')
  const playBoth = page.locator('#octaveToy [data-play="both"]')
  await expect(playBoth).toBeDisabled()
  await page.locator('#octaveToy [data-choice="yes"]').click()
  await expect(playBoth).toBeEnabled()

  // the explorer opens on this page's own lesson, with no film, and goes on
  // from the furthest step the viewer reached (kit/position.ts): Step 4, or
  // Step 5 where the scroll down to the map passed it
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText('Match a note')
  const resume = page.locator('#exCardHost a.btn.primary')
  await expect(resume).toHaveText(/^Continue: step [45]$/)
  const step = /\d+$/.exec((await resume.textContent()) ?? '')?.[0]
  await expect(resume).toHaveAttribute('href', `#step-${step}`)
  await expect(
    page
      .locator('#exCardHost')
      .getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test('the recall from Lesson 2 opens only once Lesson 2 is marked done', async ({
  page,
}) => {
  await page.goto('/learn/03')
  const recall = page.locator('#recallBox')
  await expect(recall).not.toHaveAttribute('open', '')
  await expect(recall.locator('summary')).toHaveText(
    'Done Lesson 2? Two questions from it',
  )

  await page.evaluate(() => localStorage.setItem('fyp-done', '[2]'))
  await page.reload()

  await expect(recall).toHaveAttribute('open', '')
  await expect(page.locator('#rc-qs .q')).toHaveCount(2)
  await expect(page.locator('#rc-q0')).toHaveText(
    'Listen to two steps. Which one is the semitone?',
  )

  // a step link opens Lesson 2's page at that step, in a tab of its own
  await page
    .locator('#rc-qs .q')
    .nth(1)
    .locator('button.opt')
    .filter({ hasText: '100' })
    .click()
  const link = page.locator('#rc-fb1 a')
  await expect(link).toHaveText('Try Lesson 2, Step 6 again')
  await expect(link).toHaveAttribute('href', '/learn/02#step-6')
  await expect(link).toHaveAttribute('target', '_blank')
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

  await page.goto('/learn/03')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test.describe('Sing it, on a steady A3 from the fake microphone', () => {
  test.describe.configure({ timeout: 150_000 })

  test('the lower voice: A3 in the middle, G3 and B3 two semitones off, three tries at most, then "Easy"', async ({
    page,
  }) => {
    await startSinging(page, 'lower')

    // A3: the same note
    expect(await nextReading(page)).toMatch(/^Right in the middle/)

    // G3, three times: Again goes after the third try, Next note stays
    expect(await press(page, 'next')).toMatch(/^About two semitones above/)
    await press(page, 'again')
    await expect(page.locator('[data-sing="again"]')).toBeVisible()
    await press(page, 'again')
    await expect(page.locator('[data-sing="again"]')).toBeHidden()
    await expect(page.locator('[data-sing="next"]')).toBeVisible()

    // B3: the last note offers Done
    expect(await press(page, 'next')).toMatch(/^About two semitones below/)
    await expect(page.locator('[data-sing="next"]')).toBeHidden()
    await page.locator('[data-sing="done"]').click()

    await page.locator('[data-feel="easy"]').click()
    await expect(page.locator('[data-count]')).toHaveText(
      'This time, 1 of your 3 notes landed in the band.',
    )
    await expect(page.locator('[data-tricky]')).toBeVisible()
    await expect(page.locator('[data-sing="rerun"]')).toBeVisible()
    await expect(
      page.locator('#practiseCard [data-ending="practise"]'),
    ).toContainText('Ten minutes, gently, most days.')
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeHidden()
  })

  test('a take sends nothing, keeps nothing but the voice and the Skip, and lets go of the microphone', async ({
    page,
  }) => {
    const sent: string[] = []
    page.on('request', (r) => {
      // A host behind Cloudflare's proxy, such as dev.mercurypitch.com, gets
      // the edge's own scripts on every page (Web Analytics, bot checks), which
      // post under /cdn-cgi/. They carry no audio and are not the page's.
      if (new URL(r.url()).pathname.startsWith('/cdn-cgi/')) return
      if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`)
    })
    await page.goto('/learn/03#sing')
    const keys = (): Promise<string[]> =>
      page.evaluate(() => Object.keys(localStorage).sort())
    const before = await keys()

    await page.locator('[data-comfort="sing"]').click()
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()
    await page.locator('[data-warm="skip"]').click()
    await page.locator('[data-sing="start"]').click()
    expect(await nextReading(page)).toMatch(/^Right in the middle/)

    // the device closes once the take ends and the manager's linger has passed
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            // src/lib/mic-sentinel.ts: the manager's holds and the device's liveness
            const sentinel = (
              window as unknown as {
                __micSentinel?: {
                  dump: () => { holds: readonly string[]; streamLive: boolean }
                }
              }
            ).__micSentinel
            const state = sentinel?.dump()
            return state === undefined
              ? 'no sentinel'
              : `${state.holds.length} ${String(state.streamLive)}`
          }),
        { timeout: 8000 },
      )
      .toBe('0 false')
    expect(sent).toEqual([])
    // the page's memory of the furthest step (kit/position.ts) is not the take's
    const added = (await keys()).filter(
      (k) => !before.includes(k) && k !== 'fyp-pos',
    )
    expect(added).toEqual(['fyp-l03-warmup', 'fyp-voice'])
  })

  test('the higher voice: A4 adds the octave line, G4 does not', async ({
    page,
  }) => {
    await startSinging(page, 'higher')

    expect(await nextReading(page)).toMatch(/^Right in the middle/)
    await expect(page.locator('[data-octave-line]')).toHaveText(
      'You sang it an octave lower: same note.',
    )

    expect(await press(page, 'next')).toMatch(/^About two semitones above/)
    await expect(page.locator('[data-octave-line]')).toBeHidden()
  })

  test('"Effortful" keeps the count and offers no Again', async ({ page }) => {
    await runAndFeel(page, 'effortful')

    await expect(page.locator('[data-count]')).toHaveText(
      'This time, 1 of your 3 notes landed in the band.',
    )
    await expect(page.locator('[data-closing="gentle"]')).toHaveText(
      'Keep it gentle: rest before you sing again.',
    )
    await expect(page.locator('[data-tricky]')).toBeHidden()
    await expect(page.locator('[data-sing="rerun"]')).toBeHidden()
  })

  test('"Uncomfortable" shows no count and no Again, and the Wrap rests', async ({
    page,
  }) => {
    await runAndFeel(page, 'uncomfortable')

    await expect(page.locator('[data-count]')).toBeHidden()
    await expect(page.locator('[data-sing="rerun"]')).toBeHidden()
    await expect(page.locator('[data-closing="enough"]')).toBeVisible()
    await expect(page.locator('[data-after-doctor]')).toBeVisible()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toContainText('Rest today.')
    await expect(page.locator('#practiseCard')).not.toContainText(
      'Ten minutes',
      { useInnerText: true },
    )
  })
})

test('"Just listen today" never asks for the microphone, and the Wrap rests', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { micAsks: number }
    w.micAsks = 0
    const media = navigator.mediaDevices
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      w.micAsks += 1
      return ask(constraints)
    }
  })
  await page.goto('/learn/03#sing')

  await page.locator('[data-comfort="listen"]').click()
  await expect(
    page.locator('[data-listen-why="listen"]').first(),
  ).toContainText('Good call. Merc sings all three notes, and nothing listens.')
  await page.locator('[data-panel="voice"] [data-voice="lower"]').click()
  await page.locator('[data-listen-note="0"]').click()
  await expect(page.locator('#singStatus')).toHaveText('Merc sings A3.')

  expect(
    await page.evaluate(
      () => (window as unknown as { micAsks: number }).micAsks,
    ),
  ).toBe(0)
  await expect(page.locator('#practiseCard [data-ending="rest"]')).toBeVisible()
  await expect(page.locator('#practiseCard')).not.toContainText('Ten minutes', {
    useInnerText: true,
  })
})
