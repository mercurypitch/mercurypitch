// ============================================================
// Jam room — the line being sung lights up word by word
// ============================================================
//
// Owner request (2026-09-20): highlight the word in a jam room's lyrics
// the way Karaoke Night and the mixer do. The word times were already in
// the song's LRC; the room scrubbed them out of the text and threw them
// away, so it lit a whole line at once.
//
// jsdom cannot clip a gradient to a glyph or play a song, so this drives
// a song that is really playing and reads what the browser really painted.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const SONG_SEC = 24
const TONE_WAV = readFileSync(writeToneWav(440, SONG_SEC))

const stamp = (sec: number): string => {
  const minutes = Math.floor(sec / 60)
  const rest = (sec - minutes * 60).toFixed(2).padStart(5, '0')
  return `[${String(minutes).padStart(2, '0')}:${rest}]`
}

/** Four words a line, one a second: slow enough to catch a word mid-fill. */
const WORDS = ['slowly', 'every', 'single', 'word']
const LINE_SEC = 4
const LINE_COUNT = 5
const mappedLine = (i: number): string => {
  const at = 1 + i * LINE_SEC
  return (
    stamp(at) +
    WORDS.map((w, k) => (k === 0 ? w : `${stamp(at + k)}${w}`)).join(' ')
  )
}
const MAPPED = [
  ...Array.from({ length: LINE_COUNT }, (_, i) => mappedLine(i)),
  '',
].join('\n')

/** The same sheet with line times only: what most songs have. */
const PLAIN = [
  ...Array.from(
    { length: LINE_COUNT },
    (_, i) => `${stamp(1 + i * LINE_SEC)}${WORDS.join(' ')}`,
  ),
  '',
].join('\n')

