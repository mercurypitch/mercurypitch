// MixerHeader is the stem mixer's top row: the song, and where to go.
// ============================================================
//
//   Back  Title                 Songs Pitch | Stage Layout Sidebar |
//         (playlist line)       Zen Focus | Karaoke Night Tour
//
// One row, 44 px tall on a mouse. The playback rail under it holds what the
// singer reaches for while singing; this row holds what they open once: the
// song list, the pitch tools, the stage's look, the workspace layout, the
// other views, and the same song on the Karaoke Night stage.
//
// It folds as it narrows (header-fold.ts): words go first, under 1000 px of
// header, and the buttons keep their names for a screen reader. Under 600 px
// (1000 px on a touch screen) Stage, Layout, the sidebar toggle and Tour go
// into one View menu, and Karaoke Night keeps only its icon.
//
// Open in Karaoke Night is a link: same tab, a spinner while the page loads,
// and the song opens there paused where it was here. While leaving would
// lose something (a separation, a take being kept) or open the song
// differently (a playlist run), it waits and says why in words under it.
//
// It takes values and callbacks only; StemMixer reads its stores into it.

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { ChevronDown, ChevronLeft, HelpCircle, Maximize2, Share, SkipBack, SkipForward, SlidersHorizontal, StageCurtains, X, } from '@/components/icons'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { OverflowMenu } from '@/components/OverflowMenu'
import { BusyLink } from '@/components/shared/BusyLink'
import type { MixerViewControlsProps } from '@/components/stem-mixer/MixerViewControls'
import { currentLayout, mixerViewRows, } from '@/components/stem-mixer/MixerViewControls'
import { ReasonHold } from '@/components/stem-mixer/rail/ReasonHold'
import type { BackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { isCoarsePointer } from '@/lib/use-viewport'
import { headerFolds } from './header-fold'
import { ArrowUpRight, Backdrop, PitchCurve, SongList, ZenLines, } from './header-icons'
import styles from './MixerHeader.module.css'
import type { StageTransparency } from './StagePanel'
import { StagePanel } from './StagePanel'

export interface MixerHeaderPlaylist {
  singer?: string
  song: string
  next?: { song: string; singer?: string }
  canGoBack: boolean
  onPrevious: () => void
  onNext: () => void
  onStop: () => void
}

export interface MixerHeaderStage {
  background: BackgroundSurfaceController
  /** The panels' transparency; the performance stage has none. */
  transparency?: StageTransparency
}

export interface MixerHeaderKaraokeNight {
  /** The link from the top of the song, for a copy or a new tab. */
  href: string
  /** The link at the playhead, read at the press. */
  hrefNow: () => string
  /** Why it waits, or null when it can go (karaoke-night.ts). */
  reason: string | null
  /** Leaving now: the mixer fades the song out under the page load. */
  onLeave: () => void
}

export interface MixerHeaderProps {
  title: string
  onBack?: () => void
  /** The playlist line under the title, while one runs. */
  playlist?: MixerHeaderPlaylist | null

  songsOpen: boolean
  onToggleSongs: () => void
  pitchOpen: boolean
  onTogglePitch: () => void

  /** The stage's backdrop and transparency; absent, there is no Stage. */
  stage?: MixerHeaderStage
  view: MixerViewControlsProps
  onZen: () => void
  onFocus: () => void

  /** Absent where Karaoke Night has nothing to add. */
  karaokeNight?: MixerHeaderKaraokeNight
  onTour?: () => void
  /** Copies the song's link; behind the premium flag. */
  share?: { label: string; onShare: () => void }
}

export const MixerHeader: Component<MixerHeaderProps> = (props) => {
  let header: HTMLDivElement | undefined
  let stageButton: HTMLButtonElement | undefined
  let viewSlot: HTMLSpanElement | undefined

  const [width, setWidth] = createSignal(0)
  const folded = (): boolean => headerFolds(width(), isCoarsePointer())

  onMount(() => {
    if (header === undefined || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry !== undefined) setWidth(entry.contentRect.width)
    })
    observer.observe(header)
    onCleanup(() => observer.disconnect())
  })

  // ── Stage ────────────────────────────────────────────────────────
  const [stageOpen, setStageOpen] = createSignal(false)
  const stageAnchor = (): HTMLElement | undefined =>
    folded() ? viewSlot : stageButton
  const closeStage = (restoreFocus: boolean): void => {
    setStageOpen(false)
    if (!restoreFocus) return
    const anchor = stageAnchor()
    const target =
      anchor instanceof HTMLButtonElement
        ? anchor
        : anchor?.querySelector<HTMLButtonElement>('button')
    target?.focus()
  }

  // ── Layout and View ──────────────────────────────────────────────
  const layoutIcon = () => currentLayout(props.view.layout).icon()
  const viewRows = (): OverflowMenuItem[] => {
    const rows: OverflowMenuItem[] = []
    if (props.stage !== undefined) {
      rows.push({
        key: 'stage',
        label: 'Stage backdrop and transparency',
        icon: () => <Backdrop size={16} />,
        onSelect: () => setStageOpen(true),
      })
    }
    rows.push(...mixerViewRows(props.view))
    const tour = props.onTour
    if (tour !== undefined) {
      rows.push({
        key: 'tour',
        label: 'Take the mixer tour',
        separatorBefore: true,
        icon: () => <HelpCircle size={16} />,
        onSelect: () => tour(),
      })
    }
    return rows
  }

  const sidebarLabel = () =>
    props.view.sidebarHidden ? 'Show mixer sidebar' : 'Hide mixer sidebar'

  return (
    <div
      ref={header}
      class={`sm-header ${styles.header}`}
      data-testid="mixer-header"
      data-folded={folded() ? 'true' : 'false'}
    >
      <div class={styles.row}>
        <Show when={props.onBack}>
          {(back) => (
            <button
              type="button"
              class={`${styles.hb} ${styles.back}`}
              aria-label="Back to the song list"
              title="Back"
              onClick={() => back()()}
            >
              <ChevronLeft />
            </button>
          )}
        </Show>

        <div class={`sm-header-titles ${styles.titles}`}>
          <h2 class={styles.title} title={props.title}>
            {props.title}
          </h2>
          <Show when={props.playlist}>
            {(playlist) => (
              <div class={styles.sub} role="group" aria-label="Playlist">
                <Show when={playlist().singer}>
                  {(singer) => (
                    <>
                      <span class={styles.singer}>{singer()}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                </Show>
                <span class={styles.song}>{playlist().song}</span>
                <Show when={playlist().next}>
                  {(next) => (
                    <span class={styles.next}>
                      · Next: {next().song}
                      <Show when={next().singer}>
                        {(singer) => <> ({singer()})</>}
                      </Show>
                    </span>
                  )}
                </Show>
                <span class={styles.playlistControls}>
                  <button
                    type="button"
                    aria-label="Previous song"
                    title="Previous song"
                    disabled={!playlist().canGoBack}
                    onClick={() => playlist().onPrevious()}
                  >
                    <SkipBack />
                  </button>
                  <button
                    type="button"
                    aria-label="Skip to next song"
                    title="Skip to next song"
                    onClick={() => playlist().onNext()}
                  >
                    <SkipForward />
                  </button>
                  <button
                    type="button"
                    aria-label="Stop playlist"
                    title="Stop playlist"
                    onClick={() => playlist().onStop()}
                  >
                    <X />
                  </button>
                </span>
              </div>
            )}
          </Show>
        </div>

        <div class={styles.actions} data-tour="mixer.header">
          <div class={styles.group}>
            <button
              type="button"
              class={`${styles.hb} ${styles.word}`}
              data-tour="mixer.playlist"
              aria-label="Songs"
              aria-pressed={props.songsOpen}
              title="Open songs and playlists"
              onClick={() => props.onToggleSongs()}
            >
              <SongList />
              <span class={styles.label}>Songs</span>
            </button>
            <button
              type="button"
              class={`sm-pitch-debug-btn ${styles.hb} ${styles.word}`}
              aria-label="Pitch"
              aria-pressed={props.pitchOpen}
              title="Pitch analysis and settings"
              onClick={() => props.onTogglePitch()}
            >
              <PitchCurve />
              <span class={styles.label}>Pitch</span>
            </button>
          </div>

          <Show when={!folded()}>
            <span class={styles.divider} aria-hidden="true" />
            <div class={styles.group}>
              <Show when={props.stage}>
                <button
                  ref={stageButton}
                  type="button"
                  class={`${styles.hb} ${styles.word}`}
                  aria-label="Stage"
                  aria-haspopup="dialog"
                  aria-expanded={stageOpen()}
                  title="Stage backdrop and transparency"
                  onClick={() => setStageOpen((open) => !open)}
                >
                  <Backdrop />
                  <span class={styles.label}>Stage</span>
                </button>
              </Show>
              <OverflowMenu
                label="Layout"
                testId="mixer-layout"
                triggerTitle={`Layout: ${currentLayout(props.view.layout).label}`}
                triggerClass={`${styles.hb} ${styles.menu}`}
                panelClass={`mp-dark-stage ${styles.menuPanel}`}
                triggerContent={
                  <>
                    <span class={styles.layoutIcon}>{layoutIcon()}</span>
                    <ChevronDown size={12} />
                  </>
                }
                items={mixerViewRows(props.view)}
              />
              <Show when={props.view.layout === 'fixed-2col'}>
                <button
                  type="button"
                  class={`${styles.hb} ${styles.icon}`}
                  aria-label="Mixer sidebar"
                  aria-pressed={!props.view.sidebarHidden}
                  title={sidebarLabel()}
                  onClick={() => props.view.onToggleSidebar()}
                >
                  <SlidersHorizontal />
                </button>
              </Show>
            </div>
          </Show>

          <span class={styles.divider} aria-hidden="true" />
          <div class={styles.group}>
            <button
              type="button"
              class={`${styles.hb} ${styles.word}`}
              data-testid="mixer-zen"
              aria-label="Zen"
              title="Zen mode: lyrics first, Back returns here"
              onClick={() => props.onZen()}
            >
              <ZenLines />
              <span class={styles.label}>Zen</span>
            </button>
            <button
              type="button"
              class={`${styles.hb} ${styles.icon}`}
              data-tour="mixer.focus"
              aria-label="Focus mode"
              title="Focus mode (Esc leaves it)"
              onClick={() => props.onFocus()}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <span class={styles.divider} aria-hidden="true" />
          <div class={styles.group}>
            <Show when={props.karaokeNight}>
              {(night) => (
                <ReasonHold
                  reason={night().reason}
                  blocks={night().reason !== null}
                  align="end"
                >
                  {(control) => (
                    <BusyLink
                      class={`${styles.hb} ${styles.kn}`}
                      href={night().reason === null ? night().href : undefined}
                      role={night().reason === null ? undefined : 'link'}
                      tabIndex={night().reason === null ? undefined : 0}
                      data-tour="mixer.karaoke-night"
                      data-testid="mixer-karaoke-night"
                      aria-label="Open in Karaoke Night"
                      title={
                        night().reason === null
                          ? `Open ${props.title} in Karaoke Night`
                          : undefined
                      }
                      busyLabel="Opening Karaoke Night…"
                      {...control.attrs}
                      onKeyDown={(event) => {
                        if (night().reason === null) return
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        control.refuse()
                      }}
                      onClick={(event) => {
                        if (control.refuse()) {
                          event.preventDefault()
                          return
                        }
                        event.currentTarget.href = night().hrefNow()
                        night().onLeave()
                      }}
                    >
                      <StageCurtains size={16} />
                      <span class={styles.label}>Karaoke Night</span>
                      <span class={styles.out} aria-hidden="true">
                        <ArrowUpRight />
                      </span>
                    </BusyLink>
                  )}
                </ReasonHold>
              )}
            </Show>
            <Show when={!folded() && props.onTour}>
              {(tour) => (
                <button
                  type="button"
                  class={`${styles.hb} ${styles.icon}`}
                  aria-label="Tour"
                  title="Take a guided tour of the mixer"
                  onClick={() => tour()()}
                >
                  <HelpCircle size={16} />
                </button>
              )}
            </Show>
            <Show when={folded()}>
              <span ref={viewSlot} class={styles.slot}>
                <OverflowMenu
                  label="View"
                  testId="mixer-view"
                  triggerTitle="Stage, layout, sidebar and tour"
                  triggerClass={`${styles.hb} ${styles.menu}`}
                  panelClass={`mp-dark-stage ${styles.menuPanel}`}
                  triggerContent={
                    <>
                      <span class={styles.layoutIcon}>{layoutIcon()}</span>
                      <ChevronDown size={12} />
                    </>
                  }
                  items={viewRows()}
                />
              </span>
            </Show>
            <Show when={props.share}>
              {(share) => (
                <button
                  type="button"
                  class={`${styles.hb} ${styles.icon}`}
                  aria-label={share().label}
                  title="Copy share link"
                  onClick={() => share().onShare()}
                >
                  <Share />
                </button>
              )}
            </Show>
          </div>
        </div>
      </div>

      <Show when={props.stage}>
        {(stage) => (
          <StagePanel
            open={stageOpen()}
            anchor={stageAnchor}
            onClose={closeStage}
            background={stage().background}
            transparency={stage().transparency}
          />
        )}
      </Show>
    </div>
  )
}
