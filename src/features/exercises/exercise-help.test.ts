import { describe, expect, it } from 'vitest'
import { EXERCISE_HELP } from './exercise-help'
import { EXERCISE_DRONE_INTONATION, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_STACCATO, } from './types'

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
})
