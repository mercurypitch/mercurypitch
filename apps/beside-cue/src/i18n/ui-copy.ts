// ============================================================
// UI copy — one reactive English, Spanish and German interface catalog
// ============================================================
//
// English source templates are the stable keys. User-authored and domain text
// must be passed as parameters instead of being looked up as interface copy.

import type { Accessor } from 'solid-js'
import type { AppCopySource } from './app-copy'
import { APP_COPY_CATALOGS } from './app-copy'
import { useLocale } from './context'
import type { AppLocale } from './locale'

export type CopyParams = Readonly<Record<string, number | string>>

const english = {
  Language: 'Language',
  'Choose interface language': 'Choose interface language',
  'Corky and the six original Pulls speak this language. Premium Pulls have translated captions only.':
    'Corky and the six original Pulls speak this language. Premium Pulls have translated captions only.',
  'Go back': 'Go back',
  'Main navigation': 'Main navigation',
  Cue: 'Cue',
  Reflection: 'Reflection',
  'Your current plan': 'Your current plan',
  Paused: 'Paused',
  Ready: 'Ready',
  'Record side': 'Record side',
  'Side A · The Pull': 'Side A · The Pull',
  'Side B · My choice': 'Side B · My choice',
  '{count} Pulls': '{count} Pulls',
  'PRO · Locked': 'PRO · Locked',
  'Unlock {name}': 'Unlock {name}',
  'Manage subscription': 'Manage subscription',
  'Turn off renewal': 'Turn off renewal',
  'Simulate a billing problem': 'Simulate a billing problem',
  'Expire the entitlement': 'Expire the entitlement',
  'Close without changing anything': 'Close without changing anything',
  'Yours for good.': 'Yours for good.',
  'Renews {date}.': 'Renews {date}.',
  'Active until {date}.': 'Active until {date}.',
  Support: 'Support',
  Active: 'Active',
  'Purchases need the Android or iOS app.':
    'Purchases need the Android or iOS app.',
  'Checking your purchases…': 'Checking your purchases…',
  'The six original Pulls, your own words, and the cue loop stay free. {name} unlocks the extra character cast and supports the work.':
    'The six original Pulls, your own words, and the cue loop stay free. {name} unlocks the extra character cast and supports the work.',
  'Thank you for supporting Beside Cue.':
    'Thank you for supporting Beside Cue.',
  'The store could not take the last payment. Manage your subscription to keep {name} active.':
    'The store could not take the last payment. Manage your subscription to keep {name} active.',
  'Opening…': 'Opening…',
  'Restore purchases': 'Restore purchases',
  'Gold hub · hours': 'Gold hub · hours',
  'Vinyl edge · minutes': 'Vinyl edge · minutes',
  'Around {time}; editing hours': 'Around {time}; editing hours',
  'Around {time}; editing minutes': 'Around {time}; editing minutes',
  'Preview {time}; no reminder time selected; editing hours':
    'Preview {time}; no reminder time selected; editing hours',
  'Preview {time}; no reminder time selected; editing minutes':
    'Preview {time}; no reminder time selected; editing minutes',
  'Around {time}': 'Around {time}',
  'No reminder time chosen': 'No reminder time chosen',
  'Punched Clock time picker': 'Punched Clock time picker',
  Around: 'Around',
  Preview: 'Preview',
  'Preview {time}; no reminder time selected':
    'Preview {time}; no reminder time selected',
  'Turn the record to choose a reminder time':
    'Turn the record to choose a reminder time',
  'Turning hours': 'Turning hours',
  'Turning minutes': 'Turning minutes',
  'Turn in a circle': 'Turn in a circle',
  'Sweep to choose': 'Sweep to choose',
  'Choose dial layer': 'Choose dial layer',
  'Edit hours': 'Edit hours',
  Hours: 'Hours',
  'Gold hub': 'Gold hub',
  'Edit minutes': 'Edit minutes',
  Minutes: 'Minutes',
  'Vinyl edge': 'Vinyl edge',
  'Type exact time': 'Type exact time',
  'Turn the record in a circle. Outer edge: minutes. Gold hub: hours. Scroll beside the record.':
    'Turn the record in a circle. Outer edge: minutes. Gold hub: hours. Scroll beside the record.',
  'One Pull. One chosen turn.': 'One Pull. One chosen turn.',
  'Keep your better choice beside the moment.':
    'Keep your better choice beside the moment.',
  'Pick one familiar Pull and one small thing you would rather begin. Beside Cue brings them together when you ask.':
    'Pick one familiar Pull and one small thing you would rather begin. Beside Cue brings them together when you ask.',
  'Set up my first plan': 'Set up my first plan',
  'Private by default. No account, score, or feed.':
    'Private by default. No account, score, or feed.',
  Settings: 'Settings',
  'Cue me now': 'Cue me now',
  'Resume this plan first': 'Resume this plan first',
  'Show the action I chose': 'Show the action I chose',
  'B-side games': 'B-side games',
  'Sing a few quiet minutes with Merc': 'Sing a few quiet minutes with Merc',
  'Updating plan…': 'Updating plan…',
  'Resume this plan': 'Resume this plan',
  'Pause this plan': 'Pause this plan',
  'Your plan and history are still here. The daily reminder and Cue me now stay off until you resume it.':
    'Your plan and history are still here. The daily reminder and Cue me now stay off until you resume it.',
  'A record, not a score': 'A record, not a score',
  'Small turns leave a trace.': 'Small turns leave a trace.',
  'Your Side B choices are kept here without streaks, targets, or missed-cue counts.':
    'Your Side B choices are kept here without streaks, targets, or missed-cue counts.',
  'Side B choice totals': 'Side B choice totals',
  Today: 'Today',
  'Coming back matters.': 'Coming back matters.',
  'Seven days': 'Seven days',
  'Past 7 days': 'Past 7 days',
  'Side B choices': 'Side B choices',
  'Your first turn will appear here. Nothing is late.':
    'Your first turn will appear here. Nothing is late.',
  '“No score to defend. Just another cue.”':
    '“No score to defend. Just another cue.”',
  'Close cue': 'Close cue',
  'One gentle cue': 'One gentle cue',
  'Instead of': 'Instead of',
  'Saving your choice on this device…': 'Saving your choice on this device…',
  'Saving your choice…': 'Saving your choice…',
  'Choose Side B': 'Choose Side B',
  'Saving…': 'Saving…',
  'Not now': 'Not now',
  'Cue · what brings the Pull into view':
    'Cue · what brings the Pull into view',
  'When does this Pull usually show up?':
    'When does this Pull usually show up?',
  'For {pull}, choose a familiar moment or use your own words. This is a private note; Beside Cue will not detect it automatically.':
    'For {pull}, choose a familiar moment or use your own words. This is a private note; Beside Cue will not detect it automatically.',
  'Write my own': 'Write my own',
  'Name the moment in words that feel natural to you.':
    'Name the moment in words that feel natural to you.',
  'Not sure yet': 'Not sure yet',
  'Your plan works without this.': 'Your plan works without this.',
  'For example, when I get into bed with my phone':
    'For example, when I get into bed with my phone',
  'Stored only on this device.': 'Stored only on this device.',
  'Side B · your chosen turn': 'Side B · your chosen turn',
  'What small action would you rather begin?':
    'What small action would you rather begin?',
  'When {pull} shows up, choose something concrete enough to begin without planning.':
    'When {pull} shows up, choose something concrete enough to begin without planning.',
  'Begin with a verb: open, walk, play, fill, call.':
    'Begin with a verb: open, walk, play, fill, call.',
  'Your Side B': 'Your Side B',
  'For example, play one guitar riff': 'For example, play one guitar riff',
  'Save my plan': 'Save my plan',
  'Something else': 'Something else',
  'Your Pull': 'Your Pull',
  'Use your own words for the moment you want to notice sooner.':
    'Use your own words for the moment you want to notice sooner.',
  'Starting voice…': 'Starting voice…',
  'Voice playing': 'Voice playing',
  'Replay voice': 'Replay voice',
  'Hear voice': 'Hear voice',
  'Voice is muted in Settings. The full caption is shown.':
    'Voice is muted in Settings. The full caption is shown.',
  'Voice loading.': 'Voice loading.',
  'Voice playing.': 'Voice playing.',
  'Voice stopped.': 'Voice stopped.',
  'Voice could not play. The full caption is shown.':
    'Voice could not play. The full caption is shown.',
  'Your Pull · the familiar pattern': 'Your Pull · the familiar pattern',
  'Choose your Pull': 'Choose your Pull',
  'Choose a starting point. You can use your own words, and they stay on this device.':
    'Choose a starting point. You can use your own words, and they stay on this device.',
  'Name the moment in language that feels natural to you.':
    'Name the moment in language that feels natural to you.',
  'Selected Pull preview': 'Selected Pull preview',
  'Selected Pull': 'Selected Pull',
  'Your words': 'Your words',
  'For example, opening the feed again': 'For example, opening the feed again',
  'Confirm {pull}': 'Confirm {pull}',
  'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.':
    'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.',
  '{count} minute': '{count} minute',
  '{count} minutes': '{count} minutes',
  '{count} second': '{count} second',
  '{count} seconds': '{count} seconds',
  '{duration} remaining': '{duration} remaining',
  'Timer started for {count} minute.': 'Timer started for {count} minute.',
  'Timer started for {count} minutes.': 'Timer started for {count} minutes.',
  'Quiet timer': 'Quiet timer',
  'Side B is yours': 'Side B is yours',
  'Not now is okay': 'Not now is okay',
  'You made a choice. The next cue stays gentle.':
    'You made a choice. The next cue stays gentle.',
  'Back to home': 'Back to home',
  'Your choice is recorded. You can leave Beside Cue and begin.':
    'Your choice is recorded. You can leave Beside Cue and begin.',
  'A short timer is here if it helps. Your choice is already recorded.':
    'A short timer is here if it helps. Your choice is already recorded.',
  'Start {count}-minute timer': 'Start {count}-minute timer',
  'Start one-minute timer': 'Start one-minute timer',
  'Continue without timer': 'Continue without timer',
  'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.':
    'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.',
  'End timer': 'End timer',
  'Timer finished': 'Timer finished',
  'Your choice was already recorded. No check-in needed.':
    'Your choice was already recorded. No check-in needed.',
  'Your plan, your control': 'Your plan, your control',
  'Keep only what helps.': 'Keep only what helps.',
  'Your plan and choice history stay on this device. Notification permission is requested only if you set a reminder.':
    'Your plan and choice history stay on this device. Notification permission is requested only if you set a reminder.',
  Optional: 'Optional',
  'Daily reminder': 'Daily reminder',
  'No daily reminder': 'No daily reminder',
  'Beside Cue can send one discreet reminder at this time. Your Pull and Side B stay off the lock screen.':
    'Beside Cue can send one discreet reminder at this time. Your Pull and Side B stay off the lock screen.',
  'Setting…': 'Setting…',
  'Set reminder': 'Set reminder',
  'Daily reminder state': 'Daily reminder state',
  'Only when I ask': 'Only when I ask',
  'No automatic reminder': 'No automatic reminder',
  'This reminder stays off while your plan is paused. Resume the plan to change it or receive reminders.':
    'This reminder stays off while your plan is paused. Resume the plan to change it or receive reminders.',
  'Character voice': 'Character voice',
  'Voice is on': 'Voice is on',
  'Voice is muted': 'Voice is muted',
  'Character captions always remain visible. This setting only changes whether their recorded lines play.':
    'Character captions always remain visible. This setting only changes whether their recorded lines play.',
  On: 'On',
  Off: 'Off',
  'Current plan': 'Current plan',
  'Make reminders and Cue me now available again.':
    'Make reminders and Cue me now available again.',
  'Keep the plan and history, but stop reminders and Cue me now.':
    'Keep the plan and history, but stop reminders and Cue me now.',
  'Change this plan': 'Change this plan',
  'Choose a new Pull, cue, and Side B. Your current plan stays active until the new one is saved.':
    'Choose a new Pull, cue, and Side B. Your current plan stays active until the new one is saved.',
  'Watch Corky’s introduction again': 'Watch Corky’s introduction again',
  'Replay the film without changing your plan, history, or reminder.':
    'Replay the film without changing your plan, history, or reminder.',
  'Local data': 'Local data',
  'On this device only': 'On this device only',
  'Pull, cue, and Side B text, settings, and choices stay local in this build.':
    'Pull, cue, and Side B text, settings, and choices stay local in this build.',
  'Confirm reset': 'Confirm reset',
  'Reset all local data': 'Reset all local data',
  'This deletes your saved plan, choice history, reminder settings, and onboarding progress from this device. Press Confirm reset to continue.':
    'This deletes your saved plan, choice history, reminder settings, and onboarding progress from this device. Press Confirm reset to continue.',
  'Show device info': 'Show device info',
  'Hide device info': 'Hide device info',
  Engine: 'Engine',
  Graphics: 'Graphics',
  Microphone: 'Microphone',
  'this Pull': 'this Pull',
  'Meet Corky.': 'Meet Corky.',
  'Let’s make one plan.': 'Let’s make one plan.',
  'When does it show up?': 'When does it show up?',
  'Choose your Side B': 'Choose your Side B',
  'A second side comes into view.': 'A second side comes into view.',
  'Corky starts the record.': 'Corky starts the record.',
  'Let it spin.': 'Let it spin.',
  'Stop the record to save this plan.': 'Stop the record to save this plan.',
  'Saving your plan…': 'Saving your plan…',
  'Your plan is saved.': 'Your plan is saved.',
  'A reminder for later?': 'A reminder for later?',
  'Setting your reminder…': 'Setting your reminder…',
  'Your plan is ready.': 'Your plan is ready.',
  'Ready.': 'Ready.',
  'Could not save this plan.': 'Could not save this plan.',
  'Could not set this reminder.': 'Could not set this reminder.',
  'Pro is no longer active. Choose one of the free Pulls, or use your own words.':
    'Pro is no longer active. Choose one of the free Pulls, or use your own words.',
  'Return to settings': 'Return to settings',
  'Onboarding review controls': 'Onboarding review controls',
  'Previous scene': 'Previous scene',
  'Next scene': 'Next scene',
  Replay: 'Replay',
  'Choose a time': 'Choose a time',
  'Tap to begin': 'Tap to begin',
  'Sound starts after your tap. Captions stay on.':
    'Sound starts after your tap. Captions stay on.',
  'Pull choices': 'Pull choices',
  'Hear again': 'Hear again',
  Continue: 'Continue',
  'Cue context choices': 'Cue context choices',
  Back: 'Back',
  'The familiar pattern': 'The familiar pattern',
  'Your chosen turn': 'Your chosen turn',
  'Start the record': 'Start the record',
  'Let it spin for a moment.': 'Let it spin for a moment.',
  'Stop and save plan': 'Stop and save plan',
  'Stop the record': 'Stop the record',
  'Your current pressing': 'Your current pressing',
  'Show premium': 'Show premium',
  'Hide premium': 'Hide premium',
  'Your Pro cast. Choose the Pull you want to notice.':
    'Your Pro cast. Choose the Pull you want to notice.',
  'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.':
    'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.',
  'Premium Pull choices': 'Premium Pull choices',
  'Pro is no longer active. Choose one of the six free Pulls, or name your own.':
    'Pro is no longer active. Choose one of the six free Pulls, or name your own.',
  'Mute audio': 'Mute audio',
  'Unmute audio': 'Unmute audio',
  'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.':
    'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.',
  'Redeem App Store code': 'Redeem App Store code',
  'Redeem on Google Play': 'Redeem on Google Play',
  'Test an offer': 'Test an offer',
  'Check premium access': 'Check premium access',
  'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.':
    'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.',
  'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.':
    'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.',
  'Premium access is confirmed.': 'Premium access is confirmed.',
  'No active premium access was confirmed. If you just redeemed a code, wait a moment and check again, or use Restore purchases.':
    'No active premium access was confirmed. If you just redeemed a code, wait a moment and check again, or use Restore purchases.',
  'Finish redeeming in the App Store. Premium unlocks only when the store confirms it. You can check access here afterward.':
    'Finish redeeming in the App Store. Premium unlocks only when the store confirms it. You can check access here afterward.',
  'Code redemption needs the supported mobile store. Use the redemption link supplied with your offer.':
    'Code redemption needs the supported mobile store. Use the redemption link supplied with your offer.',
  'Purchase support': 'Purchase support',
  'Purchase support ID': 'Purchase support ID',
  'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.':
    'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.',
  'Test purchases — no charge': 'Test purchases — no charge',
  'Test a premium offer': 'Test a premium offer',
  'Apply a 60-day test offer': 'Apply a 60-day test offer',
  'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.':
    'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.',
} as const

