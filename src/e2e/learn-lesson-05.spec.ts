// ============================================================
// Lesson 5 loads at /learn/05 as its own document, and its holds listen
// ============================================================
//
// A draft until the vocal coach signs it off. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like Lessons 1 and 3 it must load as itself, never
// as the 404 page or the studio's cached app shell, and its module must
// boot.
//
// Sing it runs on Chromium's fake microphone, a steady A3 (220 Hz) from a
// 20-second file (helpers/tone-wav.ts), long enough that one file outlasts
// a whole fifteen-second take, as guided-voice-check.spec.ts has it. Against
// the lower voice it is right on A3, a semitone under A sharp 3 once moved
// Higher by one; against the higher voice it is A4 an octave lower. The
// checks are WEB-SPEC's (Toys 6, Tests): the line each hold earns, "How did
// that feel?" after every take, what each answer still shows and offers,
// the three-take limit, the Wrap's practise card it picks, that listening
// only never asks for the microphone, and that the microphone stops at the
// end of each hold. Merc's celebration is not visible here: the e2e browser
// has no GPU, so the Mercs are stills (hold-flow.test.ts covers it).

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TITLE = 'Breath and a steady note · Find Your Pitch | MercuryPitch'
const TONE_WAV = writeToneWav(220, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

/** Opens Sing it with a voice already chosen (Lesson 3's `fyp-voice`), at the note. */
async function toTheNote(page: Page, voice: 'lower' | 'higher'): Promise<void> {
  await page.addInitScript((v) => {
    localStorage.setItem('fyp-voice', JSON.stringify(v))
  }, voice)
  await page.goto('/learn/05#sing')
  await page.locator('[data-comfort="sing"]').click()
}

/** The line the next hold earns: waits out Merc's note, the in-breath and the hold. */
async function nextReading(page: Page, length: 10 | 15): Promise<string> {
  const box = page.locator('[data-reading]')
  await expect(box).toBeVisible({ timeout: (length + 20) * 1000 })
  return (await page.locator('[data-reading-line]').textContent()) ?? ''
}

/** The first hold, from Start. */
async function firstHold(page: Page): Promise<string> {
  await page.locator('[data-sing="start"]').click()
  return nextReading(page, 10)
}

/** Presses one of the card's buttons, then waits for that take's reading. */
async function press(
  page: Page,
  action: 'again' | 'hold15',
  length: 10 | 15,
): Promise<string> {
  await page.locator(`[data-panel="after"] [data-sing="${action}"]`).click()
  await expect(page.locator('[data-reading]')).toBeHidden()
  return nextReading(page, length)
}

const feel = (page: Page, feeling: string): Promise<void> =>
  page.locator(`[data-feel="${feeling}"]`).click()

/** The microphone's holds and the device's liveness, from the mic sentinel (src/lib/mic-sentinel.ts). */
const micState = (page: Page): Promise<string> =>
  page.evaluate(() => {
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
  })

/** Sets a range input as a drag would, through its input event. */
async function scrubTo(
  page: Page,
  selector: string,
  value: number,
): Promise<void> {
  await page.locator(selector).evaluate((el, v) => {
    const input = el as HTMLInputElement
    input.value = String(v)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

test('a hard load of /learn/05 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/05')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'what keeps it steady?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the lesson boots: the takes play, the predict reveals, the demo reads, the explorer opens on Lesson 5 @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/learn/05')

  // sound before the predict: the easy take plays before a choice, the pushed one waits for it
  await expect(page.locator('#playEasy')).toBeEnabled()
  await expect(page.locator('#playPushed')).toBeDisabled()
  await page.locator('#predict [data-choice="steadier"]').click()
  await expect(page.locator('#playPushed')).toBeEnabled()
  await page.locator('#playPushed').click()
  const reveal = page.locator('#predict .reveal')
  await expect(reveal).toBeVisible({ timeout: 10_000 })
  await expect(reveal).toContainText('Louder, and higher.')
  await expect(reveal.locator('.mono')).toHaveText(
    'You said: settle, steadier than before',
  )

  // an address that names a step opens the deck there; the demo's readouts come from the reader
  await page.goto('/learn/05#step-5')
  await expect(page.locator('#holdToy')).toBeVisible()
  await scrubTo(page, '#holdScrub', 1000)
  await expect(page.locator('[data-hold-ro="settled"]')).toHaveText('0.7s')
  await expect(page.locator('[data-hold-ro="band"]')).toHaveText('9.4of 10 s')
  await expect(page.locator('#holdScrub')).toHaveAttribute(
    'aria-valuetext',
    '10.0 seconds of 10: in the band',
  )

  // the step 2 predict needs no sound: the choice brings the reveal and orange's line
  await page.goto('/learn/05#step-2')
  await page.locator('#breathPredict [data-choice="hold"]').click()
  await expect(page.locator('#breathPredict .reveal')).toContainText(
    'Hold it back, with your breathing muscles, never your throat.',
  )
  await expect(page.locator('[data-orange-says]')).toBeVisible()

  // the explorer opens on this page's own lesson, with no film, and goes on
  // from the furthest step the viewer reached (kit/position.ts): Step 5, not
  // Step 2, the last one opened
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Breath and a steady note',
  )
  await expect(
    page.locator('#exCardHost').getByRole('link', { name: 'Continue: step 5' }),
  ).toHaveAttribute('href', '#step-5')
  await expect(
    page
      .locator('#exCardHost')
      .getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test("the recall asks Lesson 3's two questions of everyone, and links Lesson 3's steps", async ({
  page,
}) => {
  await page.goto('/learn/05')

  await expect(page.locator('#recall-title')).toHaveText('Recall from Lesson 3')
  await expect(page.locator('#rc-qs .q')).toHaveCount(2)
  await expect(page.locator('#rc-q0')).toHaveText(
    'Merc sings an A3. You sing an A2, an octave lower and 20 cents high. Where is your note?',
  )

  // a step link opens Lesson 3's page at that step, in a tab of its own
  await page
    .locator('#rc-qs .q')
    .first()
    .locator('button.opt')
    .filter({ hasText: 'Outside the band' })
    .click()
  const link = page.locator('#rc-fb0 a')
  await expect(link).toHaveText('Try Lesson 3, Step 4 again')
  await expect(link).toHaveAttribute('href', '/learn/03#step-4')
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

  await page.goto('/learn/05')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test.describe('Sing it, on a steady A3 from the fake microphone', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the lower voice: all ten seconds, "Easy", the rest, all fifteen, "Easy", both readings', async ({
    page,
  }) => {
    await toTheNote(page, 'lower')

    expect(await firstHold(page)).toBe('In the band for all 10 seconds.')
    // "How did that feel?" comes before any longer hold
    await expect(page.locator('#feelQ')).toBeVisible()
    await expect(page.locator('[data-sing="hold15"]')).toBeHidden()

    // the microphone stops listening at the end of the hold
    await expect.poll(() => micState(page), { timeout: 8000 }).toBe('0 false')

    await feel(page, 'easy')
    const after = page.locator('[data-panel="after"]')
    await expect(after.locator('[data-closing="rest"]')).toHaveText(
      'Rest for a few easy breaths. Ready when you are.',
    )
    await expect(after.locator('[data-sing="hold15"]')).toBeVisible()
    await expect(after.locator('[data-sing="again"]')).toBeVisible()
    await expect(after.locator('[data-sing="today"]')).toBeVisible()

    expect(await press(page, 'hold15', 15)).toBe(
      'In the band for all 15 seconds.',
    )
    await expect.poll(() => micState(page), { timeout: 8000 }).toBe('0 false')
    await feel(page, 'easy')
    await expect(after.locator('[data-summary]')).toHaveText(
      'This time your line was in the band for 10 of 10 seconds, then 15 of 15.',
    )
    await expect(after.locator('[data-sing="again"]')).toBeVisible()
    await expect(after.locator('[data-sing="done"]')).toBeVisible()
    await expect(after.locator('[data-sing="hold15"]')).toBeHidden()
    await expect(
      page.locator('#practiseCard [data-ending="practise"]'),
    ).toContainText('Ten minutes, gently, most days.')
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeHidden()

    await after.locator('[data-sing="done"]').click()
    await expect(page.locator('#singStatus')).toHaveText('Done for today.')
  })

  test('moved Higher by one, the same A3 reads a semitone below', async ({
    page,
  }) => {
    await toTheNote(page, 'lower')
    await page.locator('[data-note="higher"]').click()
    await expect(page.locator('[data-note-now]')).toContainText('233 Hz')

    expect(await firstHold(page)).toBe(
      'About a semitone below, nearer a different note. Listen again, then slide up to the band.',
    )
  })

  test('moved Higher by one, the ring\'s black-key note stays on one line: "A♯3 · 233 Hz"', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await toTheNote(page, 'lower')
    await page.locator('[data-note="higher"]').click()
    await page.locator('[data-sing="start"]').click()

    const note = page.locator('#ring .ring-note')
    await expect(note).toContainText('233 Hz', { timeout: 15_000 })
    // every piece of the note drawn on one line: the sign's span sits in it
    const drawn = await note.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 1 && r.height > 1,
      )
      const tops = rects.map((r) => r.top)
      return {
        pieces: rects.length,
        spread: Math.max(...tops) - Math.min(...tops),
        line: Math.min(...rects.map((r) => r.height)),
      }
    })
    expect(drawn.pieces).toBeGreaterThan(1)
    expect(drawn.spread).toBeLessThan(drawn.line / 2)
  })

  test('the higher voice: A4, sung an octave lower, adds the octave line', async ({
    page,
  }) => {
    await toTheNote(page, 'higher')

    expect(await firstHold(page)).toBe('In the band for all 10 seconds.')
    await expect(page.locator('[data-octave-line]')).toHaveText(
      'You sang it an octave lower: same note.',
    )
  })

  test('"Effortful" keeps the reading and offers only Done for today', async ({
    page,
  }) => {
    await toTheNote(page, 'lower')
    await firstHold(page)
    await feel(page, 'effortful')

    const after = page.locator('[data-panel="after"]')
    await expect(page.locator('[data-reading-line]')).toHaveText(
      'In the band for all 10 seconds.',
    )
    await expect(after.locator('[data-closing="gentle"]')).toHaveText(
      'Keep it gentle: rest before you sing again.',
    )
    await expect(after.locator('[data-sing="hold15"]')).toBeHidden()
    await expect(after.locator('[data-sing="again"]')).toBeHidden()
    await expect(after.locator('[data-sing="today"]')).toBeVisible()
    await expect(after.locator('[data-tricky]')).toBeHidden()
  })

  test('after the third take of a hold, Again is gone', async ({ page }) => {
    await toTheNote(page, 'lower')
    await firstHold(page)
    await feel(page, 'workable')
    await press(page, 'again', 10)
    await feel(page, 'easy')
    const again = page.locator('[data-panel="after"] [data-sing="again"]')
    await expect(again).toBeVisible()
    await press(page, 'again', 10)
    await feel(page, 'easy')

    await expect(again).toBeHidden()
    await expect(
      page.locator('[data-panel="after"] [data-sing="hold15"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-panel="after"] [data-sing="today"]'),
    ).toBeVisible()
  })

  test('"Uncomfortable" offers no more holds, shows the doctor lines, and the Wrap rests', async ({
    page,
  }) => {
    await toTheNote(page, 'lower')
    await firstHold(page)
    await feel(page, 'uncomfortable')

    const after = page.locator('[data-panel="after"]')
    await expect(after.locator('[data-closing="enough"]')).toBeVisible()
    await expect(after.locator('[data-after-doctor]')).toBeVisible()
    for (const b of ['hold15', 'again', 'today', 'done'])
      await expect(after.locator(`[data-sing="${b}"]`)).toBeHidden()
    await expect(page.locator('#singLive')).toBeHidden()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toContainText('Rest today.')
    await expect(page.locator('#practiseCard')).not.toContainText(
      'Ten minutes',
      { useInnerText: true },
    )
  })

  test('a hold sends nothing and keeps nothing but the voice and the Skip', async ({
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
    await page.goto('/learn/05#sing')
    const keys = (): Promise<string[]> =>
      page.evaluate(() => Object.keys(localStorage).sort())
    const before = await keys()

    await page.locator('[data-comfort="sing"]').click()
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()
    await page.locator('[data-warm="skip"]').click()
    expect(await firstHold(page)).toBe('In the band for all 10 seconds.')
    await feel(page, 'easy')

    await expect.poll(() => micState(page), { timeout: 8000 }).toBe('0 false')
    expect(sent).toEqual([])
    // the page's memory of the furthest step (kit/position.ts) is not the take's
    const added = (await keys()).filter(
      (k) => !before.includes(k) && k !== 'fyp-pos',
    )
    expect(added).toEqual(['fyp-l05-warmup', 'fyp-voice'])
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
  await page.goto('/learn/05#sing')

  await page.locator('[data-comfort="listen"]').click()
  await expect(
    page.locator('[data-listen-why="listen"]').first(),
  ).toContainText(
    'Good call. Merc holds the note for you, and nothing listens.',
  )
  await page.locator('[data-panel="voice"] [data-voice="lower"]').click()
  await page.locator('[data-listen-len="10"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'Merc holds A3 for 10 seconds.',
  )

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
