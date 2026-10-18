// ============================================================
// NativeOnboarding: the native app's own onboarding, over the Sing room
// ============================================================
//
// One full-screen layer (onboarding-layer.ts says when it is up) on a dark
// stage, whatever the theme, like the premium rooms. Not now sits at its
// top right from the first frame to the last, and it is the only way out
// besides the beats' own last button (S7b E1, the web's settled choice).
//
// Its beats, in S7b's order, as each lands. Today the first note (beats 2
// and 3, useFirstNote.ts); its Start singing lands in the Sing room, live.
//
// NativeShell loads this file lazily, and only on a build with the
// onboarding (NATIVE_ONBOARDING), so the store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, on, onMount } from 'solid-js'
import { MercView } from '@/components/room-kit/MercView'
import surface from '@/components/room-kit/RoomSurface.module.css'
import { onboardingShown } from '../shell/run-shell-store'
import { FirstNoteView } from './FirstNoteView'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY } from './onboarding-copy'
import { leaveOnboarding } from './onboarding-layer'
import { useFirstNote } from './useFirstNote'

export function NativeOnboarding(): JSX.Element {
  const leaving = () => !onboardingShown()
  const note = useFirstNote()

  // Leaving shuts the mic at once; the layer only fades after.
  createEffect(
    on(
      leaving,
      (gone) => {
        if (gone) note.leave()
      },
      { defer: true },
    ),
  )

  let root: HTMLDivElement | undefined
  // Into the dialog, for a screen reader; nothing is drawn for it.
  onMount(() => root?.focus({ preventScroll: true }))

  return (
    <div
      ref={root}
      class={`${styles.layer} ${surface.surface} mp-dark-stage`}
      classList={{ [styles.leaving]: leaving() }}
      role="dialog"
      aria-modal="true"
      aria-label={ONBOARDING_COPY.title}
      tabIndex={-1}
      inert={leaving()}
      data-testid="native-onboarding"
      data-beat="first-note"
      data-leaving={leaving() ? 'on' : 'off'}
    >
      <div class={styles.top}>
        <button
          type="button"
          class={styles.notNow}
          onClick={() => leaveOnboarding('not-now')}
          data-testid="onboarding-not-now"
        >
          {ONBOARDING_COPY.notNow}
        </button>
      </div>
      <FirstNoteView
        controller={note}
        onFinish={() => leaveOnboarding('finished')}
        merc={
          <MercView
            state={note.mercState}
            voice={note.mercVoice}
            still={note.still}
            class={styles.mercView}
            testId="onboarding-merc"
          />
        }
      />
    </div>
  )
}
