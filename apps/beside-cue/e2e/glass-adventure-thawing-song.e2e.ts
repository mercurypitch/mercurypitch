// Thawing Song browser proof — saved lesson identity and real microphone PCM judge the portrait.

import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { CLOUDWAY_THAWING_SONG } from '../../../packages/glass-game/src/content/cloudway-thawing-song'
import { createGlassGame } from '../../../packages/glass-game/src/core/game'
import { resolveMelodyAttempt } from '../../../packages/glass-game/src/core/melody-attempt'
import type { CompiledMelody } from '../../../packages/glass-game/src/core/melody-contour'
import { installThawingInput, singCompiledPhrase, } from './helpers/thawing-song-input'

const level = CLOUDWAY_THAWING_SONG
const progressKey = `beside-cue:glass-adventure:progress:${level.id}`
const configuration = {
  attemptId: 'thawing-browser-portrait-v1',
  comfortableMidi: 60,
  pace: 1.25,
  transposeSemitones: 0,
}
const resolved = resolveMelodyAttempt(level, configuration)
const prepared = createGlassGame(level)
prepared.configureMelodyAttempt(configuration)
const finaleSave = {
  ...prepared.saveProgress(),
  checkpointId: 'thaw-portrait-save',
  completedBreakableIds: level.melodyLesson!.stations.map((s) => s.encounterId),
}

interface ScheduledPitchPoint {
  afterSeconds: number
  midi: number | null
}

interface ScheduledInterruptionObservation {
  frozenProgress: number
  minimumDuringInterruption: number
  maximumDuringInterruption: number
  recoveredProgress: number
  interruptionGuideText: string
  scheduledSeconds: number
  samplesDuringInterruption: number
}

interface TierOneGraceObservation {
  dropout: ScheduledInterruptionObservation
  mismatch: ScheduledInterruptionObservation
  resetProgress: number
}

