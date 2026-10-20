// ============================================================
// LessonsBlueprint — the series blueprint, kept for the team in admin
// ============================================================
//
// The "For the team" section that closed Lesson 1's page, drawn from
// blueprint-data.ts: the promise, the episode's beats to scale, the page
// anatomy, five teaching rules, the pipeline, the roadmap and the plan
// files. Its words are the series' own, quoted as the page printed them,
// so "this page" in them is Lesson 1's. Only the labels added here are the
// admin's.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { BlueprintHead } from './blueprint-data'
import { ANATOMY, BEAT_SHEET, BEATS, BLUEPRINT_HEAD, FILES, PAGE_ANATOMY, PHASES, PIPELINE, PIPELINE_STEPS, PLAN_FILES, planFileUrl, PROMISE, ROADMAP, RULES, TEACHING, } from './blueprint-data'
import styles from './LessonsBlueprint.module.css'

function Panel(props: {
  head: BlueprintHead
  children: JSX.Element
}): JSX.Element {
  return (
    <div class={styles.panel}>
      <span class={styles.fig}>
        {props.head.fig} · {props.head.gloss}
        <Show when={props.head.tempo}>{(tempo) => <> · {tempo()}</>}</Show>
      </span>
      <h4>{props.head.title}</h4>
      {props.children}
    </div>
  )
}

export function LessonsBlueprint(): JSX.Element {
  return (
    <section class={styles.blueprint} aria-labelledby="admin-lessons-blueprint">
      <div class={styles.head}>
        <span class={styles.fig}>
          {BLUEPRINT_HEAD.tempo} {BLUEPRINT_HEAD.gloss}
        </span>
        <h3 id="admin-lessons-blueprint">{BLUEPRINT_HEAD.title}</h3>
        <p>
          As it closed Lesson 1's page, word for word. The plan behind it is in
          the plan files below.
        </p>
      </div>

      <div class={styles.promise}>
        <span class={styles.fig}>{PROMISE.label}</span>
        <p>
          <strong>{PROMISE.lead}</strong> {PROMISE.text}
        </p>
      </div>

      <div class={styles.grid}>
        <Panel head={BEAT_SHEET}>
          <div class={styles.beatBar} role="img" aria-label={BEAT_SHEET.label}>
            <For each={BEATS}>
              {([, , seconds, kind]) => (
                <span
                  class={styles.beat}
                  data-predict={kind === 'pr' ? '' : undefined}
                  style={{ 'flex-grow': seconds }}
                />
              )}
            </For>
          </div>
          <ol class={styles.beats}>
            <For each={BEATS}>
              {([start, name, seconds, kind]) => (
                <li data-predict={kind === 'pr' ? '' : undefined}>
                  <span class={styles.time}>{start}</span>
                  <span>{name}</span>
                  <span class={styles.muted}>{seconds} s</span>
                </li>
              )}
            </For>
          </ol>
        </Panel>

        <Panel head={PAGE_ANATOMY}>
          <div class={styles.anatomy}>
            <div class={styles.phone} aria-hidden="true">
              <For each={ANATOMY}>
                {(part) => (
                  <span
                    class={styles.part}
                    data-kind={part.kind}
                    style={{ height: `${part.h}px`, opacity: part.o }}
                  />
                )}
              </For>
            </div>
            <ol class={styles.parts}>
              <For each={ANATOMY}>
                {(part) => <li data-kind={part.kind}>{part.text}</li>}
              </For>
            </ol>
          </div>
        </Panel>

        <Panel head={TEACHING}>
          <ol class={styles.rules}>
            <For each={RULES}>
              {([rule, meaning]) => (
                <li>
                  <span>
                    <strong>{rule}</strong> {meaning}
                  </span>
                </li>
              )}
            </For>
          </ol>
        </Panel>

        <Panel head={PIPELINE}>
          <ol class={styles.pipeline}>
            <For each={PIPELINE_STEPS}>
              {([step, makes]) => (
                <li>
                  <strong>{step}</strong>
                  <span>{makes}</span>
                </li>
              )}
            </For>
          </ol>
        </Panel>

        <Panel head={ROADMAP}>
          <ol class={styles.phases}>
            <For each={PHASES}>
              {(phase) => (
                <li
                  data-now={phase.now ? '' : undefined}
                  data-continuous={phase.continuous ? '' : undefined}
                >
                  <span class={styles.when}>{phase.when}</span>
                  <strong>{phase.name}</strong>
                  <span>{phase.text}</span>
                </li>
              )}
            </For>
          </ol>
        </Panel>

        <Panel head={PLAN_FILES}>
          <ul class={styles.files}>
            <For each={FILES}>
              {([path, holds]) => (
                <li>
                  <a href={planFileUrl(path)} target="_blank" rel="noopener">
                    <code>{path}</code>
                  </a>
                  <span>{holds}</span>
                </li>
              )}
            </For>
          </ul>
        </Panel>
      </div>
    </section>
  )
}
