// Runner controls presentation — isolate the long real-audio course from software-GPU scheduling.

import type { Locator, Page, TestInfo } from '@playwright/test'
import type { createSongRunnerRenderer } from '../../../../packages/glass-game/src/render/runner-renderer'

interface RunnerPitchFeedbackProbeSample {
  courseSeconds: number
  targetId: string
  targetPhase: string
  noteIndex: number | null
  state: string
  targetLabel: string
  observedLabel: string
  comparedTargetMidi: number | null
  observedMidi: number | null
}

export interface RunnerCourseProbe {
  phases: string[]
  frameGaps: { courseSeconds: number; duration: number }[]
  longTasks: { courseSeconds: number; duration: number }[]
  pitchFeedback: RunnerPitchFeedbackProbeSample[]
  pitchFeedbackDropped: number
  runnerElementConnected: boolean
  runnerDisconnectedAtCourseSeconds: number | null
}

declare global {
  interface Window {
    runnerCourseProbe?: RunnerCourseProbe
  }
}

/** No clock, input, audio, physics, score or progress authority lives in this fixture. */
const createControlsRenderer: typeof createSongRunnerRenderer = (container) => {
  const marker = document.createElement('div')
  marker.dataset.testid = 'runner-controls-presentation'
  container.append(marker)
  let disposed = false
  return {
    ready: Promise.resolve(),
    render(snapshot) {
      if (disposed) return false
      const activeTarget = snapshot.activeTarget
      const pitchFeedback = activeTarget?.pitchFeedback
      marker.dataset.courseSeconds = String(snapshot.courseSeconds)
      marker.dataset.status = snapshot.status
      marker.dataset.targetId = activeTarget?.id ?? ''
      marker.dataset.targetPhase = activeTarget?.phase ?? ''
      marker.dataset.targetNoteIndex =
        activeTarget === null ? '' : String(activeTarget.noteIndex)
      marker.dataset.pitchState = pitchFeedback?.state ?? 'neutral'
      marker.dataset.pitchObservedMidi =
        pitchFeedback?.observedMidi === null || pitchFeedback === undefined
          ? ''
          : String(pitchFeedback.observedMidi)
      marker.dataset.pitchComparedTargetMidi =
        pitchFeedback?.comparedTargetMidi === null ||
        pitchFeedback === undefined
          ? ''
          : String(pitchFeedback.comparedTargetMidi)
      marker.dataset.fill = String(
        activeTarget?.notes.reduce((sum, note) => sum + note.fillProgress, 0) ??
          0,
      )
      return true
    },
    resize() {},
    metrics: () => ({
      drawCalls: 0,
      triangles: 0,
      residentChunks: 0,
      targets: 0,
    }),
    dispose() {
      disposed = true
      marker.remove()
    },
  }
}