async function observeTierOneGraceSequence(
  panel: Locator,
  melody: Pick<CompiledMelody, 'durationSeconds' | 'samples'>,
): Promise<TierOneGraceObservation> {
  return panel.evaluate(async (root, melody) => {
    const progress = root.querySelector<HTMLElement>(
      '[role="progressbar"][aria-label="Melody progress"]',
    )
    const guide = root.querySelector<HTMLOutputElement>(
      'output[aria-label="Live pitch compared with target"]',
    )
    if (!progress || !guide)
      throw new Error('Melody grace proof lost its progress or pitch guide.')
    const progressValue = (): number => {
      const value = progress.getAttribute('aria-valuenow')
      if (value === null)
        throw new Error('Melody progress lost its current value.')
      return Number(value)
    }
    const contourTail = (
      recoveryMidi: number,
      fromProgress: number,
    ): ScheduledPitchPoint[] => {
      const maximumPhase = Math.min(1, (fromProgress + 0.5) / 100)
      const voiced = melody.samples.filter(
        (point) => point.midi !== null && point.phase <= maximumPhase,
      )
      if (voiced.length === 0)
        throw new Error('Melody recovery lost its voiced contour.')
      const matches: Array<{
        phase: number
        timeSeconds: number
        midi: number
      }> = []
      for (let index = 0; index < melody.samples.length; index++) {
        const point = melody.samples[index]!
        if (point.midi === null || point.phase > maximumPhase) continue
        if (Math.abs(point.midi - recoveryMidi) <= 0.01)
          matches.push({
            phase: point.phase,
            timeSeconds: point.timeSeconds,
            midi: point.midi,
          })
        const next = melody.samples[index + 1]
        if (
          next?.midi === null ||
          next === undefined ||
          next.segmentId !== point.segmentId
        )
          continue
        const midiDelta = next.midi - point.midi
        if (Math.abs(midiDelta) <= 1e-9) continue
        const ratio = (recoveryMidi - point.midi) / midiDelta
        if (ratio <= 0 || ratio >= 1) continue
        const phase = point.phase + (next.phase - point.phase) * ratio
        if (phase > maximumPhase) continue
        matches.push({
          phase,
          timeSeconds:
            point.timeSeconds + (next.timeSeconds - point.timeSeconds) * ratio,
          midi: recoveryMidi,
        })
      }
      const start =
        matches.length > 0
          ? matches.reduce((latest, candidate) =>
              candidate.phase > latest.phase ? candidate : latest,
            )
          : voiced.reduce((nearest, candidate) => {
              const nearestError = Math.abs(nearest.midi! - recoveryMidi)
              const candidateError = Math.abs(candidate.midi! - recoveryMidi)
              return candidateError < nearestError ||
                (Math.abs(candidateError - nearestError) <= 1e-9 &&
                  candidate.phase > nearest.phase)
                ? candidate
                : nearest
            })
      const points: ScheduledPitchPoint[] = [
        { afterSeconds: 0, midi: recoveryMidi },
      ]
      for (const point of melody.samples) {
        if (point.timeSeconds <= start.timeSeconds) continue
        points.push({
          afterSeconds: point.timeSeconds - start.timeSeconds,
          midi: point.midi,
        })
      }
      return points
    }
    // A CI reset can outlive the brief recovery state. Retain the observed
    // guide transitions and audio clock without changing the probe's timing.
    const history: Array<{
      audioSeconds: number
      progress: number
      guide: string
    }> = []
    const rememberObservation = (): void => {
      const observation = {
        audioSeconds: Number(window.thawingInput.audioTime().toFixed(3)),
        progress: progressValue(),
        guide: guide.textContent ?? '',
      }
      const previous = history.at(-1)
      if (
        previous?.progress === observation.progress &&
        previous.guide === observation.guide
      )
        return
      history.push(observation)
      if (history.length > 32) history.shift()
    }
    const waitFor = async (
      predicate: () => boolean,
      description: string,
    ): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        let timeout: number | undefined
        const observer = new MutationObserver(check)
        const finish = (): void => {
          observer.disconnect()
          if (timeout !== undefined) clearTimeout(timeout)
        }
        function check(): void {
          try {
            rememberObservation()
            if (!predicate()) return
            finish()
            resolve()
          } catch (error) {
            finish()
            reject(error)
          }
        }
        observer.observe(root, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        })
        timeout = window.setTimeout(() => {
          rememberObservation()
          finish()
          reject(
            new Error(
              `Timed out waiting for ${description}. Observations: ${JSON.stringify(history)}`,
            ),
          )
        }, 5_000)
        check()
      })
    }
    const observeRecovery = async (
      points: ScheduledPitchPoint[],
      recoveryAfterSeconds: number,
      interruptionText: string,
      recoveryText: string,
      recoveryMidi: number,
    ): Promise<ScheduledInterruptionObservation> => {
      const startedAudioAt = window.thawingInput.sequence(points)
      const recoveryAudioAt = startedAudioAt + recoveryAfterSeconds
      await waitFor(
        () => (guide.textContent ?? '').includes(interruptionText),
        `pitch guide to show ${interruptionText}`,
      )
      if (window.thawingInput.audioTime() >= recoveryAudioAt)
        throw new Error(
          `${interruptionText} appeared after its scheduled recovery time.`,
        )
      const frozenProgress = progressValue()
      const interruptionGuideText = guide.textContent ?? ''
      const observed = [frozenProgress]
      while (window.thawingInput.audioTime() < recoveryAudioAt) {
        await new Promise<void>((resolve) => setTimeout(resolve, 20))
        if (window.thawingInput.audioTime() < recoveryAudioAt)
          observed.push(progressValue())
      }
      await waitFor(() => {
        const text = guide.textContent ?? ''
        return text.includes(recoveryText) && text.includes('centered')
      }, `pitch guide to show ${recoveryText}`)
      window.thawingInput.sequence(contourTail(recoveryMidi, progressValue()))
      await waitFor(
        () => progressValue() > frozenProgress,
        `melody progress to resume after ${interruptionText}`,
      )
      return {
        frozenProgress,
        minimumDuringInterruption: Math.min(...observed),
        maximumDuringInterruption: Math.max(...observed),
        recoveredProgress: progressValue(),
        interruptionGuideText,
        scheduledSeconds: recoveryAudioAt - startedAudioAt,
        samplesDuringInterruption: observed.length,
      }
    }

    window.thawingInput.phrase(melody.samples, melody.durationSeconds)
    await waitFor(
      () => (guide.textContent ?? '').includes('You B♭3 · Target B♭3'),
      'pitch guide to show the opening note',
    )
    await waitFor(
      () => (guide.textContent ?? '').includes('Target C4'),
      'compiled contour to reach the next note',
    )
    const dropout = await observeRecovery(
      [
        { afterSeconds: 0, midi: null },
        { afterSeconds: 0.65, midi: 60 },
      ],
      0.65,
      'Listening · Target',
      'You C4 · Target',
      60,
    )
    const wrongMidi = 64
    const mismatchStartedAudioAt = window.thawingInput.sequence([
      { afterSeconds: 0, midi: wrongMidi },
    ])
    const mismatchRecoveryAudioAt = mismatchStartedAudioAt + 0.9
    await waitFor(
      () => (guide.textContent ?? '').includes('You E4 · Target'),
      'pitch guide to show You E4 · Target',
    )
    const interruptionGuideText = guide.textContent ?? ''
    const error = interruptionGuideText.match(/· (\d+) cents (high|low)$/u)
    if (!error)
      throw new Error(
        `Wrong-note guide did not expose a measured error: ${interruptionGuideText}`,
      )
    const signedErrorCents = Number(error[1]) * (error[2] === 'high' ? 1 : -1)
    const recoveryMidi = wrongMidi - signedErrorCents / 100
    const remainingWrongSeconds =
      mismatchRecoveryAudioAt - window.thawingInput.audioTime()
    if (remainingWrongSeconds <= 0)
      throw new Error('Wrong-note observation arrived after its recovery time.')
    window.thawingInput.sequence([
      { afterSeconds: remainingWrongSeconds, midi: recoveryMidi },
    ])
    const mismatchFrozenProgress = progressValue()
    const mismatchObserved = [mismatchFrozenProgress]
    while (window.thawingInput.audioTime() < mismatchRecoveryAudioAt) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20))
      if (window.thawingInput.audioTime() < mismatchRecoveryAudioAt)
        mismatchObserved.push(progressValue())
    }
    const targetName = interruptionGuideText
      .match(/Target ([^·]+)/u)?.[1]
      ?.trim()
    if (targetName === undefined)
      throw new Error(
        `Wrong-note guide did not expose its target: ${interruptionGuideText}`,
      )
    await waitFor(() => {
      const text = guide.textContent ?? ''
      return text.includes(`Target ${targetName}`) && text.includes('centered')
    }, `pitch guide to recover on Target ${targetName}`)
    window.thawingInput.sequence(contourTail(recoveryMidi, progressValue()))
    await waitFor(
      () => progressValue() > mismatchFrozenProgress,
      'melody progress to resume after You E4 · Target',
    )
    const mismatch: ScheduledInterruptionObservation = {
      frozenProgress: mismatchFrozenProgress,
      minimumDuringInterruption: Math.min(...mismatchObserved),
      maximumDuringInterruption: Math.max(...mismatchObserved),
      recoveredProgress: progressValue(),
      interruptionGuideText,
      scheduledSeconds: mismatchRecoveryAudioAt - mismatchStartedAudioAt,
      samplesDuringInterruption: mismatchObserved.length,
    }
    window.thawingInput.tone(64)
    await waitFor(
      () => (guide.textContent ?? '').includes('You E4 · Target'),
      'pitch guide to show the continuous wrong pitch',
    )
    await waitFor(
      () =>
        [...root.querySelectorAll('button')].some(
          (button) => button.textContent?.trim() === 'Try again',
        ),
      'continuous wrong pitch to request a retry',
    )
    return {
      dropout,
      mismatch,
      resetProgress: progressValue(),
    }
  }, melody)
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(150_000)

