// ============================================================
// Practice options — the room's one sheet (owner answer 7)
// ============================================================
//
// The app's existing controls, regrouped under the mock's headings. Nothing
// new was invented for it and nothing was dropped: Key, Setup, What you
// hear, Mic, Session, the per-note toggle, and All settings last.
//
// NOT DRAWN, on purpose: "Fit my range" and "Run length" are Phase 5 and
// the mock's own sheet is ahead of the app there. Two controls the mock
// shows that the app has no engine for — "Target tone" as its own switch and
// "Hear yourself" — are absent for the same reason: regrouping the app's
// controls cannot produce a control the app does not have, and a dead toggle
// is worse than an absent one.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { OptionRow, OptionSection, OptionsSheet, } from '@/components/mobile/OptionsSheet'
import { PrecCountButton } from '@/components/PrecCountButton'
import { KEY_OFFSETS } from '@/lib/scale-data'
import { bpm, getCurrentSessionItem, keyName, practiceSession, scaleType, sessionActive, setBpm, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { nativeShellApi } from '@/stores/native-shell-store'
import styles from './sing-room.module.css'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

interface SingRoomOptionsProps {
  isOpen: boolean
  close: () => void
  songName: () => string
  onOpenSong: () => void
  onChangeKey: (key: string) => void
  onChangeScale: (scale: string) => void
  onOctaveShift: (delta: number) => void
  speed: () => number
  onSpeedChange: (value: number) => void
  volume: () => number
  onVolumeChange: (value: number) => void
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void
  onAutoCalibrate: () => void
  micOnArrival: () => boolean
  onMicOnArrivalChange: (value: boolean) => void
  perNoteBurn: () => boolean
  onPerNoteBurnChange: (value: boolean) => void
  onSessionSkip: () => void
  onSessionEnd: () => void
}

const Toggle: Component<{
  on: boolean
  label: string
  onToggle: () => void
  testId?: string
}> = (props) => (
  <button
    type="button"
    classList={{ [styles.toggle]: true, [styles.toggleOn]: props.on }}
    role="switch"
    aria-checked={props.on}
    aria-label={props.label}
    onClick={() => props.onToggle()}
    data-testid={props.testId}
  >
    <i />
  </button>
)

export const SingRoomOptions: Component<SingRoomOptionsProps> = (props) => (
  <OptionsSheet
    isOpen={props.isOpen}
    close={() => props.close()}
    ariaLabel="Practice options"
  >
    <OptionSection label="Key">
      <OptionRow label="Key">
        <select
          class="dropdown-select-style"
          value={keyName()}
          data-testid="sing-options-key"
          onChange={(event) => props.onChangeKey(event.currentTarget.value)}
        >
          <For each={Object.keys(KEY_OFFSETS)}>
            {(key) => <option value={key}>{key}</option>}
          </For>
        </select>
      </OptionRow>
      <OptionRow label="Scale">
        <select
          class="dropdown-select-style"
          value={scaleType()}
          data-testid="sing-options-scale"
          onChange={(event) => props.onChangeScale(event.currentTarget.value)}
        >
          <option value="major">Major</option>
          <option value="natural-minor">Minor (Natural)</option>
          <option value="harmonic-minor">Harmonic Minor</option>
          <option value="melodic-minor">Melodic Minor</option>
        </select>
      </OptionRow>
      <OptionRow label="Octave">
        <button
          type="button"
          class={styles.stepBtn}
          onClick={() => props.onOctaveShift(-1)}
          aria-label="Octave down"
        >
          −
        </button>
        <span class={styles.stepValue}>{melodyStore.getCurrentOctave()}</span>
        <button
          type="button"
          class={styles.stepBtn}
          onClick={() => props.onOctaveShift(1)}
          aria-label="Octave up"
        >
          +
        </button>
      </OptionRow>
    </OptionSection>

    <OptionSection label="Setup">
      {/* The one way into a melody run from inside the sheet. The song chip in
          the HUD is the other, and it only exists once a melody is loaded. */}
      <OptionRow label="Melody">
        <button
          type="button"
          class={styles.stepBtn}
          onClick={() => props.onOpenSong()}
          data-testid="sing-options-song"
        >
          {props.songName()}
        </button>
      </OptionRow>
      <OptionRow label={`Tempo ${bpm()} BPM`}>
        <input
          type="range"
          min="40"
          max="220"
          step="1"
          value={bpm()}
          data-testid="sing-options-tempo"
          onInput={(event) => setBpm(Number(event.currentTarget.value))}
        />
      </OptionRow>
      <OptionRow label="Speed">
        <select
          class="dropdown-select-style"
          value={String(props.speed())}
          onChange={(event) =>
            props.onSpeedChange(Number(event.currentTarget.value))
          }
        >
          <For each={SPEEDS}>
            {(speed) => <option value={String(speed)}>{speed}×</option>}
          </For>
        </select>
      </OptionRow>
      <OptionRow label="Precount">
        <PrecCountButton />
      </OptionRow>
    </OptionSection>

    <OptionSection label="What you hear">
      <OptionRow label={`Melody volume ${props.volume()}%`}>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={props.volume()}
          onInput={(event) =>
            props.onVolumeChange(Number(event.currentTarget.value))
          }
        />
      </OptionRow>
      <OptionRow label={`Metronome — ${bpm()} bpm`}>
        <Toggle
          on={props.metronomeEnabled()}
          label="Metronome"
          onToggle={() => props.onMetronomeToggle()}
        />
      </OptionRow>
    </OptionSection>

    <OptionSection label="Mic">
      <OptionRow label="Microphone: on when the room opens">
        <Toggle
          on={props.micOnArrival()}
          label="Microphone on when the room opens"
          onToggle={() => props.onMicOnArrivalChange(!props.micOnArrival())}
          testId="sing-options-mic-arrival"
        />
      </OptionRow>
      <OptionRow label="Auto-calibrate sensitivity">
        <button
          type="button"
          class={styles.stepBtn}
          onClick={() => props.onAutoCalibrate()}
        >
          Run
        </button>
      </OptionRow>
    </OptionSection>

    <Show when={sessionActive()}>
      <OptionSection label="Session">
        <OptionRow
          label={
            getCurrentSessionItem()?.label ??
            practiceSession()?.name ??
            'Session'
          }
        >
          <button
            type="button"
            class={styles.stepBtn}
            onClick={() => {
              props.close()
              props.onSessionSkip()
            }}
          >
            Skip
          </button>
          <button
            type="button"
            class={styles.stepBtn}
            onClick={() => {
              props.close()
              props.onSessionEnd()
            }}
          >
            End
          </button>
        </OptionRow>
      </OptionSection>
    </Show>

    <OptionSection label="Per-note results">
      <OptionRow label="Show accuracy on the target line">
        <Toggle
          on={props.perNoteBurn()}
          label="Show accuracy on the target line"
          onToggle={() => props.onPerNoteBurnChange(!props.perNoteBurn())}
          testId="sing-options-burn"
        />
      </OptionRow>
    </OptionSection>

    <OptionSection label="More">
      <OptionRow label="All settings">
        <button
          type="button"
          class={styles.stepBtn}
          onClick={() => {
            props.close()
            nativeShellApi()?.pushSettings()
          }}
        >
          Open
        </button>
      </OptionRow>
    </OptionSection>
  </OptionsSheet>
)
