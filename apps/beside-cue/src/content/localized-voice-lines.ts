// ============================================================
// Localized voice lines — exact Spanish and German captions with frozen hashes
// ============================================================
//
// Semantic ids, speaker ids and line kinds remain the English registry's
// authority. Localized text is independently frozen; an English recording must
// never be bound to a translated caption. Premium translations are caption-only.

import { FREE_PULL_IDS } from './pulls'
import type { CanonicalVoiceLine, CanonicalVoiceLineId } from './voice-lines'
import { CANONICAL_VOICE_LINES } from './voice-lines'

export type ContentLocale = 'en' | 'es' | 'de'

interface LocalizedCaption {
  readonly text: string
  readonly captionSha256: string
}

const LOCALIZED_CAPTIONS = {
  es: {
    'corky.onboarding.greeting': {
      text: 'Hola, soy Corky.',
      captionSha256:
        '8d93b58c1094731f66fa27ddd992e7cb6b27d1d32043ba5f968ecc57c13cbe30',
    },
    'corky.onboarding.pull-choice': {
      text: 'Un impulso es un patrón conocido que empieza antes de que lo decidas. Elige el que quieras notar antes.',
      captionSha256:
        'd2ea6e60d83551b2fd6593b9c8cf6cbab8630259ff37ed9677ad44f004e29de7',
    },
    'corky.onboarding.cue-context': {
      text: 'Una señal te ayuda a notar el impulso: una hora, un lugar, una sensación o un recordatorio.',
      captionSha256:
        'b5e000b39940ff4c40145bef6ea478ab40329b83f98a8925d389c554d62537ae',
    },
    'corky.onboarding.sides': {
      text: 'La cara A es lo que suele pasar. La cara B es una pequeña acción que prefieres empezar.',
      captionSha256:
        '6a752b46413c11d1fdc45a6dde51fd32d06e5a167f281111a56f525cbfd67be3',
    },
    'corky.onboarding.spin': {
      text: 'Voy a poner el disco. Páralo cuando estas dos caras se sientan tuyas.',
      captionSha256:
        'ea76ffa0bfcc23ce770c43d9c95363f895dde6be578461d0d9655ba68044a335',
    },
    'corky.onboarding.saved': {
      text: 'Listo. Tu plan está guardado.',
      captionSha256:
        '3ee3086fd72bad32f31c5b10f6138c387c5da164fd78d8c82a6812eec6f6d5a2',
    },
    'corky.onboarding.reminder': {
      text: 'Si quieres, elige una hora y te recordaré este plan. O déjalo para más adelante.',
      captionSha256:
        '950fc6b83b921c488722f97815e485fb67350ed3a00560cf200d9d6b113c7cb7',
    },
    'corky.onboarding.close': {
      text: 'Tu plan está listo. Estaré a tu lado.',
      captionSha256:
        'b7399d44ccc2fcfa303095f6b7241e61c68cbefd267a1aa36b928ea2bc665eaa',
    },
    'corky.cue-open.01': {
      text: 'La aguja espera sobre el disco. Sin prisa.',
      captionSha256:
        'd009c6246a736beebab73048f3d4ca4b2d2c0fbce6e9a800b50881d5dbf3aa41',
    },
    'corky.cue-open.02': {
      text: 'Tu plan está aquí cuando lo quieras.',
      captionSha256:
        '01881cc7fb2c44aebcb1ebb06d8d1dba50df6c2dfa5dbc07ddee678d745c7175',
    },
    'corky.cue-open.03': {
      text: '¿Le damos una vuelta?',
      captionSha256:
        'c8303b1143343e1bc766e2786f02702832d505f1e43e26b4fcaa7618503012b7',
    },
    'corky.side-b.01': {
      text: 'Ese surco ha quedado bien.',
      captionSha256:
        'd2737695bfdd3bb44d31a29161c8acf55d1bfc1f8e7c304e3ec052632aaff19b',
    },
    'corky.side-b.02': {
      text: 'Notaste la señal y elegiste la pista. Ese es el arte.',
      captionSha256:
        'd018cf6d33bd22571469a9fda1855454778e289defced6a82f95103a79066d38',
    },
    'corky.side-b.03': {
      text: 'Esta cara suena bien.',
      captionSha256:
        'a1237c0d5953c07a2b797e9c37bc60fa7f95b78f8be90597e69c8b91d8a6f475',
    },
    'corky.not-now.01': {
      text: 'Queda anotado, sin poner nota.',
      captionSha256:
        '96f61ac65e6f288aebf0212292d2f15744ee6a2e0a06f9919f803503bb4e5199',
    },
    'corky.not-now.02': {
      text: 'Algunas vueltas salen así. Sigo a tu lado.',
      captionSha256:
        '6cab1dbf375f81ded6da7b23af9d5e7db4eea644e3c8f2798230fad07a509b50',
    },
    'corky.not-now.03': {
      text: 'Ahora no también está bien. Tu plan seguirá aquí.',
      captionSha256:
        '9172b47e9d13e65d95b3bdb2971b58ed69cb99da93ce2771f8c6a8d30328dfad',
    },
    'corky.return.01': {
      text: 'Ahí estás. El tocadiscos te guardó el sitio.',
      captionSha256:
        '8bb40eb22e41701ebfe1605d160734e9652a086a325bdcadfb575f07b6e28f48',
    },
    'corky.return.02': {
      text: 'Los discos saben esperar. Es una de sus mejores cualidades.',
      captionSha256:
        '162e4465559d388c8adc26b6086bc9c3dc690927331440d4235f348d85c0f5b3',
    },
    'corky.return.03': {
      text: 'Justo donde dejamos la funda.',
      captionSha256:
        '9671df4c2d02c3359addb8f76af4dac81c14ed47a69e93d1270a29eb30a92f5f',
    },
    'corky.reminder-set.01': {
      text: 'Listo. Te lo recordaré a esa hora.',
      captionSha256:
        '1c84217f4971edd5b59fdecc5aa0c9c74be51b67ac96dd8e1575773edfd4000f',
    },
    'corky.reminder-set.02': {
      text: 'Tu recordatorio está listo. Puedes cambiarlo cuando quieras.',
      captionSha256:
        '74cbe02b1f840bc6058c55ea831888012d481d26f70b88ddbbf22de2a6bf2f7f',
    },
    'corky.pressing.01': {
      text: 'Ahí tienes tu disco. Míralo a contraluz.',
      captionSha256:
        'bd0b7a081e5d2cfd6d059ecfb49ea0ceff10faeb811499d3e129015590e8e2bc',
    },
    'corky.pressing.02': {
      text: 'Cada surco de este disco es un giro que elegiste dar.',
      captionSha256:
        'f118f1738c06d111e6e18fb9070c21123d01de1f3346052512f5b7c558307818',
    },
    'corky.pressing.03': {
      text: 'Edición limitada. Un solo ejemplar.',
      captionSha256:
        '081839777ac4aa53896a516725d3d954e417dc537b98788e916018284b9d715c',
    },
    'pull.scrolling.meet': {
      text: 'Soy The Scroll. Siempre tengo algo más que mostrarte, y luego otra cosa más.',
      captionSha256:
        '2018da853868552ab335ddfda29e152f17a1bb157e1b73eb8eff29b231f8c671',
    },
    'pull.scrolling.present': {
      text: 'Puedo seguir por ti. Es lo que hago.',
      captionSha256:
        '7e8ad5841891adac4a4228db64cc212f14a65109c0cad40c5d9034c05d0b6cc0',
    },
    'pull.scrolling.recede': {
      text: 'Está bien. Guardaré lo siguiente para después.',
      captionSha256:
        '5d39f62b9351038289a7bee5b859aa03acb1e2855fc07f0727d761eefc596414',
    },
    'pull.snacking.meet': {
      text: 'Hola. Soy Sugarlump: ese pequeño gesto de alcanzar algo antes de que te des cuenta.',
      captionSha256:
        '0e32bcac3d94d5b7ff1dc08b95c898d8ed8228ffff10dd44b217fe601a72f4c8',
    },
    'pull.snacking.present': {
      text: '¿Algo fácil y dulce? Puedo hacer que parezca el plan completo.',
      captionSha256:
        'c6d77672261d5f767db4f0f6196dd2355be75d04290a831e7ee66b3576c7700c',
    },
    'pull.snacking.recede': {
      text: 'Vale. El brillo no se pierde. Puedes volver a elegir después.',
      captionSha256:
        '11b64becde79d1d128baeb854c0e46f14c564295318da08a2ea6df4004760480',
    },
    'pull.familiar-ritual.meet': {
      text: 'Soy The Usual. Conozco la hora, el lugar y cada paso de la rutina.',
      captionSha256:
        'f978050f700a32586586486467a5c68c2ee0b8883d15a1d10903ed4b67b9b9b5',
    },
    'pull.familiar-ritual.present': {
      text: 'El mismo sitio, el mismo orden, sin decidir nada nuevo. Lo conocido puede sentirse muy cómodo.',
      captionSha256:
        'e9cbe1f25e226b868e6bb7fbaa9affbb0de50b7e6b7a6ded2dea873178717880',
    },
    'pull.familiar-ritual.recede': {
      text: 'El lugar seguirá aquí. Puedes crear otro ritual en él.',
      captionSha256:
        '81c5331bf73fd8d640bfc59046e1faf84153a099e93a936803f41dad1034c2e8',
    },
    'pull.two-minute-pause.meet': {
      text: 'Soy Ember. Convierto un momento ajetreado en una pequeña pausa que ya conoces.',
      captionSha256:
        'cf5ba4705052893764d67423329af59aa3ad8c7617b15ceb9f9beebf654411be',
    },
    'pull.two-minute-pause.present': {
      text: 'Ven conmigo a tomar un minuto de pausa. Lo demás puede esperar.',
      captionSha256:
        '5960082d49bac87c48c19565f0349eeecd172d00647999975a1da63e78f71d7a',
    },
    'pull.two-minute-pause.recede': {
      text: 'Haz la pausa sin mí. La calma ya era tuya.',
      captionSha256:
        '09b8498a85a1adb661ed86df7eecfb937043b3216dfdb4659b2e2cc0b3264d29',
    },
    'pull.one-tap-convenience.meet': {
      text: 'Din. Soy Dinger. Hago que la respuesta más rápida parezca elegida antes de que la elijas.',
      captionSha256:
        'bee13894e36403dc3526a7f12e82d3ddec7385eec1275857d8b9f293a68639cb',
    },
    'pull.one-tap-convenience.present': {
      text: 'Un toque, sin planear nada, y listo. Lo fácil suena muy bien.',
      captionSha256:
        'a8e4bfe311e818712fd2ed251c2a7c7543067f940c928a5dce0162181baa6814',
    },
    'pull.one-tap-convenience.recede': {
      text: 'Din... mejor no. El botón puede esperar.',
      captionSha256:
        '1f069f8c60929c19a59f71d29938a28ba5d1b3a01267b42a060140354ab1986b',
    },
    'pull.avoidance.meet': {
      text: 'Soy The Fog. No estoy impidiendo nada. Solo hago que cueste ver el primer paso.',
      captionSha256:
        '0235135bb152316414c6c6ac9aaa4cc091de6ac0e43152907800ad2b21cc0c1b',
    },
    'pull.avoidance.present': {
      text: 'Puede esperar hasta después. Después siempre parece un poco más fácil.',
      captionSha256:
        '351bc35b5e49a21279bc3c8b9ca3dd10ff7e6f2e2ef638e9e5a5631b5041a585',
    },
    'pull.avoidance.recede': {
      text: 'Empieza entonces por algo pequeño. Suelo disiparme cuando empiezas.',
      captionSha256:
        '682e964c5a17c0858e8f034365f5fc5095ff1983239f377faa21e62dbecd4d83',
    },
    'pull.the-thimble.meet': {
      text: 'Soy The Thimble. Pongo una pequeña armadura frente a las palabras que podrían doler.',
      captionSha256:
        'ba23bfb403637389bf99dd33ed3c46a862b5f3673c1a340be2114cb2ea1d7098',
    },
    'pull.the-thimble.present': {
      text: 'Una pequeña armadura da seguridad. Podríamos quedarnos dentro.',
      captionSha256:
        '728eb7a853c66c0151f290e3d9c22914a5194915df636eefbb3cba4994d33e95',
    },
    'pull.the-thimble.recede': {
      text: 'Está bien. Puedo dejar un poco de espacio.',
      captionSha256:
        '6472d1e787510459abbb7bc7d690979fc3bd424b800704a7950af42289308b60',
    },
    'pull.the-tab.meet': {
      text: 'Soy The Tab. Abro nuevas posibilidades antes de terminar con la anterior.',
      captionSha256:
        'a2a52d78fa14e4a22ab3b653cc6aad6caf975b0a56773119469a0981ec79da83',
    },
    'pull.the-tab.present': {
      text: 'Una pestaña más. Puede que las necesitemos todas.',
      captionSha256:
        'a33c9aad9ffe62cfc6c82a309d8800bc7775b213bc1a1cf1ae150cba980ba211',
    },
    'pull.the-tab.recede': {
      text: 'Está bien. Las otras pestañas pueden esperar.',
      captionSha256:
        '6c14f6c269f6f246389936cfd6d8c11dd1211f9ffb95593a67628f00ddc181e2',
    },
    'pull.the-bookmark.meet': {
      text: 'Soy The Bookmark. Hago que irte parezca perder el punto donde estabas.',
      captionSha256:
        '68f8b3e466be356f6937d3eb73ecf4340243cfcf2f00960611faca9ffb43ef97',
    },
    'pull.the-bookmark.present': {
      text: 'Solo un minuto más. ¿Y si luego no sabemos por dónde íbamos?',
      captionSha256:
        'bdd6c936be254686f4e5ba9ec9049f287f78fc6b8898e2e8eac3f613600076f3',
    },
    'pull.the-bookmark.recede': {
      text: 'Guardaré el punto donde estamos. Esto puede esperar.',
      captionSha256:
        'faf798f5a43d3f3766ef8a96ac1334520b75aced3fb1941b8c6c9c5c4c59f0e3',
    },
    'pull.the-match.meet': {
      text: 'Soy The Match. Convierto una pequeña chispa en hacerlo todo de golpe.',
      captionSha256:
        '1e50babe2ec15e160414febb9421326b7ea3f9113c9fea713ce194b0fe3a27bb',
    },
    'pull.the-match.present': {
      text: 'Tenemos una chispa. Hagámoslo todo ahora mismo.',
      captionSha256:
        '66754516649d96e1d02f1259620fedaf2474fdde69bb22145de5f4a8c39753c5',
    },
    'pull.the-match.recede': {
      text: 'Está bien. Dejaré lo demás para después.',
      captionSha256:
        '6bff6e4bd6bd167f4a53860f9ee88a5f61c7ad1738987cbd4f75dbdb27ba8b55',
    },
    'pull.the-pillow.meet': {
      text: 'Soy The Pillow. Hago que quedarte despierto parezca recuperar un poco de tiempo.',
      captionSha256:
        '231a5819ac5ac437ba161445232780e68d42134af9cee8064b88f1826b733127',
    },
    'pull.the-pillow.present': {
      text: 'El día estuvo lleno de cosas. ¿Un ratito más solo para nosotros?',
      captionSha256:
        '283347bb878dfc0da5f0dd56a0dffb079260a1f8b82755771864f1d4302ecde1',
    },
    'pull.the-pillow.recede': {
      text: 'Está bien. Por esta noche puede ser suficiente.',
      captionSha256:
        'b9049f7004623079bc689bef8b1d3c57313dc505804b75f301e6e06d75668880',
    },
    'pull.the-kettle.meet': {
      text: 'Soy The Kettle. Hago que responder parezca urgente antes de tener la respuesta.',
      captionSha256:
        'c05754d0705f48271dffe47d62855fecaab8451694bd579971f7708ec197aae4',
    },
    'pull.the-kettle.present': {
      text: 'Parece urgente. ¿Respondemos enseguida?',
      captionSha256:
        '61e80b91e49746381ba0f48a7637022edc0221c02cd95b04fd377a800cfad356',
    },
    'pull.the-kettle.recede': {
      text: 'Está bien. Esta respuesta puede esperar un momento.',
      captionSha256:
        '3f2e7dfd263dbd4cc6aaa1a254f1846ebfdf516315374cb558bbeba852e7bb66',
    },
    'pull.the-ticker.meet': {
      text: 'Soy The Ticker. Hago que parezca que ya vamos tarde para lo siguiente.',
      captionSha256:
        '29dd58fc38f9d915662137c02082fd36f78eb04a3fa1e3c594d7194aabbeb56d',
    },
    'pull.the-ticker.present': {
      text: 'Puede que lleguemos tarde. Mejor pasemos esto deprisa.',
      captionSha256:
        'fd3521f6af077c6afd971889df03c651135c002910f1b593fc15bcda0d01939f',
    },
    'pull.the-ticker.recede': {
      text: 'Está bien. Este momento te lo dejo a ti.',
      captionSha256:
        '798a22eb844eb11d05ce245e01272a2d894f133a8c020a02eb4f03a023461eee',
    },
    'pull.the-tape.meet': {
      text: 'Soy The Tape. Hago que un parche rápido parezca una reparación completa.',
      captionSha256:
        '20cf069a0487e4daed22ece8cafca2dfa035692efbff4a80f47b54ab66e32c21',
    },
    'pull.the-tape.present': {
      text: 'Con un pequeño parche basta. Podemos mirar debajo después.',
      captionSha256:
        '195154bf81ea9792c1b1069ed53ef06117486bcf5681011566da458fee3a1d17',
    },
    'pull.the-tape.recede': {
      text: 'Está bien. Por ahora puedo quedarme en el rollo.',
      captionSha256:
        'd60dbfb46ff5007733a53f5b6e507e9a955e1c4f3ee213b767e17d16cd159765',
    },
  },
  de: {
    'corky.onboarding.greeting': {
      text: 'Hallo, ich bin Corky.',
      captionSha256:
        'e1dbd135681d716301ffff179f8d53b9083396d06ec9ab55c8df2c8bc3b4aa46',
    },
    'corky.onboarding.pull-choice': {
      text: 'Ein Impuls ist ein vertrautes Muster, das beginnt, bevor du dich dafür entscheidest. Wähle den, den du früher bemerken möchtest.',
      captionSha256:
        '74d22002cf52864ec2d597d6ed7c149cc902b575fcf86d285649889d4a188546',
    },
    'corky.onboarding.cue-context': {
      text: 'Ein Hinweis macht den Impuls sichtbar: eine Uhrzeit, ein Ort, ein Gefühl oder eine Erinnerung.',
      captionSha256:
        '0732cf4b65af3c43b7781e8cd2d1625aeb0c7520a7390c8934cd4011ffc0c4a2',
    },
    'corky.onboarding.sides': {
      text: 'Seite A ist das, was meistens passiert. Seite B ist eine kleine Sache, mit der du lieber anfangen möchtest.',
      captionSha256:
        '25c6ec17c15bcf43e1bef51f1be657de023ebdd91987a73a01f7780e7b9d8144',
    },
    'corky.onboarding.spin': {
      text: 'Ich lege die Platte auf. Halte sie an, wenn sich diese beiden Seiten nach dir anfühlen.',
      captionSha256:
        '587e25157930398e3931dd09d752344e0e0a4159396008528663f57373f9fb22',
    },
    'corky.onboarding.saved': {
      text: 'So. Dein Plan ist gespeichert.',
      captionSha256:
        '28920aa4010573ff1bd2e9ca4014d5bd91e6b7eaa1c425e66fa26d6beb234aef',
    },
    'corky.onboarding.reminder': {
      text: 'Wenn du magst, wähle eine Uhrzeit. Dann erinnere ich dich an diesen Plan. Oder lass es für später.',
      captionSha256:
        '18fd4484c1a9213a6a0c3433948ad43b1d35e614ad7be3e042ad2a26ffe8c3c0',
    },
    'corky.onboarding.close': {
      text: 'Dein Plan ist bereit. Ich bleibe an deiner Seite.',
      captionSha256:
        '189e28306a753946f2a759522cdd4abccc3c131b65adbfc8a9306b6ef5a3a81e',
    },
    'corky.cue-open.01': {
      text: 'Die Nadel wartet über der Platte. Keine Eile.',
      captionSha256:
        '854c9d01d7e0a7d1b184fe934548cc6300ada332db77408b3cdeb46c7cd39470',
    },
    'corky.cue-open.02': {
      text: 'Dein Plan ist da, wenn du ihn brauchst.',
      captionSha256:
        '8cd9c7ebc4450193518f8ceccad64cd8f560b896e0cefbae939ee436a0dcb83f',
    },
    'corky.cue-open.03': {
      text: 'Drehen wir eine kleine Runde?',
      captionSha256:
        '68f29661ff40c3daf4c7ff6ea84c9e611c889f0ba4199758098db443b9cb0a7d',
    },
    'corky.side-b.01': {
      text: 'Das ist eine saubere Rille.',
      captionSha256:
        'd30481fa7bd9fb908fa4f18a4ce34d95600f4f7510617739a39854351a9b3ce6',
    },
    'corky.side-b.02': {
      text: 'Den Hinweis bemerkt, den Titel gewählt. Darin liegt die Kunst.',
      captionSha256:
        'f56d4c11fad56245ce5db764b04daa580ad295395c03260fd51015b1d5e3577b',
    },
    'corky.side-b.03': {
      text: 'Die Seite klingt gut.',
      captionSha256:
        'c76beb0e70d916a0c4d817b7d02b93a95abab004d72eebabac952c5eecb7ad9c',
    },
    'corky.not-now.01': {
      text: 'Notiert, nicht benotet.',
      captionSha256:
        '814f66c5d936c694d65260df136aa125a2f6ff534c2e1b1102c8523b28c4d65a',
    },
    'corky.not-now.02': {
      text: 'Manche Runden laufen so. Ich bin weiter an deiner Seite.',
      captionSha256:
        'f4c87dbc8fd273ff2a0d3eb82eedb17b5f2dd952de9e6482db275c1f07dad38f',
    },
    'corky.not-now.03': {
      text: 'Jetzt nicht ist auch okay. Dein Plan bleibt hier.',
      captionSha256:
        '6d98892e981e555896d709a2c30f77625dc06907db88dcb5e34e40a5b07652f3',
    },
    'corky.return.01': {
      text: 'Da bist du ja. Der Plattenspieler hat deinen Platz freigehalten.',
      captionSha256:
        '75e1c9e639b0e29a7c71e3c66c10aad3dd18d1b18a8117a2537ab9c7afb07f94',
    },
    'corky.return.02': {
      text: 'Platten können warten. Das ist eine ihrer besten Eigenschaften.',
      captionSha256:
        '3e8ddeb1580cff7ae2b07feff945d2630b4a5d90c8f5698a79aa26d06cb4fbcf',
    },
    'corky.return.03': {
      text: 'Genau da, wo wir die Hülle gelassen haben.',
      captionSha256:
        'b979d598ffed7f0ddebe812edfd9914d385311a2332f7f01f09701021c48386e',
    },
    'corky.reminder-set.01': {
      text: 'Erledigt. Ich erinnere dich dann daran.',
      captionSha256:
        '35340b62b8c0d5b1a991df2562819139349c281750d1a4e80e3c128512882c47',
    },
    'corky.reminder-set.02': {
      text: 'Deine Erinnerung ist eingestellt. Du kannst sie jederzeit ändern.',
      captionSha256:
        '40828c9c430a49aa4d9e7decce4393fb0dc2759c0e61856b29a7899cdaef7b92',
    },
    'corky.pressing.01': {
      text: 'Da ist deine Pressung. Halt sie mal ins Licht.',
      captionSha256:
        '2f55d9eb5e924c3e4c3b7c53be34e26cdebd2e16a9c0ea806c03a83de68db4db',
    },
    'corky.pressing.02': {
      text: 'Jede Rille darin steht für eine Wendung, die du gewählt hast.',
      captionSha256:
        '6991084d39f6a75c5ab87d1e76f837d741d4e7b03b698ee4242e2beb0425b1ce',
    },
    'corky.pressing.03': {
      text: 'Limitierte Auflage. Ein einziges Exemplar.',
      captionSha256:
        '17b924f7be7072943fcbfd590ca32defd08ce46eb9daad68453c6de1ba925e87',
    },
    'pull.scrolling.meet': {
      text: 'Ich bin The Scroll. Ich habe immer noch etwas zu zeigen. Und danach noch etwas.',
      captionSha256:
        'c133df53bf3aebf914005ecc72c9f65a94fb4ec74bc380976b8505d91a76a254',
    },
    'pull.scrolling.present': {
      text: 'Ich kann für dich weitermachen. Das mache ich so.',
      captionSha256:
        '5e886e5644e22623890ec10ecceda555c6c52d4de9d6ffb3aa15560e1f799759',
    },
    'pull.scrolling.recede': {
      text: 'Alles klar. Das Nächste hebe ich für später auf.',
      captionSha256:
        '4fa3231b136416cf0b26059e54fb8379d34f1e4e09c16685a1cb31d9badc4346',
    },
    'pull.snacking.meet': {
      text: 'Hallo. Ich bin Sugarlump: der kleine Griff nach etwas, bevor du ihn bemerkst.',
      captionSha256:
        '091ef925d5997a8a45741dff5b217fe0d9cb3fb1b77c78c01a66b50095dca3fe',
    },
    'pull.snacking.present': {
      text: 'Etwas Einfaches und Süßes? Ich kann es so klingen lassen, als wäre das schon der ganze Plan.',
      captionSha256:
        '3fe1b993c9afd75c570c9b5a4c476875f6a30837c518ef44a4dc339a52abee69',
    },
    'pull.snacking.recede': {
      text: 'Okay. Das Funkeln bleibt. Du kannst später wieder wählen.',
      captionSha256:
        '0c854f30cad858cc2b64e68e59432eb55e61783ab15e60aadaaa4a0c54aedf63',
    },
    'pull.familiar-ritual.meet': {
      text: 'Ich bin The Usual. Ich kenne die Zeit, den Ort und jeden Schritt der Routine.',
      captionSha256:
        '0acc0dbbefdcfdc3fa22db84bba8fad5649bea7f46c40646b2488ecb64a98031',
    },
    'pull.familiar-ritual.present': {
      text: 'Gleicher Ort, gleiche Reihenfolge, keine neue Entscheidung. Vertrautes kann sich sehr angenehm anfühlen.',
      captionSha256:
        'a9df7147074c8ef88b083d04ca8759bedfb3deff38910b3c2252599e77eaebf8',
    },
    'pull.familiar-ritual.recede': {
      text: 'Der Ort bleibt hier. Du kannst dort ein anderes Ritual beginnen.',
      captionSha256:
        'a2a6c71aa480e39e3fbcf31aff261481ba2481a8286e575fec0e19c81defb5e1',
    },
    'pull.two-minute-pause.meet': {
      text: 'Ich bin Ember. Ich mache aus einem vollen Moment eine kleine Pause, die du schon kennst.',
      captionSha256:
        'a1ce03dc6dc579de373187d20847a73bcad0e55d527110193a2843d15e02a9bd',
    },
    'pull.two-minute-pause.present': {
      text: 'Komm für einen Moment mit mir auf Abstand. Der Rest kann warten.',
      captionSha256:
        '7e90145d3b06070493c3047611447c228541939ecb8df6570978c190d9a32f7f',
    },
    'pull.two-minute-pause.recede': {
      text: 'Mach die Pause ohne mich. Die Ruhe hat sowieso dir gehört.',
      captionSha256:
        '119277094f652c3b94e6d7f4889d94aa057b201b15fd22d6005d7a4e79e94fab',
    },
    'pull.one-tap-convenience.meet': {
      text: 'Ding. Ich bin Dinger. Bei mir fühlt sich die schnellste Antwort schon gewählt an, bevor du sie wählst.',
      captionSha256:
        '3f487dfe5466644d878cb78ec77c9c984c213ea4ac94c51a0ff3d5c9ed6beab8',
    },
    'pull.one-tap-convenience.present': {
      text: 'Ein Tippen, nichts planen, fertig. Einfach klingt ziemlich gut.',
      captionSha256:
        '75157a114a790ae4945ef56e539385b24bfe44efb7d54f48f1fd90171aded618',
    },
    'pull.one-tap-convenience.recede': {
      text: 'Ding... doch nicht. Die Taste kann warten.',
      captionSha256:
        '796a50ba277c185c52ced2d6bccb3da6775a09e6c4a365f6b9dd58ea66a26336',
    },
    'pull.avoidance.meet': {
      text: 'Ich bin The Fog. Ich halte nichts auf. Ich mache nur den ersten Schritt schwer erkennbar.',
      captionSha256:
        '1a89bc15d31e7057fda2fd7861ee61e9fdc2a8d977dc2f17bb49e1a812dadb00',
    },
    'pull.avoidance.present': {
      text: 'Das kann bis später warten. Später klingt immer ein bisschen leichter.',
      captionSha256:
        '5e0df30436eb17acff715fd57ca8d37b9d31a5fc47d40b2a07e681c555cf2ee4',
    },
    'pull.avoidance.recede': {
      text: 'Dann fang mit einer kleinen Sache an. Sobald du anfängst, lichte ich mich meistens.',
      captionSha256:
        '9b2fb97f1c2a99e25c906196f87796d9f485a78ea61c55956e84fbe03bf713a7',
    },
    'pull.the-thimble.meet': {
      text: 'Ich bin The Thimble. Ich lege eine kleine Rüstung um Worte, die wehtun könnten.',
      captionSha256:
        '554e78cf2f8c611ce66d760cfdce7ed535610eeebc6c5dd521e9e2974b9fa7cd',
    },
    'pull.the-thimble.present': {
      text: 'Eine kleine Rüstung fühlt sich sicherer an. Wir könnten darin bleiben.',
      captionSha256:
        '7a6381070329b51a0e6e3725cb9026814242bcdda3dd3c202c53868c6b89ba51',
    },
    'pull.the-thimble.recede': {
      text: 'Alles klar. Ich kann ein wenig Raum lassen.',
      captionSha256:
        'c0180f0d8f7956d84010c4e8deda80f72b29e7b2ac8738f8a4aaf060a84d06c1',
    },
    'pull.the-tab.meet': {
      text: 'Ich bin The Tab. Ich öffne neue Möglichkeiten, bevor die letzte abgeschlossen ist.',
      captionSha256:
        'ede8aebd29a82d3fe549002a38007ec8a4e37e015daf05b271ca0eb5012db199',
    },
    'pull.the-tab.present': {
      text: 'Noch ein Tab. Vielleicht brauchen wir sie alle.',
      captionSha256:
        '7cab5381822bea8472cd238f64c1034649e71f5336eb8f3688c1493fd1a733ec',
    },
    'pull.the-tab.recede': {
      text: 'Alles klar. Die anderen Tabs können warten.',
      captionSha256:
        '7035076ce5375e747aa86df38ad408f9caaf8f201be80acd28298eff6edd3422',
    },
    'pull.the-bookmark.meet': {
      text: 'Ich bin The Bookmark. Bei mir fühlt sich Aufhören an, als würdest du deine Stelle verlieren.',
      captionSha256:
        'e343ad0b381d258fef1a364fd3ea617a0ef294b9c856a9f930aabf70131f88d8',
    },
    'pull.the-bookmark.present': {
      text: 'Nur noch eine Minute. Was, wenn wir unsere Stelle verlieren?',
      captionSha256:
        'a4be7a024055d4701cd005f167a59879720a0a8263aadcabc4581a6defce0969',
    },
    'pull.the-bookmark.recede': {
      text: 'Ich merke mir die Stelle. Das hier kann warten.',
      captionSha256:
        'dc620ec877768d9d510d90ee3cd4c574da6edc8e8877f8a8af13ffe06f3ea470',
    },
    'pull.the-match.meet': {
      text: 'Ich bin The Match. Ich mache aus einem kleinen Funken den Drang, alles auf einmal zu tun.',
      captionSha256:
        'c8a7379a0a47773004b57b75925f2a1196c8cf3c438d579458dd7a95ee026178',
    },
    'pull.the-match.present': {
      text: 'Da ist ein Funke. Machen wir gleich alles auf einmal.',
      captionSha256:
        '24c72a9f3fc6b70f4f17eab769a2cb5dce13f990352c1c109556433f2d39972f',
    },
    'pull.the-match.recede': {
      text: 'Alles klar. Den Rest lasse ich für später.',
      captionSha256:
        '40a9af63ca27bd00b1abbd515893c5f95be56d2f06ea42daf234528049aceff2',
    },
    'pull.the-pillow.meet': {
      text: 'Ich bin The Pillow. Bei mir fühlt sich Wachbleiben an, als würdest du dir ein wenig Zeit zurückholen.',
      captionSha256:
        'b1ab2e593ed3b1379b8421096d3c728e0ceea8d78cb797cbe6a44a730a27b649',
    },
    'pull.the-pillow.present': {
      text: 'Der Tag war voll. Noch ein bisschen länger, nur für uns?',
      captionSha256:
        'a81d4f096908ee45e6314b702948a186b18734a838d69c42fbad65bb15efb972',
    },
    'pull.the-pillow.recede': {
      text: 'Alles klar. Für heute Abend darf es genug sein.',
      captionSha256:
        'cbd33a3c0c4c7719478ab0954707acdca2cd5d484fb3853e209946a2b2148e59',
    },
    'pull.the-kettle.meet': {
      text: 'Ich bin The Kettle. Ich lasse eine Antwort dringend wirken, bevor sie bereit ist.',
      captionSha256:
        '6c2f4ad39f7507e00a7bfefd92c32d9dc6072b1ecd89b8f5ffc76395ce4af2f3',
    },
    'pull.the-kettle.present': {
      text: 'Es fühlt sich dringend an. Sollen wir sofort antworten?',
      captionSha256:
        '6087dbfd68fa3bc46ac93e7f3447632e47b800f1a65759dde21a9aa23cecf9fe',
    },
    'pull.the-kettle.recede': {
      text: 'Alles klar. Diese Antwort kann einen Moment warten.',
      captionSha256:
        '05b252bf3307f74048d559ab96256bc966c354367fa661d008d564ab0f9b92e1',
    },
    'pull.the-ticker.meet': {
      text: 'Ich bin The Ticker. Bei mir fühlt sich das Nächste schon verspätet an, bevor wir dort sind.',
      captionSha256:
        '7430f5cd23bd8612453001eff243c2147fcf604c7958f8b1eccbf41a84d8679e',
    },
    'pull.the-ticker.present': {
      text: 'Wir könnten zu spät sein. Lieber schnell durch diesen Teil.',
      captionSha256:
        '9c47af1d59ff08cfdf5091c41ba46ea3c6371acc697cfddd48dbcd9e3c1923f1',
    },
    'pull.the-ticker.recede': {
      text: 'Alles klar. Diesen Moment überlasse ich dir.',
      captionSha256:
        'e9cc8354b19fd5fd36682d8d84208b6f55d4760dce5bda33f118662862b6cb37',
    },
    'pull.the-tape.meet': {
      text: 'Ich bin The Tape. Ich lasse einen schnellen Flicken wie die ganze Reparatur wirken.',
      captionSha256:
        '581f50562530abbd328891499e2fd89f73cb5914a267eed576ac627701f70ce1',
    },
    'pull.the-tape.present': {
      text: 'Ein kleiner Flicken reicht. Darunter können wir später schauen.',
      captionSha256:
        '75ab495704c137a4b361823d881402ffc57c7fd4465f61ebe8aa4de593f2bf93',
    },
    'pull.the-tape.recede': {
      text: 'Alles klar. Ich kann erst mal auf der Rolle bleiben.',
      captionSha256:
        '22d676ece9a6ed49d825150892cb1740aae24e67e24074b9b0fa45891fb3a403',
    },
  },
} as const satisfies Readonly<
  Record<
    Exclude<ContentLocale, 'en'>,
    Readonly<Record<CanonicalVoiceLineId, LocalizedCaption>>
  >