type SharedUiCopySource = keyof typeof english
type SharedUiCopyCatalog = Readonly<Record<SharedUiCopySource, string>>
export type UiCopySource = SharedUiCopySource | AppCopySource
type UiCopyCatalog = Readonly<Record<UiCopySource, string>>

const spanish = {
  Language: 'Idioma',
  'Choose interface language': 'Elegir el idioma de la interfaz',
  'Corky and the six original Pulls speak this language. Premium Pulls have translated captions only.':
    'Corky y los seis impulsos originales hablan en este idioma. Los impulsos premium solo tienen subtítulos traducidos.',
  'Go back': 'Volver',
  'Main navigation': 'Navegación principal',
  Cue: 'Señal',
  Reflection: 'Reflexión',
  'Your current plan': 'Tu plan actual',
  Paused: 'En pausa',
  Ready: 'Listo',
  'Record side': 'Cara del disco',
  'Side A · The Pull': 'Cara A · El impulso',
  'Side B · My choice': 'Cara B · Mi elección',
  '{count} Pulls': '{count} impulsos',
  'PRO · Locked': 'PRO · Bloqueado',
  'Unlock {name}': 'Desbloquear {name}',
  'Manage subscription': 'Gestionar suscripción',
  'Turn off renewal': 'Desactivar renovación',
  'Simulate a billing problem': 'Simular un problema de facturación',
  'Expire the entitlement': 'Finalizar el acceso',
  'Close without changing anything': 'Cerrar sin cambiar nada',
  'Yours for good.': 'Tuyo para siempre.',
  'Renews {date}.': 'Se renueva el {date}.',
  'Active until {date}.': 'Activo hasta el {date}.',
  Support: 'Apoyo',
  Active: 'Activo',
  'Purchases need the Android or iOS app.':
    'Las compras requieren la app para Android o iOS.',
  'Checking your purchases…': 'Comprobando tus compras…',
  'The six original Pulls, your own words, and the cue loop stay free. {name} unlocks the extra character cast and supports the work.':
    'Los seis impulsos originales, tus propias palabras y el ciclo de señales siguen siendo gratis. {name} desbloquea al elenco adicional y apoya el proyecto.',
  'Thank you for supporting Beside Cue.': 'Gracias por apoyar Beside Cue.',
  'The store could not take the last payment. Manage your subscription to keep {name} active.':
    'La tienda no pudo cobrar el último pago. Gestiona tu suscripción para mantener {name} activo.',
  'Opening…': 'Abriendo…',
  'Restore purchases': 'Restaurar compras',
  'Gold hub · hours': 'Centro dorado · horas',
  'Vinyl edge · minutes': 'Borde del vinilo · minutos',
  'Around {time}; editing hours': 'Alrededor de las {time}; editando horas',
  'Around {time}; editing minutes': 'Alrededor de las {time}; editando minutos',
  'Preview {time}; no reminder time selected; editing hours':
    'Vista previa {time}; no hay hora de recordatorio seleccionada; editando horas',
  'Preview {time}; no reminder time selected; editing minutes':
    'Vista previa {time}; no hay hora de recordatorio seleccionada; editando minutos',
  'Around {time}': 'Alrededor de las {time}',
  'No reminder time chosen': 'No se ha elegido una hora de recordatorio',
  'Punched Clock time picker': 'Selector de hora Punched Clock',
  Around: 'Alrededor de las',
  Preview: 'Vista previa',
  'Preview {time}; no reminder time selected':
    'Vista previa {time}; no hay hora de recordatorio seleccionada',
  'Turn the record to choose a reminder time':
    'Gira el disco para elegir una hora de recordatorio',
  'Turning hours': 'Girando las horas',
  'Turning minutes': 'Girando los minutos',
  'Turn in a circle': 'Gira en círculo',
  'Sweep to choose': 'Desliza para elegir',
  'Choose dial layer': 'Elegir la capa del dial',
  'Edit hours': 'Editar horas',
  Hours: 'Horas',
  'Gold hub': 'Centro dorado',
  'Edit minutes': 'Editar minutos',
  Minutes: 'Minutos',
  'Vinyl edge': 'Borde del vinilo',
  'Type exact time': 'Escribir la hora exacta',
  'Turn the record in a circle. Outer edge: minutes. Gold hub: hours. Scroll beside the record.':
    'Gira el disco en círculo. Borde exterior: minutos. Centro dorado: horas. Desplaza la página junto al disco.',
  'One Pull. One chosen turn.': 'Un impulso. Un cambio elegido.',
  'Keep your better choice beside the moment.':
    'Mantén tu mejor elección junto al momento.',
  'Pick one familiar Pull and one small thing you would rather begin. Beside Cue brings them together when you ask.':
    'Elige un impulso conocido y una pequeña acción que prefieras empezar. Beside Cue los reúne cuando tú lo pides.',
  'Set up my first plan': 'Crear mi primer plan',
  'Private by default. No account, score, or feed.':
    'Privado de forma predeterminada. Sin cuenta, puntos ni feed.',
  Settings: 'Ajustes',
  'Cue me now': 'Dame una señal',
  'Resume this plan first': 'Reanuda primero este plan',
  'Show the action I chose': 'Mostrar la acción que elegí',
  'B-side games': 'Juegos de la cara B',
  'Sing a few quiet minutes with Merc':
    'Canta unos minutos tranquilos con Merc',
  'Updating plan…': 'Actualizando el plan…',
  'Resume this plan': 'Reanudar este plan',
  'Pause this plan': 'Pausar este plan',
  'Your plan and history are still here. The daily reminder and Cue me now stay off until you resume it.':
    'Tu plan y tu historial siguen aquí. El recordatorio diario y «Dame una señal» permanecen desactivados hasta que lo reanudes.',
  'A record, not a score': 'Un registro, no una puntuación',
  'Small turns leave a trace.': 'Los pequeños cambios dejan huella.',
  'Your Side B choices are kept here without streaks, targets, or missed-cue counts.':
    'Tus elecciones de la cara B se guardan aquí sin rachas, objetivos ni recuentos de señales perdidas.',
  'Side B choice totals': 'Totales de elecciones de la cara B',
  Today: 'Hoy',
  'Coming back matters.': 'Volver importa.',
  'Seven days': 'Siete días',
  'Past 7 days': 'Últimos 7 días',
  'Side B choices': 'Elecciones de la cara B',
  'Your first turn will appear here. Nothing is late.':
    'Tu primer cambio aparecerá aquí. Nada llega tarde.',
  '“No score to defend. Just another cue.”':
    '«No hay puntuación que defender. Solo otra señal.»',
  'Close cue': 'Cerrar la señal',
  'One gentle cue': 'Una señal amable',
  'Instead of': 'En lugar de',
  'Saving your choice on this device…':
    'Guardando tu elección en este dispositivo…',
  'Saving your choice…': 'Guardando tu elección…',
  'Choose Side B': 'Elegir la cara B',
  'Saving…': 'Guardando…',
  'Not now': 'Ahora no',
  'Cue · what brings the Pull into view':
    'Señal · lo que hace aparecer el impulso',
  'When does this Pull usually show up?':
    '¿Cuándo suele aparecer este impulso?',
  'For {pull}, choose a familiar moment or use your own words. This is a private note; Beside Cue will not detect it automatically.':
    'Para {pull}, elige un momento conocido o usa tus propias palabras. Es una nota privada; Beside Cue no lo detectará automáticamente.',
  'Write my own': 'Escribir la mía',
  'Name the moment in words that feel natural to you.':
    'Describe el momento con palabras que te resulten naturales.',
  'Not sure yet': 'Aún no lo sé',
  'Your plan works without this.': 'Tu plan funciona sin esto.',
  'For example, when I get into bed with my phone':
    'Por ejemplo, cuando me meto en la cama con el móvil',
  'Stored only on this device.': 'Solo se guarda en este dispositivo.',
  'Side B · your chosen turn': 'Cara B · el cambio que eliges',
  'What small action would you rather begin?':
    '¿Qué pequeña acción preferirías empezar?',
  'When {pull} shows up, choose something concrete enough to begin without planning.':
    'Cuando aparezca {pull}, elige algo lo bastante concreto como para empezar sin planificar.',
  'Begin with a verb: open, walk, play, fill, call.':
    'Empieza con un verbo: abrir, caminar, tocar, llenar, llamar.',
  'Your Side B': 'Tu cara B',
  'For example, play one guitar riff': 'Por ejemplo, tocar un riff de guitarra',
  'Save my plan': 'Guardar mi plan',
  'Something else': 'Otra cosa',
  'Your Pull': 'Tu impulso',
  'Use your own words for the moment you want to notice sooner.':
    'Usa tus propias palabras para el momento que quieras notar antes.',
  'Starting voice…': 'Iniciando la voz…',
  'Voice playing': 'Voz en reproducción',
  'Replay voice': 'Repetir la voz',
  'Hear voice': 'Escuchar la voz',
  'Voice is muted in Settings. The full caption is shown.':
    'La voz está silenciada en Ajustes. Se muestra el subtítulo completo.',
  'Voice loading.': 'Cargando la voz.',
  'Voice playing.': 'Reproduciendo la voz.',
  'Voice stopped.': 'La voz se ha detenido.',
  'Voice could not play. The full caption is shown.':
    'No se pudo reproducir la voz. Se muestra el subtítulo completo.',
  'Your Pull · the familiar pattern': 'Tu impulso · el patrón conocido',
  'Choose your Pull': 'Elige tu impulso',
  'Choose a starting point. You can use your own words, and they stay on this device.':
    'Elige un punto de partida. Puedes usar tus propias palabras; se guardan en este dispositivo.',
  'Name the moment in language that feels natural to you.':
    'Describe el momento con palabras que te resulten naturales.',
  'Selected Pull preview': 'Vista previa del impulso elegido',
  'Selected Pull': 'Impulso elegido',
  'Your words': 'Tus palabras',
  'For example, opening the feed again': 'Por ejemplo, volver a abrir el feed',
  'Confirm {pull}': 'Confirmar {pull}',
  'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.':
    'Corky, un personaje de corcho color ciruela rosada con ocho extremidades tubulares, descansa junto al plan actual.',
  '{count} minute': '{count} minuto',
  '{count} minutes': '{count} minutos',
  '{count} second': '{count} segundo',
  '{count} seconds': '{count} segundos',
  '{duration} remaining': 'Quedan {duration}',
  'Timer started for {count} minute.':
    'Temporizador iniciado durante {count} minuto.',
  'Timer started for {count} minutes.':
    'Temporizador iniciado durante {count} minutos.',
  'Quiet timer': 'Temporizador tranquilo',
  'Side B is yours': 'La cara B es tuya',
  'Not now is okay': 'Ahora no también está bien',
  'You made a choice. The next cue stays gentle.':
    'Has tomado una decisión. La próxima señal seguirá siendo amable.',
  'Back to home': 'Volver al inicio',
  'Your choice is recorded. You can leave Beside Cue and begin.':
    'Tu elección está guardada. Puedes salir de Beside Cue y empezar.',
  'A short timer is here if it helps. Your choice is already recorded.':
    'Tienes un temporizador breve por si te ayuda. Tu elección ya está guardada.',
  'Start {count}-minute timer': 'Iniciar temporizador de {count} minutos',
  'Start one-minute timer': 'Iniciar temporizador de un minuto',
  'Continue without timer': 'Continuar sin temporizador',
  'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.':
    'Mantén esta pantalla abierta para sentir la vibración final. Puedes terminar el temporizador en cualquier momento; tu elección seguirá guardada.',
  'End timer': 'Terminar temporizador',
  'Timer finished': 'Temporizador terminado',
  'Your choice was already recorded. No check-in needed.':
    'Tu elección ya estaba guardada. No hace falta registrar nada.',
  'Your plan, your control': 'Tu plan, tu control',
  'Keep only what helps.': 'Quédate solo con lo que te ayuda.',
  'Your plan and choice history stay on this device. Notification permission is requested only if you set a reminder.':
    'Tu plan y tu historial de elecciones permanecen en este dispositivo. Solo pedimos permiso para las notificaciones si configuras un recordatorio.',
  Optional: 'Opcional',
  'Daily reminder': 'Recordatorio diario',
  'No daily reminder': 'Sin recordatorio diario',
  'Beside Cue can send one discreet reminder at this time. Your Pull and Side B stay off the lock screen.':
    'Beside Cue puede enviar un recordatorio discreto a esta hora. Tu impulso y tu cara B no aparecen en la pantalla de bloqueo.',
  'Setting…': 'Configurando…',
  'Set reminder': 'Configurar recordatorio',
  'Daily reminder state': 'Estado del recordatorio diario',
  'Only when I ask': 'Solo cuando yo lo pida',
  'No automatic reminder': 'Sin recordatorio automático',
  'This reminder stays off while your plan is paused. Resume the plan to change it or receive reminders.':
    'Este recordatorio permanece desactivado mientras tu plan esté en pausa. Reanuda el plan para cambiarlo o recibir recordatorios.',
  'Character voice': 'Voz de los personajes',
  'Voice is on': 'La voz está activada',
  'Voice is muted': 'La voz está silenciada',
  'Character captions always remain visible. This setting only changes whether their recorded lines play.':
    'Los subtítulos de los personajes siempre están visibles. Este ajuste solo cambia si se reproducen sus líneas grabadas.',
  On: 'Sí',
  Off: 'No',
  'Current plan': 'Plan actual',
  'Make reminders and Cue me now available again.':
    'Vuelve a activar los recordatorios y «Dame una señal».',
  'Keep the plan and history, but stop reminders and Cue me now.':
    'Conserva el plan y el historial, pero detén los recordatorios y «Dame una señal».',
  'Change this plan': 'Cambiar este plan',
  'Choose a new Pull, cue, and Side B. Your current plan stays active until the new one is saved.':
    'Elige un nuevo impulso, una señal y una cara B. Tu plan actual seguirá activo hasta que guardes el nuevo.',
  'Watch Corky’s introduction again': 'Volver a ver la introducción de Corky',
  'Replay the film without changing your plan, history, or reminder.':
    'Reproduce de nuevo la película sin cambiar tu plan, historial ni recordatorio.',
  'Local data': 'Datos locales',
  'On this device only': 'Solo en este dispositivo',
  'Pull, cue, and Side B text, settings, and choices stay local in this build.':
    'El texto del impulso, la señal y la cara B, los ajustes y las elecciones permanecen en este dispositivo en esta versión.',
  'Confirm reset': 'Confirmar borrado',
  'Reset all local data': 'Borrar todos los datos locales',
  'This deletes your saved plan, choice history, reminder settings, and onboarding progress from this device. Press Confirm reset to continue.':
    'Esto elimina de este dispositivo tu plan guardado, historial de elecciones, ajustes de recordatorios y progreso de la introducción. Pulsa «Confirmar borrado» para continuar.',
  'Show device info': 'Mostrar información del dispositivo',
  'Hide device info': 'Ocultar información del dispositivo',
  Engine: 'Motor',
  Graphics: 'Gráficos',
  Microphone: 'Micrófono',
  'this Pull': 'este impulso',
  'Meet Corky.': 'Conoce a Corky.',
  'Let’s make one plan.': 'Hagamos un plan.',
  'When does it show up?': '¿Cuándo aparece?',
  'Choose your Side B': 'Elige tu cara B',
  'A second side comes into view.': 'Una segunda cara aparece.',
  'Corky starts the record.': 'Corky pone el disco en marcha.',
  'Let it spin.': 'Déjalo girar.',
  'Stop the record to save this plan.':
    'Detén el disco para guardar este plan.',
  'Saving your plan…': 'Guardando tu plan…',
  'Your plan is saved.': 'Tu plan está guardado.',
  'A reminder for later?': '¿Un recordatorio para más tarde?',
  'Setting your reminder…': 'Configurando tu recordatorio…',
  'Your plan is ready.': 'Tu plan está listo.',
  'Ready.': 'Listo.',
  'Could not save this plan.': 'No se pudo guardar este plan.',
  'Could not set this reminder.': 'No se pudo configurar este recordatorio.',
  'Pro is no longer active. Choose one of the free Pulls, or use your own words.':
    'Pro ya no está activo. Elige uno de los impulsos gratuitos o usa tus propias palabras.',
  'Return to settings': 'Volver a Ajustes',
  'Onboarding review controls': 'Controles de revisión de la introducción',
  'Previous scene': 'Escena anterior',
  'Next scene': 'Escena siguiente',
  Replay: 'Repetir',
  'Choose a time': 'Elegir una hora',
  'Tap to begin': 'Toca para empezar',
  'Sound starts after your tap. Captions stay on.':
    'El sonido empieza después de tocar. Los subtítulos permanecen visibles.',
  'Pull choices': 'Opciones de impulso',
  'Hear again': 'Escuchar de nuevo',
  Continue: 'Continuar',
  'Cue context choices': 'Opciones de momento para la señal',
  Back: 'Volver',
  'The familiar pattern': 'El patrón conocido',
  'Your chosen turn': 'El cambio que elegiste',
  'Start the record': 'Poner el disco en marcha',
  'Let it spin for a moment.': 'Déjalo girar un momento.',
  'Stop and save plan': 'Detener y guardar el plan',
  'Stop the record': 'Detener el disco',
  'Your current pressing': 'Tu disco actual',
  'Show premium': 'Ver opciones premium',
  'Hide premium': 'Ocultar opciones premium',
  'Your Pro cast. Choose the Pull you want to notice.':
    'Tu elenco Pro. Elige el impulso que quieras notar.',
  'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.':
    'Conoce al elenco adicional. Pro permite elegirlo en Ajustes; los seis originales y tu propio impulso siguen siendo gratis.',
  'Premium Pull choices': 'Opciones premium de impulso',
  'Pro is no longer active. Choose one of the six free Pulls, or name your own.':
    'Pro ya no está activo. Elige uno de los seis impulsos gratuitos o escribe el tuyo.',
  'Mute audio': 'Silenciar audio',
  'Unmute audio': 'Activar audio',
  'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.':
    'Prueba beta de compras. No se realiza ningún cobro. El acceso de prueba no se transfiere a la versión de la tienda.',
  'Redeem App Store code': 'Canjear código del App Store',
  'Redeem on Google Play': 'Canjear en Google Play',
  'Test an offer': 'Probar una oferta',
  'Check premium access': 'Comprobar el acceso premium',
  'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.':
    'La tienda confirma los requisitos, la duración de la oferta y cualquier precio de renovación antes de que aceptes. Los códigos de Apple y Google son distintos.',
  'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.':
    'Los códigos de un solo uso se canjean en Google Play. Los códigos de suscripción personalizados se introducen en la hoja de compra. Vuelve después para comprobar el acceso.',
  'Premium access is confirmed.': 'El acceso premium está confirmado.',
  'No active premium access was confirmed. If you just redeemed a code, wait a moment and check again, or use Restore purchases.':
    'No se confirmó ningún acceso premium activo. Si acabas de canjear un código, espera un momento y vuelve a comprobarlo, o usa Restaurar compras.',
  'Finish redeeming in the App Store. Premium unlocks only when the store confirms it. You can check access here afterward.':
    'Termina el canje en el App Store. Premium solo se desbloquea cuando la tienda lo confirma. Después puedes comprobar el acceso aquí.',
  'Code redemption needs the supported mobile store. Use the redemption link supplied with your offer.':
    'Para canjear el código necesitas una tienda móvil compatible. Usa el enlace de canje incluido con tu oferta.',
  'Purchase support': 'Ayuda con las compras',
  'Purchase support ID': 'ID de ayuda de compras',
  'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.':
    'Comparte este ID en privado con el equipo de ayuda para comprobar un acceso. No es una contraseña y no contiene el texto de tu plan.',
  'Test purchases — no charge': 'Compras de prueba — sin cargo',
  'Test a premium offer': 'Probar una oferta premium',
  'Apply a 60-day test offer': 'Aplicar una oferta de prueba de 60 días',
  'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.':
    'Esto simula un acceso promocional confirmado sin renovación. No canjea un código real de Apple ni de Google.',
} as const satisfies SharedUiCopyCatalog

