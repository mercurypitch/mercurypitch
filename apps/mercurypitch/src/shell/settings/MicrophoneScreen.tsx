// ============================================================
// MicrophoneScreen — the input, its level, its timing, its room
// ============================================================
//
// S6 step 8 (mock 7a to 7c). Which input is in use and in what format, a
// live peak, the latency with the day it was measured, the room-noise
// preset, auto-calibrate, and the latency wizard in a sheet. On the web
// these were two sections of the Practice tab and nothing said which input
// was in use.
//
// The microphone opens on arrival only on a phone that has granted it
// before (the Sing room's remembered grant); otherwise one tap asks, inside
// the moment of intent. Refused, the screen says so first and sends the
// singer to the one place that can change it; the latency stays, since it
// belongs to the input, not to the permission (7c). While the wizard's sheet
// is up the level check steps aside, so the wizard has the microphone and
// the speaker to itself.

import { onAppState, openAppSettings, } from '@irchiinnuss/mobile-runtime/platform'
import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, Show, } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { autoCalibrateSensitivity } from '@/features/mic-feedback/auto-calibrate'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import { setSingMicGranted, singMicGranted, } from '@/features/sing-room/sing-room-settings'
import { describeSensitivityPosition } from '@/lib/sensitivity-scale'
import { micLatencyMs } from '@/stores/mic-latency-store'
import { sensitivityPosition } from '@/stores/settings-store'
import { ExternalIcon, MicIcon, TimerIcon, TuneIcon, WaveIcon } from '../icons'
import { pushScreen } from '../run-shell-store'
import { forgetLatencyMeasured, latencyMeasuredAt, measuredLine, recordLatencyMeasured, } from './latency-measured'
import { closeLatencySheet, latencySheetOpen, openLatencySheet, } from './latency-sheet'
import type { LevelCheck } from './level-check'
import { createLevelCheck, inputLine, peakLabel, peakText } from './level-check'
import { SettingsGroup, SettingsRow } from './SettingsList'

/** 7b's first paragraph: what the singer sees, and no one to blame. */
const LATENCY_INTRO =
  'Your phone takes a moment to play a sound and another to hear one. Over that gap a note you sing lands late against the melody. This plays a few clicks through the speaker, listens for them, and measures the gap.'

/** The input card's line while nothing is open. */
const CLOSED_LINE: Record<string, string> = {
  idle: 'Opens only while you check the level',
  opening: 'Opening…',
  unavailable: 'Could not be opened just now',
}

function InputCard(props: { check: LevelCheck }): JSX.Element {
  const live = (): boolean => props.check.state() === 'live'
  return (
    <div class="mp-set-card mp-mic__card" data-testid="mic-input">
      <p class="mp-mic__eyebrow">Input</p>
      <div class="mp-mic__input">
        <MicIcon size={20} />
        <strong>{props.check.input()?.label ?? 'Microphone'}</strong>
        <Show when={live()}>
          <span class="mp-mic__chip">In use</span>
        </Show>
      </div>
      <p class="mp-mic__meta">
        <Show
          when={live() ? props.check.input() : null}
          fallback={CLOSED_LINE[props.check.state()] ?? ''}
        >
          {(facts) => inputLine(facts())}
        </Show>
      </p>
    </div>
  )
}

function LevelCard(props: {
  check: LevelCheck
  onOpen: () => void
}): JSX.Element {
  const closedAsk = (): string =>
    props.check.state() === 'unavailable'
      ? 'The microphone could not be opened just now.'
      : 'The microphone opens only while you check.'

  return (
    <div class="mp-set-card mp-mic__card" data-testid="mic-level">
      <p class="mp-mic__eyebrow">Level check</p>
      <Show
        when={props.check.state() === 'live'}
        fallback={
          <div class="mp-mic__closed">
            <p class="mp-mic__ask">{closedAsk()}</p>
            <Show when={props.check.state() !== 'opening'}>
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary mp-set-button--small"
                data-testid="mic-check-start"
                onClick={() => {
                  props.onOpen()
                }}
              >
                {props.check.state() === 'unavailable'
                  ? 'Try again'
                  : 'Check the level'}
              </button>
            </Show>
          </div>
        }
      >
        <div class="mp-mic__row">
          <span class="mp-mic__ask">Say something at singing volume.</span>
          <span class="mp-mic__peak">{peakText(props.check.peak())}</span>
        </div>
        <div
          class="mp-mic__meter"
          role="img"
          aria-label={peakLabel(props.check.peak())}
          data-testid="mic-meter"
        >
          <span
            class="mp-mic__fill"
            style={{ '--p': `${Math.round(props.check.level() * 100)}%` }}
          />
        </div>
      </Show>
    </div>
  )
}

