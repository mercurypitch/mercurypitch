// ============================================================
// Voice Mirror — card options sheet.
//
// The results screen is a reward moment, so it shows one thing to do:
// share the card. Everything that only *tunes* the card — trace, format,
// what rides on the twin — plus the lesser actions live here, behind a
// single overflow control.
//
// Bottom sheet on a phone, right-hand drawer from tablet up. Same markup,
// same focus trap; only the transform differs.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { IconClose, IconCopy, IconFormat, IconGalaxy, IconStats, IconTrace, } from './icons'

/** One switchable card setting. `hint` explains what changes on the export —
 *  these are choices about an image the person is about to post, so the
 *  consequence belongs on screen rather than in a title attribute. */
interface ToggleRow {
  label: string
  hint: string
  on: boolean
  icon: Component<{ size?: number }>
  onToggle: () => void
}

export interface CardOptionsSheetProps {
  isOpen: boolean
  onClose: () => void
  /** Twin-only rows stay out of the sheet until the twin exists. */
  twinReady: boolean
  includeTrace: boolean
  onToggleTrace: () => void
  cardFormat: 'story' | 'square'
  onToggleFormat: () => void
  twinTrace: boolean
  onToggleTwinTrace: () => void
  twinData: boolean
  onToggleTwinData: () => void
  /** Clipboard image support is browser-dependent; hide the row when absent. */
  canCopy: boolean
  onCopy: () => void
  onCosmic: () => void
}

export const CardOptionsSheet: Component<CardOptionsSheetProps> = (props) => {
  let panelRef: HTMLDivElement | undefined

  useFocusTrap(() => panelRef, {
    isOpen: () => props.isOpen,
    onClose: () => props.onClose(),
  })

  const rows = (): ToggleRow[] => {
    const base: ToggleRow[] = [
      {
        label: 'Pitch trace',
        hint: 'Draw the glide of your voice across the card.',
        on: props.includeTrace,
        icon: IconTrace,
        onToggle: () => props.onToggleTrace(),
      },
      {
        label: 'Story format',
        hint: 'Export tall 9:16 for stories instead of square.',
        on: props.cardFormat === 'story',
        icon: IconFormat,
        onToggle: () => props.onToggleFormat(),
      },
    ]
    if (!props.twinReady) return base
    return [
      ...base,
      {
        label: 'Trace on twin',
        hint: 'Off keeps your twin’s face clean.',
        on: props.twinTrace,
        icon: IconTrace,
        onToggle: () => props.onToggleTwinTrace(),
      },
      {
        label: 'Data on twin',
        hint: 'Show range, accuracy and steadiness instead of the caption.',
        on: props.twinData,
        icon: IconStats,
        onToggle: () => props.onToggleTwinData(),
      },
    ]
  }

  return (
    <Show when={props.isOpen}>
      {/* The backdrop is a sibling, not a parent: a click target that closes
          without swallowing taps meant for the panel. */}
      <div
        class="mirror-sheet-scrim"
        onClick={() => props.onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        class="mirror-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mirror-sheet-title"
      >
        <div class="mirror-sheet-grip" aria-hidden="true" />
        <header class="mirror-sheet-head">
          <h2 id="mirror-sheet-title">Card options</h2>
          <button
            type="button"
            class="mirror-sheet-close"
            onClick={() => props.onClose()}
            aria-label="Close card options"
          >
            <IconClose size={18} />
          </button>
        </header>

        <ul class="mirror-sheet-list">
          <For each={rows()}>
            {(row) => (
              <li>
                <button
                  type="button"
                  class="mirror-sheet-row"
                  aria-pressed={row.on}
                  onClick={() => row.onToggle()}
                >
                  <span class="mirror-sheet-rowicon">
                    <row.icon size={18} />
                  </span>
                  <span class="mirror-sheet-rowtext">
                    <span class="mirror-sheet-rowlabel">{row.label}</span>
                    <span class="mirror-sheet-rowhint">{row.hint}</span>
                  </span>
                  {/* Presentational: the button's aria-pressed already
                      carries the state to assistive tech. */}
                  <span
                    class="mirror-sheet-switch"
                    classList={{ on: row.on }}
                    aria-hidden="true"
                  >
                    <span class="mirror-sheet-knob" />
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>

        <div class="mirror-sheet-more">
          <Show when={props.canCopy}>
            <button
              type="button"
              class="mirror-sheet-action"
              onClick={() => {
                props.onCopy()
                props.onClose()
              }}
            >
              <IconCopy size={18} />
              Copy card image
            </button>
          </Show>
          <button
            type="button"
            class="mirror-sheet-action"
            onClick={() => {
              props.onCosmic()
              props.onClose()
            }}
          >
            <IconGalaxy size={18} />
            Sing the Universe
          </button>
        </div>
      </div>
    </Show>
  )
}
