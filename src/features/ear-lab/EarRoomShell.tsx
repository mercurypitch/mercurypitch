// ============================================================
// EarRoomShell — the Regulator Room around the bench.
//
// The photographed room, its grade and vignette, the session bar
// (what is sealed, how ready the device is, which room), the console
// bridge with the one amber control, and the rack drawer that holds
// the instruments, the room picker with its glass slider, the
// readiness wizard and the "why no percent" plate. Entry is silent:
// nothing here creates an AudioContext or asks for the microphone —
// the wizard does that only once its panel is opened and used.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import { unlockAudio } from '@/lib/audio-unlock'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { calibrationDueAt } from '@/lib/ear/calibration'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import { STEADY_LATENCY_SPREAD_MS } from '@/lib/mic-latency'
import { earRevealHoldMs, latestCalibration, setEarRevealHoldMs, } from '@/stores/ear-lab-store'
import { micLatencyMs, micLatencySpreadMs } from '@/stores/mic-latency-store'
import type { ClickVoice } from './click-synth'
import { scheduleClick } from './click-synth'
import { EAR_GLASS, EAR_GLASS_VAR, earGlassLabel, formatEarGlassValue, loadEarGlass, persistEarGlass, } from './ear-glass'
import { IconClose, IconInfo, IconRack, IconReport, IconSeal, IconToday, } from './ear-icons'
import type { EarRoomApi, RackPanel } from './ear-room-context'
import { EarRoomContext } from './ear-room-context'
import { CLICK_VOICES, EAR_VOLUME, earClickVoice, formatEarVolume, loadEarVolume, persistEarVolume, setEarClickVoice, } from './ear-sound'
import type { EarLabView } from './EarLabDashboard'
import styles from './EarRoomShell.module.css'
import { AutoAdvanceSwitch } from './EarStage'
import { formatRevealHold } from './reveal-pacing'
import { TapCheck } from './TapCheck'

export type { EarRoomApi, RackPanel } from './ear-room-context'
export { useEarRoom } from './ear-room-context'
import { dateLabel, instrumentReading, INSTRUMENTS } from './instruments'
import { SprintCard } from './SprintCard'

interface EarRoomShellProps {
  onNavigate: (view: EarLabView) => void
  /** False while a drill stage is open: its console takes the bridge's
   *  row, so the bench's controls step aside. Defaults to true. */
  bridge?: boolean
  children: JSX.Element
}

const PANEL_TITLES: Record<RackPanel, { kicker: string; title: string }> = {
  today: { kicker: 'Today', title: 'The regulation' },
  instruments: { kicker: 'Rack', title: 'Instruments' },
  room: { kicker: 'Room', title: 'Choose the room' },
  readiness: { kicker: 'Readiness', title: 'Round-trip latency' },
  rulers: { kicker: 'The rulers', title: 'Why there is no percent here' },
}

type ShellStyle = JSX.CSSProperties & Record<typeof EAR_GLASS_VAR, string>

