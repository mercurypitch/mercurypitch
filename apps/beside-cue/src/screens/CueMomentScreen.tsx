// ============================================================
// Cue handoff — a fresh, focused view of the chosen Side B
// ============================================================
import { createMemo, onMount } from 'solid-js'
import { MascotStage } from '@/components/MascotStage'
import { CORKY_V023_REST_ART } from '@/content'
import { useCopy } from '@/i18n/ui-copy'
import { Selectable } from '@/interaction/selection'

interface CueMomentScreenProps {
  pullText: string
  bSideText: string
  cueContextText?: string
  phrase: string
  pending: boolean
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
  const copy = useCopy()
  const corkyArt = createMemo(() => ({
    ...CORKY_V023_REST_ART,
    alt: copy.t(
      'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.',
    ),
  }))
  let heading: HTMLHeadingElement | undefined
  onMount(() => {
    heading?.focus({ preventScroll: true })
    // A scrolled Home (notably at enlarged text) must not carry its offset
    // into this new task and hide the close control or the cue introduction.
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  })
  return (
    <main
      class="cue-moment app-screen"
      aria-labelledby="cue-title"
      aria-busy={props.pending}
    >
      <button
        class="icon-button cue-moment__close"
        type="button"
        onClick={() => props.onClose()}
        aria-label={copy.t('Close cue')}
        disabled={props.pending}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <div class="cue-moment__label">
        <span class="cue-pulse" aria-hidden="true" />
        {copy.t('One gentle cue')}
      </div>
      <MascotStage
        state="notice"
        artOverride={corkyArt()}
        {...(props.pullId === undefined ? {} : { pullId: props.pullId })}
      />
      <section class="cue-moment__copy">
        <p>{props.phrase}</p>
        <h1 id="cue-title" ref={heading} tabIndex={-1} {...Selectable}>
          {props.bSideText}
        </h1>
        <dl class="cue-moment__context">
          <div>
            <dt>{copy.t('Instead of')}</dt>
            <dd {...Selectable}>{props.pullText}</dd>
          </div>
          {props.cueContextText === undefined ? null : (
            <div>
              <dt>{copy.t('Your cue')}</dt>
              <dd {...Selectable}>{props.cueContextText}</dd>
            </div>
          )}
        </dl>
      </section>
      <div class="cue-moment__actions">
        {props.pending ? (
          <p role="status">{copy.t('Saving your choice on this device…')}</p>
        ) : null}
        <button
          class="primary-button primary-button--wide primary-button--bside"
          type="button"
          onClick={() => props.onChooseBSide()}
          disabled={props.pending}
        >
          {props.pending
            ? copy.t('Saving your choice…')
            : copy.t('Choose Side B')}
        </button>
        <button
          class="quiet-button"
          type="button"
          onClick={() => props.onNotNow()}
          disabled={props.pending}
        >
          {props.pending ? copy.t('Saving…') : copy.t('Not now')}
        </button>
      </div>
    </main>
  )
}
