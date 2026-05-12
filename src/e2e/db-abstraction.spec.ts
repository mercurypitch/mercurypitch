// ============================================================
// Database Abstraction Layer E2E Tests
// Tests IndexedDB initialization, seed data, feature flags, and session persistence
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

/** Trigger DB creation by toggling a feature flag, then wait for IndexedDB to be ready. */
async function ensureDb(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const store = (window as any).__pp?.appStore
    if (store?.setDevFeaturesEnabled) {
      store.setDevFeaturesEnabled(true)
    }
    // Wait for the async persistFeatureFlag -> getDb() -> seedAll chain
    await new Promise((r) => setTimeout(r, 2000))
  })
}

/** Open MercuryPitchDB via raw IndexedDB and run a callback with the DB handle. */
async function withIndexedDB<T>(
  page: import('@playwright/test').Page,
  fn: string, // function body as a string that receives `db`
): Promise<T> {
  return page.evaluate(async (fnBody) => {
    const fn = new Function('db', fnBody) as (db: IDBDatabase) => T | Promise<T>
    return new Promise<T>((resolve, reject) => {
      const req = indexedDB.open('MercuryPitchDB')
      req.onsuccess = () => {
        const db = req.result
        try {
          const result = fn(db)
          if (result instanceof Promise) {
            result.then(
              (r) => {
                db.close()
                resolve(r)
              },
              (e) => {
                db.close()
                reject(e)
              },
            )
          } else {
            db.close()
            resolve(result)
          }
        } catch (e) {
          db.close()
          reject(e)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }, fn)
}

test.describe('Database Abstraction Layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  // ==========================================
  // DB Initialization Tests
  // ==========================================

  test('IndexedDB is created when feature flag is toggled', async ({
    page,
  }) => {
    await ensureDb(page)

    const dbExists = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.some((db) => db.name === 'MercuryPitchDB')
    })
    expect(dbExists).toBe(true)
  })

  test('MercuryPitchDB has expected object stores', async ({ page }) => {
    await ensureDb(page)

    const storeNames = await withIndexedDB<string[]>(
      page,
      'return Array.from(db.objectStoreNames)',
    )

    expect(storeNames).toContain('featureFlags')
    expect(storeNames).toContain('sessionRecords')
    expect(storeNames).toContain('challengeDefinitions')
    expect(storeNames).toContain('badgeDefinitions')
    expect(storeNames).toContain('achievements')
    expect(storeNames).toContain('leaderboardEntries')
  })

  test('Seed data flag is set after DB creation', async ({ page }) => {
    await ensureDb(page)

    const isSeeded = await withIndexedDB<boolean>(
      page,
      `const tx = db.transaction('featureFlags', 'readonly');
       const store = tx.objectStore('featureFlags');
       return new Promise((resolve, reject) => {
         const getReq = store.index('key').get('db_seeded_v1');
         getReq.onsuccess = () => resolve(getReq.result?.value === true);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )
    expect(isSeeded).toBe(true)
  })

  // ==========================================
  // Seed Data Tests
  // ==========================================

  test('Challenge definitions are seeded', async ({ page }) => {
    await ensureDb(page)

    const count = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('challengeDefinitions', 'readonly');
       const store = tx.objectStore('challengeDefinitions');
       return new Promise((resolve, reject) => {
         const countReq = store.count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Badge definitions are seeded', async ({ page }) => {
    await ensureDb(page)

    const count = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('badgeDefinitions', 'readonly');
       const store = tx.objectStore('badgeDefinitions');
       return new Promise((resolve, reject) => {
         const countReq = store.count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Achievement definitions are seeded', async ({ page }) => {
    await ensureDb(page)

    const count = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('achievements', 'readonly');
       const store = tx.objectStore('achievements');
       return new Promise((resolve, reject) => {
         const countReq = store.count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Leaderboard entries are seeded', async ({ page }) => {
    await ensureDb(page)

    const count = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('leaderboardEntries', 'readonly');
       const store = tx.objectStore('leaderboardEntries');
       return new Promise((resolve, reject) => {
         const countReq = store.count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('User profile is seeded', async ({ page }) => {
    await ensureDb(page)

    const count = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('userProfiles', 'readonly');
       const store = tx.objectStore('userProfiles');
       return new Promise((resolve, reject) => {
         const countReq = store.count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Seed is idempotent — reload does not duplicate data', async ({
    page,
  }) => {
    await ensureDb(page)

    const count1 = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('challengeDefinitions', 'readonly');
       return new Promise((resolve, reject) => {
         const countReq = tx.objectStore('challengeDefinitions').count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )

    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    await ensureDb(page)

    const count2 = await withIndexedDB<number>(
      page,
      `const tx = db.transaction('challengeDefinitions', 'readonly');
       return new Promise((resolve, reject) => {
         const countReq = tx.objectStore('challengeDefinitions').count();
         countReq.onsuccess = () => resolve(countReq.result);
         countReq.onerror = () => reject(countReq.error);
       })`,
    )

    expect(count2).toBe(count1)
  })

  // ==========================================
  // Feature Flag Persistence Tests
  // ==========================================

  test('Feature flags are persisted to IndexedDB', async ({ page }) => {
    // Toggle dev features on via bridge
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setDevFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 2000))
    })

    const flagValue = await withIndexedDB<boolean | null>(
      page,
      `const tx = db.transaction('featureFlags', 'readonly');
       const store = tx.objectStore('featureFlags');
       return new Promise((resolve, reject) => {
         const getReq = store.index('key').get('pitchperfect_dev_features');
         getReq.onsuccess = () => resolve(getReq.result?.value ?? null);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )
    expect(flagValue).toBe(true)
  })

  test('Feature flags survive page reload', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 2000))
    })

    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    const flagValue = await withIndexedDB<boolean | null>(
      page,
      `const tx = db.transaction('featureFlags', 'readonly');
       const store = tx.objectStore('featureFlags');
       return new Promise((resolve, reject) => {
         const getReq = store.index('key').get('pitchperfect_advanced_features');
         getReq.onsuccess = () => resolve(getReq.result?.value ?? null);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )
    expect(flagValue).toBe(true)
  })

  test('Feature flags can be toggled off', async ({ page }) => {
    // Set on first
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setDevFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 1000))
      ;(window as any).__pp?.appStore?.setDevFeaturesEnabled(false)
      await new Promise((r) => setTimeout(r, 1000))
    })

    const flagValue = await withIndexedDB<boolean | null>(
      page,
      `const tx = db.transaction('featureFlags', 'readonly');
       const store = tx.objectStore('featureFlags');
       return new Promise((resolve, reject) => {
         const getReq = store.index('key').get('pitchperfect_dev_features');
         getReq.onsuccess = () => resolve(getReq.result?.value ?? null);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )
    expect(flagValue).toBe(false)
  })

  test('Feature flag state in DB can be synced to signals via initFeatureFlagsFromDb', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 2000))
    })

    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // initFeatureFlagsFromDb() is the public API to sync DB→signals.
    // It is not called automatically on startup (IS_DEV=false in prod builds).
    await page.evaluate(async () => {
      await (window as any).__pp?.appStore?.initFeatureFlagsFromDb()
    })

    const signalValue = await page.evaluate(() => {
      return (window as any).__pp?.appStore?.advancedFeaturesEnabled?.()
    })
    expect(signalValue).toBe(true)
  })

  // ==========================================
  // Session Record Persistence Tests
  // ==========================================

  test('Session records store exists and accepts data', async ({ page }) => {
    await ensureDb(page)

    const writeOk = await withIndexedDB<boolean>(
      page,
      `const tx = db.transaction('sessionRecords', 'readwrite');
       const store = tx.objectStore('sessionRecords');
       const record = {
         id: 'e2e-test-' + Date.now(),
         userId: 'e2e-user',
         melodyName: 'E2E Test Session',
         score: 85,
         accuracy: 0.92,
         streak: 3,
         results: JSON.stringify([{ note: 'C4', hit: true }]),
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
       };
       return new Promise((resolve, reject) => {
         const addReq = store.add(record);
         addReq.onsuccess = () => resolve(true);
         addReq.onerror = () => resolve(false);
       })`,
    )
    expect(writeOk).toBe(true)
  })

  test('Session records can be read after write', async ({ page }) => {
    await ensureDb(page)
    const testId = `e2e-read-test-${Date.now()}`

    // Write a record
    await page.evaluate(async (id) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('MercuryPitchDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('sessionRecords', 'readwrite')
          tx.objectStore('sessionRecords').add({
            id,
            userId: 'e2e-user',
            melodyName: 'E2E Read Test',
            score: 90,
            accuracy: 0.95,
            streak: 5,
            results: JSON.stringify([]),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    }, testId)

    // Read it back
    const record = await withIndexedDB<any>(
      page,
      `const tx = db.transaction('sessionRecords', 'readonly');
       return new Promise((resolve, reject) => {
         const getReq = tx.objectStore('sessionRecords').get('${testId}');
         getReq.onsuccess = () => resolve(getReq.result);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )

    expect(record).not.toBeNull()
    expect(record.melodyName).toBe('E2E Read Test')
    expect(record.score).toBe(90)
  })

  test('Session records store supports multiple records', async ({ page }) => {
    await ensureDb(page)
    const baseId = `e2e-multi-${Date.now()}`

    const count = await page.evaluate(async (bid) => {
      return new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('MercuryPitchDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('sessionRecords', 'readwrite')
          const store = tx.objectStore('sessionRecords')
          for (let i = 0; i < 3; i++) {
            store.add({
              id: `${bid}-${i}`,
              userId: 'e2e-user',
              melodyName: `Multi Test ${i}`,
              score: 70 + i * 10,
              accuracy: 0.8 + i * 0.05,
              streak: i,
              results: JSON.stringify([]),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
          tx.oncomplete = () => {
            const ct = db.transaction('sessionRecords', 'readonly')
            const cr = ct.objectStore('sessionRecords').count()
            cr.onsuccess = () => {
              db.close()
              resolve(cr.result)
            }
            cr.onerror = () => {
              db.close()
              reject(cr.error)
            }
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    }, baseId)

    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('Challenge progress store is writable', async ({ page }) => {
    await ensureDb(page)

    const writeOk = await withIndexedDB<boolean>(
      page,
      `const tx = db.transaction('challengeProgress', 'readwrite');
       const store = tx.objectStore('challengeProgress');
       return new Promise((resolve, reject) => {
         const addReq = store.add({
           id: 'e2e-cp-' + Date.now(),
           userId: 'e2e-user',
           challengeId: 'test-challenge',
           progress: 50,
           status: 'in_progress',
           completed: false,
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
         });
         addReq.onsuccess = () => resolve(true);
         addReq.onerror = () => resolve(false);
       })`,
    )
    expect(writeOk).toBe(true)
  })

  test('User badges store is writable', async ({ page }) => {
    await ensureDb(page)

    const writeOk = await withIndexedDB<boolean>(
      page,
      `const tx = db.transaction('userBadges', 'readwrite');
       const store = tx.objectStore('userBadges');
       return new Promise((resolve, reject) => {
         const addReq = store.add({
           id: 'e2e-ub-' + Date.now(),
           userId: 'e2e-user',
           badgeId: 'test-badge',
           earnedAt: new Date().toISOString(),
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
         });
         addReq.onsuccess = () => resolve(true);
         addReq.onerror = () => resolve(false);
       })`,
    )
    expect(writeOk).toBe(true)
  })

  test('Shared melodies store is writable', async ({ page }) => {
    await ensureDb(page)

    const writeOk = await withIndexedDB<boolean>(
      page,
      `const tx = db.transaction('sharedMelodies', 'readwrite');
       const store = tx.objectStore('sharedMelodies');
       return new Promise((resolve, reject) => {
         const addReq = store.add({
           id: 'e2e-sm-' + Date.now(),
           userId: 'e2e-user',
           melodyName: 'E2E Shared Melody',
           itemsJson: '[]',
           isPublic: true,
           tags: ['test'],
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
         });
         addReq.onsuccess = () => resolve(true);
         addReq.onerror = () => resolve(false);
       })`,
    )
    expect(writeOk).toBe(true)
  })

  // ==========================================
  // User Settings Persistence Tests
  // ==========================================

  test('User settings can be stored and retrieved', async ({ page }) => {
    await ensureDb(page)
    const settingId = `e2e-setting-${Date.now()}`

    // Write setting
    await page.evaluate(async (id) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('MercuryPitchDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('userSettings', 'readwrite')
          tx.objectStore('userSettings').add({
            id,
            userId: 'e2e-user',
            key: 'test_setting',
            value: JSON.stringify({ foo: 'bar', num: 42 }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    }, settingId)

    // Read it back
    const value = await withIndexedDB<string>(
      page,
      `const tx = db.transaction('userSettings', 'readonly');
       return new Promise((resolve, reject) => {
         const getReq = tx.objectStore('userSettings').get('${settingId}');
         getReq.onsuccess = () => resolve(getReq.result?.value);
         getReq.onerror = () => reject(getReq.error);
       })`,
    )

    const parsed = JSON.parse(value)
    expect(parsed.foo).toBe('bar')
    expect(parsed.num).toBe(42)
  })

  // ==========================================
  // Hidden Feature Tab Visibility Tests
  // ==========================================

  test('Hidden feature tabs appear when advanced features enabled', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 500))
    })

    await expect(page.locator('#tab-challenges')).toBeVisible()
    await expect(page.locator('#tab-leaderboard')).toBeVisible()
    await expect(page.locator('#tab-community')).toBeVisible()
    await expect(page.locator('#tab-analysis')).toBeVisible()
  })

  test('Hidden feature tabs hidden when advanced features disabled', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(false)
      await new Promise((r) => setTimeout(r, 500))
    })

    await expect(page.locator('#tab-challenges')).not.toBeVisible()
  })

  test('Can navigate to Challenges tab when enabled', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 500))
    })

    await switchTab(page, 'challenges')
    await expect(page.locator('#tab-challenges.active')).toBeVisible()
  })

  test('Can navigate to Leaderboard tab when enabled', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 500))
    })

    await switchTab(page, 'leaderboard')
    await expect(page.locator('#tab-leaderboard.active')).toBeVisible()
  })

  test('Can navigate to Community tab when enabled', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 500))
    })

    await switchTab(page, 'community')
    await expect(page.locator('#tab-community.active')).toBeVisible()
  })

  test('Can navigate to Analysis tab when enabled', async ({ page }) => {
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 500))
    })

    await switchTab(page, 'analysis')
    await expect(page.locator('#tab-analysis.active')).toBeVisible()
  })

  test('Feature flag changes take effect without reload', async ({ page }) => {
    // Disable first
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(false)
      await new Promise((r) => setTimeout(r, 300))
    })
    await expect(page.locator('#tab-challenges')).not.toBeVisible()

    // Enable
    await page.evaluate(async () => {
      ;(window as any).__pp?.appStore?.setAdvancedFeaturesEnabled(true)
      await new Promise((r) => setTimeout(r, 300))
    })
    await expect(page.locator('#tab-challenges')).toBeVisible()
  })
})
