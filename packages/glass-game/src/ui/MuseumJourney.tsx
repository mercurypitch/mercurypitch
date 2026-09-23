// Museum journey lobby — accessible gallery routing around an optional live 3D map.

import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import type { GlassMuseumAudio } from '../host'
import type { MuseumJourneyStageProgress } from '../journey/progress'
import type { MuseumJourneyScene, MuseumJourneyStageLabelProjection, } from '../journey/scene'
import type { IslandTrialView } from './IslandTrials'
import { IslandTrials } from './IslandTrials'
import styles from './MuseumJourney.module.css'

export interface MuseumJourneyChapterView {
  stageId: string
  chapterId: string
  chapterLabel: string
  lesson: string
  title: string
  description: string
  imageUrl: string
  action: 'Enter' | 'Continue' | 'Replay'
  progressLabel: string
  stars?: 1 | 2 | 3
  starKind?: 'level'
  historicalGrade: boolean
  notGraded: boolean
  portrait?: { title: string; imageUrl: string }
}

function sceneProgress(
  chapters: readonly MuseumJourneyChapterView[],
): readonly MuseumJourneyStageProgress[] {
  return chapters.map((chapter) => ({
    stageId: chapter.stageId,
    ...(chapter.stars === undefined ? {} : { stars: chapter.stars }),
    ...(chapter.portrait === undefined
      ? {}
      : { portrait: { imageUrl: chapter.portrait.imageUrl } }),
  }))
}

