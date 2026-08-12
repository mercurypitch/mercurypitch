import type { CDPSession, Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

const USER_ID = 'e2e-progress-tablet-user'
const BADGE_COUNT = 8
const LAST_BADGE_NAME = `Tablet test badge ${BADGE_COUNT}`

const dispatchTouch = async (
  session: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x?: number,
  y?: number,
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints:
      type === 'touchEnd'
        ? []
        : [
            {
              x: x ?? 0,
              y: y ?? 0,
              id: 1,
              radiusX: 8,
              radiusY: 8,
              force: 1,
            },
          ],
  })
}

const ensureLocalDb = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const store = (
      window as Window & {
        __pp?: { appStore?: { setDevFeaturesEnabled?: (on: boolean) => void } }
      }
    ).__pp?.appStore
    store?.setDevFeaturesEnabled?.(true)
  })

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases()
        return databases.some((database) => database.name === 'MercuryPitchDB')
      }),
    )
    .toBe(true)
}

const seedEarnedBadges = async (page: Page): Promise<void> => {
  await page.evaluate(
    async ({ badgeCount, userId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      try {
        const transaction = database.transaction(
          ['badgeDefinitions', 'userBadges'],
          'readwrite',
        )
        const definitions = transaction.objectStore('badgeDefinitions')
        const earnedBadges = transaction.objectStore('userBadges')

        for (let index = 1; index <= badgeCount; index += 1) {
          const badgeId = `e2e-progress-tablet-badge-${index}`
          const earnedAt = new Date(
            Date.UTC(2026, 7, 12, 12 - index),
          ).toISOString()

          definitions.put({
            id: badgeId,
            name: `Tablet test badge ${index}`,
            description: `Earned milestone ${index} for tablet shelf verification.`,
            icon: 'leaf',
            tier: 'bronze',
            category: 'e2e',
            unlockCondition: 'E2E fixture only',
            sortOrder: 10_000 + index,
            createdAt: earnedAt,
            updatedAt: earnedAt,
          })
          earnedBadges.put({
            id: `e2e-progress-tablet-earned-${index}`,
            userId,
            badgeId,
            earnedAt,
            createdAt: earnedAt,
            updatedAt: earnedAt,
          })
        }

        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
          transaction.onabort = () => reject(transaction.error)
        })
      } finally {
        database.close()
      }
    },
    { badgeCount: BADGE_COUNT, userId: USER_ID },
  )
}

const isHorizontallyVisible = async (item: Locator): Promise<boolean> =>
  item.evaluate((element) => {
    const shelf = element.parentElement
    if (shelf === null) return false
    const itemBounds = element.getBoundingClientRect()
    const shelfBounds = shelf.getBoundingClientRect()
    return (
      itemBounds.left >= shelfBounds.left - 1 &&
      itemBounds.right <= shelfBounds.right + 1
    )
  })

test.describe('Progress dashboard', () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true })

  test('Milestones shelf responds to a real tablet touch swipe @smoke', async ({
    page,
  }) => {
    await page.addInitScript((userId) => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('mp:userId', userId)
    }, USER_ID)

    await page.goto('/')
    await page.waitForSelector('#app-tabs, [data-tour="mobile-tabbar"]', {
      timeout: 10_000,
    })
    await dismissOverlays(page)
    await ensureLocalDb(page)
    await seedEarnedBadges(page)

    await page.goto('/#/progress')
    await dismissOverlays(page)
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()

    const shelf = page.getByRole('list', {
      name: 'Earned milestones. Swipe or scroll horizontally to browse.',
    })
    const lastBadge = shelf
      .getByRole('listitem')
      .filter({ hasText: LAST_BADGE_NAME })

    await expect(shelf).toBeVisible()
    await expect(lastBadge).toHaveCount(1)
    await shelf.scrollIntoViewIfNeeded()
    await expect.poll(() => isHorizontallyVisible(lastBadge)).toBe(false)

    const shelfBounds = await shelf.boundingBox()
    if (shelfBounds === null) throw new Error('Milestones shelf has no bounds')

    const session = await page.context().newCDPSession(page)
    const y = shelfBounds.y + shelfBounds.height / 2
    const startX = shelfBounds.x + shelfBounds.width * 0.82
    const endX = shelfBounds.x + shelfBounds.width * 0.18
    const initialScrollLeft = await shelf.evaluate((element) =>
      Math.round(element.scrollLeft),
    )

    await dispatchTouch(session, 'touchStart', startX, y)
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      await dispatchTouch(
        session,
        'touchMove',
        startX + (endX - startX) * progress,
        y,
      )
    }
    await dispatchTouch(session, 'touchEnd')

    await expect
      .poll(() => shelf.evaluate((element) => Math.round(element.scrollLeft)))
      .toBeGreaterThan(initialScrollLeft)
    await expect(lastBadge).toBeVisible()
    await expect.poll(() => isHorizontallyVisible(lastBadge)).toBe(true)
  })
})
