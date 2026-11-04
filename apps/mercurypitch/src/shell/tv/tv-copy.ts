// ============================================================
// TV copy: every word the TV chooser and its Settings group say
// ============================================================
//
// One module, so the sheet, Settings and their tests read the same lines.
// A line that names the device in hand reads it when it is shown
// (device-noun.ts): "my phone" on a phone, "my iPad" on an iPad. A TV is
// called by its own name where the phone heard one (tv-name.ts), and "this
// TV" where it did not.

import { deviceNoun, theDevice, thisDeviceLower } from '@/lib/device-noun'
import type { TvChoice } from './tv-memory'

/** The sheet's fixed words. */
export const TV_SHEET = {
  title: 'Show on the TV',
  notNow: 'Not now',
  recommended: 'Recommended',
} as const

/** Each choice by name, with its line: the sheet and Settings both. */
export function tvChoiceWords(choice: TvChoice): {
  readonly name: string
  readonly line: string
} {
  if (choice === 'stage') {
    return { name: 'Stage', line: 'Your pitch and the lyrics' }
  }
  if (choice === 'lyrics') {
    return { name: 'Lyrics', line: 'The words, full screen' }
  }
  return { name: 'Mirror', line: `The TV shows ${theDevice()}` }
}

/** Under the sheet's title: which TV, and that the phone stays the room. */
export function tvConnectedLine(name: string | null): string {
  const tv = name ?? 'A TV'
  return `${tv} is connected. Your ${deviceNoun()} stays the room and the microphone.`
}

/** The box that keeps the answer for this TV. */
export function tvRememberLabel(name: string | null): string {
  return `Remember for ${name ?? 'this TV'}`
}

/** The quiet third answer: the plain mirror. */
export function tvKeepMirroringLabel(): string {
  return `Keep mirroring my ${deviceNoun()}`
}

/** What Settings calls a remembered TV. */
export function tvSettingsName(name: string | null): string {
  return name ?? 'A TV with no name'
}

/** Settings, before any TV is remembered: what happens when one connects. */
export function tvNoneYetLine(): string {
  return `When a TV mirrors ${thisDeviceLower()}, you choose what it shows: the stage, the lyrics or ${theDevice()}.`
}