function LatencyRow(): JSX.Element {
  const measured = (): string | undefined => {
    const at = latencyMeasuredAt()
    return micLatencyMs() > 0 && at !== null ? measuredLine(at) : undefined
  }
  return (
    <SettingsRow
      id="mic-latency"
      icon={<TimerIcon />}
      label="Latency"
      sub={measured()}
      value={micLatencyMs() > 0 ? `${micLatencyMs()} ms` : 'Not measured'}
    />
  )
}

/** 7c: said first, with the one way to change it. */
function Refused(): JSX.Element {
  return (
    <>
      <div
        class="mp-set-note mp-set-note--warn"
        role="status"
        data-testid="mic-denied"
      >
        <MicIcon size={20} />
        <p>
          <strong>Microphone access is off.</strong> MercuryPitch cannot hear
          you until it is allowed in the Settings app.
        </p>
      </div>
      <button
        type="button"
        class="mp-set-button"
        data-testid="mic-open-settings"
        onClick={() => {
          void openAppSettings()
        }}
      >
        <ExternalIcon size={18} />
        Open Settings
      </button>
      <SettingsGroup>
        <SettingsRow
          id="mic-input"
          icon={<MicIcon />}
          label="Input"
          value="Not available"
        />
        <LatencyRow />
      </SettingsGroup>
    </>
  )
}

function LatencySheet(): JSX.Element {
  return (
    <Sheet
      isOpen={latencySheetOpen()}
      close={closeLatencySheet}
      ariaLabel="Microphone latency"
    >
      <Show when={latencySheetOpen()}>
        <MicLatencyWizard
          class="mp-latency"
          intro={LATENCY_INTRO}
          onClose={closeLatencySheet}
          onApplied={() => {
            recordLatencyMeasured()
          }}
          onCleared={forgetLatencyMeasured}
        />
      </Show>
    </Sheet>
  )
}

export function MicrophoneScreen(): JSX.Element {
  const check = createLevelCheck()
  const [calibrating, setCalibrating] = createSignal(false)
  let gone = false

  async function open(): Promise<void> {
    if (gone) return
    await check.start()
    // The Sing room's remembered grant is the same fact, so both surfaces
    // agree on whether to ask before opening.
    if (check.state() === 'live') setSingMicGranted(true)
    else if (check.state() === 'denied') setSingMicGranted(false)
  }

  async function calibrate(): Promise<void> {
    setCalibrating(true)
    try {
      await autoCalibrateSensitivity(() => check.rms())
    } finally {
      setCalibrating(false)
    }
  }

  onMount(() => {
    if (singMicGranted()) void open()
    // Back from the phone's Settings with access turned on: look again.
    onCleanup(
      onAppState((state) => {
        if (state === 'active' && check.state() === 'denied') void open()
      }),
    )
  })

  // The wizard needs the microphone and the speaker to itself.
  createEffect(
    on(
      latencySheetOpen,
      (up) => {
        if (up) check.stop()
        else if (singMicGranted()) void open()
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    gone = true
    check.stop()
    closeLatencySheet()
  })

  const live = (): boolean => check.state() === 'live'

  return (
    <div class="mp-set" data-testid="microphone-screen">
      <Show when={check.state() !== 'denied'} fallback={<Refused />}>
        <InputCard check={check} />
        <LevelCard
          check={check}
          onOpen={() => {
            void open()
          }}
        />
        <SettingsGroup>
          <LatencyRow />
          <SettingsRow
            id="mic-room-noise"
            icon={<WaveIcon />}
            label="Room noise"
            value={describeSensitivityPosition(sensitivityPosition())}
            onPress={() => {
              pushScreen('room-noise')
            }}
          />
          <SettingsRow
            id="mic-auto-calibrate"
            icon={<TuneIcon />}
            label="Auto-calibrate sensitivity"
            sub="Listens to the room for a second, then sets Room noise"
            accessory={
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary mp-set-button--small"
                aria-label="Auto-calibrate sensitivity"
                disabled={!live() || calibrating()}
                onClick={() => {
                  void calibrate()
                }}
              >
                Run
              </button>
            }
          />
        </SettingsGroup>
        <button
          type="button"
          class="mp-set-button mp-set-button--secondary"
          data-testid="latency-measure"
          onClick={openLatencySheet}
        >
          {micLatencyMs() > 0 ? 'Measure latency again' : 'Measure latency'}
        </button>
      </Show>
      <LatencySheet />
    </div>
  )
}
