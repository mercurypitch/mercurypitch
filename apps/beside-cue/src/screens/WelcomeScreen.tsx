import { buildLabel } from '@/build-info'
import { BrandMark } from '@/components/BrandMark'
import { MascotStage } from '@/components/MascotStage'
import { useCopy } from '@/i18n/ui-copy'

interface WelcomeScreenProps {
  onBegin: () => void
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  const copy = useCopy()

  return (
    <main class="welcome-screen app-screen">
      <div class="welcome-screen__top">
        <BrandMark />
        <p class="release-stamp">Beside Cue · {buildLabel()}</p>
      </div>
      <div class="welcome-screen__copy">
        <p class="screen-kicker">{copy.t('One Pull. One chosen turn.')}</p>
        <h1>{copy.t('Keep your better choice beside the moment.')}</h1>
        <p>
          {copy.t(
            'Pick one familiar Pull and one small thing you would rather begin. Beside Cue brings them together when you ask.',
          )}
        </p>
      </div>
      <MascotStage state="rest" />
      <div class="welcome-screen__action">
        <button
          class="primary-button primary-button--wide"
          type="button"
          onClick={() => props.onBegin()}
        >
          {copy.t('Set up my first plan')}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <p>{copy.t('Private by default. No account, score, or feed.')}</p>
      </div>
    </main>
  )
}
