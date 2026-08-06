import { MascotStage } from '@/components/MascotStage'

interface QuietScreenProps {
  choseBSide: boolean
  message: string
  onDone: () => void
}

export function QuietScreen(props: QuietScreenProps) {
  return (
    <main class="quiet-screen app-screen" aria-labelledby="quiet-title">
      <p class="quiet-screen__label">
        {props.choseBSide ? 'Side B is yours' : 'No score kept'}
      </p>
      <MascotStage state={props.choseBSide ? 'turn' : 'quiet'} />
      <section class="quiet-screen__copy" aria-live="polite">
        <h1 id="quiet-title">{props.message}</h1>
        <p>
          {props.choseBSide
            ? 'Begin the small thing you chose. Beside Cue can leave now.'
            : 'You made a choice. The next cue stays gentle.'}
        </p>
      </section>
      <button
        class="primary-button primary-button--wide primary-button--quiet"
        type="button"
        onClick={() => props.onDone()}
      >
        Let the screen go quiet
      </button>
    </main>
  )
}