test('first station configures one saved key, rejects the wrong pitch and restores its note @smoke', async ({
  page,
}, testInfo) => {
  await installThawingInput(page)
  await page.goto('/glass-game/?layout=thawing-song')
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByTestId('glass-sing-action').tap()
  const panel = page.getByRole('region', {
    name: 'Melody challenge',
    exact: true,
  })
  await expect(panel).toBeVisible()
  expect(await page.evaluate(() => window.thawingInput.streams.length)).toBe(0)
  await expect(
    panel.getByRole('radio', { name: 'Spacious', exact: true }),
  ).toBeChecked()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('thawing-key-setup-phone.png'),
  })
  await panel.getByRole('button', { name: 'Start singing', exact: true }).tap()
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(saved.version).toBe(3)
  expect(saved.melodyAttempt).toMatchObject({
    comfortableMidi: 60,
    rootMidi: 58,
    pace: 1.25,
  })
  expect(saved.completedBreakableIds).toEqual([])
  await page.evaluate(() => window.thawingInput.tone(60))
  await page.waitForTimeout(1800)
  await expect(game).toHaveAttribute('data-completed', '0')
  await page.evaluate(() => window.thawingInput.tone(58))
  await expect(game).toHaveAttribute('data-completed', '1', { timeout: 10_000 })
  await page.evaluate(() => window.thawingInput.silent())
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.thawingInput.streams.every((s) =>
          s.getAudioTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  await page.reload()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '1')
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(restored.melodyAttempt).toEqual(saved.melodyAttempt)
})

