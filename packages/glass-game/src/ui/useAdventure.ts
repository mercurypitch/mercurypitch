// Adventure session — orchestrates host services without putting UI or audio in the game core.
import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import type { GalleryArtwork } from '../content/gallery-artworks'
import { galleryArtwork } from '../content/gallery-artworks'
import { museumSoundscape } from '../content/soundscapes'
import type { GameEvent, GameSnapshot, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassGameHost, MuseumAudioPreferences } from '../host'
import type { LoadingProgress } from '../loading-progress'
import type { GlassRenderer } from '../render/glass-renderer'
import { createGlassRenderer } from '../render/glass-renderer'
import { reportGraphicsLoad } from '../render/graphics-diagnostics'
import type { GlassAssetQualityProfile, GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import { GLASS_RENDER_QUALITY_PREFERENCE, parseGlassRenderQualityPreference, } from '../render/render-quality'
import { EXIT_CELEBRATION_SECONDS, EXIT_REDUCED_CELEBRATION_SECONDS, } from '../render/resonance-portal'
import { initialAdventureNotice } from './adventure-notice'
import { createAdventureTransientMessages } from './adventure-transient-messages'
import type { AdventureVoiceSnapshot } from './adventure-voice-challenge'
import { createAdventureVoiceChallenge } from './adventure-voice-challenge'
import { createAdventureVoicePresentation } from './adventure-voice-presentation'
import { AUTOMATIC_SINGING_PREFERENCE, createAutomaticVoiceEngagement, createAutomaticVoicePreparationOwner, readAutomaticSingingPreference, serializeAutomaticSingingPreference, } from './automatic-voice-engagement'
import { createCameraComfortPreference } from './camera-comfort-preference'
import { handleCameraModeShortcut, toggleCameraMode } from './camera-mode'
import { createCameraModePreference } from './camera-mode-preference'
import { createAdventureInput, isAdventureEditableTarget } from './input'
import type { AdventureLoadingPhase } from './loading-lifecycle'
import { createAdventureLoadingLifecycle } from './loading-lifecycle'
import type { MicrophoneIssue, MicrophoneRecoveryAction } from './mic-error'
import { microphoneTakeoverTimedOut } from './mic-error'
import { createAdventureNarration } from './narration'
import { ASSET_LOAD_ERROR, createRendererFailureController, GRAPHICS_LOAD_ERROR, GRAPHICS_SUPPORT_ERROR, } from './renderer-failure'
import { createAdventureSoundscape } from './soundscape'
import { hasSeenTutorial, markTutorialSeen } from './tutorial-progress'

const LOADING_PRESENTATION_MS = 2000
const MAXIMUM_KEYBOARD_CAMERA_FRAME_SECONDS = 0.25
const KEYBOARD_CAMERA_YAW_RADIANS_PER_SECOND = 1.6
const KEYBOARD_CAMERA_PITCH_RADIANS_PER_SECOND = 1
const KEYBOARD_CAMERA_ORBIT: Readonly<
  Partial<Record<KeyboardEvent['code'], readonly [number, number]>>
> = {
  KeyQ: [-0.08, 0],
  KeyE: [0.08, 0],
  KeyI: [0, -0.05],
  KeyK: [0, 0.05],
}

export function useAdventure(
  host: GlassGameHost,
  level: LevelDefinition,
  mount: () => HTMLElement,
  presentationCovered: () => boolean = () => false,
  assetProfile?: GlassAssetQualityProfile,
) {
  const game = createGlassGame(level, host.loadProgress(level.id))
  const initialSnapshot = game.snapshot()
  const input = createAdventureInput()
  let renderer: GlassRenderer | null = null
  const { cameraComfort, changeCameraComfort } = createCameraComfortPreference(
    host,
    () => renderer,
  )
  const { cameraMode, changeCameraMode } = createCameraModePreference(
    host,
    input,
    () => renderer,
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
  const [voiceState, setVoiceState] = createSignal<AdventureVoiceSnapshot>()
  const voiceMode = () => voiceState()?.mode ?? 'off'
  const voicePanelVisible = createMemo(() => voiceMode() !== 'off')
  const [challengeSafeBottom, setChallengeSafeBottom] = createSignal<number>()
  const [challengeCamera, setChallengeCamera] = createSignal<ReturnType<
    GlassRenderer['getChallengeCameraMetrics']
  > | null>(null)
  const cameraInputLocked = (): boolean =>
    voiceMode() !== 'off' ||
    snapshot().phase === 'shattering' ||
    (challengeCamera()?.mode ?? 'exploration') !== 'exploration'
  const pitch = () => voiceState()?.pitch ?? null
  const target = () => voiceState()?.target ?? null
  const openingNotice = initialAdventureNotice(level, initialSnapshot)
  let alive = true
  const transientMessages = createAdventureTransientMessages(
    openingNotice,
    () => alive,
  )
  const [paused, setPaused] = createSignal(false)
  const [inspection, setInspection] = createSignal<GalleryArtwork | null>(null)
  const [nearbyArtwork, setNearbyArtwork] = createSignal<string | null>(null)
  const [tutorial, setTutorial] = createSignal(!hasSeenTutorial(host, level))
  const automaticSingingAvailable = level.presentation?.theme !== 'cloudway'
  const automaticVoiceEngagement = createAutomaticVoiceEngagement(level)
  const [automaticSingingEnabled, setAutomaticSingingEnabled] = createSignal(
    readAutomaticSingingPreference(host),
  )
  const automaticVoicePreparation = createAutomaticVoicePreparationOwner(
    host,
    () => automaticVoiceEngagement.disarm(),
  )

  function releaseAutomaticVoicePreparation(): void {
    automaticVoicePreparation.release()
  }

  function disarmAutomaticVoice(): void {
    automaticVoiceEngagement.disarm()
    releaseAutomaticVoicePreparation()
  }

  function prepareAutomaticVoiceFromGesture(): void {
    if (!automaticSingingAvailable || !automaticSingingEnabled() || !ready())
      return
    automaticVoiceEngagement.arm()
    try {
      // This reaches AudioContext.resume() before the event handler yields.
      // The microphone remains closed until an eligible circle is entered.
      automaticVoicePreparation.prepare()
    } catch {
      automaticVoiceEngagement.disarm()
    }
  }
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
  let rendererGeneration = 0
  let frameId = 0
  let lastTime = 0
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
      transientMessages.startOpeningNotice()
    },
  })
  game.setPaused(untrack(tutorial))

  function refresh(): GameSnapshot {
    const next = game.snapshot()
    setSnapshot(next)
    return next
  }

  function cancel(): void {
    transientMessages.clear()
    narration.pause()
    voiceChallenge.cancel()
    input.clear()
    refresh()
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
        const reaction = narration.breakCompleted(event.outcome)
        transientMessages.showNarrationCaption(reaction.caption)
        const authoredNotice = level.guidance?.encounterSuccessNotices?.find(
          (notice) => notice.encounterId === event.id,
        )?.notice
        transientMessages.announce(
          authoredNotice ??
            (item?.optional === true
              ? 'Optional exhibit opened. Explore, or continue to the exit.'
              : event.outcome === 'path-opened'
                ? 'Beautiful. A new path is open.'
                : event.outcome === 'exit-opened'
                  ? 'Beautiful. The exit is open.'
                  : 'Beautiful. The next exhibit is ready.'),
        )
      } else if (event.type === 'checkpoint') {
        host.saveProgress(game.saveProgress())
      } else if (event.type === 'complete') {
        transientMessages.clear()
        host.saveProgress(game.saveProgress())
        input.clear()
        renderer?.cancelHeadingFollow()
        scheduleCompletionFallback()
      } else if (event.type === 'respawn') {
        transientMessages.clear()
        input.clear()
        renderer?.cancelHeadingFollow()
        transientMessages.announce(
          'Back on solid ground. Your progress is safe.',
        )
      }
    }
  }

  const voiceChallenge = createAdventureVoiceChallenge({
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
  const voicePresentation = createAdventureVoicePresentation(
    voiceState,
    voiceChallenge,
  )

  async function startEncounter(id: string): Promise<void> {
    if (
      game.snapshot().nearbyBreakableId !== id ||
      !ready() ||
      paused() ||
      tutorial() ||
      voiceMode() !== 'off'
    )
      return
    transientMessages.clear()
    setError(null)
    setMicrophoneIssue(null)
    input.clear()
    const preparation = automaticVoicePreparation.current()
    try {
      await voiceChallenge.start(id)
    } finally {
      // The capture session now owns the shared context, or startup ended.
      // Either result retires the earlier gesture-only preparation.
      automaticVoicePreparation.release(preparation)
    }
  }

  async function start(): Promise<void> {
    const id = game.snapshot().nearbyBreakableId
    if (id === null) return
    automaticVoiceEngagement.consume(id)
    await startEncounter(id)
  }

  function startAutomaticVoice(next: GameSnapshot): void {
    const id = automaticVoiceEngagement.observe({
      enabled: automaticSingingAvailable && automaticSingingEnabled(),
      eligible:
        ready() &&
        !paused() &&
        !tutorial() &&
        inspection() === null &&
        voiceMode() === 'off' &&
        next.phase === 'idle' &&
        next.player.grounded &&
        !next.paused &&
        !next.complete &&
        (challengeCamera()?.mode ?? 'exploration') === 'exploration',
      nearbyEncounterId: next.nearbyBreakableId,
      playerPosition: next.player.position,
    })
    if (id !== null) void startEncounter(id)
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
    disarmAutomaticVoice()
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
    prepareAutomaticVoiceFromGesture()
    soundscape.activate()
    const viewport = ready() && !tutorial() ? mount() : null
    queueMicrotask(() => {
      if (alive) viewport?.focus({ preventScroll: true })
    })
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
    disarmAutomaticVoice()
    setInspection(null)
    soundscape.pause()
    setTutorial(true)
    cancel()
    game.setPaused(true)
    refresh()
  }

  function changeAudio(patch: Partial<MuseumAudioPreferences>): void {
    music?.setPreferences(patch)
    setAudioPreferences(music?.preferences())
  }

  function changeNarration(enabled: boolean): void {
    narration.setEnabled(enabled)
    if (!enabled) transientMessages.clearNarrationCaption()
    setNarrationPreferences(narration.preferences())
  }

  function changeRenderQuality(next: GlassRenderQualityPreference): void {
    const preference = parseGlassRenderQualityPreference(next)
    setRenderQualityPreference(preference)
    host.writePreference(GLASS_RENDER_QUALITY_PREFERENCE, preference)
    renderer?.setRenderQuality(preference)
    const profile = renderer?.getRenderQuality().profile
    if (profile !== undefined) setRenderQualityProfile(profile)
  }

  function changeAutomaticSinging(enabled: boolean): void {
    setAutomaticSingingEnabled(enabled)
    if (!enabled) disarmAutomaticVoice()
    host.writePreference(
      AUTOMATIC_SINGING_PREFERENCE,
      serializeAutomaticSingingPreference(enabled),
    )
  }

  function gameplayGesture(): void {
    if (!ready()) return
    prepareAutomaticVoiceFromGesture()
    soundscape.activate()
    narration.welcomeGesture()
  }

  function prepareForLoading(): void {
    disarmAutomaticVoice()
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

  const failRendererAttempt = createRendererFailureController({
    loading,
    preference: () => untrack(renderQualityPreference),
    currentRenderer: () => renderer,
    clearCurrentRenderer: () => {
      renderer = null
      rendererGeneration = 0
    },
    clearPresentation: () => {
      setInspection(null)
      setNearbyArtwork(null)
    },
    pauseSoundscape: soundscape.pause,
    cancelInteraction: () => {
      disarmAutomaticVoice()
      cancel()
    },
    pauseGame: () => game.setPaused(true),
    refresh,
  })

  function beginRendererAttempt(): void {
    if (!alive) return
    prepareForLoading()
    const generation = loading.beginAttempt()
    reportGraphicsLoad('gallery', level.id, 'loading')
    const previous = renderer
    renderer = null
    rendererGeneration = 0
    previous?.dispose()
    let attempt: GlassRenderer | null = null
    try {
      attempt = createGlassRenderer(mount(), level, host.assetUrl, {
        reducedMotion,
        followSmoothnessSeconds: cameraComfort().followSmoothnessSeconds,
        cameraMode: cameraMode(),
        renderQuality: renderQualityPreference(),
        assetProfile,
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
          failRendererAttempt({
            generation,
            message: GRAPHICS_LOAD_ERROR,
            renderer: attempt,
            stage: 'context-lost',
            cause: new Error('WebGL context lost'),
          })
        },
      })
      setRenderQualityProfile(attempt.getRenderQuality().profile)
    } catch (cause) {
      failRendererAttempt({
        generation,
        message: GRAPHICS_SUPPORT_ERROR,
        renderer: attempt,
        stage: 'initialization',
        cause,
      })
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
      .catch((cause: unknown) => {
        failRendererAttempt({
          generation,
          message: ASSET_LOAD_ERROR,
          renderer: attempt,
          stage: 'asset-load',
          cause,
        })
      })
  }

  function retryLoading(): void {
    if (loadingPhase() !== 'error') return
    beginRendererAttempt()
  }

  const getRenderMetrics = () => renderer?.getMetrics() ?? null

  onMount(() => {
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
              '[data-challenge-panel]',
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
        const cameraOrbit = input.cameraOrbitAxes()
        const cameraFrameSeconds = Math.min(
          Math.max(0, elapsed),
          MAXIMUM_KEYBOARD_CAMERA_FRAME_SECONDS,
        )
        if (cameraOrbit.yaw !== 0 || cameraOrbit.pitch !== 0) {
          const lookSensitivity = cameraComfort().lookSensitivity
          renderer?.orbit(
            cameraOrbit.yaw *
              KEYBOARD_CAMERA_YAW_RADIANS_PER_SECOND *
              cameraFrameSeconds *
              lookSensitivity,
            cameraOrbit.pitch *
              KEYBOARD_CAMERA_PITCH_RADIANS_PER_SECOND *
              cameraFrameSeconds *
              lookSensitivity,
          )
        }
        const movementActive = input.hasMovementIntent()
        const movementReferenceChanged = input.consumeMovementReferenceChange()
        renderer?.setMovementActive(movementActive)
        if (movementActive && movementReferenceChanged)
          renderer?.rebaseMovement(
            movementReferenceChanged,
            input.desiredTravelYaw(0) ?? undefined,
          )
        events(
          game.step(input.read(renderer?.getMovementYaw() ?? 0), elapsed, now),
        )
        const next = refresh()
        soundscape.update()
        startAutomaticVoice(next)
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
          const rendered = activeRenderer.render(game.snapshot(), elapsed, {
            narrationLevel: narration.outputLevel(),
            challengeEncounterId: voiceState()?.encounterId ?? null,
            paused: paused() || tutorial(),
            safeBottomFraction: challengeSafeBottom(),
          })
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
            if (loading.state().phase === 'ready')
              reportGraphicsLoad('gallery', level.id, 'ready')
          }
        } catch (cause) {
          failRendererAttempt({
            generation: rendererGeneration,
            message: GRAPHICS_LOAD_ERROR,
            renderer: activeRenderer,
            stage: 'frame',
            cause,
          })
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
      if (
        handleCameraModeShortcut(
          event,
          viewport,
          tutorial() || paused() || cameraInputLocked(),
          () => changeCameraMode(toggleCameraMode(cameraMode())),
        )
      )
        return
      if (tutorial() || paused() || cameraInputLocked()) return
      if (input.key(event, true)) {
        gameplayGesture()
        return
      }
      if (event.code === 'KeyF' && !event.repeat) {
        event.preventDefault()
        void start()
      }
      if (event.code === 'KeyR') renderer?.recenter()
      const keyboardOrbit = KEYBOARD_CAMERA_ORBIT[event.code]
      if (keyboardOrbit !== undefined) {
        event.preventDefault()
        gameplayGesture()
        renderer?.orbit(...keyboardOrbit)
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
    disarmAutomaticVoice()
    loading.dispose()
    cancelAnimationFrame(frameId)
    transientMessages.clear()
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
    getRenderMetrics,
    ready,
    error,
    microphoneIssue,
    microphoneRecoveryAction,
    microphoneRecoveryPending,
    recoverMicrophone,
    voiceMode,
    pitch,
    target,
    ...voicePresentation,
    notice: transientMessages.notice,
    narrationCaption: transientMessages.narrationCaption,
    paused,
    inspection,
    nearbyArtwork,
    closeInspection,
    inspectNearbyArtwork: () => inspectArtwork(nearbyArtwork()),
    inspectAt: (x: number, y: number) =>
      inspectArtwork(renderer?.pickArtwork(x, y) ?? null),
    tutorial,
    automaticSingingAvailable,
    automaticSingingEnabled,
    changeAutomaticSinging,
    input,
    start,
    cancel,
    pause,
    resume,
    closeTutorial,
    showTutorial,
    audioPreferences,
    changeAudio,
    narrationPreferences,
    changeNarration,
    cameraComfort,
    changeCameraComfort,
    cameraMode,
    changeCameraMode,
    renderQualityPreference,
    renderQualityProfile,
    changeRenderQuality,
    gameplayGesture,
    silenceForEncore: () => {
      transientMessages.clear()
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
      const reaction = narration.breakCompleted('celebration')
      transientMessages.showNarrationCaption(reaction.caption)
    },
    challengeCamera,
    cameraInputLocked,
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
