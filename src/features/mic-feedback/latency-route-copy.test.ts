// ============================================================
// latency-route-copy tests
// ============================================================
//
// What the latency wizard says after a failed run on a TV or Bluetooth
// (REQ-TV-096): how late a round trip it would not keep was, and what to try
// on each route; where to hold the phone when few clicks came back.

import { describe, expect, it } from 'vitest'
import type { RouteLatencyResult } from '@/lib/mic-latency-route'
import { isTvRoute, routeFailureCopy } from './latency-route-copy'

function failed(
  failure: RouteLatencyResult['failure'],
  heardMs?: number,
): RouteLatencyResult {
  return { latencyMs: null, spreadMs: null, hits: 8, failure, heardMs }
}

describe('isTvRoute', () => {
  it('counts AirPlay and HDMI as a TV, and Bluetooth and the phone as not', () => {
    expect(isTvRoute('airplay')).toBe(true)
    expect(isTvRoute('hdmi')).toBe(true)
    expect(isTvRoute('bluetooth')).toBe(false)
    expect(isTvRoute(null)).toBe(false)
  })
})

describe('routeFailureCopy', () => {
  it('says how late the TV plays the sound, and suggests mirroring on AirPlay', () => {
    expect(routeFailureCopy(failed('too-late', 1600), 'airplay')).toBe(
      'The TV plays the sound about 1.6 s after the phone sends it, too late to sing along with, so no number was kept. If only the sound goes to the TV, use Screen Mirroring instead: it sends the picture with the sound, and much sooner.',
    )
  })

  it('suggests the TV’s game mode on HDMI, and another speaker on Bluetooth', () => {
    expect(routeFailureCopy(failed('too-late', 1240), 'hdmi')).toBe(
      "The TV plays the sound about 1.2 s after the phone sends it, too late to sing along with, so no number was kept. Turn on the TV's game mode, if it has one, and try again.",
    )
    expect(routeFailureCopy(failed('too-late', 2050), 'bluetooth')).toBe(
      "The speaker plays the sound about 2.1 s after the phone sends it, too late to sing along with, so no number was kept. Use the phone's own speaker, or a wired one, instead.",
    )
  })

  it('says where to hold the phone, and what to turn off, when few clicks come back', () => {
    const tv = routeFailureCopy(failed('too-few-hits'), 'airplay')
    expect(tv).toContain("Hold the phone near the TV's speaker")
    expect(tv).toContain("turn off the TV's automatic volume")
    expect(routeFailureCopy(failed('too-few-hits'), 'hdmi')).toBe(tv)
    expect(routeFailureCopy(failed('too-few-hits'), 'bluetooth')).toBe(
      'Only a few clicks came back clearly from the speaker. Hold the phone near it, turn it up a little, and try again.',
    )
  })

  it('asks for the sound to come from the TV when nothing came back', () => {
    expect(routeFailureCopy(failed('not-heard'), 'airplay')).toContain(
      'Check that the sound plays from the TV with its volume up',
    )
    expect(routeFailureCopy(failed('not-heard'), 'bluetooth')).toContain(
      'Check that the sound plays from the speaker with its volume up',
    )
  })

  it('leaves a median at or below zero to the phone’s own words', () => {
    expect(routeFailureCopy(failed('out-of-range'), 'airplay')).toBeNull()
  })
})
