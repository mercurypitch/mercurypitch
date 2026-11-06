// ============================================================
// AdminFeaturesPage — the owner's switches for experimental features, per environment
// ============================================================
//
// THESIS: the owner turns a feature that is still being built on or off for
// everyone on this site, or hands it back to the build's default, and reads
// plainly what that does and whom it reaches.
// FIRST VIEWPORT: which environment a switch made here reaches, this
// build's default, then each feature with what it is, what visitors get,
// its switch and when it last changed.
// FORM: one card per feature, its three settings as one group of buttons,
// the pressed one the switch as stored. Saved at once on the dev site; in
// production the page asks first, since every visitor gets the change.
//
// The switches are the db-worker's (feature-switches/feature-switch-client.ts
// for the calls, src/lib/experimental-features.ts for their shapes). A page
// already open keeps what it started with, so the page says the change
// reaches visitors on their next page load, within about 30 s. Focus stays
// where the hand is: the three buttons stay mounted as the pressed one
// moves, and each names its feature in words a screen reader hears.

import type { JSX } from 'solid-js'
import { createMemo, createUniqueId, For, Match, onMount, Show, Switch, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PowerSymbol, RotateCcw } from '@/components/icons'
import { useConfirm } from '@/lib/use-confirm'
import { experimentalFeaturesBuildDefault } from '@/stores/experimental-features-store'
import type { AdminEnvironment } from './admin-environment'
import styles from './AdminFeaturesPage.module.css'
import type { FeatureSwitchState } from './feature-switches/feature-switch-client'
import { featureSwitchEnvironment } from './feature-switches/feature-switch-client'
import type { SwitchSetting } from './feature-switches/feature-switch-copy'
import { aboutFeature, asSentence, environmentSentence, lastChanged, onOff, REACHES_VISITORS, reasonLine, SETTING_WORDS, settingName, settingOf, SWITCH_SETTINGS, switchQuestion, visitorsGet, } from './feature-switches/feature-switch-copy'
import type { FeatureSwitchesController, SaveOutcome, } from './feature-switches/useFeatureSwitches'
import { useFeatureSwitches } from './feature-switches/useFeatureSwitches'

export interface AdminFeaturesPageProps {
  /** The studio's verified admin key, sent with every read and save. */
  adminKey: string
  /** Lock the studio to ask for the key again: offered when the API refuses this one. */
  onChangeKey?: () => void
  /** The environment the switches belong to; the one behind this page's API by default. */
  environment?: AdminEnvironment
  /** The default a feature with no switch falls back to here; this page's own by default. */
  buildDefault?: boolean
}

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** The names in list order, equal while the API lists the same features: the cards stay mounted across reads. */
function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

const outcomeText = (outcome: SaveOutcome): string =>
  outcome.kind === 'saving' ? 'Saving…' : outcome.message

const keyRefused = (outcome: SaveOutcome): boolean =>
  outcome.kind === 'failed' && outcome.error.kind === 'forbidden'

