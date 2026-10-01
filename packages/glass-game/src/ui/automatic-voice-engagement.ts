// Automatic voice engagement — consumes one museum circle until Merc physically leaves it.

import type { LevelDefinition, Vec3 } from '../contracts'
import { isWithinAutomaticSingingContact, isWithinAutomaticSingingFootprint, } from '../core/exhibit-interaction'
import type { GlassGameHost, GlassVoicePreparation } from '../host'

export const AUTOMATIC_SINGING_PREFERENCE = 'automatic-singing'

export function parseAutomaticSingingPreference(value: string | null): boolean {
  return value !== 'off'
}

export function serializeAutomaticSingingPreference(enabled: boolean): string {
  return enabled ? 'on' : 'off'
}

export function readAutomaticSingingPreference(
  host: Pick<GlassGameHost, 'readPreference'>,
): boolean {
  return parseAutomaticSingingPreference(
    host.readPreference(AUTOMATIC_SINGING_PREFERENCE),
  )
}

export interface AutomaticVoicePreparationOwner {
  current(): GlassVoicePreparation | null
  /** Calls the host synchronously when no preparation is already owned. */
  prepare(): GlassVoicePreparation
  /** An old async attempt can release only the preparation it captured. */
  release(preparation?: GlassVoicePreparation | null): void
}

export function createAutomaticVoicePreparationOwner(
  host: Pick<GlassGameHost, 'prepareVoiceGesture'>,
  onUnavailable: () => void,
): AutomaticVoicePreparationOwner {
  let current: GlassVoicePreparation | null = null
  const released = new WeakSet<GlassVoicePreparation>()

  const release = (
    preparation: GlassVoicePreparation | null = current,
  ): void => {
    if (preparation === null) return
    if (!released.has(preparation)) {
      released.add(preparation)
      preparation.release()
    }
    if (current === preparation) current = null
  }

  return {
    current: () => current,
    prepare() {
      if (current !== null) return current
      const preparation = host.prepareVoiceGesture()
      current = preparation
      const unavailable = (): void => {
        if (current !== preparation) return
        release(preparation)
        onUnavailable()
      }
      void preparation.ready.then((available) => {
        if (!available) unavailable()
      }, unavailable)
      return preparation
    },
    release,
  }
}

interface AutomaticVoiceObservation {
  enabled: boolean
  eligible: boolean
  nearbyEncounterId: string | null
  playerPosition: Pick<Vec3, 'x' | 'y' | 'z'>
}

export interface AutomaticVoiceEngagement {
  arm(): void
  disarm(): void
  consume(encounterId: string): void
  observe(observation: AutomaticVoiceObservation): string | null
  snapshot(): { armed: boolean; blockedEncounterId: string | null }
}

export function createAutomaticVoiceEngagement(
  level: Pick<LevelDefinition, 'breakables'>,
): AutomaticVoiceEngagement {
  const anchors = new Map(
    level.breakables.map((breakable) => [breakable.id, breakable.anchor]),
  )
  let armed = false
  let blockedEncounterId: string | null = null

  const stillInsideBlockedCircle = (
    position: Pick<Vec3, 'x' | 'y' | 'z'>,
  ): boolean => {
    if (blockedEncounterId === null) return false
    const anchor = anchors.get(blockedEncounterId)
    return (
      anchor !== undefined &&
      isWithinAutomaticSingingFootprint(position, anchor)
    )
  }

  const insideNearbyCircle = (
    encounterId: string | null,
    position: Pick<Vec3, 'x' | 'y' | 'z'>,
  ): boolean => {
    if (encounterId === null) return false
    const anchor = anchors.get(encounterId)
    return (
      anchor !== undefined && isWithinAutomaticSingingContact(position, anchor)
    )
  }

  return {
    arm() {
      armed = true
    },
    disarm() {
      armed = false
    },
    consume(encounterId) {
      if (anchors.has(encounterId)) blockedEncounterId = encounterId
    },
    observe(observation) {
      if (
        blockedEncounterId !== null &&
        !stillInsideBlockedCircle(observation.playerPosition)
      )
        blockedEncounterId = null

      if (
        !armed ||
        !observation.enabled ||
        !observation.eligible ||
        observation.nearbyEncounterId === null ||
        !insideNearbyCircle(
          observation.nearbyEncounterId,
          observation.playerPosition,
        ) ||
        blockedEncounterId !== null
      )
        return null

      blockedEncounterId = observation.nearbyEncounterId
      return blockedEncounterId
    },
    snapshot: () => ({ armed, blockedEncounterId }),
  }
}
