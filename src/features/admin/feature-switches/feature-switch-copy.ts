// ============================================================
// Feature switch copy — what each experimental feature is, where it stands here, and what a switch did
// ============================================================
//
// The words the Content Studio's Features page prints, so the page and its
// tests read one set: what each feature on the list is, its state in this
// environment (switched on, switched off, or on the build's default and
// what that default is here), what the page asks before it switches one in
// production, and what a save said. Admin copy, in American English, as the
// Lessons page's is. No DOM.
//
// A switch is per environment: each has its own db-worker and data, so what
// is set on the dev site never reaches mercurypitch.com. Visitors read the
// switches once, as the app starts, and the public read may be cached for
// 30 s (workers/db-worker/src/experimental-feature-routes.ts), so a change
// reaches them on their next page load, within about 30 s. The phone app
// never reads them: it keeps its build's default (apps/mercurypitch).

import { PROD_DOMAIN } from '@/lib/defaults'
import type { ExperimentalFeature } from '@/lib/experimental-features'
import { isExperimentalFeature } from '@/lib/experimental-features'
import type { AdminEnvironment } from '../admin-environment'
import type { FeatureApiError } from './feature-switch-client'

/** What the owner reads about a feature beside its switch. */
export interface FeatureAbout {
  /** Its name, as the app shows it. */
  readonly title: string
  /** What it is. */
  readonly about: string
  /** Where a visitor finds it while it is on. */
  readonly where: string
  /** What switching it off does to what visitors made with it; empty when unknown. */
  readonly whenOff: string
}

/** Every feature on the list, described. Keyed by the list, so a feature added without its words does not compile. */
export const FEATURE_ABOUT: Readonly<
  Record<ExperimentalFeature, FeatureAbout>
> = {
  studio: {
    title: 'Studio',
    about:
      "A song workspace: bring in recorded takes and audio files, arrange them on tracks, record over them, then mix and export the song. Its projects are kept only in the singer's browser.",
    where: 'The Studio tab, and its address /studio-night.',
    whenOff:
      "Switched off, the tab and its address go; the songs stay in each singer's browser, there again once it is back on.",
  },
}

/** What the page says about a feature: its own words, or a note for one this build does not know. */
export function aboutFeature(name: string): FeatureAbout {
  if (isExperimentalFeature(name)) return FEATURE_ABOUT[name]
  // Listed by a worker deployed ahead of this build.
  return {
    title: name,
    about:
      'This build of the app does not know this feature yet, so it has no words for it. Its switch still reaches every build that does.',
    where: 'Nowhere in this build.',
    whenOff: '',
  }
}

/** What a feature's switch is set to: one of the three a save can send. */
export type SwitchSetting = 'on' | 'off' | 'default'

export const onOff = (on: boolean): string => (on ? 'on' : 'off')

export const SWITCH_SETTINGS: readonly SwitchSetting[] = [
  'on',
  'off',
  'default',
]

/** A setting's button words. */
export const SETTING_WORDS: Readonly<Record<SwitchSetting, string>> = {
  on: 'On',
  off: 'Off',
  default: 'Build default',
}

/**
 * A setting's button as a screen reader names it, with its feature, and,
 * for the default, what that default is here: "Studio: Build default, off
 * here". It holds the button's own words, so speaking them finds it.
 */
export function settingName(
  title: string,
  setting: SwitchSetting,
  buildDefault: boolean,
): string {
  const words = `${title}: ${SETTING_WORDS[setting]}`
  return setting === 'default' ? `${words}, ${onOff(buildDefault)} here` : words
}

export function settingOf(enabled: boolean | null): SwitchSetting {
  if (enabled === null) return 'default'
  return enabled ? 'on' : 'off'
}

/** The value a save sends for a setting: true, false, or null for the build's default. */
export function enabledFor(setting: SwitchSetting): boolean | null {
  if (setting === 'default') return null
  return setting === 'on'
}

/** Whether visitors here get the feature: its switch where one is set, the build's default otherwise. */
export function visitorsGet(
  enabled: boolean | null,
  buildDefault: boolean,
): boolean {
  return enabled ?? buildDefault
}

const FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * "Oct 20, 2:02 PM", in the viewer's time zone, as the Lessons page writes
 * a change's time; the text as given if it is not a time.
 */
