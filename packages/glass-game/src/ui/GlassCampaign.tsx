// Gallery selection — a persistent museum map around one mounted adventure at a time.
import { createMemo, createSignal, Show } from 'solid-js'
import type { GalleryChapter } from '../content/campaign'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { islandChapterIds, MUSEUM_TRIALS } from '../content/campaign-trials'
import { GALLERY_ENCORES } from '../content/encores'
import { galleryArtworkForAsset } from '../content/gallery-artworks'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { replayProfilesForLevel } from '../content/replay-profiles'
import { campaignChapterAccess } from '../core/campaign-access'
import { collectionEntry } from '../core/collection'
import { readProgress } from '../core/progress'
import { resolveReplayProfile } from '../core/replay-profile'
import { canEnterReplay, highestReplayTier } from '../core/replay-progress'
import { evaluateTrialUnlock } from '../core/trial-unlock'
import type { GlassGameHost } from '../host'
import type { GlassAssetQualityProfile } from '../render/render-quality'
import { createCampaignSessionHost } from './campaign-session-host'
import { nextReplayDifficulty } from './completion-progression'
import { createEncoreAudioLeaseOwner } from './encore-audio-lease'
import { GameUIProvider } from './GameUI'
import { GlassAdventure } from './GlassAdventure'
import { MuseumCollection } from './MuseumCollection'
import type { MuseumJourneyAudio } from './MuseumJourney'
import { MuseumJourney } from './MuseumJourney'
import { projectMuseumJourneyChapter } from './MuseumJourneyProgress'
import { createReplayVisitHost, loadPreReplayProgress, loadReplayProgress, } from './replay-visit-host'
import { ReplaySelection } from './ReplaySelection'
import { SongRunnerScreen } from './SongRunnerScreen'

