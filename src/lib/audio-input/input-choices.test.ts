// Input choices tests — the null row comes first and says what it stands for, inputs are named or numbered as devices, the browser's own routes are left out, an input that is gone stays named, and an input's channels are named by their jacks.
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
  it('offers all inputs mixed, then each jack by its name from Input 1', () => {
    expect(channelChoices(2, null)).toEqual([
      { channel: null, label: 'All inputs, mixed', present: true },
      { channel: 0, label: 'Input 1', present: true },
      { channel: 1, label: 'Input 2', present: true },
    ])
  })

  it('keeps a chosen channel the input does not have, marked', () => {
    expect(channelChoices(2, 3).at(-1)).toEqual({
      channel: 3,
      label: 'Input 4 (not on this input)',
      present: false,
    })
  })

  it('offers only all inputs for an input whose channels are not known', () => {
    expect(channelChoices(0, null)).toEqual([
      { channel: null, label: 'All inputs, mixed', present: true },
    ])
  })
})