export function switchTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  // No-break spaces hold "Oct 20" and "2:02 PM" together on a narrow line.
  return FORMAT.format(at)
    .replace(/\s/g, '\u00a0')
    .replace(/,\u00a0/g, ', ')
}

/** Where a feature stands here and why: "Switched on here", or "No switch set: the build's default, off here". */
export function reasonLine(
  enabled: boolean | null,
  buildDefault: boolean,
): string {
  if (enabled === null) {
    return `No switch set: the build's default, ${onOff(buildDefault)} here`
  }
  return `Switched ${onOff(enabled)} here`
}

/** When the switch last changed, as its fact line says it. */
export function lastChanged(updatedAt: string | null): string {
  return updatedAt === null ? 'No switch is set here' : switchTime(updatedAt)
}

/** What a switch on does for visitors, in the words the page repeats. */
export const REACHES_VISITORS =
  'Visitors get it on their next page load, within about 30 s.'

const CHANGE_REACHES_VISITORS =
  'Visitors get the change on their next page load, within about 30 s.'

/** What the page says once a save landed. */
export function savedMessage(
  title: string,
  setting: SwitchSetting,
  changed: boolean,
  buildDefault: boolean,
): string {
  if (!changed) {
    return setting === 'default'
      ? `${title} was already on the build's default here, so nothing changed.`
      : `${title} was already switched ${setting} here, so nothing changed.`
  }
  if (setting === 'on') {
    return `${title} is switched on here. ${REACHES_VISITORS}`
  }
  if (setting === 'off') {
    return `${title} is switched off here. ${CHANGE_REACHES_VISITORS}`
  }
  return `${title} is back on the build's default here: ${onOff(buildDefault)}. ${CHANGE_REACHES_VISITORS}`
}

/** Text as a sentence: the API's error texts carry no full stop. */
export const asSentence = (text: string): string =>
  /[.!?]$/.test(text) ? text : `${text}.`

/** What the page says when a save failed, in the API's words where it gave any. */
export function failedMessage(title: string, error: FeatureApiError): string {
  const lead = `${title} was not switched`
  if (error.kind === 'forbidden') {
    return `${lead}: the admin key was not accepted. Change admin key to unlock the studio again.`
  }
  if (error.kind === 'offline') {
    return `${lead}: the API could not be reached. Check the connection, then try again.`
  }
  return `${lead}: ${asSentence(error.message)}`
}

/** That switches are per environment, and whom one made here reaches, as the page's intro says it. */
export function environmentSentence(environment: AdminEnvironment): string {
  const lead =
    'Each environment has its own switches, development and production alike'
  if (environment.kind === 'production') {
    return `${lead}, and the ones here are production's: they reach every visitor to ${PROD_DOMAIN}. The dev site keeps its own.`
  }
  if (environment.kind === 'development') {
    return `${lead}, and the ones here are the development environment's. Production (${PROD_DOMAIN}) keeps its own, and nothing set here reaches it.`
  }
  return `${lead}, and the ones here belong to the environment behind this console's API. Production (${PROD_DOMAIN}) keeps its own.`
}

/** What the page asks before it switches a feature in production. */
export interface SwitchQuestion {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
}

/**
 * What the page asks before it switches feature `about` to `setting` in
 * production. Elsewhere a switch is saved at once: only production has
 * visitors a slip of the finger would reach.
 */
export function productionQuestion(
  about: FeatureAbout,
  setting: SwitchSetting,
  buildDefault: boolean,
): SwitchQuestion {
  const { title } = about
  const when = 'on their next page load, within about 30 s'
  if (setting === 'on') {
    return {
      title: `Switch ${title} on in production?`,
      message: `Every visitor to ${PROD_DOMAIN} gets ${title} ${when}. The phone app keeps its own default.`,
      confirmLabel: 'Switch on',
    }
  }
  if (setting === 'off') {
    return {
      title: `Switch ${title} off in production?`,
      message:
        `${title} leaves the app for every visitor to ${PROD_DOMAIN} ${when}. ${about.whenOff}`.trim(),
      confirmLabel: 'Switch off',
    }
  }
  const word = onOff(buildDefault)
  return {
    title: `Hand ${title} back to the build's default in production?`,
    message: `The build's default here is ${word}, so ${title} is ${word} for every visitor to ${PROD_DOMAIN} ${when}.`,
    confirmLabel: 'Use build default',
  }
}
