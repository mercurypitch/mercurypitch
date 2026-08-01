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
// The denied path is a designed route, not an error screen. It offers
// a retry, a device picker when the input is merely silent, and a way
// onward that still ends somewhere useful.

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import styles from '../onboarding.module.css'
import type { SettledNote } from '../settled-note'
import { settledNote } from '../settled-note'

/** Long enough for a median to settle, short enough not to be a chore. */
const LISTEN_SEC = 4

type Phase = 'ask' | 'opening' | 'listening' | 'heard' | 'blocked'

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
  const [error, setError] = createSignal<string | null>(null)
  const [note, setNote] = createSignal<SettledNote | null>(null)
  const [level, setLevel] = createSignal(0)
  const [devices, setDevices] = createSignal<MediaDeviceInfo[]>([])

  let session: VoiceSession | null = null
  let meter = 0

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

  onCleanup(() => {
    unregisterIndicator()
    cancelAnimationFrame(meter)
    session?.close()
    session = null
  })

  const pumpMeter = () => {
    setLevel(session?.level() ?? 0)
    meter = requestAnimationFrame(pumpMeter)
  }

  const fail = (message: string, offerPicker: boolean) => {
    setError(message)
    setPhase('blocked')
    if (offerPicker) void session?.devices().then(setDevices)
  }

  /** Must run straight from the tap — iOS Safari gates AudioContext on it. */
  const listen = async (): Promise<void> => {
    setError(null)
    setPhase('opening')
    session ??= createVoiceSession('first-light')

    const opened = await session.open()
    if (!opened.ok) {
      fail(opened.message, false)
      return
    }

    const probe = await session.probe()
    if (probe !== 'ok') {
      fail(
        "We can't hear anything from that input. It may be muted, or your browser may be listening to a different microphone.",
        true,
      )
      return
    }

    setPhase('listening')
    cancelAnimationFrame(meter)
    meter = requestAnimationFrame(pumpMeter)

    const frames: PitchFrame[] = await session.record(LISTEN_SEC)
    cancelAnimationFrame(meter)

    const heard = settledNote(frames)
    if (heard === null) {
      fail(
        "We didn't catch a steady note that time. Take a breath and sing an 'ahh' for a few seconds.",
        false,
      )
      return
    }

    session.close()
    session = null
    setNote(heard)
    setPhase('heard')
    props.onHeard(heard)
  }

  const pickDevice = async (deviceId: string): Promise<void> => {
    const result = await session?.useDevice(deviceId)
    if (result === 'ok') {
      setError(null)
      void listen()
    }
  }

  const giveUp = () => {
    session?.close()
    session = null
    props.onDenied()
  }

  return (
    <div class={styles.beat} data-beat="first-light">
      <Show when={phase() === 'ask'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot state="listening" size={84} title="" />
        </span>
        <p class={styles.eyebrow}>One note</p>
        <h1 class={styles.headline}>Let's hear you</h1>
        <p class={styles.sub}>
          Sing any note you like and hold it for a few seconds. We listen on
          your device — no audio is uploaded, and none of it is stored.
        </p>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => void listen()}
          >
            Allow microphone
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

      <Show when={phase() === 'listening'}>
        <span class={styles.mascot} aria-hidden="true">
          <Mascot
            state="listening"
            size={84}
            title=""
            energy={Math.min(100, level() * 900)}
          />
        </span>
        <p class={styles.eyebrow}>Listening</p>
        <h1 class={styles.headline}>
          Sing <span class={styles.lit}>ahh</span> — and hold it
        </h1>
        <div
          class={styles.meter}
          role="progressbar"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, level() * 12) * 100)}
        >
          <div
            class={styles.meterFill}
            style={{ width: `${Math.min(100, level() * 1200)}%` }}
          />
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