test('the complete sung curve shatters the portrait and opens the exit without mixing old note evidence @smoke', async ({
  page,
}, testInfo) => {
  await installThawingInput(page, { progress: finaleSave })
  const voiceRequests: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/adventure-voice-v6/'))
      voiceRequests.push(new URL(r.url()).pathname)
  })
  await page.goto('/glass-game/?layout=thawing-song')
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '5')
  await page.getByTestId('glass-sing-action').tap()
  const panel = page.getByRole('region', {
    name: 'Melody challenge',
    exact: true,
  })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 25_000,
  })
  expect(voiceRequests).toContain(
    '/games/adventure-voice-v6/sunlit-steps/r58-p125.mp3',
  )
  await expect(game).toHaveAttribute('data-completed', '5')
  const pitchGuideButton = panel.getByRole('button', {
    name: 'Show pitch guide',
    exact: true,
  })
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await pitchGuideButton.scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    expect(
      (await pitchGuideButton.boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44)
    await page.screenshot({
      path: testInfo.outputPath(`thawing-pitch-guide-closed-${width}.png`),
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await pitchGuideButton.tap()
  const pitchGuide = panel.locator(
    'output[aria-label="Live pitch compared with target"]',
  )
  const grace = await observeTierOneGraceSequence(panel, resolved.melody)
  expect(grace.dropout.scheduledSeconds).toBeCloseTo(0.65, 5)
  expect(grace.dropout.interruptionGuideText).toContain('Listening · Target')
  expect(grace.dropout.samplesDuringInterruption).toBeGreaterThanOrEqual(2)
  expect(grace.dropout.minimumDuringInterruption).toBe(
    grace.dropout.frozenProgress,
  )
  expect(grace.dropout.maximumDuringInterruption).toBe(
    grace.dropout.frozenProgress,
  )
  expect(grace.dropout.recoveredProgress).toBeGreaterThan(
    grace.dropout.frozenProgress,
  )
  expect(grace.mismatch.scheduledSeconds).toBeCloseTo(0.9, 5)
  expect(grace.mismatch.interruptionGuideText).toContain('You E4 · Target')
  expect(grace.mismatch.samplesDuringInterruption).toBeGreaterThanOrEqual(2)
  expect(grace.mismatch.minimumDuringInterruption).toBe(
    grace.mismatch.frozenProgress,
  )
  expect(grace.mismatch.maximumDuringInterruption).toBe(
    grace.mismatch.frozenProgress,
  )
  expect(grace.mismatch.recoveredProgress).toBeGreaterThan(
    grace.mismatch.frozenProgress,
  )
  await expect(pitchGuide).toContainText(/You E4 · Target .* cents high/u)
  expect(grace.resetProgress).toBe(0)
  await expect(
    panel.getByRole('button', { name: 'Try again', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  await expect(game).toHaveAttribute('data-completed', '5')
  const ribbon = panel.getByRole('img', { name: /Melody ribbon/u })
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    const [panelBox, ribbonBox] = await Promise.all([
      panel.boundingBox(),
      ribbon.boundingBox(),
    ])
    expect(panelBox).not.toBeNull()
    expect(ribbonBox).not.toBeNull()
    expect(ribbonBox!.width).toBeGreaterThan(panelBox!.width * 0.8)
    expect(
      (await panel
        .getByRole('button', { name: 'Hide pitch guide', exact: true })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44)
    await page.screenshot({
      path: testInfo.outputPath(`thawing-pitch-guide-open-${width}.png`),
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.thawingInput.silent())
  await panel.getByRole('button', { name: 'Try again', exact: true }).tap()
  await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 25_000,
  })
  await singCompiledPhrase(page, resolved.melody)
  await expect(game).toHaveAttribute('data-completed', '6', { timeout: 20_000 })
  await page.evaluate(() => window.thawingInput.silent())
  await expect(panel).not.toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.thawingInput.streams.every((s) =>
          s.getAudioTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  // All five prior stations survive the failed attempt and the portrait is newly earned.
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    progressKey,
  )
  expect(saved.completedBreakableIds).toEqual(level.breakables.map((b) => b.id))
  expect(saved.melodyAttempt).toEqual(resolved.identity)
  await page.reload()
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await expect(game).toHaveAttribute('data-completed', '6')
  // From the actual safe portrait checkpoint, walk through the newly open golden threshold.
  // First-person yaw belongs to the player; recenter onto this restored court.
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Recenter camera', exact: true }).tap()
  await expect
    .poll(async () =>
      Math.abs(Number(await game.getAttribute('data-camera-yaw'))),
    )
    .toBeLessThan(0.01)
  await page.getByLabel('Glass museum; drag to look around').focus()
  const coordinate = async (axis: string) =>
    Number(await game.getAttribute(`data-player-${axis}`))
  await page.keyboard.down('KeyD')
  await expect
    .poll(() => coordinate('x'), { intervals: [50] })
    .toBeGreaterThan(9.8)
  await page.keyboard.up('KeyD')
  await page.keyboard.down('KeyW')
  await expect
    .poll(() => coordinate('z'), { intervals: [50] })
    .toBeLessThan(-9.7)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyA')
  await expect
    .poll(() => coordinate('x'), { intervals: [50] })
    .toBeLessThan(9.2)
  await page.keyboard.up('KeyA')
  await page.keyboard.down('KeyW')
  await expect(
    page.getByRole('heading', {
      name: 'A whole garden, awakened by your song.',
      exact: true,
    }),
  ).toBeVisible({ timeout: 8000 })
  await page.keyboard.up('KeyW')
})

test('games-enabled phone entry opens the same melody preview and returns to the list @smoke', async ({
  page,
}) => {
  await installThawingInput(page)
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/u }).tap()
  const entry = page.getByRole('button', { name: /The Thawing Song/u })
  await expect(entry).toBeVisible()
  await entry.tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-level-id', level.id)
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(entry).toBeVisible()
  await expect(game).toHaveCount(0)
})
