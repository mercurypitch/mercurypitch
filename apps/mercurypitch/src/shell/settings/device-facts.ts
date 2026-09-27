// ============================================================
// Device facts — what the phone says about itself (S6 8a, 8b)
// ============================================================
//
// For This phone and About: the model and system from @capacitor/device,
// the version and build from the app's own record (App.getInfo), and three
// readings the app already takes — the graphics tier, the rate of the audio
// context the rooms play through, and the audio session. Anything that
// cannot be read is null, and the screens say "Not available" rather than
// invent a value. Nothing here is personal: the phone's own name (which a
// person may have set to theirs) is never read.
//
// The plugins are called, never handed around: a Capacitor plugin object is
// a thenable proxy, and returning or awaiting one hangs the caller.

import { App } from '@capacitor/app'
import type { DeviceInfo } from '@capacitor/device'
import { Device } from '@capacitor/device'
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DeviceTier } from '@/lib/device-tier'
import { deviceTier } from '@/lib/device-tier'
import { ambient } from '../../alley/RoomsAlley'

export interface DeviceFacts {
  /** "iPhone17,3", or "Google Pixel 8". */
  model: string | null
  /** "iOS 26.0". */
  system: string | null
  /** "0.6.0 (380)". */
  version: string | null
}

const [facts, setFacts] = createSignal<DeviceFacts | null>(null)

/** The last facts read this session, for the Settings rows. Reactive. */
export const deviceFacts: Accessor<DeviceFacts | null> = facts

const SYSTEMS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  mac: 'macOS',
  windows: 'Windows',
}

/** "iOS 26.0", as the phone names itself. */
export function systemLine(os: string, version: string): string {
  const name = SYSTEMS[os] ?? os
  return version === '' ? name : `${name} ${version}`
}

function capitalised(word: string): string {
  return word === '' ? word : word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * The model as the phone reports it. An iPhone reports its hardware id
 * ("iPhone17,3"), exact for a bug report; an Android phone reports a model
 * name, which reads better with its maker in front, once.
 */
export function modelLine(
  info: Pick<DeviceInfo, 'model' | 'operatingSystem' | 'manufacturer'>,
): string {
  if (info.operatingSystem !== 'android' || info.manufacturer === '') {
    return info.model
  }
  const maker = capitalised(info.manufacturer)
  return info.model.toLowerCase().startsWith(maker.toLowerCase())
    ? info.model
    : `${maker} ${info.model}`
}

/** "0.6.0 (380)", as 8b writes it. */
export function versionLine(version: string, build: string): string {
  return build === '' ? version : `${version} (${build})`
}

const TIERS: Record<DeviceTier, string> = {
  high: 'High',
  balanced: 'Balanced',
  low: 'Low',
}

export function tierLabel(tier: DeviceTier): string {
  return TIERS[tier]
}

const SESSIONS: Record<string, string> = {
  auto: 'Automatic',
  playback: 'Playback',
  'play-and-record': 'Play and record',
  ambient: 'Ambient',
  transient: 'Transient',
  'transient-solo': 'Transient solo',
}

/** The audio session in words: "Play and record". */
export function audioSessionLine(type: string | undefined): string {
  if (type === undefined) return 'Not available'
  return SESSIONS[type] ?? type
}

/** The graphics tier the app runs at. */
export function graphicsTier(): DeviceTier {
  return deviceTier()
}

/** The rate of the audio context the rooms play through, once there is one. */
export function audioRate(): number | null {
  return ambient().context()?.sampleRate ?? null
}

/** The WebView's audio session type, where it has one (iOS). */
export function audioSession(): string | undefined {
  return (navigator as Navigator & { audioSession?: { type?: string } })
    .audioSession?.type
}

/** The block Copy details writes: the app's name, then a row a line. */
export function detailsText(
  rows: readonly { label: string; value: string }[],
): string {
  return [
    'MercuryPitch',
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join('\n')
}

async function readDevice(): Promise<Pick<DeviceFacts, 'model' | 'system'>> {
  try {
    const info = await Device.getInfo()
    return {
      model: modelLine(info),
      system: systemLine(info.operatingSystem, info.osVersion),
    }
  } catch {
    return { model: null, system: null }
  }
}

async function readVersion(): Promise<string | null> {
  try {
    const info = await App.getInfo()
    return versionLine(info.version, info.build)
  } catch {
    // The web preview has no native record of the app's version.
    return null
  }
}

/** Read the phone and the app. Never throws. */
export async function loadDeviceFacts(): Promise<DeviceFacts> {
  const [device, version] = await Promise.all([readDevice(), readVersion()])
  const next = { ...device, version }
  setFacts(next)
  return next
}