/** Bounded browser-side evidence for the long PCM course and its failure artifact. */
export function createRunnerCourseProbe(page: Page): {
  install(runner: Locator): Promise<void>
  attach(testInfo: TestInfo): Promise<RunnerCourseProbe | undefined>
} {
  const viteDiagnostics: string[] = []
  let viteDiagnosticsDropped = 0
  let attached = false
  page.on('console', (message) => {
    const text = message.text()
    if (!/\[vite\]/i.test(text)) return
    if (viteDiagnostics.length < 64)
      viteDiagnostics.push(`${message.type()}: ${text}`)
    else viteDiagnosticsDropped++
  })

  return {
    async install(runner) {
      await runner.evaluate((element) => {
        const maximumPitchFeedbackSamples = 512
        const pitchFeedbackIntervalSeconds = 0.08
        const phases = [element.dataset.phase ?? 'unknown']
        const frameGaps: { courseSeconds: number; duration: number }[] = []
        const longTasks: { courseSeconds: number; duration: number }[] = []
        const courseSeconds = () => Number(element.dataset.courseSeconds)
        const probe: RunnerCourseProbe = {
          phases,
          frameGaps,
          longTasks,
          pitchFeedback: [],
          pitchFeedbackDropped: 0,
          runnerElementConnected: element.isConnected,
          runnerDisconnectedAtCourseSeconds: null,
        }
        window.runnerCourseProbe = probe
        new MutationObserver(() => {
          const phase = element.dataset.phase ?? 'unknown'
          if (phases.at(-1) !== phase) phases.push(phase)
        }).observe(element, {
          attributes: true,
          attributeFilter: ['data-phase'],
        })
        const datasetNumber = (value: string | undefined): number | null => {
          if (value === undefined || value === '') return null
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }
        let lastPitchFeedbackKey = ''
        let lastPitchFeedbackCourseSeconds = Number.NEGATIVE_INFINITY
        const recordPitchFeedback = () => {
          const marker = document.querySelector<HTMLElement>(
            '[data-testid="runner-controls-presentation"]',
          )
          const markerCourseSeconds = datasetNumber(
            marker?.dataset.courseSeconds,
          )
          const targetId = marker?.dataset.targetId ?? ''
          if (
            marker === null ||
            markerCourseSeconds === null ||
            targetId === ''
          )
            return
          const readout = document.querySelector<HTMLElement>(
            '[aria-label="Your voice and target"]',
          )
          const state = marker.dataset.pitchState ?? 'neutral'
          const noteIndex = datasetNumber(marker.dataset.targetNoteIndex)
          const targetLabel =
            readout
              ?.querySelector<HTMLElement>('[data-pitch-target]')
              ?.textContent?.trim() ?? ''
          const observedLabel =
            readout
              ?.querySelector<HTMLElement>('[data-pitch-observed]')
              ?.textContent?.trim() ?? ''
          const semanticKey = [
            targetId,
            marker.dataset.targetPhase ?? '',
            noteIndex,
            state,
            targetLabel,
            observedLabel,
          ].join('|')
          const acceptedIntervalElapsed =
            state === 'accepted' &&
            markerCourseSeconds - lastPitchFeedbackCourseSeconds >=
              pitchFeedbackIntervalSeconds
          if (semanticKey === lastPitchFeedbackKey && !acceptedIntervalElapsed)
            return
          lastPitchFeedbackKey = semanticKey
          lastPitchFeedbackCourseSeconds = markerCourseSeconds
          if (probe.pitchFeedback.length >= maximumPitchFeedbackSamples) {
            probe.pitchFeedbackDropped++
            return
          }
          probe.pitchFeedback.push({
            courseSeconds: markerCourseSeconds,
            targetId,
            targetPhase: marker.dataset.targetPhase ?? '',
            noteIndex,
            state,
            targetLabel,
            observedLabel,
            comparedTargetMidi: datasetNumber(
              marker.dataset.pitchComparedTargetMidi,
            ),
            observedMidi: datasetNumber(marker.dataset.pitchObservedMidi),
          })
        }
        let previousFrame = performance.now()
        const trackFrame = (now: number) => {
          const duration = now - previousFrame
          previousFrame = now
          if (duration >= 100)
            frameGaps.push({ courseSeconds: courseSeconds(), duration })
          probe.runnerElementConnected = element.isConnected
          if (
            !element.isConnected &&
            probe.runnerDisconnectedAtCourseSeconds === null
          )
            probe.runnerDisconnectedAtCourseSeconds = courseSeconds()
          recordPitchFeedback()
          requestAnimationFrame(trackFrame)
        }
        requestAnimationFrame(trackFrame)
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((entries) => {
            for (const entry of entries.getEntries())
              longTasks.push({
                courseSeconds: courseSeconds(),
                duration: entry.duration,
              })
          })
          try {
            observer.observe({ type: 'longtask', buffered: true })
          } catch {
            /* Chromium may omit long-task timing in constrained CI sandboxes. */
          }
        }
      })
    },
    async attach(testInfo) {
      let probe: RunnerCourseProbe | undefined
      let currentRunner: {
        connected: boolean
        courseSeconds: string
        phase: string
        status: string
      } | null = null
      let evaluationError = ''
      try {
        const diagnostics = await page.evaluate(() => {
          const current = document.querySelector<HTMLElement>(
            '[data-testid="song-runner"]',
          )
          return {
            currentRunner:
              current === null
                ? null
                : {
                    connected: current.isConnected,
                    courseSeconds: current.dataset.courseSeconds ?? '',
                    phase: current.dataset.phase ?? '',
                    status: current.dataset.courseStatus ?? '',
                  },
            probe: window.runnerCourseProbe,
          }
        })
        probe = diagnostics.probe
        currentRunner = diagnostics.currentRunner
      } catch (error) {
        evaluationError = String(error)
      }
      if (!attached) {
        await testInfo.attach('runner-timing.json', {
          body: JSON.stringify(
            {
              currentRunner,
              evaluationError,
              probe,
              viteDiagnostics,
              viteDiagnosticsDropped,
            },
            null,
            2,
          ),
          contentType: 'application/json',
        })
        attached = true
      }
      return probe
    },
  }
}

/** Scoped module boundary; the application and its normal renderer have no test flags. */
export async function useRunnerControlsRenderer(page: Page): Promise<void> {
  await page.route(
    /\/packages\/glass-game\/src\/render\/runner-renderer\.ts(?:\?.*)?$/,
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export const createSongRunnerRenderer = ${createControlsRenderer.toString()};`,
      }),
  )
}
