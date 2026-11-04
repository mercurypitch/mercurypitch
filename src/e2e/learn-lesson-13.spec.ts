// ============================================================
// Lesson 13 loads at /learn/13 as its own document, and boots
// ============================================================
//
// A draft until the vocal coach signs it off. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then WEB-SPEC's end-to-end checks (Tests, End to end): no AudioContext
// before the first tap, and nothing plays before a play button (1); the
// cold open's predict (2); the vowel figure by keyboard alone (3); every
// target at least 44 px square at 390 and 344 px wide (4); Sing it on a
// steady A3 from the fake microphone, read for pitch alone, with its
// answers and the Wrap's card they pick, the microphone released after
// each take, and listening only and a refused microphone (6, 7); and a
// Show landing at once under reduced motion (11). The fake microphone is
// Chromium's, fed a 220 Hz tone (helpers/tone-wav.ts), which every test
// here may use; only Sing it's take asks for it.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, expectTogglesFlip, openStep, tabsWithin, } from './helpers/lesson-qa'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Resonance and vowels: why ee and ah differ | MercuryPitch'
const TONE_WAV = writeToneWav(220, 20)
const TOY = '#toyVowels'

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

/**
 * Counts the page's AudioContexts and every sound source it starts, from
 * before its first script runs.
 */
async function watchSound(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    w.audioContexts = 0
    w.sources = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.audioContexts += 1
      }
    }
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (
      this: AudioScheduledSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.sources += 1
      start.apply(this, args)
    }
  })
}

/** How many AudioContexts the page has made, and how many sounds it has started. */
const heard = (page: Page): Promise<{ contexts: number; sources: number }> =>
  page.evaluate(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    return { contexts: w.audioContexts, sources: w.sources }
  })

// WEB-SPEC, End to end 1, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/13 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/13')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'If ‘ee’ and ‘ah’ sung on the same note draw the same pitch line, what makes them sound different?',
      )
      await expect(page.locator('#root')).toHaveCount(0)
      // a written lesson: no film, so no Watch section
      await expect(page.locator('#watch')).toHaveCount(0)
    })

    test('the page boots with no AudioContext until the first tap, the deck and the map drawn @smoke', async ({
      page,
    }) => {
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      // the page booted: the map drawn, and the deck on Step 1 (read before the
      // scroll, which the steps follow)
      await page.goto('/learn/13')
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Then what makes ‘ee’ different from ‘ah’?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from the season
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 14',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/13')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="heights"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })
  })
}

// WEB-SPEC, End to end 14, as Lesson 3's spec checks its own
test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
  // Arrange: the studio's service worker installed, and in control
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

  // Act
  await page.goto('/learn/13')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

// WEB-SPEC, End to end 2: the cold open's predict
test("the cold open: Merc's ‘ee’ plays before a choice, ‘ee’, then ‘ah’ waits for one, and the reveal comes once it has played", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  await page.goto('/learn/13')
  await page.locator('#gateBtn').click()
  const eeAh = page.locator('.hero [data-play="ee-ah"]')
  const reveal = page.locator('#predict .reveal')

  // Act: Merc's ‘ee’ before a choice
  await expect(eeAh).toBeDisabled()
  await page.locator('#heroPlay').click()
  await expect(page.locator('#heroVowels [data-said]')).toHaveText(
    "Merc's ‘ee’ on A 3: the line stayed level.",
    { timeout: 6000 },
  )

  // Assert: nothing revealed yet; a choice opens ‘ee’, then ‘ah’, which reveals once heard
  await expect(reveal).toBeHidden()
  await page.locator('#predict [data-choice="heights"]').click()
  await expect(eeAh).toBeEnabled()
  await eeAh.click()
  await expect(reveal).toBeVisible({ timeout: 10_000 })
  await expect(reveal).toContainText('You said: their heights')
  await expect(page.locator('#heroVowels [data-said]')).toHaveText(
    '‘Ah’: peaks on the 3rd bar and the 5th.',
  )
})

// WEB-SPEC, End to end 3: the vowel figure by keyboard alone
test('Step 2 by keyboard: Tab meets Resonances, then ‘ee’ and ‘ah’; Resonances toggles aria-pressed, and a vowel plays by Enter', async ({
  page,
}) => {
  // Arrange
  await openStep(page, '/learn/13', 2)

  // Act
  const met = await tabsWithin(page, `${TOY} [data-fig-label]`, TOY)
  const flipped = await expectTogglesFlip(page, TOY, 'Step 2')
  await page.locator(`${TOY} [data-part="2"] [data-vowel="ah"]`).focus()
  await page.keyboard.press('Enter')

  // Assert
  expect(met).toEqual(['Resonances', '‘ee’, as in key', '‘ah’, as in half'])
  expect(flipped).toBe(1)
  await expect(page.locator(`${TOY} [data-said]`)).toHaveText(
    '‘Ah’ on A 3: peaks on the 3rd bar and the 5th.',
    { timeout: 6000 },
  )
})

// WEB-SPEC, End to end 4: every target at least 44 px square, none overlapping
for (const width of [390, 344]) {
  test.describe(`the vowel figure's targets at ${width} px wide`, () => {
    test.use({ viewport: { width, height: 844 } })

    test('every target of Steps 1 to 5, and of free play, is at least 44 px square, and none overlaps another', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, '/learn/13', 1)
      const counts: number[] = []

      // Act, Assert
      for (let n = 1; n <= 5; n++) {
        if (n > 1) {
          await page
            .getByRole('button', { name: 'Next step', exact: true })
            .click()
          await expect(page.locator('#stepNow')).toHaveText(String(n))
        }
        counts.push(await expectTargets(page, TOY, `Step ${n}`))
      }
      await page.locator('#freePlay').scrollIntoViewIfNeeded()
      counts.push(await expectTargets(page, '#freePlay', 'free play'))
      expect(counts).toEqual([2, 3, 3, 6, 2, 10])
    })
  })
}

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

