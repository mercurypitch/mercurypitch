// ============================================================
// Lesson 14 Sing it — two takes from the fake microphone, played back
// ============================================================
//
// WEB-SPEC, Tests (End to end), on a steady D3 from the fake microphone
// (src/e2e/helpers/tone-wav.ts): take 1 after Merc's phrase and take 2
// after "Easy", each drawn and read; the playback, each take's own Play
// reading "Stop your take N" while it plays and the seek bar moving the
// playhead without a sound; Again once, and never a fourth take; Delete;
// "Effortful", then the Wrap's rest card and the season's close in its rest
// form; "Just listen today" and a refused microphone; getUserMedia asked
// only by a Start; and the recording kept in memory only, with nothing
// stored, nothing in IndexedDB and nothing sent off the site.

import type { Locator, Page } from '@playwright/test'
import { micAsks, watchMic } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(146.83, 60)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 150_000 })

const status = (page: Page): Locator => page.locator('#singStatus')
const after = (page: Page, name: string): Locator =>
  page.locator(`[data-panel="after"] [data-sing="${name}"]`)
const takeLine = (page: Page): Locator => page.locator('[data-take-line]')

/** Counts every recording the page starts playing, from before its first script runs. */
async function watchSources(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { buffers: number }
    w.buffers = 0
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.buffers += 1
      start.apply(this, args)
    }
  })
}
const sources = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { buffers: number }).buffers)

/** Opens Sing it with the lower voice stored and the sound on, and answers the comfort check. */
async function toSing(page: Page, comfort: 'sing' | 'listen'): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l14.seeded') === '1') return
    sessionStorage.setItem('l14.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/14')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator(`[data-comfort="${comfort}"]`).click()
}

/** Presses `button` and waits through Merc's phrase, the count-in and the take, to its question. */
async function take(page: Page, button: Locator, n: 1 | 2): Promise<void> {
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await expect(status(page)).toHaveText(new RegExp(`^Take ${String(n)}: `), {
    timeout: 25_000,
  })
  await expect(status(page)).toHaveText('How did that feel?', {
    timeout: 30_000,
  })
}

const feel = (page: Page, f: string): Promise<void> =>
  page.locator(`[data-panel="feel"] [data-feel="${f}"]`).click()

test('sings two takes on a steady D3, plays them back from their own Plays, seeks in silence, Again once, and deletes them', async ({
  page,
}) => {
  // Arrange: the microphone and every sound counted, every request off the site kept
  await watchMic(page)
  await watchSources(page)
  const away: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (
      u.protocol.startsWith('http') &&
      !['localhost', '127.0.0.1'].includes(u.hostname)
    )
      away.push(u.href)
  })
  await toSing(page, 'sing')
  const asksBefore = await micAsks(page)

  // Act: take 1, Easy, take 2, Easy
  await take(
    page,
    page.locator('[data-panel="prepare"] [data-sing="start"]'),
    1,
  )
  await expect(takeLine(page)).toHaveText(
    "Take 1, drawn over Merc's bands: your line stayed at about D3.",
  )
  await feel(page, 'easy')
  await expect(status(page)).toHaveText(
    'Now take 2: breathe after “star”, and let “star” swell.',
  )
  await take(page, after(page, 'take2'), 2)
  await feel(page, 'easy')

  // Assert: the playback, each take's Play, and a seek bar that never sounds
  await expect(status(page)).toHaveText(
    'Two takes, one phrase. Play them back: where did each breathe? Did “star” grow and fade?',
  )
  const one = page.locator('[data-take-play="1"]')
  await expect(one).toBeVisible()
  await expect(page.locator('[data-take-play="2"]')).toBeVisible()
  const seek = page.locator('[data-take-seek]')
  const silentBefore = await sources(page)
  await seek.fill('3')
  await expect(seek).toHaveAttribute('aria-valuetext', /^3\.0 seconds of /)
  expect(await sources(page)).toBe(silentBefore)
  await one.click()
  await expect(one).toHaveAttribute('aria-label', 'Stop your take 1')
  expect(await sources(page)).toBe(silentBefore + 1)
  await one.click()
  await expect(one).not.toHaveAttribute('aria-label', 'Stop your take 1')

  // Again once: a third take, then no Start of any kind
  await take(page, after(page, 'again'), 2)
  await feel(page, 'workable')
  for (const name of ['take2', 'again', 'retry'])
    await expect(after(page, name)).toBeHidden()
  // the microphone was asked for by the Starts alone, never before them
  expect(asksBefore).toBe(0)
  expect(await micAsks(page)).toBeGreaterThan(0)

  // Delete: both recordings and both lines go
  await after(page, 'delete').click()
  await expect(page.locator('[data-playback]')).toBeHidden()
  await expect(takeLine(page)).toBeHidden()
  await expect(status(page)).toHaveText('Your takes are deleted.')

  // nothing stored but the page's own keys, nothing in IndexedDB, nothing sent away
  const kept = await page.evaluate(async () => ({
    keys: Object.keys(localStorage).filter((k) => k.startsWith('fyp-')),
    dbs: (await indexedDB.databases()).map((d) => d.name),
  }))
  expect(
    kept.keys.filter((k) => !/^fyp-(voice|tour|l14-|sound)/.test(k)),
  ).toEqual([])
  expect(kept.dbs).toEqual([])
  expect(away).toEqual([])
})

