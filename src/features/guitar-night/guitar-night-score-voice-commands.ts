// ============================================================
// Guitar Night score voice commands — hands-free Rehearse controls
// ============================================================
//
// The score room and its command overlay share this one capability-shaped
// vocabulary. Optional groups are omitted when their safe room handler is not
// supplied, so the overlay never advertises a control that cannot do anything.

import type { Accessor } from 'solid-js'
import { LOOP_CLEAR_PHRASES, LOOP_OFF_PHRASES, LOOP_ON_PHRASES, LOOP_SET_A_PHRASES, LOOP_SET_B_PHRASES, LOOP_TOGGLE_PHRASES, PAUSE_PHRASES, PLAY_PHRASES, SEEK_START_PHRASES, STOP_PHRASES, } from '@/features/voice-control/shared-phrases'
import type { VoiceCommand, VoiceCommandResult, } from '@/features/voice-control/types'
import { voiceFailure } from '@/features/voice-control/types'

export const GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES = [0, 1, 2, 4] as const

export type GuitarNightScoreCountInBeats =
  (typeof GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES)[number]

export interface GuitarNightScoreVoiceLoop {
  hasA: Accessor<boolean>
  hasB: Accessor<boolean>
  /** A live reason makes every loop mutation fail explicitly. */
  blockedReason?: Accessor<string | null>
  /** Return false only when the playhead cannot be marked. */
  markA: () => unknown
  /** Return false only when the playhead cannot be marked. */
  markB: () => unknown
  clear: () => unknown
  /** Omit both members when a room treats a complete A/B span as always on. */
  enabled?: Accessor<boolean>
  setEnabled?: (enabled: boolean) => void
}

export interface GuitarNightScoreVoiceToggle {
  enabled: Accessor<boolean>
  setEnabled: (enabled: boolean) => void
}

export interface GuitarNightScoreVoiceCountIn {
  beats: Accessor<number>
  setBeats: (beats: GuitarNightScoreCountInBeats) => void
}

export interface GuitarNightScoreVoiceListening {
  /** True for both an active listener and an in-flight permission request. */
  active: Accessor<boolean>
  /** A live reason makes start/toggle fail explicitly instead of pretending. */
  blockedReason?: Accessor<string | null>
  /** Return false only when the request could not even be started. */
  requestStart: () => unknown
  stop: () => void
}

export interface GuitarNightScoreVoiceScore {
  open: Accessor<boolean>
  /** False means there is not a truthful score to show yet. */
  show: () => unknown
}

export interface GuitarNightScoreVoiceDeps {
  playing: Accessor<boolean>
  paused: Accessor<boolean>
  /** Optional because a quiet room may still truthfully accept Stop as reset. */
  canStop?: Accessor<boolean>
  play: () => void
  pause: () => void
  stop: () => void
  goToBeginning: () => void
  loop?: GuitarNightScoreVoiceLoop
  click?: GuitarNightScoreVoiceToggle
  countIn?: GuitarNightScoreVoiceCountIn
  tabSound?: GuitarNightScoreVoiceToggle
  listening?: GuitarNightScoreVoiceListening
  score?: GuitarNightScoreVoiceScore
  /** Route-lifetime gate for hosts that keep the factory mounted off-stage. */
  available?: Accessor<boolean>
}

const COUNT_IN_SET_PHRASES = [
  'count in <n>',
  'count in <n> beats',
  'set count in <n>',
  'set count in to <n>',
  'set count in to <n> beats',
]

const COUNT_IN_OFF_PHRASES = [
  'count in off',
  'turn count in off',
  'disable count in',
  'no count in',
]

const COUNT_IN_CYCLE_PHRASES = ['count in', 'next count in', 'cycle count in']

const CLICK_ON_PHRASES = [
  'click on',
  'turn click on',
  'metronome on',
  'turn metronome on',
]

const CLICK_OFF_PHRASES = [
  'click off',
  'turn click off',
  'metronome off',
  'turn metronome off',
]

const CLICK_TOGGLE_PHRASES = ['click', 'toggle click', 'metronome']

const TAB_SOUND_ON_PHRASES = [
  'tab sound on',
  'tab sounds on',
  'turn tab sound on',
  'hear the tab',
  'unmute tab',
]

const TAB_SOUND_OFF_PHRASES = [
  'tab sound off',
  'tab sounds off',
  'turn tab sound off',
  'mute tab',
  'tab silent',
]

const TAB_SOUND_TOGGLE_PHRASES = [
  'tab sound',
  'tab sounds',
  'toggle tab sound',
  'toggle tab sounds',
]

const LISTENING_ON_PHRASES = [
  'listening on',
  'turn listening on',
  'start listening',
  'listen to me',
]

const LISTENING_OFF_PHRASES = [
  'listening off',
  'turn listening off',
  'stop listening',
]

const LISTENING_TOGGLE_PHRASES = ['toggle listening', 'listening']