const german = {
  Language: 'Sprache',
  'Choose interface language': 'Sprache der Benutzeroberfläche wählen',
  'Corky and the six original Pulls speak this language. Premium Pulls have translated captions only.':
    'Corky und die sechs ursprünglichen Impulse sprechen diese Sprache. Premium-Impulse haben nur übersetzte Untertitel.',
  'Go back': 'Zurück',
  'Main navigation': 'Hauptnavigation',
  Cue: 'Auslöser',
  Reflection: 'Rückblick',
  'Your current plan': 'Dein aktueller Plan',
  Paused: 'Pausiert',
  Ready: 'Bereit',
  'Record side': 'Schallplattenseite',
  'Side A · The Pull': 'Seite A · Der Impuls',
  'Side B · My choice': 'Seite B · Meine Wahl',
  '{count} Pulls': '{count} Impulse',
  'PRO · Locked': 'PRO · Gesperrt',
  'Unlock {name}': '{name} freischalten',
  'Manage subscription': 'Abo verwalten',
  'Turn off renewal': 'Verlängerung deaktivieren',
  'Simulate a billing problem': 'Abrechnungsproblem simulieren',
  'Expire the entitlement': 'Zugang auslaufen lassen',
  'Close without changing anything': 'Schließen, ohne etwas zu ändern',
  'Yours for good.': 'Für immer deins.',
  'Renews {date}.': 'Verlängert sich am {date}.',
  'Active until {date}.': 'Aktiv bis {date}.',
  Support: 'Unterstützen',
  Active: 'Aktiv',
  'Purchases need the Android or iOS app.':
    'Käufe benötigen die Android- oder iOS-App.',
  'Checking your purchases…': 'Käufe werden geprüft…',
  'The six original Pulls, your own words, and the cue loop stay free. {name} unlocks the extra character cast and supports the work.':
    'Die sechs ursprünglichen Impulse, deine eigenen Worte und der Auslöser-Ablauf bleiben kostenlos. {name} schaltet das zusätzliche Figurenensemble frei und unterstützt die Arbeit.',
  'Thank you for supporting Beside Cue.':
    'Danke, dass du Beside Cue unterstützt.',
  'The store could not take the last payment. Manage your subscription to keep {name} active.':
    'Der Store konnte die letzte Zahlung nicht einziehen. Verwalte dein Abo, damit {name} aktiv bleibt.',
  'Opening…': 'Wird geöffnet…',
  'Restore purchases': 'Käufe wiederherstellen',
  'Gold hub · hours': 'Goldene Mitte · Stunden',
  'Vinyl edge · minutes': 'Schallplattenrand · Minuten',
  'Around {time}; editing hours': 'Etwa {time}; Stunden bearbeiten',
  'Around {time}; editing minutes': 'Etwa {time}; Minuten bearbeiten',
  'Preview {time}; no reminder time selected; editing hours':
    'Vorschau {time}; keine Erinnerungszeit gewählt; Stunden bearbeiten',
  'Preview {time}; no reminder time selected; editing minutes':
    'Vorschau {time}; keine Erinnerungszeit gewählt; Minuten bearbeiten',
  'Around {time}': 'Etwa {time}',
  'No reminder time chosen': 'Keine Erinnerungszeit gewählt',
  'Punched Clock time picker': 'Zeitauswahl „Punched Clock“',
  Around: 'Etwa',
  Preview: 'Vorschau',
  'Preview {time}; no reminder time selected':
    'Vorschau {time}; keine Erinnerungszeit gewählt',
  'Turn the record to choose a reminder time':
    'Drehe die Schallplatte, um eine Erinnerungszeit zu wählen',
  'Turning hours': 'Stunden werden gedreht',
  'Turning minutes': 'Minuten werden gedreht',
  'Turn in a circle': 'Im Kreis drehen',
  'Sweep to choose': 'Zum Auswählen wischen',
  'Choose dial layer': 'Einstellebene wählen',
  'Edit hours': 'Stunden bearbeiten',
  Hours: 'Stunden',
  'Gold hub': 'Goldene Mitte',
  'Edit minutes': 'Minuten bearbeiten',
  Minutes: 'Minuten',
  'Vinyl edge': 'Schallplattenrand',
  'Type exact time': 'Genaue Uhrzeit eingeben',
  'Turn the record in a circle. Outer edge: minutes. Gold hub: hours. Scroll beside the record.':
    'Drehe die Platte im Kreis. Außenrand: Minuten. Goldene Mitte: Stunden. Scrolle neben der Platte.',
  'One Pull. One chosen turn.': 'Ein Impuls. Eine bewusste Wendung.',
  'Keep your better choice beside the moment.':
    'Halte deine bessere Wahl für den Moment bereit.',
  'Pick one familiar Pull and one small thing you would rather begin. Beside Cue brings them together when you ask.':
    'Wähle einen vertrauten Impuls und eine kleine Sache, die du lieber beginnen möchtest. Beside Cue bringt beides zusammen, wenn du danach fragst.',
  'Set up my first plan': 'Meinen ersten Plan einrichten',
  'Private by default. No account, score, or feed.':
    'Standardmäßig privat. Kein Konto, keine Punkte, kein Feed.',
  Settings: 'Einstellungen',
  'Cue me now': 'Jetzt einen Hinweis',
  'Resume this plan first': 'Setze zuerst diesen Plan fort',
  'Show the action I chose': 'Meine gewählte Aktion zeigen',
  'B-side games': 'Seite-B-Spiele',
  'Sing a few quiet minutes with Merc':
    'Singe ein paar ruhige Minuten mit Merc',
  'Updating plan…': 'Plan wird aktualisiert…',
  'Resume this plan': 'Diesen Plan fortsetzen',
  'Pause this plan': 'Diesen Plan pausieren',
  'Your plan and history are still here. The daily reminder and Cue me now stay off until you resume it.':
    'Dein Plan und dein Verlauf bleiben erhalten. Die tägliche Erinnerung und „Jetzt einen Hinweis“ bleiben aus, bis du den Plan fortsetzt.',
  'A record, not a score': 'Eine Aufzeichnung, keine Punktzahl',
  'Small turns leave a trace.': 'Kleine Wendungen hinterlassen Spuren.',
  'Your Side B choices are kept here without streaks, targets, or missed-cue counts.':
    'Deine Entscheidungen für Seite B bleiben hier – ohne Serien, Ziele oder Zählung verpasster Hinweise.',
  'Side B choice totals': 'Anzahl der Seite-B-Wahlen',
  Today: 'Heute',
  'Coming back matters.': 'Wiederzukommen zählt.',
  'Seven days': 'Sieben Tage',
  'Past 7 days': 'Letzte 7 Tage',
  'Side B choices': 'Seite-B-Wahlen',
  'Your first turn will appear here. Nothing is late.':
    'Deine erste Wendung erscheint hier. Nichts ist zu spät.',
  '“No score to defend. Just another cue.”':
    '„Keine Punktzahl zu verteidigen. Nur ein weiterer Hinweis.“',
  'Close cue': 'Hinweis schließen',
  'One gentle cue': 'Ein sanfter Hinweis',
  'Instead of': 'Statt',
  'Saving your choice on this device…':
    'Deine Wahl wird auf diesem Gerät gespeichert…',
  'Saving your choice…': 'Deine Wahl wird gespeichert…',
  'Choose Side B': 'Seite B wählen',
  'Saving…': 'Wird gespeichert…',
  'Not now': 'Jetzt nicht',
  'Cue · what brings the Pull into view':
    'Hinweis · was den Impuls sichtbar macht',
  'When does this Pull usually show up?':
    'Wann taucht dieser Impuls normalerweise auf?',
  'For {pull}, choose a familiar moment or use your own words. This is a private note; Beside Cue will not detect it automatically.':
    'Wähle für {pull} einen vertrauten Moment oder deine eigenen Worte. Diese Notiz ist privat; Beside Cue erkennt den Moment nicht automatisch.',
  'Write my own': 'Selbst schreiben',
  'Name the moment in words that feel natural to you.':
    'Beschreibe den Moment mit Worten, die sich für dich natürlich anfühlen.',
  'Not sure yet': 'Noch nicht sicher',
  'Your plan works without this.': 'Dein Plan funktioniert auch ohne das.',
  'For example, when I get into bed with my phone':
    'Zum Beispiel, wenn ich mit dem Handy ins Bett gehe',
  'Stored only on this device.': 'Wird nur auf diesem Gerät gespeichert.',
  'Side B · your chosen turn': 'Seite B · deine gewählte Wendung',
  'What small action would you rather begin?':
    'Welche kleine Aktion würdest du lieber beginnen?',
  'When {pull} shows up, choose something concrete enough to begin without planning.':
    'Wenn {pull} auftaucht, wähle etwas Konkretes, das du ohne Planung beginnen kannst.',
  'Begin with a verb: open, walk, play, fill, call.':
    'Beginne mit einem Verb: öffnen, gehen, spielen, füllen, anrufen.',
  'Your Side B': 'Deine Seite B',
  'For example, play one guitar riff': 'Zum Beispiel ein Gitarrenriff spielen',
  'Save my plan': 'Meinen Plan speichern',
  'Something else': 'Etwas anderes',
  'Your Pull': 'Dein Impuls',
  'Use your own words for the moment you want to notice sooner.':
    'Beschreibe mit eigenen Worten den Moment, den du früher bemerken möchtest.',
  'Starting voice…': 'Stimme startet…',
  'Voice playing': 'Stimme wird abgespielt',
  'Replay voice': 'Stimme erneut abspielen',
  'Hear voice': 'Stimme anhören',
  'Voice is muted in Settings. The full caption is shown.':
    'Die Stimme ist in den Einstellungen stummgeschaltet. Der vollständige Untertitel wird angezeigt.',
  'Voice loading.': 'Stimme wird geladen.',
  'Voice playing.': 'Stimme wird abgespielt.',
  'Voice stopped.': 'Stimme wurde angehalten.',
  'Voice could not play. The full caption is shown.':
    'Die Stimme konnte nicht abgespielt werden. Der vollständige Untertitel wird angezeigt.',
  'Your Pull · the familiar pattern': 'Dein Impuls · das vertraute Muster',
  'Choose your Pull': 'Wähle deinen Impuls',
  'Choose a starting point. You can use your own words, and they stay on this device.':
    'Wähle einen Ausgangspunkt. Du kannst eigene Worte verwenden; sie bleiben auf diesem Gerät.',
  'Name the moment in language that feels natural to you.':
    'Beschreibe den Moment mit Worten, die sich für dich natürlich anfühlen.',
  'Selected Pull preview': 'Vorschau des gewählten Impulses',
  'Selected Pull': 'Gewählter Impuls',
  'Your words': 'Deine Worte',
  'For example, opening the feed again':
    'Zum Beispiel den Feed noch einmal öffnen',
  'Confirm {pull}': '{pull} bestätigen',
  'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.':
    'Corky, eine rosapflaumenfarbene Korkfigur mit acht röhrenförmigen Gliedmaßen, ruht neben dem aktuellen Plan.',
  '{count} minute': '{count} Minute',
  '{count} minutes': '{count} Minuten',
  '{count} second': '{count} Sekunde',
  '{count} seconds': '{count} Sekunden',
  '{duration} remaining': 'Noch {duration}',
  'Timer started for {count} minute.': 'Timer für {count} Minute gestartet.',
  'Timer started for {count} minutes.': 'Timer für {count} Minuten gestartet.',
  'Quiet timer': 'Ruhiger Timer',
  'Side B is yours': 'Seite B gehört dir',
  'Not now is okay': 'Jetzt nicht ist in Ordnung',
  'You made a choice. The next cue stays gentle.':
    'Du hast gewählt. Der nächste Hinweis bleibt sanft.',
  'Back to home': 'Zurück zur Startseite',
  'Your choice is recorded. You can leave Beside Cue and begin.':
    'Deine Wahl ist gespeichert. Du kannst Beside Cue verlassen und beginnen.',
  'A short timer is here if it helps. Your choice is already recorded.':
    'Ein kurzer Timer ist da, falls er hilft. Deine Wahl ist bereits gespeichert.',
  'Start {count}-minute timer': '{count}-Minuten-Timer starten',
  'Start one-minute timer': 'Ein-Minuten-Timer starten',
  'Continue without timer': 'Ohne Timer fortfahren',
  'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.':
    'Lass diesen Bildschirm für das abschließende Vibrationssignal geöffnet. Du kannst den Timer jederzeit beenden; deine Wahl bleibt gespeichert.',
  'End timer': 'Timer beenden',
  'Timer finished': 'Timer beendet',
  'Your choice was already recorded. No check-in needed.':
    'Deine Wahl war bereits gespeichert. Kein Check-in nötig.',
  'Your plan, your control': 'Dein Plan, deine Kontrolle',
  'Keep only what helps.': 'Behalte nur, was dir hilft.',
  'Your plan and choice history stay on this device. Notification permission is requested only if you set a reminder.':
    'Dein Plan und dein Wahlverlauf bleiben auf diesem Gerät. Wir fragen nur nach der Benachrichtigungsberechtigung, wenn du eine Erinnerung einstellst.',
  Optional: 'Optional',
  'Daily reminder': 'Tägliche Erinnerung',
  'No daily reminder': 'Keine tägliche Erinnerung',
  'Beside Cue can send one discreet reminder at this time. Your Pull and Side B stay off the lock screen.':
    'Beside Cue kann zu dieser Uhrzeit eine diskrete Erinnerung senden. Dein Impuls und Seite B erscheinen nicht auf dem Sperrbildschirm.',
  'Setting…': 'Wird eingestellt…',
  'Set reminder': 'Erinnerung einstellen',
  'Daily reminder state': 'Status der täglichen Erinnerung',
  'Only when I ask': 'Nur wenn ich frage',
  'No automatic reminder': 'Keine automatische Erinnerung',
  'This reminder stays off while your plan is paused. Resume the plan to change it or receive reminders.':
    'Diese Erinnerung bleibt aus, solange dein Plan pausiert ist. Setze den Plan fort, um sie zu ändern oder Erinnerungen zu erhalten.',
  'Character voice': 'Figurenstimme',
  'Voice is on': 'Stimme ist an',
  'Voice is muted': 'Stimme ist stumm',
  'Character captions always remain visible. This setting only changes whether their recorded lines play.':
    'Die Untertitel der Figuren bleiben immer sichtbar. Diese Einstellung ändert nur, ob ihre aufgenommenen Zeilen abgespielt werden.',
  On: 'An',
  Off: 'Aus',
  'Current plan': 'Aktueller Plan',
  'Make reminders and Cue me now available again.':
    'Erinnerungen und „Jetzt einen Hinweis“ wieder verfügbar machen.',
  'Keep the plan and history, but stop reminders and Cue me now.':
    'Plan und Verlauf behalten, aber Erinnerungen und „Jetzt einen Hinweis“ anhalten.',
  'Change this plan': 'Diesen Plan ändern',
  'Choose a new Pull, cue, and Side B. Your current plan stays active until the new one is saved.':
    'Wähle einen neuen Impuls, Hinweis und eine neue Seite B. Dein aktueller Plan bleibt aktiv, bis der neue gespeichert ist.',
  'Watch Corky’s introduction again': 'Corkys Einführung noch einmal ansehen',
  'Replay the film without changing your plan, history, or reminder.':
    'Spiele den Film erneut ab, ohne Plan, Verlauf oder Erinnerung zu ändern.',
  'Local data': 'Lokale Daten',
  'On this device only': 'Nur auf diesem Gerät',
  'Pull, cue, and Side B text, settings, and choices stay local in this build.':
    'Texte für Impuls, Hinweis und Seite B sowie Einstellungen und Wahlen bleiben in dieser Version lokal auf dem Gerät.',
  'Confirm reset': 'Zurücksetzen bestätigen',
  'Reset all local data': 'Alle lokalen Daten zurücksetzen',
  'This deletes your saved plan, choice history, reminder settings, and onboarding progress from this device. Press Confirm reset to continue.':
    'Dadurch werden dein gespeicherter Plan, Wahlverlauf, Erinnerungseinstellungen und Einführungsfortschritt von diesem Gerät gelöscht. Drücke zum Fortfahren „Zurücksetzen bestätigen“.',
  'Show device info': 'Geräteinformationen anzeigen',
  'Hide device info': 'Geräteinformationen ausblenden',
  Engine: 'Engine',
  Graphics: 'Grafik',
  Microphone: 'Mikrofon',
  'this Pull': 'dieser Impuls',
  'Meet Corky.': 'Lerne Corky kennen.',
  'Let’s make one plan.': 'Lass uns einen Plan machen.',
  'When does it show up?': 'Wann taucht er auf?',
  'Choose your Side B': 'Wähle deine Seite B',
  'A second side comes into view.': 'Eine zweite Seite wird sichtbar.',
  'Corky starts the record.': 'Corky startet die Schallplatte.',
  'Let it spin.': 'Lass sie drehen.',
  'Stop the record to save this plan.':
    'Halte die Schallplatte an, um diesen Plan zu speichern.',
  'Saving your plan…': 'Dein Plan wird gespeichert…',
  'Your plan is saved.': 'Dein Plan ist gespeichert.',
  'A reminder for later?': 'Eine Erinnerung für später?',
  'Setting your reminder…': 'Deine Erinnerung wird eingestellt…',
  'Your plan is ready.': 'Dein Plan ist bereit.',
  'Ready.': 'Bereit.',
  'Could not save this plan.': 'Dieser Plan konnte nicht gespeichert werden.',
  'Could not set this reminder.':
    'Diese Erinnerung konnte nicht eingestellt werden.',
  'Pro is no longer active. Choose one of the free Pulls, or use your own words.':
    'Pro ist nicht mehr aktiv. Wähle einen der kostenlosen Impulse oder verwende deine eigenen Worte.',
  'Return to settings': 'Zurück zu den Einstellungen',
  'Onboarding review controls': 'Steuerung der Einführungsprüfung',
  'Previous scene': 'Vorherige Szene',
  'Next scene': 'Nächste Szene',
  Replay: 'Erneut abspielen',
  'Choose a time': 'Uhrzeit wählen',
  'Tap to begin': 'Zum Starten tippen',
  'Sound starts after your tap. Captions stay on.':
    'Der Ton startet nach deinem Tippen. Untertitel bleiben sichtbar.',
  'Pull choices': 'Impulsauswahl',
  'Hear again': 'Noch einmal anhören',
  Continue: 'Weiter',
  'Cue context choices': 'Auswahl der Hinweismomente',
  Back: 'Zurück',
  'The familiar pattern': 'Das vertraute Muster',
  'Your chosen turn': 'Deine gewählte Wendung',
  'Start the record': 'Schallplatte starten',
  'Let it spin for a moment.': 'Lass sie einen Moment drehen.',
  'Stop and save plan': 'Anhalten und Plan speichern',
  'Stop the record': 'Schallplatte anhalten',
  'Your current pressing': 'Deine aktuelle Pressung',
  'Show premium': 'Premium anzeigen',
  'Hide premium': 'Premium ausblenden',
  'Your Pro cast. Choose the Pull you want to notice.':
    'Dein Pro-Ensemble. Wähle den Impuls, den du bemerken möchtest.',
  'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.':
    'Lerne das zusätzliche Ensemble kennen. Pro schaltet die Auswahl in den Einstellungen frei; die sechs Originale und dein eigener Impuls bleiben kostenlos.',
  'Premium Pull choices': 'Premium-Impulse',
  'Pro is no longer active. Choose one of the six free Pulls, or name your own.':
    'Pro ist nicht mehr aktiv. Wähle einen der sechs kostenlosen Impulse oder benenne deinen eigenen.',
  'Mute audio': 'Audio stummschalten',
  'Unmute audio': 'Audio einschalten',
  'Beta purchase testing. No payment is taken. Test access does not transfer to the store release.':
    'Beta-Kauftest. Es wird nichts berechnet. Der Testzugang wird nicht in die Store-Version übernommen.',
  'Redeem App Store code': 'App-Store-Code einlösen',
  'Redeem on Google Play': 'Bei Google Play einlösen',
  'Test an offer': 'Ein Angebot testen',
  'Check premium access': 'Premium-Zugang prüfen',
  'The store confirms eligibility, offer duration and any renewal price before you accept. Apple and Google codes are separate.':
    'Der Store bestätigt Berechtigung, Angebotsdauer und einen möglichen Verlängerungspreis, bevor du zustimmst. Apple- und Google-Codes sind getrennt.',
  'One-time codes can be redeemed in Google Play. Custom subscription codes are entered in the purchase sheet. Return here afterward to check access.':
    'Einmalcodes können bei Google Play eingelöst werden. Individuelle Abocodes werden im Kaufdialog eingegeben. Kehre danach hierher zurück, um den Zugang zu prüfen.',
  'Premium access is confirmed.': 'Der Premium-Zugang ist bestätigt.',
  'No active premium access was confirmed. If you just redeemed a code, wait a moment and check again, or use Restore purchases.':
    'Es wurde kein aktiver Premium-Zugang bestätigt. Wenn du gerade einen Code eingelöst hast, warte kurz und prüfe erneut oder nutze Käufe wiederherstellen.',
  'Finish redeeming in the App Store. Premium unlocks only when the store confirms it. You can check access here afterward.':
    'Schließe das Einlösen im App Store ab. Premium wird erst freigeschaltet, wenn der Store es bestätigt. Danach kannst du den Zugang hier prüfen.',
  'Code redemption needs the supported mobile store. Use the redemption link supplied with your offer.':
    'Zum Einlösen des Codes ist ein unterstützter mobiler Store nötig. Nutze den Einlösungslink aus deinem Angebot.',
  'Purchase support': 'Hilfe bei Käufen',
  'Purchase support ID': 'Support-ID für Käufe',
  'Share this ID privately with support to check an access grant. It is not a password. It does not contain your plan text.':
    'Teile diese ID vertraulich mit dem Support, um eine Zugangsfreigabe zu prüfen. Sie ist kein Passwort und enthält nicht den Text deines Plans.',
  'Test purchases — no charge': 'Testkäufe — keine Kosten',
  'Test a premium offer': 'Ein Premium-Angebot testen',
  'Apply a 60-day test offer': '60-tägiges Testangebot anwenden',
  'This simulates confirmed promotional access without renewal. It does not redeem a real Apple or Google code.':
    'Dies simuliert bestätigten Aktionszugang ohne Verlängerung. Es löst keinen echten Apple- oder Google-Code ein.',
} as const satisfies SharedUiCopyCatalog

const catalogs: Readonly<Record<AppLocale, UiCopyCatalog>> = {
  en: { ...english, ...APP_COPY_CATALOGS.en },
  es: { ...spanish, ...APP_COPY_CATALOGS.es },
  de: { ...german, ...APP_COPY_CATALOGS.de },
}

export function translateUi(
  source: UiCopySource,
  locale: AppLocale,
  params: CopyParams = {},
): string {
  return catalogs[locale][source].replace(
    /\{([a-zA-Z][a-zA-Z0-9]*)\}/gu,
    (token, key: string) =>
      params[key] === undefined ? token : String(params[key]),
  )
}

export interface Copy {
  readonly locale: Accessor<AppLocale>
  readonly t: (source: UiCopySource, params?: CopyParams) => string
}

export function createCopy(locale: Accessor<AppLocale>): Copy {
  return {
    locale,
    t: (source, params) => translateUi(source, locale(), params),
  }
}

export function useCopy(): Copy {
  return createCopy(useLocale().locale)
}

export const UI_COPY_CATALOGS = catalogs
