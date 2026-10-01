// Thawing Song input proof — real oscillator PCM enters the ordinary microphone detector.

import type { Page } from '@playwright/test'
import type { SavedProgress } from '../../../../packages/glass-game/src/contracts'
import type { CompiledMelody } from '../../../../packages/glass-game/src/core/melody-contour'

declare global {
  interface Window {
    thawingInput: {
      streams: MediaStream[]
      tone(midi: number): void
      phrase(
        samples: { timeSeconds: number; midi: number | null }[],
        duration: number,
      ): void
      sequence(samples: { afterSeconds: number; midi: number | null }[]): number
      audioTime(): number
      silent(): void
    }
  }
}

export async function installThawingInput(
  page: Page,
  options: {
    progress?: SavedProgress
    realRendering?: boolean
  } = {},
): Promise<void> {
  await page.addInitScript(
    ({ progress, realRendering }) => {
      if (!realRendering)
        for (const name of [
          'clear',
          'drawArrays',
          'drawArraysInstanced',
          'drawElements',
          'drawElementsInstanced',
        ])
          Object.defineProperty(WebGL2RenderingContext.prototype, name, {
            configurable: true,
            value: () => undefined,
          })
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(`${prefix}comfortable-note`, '60')
      localStorage.setItem(
        `${prefix}camera-mode:v1`,
        realRendering ? 'third-person' : 'first-person',
      )
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
      if (
        progress &&
        localStorage.getItem(`${prefix}progress:${progress.levelId}`) === null
      )
        localStorage.setItem(
          `${prefix}progress:${progress.levelId}`,
          JSON.stringify(progress),
        )
      const streams: MediaStream[] = []
      const sources: {
        context: AudioContext
        oscillator: OscillatorNode
        gain: GainNode
      }[] = []
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        gain.gain.value = 0
        const output = context.createMediaStreamDestination()
        oscillator.connect(gain).connect(output)
        oscillator.start()
        const track = output.stream.getAudioTracks()[0]!
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        sources.push({ context, oscillator, gain })
        streams.push(output.stream)
        return output.stream
      }
      const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
      window.thawingInput = {
        streams,
        tone(midi) {
          const s = sources.at(-1)!
          const at = s.context.currentTime
          s.oscillator.frequency.cancelScheduledValues(at)
          s.oscillator.frequency.setValueAtTime(frequency(midi), at)
          s.gain.gain.cancelScheduledValues(at)
          s.gain.gain.setValueAtTime(0.22, at)
        },
        phrase(samples, duration) {
          const s = sources.at(-1)!
          const at = s.context.currentTime
          const first = samples.find((p) => p.midi !== null)!
          s.oscillator.frequency.cancelScheduledValues(at)
          s.oscillator.frequency.setValueAtTime(frequency(first.midi!), at)
          s.gain.gain.cancelScheduledValues(at)
          s.gain.gain.setValueAtTime(0.22, at)
          // Real capture needs a brief initial landing to acquire the live signal.
          const lead = 0.35
          for (const point of samples) {
            if (point.midi !== null)
              s.oscillator.frequency.setValueAtTime(
                frequency(point.midi),
                at + lead + point.timeSeconds,
              )
            s.gain.gain.setValueAtTime(
              point.midi === null ? 0 : 0.22,
              at + lead + point.timeSeconds,
            )
          }
          s.gain.gain.setValueAtTime(0, at + lead + duration + 0.5)
        },
        sequence(samples) {
          const s = sources.at(-1)!
          const at = s.context.currentTime
          s.oscillator.frequency.cancelScheduledValues(at)
          s.gain.gain.cancelScheduledValues(at)
          for (const point of samples) {
            const when = at + point.afterSeconds
            if (point.midi !== null)
              s.oscillator.frequency.setValueAtTime(frequency(point.midi), when)
            s.gain.gain.setValueAtTime(point.midi === null ? 0 : 0.22, when)
          }
          return at
        },
        audioTime() {
          return sources.at(-1)!.context.currentTime
        },
        silent() {
          for (const s of sources)
            if (s.context.state !== 'closed') {
              s.gain.gain.cancelScheduledValues(s.context.currentTime)
              s.gain.gain.setValueAtTime(0, s.context.currentTime)
            }
        },
      }
    },
    {
      progress: options.progress,
      realRendering: options.realRendering ?? false,
    },
  )
}

export async function singCompiledPhrase(
  page: Page,
  melody: CompiledMelody,
): Promise<void> {
  await page.evaluate(
    ({ samples, duration }) => window.thawingInput.phrase(samples, duration),
    {
      samples: melody.samples.map((p) => ({
        timeSeconds: p.timeSeconds,
        midi: p.midi,
      })),
      duration: melody.durationSeconds,
    },
  )
}
