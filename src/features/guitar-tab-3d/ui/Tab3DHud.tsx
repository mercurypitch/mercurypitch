// ============================================================
// Tab3DHud — glass control overlay for the 3D tab view
// ============================================================
//
// Floating HUD rendered over the canvas (DOM, not painted in the renderer).
// Dockable to the top (laid out after the song name) or bottom-centre via the
// grip handle: click toggles, drag snaps to the half you release in. The
// transport, speed, transpose and display toggles live on the rail; the
// practice loop opens as a popover. Styling: guitar-practice.css (.gp-hud*).

import type { Accessor, JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { GuitarHitResult } from '@/features/guitar-practice/useGuitarPracticeController'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { createPersistedSignal } from '@/lib/storage'

export interface Tab3DControls {
  gameState: Accessor<string>
  togglePlay: () => void
  songName: Accessor<string>
  songBpm: Accessor<number>
  playheadBeat: Accessor<number>
  playbackRate: Accessor<number>
  setPlaybackRate: (rate: number) => void
  transpose: Accessor<number>
  setTranspose: (n: number) => void
  transposeBounds: Accessor<[number, number]>
  showNoteLabels: Accessor<boolean>
  setShowNoteLabels: (on: boolean) => void
  showFretboard: Accessor<boolean>
  setShowFretboard: (on: boolean) => void
  loopEnabled: Accessor<boolean>
  loopStartBeat: Accessor<number>
  setLoopStartBeat: (beat: number) => void
  loopEndBeat: Accessor<number>
  setLoopEndBeat: (beat: number) => void
  rampEnabled: Accessor<boolean>
  setRampEnabled: (on: boolean) => void
  startingRate: Accessor<number>
  setStartingRate: (rate: number) => void
  stepRate: Accessor<number>
  setStepRate: (rate: number) => void
  startPracticeLoop: () => void
  stopPracticeLoop: () => void
  // End-of-run score (shown as a corner card instead of a modal)
  score: Accessor<number>
  totalNotes: Accessor<number>
  maxCombo: Accessor<number>
  recentScores: Accessor<number[]>
  startGame: () => void
  stopGame: () => void
  // Live input scoring (mic/MIDI) while playing
  combo: Accessor<number>
  detectedMidi: Accessor<number | null>
  detectedClarity: Accessor<number>
  hitResults: Accessor<GuitarHitResult[]>
  showUserNotes: Accessor<boolean>
  // Input toggles, so scoring is reachable without the transport bar
  isMicActive: Accessor<boolean>
  startMic: () => void
  stopMic: () => void
  midiConnected: Accessor<boolean>
  midiConnect: () => void
  midiDisconnect: () => void
  // For the dev input-signal monitor
  inputMode: Accessor<'keyboard' | 'mic' | 'midi'>
  getInputLevel: () => number
  getInputTimeData: () => Float32Array | null
  // Input signal monitor overlay (You/Target/Match + level + waveform)
  showInputMonitor: Accessor<boolean>
  setShowInputMonitor: (on: boolean) => void
  // Orientation gizmo (X/Y/Z axes, camera navigation)
  showGizmo: Accessor<boolean>
  setShowGizmo: (on: boolean) => void
}

const scoreTier = (s: number): string =>
  s >= 80 ? 'good' : s >= 50 ? 'ok' : 'poor'

const gradeLabel = (pct: number): string =>
  pct >= 90
    ? 'Pitch perfect!'
    : pct >= 80
      ? 'Excellent!'
      : pct >= 65
        ? 'Good!'
        : pct >= 50
          ? 'Okay!'
          : 'Keep practicing!'

type Dock = 'top' | 'bottom'

const isDock = (v: unknown): v is Dock => v === 'top' || v === 'bottom'

// Touch / small screens default to the top dock: the bottom-centre rail sits
// under the thumbs and, on narrow widths, wraps tall enough to cover the
// canvas. Desktop keeps the centred bottom rail. The user's explicit choice is
// persisted (local, per-device) and always wins next session.
const HUD_DOCK_KEY = 'gp-tab3d-hud-dock'
const prefersTopDock = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches
}