export function MuseumJourney(props: {
  definition: MuseumJourneyDefinition
  chapters: readonly MuseumJourneyChapterView[]
  trials?: readonly IslandTrialView[]
  onEnterTrial?(id: string): void
  selectedStageId: string
  assetUrl(id: string): string
  createMusic?: () => GlassMuseumAudio
  subscribeForeground(listener: (foreground: boolean) => void): () => void
  onSelect(stageId: string): void
  onEnter(chapterId: string): void
  onExit(): void
  onOpenCollection?(): void
}) {
  let mapContainer: HTMLDivElement | undefined
  const stageLabels = new Map<string, HTMLButtonElement>()
  let scene: MuseumJourneyScene | undefined
  let music: GlassMuseumAudio | undefined
  let unsubscribeForeground: (() => void) | undefined
  let removeMotionListener: (() => void) | undefined
  let generation = 0
  let lifetime = 0
  let latestSelectedStageId = untrack(() => props.selectedStageId)
  let latestProgress = untrack(() => sceneProgress(props.chapters))
  let foreground = true
  let reducedMotion = false
  const [mapState, setMapState] = createSignal<'loading' | 'ready' | 'failed'>(
    'loading',
  )
  const [mapError, setMapError] = createSignal('')
  const [reloadRequired, setReloadRequired] = createSignal(false)
  const [muted, setMuted] = createSignal(false)
  const [enteringChapterId, setEnteringChapterId] = createSignal<string>()
  const [enteringTrialId, setEnteringTrialId] = createSignal<string>()
  const [viewChanged, setViewChanged] = createSignal(false)

  const selectedChapter = () =>
    props.chapters.find(
      (chapter) => chapter.stageId === props.selectedStageId,
    ) ?? props.chapters[0]

  function activateMusic(): void {
    if (foreground && music !== undefined) void music.start('journey')
  }

  function select(stageId: string): void {
    props.onSelect(stageId)
    activateMusic()
  }

  function finishEntry(
    entryLifetime: number,
    onEnter: (id: string) => void,
    id: string,
  ): void {
    if (entryLifetime !== lifetime) return
    try {
      onEnter(id)
    } finally {
      // A successful handoff unmounts this lobby. A declined handoff leaves it usable.
      if (entryLifetime === lifetime) {
        setEnteringChapterId(undefined)
        setEnteringTrialId(undefined)
      }
    }
  }

  async function enter(chapter: MuseumJourneyChapterView): Promise<void> {
    if (enteringChapterId() !== undefined) return
    const entryLifetime = lifetime
    const onEnter = props.onEnter
    setEnteringChapterId(chapter.chapterId)
    props.onSelect(chapter.stageId)
    if (music !== undefined) {
      void music.start('journey')
      try {
        await music.silenceForVoice()
      } catch {
        // A retired or unavailable output is already silent enough to enter.
      }
    }
    finishEntry(entryLifetime, onEnter, chapter.chapterId)
  }

  async function enterTrial(id: string): Promise<void> {
    const trial = props.trials?.find((candidate) => candidate.id === id)
    const onEnter = props.onEnterTrial
    if (
      trial?.unlock.unlocked !== true ||
      onEnter === undefined ||
      enteringChapterId() !== undefined
    )
      return
    const entryLifetime = lifetime
    setEnteringChapterId(`trial:${id}`)
    setEnteringTrialId(id)
    if (music !== undefined) {
      try {
        await music.silenceForVoice()
      } catch {
        // An unavailable output is already silent enough to enter.
      }
    }
    finishEntry(entryLifetime, onEnter, id)
  }

  function exit(): void {
    lifetime++
    props.onExit()
  }

  function updateProjectedStageLabels(
    labels: readonly MuseumJourneyStageLabelProjection[],
  ): void {
    const projectedStageIds = new Set<string>()
    for (const label of labels) {
      const element = stageLabels.get(label.stageId)
      const visible =
        label.visible && Number.isFinite(label.x) && Number.isFinite(label.y)
      if (element === undefined || !visible) continue
      projectedStageIds.add(label.stageId)
      element.style.transform = `translate3d(${Math.round(label.x)}px, ${Math.round(label.y)}px, 0) translate(-50%, 38px)`
      element.dataset.projectedX = String(Math.round(label.x))
      element.dataset.projectedY = String(Math.round(label.y))
      element.dataset.projected = 'true'
      element.tabIndex = 0
      element.removeAttribute('aria-hidden')
    }
    for (const [stageId, element] of stageLabels) {
      if (projectedStageIds.has(stageId)) continue
      element.dataset.projected = 'false'
      element.tabIndex = -1
      element.setAttribute('aria-hidden', 'true')
    }
  }

  function mountScene(): void {
    const container = mapContainer
    if (container === undefined) return
    const definition = props.definition
    const assetUrl = props.assetUrl
    const attempt = ++generation
    scene?.dispose()
    scene = undefined
    updateProjectedStageLabels([])
    setMapState('loading')
    setMapError('')
    setReloadRequired(false)
    setViewChanged(false)
    void import('../journey/scene')
      .then((module) => {
        if (attempt !== generation) return
        let handle: MuseumJourneyScene
        try {
          handle = module.createMuseumJourneyScene(
            container,
            definition,
            assetUrl,
            {
              selectedStageId: latestSelectedStageId,
              foreground,
              reducedMotion,
              onSelect: select,
              onViewChange(changed) {
                if (attempt === generation) setViewChanged(changed)
              },
              onProjectStageLabels(labels) {
                if (attempt !== generation) return
                updateProjectedStageLabels(labels)
              },
              onFailure(error) {
                if (attempt !== generation) return
                setMapError(
                  error instanceof Error ? error.message : 'The map paused.',
                )
                setMapState('failed')
              },
            },
          )
        } catch (error) {
          if (attempt !== generation) return
          setMapError(
            error instanceof Error
              ? error.message
              : 'The floating museum could not open.',
          )
          setMapState('failed')
          return
        }
        if (attempt !== generation) {
          handle.dispose()
          return
        }
        handle.setProgress(latestProgress)
        scene = handle
        void handle.ready.then(
          () => {
            if (attempt === generation && scene === handle) setMapState('ready')
          },
          (error: unknown) => {
            if (attempt !== generation || scene !== handle) return
            handle.dispose()
            scene = undefined
            setMapError(
              error instanceof Error
                ? error.message
                : 'The museum models could not be loaded.',
            )
            setMapState('failed')
          },
        )
      })
      .catch((error: unknown) => {
        if (attempt !== generation) return
        setReloadRequired(true)
        setMapError(
          error instanceof Error
            ? error.message
            : 'The interactive map could not be loaded.',
        )
        setMapState('failed')
      })
  }

  createEffect(() => {
    latestSelectedStageId = props.selectedStageId
    scene?.setSelected(latestSelectedStageId)
  })

  createEffect(() => {
    latestProgress = sceneProgress(props.chapters)
    scene?.setProgress(latestProgress)
  })

  onMount(() => {
    lifetime++
    music = props.createMusic?.()
    setMuted(music?.preferences().muted ?? false)
    unsubscribeForeground = props.subscribeForeground((next) => {
      foreground = next
      scene?.setForeground(next)
      if (!next) music?.pause()
    })
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motionChanged = (): void => {
      reducedMotion = media.matches
      scene?.setReducedMotion(reducedMotion)
    }
    motionChanged()
    media.addEventListener('change', motionChanged)
    removeMotionListener = () =>
      media.removeEventListener('change', motionChanged)
    mountScene()
  })

  onCleanup(() => {
    lifetime++
    generation++
    unsubscribeForeground?.()
    removeMotionListener?.()
    scene?.dispose()
    scene = undefined
    updateProjectedStageLabels([])
    stageLabels.clear()
    music?.dispose()
    music = undefined
  })

  function toggleSound(): void {
    if (music === undefined) return
    const next = !music.preferences().muted
    music.setPreferences({ muted: next })
    setMuted(next)
    if (!next) activateMusic()
  }

  function resetView(): void {
    scene?.resetView()
  }

  return (
    <main
      class={styles.lobby}
      aria-labelledby="glass-campaign-title"
      data-testid="glass-campaign"
    >
      <section class={styles.mapSection} aria-label="Floating museum map">
        <div
          class={styles.mapFrame}
          data-map-state={mapState()}
          data-selected-stage={props.selectedStageId}
        >
          <div class={styles.mapCanvas} ref={mapContainer} />

          <header class={styles.mapHeader}>
            <div class={styles.brand}>
              <svg class={styles.sunMark} viewBox="0 0 80 80" aria-hidden>
                <circle cx="40" cy="40" r="14" />
                <circle cx="40" cy="40" r="3" />
                <path d="M40 3v18M40 59v18M3 40h18M59 40h18M14 14l13 13M53 53l13 13M66 14 53 27M27 53 14 66M29 6l5 15M51 59l5 15M6 29l15 5M59 51l15 5M51 6l-5 15M34 59l-5 15M74 29l-15 5M21 51 6 56" />
              </svg>
              <h1 id="glass-campaign-title">Glassworks</h1>
              <p>
                Find your voice <span>in a brighter world.</span>
              </p>
            </div>
            <div class={styles.headerActions}>
              <Show when={props.onOpenCollection}>
                <button
                  type="button"
                  class={styles.roundAction}
                  aria-label="Open museum collection"
                  onClick={() => props.onOpenCollection?.()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="3" width="16" height="18" rx="1" />
                    <path d="M7 16l3-4 3 3 3-5 2 6M8 7h3" />
                  </svg>
                </button>
              </Show>
              <button
                type="button"
                class={styles.roundAction}
                aria-label={
                  muted() ? 'Turn museum sound on' : 'Mute museum sound'
                }
                aria-pressed={muted()}
                onClick={toggleSound}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 9v6h4l5 4V5L9 9H5Z" />
                  <Show
                    when={muted()}
                    fallback={<path d="M17 9.2a4 4 0 0 1 0 5.6" />}
                  >
                    <path d="m17 9 5 6m0-6-5 6" />
                  </Show>
                </svg>
              </button>
              <button
                type="button"
                class={styles.roundAction}
                aria-label="Leave Glassworks"
                onClick={exit}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14 6-6 6 6 6" />
                </svg>
              </button>
            </div>
          </header>

          <Show when={mapState() === 'ready' && viewChanged()}>
            <button
              type="button"
              class={styles.viewReset}
              aria-label="Reset museum view"
              onClick={resetView}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.2 8.2A8 8 0 1 1 4.8 15M5.2 8.2V3.8m0 4.4h4.4" />
              </svg>
              <span>Reset view</span>
            </button>
          </Show>

          <nav class={styles.stageLabels} aria-label="Museum gallery labels">
            <For each={props.chapters}>
              {(chapter) => (
                <button
                  ref={(element) => stageLabels.set(chapter.stageId, element)}
                  type="button"
                  class={styles.stageCartouche}
                  classList={{
                    [styles.stageCartoucheSelected]:
                      chapter.stageId === props.selectedStageId,
                  }}
                  data-journey-label={chapter.stageId}
                  aria-hidden="true"
                  aria-pressed={chapter.stageId === props.selectedStageId}
                  aria-label={`Select ${chapter.title} on the museum map`}
                  tabIndex={-1}
                  onClick={() => select(chapter.stageId)}
                >
                  <span>{chapter.title}</span>
                </button>
              )}
            </For>
          </nav>

          <Show when={mapState() === 'loading'}>
            <div class={styles.mapNotice} role="status">
              <span class={styles.loader} aria-hidden="true" />
              Raising the museum from the clouds…
            </div>
          </Show>
          <Show when={mapState() === 'failed'}>
            <div class={styles.mapNotice} role="status">
              <strong>The gallery list is still open.</strong>
              <span>{mapError()}</span>
              <button
                type="button"
                onClick={() =>
                  reloadRequired() ? window.location.reload() : mountScene()
                }
              >
                {reloadRequired()
                  ? 'Reload to retry interactive map'
                  : 'Retry interactive map'}
              </button>
            </div>
          </Show>
        </div>

        <div class={styles.mapDock}>
          <nav class={styles.stageRail} aria-label="Select a museum island">
            <For each={props.chapters}>
              {(chapter, index) => (
                <button
                  type="button"
                  class={styles.stageChip}
                  classList={{
                    [styles.stageChipSelected]:
                      chapter.stageId === props.selectedStageId,
                  }}
                  aria-pressed={chapter.stageId === props.selectedStageId}
                  aria-label={`Select ${chapter.title} on the museum map`}
                  onClick={() => select(chapter.stageId)}
                >
                  <span>{String(index() + 1).padStart(2, '0')}</span>
                  <span>{chapter.chapterLabel}</span>
                </button>
              )}
            </For>
          </nav>

          <Show when={selectedChapter()} keyed>
            {(chapter) => (
              <article class={styles.selectedCard} aria-live="polite">
                <div class={styles.selectedArtwork}>
                  <img src={chapter.imageUrl} alt="" />
                  <span>{chapter.chapterLabel}</span>
                </div>
                <div class={styles.selectedContent}>
                  <span class={styles.selectedTopline}>
                    {chapter.progressLabel}
                  </span>
                  <p class={styles.lesson}>{chapter.lesson}</p>
                  <h2>{chapter.title}</h2>
                  <p class={styles.description}>{chapter.description}</p>
                  <div class={styles.keepsakes}>
                    <Show when={chapter.stars !== undefined}>
                      <span
                        class={styles.stars}
                        aria-label={`${chapter.stars} saved ${chapter.starKind === 'level' ? 'level' : 'pitch'} ${chapter.stars === 1 ? 'star' : 'stars'}${chapter.historicalGrade ? ', from an earlier challenge edition' : ''}`}
                      >
                        <For each={[1, 2, 3]}>
                          {(star) => (
                            <svg
                              viewBox="0 0 20 20"
                              classList={{
                                [styles.starEarned]:
                                  star <= (chapter.stars ?? 0),
                              }}
                              aria-hidden="true"
                            >
                              <path d="m10 1.7 2.45 5 5.5.8-4 3.85.95 5.45L10 14.2l-4.9 2.6.95-5.45-4-3.85 5.5-.8L10 1.7Z" />
                            </svg>
                          )}
                        </For>
                      </span>
                    </Show>
                    <Show when={chapter.notGraded}>
                      <span class={styles.ungraded}>
                        Singing quality not yet graded
                      </span>
                    </Show>
                    <Show when={chapter.portrait} keyed>
                      {(portrait) => (
                        <span class={styles.portraitKeepsake}>
                          <img src={portrait.imageUrl} alt="" />
                          Portrait collected · {portrait.title}
                        </span>
                      )}
                    </Show>
                  </div>
                  <button
                    type="button"
                    class={styles.enterSelected}
                    disabled={enteringChapterId() !== undefined}
                    aria-label={`Open selected gallery: ${chapter.title}`}
                    onClick={() => void enter(chapter)}
                  >
                    <span>
                      {enteringChapterId() === chapter.chapterId
                        ? 'Opening gallery…'
                        : `${chapter.action} selected gallery`}
                    </span>
                  </button>
                </div>
              </article>
            )}
          </Show>
        </div>
      </section>

      <section class={styles.galleryList} aria-labelledby="gallery-list-title">
        <div class={styles.listHeading}>
          <span>Direct gallery access</span>
          <h2 id="gallery-list-title">The museum catalogue</h2>
          <p>The list stays open even when the live map is unavailable.</p>
        </div>
        <div class={styles.chapters}>
          <For each={props.chapters}>
            {(chapter) => (
              <article
                class={styles.chapter}
                classList={{
                  [styles.chapterSelected]:
                    chapter.stageId === props.selectedStageId,
                }}
              >
                <button
                  type="button"
                  class={styles.chapterSelect}
                  aria-label={`Select ${chapter.title} on the museum map`}
                  onClick={() => select(chapter.stageId)}
                >
                  <span class={styles.chapterArt}>
                    <img src={chapter.imageUrl} alt="" />
                    <i>{chapter.chapterLabel}</i>
                  </span>
                  <span class={styles.chapterCopy}>
                    <small>{chapter.lesson}</small>
                    <strong>{chapter.title}</strong>
                    <span>{chapter.description}</span>
                  </span>
                </button>
                <div class={styles.chapterStatus}>
                  <span>{chapter.progressLabel}</span>
                  <button
                    type="button"
                    disabled={enteringChapterId() !== undefined}
                    aria-label={`${chapter.action} ${chapter.title}`}
                    onClick={() => void enter(chapter)}
                  >
                    {chapter.action}
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
      <IslandTrials
        trials={props.trials ?? []}
        enteringId={enteringTrialId()}
        disabled={enteringChapterId() !== undefined}
        onEnter={(id) => void enterTrial(id)}
      />
    </main>
  )
}
