// Museum journey lobby — accessible gallery routing around an optional live 3D map.

import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import type { GlassMuseumAudio } from '../host'
import type { MuseumJourneyScene } from '../journey/scene'
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
  historicalGrade: boolean
  notGraded: boolean
  portrait?: { title: string; imageUrl: string }
}

export function MuseumJourney(props: {
  definition: MuseumJourneyDefinition
  chapters: readonly MuseumJourneyChapterView[]
  selectedStageId: string
  assetUrl(id: string): string
  createMusic?: () => GlassMuseumAudio
  subscribeForeground(listener: (foreground: boolean) => void): () => void
  onSelect(stageId: string): void
  onEnter(chapterId: string): void
  onExit(): void
}) {
  let mapContainer: HTMLDivElement | undefined
  let scene: MuseumJourneyScene | undefined
  let music: GlassMuseumAudio | undefined
  let unsubscribeForeground: (() => void) | undefined
  let removeMotionListener: (() => void) | undefined
  let generation = 0
  let lifetime = 0
  let latestSelectedStageId = untrack(() => props.selectedStageId)
  let foreground = true
  let reducedMotion = false
  const [mapState, setMapState] = createSignal<'loading' | 'ready' | 'failed'>(
    'loading',
  )
  const [mapError, setMapError] = createSignal('')
  const [reloadRequired, setReloadRequired] = createSignal(false)
  const [muted, setMuted] = createSignal(false)
  const [enteringChapterId, setEnteringChapterId] = createSignal<string>()

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
    if (entryLifetime === lifetime) onEnter(chapter.chapterId)
  }

  function exit(): void {
    lifetime++
    props.onExit()
  }

  function mountScene(): void {
    const container = mapContainer
    if (container === undefined) return
    const definition = props.definition
    const assetUrl = props.assetUrl
    const attempt = ++generation
    scene?.dispose()
    scene = undefined
    setMapState('loading')
    setMapError('')
    setReloadRequired(false)
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

  return (
    <main
      class={styles.lobby}
      aria-labelledby="glass-campaign-title"
      data-testid="glass-campaign"
    >
      <header class={styles.header}>
        <div class={styles.heading}>
          <span class={styles.eyebrow}>MercuryPitch / Floating Museum</span>
          <h1 id="glass-campaign-title">
            Every gallery begins
            <br />
            with a breath.
          </h1>
          <p>
            Follow the gold path across four singing islands. Choose a gallery,
            then step inside when you are ready.
          </p>
        </div>
        <div class={styles.headerActions}>
          <button
            type="button"
            class={styles.roundAction}
            aria-label={muted() ? 'Turn museum sound on' : 'Mute museum sound'}
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

      <section class={styles.mapSection} aria-label="Floating museum map">
        <div class={styles.mapColumn}>
          <div
            class={styles.mapFrame}
            data-map-state={mapState()}
            data-selected-stage={props.selectedStageId}
          >
            <div class={styles.mapCanvas} ref={mapContainer} />
            <div class={styles.mapLegend} aria-hidden="true">
              <span>Four islands</span>
              <i />
              <span>One singing path</span>
            </div>
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
                  onClick={() => select(chapter.stageId)}
                >
                  <span>{String(index() + 1).padStart(2, '0')}</span>
                  {chapter.title}
                </button>
              )}
            </For>
          </nav>
        </div>

        <Show when={selectedChapter()} keyed>
          {(chapter) => (
            <article class={styles.selectedCard} aria-live="polite">
              <div class={styles.selectedTopline}>
                <span>{chapter.chapterLabel}</span>
                <span>{chapter.progressLabel}</span>
              </div>
              <p class={styles.lesson}>{chapter.lesson}</p>
              <h2>{chapter.title}</h2>
              <p class={styles.description}>{chapter.description}</p>
              <div class={styles.keepsakes}>
                <Show when={chapter.stars !== undefined}>
                  <span
                    class={styles.stars}
                    aria-label={`${chapter.stars} saved pitch ${chapter.stars === 1 ? 'star' : 'stars'}${chapter.historicalGrade ? ', from an earlier challenge edition' : ''}`}
                  >
                    <For each={[1, 2, 3]}>
                      {(star) => (
                        <svg
                          viewBox="0 0 20 20"
                          classList={{
                            [styles.starEarned]: star <= (chapter.stars ?? 0),
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
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </button>
            </article>
          )}
        </Show>
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
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
    </main>
  )
}
