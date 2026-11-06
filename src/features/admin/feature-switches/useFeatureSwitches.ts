// ============================================================
// useFeatureSwitches — the Features page's switches: read, saved, and what each save said
// ============================================================
//
// Holds the list as the API last answered it, and every save in flight and
// how it ended. A save puts the row the API answered in place at once, then
// reads the whole list again, so the page shows what is stored rather than
// its own guess. A read that answers after a newer one was asked is dropped,
// and nothing lands once the page is gone. A refused key on any call raises
// `keyRejected` until a call succeeds again. The shape is the Lessons page's
// (lessons/useLessonState.ts), so the two read alike.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { FeatureApiError, FeatureSwitchState, } from './feature-switch-client'
import { fetchFeatureSwitches, saveFeatureSwitch, } from './feature-switch-client'
import type { SwitchSetting } from './feature-switch-copy'
import { aboutFeature, enabledFor, failedMessage, savedMessage, } from './feature-switch-copy'

export type SaveOutcome =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly message: string }
  | {
      readonly kind: 'failed'
      readonly message: string
      readonly error: FeatureApiError
    }

/** One message for the live region; a new object each time, so a repeat is still announced. */
export interface Announcement {
  readonly text: string
}

export interface FeatureSwitchesController {
  /** The list as last read; null until the first read lands. */
  readonly rows: Accessor<readonly FeatureSwitchState[] | null>
  /** Feature `name`'s row, as last read or saved. */
  readonly rowOf: (name: string) => FeatureSwitchState | undefined
  /** Why the last read failed; null once one succeeds. */
  readonly readError: Accessor<FeatureApiError | null>
  readonly reading: Accessor<boolean>
  readonly readAt: Accessor<Date | null>
  readonly read: () => Promise<void>
  readonly keyRejected: Accessor<boolean>
  readonly outcome: (name: string) => SaveOutcome | undefined
  readonly saving: (name: string) => boolean
  /** Switch feature `name` to `setting`; true once it is stored. */
  readonly save: (name: string, setting: SwitchSetting) => Promise<boolean>
  readonly announcement: Accessor<Announcement | null>
}

export interface FeatureSwitchesOptions {
  /** Read at each call, so a changed key is the one sent. */
  readonly adminKey: () => string
  /** The default a feature with no switch falls back to here, for what a save says. */
  readonly buildDefault: () => boolean
}

/** The list with `row` in place of the row of its name. */
export function withSavedRow(
  rows: readonly FeatureSwitchState[],
  row: FeatureSwitchState,
): FeatureSwitchState[] {
  return rows.map((each) => (each.name === row.name ? row : each))
}

export function useFeatureSwitches(
  options: FeatureSwitchesOptions,
): FeatureSwitchesController {
  const [rows, setRows] = createSignal<readonly FeatureSwitchState[] | null>(
    null,
  )
  const [readError, setReadError] = createSignal<FeatureApiError | null>(null)
  const [reading, setReading] = createSignal(false)
  const [readAt, setReadAt] = createSignal<Date | null>(null)
  const [outcomes, setOutcomes] = createSignal<
    ReadonlyMap<string, SaveOutcome>
  >(new Map())
  const [keyRejected, setKeyRejected] = createSignal(false)
  const [announcement, setAnnouncement] = createSignal<Announcement | null>(
    null,
  )
  let alive = true
  let readRun = 0
  onCleanup(() => {
    alive = false
  })

  /** A call's answer says whether the key is good. */
  const noteKey = (error: FeatureApiError | null): void => {
    if (error === null) setKeyRejected(false)
    else if (error.kind === 'forbidden') setKeyRejected(true)
  }

  const setOutcome = (name: string, outcome: SaveOutcome): void => {
    setOutcomes((prev) => new Map(prev).set(name, outcome))
  }

  const read = async (): Promise<void> => {
    const run = ++readRun
    const adminKey = options.adminKey()
    setReading(true)
    const result = await fetchFeatureSwitches(adminKey)
    if (!alive || run !== readRun) return
    setReading(false)
    noteKey(result.ok ? null : result.error)
    if (!result.ok) {
      setReadError(result.error)
      return
    }
    setRows(result.value)
    setReadError(null)
    setReadAt(new Date())
  }

  const saving = (name: string): boolean =>
    outcomes().get(name)?.kind === 'saving'

  const save = async (
    name: string,
    setting: SwitchSetting,
  ): Promise<boolean> => {
    if (saving(name)) return false
    const adminKey = options.adminKey()
    const buildDefault = options.buildDefault()
    const { title } = aboutFeature(name)
    setOutcome(name, { kind: 'saving' })
    const result = await saveFeatureSwitch(adminKey, name, enabledFor(setting))
    if (!alive) return false
    noteKey(result.ok ? null : result.error)
    if (!result.ok) {
      const message = failedMessage(title, result.error)
      setOutcome(name, { kind: 'failed', message, error: result.error })
      setAnnouncement({ text: message })
      return false
    }
    const { row, changed } = result.value
    const message = savedMessage(title, setting, changed, buildDefault)
    setRows((prev) => (prev === null ? prev : withSavedRow(prev, row)))
    setOutcome(name, { kind: 'saved', message })
    setAnnouncement({ text: message })
    void read()
    return true
  }

  return {
    rows,
    rowOf: (name) => rows()?.find((row) => row.name === name),
    readError,
    reading,
    readAt,
    read,
    keyRejected,
    outcome: (name) => outcomes().get(name),
    saving,
    save,
    announcement,
  }
}
