// ============================================================
// Beat 2 — First light
// ============================================================
//
// The mic is asked HERE, one tap after the visitor said "sing one
// note" — at the moment of intent, with the reason on screen, not at
// first paint next to a tooltip.
//
// Then they hold a note and Merc says it back. That claim ("Merc can
// hear you") is the whole beat, which is why `settledNote` returns null
// rather than guessing: a confident wrong answer costs more here than
// an honest miss.
//
// Merc is the one listening on this beat, never "we" (owner decision,
// 11 Oct 2026). The lines the owner may swap live in ../copy.ts.
//
// Two rules earned from owner testing, and the reason this beat is
// shaped the way it is:
//
//   • NEVER record against a screen that hasn't said "sing now". The
//     old flow opened the mic and immediately spent four silent
//     seconds while the visitor was still reading, then blamed the
//     microphone. The take now starts on a voiced onset — the meter
//     is live first, and the countdown only begins once we hear a
//     voice — with a manual start as the escape hatch.
//   • A quiet room is not a broken microphone. The pre-flight probe
//     used to demand an audible signal before anyone had been asked
//     to sing, so a working mic in a silent room was sent to the
//     device picker under a "we can't hear anything" headline. Only a
//     dead-zero graph fails now (see ProbeResult in voice-session).
//
// The denied path is a designed route, not an error screen. It offers
// a retry, a device picker when the input is genuinely dead, and a way
// onward that still ends somewhere useful. "Continue without the mic"
// stays with "Try again" although the flow otherwise keeps one way out
// (owner decision V1): with no working microphone there is no voiceprint
// to skip, and the Map is the one place left to go. It sits under the
// retry as a quiet link, not beside it as its equal, so the retry reads as
// the way forward.
//
// Merc listens from the plate behind this beat (plates.ts), so the beat
// no longer draws its own small mascot.
//
// Where the wait and the take used to show a level bar, they show the
// Settings mic check's stage: the ribbon answers the level, and a held note
// throws notes that land on its key (mic-check/MicCheckStage.tsx). It never
// names the note; that claim waits for `settledNote`, for the reason above.
// Under it, a chip names the input Merc is hearing and opens every input
// with its role and a way to switch, and a second opens the fixes
// (FirstLightMic.tsx). When the nudge comes, the list opens by itself: the
// usual answer is a different microphone.

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import { MicCheckStage } from '@/features/mic-check/MicCheckStage'
import type { MicPermissionState } from '@/lib/jam/media-errors'
import { micPermissionState } from '@/lib/jam/media-errors'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { noteArticle } from '@/lib/note-utils'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import { FIRST_LIGHT_ASK, FIRST_LIGHT_ASK_ALLOWED, FIRST_LIGHT_AUTO_START, FIRST_LIGHT_DEAD_EYEBROW, FIRST_LIGHT_DEAD_INPUT, FIRST_LIGHT_HEADLINE, FIRST_LIGHT_HEARD, FIRST_LIGHT_HEARD_EYEBROW, FIRST_LIGHT_METER_LIVE, FIRST_LIGHT_NUDGE, FIRST_LIGHT_PICK_FAILED, FIRST_LIGHT_PRIVACY, } from '../copy'
import styles from '../onboarding.module.css'
import type { SettledNote } from '../settled-note'
import { settledNote } from '../settled-note'
import { createStageFeed, useInputRoster } from './first-light-mic'
import { FirstLightMic } from './FirstLightMic'

/** Long enough for a median to settle, short enough not to be a chore. */
const LISTEN_SEC = 4

/**
 * The onset bar, as an RMS level. Fixed alone it is wrong in half the
 * rooms — too low next to a fan, too high for a quiet singer on a
 * low-gain input — so it is a floor, and the room's own noise sets the
 * real bar (see FLOOR_MS).
 */
const ONSET_RMS = 0.01

/** Consecutive frames above the bar. Four rAF frames is about 60ms. */
const ONSET_FRAMES = 4

/** How long we listen to the room before judging anything in it. */
const FLOOR_MS = 600

/** The onset must clear the room's own noise by this much. */
const FLOOR_HEADROOM = 3.5

/**
 * The bar can never end up above this, whatever the room measured. A
 * singer who was already holding a note when this screen appeared
 * teaches the floor their own voice, and a bar set 3.5x above that is
 * one nothing can clear — the take would never start.
 */
const LOUD_RMS = 0.03

/** After this much silence, stop waiting quietly and offer real help. */
const NUDGE_MS = 9000

/** Above this the meter reads as "that's you", not room tone. */
const AUDIBLE_RMS = 0.006

/**
 * Auto-start is a convenience, and in a room loud enough to trigger it
 * by itself it would loop: start, catch no note, re-arm, start again.
 * After two of those, the singer presses the button.
 */
const MAX_AUTO_TAKES = 2

