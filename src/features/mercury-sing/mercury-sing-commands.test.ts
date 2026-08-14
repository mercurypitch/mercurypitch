import { afterEach, describe, expect, it } from 'vitest'
import { resolveVoiceCommand } from '@/features/voice-control/command-grammar'
import { createMercurySingVoiceCommands } from './mercury-sing-commands'
import { closeMercurySing, mercurySingOpen, openMercurySing, setMercurySingPickHandler, } from './mercury-sing-store'

const run = (utterance: string, options?: { requireWakeWord?: boolean }) => {
  const outcome = resolveVoiceCommand(
    utterance,
    createMercurySingVoiceCommands(),
    options,
  )
  if (outcome.kind !== 'matched') return outcome.kind
  const result = outcome.command.run({ n: outcome.n, m: outcome.m })
  return typeof result === 'object' && result.failed
    ? `failed: ${result.message}`
    : `${outcome.command.id}`
}

afterEach(() => {
  closeMercurySing()
  setMercurySingPickHandler(null)
})

describe('mercury sing trigger', () => {
  it('opens from the brand phrase and every alias, never from bare "sing"', () => {
    expect(run('mercury sing')).toBe('mercurySing.start')
    expect(mercurySingOpen()).toBe(true)
    closeMercurySing()
    expect(run('hey mercury sing')).toBe('mercurySing.start')
    closeMercurySing()
    expect(run('shazam sing')).toBe('mercurySing.start')
    closeMercurySing()
    expect(run('find my song')).toBe('mercurySing.start')
    closeMercurySing()
    expect(run('sing')).toBe('none')
    expect(mercurySingOpen()).toBe(false)
  })

  it('opens even in wake-word mode — the wake word is the brand', () => {
    expect(run('mercury sing', { requireWakeWord: true })).toBe(
      'mercurySing.start',
    )
  })

  it('survives the recognizer writing the surname "Singh"', () => {
    // The field report: Chrome corrected every "sing" to "Singh", so the
    // brand phrase never reached the grammar as spoken.
    expect(run('Mercury Singh')).toBe('mercurySing.start')
    closeMercurySing()
    expect(run('Hey Mercury, Singh!')).toBe('mercurySing.start')
    closeMercurySing()
    expect(run('Shazam Singh')).toBe('mercurySing.start')
  })

  it('opens from the plain-English aliases that need no brand word', () => {
    for (const phrase of [
      'what song is this',
      'what song am i singing',
      'identify this song',
      'name that song',
      'find this song',
      'match my song',
    ]) {
      expect(run(phrase)).toBe('mercurySing.start')
      closeMercurySing()
    }
  })

  it('is gated off while the stage is already open', () => {
    openMercurySing()
    expect(run('mercury sing')).toBe('unavailable')
  })
})

describe('in-stage commands under the forced wake gate', () => {
  it('cancel closes the stage without the wake word', () => {
    openMercurySing()
    expect(run('cancel', { requireWakeWord: true })).toBe('mercurySing.cancel')
    expect(mercurySingOpen()).toBe(false)
  })

  it('stage words do nothing while the stage is closed', () => {
    expect(run('cancel')).toBe('unavailable')
    expect(run('sing number one')).toBe('unavailable')
  })

  it('picks a candidate through the store handler', () => {
    openMercurySing()
    const picked: number[] = []
    setMercurySingPickHandler((index) => {
      picked.push(index)
      return index === 0
    })
    expect(run('sing number one', { requireWakeWord: true })).toBe(
      'mercurySing.pick',
    )
    expect(run('number two', { requireWakeWord: true })).toBe(
      'failed: No candidate number 2 yet',
    )
    expect(picked).toEqual([0, 1])
  })

  it('rejects a pick with no usable number', () => {
    openMercurySing()
    setMercurySingPickHandler(() => true)
    expect(run('sing number 1.5')).toBe(
      'failed: Say a candidate number, like "sing number one"',
    )
  })
})
