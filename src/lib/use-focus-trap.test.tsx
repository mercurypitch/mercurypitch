// Modal focus follows visible native disclosures rather than their hidden controls.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_KEYS, overheard, stopOverhearing } from '@/tests/utils/trap-keys'
import { isolateKeys } from './keyboard-isolation'
import { useFocusTrap } from './use-focus-trap'

function DisclosureDialog() {
  let dialog: HTMLDivElement | undefined
  useFocusTrap(() => dialog, { isOpen: () => true })
  return (
    <div ref={dialog} role="dialog" aria-modal="true" tabindex="-1">
      <button type="button">Close</button>
      <details data-testid="input-details">
        <summary>Input</summary>
        <input aria-label="Device name" />
        <details open>
          <summary>Advanced device</summary>
          <button type="button">Hidden refresh</button>
        </details>
      </details>
      <details data-testid="amp-details">
        <summary>Shape tone</summary>
        <button type="button">Reset amp</button>
      </details>
      <button type="button" disabled>
        Hear my input
      </button>
    </div>
  )
}

describe('useFocusTrap native disclosures', () => {
  afterEach(cleanup)

  it('cycles through visible summaries, excluding all collapsed descendants', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    const shape = screen.getByText('Shape tone')
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(shape).toHaveFocus()
    fireEvent.keyDown(shape, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('recomputes the last tab stop as a disclosure opens and closes', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    const details = screen.getByTestId('amp-details') as HTMLDetailsElement
    details.open = true
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    const reset = screen.getByRole('button', { name: 'Reset amp' })
    expect(reset).toHaveFocus()
    fireEvent.keyDown(reset, { key: 'Tab' })
    expect(close).toHaveFocus()
    details.open = false
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Shape tone')).toHaveFocus()
  })

  it('respects a summary explicitly removed from keyboard navigation', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    screen.getByText('Shape tone').tabIndex = -1
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Input')).toHaveFocus()
  })

  // A press on a dialog's words gives the focus to the dialog itself when it
  // can take it (tabindex -1). The dialog is not one of its own stops: from
  // there Shift+Tab went back to the page behind.
  it('keeps Tab and Shift+Tab inside when the dialog itself has the focus', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const dialog = screen.getByRole('dialog')

    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    const afterShiftTab = document.activeElement?.textContent
    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    const afterTab = document.activeElement?.textContent

    expect([afterShiftTab, afterTab]).toEqual(['Shape tone', 'Close'])
  })
})

// A trap that keeps the keys stops only a key sent from inside it. The focus
// can fall to the page without a press: a field blurs itself to put a phone's
// keyboard away, and a control that goes takes the focus with it. A Space sent
// from there would play the tab behind, so the trap takes that focus back.
function KeptDialog(props: { field: Accessor<boolean> }) {
  let dialog: HTMLDivElement | undefined
  useFocusTrap(() => dialog, {
    isOpen: () => true,
    isolateKeyboard: isolateKeys,
  })
  return (
    <div ref={dialog} role="dialog" aria-modal="true" tabindex="-1">
      <Show when={props.field()}>
        <input aria-label="Something else" />
      </Show>
      <button type="button">Next</button>
    </div>
  )
}

/** Sends the app's three keys from wherever the focus is. */
function pressAppKeys(): void {
  for (const key of APP_KEYS) {
    fireEvent.keyDown(document.activeElement ?? document.body, key)
  }
}

