// ============================================================
// Piano Night — standalone Performance Horizon practice room
// ============================================================
//
// This route composes one prepared project, one audio-clock transport, one
// normalized input owner, and one zero-download fallback instrument without
// importing the App-owned Piano page or its stores.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { ChevronLeft, Headphones, Metronome, MusicBoard, Pause, PianoKeys, Play, Settings, SkipBack, SkipForward, SlidersHorizontal, WaveformBars, X, } from '@/components/icons'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { PianoNightPhrase } from './piano-night-demo-project'
import { PIANO_NIGHT_PHRASES } from './piano-night-demo-project'
import { PianoKeyHorizon } from './PianoKeyHorizon'
import styles from './PianoNightApp.module.css'
import type { PianoNightPerformanceView } from './PianoNightStageViews'
import { PianoNightStageViews } from './PianoNightStageViews'
import { LEGACY_PIANO_PATH } from './route'
import { usePianoNightController } from './usePianoNightController'

type DrawerSection = 'session' | 'sound' | 'room'

const VIEW_ORDER: readonly PianoNightPerformanceView[] = [
  'fall',
  'score',
  'keys',
]
const VIEW_LABELS: Record<PianoNightPerformanceView, string> = {
  fall: 'Fall',
  score: 'Score',
  keys: 'Keys',
}
const DRAWER_SECTIONS: readonly DrawerSection[] = ['session', 'sound', 'room']

interface PhraseCoachProps {
  phrase: () => PianoNightPhrase
  phraseIndex: () => number
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
  closeButtonRef: (element: HTMLButtonElement) => void
}

function PhraseCoach(props: PhraseCoachProps): JSX.Element {
  return (
    <>
      <div class={styles.coachTopline}>
        <button
          type="button"
          onClick={() => props.onPrevious()}
          aria-label="Previous practice phrase"
        >
          <ChevronLeft />
        </button>
        <div>
          <strong>
            Phrase {props.phraseIndex() + 1} of {PIANO_NIGHT_PHRASES.length}
          </strong>
          <span>{props.phrase().range}</span>
        </div>
        <button
          type="button"
          onClick={() => props.onNext()}
          aria-label="Next practice phrase"
        >
          <span class={styles.chevronRight}>
            <ChevronLeft />
          </span>
        </button>
        <button
          ref={props.closeButtonRef}
          class={styles.coachClose}
          type="button"
          onClick={() => props.onClose()}
          aria-label="Close phrase practice prompt"
        >
          <X />
        </button>
      </div>

      <div class={styles.coachBody}>
        <span class={styles.previewLabel}>Practice prompt · not scored</span>
        <p class={styles.coachGuidance}>{props.phrase().guidance}</p>

        <section class={styles.coachSection}>
          <h2>Focus</h2>
          <p class={styles.focusLine}>
            <i aria-hidden="true" />
            {props.phrase().focus}
          </p>
          <svg
            class={styles.miniStaff}
            viewBox="0 0 210 66"
            role="img"
            aria-label="Practice-prompt notation, not a measured result"
          >
            <path d="M10 19h190M10 27h190M10 35h190M10 43h190M10 51h190" />
            <path class={styles.staffBars} d="M62 15v40M118 15v40M174 15v40" />
            <text x="12" y="49">
              𝄞
            </text>
            <g class={styles.cyanNotes}>
              <ellipse cx="52" cy="43" rx="5" ry="4" />
              <path d="M57 42V23" />
              <ellipse cx="80" cy="35" rx="5" ry="4" />
              <path d="M85 34V16" />
              <ellipse cx="108" cy="31" rx="5" ry="4" />
              <path d="M113 30V12" />
            </g>
            <g class={styles.coralNotes}>
              <ellipse cx="144" cy="39" rx="5" ry="4" />
              <path d="M149 38V20" />
              <ellipse cx="172" cy="35" rx="5" ry="4" />
              <path d="M177 34V16" />
            </g>
          </svg>
        </section>

        <section class={styles.coachSection}>
          <h2>Dynamics prompt</h2>
          <div class={styles.dynamics} aria-label="Suggested crescendo">
            <i>mp</i>
            <svg viewBox="0 0 160 38" aria-hidden="true">
              <path d="M2 30c47 0 65-20 104-20 24 0 37-5 52-7" />
            </svg>
            <i>mf</i>
          </div>
        </section>

        <section class={styles.coachSection}>
          <h2>Pedal prompt</h2>
          <div class={styles.pedal} aria-label="Suggested sustain range">
            <i aria-hidden="true" />
            <span />
            <i aria-hidden="true" />
          </div>
        </section>
      </div>
    </>
  )
}

