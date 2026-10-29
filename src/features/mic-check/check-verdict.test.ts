import { describe, expect, it } from 'vitest'
import type { VerdictFacts } from './check-verdict'
import { decideVerdict } from './check-verdict'
import type { RosterInput } from './mic-roster'

const device = (deviceId: string, name: string): RosterInput => ({
  deviceId,
  groupId: deviceId,
  name,
  kind: 'other',
  isDefault: false,
  isCommunications: false,
  isListening: false,
})

const STUDIO = device('studio', 'Studio Mic')
const HEADSET = device('headset', 'Headset')

/** A healthy check: listening on the default, which hears a voice. */
const listening = (overrides: Partial<VerdictFacts> = {}): VerdictFacts => ({
  phase: 'listening',
  openError: null,
  lost: null,
  otherTabLabel: null,
  permission: 'granted',
  trackMuted: false,
  trackEnded: false,
  contextInterrupted: false,
  digitalSilence: false,
  health: 'healthy',
  followingDefault: true,
  listening: STUDIO,
  systemDefault: STUDIO,
  singing: false,
  ...overrides,
})

describe('decideVerdict while listening', () => {
  it('hears a voice, and then a song', () => {
    expect(decideVerdict(listening()).kind).toBe('hearing')
    expect(decideVerdict(listening({ singing: true }))).toMatchObject({
      kind: 'singing',
      tone: 'good',
      title: 'Hearing you sing on Studio Mic',
    })
  })

  it('waits before anything is heard, and warns after six silent seconds', () => {
    expect(decideVerdict(listening({ health: 'unknown' })).kind).toBe('waiting')
    expect(decideVerdict(listening({ health: 'silent' })).kind).toBe('silent')
  })

  it('names a system pause before the silence it causes', () => {
    const verdict = decideVerdict(
      listening({ trackMuted: true, digitalSilence: true, health: 'silent' }),
    )
    expect(verdict).toMatchObject({ kind: 'paused', tone: 'bad' })
    expect(verdict.title).toBe('Your system paused Studio Mic')
  })

  it('ranks a vanished input above a paused one, and a revoked permission above both', () => {
    expect(
      decideVerdict(listening({ trackMuted: true, trackEnded: true })).kind,
    ).toBe('ended')
    expect(
      decideVerdict(
        listening({ permission: 'denied', trackMuted: true, trackEnded: true }),
      ).kind,
    ).toBe('denied')
  })

  it('calls exact zeros pure silence, not a quiet room', () => {
    expect(
      decideVerdict(listening({ digitalSilence: true, health: 'silent' })),
    ).toMatchObject({ kind: 'dead', action: 'restart' })
  })

  it('says when the system default moved away from the input being heard', () => {
    const verdict = decideVerdict(listening({ systemDefault: HEADSET }))
    expect(verdict).toMatchObject({
      kind: 'default-moved',
      tone: 'warn',
      action: 'listen-to-default',
      title: 'Your system switched its default to Headset',
    })
    expect(verdict.detail).toContain('still hearing Studio Mic')
  })

  it('stays quiet about the default when the check was pointed at an input', () => {
    expect(
      decideVerdict(
        listening({ systemDefault: HEADSET, followingDefault: false }),
      ).kind,
    ).toBe('hearing')
  })
})

describe('decideVerdict while not listening', () => {
  const idle = (overrides: Partial<VerdictFacts> = {}): VerdictFacts =>
    listening({ phase: 'idle', health: 'unknown', ...overrides })

  it('invites a check', () => {
    expect(decideVerdict(idle())).toMatchObject({
      kind: 'idle',
      action: 'start',
    })
  })

  it('turns each open failure into its own advice', () => {
    const failed = (kind: NonNullable<VerdictFacts['openError']>['kind']) =>
      decideVerdict(idle({ openError: { kind, message: 'raw message' } }))
    expect(failed('permission-denied').kind).toBe('denied')
    expect(failed('device-busy').kind).toBe('busy')
    expect(failed('no-device').kind).toBe('no-device')
    expect(failed('held-elsewhere')).toMatchObject({
      kind: 'other-tab',
      action: 'take-over',
    })
    expect(failed('unknown')).toMatchObject({
      kind: 'failed',
      detail: 'raw message',
    })
  })

  it('says another tab took the microphone, and what for', () => {
    const verdict = decideVerdict(
      idle({ lost: 'other-tab', otherTabLabel: 'the Karaoke room' }),
    )
    expect(verdict.kind).toBe('taken')
    expect(verdict.detail).toContain('the Karaoke room')
  })
})
