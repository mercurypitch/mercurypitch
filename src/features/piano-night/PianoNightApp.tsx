// Piano Night presents the app-store-free Performance Horizon pilot shell.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { ChevronLeft, Headphones, Metronome, MusicBoard, Pause, PianoKeys, Play, Settings, SkipBack, SkipForward, SlidersHorizontal, WaveformBars, X, } from '@/components/icons'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './PianoNightApp.module.css'
import { LEGACY_PIANO_PATH } from './route'

type PerformanceView = 'fall' | 'score' | 'keys'
type DrawerSection = 'session' | 'sound' | 'room'

interface PhrasePreview {
  range: string
  guidance: string
  focus: string
}

interface KeyboardKey {
  midi: number
  left?: string
  tone?: 'cyan' | 'coral'
}

const VIEW_ORDER: readonly PerformanceView[] = ['fall', 'score', 'keys']
const VIEW_LABELS: Record<PerformanceView, string> = {
  fall: 'Fall',
  score: 'Score',
  keys: 'Keys',
}

const PHRASES: readonly PhrasePreview[] = [
  {
    range: 'bars 1–8',
    guidance: 'Settle into the room before the melody enters.',
    focus: 'Left-hand pulse',
  },
  {
    range: 'bars 9–16',
    guidance: 'Keep the inner voice close to the keys.',
    focus: 'Quiet inner voice',
  },
  {
    range: 'bars 17–24',
    guidance: 'Shape the swell into the cadence.',
    focus: 'Right-hand melody',
  },
  {
    range: 'bars 25–32',
    guidance: 'Let the final bass note release the room.',
    focus: 'Pedal release',
  },
]

const FALL_NOTES = [
  { hand: 'left', x: 26, y: -8, height: 128, delay: -1.8 },
  { hand: 'left', x: 31, y: 20, height: 88, delay: -0.4 },
  { hand: 'left', x: 37, y: 42, height: 172, delay: -2.7 },
  { hand: 'left', x: 43, y: 12, height: 104, delay: -1.1 },
  { hand: 'left', x: 49, y: 54, height: 138, delay: -3.4 },
  { hand: 'right', x: 60, y: 18, height: 128, delay: -0.8 },
  { hand: 'right', x: 66, y: 44, height: 150, delay: -2.4 },
  { hand: 'right', x: 72, y: 7, height: 108, delay: -1.5 },
  { hand: 'right', x: 77, y: 58, height: 98, delay: -3.1 },
] as const

const CYAN_KEYS = new Set([48, 53, 57, 62])
const CORAL_KEYS = new Set([65, 69])
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

function buildKeyboard(): {
  white: readonly KeyboardKey[]
  black: readonly KeyboardKey[]
} {
  const white: KeyboardKey[] = []
  const black: KeyboardKey[] = []
  let whiteCount = 0

  for (let midi = 21; midi <= 108; midi += 1) {
    if (BLACK_PITCH_CLASSES.has(midi % 12)) {
      black.push({ midi, left: `${(whiteCount / 52) * 100}%` })
      continue
    }

    white.push({
      midi,
      tone: CYAN_KEYS.has(midi)
        ? 'cyan'
        : CORAL_KEYS.has(midi)
          ? 'coral'
          : undefined,
    })
    whiteCount += 1
  }

  return { white, black }
}

const KEYBOARD = buildKeyboard()

function ChevronRightIcon(): JSX.Element {
  return <ChevronLeft />
}

interface PhraseCoachProps {
  phraseIndex: () => number
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
  closeButtonRef: (element: HTMLButtonElement) => void
}

