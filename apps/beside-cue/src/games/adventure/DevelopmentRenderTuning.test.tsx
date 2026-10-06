// Shared tuning integration — visible controls invoke host callbacks and reset the saved presentation values.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { CameraTuningPanel } from '../../../../../packages/glass-game/src/ui/CameraTuningPanel'
import { DevelopmentRenderTuning } from '../../../../../packages/glass-game/src/ui/DevelopmentRenderTuning'

describe('development rendering controls', () => {
  it('shows the saved speed, accepts a range input and resets graphics and glass together', () => {
    const quality = vi.fn()
    const apply = vi.fn()
    const [speed, setSpeed] = createSignal(0.6)
    render(() => (
      <DevelopmentRenderTuning
        renderQualityPreference="balanced"
        renderQualityProfile="balanced"
        onRenderQualityChange={quality}
        shatterPlaybackSpeed={speed()}
        onShatterPlaybackSpeedChange={(value) => {
          apply(value)
          setSpeed(value)
        }}
      />
    ))
    const slider = screen.getByRole('slider', { name: 'Shatter speed' })
    expect(slider).toHaveValue('0.6')
    expect(slider).toHaveAttribute('aria-valuetext', '0.60 times normal speed')
    fireEvent.input(slider, { target: { value: '0.8' } })
    expect(apply).toHaveBeenLastCalledWith(0.8)
    fireEvent.click(screen.getByRole('button', { name: 'High' }))
    expect(quality).toHaveBeenLastCalledWith('high')
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset graphics and glass' }),
    )
    expect(apply).toHaveBeenLastCalledWith(1)
    expect(quality).toHaveBeenLastCalledWith('auto')
    expect(slider).toHaveValue('1')
  })
  it('opens the rendering controls through the gallery Tune button and resets its full preset', () => {
    const camera = vi.fn(),
      speed = vi.fn(),
      quality = vi.fn()
    render(() => (
      <CameraTuningPanel
        settings={{ lookSensitivity: 0.8, followSmoothnessSeconds: 0.42 }}
        onChange={camera}
        renderQualityPreference="high"
        renderQualityProfile="high"
        onRenderQualityChange={quality}
        shatterPlaybackSpeed={0.6}
        onShatterPlaybackSpeedChange={speed}
      />
    ))
    expect(screen.queryByRole('slider', { name: 'Shatter speed' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Camera tuning' }))
    expect(screen.getByRole('slider', { name: 'Shatter speed' })).toHaveValue(
      '0.6',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }))
    expect(camera).toHaveBeenCalledWith({
      lookSensitivity: 1,
      followSmoothnessSeconds: 0.32,
    })
    expect(speed).toHaveBeenCalledWith(1)
    expect(quality).toHaveBeenCalledWith('auto')
  })
})
