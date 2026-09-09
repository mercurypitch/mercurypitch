// ============================================================
// Two tabs, one database, one schema bump
// ============================================================
// Reproduced on a real device on 2026-09-09: six tabs open on the same origin,
// the database pinned at IndexedDB version 80 while the deployed app wanted
// 120, and a versionless open that never returned. The app looked like it was
// re-indexing a large library for over ten minutes. It was not working at all;
// closing the other tabs let the upgrade finish, after which the database
// opened in 2 ms.
//
// The cause was not a missing handler. Dexie ships one, and it closes the
// connection — with `disableAutoOpen: false`, so the NEXT query in that tab
// reopens at the old version and blocks the upgrade again.
//
// That last sentence is the whole test design. A tab sitting idle upgrades
// fine either way, which is why the first version of this spec passed against
// the unfixed build and proved nothing. The tab has to be doing database work
// while the other connection tries to upgrade. `__ppDatabase.read()` is that
// work, and the loop below is the live query a real room always has running.

import { expect, test } from '@playwright/test'

const DB = 'MercuryPitchDB'

/** The schema the shipped app opens. Dexie's version 12 is IndexedDB's 120. */
const APP_VERSION = 120

declare global {
  interface Window {
    __ppDatabase?: {
      lifecycle: () => string
      read: () => Promise<string>
    }
    __probeStop?: () => void
  }
}

async function openApp(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  // The bridge is what makes this tab's database work drivable.
  await page.waitForFunction(() => window.__ppDatabase !== undefined, null, {
    timeout: 30_000,
  })
  await expect
    .poll(
      () =>
        page.evaluate(async (name) => {
          const dbs = await indexedDB.databases()
          return dbs.some((d) => d.name === name)
        }, DB),
      { timeout: 20_000 },
    )
    .toBe(true)
}

test.describe('multi-tab database upgrade', () => {
  test('a busy tab still lets another connection upgrade @smoke', async ({
    page,
  }) => {
    await openApp(page)

    const result = await page.evaluate(
      async ({ name, version }) => {
        // The live tab: keep querying, exactly as a room with a reactive query
        // does. Before the fix each read reopened the old version and pushed
        // the upgrade back behind it, forever.
        let running = true
        const reads: string[] = []
        const loop = (async () => {
          while (running) {
            reads.push(await (window.__ppDatabase?.read() ?? 'no-bridge'))
            await new Promise((r) => setTimeout(r, 25))
          }
        })()

        const outcome = await new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve('blocked-forever'), 20_000)
          const request = indexedDB.open(name, version + 10)
          request.onsuccess = () => {
            clearTimeout(timer)
            const got = request.result.version
            request.result.close()
            resolve(`upgraded-to-${got}`)
          }
          request.onerror = () => {
            clearTimeout(timer)
            resolve(`error-${request.error?.name ?? 'unknown'}`)
          }
        })

        running = false
        await loop
        return {
          outcome,
          lifecycle: window.__ppDatabase?.lifecycle() ?? 'no-bridge',
          reads: reads.length,
        }
      },
      { name: DB, version: APP_VERSION },
    )

    // The regression, in one assertion. Against the unfixed build this is
    // `blocked-forever`: the read loop keeps reopening version 120 and the
    // upgrade to 130 never starts.
    expect(result.outcome).toBe(`upgraded-to-${APP_VERSION + 10}`)
    // And the tab knows why it can no longer read, so the UI can say so.
    expect(result.lifecycle).toBe('superseded')
    // The loop really did run; a zero here would mean the test proved nothing.
    expect(result.reads).toBeGreaterThan(0)
  })

  test('the superseded tab stops reopening the old version', async ({
    page,
  }) => {
    await openApp(page)

    await page.evaluate(
      async ({ name, version }) => {
        await new Promise<void>((resolve) => {
          const request = indexedDB.open(name, version + 10)
          request.onsuccess = () => {
            request.result.close()
            resolve()
          }
          request.onerror = () => resolve()
          setTimeout(resolve, 20_000)
        })
      },
      { name: DB, version: APP_VERSION },
    )

    // Keep asking the app to read. A connection that still auto-opens would
    // drag the database back down to the old version here.
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.evaluate(() => window.__ppDatabase?.read())
      await page.waitForTimeout(50)
    }

    const version = await page.evaluate(async (name) => {
      const dbs = await indexedDB.databases()
      return dbs.find((d) => d.name === name)?.version ?? null
    }, DB)

    expect(version).toBe(APP_VERSION + 10)
    expect(await page.evaluate(() => window.__ppDatabase?.lifecycle())).toBe(
      'superseded',
    )
  })

  test('an upgrade held up by another connection reports blocked, then completes', async ({
    page,
  }) => {
    await openApp(page)

    const result = await page.evaluate(
      async ({ name, version }) => {
        // A second connection standing in for the tab that has not reloaded.
        const holder = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(name)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        let sawBlocked = false
        const finalVersion = await new Promise<number>((resolve, reject) => {
          const request = indexedDB.open(name, version + 20)
          request.onblocked = () => {
            sawBlocked = true
            // Releasing it is what a visitor does by closing that tab.
            holder.close()
          }
          request.onsuccess = () => {
            const v = request.result.version
            request.result.close()
            resolve(v)
          }
          request.onerror = () => reject(request.error)
        })

        return { sawBlocked, finalVersion }
      },
      { name: DB, version: APP_VERSION },
    )

    // Both halves matter: the browser really did report blocked, and closing
    // the other connection really did let it through. That is the advice the
    // rooms now give while they wait, proven end to end.
    expect(result.sawBlocked).toBe(true)
    expect(result.finalVersion).toBe(APP_VERSION + 20)
  })
})
