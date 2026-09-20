// Gallery selection — one mounted adventure at a time, with independent route progress.
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { GalleryChapter } from '../content/campaign'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { readProgress } from '../core/progress'
import type { GlassGameHost } from '../host'
import { GlassAdventure } from './GlassAdventure'
import styles from './GlassCampaign.module.css'

export function GlassCampaign(props: {
  host: GlassGameHost
  chapters?: readonly GalleryChapter[]
}) {
  const [selected, setSelected] = createSignal<{
    id: string
    replay: boolean
  } | null>(null)
  const [progressRevision, setProgressRevision] = createSignal(0)
  const chapters = () => props.chapters ?? MUSEUM_CAMPAIGN
  const current = createMemo(() => {
    const selection = selected()
    if (selection === null) return undefined
    const chapter = chapters().find((item) => item.id === selection.id)
    return chapter === undefined
      ? undefined
      : { chapter, replay: selection.replay }
  })
  const cards = createMemo(() => {
    progressRevision()
    return chapters().map((chapter) => ({
      chapter,
      progress: readProgress(
        chapter.level,
        props.host.loadProgress(chapter.level.id),
      ),
    }))
  })
  const visitHost = createMemo<GlassGameHost>(() => ({
    ...props.host,
    onExit: () => {
      setProgressRevision((value) => value + 1)
      setSelected(null)
    },
  }))

  function progressFor(chapter: GalleryChapter) {
    return readProgress(
      chapter.level,
      props.host.loadProgress(chapter.level.id),
    )
  }

  function enter(chapter: GalleryChapter): void {
    const progress = progressFor(chapter)
    setSelected({ id: chapter.id, replay: progress.finished === true })
  }

  return (
    <Show
      when={current()}
      keyed
      fallback={
        <main
          class={styles.lobby}
          aria-labelledby="glass-campaign-title"
          data-testid="glass-campaign"
        >
          <div class={styles.inner}>
            <header class={styles.header}>
              <div>
                <span class={styles.eyebrow}>MercuryPitch / Glassworks</span>
                <h1 id="glass-campaign-title">
                  Every gallery begins
                  <br />
                  with a breath.
                </h1>
              </div>
              <button
                type="button"
                class={styles.leave}
                aria-label="Leave Glassworks"
                onClick={() => props.host.onExit()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14 6-6 6 6 6" />
                </svg>
              </button>
            </header>
            <p class={styles.introduction}>
              Choose a gallery. Explore at your own pace, and let your voice do
              the glasswork.
            </p>
            <div class={styles.chapters}>
              <For each={cards()}>
                {({ chapter, progress }) => {
                  const completed = chapter.level.breakables.filter(
                    (item) =>
                      !item.optional &&
                      progress.completedBreakableIds.includes(item.id),
                  ).length
                  const total = chapter.level.breakables.filter(
                    (item) => !item.optional,
                  ).length
                  const visited =
                    progress.completedBreakableIds.length > 0 ||
                    progress.checkpointId !==
                      (chapter.level.spawn.checkpointId ??
                        chapter.level.checkpoints[0]?.id)
                  return (
                    <button
                      class={styles.chapter}
                      type="button"
                      onClick={() => enter(chapter)}
                      aria-label={`${progress.finished === true ? 'Replay' : visited ? 'Continue' : 'Enter'} ${chapter.level.title}`}
                    >
                      <div class={styles.art}>
                        <img
                          src={props.host.assetUrl(chapter.imageAsset)}
                          alt=""
                        />
                        <span class={styles.chapterNumber}>
                          {chapter.chapter}
                        </span>
                      </div>
                      <div class={styles.label}>
                        <span class={styles.lesson}>{chapter.lesson}</span>
                        <h2>{chapter.level.title}</h2>
                        <p>{chapter.description}</p>
                        <div class={styles.status}>
                          <span>
                            {progress.finished === true
                              ? 'Gallery complete'
                              : completed > 0
                                ? `${completed} of ${total} exhibits opened`
                                : `${total} voice discoveries`}
                          </span>
                          <strong>
                            {progress.finished === true
                              ? 'Replay gallery'
                              : visited
                                ? 'Continue'
                                : 'Step inside'}
                            <span aria-hidden="true"> →</span>
                          </strong>
                        </div>
                      </div>
                    </button>
                  )
                }}
              </For>
            </div>
            <p class={styles.footnote}>
              Your progress stays with each gallery. A gentle hum is always
              welcome.
            </p>
          </div>
        </main>
      }
    >
      {(selection) => {
        const chapter = selection.chapter
        const next = () =>
          chapters().at(
            chapters().findIndex((item) => item.id === chapter.id) + 1,
          )
        const nextLabel = () => {
          const destination = next()
          if (destination === undefined) return undefined
          const verb =
            progressFor(destination).finished === true ? 'Replay' : 'Visit'
          return `${verb} ${destination.level.title}`
        }
        return (
          <GlassAdventure
            host={visitHost()}
            level={chapter.level}
            freshStart={selection.replay}
            onContinue={
              next() !== undefined
                ? () => {
                    const destination = next()
                    if (destination !== undefined) enter(destination)
                  }
                : undefined
            }
            continueLabel={nextLabel()}
          />
        )
      }}
    </Show>
  )
}
