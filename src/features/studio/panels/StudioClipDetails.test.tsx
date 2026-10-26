// Studio clip detail tests — submillisecond bounds and source-anchored fade preservation.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { StudioClipDetails } from './StudioClipDetails'

afterEach(cleanup)

describe('Studio clip details', () => {
  it('keeps exact valid bounds for a one-frame clip and accepts a one-frame tail extension', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={{ ...clip, startFrame: 0, sourceInFrame: 4, sourceOutFrame: 5 }}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const head = screen.getByRole('spinbutton', {
      name: 'Trim start',
    }) as HTMLInputElement
    const tail = screen.getByRole('spinbutton', {
      name: 'Trim end',
    }) as HTMLInputElement
    expect(head.valueAsNumber).toBe(4 / 48000)
    expect(Number(head.min)).toBe(4 / 48000)
    expect(Number(head.max)).toBe(4 / 48000)
    expect(head.validity.valid).toBe(true)
    expect(tail.validity.valid).toBe(true)
    fireEvent.input(tail, { target: { value: String(6 / 48000) } })
    fireEvent.keyDown(tail, { key: 'Enter' })
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'trim-tail',
      clipId: clip.id,
      sourceOutFrame: 6,
    })
    fireEvent.input(head, { target: { value: String(3 / 48000) } })
    fireEvent.blur(head)
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('does not rewrite a retained partial fade on Enter or blur, and anchors an explicit edit in source frames', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={{ ...clip, sourceInFrame: 100, sourceOutFrame: 900 }}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const fade = screen.getByRole('spinbutton', { name: 'Fade in' })
    expect(fade).toHaveValue(100 / 48000)
    fireEvent.keyDown(fade, { key: 'Enter' })
    fireEvent.blur(fade)
    expect(command).not.toHaveBeenCalled()
    fireEvent.input(fade, { target: { value: String(50 / 48000) } })
    fireEvent.blur(fade)
    expect(command).toHaveBeenCalledExactlyOnceWith({
      type: 'set-fades',
      clipId: clip.id,
      fades: {
        ...clip.fades,
        in: { fromSourceFrame: 100, toSourceFrame: 150 },
      },
    })
  })

  it('rejects a fade that would cross the other retained source ramp', () => {
    const { clip, asset } = studioFixture()
    const command = vi.fn(() => true)
    render(() => (
      <StudioClipDetails
        clip={clip}
        asset={asset}
        writable
        onCommand={command}
      />
    ))
    const fade = screen.getByRole('spinbutton', { name: 'Fade in' })
    expect(fade).toHaveAttribute('max', String(800 / 48000))
    fireEvent.input(fade, { target: { value: String(801 / 48000) } })
    fireEvent.blur(fade)
    expect(command).not.toHaveBeenCalled()
    expect(fade).toHaveValue(200 / 48000)
    expect(fade).toHaveAttribute('aria-invalid', 'true')
  })
})
