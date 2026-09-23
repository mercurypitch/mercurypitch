// Gallery selection — a persistent museum map around one mounted adventure at a time.
import { createMemo, createSignal, Show } from 'solid-js'
import type { GalleryChapter } from '../content/campaign'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { islandChapterIds, MUSEUM_TRIALS } from '../content/campaign-trials'
import { galleryArtworkForAsset } from '../content/gallery-artworks'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { replayProfilesForLevel } from '../content/replay-profiles'
import { collectionEntry } from '../core/collection'
import { readProgress } from '../core/progress'
import { resolveReplayProfile } from '../core/replay-profile'
import { canEnterReplay, highestReplayTier } from '../core/replay-progress'
import { evaluateTrialUnlock } from '../core/trial-unlock'
import type { GlassGameHost } from '../host'
import { GlassAdventure } from './GlassAdventure'
import { MuseumCollection } from './MuseumCollection'
import { MuseumJourney } from './MuseumJourney'
import { projectMuseumJourneyChapter } from './MuseumJourneyProgress'
import { createReplayVisitHost, loadPreReplayProgress, loadReplayProgress, } from './replay-visit-host'
import { ReplaySelection } from './ReplaySelection'

export function GlassCampaign(props: {
  host: GlassGameHost
  chapters?: readonly GalleryChapter[]
}) {
  const [activeVisit, setActiveVisit] = createSignal<{
    id: string
    replay: boolean
    trial?: boolean
    profileId?: string
    fresh?: boolean
    visit?: number
  } | null>(null)
  const [replayChapterId, setReplayChapterId] = createSignal<string>()
  const [collectionOpen, setCollectionOpen] = createSignal(false)
  let visitSequence = 0
  const [selectedStageId, setSelectedStageId] = createSignal(
    FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
  )
  const [progressRevision, setProgressRevision] = createSignal(0)
  const chapters = () => props.chapters ?? MUSEUM_CAMPAIGN
  const current = createMemo(() => {
    const selection = activeVisit()
    if (selection === null) return undefined
    const chapter =
      selection.trial === true
        ? MUSEUM_TRIALS.find((item) => item.id === selection.id)?.chapter
        : chapters().find((item) => item.id === selection.id)
    if (chapter === undefined) return undefined
    const profiles = profilesFor(chapter)
    const profile = profiles.find(
      (item) => item.profile.id === selection.profileId,
    )
    const replayVisit =
      profile === undefined
        ? undefined
        : createReplayVisitHost(visitHost(), chapter.level, profile, profiles, {
            fresh: selection.fresh === true,
            leaseId: `${Date.now()}:${selection.visit ?? 0}:${Math.random()}`,
          })
    return {
      chapter,
      replay: selection.replay,
      trial: selection.trial === true,
      profile,
      replayVisit,
    }
  })
  const journeyChapters = createMemo(() => {
    progressRevision()
    return chapters().map((chapter) => {
      const stage = FLOATING_MUSEUM_JOURNEY.stages.find((candidate) =>
        candidate.chapterIds.includes(chapter.id),
      )
      const view = projectMuseumJourneyChapter(
        chapter,
        stage?.id ?? FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
        props.host.loadProgress(chapter.level.id),
        props.host.assetUrl,
      )
      const profiles = profilesFor(chapter)
      if (profiles.length === 0) return view
      const stars = highestReplayTier(
        loadReplayProgress(props.host, chapter.level, profiles),
      )
      return {
        ...view,
        stars: stars === 0 ? undefined : stars,
        starKind: 'level' as const,
        historicalGrade: false,
        notGraded: false,
      }
    })
  })
  const visitHost = createMemo<GlassGameHost>(() => ({
    ...props.host,
    onExit: () => {
      setProgressRevision((value) => value + 1)
      setActiveVisit(null)
    },
  }))

  function profilesFor(chapter: GalleryChapter) {
    return replayProfilesForLevel(chapter.level).map((profile) =>
      resolveReplayProfile(chapter.level, profile),
    )
  }

  const replayChoice = createMemo(() => {
    const chapter = chapters().find((item) => item.id === replayChapterId())
    if (!chapter) return undefined
    const profiles = profilesFor(chapter)
    return {
      chapter,
      profiles,
      progress: loadReplayProgress(props.host, chapter.level, profiles),
    }
  })

  const collection = createMemo(() => {
    progressRevision()
    return chapters().flatMap((chapter) => {
      const entry = collectionEntry(
        chapter.level,
        loadReplayProgress(props.host, chapter.level, profilesFor(chapter)),
      )
      return entry === undefined
        ? []
        : [
            {
              ...entry,
              artwork: galleryArtworkForAsset(
                entry.summary.portrait!.imageAssetId,
              ),
            },
          ]
    })
  })

  function progressFor(chapter: GalleryChapter) {
    return readProgress(
      chapter.level,
      props.host.loadProgress(chapter.level.id),
    )
  }

  function unlockFor(islandId: string) {
    const host = props.host
    const currentChapters = chapters()
    const requirements = currentChapters.map((chapter) => ({
      chapterId: chapter.id,
      title: chapter.level.title,
      level: chapter.level,
    }))
    const historical = evaluateTrialUnlock(
      islandChapterIds(FLOATING_MUSEUM_JOURNEY, islandId),
      requirements,
      (id) => loadPreReplayProgress(host, id),
    )
    return evaluateTrialUnlock(
      islandChapterIds(FLOATING_MUSEUM_JOURNEY, islandId),
      chapters().map((chapter) => ({
        chapterId: chapter.id,
        title: chapter.level.title,
        level: chapter.level,
      })),
      host.loadProgress,
      (id) => {
        const chapter = currentChapters.find((item) => item.level.id === id)
        if (!chapter) return undefined
        const profiles = profilesFor(chapter)
        if (profiles.length === 0) return undefined
        return {
          stars: highestReplayTier(
            loadReplayProgress(host, chapter.level, profiles),
          ),
          previouslyUnlocked:
            historical.chapters.find((item) => item.chapterId === chapter.id)
              ?.ready === true,
        }
      },
    )
  }

  const trials = createMemo(() => {
    progressRevision()
    return MUSEUM_TRIALS.map((trial) => ({
      id: trial.id,
      islandTitle: trial.islandTitle,
      title: trial.chapter.level.title,
      description: trial.chapter.description,
      imageUrl: props.host.assetUrl(trial.chapter.imageAsset),
      replay: progressFor(trial.chapter).finished === true,
      unlock: unlockFor(trial.islandId),
    }))
  })

  function enterTrial(id: string): void {
    const trial = MUSEUM_TRIALS.find((candidate) => candidate.id === id)
    // Enforce again at the route boundary, independently of the disabled button.
    if (trial === undefined) return
    if (!unlockFor(trial.islandId).unlocked) {
      setProgressRevision((value) => value + 1)
      return
    }
    setActiveVisit({
      id,
      trial: true,
      replay: progressFor(trial.chapter).finished === true,
    })
  }

  function enter(chapter: GalleryChapter): void {
    const progress = progressFor(chapter)
    const stage = FLOATING_MUSEUM_JOURNEY.stages.find((candidate) =>
      candidate.chapterIds.includes(chapter.id),
    )
    if (stage !== undefined) setSelectedStageId(stage.id)
    const profiles = profilesFor(chapter)
    if (profiles.length > 0) {
      const saved = loadReplayProgress(props.host, chapter.level, profiles)
      if (saved.legacyCompleted || saved.clears.length > 0) {
        setActiveVisit(null)
        setProgressRevision((value) => value + 1)
        setReplayChapterId(chapter.id)
        return
      }
      // Finish an in-flight pre-profile visit without discarding its checkpoint.
      const legacyVisit =
        saved.attempts.length === 0 &&
        (progress.completedBreakableIds.length > 0 ||
          progress.checkpointId !== chapter.level.spawn.checkpointId)
      if (!legacyVisit) {
        beginReplay(chapter, profiles[0]!.profile.id, false)
        return
      }
    }
    setActiveVisit({ id: chapter.id, replay: progress.finished === true })
  }

  function beginReplay(
    chapter: GalleryChapter,
    profileId: string,
    fresh: boolean,
  ): void {
    const profiles = profilesFor(chapter)
    const profile = profiles.find((item) => item.profile.id === profileId)
    if (
      !profile ||
      !canEnterReplay(
        loadReplayProgress(props.host, chapter.level, profiles),
        profile,
      )
    )
      return
    setReplayChapterId(undefined)
    setActiveVisit({
      id: chapter.id,
      replay: false,
      profileId,
      fresh,
      visit: ++visitSequence,
    })
  }

  return (
    <Show
      when={current()}
      keyed
      fallback={
        <>
          <div inert={replayChoice() !== undefined || collectionOpen()}>
            <MuseumJourney
              definition={FLOATING_MUSEUM_JOURNEY}
              chapters={journeyChapters()}
              trials={trials()}
              onEnterTrial={enterTrial}
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
              onOpenCollection={() => setCollectionOpen(true)}
            />
          </div>
          <Show when={replayChoice()} keyed>
            {(choice) => (
              <ReplaySelection
                title={choice.chapter.level.title}
                imageUrl={props.host.assetUrl(choice.chapter.imageAsset)}
                profiles={choice.profiles}
                progress={choice.progress}
                onChoose={(id, fresh) => beginReplay(choice.chapter, id, fresh)}
                onClose={() => setReplayChapterId(undefined)}
              />
            )}
          </Show>
          <Show when={collectionOpen()}>
            <MuseumCollection
              entries={collection()}
              assetUrl={props.host.assetUrl}
              onClose={() => setCollectionOpen(false)}
              onVisit={(levelId) => {
                setCollectionOpen(false)
                const chapter = chapters().find(
                  (item) => item.level.id === levelId,
                )
                if (chapter !== undefined) enter(chapter)
              }}
            />
          </Show>
        </>
      }
    >
      {(selection) => {
        const chapter = selection.chapter
        const next = () =>
          selection.trial
            ? undefined
            : chapters().at(
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
            host={selection.replayVisit?.host ?? visitHost()}
            level={selection.profile?.level ?? chapter.level}
            freshStart={selection.replay}
            onRestart={
              selection.profile
                ? () =>
                    beginReplay(chapter, selection.profile!.profile.id, true)
                : undefined
            }
            replayGoal={
              selection.profile
                ? {
                    title: selection.profile.profile.title,
                    tier: selection.profile.profile.tier,
                  }
                : undefined
            }
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
