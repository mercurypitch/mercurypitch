// ============================================================
// Mercury Sing voice commands — the trigger and the stage's own words
// ============================================================
//
// The trigger phrases open the listening stage; the in-stage set (cancel,
// pick) carries `ignoresWakeWord` because the stage forces wake-word mode
// on while it captures singing — the user must be able to say a bare
// "cancel" without addressing Mercury first. "mercury sing" itself works
// through the grammar's brand-phrase retry, and recognizers writing the
// surname "Singh" for "sing" are repaired in the grammar's normalization.
// Deliberately NO bare "sing" phrase: it is a lyric word.
//
// The plain-English aliases are not decoration. A brand phrase is the one
// thing a recognizer has no language-model support for, so it is the
// hardest thing to say reliably — "what song is this" always lands.

import type { VoiceCommand } from '@/features/voice-control/types'
import { voiceFailure } from '@/features/voice-control/types'
import { closeMercurySing, mercurySingOpen, openMercurySing, requestMercurySingPick, } from './mercury-sing-store'

export function createMercurySingVoiceCommands(): VoiceCommand[] {
  return [
    {
      id: 'mercurySing.start',
      label: 'Mercury Sing',
      phrases: [
        'mercury sing',
        'shazam sing',
        'find my song',
        'find this song',
        'name this song',
        'name that song',
        'what song is this',
        'what song am i singing',
        'what am i singing',
        'identify this song',
        'match my song',
      ],
      available: () => !mercurySingOpen(),
      run: () => {
        openMercurySing()
        return 'Listening for your song'
      },
    },
    {
      id: 'mercurySing.cancel',
      label: 'Stop listening',
      phrases: ['cancel', 'stop listening', 'never mind'],
      ignoresWakeWord: true,
      available: () => mercurySingOpen(),
      run: () => {
        closeMercurySing()
        return 'Stopped listening'
      },
    },
    {
      id: 'mercurySing.pick',
      label: 'Sing number <n>',
      phrases: ['sing number <n>', 'number <n>', 'open number <n>'],
      ignoresWakeWord: true,
      available: () => mercurySingOpen(),
      run: (args) => {
        const n = args.n
        if (n === undefined || !Number.isInteger(n) || n < 1) {
          return voiceFailure('Say a candidate number, like "sing number one"')
        }
        return requestMercurySingPick(n - 1)
          ? `Opening number ${String(n)}`
          : voiceFailure(`No candidate number ${String(n)} yet`)
      },
    },
  ]
}
