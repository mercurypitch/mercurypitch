// Guitar Night Tuner is the prop-driven Velvet preflight for a shared tuning runtime.
// ============================================================
//
// This surface deliberately owns no microphone, AudioContext, detector, or
// reference oscillator. The room controller supplies readings and performs
// every side effect after one of the explicit controls below is used.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { CheckSmall, ChevronDown, ChevronLeft, Mic, Volume2, VolumeX, } from '@/components/icons'
import type { MicPermissionState } from '@/lib/jam/media-errors'
import styles from './GuitarNightTuner.module.css'

export type GuitarNightTunerSurfaceMode = 'standalone' | 'overlay'

export type GuitarNightTunerTargetMode = 'auto' | 'manual'

export type GuitarNightTunerInputProfile = 'microphone' | 'interface'

export type GuitarNightTunerListeningState = 'idle' | 'starting' | 'listening'

export type GuitarNightTunerPitchState =
  | 'idle'
  | 'searching'
  | 'low'
  | 'in-tune'
  | 'high'
  | 'unsteady'
  | 'error'

/** One prepared open-string target, in the order it should appear on screen. */
export interface GuitarNightTunerString {
  /** Stable identity even when two strings share a note name. */
  id: string
  /** Physical string number, for example 6 for a guitar's low E. */
  stringNumber: number
  /** Pitch class as the player knows it, for example E or Bb. */
  noteName: string
  octave: number
  frequencyHz: number
}

export interface GuitarNightTunerPreset {
  id: string
  label: string
  detail?: string
}

export interface GuitarNightTunerProps {
  /** A full route by default; overlay fills and labels its containing stage. */
  surfaceMode?: GuitarNightTunerSurfaceMode
  instrumentLabel: Accessor<string>
  tuningLabel: Accessor<string>
  inputLabel?: Accessor<string | null>
  /** Four to eight targets. The parent owns validation and ordering. */
  strings: Accessor<readonly GuitarNightTunerString[]>
  targetMode: Accessor<GuitarNightTunerTargetMode>
  targetStringId: Accessor<string | null>
  listeningState: Accessor<GuitarNightTunerListeningState>
  pitchState: Accessor<GuitarNightTunerPitchState>
  detectedNoteLabel: Accessor<string | null>
  detectedFrequencyHz: Accessor<number | null>
  cents: Accessor<number | null>
  /** Optional evidence-backed instruction or input error from the controller. */
  statusDetail?: Accessor<string | null>
  /** The target whose audible reference is currently sounding, if any. */
  referenceStringId: Accessor<string | null>
  /** Strings already confirmed during this visit. */
  readyStringIds?: Accessor<readonly string[]>
  /** Optional two-route audio choice. Null leaves both physical routes unselected. */
  inputProfile?: Accessor<GuitarNightTunerInputProfile | null>
  onInputProfileChange?(profile: GuitarNightTunerInputProfile): void
  /** Browser permission is observed without opening capture on entry. */
  microphonePermission?: Accessor<MicPermissionState>
  tuningPresets?: Accessor<readonly GuitarNightTunerPreset[]>
  activeTuningPreset?: Accessor<string | null>
  onTuningPresetChange?(presetId: string): void
  /** A one-action recovery shown beside an input error, for example Use it here. */
  recoveryActionLabel?: Accessor<string | null>
  onRecoveryAction?(): void
  controlsDisabled?: Accessor<boolean>
  /** Defaults to true when this full-stage surface is entered. */
  autoFocusHeading?: boolean
  onBack(): void
  onTargetModeChange(mode: GuitarNightTunerTargetMode): void
  onTargetStringChange(stringId: string): void
  onStartListening(): void
  onStopListening(): void
  onStartReference(target: GuitarNightTunerString): void
  onStopReference(): void
}

const PITCH_STATE_LABELS: Readonly<Record<GuitarNightTunerPitchState, string>> =
  {
    idle: 'Ready to tune',
    searching: 'Play one string',
    low: 'Pitch low',
    'in-tune': 'In tune',
    high: 'Pitch high',
    unsteady: 'Let it ring',
    error: 'Listening unavailable',
  }

const PITCH_STATE_DETAILS: Readonly<
  Record<GuitarNightTunerPitchState, string>
