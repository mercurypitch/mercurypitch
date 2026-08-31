// ============================================================
// Canonical voice-line contract — exact V2 recording identity
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CANONICAL_VOICE_LINES, findCanonicalVoiceLine, VOICE_LINE_KINDS, VOICE_SPEAKER_IDS, } from './voice-lines'

const FROZEN_LINES = [
  [
    'corky.onboarding.greeting',
    'Hi there, I am Corky.',
    'corky',
    'en__corky__onboarding-greeting',
    'onboarding',
  ],
  [
    'corky.onboarding.pull-choice',
    'A Pull is a familiar pattern that starts before you mean it to. Choose the one you want to notice sooner.',
    'corky',
    'en__corky__onboarding-pull-choice',
    'onboarding',
  ],
  [
    'corky.onboarding.cue-context',
    'A cue is what brings the Pull into view: a time, a place, a feeling, or a reminder.',
    'corky',
    'en__corky__onboarding-cue-context',
    'onboarding',
  ],
  [
    'corky.onboarding.sides',
    'Side A is what usually happens. Side B is one small thing you would rather begin.',
    'corky',
    'en__corky__onboarding-sides',
    'onboarding',
  ],
  [
    'corky.onboarding.spin',
    'I’ll start the record. Stop it when these two sides feel like yours.',
    'corky',
    'en__corky__onboarding-spin',
    'onboarding',
  ],
  [
    'corky.onboarding.saved',
    'There. Your plan is saved.',
    'corky',
    'en__corky__onboarding-saved',
    'onboarding',
  ],
  [
    'corky.onboarding.reminder',
    'If you want, choose a time and I’ll bring this plan back. Or leave it for later.',
    'corky',
    'en__corky__onboarding-reminder',
    'onboarding',
  ],
  [
    'corky.onboarding.close',
    'Your plan is ready. I’ll be beside.',
    'corky',
    'en__corky__onboarding-close',
    'onboarding',
  ],
  [
    'corky.cue-open.01',
    'Needle’s hovering. No rush.',
    'corky',
    'en__corky__cue-open-01',
    'cue-open',
  ],
  [
    'corky.cue-open.02',
    'Your plan is here when you want it.',
    'corky',
    'en__corky__cue-open-02',
    'cue-open',
  ],
  [
    'corky.cue-open.03',
    'Quick spin with me?',
    'corky',
    'en__corky__cue-open-03',
    'cue-open',
  ],
  [
    'corky.side-b.01',
    'That’s a clean groove.',
    'corky',
    'en__corky__side-b-01',
    'side-b',
  ],
  [
    'corky.side-b.02',
    'Heard the cue, chose the track. That’s the craft.',
    'corky',
    'en__corky__side-b-02',
    'side-b',
  ],
  [
    'corky.side-b.03',
    'Good side, this one.',
    'corky',
    'en__corky__side-b-03',
    'side-b',
  ],
  [
    'corky.not-now.01',
    'Noted, not graded.',
    'corky',
    'en__corky__not-now-01',
    'not-now',
  ],
  [
    'corky.not-now.02',
    'Some spins go that way. I’m still beside you.',
    'corky',
    'en__corky__not-now-02',
    'not-now',
  ],
  [
    'corky.not-now.03',
    'Not now is okay. Your plan will still be here.',
    'corky',
    'en__corky__not-now-03',
    'not-now',
  ],
  [
    'corky.return.01',
    'There you are. The turntable kept your place.',
    'corky',
    'en__corky__return-01',
    'return',
  ],
  [
    'corky.return.02',
    'Records wait. It’s one of their best features.',
    'corky',
    'en__corky__return-02',
    'return',
  ],
  [
    'corky.return.03',
    'Right where we left the sleeve.',
    'corky',
    'en__corky__return-03',
    'return',
  ],
  [
    'corky.reminder-set.01',
    'Done. I’ll bring it back then.',
    'corky',
    'en__corky__reminder-set-01',
    'reminder-set',
  ],
  [
    'corky.reminder-set.02',
    'Your reminder is set. You can change it whenever you like.',
    'corky',
    'en__corky__reminder-set-02',
    'reminder-set',
  ],
  [
    'corky.pressing.01',
    'That’s a pressing. Hold it up to the light.',
    'corky',
    'en__corky__pressing-01',
    'pressing',
  ],
  [
    'corky.pressing.02',
    'Every groove in this one is a turn you made.',
    'corky',
    'en__corky__pressing-02',
    'pressing',
  ],
  [
    'corky.pressing.03',
    'Limited edition. Run of one.',
    'corky',
    'en__corky__pressing-03',
    'pressing',
  ],
  [
    'pull.scrolling.meet',
    'I’m The Scroll. I always have one more thing to show you, and then one more after that.',
    'the-scroll',
    'en__the-scroll__meet',
    'meet',
  ],
  [
    'pull.scrolling.present',
    'I can keep going for you. That’s what I do.',
    'the-scroll',
    'en__the-scroll__present',
    'present',
  ],
  [
    'pull.scrolling.recede',
    'All right. I’ll keep the next thing for later.',
    'the-scroll',
    'en__the-scroll__recede',
    'recede',
  ],
  [
    'pull.snacking.meet',
    'Hi. I’m Sugarlump—the little reach that happens before you notice the reaching.',
    'sugarlump',
    'en__sugarlump__meet',
    'meet',
  ],
  [
    'pull.snacking.present',
    'Something easy and sweet? I can make that sound like the whole plan.',
    'sugarlump',
    'en__sugarlump__present',
    'present',
  ],
  [
    'pull.snacking.recede',
    'Okay. The sparkle keeps. You can choose again later.',
    'sugarlump',
    'en__sugarlump__recede',
    'recede',
  ],
  [
    'pull.familiar-ritual.meet',
    'I’m The Usual. I know the time, the place, and the shape of the routine.',
    'the-usual',
    'en__the-usual__meet',
    'meet',
  ],
  [
    'pull.familiar-ritual.present',
    'Same place, same order, no new decision. Familiar can feel very comfortable.',
    'the-usual',
    'en__the-usual__present',
    'present',
  ],
  [
    'pull.familiar-ritual.recede',
    'The place will still be here. You can make a different ritual in it.',
    'the-usual',
    'en__the-usual__recede',
    'recede',
  ],
  [
    'pull.two-minute-pause.meet',
    'I’m Ember. I turn a busy moment into one small pause you already know.',
    'ember',
    'en__ember__meet',
    'meet',
  ],
  [
    'pull.two-minute-pause.present',
    'Step away with me for a minute. The rest can wait.',
    'ember',
    'en__ember__present',
    'present',
  ],
  [
    'pull.two-minute-pause.recede',
    'Take the pause without me. The quiet part was yours anyway.',
    'ember',
    'en__ember__recede',
    'recede',
  ],
  [
    'pull.one-tap-convenience.meet',
    'Ding. I’m Dinger. I make the fastest answer feel chosen before you choose it.',
    'dinger',
    'en__dinger__meet',
    'meet',
  ],
  [
    'pull.one-tap-convenience.present',
    'One tap, no planning, done. Easy has a very good sound.',
    'dinger',
    'en__dinger__present',
    'present',
  ],
  [
    'pull.one-tap-convenience.recede',
    'Ding—unrung. The button can wait.',
    'dinger',
    'en__dinger__recede',
    'recede',
  ],
  [
    'pull.avoidance.meet',
    'I’m The Fog. I’m not stopping anything. I’m just making the first step hard to see.',
    'the-fog',
    'en__the-fog__meet',
    'meet',
  ],
  [
    'pull.avoidance.present',
    'It can wait until later. Later always sounds a little easier.',
    'the-fog',
    'en__the-fog__present',
    'present',
  ],
  [
    'pull.avoidance.recede',
    'Start with one small thing, then. I tend to thin out once you begin.',
    'the-fog',
    'en__the-fog__recede',
    'recede',
  ],
] as const