export function GlassCampaign(props: {
  host: GlassGameHost
  chapters?: readonly GalleryChapter[]
  /** Host build policy only; this never writes earned progress or stars. */
  developmentUnlock?: boolean
  /** Fixed startup bundle tier supplied by a size-bounded native host. */
  assetProfile?: GlassAssetQualityProfile
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
  const [runnerOpen, setRunnerOpen] = createSignal(false)
  let visitSequence = 0
  let mapAudio: MuseumJourneyAudio | undefined
  const collectionEncoreAudioLeases = createEncoreAudioLeaseOwner(
    () => mapAudio?.silenceForVoice() ?? Promise.resolve(),
    () => mapAudio?.releaseVoice(),
  )
  const [selectedStageId, setSelectedStageId] = createSignal(
    FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
  )
  const [progressRevision, setProgressRevision] = createSignal(0)
  const campaignHost = createMemo(() => createCampaignSessionHost(props.host))
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
      const projected = projectMuseumJourneyChapter(
        chapter,
        stage?.id ?? FLOATING_MUSEUM_JOURNEY.stages[0]!.id,
        campaignHost().loadProgress(chapter.level.id),
        campaignHost().assetUrl,
      )
      const access = chapterAccess(chapter.id)
      const view = {
        ...projected,
        ...(access.unlocked
          ? {}
          : {
              lockedReason: `Finish ${access.blockedBy?.title ?? 'the previous gallery'} first`,
            }),
      }
      const profiles = profilesFor(chapter)
      if (profiles.length === 0) return view
      const stars = highestReplayTier(
        loadReplayProgress(campaignHost(), chapter.level, profiles),
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
    ...campaignHost(),
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

  function chapterAccess(chapterId: string) {
    return campaignChapterAccess(
      chapterId,
      chapters(),
      campaignHost().loadProgress,
      props.developmentUnlock === true,
    )
  }

  const replayChoice = createMemo(() => {
    const chapter = chapters().find((item) => item.id === replayChapterId())
    if (!chapter) return undefined
    const profiles = profilesFor(chapter)
    return {
      chapter,
      profiles,
      progress: loadReplayProgress(campaignHost(), chapter.level, profiles),
    }
  })

  const collection = createMemo(() => {
    progressRevision()
    return chapters().flatMap((chapter) => {
      const entry = collectionEntry(
        chapter.level,
        loadReplayProgress(campaignHost(), chapter.level, profilesFor(chapter)),
      )
      return entry === undefined
        ? []
        : [
            {
              ...entry,
              encore:
                GALLERY_ENCORES[
                  chapter.level.authored?.levelId ?? chapter.level.id
                ],
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
      campaignHost().loadProgress(chapter.level.id),
    )
  }

  function unlockFor(islandId: string) {
    const host = campaignHost()
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
    const earned = evaluateTrialUnlock(
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
    const earlierRouteComplete = islandChapterIds(
      FLOATING_MUSEUM_JOURNEY,
      islandId,
    ).every((chapterId) => chapterAccess(chapterId).unlocked)
    return {
      ...earned,
      unlocked:
        props.developmentUnlock === true ||
        (earned.unlocked && earlierRouteComplete),
    }
  }

  const trials = createMemo(() => {
    progressRevision()
    return MUSEUM_TRIALS.map((trial) => ({
      id: trial.id,
      islandId: trial.islandId,
      islandTitle: trial.islandTitle,
      title: trial.chapter.level.title,
      description: trial.chapter.description,
      imageUrl: campaignHost().assetUrl(trial.chapter.imageAsset),
      replay: progressFor(trial.chapter).finished === true,
      unlock: unlockFor(trial.islandId),
      previewUnlocked: props.developmentUnlock === true,
    }))
  })

  function runnerUnlocked(): boolean {
    progressRevision()
    if (props.developmentUnlock === true) return true
    const prologue = chapters().find((chapter) => chapter.id === 'first-light')
    return prologue !== undefined && progressFor(prologue).finished === true
  }

  function enterRunner(): void {
    if (runnerUnlocked()) setRunnerOpen(true)
  }

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
    if (!chapterAccess(chapter.id).unlocked) {
      setProgressRevision((value) => value + 1)
      return
    }
    const progress = progressFor(chapter)
    const stage = FLOATING_MUSEUM_JOURNEY.stages.find((candidate) =>
      candidate.chapterIds.includes(chapter.id),
    )
    if (stage !== undefined) setSelectedStageId(stage.id)
    const profiles = profilesFor(chapter)
    if (profiles.length > 0) {
      const saved = loadReplayProgress(campaignHost(), chapter.level, profiles)
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
    if (!chapterAccess(chapter.id).unlocked) {
      setReplayChapterId(undefined)
      setProgressRevision((value) => value + 1)
      return
    }
    const profiles = profilesFor(chapter)
    const profile = profiles.find((item) => item.profile.id === profileId)
    if (
      !profile ||
      !canEnterReplay(
        loadReplayProgress(campaignHost(), chapter.level, profiles),
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
    <GameUIProvider host={campaignHost()}>
      <Show
        when={runnerOpen()}
        fallback={
          <Show
            when={current()}
            keyed
            fallback={
              <>
                <div inert={replayChoice() !== undefined || collectionOpen()}>
                  <MuseumJourney
                    host={campaignHost()}
                    definition={FLOATING_MUSEUM_JOURNEY}
                    developmentUnlock={props.developmentUnlock}
                    chapters={journeyChapters()}
                    trials={trials()}
                    onEnterTrial={enterTrial}
                    runnerUnlocked={runnerUnlocked()}
                    onEnterRunner={enterRunner}
                    selectedStageId={selectedStageId()}
                    assetUrl={campaignHost().assetUrl}
                    createMusic={campaignHost().createMusic}
                    subscribeForeground={campaignHost().subscribeForeground}
                    onSelect={setSelectedStageId}
                    onEnter={(chapterId) => {
                      const chapter = chapters().find(
                        (item) => item.id === chapterId,
                      )
                      if (chapter !== undefined) enter(chapter)
                    }}
                    onExit={() => campaignHost().onExit()}
                    onOpenCollection={() => setCollectionOpen(true)}
                    covered={collectionOpen() || replayChoice() !== undefined}
                    onAudioReady={(audio) => {
                      mapAudio = audio
                    }}
                  />
                </div>
                <Show when={replayChoice()} keyed>
                  {(choice) => (
                    <ReplaySelection
                      title={choice.chapter.level.title}
                      imageUrl={campaignHost().assetUrl(
                        choice.chapter.imageAsset,
                      )}
                      profiles={choice.profiles}
                      progress={choice.progress}
                      onChoose={(id, fresh) =>
                        beginReplay(choice.chapter, id, fresh)
                      }
                      onClose={() => setReplayChapterId(undefined)}
                    />
                  )}
                </Show>
                <Show when={collectionOpen()}>
                  <MuseumCollection
                    entries={collection()}
                    host={campaignHost()}
                    audioLeases={collectionEncoreAudioLeases}
                    assetUrl={campaignHost().assetUrl}
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
              const replayProfiles = profilesFor(chapter)
              const next = () =>
                selection.trial
                  ? undefined
                  : chapters().at(
                      chapters().findIndex((item) => item.id === chapter.id) +
                        1,
                    )
              const nextLabel = () => {
                const destination = next()
                if (destination === undefined) return undefined
                const verb =
                  progressFor(destination).finished === true
                    ? 'Replay'
                    : 'Visit'
                return `${verb} ${destination.level.title}`
              }
              const nextDifficulty = () => {
                const currentProfile = selection.profile
                if (currentProfile === undefined) return undefined
                const earned = highestReplayTier(
                  loadReplayProgress(
                    campaignHost(),
                    chapter.level,
                    replayProfiles,
                  ),
                )
                const profile = nextReplayDifficulty(
                  replayProfiles,
                  currentProfile.profile.tier,
                  earned,
                )
                if (profile === undefined || profile.profile.tier === 1)
                  return undefined
                return {
                  label: profile.profile.title,
                  tier: profile.profile.tier,
                  onSelect: () =>
                    beginReplay(chapter, profile.profile.id, true),
                }
              }
              return (
                <GlassAdventure
                  host={selection.replayVisit?.host ?? visitHost()}
                  level={selection.profile?.level ?? chapter.level}
                  assetProfile={props.assetProfile}
                  freshStart={selection.replay}
                  onRestart={
                    selection.profile
                      ? () =>
                          beginReplay(
                            chapter,
                            selection.profile!.profile.id,
                            true,
                          )
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
                  nextLevelName={next()?.level.title}
                  nextDifficulty={nextDifficulty()}
                />
              )
            }}
          </Show>
        }
      >
        <SongRunnerScreen
          exitLabel="Museum"
          host={campaignHost()}
          assetProfile={props.assetProfile}
          onExit={() => {
            setProgressRevision((value) => value + 1)
            setRunnerOpen(false)
          }}
        />
      </Show>
    </GameUIProvider>
  )
}
