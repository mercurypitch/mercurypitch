// Input kinds — a short tag for each kind of input the roster names (mic-roster.ts), for every list that shows inputs: the mic check, First Light's microphone and the Studio's Inputs view.
import type { InputKind } from './mic-roster'

/** A short tag for each kind of input. `other` says nothing rather than guess. */
export const INPUT_KIND_LABEL: Readonly<Record<InputKind, string>> = {
  'built-in': 'Built-in',
  usb: 'USB',
  bluetooth: 'Bluetooth',
  headset: 'Headset',
  camera: 'Webcam',
  display: 'Display',
  virtual: 'Virtual',
  loopback: 'Loopback',
  other: '',
}
