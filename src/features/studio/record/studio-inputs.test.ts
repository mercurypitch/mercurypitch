// Studio inputs tests — the default comes first, inputs are named or numbered, the browser's own routes are left out, and an input that is gone stays named.
import { describe, expect, it } from 'vitest'
import { studioInputChoices, studioInputsNamed } from './studio-inputs'

const device = (deviceId: string, label: string) => ({ deviceId, label })

describe('studioInputChoices', () => {
  it('lists the default, then each input by name, leaving out the browser routes', () => {
    expect(
      studioInputChoices(
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
      { id: 'usb-2', label: 'Input 2', connected: true },
    ])
  })

  it('keeps a chosen input that is gone, named as it was', () => {
    const choices = studioInputChoices([device('desk-mic', 'Desk mic')], {
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
    expect(studioInputChoices(unnamed, { id: null, label: null })).toEqual([
      { id: null, label: 'Default input', connected: true },
    ])
    expect(studioInputsNamed(unnamed)).toBe(false)
    expect(studioInputsNamed([device('desk-mic', 'Desk mic')])).toBe(true)
    expect(studioInputsNamed([device('default', 'Default - Desk mic')])).toBe(
      false,
    )
  })
})
