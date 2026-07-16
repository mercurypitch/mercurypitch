import { showNotification } from '@/stores/notifications-store'
import type { SensitivityPreset } from '@/stores/settings-store'
import { applySensitivityPreset } from '@/stores/settings-store'

const SAMPLE_MS = 1000

/**
 * Sample the ambient mic level for ~1s and pick a sensitivity preset from the
 * measured noise floor, then apply it. The caller must ensure the mic is on
 * first. The user is asked to stay quiet so we measure background noise, not
 * their voice.
 */
export async function autoCalibrateSensitivity(
  getLevel: () => number,
): Promise<SensitivityPreset> {
  showNotification('Calibrating — stay quiet for a moment…', 'info')

  const samples: number[] = []
  await new Promise<void>((resolve) => {
    const start = performance.now()
    const tick = () => {
      samples.push(getLevel())
      if (performance.now() - start >= SAMPLE_MS) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const avg =
    samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0
  const preset: SensitivityPreset =
    avg < 0.01 ? 'quiet' : avg < 0.03 ? 'home' : 'noisy'

  applySensitivityPreset(preset)
  showNotification(
    `Mic sensitivity set to "${preset}" (room noise).`,
    'success',
  )
  return preset
}
