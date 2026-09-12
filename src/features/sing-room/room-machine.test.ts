import { describe, expect, it } from 'vitest'
import type { SingRoomContext, SingRoomEvent } from './room-machine'
import { hasUnsavedTake, initialSingRoomContext, micChipAction, micChipState, micIntent, runIsLive, runIsPaused, singRoomReducer, startsNewTake, } from './room-machine'

const run = (
  ctx: SingRoomContext,
  ...events: SingRoomEvent[]
): SingRoomContext => events.reduce(singRoomReducer, ctx)

describe('the first arrival', () => {
  it('rests with the mic off until the capsule is tapped', () => {
    const ctx = run(initialSingRoomContext(), {
      type: 'enter',
      hasSummary: false,
    })
    expect(ctx.state).toBe('resting')
    expect(micIntent(ctx)).toBe(false)
  })

  it('goes to the priming screen, not straight to the alert', () => {
    const ctx = run(
      initialSingRoomContext(),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
    )
    expect(ctx.state).toBe('priming')
    expect(micIntent(ctx)).toBe(false)
  })

  it('runs once the permission is granted', () => {
    const ctx = run(
      initialSingRoomContext(),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
      { type: 'priming-continue' },
      { type: 'mic-granted' },
    )
    expect(ctx.state).toBe('live')
    expect(micIntent(ctx)).toBe(true)
    expect(runIsLive(ctx)).toBe(true)
  })

  it('shows the demo line when it is refused', () => {
    const ctx = run(
      initialSingRoomContext(),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
      { type: 'mic-denied' },
    )
    expect(ctx.state).toBe('denied')
    expect(micIntent(ctx)).toBe(false)
  })

  it('re-asks gently at the next capsule, and only there', () => {
    const denied = run(
      initialSingRoomContext(),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
      { type: 'mic-denied' },
    )
    // Leaving and coming back does NOT re-ask: that would be the nag.
    const returned = run(
      denied,
      { type: 'leave' },
      { type: 'enter', hasSummary: false },
    )
    expect(returned.state).toBe('denied')
    // The capsule does.
    expect(
      run(returned, { type: 'explore' }, { type: 'sing-a-note' }).state,
    ).toBe('priming')
  })
})

describe('a device that is busy rather than refused', () => {
  it('rests, and does not send anybody to Settings over it', () => {
    const ctx = run(
      initialSingRoomContext(),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
      { type: 'mic-unavailable' },
    )
    expect(ctx.state).toBe('resting')
    expect(ctx.permission).toBe('unknown')
    expect(micIntent(ctx)).toBe(false)
  })
})

describe('the automatic microphone', () => {
  const granted = initialSingRoomContext({ permission: 'granted' })

  it('is live on arrival once permission exists', () => {
    const ctx = run(granted, { type: 'enter', hasSummary: false })
    expect(ctx.state).toBe('live')
    expect(micIntent(ctx)).toBe(true)
  })

  it('stays off on arrival when the sheet setting says so', () => {
    const ctx = run(
      initialSingRoomContext({ permission: 'granted', micOnArrival: false }),
      { type: 'enter', hasSummary: false },
    )
    expect(ctx.state).toBe('resting')
    expect(micIntent(ctx)).toBe(false)
  })

  it('still starts from the capsule when the setting is off', () => {
    const ctx = run(
      initialSingRoomContext({ permission: 'granted', micOnArrival: false }),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
    )
    expect(ctx.state).toBe('live')
    expect(micIntent(ctx)).toBe(true)
  })

  it('releases it the moment the tab stops being the one on screen', () => {
    const ctx = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'leave' },
    )
    expect(ctx.state).toBe('paused')
    expect(micIntent(ctx)).toBe(false)
  })

  it('comes back paused from the pill, and does not sound on its own', () => {
    const ctx = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'leave' },
      { type: 'enter', hasSummary: false },
    )
    expect(ctx.state).toBe('paused')
    expect(micIntent(ctx)).toBe(false)
    expect(runIsPaused(ctx)).toBe(true)
    expect(micIntent(run(ctx, { type: 'resume' }))).toBe(true)
  })

  it('does not restart itself after a deliberate stop', () => {
    const stopped = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'stop', hasTake: false },
    )
    expect(stopped.state).toBe('resting')
    // Even an arrival does not re-arm it: only the capsule does.
    const returned = run(
      stopped,
      { type: 'leave' },
      { type: 'enter', hasSummary: false },
    )
    expect(returned.state).toBe('resting')
    expect(micIntent(returned)).toBe(false)
    expect(micIntent(run(returned, { type: 'sing-a-note' }))).toBe(true)
  })

  it('turns on for Play on a melody', () => {
    const ctx = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'toggle-mute' },
    )
    expect(micIntent(ctx)).toBe(false)
    const playing = run(ctx, { type: 'melody-play' })
    expect(micIntent(playing)).toBe(true)
    expect(playing.melody).toBe(true)
  })
})

