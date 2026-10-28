// ============================================================
// What rises over the drill room: the "?" sheet, Close's question,
// the sound having stopped, and Calibration's "before you start".
// Each holds focus while it is up and gives it back as it goes.
// ============================================================

import type { JSX } from 'solid-js'
import { createUniqueId, For, onCleanup, onMount, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { IconCheck, IconClose } from '@/features/ear-lab/ear-icons'
import { useEarRoom } from '@/features/ear-lab/ear-room-context'
import { CLICK_VOICES, EAR_VOLUME, formatEarVolume, } from '@/features/ear-lab/ear-sound'
import type { ModeToggleProps } from '@/features/ear-lab/EarStage'
import { RulersNote } from '@/features/ear-lab/RulersNote'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import { micLatencyMs } from '@/stores/mic-latency-store'
import { IconDoor, IconGlass, IconHeadphones, IconOnce, IconTracks, } from './merc-icons'
import styles from './room.module.css'
import { mercStill } from './stills'

/** Focus the sheet's first control as it opens; give focus back to
 *  whatever opened it as it closes; Escape closes. */
function useSheetFocus(
  host: () => HTMLElement | undefined,
  onEscape: () => void,
): void {
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  onMount(() => {
    queueMicrotask(() =>
      host()
        ?.querySelector<HTMLElement>('[data-autofocus], button')
        ?.focus({ preventScroll: true }),
    )
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onEscape()
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })
  onCleanup(() => {
    if (opener && document.body.contains(opener)) {
      opener.focus({ preventScroll: true })
    }
  })
}

/** Merc and his line, small, at the head of a sheet. */
function SheetMerc(props: { line: string }): JSX.Element {
  return (
    <div class={styles.mercRow}>
      <div class={styles.mercBox}>
        <MercPresence
          state={() => 'point'}
          stillSrc={mercStill('point')}
          size={56}
          testId="merc-sheet-merc"
        />
      </div>
      <div class={styles.bubble}>
        <p class={styles.say}>{props.line}</p>
      </div>
    </div>
  )
}

// ── "?" ─────────────────────────────────────────────────────────

/** Drills whose sound is the click the room's "?" lets you choose. */
const CLICK_DRILLS = new Set(['the-grid', 'drift', 'pulse', 'chart'])
/** Drills that take taps against the round trip. */
const TAP_DRILLS = new Set(['pulse', 'chart'])

export function HelpSheet(props: {
  name: string
  drillId: string
  measures?: string
  description?: string
  answerMode: ModeToggleProps<string> | null
  running: boolean
  /** Open on the rulers, from a sealed plate's "What the Index counts". */
  rulersFirst?: boolean
  onClose: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const room = useEarRoom()
  const titleId = `merc-help-${createUniqueId()}`
  useSheetFocus(
    () => host,
    () => props.onClose(),
  )
  onMount(() => {
    if (props.rulersFirst !== true) return
    queueMicrotask(() =>
      host
        ?.querySelector('[data-section="rulers"]')
        ?.scrollIntoView({ block: 'start' }),
    )
  })
  return (
    <>
      <div class={styles.scrim} onClick={() => props.onClose()} />
      <section
        class={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={host}
        data-testid="merc-help"
      >
        <div class={styles.grabber} aria-hidden="true" />
        <div class={styles.sheetHead}>
          <h2 id={titleId} class={styles.sheetTitle}>
            {props.name}
          </h2>
          <button
            type="button"
            class={styles.round}
            aria-label="Close"
            onClick={() => props.onClose()}
          >
            <IconClose size={18} />
          </button>
        </div>

        <Show when={props.description}>
          {(description) => (
            <div class={styles.sheetSection}>
              <p class={styles.sheetKicker}>The instrument</p>
              <Show when={props.measures}>
                {(measures) => <p class={styles.sheetMeasures}>{measures()}</p>}
              </Show>
              <p class={styles.sheetText}>{description()}</p>
            </div>
          )}
        </Show>

        <Show when={props.answerMode}>
          {(toggle) => (
            <div class={styles.sheetSection}>
              <p class={styles.sheetKicker} id={`${titleId}-mode`}>
                {toggle().label}
              </p>
              <div
                class={styles.choiceRow}
                role="radiogroup"
                aria-labelledby={`${titleId}-mode`}
              >
                <For each={toggle().options}>
                  {(option) => (
                    <button
                      type="button"
                      role="radio"
                      class={styles.choice}
                      aria-checked={toggle().value === option.id}
                      onClick={() => toggle().onChange(option.id)}
                    >
                      <b>{option.label}</b>
                    </button>
                  )}
                </For>
              </div>
              <Show when={props.running}>
                <p class={styles.sheetText}>Takes effect from the next run.</p>
              </Show>
            </div>
          )}
        </Show>

        <div class={styles.sheetSection}>
          <p class={styles.sheetKicker}>Sound</p>
          <label class={styles.slider}>
            <input
              type="range"
              min={EAR_VOLUME.min}
              max={EAR_VOLUME.max}
              step={EAR_VOLUME.step}
              value={room.volume()}
              aria-label="Stage volume"
              aria-valuetext={formatEarVolume(room.volume())}
              data-testid="merc-volume"
              onInput={(event) =>
                room.setVolume(Number(event.currentTarget.value))
              }
            />
            <output aria-hidden="true">{formatEarVolume(room.volume())}</output>
          </label>
          <Show when={CLICK_DRILLS.has(props.drillId)}>
            <p class={styles.sheetText} id={`${titleId}-click`}>
              The click
            </p>
            <div
              class={styles.choiceRow}
              role="radiogroup"
              aria-labelledby={`${titleId}-click`}
            >
              <For each={CLICK_VOICES}>
                {(voice) => (
                  <button
                    type="button"
                    role="radio"
                    class={styles.choice}
                    aria-checked={room.clickVoice() === voice.id}
                    onClick={() => room.chooseClick(voice.id)}
                  >
                    <b>{voice.label}</b>
                    <small>{voice.note}</small>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={TAP_DRILLS.has(props.drillId)}>
          <div class={styles.sheetSection}>
            <p class={styles.sheetKicker}>Round trip</p>
            <p class={styles.sheetText}>
              <Show
                when={micLatencyMs() > 0}
                fallback="Not measured yet: taps are taken raw."
              >
                Round trip {Math.round(micLatencyMs())} ms comes off every tap.
              </Show>
            </p>
            <MicLatencyWizard onClose={() => undefined} />
          </div>
        </Show>

        <div class={styles.sheetSection} data-section="rulers">
          <p class={styles.sheetKicker}>Why no percent</p>
          <div class={styles.sheetText}>
            <RulersNote />
          </div>
        </div>
      </section>
    </>
  )
}

// ── Close's question ────────────────────────────────────────────

export function ExitConfirm(props: {
  title: string
  body: string
  leave: string
  stay: string
  onLeave: () => void
  onStay: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const titleId = `merc-exit-${createUniqueId()}`
  useSheetFocus(
    () => host,
    () => props.onStay(),
  )
  return (
    <>
      <div class={styles.scrim} onClick={() => props.onStay()} />
      <section
        class={styles.confirm}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-body`}
        ref={host}
        data-testid="merc-exit"
      >
        <h2 id={titleId} class={styles.confirmTitle}>
          {props.title}
        </h2>
        <p id={`${titleId}-body`} class={styles.confirmBody}>
          {props.body}
        </p>
        <div class={styles.confirmActions}>
          <button
            type="button"
            class={styles.danger}
            onClick={() => props.onLeave()}
          >
            {props.leave}
          </button>
          <button
            type="button"
            class={styles.primary}
            data-autofocus
            onClick={() => props.onStay()}
          >
            {props.stay}
          </button>
        </div>
      </section>
    </>
  )
}

// ── The sound stopped ───────────────────────────────────────────

export function SoundStopped(props: {
  title: string
  cause: string
  merc: string
  body: string
  onResume: () => void
  onLeave: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const titleId = `merc-stopped-${createUniqueId()}`
  useSheetFocus(
    () => host,
    () => undefined,
  )
  return (
    <>
      <div class={styles.scrim} />
      <section
        class={styles.sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={host}
        data-testid="merc-sound-stopped"
      >
        <div class={styles.grabber} aria-hidden="true" />
        <div class={styles.sheetHead}>
          <div>
            <h2 id={titleId} class={styles.sheetTitle}>
              {props.title}
            </h2>
            <p class={styles.sheetMeasures}>{props.cause}</p>
          </div>
        </div>
        <div class={styles.sheetSection}>
          <SheetMerc line={props.merc} />
        </div>
        <p class={styles.sheetText}>{props.body}</p>
        <div class={styles.confirmActions}>
          <button
            type="button"
            class={styles.danger}
            onClick={() => props.onLeave()}
          >
            End the run
          </button>
          <button
            type="button"
            class={styles.primary}
            data-autofocus
            onClick={() => props.onResume()}
          >
            Resume
          </button>
        </div>
      </section>
    </>
  )
}

// ── Calibration: before you start ───────────────────────────────

const TERM_ICONS = [IconTracks, IconOnce, IconHeadphones, IconGlass, IconDoor]

export function CalibrationBefore(props: {
  title: string
  sub: string
  merc: string
  terms: ReadonlyArray<{ head: string; line: string }>
  later: string
  begin: string
  onBegin: () => void
  onLater: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const titleId = `merc-calibrate-${createUniqueId()}`
  useSheetFocus(
    () => host,
    () => props.onLater(),
  )
  return (
    <>
      <div class={styles.scrim} onClick={() => props.onLater()} />
      <section
        class={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={host}
        data-testid="merc-calibration-before"
      >
        <div class={styles.grabber} aria-hidden="true" />
        <div class={styles.sheetHead}>
          <div style={{ flex: '1 1 auto' }}>
            <h2 id={titleId} class={styles.sheetTitle}>
              {props.title}
            </h2>
            <p class={styles.sheetMeasures}>{props.sub}</p>
          </div>
          <button
            type="button"
            class={styles.round}
            aria-label="Close"
            onClick={() => props.onLater()}
          >
            <IconClose size={18} />
          </button>
        </div>
        <div class={styles.sheetSection}>
          <SheetMerc line={props.merc} />
        </div>
        <ul class={styles.terms} aria-label="How calibration works">
          <For each={props.terms}>
            {(term, i) => {
              return (
                <li class={styles.term}>
                  <Dynamic component={TERM_ICONS[i()] ?? IconCheck} size={20} />
                  <span>
                    <b>{term.head}</b>
                    <small>{term.line}</small>
                  </span>
                </li>
              )
            }}
          </For>
        </ul>
        <div class={styles.confirmActions}>
          <button
            type="button"
            class={styles.quiet}
            onClick={() => props.onLater()}
          >
            {props.later}
          </button>
          <button
            type="button"
            class={styles.primary}
            data-autofocus
            data-testid="merc-calibration-begin"
            onClick={() => props.onBegin()}
          >
            {props.begin}
          </button>
        </div>
      </section>
    </>
  )
}
