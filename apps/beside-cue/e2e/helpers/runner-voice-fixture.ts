// Runner voice fixture — real oscillator PCM with explicit tone, silence and compiled-contour controls.
import type { Page } from '@playwright/test'
import type { CompiledRunnerCourse } from '../../../../packages/glass-game/src/runner/contracts'
import { SINGING_CURRENT } from '../../../../packages/glass-game/src/runner/first-course'
import { omitRasterOutput } from './glass-adventure-controls'

interface RunnerVoiceSource {
  context: AudioContext
  gain: GainNode
  oscillator: OscillatorNode
  track: MediaStreamTrack
}

const RUNNER_ROOT_MIDI = 57

declare global {
  interface Window {
    runnerVoiceFixture: {
      readonly requests: number
      readonly stoppedTracks: number
      tone(midi: number): void
      silent(): void
      followTarget(): void
      dispose(): Promise<void>
    }
  }
}

export async function installRunnerVoice(
  page: Page,
  followCourse = false,
  options: { omitRaster?: boolean; course?: CompiledRunnerCourse } = {},
): Promise<void> {
  const targets = (options.course ?? SINGING_CURRENT).targets.map((target) => ({
    judgeOpenCourseSeconds: target.judgeOpenCourseSeconds,
    judgeCloseCourseSeconds: target.judgeCloseCourseSeconds,
    notes: target.notes.map((note) => ({
      startCourseSeconds: note.startCourseSeconds,
      endCourseSeconds: note.endCourseSeconds,
      startOffsetSemitones: note.startOffsetSemitones,
      endOffsetSemitones: note.endOffsetSemitones,
    })),
  }))
  if (options.omitRaster !== false) await omitRasterOutput(page)
  await page.addInitScript(
    ({ follow, rootMidi, targets }) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      localStorage.setItem(`${prefix}runner-music-muted:v1`, 'true')

      let mode: 'follow' | 'tone' | 'silent' = follow ? 'follow' : 'tone'
      let fixedMidi = rootMidi
      let requests = 0
      let stoppedTracks = 0
      const sources: RunnerVoiceSource[] = []
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) return new MediaStream()
          requests++
          const context = new AudioContext()
          await context.resume()
          const oscillator = context.createOscillator()
          oscillator.frequency.value = 220
          const gain = context.createGain()
          gain.gain.value = 0.22
          const destination = context.createMediaStreamDestination()
          oscillator.connect(gain).connect(destination)
          oscillator.start()
          const track = destination.stream.getAudioTracks()[0]!
          const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
          const targetMidiAt = (courseSeconds: number): number => {
            const target = targets.find(
              (candidate) =>
                courseSeconds >= candidate.judgeOpenCourseSeconds &&
                courseSeconds <= candidate.judgeCloseCourseSeconds,
            )
            if (target === undefined || target.notes.length === 0)
              return rootMidi
            const first = target.notes[0]!
            if (courseSeconds <= first.startCourseSeconds)
              return rootMidi + first.startOffsetSemitones
            const last = target.notes.at(-1)!
            if (courseSeconds >= last.endCourseSeconds)
              return rootMidi + last.endOffsetSemitones
            const note =
              target.notes.find(
                (candidate) =>
                  courseSeconds >= candidate.startCourseSeconds &&
                  courseSeconds < candidate.endCourseSeconds,
              ) ?? last
            const duration = note.endCourseSeconds - note.startCourseSeconds
            const progress =
              duration <= 0
                ? 1
                : Math.min(
                    1,
                    Math.max(
                      0,
                      (courseSeconds - note.startCourseSeconds) / duration,
                    ),
                  )
            return (
              rootMidi +
              note.startOffsetSemitones +
              (note.endOffsetSemitones - note.startOffsetSemitones) * progress
            )
          }
          const applyTone = () => {
            const runner = document.querySelector<HTMLElement>(
              '[data-testid="song-runner"]',
            )
            const courseSeconds = Number(runner?.dataset.courseSeconds)
            const midi =
              mode === 'follow' && Number.isFinite(courseSeconds)
                ? targetMidiAt(courseSeconds)
                : fixedMidi
            oscillator.frequency.setValueAtTime(
              frequency(midi),
              context.currentTime,
            )
            gain.gain.setTargetAtTime(
              mode === 'silent' ? 0 : 0.22,
              context.currentTime,
              0.002,
            )
          }
          const followTimer = window.setInterval(applyTone, 10)
          const stop = track.stop.bind(track)
          track.stop = () => {
            if (track.readyState === 'ended') return
            stoppedTracks++
            if (followTimer !== undefined) window.clearInterval(followTimer)
            stop()
            oscillator.stop()
            oscillator.disconnect()
            gain.disconnect()
            void context.close()
          }
          sources.push({ context, gain, oscillator, track })
          return destination.stream
        },
      })
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        configurable: true,
        value: async () => [
          {
            deviceId: 'runner-test-input',
            groupId: 'runner-test-group',
            kind: 'audioinput',
            label: 'Runner test microphone',
            toJSON: () => ({}),
          },
        ],
      })
      window.runnerVoiceFixture = {
        tone(midi: number) {
          mode = 'tone'
          fixedMidi = midi
        },
        silent() {
          mode = 'silent'
        },
        followTarget() {
          mode = 'follow'
        },
        get requests() {
          return requests
        },
        get stoppedTracks() {
          return stoppedTracks
        },
        async dispose() {
          for (const source of sources)
            if (source.track.readyState === 'live') source.track.stop()
          await Promise.all(
            sources.map((source) =>
              source.context.state === 'closed'
                ? Promise.resolve()
                : source.context.close(),
            ),
          )
        },
      }
    },
    {
      follow: followCourse,
      rootMidi: RUNNER_ROOT_MIDI,
      targets,
    },
  )
}
