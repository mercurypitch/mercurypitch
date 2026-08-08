// ============================================================
// Shared phrase families — one vocabulary for every transport
// ============================================================
//
// The global (beat-domain) transport and the StemMixer's (seconds-domain)
// set deliberately speak the same language. Keeping the phrase lists here
// makes that structural: "backwards 60 seconds" working on the Singing tab
// but reporting "not available" inside karaoke was exactly the drift this
// file exists to prevent. Command sets may EXTEND a family (the mixer's
// restart adds "sing that again") but never fork it.

export const PLAY_PHRASES = [
  'play',
  'start',
  'go',
  'begin',
  'resume',
  'continue',
  'keep going',
]

export const PAUSE_PHRASES = ['pause', 'hold', 'hold on', 'wait']

export const STOP_PHRASES = ['stop', 'finish', 'stop playback', 'stop playing']

export const RESTART_PHRASES = [
  'again',
  'restart',
  'from the top',
  'from the beginning',
  'start over',
  'start again',
  'one more time',
  'once more',
  'take it from the top',
]

export const SEEK_START_PHRASES = [
  'go to start',
  'go to the start',
  'go to beginning',
  'go to the beginning',
  'beginning',
  'rewind',
]

export const FORWARD_SECONDS_PHRASES = [
  'forward <n> seconds',
  'forward <n> second',
  'forwards <n> seconds',
  'forwards <n>',
  'skip <n> seconds',
  'skip ahead <n> seconds',
  'skip forward <n> seconds',
  'ahead <n> seconds',
  'jump forward <n> seconds',
  'jump ahead <n> seconds',
  'forward <n>',
  'skip <n>',
]

export const BACK_SECONDS_PHRASES = [
  'back <n> seconds',
  'back <n> second',
  'go back <n> seconds',
  'rewind <n> seconds',
  'backwards <n> seconds',
  'backwards <n>',
  'jump back <n> seconds',
  'back <n>',
]

export const FORWARD_MINUTES_PHRASES = [
  'forward <n> minutes',
  'forward <n> minute',
  'forwards <n> minutes',
  'skip <n> minutes',
  'ahead <n> minutes',
]

export const BACK_MINUTES_PHRASES = [
  'back <n> minutes',
  'back <n> minute',
  'go back <n> minutes',
  'backwards <n> minutes',
  'rewind <n> minutes',
]

export const ABSOLUTE_SECONDS_PHRASES = [
  'go to <n> seconds',
  'go to <n> second',
  'go to second <n>',
  'start at <n> seconds',
  'jump to <n> seconds',
  'go to <n>',
  'skip the first <n> seconds',
  'skip first <n> seconds',
]

export const ABSOLUTE_MINUTES_PHRASES = [
  'go to <n> minutes',
  'go to <n> minute',
  'go to minute <n>',
  'start at <n> minutes',
  'skip the first <n> minutes',
]

export const MIDDLE_PHRASES = [
  'go to the middle',
  'go to middle',
  'middle',
  'halfway',
]

export const END_PHRASES = ['go to the end', 'go to end', 'the end']

export const LOOP_SET_A_PHRASES = [
  'set a',
  'set point a',
  'mark a',
  'loop start',
  'set loop start',
  'loop from here',
]

export const LOOP_SET_B_PHRASES = [
  'set b',
  'set be',
  'set bee',
  'set point b',
  'mark b',
  'mark be',
  'loop end',
  'set loop end',
  'loop to here',
]

export const LOOP_TOGGLE_PHRASES = ['loop', 'toggle loop']

export const LOOP_ON_PHRASES = [
  'loop on',
  'enable loop',
  'start loop',
  'start looping',
  'loop this',
]

export const LOOP_OFF_PHRASES = [
  'loop off',
  'disable loop',
  'stop looping',
  'stop loop',
  'no loop',
]

export const LOOP_CLEAR_PHRASES = [
  'clear loop',
  'clear the loop',
  'remove loop',
  'delete loop',
  'reset loop',
]

export const LOOP_RANGE_PHRASES = [
  'loop from <n> to <n> seconds',
  'loop from <n> to <n>',
  'play a loop from <n> to <n> seconds',
  'play a loop from <n> to <n>',
  'play loop from <n> to <n> seconds',
  'loop between <n> and <n> seconds',
  'loop <n> to <n> seconds',
  'loop <n> to <n>',
]

export const SPEED_FASTER_PHRASES = [
  'faster',
  'speed up',
  'a bit faster',
  'little faster',
]

export const SPEED_SLOWER_PHRASES = [
  'slower',
  'slow down',
  'a bit slower',
  'little slower',
]

/** Named speed presets and the phrases that reach each. */
export const SPEED_PRESETS: Array<[number, string[]]> = [
  [1, ['normal speed', 'full speed', 'regular speed']],
  [0.5, ['half speed']],
  [0.25, ['quarter speed']],
  [0.75, ['three quarter speed', 'three quarters speed']],
  [2, ['double speed']],
]

/** Explicit multiplier phrasing — ALWAYS a multiplier, never percent. */
export const SPEED_MULTIPLIER_PHRASES = [
  'speed <n> x',
  '<n> x',
  'speed <n> times',
  '<n> times speed',
]

/** Bare numbers; values over 2.5 read as percent. */
export const SPEED_SPOKEN_PHRASES = [
  'speed <n> percent',
  '<n> percent speed',
  'speed <n>',
]
