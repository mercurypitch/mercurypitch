// Input choices tests — the null row comes first and says what it stands for, inputs are named or numbered as devices, the browser's own routes are left out, an input that is gone stays named, and an input's channels and aligned pairs are named by their jacks, after a default that says what it takes.
import { describe, expect, it } from 'vitest'
import { channelChoices, inputChoices, inputsNamed } from './input-choices'

const device = (deviceId: string, label: string) => ({ deviceId, label })

describe('inputChoices', () => {
  it('lists the default, then each input by name, leaving out the browser routes', () => {
    expect(
      inputChoices(
        [
          device('default', 'Default - Desk mic'),
          device('communications', 'Communications - Desk mic'),
          device('desk-mic', 'Desk mic'),
          device('usb-2', ''),
        ],
        { id: null, label: null },
      ),
    ).toEqual([
      { id: null, label: 'Default input', connected: true },
      { id: 'desk-mic', label: 'Desk mic', connected: true },
      { id: 'usb-2', label: 'Device 2', connected: true },
    ])
  })

  it('numbers an unnamed input as a device, never as an input: that is a channel', () => {
    const choices = inputChoices([device('a', ''), device('b', '')], {
      id: null,
      label: null,
    })

    expect(choices.map((choice) => choice.label)).toEqual([
      'Default input',
      'Device 1',
      'Device 2',
    ])
  })

  it('names the null row for what a picker follows', () => {
    const choices = inputChoices(
      [device('desk-mic', 'Desk mic')],
      { id: null, label: null },
      "Studio's input (Scarlett 2i2)",
    )

    expect(choices[0]).toEqual({
      id: null,
      label: "Studio's input (Scarlett 2i2)",
      connected: true,
    })
  })

  it('keeps a chosen input that is gone, named as it was', () => {
    const choices = inputChoices([device('desk-mic', 'Desk mic')], {
      id: 'interface-1',
      label: 'Interface In 1',
    })
    expect(choices.at(-1)).toEqual({
      id: 'interface-1',
      label: 'Interface In 1 (not connected)',
      connected: false,
    })
  })

  it('lists nothing but the default before the browser lets the page see its inputs', () => {
    const unnamed = [device('', '')]
    expect(inputChoices(unnamed, { id: null, label: null })).toEqual([
      { id: null, label: 'Default input', connected: true },
    ])
    expect(inputsNamed(unnamed)).toBe(false)
    expect(inputsNamed([device('desk-mic', 'Desk mic')])).toBe(true)
    expect(inputsNamed([device('default', 'Default - Desk mic')])).toBe(false)
  })
})

describe('channelChoices', () => {
  const labels = (count: number | null) =>
    channelChoices(count, null).map((choice) => choice.label)

  it('offers the default by what it takes, then each input, then each aligned pair', () => {
    expect(channelChoices(2, null)).toEqual([
      { pick: null, label: 'Default: Inputs 1 + 2', present: true },
      { pick: { channel: 0, pair: false }, label: 'Input 1', present: true },
      { pick: { channel: 1, pair: false }, label: 'Input 2', present: true },
      {
        pick: { channel: 0, pair: true },
        label: 'Inputs 1 + 2',
        present: true,
      },
    ])
    expect(labels(4)).toEqual([
      'Default: Input 1',
      'Input 1',
      'Input 2',
      'Input 3',
      'Input 4',
      'Inputs 1 + 2',
      'Inputs 3 + 4',
    ])
  })

  it('lists only the pairs the input has both of', () => {
    expect(labels(1)).toEqual(['Default: Input 1', 'Input 1'])
    expect(labels(3)).toEqual([
      'Default: Input 1',
      'Input 1',
      'Input 2',
      'Input 3',
      'Inputs 1 + 2',
    ])
  })

  it('keeps a chosen input or pair the input does not have, marked', () => {
    expect(channelChoices(2, { channel: 3, pair: false }).at(-1)).toEqual({
      pick: { channel: 3, pair: false },
      label: 'Input 4 (not on this input)',
      present: false,
    })
    expect(channelChoices(2, { channel: 2, pair: true }).at(-1)).toEqual({
      pick: { channel: 2, pair: true },
      label: 'Inputs 3 + 4 (not on this input)',
      present: false,
    })
  })

  it('names the default plainly, and a kept choice as it is, while the channel count is not known', () => {
    expect(labels(null)).toEqual(['Default'])
    expect(channelChoices(null, { channel: 1, pair: false })).toEqual([
      { pick: null, label: 'Default', present: true },
      { pick: { channel: 1, pair: false }, label: 'Input 2', present: true },
    ])
  })
})
