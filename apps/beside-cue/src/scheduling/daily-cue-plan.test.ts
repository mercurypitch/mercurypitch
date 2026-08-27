import { describe, expect, it } from 'vitest'
import { DAILY_CUE_NOTIFICATION_ID, DAILY_CUE_NOTIFICATION_IDS, decodeDailyCueNotificationPayload, planDailyCueNotification, } from './daily-cue-plan'

describe('daily cue notification plan', () => {
  it('plans one stable recurring local time without private cue text', () => {
    const privateCueContext = 'PRIVATE: after a difficult team call'
    const input = {
      cueId: 'cue-1',
      scheduleRuleId: 'rule-1',
      scheduleRevision: '2026-08-06T08:00:00.000Z',
      localTime: '13:05',
      title: 'A small cue is ready',
      body: 'Open Beside Cue when you choose.',
      channelId: 'gentle',
      // The planner must allowlist notification fields even if a wider caller
      // accidentally carries private plan data across this boundary.
      cueContextText: privateCueContext,
    }

    const result = planDailyCueNotification(input)

    expect(result.id).toBe(DAILY_CUE_NOTIFICATION_ID)
    expect(DAILY_CUE_NOTIFICATION_IDS).toEqual([DAILY_CUE_NOTIFICATION_ID])
    expect(result.title).toBe('A small cue is ready')
    expect(result.body).toBe('Open Beside Cue when you choose.')
    expect(result.schedule).toEqual({ kind: 'daily', hour: 13, minute: 5 })
    expect(JSON.stringify(result)).not.toContain(privateCueContext)
    expect(result.extra).toEqual({
      type: 'beside-cue-daily',
      cueId: 'cue-1',
      scheduleRuleId: 'rule-1',
      scheduleRevision: '2026-08-06T08:00:00.000Z',
    })
  })

  it.each(['0:00', '7:05', '24:00', '23:60', '09:30 '])(
    'rejects malformed local time %s',
    (localTime) => {
      expect(() =>
        planDailyCueNotification({
          cueId: 'cue-1',
          scheduleRuleId: 'rule-1',
          scheduleRevision: '2026-08-06T08:00:00.000Z',
          localTime,
          title: 'Title',
          body: 'Body',
        }),
      ).toThrow()
    },
  )

  it('rejects malformed action payloads', () => {
    expect(
      decodeDailyCueNotificationPayload({
        type: 'beside-cue-daily',
        cueId: 'cue-1',
      }),
    ).toBeUndefined()
  })

  it('round-trips a valid action payload', () => {
    const notification = planDailyCueNotification({
      cueId: 'cue-1',
      scheduleRuleId: 'rule-1',
      scheduleRevision: '2026-08-06T08:00:00.000Z',
      localTime: '09:00',
      title: 'Title',
      body: 'Body',
    })

    expect(decodeDailyCueNotificationPayload(notification.extra)).toEqual(
      notification.extra,
    )
  })
})
