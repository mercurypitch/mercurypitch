// ============================================================
// Localized catalog — translated presentation around unchanged plan identities
// ============================================================
//
// Only built-in display copy changes. Access, anchors, actions and timing keep
// their canonical ids and metadata. Never run this over a user's saved text.

import type { ActionDefinition, BuiltInActionId } from './actions'
import { ACTION_DEFINITIONS, CUSTOM_PULL_ACTION_IDS, CUSTOM_PULL_ACTIONS, } from './actions'
import type { ContentLocale } from './localized-voice-lines'
import type { MomentDefinition, MomentId } from './moments'
import { MOMENTS } from './moments'
import type { BuiltInPullId, BuiltInPullOption } from './pulls'
import { pullOptions } from './pulls'

interface PullCopy {
  readonly label: string
  readonly moment: string
  readonly defaultSideAText: string
  readonly anchors: readonly [string, string, string]
}

interface CatalogCopy {
  readonly pulls: Readonly<Record<BuiltInPullId, PullCopy>>
  readonly actions: Readonly<Record<BuiltInActionId, string>>
  readonly moments: Readonly<Record<MomentId, string>>
}

const CATALOG_COPY = {
  es: {
    pulls: {
      scrolling: {
        label: 'Deslizar sin parar',
        moment: 'Cuando sigues viendo publicaciones después de querer salir.',
        defaultSideAText: 'Seguir deslizando',
        anchors: [
          'Cuando abro las publicaciones sin decidirlo.',
          'Cuando me acuesto con el teléfono.',
          'Cuando una publicación lleva a otra.',
        ],
      },
      snacking: {
        label: 'Picar sin pensarlo',
        moment: 'Cuando alcanzas algo de comer antes de elegirlo.',
        defaultSideAText: 'Tomar algo de comer automáticamente',
        anchors: [
          'Cuando entro en la cocina sin un plan.',
          'Cuando veo comida mientras hago otra cosa.',
          'Cuando quiero una pausa, pero aún no he elegido cuál.',
        ],
      },
      'familiar-ritual': {
        label: 'El ritual de siempre',
        moment:
          'Cuando la hora o el lugar de siempre pone en marcha la rutina.',
        defaultSideAText: 'Seguir el ritual de siempre',
        anchors: [
          'Cuando llega la hora de siempre.',
          'Cuando me siento en el lugar de siempre.',
          'Cuando terminar una parte del día pone en marcha la rutina.',
        ],
      },
      'two-minute-pause': {
        label: 'La pausa de siempre',
        moment: 'Cuando buscas la pausa de siempre antes de elegirla.',
        defaultSideAText: 'Hacer la pausa de siempre',
        anchors: [
          'Cuando me aparto entre dos tareas.',
          'Cuando un momento de tensión me hace buscar la pausa de siempre.',
          'Cuando voy al lugar de siempre para descansar.',
        ],
      },
      'one-tap-convenience': {
        label: 'Todo con un toque',
        moment: 'Cuando un toque empieza a parecer la respuesta más fácil.',
        defaultSideAText: 'Elegir la opción de un toque',
        anchors: [
          'Cuando una app me pone delante la opción fácil.',
          'Cuando siento cansancio y quiero la respuesta más rápida.',
          'Cuando llego al pago sin haber elegido de verdad.',
        ],
      },
      avoidance: {
        label: 'Dejarlo para después',
        moment: 'Cuando dar vueltas a la tarea sustituye a empezarla.',
        defaultSideAText: 'Posponer el comienzo',
        anchors: [
          'Cuando veo la tarea y miro hacia otro lado.',
          'Cuando el primer paso no está claro.',
          'Cuando planear sustituye a empezar.',
        ],
      },
      'the-thimble': {
        label: 'Ponerme a la defensiva',
        moment: 'Cuando un comentario hace que me cierre antes de escuchar.',
        defaultSideAText: 'Ponerme a la defensiva',
        anchors: [
          'Cuando alguien me hace un comentario sobre lo que hago.',
          'Cuando noto que me pongo a la defensiva.',
          'Después de una conversación difícil.',
        ],
      },
      'the-tab': {
        label: 'Demasiadas pestañas',
        moment: 'Cuando cambiar de tarea sustituye a hacer una sola cosa.',
        defaultSideAText: 'Abrir otra pestaña',
        anchors: [
          'Cuando abro otra pestaña del navegador.',
          'Cuando cambio de tarea sin terminar.',
          'Al empezar una sesión de trabajo.',
        ],
      },
      'the-bookmark': {
        label: 'Solo un minuto más',
        moment: 'Cuando irme parece perder el punto donde estaba.',
        defaultSideAText: 'Quedarme un poco más',
        anchors: [
          'Cuando llego a un buen punto para parar.',
          'Cuando sigo diciendo «un minuto más».',
          'Cuando es hora de pasar a otra cosa.',
        ],
      },
      'the-match': {
        label: 'Hacerlo todo de golpe',
        moment: 'Cuando un impulso de energía no deja espacio para una pausa.',
        defaultSideAText: 'Seguir sin descansar',
        anchors: [
          'Cuando me salto una pausa para seguir trabajando.',
          'Cuando empiezo varias cosas a la vez.',
          'Cuando una idea nueva lo ocupa todo.',
        ],
      },
      'the-pillow': {
        label: 'Posponer el sueño',
        moment: 'Cuando sigo sin acostarme aunque tenga sueño.',
        defaultSideAText: 'Seguir sin acostarme aunque tenga sueño',
        anchors: [
          'Cuando llevo el teléfono a la cama.',
          'Cuando noto que tengo sueño.',
          'Cuando termino lo último de esta noche.',
        ],
      },
      'the-kettle': {
        label: 'Reaccionar con prisa',
        moment: 'Cuando la urgencia se adelanta a una respuesta pensada.',
        defaultSideAText: 'Reaccionar antes de hacer una pausa',
        anchors: [
          'Cuando un mensaje parece urgente.',
          'Cuando quiero contestar de inmediato.',
          'Cuando los planes cambian sin aviso.',
        ],
      },
      'the-ticker': {
        label: 'Siempre con prisa',
        moment:
          'Cuando sentir que voy tarde me hace pasar el momento con prisa.',
        defaultSideAText: 'Correr hacia lo siguiente',
        anchors: [
          'Cuando vuelvo a mirar la hora.',
          'Entre dos tareas.',
          'Cuando siento que voy con retraso.',
        ],
      },
      'the-tape': {
        label: 'Otro arreglo rápido',
        moment: 'Cuando pongo un parche rápido sin dedicarle tiempo.',
        defaultSideAText: 'Buscar otro arreglo rápido',
        anchors: [
          'Cuando vuelve el mismo problema.',
          'Cuando quiero arreglarlo todo a la vez.',
          'Antes de recurrir a una solución temporal.',
        ],
      },
    },
    actions: {
      'bside.phone-away': 'Dejar el teléfono en otra habitación.',
      'bside.guitar-riff': 'Tocar un riff de guitarra.',
      'bside.street-walk': 'Caminar hasta el final de la calle.',
      'bside.fill-water': 'Llenar un vaso de agua.',
      'bside.make-tea': 'Preparar una taza de té.',
      'bside.step-outside': 'Salir al aire libre tres minutos.',
      'bside.pour-water': 'Servir un vaso de agua.',
      'bside.play-one-song': 'Poner una canción que me guste.',
      'bside.block-walk': 'Dar un paseo corto por el barrio.',
      'bside.six-breaths': 'Respirar despacio seis veces.',
      'bside.open-window-pause':
        'Estar junto a una ventana abierta dos minutos.',
      'bside.send-message': 'Enviar un mensaje a alguien que me cae bien.',
      'bside.checkout-pause': 'Esperar cinco minutos antes de ir al pago.',
      'bside.note-order': 'Anotar lo que iba a pedir.',
      'bside.later-list': 'Pasarlo primero a una lista para después.',
      'bside.open-file-line': 'Abrir el archivo y escribir una línea.',
      'bside.quiet-work': 'Trabajar dos minutos con calma.',
      'bside.first-object': 'Poner en la mesa el primer objeto que necesito.',
      'bside.begin-tiny-part': 'Empezar por una parte pequeña.',
    },
    moments: {
      'cue.open': 'Una señal, sin discusión',
      'turn.b-side': 'Girar hacia la cara B',
      'turn.a-side': 'La pantalla puede descansar',
      return: 'El tocadiscos te guardó el sitio',
      'pressing.earned': 'Un disco, un solo ejemplar',
      'reminder.set': 'Tu momento en el tocadiscos',
    },
  },
  de: {
    pulls: {
      scrolling: {
        label: 'Endlos scrollen',
        moment:
          'Wenn du weiter durch Beiträge scrollst, obwohl du schon aufhören wolltest.',
        defaultSideAText: 'Weiter scrollen',
        anchors: [
          'Wenn ich den Feed öffne, ohne mich dafür zu entscheiden.',
          'Wenn ich mit dem Handy ins Bett gehe.',
          'Wenn aus einem Beitrag noch einer wird.',
        ],
      },
      snacking: {
        label: 'Nebenbei snacken',
        moment:
          'Wenn der Griff nach etwas Essbarem vor der Entscheidung kommt.',
        defaultSideAText: 'Automatisch nach einem Snack greifen',
        anchors: [
          'Wenn ich ohne Plan in die Küche gehe.',
          'Wenn ich beim Tun von etwas anderem Essen sehe.',
          'Wenn ich eine Pause will, aber noch keine gewählt habe.',
        ],
      },
      'familiar-ritual': {
        label: 'Das gewohnte Ritual',
        moment:
          'Wenn die gewohnte Zeit oder der gewohnte Ort die Routine auslöst.',
        defaultSideAText: 'Dem gewohnten Ritual folgen',
        anchors: [
          'Wenn die gewohnte Tageszeit kommt.',
          'Wenn ich mich an den gewohnten Platz setze.',
          'Wenn nach einem Teil des Tages die Routine beginnt.',
        ],
      },
      'two-minute-pause': {
        label: 'Die gewohnte Pause',
        moment:
          'Wenn du zur gewohnten Pause greifst, bevor du sie gewählt hast.',
        defaultSideAText: 'Die gewohnte Pause machen',
        anchors: [
          'Wenn ich zwischen zwei Aufgaben kurz weggehe.',
          'Wenn ich in einem angespannten Moment die gewohnte Pause möchte.',
          'Wenn ich für eine Pause zum gewohnten Ort gehe.',
        ],
      },
      'one-tap-convenience': {
        label: 'Mit einem Tippen',
        moment: 'Wenn ein Tippen wie die einfachste Antwort wirkt.',
        defaultSideAText: 'Die Option mit einem Tippen wählen',
        anchors: [
          'Wenn eine App mir die einfache Option zeigt.',
          'Wenn ich müde bin und die schnellste Antwort will.',
          'Wenn ich schon beim Bezahlen bin, bevor ich wirklich gewählt habe.',
        ],
      },
      avoidance: {
        label: 'Es aufschieben',
        moment:
          'Wenn sich alles um die Aufgabe dreht, statt mit ihr anzufangen.',
        defaultSideAText: 'Den Anfang aufschieben',
        anchors: [
          'Wenn ich die Aufgabe sehe und wegschaue.',
          'Wenn der erste Schritt unklar erscheint.',
          'Wenn Planen das Anfangen ersetzt.',
        ],
      },
      'the-thimble': {
        label: 'In Abwehr gehen',
        moment: 'Wenn ich bei Rückmeldungen zumache, bevor ich zuhören kann.',
        defaultSideAText: 'In Abwehr gehen',
        anchors: [
          'Wenn mir jemand eine Rückmeldung gibt.',
          'Wenn ich merke, dass ich in Abwehr gehe.',
          'Nach einem schwierigen Gespräch.',
        ],
      },
      'the-tab': {
        label: 'Zu viele Tabs',
        moment: 'Wenn ich nur noch Aufgaben wechsle, statt eine Sache zu tun.',
        defaultSideAText: 'Noch einen Tab öffnen',
        anchors: [
          'Wenn ich noch einen Browser-Tab öffne.',
          'Wenn ich die Aufgabe wechsle, ohne fertig zu sein.',
          'Wenn ich mit der Arbeit beginne.',
        ],
      },
      'the-bookmark': {
        label: 'Nur noch eine Minute',
        moment:
          'Wenn sich Aufhören anfühlt, als würde ich meine Stelle verlieren.',
        defaultSideAText: 'Noch etwas länger bleiben',
        anchors: [
          'Wenn ich an einer guten Stelle zum Aufhören bin.',
          'Wenn ich immer wieder «noch eine Minute» sage.',
          'Wenn es Zeit für etwas anderes ist.',
        ],
      },
      'the-match': {
        label: 'Alles auf einmal',
        moment: 'Wenn ein Energieschub keinen Raum für eine Pause lässt.',
        defaultSideAText: 'Ohne Pause weitermachen',
        anchors: [
          'Wenn ich eine Pause auslasse, um weiterzuarbeiten.',
          'Wenn ich mehrere Dinge gleichzeitig anfange.',
          'Wenn eine neue Idee alles einnimmt.',
        ],
      },
      'the-pillow': {
        label: 'Schlafen aufschieben',
        moment: 'Wenn ich wach bleibe, obwohl ich müde bin.',
        defaultSideAText: 'Trotz Müdigkeit wach bleiben',
        anchors: [
          'Wenn ich mein Handy mit ins Bett nehme.',
          'Wenn ich merke, dass ich müde bin.',
          'Wenn ich für heute Abend das Letzte erledigt habe.',
        ],
      },
      'the-kettle': {
        label: 'Hastig reagieren',
        moment: 'Wenn die Dringlichkeit einer überlegten Antwort zuvorkommt.',
        defaultSideAText: 'Reagieren, bevor ich innehalte',
        anchors: [
          'Wenn eine Nachricht dringend wirkt.',
          'Wenn ich sofort antworten möchte.',
          'Wenn sich Pläne unerwartet ändern.',
        ],
      },
      'the-ticker': {
        label: 'Immer in Eile',
        moment: 'Wenn ich mich im Rückstand fühle und durch den Moment hetze.',
        defaultSideAText: 'Zur nächsten Sache eilen',
        anchors: [
          'Wenn ich wieder auf die Uhr schaue.',
          'Zwischen zwei Aufgaben.',
          'Wenn ich mich hinter meinem Zeitplan fühle.',
        ],
      },
      'the-tape': {
        label: 'Noch schnell flicken',
        moment:
          'Wenn ich etwas schnell flicke, statt mir dafür Zeit zu nehmen.',
        defaultSideAText: 'Zur nächsten schnellen Lösung greifen',
        anchors: [
          'Wenn dasselbe Problem wiederkommt.',
          'Wenn ich alles auf einmal reparieren will.',
          'Bevor ich zu einer Übergangslösung greife.',
        ],
      },
    },
    actions: {
      'bside.phone-away': 'Das Handy in einen anderen Raum legen.',
      'bside.guitar-riff': 'Ein Gitarrenriff spielen.',
      'bside.street-walk': 'Bis zum Ende der Straße gehen.',
      'bside.fill-water': 'Ein Glas mit Wasser füllen.',
      'bside.make-tea': 'Eine Tasse Tee machen.',
      'bside.step-outside': 'Für drei Minuten nach draußen gehen.',
      'bside.pour-water': 'Ein Glas Wasser eingießen.',
      'bside.play-one-song': 'Ein Lied anmachen, das mir gefällt.',
      'bside.block-walk': 'Eine kleine Runde um den Block gehen.',
      'bside.six-breaths': 'Sechsmal langsam atmen.',
      'bside.open-window-pause':
        'Zwei Minuten an einem offenen Fenster stehen.',
      'bside.send-message':
        'Einem Menschen, den ich mag, eine Nachricht schicken.',
      'bside.checkout-pause': 'Fünf Minuten warten, bevor ich zur Kasse gehe.',
      'bside.note-order': 'Aufschreiben, was ich gerade bestellen wollte.',
      'bside.later-list': 'Es zuerst auf eine Liste für später setzen.',
      'bside.open-file-line': 'Die Datei öffnen und eine Zeile schreiben.',
      'bside.quiet-work': 'Zwei ruhige Minuten arbeiten.',
      'bside.first-object':
        'Den ersten benötigten Gegenstand auf den Tisch legen.',
      'bside.begin-tiny-part': 'Mit einem winzigen Teil anfangen.',
    },
    moments: {
      'cue.open': 'Ein Hinweis, keine Diskussion',
      'turn.b-side': 'Hin zu Seite B',
      'turn.a-side': 'Der Bildschirm darf jetzt ruhen',
      return: 'Der Plattenspieler hat deinen Platz freigehalten',
      'pressing.earned': 'Eine Pressung, ein einziges Exemplar',
      'reminder.set': 'Dein Moment am Plattenspieler',
    },
  },
} as const satisfies Readonly<Record<Exclude<ContentLocale, 'en'>, CatalogCopy>>

