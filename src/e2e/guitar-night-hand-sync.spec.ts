// ============================================================
// Hanging a written part on the recording, by hand
// ============================================================
//
// Phase 3 of `docs/plans/score-recording-sync.md`. The matcher needs a
// transcription of this recording and there is not always one. This is the
// reader doing it themselves: play to a moment, say "here".
//
// Before this, the room said out loud that an attached tab "keeps its own BPM"
// and could only rehearse elsewhere. That note is what these tests replace.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

function scoreSeed() {
  return (seededSongId: string) => {
    const notes = Array.from({ length: 24 }, (_, index) => ({
      midi: index % 2 === 0 ? 64 : 67,
      startBeat: index,
      duration: 1,
      stringIndex: 0,
      fret: index % 2 === 0 ? 0 : 3,
    }))
    localStorage.setItem(
      'pitchperfect_guitar_songs',
      JSON.stringify([
        {
          id: seededSongId,
          name: 'Velvet pointer study',
          bpm: 120,
          tracks: [
            {
              id: 'track-lead',
              name: 'Lead guitar',
              instrumentName: 'Clean Guitar',
              noteCount: notes.length,
              notes,
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

/** A tab attached in the lobby, with the demo song staged as the recording. */
async function stageTabOverDemo(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript(scoreSeed(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'Score to follow', exact: true }),
  ).toBeVisible()
}

test('offers to hang an attached tab on the staged recording @smoke', async ({
  page,
}) => {
  await stageTabOverDemo(page, `hand-offer-${Date.now()}`)

  // The room used to say only that this tab could not follow the recording.
  const offer = page.getByRole('button', {
    name: 'Place it on this recording by hand',
  })
  await expect(offer).toBeVisible()
  await offer.click()

  // Nothing has been placed yet — the reader has claimed a part, not sited it.
  await expect(page.getByText(/mark the part.s first note/)).toBeVisible()
})

test('marks the part against the recording and nudges it', async ({ page }) => {
  await stageTabOverDemo(page, `hand-mark-${Date.now()}`)
  await page
    .getByRole('button', { name: 'Place it on this recording by hand' })
    .click()
  // "Play along" is the room door when a tab is already attached.
  await page.getByRole('button', { name: 'Play along', exact: true }).click()

  const room = page.getByTestId('guitar-night-room')
  await room
    .getByLabel(/^Band, loop, and input controls/)
    .first()
    .click()

  const sync = room.getByRole('group', {
    name: 'Place Lead guitar on this recording',
  })
  await expect(sync).toBeVisible()
  await expect(sync.getByText('Nothing marked yet.')).toBeVisible()

  // No nudge until the part is actually somewhere.
  await expect(sync.getByRole('group', { name: 'Nudge the tab' })).toHaveCount(
    0,
  )

  await sync.getByRole('button', { name: 'First note here' }).click()
  await expect(
    sync.getByRole('button', { name: 'First note here' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(sync.getByText(/First note at/)).toBeVisible()

  // Placed, so it can be slid.
  const nudge = sync.getByRole('group', { name: 'Nudge the tab' })
  await expect(nudge).toBeVisible()
  await nudge
    .getByRole('button', { name: 'Move the tab 0.5 seconds later' })
    .click()

  // And taken back.
  await sync.getByRole('button', { name: 'Clear' }).click()
  await expect(sync.getByText('Nothing marked yet.')).toBeVisible()
  await expect(sync.getByRole('group', { name: 'Nudge the tab' })).toHaveCount(
    0,
  )
})