const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export function Tab3DHud(props: { controls: Tab3DControls }) {
  // Stable controls object created once by the parent; its fields are the
  // reactive accessors we actually read.
  // eslint-disable-next-line solid/reactivity
  const c = props.controls
  const [dock, setDock] = createPersistedSignal<Dock>(
    HUD_DOCK_KEY,
    prefersTopDock() ? 'top' : 'bottom',
    { validator: isDock },
  )
  const [loopOpen, setLoopOpen] = createSignal(false)

  const isPlaying = () => c.gameState() === 'playing'
  const rate = () => c.playbackRate()
  const effBpm = () => Math.round(c.songBpm() * rate())
  const barBeat = () => {
    const b = Math.max(0, c.playheadBeat())
    return `${Math.floor(b / 4) + 1}.${Math.floor(b % 4) + 1}`
  }
  const fmtRate = (r: number) => `${r.toFixed(2)}×`
  const fmtSemi = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  const bounds = () => c.transposeBounds()

  // Grip: click toggles dock; drag snaps to the half you release in.
  let downY = 0
  let moved = false
  let containerEl: HTMLElement | null = null
  const onGripDown = (e: PointerEvent) => {
    downY = e.clientY
    moved = false
    containerEl = (e.currentTarget as HTMLElement).closest(
      '.gp-tab3d-container',
    )
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events / no active pointer */
    }
    e.preventDefault()
  }
  const onGripMove = (e: PointerEvent) => {
    if (Math.abs(e.clientY - downY) > 4) moved = true
  }
  const onGripUp = (e: PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    if (!moved) {
      setDock((d) => (d === 'top' ? 'bottom' : 'top'))
      return
    }
    const rect = containerEl?.getBoundingClientRect()
    if (rect) setDock(e.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom')
  }

  const grip = () => (
    <button
      class="gp-hud-grip"
      title="Drag to move (top/bottom) · click to flip"
      aria-label="Move control bar"
      onPointerDown={onGripDown}
      onPointerMove={onGripMove}
      onPointerUp={onGripUp}
      onPointerCancel={onGripUp}
    >
      <Glyph paths={GRIP} />
    </button>
  )

  const isLive = () => {
    const s = c.gameState()
    return s === 'playing' || s === 'countdown'
  }
  const detectedName = () => {
    const m = c.detectedMidi()
    return m === null ? null : midiToNoteNameOctave(m)
  }

  const statusBlock = () => (
    <>
      <span class="gp-hud-title">{c.songName() || 'Untitled tab'}</span>
      <span class="gp-hud-stats">
        <Stat label="Bar" value={barBeat()} />
        <Stat label="BPM" value={String(effBpm())} />
        <Show when={c.transpose() !== 0}>
          <Stat label="Shift" value={`${fmtSemi(c.transpose())} st`} />
        </Show>
      </span>
      <Show when={isLive()}>
        <span class="gp-hud-stats gp-hud-live">
          <Stat label="Score" value={String(Math.floor(c.score()))} />
          <Stat label="Combo" value={`${c.combo()}×`} />
          <Show when={detectedName()}>
            {(n) => <Stat label="You" value={n()} />}
          </Show>
        </span>
      </Show>
    </>
  )

  const railContent = () => (
    <>
      <button
        class="gp-hud-hero"
        classList={{ 'is-playing': isPlaying() }}
        aria-label={isPlaying() ? 'Pause' : 'Play'}
        title={isPlaying() ? 'Pause' : 'Play'}
        onClick={(e) => {
          c.togglePlay()
          e.currentTarget.blur()
        }}
      >
        {isPlaying() ? (
          <Glyph paths={PAUSE} fill />
        ) : (
          <Glyph paths={PLAY} fill />
        )}
      </button>

      <span class="gp-hud-sep" />

      <Stepper
        icon={GAUGE}
        label="Speed"
        value={fmtRate(rate())}
        onDec={() => c.setPlaybackRate(clamp(round2(rate() - 0.05), 0.25, 2))}
        onInc={() => c.setPlaybackRate(clamp(round2(rate() + 0.05), 0.25, 2))}
        decDisabled={rate() <= 0.25}
        incDisabled={rate() >= 2}
      />
      <div class="gp-hud-presets">
        <For each={[0.5, 0.75, 1]}>
          {(p) => (
            <button
              class="gp-chip"
              classList={{ 'is-active': Math.abs(rate() - p) < 0.001 }}
              onClick={(e) => {
                c.setPlaybackRate(p)
                e.currentTarget.blur()
              }}
            >
              {fmtRate(p)}
            </button>
          )}
        </For>
      </div>

      <Stepper
        icon={TRANSPOSE}
        label="Transpose"
        value={fmtSemi(c.transpose())}
        onDec={() => c.setTranspose(c.transpose() - 1)}
        onInc={() => c.setTranspose(c.transpose() + 1)}
        decDisabled={c.transpose() <= bounds()[0]}
        incDisabled={c.transpose() >= bounds()[1]}
        onDec2={() => c.setTranspose(c.transpose() - 12)}
        onInc2={() => c.setTranspose(c.transpose() + 12)}
        dec2Disabled={c.transpose() - 12 < bounds()[0]}
        inc2Disabled={c.transpose() + 12 > bounds()[1]}
      />

      <span class="gp-hud-sep" />

      <Toggle
        icon={LABELS}
        label="Names"
        active={c.showNoteLabels()}
        onClick={() => c.setShowNoteLabels(!c.showNoteLabels())}
      />
      <Toggle
        icon={FRETS}
        label="Neck"
        active={c.showFretboard()}
        onClick={() => c.setShowFretboard(!c.showFretboard())}
      />
      <Toggle
        icon={GIZMO}
        label="Axes"
        active={c.showGizmo()}
        onClick={() => c.setShowGizmo(!c.showGizmo())}
      />
      <Toggle
        icon={LOOP}
        label="Loop"
        active={loopOpen() || c.loopEnabled()}
        onClick={() => setLoopOpen((v) => !v)}
      />

      <span class="gp-hud-sep" />

      <Toggle
        icon={MIC}
        label="Mic"
        active={c.isMicActive()}
        onClick={() => (c.isMicActive() ? c.stopMic() : c.startMic())}
      />
      <Toggle
        icon={MIDI}
        label="MIDI"
        active={c.midiConnected()}
        onClick={() =>
          c.midiConnected() ? c.midiDisconnect() : c.midiConnect()
        }
      />
      <Toggle
        icon={SIGNAL}
        label="Signal"
        active={c.showInputMonitor()}
        onClick={() => c.setShowInputMonitor(!c.showInputMonitor())}
      />
    </>
  )

  return (
    <>
      <Show when={dock() === 'top'}>
        <div class="gp-hud-bar gp-hud-bar--top">
          <div class="gp-hud-bar-status">{statusBlock()}</div>
          <span class="gp-hud-sep" />
          {grip()}
          {railContent()}
        </div>
      </Show>

      <Show when={dock() === 'bottom'}>
        <div class="gp-hud-status">{statusBlock()}</div>
        <div class="gp-hud-rail">
          {grip()}
          {railContent()}
        </div>
      </Show>

      <Show when={loopOpen()}>
        <div
          class="gp-hud-loop"
          classList={{
            'gp-hud-loop--top': dock() === 'top',
            'gp-hud-loop--bottom': dock() === 'bottom',
          }}
        >
          <Stepper
            icon={MARK}
            label="A"
            value={c.loopStartBeat().toFixed(0)}
            onDec={() => c.setLoopStartBeat(Math.max(0, c.loopStartBeat() - 1))}
            onInc={() => c.setLoopStartBeat(c.loopStartBeat() + 1)}
            onSet={() =>
              c.setLoopStartBeat(Math.max(0, Math.round(c.playheadBeat())))
            }
          />
          <Stepper
            icon={MARK}
            label="B"
            value={c.loopEndBeat().toFixed(0)}
            onDec={() => c.setLoopEndBeat(Math.max(0, c.loopEndBeat() - 1))}
            onInc={() => c.setLoopEndBeat(c.loopEndBeat() + 1)}
            onSet={() =>
              c.setLoopEndBeat(Math.max(0, Math.round(c.playheadBeat())))
            }
          />
          <Toggle
            icon={GAUGE}
            label="Ramp"
            active={c.rampEnabled()}
            onClick={() => c.setRampEnabled(!c.rampEnabled())}
          />
          <Stepper
            label="From"
            value={fmtRate(c.startingRate())}
            onDec={() =>
              c.setStartingRate(clamp(round2(c.startingRate() - 0.05), 0.25, 2))
            }
            onInc={() =>
              c.setStartingRate(clamp(round2(c.startingRate() + 0.05), 0.25, 2))
            }
          />
          <Stepper
            label="Step"
            value={fmtRate(c.stepRate())}
            onDec={() =>
              c.setStepRate(clamp(round2(c.stepRate() - 0.05), 0.05, 1))
            }
            onInc={() =>
              c.setStepRate(clamp(round2(c.stepRate() + 0.05), 0.05, 1))
            }
          />
          <button
            class="gp-toggle"
            classList={{ 'is-active': c.loopEnabled() }}
            onClick={(e) => {
              if (c.loopEnabled()) c.stopPracticeLoop()
              else c.startPracticeLoop()
              e.currentTarget.blur()
            }}
          >
            {c.loopEnabled() ? 'Exit loop' : 'Start loop'}
          </button>
        </div>
      </Show>

      <Show when={c.gameState() === 'finished'}>
        {(() => {
          const pct = () => {
            const t = c.totalNotes()
            return t > 0 ? Math.round((c.score() / (t * 100)) * 100) : 0
          }
          return (
            <div class="gp-tab3d-score" aria-label="Session score">
              <span class="gp-tab3d-score-title">Complete</span>
              <span class={`gp-tab3d-score-pct is-${scoreTier(pct())}`}>
                {pct()}%
              </span>
              <span class="gp-tab3d-score-grade">{gradeLabel(pct())}</span>
              <span class="gp-tab3d-score-detail">
                {c.totalNotes()} notes · {c.maxCombo()}× combo
              </span>
              <Show when={c.recentScores().length > 1}>
                <div class="gp-tab3d-score-history">
                  <For each={c.recentScores().slice(1)}>
                    {(s) => (
                      <span class={`gp-tab3d-score-chip is-${scoreTier(s)}`}>
                        {s}%
                      </span>
                    )}
                  </For>
                </div>
              </Show>
              <div class="gp-tab3d-score-actions">
                <button
                  class="gp-chip"
                  onClick={(e) => {
                    c.startGame()
                    e.currentTarget.blur()
                  }}
                >
                  Play again
                </button>
                <button
                  class="gp-chip"
                  onClick={(e) => {
                    c.stopGame()
                    e.currentTarget.blur()
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        })()}
      </Show>
    </>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <span class="gp-hud-stat">
      <span class="gp-hud-stat-label">{props.label}</span>
      <span class="gp-hud-stat-val">{props.value}</span>
    </span>
  )
}

function Stepper(props: {
  icon?: string[]
  label: string
  value: string
  onDec: () => void
  onInc: () => void
  decDisabled?: boolean
  incDisabled?: boolean
  onDec2?: () => void
  onInc2?: () => void
  dec2Disabled?: boolean
  inc2Disabled?: boolean
  onSet?: () => void
}) {
  return (
    <div class="gp-pill">
      <Show when={props.icon}>
        {(ic) => (
          <span class="gp-pill-ico">
            <Glyph paths={ic()} />
          </span>
        )}
      </Show>
      <span class="gp-pill-label">{props.label}</span>
      <span class="gp-pill-ctrls">
        <Show when={props.onDec2}>
          <StepBtn
            label="Octave down"
            paths={CHEV2_DOWN}
            onClick={props.onDec2!}
            disabled={props.dec2Disabled}
          />
        </Show>
        <StepBtn
          label="Down"
          paths={MINUS}
          onClick={props.onDec}
          disabled={props.decDisabled}
        />
        <span class="gp-pill-val">{props.value}</span>
        <StepBtn
          label="Up"
          paths={PLUS}
          onClick={props.onInc}
          disabled={props.incDisabled}
        />
        <Show when={props.onInc2}>
          <StepBtn
            label="Octave up"
            paths={CHEV2_UP}
            onClick={props.onInc2!}
            disabled={props.inc2Disabled}
          />
        </Show>
        <Show when={props.onSet}>
          <button
            class="gp-step-btn"
            title="Set to playhead"
            aria-label="Set to playhead"
            onClick={(e) => {
              props.onSet?.()
              e.currentTarget.blur()
            }}
          >
            <Glyph paths={PIN} />
          </button>
        </Show>
      </span>
    </div>
  )
}

function StepBtn(props: {
  label: string
  paths: string[]
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      class="gp-step-btn"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={(e) => {
        props.onClick()
        e.currentTarget.blur()
      }}
    >
      <Glyph paths={props.paths} />
    </button>
  )
}

function Toggle(props: {
  icon: string[]
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      class="gp-toggle"
      classList={{ 'is-active': props.active }}
      aria-pressed={props.active}
      title={props.label}
      onClick={(e) => {
        props.onClick()
        e.currentTarget.blur()
      }}
    >
      <Glyph paths={props.icon} />
      <span>{props.label}</span>
    </button>
  )
}

function Glyph(props: { paths: string[]; fill?: boolean }): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={props.fill === true ? 'currentColor' : 'none'}
      stroke={props.fill === true ? 'none' : 'currentColor'}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <For each={props.paths}>{(d) => <path d={d} />}</For>
    </svg>
  )
}

// ── Icon paths (24x24) ─────────────────────────────────────
const PLAY = ['M8 5v14l11-7z']
const PAUSE = ['M6 5h4v14H6z', 'M14 5h4v14h-4z']
const MINUS = ['M5 12h14']
const PLUS = ['M12 5v14', 'M5 12h14']
const CHEV2_UP = ['M6 13l6-6 6 6', 'M6 19l6-6 6 6']
const CHEV2_DOWN = ['M6 5l6 6 6-6', 'M6 11l6 6 6-6']
const GAUGE = ['M5 18a8 8 0 1 1 14 0', 'M12 18l4-4']
const TRANSPOSE = ['M12 4v16', 'M8 8l4-4 4 4', 'M8 16l4 4 4-4']
const LABELS = [
  'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z',
  'M7 7h.01',
]
const FRETS = ['M3 8h18', 'M3 12h18', 'M3 16h18', 'M9 4v16', 'M15 4v16']
const LOOP = [
  'M17 2l4 4-4 4',
  'M3 11V9a4 4 0 0 1 4-4h14',
  'M7 22l-4-4 4-4',
  'M21 13v2a4 4 0 0 1-4 4H3',
]
const MARK = ['M6 3v18', 'M6 4h11l-2 3 2 3H6']
const PIN = ['M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10z', 'M12 11h.01']
const MIC = [
  'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z',
  'M5 11a7 7 0 0 0 14 0',
  'M12 18v3',
]
const MIDI = [
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  'M8 10h.01',
  'M16 10h.01',
  'M9 14h.01',
  'M15 14h.01',
  'M12 15h.01',
]
const SIGNAL = ['M2 12h4l2-6 3 12 2-6h7']
const GIZMO = ['M12 12V4', 'M12 12l7 4', 'M12 12l-7 4']
const GRIP = [
  'M9 6h.01',
  'M9 12h.01',
  'M9 18h.01',
  'M15 6h.01',
  'M15 12h.01',
  'M15 18h.01',
]
