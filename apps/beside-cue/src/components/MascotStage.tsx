export type MascotState = 'rest' | 'notice' | 'turn' | 'quiet'

interface MascotStageProps {
  state: MascotState
  compact?: boolean
}

const labels: Record<MascotState, string> = {
  rest: 'Ready when the moment arrives',
  notice: 'One cue, no argument',
  turn: 'Turn toward your B-side',
  quiet: 'The screen can go quiet now',
}

const mascotImageUrl = `${import.meta.env.BASE_URL}art/corktop-turn-clean.webp`

export function MascotStage(props: MascotStageProps) {
  return (
    <figure
      class="mascot-stage"
      classList={{ 'mascot-stage--compact': props.compact === true }}
      data-state={props.state}
    >
      <div class="mascot-stage__record" aria-hidden="true" />
      <div class="mascot-stage__sleeve">
        <img
          src={mascotImageUrl}
          alt="Purple cork-topped character beside a plant, turning toward a guitar."
          width="1024"
          height="1024"
        />
        <span class="mascot-stage__wash" aria-hidden="true" />
      </div>
      <figcaption>{labels[props.state]}</figcaption>
    </figure>
  )
}
