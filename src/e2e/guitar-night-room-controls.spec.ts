// ============================================================
// The room a take had locked, and the band nobody could hear
// ============================================================
//
// Reported 2026-08-20, against a five-part Guitar Pro file:
//
//   "there is no way to control the other tracks mute/hear, and by default all
//    others are muted. But usually it should be other way around, we should
//    play all but the scored against so user can play"
//   "'turn on listening' is disabled button, cannot turn it on, as is the
//    'count' click metronome, it plays in background and cannot be adjusted"
//   "I tried to switch between 'score' track ... once I am in, it doesn't
//    allow me"
//
// All three were one room: the first Play pinned the setup, and Play/Pause was
// the only transport, so nothing let go of it again.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1440, height: 900 }

/** Three parts on two instruments — a band, and a part to play against it. */
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
              noteCount: 16,
              notes: part(64, 16, 1),
            },
            {
              id: 'track-rhythm',
              name: 'Rhythm guitar',
              instrumentName: 'Clean Guitar',
              noteCount: 12,
              notes: part(52, 12, 1.5),
            },
            {
              id: 'track-bass',
              name: 'Bass',
              instrumentName: 'Electric Bass',
              noteCount: 8,
              notes: part(33, 8, 2),
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
    .getByRole('button', { name: 'Rehearse the tab', exact: true })
    .click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
}

/** Listening, the click and the count-in live behind the session summary. */
async function openSessionControls(
  page: import('@playwright/test').Page,
): Promise<void> {
  const opened = await page.evaluate(() => {
    const summary = document.querySelector(
      'summary[aria-label="Session controls"], summary[aria-label="Listening is on"], summary[aria-label="Calibrating input"]',
    )
    const details = summary?.closest('details')
    if (details === null || details === undefined) return false
    details.open = true
    return true
  })
  expect(opened).toBe(true)
}

test('plays the rest of the band, and lets any of it be muted @smoke', async ({
  page,
}) => {
  await openTheRoom(page, `room-band-${Date.now()}`)

  const listeningMix = page.getByRole('group', {
    name: 'Listening playback mix',
  })
  await expect(
    listeningMix.getByRole('button', { name: 'Mute backing parts' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    listeningMix.getByRole('button', { name: 'Hear target guide' }),
  ).toHaveAttribute('aria-pressed', 'false')

  // Coarse Target and Backing controls are explicit mix choices. They do not
  // rewrite the individual M/S state that Session owns.
  await listeningMix.getByRole('button', { name: 'Mute backing parts' }).click()
  await listeningMix.getByRole('button', { name: 'Hear target guide' }).click()
  await expect(
    listeningMix.getByRole('button', { name: 'Hear backing parts' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    listeningMix.getByRole('button', { name: 'Mute target guide' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Session reports the same coarse bus truth; the individual M/S choices
  // underneath it are retained while the bus is quiet.
  await page.getByTestId('guitar-night-session-trigger').click()
  let panel = page.getByTestId('guitar-night-session-panel')
  const restoreBacking = panel.getByRole('button', {
    name: 'Hear selected backing parts',
  })
  await expect(restoreBacking).toHaveAttribute('aria-pressed', 'false')
  await expect(panel.getByLabel('Mute Rhythm guitar')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await restoreBacking.click()
  await panel.getByRole('button', { name: 'Close the session details' }).click()

  await listeningMix.getByRole('button', { name: 'Mute target guide' }).click()

  // THE REPORT: every part but the scored one was silent, with no control.
  await page.getByTestId('guitar-night-session-trigger').click()
  panel = page.getByTestId('guitar-night-session-panel')
  await expect(panel.getByLabel('Mute Rhythm guitar')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(panel.getByLabel('Mute Bass')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  // The part being scored is the player's to play, so it is quiet by default.
  await expect(panel.getByLabel('Unmute Lead guitar')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(panel.getByLabel('Unmute Lead guitar')).toBeDisabled()

  await panel.getByLabel('Mute Bass').click()
  await expect(panel.getByLabel('Unmute Bass')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('lets the click be quieted before a take @smoke', async ({ page }) => {
  await openTheRoom(page, `room-click-${Date.now()}`)
  await openSessionControls(page)

  const session = page.getByLabel('Room tools')
  const click = session.getByRole('button', {
    name: 'Turn playback click off',
    exact: true,
  })
  await expect(click).toBeVisible()
  await click.click()
  await expect(
    session.getByRole('button', {
      name: 'Turn playback click on',
      exact: true,
    }),
  ).toBeVisible()
})

test('gives a take a way out, so the room is not locked for good @smoke', async ({
  page,
}) => {
  await openTheRoom(page, `room-stop-${Date.now()}`)
  await openSessionControls(page)

  const listening = page.getByRole('button', { name: 'Turn on Listening' })
  await expect(listening).toBeEnabled()

  await page.getByRole('button', { name: /Start the count-in/ }).click()
  const end = page.getByRole('button', { name: 'End the take' })
  await expect(end).toBeVisible()

  // Configuration stays reachable during a take; using it parks the run at
  // the current playhead instead of leaving the room locked.
  await openSessionControls(page)
  await expect(listening).toBeEnabled()

  await end.click()
  await openSessionControls(page)
  await expect(listening).toBeEnabled()
  await expect(page.getByRole('button', { name: 'End the take' })).toHaveCount(
    0,
  )
})

test('reads another part when asked to during a take @smoke', async ({
  page,
}) => {
  await openTheRoom(page, `room-switch-${Date.now()}`)
  const room = page.getByTestId('guitar-night-score-room')
  await expect(room.getByText(/Tab rehearsal · Lead guitar/)).toBeVisible()

  await page.getByRole('button', { name: /Start the count-in/ }).click()
  await expect(page.getByRole('button', { name: 'End the take' })).toBeVisible()

  // THE REGRESSION: this used to be swallowed by the take's pinned snapshot,
  // and stayed swallowed after the take ended.
  await page.getByTestId('guitar-night-session-trigger').click()
  await page
    .getByTestId('guitar-night-session-panel')
    .getByTestId('guitar-night-session-track')
    .filter({ hasText: 'Bass' })
    .click()

  await expect(room.getByText(/Tab rehearsal · Bass/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'End the take' })).toHaveCount(
    0,
  )
})
