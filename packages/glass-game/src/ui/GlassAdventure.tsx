// Glass adventure — the same playable museum surface in web and native hosts.
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassGameHost } from '../host'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './GlassAdventure.module.css'
import type { LoadingScreenPhase } from './LoadingScreen'
import { LoadingScreen } from './LoadingScreen'
import { TouchControls } from './TouchControls'
import { Tutorial } from './Tutorial'
import { useAdventure } from './useAdventure'

export interface GlassAdventureProps {
  host: GlassGameHost
  level?: LevelDefinition
}
const notes = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

function noteName(midi: number | null): string {
  if (midi === null) return 'Your note'
  const rounded = Math.round(midi)
  return `${notes[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}
export function GlassAdventure(props: GlassAdventureProps) {
  const [visit, setVisit] = createSignal(1)
  const restart = (): void => {
    const level = props.level ?? GLASSWORKS
    props.host.saveProgress(createGlassGame(level).saveProgress())
    setVisit((value) => value + 1)
  }
  return (
    <Show when={visit()} keyed>
      {(_visit) => (
        <AdventureVisit
          host={props.host}
          level={props.level}
          onRestart={restart}
        />
      )}
    </Show>
  )
}

function AdventureVisit(props: GlassAdventureProps & { onRestart(): void }) {
  let canvas!: HTMLDivElement
  const level = untrack(() => props.level) ?? GLASSWORKS
  const mercLoadingArt = untrack(() => props.host.assetUrl('merc-loading'))
  const adventure = useAdventure(
    untrack(() => props.host),
    level,
    () => canvas,
  )
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
      (item) => item.id === adventure.snapshot().activeEncounter?.id,
    ),
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
  const optionalCount = createMemo(
    () =>
      level.breakables.filter(
        (item) =>
          item.optional &&
          adventure.snapshot().completedBreakableIds.includes(item.id),
      ).length,
  )
  let pointer: number | null = null
  let previous = { x: 0, y: 0 }
  const releaseOrbit = (): void => {
    const heldPointer = pointer
    pointer = null
    if (heldPointer !== null) {
      adventure.setOrbitActive(false)
      if (canvas?.hasPointerCapture(heldPointer))
        canvas.releasePointerCapture(heldPointer)
    }
  }
  const release = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return
    pointer = null
    adventure.setOrbitActive(false)
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
    if (
      !adventure.ready() ||
      adventure.paused() ||
      adventure.tutorial() ||
      adventure.snapshot().complete
    )
      releaseOrbit()
  })
  return (
    <div
      class={styles.adventure}
      data-testid="glass-adventure"
      data-ready={adventure.ready()}
      data-loading-phase={adventure.loadingPhase()}
      data-checkpoint={adventure.snapshot().checkpointId}
      data-completed={count()}
      data-player-x={adventure.snapshot().player.position.x}
      data-player-y={adventure.snapshot().player.position.y}
      data-player-z={adventure.snapshot().player.position.z}
      data-camera-yaw={adventure.cameraYaw()}
    >
      <div
        ref={canvas}
        class={styles.viewport}
        classList={{ [styles.viewportBlocked]: !adventure.ready() }}
        aria-label="Glass museum; drag to look around"
        aria-hidden={!adventure.ready()}
        inert={!adventure.ready()}
        tabIndex={adventure.ready() ? 0 : -1}
        onPointerDown={(event) => {
          if (
            !adventure.ready() ||
            pointer !== null ||
            adventure.paused() ||
            adventure.tutorial()
          )
            return
          adventure.gameplayGesture()
          pointer = event.pointerId
          event.currentTarget.focus({ preventScroll: true })
          previous = { x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
          adventure.setOrbitActive(true)
        }}
        onPointerMove={(event) => {
          if (
            !adventure.ready() ||
            event.pointerId !== pointer ||
            adventure.paused() ||
            adventure.tutorial()
          )
            return
          adventure.orbit(
            (event.clientX - previous.x) * -0.005,
            (event.clientY - previous.y) * 0.004,
          )
          previous = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onWheel={(event) => {
          event.preventDefault()
          if (!adventure.ready() || adventure.paused() || adventure.tutorial())
            return
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
            onRetry={adventure.retryLoading}
            onLeave={() => props.host.onExit()}
          />
        }
      >
        <div class={styles.topbar}>
          <button
            class={styles.roundButton}
            type="button"
            aria-label="Leave museum"
            onClick={() => props.host.onExit()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <div class={styles.identity}>
            <h1>{level.title}</h1>
            <p>{level.guidance?.subtitle ?? 'The floating museum'}</p>
          </div>
          <div
            class={styles.collection}
            aria-label={`${count()} of ${total} main exhibits opened`}
          >
            <span>
              {count()} / {total}
            </span>
            <span>Exhibits</span>
          </div>
          <button
            class={styles.roundButton}
            type="button"
            aria-label="Pause game"
            onClick={adventure.pause}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6v12M16 6v12" />
            </svg>
          </button>
        </div>
        <div class={styles.utility}>
          <button
            type="button"
            onClick={adventure.recenter}
            aria-label="Recenter camera"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3H3v3m15-3h3v3M3 18v3h3m15-3v3h-3" />
              <circle cx="12" cy="12" r="5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={adventure.showTutorial}
            aria-label="How to play"
          >
            ?
          </button>
        </div>
        <Show
          when={
            adventure.notice() &&
            !active() &&
            !adventure.tutorial() &&
            !adventure.paused()
          }
        >
          <p class={styles.notice} role="status">
            {adventure.notice()}
          </p>
        </Show>
        <Show
          when={
            adventure.narrationCaption() &&
            !adventure.tutorial() &&
            !adventure.paused()
          }
        >
          <p
            class={styles.narrationCaption}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="merc-narration-caption"
          >
            <strong>Merc:</strong> {adventure.narrationCaption()}
          </p>
        </Show>
        <Show when={adventure.error()}>
          <div class={styles.error} role="alert">
            {adventure.error()}
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
          <TouchControls
            input={adventure.input}
            onActivity={adventure.gameplayGesture}
            disabled={
              adventure.voiceMode() !== 'off' ||
              adventure.snapshot().phase === 'shattering'
            }
          />
          <Show when={adventure.voiceMode() === 'off' && nearby()}>
            <div class={styles.encounterOffer}>
              <span>
                {nearby()?.optional === true
                  ? 'Just for the joy of it'
                  : nearby()?.label}
              </span>
              <button
                class={styles.primary}
                type="button"
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
            <section class={styles.encounter} aria-label="Voice challenge">
              <div class={styles.encounterHeading}>
                <span>{active()?.label}</span>
                <button type="button" onClick={adventure.cancel}>
                  Cancel
                </button>
              </div>
              <h2>
                {adventure.voiceMode() === 'permission'
                  ? 'Opening your microphone…'
                  : adventure.voiceMode() === 'finding'
                    ? 'Hum a comfortable note.'
                    : adventure.voiceMode() === 'reference'
                      ? 'Listen to your note.'
                      : 'Hold it gently.'}
              </h2>
              <div class={styles.voiceMeter}>
                <div
                  class={styles.noteDisc}
                  style={{
                    '--charge': `${(adventure.snapshot().activeEncounter?.charge ?? 0) * 100}%`,
                  }}
                >
                  <span>{noteName(adventure.target())}</span>
                </div>
                <div class={styles.voiceReadout}>
                  <span>
                    {adventure.voiceMode() === 'finding'
                      ? 'The glass is finding your voice.'
                      : adventure.voiceMode() === 'reference'
                        ? 'Your turn in a moment…'
                        : adventure.pitch() === null
                          ? 'Sing or hum. No need to be loud.'
                          : `${noteName(adventure.pitch())} · ${Math.round((adventure.snapshot().activeEncounter?.charge ?? 0) * 100)}%`}
                  </span>
                  <div
                    class={styles.chargeTrack}
                    role="progressbar"
                    aria-label="Glass resonance"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      (adventure.snapshot().activeEncounter?.charge ?? 0) * 100,
                    )}
                  >
                    <span
                      style={{
                        width: `${(adventure.snapshot().activeEncounter?.charge ?? 0) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div class={styles.encounterActions}>
                <Show when={adventure.voiceMode() === 'singing'}>
                  <button
                    class={styles.textButton}
                    type="button"
                    onClick={adventure.replay}
                  >
                    Hear the note again
                  </button>
                </Show>
                <button
                  class={styles.textButton}
                  type="button"
                  onClick={adventure.changeNote}
                >
                  Find my note again
                </button>
              </div>
            </section>
          </Show>
          <div class={styles.desktopHint}>
            WASD move <span>Space jump</span>
            <span>Drag to look</span>
          </div>
        </Show>
        <Show when={adventure.tutorial()}>
          <Tutorial
            onClose={adventure.closeTutorial}
            content={level.guidance?.tutorial}
            autoRun={
              (level.movement?.runSpeed ?? 0) > (level.movement?.walkSpeed ?? 0)
            }
          />
        </Show>
        <Show when={adventure.paused() && !adventure.tutorial()}>
          <div class={styles.scrim}>
            <section
              class={styles.pausePanel}
              ref={focusDialog}
              onKeyDown={trapDialogKeys}
              role="dialog"
              aria-modal="true"
              aria-labelledby="glass-pause-title"
            >
              <h2 id="glass-pause-title">Take a little breath.</h2>
              <p>Your progress is safe. The microphone is off.</p>
              <Show
                when={
                  adventure.audioPreferences() ||
                  adventure.narrationPreferences()
                }
              >
                <fieldset class={styles.audioSettings}>
                  <legend>Museum sound</legend>
                  <Show when={adventure.audioPreferences()}>
                    {(preferences) => (
                      <>
                        <label class={styles.audioMute}>
                          <input
                            type="checkbox"
                            checked={preferences().muted}
                            onChange={(event) =>
                              adventure.changeAudio({
                                muted: event.currentTarget.checked,
                              })
                            }
                          />
                          Mute music and ambience
                        </label>
                        <label
                          class={styles.audioVolume}
                          for="glass-music-volume"
                        >
                          <span>
                            Music{' '}
                            <output for="glass-music-volume">
                              {Math.round(preferences().musicVolume * 100)}%
                            </output>
                          </span>
                          <input
                            id="glass-music-volume"
                            aria-label="Music volume"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(preferences().musicVolume * 100)}
                            onInput={(event) =>
                              adventure.changeAudio({
                                musicVolume:
                                  event.currentTarget.valueAsNumber / 100,
                              })
                            }
                          />
                        </label>
                        <label
                          class={styles.audioVolume}
                          for="glass-ambience-volume"
                        >
                          <span>
                            Ambience{' '}
                            <output for="glass-ambience-volume">
                              {Math.round(preferences().ambienceVolume * 100)}%
                            </output>
                          </span>
                          <input
                            id="glass-ambience-volume"
                            aria-label="Ambience volume"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(
                              preferences().ambienceVolume * 100,
                            )}
                            onInput={(event) =>
                              adventure.changeAudio({
                                ambienceVolume:
                                  event.currentTarget.valueAsNumber / 100,
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </Show>
                  <Show when={adventure.narrationPreferences()}>
                    {(preferences) => (
                      <label class={styles.audioMute}>
                        <input
                          type="checkbox"
                          checked={preferences().enabled}
                          onChange={(event) =>
                            adventure.changeNarration(
                              event.currentTarget.checked,
                            )
                          }
                        />
                        Merc voice
                      </label>
                    )}
                  </Show>
                  <Show when={adventure.audioPreferences()}>
                    <small>Music and ambience fade out while you sing.</small>
                  </Show>
                </fieldset>
              </Show>
              <button
                class={styles.primary}
                type="button"
                onClick={adventure.resume}
              >
                Back to the museum
              </button>
              <button
                class={styles.textButton}
                type="button"
                onClick={() => props.host.onExit()}
              >
                Leave museum
              </button>
            </section>
          </div>
        </Show>
        <Show
          when={
            adventure.completionPresented() &&
            !adventure.paused() &&
            !adventure.tutorial()
          }
        >
          <div class={styles.scrim}>
            <section
              class={styles.pausePanel}
              ref={focusDialog}
              onKeyDown={trapDialogKeys}
              role="dialog"
              aria-modal="true"
              aria-labelledby="glass-complete-title"
            >
              <div class={styles.completionMark} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
                </svg>
              </div>
              <h2 id="glass-complete-title">
                {level.guidance?.completionTitle ?? 'You made the museum sing.'}
              </h2>
              <p>
                {total} exhibits, opened with your voice.
                {optionalCount() > 0
                  ? ` And ${optionalCount()} extra ${optionalCount() === 1 ? 'treasure' : 'treasures'} along the way.`
                  : ''}
              </p>
              <p class={styles.tutorialAside}>
                {level.guidance?.completionNext ??
                  'The next gallery will teach notes that rise and fall.'}
              </p>
              <button
                class={styles.primary}
                type="button"
                onClick={() => props.host.onExit()}
              >
                Leave with a little sparkle
              </button>
              <button
                class={styles.textButton}
                type="button"
                onClick={() => props.onRestart()}
              >
                Play this gallery again
              </button>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  )
}
