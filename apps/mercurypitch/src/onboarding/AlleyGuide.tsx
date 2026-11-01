// ============================================================
// AlleyGuide: Merc's welcome in the alley (S7b beat 1)
// ============================================================
//
// A new install's first alley, with its headline ("Pick a room. Make a
// sound."), is beat 1: Merc drops in on the road in front of the middle
// door, lands with his feet on its floor line, says hello and points at the
// doors, and the open doors light in turn, the Ear Lab, then Karaoke, then
// Sing. Then he says where to start, "Start here: the Sing room.", and the
// Sing door stays lit while the onboarding is due: the hello alone left a
// new singer with six doors and nothing to choose by. The doors not open
// yet are dimmed meanwhile (RoomsAlley), so the three that open stand out.
// Then he waits in his idle breath while the singer picks. A door picked,
// he steps aside (fades out, then stops drawing), his line first, so the
// door's card never comes in over his words, and he comes back when it is
// put back, the Sing door lit again.
// An install whose onboarding is done (onboarding-flag.ts) sees the alley
// as it always was: RoomsAlley mounts this only under the headline, and it
// shows nothing unless the onboarding is due.
//
// Where he stands is alley-guide-place.ts: sized to the door behind him,
// which takes taps through him, with his line under him, over no door. His
// time starts when he is first drawn (MercView's onReady), so a slow first
// load does not cut his drop short; without WebGL he is never drawn, and
// the doors light all the same, with no hello.
//
// Reduced motion: no drop, he is simply there; his line and the doors'
// lights come and go in 150 ms fades.
//
// Merc is decorative and his line under him is hidden from a screen
// reader: each of his two lines is read once, politely, from a live region
// of its own.
// His hello is remembered for the session (alley-greeting.ts), so the
// first note does not say it again.
//
// Counted (S7b §7): the welcome shown, and a door opened from it.
//
// Loaded lazily by RoomsAlley on a build with the onboarding only
// (NATIVE_ONBOARDING), so the store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, Show, untrack, } from 'solid-js'
import './alley-guide.css'
import { MercView } from '@/components/room-kit/MercView'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import { trackNativeOnboarding } from '@/features/onboarding/funnel'
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

/**
 * His fade out for a picked door (alley-guide.css), after which his frame
 * loop stops until the door goes back, ms.
 */
export const ASIDE_MS = 240
/** The same under reduced motion. */
export const ASIDE_STILL_MS = 150

/** The open doors, left to right: the ones he points at. */
export const DOORS_IN_TURN: readonly DoorKey[] = DOORS.filter((door) =>
  isEnterable(door.key),
).map((door) => door.key)

/** The door he sends a new singer to, lit once the doors have had their turn. */
export const START_DOOR: DoorKey = 'sing'

export interface AlleyGuideProps {
  /** The alley as it measures: where he can stand. */
  input: () => GuideInput
  /** The alley's reduced motion (the shell's or the phone's), read once. */
  reduced: () => boolean
  /** A door is picked, opening or open: he steps aside. */
  aside: () => boolean
  /** A door is opening: the welcome is done. */
  opened: () => boolean
  /** The door lit for him, one at a time, or none. */
  light: (door: DoorKey | null) => void
}

export function AlleyGuide(props: AlleyGuideProps): JSX.Element {
  // Read once: the beat is timed from the start for one or the other.
  const still = untrack(() => props.reduced())
  // The door to light: a plain callback, read once.
  const light = untrack(() => props.light)
  const times = still ? GUIDE_STILL_TIMES : GUIDE_TIMES
  const place = createMemo(() => guidePlace(props.input()))
  const [state, setState] = createSignal<MercState>(still ? 'idle' : 'drop')
  /** His line: none yet, his hello, then where to start. */
  const [said, setSaid] = createSignal<'hello' | 'start' | null>(null)
  const hello = (): boolean => said() !== null
  const lineText = (): string =>
    said() === 'start' ? ONBOARDING_COPY.startHere : ONBOARDING_COPY.hello

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
    light(null)
  })

  let lighting = false
  let drawn = false
  /** The doors have had their turn: the door to start at stays lit. */
  let settled = false
  /**
   * The doors in turn, once, from his own beat or without him; then the
   * door to start at, lit for as long as he is there, and his word on it
   * once he has said hello.
   */
  const lightDoors = (from: number): void => {
    if (lighting) return
    lighting = true
    DOORS_IN_TURN.forEach((door, index) => {
      later(from + index * times.every, () => light(door))
    })
    later(from + DOORS_IN_TURN.length * times.every, () => {
      settled = true
      light(START_DOOR)
      if (untrack(said) !== null) setSaid('start')
    })
  }
  /** He is drawn: his hello once he has landed, then he points. */
  const meet = (): void => {
    if (drawn) return
    drawn = true
    later(times.hello, () => {
      setSaid(settled ? 'start' : 'hello')
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

  // Counted once each: the welcome on a due install, and a door opened
  // from it.
  let viewed = false
  let completed = false
  createEffect(() => {
    if (viewed || !onboardingDue()) return
    viewed = true
    trackNativeOnboarding('native_onboarding_welcome_view')
  })
  createEffect(() => {
    if (completed || !viewed || !props.opened()) return
    completed = true
    trackNativeOnboarding('native_onboarding_welcome_complete')
  })

  // A door picked: what is still to come is called off, and the lit door
  // goes out. He is back, in his idle, when the door goes back, and the
  // door to start at is lit again, with his word on it.
  createEffect(
    on(
      () => props.aside(),
      (aside) => {
        if (!aside) {
          if (settled) light(START_DOOR)
          return
        }
        quiet()
        lighting = true
        drawn = true
        settled = true
        light(null)
        setState('idle')
        if (untrack(said) !== null) setSaid('start')
      },
      { defer: true },
    ),
  )

  // Faded out for a picked door, he stops drawing until it goes back: an
  // unseen Merc takes nothing from the door's open (a software renderer
  // otherwise stalls the open by seconds).
  const [resting, setResting] = createSignal(false)
  let restTimer: ReturnType<typeof setTimeout> | undefined
  const stopResting = (): void => {
    clearTimeout(restTimer)
    restTimer = undefined
  }
  createEffect(
    on(
      () => props.aside(),
      (aside) => {
        stopResting()
        if (!aside) {
          setResting(false)
          return
        }
        restTimer = setTimeout(
          () => {
            restTimer = undefined
            setResting(true)
          },
          still ? ASIDE_STILL_MS : ASIDE_MS,
        )
      },
    ),
  )
  onCleanup(stopResting)

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
            {/* data-floor: the spot on the picture's floor line he stands
                on, for the walk to hold his feet to (probe-onboarding.mjs). */}
            <div
              class="mp-alley-guide__merc"
              data-floor={props.input().feet.join(',')}
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
                paused={resting}
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
                  data-said={said() ?? 'none'}
                  data-testid="alley-guide-line"
                  style={{
                    // Its middle under his feet: the stylesheet centres it.
                    left: `${line().x}px`,
                    top: `${line().y}px`,
                    'max-width': `${line().width}px`,
                  }}
                >
                  {lineText()}
                </p>
              )}
            </Show>
          </div>
          <span
            class="mp-alley-guide__said"
            aria-live="polite"
            data-testid="alley-guide-said"
          >
            {hello() ? lineText() : ''}
          </span>
        </>
      )}
    </Show>
  )
}
