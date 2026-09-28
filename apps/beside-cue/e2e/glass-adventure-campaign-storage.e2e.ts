// Campaign storage failure — a completed live visit can advance even when durable writes are denied.

import { expect, test } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { replayProfilesForLevel } from '../../../packages/glass-game/src/content/replay-profiles'
import { readProgress } from '../../../packages/glass-game/src/core/progress'
import { resolveReplayProfile } from '../../../packages/glass-game/src/core/replay-profile'
import { beginReplayAttempt, readReplayProgress, saveReplayAttempt, } from '../../../packages/glass-game/src/core/replay-progress'

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

for (const destination of ['level', 'difficulty'] as const) {
  test(`completed visit opens the next ${destination} when saves fail @smoke`, async ({
    page,
  }) => {
    const prologue = MUSEUM_CAMPAIGN[0]!.level
    const level = MUSEUM_CAMPAIGN[1]!.level
    const profiles = replayProfilesForLevel(level).map((profile) =>
      resolveReplayProfile(level, profile),
    )
    const first = profiles[0]!
    const checkpoint = level.checkpoints.find((item) =>
      item.id.endsWith('/checkpoint/panorama'),
    )!
    const progress = {
      ...readProgress(level, null),
      checkpointId: checkpoint.id,
      completedBreakableIds: level.breakables
        .filter((item) => !item.optional)
        .map((item) => item.id),
      finished: false,
    }
    const replay = saveReplayAttempt(
      beginReplayAttempt(
        readReplayProgress(level, profiles, null),
        first,
        true,
      ),
      first,
      progress,
      100,
    )
    const completedPrologue = {
      ...readProgress(prologue, null),
      completedBreakableIds: prologue.breakables.map((item) => item.id),
      finished: true,
    }
    await page.addInitScript(
      ({ completedPrologue, progress, replay }) => {
        // Only host decisions and HTML controls are under test, not WebGL output.
        for (const method of [
          'clear',
          'drawArrays',
          'drawArraysInstanced',
          'drawElements',
          'drawElementsInstanced',
        ])
          Object.defineProperty(WebGL2RenderingContext.prototype, method, {
            configurable: true,
            value: () => undefined,
          })
        const prefix = 'beside-cue:glass-adventure'
        localStorage.setItem(`${prefix}:tutorial`, 'seen')
        localStorage.setItem(
          `${prefix}:progress:${completedPrologue.levelId}`,
          JSON.stringify(completedPrologue),
        )
        localStorage.setItem(
          `${prefix}:progress:${progress.levelId}`,
          JSON.stringify(progress),
        )
        localStorage.setItem(
          `${prefix}:replays:v1:${progress.levelId}`,
          JSON.stringify(replay),
        )
        const originalSetItem = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (
            key.startsWith(`${prefix}:progress:`) ||
            key.startsWith(`${prefix}:replays:`)
          )
            throw new DOMException('Storage write denied', 'QuotaExceededError')
          originalSetItem.call(this, key, value)
        }
      },
      { completedPrologue, progress, replay },
    )

    await page.goto('/glass-game/?campaign=1&progression=earned')
    await page
      .getByRole('button', { name: `Continue ${level.title}`, exact: true })
      .click()
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await page.keyboard.down('KeyW')
    try {
      await expect(page.getByTestId('level-star-summary')).toContainText(
        '1 star earned',
        { timeout: 20_000 },
      )
    } finally {
      await page.keyboard.up('KeyW')
    }

    if (destination === 'level') {
      const next = MUSEUM_CAMPAIGN[2]!.level
      await page
        .getByRole('button', { name: `Next level: ${next.title}` })
        .click()
      await expect(game).toHaveAttribute('data-level-id', next.id)
    } else {
      await page
        .getByRole('button', { name: 'Earn 2 stars: Two-star challenge' })
        .click()
      await expect(page.getByTestId('completion-results')).toHaveCount(0)
    }
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await expect(game).toHaveAttribute('data-completed', '0')
    if (destination === 'difficulty')
      await expect(game).toContainText('Two-star challenge')
    const persisted = await page.evaluate(
      (id) => ({
        progress: JSON.parse(
          localStorage.getItem(`beside-cue:glass-adventure:progress:${id}`)!,
        ),
        replay: JSON.parse(
          localStorage.getItem(`beside-cue:glass-adventure:replays:v1:${id}`)!,
        ),
      }),
      level.id,
    )
    expect(persisted.progress.finished).toBe(false)
    expect(persisted.replay.clears).toEqual([])
  })
}

for (const route of ['chapter', 'replay'] as const) {
  test(`${route} entry refreshes its lock when prior completion is removed before the click @smoke`, async ({
    page,
  }) => {
    const prologue = MUSEUM_CAMPAIGN[0]!.level
    const gallery = MUSEUM_CAMPAIGN[1]!.level
    const completedPrologue = {
      ...readProgress(prologue, null),
      completedBreakableIds: prologue.breakables.map((item) => item.id),
      finished: true,
    }
    const completedGallery =
      route === 'replay'
        ? {
            ...readProgress(gallery, null),
            completedBreakableIds: gallery.breakables.map((item) => item.id),
            finished: true,
          }
        : undefined
    await page.addInitScript(
      ({ completedPrologue, completedGallery }) => {
        HTMLCanvasElement.prototype.getContext = (() =>
          null) as typeof HTMLCanvasElement.prototype.getContext
        for (const progress of [completedPrologue, completedGallery]) {
          if (progress)
            localStorage.setItem(
              `beside-cue:glass-adventure:progress:${progress.levelId}`,
              JSON.stringify(progress),
            )
        }
      },
      { completedPrologue, completedGallery },
    )
    await page.goto('/glass-game/?campaign=1&progression=earned')
    let enter = page.getByRole('button', {
      name: `${route === 'replay' ? 'Replay' : 'Enter'} ${gallery.title}`,
      exact: true,
    })
    await expect(enter).toBeEnabled()
    if (route === 'replay') {
      await enter.click()
      enter = page.getByRole('button', {
        name: 'Begin this challenge',
        exact: true,
      })
      await expect(enter).toBeEnabled()
    }
    await page.evaluate(
      (id) =>
        localStorage.removeItem(`beside-cue:glass-adventure:progress:${id}`),
      prologue.id,
    )
    await enter.click()
    await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
    await expect(
      page.getByRole('dialog', { name: gallery.title, exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', {
        name: `Locked: ${gallery.title}`,
        exact: true,
      }),
    ).toBeDisabled()
  })
}
