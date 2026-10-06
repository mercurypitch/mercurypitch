// Development tuning capability — compiled preview hosts opt in without unlocking progression.
import type { GlassGameHost } from '../host'

export function hasDevelopmentTuning(
  host: Pick<GlassGameHost, 'developmentTuning'>,
): boolean {
  return host.developmentTuning ?? import.meta.env.DEV
}
