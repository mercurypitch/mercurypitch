// ============================================================
// Drum Night — silent-first Pocket Console percussion room
// ============================================================
//
// This standalone surface preserves articulation, timing, and velocity as the
// product language while its real input and sound ports are still being built.
// First paint is deliberately visual-only: no audio graph, MIDI permission,
// microphone capture, worker, or model is created by this component.

import type { JSX } from 'solid-js'
import { createSignal, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { AudioWave, ChevronDown, Drum, Loop, MercuryPlanet, Metronome, MidiDin, Minus, MusicLibrary, MusicNote, Pause, Play, Plus, Repeat, SlidersHorizontal, WaveformBars, X, } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './DrumNightApp.module.css'

type StageView = 'pocket' | 'score' | 'kit'
type Workspace = 'groove' | 'kit' | 'mix' | 'room' | 'learn' | 'songs' | 'coach'
type PadId = 'hi-hat' | 'snare' | 'kick' | 'tom' | 'ride' | 'crash'

interface PadMeta {
  id: PadId
  shortLabel: string
  label: string
  key: string
  velocity: number
}

const STAGE_VIEWS: readonly StageView[] = ['pocket', 'score', 'kit']
const WORKBENCH_TABS: readonly Workspace[] = ['groove', 'kit', 'mix', 'room']
const PAD_META: readonly PadMeta[] = [
  {
    id: 'hi-hat',
    shortLabel: 'HH',
    label: 'Closed hi-hat',
    key: '1',
    velocity: 74,
  },
  { id: 'snare', shortLabel: 'SN', label: 'Snare', key: '2', velocity: 91 },
  { id: 'kick', shortLabel: 'KICK', label: 'Kick', key: '3', velocity: 86 },
  { id: 'tom', shortLabel: 'TOM', label: 'Mid tom', key: '4', velocity: 78 },
  { id: 'ride', shortLabel: 'RIDE', label: 'Ride', key: '5', velocity: 69 },
  { id: 'crash', shortLabel: 'CR', label: 'Crash', key: '6', velocity: 96 },
]
const WORKSPACE_TITLES: Record<Workspace, string> = {
  groove: 'Shape the groove',
  kit: 'Choose the kit',
  mix: 'Balance the room',
  room: 'Choose the room',
  learn: 'Build the first pocket',
  songs: 'Bring a drum part',
  coach: 'Recover the backbeat',
}

const RING_EVENTS = [
  ['eventHat', 'translate(155 322) rotate(-58)', '-0.1s', 6, 26],
  ['eventHat', 'translate(208 232) rotate(-38)', '-0.4s', 6, 20],
  ['eventSnare', 'translate(309 171) rotate(-19)', '-0.8s', 10, 34],
  ['eventHat', 'translate(406 132) rotate(-9)', '-1.2s', 6, 20],
  ['eventKick', 'translate(500 118)', '-1.6s', 10, 44],
  ['eventHat', 'translate(592 132) rotate(9)', '-2s', 6, 20],
  ['eventTom', 'translate(688 169) rotate(18)', '-2.4s', 10, 34],
  ['eventHat', 'translate(778 224) rotate(36)', '-2.8s', 6, 20],
  ['eventRide', 'translate(840 314) rotate(58)', '-3.2s', 8, 28],
  ['eventCrash', 'translate(866 398) rotate(72)', '-3.6s', 10, 40],
  ['eventHat', 'translate(258 377) rotate(-58)', '-0.5s', 6, 20],
  ['eventSnare', 'translate(371 321) rotate(-25)', '-1.3s', 10, 34],
  ['eventKick', 'translate(500 302)', '-2.1s', 10, 44],
  ['eventHat', 'translate(626 325) rotate(25)', '-2.9s', 6, 20],
  ['eventSnare', 'translate(742 377) rotate(58)', '-3.7s', 10, 34],
] as const

const cx = (...names: Array<keyof typeof styles | false | undefined>): string =>
  names
    .filter(
      (name): name is keyof typeof styles =>
        name !== false && name !== undefined,
    )
    .map((name) => styles[name])
    .join(' ')

function PocketRing(): JSX.Element {
  return (
    <div class={styles.pocketView} data-testid="drum-night-pocket-view">
      <svg
        class={styles.pocketRing}
        viewBox="0 0 1000 620"
        role="img"
        aria-labelledby="drum-pocket-title drum-pocket-description"
      >
        <title id="drum-pocket-title">Pocket Ring for bar nine</title>
        <desc id="drum-pocket-description">
          A synthetic one-bar preview with kit events approaching a shared
          strike horizon.
        </desc>
        <defs>
          <linearGradient id="drum-arc-fade" x1="0" x2="1">
            <stop offset="0" stop-color="#aab3b8" stop-opacity="0" />
            <stop offset="0.18" stop-color="#aab3b8" stop-opacity=".48" />
            <stop offset=".82" stop-color="#aab3b8" stop-opacity=".48" />
            <stop offset="1" stop-color="#aab3b8" stop-opacity="0" />
          </linearGradient>
          <filter
            id="drum-event-soft"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g class={styles.ringGeometry} aria-hidden="true">
          <ellipse cx="500" cy="342" rx="416" ry="236" />
          <ellipse cx="500" cy="342" rx="370" ry="205" />
          <ellipse cx="500" cy="342" rx="322" ry="175" />
          <ellipse cx="500" cy="342" rx="274" ry="144" />
          <path class={styles.subdivision} d="M100 342h800" />
          <path class={styles.strikeArc} d="M174 430Q500 578 826 430" />
          <path class={styles.scanArc} d="M94 342A406 226 0 0 1 906 342" />
        </g>

        <g class={styles.kitAnchors} aria-hidden="true">
          <g transform="translate(178 290)">
            <circle r="5" />
            <text y="-16">HI-HAT</text>
          </g>
          <g transform="translate(350 206)">
            <circle r="5" />
            <text y="-16">SNARE</text>
          </g>
          <g transform="translate(500 170)">
            <circle r="5" />
            <text y="-16">KICK</text>
          </g>
          <g transform="translate(638 214)">
            <circle r="5" />
            <text y="-16">TOMS</text>
          </g>
          <g transform="translate(790 294)">
            <circle r="5" />
            <text y="-16">RIDE</text>
          </g>
          <g transform="translate(866 398)">
            <circle r="5" />
            <text x="-18" y="-18">
              CRASH
            </text>
          </g>
        </g>

        <g class={styles.ringEvents} aria-hidden="true">
          <For each={RING_EVENTS}>
            {(event) => (
              <g
                class={cx('event', event[0])}
                style={{ '--event-delay': event[2] } as JSX.CSSProperties}
                transform={event[1]}
              >
                <rect
                  x={-event[3] / 2}
                  y={-event[4] / 2}
                  width={event[3]}
                  height={event[4]}
                  rx={event[3] / 2}
                />
              </g>
            )}
          </For>
        </g>

        <g class={styles.evidenceEcho} aria-hidden="true">
          <circle class={styles.early} cx="375" cy="498" r="6" />
          <circle class={styles.centred} cx="498" cy="527" r="7" />
          <circle class={styles.late} cx="650" cy="493" r="6" />
          <text x="340" y="548">
            EARLY
          </text>
          <text x="482" y="568">
            ON
          </text>
          <text x="642" y="542">
            LATE
          </text>
        </g>
      </svg>

      <div class={styles.nowCapsule} aria-live="polite">
        <span class={styles.nowPulse} aria-hidden="true" />
        <span>
          <small>Next</small>
          <strong>Snare</strong>
        </span>
        <b>2</b>
      </div>
      <div class={styles.syntheticLabel}>Synthetic performance preview</div>
    </div>
  )
}

function ScoreView(): JSX.Element {
  const noteXs = [92, 156, 270, 334, 448, 512, 626, 690]
  return (
    <div class={styles.scoreView} data-testid="drum-night-score-view">
      <div
        class={styles.scorePanel}
        aria-label="Synthetic percussion score for bars nine through twelve"
      >
        <div class={styles.scoreHeading}>
          <span>Midnight Pocket</span>
          <small>bars 9–12</small>
        </div>
        <svg
          viewBox="0 0 820 330"
          role="img"
          aria-label="Illustrative percussion notation"
        >
          <g class={styles.staffLines}>
            <path d="M54 90h714M54 112h714M54 134h714M54 156h714M54 178h714" />
            <path d="M232 82v104M410 82v104M588 82v104M768 82v104" />
          </g>
          <g class={styles.scoreNotes}>
            <For each={noteXs}>
              {(x, index) => (
                <>
                  <path d={`m${x} 80 10 10m0-10-10 10m5 0v50`} />
                  <ellipse
                    cx={x + 32}
                    cy={index() % 2 === 0 ? 156 : 134}
                    rx="8"
                    ry="6"
                  />
                  <path d={`M${x + 40} ${index() % 2 === 0 ? 154 : 132}v-48`} />
                </>
              )}
            </For>
          </g>
          <g class={styles.scoreAccents}>
            <path d="m178 66 12-7 12 7M356 66l12-7 12 7M534 66l12-7 12 7M712 66l12-7 12 7" />
          </g>
          <path class={styles.scorePlayhead} d="M420 58v148" />
          <text class={styles.scoreCopy} x="74" y="238">
            Kick and snare anchor the pocket. Hi-hat opens on the final eighth.
          </text>
          <text class={styles.scoreMuted} x="74" y="270">
            Authored preview · GM articulations · no sticking inferred
          </text>
        </svg>
      </div>
    </div>
  )
}

interface KitViewProps {
  activeHit: () => PadId | null
  onHit: (pad: PadId) => void
}

function KitView(props: KitViewProps): JSX.Element {
  return (
    <div class={styles.kitView} data-testid="drum-night-kit-view">
      <div class={styles.kitIntro}>
        <span>Playable preview</span>
        <h2>Strike the room.</h2>
        <p>
          Use the pads or keys 1–6. This preview visualises hits and does not
          load a soundbank.
        </p>
      </div>
      <div class={styles.kitHotspots} aria-label="Playable drum-kit preview">
        <For each={PAD_META}>
          {(pad) => (
            <button
              class={cx(
                'kitHotspot',
                `hotspot${pad.id === 'hi-hat' ? 'Hat' : pad.id[0].toUpperCase() + pad.id.slice(1)}` as keyof typeof styles,
                props.activeHit() === pad.id && 'isHit',
              )}
              type="button"
              onPointerDown={() => props.onHit(pad.id)}
              aria-label={`${pad.label}, key ${pad.key}`}
            >
              <span>{pad.label}</span>
              <kbd>{pad.key}</kbd>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

export function DrumNightApp(): JSX.Element {
  const [view, setView] = createSignal<StageView>('pocket')
  const [workspace, setWorkspace] = createSignal<Workspace>('groove')
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [inputOpen, setInputOpen] = createSignal(false)
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [tempo, setTempo] = createSignal(96)
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [countInEnabled, setCountInEnabled] = createSignal(true)
  const [activeHit, setActiveHit] = createSignal<PadId | null>(null)
  const [lastHit, setLastHit] = createSignal('Snare · 91')
  const [liveMessage, setLiveMessage] = createSignal(
    'Synthetic preview ready. Audio and input are off.',
  )
  const [toastVisible, setToastVisible] = createSignal(false)
  const [variation, setVariation] = createSignal('Source')
  let drawerRef: HTMLElement | undefined
  let inputRef: HTMLDivElement | undefined
  let inputButtonRef: HTMLButtonElement | undefined
  let toastTimer: number | undefined
  let hitTimer: number | undefined

  const updateUrl = (
    nextView: StageView,
    nextDrawer: Workspace | null,
  ): void => {
    const url = new URL(window.location.href)
    if (nextView === 'pocket') url.searchParams.delete('view')
    else url.searchParams.set('view', nextView)
    if (nextDrawer === null) url.searchParams.delete('drawer')
    else url.searchParams.set('drawer', nextDrawer)
    window.history.replaceState({}, '', url)
  }

  const showToast = (message: string): void => {
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    setLiveMessage(message)
    setToastVisible(true)
    toastTimer = window.setTimeout(() => setToastVisible(false), 2600)
  }

  const selectView = (nextView: StageView): void => {
    setView(nextView)
    updateUrl(nextView, drawerOpen() ? workspace() : null)
  }

  const openWorkspace = (nextWorkspace: Workspace): void => {
    setInputOpen(false)
    setWorkspace(nextWorkspace)
    setDrawerOpen(true)
    updateUrl(view(), nextWorkspace)
  }

  const closeWorkspace = (): void => {
    setDrawerOpen(false)
    updateUrl(view(), null)
  }

  const togglePlaying = (): void => {
    const nextPlaying = !isPlaying()
    setIsPlaying(nextPlaying)
    showToast(
      nextPlaying
        ? 'Visual count-in started. This preview does not load a soundbank.'
        : 'Visual playback paused.',
    )
  }

  const changeTempo = (delta: number): void => {
    const nextTempo = Math.max(40, Math.min(240, tempo() + delta))
    setTempo(nextTempo)
    showToast(`Tempo set to ${nextTempo} BPM.`)
  }

  const triggerPad = (padId: PadId): void => {
    const pad = PAD_META.find((candidate) => candidate.id === padId)
    if (pad === undefined) return
    if (hitTimer !== undefined) window.clearTimeout(hitTimer)
    setActiveHit(null)
    window.requestAnimationFrame(() => setActiveHit(padId))
    hitTimer = window.setTimeout(() => setActiveHit(null), 150)
    setLastHit(`${pad.label} · ${pad.velocity}`)
    showToast(
      `${pad.label} visualised. No soundbank is loaded in this preview.`,
    )
  }

  const playRecovery = (): void => {
    setTempo(82)
    setDrawerOpen(false)
    setIsPlaying(true)
    updateUrl(view(), null)
    showToast('Bars 5 through 8 staged at 82 BPM. Synthetic preview only.')
  }

  useFocusTrap(() => drawerRef, {
    isOpen: drawerOpen,
    onClose: closeWorkspace,
    initialFocus: () =>
      drawerRef?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      drawerRef,
  })

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const initialView = params.get('view')
    if (STAGE_VIEWS.includes(initialView as StageView))
      setView(initialView as StageView)
    const initialDrawer = params.get('drawer')
    if (initialDrawer !== null && initialDrawer in WORKSPACE_TITLES) {
      setWorkspace(initialDrawer as Workspace)
      setDrawerOpen(true)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (event.key === 'Escape' && inputOpen()) {
        event.preventDefault()
        setInputOpen(false)
        inputButtonRef?.focus({ preventScroll: true })
        return
      }
      if (
        typing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        drawerOpen()
      )
        return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlaying()
        return
      }
      const pad = PAD_META.find((candidate) => candidate.key === event.key)
      if (pad !== undefined) triggerPad(pad.id)
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (
        !inputOpen() ||
        inputRef === undefined ||
        inputButtonRef === undefined
      )
        return
      const target = event.target
      if (!(target instanceof Node)) return
      if (!inputRef.contains(target) && !inputButtonRef.contains(target))
        setInputOpen(false)
    }

    const onVisibilityChange = (): void => {
      if (document.hidden) setIsPlaying(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('visibilitychange', onVisibilityChange)
    onCleanup(() => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  })

  onCleanup(() => {
    if (toastTimer !== undefined) window.clearTimeout(toastTimer)
    if (hitTimer !== undefined) window.clearTimeout(hitTimer)
  })

  return (
    <div
      class={styles.shell}
      data-testid="drum-night-shell"
      data-playing={isPlaying() ? 'true' : 'false'}
      data-drawer-open={drawerOpen() ? 'true' : 'false'}
      data-view={view()}
    >
      <a class={styles.skipLink} href="#drum-night-stage">
        Skip to the drum stage
      </a>

      <aside class={styles.roomRail} aria-label="Drum Night sections">
        <a class={styles.brandMark} href="/" aria-label="MercuryPitch home">
          <MercuryPlanet />
        </a>
        <nav class={styles.railNav}>
          <button
            class={cx('railAction', !drawerOpen() && 'isActive')}
            type="button"
            aria-current={!drawerOpen() ? 'page' : undefined}
            onClick={() => {
              closeWorkspace()
              selectView('pocket')
            }}
          >
            <WaveformBars />
            <span>Pocket</span>
          </button>
          <button
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('learn')}
          >
            <MusicLibrary />
            <span>Learn</span>
          </button>
          <button
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('songs')}
          >
            <MusicNote />
            <span>Songs</span>
          </button>
          <button
            class={styles.railAction}
            type="button"
            onClick={() => openWorkspace('groove')}
          >
            <SlidersHorizontal />
            <span>Groove</span>
          </button>
        </nav>
        <button
          class={cx('railAction', 'railKit')}
          type="button"
          onClick={() => openWorkspace('kit')}
        >
          <Drum />
          <span>Kit</span>
        </button>
      </aside>

      <main class={styles.roomShell}>
        <header class={styles.sessionBar}>
          <div class={styles.mobileBrand} aria-label="MercuryPitch Drum Night">
            <MercuryPlanet />
            <span>Drums</span>
          </div>
          <button
            class={styles.sessionIdentity}
            type="button"
            onClick={() => openWorkspace('songs')}
          >
            <span class={styles.sessionLight} aria-hidden="true" />
            <span>
              <strong>Midnight Pocket</strong>
              <small>
                A minor <i /> Neo-soul <i /> {tempo()} BPM
              </small>
            </span>
            <ChevronDown />
          </button>
          <div class={styles.barMap} aria-label="Bar 9 of 16">
            <span class={styles.barLabel}>Bar 9</span>
            <div class={styles.barDots} aria-hidden="true">
              <For each={Array.from({ length: 16 })}>
                {(_, index) => (
                  <i class={index() === 8 ? styles.current : undefined} />
                )}
              </For>
            </div>
          </div>
          <div class={styles.sessionActions}>
            <span class={styles.conceptBadge}>Interactive preview</span>
            <button
              ref={inputButtonRef}
              class={styles.inputChip}
              type="button"
              aria-expanded={inputOpen()}
              onClick={() => {
                const nextInputOpen = !inputOpen()
                setDrawerOpen(false)
                setInputOpen(nextInputOpen)
                updateUrl(view(), null)
              }}
            >
              <span class={styles.signalDot} aria-hidden="true" />
              <MidiDin />
              <span class={styles.inputCopy}>
                <strong>MIDI not connected</strong>
                <small>preview mapping only</small>
              </span>
              <ChevronDown />
            </button>
            <button
              class={styles.roomChip}
              type="button"
              onClick={() => openWorkspace('room')}
            >
              <span class={styles.roomChipArt} aria-hidden="true" />
              <span>
                <strong>Pocket Console</strong>
                <small>Tracking room</small>
              </span>
              <ChevronDown />
            </button>
          </div>
        </header>

        <section
          class={styles.performanceStage}
          id="drum-night-stage"
          tabindex="-1"
          aria-label="Drum performance stage"
        >
          <div class={styles.stageRoom} aria-hidden="true" />
          <div class={styles.stageShade} aria-hidden="true" />
          <div class={styles.stageVignette} aria-hidden="true" />

          <div class={styles.stageHeading}>
            <div class={styles.stageCopy}>
              <span class={styles.stageKicker}>
                <i aria-hidden="true" /> Live take
              </span>
              <h1>
                Find the centre.
                <br />
                Let it move.
              </h1>
            </div>
            <div
              class={styles.viewSwitcher}
              role="group"
              aria-label="Drum view"
            >
              <For each={STAGE_VIEWS}>
                {(item) => (
                  <button
                    class={view() === item ? styles.isActive : undefined}
                    type="button"
                    aria-pressed={view() === item}
                    onClick={() => selectView(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show when={view() === 'pocket'}>
            <PocketRing />
          </Show>
          <Show when={view() === 'score'}>
            <ScoreView />
          </Show>
          <Show when={view() === 'kit'}>
            <KitView activeHit={activeHit} onHit={triggerPad} />
          </Show>

          <aside class={styles.phraseCoach} aria-label="Pocket coach">
            <div class={styles.coachHeading}>
              <span>
                <i aria-hidden="true" /> Pocket coach
              </span>
              <small>Synthetic preview</small>
            </div>
            <span class={styles.coachWindow}>Last 8 bars</span>
            <h2>Your backbeat is settling.</h2>
            <p>
              The snare lands <b>12 ms late</b> on beats 2 and 4. The kick stays
              centred when the hi-hat opens.
            </p>
            <div
              class={styles.timingEvidence}
              aria-label="Illustrative timing evidence"
            >
              <div class={styles.timingAxis}>
                <span>early</span>
                <i />
                <span>late</span>
              </div>
              <div class={styles.timingMarks} aria-hidden="true">
                <i class={cx('mark', 'teal', 'm1')} />
                <i class={cx('mark', 'ivory', 'm2')} />
                <i class={cx('mark', 'coral', 'm3')} />
                <i class={cx('mark', 'teal', 'm4')} />
                <i class={cx('mark', 'amber', 'm5')} />
              </div>
            </div>
            <button
              class={styles.recoveryAction}
              type="button"
              onClick={playRecovery}
            >
              <span class={styles.recoveryIcon}>
                <Repeat />
              </span>
              <span>
                <strong>Loop bars 5–8 at 82 BPM</strong>
                <small>Keep the snare on 2 and 4</small>
              </span>
              <ChevronDown />
            </button>
            <button
              class={styles.quietAction}
              type="button"
              onClick={() =>
                showToast(
                  'Warm-up saving is planned. Nothing was stored by this preview.',
                )
              }
            >
              Save to tomorrow's warm-up
            </button>
            <div class={styles.privacyNote}>
              <span class={styles.privacyMark} aria-hidden="true" />
              <span>
                <strong>Planned on-device timing</strong>
                <small>This preview measures or stores nothing.</small>
              </span>
            </div>
          </aside>

          <button
            class={styles.coachCue}
            type="button"
            onClick={() => openWorkspace('coach')}
            aria-label="Open Pocket Coach"
          >
            <span class={styles.coachOrb}>
              <AudioWave />
            </span>
            <span>
              <strong>Backbeat settling.</strong>
              <small>Snare is 12 ms late on 2 and 4.</small>
            </span>
            <ChevronDown />
          </button>

          <button
            class={styles.sheetScrim}
            type="button"
            aria-label="Close rack drawer"
            onClick={closeWorkspace}
            tabindex={drawerOpen() ? 0 : -1}
          />
          <section
            ref={drawerRef}
            class={styles.workbench}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drum-workbench-title"
            aria-hidden={!drawerOpen()}
            inert={!drawerOpen()}
            tabindex="-1"
          >
            <div class={styles.workbenchBar}>
              <div>
                <span>Rack drawer</span>
                <strong id="drum-workbench-title">
                  {WORKSPACE_TITLES[workspace()]}
                </strong>
              </div>
              <div
                class={styles.workbenchTabs}
                role="tablist"
                aria-label="Drum workbench"
              >
                <For each={WORKBENCH_TABS}>
                  {(item) => (
                    <button
                      class={workspace() === item ? styles.isActive : undefined}
                      type="button"
                      role="tab"
                      aria-selected={workspace() === item}
                      onClick={() => {
                        setWorkspace(item)
                        updateUrl(view(), item)
                      }}
                    >
                      {item[0].toUpperCase() + item.slice(1)}
                    </button>
                  )}
                </For>
              </div>
              <button
                class={styles.closeWorkbench}
                type="button"
                onClick={closeWorkspace}
                aria-label="Close rack drawer"
              >
                <X />
              </button>
            </div>

            <Switch>
              <Match when={workspace() === 'groove'}>
                <div class={styles.workspaceView}>
                  <div class={styles.workspaceCopy}>
                    <span>Groove mirror</span>
                    <h3>Neo-soul pocket</h3>
                    <p>
                      One authored bar. Variations preserve the source hits and
                      remain reversible.
                    </p>
                  </div>
                  <div
                    class={styles.grooveLanes}
                    aria-label="Illustrative groove lanes"
                  >
                    <For
                      each={
                        [
                          ['Hat', [1, 0, 1, 0, 1, 0, 1, 0]],
                          ['Snare', [0, 1, 0, 0, 0, 1, 0, 0]],
                          ['Kick', [1, 0, 0, 1, 0, 0, 1, 0]],
                        ] as const
                      }
                    >
                      {(lane) => (
                        <div>
                          <b>{lane[0]}</b>
                          <span>
                            <For each={lane[1]}>
                              {(on) => (
                                <i class={on === 1 ? styles.on : undefined} />
                              )}
                            </For>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                  <div
                    class={styles.variationSwitch}
                    role="group"
                    aria-label="Groove variation"
                  >
                    <For each={['Source', 'Tight', 'Loose', 'Half-time']}>
                      {(item) => (
                        <button
                          class={
                            variation() === item ? styles.isSelected : undefined
                          }
                          type="button"
                          onClick={() => {
                            setVariation(item)
                            showToast(
                              `${item} groove variation selected. Source events remain unchanged.`,
                            )
                          }}
                        >
                          {item}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'kit'}>
                <div class={styles.workspaceView}>
                  <div class={styles.workspaceCopy}>
                    <span>Kit and mapping</span>
                    <h3>Oxblood Maple</h3>
                    <p>
                      General MIDI mapping with visible fallbacks. No
                      acoustic-kit identity is inferred from note numbers.
                    </p>
                  </div>
                  <div class={styles.mappingList}>
                    <For
                      each={
                        [
                          [36, 'Kick'],
                          [38, 'Snare'],
                          [42, 'Closed hat'],
                          [51, 'Ride'],
                        ] as const
                      }
                    >
                      {(mapping) => (
                        <div>
                          <span>{mapping[0]}</span>
                          <strong>{mapping[1]}</strong>
                          <small>Planned GM map</small>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'mix'}>
                <div class={styles.workspaceView}>
                  <div class={styles.workspaceCopy}>
                    <span>Session mix</span>
                    <h3>Keep the kit in front.</h3>
                    <p>
                      Guide, click, kit and backing will share one route-owned
                      clock.
                    </p>
                  </div>
                  <div class={styles.mixerStrips}>
                    <For
                      each={
                        [
                          ['Kit', 82],
                          ['Click', 44],
                          ['Bass', 68],
                          ['Guide', 58],
                        ] as const
                      }
                    >
                      {(strip) => (
                        <label>
                          <span>{strip[0]}</span>
                          <input
                            aria-label={`${strip[0]} level`}
                            type="range"
                            min="0"
                            max="100"
                            value={strip[1]}
                          />
                        </label>
                      )}
                    </For>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'room'}>
                <div class={styles.workspaceView}>
                  <div class={styles.workspaceCopy}>
                    <span>Room and ambience</span>
                    <h3>Pocket Console</h3>
                    <p>
                      Preview art first. Kit and reverb never change without
                      separate confirmation.
                    </p>
                  </div>
                  <div class={styles.roomOptions}>
                    <div class={styles.isSelected}>
                      <span class={cx('roomThumb', 'pocketThumb')} />
                      <strong>Pocket Console</strong>
                      <small>Current visual</small>
                    </div>
                    <div>
                      <span class={cx('roomThumb', 'tapeThumb')} />
                      <strong>Tape Room</strong>
                      <small>Planned room</small>
                    </div>
                    <div>
                      <span class={cx('roomThumb', 'daylightThumb')} />
                      <strong>Daylight Riser</strong>
                      <small>Planned room</small>
                    </div>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'learn'}>
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>First pocket</span>
                    <h3>Kick. Snare. Space.</h3>
                    <p>
                      Play a two-bar backbeat with touch or computer keys now.
                      E-kit input is planned.
                    </p>
                  </div>
                  <button
                    class={styles.largeRecovery}
                    type="button"
                    onClick={playRecovery}
                  >
                    Start at 82 BPM
                  </button>
                </div>
              </Match>
              <Match when={workspace() === 'songs'}>
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>Bring a drum part</span>
                    <h3>Open MIDI or Guitar Pro.</h3>
                    <p>
                      Percussion tracks remain articulations. Unsupported
                      mappings fail visibly and never play as pitches.
                    </p>
                  </div>
                  <div class={styles.songActions}>
                    <button type="button" disabled>
                      Local import planned
                    </button>
                    <button type="button" disabled>
                      Prepared parts planned
                    </button>
                  </div>
                </div>
              </Match>
              <Match when={workspace() === 'coach'}>
                <div class={cx('workspaceView', 'simpleWorkspace')}>
                  <div class={styles.workspaceCopy}>
                    <span>Recovery loop</span>
                    <h3>Re-centre the backbeat.</h3>
                    <p>
                      Bars 5–8, snare on 2 and 4, 82 BPM. Evidence shown here is
                      synthetic preview data.
                    </p>
                  </div>
                  <button
                    class={styles.largeRecovery}
                    type="button"
                    onClick={playRecovery}
                  >
                    Loop bars 5–8
                  </button>
                </div>
              </Match>
            </Switch>
          </section>
        </section>

        <div class={styles.touchKit} aria-label="Touch drum pads">
          <For each={PAD_META}>
            {(pad) => (
              <button
                class={cx(
                  pad.id === 'kick' && 'kickPad',
                  activeHit() === pad.id && 'isHit',
                )}
                type="button"
                onPointerDown={() => triggerPad(pad.id)}
                aria-label={`${pad.label}, key ${pad.key}`}
              >
                <span>{pad.shortLabel}</span>
                <small>{pad.key}</small>
              </button>
            )}
          </For>
        </div>

        <div class={styles.consoleBridge}>
          <button
            class={styles.consoleModule}
            type="button"
            aria-pressed={countInEnabled()}
            onClick={() => {
              setCountInEnabled(!countInEnabled())
              showToast(
                countInEnabled()
                  ? 'One-bar visual count-in enabled.'
                  : 'Visual count-in disabled.',
              )
            }}
          >
            <Metronome />
            <span>
              <small>Count-in</small>
              <strong>{countInEnabled() ? '1 bar' : 'Off'}</strong>
            </span>
          </button>
          <div class={styles.tempoModule} aria-label="Tempo">
            <button
              type="button"
              onClick={() => changeTempo(-2)}
              aria-label="Decrease tempo"
            >
              <Minus />
            </button>
            <span>
              <strong>{tempo()}</strong>
              <small>BPM</small>
            </span>
            <button
              type="button"
              onClick={() => changeTempo(2)}
              aria-label="Increase tempo"
            >
              <Plus />
            </button>
          </div>
          <button
            class={styles.playButton}
            type="button"
            onClick={togglePlaying}
            aria-label={`${isPlaying() ? 'Pause' : 'Play'} Midnight Pocket`}
          >
            {isPlaying() ? <Pause /> : <Play />}
            <span>{isPlaying() ? 'Pause' : 'Play'}</span>
          </button>
          <button
            class={styles.consoleModule}
            type="button"
            aria-expanded={drawerOpen() && workspace() === 'groove'}
            onClick={() =>
              drawerOpen() ? closeWorkspace() : openWorkspace('groove')
            }
          >
            <SlidersHorizontal />
            <span>
              <small>Groove</small>
              <strong>Neo-soul pocket</strong>
            </span>
            <ChevronDown />
          </button>
          <button
            class={styles.consoleModule}
            type="button"
            onClick={() => openWorkspace('kit')}
          >
            <Drum />
            <span>
              <small>Kit</small>
              <strong>Oxblood Maple</strong>
            </span>
            <ChevronDown />
          </button>
          <button
            class={cx('consoleModule', 'compactModule')}
            type="button"
            aria-pressed={loopEnabled()}
            onClick={() => {
              const enabled = !loopEnabled()
              setLoopEnabled(enabled)
              showToast(
                enabled
                  ? 'Practice loop set for bars 5 through 8.'
                  : 'Practice loop cleared.',
              )
            }}
          >
            <Loop />
            <span>
              <small>Practice loop</small>
              <strong>{loopEnabled() ? 'Bars 5–8' : 'Off'}</strong>
            </span>
          </button>
        </div>

        <nav class={styles.mobileNav} aria-label="Drum Night navigation">
          <button type="button" onClick={() => openWorkspace('songs')}>
            <MusicNote />
            <span>Song</span>
          </button>
          <button type="button" onClick={() => openWorkspace('groove')}>
            <SlidersHorizontal />
            <span>Groove</span>
          </button>
          <button
            class={styles.mobilePlay}
            type="button"
            onClick={togglePlaying}
            aria-label={`${isPlaying() ? 'Pause' : 'Play'} Midnight Pocket`}
          >
            {isPlaying() ? <Pause /> : <Play />}
            <span>{isPlaying() ? 'Pause' : 'Play'}</span>
          </button>
          <button type="button" onClick={() => openWorkspace('coach')}>
            <AudioWave />
            <span>Coach</span>
          </button>
          <button type="button" onClick={() => openWorkspace('kit')}>
            <Drum />
            <span>Kit</span>
          </button>
        </nav>

        <Show when={inputOpen()}>
          <div ref={inputRef} class={styles.inputPopover}>
            <div class={styles.popoverHeading}>
              <span>Input preview</span>
              <button
                type="button"
                onClick={() => {
                  setInputOpen(false)
                  inputButtonRef?.focus({ preventScroll: true })
                }}
                aria-label="Close input details"
              >
                <X />
              </button>
            </div>
            <strong>No e-kit connected</strong>
            <p>
              The production input will retain articulation, velocity, channel,
              and overlapping voice identity.
            </p>
            <div class={styles.inputRow}>
              <span>Last preview hit</span>
              <b>{lastHit()}</b>
            </div>
            <div class={styles.inputRow}>
              <span>Latency</span>
              <b>Not calibrated</b>
            </div>
            <button type="button" onClick={() => openWorkspace('kit')}>
              Review mapping
            </button>
          </div>
        </Show>

        <div
          class={cx('toast', toastVisible() && 'toastVisible')}
          role="status"
          aria-live="polite"
        >
          {liveMessage()}
        </div>
      </main>
    </div>
  )
}
