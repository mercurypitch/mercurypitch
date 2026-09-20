// Adventure session — orchestrates host services without putting UI or audio in the game core.
import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { museumSoundscape } from '../content/soundscapes'
import type { GameEvent, LevelDefinition, PitchObservation } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassGameHost, GlassSound, GlassVoiceSession, MuseumAudioPreferences, } from '../host'
import type { GlassRenderer } from '../render/glass-renderer'
import { createGlassRenderer } from '../render/glass-renderer'
import { createAdventureInput } from './input'
import { microphoneError } from './mic-error'
import { createAdventureSoundscape } from './soundscape'

type VoiceMode = 'off' | 'permission' | 'finding' | 'reference' | 'singing'
export function useAdventure(
  host: GlassGameHost,
  level: LevelDefinition,
  mount: () => HTMLElement,
) {
  const game = createGlassGame(level, host.loadProgress(level.id))
  const input = createAdventureInput()
  const [snapshot, setSnapshot] = createSignal(game.snapshot())
  const [ready, setReady] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [voiceMode, setVoiceMode] = createSignal<VoiceMode>('off')
  const [pitch, setPitch] = createSignal<number | null>(null)
  const [notice, setNotice] = createSignal(
    level.guidance?.openingNotice ??
      'Explore the museum and approach a glass exhibit.',
  )
  const [paused, setPaused] = createSignal(false)
  const [tutorial, setTutorial] = createSignal(
    host.readPreference('tutorial') !== 'seen',
  )
  const music = host.createMusic?.()
  const [audioPreferences, setAudioPreferences] = createSignal(
    music?.preferences(),
  )
  const soundscape = createAdventureSoundscape(
    music,
    (previous) =>
      museumSoundscape(level, game.snapshot().player.position, previous),
    () => alive && ready() && !paused() && !tutorial() && !graphicsFailed,
  )
  const storedNote = Number(host.readPreference('comfortable-note') ?? '')
  const [target, setTarget] = createSignal<number | null>(
    Number.isFinite(storedNote) && storedNote >= 36 && storedNote <= 84
      ? storedNote
      : null,
  )
  let renderer: GlassRenderer | null = null
  let voice: GlassVoiceSession | null = null
  let stopObserving: (() => void) | null = null
  let sound: GlassSound | null = null
  let token = 0
  let alive = true
  let graphicsFailed = false
  let frameId = 0
  let lastTime = 0
  let lastSequence = -1
  let samples: PitchObservation[] = []
  let soundTimer: ReturnType<typeof setTimeout> | undefined
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  game.setPaused(untrack(tutorial))

  function refresh(): void {
    setSnapshot(game.snapshot())
  }

  function stopCapture(): void {
    token++
    stopObserving?.()
    stopObserving = null
    voice?.stop()
    voice = null
    lastSequence = -1
    samples = []
    setPitch(null)
    setVoiceMode('off')
  }

  function stopSound(): void {
    clearTimeout(soundTimer)
    sound?.dispose()
    sound = null
  }

  function cancel(): void {
    stopCapture()
    stopSound()
    game.cancelEncounter()
    input.clear()
    refresh()
    soundscape.releaseVoice()
  }

  function announce(message: string): void {
    clearTimeout(noticeTimer)
    setNotice(message)
    noticeTimer = setTimeout(() => {
      if (alive) setNotice('')
    }, 5000)
  }

  function events(batch: GameEvent[]): void {
    for (const event of batch) {
      if (event.type === 'break') {
        // This write precedes the fracture, its sound and bridge presentation.
        host.saveProgress(game.saveProgress())
        stopCapture()
        sound?.shatter()
        soundscape.releaseVoice()
        const finishedSound = sound
        soundTimer = setTimeout(() => {
          finishedSound?.dispose()
          if (sound === finishedSound) sound = null
        }, 3000)
        const item = level.breakables.find(
          (candidate) => candidate.id === event.id,
        )
        const authoredNotice = level.guidance?.encounterSuccessNotices?.find(
          (notice) => notice.encounterId === event.id,
        )?.notice
        announce(
          authoredNotice ??
            (item?.optional === true
              ? 'One more beautiful mess.'
              : 'Beautiful. A new path is open.'),
        )
      } else if (event.type === 'checkpoint' || event.type === 'complete') {
        host.saveProgress(game.saveProgress())
      } else if (event.type === 'respawn') {
        input.clear()
        renderer?.cancelHeadingFollow()
        announce('Back on solid ground. Your progress is safe.')
      }
    }
  }

  async function reference(midi: number, sessionToken: number): Promise<void> {
    const active = game.snapshot().activeEncounter
    if (!active || !sound) return
    game.cancelEncounter()
    game.beginEncounter(active.id, midi)
    setTarget(midi)
    setVoiceMode('reference')
    refresh()
    try {
      await sound.reference(midi)
      if (!alive || sessionToken !== token) return
      lastSequence = voice?.latest(performance.now())?.sequence ?? -1
      setVoiceMode('singing')
    } catch {
      if (!alive || sessionToken !== token) return
      soundscape.pause()
      cancel()
      setError(
        'The reference note could not play. Tap Sing to try again when audio is available.',
      )
    }
  }

  async function start(): Promise<void> {
    const id = game.snapshot().nearbyBreakableId
    if (
      id === null ||
      !ready() ||
      paused() ||
      tutorial() ||
      voiceMode() !== 'off'
    )
      return
    const chosenTarget = target()
    setError(null)
    input.clear()
    stopSound()
    if (!game.beginEncounter(id, chosenTarget ?? 57)) return
    const currentToken = ++token
    const session = host.createVoice()
    voice = session
    sound = host.createSound()
    setVoiceMode('permission')
    refresh()
    try {
      // Start the microphone and context inside this gesture, but do not feed
      // our own fading music into calibration or pitch detection.
      await session.start(soundscape.silenceForVoice())
      if (!alive || currentToken !== token) {
        session.stop()
        return
      }
      stopObserving = session.subscribe(
        (observation, now) => {
          if (alive && voice === session) observe(observation, now)
        },
        () => {
          if (!alive || voice !== session) return
          soundscape.pause()
          cancel()
          setError('Audio was interrupted. Tap Sing to try again.')
        },
      )
      if (chosenTarget !== null) await reference(chosenTarget, currentToken)
      else {
        samples = []
        lastSequence = -1
        setVoiceMode('finding')
      }
    } catch (cause) {
      if (!alive || currentToken !== token) return
      cancel()
      setError(microphoneError(cause))
    }
  }

  function observe(observation: PitchObservation, now: number): void {
    if (observation.sequence === lastSequence) return
    lastSequence = observation.sequence
    const voiced =
      observation.midi !== null &&
      observation.confidence >= 0.5 &&
      now - observation.capturedAtMs <= 150
    setPitch(voiced ? observation.midi : null)
    if (voiceMode() === 'finding') {
      if (!voiced || observation.midi! < 36 || observation.midi! > 84) {
        samples = []
        return
      }
      const previous = samples.at(-1)
      if (
        previous &&
        (observation.captureSeconds - previous.captureSeconds > 0.1 ||
          Math.abs(observation.midi! - previous.midi!) > 0.8)
      )
        samples = []
      samples.push(observation)
      if (samples.length > 30) samples.shift()
      if (
        samples.length >= 12 &&
        observation.captureSeconds - samples[0].captureSeconds >= 0.45
      ) {
        const values = samples
          .map((sample) => sample.midi!)
          .sort((a, b) => a - b)
        const midi = Math.round(values[Math.floor(values.length / 2)])
        host.writePreference('comfortable-note', String(midi))
        void reference(midi, token)
      }
    } else if (voiceMode() === 'singing')
      events(game.feedPitch(observation, now))
  }

  function pause(): void {
    soundscape.pause()
    cancel()
    setPaused(true)
    game.setPaused(true)
    refresh()
  }

  function resume(): void {
    input.clear()
    setPaused(false)
    game.setPaused(tutorial())
    lastTime = 0
    refresh()
    soundscape.activate()
  }

  function closeTutorial(): void {
    host.writePreference('tutorial', 'seen')
    setTutorial(false)
    game.setPaused(paused())
    input.clear()
    refresh()
    soundscape.activate()
  }

  function showTutorial(): void {
    soundscape.pause()
    cancel()
    setTutorial(true)
    game.setPaused(true)
    refresh()
  }

  function changeNote(): void {
    cancel()
    setTarget(null)
    host.writePreference('comfortable-note', '')
  }

  function replay(): void {
    const midi = target()
    if (midi !== null && voiceMode() === 'singing')
      void reference(midi, ++token)
  }

  function changeAudio(patch: Partial<MuseumAudioPreferences>): void {
    music?.setPreferences(patch)
    setAudioPreferences(music?.preferences())
  }

  onMount(() => {
    try {
      renderer = createGlassRenderer(mount(), level, host.assetUrl, {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
          .matches,
        onAssetError: () => {
          if (alive)
            announce(
              'Some museum details could not load. Reopen the gallery when your connection is back.',
            )
        },
        onContextLost: () => {
          if (!alive) return
          graphicsFailed = true
          soundscape.pause()
          cancel()
          game.setPaused(true)
          setReady(false)
          setError(
            'The graphics connection stopped. Leave and reopen the museum; your progress is safe.',
          )
        },
      })
    } catch {
      setError(
        'The museum needs 3D graphics support. Reopen the game after closing other demanding apps.',
      )
    }
    void renderer?.ready
      .then(() => {
        if (alive && !graphicsFailed) setReady(true)
      })
      .catch(() => {
        if (alive)
          setError(
            'The museum could not load. Check your connection and reopen the game.',
          )
      })
    const tick = (now: number): void => {
      if (!alive) return
      const elapsed = lastTime === 0 ? 0 : (now - lastTime) / 1000
      lastTime = now
      if (ready() && !paused() && !tutorial()) {
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
      renderer?.render(game.snapshot(), Math.min(0.05, elapsed))
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    const keyDown = (event: KeyboardEvent): void => {
      if (game.snapshot().complete) return
      if (event.code === 'Escape') {
        event.preventDefault()
        if (tutorial()) closeTutorial()
        else if (voiceMode() !== 'off') cancel()
        else if (paused()) resume()
        else pause()
        return
      }
      if (tutorial() || paused()) return
      if (input.key(event, true)) {
        soundscape.activate()
        return
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select')
      )
        return
      if (event.code === 'KeyF' && !event.repeat) {
        event.preventDefault()
        void start()
      }
      if (event.code === 'KeyR') renderer?.recenter()
      if (event.code === 'KeyQ') renderer?.orbit(-0.08, 0)
      if (event.code === 'KeyE') renderer?.orbit(0.08, 0)
      if (event.code === 'KeyI') renderer?.orbit(0, -0.05)
      if (event.code === 'KeyK') renderer?.orbit(0, 0.05)
    }
    const keyUp = (event: KeyboardEvent): void => {
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
    cancelAnimationFrame(frameId)
    clearTimeout(noticeTimer)
    stopCapture()
    stopSound()
    soundscape.dispose()
    input.clear()
    renderer?.dispose()
  })
  return {
    snapshot,
    ready,
    error,
    voiceMode,
    pitch,
    target,
    notice,
    paused,
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
    enableMusic: soundscape.activate,
    cameraYaw: () => {
      snapshot()
      return renderer?.getCameraYaw() ?? 0
    },
    orbit: (x: number, y: number) => renderer?.orbit(x, y),
    setOrbitActive: (active: boolean) => renderer?.setOrbitActive(active),
    zoom: (delta: number) => renderer?.zoom(delta),
    recenter: () => renderer?.recenter(),
  }
}
