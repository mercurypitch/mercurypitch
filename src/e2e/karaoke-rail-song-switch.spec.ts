// ============================================================
// The Karaoke rail opens the song you tapped — audio included
// ============================================================
//
// Reported: tapping a song in the sidebar rail "reloads" the whole tab
// (the Suspense boundary swapped everything for the page skeleton), and
// the mixer that came back kept playing the PREVIOUS song's audio — each
// tap loaded the song one behind the one asked for.
//
// The mixer's own drawer had coverage (`stem-mixer-controls.spec.ts`
// scopes itself to it, noting the rail lists the same songs); the rail
// path — hash navigation through `handleSessionView` — had none. This
// spec pins all three properties at once: the right session in the URL,
// the right audio's duration on the stage, and no full-page fallback or
// reload between songs.
//
// Durations are the fingerprint: each seeded song is a tone of a
// different length, so "0:04 on screen" can only come from the song
// that was actually decoded, never from stale chrome.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

interface SongSeed {
  seedSong: (input: {
    name: string
    fileHash: string
    vocalWavBase64: string
  }) => Promise<string>
}

function toneWavBase64(seconds: number, hz: number): string {
  const rate = 8000
  const samples = Math.floor(rate * seconds)
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) {
    buf.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * hz * index) / rate) * 8000),
      44 + index * 2,
    )
  }
  return buf.toString('base64')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(
    () =>
      (window as unknown as { __ppSongSeed?: unknown }).__ppSongSeed !==
      undefined,
  )
  await page.evaluate(
    async (songs) => {
      const seeder = (window as unknown as { __ppSongSeed: SongSeed })
        .__ppSongSeed
      for (const song of songs) await seeder.seedSong(song)
    },
    [
      {
        name: 'Rail Song Two',
        fileHash: 'rail-song-two',
        vocalWavBase64: toneWavBase64(2, 330),
      },
      {
        name: 'Rail Song Four',
        fileHash: 'rail-song-four',
        vocalWavBase64: toneWavBase64(4, 440),
      },
    ],
  )
  await page.goto('/#/karaoke')
  await dismissOverlays(page)
})

test('a rail tap lands on that song, and the next tap swaps the audio with it', async ({
  page,
}) => {
  // Anything that would look like a crash gets counted, not eyeballed: a
  // Suspense fallback inserts the tab skeleton, a real reload loses the
  // marker.
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>
    win.__railMarker = 'alive'
    win.__skeletonSeen = 0
    // The added nodes, not the live DOM: callbacks are delivered at a
    // microtask checkpoint after the task finishes, so a fallback that is
    // inserted and removed inside one task leaves nothing to query and a
    // re-query would report the flash as never having happened — passing on
    // exactly the case this counts.
    const isSkeleton = (node: Node): boolean => {
      if (!(node instanceof HTMLElement)) return false
      return (
        node.className.includes('skeletonTabContent') ||
        node.querySelector('[class*="skeletonTabContent"]') !== null
      )
    }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (isSkeleton(node)) {
            win.__skeletonSeen = (win.__skeletonSeen as number) + 1
          }
        }
      }
    })
    observer.observe(document.body, { subtree: true, childList: true })
  })

  const railRow = (name: string) =>
    page.getByTitle(`Open "${name}" on the stage`)

  await railRow('Rail Song Two').click()
  await expect(page).toHaveURL(/#\/karaoke\/session\/[^/]+\/mixer$/)
  const header = page.locator('.sm-header')
  await expect(header).toContainText('Rail Song Two', { timeout: 15_000 })
  await expect(header).toContainText('0:02', { timeout: 15_000 })

  // The switch under test: a second rail tap from INSIDE the mixer.
  await railRow('Rail Song Four').click()
  await expect(header).toContainText('Rail Song Four', { timeout: 15_000 })
  // The duration can only come from the newly decoded audio — the stale
  // mixer kept the old song's 0:02 here.
  await expect(header).toContainText('0:04', { timeout: 15_000 })

  const aftermath = await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>
    return {
      marker: win.__railMarker ?? 'GONE',
      skeletonSeen: win.__skeletonSeen ?? 'observer lost',
    }
  })
  expect(aftermath.marker, 'the tab reloaded the whole app').toBe('alive')
  expect(
    aftermath.skeletonSeen,
    'the Karaoke tab fell back to its skeleton mid-switch',
  ).toBe(0)
})
