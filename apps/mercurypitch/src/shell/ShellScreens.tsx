// ============================================================
// ShellScreens — the pushed screen on top of the stack, and only that one
// ============================================================
//
// Settings is the root of a stack (S6, decision D1 A): its rows push screens
// of their own, and those can push again. Only the TOP screen is drawn. A
// screen underneath is not hidden behind the one above but gone, because two
// copies of the same bar would be two Backs under one thumb, two matches for
// every probe that looks for one, and a screen reader walking a page the eye
// cannot see. What a screen needs to come back to lives in a store, not in a
// component that stayed mounted.
//
// Keyed on the id, so moving between levels re-creates the screen rather
// than morphing one into the other.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { thisDevice } from '@/lib/device-noun'
import { KaraokeStudioScreen } from './KaraokeStudioScreen'
import { isFullBleed, isPremiumRoom } from './premium-rooms'
import { PushedScreen } from './PushedScreen'
import { RoomVisit } from './room-visit'
import { RoomVolumeHint } from './RoomVolumeHint'
import type { PushedScreen as PushedScreenId } from './run-shell-store'
import { popScreen, pushed, pushScreen } from './run-shell-store'
import { AboutScreen } from './settings/AboutScreen'
import { AccountNameScreen } from './settings/AccountNameScreen'
import { AccountScreen } from './settings/AccountScreen'
import { AppearanceScreen } from './settings/AppearanceScreen'
import { BlockedSingersScreen } from './settings/BlockedSingersScreen'
import { DeleteAccountScreen } from './settings/DeleteAccountScreen'
import { DevicesScreen } from './settings/DevicesScreen'
import { KaraokeSettingsScreen } from './settings/KaraokeSettingsScreen'
import { MicrophoneScreen } from './settings/MicrophoneScreen'
import { RoomNoiseScreen } from './settings/RoomNoiseScreen'
import { SettingsScreen } from './settings/SettingsScreen'
import { StorageScreen } from './settings/StorageScreen'
import { ThisPhoneScreen } from './settings/ThisPhoneScreen'

export interface ShellScreensProps {
  /**
   * The developer screen, on a build that has one. NativeShell owns the lazy
   * import behind the build constant, so a store build passes nothing and
   * carries no chunk for it.
   */
  developer?: Component
  /**
   * The Long note exercise, on a build with the premium exercises. Passed in
   * for the same reason as `developer`: NativeShell owns the lazy import
   * behind `PREMIUM_EXERCISES`, so a store build carries no chunk for it.
   */
  longNote?: Component
  /** The Echo exercise, passed in as Long note is, for the same reason. */
  echo?: Component
  /** The Lip roll exercise, passed in as Long note is, for the same reason. */
  lipRoll?: Component
  /** The Ng slides exercise, passed in as Long note is, for the same reason. */
  ngSlides?: Component
  /** The Warm-up's path, passed in as Long note is, for the same reason. */
  warmUp?: Component
  /** Home note, the first Ear room, passed in as Long note is. */
  homeNote?: Component
  /** First note, the second Ear room, passed in as Long note is. */
  firstNote?: Component
  /** Leap, the third Ear room, passed in as Long note is. */
  leap?: Component
  /** Harmony, the fourth Ear room, passed in as Long note is. */
  harmony?: Component
  /**
   * Leagues, on a build with them (NATIVE_LEAGUES): passed in as Developer
   * is, so a store build carries no chunk for it.
   */
  leagues?: Component
  /** The Legend room, on a build with it (NATIVE_LEAGUES). */
  legend?: Component
  /**
   * Community and a shared result opened from it, on a build with them
   * (NATIVE_COMMUNITY): passed in as Developer is, so a store build carries
   * no chunk for either.
   */
  community?: Component
  communityResult?: Component
  /**
   * Voice Constellation, opened from the native Progress page, on a build
   * with it (NATIVE_PROGRESS): passed in as Developer is, so a store build
   * carries no chunk for it.
   */
  voiceConstellation?: Component
}

