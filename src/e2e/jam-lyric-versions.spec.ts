// ============================================================
// Jam room — the Original / Edited buttons and the song they belong to
// ============================================================
//
// Owner report (2026-09-19): the buttons put another song's words on the
// one that was loaded, and came and went as songs were switched. The
// component and the store are pinned in vitest; what only a real browser
// can show is the whole line from a stored lyric record to the words on
// the stage -- IndexedDB, the example's own id, the picker, the column --
// on the bundle that ships.
//
// The example song is the one used, because it is the one that lost its
// buttons: an example is loaded by its own id, not from a library row, and
// the picker only knew how to read a library row.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const DEMO_SESSION_ID = 'karaoke-night-demo'

const ORIGINAL =
  '[00:01.00] Original first line\n[00:05.00] Original second line'
const EDITED = '[00:01.40] Edited first line\n[00:05.30] Edited second line'

/**
 * Leave the example the way the mixer leaves a song somebody has corrected:
 * both versions stored, the Edited one in use.
 *
 * Replaces whatever the startup seeder wrote, in one transaction, so the
 * session has exactly one row whichever of the two got there first.
 */
async function storeBothVersions(page: Page): Promise<void> {
  await page.evaluate(
    async ({ sessionId, original, edited }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('MercuryPitchDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['uvrSessionLyrics'], 'readwrite')
          const store = tx.objectStore('uvrSessionLyrics')
          const existing = store.index('sessionId').getAllKeys(sessionId)
          existing.onsuccess = () => {
            for (const key of existing.result) store.delete(key)
            const now = new Date().toISOString()
            store.put({
              id: 'e2e-jam-lyric-versions',
              sessionId,
              text: edited,
              format: 'lrc',
              filename: 'e2e.lrc',
              activeVersionKind: 'edited',
              versionsJson: JSON.stringify([
                { kind: 'imported', text: original, createdAt: 1 },
                { kind: 'edited', text: edited, createdAt: 2 },
              ]),
              createdAt: now,
              updatedAt: now,
            })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { sessionId: DEMO_SESSION_ID, original: ORIGINAL, edited: EDITED },
  )
}

async function openRoom(page: Page): Promise<void> {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await storeBothVersions(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
}

async function pick(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page.getByRole('button', { name }).first().click()
}

test.describe('the words a room can choose between', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('an example opens on the version in use, and either can be chosen @smoke', async ({
    page,
  }) => {
    await openRoom(page)
    await pick(page, /Goodbye to Spring/)

    const original = page.getByRole('button', { name: 'Original', exact: true })
    const edited = page.getByRole('button', { name: 'Edited', exact: true })
    await expect(edited).toHaveAttribute('aria-pressed', 'true')
    await expect(original).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[data-line="0"]')).toHaveText(
      'Edited first line',
    )

    await original.click()
    await expect(original).toHaveAttribute('aria-pressed', 'true')
    await expect(edited).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[data-line="0"]')).toHaveText(
      'Original first line',
    )

    await edited.click()
    await expect(page.locator('[data-line="1"]')).toHaveText(
      'Edited second line',
    )
  })

  test('the buttons leave with the song and come back with it @smoke', async ({
    page,
  }) => {
    await openRoom(page)
    await pick(page, /Goodbye to Spring/)
    const original = page.getByRole('button', { name: 'Original', exact: true })
    await expect(original).toBeVisible()

    // A drill has no words to choose between, and must not inherit the
    // song's.
    await pick(page, /Long note/i)
    await expect(original).toHaveCount(0)

    await pick(page, /Goodbye to Spring/)
    await expect(original).toBeVisible()
    await original.click()
    await expect(page.locator('[data-line="0"]')).toHaveText(
      'Original first line',
    )
  })
})
