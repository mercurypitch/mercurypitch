// ============================================================
// A station's sheet: the faculty, Merc's one line about where to
// start, and a row per instrument that names its task and shows its
// reading. A tap on a row starts that drill; there is no Start pinned
// under the list. Wild lists the Field Book's songs instead, or says
// how to get one. Where a drill here can be sung, the sheet asks Tap or
// Sing or play first, and a row that will be sung starts on a mic.
// ============================================================

import type { JSX } from 'solid-js'
import { createUniqueId, For, onCleanup, onMount, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { MercPresence } from '@/components/room-kit/MercPresence'
import type { AnswerMode } from '@/features/ear-lab/answer-mode'
import { ANSWER_MODES } from '@/features/ear-lab/answer-mode'
import { IconClose, IconEar, IconMic, IconPlay, } from '@/features/ear-lab/ear-icons'
import { INSTRUMENT_ICON } from '@/features/ear-lab/instrument-icons'
import type { Instrument } from '@/features/ear-lab/instruments'
import { fieldBookSessions, setFieldBookSessionId, songName, } from '@/features/ear-lab/wild-store'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { FacultyId } from '@/lib/ear/drills'
import { setActiveTab } from '@/stores/ui-store'
import { answerModeOf, setStationAnswerMode, stationAnswerMode, sungDrills, voiceLine, } from './answer-choice'
import styles from './bench.module.css'
import { FIELD_BOOK_EMPTY, STATION_LINE, STATION_MEASURES, SUNG_TASK, TASK, } from './merc-lines'
import { instrumentName, rowReading, stationInstruments, stationTitle, } from './stations'
import { mercStill } from './stills'

export function StationSheet(props: {
  faculty: FacultyId
  /** The drill whose number a run just moved: its row is lit. */
  lit: string | null
  onStart: (instrument: Instrument) => void
  onOpenFieldBook: () => void
  onClose: () => void
}): JSX.Element {
  let host: HTMLElement | undefined
  const titleId = `merc-station-${createUniqueId()}`
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  onMount(() => {
    queueMicrotask(() =>
      host
        ?.querySelector<HTMLElement>('button')
        ?.focus({ preventScroll: true }),
    )
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onClose()
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })
  onCleanup(() => {
    if (opener && document.body.contains(opener)) {
      opener.focus({ preventScroll: true })
    }
  })

  const lead = () => stationInstruments(props.faculty)[0]
  /** The switch shows where songs or drills it governs are listed. */
  const asksVoice = () =>
    sungDrills(props.faculty).length > 0 &&
    (props.faculty !== 'wild' || fieldBookSessions().length > 0)
  const sung = (drillId: string | null): boolean =>
    drillId !== null &&
    sungDrills(props.faculty).includes(drillId) &&
    answerModeOf(drillId) === 'mic'
  const modeIcon = (id: AnswerMode) => (id === 'mic' ? IconMic : IconPlay)
  const Icon = () =>
    props.faculty === 'wild' || lead() === undefined
      ? IconEar
      : INSTRUMENT_ICON[lead().view]

  return (
    <>
      <div class={styles.scrim} onClick={() => props.onClose()} />
      <section
        class={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={host}
        data-testid="merc-station-sheet"
        data-faculty={props.faculty}
      >
        <div class={styles.grabber} aria-hidden="true" />
        <div class={styles.sheetHead}>
          <span class={styles.sheetIcon} aria-hidden="true">
            <Dynamic component={Icon()} size={30} />
          </span>
          <div class={styles.sheetTitles}>
            <h2 id={titleId} class={styles.sheetTitle}>
              {stationTitle(props.faculty)}
            </h2>
            <p class={styles.sheetMeasures}>
              {STATION_MEASURES[props.faculty]}
            </p>
          </div>
          <button
            type="button"
            class={styles.sheetClose}
            aria-label="Close"
            onClick={() => props.onClose()}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div class={styles.sheetMerc}>
          <div class={styles.sheetMercBox}>
            <MercPresence
              state={() => 'point'}
              stillSrc={mercStill('point')}
              size={56}
              testId="merc-station-merc"
            />
          </div>
          <div class={styles.sheetBubble}>
            <p>{STATION_LINE[props.faculty]}</p>
          </div>
        </div>

        <Show when={asksVoice()}>
          <div class={styles.voice} data-testid="merc-station-voice">
            <p class={styles.voiceKicker} id={`${titleId}-voice`}>
              Answer by
            </p>
            <div
              class={styles.voiceRow}
              role="radiogroup"
              aria-labelledby={`${titleId}-voice`}
            >
              <For each={ANSWER_MODES}>
                {(option) => (
                  <button
                    type="button"
                    role="radio"
                    class={styles.voiceOption}
                    aria-checked={
                      stationAnswerMode(props.faculty) === option.id
                    }
                    onClick={() =>
                      setStationAnswerMode(props.faculty, option.id)
                    }
                  >
                    <Dynamic
                      component={modeIcon(option.id)}
                      size={option.id === 'mic' ? 18 : 14}
                    />
                    <span>{option.label}</span>
                  </button>
                )}
              </For>
            </div>
            <p class={styles.voiceNote}>{voiceLine(props.faculty)}</p>
          </div>
        </Show>

        <Show
          when={props.faculty === 'wild'}
          fallback={
            <ul class={styles.rows} aria-label="Instruments">
              <For each={stationInstruments(props.faculty)}>
                {(instrument) => {
                  const reading = () => rowReading(instrument)
                  const task = () =>
                    (sung(instrument.drillId)
                      ? SUNG_TASK[instrument.drillId ?? '']
                      : undefined) ??
                    TASK[instrument.drillId ?? ''] ??
                    instrument.answer
                  const said = () => {
                    const now = reading()
                    if (now === null) return 'Unmeasured'
                    return `${now.unit === '' ? 'Rating ' : ''}${now.value}${
                      now.unit === '' ? '' : ` ${now.unit}`
                    }${now.settling ? ', settling' : ''}`
                  }
                  return (
                    <li>
                      <button
                        type="button"
                        class={styles.row}
                        classList={{
                          [styles.lit]: props.lit === instrument.drillId,
                        }}
                        aria-label={`Start ${instrumentName(instrument)}${
                          sung(instrument.drillId) ? ', sung' : ''
                        }: ${task()}. ${said()}.`}
                        data-testid="merc-station-row"
                        data-drill={instrument.drillId ?? instrument.view}
                        data-sung={sung(instrument.drillId) ? '' : undefined}
                        onClick={() => props.onStart(instrument)}
                      >
                        <span class={styles.rowIcon} aria-hidden="true">
                          <Dynamic
                            component={INSTRUMENT_ICON[instrument.view]}
                            size={22}
                          />
                        </span>
                        <span class={styles.rowText} aria-hidden="true">
                          <span class={styles.rowName}>
                            {instrumentName(instrument)}
                          </span>
                          <span class={styles.rowTask}>{task()}</span>
                        </span>
                        <span class={styles.rowReading} aria-hidden="true">
                          <Show
                            when={reading()}
                            fallback={
                              <span class={styles.rowNote}>Unmeasured</span>
                            }
                          >
                            {(now) => (
                              <>
                                <span class={styles.rowValue}>
                                  {now().value}
                                  {now().unit === '' ? '' : ` ${now().unit}`}
                                </span>
                                <Show when={now().settling}>
                                  <span class={styles.rowNote}>settling</span>
                                </Show>
                              </>
                            )}
                          </Show>
                        </span>
                        <span class={styles.rowGo} aria-hidden="true">
                          <Show
                            when={sung(instrument.drillId)}
                            fallback={<IconPlay size={12} />}
                          >
                            <IconMic size={16} />
                          </Show>
                        </span>
                      </button>
                    </li>
                  )
                }}
              </For>
            </ul>
          }
        >
          <Show
            when={fieldBookSessions().length > 0}
            fallback={
              <>
                <p class={styles.empty} data-testid="merc-field-book-empty">
                  {FIELD_BOOK_EMPTY}
                </p>
                <button
                  type="button"
                  class={styles.quiet}
                  onClick={() => {
                    props.onClose()
                    setActiveTab(TAB_KARAOKE)
                  }}
                >
                  Open the Karaoke room
                </button>
              </>
            }
          >
            <ul class={styles.rows} aria-label="Your songs">
              <For each={fieldBookSessions().slice(0, 8)}>
                {(song) => (
                  <li>
                    <button
                      type="button"
                      class={styles.row}
                      onClick={() => {
                        setFieldBookSessionId(song.sessionId)
                        props.onOpenFieldBook()
                      }}
                    >
                      <span class={styles.rowIcon} aria-hidden="true">
                        <IconEar size={22} />
                      </span>
                      <span class={styles.rowText}>
                        <span class={styles.rowName}>{songName(song)}</span>
                        <span class={styles.rowTask}>The Field Book</span>
                      </span>
                      <span class={styles.rowGo} aria-hidden="true">
                        <IconPlay size={12} />
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </section>
    </>
  )
}
