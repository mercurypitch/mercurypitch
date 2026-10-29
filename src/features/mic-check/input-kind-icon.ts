// The icon for each kind of input, for every list that names inputs: the
// Settings mic check and First Light's microphone panel.

import type { Component } from 'solid-js'
import { Cpu, Headphones, Loop, Mic } from '@/components/icons'
import type { InputKind } from './mic-roster'

export const INPUT_KIND_ICON: Record<InputKind, Component> = {
  'built-in': Mic,
  usb: Mic,
  bluetooth: Headphones,
  headset: Headphones,
  camera: Mic,
  display: Mic,
  virtual: Cpu,
  loopback: Loop,
  other: Mic,
}
