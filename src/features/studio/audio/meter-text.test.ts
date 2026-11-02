// Studio meter text tests — a meter's numbers take a reading eight times a second, and at once when it stops or a new measurement begins.
import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createMeterText, STUDIO_METER_TEXT_MS } from './meter-text'

interface Reading {
  db: number
  measurement: number
}

function mount() {
  let time = 0
  const [reading, setReading] = createSignal<Reading | null>(null)
  return createRoot((dispose) => ({
    text: createMeterText(
      reading,
      (shown, next) => shown.measurement === next.measurement,
      () => time,
    ),
    /** A reading `ms` into the test. */
    read(ms: number, next: Reading | null) {
      time = ms
      setReading(next)
    },
    dispose,
  }))
}

describe('Studio meter text', () => {
  it('takes a new reading at most every 125 ms while one measurement lasts', () => {
    // Arrange
    const meter = mount()
    meter.read(0, { db: -6, measurement: 1 })

    // Act: the next two ticks.
    meter.read(33, { db: -3, measurement: 1 })
    meter.read(66, { db: -9, measurement: 1 })
    const between = meter.text()
    meter.read(STUDIO_METER_TEXT_MS, { db: -12, measurement: 1 })

    // Assert
    expect(between).toEqual({ db: -6, measurement: 1 })
    expect(meter.text()).toEqual({ db: -12, measurement: 1 })
    meter.dispose()
  })

  it('shows at once a reading that starts a new measurement, and no reading once it stops', () => {
    // Arrange
    const meter = mount()
    meter.read(0, { db: -6, measurement: 1 })

    // Act
    meter.read(33, { db: -30, measurement: 2 })
    const seek = meter.text()
    meter.read(66, null)
    const stopped = meter.text()
    meter.read(99, { db: -20, measurement: 2 })

    // Assert
    expect(seek).toEqual({ db: -30, measurement: 2 })
    expect(stopped).toBeNull()
    expect(meter.text()).toEqual({ db: -20, measurement: 2 })
    meter.dispose()
  })
})
