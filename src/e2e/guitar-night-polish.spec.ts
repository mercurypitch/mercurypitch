// ============================================================
// Guitar Night polish — the lobby scrolls twice, the room's note cannot go
// ============================================================
//
// Four reports, one sitting, all of them about the same two screens:
//
//   "the guitar night page on desktop itself scrolls, and twice? it seems,
//    in chrome, when there is song library shown"
//   "in the room itself, it says, attach tab to play along, but I don't have
//    any option to attach it afterwards"
//   "that note needs to be closeable, especially on the mobile. Its hiding
//    half the screen"
//
// Each assertion below fails against the code as reported and passes after
// the fix; the comment on each says which half of the report it stands for.

import { expect, test } from '@playwright/test'

const DESKTOP = { width: 1920, height: 1004 }
const PHONE = { width: 390, height: 844 }

function scoreSeed() {
  return (seededSongId: string) => {
    const notes = Array.from({ length: 16 }, (_, index) => ({
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

/** Every element that can actually scroll, the page box included. */
async function scrollers(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const found: string[] = []
    const root = document.scrollingElement ?? document.documentElement
    if (root.scrollHeight - root.clientHeight > 1) found.push('document')
    for (const element of document.querySelectorAll('*')) {
      const node = element as HTMLElement
      if (node.scrollHeight - node.clientHeight <= 1) continue
      const overflowY = getComputedStyle(node).overflowY
      if (overflowY !== 'auto' && overflowY !== 'scroll') continue
      const className =
        typeof node.className === 'string' ? node.className : '(svg)'
      found.push(`${node.tagName.toLowerCase()}.${className}`)
    }
    return found
  })
}

test('the desktop lobby scrolls once, in one place @smoke', async ({
  page,
}) => {
  // THE REGRESSION. `.app` carried `overflow-y: auto` while the decorative
  // backdrop under it was `transform: scale(1.015)` over `inset: 0`. The
  // scaled bleed is overflow like any other, so the shell grew its own
  // scrollbar beside the page's — two bars, one page, neither wanted.
  const songId = `polish-score-${Date.now()}`
  await page.addInitScript(scoreSeed(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()

  // What was reported is two bars, so what is asserted is two bars: the shell
  // must not be a scroll container, and the page must not need more than one
  // scroller in total. (The shell still *contains* the 17px of scaled
  // backdrop — `overflow: clip` cuts it without offering to scroll to it, so
  // measuring `scrollHeight` here would test the bleed, not the bug.)
  const found = await scrollers(page)
  expect(found.filter((entry) => entry.includes('_app'))).toEqual([])
  expect(found.length).toBeLessThanOrEqual(1)
})

test('the desktop lobby fits the screen it was opened on @smoke', async ({
  page,
}) => {
  // "ideally no scroll at all, and maybe all elements compact and to fit in
  // current height of that desktop screen size." The column that can grow
  // without bound is the song list, so that is the one that scrolls; the
  // page itself must not.
  const songId = `polish-fit-${Date.now()}`
  await page.addInitScript(scoreSeed(), songId)
  await page.setViewportSize(DESKTOP)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()

  expect(await scrollers(page)).not.toContain('document')
})

/** The demo row is one button whose name is the whole row, not an "Open". */
async function openDemoSong(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Prepared songs', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
}

/** Reach the play-along room the way the report did: a tab attached in the
    lobby, then the demo song opened as the backing. */
async function enterRoomWithAttachedTab(
  page: import('@playwright/test').Page,
  songId: string,
): Promise<void> {
  await page.addInitScript(scoreSeed(), songId)
  await page.goto(`/guitar-night?song=${encodeURIComponent(songId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await openDemoSong(page)
  await page.getByRole('button', { name: 'Play along', exact: true }).click()
}

test('the room owns up to the tab it was given @smoke', async ({ page }) => {
  // THE REPORT. "in the room itself, it says, attach tab to play along, but I
  // don't have any option to attach it afterwards" — said while a tab WAS
  // attached. The play-along room guides only with a line measured from this
  // recording, so an authored tab genuinely cannot drive it; what was wrong
  // was the note asking again for what it already had, and offering no way on.
  const songId = `polish-room-${Date.now()}`
  await page.setViewportSize(DESKTOP)
  await enterRoomWithAttachedTab(page, songId)

  const note = page.getByTestId('guitar-night-free-play-note')
  await expect(note).toBeVisible()
  await expect(note).not.toContainText('Attach a tab or turn on Listening')
  await expect(note).toContainText('Velvet pointer study')
  await expect(
    note.getByRole('button', { name: 'Rehearse the tab', exact: true }),
  ).toBeVisible()
})

test('the room note closes, and stays closed @smoke', async ({ page }) => {
  // "that note needs to be closeable, especially on the mobile. Its hiding
  // half the screen." A hint that comes back every visit is the same
  // complaint again, so the dismissal is persisted.
  const songId = `polish-close-${Date.now()}`
  await page.setViewportSize(PHONE)
  await enterRoomWithAttachedTab(page, songId)

  const note = page.getByTestId('guitar-night-free-play-note')
  await expect(note).toBeVisible()

  // It must not swallow the fretboard behind it.
  const share = await note.evaluate(
    (element) => element.getBoundingClientRect().height / window.innerHeight,
  )
  expect(share).toBeLessThan(0.3)

  await note
    .getByRole('button', { name: 'Dismiss the free play note', exact: true })
    .click()
  await expect(note).toHaveCount(0)

  // Back in on a cold load. The URL restores the selection, so the lobby may
  // open straight on the song rather than on the library.
  await page.reload({ waitUntil: 'domcontentloaded' })
  const playAlong = page.getByRole('button', {
    name: 'Play along',
    exact: true,
  })
  const loadASong = page.getByRole('button', {
    name: 'Load a song',
    exact: true,
  })
  await expect(playAlong.or(loadASong).first()).toBeVisible()
  if ((await playAlong.count()) === 0) {
    await loadASong.click()
    await openDemoSong(page)
  }
  await playAlong.click()
  await expect(page.getByTestId('guitar-night-free-play-note')).toHaveCount(0)
})

test('with no tab attached the note offers to get one @smoke', async ({
  page,
}) => {
  // The other half of the same note. Free play with nothing attached is a
  // legitimate state, and there the original copy was right — what it lacked
  // was any way to act on it without hunting back through the lobby.
  await page.setViewportSize(DESKTOP)
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await openDemoSong(page)
  await page.getByRole('button', { name: 'Enter room', exact: true }).click()

  const note = page.getByTestId('guitar-night-free-play-note')
  await expect(note).toContainText('Attach a tab or turn on Listening')
  const attach = note.getByRole('button', { name: 'Attach a tab', exact: true })
  await expect(attach).toBeVisible()

  // It has to actually go somewhere — the lobby owns the file drop.
  await attach.click()
  await expect(
    page.getByRole('heading', { name: 'Score to follow', exact: true }),
  ).toBeVisible()
})

test('dresses its own scrollbar instead of the platform one @smoke', async ({
  page,
}) => {
  // Guitar Night is a standalone entry and never loads `src/styles/app.css`,
  // which is where the shared `::-webkit-scrollbar` treatment lives. So the
  // one scroll the lobby has came up as the raw platform scrollbar against a
  // lamplit room: "its ugly, instead of our nice app scrolls".
  await page.setViewportSize(DESKTOP)
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await openDemoSong(page)

  const skin = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (main === null) return null
    const style = getComputedStyle(main)
    return {
      width: style.getPropertyValue('scrollbar-width').trim(),
      color: style.getPropertyValue('scrollbar-color').trim(),
      gutter: style.getPropertyValue('scrollbar-gutter').trim(),
    }
  })
  expect(skin?.width).toBe('thin')
  expect(skin?.color).not.toBe('auto')
  expect(skin?.color).toContain('224')
  // Not cosmetic: a bar that appears must not narrow the content, or the
  // content can shorten, drop the bar, and start the loop again.
  expect(skin?.gutter).toBe('stable')
})
