import { describe, expect, it } from 'vitest'
import { EXERCISE_HELP } from './exercise-help'
import { EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_SIREN, EXERCISE_STACCATO, } from './types'

describe('exercise help', () => {
  it('says what the Long note lantern counts: a vibrato costs steadiness, and the Accuracy Tier sets the top', () => {
    // A vibrato counts against steadiness (owner, 11 Oct 2026): a natural
    // +-40 cent one scores about 44. And the level, the Accuracy Tier from
    // Settings (owner, 12 Oct 2026), sets how steady the top asks a voice
    // to be: at Learning a natural vibrato fills it, so the help never says
    // only steady singing does.
    const body = EXERCISE_HELP[EXERCISE_LONG_NOTE_LANTERN].body.join(' ')
    expect(body).not.toMatch(/vibrato does not count/i)
    expect(body).toMatch(/vibrato counts/i)
    expect(body).not.toMatch(/only steady/i)
    expect(body).toMatch(/Accuracy Tier/)
    expect(body).not.toMatch(/\b(Beginner|Pro)\b/)
    expect(body).not.toMatch(/—|calm|practise/i)
  })

  it("says Drone Intonation's targets are equal-tempered, and promises no pure or just tuning", () => {
    // Every target is midiToFreq of the note, twelve equal steps to the
    // octave (Lesson 10 FACTS 49), so the help promises no other tuning.
    // Arrange
    const help = EXERCISE_HELP[EXERCISE_DRONE_INTONATION]

    // Act
    const words = [help.summary, ...help.body].join(' ')

    // Assert
    expect(help.summary).toMatch(/equal-tempered/)
    expect(words).not.toMatch(/just intonation|pure intonation|stop beating/i)
  })

  it('says Staccato scores pitch, and promises no timing', () => {
    // Staccato grades each note on its cents from the target and on the
    // share of its first frames within 25 cents, with the best round.
    // Nothing measures when a note starts or how long it lasts.
    // Arrange
    const help = EXERCISE_HELP[EXERCISE_STACCATO]

    // Act
    const words = [help.summary, ...help.body].join(' ')

    // Assert
    expect(words).toMatch(/scores how in tune each note is/)
    expect(words).not.toMatch(/timing|rhythm|on the beat|in time/i)
  })

  it('says Chord Stacker plays its chord a note at a time, and each note is sung back alone', () => {
    // The demo's tones never sound together, and nothing sounds while each
    // note is sung back in its own window, so no note is tuned against
    // others still sounding.
    // Arrange
    const help = EXERCISE_HELP[EXERCISE_CHORD_STACKER]

    // Act
    const words = [help.summary, ...help.body].join(' ')

    // Assert
    expect(words).toMatch(/one note at a time/)
    expect(words).toMatch(/on its own/)
    expect(words).not.toMatch(/already sounding|lock in/i)
  })

  it('lets a flip come in the Siren, asks for no full range, and says what most of its score is', () => {
    // Every voice has gears, and a slide can flip between them (Lesson 11
    // FACTS 42), so the help never asks for a glide without breaks; the
    // glides stay in an easy part of the saved range; and 70 % of a round's
    // score is how close the voice ends to the second note (FACTS 41).
    // Arrange
    const help = EXERCISE_HELP[EXERCISE_SIREN]

    // Act
    const words = [help.summary, ...help.body].join(' ')

    // Assert
    expect(help.summary).toMatch(/within an easy part of your range/)
    expect(words).toMatch(
      /If your voice flips .*, let it: every voice changes gear\./,
    )
    expect(words).toMatch(
      /Most of your score is how close you come to the second note\./,
    )
    expect(words).not.toMatch(/without breaks|full range|through your range/i)
    expect(words).not.toMatch(/smooth and connected the glide is/)
  })
})
