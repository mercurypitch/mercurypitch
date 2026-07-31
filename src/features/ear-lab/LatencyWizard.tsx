// ============================================================
// LatencyWizard — measures the device's audio round trip.
//
// Five clicks are scheduled on the AudioContext clock and the
// microphone records on the same clock; the median gap between
// scheduled and heard is the number every millisecond drill will
// subtract. Until it exists, ms drills stay locked (plan §7) —
// a Grid reading that silently included 140 ms of Bluetooth
// buffering would be confidently wrong.
//
// The click path goes straight to ctx.destination, bypassing the
// engine's master gain, reverb and envelopes: the wizard measures
// the hardware, not the app's effects chain.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { LatencyReading } from '@/lib/ear/latency'
import { aggregateLatency, detectClicks, MAX_TRUSTED_SPREAD_MS, } from '@/lib/ear/latency'
import { LATENCY_TIMING } from '@/lib/ear/timing'
import { micManager } from '@/lib/mic-manager'
import { earLatency, recordLatencyReading } from '@/stores/ear-lab-store'
import { scheduleClick } from './click-synth'
import styles from './LatencyWizard.module.css'

type WizardStatus = 'idle' | 'running' | 'error'

const MIC_CONSUMER = 'ear-latency-wizard'

interface Capture {
  samples: Float32Array
  /** Context time of the capture's first sample. */
  startAt: number
}

/** Record the mic through a ScriptProcessor until `stopAt` on the
 *  context clock. Chunks are contiguous, so one concatenated buffer
 *  plus the first chunk's playbackTime maps samples to clock time.
 *
 *  A wall-clock timeout backs the audio-clock stop condition: if the
 *  processor never fires (dead track, suspended context) the promise
 *  would otherwise hang and strand the wizard in 'running' forever. */
function captureUntil(
  ctx: AudioContext,
  stream: MediaStream,
  stopAt: number,
): Promise<Capture> {
  return new Promise((resolve) => {
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const sink = ctx.createGain()
    sink.gain.value = 0

    const chunks: Float32Array[] = []
    let firstChunkAt: number | null = null
    let stopped = false

    const teardown = (): void => {
      processor.onaudioprocess = null
      processor.disconnect()
      source.disconnect()
      sink.disconnect()
    }

    const finish = (): void => {
      if (stopped) return
      stopped = true
      clearTimeout(bailout)
      teardown()
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const samples = new Float32Array(total)
      let offset = 0
      for (const chunk of chunks) {
        samples.set(chunk, offset)
        offset += chunk.length
      }
      resolve({ samples, startAt: firstChunkAt ?? 0 })
    }

    const bailout = setTimeout(finish, LATENCY_TIMING.captureTimeoutMs)

    processor.onaudioprocess = (event) => {
      if (stopped) return
      // playbackTime = context time of this buffer's first sample; the
      // fallback (currentTime minus the buffer span) is one buffer
      // coarse but keeps ancient WebKits from breaking entirely.
      const at =
        typeof event.playbackTime === 'number' && event.playbackTime > 0
          ? event.playbackTime
          : ctx.currentTime - 4096 / ctx.sampleRate
      if (firstChunkAt === null) firstChunkAt = at
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))

      if (at + 4096 / ctx.sampleRate >= stopAt) finish()
    }

    source.connect(processor)
    processor.connect(sink)
    sink.connect(ctx.destination)
  })
}

export function LatencyWizard(): JSX.Element {
  const { audioEngine } = useEngines()
  const [status, setStatus] = createSignal<WizardStatus>('idle')
  const [error, setError] = createSignal('')
  const [lastRun, setLastRun] = createSignal<LatencyReading | null>(null)

  onCleanup(() => micManager.release(MIC_CONSUMER))

  async function measure(): Promise<void> {
    setStatus('running')
    setError('')
    try {
      await audioEngine.init()
      await audioEngine.resume()
      const ctx = audioEngine.getAudioContext()
      if (!ctx) throw new Error('Audio engine has no context')

      const stream = await micManager.acquire(MIC_CONSUMER)

      const t0 = ctx.currentTime + LATENCY_TIMING.settleS
      const scheduled = Array.from(
        { length: LATENCY_TIMING.clicks },
        (_, i) => t0 + i * LATENCY_TIMING.spacingS,
      )
      for (const at of scheduled) scheduleClick(ctx, at)

      const capture = await captureUntil(
        ctx,
        stream,
        scheduled[scheduled.length - 1] + LATENCY_TIMING.tailS,
      )
      micManager.release(MIC_CONSUMER)

      const reading = aggregateLatency(
        detectClicks(
          capture.samples,
          ctx.sampleRate,
          capture.startAt,
          scheduled,
        ),
      )
      if (!reading) {
        setStatus('error')
        setError(
          'Could not hear the clicks. Turn the volume up, keep the room quiet, and try again.',
        )
        return
      }

      recordLatencyReading(reading)
      setLastRun(reading)
      setStatus('idle')
    } catch (err) {
      micManager.release(MIC_CONSUMER)
      setStatus('error')
      setError(
        err instanceof Error && err.message !== ''
          ? err.message
          : 'Microphone unavailable. Allow mic access and try again.',
      )
    }
  }

  const stored = () => earLatency()
  const unsteady = () => (stored()?.spreadMs ?? 0) > MAX_TRUSTED_SPREAD_MS

  return (
    <article class={styles.card} data-ear-widget="latency">
      <div class={styles.head}>
        <h3>Timing calibration</h3>
        <Show
          when={stored()}
          fallback={<span class={styles.badgeMissing}>Not measured</span>}
        >
          {(entry) => (
            <span class={styles.badgeValue}>
              {Math.round(entry().medianMs)} ms ± {entry().spreadMs.toFixed(1)}
            </span>
          )}
        </Show>
      </div>

      <p class={styles.copy}>
        Plays five clicks and listens for them through your microphone to
        measure your device's audio round trip. Millisecond drills stay locked
        until this number exists — without it they would blame your ear for your
        hardware.
      </p>

      <Show when={status() === 'running'}>
        <p class={styles.running}>
          Listening for clicks — volume up, stay quiet (about 4 seconds)…
        </p>
      </Show>
      <Show when={status() === 'error'}>
        <p class={styles.error}>{error()}</p>
      </Show>
      <Show when={status() !== 'running' && unsteady()}>
        <p class={styles.warn}>
          The last measurement was unsteady — worth re-running in a quieter
          room.
        </p>
      </Show>
      <Show when={lastRun()}>
        {(reading) => (
          <p class={styles.copy}>
            Heard {reading().detected} of {reading().total} clicks.
          </p>
        )}
      </Show>

      <button
        type="button"
        class={styles.measureBtn}
        disabled={status() === 'running'}
        onClick={() => void measure()}
      >
        {stored() ? 'Re-measure' : 'Measure round trip'}
      </button>
    </article>
  )
}