const TITLES: Record<Exclude<PushedScreenId, 'this-phone'>, string> = {
  settings: 'Settings',
  account: 'Account',
  'account-name': 'Name',
  devices: 'Devices',
  'blocked-singers': 'Blocked singers',
  'delete-account': 'Delete account',
  microphone: 'Microphone',
  'room-noise': 'Room noise',
  storage: 'Storage',
  appearance: 'Appearance',
  about: 'About',
  karaoke: 'Karaoke',
  'karaoke-studio': 'Karaoke studio',
  'long-note': 'Long note',
  echo: 'Echo',
  'lip-roll': 'Lip roll',
  'ng-slides': 'Ng slides',
  'warm-up': 'Warm-up',
  'home-note': 'Home note',
  'first-note': 'First note',
  leap: 'Leap',
  harmony: 'Harmony',
  developer: 'Developer',
  leagues: 'Leagues',
  legend: 'Legend',
  community: 'Community',
  'community-result': 'Shared result',
  'voice-constellation': 'Voice constellation',
}

/**
 * The screens that hand the focus to their title as they are pushed
 * (PushedScreen.tsx): Community's two and Voice Constellation, so a screen
 * reader starts at the top of what opened. The others keep the focus rules
 * they were built with.
 */
const TITLE_FOCUS: ReadonlySet<PushedScreenId> = new Set([
  'community',
  'community-result',
  'voice-constellation',
])

/**
 * The screens a swipe in from the left edge takes off, as Back does
 * (edge-swipe.ts). Voice Constellation for now: a page to look through and
 * leave, with nothing on it that drags sideways.
 */
const SWIPE_BACK: ReadonlySet<PushedScreenId> = new Set(['voice-constellation'])

/** The device's own screen is named for what it is: "This iPad" on an iPad. */
function titleOf(screen: PushedScreenId): string {
  return screen === 'this-phone' ? thisDevice() : TITLES[screen]
}

/**
 * A screen only some builds carry (passed in, behind its build constant),
 * or nothing on a build without it.
 */
function drawn(Screen: Component | undefined): JSX.Element {
  return Screen === undefined ? null : <Screen />
}

export function ShellScreens(props: ShellScreensProps): JSX.Element {
  const body = (screen: PushedScreenId): JSX.Element => {
    switch (screen) {
      case 'settings':
        return <SettingsScreen onPush={pushScreen} />
      case 'account':
        return <AccountScreen />
      case 'account-name':
        return <AccountNameScreen />
      case 'devices':
        return <DevicesScreen />
      case 'blocked-singers':
        return <BlockedSingersScreen />
      case 'delete-account':
        return <DeleteAccountScreen />
      case 'microphone':
        return <MicrophoneScreen />
      case 'room-noise':
        return <RoomNoiseScreen />
      case 'storage':
        return <StorageScreen />
      case 'this-phone':
        return <ThisPhoneScreen />
      case 'appearance':
        return <AppearanceScreen />
      case 'about':
        return <AboutScreen />
      case 'karaoke':
        return <KaraokeSettingsScreen />
      case 'karaoke-studio':
        return <KaraokeStudioScreen />
      case 'long-note':
        return drawn(props.longNote)
      case 'echo':
        return drawn(props.echo)
      case 'lip-roll':
        return drawn(props.lipRoll)
      case 'ng-slides':
        return drawn(props.ngSlides)
      case 'warm-up':
        return drawn(props.warmUp)
      case 'home-note':
        return drawn(props.homeNote)
      case 'first-note':
        return drawn(props.firstNote)
      case 'leap':
        return drawn(props.leap)
      case 'harmony':
        return drawn(props.harmony)
      case 'developer':
        return drawn(props.developer)
      case 'leagues':
        return drawn(props.leagues)
      case 'legend':
        return drawn(props.legend)
      case 'community':
        return drawn(props.community)
      case 'community-result':
        return drawn(props.communityResult)
      case 'voice-constellation':
        return drawn(props.voiceConstellation)
    }
  }

  return (
    <Show when={pushed()} keyed>
      {(screen) => (
        <PushedScreen
          title={titleOf(screen)}
          onBack={popScreen}
          bleed={isFullBleed(screen)}
          focusTitle={TITLE_FOCUS.has(screen)}
          swipeBack={SWIPE_BACK.has(screen)}
        >
          {/* One iOS volume from the door to the way out (room-visit.ts):
              before the room, so its first sound already has it. */}
          {isPremiumRoom(screen) ? <RoomVisit room={screen} /> : null}
          {body(screen)}
          {/* A premium room's notes play through the phone's volume: the
              hint asks for it to go up while it is down (RoomVolumeHint). */}
          {isPremiumRoom(screen) ? <RoomVolumeHint /> : null}
        </PushedScreen>
      )}
    </Show>
  )
}
