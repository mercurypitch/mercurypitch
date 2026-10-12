import { describe, expect, it } from 'vitest'
import { EXERCISE_HELP } from './exercise-help'
import { EXERCISE_LONG_NOTE_LANTERN } from './types'

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
})
