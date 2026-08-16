import type { CDPSession, Page } from '@playwright/test'
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

const swipeShelf = async (
  session: CDPSession,
  bounds: { x: number; y: number; width: number; height: number },
  direction: 'left' | 'right',
): Promise<void> => {
  const y = bounds.y + bounds.height / 2
  const left = bounds.x + bounds.width * 0.18
  const right = bounds.x + bounds.width * 0.82
  const startX = direction === 'left' ? right : left
  const endX = direction === 'left' ? left : right

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

const seedProgressEvidence = async (page: Page): Promise<void> => {
  await page.evaluate(
    async ({ badgeCount, userId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      try {
        const transaction = database.transaction(
          ['badgeDefinitions', 'userBadges', 'sessionRecords'],
          'readwrite',
        )
        const definitions = transaction.objectStore('badgeDefinitions')
        const earnedBadges = transaction.objectStore('userBadges')
        const sessionRecords = transaction.objectStore('sessionRecords')

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

        const endedAt = new Date().toISOString()
        sessionRecords.put({
          id: 'e2e-progress-tablet-exercise',
          userId,
          melodyName: 'Tablet exercise evidence',
          startedAt: new Date(Date.now() - 90_000).toISOString(),
          endedAt,
          score: 88,
          accuracy: 88,
          notesHit: 8,
          notesTotal: 10,
          streak: 4,
          source: 'exercise',
          instrument: 'voice',
          durationMs: 90_000,
          sourceRef: 'e2e-progress-tablet-exercise',
          sourceVersion: 1,
          comparabilityKey: 'exercise:e2e-progress-tablet-exercise:v1',
          results: [],
          createdAt: endedAt,
          updatedAt: endedAt,
        })

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

test.describe('Progress dashboard', () => {
  test.use({ viewport: { width: 912, height: 1368 }, hasTouch: true })

  test('Atlas stays fixed while its reason disclosure opens @smoke', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript((userId) => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('mp:userId', userId)
      localStorage.setItem('pitchperfect_theme', 'light')
    }, USER_ID)

    await page.goto('/')
    await page.waitForSelector('#app-tabs, [data-tour="mobile-tabbar"]', {
      timeout: 10_000,
    })
    await dismissOverlays(page)
    await ensureLocalDb(page)
    await seedProgressEvidence(page)

    await page.goto('/#/progress')
    await dismissOverlays(page)
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()

    const progress = page.locator('[data-progress-state]')
    await expect(progress).toHaveClass(/mp-dark-stage/)
    await expect(progress).toHaveCSS('color-scheme', 'dark')
    const pagePalette = await progress.evaluate((element) => {
      const style = getComputedStyle(element)
      const rootStyle = getComputedStyle(document.documentElement)
      return {
        primary: style.getPropertyValue('--bg-primary').trim(),
        rootPrimary: rootStyle.getPropertyValue('--bg-primary').trim(),
        rootScheme: rootStyle.colorScheme,
      }
    })
    expect(pagePalette).toEqual({
      primary: '#0d1117',
      rootPrimary: '#f3f4f6',
      rootScheme: 'light',
    })

    const weekField = page.getByRole('group', { name: /Practice by week/ })
    const atlas = weekField.locator('..')
    const whyMoment = page.getByRole('button', {
      name: 'Why this moment was selected',
    })
    await whyMoment.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)

    const geometry = () =>
      atlas.evaluate((element) => {
        const plate = element.getBoundingClientRect()
        const field = element
          .querySelector('[role="group"]')
          ?.getBoundingClientRect()
        if (field === undefined) throw new Error('Atlas week field is missing')
        return {
          plateHeight: plate.height,
          fieldTop: field.top - plate.top,
          fieldHeight: field.height,
        }
      })

    const before = await geometry()
    await whyMoment.click()
    await expect(whyMoment).toHaveAttribute('aria-expanded', 'true')
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveCSS('color-scheme', 'dark')
    const tooltipPalette = await tooltip.evaluate((element) => {
      const parse = (value: string): [number, number, number] => {
        const channels = value
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number)
        if (channels === undefined || channels.length !== 3) {
          throw new Error(`Expected an RGB color, received ${value}`)
        }
        return [channels[0], channels[1], channels[2]]
      }
      const luminance = ([red, green, blue]: [number, number, number]) => {
        const channels = [red, green, blue].map((channel) => {
          const normalized = channel / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4)
        })
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        )
      }
      const style = getComputedStyle(element)
      const body = element.querySelector('p')
      if (body === null) throw new Error('Why-moment copy is missing')
      const foreground = luminance(parse(getComputedStyle(body).color))
      const background = luminance(parse(style.backgroundColor))
      return {
        contrast:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
        outsideAppRoot:
          document.querySelector('#root')?.contains(element) === false,
        primary: style.getPropertyValue('--bg-primary').trim(),
        progressInk: style.getPropertyValue('--progress-ink').trim(),
      }
    })
    expect(tooltipPalette.outsideAppRoot).toBe(true)
    expect(tooltipPalette.primary).toBe('#0d1117')
    expect(tooltipPalette.progressInk).toBe('#f4f5fb')
    expect(tooltipPalette.contrast).toBeGreaterThanOrEqual(4.5)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    const after = await geometry()

    expect(
      Math.abs(after.plateHeight - before.plateHeight),
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(after.fieldTop - before.fieldTop)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(after.fieldHeight - before.fieldHeight),
    ).toBeLessThanOrEqual(1)
  })

  test('Tablet milestones use their row and swipe in both directions @smoke', async ({
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
    await seedProgressEvidence(page)

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
    await expect
      .poll(() =>
        shelf.evaluate((element) => {
          const container = element.parentElement
          return container === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(element.clientWidth - container.clientWidth)
        }),
      )
      .toBeLessThanOrEqual(1)
    await expect
      .poll(() =>
        shelf.evaluate((element) => element.scrollWidth > element.clientWidth),
      )
      .toBe(true)

    const shelfBounds = await shelf.boundingBox()
    if (shelfBounds === null) throw new Error('Milestones shelf has no bounds')

    const session = await page.context().newCDPSession(page)
    const initialScrollLeft = await shelf.evaluate((element) =>
      Math.round(element.scrollLeft),
    )

    await swipeShelf(session, shelfBounds, 'left')

    await expect
      .poll(() => shelf.evaluate((element) => Math.round(element.scrollLeft)))
      .toBeGreaterThan(initialScrollLeft)

    const forwardScrollLeft = await shelf.evaluate((element) =>
      Math.round(element.scrollLeft),
    )
    await swipeShelf(session, shelfBounds, 'right')

    await expect
      .poll(() => shelf.evaluate((element) => Math.round(element.scrollLeft)))
      .toBeLessThan(forwardScrollLeft)

    const exercisesAction = page
      .getByRole('region', { name: 'Practice Paths' })
      .getByRole('link', { name: 'Open Exercises' })
    await expect(exercisesAction).toBeVisible()
    const actionColors = await exercisesAction.evaluate((element) => ({
      control: getComputedStyle(element).color,
      label: getComputedStyle(element.querySelector('span')!).color,
    }))
    expect(actionColors.label).toBe(actionColors.control)
    expect(actionColors.label).toBe('rgb(7, 17, 24)')
  })
})
