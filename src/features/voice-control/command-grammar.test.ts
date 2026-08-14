import { describe, expect, it } from 'vitest'
import { matchVoiceCommand, normalizeUtterance, parseNumberAt, phraseExtendsFurther, resolveVoiceCommand, stripFillerTokens, } from './command-grammar'
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

  it('repairs proper nouns recognizers substitute for brand words', () => {
    // Chrome writes the surname for "sing", which made the brand phrase
    // almost impossible to trigger.
    expect(normalizeUtterance('Mercury Singh')).toBe('mercury sing')
    expect(normalizeUtterance('Shazam Singh!')).toBe('shazam sing')
    expect(normalizeUtterance('Shazaam sing')).toBe('shazam sing')
    expect(normalizeUtterance('singh number one')).toBe('sing number one')
  })

  it('leaves ordinary words alone', () => {
    expect(normalizeUtterance('single')).toBe('single')
    expect(normalizeUtterance('singing')).toBe('singing')
    expect(normalizeUtterance('')).toBe('')
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

  it('parses spoken decimals and splits digit-letter tokens', () => {
    expect(parseNumberAt(['one', 'point', 'five'], 0)).toEqual({
      value: 1.5,
      consumed: 3,
    })
    expect(normalizeUtterance('1.5x')).toBe('1.5 x')
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

  it('flags phrases that are strict prefixes of longer ones', () => {
    const play = command('play', ['go'])
    const nav = command('nav', ['go to karaoke'])
    const loop = command('loop', ['loop', 'loop off'])
    expect(phraseExtendsFurther('go', [play, nav])).toBe(true)
    expect(phraseExtendsFurther('go to karaoke', [play, nav])).toBe(false)
    expect(phraseExtendsFurther('loop', [loop])).toBe(true)
    expect(
      phraseExtendsFurther('back <n>', [command('s', ['back <n> seconds'])]),
    ).toBe(true)
    expect(phraseExtendsFurther('stop', [play, nav, loop])).toBe(false)
  })

  it('salvages self-corrections by dropping up to two leading tokens', () => {
    const role = command('role', ['i play guitar'])
    const forward = command('seek', [
      'forward <n> seconds',
      'forwards <n> seconds',
    ])
    expect(matchVoiceCommand('guitar i play guitar', [role])?.command.id).toBe(
      'role',
    )
    expect(
      matchVoiceCommand('backwards forwards 60 seconds', [forward])?.n,
    ).toBe(60)
    // Single-word commands stay exact-only, so lyric tails never fire.
    expect(
      matchVoiceCommand('baby stop', [command('stop', ['stop'])]),
    ).toBeNull()
    expect(
      matchVoiceCommand('you make me wanna play', [command('p', ['play'])]),
    ).toBeNull()
  })

  it('fills two numeric slots for range phrases', () => {
    const range = command('loop', ['loop from <n> to <n> seconds'])
    const match = matchVoiceCommand('loop from 20 to 60 seconds', [range])
    expect(match?.n).toBe(20)
    expect(match?.m).toBe(60)
  })

  it('reports the matched phrase on the outcome', () => {
    const forward = command('seek', ['forward <n> seconds'])
    const outcome = resolveVoiceCommand('forward ten seconds', [forward])
    expect(outcome.kind === 'matched' && outcome.phrase).toBe(
      'forward <n> seconds',
    )
  })

  it('ignores wakeless speech when the wake word is required', () => {
    const play = command('transport.play', ['play'])
    const options = { requireWakeWord: true }
    expect(resolveVoiceCommand('play', [play], options).kind).toBe('ignored')
    expect(resolveVoiceCommand('some lyric line', [play], options).kind).toBe(
      'ignored',
    )
    const withWake = resolveVoiceCommand('mercury play', [play], options)
    expect(withWake.kind).toBe('matched')
    expect(resolveVoiceCommand('hey mercury play', [play], options).kind).toBe(
      'matched',
    )
  })
})

describe('brand phrases starting with the wake word', () => {
  const sing = command('mercurySing.start', ['mercury sing', 'find my song'])

  it('matches after the stripper ate the wake word, via the retry', () => {
    expect(matchVoiceCommand('mercury sing', [sing])?.command.id).toBe(
      'mercurySing.start',
    )
    expect(matchVoiceCommand('hey mercury sing', [sing])?.command.id).toBe(
      'mercurySing.start',
    )
    expect(matchVoiceCommand('mercury sing please', [sing])?.command.id).toBe(
      'mercurySing.start',
    )
  })

  it('a doubled wake word still reaches the brand phrase', () => {
    // The stripper removes exactly ONE leading mercury, so the primary pass
    // sees "mercury sing" directly.
    expect(matchVoiceCommand('mercury mercury sing', [sing])?.command.id).toBe(
      'mercurySing.start',
    )
  })

  it('the bare tail of a brand phrase does not match', () => {
    // "sing" is a lyric word; only the full brand phrase triggers.
    expect(matchVoiceCommand('sing', [sing])).toBeNull()
  })

  it('trailing tokens after the brand phrase still reject the match', () => {
    expect(matchVoiceCommand('mercury sing something', [sing])).toBeNull()
  })

  it('prefers the wake-stripped reading when both parse', () => {
    const play = command('play', ['play'])
    const brand = command('brand', ['mercury play'])
    expect(matchVoiceCommand('mercury play', [play, brand])?.command.id).toBe(
      'play',
    )
  })

  it('passes the wake gate — the wake word is right there', () => {
    const options = { requireWakeWord: true }
    expect(resolveVoiceCommand('mercury sing', [sing], options).kind).toBe(
      'matched',
    )
    expect(resolveVoiceCommand('find my song', [sing], options).kind).toBe(
      'ignored',
    )
    expect(
      resolveVoiceCommand('mercury find my song', [sing], options).kind,
    ).toBe('matched')
  })
})

describe('ignoresWakeWord exemption', () => {
  const play = command('transport.play', ['play'])
  const cancel = command('stage.cancel', ['cancel', 'stop listening'], {
    ignoresWakeWord: true,
  })
  const options = { requireWakeWord: true }

  it('exempt commands match without the wake word; others stay ignored', () => {
    const outcome = resolveVoiceCommand('cancel', [play, cancel], options)
    expect(outcome.kind).toBe('matched')
    expect(outcome.kind === 'matched' && outcome.command.id).toBe(
      'stage.cancel',
    )
    expect(resolveVoiceCommand('play', [play, cancel], options).kind).toBe(
      'ignored',
    )
  })

  it('salvage still reaches exempt commands under the gate', () => {
    const outcome = resolveVoiceCommand(
      'uh stop listening',
      [play, cancel],
      options,
    )
    expect(outcome.kind).toBe('matched')
    expect(outcome.kind === 'matched' && outcome.command.id).toBe(
      'stage.cancel',
    )
  })

  it('unmatched wakeless speech stays ignored, never unrecognized', () => {
    expect(
      resolveVoiceCommand('la la la la', [play, cancel], options).kind,
    ).toBe('ignored')
  })

  it('the flag changes nothing when the wake word is not required', () => {
    expect(matchVoiceCommand('cancel', [play, cancel])?.command.id).toBe(
      'stage.cancel',
    )
    expect(matchVoiceCommand('play', [play, cancel])?.command.id).toBe(
      'transport.play',
    )
  })
})
