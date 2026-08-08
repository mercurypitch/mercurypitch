// ============================================================
// Mercury Sing voice commands — the trigger and the stage's own words
// ============================================================
//
// The trigger phrases open the listening stage; the in-stage set (cancel,
// pick) carries `ignoresWakeWord` because the stage forces wake-word mode
// on while it captures singing — the user must be able to say a bare
// "cancel" without addressing Mercury first. "mercury sing" itself works
// through the grammar's brand-phrase retry. Deliberately NO bare "sing"
// phrase: it is a lyric word.

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
        'name this song',
        'what am i singing',
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