describe('useFocusTrap keeping the keys', () => {
  afterEach(() => {
    cleanup()
    stopOverhearing()
  })

  it('takes back the focus a field lets go of, so the keys after it stay inside', async () => {
    render(() => <KeptDialog field={() => true} />)
    await Promise.resolve()
    const field = screen.getByRole('textbox', { name: 'Something else' })
    expect(field).toHaveFocus()
    const heard = overheard()

    // What Enter does in the plan's typed lines.
    field.blur()
    await Promise.resolve()

    expect.soft(screen.getByRole('dialog')).toHaveFocus()
    pressAppKeys()
    expect(heard).toEqual([])
  })

  it('takes back the focus when the focused control goes', async () => {
    const [field, setField] = createSignal(true)
    render(() => <KeptDialog field={field} />)
    await Promise.resolve()
    expect(
      screen.getByRole('textbox', { name: 'Something else' }),
    ).toHaveFocus()
    const heard = overheard()

    setField(false)
    await Promise.resolve()

    expect.soft(screen.getByRole('dialog')).toHaveFocus()
    pressAppKeys()
    expect(heard).toEqual([])
  })

  it('leaves the focus where the dialog moves it next', async () => {
    render(() => <KeptDialog field={() => true} />)
    await Promise.resolve()
    const next = screen.getByRole('button', { name: 'Next' })

    screen.getByRole('textbox', { name: 'Something else' }).blur()
    next.focus()
    await Promise.resolve()

    expect(next).toHaveFocus()
  })

  it('leaves a trap that lets the keys through as it was', async () => {
    function OpenDialog() {
      let dialog: HTMLDivElement | undefined
      useFocusTrap(() => dialog, { isOpen: () => true })
      return (
        <div ref={dialog} role="dialog" aria-modal="true" tabindex="-1">
          <input aria-label="Name" />
        </div>
      )
    }
    render(() => <OpenDialog />)
    await Promise.resolve()

    screen.getByRole('textbox', { name: 'Name' }).blur()
    await Promise.resolve()

    expect(document.activeElement).toBe(document.body)
  })
})

/** Lets the traps' queued focus moves and the observers' deliveries run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

// Two traps open at once. A focus that falls belongs to the dialog that held
// it, never to the one beneath, nested or not.
describe('useFocusTrap keeping the keys under another dialog', () => {
  afterEach(cleanup)

  it('leaves a fallen focus to the dialog nested in it that held it', async () => {
    const [field, setField] = createSignal(true)

    function Nested() {
      let outer: HTMLDivElement | undefined
      let inner: HTMLDivElement | undefined
      useFocusTrap(() => outer, {
        isOpen: () => true,
        isolateKeyboard: isolateKeys,
      })
      useFocusTrap(() => inner, {
        isOpen: () => true,
        isolateKeyboard: isolateKeys,
      })
      return (
        <div
          ref={outer}
          role="dialog"
          aria-modal="true"
          aria-label="Outer"
          tabindex="-1"
        >
          <button type="button">Outer button</button>
          <div
            ref={inner}
            role="dialog"
            aria-modal="true"
            aria-label="Inner"
            tabindex="-1"
          >
            <Show when={field()}>
              <input aria-label="Inner field" />
            </Show>
          </div>
        </div>
      )
    }
    render(() => <Nested />)
    await settle()
    expect(screen.getByRole('textbox', { name: 'Inner field' })).toHaveFocus()

    setField(false)
    await settle()

    expect(screen.getByRole('dialog', { name: 'Inner' })).toHaveFocus()
  })

  it('leaves a focus that falls from a dialog over it alone, and takes it back once that one has gone', async () => {
    const [overOpen, setOverOpen] = createSignal(true)
    const [note, setNote] = createSignal(false)

    function Stacked() {
      let under: HTMLDivElement | undefined
      let over: HTMLDivElement | undefined
      useFocusTrap(() => under, {
        isOpen: () => true,
        isolateKeyboard: isolateKeys,
      })
      useFocusTrap(() => over, { isOpen: overOpen })
      return (
        <>
          <div
            ref={under}
            role="dialog"
            aria-modal="true"
            aria-label="Under"
            tabindex="-1"
          >
            <button type="button">Under button</button>
            <Show when={note()}>
              <p>Saved</p>
            </Show>
          </div>
          <Show when={overOpen()}>
            <div
              ref={over}
              role="dialog"
              aria-modal="true"
              aria-label="Over"
              tabindex="-1"
            >
              <input aria-label="Over field" />
            </div>
          </Show>
        </>
      )
    }
    render(() => <Stacked />)
    await settle()
    const field = screen.getByRole('textbox', { name: 'Over field' })
    expect(field).toHaveFocus()

    field.blur()
    setNote(true)
    await settle()
    expect.soft(document.activeElement).toBe(document.body)

    setOverOpen(false)
    setNote(false)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Under' })).toHaveFocus()
  })
})
