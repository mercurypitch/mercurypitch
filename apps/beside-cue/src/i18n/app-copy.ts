// ============================================================
// App copy — localized orchestration messages without translating personal text
// ============================================================

import type { AppLocale } from './locale'

const english = {
  'Use your own words for the familiar moment you want to notice sooner.':
    'Use your own words for the familiar moment you want to notice sooner.',
  'This change is visible now, but could not be saved on this device.':
    'This change is visible now, but could not be saved on this device.',
  'That change could not be saved on this device.':
    'That change could not be saved on this device.',
  'Daily reminder is off because notifications are off for this app.':
    'Daily reminder is off because notifications are off for this app.',
  'Daily reminder is off until notification permission is allowed.':
    'Daily reminder is off until notification permission is allowed.',
  'Daily reminders are not available on this device.':
    'Daily reminders are not available on this device.',
  'The device reminder could not be removed. Open Settings and try again.':
    'The device reminder could not be removed. Open Settings and try again.',
  'Your reminder time is saved, but the device reminder could not be updated. Open Settings to retry.':
    'Your reminder time is saved, but the device reminder could not be updated. Open Settings to retry.',
  'Choose a free Pull, or restore Pro to use this character.':
    'Choose a free Pull, or restore Pro to use this character.',
  'This introduction is not available in this build.':
    'This introduction is not available in this build.',
  'Choose one small Side B, then try again.':
    'Choose one small Side B, then try again.',
  'Your plan could not be saved on this device. Try again.':
    'Your plan could not be saved on this device. Try again.',
  'This V2 introduction is not available in this build.':
    'This V2 introduction is not available in this build.',
  'Choose one clear Side A and Side B, then try again.':
    'Choose one clear Side A and Side B, then try again.',
  'This character needs Pro. Choose a free Pull or your own words.':
    'This character needs Pro. Choose a free Pull or your own words.',
  'Choose a free Pull, or restore Pro in Settings.':
    'Choose a free Pull, or restore Pro in Settings.',
  'Side A': 'Side A',
  'Choose a cue moment, or choose Not sure yet.':
    'Choose a cue moment, or choose Not sure yet.',
  'Choose one of the cue moments shown here.':
    'Choose one of the cue moments shown here.',
  'Your cue': 'Your cue',
  'Pro is no longer active. Choose a free Pull or your own words.':
    'Pro is no longer active. Choose a free Pull or your own words.',
  'Your current plan is still active. The new plan could not be saved; try again.':
    'Your current plan is still active. The new plan could not be saved; try again.',
  'Side B': 'Side B',
  'A reminder update is already in progress.':
    'A reminder update is already in progress.',
  'Resume your plan before setting a daily reminder.':
    'Resume your plan before setting a daily reminder.',
  'Choose a valid time and try again.': 'Choose a valid time and try again.',
  'Daily reminder is off. Cue me now still works.':
    'Daily reminder is off. Cue me now still works.',
  'Reminder set for {time} while Beside Cue is open.':
    'Reminder set for {time} while Beside Cue is open.',
  'Reminder set for {time}. You can change it in Settings.':
    'Reminder set for {time}. You can change it in Settings.',
  'Rehearsal only. Your reminder has not changed.':
    'Rehearsal only. Your reminder has not changed.',
  'Cue me now stays ready whenever you ask.':
    'Cue me now stays ready whenever you ask.',
  'The device could not remove that daily reminder. Please try again.':
    'The device could not remove that daily reminder. Please try again.',
  'Your choice could not be saved on this device. Please try again.':
    'Your choice could not be saved on this device. Please try again.',
  'Your plan is active again.': 'Your plan is active again.',
  'Your plan is paused.': 'Your plan is paused.',
  'Your plan is active, but the daily reminder could not be restored.':
    'Your plan is active, but the daily reminder could not be restored.',
  'Your plan is paused, but the daily reminder could not be stopped.':
    'Your plan is paused, but the daily reminder could not be stopped.',
  'Corky’s introduction is not available in this build.':
    'Corky’s introduction is not available in this build.',
  'Local data could not be reset. Please try again.':
    'Local data could not be reset. Please try again.',
  'Opening Beside Cue': 'Opening Beside Cue',
  'Loading your plan…': 'Loading your plan…',
  'Saved data unavailable': 'Saved data unavailable',
  'Your saved data could not be opened.':
    'Your saved data could not be opened.',
  'Try again first. Deleting saved data removes your plan, choice history, reminder settings, and onboarding progress from this device.':
    'Try again first. Deleting saved data removes your plan, choice history, reminder settings, and onboarding progress from this device.',
  'Try again': 'Try again',
  'Delete saved data': 'Delete saved data',
  'Change plan': 'Change plan',
  'Your first plan': 'Your first plan',
  Dismiss: 'Dismiss',
  '{subject} needs between 1 and 120 characters.':
    '{subject} needs between 1 and 120 characters.',
  'We could not keep that {subject}. Please try again.':
    'We could not keep that {subject}. Please try again.',
} as const

