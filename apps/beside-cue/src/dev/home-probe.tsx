// ============================================================
// Home probe — the Home screen in any state, on a page that needs no plan
// ============================================================
//
// Dev only: reached from /home-probe.html, which Vite serves in dev and does
// not build (the production input is index.html alone). Home renders only
// with a saved cue, so its empty platter cannot be reached through the app
// at all, and the other states each take a walk through the cue loop. Here
// every state is a URL, which is what the layout renders are taken from.
//
//   /home-probe.html?state=rest          the plan at rest (default)
//   /home-probe.html?state=side-b        back from a recorded Side B, settling
//   /home-probe.html?state=paused        the paused plan
//   /home-probe.html?state=empty         no plan on the deck yet
//   /home-probe.html?state=no-reminder   the reminder row's Set state
//   /home-probe.html?pull=scrolling      which Pull is on the label
//                   (a free or premium id, or `custom` for the drop mark)
//   /home-probe.html?locale=es           the interface language
//
// Cue me now runs its real beat and then stays on Home, so a screenshot a
// few hundred milliseconds after the tap catches the record turning.

import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@fontsource/coiny/latin-400.css'
import '@fontsource/saira-condensed/latin-600.css'
import '@fontsource/saira-condensed/latin-700.css'
import '../styles.css'
import '../interaction/selection.css'
import { LocaleProvider } from '../i18n/context'
import type { AppLocale } from '../i18n/locale'
import type { HomePlan } from '../screens/HomeScreen'
import { HomeScreen } from '../screens/HomeScreen'

const params = new URLSearchParams(window.location.search)
const state = params.get('state') ?? 'rest'
const pull = params.get('pull') ?? 'custom'
const locale = (params.get('locale') ?? 'en') as AppLocale

const plan: HomePlan | undefined =
  state === 'empty'
    ? undefined
    : {
        pullText: 'Endless scrolling',
        bSideText: 'Walk to the end of the street',
        cueContextText: 'When one post turns into another.',
        ...(pull === 'custom' ? {} : { pullId: pull }),
        paused: state === 'paused',
        ...(state === 'no-reminder' ? {} : { scheduleTime: '20:30' }),
      }

const root = document.querySelector<HTMLDivElement>('#root')
if (root === null) throw new Error('Home probe could not find its root.')

function Probe() {
  const [settle, setSettle] = createSignal(state === 'side-b')
  const [muted, setMuted] = createSignal(false)
  const [currentLocale, setLocale] = createSignal<AppLocale>(locale)
  const noop = (): void => undefined
  return (
    <LocaleProvider locale={currentLocale()} onLocaleChange={setLocale}>
      <HomeScreen
        {...(plan === undefined ? {} : { plan })}
        cueStatePending={false}
        recordSide={state === 'side-b' ? 'B' : 'A'}
        recordSettle={settle()}
        onRecordSettled={() => setSettle(false)}
        activeView="cue"
        onChangeView={noop}
        onCueNow={noop}
        onPauseToggle={noop}
        onOpenSettings={noop}
        onOpenReminder={noop}
        onReplace={noop}
        onStartPlan={noop}
        onOpenGames={noop}
        muted={muted()}
        onMuteToggle={() => setMuted((value) => !value)}
      />
    </LocaleProvider>
  )
}

render(() => <Probe />, root)
