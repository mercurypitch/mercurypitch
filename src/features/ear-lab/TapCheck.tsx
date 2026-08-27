// ============================================================
// TapCheck — the rhythm seam, tried by hand in the readiness panel.
//
// Eight clicks at 100 BPM in the room's own click voice; tap with
// them. Every tap goes through the same ledger Pulse will use: the
// page-clock stamp of the touch, measured from the instant the first
// click was scheduled, with the app's round trip subtracted. The
// summary says where the taps landed — early or late, and how
// tightly — so the subtraction can be judged on real hardware before
// a drill depends on it.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { unlockAudio } from '@/lib/audio-unlock'
import type { TapSummary } from '@/lib/ear/tap-input'
import { createTapLedger, summariseTaps } from '@/lib/ear/tap-input'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { useEarRoom } from './ear-room-context'
import styles from './EarRoomShell.module.css'
import { TapPad } from './EarStage'

const BEATS = 8
const PERIOD_MS = 600
const LEAD_S = 0.6
const BEAT_OFFSETS_MS = Array.from({ length: BEATS }, (_, i) => i * PERIOD_MS)

type Phase = 'idle' | 'running' | 'done'

function signed(ms: number): string {
  const rounded = Math.round(ms)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

export function TapCheck(): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const [phase, setPhase] = createSignal<Phase>('idle')
  const [summary, setSummary] = createSignal<TapSummary | null>(null)
  const [count, setCount] = createSignal(0)
  const ledger = createTapLedger({ latencyMs: micLatencyMs })
  let scheduled: ScheduledClick[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  function cancel(): void {
    clearTimeout(timer)
    for (const click of scheduled) click.cancel()
    scheduled = []
    ledger.disarm()
  }
  onCleanup(cancel)

  function finish(): void {
    setSummary(summariseTaps(ledger.taps(), BEAT_OFFSETS_MS, PERIOD_MS / 2))
    ledger.disarm()
    scheduled = []
    setPhase('done')
  }

  async function start(): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
    unlockAudio(ctx)
    cancel()
    // Both clocks read in the same instant: the first click's audio
    // time, and the page time the ledger measures taps from.
    const startAt = ctx.currentTime + LEAD_S
    const originMs = performance.now() + LEAD_S * 1000
    const click = {
      voice: room.clickVoice(),
      gainLevel: room.volume() * audioEngine.getVolume(),
    }
    for (const offset of BEAT_OFFSETS_MS) {
      scheduled.push(scheduleClick(ctx, startAt + offset / 1000, click))
    }
    ledger.arm(originMs)
    setCount(0)
    setSummary(null)
    setPhase('running')
    timer = setTimeout(
      finish,
      LEAD_S * 1000 + (BEATS - 1) * PERIOD_MS + PERIOD_MS / 2,
    )
  }

  const onTap = (atMs: number) => {
    if (phase() === 'running') {
      ledger.tap(atMs)
      setCount(ledger.taps().length)
      return
    }
    void start()
  }

  const reading = (): string => {
    if (phase() === 'idle') {
      return 'Press the pad to start eight clicks at 100 BPM, then tap with them.'
    }
    if (phase() === 'running') {
      return count() === 0
        ? 'Tap with the clicks.'
        : `Tap with the clicks — ${count()} so far.`
    }
    const take = summary()
    if (!take) return 'No tap landed near a click. Press the pad to try again.'
    const side = take.meanMs < 0 ? 'early' : 'late'
    const trip =
      micLatencyMs() > 0
        ? `Round trip ${Math.round(micLatencyMs())} ms subtracted from every tap.`
        : 'Round trip unmeasured — these are raw taps.'
    return `Mean ${signed(take.meanMs)} ms (${side}) · spread ${Math.round(take.spreadMs)} ms · ${take.matched} of ${BEATS} clicks met. ${trip}`
  }

  return (
    <div class={styles.tapCheck} data-testid="ear-tap-check">
      <span class={styles.glassLabel}>Tap check</span>
      <TapPad
        label={
          phase() === 'running'
            ? 'Tap'
            : phase() === 'done'
              ? 'Again'
              : 'Tap check'
        }
        sub={
          phase() === 'running'
            ? 'with the clicks'
            : 'eight clicks · tap along · the round trip comes off'
        }
        armed={phase() === 'running'}
        onTap={onTap}
      />
      <p class={styles.tapReading} aria-live="polite">
        {reading()}
      </p>
    </div>
  )
}