/** In ranges, so the element can be seeked (see jam-lyrics-follow.spec.ts). */
async function serveSeekableTone(page: Page): Promise<void> {
  await page.route('**/demo/goodbye-to-spring/*.m4a', async (route) => {
    const total = TONE_WAV.byteLength
    const asked = /bytes=(\d+)-(\d*)/.exec(
      route.request().headers().range ?? '',
    )
    if (asked === null) {
      await route.fulfill({
        contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes' },
        body: TONE_WAV,
      })
      return
    }
    const start = Number(asked[1])
    const end =
      asked[2] === '' ? total - 1 : Math.min(Number(asked[2]), total - 1)
    await route.fulfill({
      status: 206,
      contentType: 'audio/wav',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${total}`,
      },
      body: TONE_WAV.subarray(start, end + 1),
    })
  })
}

async function openSongRoom(page: Page, lyrics: string): Promise<void> {
  await serveSeekableTone(page)
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({ contentType: 'text/plain', body: lyrics }),
  )
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(page.locator('[data-line="0"]')).toBeVisible()
}

/** What the line being sung looks like right now, word by word. */
const currentLine = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('[data-current]')
    if (row === null) return null
    const words = Array.from(row.querySelectorAll<HTMLElement>('[data-word]'))
    return {
      line: Number(row.dataset.line),
      states: words.map((w) => w.dataset.word ?? ''),
      sweep: words.map((w) =>
        Number.parseFloat(w.style.getPropertyValue('--word-sweep') || 'NaN'),
      ),
      clip: words.map((w) => getComputedStyle(w).backgroundClip),
      splitElsewhere: document.querySelectorAll(
        '[data-line]:not([data-current]) [data-word]',
      ).length,
    }
  })

test.describe('a song mapped word by word', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('lights the words of the line being sung, one after another @smoke', async ({
    page,
  }) => {
    await openSongRoom(page, MAPPED)
    // Nothing is split until something is being sung.
    expect(await page.locator('[data-word]').count()).toBe(0)

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    // Into the first line: its first word fills while the rest wait.
    await expect
      .poll(async () => (await currentLine(page))?.states.join(','), {
        timeout: 8000,
      })
      .toMatch(/^(active|sung),ahead,ahead,ahead$/)

    // ...and a couple of seconds on, the song has moved along the line.
    await expect
      .poll(async () => (await currentLine(page))?.states.join(','), {
        timeout: 8000,
      })
      .toMatch(/^sung,sung,(active|sung|ahead),ahead$/)

    const seen = await currentLine(page)
    expect(seen?.line).toBe(0)
    // Only the line being sung is ever split into words.
    expect(seen?.splitElsewhere).toBe(0)
  })

  test('fills the word being sung from the left, and the fill moves', async ({
    page,
  }) => {
    await openSongRoom(page, MAPPED)
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    // Every frame for a few seconds, from inside the page: a word fills in
    // about a third of a second and then waits lit for the next one, so a
    // poll from out here samples the wait far more often than the fill.
    const frames = await page.evaluate(
      () =>
        new Promise<{ word: number; sweep: number; clip: string }[]>(
          (resolve) => {
            const seen: { word: number; sweep: number; clip: string }[] = []
            const from = performance.now()
            const tick = (): void => {
              const row = document.querySelector<HTMLElement>('[data-current]')
              const active = row?.querySelector<HTMLElement>(
                '[data-word="active"]',
              )
              if (row !== null && active !== null && active !== undefined) {
                const words = Array.from(row.querySelectorAll('[data-word]'))
                seen.push({
                  word: Number(row.dataset.line) * 10 + words.indexOf(active),
                  sweep: Number.parseFloat(
                    active.style.getPropertyValue('--word-sweep'),
                  ),
                  clip: getComputedStyle(active).backgroundClip,
                })
              }
              if (performance.now() - from < 4000) requestAnimationFrame(tick)
              else resolve(seen)
            }
            tick()
          },
        ),
    )

    expect(frames.length).toBeGreaterThan(10)
    for (const frame of frames) {
      // A gradient clipped to the glyphs, not a recoloured box.
      expect(frame.clip).toBe('text')
      expect(frame.sweep).toBeGreaterThan(0)
      expect(frame.sweep).toBeLessThanOrEqual(100)
    }
    // Within one word the fill only ever grows...
    for (let i = 1; i < frames.length; i++) {
      const [before, now] = [frames[i - 1]!, frames[i]!]
      if (before.word === now.word) {
        expect(now.sweep).toBeGreaterThanOrEqual(before.sweep)
      } else {
        // ...and the song only ever moves on to a later word.
        expect(now.word).toBeGreaterThan(before.word)
      }
    }
    // It really is a sweep: some word was caught both early and late.
    const byWord = new Map<number, number[]>()
    for (const frame of frames) {
      byWord.set(frame.word, [...(byWord.get(frame.word) ?? []), frame.sweep])
    }
    const widest = Math.max(
      ...Array.from(byWord.values(), (s) => Math.max(...s) - Math.min(...s)),
    )
    expect(widest).toBeGreaterThan(30)
  })

  test('holds still with a paused song, and picks up where it was', async ({
    page,
  }) => {
    await openSongRoom(page, MAPPED)
    await page.keyboard.press('Space')
    await expect
      .poll(async () => (await currentLine(page))?.states.includes('sung'), {
        timeout: 8000,
      })
      .toBe(true)
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
    await page.waitForTimeout(300)
    const paused = await currentLine(page)
    await page.waitForTimeout(700)
    expect(await currentLine(page)).toEqual(paused)
  })
})

test.describe('a song timed line by line', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('still lights up word by word, shared out evenly', async ({ page }) => {
    await openSongRoom(page, PLAIN)
    await page.keyboard.press('Space')
    await expect
      .poll(async () => (await currentLine(page))?.states.join(','), {
        timeout: 8000,
      })
      .toMatch(/^sung,(active|sung),/)
    expect((await currentLine(page))?.splitElsewhere).toBe(0)
  })
})