function PhraseCoach(props: PhraseCoachProps): JSX.Element {
  const phrase = () => PHRASES[props.phraseIndex()]

  return (
    <>
      <div class={styles.coachTopline}>
        <button
          type="button"
          onClick={() => props.onPrevious()}
          aria-label="Previous illustrative phrase"
        >
          <ChevronLeft />
        </button>
        <div>
          <strong>
            Phrase {props.phraseIndex() + 1} of {PHRASES.length}
          </strong>
          <span>{phrase().range}</span>
        </div>
        <button
          type="button"
          onClick={() => props.onNext()}
          aria-label="Next illustrative phrase"
        >
          <span class={styles.chevronRight}>
            <ChevronRightIcon />
          </span>
        </button>
        <button
          ref={props.closeButtonRef}
          class={styles.coachClose}
          type="button"
          onClick={() => props.onClose()}
          aria-label="Close phrase coach"
        >
          <X />
        </button>
      </div>

      <div class={styles.coachBody}>
        <span class={styles.previewLabel}>Illustrative coach</span>
        <p class={styles.coachGuidance}>{phrase().guidance}</p>

        <section class={styles.coachSection}>
          <h2>Focus</h2>
          <p class={styles.focusLine}>
            <i aria-hidden="true" />
            {phrase().focus}
          </p>
          <svg
            class={styles.miniStaff}
            viewBox="0 0 210 66"
            role="img"
            aria-label="Illustrative focus notation"
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
          <h2>Dynamics</h2>
          <div class={styles.dynamics} aria-label="Illustrative crescendo">
            <i>mp</i>
            <svg viewBox="0 0 160 38" aria-hidden="true">
              <path d="M2 30c47 0 65-20 104-20 24 0 37-5 52-7" />
            </svg>
            <i>mf</i>
          </div>
        </section>

        <section class={styles.coachSection}>
          <h2>Pedal</h2>
          <div class={styles.pedal} aria-label="Illustrative sustain range">
            <i aria-hidden="true" />
            <span />
            <i aria-hidden="true" />
          </div>
        </section>
      </div>
    </>
  )
}

