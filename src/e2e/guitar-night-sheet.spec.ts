// ============================================================
// Reading every part of a score at once
// ============================================================
//
// Asked for 2026-08-19: "a way to see multiple tracks at the same time even if
// not playing them... a sort of selector to show hide multiple stacked
// instruments tabs/notes per bar, few bars that fit on one horizontal page
// listing, and then they scroll down."
//
// The room could show one part. This judges the sheet from the room: stack the
// parts, take one off the page, and score another by reading its name.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

/** Three parts on three necks, which is what stacking is for. */
function seedBandScore() {
  return (seededSongId: string) => {
    const part = (midi: number, count: number, spacing: number) =>
      Array.from({ length: count }, (_, index) => ({
        midi,
        startBeat: index * spacing,
        duration: 1,
      }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Band Study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 12,
              notes: part(64, 12, 1),
            },
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 8,
              notes: part(52, 8, 1.5),
            },
            {
              id: 'track-bass',
              name: 'Bass',
              instrumentName: 'Electric Bass',
              noteCount: 6,
              notes: part(33, 6, 2),
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

async function openTheRoom(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript(seedBandScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
}

test('stacks every part of the file on one sheet @smoke', async ({ page }) => {
  await openTheRoom(page, `sheet-stack-${Date.now()}`)

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await expect(sheet).toBeVisible()

  // Written order, and the scored part marked where it stands.
  await expect(
    sheet.getByRole('button', { name: 'Lead guitar' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Bass' }).first(),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Lead guitar' }).first(),
  ).toHaveAttribute('aria-pressed', 'true')

  // Scoring another part marks it without moving anything.
  const orderBefore = await sheet
    .locator('[data-system="0"] button')
    .allTextContents()
  await sheet.getByRole('button', { name: 'Bass' }).first().click()
  await expect(
    sheet.getByRole('button', { name: 'Bass' }).first(),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(
    await sheet.locator('[data-system="0"] button').allTextContents(),
  ).toEqual(orderBefore)

  // Bars are drawn, and the line that follows the music is on the page.
  await expect(sheet.locator('canvas').first()).toBeVisible()
  await expect(page.getByTestId('guitar-night-sheet-playhead')).toBeVisible()
})

test('seeks and edits a full-width sheet loop without horizontal scroll @smoke', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-loop-${Date.now()}`)
  const room = page.getByTestId('guitar-night-score-room')
  const deck = room.getByTestId('guitar-night-score-deck')
  const scorePosition = deck.getByRole('slider', {
    name: 'Score position',
    exact: true,
  })
  const loopControls = deck.getByRole('group', { name: 'Section loop' })

  await loopControls
    .getByRole('button', {
      name: 'A — start the loop at the playhead',
      exact: true,
    })
    .click()
  await scorePosition.focus()
  await page.keyboard.press('End')
  const duration = Number(await scorePosition.getAttribute('max'))
  await expect
    .poll(async () => Number(await scorePosition.inputValue()))
    .toBe(duration)
  await loopControls
    .getByRole('button', {
      name: 'B — end the loop at the playhead',
      exact: true,
    })
    .click()

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  const scroller = sheet.getByTestId('guitar-night-sheet-scroll')
  const markerB = sheet.getByRole('slider', {
    name: 'Loop end marker on sheet',
    exact: true,
  })
  await expect(markerB).toBeVisible()

  const initialGeometry = await markerB.evaluate((element) => {
    const marker = element.getBoundingClientRect()
    const hit = getComputedStyle(element, '::after')
    const system = element.parentElement?.getBoundingClientRect()
    const scroll = element
      .closest('[data-testid="guitar-night-sheet-scroll"]')
      ?.getBoundingClientRect()
    const hitLeft = marker.left + Number.parseFloat(hit.left)
    const hitWidth = Number.parseFloat(hit.width)
    return {
      hitLeft,
      hitRight: hitLeft + hitWidth,
      hitWidth,
      markerX: marker.left,
      markerY: marker.top + marker.height / 2,
      scrollLeft: scroll?.left ?? 0,
      scrollRight: scroll?.right ?? 0,
      systemRight: system?.right ?? 0,
    }
  })
  expect(initialGeometry.hitWidth).toBeGreaterThanOrEqual(44)
  expect(initialGeometry.hitLeft).toBeGreaterThanOrEqual(
    initialGeometry.scrollLeft,
  )
  expect(initialGeometry.hitRight).toBeLessThanOrEqual(
    Math.min(initialGeometry.systemRight, initialGeometry.scrollRight) + 1,
  )

  const overflowBefore = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }))
  expect(overflowBefore.scrollWidth).toBeLessThanOrEqual(
    overflowBefore.clientWidth + 1,
  )
  expect(overflowBefore.scrollLeft).toBe(0)

  const initialB = Number(await markerB.getAttribute('aria-valuenow'))
  await page.mouse.move(
    initialGeometry.hitLeft + initialGeometry.hitWidth / 2,
    initialGeometry.markerY,
  )
  await page.mouse.down()
  await page.mouse.move(
    initialGeometry.hitLeft + initialGeometry.hitWidth / 2 - 180,
    initialGeometry.markerY,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => Number(await markerB.getAttribute('aria-valuenow')))
    .toBeLessThan(initialB)

  // Session is a true modal: the first pointer dismisses its scrim and must
  // not also seek the covered notation. The next intentional click may seek.
  await page.getByTestId('guitar-night-session-trigger').click()
  await expect(page.getByRole('dialog', { name: 'Loaded score' })).toBeVisible()
  const rowSeek = sheet.getByRole('slider', {
    name: 'Playback position in score row 1',
    exact: true,
  })
  const rowBox = await rowSeek.boundingBox()
  expect(rowBox).not.toBeNull()
  const beforeDismiss = Number(await scorePosition.inputValue())
  await page.mouse.click(
    (rowBox?.x ?? 0) + (rowBox?.width ?? 0) * 0.22,
    (rowBox?.y ?? 0) + (rowBox?.height ?? 0) / 2,
  )
  await expect(page.getByRole('dialog', { name: 'Loaded score' })).toHaveCount(
    0,
  )
  expect(Number(await scorePosition.inputValue())).toBeCloseTo(beforeDismiss, 2)
  await page.mouse.click(
    (rowBox?.x ?? 0) + (rowBox?.width ?? 0) * 0.22,
    (rowBox?.y ?? 0) + (rowBox?.height ?? 0) / 2,
  )
  await expect
    .poll(async () => Number(await scorePosition.inputValue()))
    .toBeLessThan(duration * 0.5)

  const overflowAfter = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }))
  expect(overflowAfter.scrollWidth).toBeLessThanOrEqual(
    overflowAfter.clientWidth + 1,
  )
  expect(overflowAfter.scrollLeft).toBe(0)
})

test('takes a part off the sheet from the loaded-score panel', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-hide-${Date.now()}`)
  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await expect(
    sheet.getByRole('button', { name: 'Bass' }).first(),
  ).toBeVisible()

  await page.getByTestId('guitar-night-session-trigger').click()
  const panel = page.getByTestId('guitar-night-session-panel')
  await panel.getByLabel('Hide Bass on the sheet').click()
  await page.keyboard.press('Escape')

  await expect(sheet.getByRole('button', { name: 'Bass' })).toHaveCount(0)
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toBeVisible()

  // The part being scored cannot be taken off the page it is scored from.
  await page.getByTestId('guitar-night-session-trigger').click()
  await expect(
    page
      .getByTestId('guitar-night-session-panel')
      .getByLabel('Hide Lead guitar on the sheet'),
  ).toBeDisabled()
})

test('scores another part by reading its name on the sheet', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-score-${Date.now()}`)
  const room = page.getByTestId('guitar-night-score-room')
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await sheet.getByRole('button', { name: 'Rhythm guitar' }).first().click()

  await expect(room.getByText(/Tab rehearsal · Rhythm guitar/)).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Rhythm guitar' }).first(),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('swaps the corner part with the one being read @smoke', async ({
  page,
}) => {
  await openTheRoom(page, `sheet-corner-${Date.now()}`)
  const room = page.getByTestId('guitar-night-score-room')
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  // Asked for 2026-08-19: "you see 1 other in some corner, smaller... And then
  // you can maybe swap between the two easily, by tapping."
  const corner = page.getByTestId('guitar-night-secondary-part')
  await expect(corner).toBeVisible()
  await corner
    .getByRole('button', {
      name: 'Read Rhythm guitar instead',
      exact: true,
    })
    .click()

  await expect(room.getByText(/Tab rehearsal · Rhythm guitar/)).toBeVisible()
  // The corner now offers the way back, so tapping twice returns.
  await expect(
    corner.getByRole('button', {
      name: 'Read Lead guitar instead',
      exact: true,
    }),
  ).toBeVisible()
  await corner
    .getByRole('button', {
      name: 'Read Lead guitar instead',
      exact: true,
    })
    .click()
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()
})

/**
 * A song that drops a 2/4 bar in early, the way Wrathchild and Aces High and
 * half the Maiden catalogue do. Two bars of common time, one two-beat bar,
 * then common time again: every bar after the short one sits two beats earlier
 * than four-four arithmetic would put it.
 */
function seedShortBarScore() {
  return (seededSongId: string) => {
    const notes = Array.from({ length: 40 }, (_, index) => ({
      midi: 52,
      startBeat: index,
      duration: 1,
    }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Short Bar Study',
          bpm: 120,
          timeSignatures: [
            { beat: 0, numerator: 4, denominator: 4 },
            { beat: 8, numerator: 2, denominator: 4 },
            { beat: 10, numerator: 4, denominator: 4 },
          ],
          tracks: [
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: notes.length,
              notes,
            },
          ],
          scoreTrackId: 'track-rhythm',
          backingTrackIds: [],
          importedAt: Date.now(),
        },
      ]),
    )
  }
}

test('puts the bar lines where the score says, not every four beats', async ({
  page,
}) => {
  const songId = `sheet-short-bar-${Date.now()}`
  await page.addInitScript(seedShortBarScore(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()

  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  const sheet = page.getByTestId('guitar-night-sheet')
  await expect(sheet).toBeVisible()

  const starts = await sheet
    .locator('[data-start-beat]')
    .evaluateAll((rows) =>
      rows.map((row) => Number(row.getAttribute('data-start-beat'))),
    )
  expect(starts.length).toBeGreaterThan(1)

  // Four bars to a row, and the 2/4 is the third of them. The second row
  // therefore opens at beat 14. Held in common time it would open at 16, and
  // every note on it would be drawn two beats late for the rest of the song.
  expect(starts).toContain(14)
  expect(starts).not.toContain(16)
})
