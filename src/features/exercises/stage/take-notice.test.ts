// ============================================================
// take-notice: what Merc's notice says, state by state
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ExerciseVoiceCaptureState } from '@/lib/domain/exercise-voice-capture'
import type { TakeNoticeInput } from './take-notice'
import { takeNotice } from './take-notice'

const at = (input: Partial<TakeNoticeInput>) =>
  takeNotice({
    keep: 'idle',
    capture: 'ready',
    storageFull: false,
    keptSeen: false,
    ...input,
  })

describe('the take notice', () => {
  it('asks to keep a take that is ready, with Keep and a discarding close', () => {
    expect(at({})).toEqual({
      kind: 'ready',
      tone: 'ask',
      title: 'Keep this take?',
      line: 'Not saved unless you keep it.',
      primary: 'Keep',
      primaryBusy: false,
      close: 'Discard take',
    })
  })

  it('says it is keeping, with a capsule that does nothing and no close', () => {
    expect(at({ keep: 'saving' })).toEqual({
      kind: 'keeping',
      tone: 'ask',
      title: 'Keeping your take',
      line: 'Saving on this device…',
      primary: 'Keeping',
      primaryBusy: true,
      close: null,
    })
  })

  it('says where a kept take is, with a check and only a dismiss', () => {
    expect(at({ keep: 'saved' })).toEqual({
      kind: 'kept',
      tone: 'success',
      title: 'Take kept',
      line: 'Find it in Hear Yourself, on this device.',
      primary: null,
      primaryBusy: false,
      close: 'Dismiss',
    })
  })

  it('does not offer "Take kept" again once it has gone', () => {
    expect(at({ keep: 'saved', keptSeen: true })).toBeNull()
  })

  it('asks for storage when a keep failed for want of it', () => {
    expect(at({ keep: 'error', storageFull: true })).toEqual({
      kind: 'full',
      tone: 'warning',
      title: 'Not enough storage',
      line: 'Free some browser storage, then retry.',
      primary: 'Retry',
      primaryBusy: false,
      close: 'Discard take',
    })
  })

  it('offers a retry when a keep failed for any other reason', () => {
    expect(at({ keep: 'error' })).toEqual({
      kind: 'failed',
      tone: 'error',
      title: 'Could not keep it',
      line: 'The temporary copy stays until you retry or leave.',
      primary: 'Retry',
      primaryBusy: false,
      close: 'Discard take',
    })
  })

  it.each<ExerciseVoiceCaptureState>([
    'processing',
    'idle',
    'recording',
    'unsupported',
    'error',
  ])('says nothing of a take that is "%s" before any keep', (capture) => {
    expect(at({ capture })).toBeNull()
  })

  it('follows the keep, not the capture, once the singer has pressed Keep', () => {
    expect(at({ keep: 'saving', capture: 'idle' })?.kind).toBe('keeping')
    expect(at({ keep: 'error', capture: 'processing' })?.kind).toBe('failed')
  })
})
