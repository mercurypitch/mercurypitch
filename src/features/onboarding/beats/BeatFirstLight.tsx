// ============================================================
// Beat 2 — First light
// ============================================================
//
// The mic is asked HERE, one tap after the visitor said "sing one
// note" — at the moment of intent, with the reason on screen, not at
// first paint next to a tooltip.
//
// Then they hold a note and we say it back. That claim ("we can hear
// you") is the whole beat, which is why `settledNote` returns null
// rather than guessing: a confident wrong answer costs more here than
// an honest miss.
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
// onward that still ends somewhere useful.

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { MicTroubleshooting } from '@/components/MicTroubleshooting'
import type { MicPermissionState } from '@/lib/jam/media-errors'
import { micPermissionState } from '@/lib/jam/media-errors'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import styles from '../onboarding.module.css'
import type { SettledNote } from '../settled-note'
import { settledNote } from '../settled-note'

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
}

export const BeatFirstLight: Component<BeatFirstLightProps> = (props) => {
  const [phase, setPhase] = createSignal<Phase>('ask')
  const [permission, setPermission] = createSignal<MicPermissionState | null>(
    null,
  )
  const [error, setError] = createSignal<string | null>(null)
  const [picker, setPicker] = createSignal(false)
  const [hint, setHint] = createSignal<string | null>(null)
  const [nudged, setNudged] = createSignal(false)
  const [manual, setManual] = createSignal(false)
  const [note, setNote] = createSignal<SettledNote | null>(null)
  const [level, setLevel] = createSignal(0)
  const [remaining, setRemaining] = createSignal(LISTEN_SEC)
  const [devices, setDevices] = createSignal<MediaDeviceInfo[]>([])

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
          'Your browser is blocking the microphone for this site. Allow it in the site settings — the padlock or sliders next to the address — and try again.',
        )
        setPhase('blocked')
      })
    })
  })

  onCleanup(() => {
    unregisterIndicator()
    cancelAnimationFrame(meter)
    clearInterval(ticker)
    session?.close()
    session = null
  })

  const fail = (message: string, offerPicker: boolean) => {
    cancelAnimationFrame(meter)
    clearInterval(ticker)
    setError(message)
    setPicker(offerPicker)
    setPhase('blocked')
    if (offerPicker) void session?.devices().then(setDevices)
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
        "Almost — that one wandered. Take a breath and hold a single 'ahh'.",
      )
      wait()
      return
    }

    cancelAnimationFrame(meter)
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
      void session?.devices().then(setDevices)
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

  const pump = () => {
    const value = session?.level() ?? 0
    setLevel(value)
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
        fail(
          "That input is carrying no signal at all — not even room tone. It's likely muted at the system level, or your browser is listening to a different microphone.",
          true,
        )
        return
      }
    }

    wait()
  }

  const pickDevice = async (deviceId: string): Promise<void> => {
    const result = await session?.useDevice(deviceId)
    if (result !== 'ok' && result !== 'quiet') return
    setError(null)
    setHint(null)
    probed = true
    wait()
  }

  const giveUp = () => {
    cancelAnimationFrame(meter)
    clearInterval(ticker)
    session?.close()
    session = null
    props.onDenied()
  }

  const meterWidth = () => Math.min(100, level() * 1200)

  return (
    <div class={styles.beat} data-beat="first-light">
      <Show when={phase() === 'ask'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot state="listening" size={84} title="" />
        </span>
        <p class={styles.eyebrow}>One note</p>
        <h1 class={styles.headline}>Let's hear you</h1>
        <Show
          when={permission() === 'granted'}
          fallback={
            <p class={styles.sub}>
              Sing any note you like and hold it for a few seconds. Your browser
              will ask for the microphone first — choose Allow. We listen on
              your device; no audio is uploaded, and none of it is stored.
            </p>
          }
        >
          <p class={styles.sub}>
            Your microphone is already allowed. Sing any note you like and hold
            it — we start recording the moment we hear you. It all happens on
            your device; no audio is uploaded, and none of it is stored.
          </p>
        </Show>
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
          Your browser will ask for permission — choose Allow.
        </p>
      </Show>

      <Show when={phase() === 'waiting'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot
            state="listening"
            size={84}
            title=""
            energy={Math.min(100, level() * 900)}
          />
        </span>
        <p class={styles.eyebrow}>Your turn</p>
        <h1 class={styles.headline}>
          Sing <span class={styles.lit}>ahh</span> — whenever you're ready
        </h1>
        <Show
          when={manual()}
          fallback={
            <p class={styles.sub}>
              Any note at all, held for a few seconds. Recording starts by
              itself the moment we hear you.
            </p>
          }
        >
          <p class={styles.sub}>
            Any note at all, held for a few seconds. Take a breath, then press
            start and sing.
          </p>
        </Show>

        <div
          class={styles.meterBig}
          role="progressbar"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, level() * 12) * 100)}
        >
          <div class={styles.meterFill} style={{ width: `${meterWidth()}%` }} />
        </div>
        <p
          class={`${styles.meterCaption} ${
            level() > AUDIBLE_RMS ? styles.meterCaptionLive : ''
          }`}
        >
          {level() > AUDIBLE_RMS
            ? 'We can hear you'
            : 'Microphone is on and listening'}
        </p>

        <Show when={hint() !== null}>
          <p class={styles.recordHint}>{hint()}</p>
        </Show>

        {/* The hardest mic failure is the one that does NOT error: another
            tab holding the device leaves us a granted stream that carries
            almost no signal, so the meter sits flat and nothing here can
            say why. After nine seconds of nothing, put the recovery steps
            where the singer is actually stuck — next to the meter they
            are watching — rather than waiting to fail them first. */}
        <Show when={nudged()}>
          <p class={styles.recordHint}>
            Still nothing on the meter. If you are singing, the browser is
            probably listening to a different microphone.
          </p>
          <Show when={devices().length > 1}>
            <div class={styles.deviceList}>
              <For each={devices()}>
                {(device) => (
                  <button
                    type="button"
                    class={styles.sideDoor}
                    onClick={() => void pickDevice(device.deviceId)}
                  >
                    {device.label !== '' ? device.label : 'Microphone'}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <div class={styles.micHelp}>
            <MicTroubleshooting />
          </div>
        </Show>

        <div class={styles.actions}>
          <button
            type="button"
            class={manual() ? styles.primary : styles.secondary}
            onClick={startNow}
          >
            {manual() ? 'Start the take' : 'Start the take now'}
          </button>
          <Show when={nudged()}>
            <button type="button" class={styles.secondary} onClick={giveUp}>
              Continue without the mic
            </button>
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'listening'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot
            state="listening"
            size={84}
            title=""
            energy={Math.min(100, level() * 900)}
          />
        </span>
        <p class={styles.recordingTag}>Recording</p>
        <h1 class={styles.headline}>
          Hold it — <span class={styles.lit}>{remaining()}s</span>
        </h1>
        <div
          class={styles.meterBig}
          role="progressbar"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, level() * 12) * 100)}
        >
          <div class={styles.meterFill} style={{ width: `${meterWidth()}%` }} />
        </div>
      </Show>

      <Show when={phase() === 'heard'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot state="celebrate" size={84} title="" />
        </span>
        <p class={styles.eyebrow}>We heard you</p>
        <h1 class={styles.headline}>
          That's a <span class={styles.lit}>{note()?.note}</span>
        </h1>
        <p class={styles.readout}>
          {note()?.hz.toFixed(1)} Hz · held for{' '}
          {note()?.voicedSeconds.toFixed(1)}s
        </p>
        <p class={styles.sub}>
          One note, and the sky has a star in it. There's a lot more where that
          came from.
        </p>
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
        <p class={styles.eyebrow}>No microphone</p>
        <h1 class={styles.headline}>We can carry on without it</h1>
        <p class={styles.sub}>{error()}</p>

        <div class={styles.micHelp}>
          <MicTroubleshooting />
        </div>

        <Show when={picker() && devices().length > 1}>
          <div class={styles.deviceList}>
            <For each={devices()}>
              {(device) => (
                <button
                  type="button"
                  class={styles.sideDoor}
                  onClick={() => void pickDevice(device.deviceId)}
                >
                  {device.label !== '' ? device.label : 'Microphone'}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => void listen()}
          >
            Try again
          </button>
          <button type="button" class={styles.secondary} onClick={giveUp}>
            Continue without the mic
          </button>
        </div>
      </Show>
    </div>
  )
}

export default BeatFirstLight