export type AppCopySource = keyof typeof english
type AppCopyCatalog = Readonly<Record<AppCopySource, string>>

const spanish = {
  'Use your own words for the familiar moment you want to notice sooner.':
    'Usa tus propias palabras para el momento conocido que quieras notar antes.',
  'This change is visible now, but could not be saved on this device.':
    'El cambio ya se ve, pero no se pudo guardar en este dispositivo.',
  'That change could not be saved on this device.':
    'No se pudo guardar ese cambio en este dispositivo.',
  'Daily reminder is off because notifications are off for this app.':
    'El recordatorio diario está desactivado porque las notificaciones de esta app están desactivadas.',
  'Daily reminder is off until notification permission is allowed.':
    'El recordatorio diario estará desactivado hasta que permitas las notificaciones.',
  'Daily reminders are not available on this device.':
    'Los recordatorios diarios no están disponibles en este dispositivo.',
  'The device reminder could not be removed. Open Settings and try again.':
    'No se pudo quitar el recordatorio del dispositivo. Abre Ajustes e inténtalo de nuevo.',
  'Your reminder time is saved, but the device reminder could not be updated. Open Settings to retry.':
    'La hora está guardada, pero no se pudo actualizar el recordatorio del dispositivo. Abre Ajustes para volver a intentarlo.',
  'Choose a free Pull, or restore Pro to use this character.':
    'Elige un impulso gratuito o restaura Pro para usar este personaje.',
  'This introduction is not available in this build.':
    'Esta introducción no está disponible en esta versión.',
  'Choose one small Side B, then try again.':
    'Elige una pequeña acción para la cara B e inténtalo de nuevo.',
  'Your plan could not be saved on this device. Try again.':
    'No se pudo guardar tu plan en este dispositivo. Inténtalo de nuevo.',
  'This V2 introduction is not available in this build.':
    'La introducción V2 no está disponible en esta versión.',
  'Choose one clear Side A and Side B, then try again.':
    'Elige una cara A y una cara B claras e inténtalo de nuevo.',
  'This character needs Pro. Choose a free Pull or your own words.':
    'Este personaje requiere Pro. Elige un impulso gratuito o usa tus propias palabras.',
  'Choose a free Pull, or restore Pro in Settings.':
    'Elige un impulso gratuito o restaura Pro en Ajustes.',
  'Side A': 'Cara A',
  'Choose a cue moment, or choose Not sure yet.':
    'Elige un momento para la señal o selecciona «Aún no lo sé».',
  'Choose one of the cue moments shown here.':
    'Elige uno de los momentos para la señal que aparecen aquí.',
  'Your cue': 'Tu señal',
  'Pro is no longer active. Choose a free Pull or your own words.':
    'Pro ya no está activo. Elige un impulso gratuito o usa tus propias palabras.',
  'Your current plan is still active. The new plan could not be saved; try again.':
    'Tu plan actual sigue activo. No se pudo guardar el nuevo; inténtalo de nuevo.',
  'Side B': 'Cara B',
  'A reminder update is already in progress.':
    'Ya se está actualizando un recordatorio.',
  'Resume your plan before setting a daily reminder.':
    'Reanuda tu plan antes de configurar un recordatorio diario.',
  'Choose a valid time and try again.':
    'Elige una hora válida e inténtalo de nuevo.',
  'Daily reminder is off. Cue me now still works.':
    'El recordatorio diario está desactivado. «Dame una señal» sigue funcionando.',
  'Reminder set for {time} while Beside Cue is open.':
    'Recordatorio configurado para las {time} mientras Beside Cue esté abierto.',
  'Reminder set for {time}. You can change it in Settings.':
    'Recordatorio configurado para las {time}. Puedes cambiarlo en Ajustes.',
  'Rehearsal only. Your reminder has not changed.':
    'Solo es un ensayo. Tu recordatorio no ha cambiado.',
  'Cue me now stays ready whenever you ask.':
    '«Dame una señal» sigue disponible cuando quieras.',
  'The device could not remove that daily reminder. Please try again.':
    'El dispositivo no pudo quitar ese recordatorio diario. Inténtalo de nuevo.',
  'Your choice could not be saved on this device. Please try again.':
    'No se pudo guardar tu elección en este dispositivo. Inténtalo de nuevo.',
  'Your plan is active again.': 'Tu plan vuelve a estar activo.',
  'Your plan is paused.': 'Tu plan está en pausa.',
  'Your plan is active, but the daily reminder could not be restored.':
    'Tu plan está activo, pero no se pudo restaurar el recordatorio diario.',
  'Your plan is paused, but the daily reminder could not be stopped.':
    'Tu plan está en pausa, pero no se pudo detener el recordatorio diario.',
  'Corky’s introduction is not available in this build.':
    'La introducción de Corky no está disponible en esta versión.',
  'Local data could not be reset. Please try again.':
    'No se pudieron borrar los datos locales. Inténtalo de nuevo.',
  'Opening Beside Cue': 'Abriendo Beside Cue',
  'Loading your plan…': 'Cargando tu plan…',
  'Saved data unavailable': 'Datos guardados no disponibles',
  'Your saved data could not be opened.':
    'No se pudieron abrir tus datos guardados.',
  'Try again first. Deleting saved data removes your plan, choice history, reminder settings, and onboarding progress from this device.':
    'Primero inténtalo de nuevo. Al borrar los datos guardados, se eliminarán de este dispositivo tu plan, historial de elecciones, ajustes de recordatorios y progreso de la introducción.',
  'Try again': 'Volver a intentar',
  'Delete saved data': 'Borrar datos guardados',
  'Change plan': 'Cambiar el plan',
  'Your first plan': 'Tu primer plan',
  Dismiss: 'Cerrar',
  '{subject} needs between 1 and 120 characters.':
    '{subject} debe tener entre 1 y 120 caracteres.',
  'We could not keep that {subject}. Please try again.':
    'No se pudo guardar: {subject}. Inténtalo de nuevo.',
} as const satisfies AppCopyCatalog

