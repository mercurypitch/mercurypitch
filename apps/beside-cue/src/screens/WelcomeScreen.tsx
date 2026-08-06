import { BrandMark } from '@/components/BrandMark'
import { MascotStage } from '@/components/MascotStage'

interface WelcomeScreenProps {
  onBegin: () => void
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <main class="welcome-screen app-screen">
      <div class="welcome-screen__top">
        <BrandMark />
        <p class="release-stamp">Pocket pressing 01</p>
      </div>
      <div class="welcome-screen__copy">
        <p class="screen-kicker">One pull. One chosen turn.</p>
        <h1>Keep your better choice beside the moment.</h1>
        <p>
          Pick one familiar pull and one small thing you would rather begin.
          Beside Cue brings them together when you ask.
        </p>
      </div>
      <MascotStage state="rest" />
      <div class="welcome-screen__action">
        <button
          class="primary-button primary-button--wide"
          type="button"
          onClick={() => props.onBegin()}
        >
          Make my first cue
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <p>Private by default. No account, score, or feed.</p>
      </div>
    </main>
  )
}