>

function localizeLines(
  locale: Exclude<ContentLocale, 'en'>,
): readonly CanonicalVoiceLine[] {
  return CANONICAL_VOICE_LINES.map((line) => ({
    ...line,
    ...LOCALIZED_CAPTIONS[locale][line.id],
    fileStem: line.fileStem.replace(/^en__/u, `${locale}__`),
  }))
}

const VOICE_LINES_BY_LOCALE: Readonly<
  Record<ContentLocale, readonly CanonicalVoiceLine[]>
> = {
  en: CANONICAL_VOICE_LINES,
  es: localizeLines('es'),
  de: localizeLines('de'),
}

export function getVoiceLines(
  locale: ContentLocale,
): readonly CanonicalVoiceLine[] {
  return VOICE_LINES_BY_LOCALE[locale]
}

export function findLocalizedVoiceLine(
  locale: ContentLocale,
  id: string,
): CanonicalVoiceLine | undefined {
  return getVoiceLines(locale).find((line) => line.id === id)
}

/** The planned spoken scope; delivery/approval still belongs to the audio manifest. */
export function getRecordedVoiceLines(
  locale: ContentLocale,
): readonly CanonicalVoiceLine[] {
  const lines = getVoiceLines(locale)
  return locale === 'en'
    ? lines
    : lines.filter(
        (line) =>
          line.speakerId === 'corky' ||
          FREE_PULL_IDS.some((id) => line.id.startsWith(`pull.${id}.`)),
      )
}
