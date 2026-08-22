// ============================================================
// Piano Night — standalone Performance Horizon practice room
// ============================================================
//
// This route composes one replaceable staged source, one audio-clock transport,
// one normalized input owner, and one zero-download fallback instrument
// without importing the App-owned Piano page or its stores on first paint.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { ChevronLeft, MusicLibrary, Pause, PianoKeys, PianoWorkspace, Play, Repeat, RotateCcw, ScoreDocument, Settings, SkipBack, SkipForward, Volume2, WaveformBars, X, } from '@/components/icons'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { createPianoKeyWindowController } from './piano-key-window'
import type { PianoNightPhrase } from './piano-night-demo-project'
import { PIANO_NIGHT_PHRASES } from './piano-night-demo-project'
import type { PianoNightStageMotion } from './piano-night-fall-geometry'
import type { PianoNightPracticeRange } from './piano-night-practice-loop'
import { PIANO_NIGHT_PRACTICE_SPEEDS } from './piano-night-practice-loop'
import { createPianoNightPracticeSections } from './piano-night-practice-sections'
import { PianoKeyHorizon } from './PianoKeyHorizon'
import styles from './PianoNightApp.module.css'
import { PianoNightSoundPanel } from './PianoNightSoundPanel'
import type { PianoNightPerformanceView } from './PianoNightStageViews'
import { PianoNightStageViews } from './PianoNightStageViews'
import { LEGACY_PIANO_PATH } from './route'
import { usePianoNightController } from './usePianoNightController'

const PianoNightMusicPanel = lazy(async () =>
  import('./PianoNightMusicPanel').then((module) => ({
    default: module.PianoNightMusicPanel,
  })),
)

/** How long the coach stays marked after a rail press that cannot open it. */
const COACH_FLASH_MS = 1200

type SettingsSection = 'session' | 'sound' | 'room'
type DrawerSection = SettingsSection | 'music'

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
const DRAWER_SECTIONS: readonly DrawerSection[] = [
  'session',
  'music',
  'sound',
  'room',
]
const PIANO_NIGHT_STAGE_MOTIONS: readonly PianoNightStageMotion[] = [
  'flowing',
  'stepped',
]
const STAGE_MOTION_LABELS: Record<PianoNightStageMotion, string> = {
  flowing: 'Flowing',
  stepped: 'Stepped',
}
const STAGE_MOTION_ANNOUNCEMENTS: Record<PianoNightStageMotion, string> = {
  flowing: 'Stage motion set to flowing. Notes scroll continuously.',
  stepped: 'Stage motion set to stepped. Notes advance one bar at a time.',
}
interface PhraseCoachProps {
  phrase: () => PianoNightPhrase
  phraseIndex: () => number
  phraseCount: () => number
  hasAuthoredCoach: () => boolean
  sourceTitle: () => string
  practiceTrackLabel: () => string
  noteCount: () => number
  tempoBpm: () => number
  onPrevious: () => void
  onNext: () => void
  onPractice: () => void
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
          aria-label={
            props.hasAuthoredCoach()
              ? 'Previous practice phrase'
              : 'Previous project section'
          }
          disabled={props.phraseCount() <= 1}
        >
          <ChevronLeft />
        </button>
        <div>
          <strong>
            {props.hasAuthoredCoach() ? 'Phrase' : 'Section'}{' '}
            {props.phraseIndex() + 1} of {props.phraseCount()}
          </strong>
          <span>{props.phrase().range}</span>
        </div>
        <button
          type="button"
          onClick={() => props.onNext()}
          aria-label={
            props.hasAuthoredCoach()
              ? 'Next practice phrase'
              : 'Next project section'
          }
          disabled={props.phraseCount() <= 1}
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
        <Show
          when={props.hasAuthoredCoach()}
          fallback={
            <>
              <span class={styles.previewLabel}>
                No authored prompt · results measured separately
              </span>
              <p class={styles.coachGuidance}>
                No authored coaching prompt exists for {props.sourceTitle()}.
              </p>
              <section class={styles.coachSection}>
                <h2>On stage</h2>
                <dl class={styles.coachFacts}>
                  <div>
                    <dt>Section</dt>
                    <dd>{props.phrase().range}</dd>
                  </div>
                  <div>
                    <dt>Practice track</dt>
                    <dd>{props.practiceTrackLabel()}</dd>
                  </div>
                  <div>
                    <dt>Score notes</dt>
                    <dd>{props.noteCount()}</dd>
                  </div>
                  <div>
                    <dt>Base tempo</dt>
                    <dd>{Math.round(props.tempoBpm())} BPM</dd>
                  </div>
                </dl>
                <p class={styles.coachTruth}>
                  Use this beat range as a rehearsal boundary. Dynamics and
                  pedal guidance have not been inferred; timing and pitch
                  results still appear in Session.
                </p>
              </section>
            </>
          }
        >
          <span class={styles.previewLabel}>
            Practice prompt · results measured separately
          </span>
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
              <path
                class={styles.staffBars}
                d="M62 15v40M118 15v40M174 15v40"
              />
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
            <div
              class={styles.dynamics}
              role="img"
              aria-label="Crescendo from mezzo-piano to mezzo-forte"
            >
              <i>mp</i>
              <svg viewBox="0 0 160 38" aria-hidden="true">
                <path d="M2 30c47 0 65-20 104-20 24 0 37-5 52-7" />
              </svg>
              <i>mf</i>
            </div>
          </section>