describe('the state chip', () => {
  const granted = initialSingRoomContext({ permission: 'granted' })

  it('mutes and unmutes without ending the take', () => {
    const live = run(granted, { type: 'enter', hasSummary: false })
    const muted = run(live, { type: 'toggle-mute' })
    expect(muted.state).toBe('live')
    expect(runIsLive(muted)).toBe(true)
    expect(micIntent(muted)).toBe(false)
    expect(micChipState(muted, false)).toBe('muted')
    const back = run(muted, { type: 'toggle-mute' })
    expect(micIntent(back)).toBe(true)
    expect(micChipState(back, true)).toBe('listening')
  })

  it('says Paused while the run is paused, mute or not', () => {
    const paused = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'pause' },
    )
    expect(micChipState(paused, false)).toBe('paused')
  })

  it('clears a mute on the next arrival', () => {
    const muted = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'toggle-mute' },
    )
    const returned = run(
      muted,
      { type: 'leave' },
      { type: 'enter', hasSummary: false },
    )
    expect(returned.muted).toBe(false)
  })

  it('does nothing at all while the room is resting', () => {
    const resting = initialSingRoomContext({ active: true })
    expect(run(resting, { type: 'toggle-mute' })).toEqual(resting)
  })
})

describe('the end card', () => {
  const granted = initialSingRoomContext({ permission: 'granted' })

  it('opens on a stop with a take in it, and claims the take', () => {
    const ended = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'stop', hasTake: true },
    )
    expect(ended.state).toBe('ended')
    expect(hasUnsavedTake(ended)).toBe(true)
    expect(micIntent(ended)).toBe(false)
  })

  it('never opens under three seconds — the room just rests', () => {
    const ended = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'stop', hasTake: false },
    )
    expect(ended.state).toBe('resting')
    expect(hasUnsavedTake(ended)).toBe(false)
  })

  it('closes on either answer, and the claim goes with it', () => {
    const decided = run(
      granted,
      { type: 'enter', hasSummary: false },
      { type: 'stop', hasTake: true },
      { type: 'take-decided' },
    )
    expect(decided.state).toBe('resting')
    expect(hasUnsavedTake(decided)).toBe(false)
  })
})

describe('the sheet setting', () => {
  it('takes effect from the next arrival, not mid-run', () => {
    const live = run(initialSingRoomContext({ permission: 'granted' }), {
      type: 'enter',
      hasSummary: false,
    })
    const off = run(live, { type: 'set-mic-on-arrival', value: false })
    expect(off.state).toBe('live')
    expect(micIntent(off)).toBe(true)
    expect(
      run(off, { type: 'leave' }, { type: 'enter', hasSummary: false }).state,
    ).toBe('paused')
  })
})

describe('what begins a take', () => {
  it('does, when the room goes live from rest or from the priming door', () => {
    expect(startsNewTake('resting', 'live')).toBe(true)
    expect(startsNewTake('priming', 'live')).toBe(true)
    expect(startsNewTake('denied', 'live')).toBe(true)
    expect(startsNewTake('ended', 'live')).toBe(true)
  })

  it('does NOT, on a resume: that take is the one being continued', () => {
    expect(startsNewTake('paused', 'live')).toBe(false)
  })

  it('does NOT, when the state did not move at all', () => {
    // A mute dispatches, which hands back a new context object and wakes
    // every effect reading it. Counting that as a take made the second take
    // of a session report itself as the fourth.
    expect(startsNewTake('live', 'live')).toBe(false)
  })

  it('does NOT, on the first read of a freshly mounted room', () => {
    expect(startsNewTake(undefined, 'live')).toBe(false)
  })

  it('does NOT, for any state that is not a live run', () => {
    for (const next of [
      'resting',
      'paused',
      'ended',
      'denied',
      'priming',
    ] as const) {
      expect(startsNewTake('resting', next)).toBe(false)
    }
  })
})