export function AdminFeaturesPage(props: AdminFeaturesPageProps): JSX.Element {
  const environment = createMemo(
    () => props.environment ?? featureSwitchEnvironment(),
  )
  // What visitors in the environment this console reaches fall back to:
  // the production build's default is off, and the dev site's and every
  // PR preview's is on (tools/experimental-features.ts). Not this console's
  // own bundle, which can be a dev build pointed at production. Only an
  // address the console cannot place falls back to its own build's.
  const buildDefault = (): boolean => {
    if (props.buildDefault !== undefined) return props.buildDefault
    const kind = environment().kind
    if (kind === 'production') return false
    if (kind === 'development' || kind === 'preview') return true
    return experimentalFeaturesBuildDefault()
  }
  const switches = useFeatureSwitches({
    adminKey: () => props.adminKey,
    buildDefault,
  })
  const names = createMemo(
    () => switches.rows()?.map((row) => row.name) ?? [],
    [],
    { equals: sameNames },
  )
  const confirm = useConfirm()

  /**
   * Switch feature `name` to `setting`: at once in development, after the
   * question anywhere else, an address the console cannot place included.
   * The setting already stored, or a save in flight, does nothing.
   */
  const choose = (name: string, setting: SwitchSetting): void => {
    const row = switches.rowOf(name)
    if (row === undefined || switches.saving(name)) return
    if (settingOf(row.enabled) === setting) return
    if (environment().kind === 'development') {
      void switches.save(name, setting)
      return
    }
    confirm.request({
      ...switchQuestion(
        aboutFeature(name),
        setting,
        buildDefault(),
        environment(),
      ),
      confirmIcon: <PowerSymbol size={16} />,
      onConfirm: () => void switches.save(name, setting),
    })
  }

  onMount(() => {
    void switches.read()
  })

  return (
    <div class={styles.page} data-testid="admin-features">
      <div class={styles.intro}>
        <p>
          A switch is saved at once and holds for every visitor to this site.{' '}
          {REACHES_VISITORS} The app reads the switches once, as it starts, and
          the answer may be kept for up to 30 seconds, so a page already open
          keeps what it started with.
        </p>
        <div class={styles.statusRow}>
          <span
            class={styles.environment}
            data-tone={environment().kind === 'production' ? 'prod' : 'other'}
            title="The API environment every switch here is saved to"
          >
            {environment().label}
          </span>
          <span class={styles.badge}>
            Build default here: {onOff(buildDefault())}
          </span>
        </div>
        <p>{environmentSentence(environment())}</p>
        <ReadLine switches={switches} />
        <Show when={switches.keyRejected()}>
          <div class={styles.keyNotice}>
            <p>
              The admin key was not accepted, so this page cannot read or change
              the switches. Change admin key to unlock the studio again.
            </p>
            <Show when={props.onChangeKey !== undefined}>
              <button
                type="button"
                class={styles.action}
                onClick={() => props.onChangeKey?.()}
              >
                Change admin key
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <section class={styles.section} aria-labelledby="admin-features-list">
        <h3 id="admin-features-list" class={styles.sectionTitle}>
          Switches in this environment
        </h3>
        <Switch>
          <Match
            when={switches.rows() === null && switches.readError() === null}
          >
            <p class={styles.waiting} role="status">
              <span class={styles.spinner} aria-hidden="true" />
              Reading the switches…
            </p>
          </Match>
          <Match when={switches.rows()?.length === 0}>
            <p class={styles.sectionNote}>
              The API lists no experimental features: there is nothing to
              switch.
            </p>
          </Match>
        </Switch>
        <ul class={styles.features} aria-labelledby="admin-features-list">
          <For each={names()}>
            {(name) => (
              <Show when={switches.rowOf(name)}>
                {(row) => (
                  <FeatureCard
                    row={row()}
                    buildDefault={buildDefault()}
                    switches={switches}
                    onChoose={choose}
                    onChangeKey={props.onChangeKey}
                  />
                )}
              </Show>
            )}
          </For>
        </ul>
      </section>

      <section class={styles.section} aria-labelledby="admin-features-notes">
        <h3 id="admin-features-notes" class={styles.sectionTitle}>
          Good to know
        </h3>
        <ul class={styles.notes}>
          <li>
            A browser keeps the last switches it heard: a feature switched on
            stays for a visitor whose next read is slow or offline, and only a
            new answer from this site changes it.
          </li>
          <li>
            Switched on, a feature shows in the app. Its own page stays out of
            search and the sitemap until it graduates in code.
          </li>
          <li>
            The phone app never reads these switches. It keeps its own build's
            default: off.
          </li>
        </ul>
      </section>

      {/* Saves are announced here once; the words also stay under the
          feature's switch. A new object per message, so a repeat is
          announced again. */}
      <div class={styles.srOnly} role="status" aria-live="polite">
        <Show when={switches.announcement()} keyed>
          {(said) => <span>{said.text}</span>}
        </Show>
      </div>
      <ConfirmDialog
        open={confirm.pending() !== null}
        title={confirm.pending()?.title ?? ''}
        message={confirm.pending()?.message ?? ''}
        confirmLabel={confirm.pending()?.confirmLabel}
        confirmIcon={confirm.pending()?.confirmIcon}
        tone="primary"
        onConfirm={confirm.accept}
        onCancel={confirm.cancel}
      />
    </div>
  )
}

