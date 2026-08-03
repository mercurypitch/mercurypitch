// ── JamGuideVocal ─────────────────────────────────────────────────────
// How loud the original singer is, in YOUR ears only.
//
// This is deliberately not room state, and it is the one setting in the
// room that should not be: how much guide you need to learn a song is
// about you, not about what the room is doing. Someone who knows the
// track wants it off; someone hearing it for the first time wants it up.
// Every peer has its own audio element, so per-person costs nothing.
//
// The control is PillControl -- the same capsule the karaoke stage uses
// for its "sing" pill. Tap toggles, a vertical drag sets the level, and
// the track slides out only while you are touching it. That last part is
// why it is safe to float this over the room on a phone: at rest it is a
// button, not a panel.
//
// It used to be a horizontal slider that expanded on hover, which on a
// phone was permanently expanded (no hover to collapse it), permanently
// wide, and sat across whatever was behind it.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { PillControl } from '@/components/mobile/PillControl'
import styles from './JamGuideVocal.module.css'

interface JamGuideVocalProps {
  volume: () => number
  onVolume: (v: number) => void
}

/**
 * Where an un-mute lands you.
 *
 * Half, not full: the guide is meant to sit under your own voice, and
 * coming back at whatever it was before means the first thing an un-mute
 * does can be a shout.
 */
const DEFAULT_LEVEL = 0.5

/** The guide singing: a microphone with its sound coming off it. */
const GuideOnIcon: Component = () => (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </svg>
)

/** The same microphone, struck through. Muted is a state you should be
    able to read at a glance and from across a table. */
const GuideOffIcon: Component = () => (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
)

export const JamGuideVocal: Component<JamGuideVocalProps> = (props) => {
  const muted = () => props.volume() <= 0

  return (
    <PillControl
      class={styles.pill}
      level={props.volume()}
      off={muted()}
      // A tap is the whole interaction most of the time -- on or off. The
      // level is there for the times it is not.
      onTap={() => props.onVolume(muted() ? DEFAULT_LEVEL : 0)}
      onLevel={(v) => props.onVolume(v)}
      title={
        muted()
          ? 'Guide vocal is off. Tap to bring the original singer in — only you hear this.'
          : 'Guide vocal is on, and only you hear it. Tap to mute, drag up or down to set the level.'
      }
      ariaLabel="Guide vocal (tap to toggle, drag to set the level)"
    >
      <Show when={muted()} fallback={<GuideOnIcon />}>
        <GuideOffIcon />
      </Show>
    </PillControl>
  )
}
