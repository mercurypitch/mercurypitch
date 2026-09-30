// Living Thawing Song proof — shared asset requests retain three sung targets and saved key.

import { expect, test } from '@playwright/test'
import { CLOUDWAY_THAWING_SONG } from '../../../packages/glass-game/src/content/cloudway-thawing-song'
import { createGlassGame } from '../../../packages/glass-game/src/core/game'
import { installThawingInput } from './helpers/thawing-song-input'

const level = CLOUDWAY_THAWING_SONG
const progressKey = `beside-cue:glass-adventure:progress:${level.id}`
const configured = createGlassGame(level)
configured.configureMelodyAttempt({
  attemptId: 'thawing-living-art-browser-v1',
  comfortableMidi: 60,
  pace: 1.25,
  transposeSemitones: 0,
})

const stations = [
  { id: 'home', checkpoint: 'thaw-arrival-save', completed: 0, midi: 58 },
  { id: 'crown', checkpoint: 'thaw-garden-save', completed: 2, midi: 62 },
  { id: 'homecoming', checkpoint: 'thaw-home-save', completed: 4, midi: 58 },
] as const

test.use({
  viewport: { width: 640, height: 480 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(150_000)

for (const station of stations) {
  test(`living ${station.id} preserves cancellation, singing and saved progress @smoke`, async ({
    page,
  }) => {
    const priorIds = level.breakables
      .slice(0, station.completed)
      .map((b) => b.id)
    const progress = {
      ...configured.saveProgress(),
      checkpointId: station.checkpoint,
      completedBreakableIds: priorIds,
    }
    // Keep real asset loading and PCM; review rendered art separately from capture timing.
    await installThawingInput(page, { progress })
    await page.addInitScript(() => {
      localStorage.setItem(
        'beside-cue:glass-adventure:automatic-singing',
        'off',
      )
    })
    const requests: string[] = []
    const pageErrors: string[] = []
    page.on('request', (request) =>
      requests.push(new URL(request.url()).pathname),
    )
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/glass-game/?layout=thawing-song')
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 75_000,
    })
    await expect(game).toHaveAttribute(
      'data-completed',
      String(station.completed),
    )
    expect(
      requests.filter((path) => path.endsWith('/resonance-rosebud-v1.glb')),
    ).toHaveLength(1)
    expect(
      requests.filter((path) =>
        path.endsWith('/living-crystal-platform-v2.glb'),
      ),
    ).toHaveLength(1)

    const panel = page.getByRole('region', {
      name: 'Melody challenge',
      exact: true,
    })
    await page.getByTestId('glass-sing-action').tap()
    if (station.completed === 0)
      await panel
        .getByRole('button', { name: 'Start singing', exact: true })
        .tap()
    await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
      timeout: 25_000,
    })
    // Silence and cancellation must not earn the new vessel's reward.
    await page.waitForTimeout(400)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).tap()
    await expect(panel).not.toBeVisible()
    await expect(game).toHaveAttribute(
      'data-completed',
      String(station.completed),
    )
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.thawingInput.streams.every((stream) =>
            stream
              .getAudioTracks()
              .every((track) => track.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true)

    await page.getByTestId('glass-sing-action').tap()
    if (station.completed === 0)
      await panel
        .getByRole('button', { name: 'Start singing', exact: true })
        .tap()
    await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
      timeout: 25_000,
    })
    await page.evaluate((midi) => window.thawingInput.tone(midi), station.midi)
    await expect(game).toHaveAttribute(
      'data-completed',
      String(station.completed + 1),
      { timeout: 15_000 },
    )
    await page.evaluate(() => window.thawingInput.silent())
    await expect(panel).not.toBeVisible()
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      progressKey,
    )
    expect(saved.completedBreakableIds).toEqual(
      level.breakables.slice(0, station.completed + 1).map((b) => b.id),
    )
    expect(saved.melodyAttempt).toEqual(progress.melodyAttempt)
    await page.reload()
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 75_000,
    })
    await expect(game).toHaveAttribute(
      'data-completed',
      String(station.completed + 1),
    )
    expect(pageErrors).toEqual([])
  })
}
