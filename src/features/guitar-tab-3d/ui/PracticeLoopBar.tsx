// ============================================================
// PracticeLoopBar — speed control + A/B loop (speed trainer)
// ============================================================
//
// Practice strip for the 3D tab view: playback speed, an A/B loop with
// start/end markers, and an optional speed ramp (starting rate + per-pass
// step). Drives the guitar practice controller's loop.

import type { Accessor } from 'solid-js'

export interface PracticeLoopBarProps {
  playbackRate: Accessor<number>
  setPlaybackRate: (rate: number) => void
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
  playheadBeat: Accessor<number>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function PracticeLoopBar(props: PracticeLoopBarProps) {
  const fmtBeat = (b: number) => b.toFixed(1)
  const fmtRate = (r: number) => `${r.toFixed(2)}x`

  return (
    <div
      class="gp-tab3d-practicebar"
      style={{
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        gap: '10px',
        padding: '8px 10px',
        margin: '0 0 8px',
        'border-radius': '10px',
        background: 'rgba(255,255,255,0.04)',
        'font-size': '13px',
      }}
    >
      <Stepper
        label="Speed"
        value={fmtRate(props.playbackRate())}
        onDec={() => props.setPlaybackRate(props.playbackRate() - 0.1)}
        onInc={() => props.setPlaybackRate(props.playbackRate() + 0.1)}
      />

      <div
        style={{
          width: '1px',
          'align-self': 'stretch',
          background: 'rgba(255,255,255,0.1)',
        }}
      />

      <Stepper
        label="Start"
        value={fmtBeat(props.loopStartBeat())}
        onDec={() =>
          props.setLoopStartBeat(Math.max(0, props.loopStartBeat() - 1))
        }
        onInc={() => props.setLoopStartBeat(props.loopStartBeat() + 1)}
        onSet={() =>
          props.setLoopStartBeat(Math.max(0, Math.round(props.playheadBeat())))
        }
      />
      <Stepper
        label="End"
        value={fmtBeat(props.loopEndBeat())}
        onDec={() => props.setLoopEndBeat(Math.max(0, props.loopEndBeat() - 1))}
        onInc={() => props.setLoopEndBeat(props.loopEndBeat() + 1)}
        onSet={() =>
          props.setLoopEndBeat(Math.max(0, Math.round(props.playheadBeat())))
        }
      />

      <label style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <input
          type="checkbox"
          checked={props.rampEnabled()}
          onChange={(e) => props.setRampEnabled(e.currentTarget.checked)}
        />
        Speed ramp
      </label>
      <Stepper
        label="From"
        value={fmtRate(props.startingRate())}
        onDec={() =>
          props.setStartingRate(clamp(props.startingRate() - 0.05, 0.25, 2))
        }
        onInc={() =>
          props.setStartingRate(clamp(props.startingRate() + 0.05, 0.25, 2))
        }
      />
      <Stepper
        label="Step"
        value={fmtRate(props.stepRate())}
        onDec={() => props.setStepRate(clamp(props.stepRate() - 0.05, 0.05, 1))}
        onInc={() => props.setStepRate(clamp(props.stepRate() + 0.05, 0.05, 1))}
      />

      <button
        class="gp-btn"
        style={{ 'margin-left': 'auto' }}
        onClick={() =>
          props.loopEnabled()
            ? props.stopPracticeLoop()
            : props.startPracticeLoop()
        }
      >
        {props.loopEnabled() ? 'Exit Loop' : 'Start Loop'}
      </button>
    </div>
  )
}

interface StepperProps {
  label: string
  value: string
  onDec: () => void
  onInc: () => void
  onSet?: () => void
}

function Stepper(props: StepperProps) {
  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
      <span style={{ opacity: '0.7' }}>{props.label}</span>
      <button class="gp-btn" onClick={props.onDec}>
        -
      </button>
      <span style={{ 'min-width': '42px', 'text-align': 'center' }}>
        {props.value}
      </span>
      <button class="gp-btn" onClick={props.onInc}>
        +
      </button>
      {props.onSet !== undefined && (
        <button
          class="gp-btn"
          title="Set to current playhead"
          onClick={props.onSet}
        >
          Set
        </button>
      )}
    </div>
  )
}
