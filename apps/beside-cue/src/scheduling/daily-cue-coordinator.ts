import type { TargetTimeScheduleRule } from '@irchiinnuss/beside-cue-core'
import type { MobileRuntime, NotificationPermissionState, } from '@irchiinnuss/mobile-runtime'
import type { DailyCueConfig } from '../app-config'
import type { BesideCuePlatform } from '../infrastructure/mobile-runtime'
import { DAILY_CUE_NOTIFICATION_IDS, planDailyCueNotification, } from './daily-cue-plan'

export type DailyCueReconcileResult =
  | 'scheduled'
  | 'foreground-only'
  | 'cleared'
  | 'permission-needed'
  | 'permission-denied'
  | 'unsupported'
  | 'superseded'

export interface DailyCueCoordinator {
  permission(requestIfNeeded: boolean): Promise<NotificationPermissionState>
  reconcile(
    rule: TargetTimeScheduleRule | undefined,
    config: DailyCueConfig,
  ): Promise<DailyCueReconcileResult>
}

async function notificationPermission(
  runtime: MobileRuntime,
  requestIfNeeded: boolean,
): Promise<NotificationPermissionState> {
  const current = await runtime.localNotifications.checkPermission()
  if (
    requestIfNeeded &&
    (current === 'prompt' || current === 'prompt-with-rationale')
  ) {
    return runtime.localNotifications.requestPermission()
  }
  return current
}

/**
 * Serializes every mutation of Beside Cue's reserved notification ID. A newer
 * intent supersedes queued work, while already-running work is always followed
 * by the newer reconciliation before the queue settles.
 */
export function createDailyCueCoordinator(
  runtimePromise: Promise<MobileRuntime>,
  platform: BesideCuePlatform,
): DailyCueCoordinator {
  let generation = 0
  let mutationQueue: Promise<void> = Promise.resolve()

  function enqueue(
    operation: (
      operationGeneration: number,
    ) => Promise<DailyCueReconcileResult>,
  ): Promise<DailyCueReconcileResult> {
    const operationGeneration = (generation += 1)
    const result = mutationQueue
      .catch(() => undefined)
      .then(() => operation(operationGeneration))
    mutationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async function clear(runtime: MobileRuntime): Promise<void> {
    await Promise.all([
      runtime.localNotifications.cancel(DAILY_CUE_NOTIFICATION_IDS),
      runtime.localNotifications.removeDelivered(DAILY_CUE_NOTIFICATION_IDS),
    ])
  }

  return {
    async permission(requestIfNeeded) {
      if (platform === 'web') return 'unsupported'
      return notificationPermission(await runtimePromise, requestIfNeeded)
    },

    reconcile(rule, config) {
      return enqueue(async (operationGeneration) => {
        const runtime = await runtimePromise
        if (operationGeneration !== generation) return 'superseded'

        if (rule === undefined) {
          await clear(runtime)
          return operationGeneration === generation ? 'cleared' : 'superseded'
        }

        if (platform !== 'web') {
          const permission = await notificationPermission(runtime, false)
          if (operationGeneration !== generation) return 'superseded'
          if (permission !== 'granted') {
            await clear(runtime)
            if (operationGeneration !== generation) return 'superseded'
            if (
              permission === 'prompt' ||
              permission === 'prompt-with-rationale'
            ) {
              return 'permission-needed'
            }
            return permission === 'denied' ? 'permission-denied' : 'unsupported'
          }
        }

        if (platform === 'android') {
          await runtime.localNotifications.createChannel({
            ...config.channel,
            importance: 2,
            visibility: 0,
            vibration: false,
            lights: false,
          })
          if (operationGeneration !== generation) return 'superseded'
        }

        const notification = planDailyCueNotification({
          cueId: rule.cueId,
          scheduleRuleId: rule.id,
          scheduleRevision: rule.updatedAt,
          localTime: rule.localTime,
          title: config.notification.title,
          body: config.notification.body,
          ...(platform === 'android' ? { channelId: config.channel.id } : {}),
        })

        await clear(runtime)
        if (operationGeneration !== generation) return 'superseded'
        await runtime.localNotifications.schedule([notification])
        return operationGeneration === generation
          ? platform === 'web'
            ? 'foreground-only'
            : 'scheduled'
          : 'superseded'
      })
    },
  }
}