          <section class={styles.coachSection}>
            <h2>Pedal prompt</h2>
            <div
              class={styles.pedal}
              role="img"
              aria-label="Hold the sustain pedal through the phrase, then release"
            >
              <i aria-hidden="true" />
              <span />
              <i aria-hidden="true" />
            </div>
          </section>
        </Show>
        <button
          class={styles.coachPracticeButton}
          type="button"
          onClick={() => props.onPractice()}
        >
          <Repeat />
          Practise this {props.hasAuthoredCoach() ? 'phrase' : 'section'}
        </button>
      </div>
    </>
  )
}

interface SessionTraceProps {
  playheadBeat: () => number
  totalBeats: () => number
  progress: () => number
  loopRange: () => PianoNightPracticeRange | null
  onSeek: (beat: number) => void
}

function SessionTrace(props: SessionTraceProps): JSX.Element {
  const loopStyle = (): JSX.CSSProperties | undefined => {
    const range = props.loopRange()
    const totalBeats = props.totalBeats()
    if (range === null || !(totalBeats > 0)) return undefined
    return {
      left: `${(range.startBeat / totalBeats) * 100}%`,
      width: `${((range.endBeat - range.startBeat) / totalBeats) * 100}%`,
    }
  }

  return (
    <div class={styles.sessionTrace}>
      <div aria-hidden="true" data-testid="piano-night-trace-rail">
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
        <Show when={loopStyle()}>
          {(style) => (
            <span
              class={styles.traceLoop}
              style={style()}
              data-testid="piano-night-loop-range"
            />
          )}
        </Show>
        <span
          class={styles.traceProgress}
          style={{ transform: `scaleX(${props.progress()})` }}
        />
        <b
          style={{
            left: `${props.progress() * 100}%`,
          }}
          data-testid="piano-night-trace-playhead"
        />
      </div>
      <input
        type="range"
        min="0"
        max={props.totalBeats()}
        step="0.25"
        value={props.playheadBeat()}
        aria-label="Seek piano project"
        aria-valuetext={`Beat ${props.playheadBeat().toFixed(1)} of ${props.totalBeats()}`}
        onInput={(event) => props.onSeek(Number(event.currentTarget.value))}
        data-testid="piano-night-seek"
      />
    </div>
  )
}

