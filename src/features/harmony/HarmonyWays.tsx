// ============================================================
// How to sing it: taking turns, or together in headphones
// ============================================================
//
// The first chip in the bar names the way ("Turns", "Together"); a tap
// opens a sheet with the two, each saying what it is, in the level
// control's look (LevelControl.module.css). Taking turns: Merc sings his
// line, then the singer sings theirs, on the phone's speaker. Together:
// the singer sings while he does, headphones on, so the mic hears only
// them. The room keeps the choice for next time (harmony-store.ts), as the
// sheet says (the owner's call of 1 Nov 2026, the room's mock-ups).

import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckSmall, ChevronDown, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import styles from '@/components/room-kit/LevelControl.module.css'
import type { HarmonyWayId } from '@/stores/harmony-store'
import { harmonyWay, setHarmonyWay } from '@/stores/harmony-store'

interface WayOption {
  readonly id: HarmonyWayId
  /** The chip's word. */
  readonly chip: string
  readonly name: string
  readonly line: string
}

const WAYS: readonly WayOption[] = [
  {
    id: 'turns',
    chip: 'Turns',
    name: 'Take turns',
    line: "Merc sings his line, then you sing yours. On the phone's speaker.",
  },
  {
    id: 'together',
    chip: 'Together',
    name: 'Together',
    line: 'You sing while he does. Headphones on, so the mic hears only you.',
  },
]

const wayOf = (id: HarmonyWayId): WayOption =>
  WAYS.find((way) => way.id === id) ?? WAYS[0]

/** The chip, and the sheet it opens. */
export function HarmonyWays(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  const pick = (id: HarmonyWayId): void => {
    setHarmonyWay(id)
    setOpen(false)
  }
  const chipSays = (): string =>
    harmonyWay() === 'together' ? 'singing together' : 'taking turns'
  return (
    <span class={styles.control}>
      <button
        type="button"
        class={styles.pill}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`How to sing it: ${chipSays()}`}
        data-testid="harmony-ways"
      >
        {wayOf(harmonyWay()).chip}
        <ChevronDown size={12} />
      </button>
      <Sheet
        isOpen={open()}
        close={() => setOpen(false)}
        ariaLabel="How to sing it"
      >
        <div class={styles.head}>
          <div>
            <h2 class={styles.title}>How to sing it</h2>
            <p class={styles.sub}>The room keeps your choice for next time.</p>
          </div>
          <button
            type="button"
            class={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X />
          </button>
        </div>
        <div class={styles.levels} role="group" aria-label="Ways">
          <For each={WAYS}>
            {(way) => (
              <button
                type="button"
                class={styles.level}
                aria-pressed={harmonyWay() === way.id}
                onClick={() => pick(way.id)}
                data-testid="harmony-ways-option"
                data-way={way.id}
              >
                <span class={styles.levelText}>
                  <span class={styles.levelName}>{way.name}</span>
                  <span class={styles.levelLine}>{way.line}</span>
                </span>
                <span class={styles.mark} aria-hidden="true">
                  <Show when={harmonyWay() === way.id}>
                    <CheckSmall size={18} />
                  </Show>
                </span>
              </button>
            )}
          </For>
        </div>
      </Sheet>
    </span>
  )
}