/** Opens Sing it with a voice already chosen, at the note. */
async function toTheNote(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/13#sing')
  await page.locator('[data-comfort="sing"]').click()
}

/** The line the hold earns: waits out Merc's ten seconds, the in-breath and the hold. */
async function holdReading(page: Page): Promise<string> {
  await page.locator('[data-sing="start"]').click()
  await expect(page.locator('[data-reading]')).toBeVisible({
    timeout: 45_000,
  })
  return (await page.locator('[data-reading-line]').textContent()) ?? ''
}

// WEB-SPEC, End to end 6 and 7
test.describe('Sing it, on a steady A3 from the fake microphone', () => {
  test.describe.configure({ timeout: 180_000 })

  test('one hold through the five vowels: all ten seconds in the band, "Easy", the rest, Again and Done for today', async ({
    page,
  }) => {
    // Arrange
    await toTheNote(page)

    // Act
    const line = await holdReading(page)

    // Assert
    expect(line).toBe('In the band for all 10 seconds.')
    await expect(page.locator('#feelQ')).toBeVisible()
    // the microphone stops listening at the end of the hold
    await expect.poll(() => micState(page), { timeout: 8000 }).toBe('0 false')
    // the chart's words name the note and the time, never a vowel
    await expect(page.locator('#singChart canvas')).toHaveAttribute(
      'aria-label',
      /^Merc's note A 3; your line in the band for 10 of 10 seconds/,
    )
    await page.locator('[data-feel="easy"]').click()
    const after = page.locator('[data-panel="after"]')
    await expect(after.locator('[data-closing="rest"]')).toHaveText(
      'Rest for a few easy breaths. Ready when you are.',
    )
    await expect(after.locator('[data-sing="again"]')).toBeVisible()
    await expect(after.locator('[data-sing="today"]')).toBeVisible()
    await expect(
      page.locator('#practiseCard [data-ending="practise"]'),
    ).toBeVisible()
    await after.locator('[data-sing="today"]').click()
    await expect(page.locator('#singStatus')).toHaveText('Done for today.')
  })

  test('"Uncomfortable" takes the reading away, offers no more holds, shows the doctor lines, and the Wrap rests', async ({
    page,
  }) => {
    // Arrange
    await toTheNote(page)
    await holdReading(page)

    // Act
    await page.locator('[data-feel="uncomfortable"]').click()

    // Assert
    const after = page.locator('[data-panel="after"]')
    await expect(after.locator('[data-after-doctor]')).toBeVisible()
    await expect(page.locator('#singLive')).toBeHidden()
    await expect(page.locator('[data-sing="again"]:visible')).toHaveCount(0)
    await expect(page.locator('[data-sing="start"]:visible')).toHaveCount(0)
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeVisible()
    await expect(page.locator('#practiseCard')).not.toHaveAttribute(
      'href',
      /.*/,
    )
  })
})

test('"Just listen today" never asks for the microphone: Merc\'s ten seconds play, and the Wrap rests', async ({
  page,
}) => {
  // Arrange
  await page.addInitScript(() => {
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
    const w = window as unknown as { asked: number }
    w.asked = 0
    const real = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    navigator.mediaDevices.getUserMedia = (c) => {
      w.asked += 1
      return real(c)
    }
  })
  await page.goto('/learn/13#sing')

  // Act
  await page.locator('[data-comfort="listen"]').click()
  await page.locator('[data-listen-play]').click()

  // Assert
  await expect(page.locator('#singStatus')).toHaveText(
    'Merc sings ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’ on A 3, two seconds each.',
  )
  await expect(page.locator('[data-sing="start"]:visible')).toHaveCount(0)
  await expect(page.locator('#practiseCard [data-ending="rest"]')).toBeVisible()
  expect(
    await page.evaluate(() => (window as unknown as { asked: number }).asked),
  ).toBe(0)
})

test('a refused microphone leaves listening only, with the no-microphone line, and the Voice Mirror card', async ({
  page,
}) => {
  // Arrange: the browser refuses every request for the microphone
  await page.addInitScript(() => {
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('refused', 'NotAllowedError'))
  })
  await page.goto('/learn/13#sing')
  await page.locator('[data-comfort="sing"]').click()

  // Act
  await page.locator('[data-sing="start"]').click()

  // Assert
  await expect(page.locator('#singStatus')).toHaveText(
    'No microphone? Sing along anyway: Merc sings the note first, and nothing listens.',
    { timeout: 10_000 },
  )
  await expect(page.locator('[data-listen-play]')).toBeVisible()
  await expect(
    page.locator('#practiseCard [data-ending="practise"]'),
  ).toBeVisible()
})

// WEB-SPEC, End to end 11
test.describe('under reduced motion', () => {
  test("a word's Show lands on its end at once: Spectrum's strip lit as drawn", async ({
    page,
  }) => {
    // Arrange
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/learn/13#lesson')
    const heights = (): Promise<string[]> =>
      page
        .locator('[data-word="spectrum"] .stub .lit')
        .evaluateAll((els) => els.map((e) => e.getAttribute('height') ?? ''))
    const drawn = await heights()

    // Act
    await page.locator('[data-word-play="spectrum"]').click()

    // Assert
    expect(await heights()).toEqual(drawn)
    await expect(page.locator('[data-word-play="spectrum"]')).not.toHaveClass(
      /is-on/,
    )
  })
})
