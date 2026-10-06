// Adventure visit — the loaded 3D gallery, controls, challenges and completion presentation.
import { createEffect, createMemo, createSignal, lazy, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { GALLERY_ENCORES } from '../content/encores'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import type { GlassGameHost } from '../host'
import type { GlassAssetQualityProfile } from '../render/render-quality'
import { deriveAdventureProgressGuidance } from './AdventureGuidance'
import { AdventureMessageStack } from './AdventureMessageStack'
import { AdventureSettings } from './AdventureSettings'
import { AdventureVoicePanel } from './AdventureVoicePanel'
import { ArtworkInspection, ArtworkOffer } from './ArtworkInspection'
import type { CompletionDifficultyAction } from './CompletionResults'
import { CompletionResults } from './CompletionResults'
import { createEncoreAudioLeaseOwner } from './encore-audio-lease'
import { GameIconButton, GameMuseumButton, GameUIProvider } from './GameUI'
import styles from './GlassAdventure.module.css'
import type { LoadingScreenPhase } from './LoadingScreen'
import { LoadingScreen } from './LoadingScreen'
import { MelodyRouteProgress } from './MelodyRouteProgress'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'
import { TouchControls } from './TouchControls'
import { Tutorial } from './Tutorial'
import { useAdventure } from './useAdventure'

const CameraTuningPanel = lazy(async () => ({
  default: (await import('./CameraTuningPanel')).CameraTuningPanel,
}))
const EncoreDialog = lazy(async () => ({
  default: (await import('./EncoreDialog')).EncoreDialog,
}))

export interface AdventureVisitProps {
  host: GlassGameHost
  level?: LevelDefinition
  /** Fixed bundle tier for hosts that package only reviewed mobile assets. */
  assetProfile?: GlassAssetQualityProfile
  onContinue?(): void
  continueLabel?: string
  nextLevelName?: string
  nextDifficulty?: CompletionDifficultyAction
  onRestart(): void
  replayGoal?: { title: string; tier: 1 | 2 | 3 }
}

export function AdventureVisit(props: AdventureVisitProps) {
  let canvas!: HTMLDivElement
  const level = untrack(() => props.level) ?? GLASSWORKS
  const encore = GALLERY_ENCORES[level.authored?.levelId ?? level.id]
  const [encoreOpen, setEncoreOpen] = createSignal(false)
  const [cameraPreviewOpen, setCameraPreviewOpen] = createSignal(false)
  let encoreOpener: HTMLButtonElement | undefined
  const closeEncore = () => {
    setEncoreOpen(false)
    queueMicrotask(() => encoreOpener?.focus({ preventScroll: true }))
  }
  const mercLoadingArt = untrack(() => props.host.assetUrl('merc-loading'))
  const mercModel = untrack(() => props.host.assetUrl('merc'))
  const adventure = useAdventure(
    untrack(() => props.host),
    level,
    () => canvas,
    encoreOpen,
    untrack(() => props.assetProfile),
  )
  const encoreAudioLeases = createEncoreAudioLeaseOwner(
    adventure.silenceForEncore,
    adventure.releaseEncore,
  )
  const retryableMicrophoneIssue = createMemo(() => {
    const issue = adventure.microphoneIssue()
    return issue?.action === 'retry' ? issue : null
  })
  const loadingPresentationPhase = createMemo<LoadingScreenPhase>(() => {
    const phase = adventure.loadingPhase()
    return phase === 'ready' ? 'awaiting-first-frame' : phase
  })
  let focusActive = true
  const nearby = createMemo(() =>
    level.breakables.find(
      (item) => item.id === adventure.snapshot().nearbyBreakableId,
    ),
  )
  const active = createMemo(() =>
    level.breakables.find(
      (item) =>
        item.id ===
        (adventure.snapshot().activeEncounter?.id ??
          adventure.voiceEncounterId()),
    ),
  )
  const contextualMessagesAvailable = createMemo(
    () =>
      !adventure.paused() &&
      !adventure.tutorial() &&
      !adventure.snapshot().complete &&
      adventure.inspection() === null,
  )
  const progressGuidance = createMemo(() =>
    contextualMessagesAvailable() &&
    adventure.voiceMode() === 'off' &&
    adventure.snapshot().phase !== 'shattering'
      ? deriveAdventureProgressGuidance(level, adventure.snapshot())
      : undefined,
  )
  const visibleNotice = createMemo(() =>
    contextualMessagesAvailable() &&
    adventure.notice() &&
    !active() &&
    adventure.snapshot().phase !== 'shattering'
      ? adventure.notice()
      : '',
  )
  const visibleNarrationCaption = createMemo(() =>
    contextualMessagesAvailable() &&
    adventure.narrationCaption() &&
    adventure.voiceMode() === 'off'
      ? adventure.narrationCaption()
      : '',
  )
  const showArtworkOffer = createMemo(
    () =>
      adventure.ready() &&
      !adventure.paused() &&
      !adventure.tutorial() &&
      !adventure.snapshot().complete &&
      adventure.nearbyArtwork() !== null &&
      adventure.voiceMode() === 'off' &&
      adventure.snapshot().phase !== 'shattering',
  )
  const showEncounterOffer = createMemo(
    () =>
      adventure.voiceMode() === 'off' &&
      adventure.microphoneIssue() === null &&
      nearby() !== undefined,
  )
  const count = createMemo(
    () =>
      level.breakables.filter(
        (item) =>
          !item.optional &&
          adventure.snapshot().completedBreakableIds.includes(item.id),
      ).length,
  )
  const total = level.breakables.filter((item) => !item.optional).length
  const cameraInputBlocked = (): boolean =>
    !adventure.ready() ||
    adventure.paused() ||
    adventure.tutorial() ||
    adventure.snapshot().complete ||
    adventure.cameraInputLocked()
  let pointer: number | null = null
  let previous = { x: 0, y: 0 }
  let pointerStart = { x: 0, y: 0 }
  let isTap = false
  const releaseOrbit = (): void => {
    const heldPointer = pointer
    pointer = null
    isTap = false
    if (heldPointer !== null) {
      adventure.setOrbitActive(false)
      if (canvas?.hasPointerCapture(heldPointer))
        canvas.releasePointerCapture(heldPointer)
    }
  }
  const release = (event: PointerEvent): void => {
    // Touch implicitly captures the child canvas before we capture its host.
    // That child's bubbling loss is a transfer, not the end of this gesture.
    if (event.type === 'lostpointercapture' && event.target !== canvas) return
    if (event.pointerId !== pointer) return
    const inspect =
      event.type === 'pointerup' &&
      isTap &&
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) <= 8
    pointer = null
    isTap = false
    adventure.setOrbitActive(false)
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId)
    if (inspect) adventure.inspectAt(event.clientX, event.clientY)
  }
  onMount(() => {
    window.addEventListener('blur', releaseOrbit)
    onCleanup(() => {
      focusActive = false
      window.removeEventListener('blur', releaseOrbit)
    })
  })
  createEffect<boolean>((wasReady) => {
    const isReady = adventure.ready()
    if (isReady && !wasReady) {
      queueMicrotask(() => {
        if (
          focusActive &&
          adventure.ready() &&
          !adventure.tutorial() &&
          canvas.isConnected
        )
          canvas.focus({ preventScroll: true })
      })
    }
    return isReady
  }, false)
  createEffect(() => {
    if (cameraInputBlocked()) {
      releaseOrbit()
      setCameraPreviewOpen(false)
    }
  })
  return (
    <GameUIProvider host={props.host}>
      <div
        class={styles.adventure}
        data-testid="glass-adventure"
        data-ready={adventure.ready()}
        data-level-id={level.id}
        data-loading-phase={adventure.loadingPhase()}
        data-checkpoint={adventure.snapshot().checkpointId}
        data-completed={count()}
        data-player-x={adventure.snapshot().player.position.x}
        data-player-y={adventure.snapshot().player.position.y}
        data-player-z={adventure.snapshot().player.position.z}
        data-camera-yaw={adventure.cameraYaw()}
        data-merc-yaw={adventure.mercYaw() ?? undefined}
        data-travel-yaw={adventure.desiredTravelYaw() ?? undefined}
        data-look-sensitivity={adventure.cameraComfort().lookSensitivity}
        data-follow-smoothness={
          adventure.cameraComfort().followSmoothnessSeconds
        }
        data-camera-mode={adventure.cameraMode()}
        data-render-quality-preference={adventure.renderQualityPreference()}
        data-render-quality-profile={adventure.renderQualityProfile()}
        data-automatic-singing={adventure.automaticSingingEnabled()}
        data-challenge-camera-mode={
          adventure.challengeCamera()?.mode ?? 'exploration'
        }
        data-challenge-camera-progress={
          adventure.challengeCamera()?.progress ?? 0
        }
        data-challenge-camera-encounter={
          adventure.challengeCamera()?.encounterId ?? undefined
        }
        data-challenge-camera={JSON.stringify(adventure.challengeCamera())}
      >
        <div
          ref={canvas}
          class={styles.viewport}
          classList={{ [styles.viewportBlocked]: !adventure.ready() }}
          aria-label="Glass museum; drag to look around"
          aria-hidden={!adventure.ready()}
          inert={!adventure.ready() || adventure.inspection() !== null}
          tabIndex={adventure.ready() ? 0 : -1}
          onPointerDown={(event) => {
            if (pointer !== null) isTap = false
            if (event.button !== 0 || pointer !== null || cameraInputBlocked())
              return
            adventure.gameplayGesture()
            pointer = event.pointerId
            event.currentTarget.focus({ preventScroll: true })
            previous = { x: event.clientX, y: event.clientY }
            pointerStart = previous
            isTap = true
            event.currentTarget.setPointerCapture(event.pointerId)
            adventure.setOrbitActive(true)
          }}
          onPointerMove={(event) => {
            if (event.pointerId !== pointer || cameraInputBlocked()) return
            if (
              Math.hypot(
                event.clientX - pointerStart.x,
                event.clientY - pointerStart.y,
              ) > 8
            )
              isTap = false
            adventure.orbit(
              (event.clientX - previous.x) *
                -0.005 *
                adventure.cameraComfort().lookSensitivity,
              (event.clientY - previous.y) *
                0.004 *
                adventure.cameraComfort().lookSensitivity,
            )
            previous = { x: event.clientX, y: event.clientY }
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onWheel={(event) => {
            event.preventDefault()
            if (cameraInputBlocked()) return
            adventure.zoom(event.deltaY * 0.002)
          }}
        />
        <Show
          when={adventure.ready()}
          fallback={
            <LoadingScreen
              phase={loadingPresentationPhase()}
              error={adventure.loadError()}
              levelTitle={level.title}
              mercArtUrl={mercLoadingArt}
              mercModelUrl={mercModel}
              generation={adventure.loadingGeneration()}
              progress={adventure.loadingProgress()}
              onRetry={adventure.retryLoading}
              onLeave={() => props.host.onExit()}
            />
          }
        >
          <div
            class={styles.topbar}
            classList={{ [styles.topbarArtwork]: showArtworkOffer() }}
            inert={adventure.inspection() !== null}
          >
            <GameMuseumButton onClick={() => props.host.onExit()} />

            <div class={styles.identity}>
              <h1>{level.title}</h1>
              <p>
                {props.replayGoal?.title ??
                  level.guidance?.subtitle ??
                  'The floating museum'}
              </p>
            </div>
            <Show when={showArtworkOffer()}>
              <ArtworkOffer onOpen={adventure.inspectNearbyArtwork} />
            </Show>
            <div
              class={styles.collection}
              aria-label={`${count()} of ${total} main exhibits opened`}
            >
              <span>
                {count()} / {total}
              </span>
              <span>Exhibits</span>
            </div>
            <GameIconButton
              label="Open settings"
              icon="settings"
              onClick={adventure.pause}
            />
          </div>
          <div class={styles.utility} inert={adventure.inspection() !== null}>
            <button
              type="button"
              onClick={adventure.recenter}
              aria-label="Recenter camera"
              disabled={adventure.cameraInputLocked()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 3H3v3m15-3h3v3M3 18v3h3m15-3v3h-3" />
                <circle cx="12" cy="12" r="5" />
              </svg>
            </button>
            <Show when={cameraPreviewOpen()}>
              <CameraTuningPanel
                hideTrigger
                open={cameraPreviewOpen()}
                onClose={() => setCameraPreviewOpen(false)}
                settings={adventure.cameraComfort()}
                onChange={adventure.changeCameraComfort}
                renderQualityPreference={adventure.renderQualityPreference()}
                renderQualityProfile={adventure.renderQualityProfile()}
                onRenderQualityChange={adventure.changeRenderQuality}
                shatterPlaybackSpeed={adventure.shatterPlaybackSpeed()}
                onShatterPlaybackSpeedChange={
                  adventure.changeShatterPlaybackSpeed
                }
              />
            </Show>
          </div>
          <Show when={level.melodyLesson}>
            {(lesson) => (
              <MelodyRouteProgress
                lesson={lesson()}
                completedEncounterIds={
                  adventure.snapshot().completedBreakableIds
                }
                activeEncounterId={adventure.voiceEncounterId()}
              />
            )}
          </Show>
          <AdventureMessageStack
            narration={visibleNarrationCaption()}
            notice={visibleNotice()}
            guidance={progressGuidance()}
            withEncounterOffer={showEncounterOffer()}
          />
          <Show when={adventure.error()}>
            <div class={styles.error} role="alert">
              <div class={styles.errorBody}>
                <p>{adventure.error()}</p>
                <Show when={retryableMicrophoneIssue()}>
                  {(issue) => (
                    <MicrophoneInputRecovery
                      microphoneInput={props.host.microphoneInput}
                      issue={issue()}
                    />
                  )}
                </Show>
              </div>
              <Show when={adventure.microphoneRecoveryAction() !== 'none'}>
                <button
                  class={styles.errorAction}
                  type="button"
                  disabled={adventure.microphoneRecoveryPending()}
                  aria-busy={adventure.microphoneRecoveryPending()}
                  onClick={() => void adventure.recoverMicrophone()}
                >
                  {adventure.microphoneRecoveryPending()
                    ? 'Moving microphone…'
                    : adventure.microphoneRecoveryAction() === 'take-over'
                      ? 'Use it here'
                      : 'Try again'}
                </button>
              </Show>
            </div>
          </Show>
          <Show
            when={
              adventure.ready() &&
              !adventure.paused() &&
              !adventure.tutorial() &&
              !adventure.snapshot().complete
            }
          >
            <div style={{ display: 'contents' }}>
              <TouchControls
                input={adventure.input}
                onActivity={adventure.gameplayGesture}
                disabled={
                  adventure.voiceMode() !== 'off' ||
                  adventure.snapshot().phase === 'shattering'
                }
              />
              <Show when={showEncounterOffer()}>
                <div class={styles.encounterOffer}>
                  <span>
                    {nearby()?.optional === true
                      ? 'Just for the joy of it'
                      : nearby()?.label}
                  </span>
                  <button
                    class={styles.primary}
                    type="button"
                    data-testid="glass-sing-action"
                    onClick={() => void adventure.start()}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="12" rx="3" />
                      <path d="M6 11v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6" />
                    </svg>
                    Sing to the glass <kbd>F</kbd>
                  </button>
                </div>
              </Show>
              <Show when={adventure.voiceMode() !== 'off'}>
                <AdventureVoicePanel
                  adventure={adventure}
                  active={active()}
                  onStartFresh={props.onRestart}
                />
              </Show>
              <Show
                when={
                  adventure.voiceMode() === 'off' &&
                  adventure.snapshot().phase !== 'shattering'
                }
              >
                <div class={styles.desktopHint}>
                  WASD move <span>Space jump</span>
                  <span>Arrows / drag look</span>
                </div>
              </Show>
            </div>
          </Show>
          <Show when={adventure.tutorial()}>
            <Tutorial
              onClose={adventure.closeTutorial}
              content={level.guidance?.tutorial}
              automaticSinging={
                adventure.automaticSingingAvailable
                  ? adventure.automaticSingingEnabled()
                  : undefined
              }
              autoRun={
                (level.movement?.runSpeed ?? 0) >
                (level.movement?.walkSpeed ?? 0)
              }
            />
          </Show>
          <Show when={adventure.inspection()}>
            {(artwork) => (
              <ArtworkInspection
                artwork={artwork()}
                imageUrl={props.host.assetUrl(artwork().imageAsset)}
                onClose={adventure.closeInspection}
              />
            )}
          </Show>
          <AdventureSettings
            host={props.host}
            adventure={adventure}
            onClosed={() => {
              if (!cameraInputBlocked()) canvas.focus({ preventScroll: true })
            }}
            onPreviewCamera={() => {
              adventure.resume()
              setCameraPreviewOpen(true)
            }}
          />
          <Show
            when={
              adventure.completionPresented() &&
              !adventure.paused() &&
              !adventure.tutorial()
            }
          >
            <CompletionResults
              level={level}
              summary={adventure.snapshot().rewardSummary}
              replayGoal={props.replayGoal}
              nextDifficulty={props.nextDifficulty}
              nextLevel={
                props.onContinue === undefined
                  ? undefined
                  : {
                      label:
                        props.nextLevelName ??
                        props.continueLabel ??
                        'Next gallery',
                      onSelect: props.onContinue,
                    }
              }
              assetUrl={(id) => props.host.assetUrl(id)}
              covered={encoreOpen()}
              encoreAvailable={
                encore !== undefined &&
                props.host.createMelodyReference !== undefined
              }
              onEncore={(opener) => {
                encoreOpener = opener
                setEncoreOpen(true)
              }}
              onReplay={props.onRestart}
              onBack={() => props.host.onExit()}
            />
            <Show when={encoreOpen() && encore}>
              {(definition) => (
                <EncoreDialog
                  host={props.host}
                  levelId={level.id}
                  encore={definition()}
                  audioLeases={encoreAudioLeases}
                  melodyTier={props.replayGoal?.tier ?? 1}
                  onComplete={adventure.celebrateEncore}
                  onClose={closeEncore}
                />
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </GameUIProvider>
  )
}