function formatClock(beat: number, tempoBpm: number): string {
  const seconds = Math.max(0, (beat * 60) / tempoBpm)
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function PianoNightApp(): JSX.Element {
  const controller = usePianoNightController()
  const background = useBackgroundSurfaceController('piano')
  const [view, setView] = createSignal<PianoNightPerformanceView>('fall')
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [drawerSection, setDrawerSection] =
    createSignal<DrawerSection>('session')
  const [coachOpen, setCoachOpen] = createSignal(false)
  const [compactSheets, setCompactSheets] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')

  let stageElement: HTMLElement | undefined
  let drawerElement: HTMLElement | undefined
  let drawerCloseButton: HTMLButtonElement | undefined
  let coachElement: HTMLElement | undefined
  let coachCloseButton: HTMLButtonElement | undefined
  let compactSurfaceOpener: HTMLElement | null = null
  let announcementTimer: number | null = null

  const phraseIndex = (): number => {
    const beat = controller.playheadBeat()
    const index = PIANO_NIGHT_PHRASES.findIndex(
      (candidate) => beat < candidate.endBeat,
    )
    return index === -1 ? PIANO_NIGHT_PHRASES.length - 1 : index
  }
  const phrase = (): PianoNightPhrase => PIANO_NIGHT_PHRASES[phraseIndex()]
  const roomLabel = (): string =>
    background
      .options()
      .find((option) => option.id === background.resolved().id)?.label ??
    getBackgroundDefinition(background.resolved().id)?.label ??
    'Piano room'
  const isPlaying = (): boolean => controller.transport.phase() === 'playing'
  const isLoading = (): boolean => controller.transport.phase() === 'loading'
  const blockingModal = (): boolean => drawerOpen() && !compactSheets()

  const midiLabel = (): string => {
    const snapshot = controller.midiSnapshot()
    if (snapshot.connected) {
      return (
        snapshot.devices.find(
          (device) => device.id === snapshot.selectedInputId,
        )?.name ?? 'MIDI connected'
      )
    }
    if (snapshot.permission === 'requesting') return 'Connecting'
    if (snapshot.permission === 'denied') return 'MIDI denied'
    if (snapshot.permission === 'unsupported') return 'MIDI unavailable'
    const liveCount = controller.inputSnapshot().soundingNotes.length
    return liveCount > 0 ? `${liveCount} live notes` : 'Touch ready'
  }

  const pedalLabel = (): string | null => {
    const observed = controller.observedPedals()
    if (observed.size === 0) return null
    const labels = {
      sustain: 'Sustain',
      sostenuto: 'Sostenuto',
      soft: 'Soft',
    } as const
    return Array.from(observed)
      .map((kind) => {
        const value = controller
          .inputSnapshot()
          .pedals.reduce((maximum, pedal) => Math.max(maximum, pedal[kind]), 0)
        return `${labels[kind]} ${Math.round(value * 100)}%`
      })
      .join(' · ')
  }

  const announce = (message: string): void => {
    if (announcementTimer !== null) window.clearTimeout(announcementTimer)
    setAnnouncement(message)
    announcementTimer = window.setTimeout(() => {
      setAnnouncement('')
      announcementTimer = null
    }, 1800)
  }

  const selectDrawerSection = (section: DrawerSection): void => {
    setDrawerSection(section)
    queueMicrotask(() => drawerElement?.scrollTo?.({ top: 0 }))
  }

  const onDrawerTabKeyDown = (
    event: KeyboardEvent,
    section: DrawerSection,
  ): void => {
    let nextIndex: number | null = null
    const currentIndex = DRAWER_SECTIONS.indexOf(section)
    if (event.key === 'ArrowLeft') nextIndex = currentIndex - 1
    else if (event.key === 'ArrowRight') nextIndex = currentIndex + 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = DRAWER_SECTIONS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    const next =
      DRAWER_SECTIONS[
        (nextIndex + DRAWER_SECTIONS.length) % DRAWER_SECTIONS.length
      ]
    selectDrawerSection(next)
    queueMicrotask(() =>
      drawerElement
        ?.querySelector<HTMLButtonElement>(`#piano-night-tab-${next}`)
        ?.focus(),
    )
  }

  const stepPhrase = (direction: -1 | 1): void => {
    const next =
      (phraseIndex() + direction + PIANO_NIGHT_PHRASES.length) %
      PIANO_NIGHT_PHRASES.length
    controller.seekToBeat(PIANO_NIGHT_PHRASES[next].startBeat)
    announce(`Phrase ${next + 1}, ${PIANO_NIGHT_PHRASES[next].range}.`)
  }

  const cycleView = (): void => {
    setView((current) => {
      const index = VIEW_ORDER.indexOf(current)
      const next = VIEW_ORDER[(index + 1) % VIEW_ORDER.length]
      announce(`${VIEW_LABELS[next]} view selected.`)
      return next
    })
  }

  const rememberCompactSurfaceOpener = (): void => {
    compactSurfaceOpener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  }

  const restoreCompactSurfaceFocus = (): void => {
    const opener = compactSurfaceOpener
    compactSurfaceOpener = null
    queueMicrotask(() => {
      if (opener?.isConnected === true) opener.focus({ preventScroll: true })
    })
  }

  const closeDrawer = (): void => {
    setDrawerOpen(false)
    if (compactSheets()) restoreCompactSurfaceFocus()
  }

  const closeCoach = (): void => {
    setCoachOpen(false)
    if (compactSheets()) restoreCompactSurfaceFocus()
  }

  const openDrawer = (section: DrawerSection): void => {
    setCoachOpen(false)
    selectDrawerSection(section)
    setDrawerOpen(true)
    if (compactSheets()) {
      rememberCompactSurfaceOpener()
      queueMicrotask(() => drawerCloseButton?.focus())
    }
  }

  const openCoach = (): void => {
    if (!compactSheets()) {
      coachElement?.focus()
      return
    }
    setDrawerOpen(false)
    setCoachOpen(true)
    rememberCompactSurfaceOpener()
    queueMicrotask(() => coachCloseButton?.focus())
  }

  const closeTopSurface = (): boolean => {
    if (coachOpen()) {
      closeCoach()
      return true
    }
    if (drawerOpen()) {
      closeDrawer()
      return true
    }
    return false
  }

  useFocusTrap(() => drawerElement, {
    isOpen: blockingModal,
    onClose: closeDrawer,
    initialFocus: () => drawerCloseButton,
  })

  onCleanup(() => {
    if (announcementTimer !== null) window.clearTimeout(announcementTimer)
  })

  onMount(() => {
    const uninstallSpace = installSpacePlaybackToggle({
      toggle: controller.togglePlayback,
      enabled: () => !isLoading(),
    })
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 1180px)')
        : null
    const syncSheets = (): void => {
      const isCompact = media?.matches ?? false
      setCompactSheets(isCompact)
      if (!isCompact) setCoachOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (closeTopSurface()) event.preventDefault()
    }
    syncSheets()
    media?.addEventListener?.('change', syncSheets)
    window.addEventListener('keydown', onKeyDown)

    onCleanup(() => {
      uninstallSpace()
      media?.removeEventListener?.('change', syncSheets)
      window.removeEventListener('keydown', onKeyDown)
    })
  })

  return (
    <div
      class={styles.shell}
      classList={{ [styles.playing]: isPlaying() }}
      data-view={view()}
      data-room={background.resolved().id}
      data-room-treatment={background.resolved().treatment}
      data-testid="piano-night-shell"
    >
      <a
        class={styles.skipLink}
        href="#piano-night-stage"
        inert={blockingModal()}
      >
        Skip to piano stage
      </a>

      <aside
        class={styles.rail}
        aria-label="Piano Night navigation"
        inert={blockingModal()}
      >
        <button
          class={styles.railButton}
          type="button"
          onClick={() => openDrawer('session')}
          aria-label="Open Piano Night controls"
        >
          <SlidersHorizontal />
          <span>Controls</span>
        </button>

        <nav class={styles.railStack}>
          <button
            class={`${styles.railButton} ${styles.railActive}`}
            type="button"
            onClick={() => stageElement?.focus()}
            aria-current="page"
          >
            <PianoKeys />
            <span>Stage</span>
          </button>
          <button class={styles.railButton} type="button" onClick={openCoach}>
            <WaveformBars />
            <span>Coach</span>
          </button>
          <button
            class={styles.railButton}
            type="button"
            onClick={() => openDrawer('sound')}
          >
            <Headphones />
            <span>Sounds</span>
          </button>
          <a class={styles.railButton} href={LEGACY_PIANO_PATH}>
            <MusicBoard />
            <span>Current Piano</span>
          </a>
        </nav>

        <button
          class={styles.railButton}
          type="button"
          onClick={() => openDrawer('room')}
        >
          <Settings />
          <span>Room</span>
        </button>
      </aside>

      <main
        ref={stageElement}
        id="piano-night-stage"
        class={styles.stage}
        tabindex="-1"
        aria-label="Piano Night performance stage"
        data-testid="piano-night-stage"
        inert={blockingModal()}
      >
        <div
          class={styles.roomPlate}
          style={background.resolvedStyle()}
          aria-hidden="true"
          data-testid="piano-night-room-art"
        />
        <div class={styles.roomGrade} aria-hidden="true" />

        <div class={styles.sessionHud} aria-label="Piano Night session status">
          <button
            class={styles.sessionDocument}
            type="button"
            onClick={() => openDrawer('session')}
            aria-label="Open session controls"
          >
            <MusicBoard />
          </button>
          <div class={styles.sessionPiece}>
            <strong>{controller.stage.title}</strong>
            <span>
              {phrase().range} · {roomLabel()}
            </span>
          </div>
          <div class={`${styles.sessionMetric} ${styles.timeMetric}`}>
            <strong>
              {formatClock(
                controller.playheadBeat(),
                controller.transport.timeline.tempoBpm(),
              )}
            </strong>
            <span>{controller.transport.phase()}</span>
          </div>
          <div class={styles.sessionTrace}>
            <div aria-hidden="true">
              <For each={[8, 14, 6, 18, 10, 7, 15, 5, 12, 8]}>
                {(height, index) => (
                  <i
                    classList={{
                      [styles.traceCoral]: index() === 7 || index() === 9,
                    }}
                    style={{ height: `${height}px` }}
                  />
                )}
              </For>
              <b />
            </div>
            <input
              type="range"
              min="0"
              max={controller.stage.totalBeats}
              step="0.25"
              value={controller.playheadBeat()}
              aria-label="Seek prepared piano project"
              onInput={(event) =>
                controller.seekToBeat(Number(event.currentTarget.value))
              }
              data-testid="piano-night-seek"
            />
          </div>
          <div class={styles.sessionMetric}>
            <strong>
              {Math.round(controller.transport.timeline.tempoBpm())}
            </strong>
            <span>BPM</span>
          </div>
          <div class={styles.inputState}>
            <i
              aria-hidden="true"
              data-connected={controller.midiSnapshot().connected}
            />
            <span>{midiLabel()}</span>
          </div>
          <button
            class={styles.viewButton}
            type="button"
            onClick={cycleView}
            aria-label={`Change performance view. Current view: ${VIEW_LABELS[view()]}`}
          >
            <span>{VIEW_LABELS[view()]}</span>
            <PianoKeys />
          </button>
        </div>

        <PianoNightStageViews
          view={view}
          notes={controller.stage.notes}
          playheadBeat={controller.playheadBeat}
          isPlaying={isPlaying}
          phrase={phrase}
          activeMidis={controller.activeMidis}
          reducedMotion={controller.reducedMotion}
        />

        <button
          class={styles.coachPeek}
          type="button"
          onClick={openCoach}
          aria-expanded={coachOpen()}
        >
          <WaveformBars />
          <span>Phrase {phraseIndex() + 1}</span>
        </button>

        <PianoKeyHorizon
          activeMidis={controller.activeMidis}
          onPointerDown={controller.pressTouchKey}
          onPointerMove={controller.moveTouchKey}
          onPointerRelease={controller.releaseTouchKey}
          onKeyboardActivate={controller.playKeyboardKey}
        />

        <div class={styles.fallboard}>
          <div class={styles.transport} aria-label="Piano Night transport">
            <button
              type="button"
              onClick={() => openDrawer('session')}
              aria-label="Open session controls"
            >
              <SlidersHorizontal />
            </button>
            <button
              type="button"
              disabled
              aria-label="Metronome is not available in this free runtime yet"
              title="Metronome arrives with the full practice transport"
            >
              <Metronome />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <button
              type="button"
              onClick={() => stepPhrase(-1)}
              aria-label="Previous practice phrase"
            >
              <SkipBack />
            </button>
            <button
              class={styles.playButton}
              type="button"
              onClick={controller.togglePlayback}
              aria-label={
                isPlaying() ? 'Pause Piano Night' : 'Play Piano Night'
              }
              aria-pressed={isPlaying()}
              disabled={isLoading()}
              data-testid="piano-night-play"
            >
              <Show when={isPlaying()} fallback={<Play />}>
                <Pause />
              </Show>
            </button>
            <button
              type="button"
              onClick={() => stepPhrase(1)}
              aria-label="Next practice phrase"
            >
              <SkipForward />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <div class={styles.tempoReadout}>
              <strong>
                {Math.round(controller.transport.timeline.tempoBpm())}
              </strong>
              <span>BPM</span>
            </div>
            <button
              type="button"
              onClick={() =>
                controller.setTempoBpm(
                  controller.transport.timeline.tempoBpm() - 2,
                )
              }
              aria-label="Decrease tempo"
            >
              −
            </button>
            <button
              type="button"
              onClick={() =>
                controller.setTempoBpm(
                  controller.transport.timeline.tempoBpm() + 2,
                )
              }
              aria-label="Increase tempo"
            >
              +
            </button>
          </div>
        </div>
      </main>

      <aside
        ref={coachElement}
        class={styles.coach}
        classList={{ [styles.coachOpen]: coachOpen() }}
        role={compactSheets() ? 'region' : undefined}
        aria-label="Phrase practice prompt"
        aria-hidden={
          blockingModal() || (compactSheets() && !coachOpen())
            ? 'true'
            : undefined
        }
        inert={blockingModal() || (compactSheets() && !coachOpen())}
        tabindex="-1"
      >
        <PhraseCoach
          phrase={phrase}
          phraseIndex={phraseIndex}
          onPrevious={() => stepPhrase(-1)}
          onNext={() => stepPhrase(1)}
          onClose={closeCoach}
          closeButtonRef={(element) => {
            coachCloseButton = element
          }}
        />
      </aside>

      <nav
        class={styles.mobileNav}
        aria-label="Piano Night mobile navigation"
        inert={blockingModal()}
      >
        <button
          class={styles.mobileActive}
          type="button"
          onClick={() => stageElement?.focus()}
        >
          <PianoKeys />
          <span>Stage</span>
        </button>
        <button type="button" onClick={openCoach} aria-expanded={coachOpen()}>
          <WaveformBars />
          <span>Coach</span>
        </button>
        <button type="button" onClick={() => openDrawer('sound')}>
          <Headphones />
          <span>Sounds</span>
        </button>
        <a href={LEGACY_PIANO_PATH}>
          <MusicBoard />
          <span>Current</span>
        </a>
      </nav>

      <Show when={blockingModal()}>
        <button
          class={styles.scrim}
          type="button"
          onClick={closeDrawer}
          aria-label="Close Piano Night controls"
        />
      </Show>
      <aside
        ref={drawerElement}
        class={styles.drawer}
        classList={{ [styles.drawerOpen]: drawerOpen() }}
        role="dialog"
        aria-modal={blockingModal() ? 'true' : undefined}
        aria-label="Piano Night controls"
        aria-hidden={!drawerOpen()}
        inert={!drawerOpen()}
        tabindex="-1"
      >
        <div class={styles.drawerTopline}>
          <div>
            <span>Performance Horizon</span>
            <strong>Piano Night</strong>
          </div>
          <button
            ref={drawerCloseButton}
            type="button"
            onClick={closeDrawer}
            aria-label="Close Piano Night controls"
          >
            <X />
          </button>
        </div>
        <div
          class={styles.drawerTabs}
          role="tablist"
          aria-label="Control groups"
        >
          <For each={DRAWER_SECTIONS}>
            {(section) => (
              <button
                type="button"
                id={`piano-night-tab-${section}`}
                role="tab"
                classList={{
                  [styles.drawerTabActive]: drawerSection() === section,
                }}
                aria-selected={drawerSection() === section}
                aria-controls={`piano-night-panel-${section}`}
                tabindex={drawerSection() === section ? 0 : -1}
                onClick={() => selectDrawerSection(section)}
                onKeyDown={(event) => onDrawerTabKeyDown(event, section)}
              >
                {section[0].toUpperCase() + section.slice(1)}
              </button>
            )}
          </For>
        </div>

        <Show when={drawerSection() === 'session'}>
          <section
            id="piano-night-panel-session"
            class={styles.drawerPanel}
            role="tabpanel"
            aria-labelledby="piano-night-tab-session"
          >
            <span class={styles.drawerKicker}>Prepared session</span>
            <h2>{controller.stage.title}</h2>
            <p>
              A bundled first-party score powers every lens. Nothing is loaded
              from your library until a later handoff phase.
            </p>
            <dl class={styles.sessionFacts}>
              <div>
                <dt>Position</dt>
                <dd>
                  Beat {controller.playheadBeat().toFixed(1)} of{' '}
                  {controller.stage.totalBeats}
                </dd>
              </div>
              <div>
                <dt>Input</dt>
                <dd>{midiLabel()}</dd>
              </div>
              <div>
                <dt>Sound</dt>
                <dd>Built-in fallback synth</dd>
              </div>
              <Show when={pedalLabel()}>
                {(label) => (
                  <div>
                    <dt>Pedals detected</dt>
                    <dd>{label()}</dd>
                  </div>
                )}
              </Show>
            </dl>

            <div class={styles.midiActions}>
              <Show
                when={controller.midiSnapshot().permission === 'granted'}
                fallback={
                  <button
                    class={styles.actionButton}
                    type="button"
                    onClick={() => void controller.connectMidi()}
                    disabled={
                      controller.midiSnapshot().permission === 'requesting'
                    }
                  >
                    {controller.midiSnapshot().permission === 'requesting'
                      ? 'Connecting…'
                      : 'Connect MIDI'}
                  </button>
                }
              >
                <label class={styles.midiSelect}>
                  <span>MIDI input</span>
                  <select
                    value={controller.midiSnapshot().selectedInputId ?? ''}
                    onChange={(event) =>
                      controller.selectMidiInput(
                        event.currentTarget.value === ''
                          ? null
                          : event.currentTarget.value,
                      )
                    }
                  >
                    <option value="">No MIDI input</option>
                    <For each={controller.midiSnapshot().devices}>
                      {(device) => (
                        <option value={device.id}>{device.name}</option>
                      )}
                    </For>
                  </select>
                </label>
                <button
                  class={styles.textButton}
                  type="button"
                  onClick={controller.disconnectMidi}
                >
                  Disconnect MIDI
                </button>
              </Show>
            </div>

            <Show when={controller.audioError()}>
              {(message) => (
                <p class={styles.runtimeError} role="alert">
                  {message()}
                </p>
              )}
            </Show>

            <a class={styles.legacyLink} href={LEGACY_PIANO_PATH}>
              <PianoKeys />
              <span>
                <strong>Open the current Piano tab</strong>
                <small>Use today’s songs, microphone, loop, and scoring.</small>
              </span>
            </a>
          </section>
        </Show>

        <Show when={drawerSection() === 'sound'}>
          <section
            id="piano-night-panel-sound"
            class={styles.drawerPanel}
            role="tabpanel"
            aria-labelledby="piano-night-tab-sound"
          >
            <span class={styles.drawerKicker}>Free instrument</span>
            <h2>Mercury Felt Synth</h2>
            <p>
              A lightweight 32-voice Web Audio fallback starts only after your
              first Play, MIDI-connect, or touch-key gesture. It is not a
              sampled piano or imported soundbank.
            </p>
            <div class={styles.soundStatus}>
              <span>Current output</span>
              <strong>
                {!controller.audioActive()
                  ? 'Silent until gesture'
                  : 'Fallback synth active'}
              </strong>
            </div>
            <button class={styles.previewRow} type="button" disabled>
              <span>
                <strong>Load your soundbank</strong>
                <small>Local Mercury Bank support is a later phase.</small>
              </span>
              <i>Not yet</i>
            </button>
          </section>
        </Show>

        <Show when={drawerSection() === 'room'}>
          <section
            id="piano-night-panel-room"
            class={styles.drawerPanel}
            role="tabpanel"
            aria-labelledby="piano-night-tab-room"
          >
            <span class={styles.drawerKicker}>Piano Night rooms</span>
            <h2>Choose the light around the instrument.</h2>
            <p>
              Room art is visual only. It never changes the synth, mix, or
              ambience. Your choice stays on this device and access is checked
              again whenever Piano Night opens.
            </p>
            <PremiumBackgroundPicker
              class={styles.roomPicker}
              controller={background}
              embedded
              onSelect={(option) => {
                const accepted = background.select(option.id)
                if (accepted) {
                  announce(
                    `${option.label} selected. Instrument sound unchanged.`,
                  )
                }
                return accepted
              }}
            />
          </section>
        </Show>
      </aside>

      <p class={styles.srOnly} role="status" aria-live="polite">
        {announcement() || controller.statusMessage()}
      </p>
    </div>
  )
}
