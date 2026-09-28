// ============================================================
// Glassworks campaign entry — MercuryPitch's standalone museum front door
// ============================================================

import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@/lib/pitch-engine-assets'
import './glass-adventure.css'
import { createMercuryGlassHost } from './host'

const root = document.getElementById('root')
if (root === null) throw new Error('The Glassworks mount is missing.')

const host = createMercuryGlassHost(() => {
  window.location.href = '/'
})

const showCampaignLoadFailure = (): void => {
  if (document.getElementById('glass-campaign-load-error') !== null) return
  const notice = document.createElement('p')
  notice.id = 'glass-campaign-load-error'
  notice.setAttribute('role', 'alert')
  notice.append(
    document.createTextNode('Glassworks could not finish loading. '),
  )
  const retry = document.createElement('a')
  retry.href = window.location.href
  retry.textContent = 'Reload and try again.'
  notice.append(retry)
  ;(document.querySelector<HTMLElement>('.entry-prelude') ?? root).append(
    notice,
  )
}

// The document already carries an accessible opening prelude. Let it paint
// before fetching the campaign, whose active-gallery branch owns the full 3D
// renderer. This keeps gallery code out of the entry's static dependency graph
// while preserving the same campaign mount as soon as the chunk is ready.
void import('@irchiinnuss/glass-game/campaign')
  .then(({ GlassCampaign }) => {
    render(
      () => (
        <GlassCampaign
          host={host}
          developmentUnlock={
            import.meta.env.DEV &&
            new URLSearchParams(window.location.search).get('progression') !==
              'earned'
          }
        />
      ),
      root,
    )
  })
  .catch(showCampaignLoadFailure)