export function PianoNightApp(): JSX.Element {
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [tempo, setTempo] = createSignal(76)
  const [view, setView] = createSignal<PerformanceView>('fall')
  const [phraseIndex, setPhraseIndex] = createSignal(2)
  const [metronomeOn, setMetronomeOn] = createSignal(false)
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [drawerSection, setDrawerSection] =
    createSignal<DrawerSection>('session')
  const [coachOpen, setCoachOpen] = createSignal(false)
  const [compactCoach, setCompactCoach] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal(
    'Piano Night visual preview ready.',
  )

  let stage: HTMLElement | undefined
  let drawer: HTMLElement | undefined
  let drawerCloseButton: HTMLButtonElement | undefined
  let coach: HTMLElement | undefined
  let coachCloseButton: HTMLButtonElement | undefined

  const modalOpen = (): boolean =>
    drawerOpen() || (compactCoach() && coachOpen())

  const announce = (message: string): void => {
    setAnnouncement(message)
  }

  const togglePreview = (): void => {
    setIsPlaying((current) => {
      const next = !current
      announce(
        next
          ? 'Visual note preview started. No audio is playing.'
          : 'Visual note preview paused.',
      )
      return next
    })
  }

  const stepPhrase = (direction: -1 | 1): void => {
    setPhraseIndex((current) => {
      const next = (current + direction + PHRASES.length) % PHRASES.length
      announce(`Illustrative phrase ${next + 1}, ${PHRASES[next].range}.`)
      return next
    })
  }

  const cycleView = (): void => {
    setView((current) => {
      const currentIndex = VIEW_ORDER.indexOf(current)
      const next = VIEW_ORDER[(currentIndex + 1) % VIEW_ORDER.length]
      announce(`${VIEW_LABELS[next]} preview selected.`)
      return next
    })
  }

  const changeTempo = (delta: number): void => {
    setTempo((current) => {
      const next = Math.max(40, Math.min(160, current + delta))
      announce(`Preview tempo set to ${next} BPM.`)
      return next
    })
  }

  const openDrawer = (section: DrawerSection): void => {
    setCoachOpen(false)
    setDrawerSection(section)
    setDrawerOpen(true)
  }

  const openCoach = (): void => {
    if (!compactCoach()) {
      coach?.focus()
      return
    }
    setDrawerOpen(false)
    setCoachOpen(true)
  }

  useFocusTrap(() => drawer, {
    isOpen: drawerOpen,
    onClose: () => setDrawerOpen(false),
    initialFocus: () => drawerCloseButton,
  })
  useFocusTrap(() => coach, {
    isOpen: () => compactCoach() && coachOpen(),
    onClose: () => setCoachOpen(false),
    initialFocus: () => coachCloseButton,
  })

  onMount(() => {
    const uninstallSpace = installSpacePlaybackToggle({ toggle: togglePreview })
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 1180px)')
        : null
    const updateCompactCoach = (): void => {
      setCompactCoach(media?.matches ?? false)
      if (media?.matches !== true) setCoachOpen(false)
    }
    updateCompactCoach()
    media?.addEventListener?.('change', updateCompactCoach)

    onCleanup(() => {
      uninstallSpace()
      media?.removeEventListener?.('change', updateCompactCoach)
    })
  })

  return (
    <div
      class={styles.shell}
      classList={{ [styles.playing]: isPlaying() }}
      data-view={view()}
      data-testid="piano-night-shell"
    >
      <a class={styles.skipLink} href="#piano-night-stage" inert={modalOpen()}>
        Skip to piano stage
      </a>

      <aside
        class={styles.rail}
        aria-label="Piano Night navigation"
        inert={modalOpen()}
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
            onClick={() => stage?.focus()}
            aria-current="page"
          >
            <PianoKeys />
            <span>Stage</span>
          </button>
          <button
            class={styles.railButton}
            type="button"
            onClick={openCoach}
            aria-expanded={compactCoach() ? coachOpen() : undefined}
          >
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
        ref={stage}
        id="piano-night-stage"
        class={styles.stage}
        tabindex="-1"
        aria-label="Piano Night illustrative performance stage"
        data-testid="piano-night-stage"
        inert={modalOpen()}
      >
        <div class={styles.roomPlate} aria-hidden="true" />
        <div class={styles.roomGrade} aria-hidden="true" />

        <div class={styles.sessionHud} aria-label="Piano Night preview status">
          <button
            class={styles.sessionDocument}
            type="button"
            onClick={() => openDrawer('session')}
            aria-label="Open session controls"
          >
            <MusicBoard />
          </button>
          <div class={styles.sessionPiece}>
            <strong>Piano Night Preview</strong>
            <span>No project loaded · Nocturne Studio</span>
          </div>
          <div class={`${styles.sessionMetric} ${styles.timeMetric}`}>
            <strong>00:00</strong>
            <span>visual preview</span>
          </div>
          <div class={styles.sessionTrace} aria-hidden="true">
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
          <div class={styles.sessionMetric}>
            <strong>{tempo()}</strong>
            <span>BPM</span>
          </div>
          <div class={styles.inputState}>
            <i aria-hidden="true" />
            <span>Input off</span>
          </div>
          <button
            class={styles.viewButton}
            type="button"
            onClick={cycleView}
            aria-label={`Change performance preview. Current view: ${VIEW_LABELS[view()]}`}
          >
            <span>{VIEW_LABELS[view()]}</span>
            <PianoKeys />
          </button>
        </div>

        <Show when={view() === 'fall'}>
          <section
            class={styles.fallStage}
            aria-label="Illustrative falling-note preview"
            data-testid="piano-night-fall-view"
          >
            <div class={styles.laneGuides} aria-hidden="true">
              <For each={Array.from({ length: 12 })}>{() => <i />}</For>
            </div>
            <For each={FALL_NOTES}>
              {(note) => (
                <i
                  classList={{
                    [styles.fallNote]: true,
                    [styles.leftNote]: note.hand === 'left',
                    [styles.rightNote]: note.hand === 'right',
                  }}
                  style={{
                    left: `${note.x}%`,
                    top: `${note.y}%`,
                    height: `${note.height}px`,
                    'animation-delay': `${note.delay}s`,
                  }}
                  aria-hidden="true"
                />
              )}
            </For>
            <span class={styles.syntheticLabel}>Illustrative performance</span>
          </section>
        </Show>

        <Show when={view() === 'score'}>
          <section
            class={styles.scoreStage}
            aria-label="Illustrative score preview"
            data-testid="piano-night-score-view"
          >
            <div class={styles.scorePaper}>
              <div class={styles.scoreHeading}>
                <span>Piano Night Preview</span>
                <small>
                  Phrase {phraseIndex() + 1} · {PHRASES[phraseIndex()].range}
                </small>
              </div>
              <svg
                viewBox="0 0 760 320"
                role="img"
                aria-label="Illustrative grand staff notation"
              >
                <g class={styles.scoreLines}>
                  <path d="M52 82h656M52 95h656M52 108h656M52 121h656M52 134h656M52 206h656M52 219h656M52 232h656M52 245h656M52 258h656" />
                  <path d="M224 76v188M390 76v188M556 76v188M708 76v188" />
                </g>
                <g class={styles.scoreClefs}>
                  <text x="64" y="132">
                    𝄞
                  </text>
                  <text x="64" y="256">
                    𝄢
                  </text>
                </g>
                <g class={styles.scoreNotes}>
                  <ellipse cx="148" cy="121" rx="8" ry="6" />
                  <path d="M155 120v-38" />
                  <ellipse cx="184" cy="108" rx="8" ry="6" />
                  <path d="M191 107v-38" />
                  <ellipse cx="274" cy="116" rx="8" ry="6" />
                  <path d="M281 115v-38" />
                  <ellipse cx="332" cy="101" rx="8" ry="6" />
                  <path d="M339 100v-38" />
                  <ellipse cx="440" cy="110" rx="8" ry="6" />
                  <path d="M447 109v-38" />
                  <ellipse cx="492" cy="95" rx="8" ry="6" />
                  <path d="M499 94v-38" />
                  <ellipse cx="608" cy="121" rx="8" ry="6" />
                  <path d="M615 120v-38" />
                  <ellipse cx="148" cy="232" rx="9" ry="7" />
                  <ellipse cx="274" cy="245" rx="9" ry="7" />
                  <ellipse cx="440" cy="226" rx="9" ry="7" />
                  <ellipse cx="608" cy="245" rx="9" ry="7" />
                </g>
              </svg>
              <div class={styles.scoreLegend}>
                <span>D minor</span>
                <span>{tempo()} BPM</span>
                <span>Illustrative notation</span>
              </div>
            </div>
          </section>
        </Show>

        <Show when={view() === 'keys'}>
          <section
            class={styles.keysStage}
            aria-label="Illustrative voicing preview"
            data-testid="piano-night-keys-view"
          >
            <div class={styles.voicingCard}>
              <span>Illustrative voicing</span>
              <h1>D minor over A</h1>
              <p>Let the ninth arrive after the bass settles.</p>
              <div>
                <For each={['A2', 'C3', 'D3', 'F3', 'E4', 'A4']}>
                  {(note) => <i>{note}</i>}
                </For>
              </div>
            </div>
          </section>
        </Show>

        <button
          class={styles.coachPeek}
          type="button"
          onClick={openCoach}
          aria-expanded={coachOpen()}
        >
          <WaveformBars />
          <span>Phrase {phraseIndex() + 1}</span>
        </button>

        <div class={styles.keybed}>
          <div class={styles.feltLine} aria-hidden="true" />
          <div
            class={styles.keyboard}
            role="img"
            aria-label="Illustrative 88-key piano keyboard. Touch and MIDI input are not connected in this pilot."
            data-testid="piano-night-keyboard"
          >
            <div class={styles.whiteKeys} aria-hidden="true">
              <For each={KEYBOARD.white}>
                {(key) => <i data-tone={key.tone} />}
              </For>
            </div>
            <div class={styles.blackKeys} aria-hidden="true">
              <For each={KEYBOARD.black}>
                {(key) => <i style={{ left: key.left }} />}
              </For>
            </div>
          </div>
        </div>

        <div class={styles.fallboard}>
          <div class={styles.transport} aria-label="Visual preview transport">
            <button
              type="button"
              onClick={() => openDrawer('session')}
              aria-label="Open session controls"
            >
              <SlidersHorizontal />
            </button>
            <button
              type="button"
              classList={{ [styles.controlActive]: metronomeOn() }}
              onClick={() => {
                setMetronomeOn((current) => !current)
                announce(`Visual metronome ${metronomeOn() ? 'on' : 'off'}.`)
              }}
              aria-pressed={metronomeOn()}
              aria-label="Toggle visual metronome"
            >
              <Metronome />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <button
              type="button"
              onClick={() => stepPhrase(-1)}
              aria-label="Previous illustrative phrase"
            >
              <SkipBack />
            </button>
            <button
              class={styles.playButton}
              type="button"
              onClick={togglePreview}
              aria-label={`${isPlaying() ? 'Pause' : 'Play'} visual note preview`}
              aria-pressed={isPlaying()}
              data-testid="piano-night-play"
            >
              <Show when={isPlaying()} fallback={<Play />}>
                <Pause />
              </Show>
            </button>
            <button
              type="button"
              onClick={() => stepPhrase(1)}
              aria-label="Next illustrative phrase"
            >
              <SkipForward />
            </button>
            <i class={styles.transportDivider} aria-hidden="true" />
            <div class={styles.tempoReadout}>
              <strong>{tempo()}</strong>
              <span>BPM</span>
            </div>
            <button
              type="button"
              onClick={() => changeTempo(-2)}
              aria-label="Decrease preview tempo"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => changeTempo(2)}
              aria-label="Increase preview tempo"
            >
              +
            </button>
          </div>
        </div>
      </main>

      <Show when={compactCoach() && coachOpen()}>
        <button
          class={styles.coachScrim}
          type="button"
          onClick={() => setCoachOpen(false)}
          aria-label="Close phrase coach"
        />
      </Show>
      <aside
        ref={coach}
        class={styles.coach}
        classList={{ [styles.coachOpen]: coachOpen() }}
        role={compactCoach() ? 'dialog' : undefined}
        aria-modal={compactCoach() ? 'true' : undefined}
        aria-label="Illustrative phrase coach"
        aria-hidden={compactCoach() ? !coachOpen() : undefined}
        inert={compactCoach() && !coachOpen()}
        tabindex="-1"
      >
        <PhraseCoach
          phraseIndex={phraseIndex}
          onPrevious={() => stepPhrase(-1)}
          onNext={() => stepPhrase(1)}
          onClose={() => setCoachOpen(false)}
          closeButtonRef={(element) => {
            coachCloseButton = element
          }}
        />
      </aside>

      <nav
        class={styles.mobileNav}
        aria-label="Piano Night mobile navigation"
        inert={modalOpen()}
      >
        <button
          class={styles.mobileActive}
          type="button"
          onClick={() => stage?.focus()}
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

      <Show when={drawerOpen()}>
        <button
          class={styles.scrim}
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close Piano Night controls"
        />
      </Show>
      <aside
        ref={drawer}
        class={styles.drawer}
        classList={{ [styles.drawerOpen]: drawerOpen() }}
        role="dialog"
        aria-modal="true"
        aria-label="Piano Night controls"
        aria-hidden={!drawerOpen()}
        inert={!drawerOpen()}
        tabindex="-1"
      >
        <div class={styles.drawerTopline}>
          <div>
            <span>Performance Horizon</span>
            <strong>Piano Night pilot</strong>
          </div>
          <button
            ref={drawerCloseButton}
            type="button"
            onClick={() => setDrawerOpen(false)}
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
          <For each={['session', 'sound', 'room'] as const}>
            {(section) => (
              <button
                type="button"
                role="tab"
                classList={{
                  [styles.drawerTabActive]: drawerSection() === section,
                }}
                aria-selected={drawerSection() === section}
                onClick={() => setDrawerSection(section)}
              >
                {section[0].toUpperCase() + section.slice(1)}
              </button>
            )}
          </For>
        </div>

        <Show when={drawerSection() === 'session'}>
          <section class={styles.drawerPanel}>
            <span class={styles.drawerKicker}>Empty session</span>
            <h2>Bring the proven Piano runtime in next.</h2>
            <p>
              This first slice validates the room, responsive composition, and
              reusable transport boundary. It does not start audio or request
              microphone or MIDI access.
            </p>
            <dl class={styles.sessionFacts}>
              <div>
                <dt>Project</dt>
                <dd>None loaded</dd>
              </div>
              <div>
                <dt>Input</dt>
                <dd>Off</dd>
              </div>
              <div>
                <dt>Sound</dt>
                <dd>Visual preview only</dd>
              </div>
            </dl>
            <a class={styles.legacyLink} href={LEGACY_PIANO_PATH}>
              <PianoKeys />
              <span>
                <strong>Open the current Piano tab</strong>
                <small>Use today’s MIDI, mic, songs, and scoring.</small>
              </span>
            </a>
          </section>
        </Show>

        <Show when={drawerSection() === 'sound'}>
          <section class={styles.drawerPanel}>
            <span class={styles.drawerKicker}>Next runtime slice</span>
            <h2>One instrument rack, built for real libraries.</h2>
            <p>
              Felt grand, electric piano, user soundbanks, bass, and drummer
              companions will attach to the shared transport after import and
              licensing rules are defined.
            </p>
            <button class={styles.previewRow} type="button" disabled>
              <span>
                <strong>Felt Grand</strong>
                <small>Sampled piano slot</small>
              </span>
              <i>Planned</i>
            </button>
            <button class={styles.previewRow} type="button" disabled>
              <span>
                <strong>Load your soundbank</strong>
                <small>Local-first import</small>
              </span>
              <i>Planned</i>
            </button>
          </section>
        </Show>

        <Show when={drawerSection() === 'room'}>
          <section class={styles.drawerPanel}>
            <span class={styles.drawerKicker}>Free pilot room</span>
            <h2>Nocturne Studio</h2>
            <p>
              The midnight recording room is the provisional first backdrop.
              Room selection and premium entitlements are intentionally not
              implied by this preview.
            </p>
            <div
              class={styles.roomSwatch}
              aria-label="Nocturne Studio selected"
            >
              <span />
              <div>
                <strong>Nocturne Studio</strong>
                <small>Selected for pilot</small>
              </div>
              <i>Free</i>
            </div>
          </section>
        </Show>
      </aside>

      <p class={styles.srOnly} role="status" aria-live="polite">
        {announcement()}
      </p>
    </div>
  )
}