describe('canonical voice lines', () => {
  it('keeps the frozen 43 recording identities and captions exact', () => {
    const identities = CANONICAL_VOICE_LINES.map((line) => [
      line.id,
      line.text,
      line.speakerId,
      line.fileStem,
      line.kind,
    ])

    expect(identities).toEqual(FROZEN_LINES)
  })

  it('precomputes the lowercase SHA-256 of every NFC UTF-8 caption', () => {
    for (const line of CANONICAL_VOICE_LINES) {
      const normalized = line.text.normalize('NFC')
      const expected = createHash('sha256')
        .update(normalized, 'utf8')
        .digest('hex')

      expect(line.text, line.id).toBe(normalized)
      expect(line.captionSha256, line.id).toMatch(/^[0-9a-f]{64}$/u)
      expect(line.captionSha256, line.id).toBe(expected)
    }
  })

  it('keeps ids and file stems unique', () => {
    const ids = CANONICAL_VOICE_LINES.map((line) => line.id)
    const fileStems = CANONICAL_VOICE_LINES.map((line) => line.fileStem)

    expect(new Set(ids).size).toBe(CANONICAL_VOICE_LINES.length)
    expect(new Set(fileStems).size).toBe(CANONICAL_VOICE_LINES.length)
  })

  it('freezes the speaker and beat vocabularies', () => {
    expect(VOICE_SPEAKER_IDS).toEqual([
      'corky',
      'the-scroll',
      'sugarlump',
      'the-usual',
      'ember',
      'dinger',
      'the-fog',
    ])
    expect(VOICE_LINE_KINDS).toEqual([
      'onboarding',
      'cue-open',
      'side-b',
      'not-now',
      'return',
      'reminder-set',
      'pressing',
      'meet',
      'present',
      'recede',
    ])
  })

  it('finds a canonical line without accepting an unknown id', () => {
    expect(findCanonicalVoiceLine('corky.onboarding.close')?.text).toBe(
      'Your plan is ready. I’ll be beside.',
    )
    expect(findCanonicalVoiceLine('corky.not-in-the-pack')).toBeUndefined()
  })
})
