import { describe, expect, it } from 'vitest'
import { matchVoiceCommand, normalizeUtterance, parseNumberAt, resolveVoiceCommand, stripFillerTokens, } from './command-grammar'
import type { VoiceCommand } from './types'

const command = (
  id: string,
  phrases: string[],
  overrides: Partial<VoiceCommand> = {},
): VoiceCommand => ({
  id,
  label: id,
  phrases,
  run: () => undefined,
  ...overrides,
})

describe('normalizeUtterance', () => {
  it('lowercases, trims and strips punctuation', () => {
    expect(normalizeUtterance('  Play.  ')).toBe('play')
    expect(normalizeUtterance('From the TOP!')).toBe('from the top')
    expect(normalizeUtterance('loop, on')).toBe('loop on')
  })

  it('keeps decimal numbers intact', () => {
    expect(normalizeUtterance('forward 1.5 seconds')).toBe(
      'forward 1.5 seconds',
    )
    expect(normalizeUtterance('speed .5')).toBe('speed .5')
  })

  it('splits hyphenated number words', () => {
    expect(normalizeUtterance('twenty-five')).toBe('twenty five')
  })

  it('strips diacritics', () => {
    expect(normalizeUtterance('café')).toBe('cafe')
  })
})

describe('stripFillerTokens', () => {
  it('drops wake-word prefixes and please', () => {
    expect(stripFillerTokens(['hey', 'mercury', 'play'])).toEqual(['play'])
    expect(stripFillerTokens(['mercury', 'stop'])).toEqual(['stop'])
    expect(stripFillerTokens(['okay', 'play'])).toEqual(['play'])
    expect(stripFillerTokens(['play', 'please'])).toEqual(['play'])
    expect(stripFillerTokens(['hey', 'mercury', 'please', 'play'])).toEqual([
      'play',
    ])
  })

  it('leaves plain commands untouched', () => {
    expect(stripFillerTokens(['set', 'a'])).toEqual(['set', 'a'])
  })
})

describe('parseNumberAt', () => {
  it('parses digit tokens including decimals', () => {
    expect(parseNumberAt(['10'], 0)).toEqual({ value: 10, consumed: 1 })
    expect(parseNumberAt(['1.5'], 0)).toEqual({ value: 1.5, consumed: 1 })
    expect(parseNumberAt(['.5'], 0)).toEqual({ value: 0.5, consumed: 1 })
  })

  it('parses number words', () => {
    expect(parseNumberAt(['ten'], 0)).toEqual({ value: 10, consumed: 1 })
    expect(parseNumberAt(['twenty'], 0)).toEqual({ value: 20, consumed: 1 })
    expect(parseNumberAt(['twenty', 'five'], 0)).toEqual({
      value: 25,
      consumed: 2,
    })
    expect(parseNumberAt(['one', 'hundred', 'fifty'], 0)).toEqual({
      value: 150,
      consumed: 3,
    })
  })

  it('stops at non-number tokens', () => {
    expect(parseNumberAt(['seconds'], 0)).toBeNull()
    expect(parseNumberAt(['twenty', 'seconds'], 0)).toEqual({
      value: 20,
      consumed: 1,
    })
  })
})

describe('matchVoiceCommand', () => {
  const play = command('transport.play', ['play', 'start', 'go'])
  const stop = command('transport.stop', ['stop'])

  it('matches an exact utterance, however it was punctuated', () => {
    expect(matchVoiceCommand('play', [play, stop])?.command.id).toBe(
      'transport.play',
    )
    expect(matchVoiceCommand(' Play. ', [play, stop])?.command.id).toBe(
      'transport.play',
    )
  })

  it('requires the FULL utterance to be the command', () => {
    // A backing-track lyric bleeding into the mic must not fire the transport.
    expect(matchVoiceCommand('play that funky music', [play, stop])).toBeNull()
    expect(matchVoiceCommand('can you play', [play, stop])).toBeNull()
    expect(matchVoiceCommand('', [play, stop])).toBeNull()
  })

  it('accepts wake-word and politeness fillers around the command', () => {
    expect(matchVoiceCommand('hey mercury play', [play])?.command.id).toBe(
      'transport.play',
    )
    expect(matchVoiceCommand('stop please', [stop])?.command.id).toBe(
      'transport.stop',
    )
  })

  it('fills <n> slots from digits and number words', () => {
    const forward = command('seek.forward', [
      'forward <n> seconds',
      'forward <n>',
    ])
    expect(matchVoiceCommand('forward 10 seconds', [forward])?.n).toBe(10)
    expect(matchVoiceCommand('forward ten seconds', [forward])?.n).toBe(10)
    expect(matchVoiceCommand('forward twenty five seconds', [forward])?.n).toBe(
      25,
    )
    expect(matchVoiceCommand('forward 30', [forward])?.n).toBe(30)
    // Slot is mandatory: a phrase with <n> never matches without a number.
    expect(matchVoiceCommand('forward seconds', [forward])).toBeNull()
    // Trailing tokens after the phrase still reject the match.
    expect(matchVoiceCommand('forward 10 beats', [forward])).toBeNull()
  })

  it('parses slots that end the phrase', () => {
    const percent = command('speed.percent', [
      'speed <n> percent',
      '<n> percent',
    ])
    expect(matchVoiceCommand('speed one hundred percent', [percent])?.n).toBe(
      100,
    )
    expect(matchVoiceCommand('seventy five percent', [percent])?.n).toBe(75)
  })

  it('skips unavailable commands and falls through in order', () => {
    const first = command('first', ['go'], { available: () => false })
    const second = command('second', ['go'])
    expect(matchVoiceCommand('go', [first, second])?.command.id).toBe('second')
  })

  it('prefers the earlier registered command on a tie', () => {
    const first = command('first', ['go'])
    const second = command('second', ['go'])
    expect(matchVoiceCommand('go', [first, second])?.command.id).toBe('first')
  })
})

describe('resolveVoiceCommand', () => {
  it('reports a phrase that only matches gated-off commands as unavailable', () => {
    const gated = command('gated', ['play'], { available: () => false })
    const outcome = resolveVoiceCommand('play', [gated])
    expect(outcome.kind).toBe('unavailable')
    expect(outcome.kind === 'unavailable' && outcome.command.id).toBe('gated')
  })

  it('reports unknown speech as none, not unavailable', () => {
    const gated = command('gated', ['play'], { available: () => false })
    expect(resolveVoiceCommand('something else', [gated]).kind).toBe('none')
  })

  it('still prefers an available command over an earlier gated one', () => {
    const gated = command('gated', ['go'], { available: () => false })
    const live = command('live', ['go'])
    const outcome = resolveVoiceCommand('go', [gated, live])
    expect(outcome.kind).toBe('matched')
    expect(outcome.kind === 'matched' && outcome.command.id).toBe('live')
  })
})
