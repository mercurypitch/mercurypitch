import { describe, expect, it } from 'vitest'
import type { SingRoomContext, SingRoomEvent } from './room-machine'
import { hasUnsavedTake, initialSingRoomContext, micChipState, micIntent, runIsLive, runIsPaused, singRoomReducer, } from './room-machine'

const run = (
  ctx: SingRoomContext,
  ...events: SingRoomEvent[]
): SingRoomContext => events.reduce(singRoomReducer, ctx)

describe('the first arrival', () => {
  it('rests with the mic off until the capsule is tapped', () => {
    const ctx = run(initialSingRoomContext(), { type: 'enter' })
    expect(ctx.state).toBe('resting')
    expect(micIntent(ctx)).toBe(false)
  })

  it('goes to the priming screen, not straight to the alert', () => {
    const ctx = run(initialSingRoomContext(), { type: 'enter' }, { type: 'sing-a-note' })
    expect(ctx.state).toBe('priming')
    expect(micIntent(ctx)).toBe(false)
  })

  it('runs once the permission is granted', () => {
    const ctx = run(
      initialSingRoomContext(),
      { type: 'enter' },
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
      { type: 'enter' },
      { type: 'sing-a-note' },
      { type: 'mic-denied' },
    )
    expect(ctx.state).toBe('denied')
    expect(micIntent(ctx)).toBe(false)
  })

  it('re-asks gently at the next capsule, and only there', () => {
    const denied = run(
      initialSingRoomContext(),
      { type: 'enter' },
      { type: 'sing-a-note' },
      { type: 'mic-denied' },
    )
    // Leaving and coming back does NOT re-ask: that would be the nag.
    const returned = run(denied, { type: 'leave' }, { type: 'enter' })
    expect(returned.state).toBe('denied')
    // The capsule does.
    expect(run(returned, { type: 'explore' }, { type: 'sing-a-note' }).state).toBe(
      'priming',
    )
  })
})

describe('the automatic microphone', () => {
  const granted = initialSingRoomContext({ permission: 'granted' })

  it('is live on arrival once permission exists', () => {
    const ctx = run(granted, { type: 'enter' })
    expect(ctx.state).toBe('live')
    expect(micIntent(ctx)).toBe(true)
  })

  it('stays off on arrival when the sheet setting says so', () => {
    const ctx = run(
      initialSingRoomContext({ permission: 'granted', micOnArrival: false }),
      { type: 'enter' },
    )
    expect(ctx.state).toBe('resting')
    expect(micIntent(ctx)).toBe(false)
  })

  it('still starts from the capsule when the setting is off', () => {
    const ctx = run(
      initialSingRoomContext({ permission: 'granted', micOnArrival: false }),
      { type: 'enter' },
      { type: 'sing-a-note' },
    )
    expect(ctx.state).toBe('live')
    expect(micIntent(ctx)).toBe(true)
  })

  it('releases it the moment the tab stops being the one on screen', () => {
    const ctx = run(granted, { type: 'enter' }, { type: 'leave' })
    expect(ctx.state).toBe('paused')
    expect(micIntent(ctx)).toBe(false)
  })

  it('comes back paused from the pill, and does not sound on its own', () => {
    const ctx = run(granted, { type: 'enter' }, { type: 'leave' }, { type: 'enter' })
    expect(ctx.state).toBe('paused')
    expect(micIntent(ctx)).toBe(false)
    expect(runIsPaused(ctx)).toBe(true)
    expect(micIntent(run(ctx, { type: 'resume' }))).toBe(true)
  })

  it('does not restart itself after a deliberate stop', () => {
    const stopped = run(granted, { type: 'enter' }, { type: 'stop', hasTake: false })
    expect(stopped.state).toBe('resting')
    // Even an arrival does not re-arm it: only the capsule does.
    const returned = run(stopped, { type: 'leave' }, { type: 'enter' })
    expect(returned.state).toBe('resting')
    expect(micIntent(returned)).toBe(false)
    expect(micIntent(run(returned, { type: 'sing-a-note' }))).toBe(true)
  })

  it('turns on for Play on a melody', () => {
    const ctx = run(granted, { type: 'enter' }, { type: 'toggle-mute' })
    expect(micIntent(ctx)).toBe(false)
    const playing = run(ctx, { type: 'melody-play' })
    expect(micIntent(playing)).toBe(true)
    expect(playing.melody).toBe(true)
  })
})

describe('the state chip', () => {
  const granted = initialSingRoomContext({ permission: 'granted' })

  it('mutes and unmutes without ending the take', () => {
    const live = run(granted, { type: 'enter' })
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
    const paused = run(granted, { type: 'enter' }, { type: 'pause' })
    expect(micChipState(paused, false)).toBe('paused')
  })

  it('clears a mute on the next arrival', () => {
    const muted = run(granted, { type: 'enter' }, { type: 'toggle-mute' })
    const returned = run(muted, { type: 'leave' }, { type: 'enter' })
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
    const ended = run(granted, { type: 'enter' }, { type: 'stop', hasTake: true })
    expect(ended.state).toBe('ended')
    expect(hasUnsavedTake(ended)).toBe(true)
    expect(micIntent(ended)).toBe(false)
  })

  it('never opens under three seconds — the room just rests', () => {
    const ended = run(granted, { type: 'enter' }, { type: 'stop', hasTake: false })
    expect(ended.state).toBe('resting')
    expect(hasUnsavedTake(ended)).toBe(false)
  })

  it('closes on either answer, and the claim goes with it', () => {
    const decided = run(
      granted,
      { type: 'enter' },
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
    })
    const off = run(live, { type: 'set-mic-on-arrival', value: false })
    expect(off.state).toBe('live')
    expect(micIntent(off)).toBe(true)
    expect(run(off, { type: 'leave' }, { type: 'enter' }).state).toBe('paused')
  })
})