function localizeActions(
  locale: Exclude<ContentLocale, 'en'>,
): readonly ActionDefinition[] {
  return ACTION_DEFINITIONS.map((action) => ({
    ...action,
    label: CATALOG_COPY[locale].actions[action.id],
  }))
}

const ACTIONS_BY_LOCALE: Readonly<
  Record<ContentLocale, readonly ActionDefinition[]>
> = {
  en: ACTION_DEFINITIONS,
  es: localizeActions('es'),
  de: localizeActions('de'),
}

export function getLocalizedActionDefinitions(
  locale: ContentLocale,
): readonly ActionDefinition[] {
  return ACTIONS_BY_LOCALE[locale]
}

function requiredAction(locale: ContentLocale, id: string): ActionDefinition {
  const action = getLocalizedActionDefinitions(locale).find(
    (candidate) => candidate.id === id,
  )
  if (action === undefined) throw new Error(`Unknown localized action: ${id}`)
  return action
}

const CUSTOM_ACTIONS_BY_LOCALE: Readonly<
  Record<ContentLocale, readonly ActionDefinition[]>
> = {
  en: CUSTOM_PULL_ACTIONS,
  es: CUSTOM_PULL_ACTION_IDS.map((id) => requiredAction('es', id)),
  de: CUSTOM_PULL_ACTION_IDS.map((id) => requiredAction('de', id)),
}