> = {
  idle: 'Nothing starts until you choose Start listening.',
  searching: 'Play one string and let it ring without touching the others.',
  low: 'Raise the pitch until the needle reaches the centre.',
  'in-tune': 'Hold there. This string is ready.',
  high: 'Lower the pitch until the needle reaches the centre.',
  unsteady: 'Let one string ring clearly, then try it again.',
  error: 'Check the selected input, then start listening again.',
}

const SCALE_MARKS = [-50, -25, 0, 25, 50] as const
const ANNOUNCEMENT_STABILITY_MS = 420
const TUNER_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

function finiteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

export function clampTunerCents(value: number | null): number | null {
  if (!finiteNumber(value)) return null
  return Math.min(50, Math.max(-50, value))
}

export type GuitarNightTunerOverflowDirection = 'low' | 'high' | null

export function tunerOverflowDirection(
  value: number | null,
): GuitarNightTunerOverflowDirection {
  if (!finiteNumber(value)) return null
  if (value < -50) return 'low'
  if (value > 50) return 'high'
  return null
}

function pitchName(target: GuitarNightTunerString): string {
  return `${target.noteName}${target.octave}`
}

function frequencyLabel(value: number | null): string {
  if (!finiteNumber(value) || value <= 0) return 'No reading'
  return `${value.toFixed(2)} Hz`
}

