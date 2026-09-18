// ============================================================
// Every licensed kit in the picker carries its credits
// ============================================================
//
// The Session Drummer's notice used to be
// `kitId === 'muldjord' || kitId === 'crocell'` written into the component,
// so the day a third licensed kit joined the picker it would have played with
// no attribution — the one thing a CC BY licence actually asks of us. The kit
// options declare their credits now, and this is what keeps that declaration
// honest: it is checked against the manifest, which is the record of what we
// actually ship and under what terms.
//
// The declaration is duplicated on purpose. Guitar Night renders its picker on
// first paint and must not pull the generated sample catalogue into that chunk
// (see the header of guitar-night-drum-sound.ts), so the manifest is imported
// here, in a test, where it costs nothing.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRUM_KIT_MANIFESTS } from '@/features/drum-night/audio/drum-kit-manifest'
import { GUITAR_NIGHT_DRUM_KIT_OPTIONS, guitarNightDrumKitCredit, } from '@/features/guitar-night/guitar-night-drum-sound'

const publicDir = resolve(import.meta.dirname, '../../public')

describe('the Session Drummer kit picker', () => {
  it.each(GUITAR_NIGHT_DRUM_KIT_OPTIONS.map((option) => option.id))(
    '%s credits exactly what its licence requires',
    (kitId) => {
      const license = DRUM_KIT_MANIFESTS[kitId].license
      const notice = license.noticePath ?? license.licenseTextPath
      const credit = guitarNightDrumKitCredit(kitId)
      if (notice === null) {
        expect(credit, `${kitId} owes no notice but offers one`).toBeNull()
        return
      }
      expect(
        credit,
        `${kitId} ships ${notice} with no credit line`,
      ).not.toBeNull()
      expect(credit?.href).toBe(`/drum-night/kits/${notice}`)
      expect(credit?.label).toBe(
        `Kit credits · ${license.spdx.replace(/-/g, ' ')}`,
      )
    },
  )

  it.each(
    GUITAR_NIGHT_DRUM_KIT_OPTIONS.filter((option) => option.credit).map(
      (option) => [option.id, option.credit!.href] as const,
    ),
  )('%s links a notice that is actually shipped', (_kitId, href) => {
    expect(existsSync(resolve(publicDir, href.replace(/^\//, '')))).toBe(true)
  })
})
