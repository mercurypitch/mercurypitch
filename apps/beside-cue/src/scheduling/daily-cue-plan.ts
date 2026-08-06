import { assertLocalTime } from '@irchiinnuss/beside-cue-core'
import type { LocalNotificationRequest, NotificationId, } from '@irchiinnuss/mobile-runtime'
import { notificationId } from '@irchiinnuss/mobile-runtime'

export const DAILY_CUE_NOTIFICATION_ID: NotificationId =
  notificationId(1_620_100_000)

export const DAILY_CUE_NOTIFICATION_IDS: readonly NotificationId[] =
  Object.freeze([DAILY_CUE_NOTIFICATION_ID])

export interface DailyCueNotificationPayload extends Readonly<
  Record<string, unknown>
> {
  readonly type: 'beside-cue-daily'
  readonly cueId: string
  readonly scheduleRuleId: string
  readonly scheduleRevision: string
}

export interface PlanDailyCueNotificationInput {
  readonly cueId: string
  readonly scheduleRuleId: string
  readonly scheduleRevision: string
  readonly localTime: string
  readonly title: string
  readonly body: string
  readonly channelId?: string
}

/**
 * Maps portable daily intent to one recurring wall-clock notification. A
 * stable identifier prevents ignored cues from accumulating in the device
 * notification shade and lets the OS preserve the schedule across restarts.
 */
export function planDailyCueNotification(
  input: PlanDailyCueNotificationInput,
): LocalNotificationRequest {
  assertLocalTime(input.localTime)
  const [hoursText, minutesText] = input.localTime.split(':')
  const hour = Number(hoursText)
  const minute = Number(minutesText)
  const payload: DailyCueNotificationPayload = {
    type: 'beside-cue-daily',
    cueId: input.cueId,
    scheduleRuleId: input.scheduleRuleId,
    scheduleRevision: input.scheduleRevision,
  }

  return {
    id: DAILY_CUE_NOTIFICATION_ID,
    title: input.title,
    body: input.body,
    schedule: { kind: 'daily', hour, minute },
    ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
    extra: payload,
    allowWhileIdle: false,
    autoCancel: true,
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function decodeDailyCueNotificationPayload(
  value: unknown,
): DailyCueNotificationPayload | undefined {
  if (
    !isRecord(value) ||
    value.type !== 'beside-cue-daily' ||
    !isNonEmptyString(value.cueId) ||
    !isNonEmptyString(value.scheduleRuleId) ||
    !isNonEmptyString(value.scheduleRevision) ||
    !Number.isFinite(Date.parse(value.scheduleRevision))
  ) {
    return undefined
  }

  return {
    type: 'beside-cue-daily',
    cueId: value.cueId,
    scheduleRuleId: value.scheduleRuleId,
    scheduleRevision: value.scheduleRevision,
  }
}
