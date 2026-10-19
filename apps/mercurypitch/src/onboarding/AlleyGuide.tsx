// ============================================================
// AlleyGuide: Merc's welcome in the alley (S7b beat 1)
// ============================================================
//
// A new install's first alley, with its headline ("Pick a room. Make a
// sound."), is beat 1: Merc drops in on the cobbles, lands, says hello and
// points at the doors, and the open doors light in turn, the Ear Lab, then
// Karaoke, then Sing. Then he waits in his idle breath while the singer
// picks. A door picked, he steps aside (fades out) and comes back when it
// is put back. An install whose onboarding is done (onboarding-flag.ts)
// sees the alley as it always was: RoomsAlley mounts this only under the
// headline, and it shows nothing unless the onboarding is due.
//
// Where he stands is alley-guide-place.ts: never over a door. His time
// starts when he is first drawn (MercView's onReady), so a slow first
// load does not cut his drop short; without WebGL he is never drawn, and
// the doors light all the same, with no hello.
//
// Reduced motion: no drop, he is simply there; his line and the doors'
// lights come and go in 150 ms fades.
//
// Merc is decorative and his line beside him is hidden from a screen
// reader: the hello is read once, politely, from a live region of its own.
// His hello is remembered for the session (alley-greeting.ts), so the
// first note does not say it again.
//
// Loaded lazily by RoomsAlley on a build with the onboarding only
// (NATIVE_ONBOARDING), so the store build carries none of it.

import './alley-guide.css'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, Show, } from 'solid-js'
import { MercView } from '@/components/room-kit/MercView'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import type { MercState } from '@/lib/merc/constants'
import type { DoorKey } from '../alley/alley-plate'
import { DOORS, isEnterable } from '../alley/alley-plate'
import { markAlleyGreeted } from './alley-greeting'
import type { GuideInput } from './alley-guide-place'
import { guidePlace } from './alley-guide-place'
import { ONBOARDING_COPY } from './onboarding-copy'
import { onboardingDue } from './onboarding-flag'

/** His beat, ms from when he is first drawn. */
export interface GuideTimes {
  /** His hello appears: he has landed. */
  readonly hello: number
  /** He points at the doors. */
  readonly point: number
  /** The first door lights; the next ones one `every` after another. */
  readonly light: number
  readonly every: number
}

export const GUIDE_TIMES: GuideTimes = {
  hello: 1200,
  point: 1700,
  light: 1900,
  every: 600,
}

/** Under reduced motion: no drop to wait for. */
export const GUIDE_STILL_TIMES: GuideTimes = {
  hello: 0,
  point: 400,
  light: 600,
  every: 600,
}

/** Never drawn (no WebGL) by then: the doors light all the same, ms. */
export const UNDRAWN_MS = 1500

/** The open doors, left to right: the ones he points at. */
export const DOORS_IN_TURN: readonly DoorKey[] = DOORS.filter((door) =>
  isEnterable(door.key),
).map((door) => door.key)

export interface AlleyGuideProps {
  /** The alley as it measures: where he can stand. */
  input: () => GuideInput
  /** The alley's reduced motion (the shell's or the phone's), read once. */
  reduced: () => boolean
  /** A door is picked, opening or open: he steps aside. */
  aside: () => boolean
  /** The door lit for him, one at a time, or none. */
  light: (door: DoorKey | null) => void
}

export function AlleyGuide(props: AlleyGuideProps): JSX.Element {
  // Read once: the beat is timed from the start for one or the other.
  const still = props.reduced()
  const times = still ? GUIDE_STILL_TIMES : GUIDE_TIMES
  const place = createMemo(() => guidePlace(props.input()))
  const [state, setState] = createSignal<MercState>(still ? 'idle' : 'drop')
  const [hello, setHello] = createSignal(false)

  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, run: () => void): void => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      run()
    }, ms)
    timers.add(timer)
  }
  const quiet = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
  onCleanup(() => {
    quiet()
    props.light(null)
  })

  let lighting = false
  let drawn = false
  /** The doors in turn, once: from his own beat, or without him. */
  const lightDoors = (from: number): void => {
    if (lighting) return
    lighting = true
    DOORS_IN_TURN.forEach((door, index) => {
      later(from + index * times.every, () => props.light(door))
    })
    later(from + DOORS_IN_TURN.length * times.every, () => props.light(null))
  }
  /** He is drawn: his hello once he has landed, then he points. */
  const meet = (): void => {
    if (drawn) return
    drawn = true
    later(times.hello, () => {
      setHello(true)
      markAlleyGreeted()
    })
    later(times.point, () => setState('point'))
    later(times.light + DOORS_IN_TURN.length * times.every, () =>
      setState('idle'),
    )
    lightDoors(times.light)
  }
  // Never drawn (no WebGL, or a load slower than this): the doors light all
  // the same, and he says hello if he arrives after all.
  later(UNDRAWN_MS, () => lightDoors(0))

  // A door picked: what is still to come is called off, and the lit door
  // goes out. He is back, in his idle, when the door goes back.
  createEffect(
    on(
      props.aside,
      (aside) => {
        if (!aside) return
        quiet()
        lighting = true
        drawn = true
        props.light(null)
        setState('idle')
      },
      { defer: true },
    ),
  )

  return (
    <Show when={onboardingDue() ? place() : null}>
      {(at) => (
        <>
          <div
            class="mp-alley-guide"
            data-testid="alley-guide"
            data-aside={props.aside() ? 'on' : 'off'}
            data-still={still ? 'on' : 'off'}
            aria-hidden="true"
          >
            <div
              class="mp-alley-guide__merc"
              style={{
                left: `${at().x}px`,
                top: `${at().y}px`,
                width: `${at().size}px`,
                height: `${at().size}px`,
              }}
            >
              <MercView
                state={state}
                voice={() => SILENT_VOICE}
                still={() => still}
                rings={false}
                class="mp-alley-guide__view"
                testId="alley-merc"
                onReady={meet}
              />
            </div>
            <Show when={at().line}>
              {(line) => (
                <p
                  class="mp-alley-guide__line"
                  data-shown={hello() ? 'on' : 'off'}
                  data-testid="alley-guide-line"
                  style={{
                    left: `${line().x}px`,
                    top: `${line().y}px`,
                    'max-width': `${line().width}px`,
                  }}
                >
                  {ONBOARDING_COPY.hello}
                </p>
              )}
            </Show>
          </div>
          <span
            class="mp-alley-guide__said"
            aria-live="polite"
            data-testid="alley-guide-said"
          >
            {hello() ? ONBOARDING_COPY.hello : ''}
          </span>
        </>
      )}
    </Show>
  )
}