/**
 * When the list was read, or why it could not be, with a way to read it
 * again. Nothing until the first read ends: the list says it is reading.
 */
function ReadLine(props: { switches: FeatureSwitchesController }): JSX.Element {
  const settled = (): boolean =>
    props.switches.readError() !== null || props.switches.readAt() !== null
  return (
    <Show when={settled()}>
      <div class={styles.statusRow}>
        <span class={styles.meta}>
          <Show
            when={props.switches.readError()}
            fallback={
              <Show when={props.switches.readAt()}>
                {(at) => <>Switches read at {TIME.format(at())}</>}
              </Show>
            }
          >
            {(error) => (
              <span class={styles.problem}>
                The switches could not be read. {asSentence(error().message)}
              </span>
            )}
          </Show>
        </span>
        <button
          type="button"
          class={styles.action}
          onClick={() => {
            if (!props.switches.reading()) void props.switches.read()
          }}
          aria-disabled={props.switches.reading() ? 'true' : undefined}
        >
          <RotateCcw size={14} />
          {props.switches.reading() ? 'Reading…' : 'Read again'}
        </button>
      </div>
    </Show>
  )
}

/** One feature: what it is, what visitors here get and why, its switch, and what the last save said. */
function FeatureCard(props: {
  row: FeatureSwitchState
  buildDefault: boolean
  switches: FeatureSwitchesController
  onChoose: (name: string, setting: SwitchSetting) => void
  onChangeKey?: () => void
}): JSX.Element {
  const heading = createUniqueId()
  const label = createUniqueId()
  const about = () => aboutFeature(props.row.name)
  const on = () => visitorsGet(props.row.enabled, props.buildDefault)
  const busy = () => props.switches.saving(props.row.name)
  const outcome = () => props.switches.outcome(props.row.name)
  return (
    <li
      class={styles.feature}
      aria-labelledby={heading}
      data-feature={props.row.name}
    >
      <div class={styles.featureHead}>
        <h4 id={heading} class={styles.featureTitle}>
          {about().title}
        </h4>
        <span class={styles.mark} data-on={on() ? 'true' : 'false'}>
          <PowerSymbol size={14} />
          {on() ? 'On' : 'Off'} for visitors here
        </span>
      </div>
      <p class={styles.about}>{about().about}</p>
      <dl class={styles.facts}>
        <div class={styles.fact}>
          <dt>Where</dt>
          <dd>{about().where}</dd>
        </div>
        <div class={styles.fact}>
          <dt>Switch</dt>
          <dd>{reasonLine(props.row.enabled, props.buildDefault)}</dd>
        </div>
        <div class={styles.fact}>
          <dt>Last changed</dt>
          <dd>{lastChanged(props.row.updatedAt)}</dd>
        </div>
      </dl>
      <div
        class={styles.switch}
        role="group"
        aria-labelledby={label}
        aria-busy={busy() ? 'true' : undefined}
      >
        <span id={label} class={styles.label}>
          {about().title} in this environment
        </span>
        <div class={styles.choices}>
          <For each={SWITCH_SETTINGS}>
            {(setting) => (
              <button
                type="button"
                class={styles.choice}
                aria-label={settingName(
                  about().title,
                  setting,
                  props.buildDefault,
                )}
                aria-pressed={settingOf(props.row.enabled) === setting}
                aria-disabled={busy() ? 'true' : undefined}
                onClick={() => props.onChoose(props.row.name, setting)}
              >
                <span>{SETTING_WORDS[setting]}</span>
                <Show when={setting === 'default'}>
                  <small>{onOff(props.buildDefault)} here</small>
                </Show>
              </button>
            )}
          </For>
        </div>
        <Show when={outcome()}>
          {(said) => (
            <p class={styles.outcome} data-kind={said().kind}>
              {outcomeText(said())}
              <Show
                when={keyRefused(said()) && props.onChangeKey !== undefined}
              >
                <button
                  type="button"
                  class={styles.action}
                  onClick={() => props.onChangeKey?.()}
                >
                  Change admin key
                </button>
              </Show>
            </p>
          )}
        </Show>
      </div>
    </li>
  )
}