function centsLabel(value: number | null): string {
  if (!finiteNumber(value)) return 'No cents reading'
  const rounded = Math.round(value)
  if (rounded === 0) return '0 cents'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} cents`
}

function scaleMarkLabel(mark: (typeof SCALE_MARKS)[number]): string {
  if (mark === 0) return '0'
  return mark > 0 ? `+${mark}` : `−${Math.abs(mark)}`
}

export function GuitarNightTuner(props: GuitarNightTunerProps) {
  let surface!: HTMLElement
  let heading!: HTMLHeadingElement
  let presetDetails: HTMLDetailsElement | undefined
  let presetSummary: HTMLElement | undefined

  const surfaceMode = createMemo(() => props.surfaceMode ?? 'standalone')
  const selectedTarget = createMemo(
    () =>
      props.strings().find((target) => target.id === props.targetStringId()) ??
      null,
  )
  const referenceTarget = createMemo(
    () =>
      props
        .strings()
        .find((target) => target.id === props.referenceStringId()) ?? null,
  )
  const readyStringIds = createMemo(
    () => new Set(props.readyStringIds?.() ?? []),
  )
  const tuningPresets = createMemo(() => props.tuningPresets?.() ?? [])
  const hasInputProfileControls = createMemo(
    () =>
      props.inputProfile !== undefined &&
      props.onInputProfileChange !== undefined,
  )
  const hasTuningPresetControls = createMemo(
    () =>
      tuningPresets().length > 0 &&
      props.activeTuningPreset !== undefined &&
      props.onTuningPresetChange !== undefined,
  )
  const hasSetupControls = createMemo(
    () => hasInputProfileControls() || hasTuningPresetControls(),
  )
  const activeTuningPresetLabel = createMemo(() => {
    const activeId = props.activeTuningPreset?.()
    if (activeId !== undefined && activeId !== null) {
      const active = tuningPresets().find((preset) => preset.id === activeId)
      if (active !== undefined) return active.label
    }
    return props.tuningLabel()
  })
  const recoveryActionLabel = createMemo(() => {
    const label = props.recoveryActionLabel?.()?.trim()
    if (
      label === undefined ||
      label === '' ||
      props.onRecoveryAction === undefined
    ) {
      return null
    }
    return label
  })
  const clampedCents = createMemo(() => clampTunerCents(props.cents()))
  const overflowDirection = createMemo(() =>
    tunerOverflowDirection(props.cents()),
  )
  const hasReading = createMemo(() => clampedCents() !== null)
  const pitchStatus = createMemo(() => PITCH_STATE_LABELS[props.pitchState()])
  const pitchDetail = createMemo(() => {
    const suppliedDetail = props.statusDetail?.()
    if (suppliedDetail !== undefined && suppliedDetail !== null) {
      return suppliedDetail
    }
    if (
      props.pitchState() === 'idle' &&
      props.microphonePermission?.() === 'denied'
    ) {
      return 'Microphone access is blocked. Allow it in this site’s browser settings, then try again.'
    }
    if (
      props.pitchState() === 'idle' &&
      props.microphonePermission?.() === 'prompt'
    ) {
      return 'Choose Allow microphone when your browser asks. Audio stays on this device.'
    }
    if (
      props.pitchState() === 'idle' &&
      props.microphonePermission?.() === 'unknown'
    ) {
      return 'Start listening when you are ready. If access is needed, your browser will ask then. Audio stays on this device.'
    }
    return PITCH_STATE_DETAILS[props.pitchState()]
  })
  const displayedPitch = createMemo(() => {
    const detected = props.detectedNoteLabel()?.trim()
    if (detected !== undefined && detected !== '') return detected
    const target = selectedTarget()
    return target === null ? '—' : pitchName(target)
  })
  const [announcedPitch, setAnnouncedPitch] = createSignal<{
    label: string
    state: GuitarNightTunerPitchState
  }>({ label: '—', state: 'idle' })
  let announcementInitialized = false
  const listeningActive = createMemo(() => props.listeningState() !== 'idle')
  const controlsDisabled = createMemo(() => props.controlsDisabled?.() ?? false)
  const surfaceStyle = createMemo(() => {
    const stringCount = Math.max(1, props.strings().length)
    const mobileStringCount =
      stringCount <= 5 ? stringCount : stringCount === 6 ? 3 : 4
    const needlePosition = 50 + (clampedCents() ?? 0) * 0.8
    return `--tuner-needle-position: ${needlePosition}%; --tuner-string-count: ${stringCount}; --tuner-mobile-string-count: ${mobileStringCount}`
  })
  const targetModeCopy = createMemo(() => {
    if (props.targetMode() === 'auto') return 'Auto target'
    const target = selectedTarget()
    return target === null
      ? 'Choose a string'
      : `String ${target.stringNumber} target`
  })
  const meterValueText = createMemo(() => {
    if (!hasReading()) return pitchStatus()
    if (overflowDirection() === 'low') {
      return `${centsLabel(props.cents())}. Beyond the displayed low range. Raise the pitch toward centre.`
    }
    if (overflowDirection() === 'high') {
      return `${centsLabel(props.cents())}. Beyond the displayed high range. Lower the pitch toward centre.`
    }
    return `${centsLabel(props.cents())}. ${pitchStatus()}.`
  })
  const listeningControlCopy = createMemo(() => {
    if (props.listeningState() === 'starting') return 'Opening input'
    if (listeningActive()) return 'Stop listening'
    if (props.microphonePermission === undefined) return 'Start listening'
    if (props.microphonePermission() === 'granted') return 'Start listening'
    if (props.microphonePermission() === 'denied') return 'Retry microphone'
    if (props.microphonePermission() === 'prompt') return 'Allow microphone'
    return 'Start listening'
  })
  const referenceControlLabel = createMemo(() => {
    const sounding = referenceTarget()
    if (sounding !== null) return `Stop ${pitchName(sounding)} reference`
    const target = selectedTarget()
    if (target !== null) return `Hear ${pitchName(target)} reference`
    return 'Choose a string to hear its reference'
  })
  const referenceControlCopy = createMemo(() => {
    if (referenceTarget() !== null) return 'Stop reference'
    const target = selectedTarget()
    return target === null ? 'Choose a string' : `Hear ${pitchName(target)}`
  })

  const targetAriaLabel = (target: GuitarNightTunerString): string => {
    const base = `String ${target.stringNumber}, ${pitchName(target)}, ${frequencyLabel(target.frequencyHz)}, play reference`
    return readyStringIds().has(target.id) ? `${base}, ready` : base
  }

  const selectTarget = (target: GuitarNightTunerString): void => {
    if (props.targetMode() !== 'manual') props.onTargetModeChange('manual')
    props.onTargetStringChange(target.id)
    props.onStartReference(target)
  }

  const toggleListening = (): void => {
    if (listeningActive()) {
      props.onStopListening()
      return
    }
    props.onStartListening()
  }

  const toggleReference = (): void => {
    if (referenceTarget() !== null) {
      props.onStopReference()
      return
    }
    const target = selectedTarget()
    if (target !== null) props.onStartReference(target)
  }

  const chooseTuningPreset = (presetId: string): void => {
    props.onTuningPresetChange?.(presetId)
    presetDetails?.removeAttribute('open')
    queueMicrotask(() => presetSummary?.focus())
  }

  const closeTuningPresets = (restoreFocus: boolean): boolean => {
    if (presetDetails?.open !== true) return false
    presetDetails.removeAttribute('open')
    if (restoreFocus) queueMicrotask(() => presetSummary?.focus())
    return true
  }

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    if (
      presetDetails?.open !== true ||
      !(event.target instanceof Node) ||
      presetDetails.contains(event.target)
    ) {
      return
    }
    const clickedControl =
      event.target instanceof Element
        ? event.target.closest(TUNER_FOCUSABLE_SELECTOR)
        : null
    const focusWillMove =
      clickedControl !== null && clickedControl.closest('[inert]') === null
    closeTuningPresets(!focusWillMove)
  }

  const focusableControls = (): readonly HTMLElement[] =>
    Array.from(
      surface.querySelectorAll<HTMLElement>(TUNER_FOCUSABLE_SELECTOR),
    ).filter((element) => {
      if (element.closest('[hidden], [aria-hidden="true"], [inert]') !== null) {
        return false
      }
      const closedDisclosure = element.closest('details:not([open])')
      return (
        closedDisclosure === null ||
        closedDisclosure.firstElementChild === element
      )
    })

  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (closeTuningPresets(true)) return
      props.onBack()
      return
    }
    if (event.key !== 'Tab' || surfaceMode() !== 'overlay') return

    const controls = focusableControls()
    const first = controls[0]
    const last = controls.at(-1)
    if (first === undefined || last === undefined) {
      event.preventDefault()
      heading.focus()
      return
    }

    const activeIndex = controls.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey) {
      if (activeIndex > 0) return
      event.preventDefault()
      last.focus()
      return
    }
    if (activeIndex >= 0 && activeIndex < controls.length - 1) return
    event.preventDefault()
    first.focus()
  }

  onMount(() => {
    document.addEventListener('keydown', handleDocumentKeyDown)
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    onCleanup(() => {
      document.removeEventListener('keydown', handleDocumentKeyDown)
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
    })
    if (props.autoFocusHeading !== false) {
      heading.focus({ preventScroll: true })
    }
  })

  createEffect(() => {
    const nextState = props.pitchState()
    const nextLabel = displayedPitch()
    const nextAnnouncement = { label: nextLabel, state: nextState }
    if (!announcementInitialized) {
      announcementInitialized = true
      setAnnouncedPitch(nextAnnouncement)
      return
    }
    if (nextState === 'idle' || nextState === 'error') {
      setAnnouncedPitch(nextAnnouncement)
      return
    }
    const timer = window.setTimeout(
      () => setAnnouncedPitch(nextAnnouncement),
      ANNOUNCEMENT_STABILITY_MS,
    )
    onCleanup(() => window.clearTimeout(timer))
  })

  return (
    <section
      ref={surface}
      class={styles.tuner}
      data-testid="guitar-night-tuner"
      data-pitch-state={props.pitchState()}
      data-surface-mode={surfaceMode()}
      style={surfaceStyle()}
      role={surfaceMode() === 'overlay' ? 'dialog' : undefined}
      aria-modal={surfaceMode() === 'overlay' ? 'true' : undefined}
      aria-labelledby="guitar-night-tuner-title"
    >
      <div class={styles.topRail}>
        <button
          class={styles.backControl}
          type="button"
          onClick={() => props.onBack()}
        >
          <ChevronLeft />
          <span>Back</span>
        </button>

        <div class={styles.roomIdentity}>
          <span>Guitar Night</span>
          <strong>Tuning room</strong>
        </div>

        <div class={styles.roomContext} aria-label="Tuner setup">
          <span>{props.instrumentLabel()}</span>
          <strong>{props.tuningLabel()}</strong>
          <Show when={props.inputLabel?.()}>
            {(label) => <small>{label()}</small>}
          </Show>
        </div>
      </div>

      <div class={styles.stage}>
        <div class={styles.stageIntroduction}>
          <p>Quiet preflight</p>
          <h1 id="guitar-night-tuner-title" ref={heading} tabindex="-1">
            Tune before the room.
          </h1>
          <span>
            One string at a time. The band and backing stay paused here.
          </span>
        </div>

        <div
          class={styles.gauge}
          data-state={props.pitchState()}
          data-has-reading={hasReading() ? 'true' : 'false'}
          data-overflow={overflowDirection() ?? undefined}
        >
          <div class={styles.pitchReadout}>
            <span>{targetModeCopy()}</span>
            <strong aria-hidden="true">{displayedPitch()}</strong>
            <p
              role={props.pitchState() === 'error' ? 'alert' : undefined}
              aria-live={
                props.pitchState() === 'error' ? 'assertive' : undefined
              }
              aria-atomic={props.pitchState() === 'error' ? 'true' : undefined}
            >
              {pitchStatus()}
            </p>
            <span
              class={styles.visuallyHidden}
              role="status"
              aria-live={props.pitchState() === 'error' ? 'off' : 'polite'}
              aria-atomic="true"
            >
              {announcedPitch().label}.{' '}
              {PITCH_STATE_LABELS[announcedPitch().state]}
            </span>
          </div>

          <div
            class={styles.gaugeMeter}
            role={hasReading() ? 'meter' : undefined}
            aria-hidden={hasReading() ? undefined : 'true'}
            aria-label={hasReading() ? 'Pitch offset' : undefined}
            aria-valuemin={hasReading() ? '-50' : undefined}
            aria-valuemax={hasReading() ? '50' : undefined}
            aria-valuenow={hasReading() ? clampedCents()! : undefined}
            aria-valuetext={hasReading() ? meterValueText() : undefined}
          >
            <span class={styles.rangeLabel}>Low</span>
            <div class={styles.gaugeRail} aria-hidden="true">
              <div class={styles.scaleMarks}>
                <For each={SCALE_MARKS}>
                  {(mark) => (
                    <span data-centre={mark === 0 ? 'true' : undefined}>
                      <i />
                      <small>{scaleMarkLabel(mark)}</small>
                    </span>
                  )}
                </For>
              </div>
              <span class={styles.tuningWindow} />
              <span class={styles.needle} />
              <Show when={overflowDirection()}>
                {(direction) => (
                  <span
                    class={styles.overflowCue}
                    data-direction={direction()}
                    aria-hidden="true"
                  >
                    <b>{direction() === 'low' ? '›' : '‹'}</b>
                    <small>{direction() === 'low' ? 'Raise' : 'Lower'}</small>
                  </span>
                )}
              </Show>
            </div>
            <span class={styles.rangeLabel}>High</span>
          </div>

          <dl class={styles.readingEvidence}>
            <div>
              <dt>Detected</dt>
              <dd>
                <span aria-label="Detected frequency">
                  {frequencyLabel(props.detectedFrequencyHz())}
                </span>
              </dd>
            </div>
            <div>
              <dt>Offset</dt>
              <dd>
                <span aria-label="Pitch offset in cents">
                  {centsLabel(props.cents())}
                </span>
              </dd>
            </div>
          </dl>
          <div class={styles.statusGuidance}>
            <p class={styles.pitchDetail}>{pitchDetail()}</p>
            <Show when={recoveryActionLabel()}>
              {(label) => (
                <button
                  class={styles.recoveryControl}
                  type="button"
                  disabled={controlsDisabled()}
                  onClick={() => props.onRecoveryAction?.()}
                >
                  {label()}
                </button>
              )}
            </Show>
          </div>
        </div>

        <Show when={hasSetupControls()}>
          <div
            class={styles.setupRail}
            data-testid="guitar-night-tuner-setup"
            aria-label="Tuner setup controls"
          >
            <Show when={hasInputProfileControls()}>
              <div class={styles.inputProfiles}>
                <span>Input</span>
                <div role="group" aria-label="Audio input route">
                  <button
                    type="button"
                    aria-pressed={props.inputProfile?.() === 'microphone'}
                    disabled={controlsDisabled()}
                    onClick={() => props.onInputProfileChange?.('microphone')}
                  >
                    Room mic
                  </button>
                  <button
                    type="button"
                    aria-pressed={props.inputProfile?.() === 'interface'}
                    disabled={controlsDisabled()}
                    onClick={() => props.onInputProfileChange?.('interface')}
                  >
                    Plugged in
                  </button>
                </div>
              </div>
            </Show>

            <Show when={hasTuningPresetControls()}>
              <details class={styles.presetDisclosure} ref={presetDetails}>
                <summary
                  ref={presetSummary}
                  aria-label={`Tuning presets, ${activeTuningPresetLabel()}`}
                >
                  <span>Tuning</span>
                  <strong>{activeTuningPresetLabel()}</strong>
                  <ChevronDown size={16} />
                </summary>
                <div
                  class={styles.presetChoices}
                  role="group"
                  aria-label="Tuning preset"
                >
                  <For each={tuningPresets()}>
                    {(preset) => (
                      <button
                        type="button"
                        aria-pressed={
                          props.activeTuningPreset?.() === preset.id
                        }
                        disabled={controlsDisabled()}
                        onClick={() => chooseTuningPreset(preset.id)}
                      >
                        <strong>{preset.label}</strong>
                        <Show when={preset.detail}>
                          <small>{preset.detail}</small>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </details>
            </Show>
          </div>
        </Show>

        <div class={styles.stringRail} data-testid="guitar-night-tuner-strings">
          <div class={styles.stringRailLabel}>
            <strong>Open strings</strong>
            <span>
              {props.targetMode() === 'auto'
                ? 'The closest string is chosen as you play.'
                : 'Choose the string you are tuning.'}
            </span>
          </div>
          <div
            class={styles.stringTargets}
            role="group"
            aria-label={`${props.strings().length}-string tuning targets`}
          >
            <For each={props.strings()}>
              {(target) => (
                <button
                  type="button"
                  data-selected={
                    props.targetStringId() === target.id ? 'true' : undefined
                  }
                  data-reference={
                    props.referenceStringId() === target.id ? 'true' : undefined
                  }
                  data-ready={
                    readyStringIds().has(target.id) ? 'true' : undefined
                  }
                  aria-pressed={
                    props.targetMode() === 'manual' &&
                    props.targetStringId() === target.id
                  }
                  aria-label={targetAriaLabel(target)}
                  disabled={controlsDisabled()}
                  onClick={() => selectTarget(target)}
                >
                  <small>String {target.stringNumber}</small>
                  <strong>{target.noteName}</strong>
                  <span class={styles.stringOctave}>{target.octave}</span>
                  <Show when={readyStringIds().has(target.id)}>
                    <span class={styles.readyMark} aria-hidden="true">
                      <CheckSmall size={13} />
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <div
        class={styles.controlDeck}
        data-testid="guitar-night-tuner-controls"
        aria-label="Tuner controls"
      >
        <div class={styles.targetModes}>
          <span>Target</span>
          <div role="group" aria-label="String targeting">
            <button
              type="button"
              aria-pressed={props.targetMode() === 'auto'}
              disabled={controlsDisabled()}
              onClick={() => props.onTargetModeChange('auto')}
            >
              Auto
            </button>
            <button
              type="button"
              aria-pressed={props.targetMode() === 'manual'}
              disabled={controlsDisabled()}
              onClick={() => props.onTargetModeChange('manual')}
            >
              Manual
            </button>
          </div>
        </div>

        <button
          class={styles.referenceControl}
          type="button"
          aria-label={referenceControlLabel()}
          aria-pressed={referenceTarget() !== null}
          disabled={
            controlsDisabled() ||
            (selectedTarget() === null && referenceTarget() === null)
          }
          onClick={toggleReference}
        >
          {referenceTarget() === null ? <Volume2 /> : <VolumeX />}
          <span>{referenceControlCopy()}</span>
        </button>

        <button
          class={styles.listeningControl}
          type="button"
          data-active={listeningActive() ? 'true' : undefined}
          aria-busy={props.listeningState() === 'starting'}
          disabled={controlsDisabled()}
          onClick={toggleListening}
        >
          <Mic />
          <span>{listeningControlCopy()}</span>
        </button>
      </div>
    </section>
  )
}