describe('the end card, and the ways out of it', () => {
  const ended = (): SingRoomContext =>
    run(
      initialSingRoomContext({ permission: 'granted' }),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
      { type: 'stop', hasTake: true },
    )

  it('comes back to its card when the room is mounted again', () => {
    const back = run(
      ended(),
      { type: 'leave' },
      { type: 'enter', hasSummary: true },
    )
    expect(back.state).toBe('ended')
    expect(hasUnsavedTake(back)).toBe(true)
  })

  it('rests rather than showing a card it has no summary for', () => {
    // The failure this exists for: `ended` with nothing to draw is a frozen
    // canvas with no capsule, no card and no control that does anything.
    const back = run(
      ended(),
      { type: 'leave' },
      { type: 'enter', hasSummary: false },
    )
    expect(back.state).toBe('resting')
    expect(hasUnsavedTake(back)).toBe(false)
  })
})

describe('a microphone that opened over a suspended context', () => {
  const suspended = run(
    initialSingRoomContext({ permission: 'granted' }),
    { type: 'enter', hasSummary: false },
    { type: 'sing-a-note' },
    { type: 'mic-suspended' },
  )

  it('rests, so the chip cannot say Listening over a dead line', () => {
    expect(suspended.state).toBe('resting')
    expect(micIntent(suspended)).toBe(false)
    expect(micChipState(suspended, false)).toBe('off')
  })

  it('keeps the grant, and disarms so it does not retry by itself', () => {
    expect(suspended.permission).toBe('granted')
    expect(suspended.armed).toBe(false)
    expect(
      run(suspended, { type: 'leave' }, { type: 'enter', hasSummary: false })
        .state,
    ).toBe('resting')
  })

  it('starts on the next tap, which is a gesture', () => {
    const tapped = run(suspended, { type: 'sing-a-note' })
    expect(tapped.state).toBe('live')
    expect(micIntent(tapped)).toBe(true)
  })
})

describe('a melody, once one is chosen', () => {
  it('is not loaded on arrival: the room opens as a free tracker', () => {
    const ctx = run(initialSingRoomContext(), {
      type: 'enter',
      hasSummary: false,
    })
    expect(ctx.melodyLoaded).toBe(false)
    expect(ctx.melody).toBe(false)
  })

  it('stays loaded after the run that used it stops', () => {
    const ctx = run(
      initialSingRoomContext({ permission: 'granted' }),
      { type: 'enter', hasSummary: false },
      { type: 'melody-play' },
      { type: 'stop', hasTake: false },
    )
    expect(ctx.melodyLoaded).toBe(true)
    expect(ctx.melody).toBe(false)
  })
})

describe('what a tap on the state chip does', () => {
  const at = (state: SingRoomContext['state'], muted = false) =>
    micChipAction(initialSingRoomContext({ state, muted, active: true }))

  it('mutes and unmutes a live run', () => {
    expect(at('live')).toBe('mute')
    expect(at('live', true)).toBe('listen')
  })

  it('is the capsule while the room rests', () => {
    expect(at('resting')).toBe('start')
  })

  it('does nothing at all where there is nothing to do', () => {
    expect(at('paused')).toBeNull()
    expect(at('ended')).toBeNull()
    expect(at('denied')).toBeNull()
    expect(at('priming')).toBeNull()
  })
})

describe('dismissing the priming door', () => {
  const primed = run(
    initialSingRoomContext(),
    {
      type: 'enter',
      hasSummary: false,
    },
    { type: 'sing-a-note' },
  )

  it('returns to rest, with nothing asked and nothing remembered', () => {
    expect(primed.state).toBe('priming')
    const cancelled = run(primed, { type: 'priming-cancel' })
    expect(cancelled.state).toBe('resting')
    // Nothing was asked, so nothing was answered: the room must ask again at
    // the next capsule rather than assume either way.
    expect(cancelled.permission).toBe('unknown')
    expect(micIntent(cancelled)).toBe(false)
  })

  it('asks again at the next tap', () => {
    const again = run(
      primed,
      { type: 'priming-cancel' },
      { type: 'sing-a-note' },
    )
    expect(again.state).toBe('priming')
  })

  it('does nothing anywhere else', () => {
    const live = run(
      initialSingRoomContext({ permission: 'granted' }),
      { type: 'enter', hasSummary: false },
      { type: 'sing-a-note' },
    )
    expect(run(live, { type: 'priming-cancel' })).toBe(live)
  })
})
