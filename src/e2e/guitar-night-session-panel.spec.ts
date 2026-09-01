// ============================================================
// Changing the scored part without leaving the room
// ============================================================
//
// Reported 2026-08-19: "the guitar night room, doesn't seem to have a easy way
// to change what is being scored against? what track?"
//
// It was changeable only from the lobby, so the fix is judged from inside the
// room: open the track mixer, pick another part, and see the room
// itself change what it is reading.

import { devices, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

/** A two-part file, which is the case the lobby's picker existed for. */
function seedTwoPartScore() {
  return (seededSongId: string) => {
    const lead = Array.from({ length: 12 }, (_, index) => ({
      midi: 64,
      startBeat: index,
      duration: 1,
      stringIndex: 0,
      fret: index % 5,
    }))
    const rhythm = Array.from({ length: 8 }, (_, index) => ({
      midi: 52,
      startBeat: index * 1.5,
      duration: 1,
      stringIndex: 4,
      fret: 2,
    }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Two Part Study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: lead.length,
              notes: lead,
            },
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: rhythm.length,
              notes: rhythm,
            },
          ],
          scoreTrackId: 'track-lead',
          backingTrackIds: [],
          importedAt: Date.now(),
        },
      ]),
    )
  }
}

async function enterTwoPartRoom(page: Page, songId: string): Promise<void> {
  await page.addInitScript(seedTwoPartScore(), songId)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
}

test('changes the scored part from inside the tab room @smoke', async ({
  page,
}) => {
  const songId = `session-panel-${Date.now()}`
  await page.addInitScript(seedTwoPartScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const room = page.getByTestId('guitar-night-score-room')
  await expect(room).toBeVisible()
  // The room opens on the file's own scored part.
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  // THE REGRESSION: before this there was no way in from here at all.
  await page.getByTestId('guitar-night-session-trigger').click()
  const panel = page.getByTestId('guitar-night-session-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Two Part Study')).toBeVisible()

  const rhythm = panel
    .getByTestId('guitar-night-session-track')
    .filter({ hasText: 'Rhythm guitar' })
  await expect(rhythm).toHaveAttribute('aria-pressed', 'false')
  await rhythm.click()

  // The room is reading the other part now, and says so where it always said it.
  await expect(panel).toHaveCount(0)
  await expect(room.getByText(/Tab rehearsal · Rhythm guitar/)).toBeVisible()

  // And the panel agrees on the way back in.
  await page.getByTestId('guitar-night-session-trigger').click()
  await expect(
    page
      .getByTestId('guitar-night-session-panel')
      .getByTestId('guitar-night-session-track')
      .filter({ hasText: 'Rhythm guitar' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('returns focus to the room when the panel is dismissed @smoke', async ({
  page,
}) => {
  const songId = `session-focus-${Date.now()}`
  await page.addInitScript(seedTwoPartScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()

  const trigger = page.getByTestId('guitar-night-session-trigger')
  await trigger.click()
  await expect(page.getByTestId('guitar-night-session-panel')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('guitar-night-session-panel')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('keeps one mixer row stable through a real-mouse fader lift @smoke', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await enterTwoPartRoom(page, `session-fader-${Date.now()}`)

  const trigger = page.getByRole('button', {
    name: 'Open track mixer for Two Part Study',
    exact: true,
  })
  await expect(trigger.getByText('Mix', { exact: true })).toBeVisible()
  await trigger.click()

  const mixer = page.getByRole('dialog', {
    name: 'Track mixer for Two Part Study',
    exact: true,
  })
  const rhythmTrack = mixer
    .getByTestId('guitar-night-session-track')
    .filter({ hasText: 'Rhythm guitar' })
  const rhythmRow = rhythmTrack.locator('..')
  const fader = mixer.getByRole('slider', {
    name: 'Rhythm guitar level',
    exact: true,
  })
  await expect(fader).toHaveAttribute('aria-valuetext', '0 dB')
  await rhythmRow.evaluate((element) => {
    const browserWindow = window as typeof window & {
      __guitarNightMixerRow?: Element
    }
    browserWindow.__guitarNightMixerRow = element
  })

  const bounds = await fader.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = (bounds?.x ?? 0) + (bounds?.width ?? 0) * (30 / 36)
  const endX = (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.98
  const y = (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(endX, y, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => Number(await fader.inputValue()))
    .toBeGreaterThan(0)
  await expect(fader).toHaveAttribute('aria-valuetext', /^\+[1-6](?:\.\d)? dB$/)
  await expect(rhythmRow.locator('output')).toHaveText(/^\+/)
  expect(
    await rhythmRow.evaluate(
      (element) =>
        (window as typeof window & { __guitarNightMixerRow?: Element })
          .__guitarNightMixerRow === element,
    ),
  ).toBe(true)
  await expect(rhythmTrack).toHaveAttribute('aria-pressed', 'false')
})

test('keeps the track mixer inside both phone viewports with touch-sized controls @smoke', async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()

  try {
    await enterTwoPartRoom(page, `session-phone-${Date.now()}`)
    await page
      .getByRole('button', {
        name: 'Open track mixer for Two Part Study',
        exact: true,
      })
      .click()
    const mixer = page.getByRole('dialog', {
      name: 'Track mixer for Two Part Study',
      exact: true,
    })

    const topbarIsCovered = await page
      .getByTestId('guitar-night-topbar')
      .evaluate((topbar) => {
        const bounds = topbar.getBoundingClientRect()
        const element = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        return element !== null && !topbar.contains(element)
      })
    expect(topbarIsCovered).toBe(true)

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(mixer).toBeVisible()
      const fit = await mixer.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          bottom: bounds.bottom,
          clientWidth: element.clientWidth,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          left: bounds.left,
          right: bounds.right,
          scrollWidth: element.scrollWidth,
          top: bounds.top,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        }
      })
      expect(fit.left).toBeGreaterThanOrEqual(0)
      expect(fit.right).toBeLessThanOrEqual(fit.viewportWidth + 1)
      expect(fit.top).toBeGreaterThanOrEqual(0)
      expect(fit.bottom).toBeLessThanOrEqual(fit.viewportHeight + 1)
      expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1)
      expect(fit.documentScrollWidth).toBeLessThanOrEqual(
        fit.documentClientWidth + 1,
      )

      const controls = mixer.locator('button, input, select')
      const controlCount = await controls.count()
      expect(controlCount).toBeGreaterThan(0)
      for (let index = 0; index < controlCount; index += 1) {
        const control = controls.nth(index)
        await control.scrollIntoViewIfNeeded()
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
        expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          viewport.width + 1,
        )
      }
    }
  } finally {
    await context.close()
  }
})
