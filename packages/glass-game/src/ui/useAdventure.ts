// Adventure session — orchestrates host services without putting UI or audio in the game core.
import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import type { GalleryArtwork } from '../content/gallery-artworks'
import { galleryArtwork } from '../content/gallery-artworks'
import { museumSoundscape } from '../content/soundscapes'
import type { GameEvent, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassGameHost, MuseumAudioPreferences } from '../host'
import type { LoadingProgress } from '../loading-progress'
import type { GlassRenderer } from '../render/glass-renderer'
import { createGlassRenderer } from '../render/glass-renderer'
import type { GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import { GLASS_RENDER_QUALITY_PREFERENCE, parseGlassRenderQualityPreference, } from '../render/render-quality'
import { EXIT_CELEBRATION_SECONDS, EXIT_REDUCED_CELEBRATION_SECONDS, } from '../render/resonance-portal'
import { initialAdventureNotice } from './adventure-notice'
import type { CameraComfortSettings } from './camera-comfort'
import { CAMERA_COMFORT_PREFERENCE, normalizeCameraComfort, parseCameraComfort, serializeCameraComfort, } from './camera-comfort'
import { createAdventureInput, isAdventureEditableTarget } from './input'
import type { AdventureLoadingPhase } from './loading-lifecycle'
import { createAdventureLoadingLifecycle } from './loading-lifecycle'
import type { MicrophoneIssue, MicrophoneRecoveryAction } from './mic-error'
import { microphoneTakeoverTimedOut } from './mic-error'
import { createAdventureNarration } from './narration'
import { createAdventureSoundscape } from './soundscape'
import { hasSeenTutorial, markTutorialSeen } from './tutorial-progress'
import type { VoiceChallengeSnapshot } from './voice-challenge'
import { createVoiceChallenge } from './voice-challenge'

const LOADING_PRESENTATION_MS = 2000
const ASSET_LOAD_ERROR =
  'The gallery could not finish loading. Check your connection, then retry.'
const GRAPHICS_LOAD_ERROR =
  'The graphics connection stopped. Your progress is safe. Retry the gallery.'
const GRAPHICS_SUPPORT_ERROR =
  'The museum needs 3D graphics support. Close other demanding apps, then retry.'

export function useAdventure(
  host: GlassGameHost,
  level: LevelDefinition,
  mount: () => HTMLElement,
  presentationCovered: () => boolean = () => false,
) {
  const game = createGlassGame(level, host.loadProgress(level.id))
  const initialSnapshot = game.snapshot()
  const input = createAdventureInput()
  const [cameraComfort, setCameraComfort] = createSignal(
    parseCameraComfort(host.readPreference(CAMERA_COMFORT_PREFERENCE)),
  )
  const [renderQualityPreference, setRenderQualityPreference] = createSignal(
    parseGlassRenderQualityPreference(
      host.readPreference(GLASS_RENDER_QUALITY_PREFERENCE),
    ),
  )
  const [renderQualityProfile, setRenderQualityProfile] =
    createSignal<GlassRenderQualityProfile>('high')
  const [snapshot, setSnapshot] = createSignal(initialSnapshot)
  const [completionPresented, setCompletionPresented] = createSignal(
    initialSnapshot.complete,
  )
  const [loadingPhase, setLoadingPhase] =
    createSignal<AdventureLoadingPhase>('loading-assets')
  const [loadingProgress, setLoadingProgress] = createSignal<LoadingProgress>({
    completedUnits: 0,
    totalUnits: 0,
  })
  const [loadingGeneration, setLoadingGeneration] = createSignal(0)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const ready = () => loadingPhase() === 'ready'
  const [error, setError] = createSignal<string | null>(null)
  const [microphoneIssue, setMicrophoneIssue] =
    createSignal<MicrophoneIssue | null>(null)
  const [microphoneRecoveryPending, setMicrophoneRecoveryPending] =
    createSignal(false)
  const [voiceState, setVoiceState] = createSignal<VoiceChallengeSnapshot>()
  const voiceMode = () => voiceState()?.mode ?? 'off'
  const voicePanelVisible = createMemo(() => voiceMode() !== 'off')
  const [challengeSafeBottom, setChallengeSafeBottom] = createSignal<number>()
  const [challengeCamera, setChallengeCamera] = createSignal<ReturnType<
    GlassRenderer['getChallengeCameraMetrics']
  > | null>(null)
  const pitch = () => voiceState()?.pitch ?? null
  const target = () => voiceState()?.target ?? null
  const [notice, setNotice] = createSignal(
    initialAdventureNotice(level, initialSnapshot),
  )
  const [narrationCaption, setNarrationCaption] = createSignal('')
  const [paused, setPaused] = createSignal(false)
  const [inspection, setInspection] = createSignal<GalleryArtwork | null>(null)
  const [nearbyArtwork, setNearbyArtwork] = createSignal<string | null>(null)
  const [tutorial, setTutorial] = createSignal(!hasSeenTutorial(host, level))
  const music = host.createMusic?.()
  const [audioPreferences, setAudioPreferences] = createSignal(
    music?.preferences(),
  )
  const soundscape = createAdventureSoundscape(
    music,
    (previous) =>
      museumSoundscape(level, game.snapshot().player.position, previous),
    () => alive && ready() && !paused() && !tutorial(),
  )
  const narration = createAdventureNarration(
    host.createNarration?.(),
    () => alive && ready() && !paused() && !tutorial(),
  )
  const [narrationPreferences, setNarrationPreferences] = createSignal(
    narration.preferences(),
  )
  let renderer: GlassRenderer | null = null
  let alive = true
  let rendererGeneration = 0
  let frameId = 0
  let lastTime = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let narrationCaptionTimer: ReturnType<typeof setTimeout> | undefined
  let completionTimer: ReturnType<typeof setTimeout> | undefined
  let reducedMotion = false
  let lastArtworkCheck = 0
  let lastCameraMetricsAt = -Infinity
  const loading = createAdventureLoadingLifecycle({
    minimumVisibleMs: LOADING_PRESENTATION_MS,
    onChange: (state) => {
      if (!alive) return
      setLoadingGeneration(state.generation)
      setLoadingProgress(state.progress)
      setLoadingPhase(state.phase)
      setLoadError(state.error)
      if (state.phase !== 'ready') return
      game.setPaused(paused() || tutorial())
      lastTime = 0
      refresh()
    },
  })
  game.setPaused(untrack(tutorial))

  function refresh(): void {
    setSnapshot(game.snapshot())
  }

  function cancel(): void {
    clearNarrationCaption()
    narration.pause()
    voiceChallenge.cancel()
    input.clear()
    refresh()
  }

  function announce(message: string): void {
    clearTimeout(noticeTimer)
    setNotice(message)
    noticeTimer = setTimeout(() => {
      if (alive) setNotice('')
    }, 5000)
  }

  function clearNarrationCaption(): void {
    clearTimeout(narrationCaptionTimer)
    narrationCaptionTimer = undefined
    setNarrationCaption('')
  }

  function showNarrationCaption(caption: string): void {
    clearNarrationCaption()
    setNarrationCaption(caption)
    narrationCaptionTimer = setTimeout(() => {
      if (alive) setNarrationCaption('')
    }, 5000)
  }

  function presentCompletion(): void {
    clearTimeout(completionTimer)
    completionTimer = undefined
    if (alive) setCompletionPresented(true)
  }

  function scheduleCompletionFallback(): void {
    clearTimeout(completionTimer)
    const seconds = reducedMotion
      ? EXIT_REDUCED_CELEBRATION_SECONDS
      : EXIT_CELEBRATION_SECONDS
    completionTimer = setTimeout(presentCompletion, seconds * 1000 + 100)
  }

  function events(batch: GameEvent[]): void {
    for (const event of batch) {
      if (event.type === 'break') {
        // This write precedes the fracture, its sound and bridge presentation.
        host.saveProgress(game.saveProgress())
        voiceChallenge.completeBreak()
        const item = level.breakables.find(
          (candidate) => candidate.id === event.id,
        )
        const reaction = narration.breakCompleted(item?.optional === true)
        showNarrationCaption(reaction.caption)
        const authoredNotice = level.guidance?.encounterSuccessNotices?.find(
          (notice) => notice.encounterId === event.id,
        )?.notice
        announce(
          authoredNotice ??
            (item?.optional === true
              ? 'Optional exhibit opened. Explore, or continue to the exit.'
              : 'Beautiful. A new path is open.'),
        )
      } else if (event.type === 'checkpoint') {
        host.saveProgress(game.saveProgress())
      } else if (event.type === 'complete') {
        host.saveProgress(game.saveProgress())
        input.clear()
        renderer?.cancelHeadingFollow()
        scheduleCompletionFallback()
      } else if (event.type === 'respawn') {
        input.clear()
        renderer?.cancelHeadingFollow()
        announce('Back on solid ground. Your progress is safe.')
      }
    }
  }

  const voiceChallenge = createVoiceChallenge({
    host,
    game,
    level,
    canPlay: () => alive && ready() && !paused() && !tutorial(),
    beforeCapture: () =>
      Promise.all([
        soundscape.silenceForVoice(),
        narration.silenceForVoice(),
      ]).then(() => undefined),
    onChange: (next) => {
      if (alive) setVoiceState(next)
      refresh()
    },
    onEvents: events,
    onError: (message, microphone) => {
      setError(message)
      setMicrophoneIssue(microphone ?? null)
    },
    onPauseAudio: () => soundscape.pause(),
    onReleaseVoice: () => {
      narration.releaseVoice()
      soundscape.releaseVoice()
    },
  })

  async function start(): Promise<void> {
    clearNarrationCaption()
    const id = game.snapshot().nearbyBreakableId
    if (
      id === null ||
      !ready() ||
      paused() ||
      tutorial() ||
      voiceMode() !== 'off'
    )
      return
    setError(null)
    setMicrophoneIssue(null)
    input.clear()
    await voiceChallenge.start(id)
  }

  function microphoneRecoveryAction(): MicrophoneRecoveryAction {
    const action = microphoneIssue()?.action ?? 'none'
    if (action === 'take-over' && host.takeOverMicrophone === undefined)
      return 'none'
    return action
  }

  async function releaseUnusedMicrophoneTakeover(): Promise<void> {
    try {
      await host.releaseUnusedMicrophoneTakeover?.()
    } catch {
      // A later acquisition rechecks the shared lock; cleanup must stay silent.
    }
  }

  async function recoverMicrophone(): Promise<void> {
    const action = microphoneRecoveryAction()
    if (action === 'none' || microphoneRecoveryPending()) return
    if (action === 'retry') {
      await start()
      return
    }
    const takeOver = host.takeOverMicrophone
    if (takeOver === undefined) return
    setMicrophoneRecoveryPending(true)
    let moved = false
    try {
      moved = await takeOver()
      if (!alive) {
        if (moved) await releaseUnusedMicrophoneTakeover()
        return
      }
      if (!moved) {
        const issue = microphoneTakeoverTimedOut()
        setMicrophoneIssue(issue)
        setError(issue.message)
        return
      }
      setMicrophoneIssue(null)
      setError(null)
      await start()
      if (voiceMode() === 'off') await releaseUnusedMicrophoneTakeover()
    } catch {
      if (!alive) {
        if (moved) await releaseUnusedMicrophoneTakeover()
        return
      }
      const issue = microphoneTakeoverTimedOut()
      setMicrophoneIssue(issue)
      setError(issue.message)
      if (moved) await releaseUnusedMicrophoneTakeover()
    } finally {
      if (alive) setMicrophoneRecoveryPending(false)
    }
  }

  function pause(): void {
    setInspection(null)
    soundscape.pause()
    setPaused(true)
    cancel()
    game.setPaused(true)
    refresh()
  }

  function resume(): void {
    setInspection(null)
    input.clear()
    setPaused(false)
    game.setPaused(tutorial())
    lastTime = 0
    refresh()
    soundscape.activate()
  }

  function inspectArtwork(recipeId: string | null): void {
    const artwork = galleryArtwork(recipeId)
    if (
      !artwork ||
      !ready() ||
      paused() ||
      tutorial() ||
      voiceMode() !== 'off' ||
      game.snapshot().phase === 'shattering' ||
      game.snapshot().complete
    )
      return
    pause()
    renderer?.setMovementActive(false)
    renderer?.setOrbitActive(false)
    setInspection(artwork)
  }

  function closeInspection(): void {
    if (inspection() === null) return
    resume()
    queueMicrotask(() =>
      untrack(() => {
        if (alive && ready() && !paused() && !tutorial())
          mount().focus({ preventScroll: true })
      }),
    )
  }

  function closeTutorial(): void {
    markTutorialSeen(host, level)
    setTutorial(false)
    game.setPaused(paused())
    input.clear()
    refresh()
    gameplayGesture()
  }

  function showTutorial(): void {
    setInspection(null)
    soundscape.pause()
    setTutorial(true)
    cancel()
    game.setPaused(true)
    refresh()
  }

  function changeNote(): void {
    voiceChallenge.refind()
    refresh()
  }

  function replay(): void {
    void voiceChallenge.replay()
  }

  function changeAudio(patch: Partial<MuseumAudioPreferences>): void {
    music?.setPreferences(patch)
    setAudioPreferences(music?.preferences())
  }

  function changeNarration(enabled: boolean): void {
    narration.setEnabled(enabled)
    setNarrationPreferences(narration.preferences())
  }

  function changeCameraComfort(next: CameraComfortSettings): void {
    const normalized = normalizeCameraComfort(next)
    setCameraComfort(normalized)
    host.writePreference(
      CAMERA_COMFORT_PREFERENCE,
      serializeCameraComfort(normalized),
    )
    renderer?.setFollowSmoothness(normalized.followSmoothnessSeconds)
  }

  function changeRenderQuality(next: GlassRenderQualityPreference): void {
    const preference = parseGlassRenderQualityPreference(next)
    setRenderQualityPreference(preference)
    host.writePreference(GLASS_RENDER_QUALITY_PREFERENCE, preference)
    renderer?.setRenderQuality(preference)
    const profile = renderer?.getRenderQuality().profile
    if (profile !== undefined) setRenderQualityProfile(profile)
  }

  function gameplayGesture(): void {
    if (!ready()) return
    soundscape.activate()
    narration.welcomeGesture()
  }

  function prepareForLoading(): void {
    setInspection(null)
    setNearbyArtwork(null)
    soundscape.pause()
    cancel()
    input.clear()
    renderer?.setMovementActive(false)
    renderer?.setOrbitActive(false)
    game.setPaused(true)
    refresh()
  }

  function failRendererAttempt(
    generation: number,
    message: string,
    attempt: GlassRenderer | null,
  ): void {
    if (!loading.fail(generation, message)) return
    setInspection(null)
    setNearbyArtwork(null)
    soundscape.pause()
    cancel()
    game.setPaused(true)
    refresh()
    if (renderer === attempt) {
      renderer = null
      rendererGeneration = 0
    }
    attempt?.dispose()
  }

  function beginRendererAttempt(): void {
    if (!alive) return
    prepareForLoading()
    const generation = loading.beginAttempt()
    const previous = renderer
    renderer = null
    rendererGeneration = 0
    previous?.dispose()
    let attempt: GlassRenderer | null = null
    try {
      attempt = createGlassRenderer(mount(), level, host.assetUrl, {
        reducedMotion,
        followSmoothnessSeconds: cameraComfort().followSmoothnessSeconds,
        renderQuality: renderQualityPreference(),
        onLoadingProgress: (progress) => {
          loading.reportProgress(generation, progress)
        },
        onExitCelebrationComplete: () => {
          if (
            loading.isCurrent(generation) &&
            loading.state().phase === 'ready'
          )
            presentCompletion()
        },
        onContextLost: () => {
          failRendererAttempt(generation, GRAPHICS_LOAD_ERROR, attempt)
        },
      })
      setRenderQualityProfile(attempt.getRenderQuality().profile)
    } catch {
      loading.fail(generation, GRAPHICS_SUPPORT_ERROR)
      return
    }
    if (
      !loading.isCurrent(generation) ||
      loading.state().phase !== 'loading-assets'
    ) {
      attempt.dispose()
      return
    }
    renderer = attempt
    rendererGeneration = generation
    void attempt.ready
      .then(() => {
        loading.assetsInstalled(generation)
      })
      .catch(() => {
        failRendererAttempt(generation, ASSET_LOAD_ERROR, attempt)
      })
  }

  function retryLoading(): void {
    if (loadingPhase() !== 'error') return
    beginRendererAttempt()
  }

  onMount(() => {
    if (notice()) announce(notice())
    const viewport = mount()
    let voicePanel: HTMLElement | null = null
    const measureChallengePanel = (): void => {
      if (voicePanel === null) {
        // An absent panel is not a new zero budget: the renderer retains the
        // last composition while the completed exhibit is still shattering.
        setChallengeSafeBottom(undefined)
        return
      }
      const view = viewport.getBoundingClientRect()
      const panel = voicePanel.getBoundingClientRect()
      setChallengeSafeBottom(
        view.height > 0 && panel.height > 0
          ? Math.min(
              0.62,
              Math.max(0, (view.bottom - panel.top + 16) / view.height),
            )
          : undefined,
      )
    }
    const panelResize = new ResizeObserver(measureChallengePanel)
    panelResize.observe(viewport)
    createEffect(() => {
      const visible = voicePanelVisible()
      // Conditional Solid content is mounted by the end of this update. Watch
      // its actual size so changed instructions, fonts and rotation reframe too.
      queueMicrotask(() => {
        if (!alive) return
        if (voicePanel !== null) panelResize.unobserve(voicePanel)
        voicePanel = visible
          ? (viewport.parentElement?.querySelector<HTMLElement>(
              '[aria-label="Voice challenge"]',
            ) ?? null)
          : null
        if (voicePanel !== null) panelResize.observe(voicePanel)
        measureChallengePanel()
      })
    })
    onCleanup(() => panelResize.disconnect())
    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    beginRendererAttempt()
    const tick = (now: number): void => {
      if (!alive) return
      const elapsed = lastTime === 0 ? 0 : (now - lastTime) / 1000
      lastTime = now
      // An opaque encore covers a completed world. Keep its frame, freeing
      // the main thread for pitch capture and the visible melody ribbon.
      const covered = presentationCovered()
      if (!covered && ready() && !paused() && !tutorial()) {
        const movementActive = input.hasMovementIntent()
        const movementReferenceChanged = input.consumeMovementReferenceChange()
        renderer?.setMovementActive(movementActive)
        if (movementActive && movementReferenceChanged)
          renderer?.rebaseMovement()
        events(
          game.step(input.read(renderer?.getMovementYaw() ?? 0), elapsed, now),
        )
        refresh()
        soundscape.update()
      }
      const activeRenderer = renderer
      const phase = loadingPhase()
      const needsStableFrame = phase === 'awaiting-first-frame'
      if (
        !covered &&
        activeRenderer !== null &&
        (phase === 'ready' || needsStableFrame)
      )
        try {
          const rendered = activeRenderer.render(
            game.snapshot(),
            Math.min(0.05, elapsed),
            {
              challengeEncounterId: voiceState()?.encounterId ?? null,
              paused: paused() || tutorial(),
              safeBottomFraction: challengeSafeBottom(),
            },
          )
          // Inspection attributes are sampled, not a second per-frame UI loop.
          if (needsStableFrame || now - lastCameraMetricsAt >= 100) {
            lastCameraMetricsAt = now
            setChallengeCamera(activeRenderer.getChallengeCameraMetrics())
          }
          if (phase === 'ready' && !paused() && now - lastArtworkCheck >= 250) {
            lastArtworkCheck = now
            setNearbyArtwork(
              activeRenderer.nearbyArtwork(game.snapshot().player.position),
            )
          }
          if (rendered && activeRenderer === renderer && needsStableFrame) {
            loading.frameRendered(rendererGeneration)
          }
        } catch {
          failRendererAttempt(
            rendererGeneration,
            GRAPHICS_LOAD_ERROR,
            activeRenderer,
          )
        }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    const keyDown = (event: KeyboardEvent): void => {
      if (!ready()) return
      if (game.snapshot().complete) return
      if (isAdventureEditableTarget(event.target)) return
      if (event.code === 'Escape') {
        event.preventDefault()
        if (inspection()) closeInspection()
        else if (tutorial()) closeTutorial()
        else if (voiceMode() !== 'off') cancel()
        else if (paused()) resume()
        else pause()
        return
      }
      if (tutorial() || paused()) return
      if (input.key(event, true)) {
        gameplayGesture()
        return
      }
      if (event.code === 'KeyF' && !event.repeat) {
        event.preventDefault()
        void start()
      }
      if (event.code === 'KeyR') renderer?.recenter()
      if (event.code === 'KeyQ') {
        gameplayGesture()
        renderer?.orbit(-0.08, 0)
      }
      if (event.code === 'KeyE') {
        gameplayGesture()
        renderer?.orbit(0.08, 0)
      }
      if (event.code === 'KeyI') {
        gameplayGesture()
        renderer?.orbit(0, -0.05)
      }
      if (event.code === 'KeyK') {
        gameplayGesture()
        renderer?.orbit(0, 0.05)
      }
    }
    const keyUp = (event: KeyboardEvent): void => {
      if (!ready()) {
        input.clear()
        return
      }
      input.key(event, false)
    }
    const releaseInput = (): void => input.clear()
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    // Permission prompts can blur a still-visible window. Release contacts so
    // movement cannot stick, while the host's foreground gate owns real exits.
    window.addEventListener('blur', releaseInput)
    const unsubscribe = host.subscribeForeground((foreground) => {
      if (!foreground) pause()
    })
    onCleanup(() => {
      unsubscribe()
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', releaseInput)
    })
  })
  onCleanup(() => {
    alive = false
    loading.dispose()
    cancelAnimationFrame(frameId)
    clearTimeout(noticeTimer)
    clearNarrationCaption()
    clearTimeout(completionTimer)
    voiceChallenge.dispose()
    soundscape.dispose()
    narration.dispose()
    input.clear()
    renderer?.dispose()
  })
  return {
    snapshot,
    completionPresented,
    loadingPhase,
    loadingProgress,
    loadingGeneration,
    loadError,
    retryLoading,
    ready,
    error,
    microphoneIssue,
    microphoneRecoveryAction,
    microphoneRecoveryPending,
    recoverMicrophone,
    voiceMode,
    pitch,
    target,
    voiceEncounterId: () => voiceState()?.encounterId ?? null,
    findingTarget: () => voiceState()?.findingTarget ?? null,
    voiceMessage: () => voiceState()?.message ?? '',
    voiceHint: () => voiceState()?.hint ?? '',
    voicePair: () => voiceState()?.pair ?? false,
    voiceStepIndex: () => voiceState()?.stepIndex ?? 0,
    voiceStepCount: () => voiceState()?.stepCount ?? 1,
    voiceStepCharge: () => voiceState()?.stepCharge ?? 0,
    notice,
    narrationCaption,
    paused,
    inspection,
    nearbyArtwork,
    closeInspection,
    inspectNearbyArtwork: () => inspectArtwork(nearbyArtwork()),
    inspectAt: (x: number, y: number) =>
      inspectArtwork(renderer?.pickArtwork(x, y) ?? null),
    tutorial,
    input,
    start,
    cancel,
    pause,
    resume,
    closeTutorial,
    showTutorial,
    changeNote,
    replay,
    audioPreferences,
    changeAudio,
    narrationPreferences,
    changeNarration,
    cameraComfort,
    changeCameraComfort,
    renderQualityPreference,
    renderQualityProfile,
    changeRenderQuality,
    gameplayGesture,
    silenceForEncore: () => {
      clearNarrationCaption()
      return Promise.all([
        soundscape.silenceForVoice(),
        narration.silenceForVoice(),
      ]).then(() => undefined)
    },
    releaseEncore: () => {
      narration.releaseVoice()
      soundscape.releaseVoice()
    },
    celebrateEncore: () => {
      const reaction = narration.breakCompleted(false)
      showNarrationCaption(reaction.caption)
    },
    challengeCamera,
    cameraYaw: () => {
      snapshot()
      return renderer?.getCameraYaw() ?? 0
    },
    mercYaw: () => {
      snapshot()
      return renderer?.getMercYaw() ?? null
    },
    desiredTravelYaw: () => {
      snapshot()
      return input.desiredTravelYaw(renderer?.getMovementYaw() ?? 0)
    },
    orbit: (x: number, y: number) => {
      if (ready()) renderer?.orbit(x, y)
    },
    setOrbitActive: (active: boolean) => {
      if (ready() || !active) renderer?.setOrbitActive(active)
    },
    zoom: (delta: number) => {
      if (ready()) renderer?.zoom(delta)
    },
    recenter: () => {
      if (ready()) renderer?.recenter()
    },
  }
}