export function getLocalizedCustomPullActions(
  locale: ContentLocale,
): readonly ActionDefinition[] {
  return CUSTOM_ACTIONS_BY_LOCALE[locale]
}

function localizePulls(
  locale: Exclude<ContentLocale, 'en'>,
): readonly BuiltInPullOption[] {
  return pullOptions.map((pull) => {
    const copy = CATALOG_COPY[locale].pulls[pull.id as BuiltInPullId]
    const bSideSuggestions = pull.bSideSuggestions.map((action) =>
      requiredAction(locale, action.id),
    )
    return {
      ...pull,
      label: copy.label,
      moment: copy.moment,
      defaultSideAText: copy.defaultSideAText,
      anchorSuggestions: pull.anchorSuggestions.map((anchor, index) => ({
        ...anchor,
        text: copy.anchors[index]!,
      })),
      bSideSuggestions,
      suggestions: bSideSuggestions.map((action) => action.label),
    }
  })
}

const PULLS_BY_LOCALE: Readonly<
  Record<ContentLocale, readonly BuiltInPullOption[]>
> = {
  en: pullOptions,
  es: localizePulls('es'),
  de: localizePulls('de'),
}

export function getLocalizedPullOptions(
  locale: ContentLocale,
): readonly BuiltInPullOption[] {
  return PULLS_BY_LOCALE[locale]
}

function localizeMoments(
  locale: Exclude<ContentLocale, 'en'>,
): Readonly<Record<MomentId, MomentDefinition>> {
  return Object.fromEntries(
    Object.values(MOMENTS).map((moment) => [
      moment.id,
      { ...moment, caption: CATALOG_COPY[locale].moments[moment.id] },
    ]),
  ) as Readonly<Record<MomentId, MomentDefinition>>
}

const MOMENTS_BY_LOCALE: Readonly<
  Record<ContentLocale, Readonly<Record<MomentId, MomentDefinition>>>
> = {
  en: MOMENTS,
  es: localizeMoments('es'),
  de: localizeMoments('de'),
}

export function getLocalizedMoments(
  locale: ContentLocale,
): Readonly<Record<MomentId, MomentDefinition>> {
  return MOMENTS_BY_LOCALE[locale]
}