export function EarRoomShell(props: EarRoomShellProps): JSX.Element {
  const background = useBackgroundSurfaceController('ear')
  const { audioEngine } = useEngines()
  const [glass, setGlass] = createSignal(loadEarGlass())
  const [volume, setVolume] = createSignal(loadEarVolume())
  const [panel, setPanel] = createSignal<RackPanel | null>(null)
  let opener: HTMLElement | null = null
  let closeButton: HTMLButtonElement | undefined

  const roomLabel = createMemo(
    () =>
      background
        .options()
        .find((option) => option.id === background.resolved().id)?.label ??
      getBackgroundDefinition(background.resolved().id)?.label ??
      'Room',
  )
  const roomAccess = createMemo(() => {
    const option = background
      .options()
      .find((candidate) => candidate.id === background.resolved().id)
    return option?.access === 'free' ? 'Free room' : 'Supporter room'
  })

  const sealed = () => latestCalibration()
  /** The app's one round-trip number; zero means never measured. */
  const latencyMs = () => micLatencyMs()
  const measured = () => latencyMs() > 0
  /** null: an older measurement with no spread, so no steadiness claim. */
  const latencySteady = (): boolean | null => {
    const spread = micLatencySpreadMs()
    return spread === null ? null : spread <= STEADY_LATENCY_SPREAD_MS
  }
  const latencyWord = () => {
    const steady = latencySteady()
    if (steady === null) return 'measured'
    return steady ? 'steady' : 'unsteady'
  }

  const shellStyle = (): ShellStyle => ({
    [EAR_GLASS_VAR]: String(glass()),
  })

  const updateGlass = (value: number) => setGlass(persistEarGlass(value))

  const open = (next: RackPanel) => {
    opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setPanel(next)
    queueMicrotask(() => closeButton?.focus({ preventScroll: true }))
  }

  const close = () => {
    if (panel() === null) return
    setPanel(null)
    const target = opener
    opener = null
    if (target && document.body.contains(target)) {
      target.focus({ preventScroll: true })
    }
  }

  const go = (view: EarLabView) => {
    close()
    props.onNavigate(view)
  }

  const updateVolume = (value: number) => setVolume(persistEarVolume(value))

  // The bench's level rides on the engine as a trim, so every tone a
  // drill plays follows the slider; the way out resets it, and the
  // rest of the app hears Settings' volume alone again.
  createEffect(() => audioEngine.setToneTrim(volume()))
  onCleanup(() => audioEngine.setToneTrim(1))

  const previewClick = async (voice: ClickVoice) => {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
    unlockAudio(ctx)
    scheduleClick(ctx, ctx.currentTime + 0.04, {
      voice,
      gainLevel: volume() * audioEngine.getVolume(),
    })
  }

  const chooseVoice = (voice: ClickVoice) => {
    setEarClickVoice(voice)
    void previewClick(voice)
  }

  const roomApi: EarRoomApi = {
    openPanel: open,
    volume,
    clickVoice: earClickVoice,
  }

  createEffect(() => {
    if (panel() === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })

  return (
    <EarRoomContext.Provider value={roomApi}>
      <div
        class={styles.shell}
        style={shellStyle()}
        data-room={background.resolved().id}
        data-room-treatment={background.resolved().treatment}
        data-testid="ear-room-shell"
      >
        <div
          class={styles.roomPlate}
          style={background.resolvedStyle()}
          aria-hidden="true"
          data-testid="ear-room-art"
        />
        <div class={styles.roomShade} aria-hidden="true" />
        <div class={styles.roomVignette} aria-hidden="true" />

        <div class={styles.sessionBar} data-testid="ear-session-bar">
          <div class={styles.sessionCopy}>
            <h2 class={styles.sessionTitle}>Ear Lab</h2>
            <p class={styles.sessionMeta}>
              <span>{roomLabel()}</span>
              <i aria-hidden="true" />
              <Show when={sealed()} fallback={<span>Not yet marked</span>}>
                {(run) => (
                  <span>
                    Index <b>{run().index}</b>
                    <span class={styles.metaExtra}>
                      <i aria-hidden="true" /> sealed {dateLabel(run().at)}
                      <i aria-hidden="true" /> due{' '}
                      {dateLabel(calibrationDueAt(run().at))}
                    </span>
                  </span>
                )}
              </Show>
            </p>
          </div>

          <div class={styles.sessionChips}>
            <button
              type="button"
              class={styles.chip}
              data-tour="ear.latency"
              onClick={() => open('readiness')}
              aria-label={
                measured()
                  ? `Round trip ${latencyMs()} milliseconds, ${latencyWord()}. Open the readiness panel`
                  : 'Round trip not measured. Open the readiness panel'
              }
            >
              <span
                class={styles.chipDot}
                classList={{
                  [styles.chipDotOn]: measured() && latencySteady() !== false,
                  [styles.chipDotWarn]: measured() && latencySteady() === false,
                }}
              />
              <span class={styles.chipCopy}>
                <b>
                  <Show when={measured()} fallback="Round trip">
                    {latencyMs()} ms
                  </Show>
                </b>
                <small>
                  <Show when={measured()} fallback="unmeasured">
                    round trip · {latencyWord()}
                  </Show>
                </small>
              </span>
            </button>

            <button
              type="button"
              class={styles.chip}
              data-tour="ear.rulers"
              onClick={() => open('rulers')}
              aria-label="Why there is no percent here"
              title="Why there is no percent here"
            >
              <IconInfo size={18} class={styles.chipIcon} />
              <span class={styles.chipText}>No percent</span>
            </button>

            <button
              type="button"
              class={`${styles.chip} ${styles.roomChip}`}
              onClick={() => open('room')}
              aria-label={`Room: ${roomLabel()}. Choose the room`}
              data-testid="ear-room-chip"
            >
              <span
                class={styles.roomThumb}
                style={background.resolvedStyle()}
                aria-hidden="true"
              />
              <span class={styles.chipCopy}>
                <b>{roomLabel()}</b>
                <small>{roomAccess()}</small>
              </span>
            </button>
          </div>
        </div>

        <div class={styles.stage}>{props.children}</div>

        <Show when={props.bridge !== false}>
          <div class={styles.bridge}>
            <button
              type="button"
              class={`${styles.bridgeButton} ${styles.bridgeToday}`}
              onClick={() => open('today')}
            >
              <IconToday size={20} />
              <span>Today</span>
            </button>

            <button
              type="button"
              class={styles.primary}
              data-tour="ear.actions"
              onClick={() => go('calibration')}
            >
              <IconSeal size={22} class={styles.primaryIcon} />
              <span class={styles.primaryCopy}>
                <b>
                  <span class={styles.primaryLong}>Run Calibration</span>
                  <span class={styles.primaryShort}>Calibrate</span>
                </b>
                <small>about 50 questions · marks the glass</small>
              </span>
            </button>

            <button
              type="button"
              class={`${styles.bridgeButton} ${styles.bridgeInstruments}`}
              onClick={() => open('instruments')}
            >
              <IconRack size={20} />
              <span>Instruments</span>
            </button>

            <button
              type="button"
              class={`${styles.bridgeButton} ${styles.bridgeReport}`}
              onClick={() => go('report')}
            >
              <IconReport size={20} />
              <span>Ear Report</span>
            </button>
          </div>
        </Show>

        <Show when={panel() !== null}>
          <div class={styles.scrim} onClick={close} aria-hidden="true" />
        </Show>

        <aside
          class={styles.rack}
          classList={{ [styles.rackOpen]: panel() !== null }}
          role="dialog"
          aria-modal={panel() !== null ? 'true' : undefined}
          aria-labelledby="ear-rack-title"
          aria-hidden={panel() === null ? 'true' : undefined}
          inert={panel() === null}
          data-testid="ear-rack"
        >
          <div class={styles.rackHead}>
            <div>
              <span class={styles.rackKicker}>
                {panel() ? PANEL_TITLES[panel() as RackPanel].kicker : ''}
              </span>
              <h3 id="ear-rack-title" class={styles.rackTitle}>
                {panel() ? PANEL_TITLES[panel() as RackPanel].title : ''}
              </h3>
            </div>
            <button
              type="button"
              class={styles.rackClose}
              onClick={close}
              aria-label="Close"
              ref={closeButton}
            >
              <IconClose size={18} />
            </button>
          </div>

          <Show when={panel() === 'instruments'}>
            <ul class={styles.rackList} aria-label="Instruments">
              <For each={INSTRUMENTS}>
                {(instrument) => (
                  <li>
                    <button
                      type="button"
                      class={styles.rackRow}
                      classList={{
                        [styles.rackRowSeal]: instrument.view === 'calibration',
                      }}
                      onClick={() => go(instrument.view)}
                    >
                      <span class={styles.rackRowMain}>
                        <span class={styles.rackRowName}>
                          {instrument.name}
                        </span>
                        <span class={styles.rackRowMeasures}>
                          {instrument.measures}
                        </span>
                      </span>
                      <Show
                        when={instrumentReading(instrument)}
                        fallback={
                          <span class={styles.rackRowEmpty}>
                            {instrument.view === 'calibration'
                              ? 'Unsealed'
                              : 'Unmeasured'}
                          </span>
                        }
                      >
                        {(reading) => (
                          <span class={styles.rackRowReading}>
                            {reading().value}
                            <Show when={reading().unit}>
                              <small> {reading().unit}</small>
                            </Show>
                          </span>
                        )}
                      </Show>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={panel() === 'today'}>
            <div class={styles.rackPanel}>
              <p class={styles.rackNote}>
                The same three drills as the regulation on the bench. Choosing
                one opens it and the rack closes behind you.
              </p>
              <SprintCard onNavigate={go} rack />
            </div>
          </Show>

          <Show when={panel() === 'room'}>
            <div class={styles.rackPanel}>
              <p class={styles.rackNote}>
                The room is visual only. It never changes a sound or a reading,
                and your choice stays on this device.
              </p>
              <PremiumBackgroundPicker
                class={styles.roomPicker}
                controller={background}
                embedded
                onSelect={(option) => background.select(option.id)}
              />
              <label class={styles.glass} title="How much of the room shows">
                <span class={styles.glassLabel}>Room visibility</span>
                <input
                  type="range"
                  class={styles.glassSlider}
                  min={EAR_GLASS.min}
                  max={EAR_GLASS.max}
                  step={EAR_GLASS.step}
                  value={glass()}
                  aria-label="Room visibility"
                  aria-valuetext={formatEarGlassValue(glass())}
                  data-testid="ear-room-glass"
                  onInput={(event) =>
                    updateGlass(Number(event.currentTarget.value))
                  }
                />
                <output class={styles.glassValue} aria-hidden="true">
                  {earGlassLabel(glass())}
                </output>
              </label>
              <label
                class={styles.glass}
                title="How loud the bench is, on top of the app's volume"
              >
                <span class={styles.glassLabel}>Stage volume</span>
                <input
                  type="range"
                  class={styles.glassSlider}
                  min={EAR_VOLUME.min}
                  max={EAR_VOLUME.max}
                  step={EAR_VOLUME.step}
                  value={volume()}
                  aria-label="Stage volume"
                  aria-valuetext={formatEarVolume(volume())}
                  data-testid="ear-room-volume"
                  onInput={(event) =>
                    updateVolume(Number(event.currentTarget.value))
                  }
                />
                <output class={styles.glassValue} aria-hidden="true">
                  {formatEarVolume(volume())}
                </output>
              </label>
              <div class={styles.pace}>
                <span class={styles.glassLabel}>Between trials</span>
                <div class={styles.paceSwitch}>
                  <AutoAdvanceSwitch label="Auto-advance" />
                </div>
                <label
                  class={styles.paceHold}
                  title="How long the verdict holds before the next trial sounds"
                >
                  <span class={styles.paceSub}>Hold after the verdict</span>
                  <input
                    type="range"
                    class={styles.glassSlider}
                    min={REVEAL_HOLD.min}
                    max={REVEAL_HOLD.max}
                    step={REVEAL_HOLD.step}
                    value={earRevealHoldMs()}
                    aria-label="Hold after the verdict"
                    aria-valuetext={formatRevealHold(earRevealHoldMs())}
                    data-testid="ear-room-hold"
                    onInput={(event) =>
                      setEarRevealHoldMs(Number(event.currentTarget.value))
                    }
                  />
                  <output class={styles.glassValue} aria-hidden="true">
                    {formatRevealHold(earRevealHoldMs())}
                  </output>
                </label>
                <p class={styles.paceNote}>
                  On, the next trial follows the verdict after the hold; off,
                  every drill parks on its verdict until Next. The switch in
                  each stage bar is this one.
                </p>
              </div>
              <div class={styles.voices}>
                <span class={styles.glassLabel} id="ear-click-voice-label">
                  The Grid's click
                </span>
                <div
                  class={styles.voiceRow}
                  role="radiogroup"
                  aria-labelledby="ear-click-voice-label"
                >
                  <For each={CLICK_VOICES}>
                    {(voice) => (
                      <button
                        type="button"
                        role="radio"
                        class={styles.voice}
                        aria-checked={earClickVoice() === voice.id}
                        data-testid={`ear-click-${voice.id}`}
                        onClick={() => chooseVoice(voice.id)}
                      >
                        <b>{voice.label}</b>
                        <small>{voice.note}</small>
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <p class={styles.rackNote}>
                Every tone on the bench and the Grid's clicks follow the stage
                volume, on top of the app's own. Choosing a click plays it once.
              </p>
            </div>
          </Show>

          <Show when={panel() === 'readiness'}>
            <div class={styles.rackPanel}>
              <p class={styles.rackNote}>
                The round trip from your speakers back to your microphone — one
                number for the whole app, the same one Settings shows. Tap
                drills subtract it so the reading is your ear, not your
                hardware. Nothing listens until you press Start, and the
                microphone is asked for only then.
              </p>
              <MicLatencyWizard
                class={styles.readinessWizard}
                onClose={close}
              />
              <TapCheck />
            </div>
          </Show>

          <Show when={panel() === 'rulers'}>
            <div class={`${styles.rackPanel} ${styles.plate}`}>
              <p>
                Adaptive drills hold everyone near 75% correct forever, so a
                score can never show growth. The Ear Lab reports thresholds in
                real units — cents, milliseconds, notes — that keep falling, and
                ratings against items of frozen difficulty that keep rising.
              </p>
              <p>
                Calibration re-measures you on a sealed protocol. The marks on
                the glass are earned, not estimated; practice only ever draws
                the fainter line above them.
              </p>
            </div>
          </Show>
        </aside>
      </div>
    </EarRoomContext.Provider>
  )
}