function formatClock(elapsedSeconds: number): string {
  const seconds = Math.max(0, elapsedSeconds)
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function PianoNightApp(): JSX.Element {
  const controller = usePianoNightController()
  // Owned here so the keybed and the fall stage cannot disagree about which
  // keys are on screen — the bug that put every falling note a key to the
  // left of its own key on a phone.
  const keyWindow = createPianoKeyWindowController()
  const background = useBackgroundSurfaceController('piano')
  const [view, setView] = createSignal<PianoNightPerformanceView>('fall')
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [musicNavigationLocked, setMusicNavigationLocked] = createSignal(false)
  const [drawerSection, setDrawerSection] =
    createSignal<DrawerSection>('session')
  const [lastSettingsSection, setLastSettingsSection] =
    createSignal<SettingsSection>('session')
  const [coachOpen, setCoachOpen] = createSignal(false)
  const [coachFlashing, setCoachFlashing] = createSignal(false)
  const [compactSheets, setCompactSheets] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal('')

  let stageElement: HTMLElement | undefined
  let drawerElement: HTMLElement | undefined
  let drawerCloseButton: HTMLButtonElement | undefined
  let coachElement: HTMLElement | undefined
  let coachCloseButton: HTMLButtonElement | undefined
  let compactSurfaceOpener: HTMLElement | null = null
  let announcementTimer: number | null = null

  const practiceSections = createMemo<readonly PianoNightPhrase[]>(() =>
    controller.source().hasAuthoredCoach
      ? PIANO_NIGHT_PHRASES
      : createPianoNightPracticeSections(controller.stage().totalBeats),
  )
  const phraseIndex = createMemo((): number => {
    const beat = controller.playheadBeat()
    const index = practiceSections().findIndex(
      (candidate) => beat < candidate.endBeat,
    )
    return index === -1 ? practiceSections().length - 1 : index
  })
  const phrase = createMemo<PianoNightPhrase>(
    () => practiceSections()[phraseIndex()],
  )
  const sessionProgress = createMemo(() => {
    const totalBeats = controller.stage().totalBeats
    if (!(totalBeats > 0)) return 0
    return Math.min(1, Math.max(0, controller.playheadBeat() / totalBeats))
  })
  const sessionClock = createMemo(() =>
    formatClock(
      controller.transport.playbackSecondsAtBeat(controller.playheadBeat()),
    ),
  )
  const currentTempoBpm = createMemo(() =>
    controller.transport.effectiveTempoBpmAtBeat(controller.playheadBeat()),
  )
  const practiceLoopRange = createMemo(() => controller.practiceLoop().range)
  const practiceAccuracyLabel = createMemo(() => {
    const loop = controller.practiceLoop()
    if (!loop.enabled) return 'accuracy'
    return controller.practiceRunComplete()
      ? 'final pass'
      : `pass ${loop.currentPass} accuracy`
  })
  const practiceResultLabel = createMemo(() => {
    const loop = controller.practiceLoop()
    if (!loop.enabled) return 'Result'
    return controller.practiceRunComplete()
      ? 'Final pass result'
      : `Pass ${loop.currentPass} result`
  })
  const audibleBackingTrackCount = createMemo(
    () => controller.arrangement().backingTrackIds.length,
  )
  const preservedBackingTrackCount = createMemo(() =>
    Math.max(
      0,
      controller.source().additionalTrackCount - audibleBackingTrackCount(),
    ),
  )
  const roomLabel = (): string =>
    background
      .options()
      .find((option) => option.id === background.resolved().id)?.label ??
    getBackgroundDefinition(background.resolved().id)?.label ??
    'Piano room'
  const isPlaying = (): boolean => controller.transport.phase() === 'playing'
  const isLoading = (): boolean => controller.transport.phase() === 'loading'
  const blockingModal = (): boolean => drawerOpen() && !compactSheets()
  const concertGrandSelected = (): boolean =>
    controller.instrumentPreference() !== 'fallback'
  const soundOutputLabel = (): string => {
    if (controller.soundLoadStatus() === 'ready' && concertGrandSelected()) {
      return 'Mercury Concert Grand'
    }
    return 'Mercury Felt Synth'
  }
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
    if (musicNavigationLocked() && section !== 'music') return
    setDrawerSection(section)
    if (section !== 'music') setLastSettingsSection(section)
    queueMicrotask(() => drawerElement?.scrollTo?.({ top: 0 }))
  }

  const onDrawerTabKeyDown = (
    event: KeyboardEvent,
    section: DrawerSection,
  ): void => {
    if (musicNavigationLocked()) return
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
    const sections = practiceSections()
    if (sections.length <= 1) {
      announce('This project fits in one practice section.')
      return
    }
    const next = (phraseIndex() + direction + sections.length) % sections.length
    controller.seekToBeat(sections[next].startBeat)
    announce(
      `${controller.source().hasAuthoredCoach ? 'Phrase' : 'Section'} ${
        next + 1
      }, ${sections[next].range}.`,
    )
  }

  const selectView = (next: PianoNightPerformanceView): void => {
    setView(next)
    announce(`${VIEW_LABELS[next]} view selected.`)
  }

  const practiceCurrentSection = (): void => {
    const current = phrase()
    if (
      !controller.configurePracticeLoop({
        startBeat: current.startBeat,
        endBeat: current.endBeat,
      })
    ) {
      return
    }
    announce(
      `${controller.source().hasAuthoredCoach ? 'Phrase' : 'Section'} ${phraseIndex() + 1} ready for ${controller.practiceLoop().repeatCount} passes.`,
    )
    if (compactSheets()) closeCoach()
  }

  const togglePracticeLoop = (): void => {
    const loop = controller.practiceLoop()
    if (loop.enabled) {
      controller.setPracticeLoopEnabled(false)
      announce('Repeat off. A/B markers saved.')
      return
    }
    if (loop.range !== null) {
      controller.setPracticeLoopEnabled(true)
      announce(`Repeat on for ${loop.repeatCount} passes.`)
      return
    }
    practiceCurrentSection()
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
    if (musicNavigationLocked()) return
    setDrawerOpen(false)
    if (compactSheets()) restoreCompactSurfaceFocus()
  }

  /** Mark the coach for a moment so a press on an always-visible panel lands. */
  let coachFlashTimer: ReturnType<typeof setTimeout> | undefined
  const flashCoach = (): void => {
    clearTimeout(coachFlashTimer)
    setCoachFlashing(true)
    coachFlashTimer = setTimeout(() => setCoachFlashing(false), COACH_FLASH_MS)
  }
  onCleanup(() => clearTimeout(coachFlashTimer))

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

  /** True while the drawer is showing anything other than the music panel. */
  const settingsShowing = (): boolean =>
    drawerOpen() && drawerSection() !== 'music'
  const musicShowing = (): boolean =>
    drawerOpen() && drawerSection() === 'music'

  // A rail button that opens a surface closes it too. Pressing Settings twice
  // reopening Settings is a dead end on a phone, where the rail is the only
  // chrome on screen and there is nothing else to press.
  const toggleSettings = (): void => {
    if (settingsShowing()) {
      closeDrawer()
      return
    }
    openDrawer(lastSettingsSection())
  }

  const toggleMusic = (): void => {
    if (musicShowing()) {
      closeDrawer()
      return
    }
    openDrawer('music')
  }

  const toggleCoach = (): void => {
    if (!compactSheets()) {
      // The coach is already on screen here and has no hidden state to
      // toggle, so the press moves to it and says so — without that, pressing
      // Coach on a desktop looked like a button that does nothing.
      coachElement?.focus()
      flashCoach()
      return
    }
    if (coachOpen()) {
      closeCoach()
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
        <a
          class={styles.railButton}
          href={LEGACY_PIANO_PATH}
          aria-label="Open the current Piano workspace"
        >
          <PianoWorkspace />
          <span>Current Piano</span>
        </a>

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
          <button
            class={styles.railButton}
            type="button"
            onClick={toggleMusic}
            aria-label="Choose music for Piano Night"
            aria-haspopup="dialog"
            aria-expanded={musicShowing()}
            aria-controls="piano-night-settings"
          >
            <MusicLibrary />
            <span>Music</span>
          </button>
          <button
            class={styles.railButton}
            type="button"
            onClick={toggleCoach}
            aria-controls="piano-night-coach"
          >
            <WaveformBars />
            <span>Coach</span>
          </button>
        </nav>

        <button
          class={styles.railButton}
          type="button"
          onClick={toggleSettings}
          aria-label="Open Piano Night settings"
          aria-haspopup="dialog"
          aria-expanded={settingsShowing()}
          aria-controls="piano-night-settings"
        >
          <Settings />
          <span>Settings</span>
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

        <div
          class={styles.sessionHud}
          classList={{ [styles.sessionHudCompact]: compactSheets() }}
          aria-label="Piano Night session status"
        >
          <span class={styles.sessionDocument} aria-hidden="true">
            <ScoreDocument />
          </span>
          <div class={styles.sessionPiece}>
            <strong>{controller.stage().title}</strong>
            <span>
              {phrase().range} · {roomLabel()}
            </span>
          </div>
          <div class={`${styles.sessionMetric} ${styles.timeMetric}`}>
            <strong>{sessionClock()}</strong>
            <span>{controller.transport.phase()}</span>
          </div>
          <Show when={!compactSheets()}>
            <SessionTrace
              playheadBeat={controller.playheadBeat}
              totalBeats={() => controller.stage().totalBeats}
              progress={sessionProgress}
              loopRange={practiceLoopRange}
              onSeek={controller.seekToBeat}
            />
          </Show>
          <div class={styles.sessionMetric}>
            <strong>
              {controller.scoringState().judgedNotes > 0
                ? `${controller.scoringState().accuracyPercent}%`
                : '—'}
            </strong>
            <span>{practiceAccuracyLabel()}</span>
          </div>
          <div class={`${styles.sessionMetric} ${styles.streakMetric}`}>
            <strong>
              {controller.scoringState().judgedNotes > 0
                ? controller.scoringState().combo
                : '—'}
            </strong>
            <span>streak</span>
          </div>
          <div
            class={styles.viewSelector}
            role="group"
            aria-label="Performance view"
          >
            <For each={VIEW_ORDER}>
              {(candidate) => (
                <button
                  type="button"
                  classList={{
                    [styles.viewChoiceActive]: view() === candidate,
                  }}
                  onClick={() => selectView(candidate)}
                  aria-label={`${VIEW_LABELS[candidate]} performance view`}
                  aria-pressed={view() === candidate}
                >
                  <Show when={candidate === 'fall'}>
                    <WaveformBars />
                  </Show>
                  <Show when={candidate === 'score'}>
                    <ScoreDocument />
                  </Show>
                  <Show when={candidate === 'keys'}>
                    <PianoKeys />
                  </Show>
                  <span>{VIEW_LABELS[candidate]}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        <Show when={compactSheets()}>
          <div class={styles.practiceStrip} aria-label="Practice timeline">
            <SessionTrace
              playheadBeat={controller.playheadBeat}
              totalBeats={() => controller.stage().totalBeats}
              progress={sessionProgress}
              loopRange={practiceLoopRange}
              onSeek={controller.seekToBeat}
            />
            <div class={styles.practiceStripMetric}>
              <strong>{sessionClock()}</strong>
              <span>POSITION</span>
            </div>
            <div class={styles.practiceStripMetric}>
              <strong>{Math.round(currentTempoBpm())}</strong>
              <span>LIVE BPM</span>
            </div>
            <div class={styles.practiceStripMetric}>
              <strong>{controller.practiceSpeed()}×</strong>
              <span>SPEED</span>
            </div>
          </div>
        </Show>

        <PianoNightStageViews
          view={view}
          notes={() => controller.stage().notes}
          title={() => controller.stage().title}
          totalBeats={() => controller.stage().totalBeats}
          keyLabel={() => controller.source().keyLabel}
          hasAuthoredCoach={() => controller.source().hasAuthoredCoach}
          playheadBeat={controller.playheadBeat}
          isPlaying={isPlaying}
          phrase={phrase}
          activeMidis={controller.activeMidis}
          keyWindow={keyWindow.window}
          stageMotion={controller.stageMotion}
        />

        <PianoKeyHorizon
          keyWindow={keyWindow}
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
              onClick={controller.stop}
              aria-label="Stop and reset practice"
              title="Stop and return to the practice start"
              data-testid="piano-night-stop"
            >
              <RotateCcw />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <button
              classList={{
                [styles.controlActive]: controller.practiceLoop().enabled,
              }}
              type="button"
              onClick={togglePracticeLoop}
              aria-label={
                controller.practiceLoop().enabled
                  ? 'Turn practice repeat off'
                  : controller.practiceLoop().range === null
                    ? `Practise the current ${
                        controller.source().hasAuthoredCoach
                          ? 'phrase'
                          : 'section'
                      }`
                    : 'Turn practice repeat on'
              }
              aria-pressed={controller.practiceLoop().enabled}
              data-testid="piano-night-repeat"
            >
              <Repeat />
              <Show when={controller.practiceLoop().enabled}>
                <span class={styles.repeatBadge}>
                  {controller.practiceLoop().currentPass}/
                  {controller.practiceLoop().repeatCount}
                </span>
              </Show>
            </button>
            <button
              class={styles.phraseStep}
              type="button"
              onClick={() => stepPhrase(-1)}
              aria-label={
                controller.source().hasAuthoredCoach
                  ? 'Previous practice phrase'
                  : 'Previous project section'
              }
              disabled={practiceSections().length <= 1}
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
              class={styles.phraseStep}
              type="button"
              onClick={() => stepPhrase(1)}
              aria-label={
                controller.source().hasAuthoredCoach
                  ? 'Next practice phrase'
                  : 'Next project section'
              }
              disabled={practiceSections().length <= 1}
            >
              <SkipForward />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <div class={styles.tempoReadout}>
              <strong>
                {Math.round(controller.transport.timeline.tempoBpm())}
              </strong>
              <span>BASE BPM</span>
            </div>
            <button
              class={styles.tempoStep}
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
              class={styles.tempoStep}
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
            <label class={styles.transportSpeed}>
              <span class={styles.srOnly}>Practice speed</span>
              <select
                value={controller.practiceSpeed()}
                aria-label="Practice speed"
                onChange={(event) =>
                  controller.setPracticeSpeed(Number(event.currentTarget.value))
                }
              >
                <For each={PIANO_NIGHT_PRACTICE_SPEEDS}>
                  {(speed) => <option value={speed}>{speed}×</option>}
                </For>
              </select>
            </label>
            <label
              class={styles.transportVolume}
              title={`Piano Night volume: ${Math.round(controller.masterVolume() * 100)}%`}
            >
              <Volume2 />
              <span class={styles.srOnly}>Piano Night master volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controller.masterVolume()}
                aria-label="Piano Night master volume"
                aria-valuetext={`${Math.round(controller.masterVolume() * 100)}%`}
                onInput={(event) =>
                  controller.setMasterVolume(Number(event.currentTarget.value))
                }
              />
              <output aria-hidden="true">
                {Math.round(controller.masterVolume() * 100)}%
              </output>
            </label>
          </div>
        </div>
      </main>

      <aside
        ref={coachElement}
        id="piano-night-coach"
        class={styles.coach}
        classList={{
          [styles.coachOpen]: coachOpen(),
          [styles.coachFlash]: coachFlashing(),
        }}
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
          phraseCount={() => practiceSections().length}
          hasAuthoredCoach={() => controller.source().hasAuthoredCoach}
          sourceTitle={() => controller.stage().title}
          practiceTrackLabel={() => controller.source().practiceTrackLabel}
          noteCount={() => controller.stage().notes.length}
          tempoBpm={controller.transport.timeline.tempoBpm}
          onPrevious={() => stepPhrase(-1)}
          onNext={() => stepPhrase(1)}
          onPractice={practiceCurrentSection}
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
        <button
          type="button"
          onClick={toggleMusic}
          aria-label="Choose music for Piano Night"
          aria-haspopup="dialog"
          aria-expanded={musicShowing()}
          aria-controls="piano-night-settings"
        >
          <MusicLibrary />
          <span>Music</span>
        </button>
        <button
          type="button"
          onClick={toggleCoach}
          aria-expanded={coachOpen()}
          aria-controls="piano-night-coach"
        >
          <WaveformBars />
          <span>Coach</span>
        </button>
        <button
          type="button"
          onClick={toggleSettings}
          aria-label="Open Piano Night settings"
          aria-haspopup="dialog"
          aria-expanded={settingsShowing()}
          aria-controls="piano-night-settings"
        >
          <Settings />
          <span>Settings</span>
        </button>
        {/* The way out. The side rail has carried this since the room shipped;
            on a phone that rail is gone and the bottom row is the only chrome
            there is, so without it Piano Night had no exit. */}
        <a
          href={LEGACY_PIANO_PATH}
          aria-label="Open the current Piano workspace"
        >
          <PianoWorkspace />
          <span>Studio</span>
        </a>
      </nav>

      <Show when={blockingModal()}>
        <button
          class={styles.scrim}
          type="button"
          onClick={closeDrawer}
          disabled={musicNavigationLocked()}
          aria-label="Close Piano Night controls"
        />
      </Show>
      <aside
        id="piano-night-settings"
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
            disabled={musicNavigationLocked()}
            title={
              musicNavigationLocked()
                ? 'Finish or leave track choices first'
                : undefined
            }
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
                disabled={musicNavigationLocked() && section !== 'music'}
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
            <span class={styles.drawerKicker}>
              {controller.source().provenanceLabel}
            </span>
            <h2>{controller.stage().title}</h2>
            <p>
              Fall, Score, Keys, scoring, and the transport read the same staged
              source. Selected pitched Hear tracks play as accompaniment; the
              Score track remains the one measured practice lane.
            </p>

            <section
              class={styles.practicePanel}
              aria-labelledby="piano-night-practice-heading"
            >
              <div class={styles.practicePanelHeading}>
                <div>
                  <span>Focused rehearsal</span>
                  <h3 id="piano-night-practice-heading">Practice</h3>
                </div>
                <Show
                  when={controller.practiceLoop().range}
                  fallback={<strong>Full piece</strong>}
                >
                  {(range) => (
                    <strong>
                      A {range().startBeat.toFixed(1)} · B{' '}
                      {range().endBeat.toFixed(1)}
                    </strong>
                  )}
                </Show>
              </div>

              <div class={styles.practicePrimaryActions}>
                <button
                  class={styles.actionButton}
                  type="button"
                  onClick={practiceCurrentSection}
                >
                  <Repeat />
                  Practise this{' '}
                  {controller.source().hasAuthoredCoach ? 'phrase' : 'section'}
                </button>
                <button
                  class={styles.textButton}
                  type="button"
                  disabled={controller.practiceLoop().range === null}
                  aria-pressed={controller.practiceLoop().enabled}
                  onClick={togglePracticeLoop}
                >
                  {controller.practiceLoop().enabled
                    ? 'Repeat on'
                    : 'Repeat off'}
                </button>
              </div>

              <div class={styles.loopBoundaryActions}>
                <button
                  type="button"
                  onClick={() =>
                    controller.setPracticeLoopStart(
                      controller.transport.timeline.playheadBeat(),
                    )
                  }
                >
                  Set A here
                </button>
                <button
                  type="button"
                  onClick={() =>
                    controller.setPracticeLoopEnd(
                      controller.transport.timeline.playheadBeat(),
                    )
                  }
                >
                  Set B here
                </button>
                <button
                  type="button"
                  disabled={controller.practiceLoop().range === null}
                  onClick={controller.clearPracticeLoop}
                >
                  Clear A/B
                </button>
              </div>

              <label class={styles.practiceNumberField}>
                <span>
                  Passes
                  <small>Repeat count includes the first pass.</small>
                </span>
                <input
                  type="number"
                  min="2"
                  max="100"
                  inputmode="numeric"
                  value={controller.practiceLoop().repeatCount}
                  onChange={(event) =>
                    controller.setPracticeRepeatCount(
                      Number(event.currentTarget.value),
                    )
                  }
                />
              </label>

              <fieldset
                class={styles.stageMotionGroup}
                aria-describedby="piano-night-stage-motion-note"
              >
                <legend>Stage motion</legend>
                <div>
                  <For each={PIANO_NIGHT_STAGE_MOTIONS}>
                    {(motion) => (
                      <button
                        type="button"
                        aria-pressed={controller.stageMotion() === motion}
                        classList={{
                          [styles.practiceChoiceActive]:
                            controller.stageMotion() === motion,
                        }}
                        onClick={() => {
                          controller.setStageMotion(motion)
                          announce(STAGE_MOTION_ANNOUNCEMENTS[motion])
                        }}
                      >
                        {STAGE_MOTION_LABELS[motion]}
                      </button>
                    )}
                  </For>
                </div>
                <p
                  class={styles.stageMotionNote}
                  id="piano-night-stage-motion-note"
                >
                  {controller.systemReducedMotion()
                    ? 'Your system asks for reduced motion, so the trim and panels stay still. The notes keep advancing either way — their descent is how the stage tells you when to play. Choose Stepped if you would rather they move a bar at a time.'
                    : 'Flowing scrolls the notes continuously. Stepped advances them a bar at a time instead.'}
                </p>
              </fieldset>

              <fieldset class={styles.practiceSpeedGroup}>
                <legend>Practice speed</legend>
                <div>
                  <For each={PIANO_NIGHT_PRACTICE_SPEEDS}>
                    {(speed) => (
                      <button
                        type="button"
                        aria-pressed={controller.practiceSpeed() === speed}
                        classList={{
                          [styles.practiceChoiceActive]:
                            controller.practiceSpeed() === speed,
                        }}
                        onClick={() => controller.setPracticeSpeed(speed)}
                      >
                        {speed}×
                      </button>
                    )}
                  </For>
                </div>
              </fieldset>

              <label class={styles.practiceVolume}>
                <span>
                  <Volume2 />
                  Piano volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={controller.masterVolume()}
                  aria-label="Piano volume"
                  aria-valuetext={`${Math.round(controller.masterVolume() * 100)}%`}
                  onInput={(event) =>
                    controller.setMasterVolume(
                      Number(event.currentTarget.value),
                    )
                  }
                />
                <strong aria-hidden="true">
                  {Math.round(controller.masterVolume() * 100)}%
                </strong>
              </label>
            </section>

            <h3 class={styles.drawerSubheading}>Results and project</h3>
            <dl class={styles.sessionFacts}>
              <div>
                <dt>Position</dt>
                <dd>
                  Beat {controller.playheadBeat().toFixed(1)} of{' '}
                  {controller.stage().totalBeats}
                </dd>
              </div>
              <div>
                <dt>Current tempo</dt>
                <dd>{Math.round(currentTempoBpm())} BPM</dd>
              </div>
              <Show when={controller.source().tempoMapChangeCount > 0}>
                <div>
                  <dt>Tempo map</dt>
                  <dd>
                    {controller.source().tempoMapChangeCount}{' '}
                    {controller.source().tempoMapChangeCount === 1
                      ? 'change'
                      : 'changes'}{' '}
                    · {Math.round(controller.transport.timeline.tempoBpm())} BPM
                    base
                  </dd>
                </div>
              </Show>
              <div>
                <dt>Practice track</dt>
                <dd>{controller.source().practiceTrackLabel}</dd>
              </div>
              <Show when={audibleBackingTrackCount() > 0}>
                <div>
                  <dt>Hear tracks</dt>
                  <dd>
                    {audibleBackingTrackCount()} pitched{' '}
                    {audibleBackingTrackCount() === 1 ? 'part' : 'parts'}
                  </dd>
                </div>
              </Show>
              <Show when={preservedBackingTrackCount() > 0}>
                <div>
                  <dt>Preserved tracks</dt>
                  <dd>{preservedBackingTrackCount()} not rendered yet</dd>
                </div>
              </Show>
              <div>
                <dt>{practiceResultLabel()}</dt>
                <dd>
                  {controller.scoringState().judgedNotes > 0
                    ? `${controller.scoringState().accuracyPercent}% accuracy`
                    : 'Waiting for input'}
                </dd>
              </div>
              <Show when={controller.scoringState().judgedNotes > 0}>
                <div>
                  <dt>Notes</dt>
                  <dd>
                    {controller.scoringState().hits} hit ·{' '}
                    {controller.scoringState().misses} missed
                  </dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{controller.scoringState().streak}</dd>
                </div>
              </Show>
              <div>
                <dt>Input</dt>
                <dd>{midiLabel()}</dd>
              </div>
              <div>
                <dt>Sound</dt>
                <dd>
                  {soundOutputLabel()} ·{' '}
                  {audibleBackingTrackCount() > 0 ? 'Score + Hear' : 'Score'}
                </dd>
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

            <h3 class={styles.drawerSubheading}>Input</h3>
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
          </section>
        </Show>

        <Show when={drawerOpen() && drawerSection() === 'music'}>
          <Suspense
            fallback={
              <section
                id="piano-night-panel-music"
                class={styles.drawerPanel}
                role="tabpanel"
                aria-labelledby="piano-night-tab-music"
                aria-busy="true"
              >
                <span class={styles.drawerKicker}>Music on this device</span>
                <h2>Opening your music…</h2>
                <p>Afterglow Study remains ready while the library loads.</p>
              </section>
            }
          >
            <PianoNightMusicPanel
              panelClass={styles.drawerPanel}
              currentSourceId={() => controller.source().id}
              legacyPianoPath={LEGACY_PIANO_PATH}
              onNavigationLockChange={setMusicNavigationLocked}
              onSelect={(source) => {
                const selected = controller.replaceSource(source)
                if (!selected) return false
                announce(`${source.stage.title} is on stage.`)
                setMusicNavigationLocked(false)
                closeDrawer()
                return true
              }}
            />
          </Suspense>
        </Show>

        <Show when={drawerSection() === 'sound'}>
          <PianoNightSoundPanel controller={controller} />
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