const german = {
  'Use your own words for the familiar moment you want to notice sooner.':
    'Beschreibe mit deinen eigenen Worten den vertrauten Moment, den du früher bemerken möchtest.',
  'This change is visible now, but could not be saved on this device.':
    'Die Änderung ist jetzt sichtbar, konnte aber auf diesem Gerät nicht gespeichert werden.',
  'That change could not be saved on this device.':
    'Diese Änderung konnte auf diesem Gerät nicht gespeichert werden.',
  'Daily reminder is off because notifications are off for this app.':
    'Die tägliche Erinnerung ist aus, weil Benachrichtigungen für diese App ausgeschaltet sind.',
  'Daily reminder is off until notification permission is allowed.':
    'Die tägliche Erinnerung bleibt aus, bis Benachrichtigungen erlaubt sind.',
  'Daily reminders are not available on this device.':
    'Tägliche Erinnerungen sind auf diesem Gerät nicht verfügbar.',
  'The device reminder could not be removed. Open Settings and try again.':
    'Die Geräteerinnerung konnte nicht entfernt werden. Öffne die Einstellungen und versuche es erneut.',
  'Your reminder time is saved, but the device reminder could not be updated. Open Settings to retry.':
    'Deine Uhrzeit ist gespeichert, aber die Geräteerinnerung konnte nicht aktualisiert werden. Versuche es in den Einstellungen erneut.',
  'Choose a free Pull, or restore Pro to use this character.':
    'Wähle einen kostenlosen Impuls oder stelle Pro wieder her, um diese Figur zu nutzen.',
  'This introduction is not available in this build.':
    'Diese Einführung ist in dieser Version nicht verfügbar.',
  'Choose one small Side B, then try again.':
    'Wähle eine kleine Aktion für Seite B und versuche es erneut.',
  'Your plan could not be saved on this device. Try again.':
    'Dein Plan konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
  'This V2 introduction is not available in this build.':
    'Die V2-Einführung ist in dieser Version nicht verfügbar.',
  'Choose one clear Side A and Side B, then try again.':
    'Wähle eine klare Seite A und Seite B und versuche es erneut.',
  'This character needs Pro. Choose a free Pull or your own words.':
    'Für diese Figur brauchst du Pro. Wähle einen kostenlosen Impuls oder deine eigenen Worte.',
  'Choose a free Pull, or restore Pro in Settings.':
    'Wähle einen kostenlosen Impuls oder stelle Pro in den Einstellungen wieder her.',
  'Side A': 'Seite A',
  'Choose a cue moment, or choose Not sure yet.':
    'Wähle einen Moment für den Hinweis oder «Noch nicht sicher».',
  'Choose one of the cue moments shown here.':
    'Wähle einen der hier gezeigten Hinweismomente.',
  'Your cue': 'Dein Hinweis',
  'Pro is no longer active. Choose a free Pull or your own words.':
    'Pro ist nicht mehr aktiv. Wähle einen kostenlosen Impuls oder deine eigenen Worte.',
  'Your current plan is still active. The new plan could not be saved; try again.':
    'Dein aktueller Plan ist weiterhin aktiv. Der neue Plan konnte nicht gespeichert werden. Versuche es erneut.',
  'Side B': 'Seite B',
  'A reminder update is already in progress.':
    'Eine Erinnerung wird bereits aktualisiert.',
  'Resume your plan before setting a daily reminder.':
    'Setze deinen Plan fort, bevor du eine tägliche Erinnerung einstellst.',
  'Choose a valid time and try again.':
    'Wähle eine gültige Uhrzeit und versuche es erneut.',
  'Daily reminder is off. Cue me now still works.':
    'Die tägliche Erinnerung ist aus. «Jetzt einen Hinweis» funktioniert weiterhin.',
  'Reminder set for {time} while Beside Cue is open.':
    'Erinnerung für {time} eingestellt, solange Beside Cue geöffnet ist.',
  'Reminder set for {time}. You can change it in Settings.':
    'Erinnerung für {time} eingestellt. Du kannst sie in den Einstellungen ändern.',
  'Rehearsal only. Your reminder has not changed.':
    'Nur eine Vorschau. Deine Erinnerung wurde nicht geändert.',
  'Cue me now stays ready whenever you ask.':
    '«Jetzt einen Hinweis» bleibt bereit, wann immer du möchtest.',
  'The device could not remove that daily reminder. Please try again.':
    'Die tägliche Erinnerung konnte auf dem Gerät nicht entfernt werden. Bitte versuche es erneut.',
  'Your choice could not be saved on this device. Please try again.':
    'Deine Wahl konnte auf diesem Gerät nicht gespeichert werden. Bitte versuche es erneut.',
  'Your plan is active again.': 'Dein Plan ist wieder aktiv.',
  'Your plan is paused.': 'Dein Plan ist pausiert.',
  'Your plan is active, but the daily reminder could not be restored.':
    'Dein Plan ist aktiv, aber die tägliche Erinnerung konnte nicht wiederhergestellt werden.',
  'Your plan is paused, but the daily reminder could not be stopped.':
    'Dein Plan ist pausiert, aber die tägliche Erinnerung konnte nicht gestoppt werden.',
  'Corky’s introduction is not available in this build.':
    'Corkys Einführung ist in dieser Version nicht verfügbar.',
  'Local data could not be reset. Please try again.':
    'Die lokalen Daten konnten nicht zurückgesetzt werden. Bitte versuche es erneut.',
  'Opening Beside Cue': 'Beside Cue wird geöffnet',
  'Loading your plan…': 'Dein Plan wird geladen…',
  'Saved data unavailable': 'Gespeicherte Daten nicht verfügbar',
  'Your saved data could not be opened.':
    'Deine gespeicherten Daten konnten nicht geöffnet werden.',
  'Try again first. Deleting saved data removes your plan, choice history, reminder settings, and onboarding progress from this device.':
    'Versuche es zuerst erneut. Wenn du gespeicherte Daten löschst, werden dein Plan, dein Wahlverlauf, deine Erinnerungseinstellungen und dein Einführungsfortschritt von diesem Gerät entfernt.',
  'Try again': 'Erneut versuchen',
  'Delete saved data': 'Gespeicherte Daten löschen',
  'Change plan': 'Plan ändern',
  'Your first plan': 'Dein erster Plan',
  Dismiss: 'Schließen',
  '{subject} needs between 1 and 120 characters.':
    '{subject} muss zwischen 1 und 120 Zeichen lang sein.',
  'We could not keep that {subject}. Please try again.':
    'Das konnten wir nicht speichern: {subject}. Bitte versuche es erneut.',
} as const satisfies AppCopyCatalog

export const APP_COPY_CATALOGS: Readonly<Record<AppLocale, AppCopyCatalog>> = {
  en: english,
  es: spanish,
  de: german,
}