test('after Effortful offers no further take, and the Wrap rests: the rest card and the season’s close in its rest form', async ({
  page,
}) => {
  // Arrange
  await toSing(page, 'sing')

  // Act
  await take(
    page,
    page.locator('[data-panel="prepare"] [data-sing="start"]'),
    1,
  )
  await feel(page, 'effortful')

  // Assert
  await expect(status(page)).toHaveText(
    'Keep it gentle: rest before you sing again.',
  )
  for (const name of ['take2', 'again', 'retry'])
    await expect(after(page, name)).toBeHidden()
  await expect(page.locator('[data-take-play="1"]')).toBeVisible()
  await expect(page.locator('#practiseCard [data-ending="rest"]')).toBeVisible()
  const close = page.locator('#wrap [data-next-card]')
  await expect(close).toContainText("You've seen every note you sing.")
  await expect(close).not.toContainText('Now sing a whole song.')
  await expect(
    close.getByRole('link', { name: 'See the season map' }),
  ).toBeVisible()
  await expect(close.getByRole('link', { name: /Karaoke Night/ })).toHaveCount(
    0,
  )
})

test('“Just listen today” plays Merc’s phrase and never asks for the microphone', async ({
  page,
}) => {
  // Arrange
  await watchMic(page)
  await toSing(page, 'listen')

  // Act
  await page.locator('[data-merc-phrase]').click()

  // Assert
  await expect(page.locator('[data-listen-why="listen"]').first()).toBeVisible()
  await expect(
    page.locator('[data-panel="prepare"] [data-sing="start"]'),
  ).toBeHidden()
  await expect(page.locator('#practiseCard [data-ending="rest"]')).toBeVisible()
  expect(await micAsks(page)).toBe(0)
})

test('a refused microphone listens only, and keeps the practice card', async ({
  page,
}) => {
  // Arrange
  await watchMic(page, true)
  await toSing(page, 'sing')

  // Act
  await page.locator('[data-panel="prepare"] [data-sing="start"]').click()

  // Assert
  await expect(page.locator('[data-listen-why="nomic"]')).toBeVisible()
  await expect(status(page)).toHaveText(
    'No microphone? Sing along anyway: Merc sings the phrase first, and nothing listens.',
  )
  await expect(
    page.locator('[data-panel="prepare"] [data-sing="start"]'),
  ).toBeHidden()
  await expect(
    page.locator('#practiseCard [data-ending="practise"]'),
  ).toBeVisible()
  expect(await micAsks(page)).toBe(1)
})
