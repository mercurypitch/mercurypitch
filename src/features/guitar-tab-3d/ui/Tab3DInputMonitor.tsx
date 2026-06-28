// ============================================================
// Tab3DInputMonitor — input signal monitor overlay
// ============================================================
//
// A small overlay (bottom-left of the 3D view) for confirming that the guitar
// input is being detected and matched: input mode, your detected note, the
// nearest target note, whether they match (same rule the scorer uses), the
// last hit timing, a level bar, and a live mic waveform. Toggled from the HUD
// rail (the "Signal" toggle); defaults on in dev, off for players.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { Tab3DControls } from './Tab3DHud'

const GOOD_MS = 150

export function Tab3DInputMonitor(props: {
  controls: Tab3DControls
  fallingNotes: Accessor<GuitarNote[]>
  playheadBeat: Accessor<number>
  songBpm: Accessor<number>
}) {
  // eslint-disable-next-line solid/reactivity
  const c = props.controls
  let waveCanvas: HTMLCanvasElement | undefined
  const [level, setLevel] = createSignal(0)

  const detected = () => {
    const m = c.detectedMidi()
    return m === null ? null : { midi: m, name: midiToNoteNameOctave(m) }
  }

  // Nearest hittable target around the playhead (mirrors the scorer's window).
  const target = () => {
    const ph = props.playheadBeat()
    const bps = Math.max(0.1, props.songBpm() / 60)
    let best: GuitarNote | null = null
    let bestAbs = Infinity
    for (const n of props.fallingNotes()) {
      if ((n.isBacking ?? false) === true) continue
      const deltaMs = ((n.startBeat - ph) / bps) * 1000
      const endMs = ((n.startBeat + n.duration - ph) / bps) * 1000
      if (deltaMs > GOOD_MS || endMs < -GOOD_MS) continue
      const a = Math.abs(deltaMs)
      if (a < bestAbs) {
        bestAbs = a
        best = n
      }
    }
    return best === null
      ? null
      : { midi: best.midi, name: midiToNoteNameOctave(best.midi) }
  }

  // Same match rule as the scorer: exact for MIDI, pitch-class for mic.
  const matches = () => {
    const d = detected()
    const t = target()
    if (d === null || t === null) return null
    return c.inputMode() === 'midi'
      ? d.midi === t.midi
      : d.midi % 12 === t.midi % 12
  }

  const lastHit = () => {
    const r = c.hitResults()
    return r.length > 0 ? r[r.length - 1] : null
  }

  onMount(() => {
    let raf = 0
    const draw = () => {
      setLevel(c.getInputLevel())
      const cv = waveCanvas
      const data = c.getInputTimeData()
      if (cv) {
        const ctx = cv.getContext('2d')
        if (ctx) {
          const w = cv.width
          const h = cv.height
          ctx.clearRect(0, 0, w, h)
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'
          ctx.beginPath()
          ctx.moveTo(0, h / 2)
          ctx.lineTo(w, h / 2)
          ctx.stroke()
          if (data && data.length > 0) {
            ctx.strokeStyle = '#4dd2ff'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            const step = data.length / w
            for (let x = 0; x < w; x++) {
              const v = data[Math.floor(x * step)] ?? 0
              const y = h / 2 - v * (h / 2) * 0.95
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    onCleanup(() => cancelAnimationFrame(raf))
  })

  return (
    <div class="gp-tab3d-monitor" aria-label="Input signal monitor">
      <div class="gp-tab3d-monitor-head">
        <span>Input monitor</span>
        <span class="gp-tab3d-monitor-mode">{c.inputMode()}</span>
      </div>
      <div class="gp-tab3d-monitor-row">
        <span class="gp-tab3d-monitor-label">You</span>
        <span class="gp-tab3d-monitor-val">
          {(() => {
            const d = detected()
            return d ? `${d.name} (${d.midi})` : '—'
          })()}
        </span>
      </div>
      <div class="gp-tab3d-monitor-row">
        <span class="gp-tab3d-monitor-label">Target</span>
        <span class="gp-tab3d-monitor-val">
          {(() => {
            const t = target()
            return t ? `${t.name} (${t.midi})` : '—'
          })()}
        </span>
      </div>
      <div class="gp-tab3d-monitor-row">
        <span class="gp-tab3d-monitor-label">Match</span>
        <span
          class="gp-tab3d-monitor-val"
          classList={{
            'is-good': matches() === true,
            'is-bad': matches() === false,
          }}
        >
          {matches() === null ? '—' : matches() === true ? 'yes' : 'no'}
        </span>
      </div>
      <Show when={lastHit()}>
        {(h) => (
          <div class="gp-tab3d-monitor-row">
            <span class="gp-tab3d-monitor-label">Last</span>
            <span
              class="gp-tab3d-monitor-val"
              classList={{
                'is-good': h().timing !== 'miss',
                'is-bad': h().timing === 'miss',
              }}
            >
              {h().timing}
            </span>
          </div>
        )}
      </Show>
      <div class="gp-tab3d-monitor-meter">
        <div
          class="gp-tab3d-monitor-meter-fill"
          style={{ width: `${Math.min(100, Math.round(level() * 250))}%` }}
        />
      </div>
      <canvas
        ref={waveCanvas}
        width="180"
        height="36"
        class="gp-tab3d-monitor-wave"
      />
    </div>
  )
}