type Phase = 'ask' | 'opening' | 'waiting' | 'listening' | 'heard' | 'blocked'

export interface BeatFirstLightProps {
  /** Carries the heard note forward so beat 3 can name it back. */
  onHeard: (note: SettledNote) => void
  /** Move to the fork. User-paced — the reveal is the payoff, not a splash. */
  onContinue: () => void
  /** The mic is unusable — route onward to the Map. */
  onDenied: () => void
  /**
   * The live mic level (RMS), every frame the meter runs, and 0 once it
   * stops. FirstLight turns it into the glow where the star will light
   * (owner decision V11): on main a small Merc here pulsed with it.
   */
  onLevel?: (level: number) => void
}

export const BeatFirstLight: Component<BeatFirstLightProps> = (props) => {
  const [phase, setPhase] = createSignal<Phase>('ask')
  const [permission, setPermission] = createSignal<MicPermissionState | null>(
    null,
  )
  const [error, setError] = createSignal<string | null>(null)
  const [picker, setPicker] = createSignal(false)
  // The input opened and carries nothing at all. Not a missing microphone:
  // the screen and the input's row both say "No signal".
  const [deadInput, setDeadInput] = createSignal(false)
  const [hint, setHint] = createSignal<string | null>(null)
  const [nudged, setNudged] = createSignal(false)
  const [manual, setManual] = createSignal(false)
  const [note, setNote] = createSignal<SettledNote | null>(null)
  const [level, setLevel] = createSignal(0)
  const [remaining, setRemaining] = createSignal(LISTEN_SEC)
  const [switching, setSwitching] = createSignal<string | null>(null)
  const [silentPick, setSilentPick] = createSignal<string | null>(null)

  const stage = createStageFeed()
  const inputs = useInputRoster()

  let session: VoiceSession | null = null
  let meter = 0
  let ticker = 0
  let probed = false
  let waitStarted = 0
  let roomFloor = 0
  let aboveFrames = 0
  let takeStarted = false
  let autoOnset = true
  let autoTakes = 0

  // Mic sentinel: this beat holds the shared mic while its session is
  // open, and has no persistent mic icon — without a registered
  // indicator every take tripped the live-without-ui watchdog. The open
  // session IS the honest "on" signal here.
  const unregisterIndicator = registerMicIndicator(
    'first-light',
    () => session?.isOpen() ?? false,
    () => {
      session?.close()
      session = null
    },
  )

  // What the browser has already decided, so the ask screen can say the
  // truth. With permission granted there is no prompt to explain, and a
  // button labelled "Allow microphone" is a lie the visitor then waits
  // on — the exact confusion this beat was reported for.
  onMount(() => {
    void micPermissionState().then((state) => {
      // Untracked on purpose: this resolves outside any reactive scope,
      // and reading `phase()` here must not subscribe anything to it.
      untrack(() => {
        setPermission(state)
        if (state !== 'denied' || phase() !== 'ask') return
        setPicker(false)
        setError(
          'Your browser is blocking the microphone for this site. Allow it in the site settings (the padlock or sliders next to the address), then try again.',
        )
        setPhase('blocked')
      })
    })
  })

  onCleanup(() => {
    unregisterIndicator()
    cancelAnimationFrame(meter)
    clearInterval(ticker)
    stage.stop()
    session?.close()
    session = null
    props.onLevel?.(0)
  })

  const fail = (message: string, offerPicker: boolean, dead = false) => {
    cancelAnimationFrame(meter)
    props.onLevel?.(0)
    clearInterval(ticker)
    stage.stop()
    setError(message)
    setPicker(offerPicker)
    setDeadInput(dead)
    setPhase('blocked')
    if (offerPicker) void inputs.refresh()
  }

  /** The take itself, once we know someone is actually singing. */
  const capture = async (): Promise<void> => {
    if (session === null) return
    setPhase('listening')
    setRemaining(LISTEN_SEC)
    clearInterval(ticker)
    ticker = window.setInterval(() => {
      setRemaining((left) => Math.max(0, left - 1))
    }, 1000)

    const frames: PitchFrame[] = await session.record(LISTEN_SEC)
    clearInterval(ticker)

    const heard = settledNote(frames)
    if (heard === null) {
      // We heard *something* — that is why we started — so this is a
      // wobble, not a fault. Sending it to the "no microphone" screen
      // was the bug: it blamed working hardware for a wandering note.
      setHint(
        "Almost. That one wandered. Take a breath and hold a single 'ahh'.",
      )
      wait()
      return
    }

    cancelAnimationFrame(meter)
    props.onLevel?.(0)
    stage.stop()
    session.close()
    session = null
    setNote(heard)
    setPhase('heard')
    props.onHeard(heard)
  }

  const watchForVoice = (value: number) => {
    if (takeStarted || !autoOnset) return
    const elapsed = performance.now() - waitStarted

    // Learn the room before judging it. A fixed threshold is wrong in a
    // kitchen and wrong again in a treated room; the loudest thing in
    // the first 600ms of silence is what we have to beat.
    if (elapsed < FLOOR_MS) {
      if (value > roomFloor) roomFloor = value
      return
    }

    if (!nudged() && elapsed > NUDGE_MS) {
      setNudged(true)
      void inputs.refresh()
    }

    const bar = Math.min(
      Math.max(ONSET_RMS, roomFloor * FLOOR_HEADROOM),
      LOUD_RMS,
    )
    aboveFrames = value > bar ? aboveFrames + 1 : 0
    if (aboveFrames < ONSET_FRAMES) return
    takeStarted = true
    autoTakes += 1
    void capture()
  }

  const pump = (now: number) => {
    const value = session?.level() ?? 0
    setLevel(value)
    props.onLevel?.(value)
    stage.read(session, now)
    if (phase() === 'waiting') watchForVoice(value)
    meter = requestAnimationFrame(pump)
  }

  /** Live meter, no recording: the screen that says "go ahead, sing". */
  const wait = () => {
    takeStarted = false
    autoOnset = autoTakes < MAX_AUTO_TAKES
    setManual(!autoOnset)
    aboveFrames = 0
    roomFloor = 0
    waitStarted = performance.now()
    setNudged(false)
    setPhase('waiting')
    session?.arm()
    // Names arrive with the grant, and the input heard is the one opened.
    void inputs.refresh()
    cancelAnimationFrame(meter)
    meter = requestAnimationFrame(pump)
  }

  const startNow = () => {
    if (takeStarted) return
    takeStarted = true
    void capture()
  }

  /** Must run straight from the tap — iOS Safari gates AudioContext on it. */
  const listen = async (): Promise<void> => {
    setError(null)
    setHint(null)
    session ??= createVoiceSession('first-light')

    // Re-opening an already-open session builds a second graph over the
    // first, so every "Try again" used to leak an AudioContext.
    if (!session.isOpen()) {
      setPhase('opening')
      const opened = await session.open()
      if (!opened.ok) {
        fail(opened.message, false)
        return
      }
      probed = false
    }

    // Once per open. The probe costs up to 1.8s of dead air and only
    // answers one question — is the graph alive — which cannot change
    // between two taps of the same button.
    if (!probed) {
      const result = await session.probe()
      probed = true
      if (result === 'silent' || result === 'no-session') {
        fail(FIRST_LIGHT_DEAD_INPUT, true, true)
        return
      }
    }

    wait()
  }

  const pickDevice = async (deviceId: string): Promise<void> => {
    const current = session
    if (current === null || switching() !== null) return
    setSwitching(deviceId)
    setSilentPick(null)
    let result: Awaited<ReturnType<VoiceSession['useDevice']>>
    try {
      result = await current.useDevice(deviceId)
    } finally {
      setSwitching(null)
    }
    // Closed under the switch: the beat is gone, or the singer moved on.
    if (session !== current) return
    if (micManager.getStream() === null) {
      // The new input would not open, and the old one is closed already.
      fail(FIRST_LIGHT_PICK_FAILED, true)
      return
    }
    setError(null)
    setHint(null)
    probed = true
    // An input with no signal at all is still the one being heard: say so
    // on its row, and keep the meter live for the next pick. Going quiet
    // here was the old bug, a switch that changed nothing on screen.
    if (result === 'silent' || result === 'no-session') setSilentPick(deviceId)
    wait()
  }

  const giveUp = () => {
    cancelAnimationFrame(meter)
    props.onLevel?.(0)
    clearInterval(ticker)
    stage.stop()
    session?.close()
    session = null
    props.onDenied()
  }

  const meterValue = () => Math.round(Math.min(1, level() * 12) * 100)

  return (
    <div class={styles.beat} data-beat="first-light">
      <Show when={phase() === 'ask'}>
        <p class={styles.eyebrow}>One note</p>
        <h1 class={styles.headline}>{FIRST_LIGHT_HEADLINE}</h1>
        <p class={styles.sub}>
          {permission() === 'granted'
            ? FIRST_LIGHT_ASK_ALLOWED
            : FIRST_LIGHT_ASK}{' '}
          {FIRST_LIGHT_PRIVACY}
        </p>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => void listen()}
          >
            {permission() === 'granted'
              ? 'Start listening'
              : 'Allow microphone'}
          </button>
        </div>
      </Show>

      <Show when={phase() === 'opening'}>
        <p class={styles.eyebrow}>Waking the microphone</p>
        <h1 class={styles.headline}>One moment</h1>
        <p class={styles.sub}>
          Your browser will ask for permission. Choose Allow.
        </p>
      </Show>

      <Show when={phase() === 'waiting'}>
        <p class={styles.eyebrow}>Your turn</p>
        <h1 class={styles.headline}>
          Sing <span class={styles.lit}>ahh</span> whenever you're ready
        </h1>
        {/* The hardest mic failure is the one that does NOT error: another
            tab holding the device leaves us a granted stream that carries
            almost no signal, so the stage stays flat and nothing here can
            say why. After nine seconds of nothing, the likely cause takes
            the instructions' place, and the list of inputs opens under the
            stage the singer is watching, rather than waiting to fail them
            first. */}
        <Show
          when={!nudged()}
          fallback={<p class={styles.sub}>{FIRST_LIGHT_NUDGE}</p>}
        >
          <Show
            when={manual()}
            fallback={<p class={styles.sub}>{FIRST_LIGHT_AUTO_START}</p>}
          >
            <p class={styles.sub}>
              Any note at all, held for a few seconds. Take a breath, then press
              start and sing.
            </p>
          </Show>
        </Show>
      </Show>

      <Show when={phase() === 'listening'}>
        <p class={styles.recordingTag}>Recording</p>
        <h1 class={styles.headline}>
          Hold it: <span class={styles.lit}>{remaining()}s</span>
        </h1>
      </Show>

      {/* One stage for the wait and the take, so the note that starts the
          take keeps flying when the screen turns to "Hold it". */}
      <Show when={phase() === 'waiting' || phase() === 'listening'}>
        <div
          class={styles.stage}
          classList={{
            [styles.stageCompact]: phase() === 'waiting' && nudged(),
            [styles.stageTake]: phase() === 'listening',
          }}
          role="progressbar"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meterValue()}
        >
          <MicCheckStage
            live={stage.live}
            listening
            keys="soft"
            labels={false}
          />
        </div>
      </Show>

      <Show when={phase() === 'waiting'}>
        {/* Once nudged, the line above already says what this would. */}
        <Show when={!nudged()}>
          <p
            class={`${styles.meterCaption} ${
              level() > AUDIBLE_RMS ? styles.meterCaptionLive : ''
            }`}
          >
            {level() > AUDIBLE_RMS
              ? FIRST_LIGHT_METER_LIVE
              : 'Microphone is on and listening'}
          </p>
        </Show>

        <Show when={hint() !== null}>
          <p class={styles.recordHint}>{hint()}</p>
        </Show>

        <FirstLightMic
          roster={inputs.roster()}
          settings={inputs.settings()}
          helpDue={nudged()}
          showInputs
          switching={switching()}
          silentPick={silentPick()}
          onPick={(deviceId) => void pickDevice(deviceId)}
        />

        <div class={styles.actionStack}>
          <button
            type="button"
            class={manual() ? styles.primary : styles.secondary}
            onClick={startNow}
          >
            {manual() ? 'Start the take' : 'Start the take now'}
          </button>
          <Show when={nudged()}>
            <button type="button" class={styles.quietAction} onClick={giveUp}>
              Continue without the mic
            </button>
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'heard'}>
        <p class={styles.eyebrow}>{FIRST_LIGHT_HEARD_EYEBROW}</p>
        <h1 class={styles.headline}>
          {/* "an A3", not "a A3" — the note name is read out loud, and A,
              E and F are all said starting on a vowel sound. */}
          That's {noteArticle(note()?.note ?? '')}{' '}
          <span class={styles.lit}>{note()?.note}</span>
        </h1>
        <p class={styles.readout}>
          {note()?.hz.toFixed(1)} Hz · held for{' '}
          {note()?.voicedSeconds.toFixed(1)}s
        </p>
        <p class={styles.sub}>{FIRST_LIGHT_HEARD}</p>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => props.onContinue()}
          >
            Keep going
          </button>
        </div>
      </Show>

      <Show when={phase() === 'blocked'}>
        <p class={styles.eyebrow}>
          {deadInput() ? FIRST_LIGHT_DEAD_EYEBROW : 'No microphone'}
        </p>
        <h1 class={styles.headline}>Merc can't hear you yet</h1>
        <p class={styles.sub}>{error()}</p>

        {/* The same chips as the wait: the inputs, open, when the input
            carried nothing (the picker), and the fixes either way. A
            blocked permission keeps them closed, since its fix is the
            site settings the line above names. */}
        <FirstLightMic
          roster={inputs.roster()}
          settings={inputs.settings()}
          helpDue={picker()}
          showInputs={picker()}
          listeningSilent={deadInput()}
          switching={switching()}
          silentPick={silentPick()}
          onPick={(deviceId) => void pickDevice(deviceId)}
        />

        <div class={styles.actionStack}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => void listen()}
          >
            Try again
          </button>
          <button type="button" class={styles.quietAction} onClick={giveUp}>
            Continue without the mic
          </button>
        </div>
      </Show>
    </div>
  )
}

export default BeatFirstLight
