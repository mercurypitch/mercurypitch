import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

import type { HapticImpactStyle, HapticNotificationType, HapticsPort, } from '../contracts'

const IMPACT_STYLES: Record<HapticImpactStyle, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

const NOTIFICATION_TYPES: Record<HapticNotificationType, NotificationType> = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
}

export function createCapacitorHapticsPort(): HapticsPort {
  return {
    impact: (style) => Haptics.impact({ style: IMPACT_STYLES[style] }),
    notification: (type) =>
      Haptics.notification({ type: NOTIFICATION_TYPES[type] }),
  }
}
