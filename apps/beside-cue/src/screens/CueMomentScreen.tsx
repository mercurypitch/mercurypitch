import { MascotStage } from '@/components/MascotStage'
import { CORKY_V023_REST_ART } from '@/content'

interface CueMomentScreenProps {
  pullText: string
  bSideText: string
  phrase: string
  /**
   * The pull category this cue is about, so the mascot shows that pull's own
   * creature rather than the generic token. Absent for a self-named pull,
   * which the content pack answers with the canon turquoise cue.
   */
  pullId?: string
  onChooseBSide: () => void
  onNotNow: () => void
  onClose: () => void
}

export function CueMomentScreen(props: CueMomentScreenProps) {
  return (
    <main class="cue-moment app-screen" aria-labelledby="cue-title">
      <button
        class="icon-button cue-moment__close"
        type="button"
        onClick={() => props.onClose()}
        aria-label="Close cue"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <div class="cue-moment__label">
        <span class="cue-pulse" aria-hidden="true" />
        One gentle cue
      </div>
      <MascotStage
        state="notice"
        artOverride={CORKY_V023_REST_ART}
        {...(props.pullId === undefined ? {} : { pullId: props.pullId })}
      />
      <section class="cue-moment__copy">
        <p>{props.phrase}</p>
        <h1 id="cue-title">{props.bSideText}</h1>
        <div class="cue-moment__context">
          <span>Instead of</span>
          <strong>{props.pullText}</strong>
        </div>
      </section>
      <div class="cue-moment__actions">
        <button
          class="primary-button primary-button--wide primary-button--bside"
          type="button"
          onClick={() => props.onChooseBSide()}
        >
          Choose Side B
        </button>
        <button
          class="quiet-button"
          type="button"
          onClick={() => props.onNotNow()}
        >
          Not now
        </button>
      </div>
    </main>
  )
}