const SHOW_SCORE_PHRASES = [
  'show score',
  'show my score',
  'open score',
  'score',
  'show results',
  'how did i do',
]

function isCountInChoice(value: number): value is GuitarNightScoreCountInBeats {
  return GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.some((choice) => choice === value)
}

function formatCountIn(beats: GuitarNightScoreCountInBeats): string {
  if (beats === 0) return 'Count-in off'
  return `Count-in ${String(beats)} ${beats === 1 ? 'beat' : 'beats'}`
}

/**
 * Builds only the controls whose safe handlers the score-room host exposes.
 * Every successful command returns the exact feedback the HUD should show;
 * every no-op returns a reason instead of silently claiming success.
 */
export function createGuitarNightScoreVoiceCommands(
  deps: GuitarNightScoreVoiceDeps,
): VoiceCommand[] {
  const commands: VoiceCommand[] = []

  const add = (command: VoiceCommand): void => {
    commands.push(
      deps.available === undefined
        ? command
        : { ...command, available: deps.available },
    )
  }

  add({
    id: 'guitarNight.score.play',
    label: 'Play or resume',
    phrases: PLAY_PHRASES,
    run: () => {
      if (deps.playing()) return voiceFailure('Already playing')
      const feedback = deps.paused() ? 'Resume' : 'Play'
      deps.play()
      return feedback
    },
  })

  add({
    id: 'guitarNight.score.pause',
    label: 'Pause',
    phrases: PAUSE_PHRASES,
    run: () => {
      if (!deps.playing()) return voiceFailure('Nothing playing')
      deps.pause()
      return 'Pause'
    },
  })

  add({
    id: 'guitarNight.score.stop',
    label: 'Stop',
    phrases: STOP_PHRASES,
    run: () => {
      if (deps.canStop !== undefined && !deps.canStop()) {
        return voiceFailure('Nothing to stop')
      }
      deps.stop()
      return 'Stop'
    },
  })

  add({
    id: 'guitarNight.score.beginning',
    label: 'Go to beginning',
    phrases: SEEK_START_PHRASES,
    run: () => {
      deps.goToBeginning()
      return 'Go to beginning'
    },
  })

  const loop = deps.loop
  if (loop !== undefined) {
    const loopBlocked = (): VoiceCommandResult | null => {
      const reason = loop.blockedReason?.() ?? null
      return reason === null ? null : voiceFailure(reason)
    }
    add({
      id: 'guitarNight.score.loopSetA',
      label: 'Loop A set',
      phrases: LOOP_SET_A_PHRASES,
      run: () => {
        const blocked = loopBlocked()
        if (blocked !== null) return blocked
        return loop.markA() === false
          ? voiceFailure('Loop A needs a valid playhead')
          : 'Loop A set'
      },
    })

    add({
      id: 'guitarNight.score.loopSetB',
      label: 'Loop B set',
      phrases: LOOP_SET_B_PHRASES,
      run: () => {
        const blocked = loopBlocked()
        if (blocked !== null) return blocked
        return loop.markB() === false
          ? voiceFailure('Loop B needs a valid playhead')
          : 'Loop B set'
      },
    })

    add({
      id: 'guitarNight.score.loopClear',
      label: 'Loop cleared',
      phrases: LOOP_CLEAR_PHRASES,
      run: () => {
        const blocked = loopBlocked()
        if (blocked !== null) return blocked
        if (!loop.hasA() && !loop.hasB()) {
          return voiceFailure('No loop to clear')
        }
        if (loop.clear() === false) {
          return voiceFailure('Loop could not be cleared')
        }
        return 'Loop cleared'
      },
    })

    if (loop.enabled !== undefined && loop.setEnabled !== undefined) {
      const setLoopEnabled = (enabled: boolean): VoiceCommandResult => {
        if (enabled && (!loop.hasA() || !loop.hasB())) {
          return voiceFailure('Set A and B first')
        }
        if (loop.enabled?.() === enabled) {
          return voiceFailure(`Loop already ${enabled ? 'on' : 'off'}`)
        }
        loop.setEnabled?.(enabled)
        return enabled ? 'Loop on' : 'Loop off'
      }

      add({
        id: 'guitarNight.score.loopOn',
        label: 'Loop on',
        phrases: LOOP_ON_PHRASES,
        run: () => setLoopEnabled(true),
      })

      add({
        id: 'guitarNight.score.loopOff',
        label: 'Loop off',
        phrases: LOOP_OFF_PHRASES,
        run: () => setLoopEnabled(false),
      })

      add({
        id: 'guitarNight.score.loopToggle',
        label: 'Toggle loop',
        phrases: LOOP_TOGGLE_PHRASES,
        run: () => setLoopEnabled(!(loop.enabled?.() ?? false)),
      })
    }
  }

  const click = deps.click
  if (click !== undefined) {
    const setClick = (enabled: boolean): VoiceCommandResult => {
      if (click.enabled() === enabled) {
        return voiceFailure(`Click already ${enabled ? 'on' : 'off'}`)
      }
      click.setEnabled(enabled)
      return enabled ? 'Click on' : 'Click off'
    }

    add({
      id: 'guitarNight.score.clickOn',
      label: 'Click on',
      phrases: CLICK_ON_PHRASES,
      run: () => setClick(true),
    })
    add({
      id: 'guitarNight.score.clickOff',
      label: 'Click off',
      phrases: CLICK_OFF_PHRASES,
      run: () => setClick(false),
    })
    add({
      id: 'guitarNight.score.clickToggle',
      label: 'Toggle click',
      phrases: CLICK_TOGGLE_PHRASES,
      run: () => setClick(!click.enabled()),
    })
  }

  const countIn = deps.countIn
  if (countIn !== undefined) {
    const setCountIn = (raw: number | undefined): VoiceCommandResult => {
      if (raw === undefined || !isCountInChoice(raw)) {
        return voiceFailure('Count-in can be off, 1, 2 or 4 beats')
      }
      if (countIn.beats() === raw) {
        return voiceFailure(`${formatCountIn(raw)} already set`)
      }
      countIn.setBeats(raw)
      return formatCountIn(raw)
    }

    add({
      id: 'guitarNight.score.countInOff',
      label: 'Count-in off',
      phrases: COUNT_IN_OFF_PHRASES,
      run: () => setCountIn(0),
    })
    add({
      id: 'guitarNight.score.countInSet',
      label: 'Set count-in',
      phrases: COUNT_IN_SET_PHRASES,
      run: (args) => setCountIn(args.n),
    })
    add({
      id: 'guitarNight.score.countInCycle',
      label: 'Next count-in',
      phrases: COUNT_IN_CYCLE_PHRASES,
      run: () => {
        const index = GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.indexOf(
          countIn.beats() as GuitarNightScoreCountInBeats,
        )
        const next =
          GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES[
            index < 0
              ? 0
              : (index + 1) % GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.length
          ] ?? 0
        countIn.setBeats(next)
        return formatCountIn(next)
      },
    })
  }

  const tabSound = deps.tabSound
  if (tabSound !== undefined) {
    const setTabSound = (enabled: boolean): VoiceCommandResult => {
      if (tabSound.enabled() === enabled) {
        return voiceFailure(
          enabled ? 'Tab sounds already on' : 'Tab already silent',
        )
      }
      tabSound.setEnabled(enabled)
      return enabled ? 'Tab sounds' : 'Tab silent'
    }

    add({
      id: 'guitarNight.score.tabSoundOn',
      label: 'Tab sounds',
      phrases: TAB_SOUND_ON_PHRASES,
      run: () => setTabSound(true),
    })
    add({
      id: 'guitarNight.score.tabSoundOff',
      label: 'Tab silent',
      phrases: TAB_SOUND_OFF_PHRASES,
      run: () => setTabSound(false),
    })
    add({
      id: 'guitarNight.score.tabSoundToggle',
      label: 'Toggle tab sound',
      phrases: TAB_SOUND_TOGGLE_PHRASES,
      run: () => setTabSound(!tabSound.enabled()),
    })
  }

  const listening = deps.listening
  if (listening !== undefined) {
    const startListening = (): VoiceCommandResult => {
      if (listening.active()) {
        return voiceFailure('Listening already on')
      }
      const reason = listening.blockedReason?.()
      if (reason !== undefined && reason !== null) {
        return voiceFailure(reason)
      }
      if (listening.requestStart() === false) {
        return voiceFailure('Listening could not start')
      }
      return 'Listening starting'
    }

    const stopListening = (): VoiceCommandResult => {
      if (!listening.active()) {
        return voiceFailure('Listening already off')
      }
      listening.stop()
      return 'Listening off'
    }

    add({
      id: 'guitarNight.score.listeningOn',
      label: 'Listening on',
      phrases: LISTENING_ON_PHRASES,
      run: startListening,
    })
    add({
      id: 'guitarNight.score.listeningOff',
      label: 'Listening off',
      phrases: LISTENING_OFF_PHRASES,
      run: stopListening,
    })
    add({
      id: 'guitarNight.score.listeningToggle',
      label: 'Toggle Listening',
      phrases: LISTENING_TOGGLE_PHRASES,
      run: () => (listening.active() ? stopListening() : startListening()),
    })
  }

  const score = deps.score
  if (score !== undefined) {
    add({
      id: 'guitarNight.score.showScore',
      label: 'Show score',
      phrases: SHOW_SCORE_PHRASES,
      run: () => {
        if (score.open()) return voiceFailure('Score already open')
        if (score.show() === false) return voiceFailure('No score to show yet')
        return 'Score opened'
      },
    })
  }

  return commands
}
