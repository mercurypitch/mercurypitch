// Gallery selection — a persistent museum map around one mounted adventure at a time.
import { createMemo, createSignal, Show } from 'solid-js'
import type { GalleryChapter } from '../content/campaign'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { readProgress } from '../core/progress'
import type { GlassGameHost } from '../host'
import { GlassAdventure } from './GlassAdventure'
import { MuseumJourney } from './MuseumJourney'
import { projectMuseumJourneyChapter } from './MuseumJourneyProgress'

export function GlassCampaign(props: {
  host: GlassGameHost
  chapters?: readonly GalleryChapter[]
}) {
  const [activeVisit, setActiveVisit] = createSignal<{
    id: string
    replay: boolean
  } | null>(null)
  const [selectedStageId, setSelectedStageId] = createSignal(
    FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
  )
  const [progressRevision, setProgressRevision] = createSignal(0)
  const chapters = () => props.chapters ?? MUSEUM_CAMPAIGN
  const current = createMemo(() => {
    const selection = activeVisit()
    if (selection === null) return undefined
    const chapter = chapters().find((item) => item.id === selection.id)
    return chapter === undefined
      ? undefined
      : { chapter, replay: selection.replay }
  })
  const journeyChapters = createMemo(() => {
    progressRevision()
    return chapters().map((chapter) => {
      const stage = FLOATING_MUSEUM_JOURNEY.stages.find((candidate) =>
        candidate.chapterIds.includes(chapter.id),
      )
      return projectMuseumJourneyChapter(
        chapter,
        stage?.id ?? FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
        props.host.loadProgress(chapter.level.id),
        props.host.assetUrl,
      )
    })
  })
  const visitHost = createMemo<GlassGameHost>(() => ({
    ...props.host,
    onExit: () => {
      setProgressRevision((value) => value + 1)
      setActiveVisit(null)
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
    const stage = FLOATING_MUSEUM_JOURNEY.stages.find((candidate) =>
      candidate.chapterIds.includes(chapter.id),
    )
    if (stage !== undefined) setSelectedStageId(stage.id)
    setActiveVisit({ id: chapter.id, replay: progress.finished === true })
  }

  return (
    <Show
      when={current()}
      keyed
      fallback={
        <MuseumJourney
          definition={FLOATING_MUSEUM_JOURNEY}
          chapters={journeyChapters()}
          selectedStageId={selectedStageId()}
          assetUrl={props.host.assetUrl}
          createMusic={props.host.createMusic}
          subscribeForeground={props.host.subscribeForeground}
          onSelect={setSelectedStageId}
          onEnter={(chapterId) => {
            const chapter = chapters().find((item) => item.id === chapterId)
            if (chapter !== undefined) enter(chapter)
          }}
          onExit={() => props.host.onExit()}
        />
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
