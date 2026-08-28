// ============================================================
// Canonical voice lines — frozen V2 captions and recording identities
// ============================================================
//
// Captions are product authority, not transcriptions of delivered audio. Their
// hashes bind a recording manifest to the exact NFC UTF-8 text without asking
// browser runtime code to calculate a digest asynchronously.

export const VOICE_SPEAKER_IDS = [
  'corky',
  'the-scroll',
  'sugarlump',
  'the-usual',
  'ember',
  'dinger',
  'the-fog',
] as const

export type VoiceSpeakerId = (typeof VOICE_SPEAKER_IDS)[number]

export const VOICE_LINE_KINDS = [
  'onboarding',
  'cue-open',
  'side-b',
  'not-now',
  'return',
  'reminder-set',
  'pressing',
  'meet',
  'present',
  'recede',
] as const

export type VoiceLineKind = (typeof VOICE_LINE_KINDS)[number]

export interface CanonicalVoiceLine {
  readonly id: string
  readonly text: string
  readonly captionSha256: string
  readonly speakerId: VoiceSpeakerId
  readonly fileStem: string
  readonly kind: VoiceLineKind
}

export const CANONICAL_VOICE_LINES = [
  {
    id: 'corky.onboarding.greeting',
    text: 'Hi there, I am Corky.',
    captionSha256:
      '4d74d9080a6e32473f9a83d5956dae4e47dfc8861f0fae159e8a4e4c9febd805',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-greeting',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.pull-choice',
    text: 'A Pull is a familiar pattern that starts before you mean it to. Choose the one you want to notice sooner.',
    captionSha256:
      '4fe141a27c26ba96b3eea66681e7249ce6bd5d8888549412f63248fbd2e7aa23',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-pull-choice',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.cue-context',
    text: 'A cue is what brings the Pull into view: a time, a place, a feeling, or a reminder.',
    captionSha256:
      '2996fcb0665b33eda5d12c259104ef7171804f608a98f83f4ee0f05c213dafe8',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-cue-context',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.sides',
    text: 'Side A is what usually happens. Side B is one small thing you would rather begin.',
    captionSha256:
      '240e4e4671d760c953b737d81ae18e867aeeb92fec6ceba424e5452475dab82a',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-sides',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.spin',
    text: 'I’ll start the record. Stop it when these two sides feel like yours.',
    captionSha256:
      'c3ea3b7ac8211bcd9562632e563e17de326c6222c99f81dfa94c0e96311497b3',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-spin',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.saved',
    text: 'There. Your plan is saved.',
    captionSha256:
      'ca21f3ce0b484c0c6c7c060ebe0f3f8aa51d023a1719d0e637efded841557f06',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-saved',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.reminder',
    text: 'If you want, choose a time and I’ll bring this plan back. Or leave it for later.',
    captionSha256:
      'bc7389a56856a5b26b3570f2286199fefce9b27b27667b7ed0987919ca9e6c71',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-reminder',
    kind: 'onboarding',
  },
  {
    id: 'corky.onboarding.close',
    text: 'Your plan is ready. I’ll be beside.',
    captionSha256:
      'd729954f914357bc4c1e3aef9b5c2341230ce66e4a7e031ba8a435dd97a806ba',
    speakerId: 'corky',
    fileStem: 'en__corky__onboarding-close',
    kind: 'onboarding',
  },
  {
    id: 'corky.cue-open.01',
    text: 'Needle’s hovering. No rush.',
    captionSha256:
      'e15171581fc255f3685a05add36880a8437799cecdd480e25255a4f832343523',
    speakerId: 'corky',
    fileStem: 'en__corky__cue-open-01',
    kind: 'cue-open',
  },
  {
    id: 'corky.cue-open.02',
    text: 'Your plan is here when you want it.',
    captionSha256:
      '5daa5af9afa8dad71937238f88c2802a276125cef93e7efc67cc110aacc0d6cd',
    speakerId: 'corky',
    fileStem: 'en__corky__cue-open-02',
    kind: 'cue-open',
  },
  {
    id: 'corky.cue-open.03',
    text: 'Quick spin with me?',
    captionSha256:
      '5fb720560eb852dba1a22ce7b5c28818a5900e0fcbfe409fd4d05409cc3f9a21',
    speakerId: 'corky',
    fileStem: 'en__corky__cue-open-03',
    kind: 'cue-open',
  },
  {
    id: 'corky.side-b.01',
    text: 'That’s a clean groove.',
    captionSha256:
      '88d037855c0da7e0291b1a7073649c31534d220bfd0d8da2ec20bb9a47fa3f17',
    speakerId: 'corky',
    fileStem: 'en__corky__side-b-01',
    kind: 'side-b',
  },
  {
    id: 'corky.side-b.02',
    text: 'Heard the cue, chose the track. That’s the craft.',
    captionSha256:
      '57a912f4e9c2120d6cb2f3f8664e5d1ad5d49dbe17af809636fd9d48314d884b',
    speakerId: 'corky',
    fileStem: 'en__corky__side-b-02',
    kind: 'side-b',
  },
  {
    id: 'corky.side-b.03',
    text: 'Good side, this one.',
    captionSha256:
      '451f8a415308e917f0d008b827bb28ddbfbbb4d76f20b4491467dbf96d54583d',
    speakerId: 'corky',
    fileStem: 'en__corky__side-b-03',
    kind: 'side-b',
  },
  {
    id: 'corky.not-now.01',
    text: 'Noted, not graded.',
    captionSha256:
      '9c94366367bc59672c971c209f985ee7853c2e9c70aa9dfeba9eaed760a2158f',
    speakerId: 'corky',
    fileStem: 'en__corky__not-now-01',
    kind: 'not-now',
  },
  {
    id: 'corky.not-now.02',
    text: 'Some spins go that way. I’m still beside you.',
    captionSha256:
      'cafe5658d3858c30c42c61d534473a4dfe06c07e767266bd7b10e4e09387ffb2',
    speakerId: 'corky',
    fileStem: 'en__corky__not-now-02',
    kind: 'not-now',
  },
  {
    id: 'corky.not-now.03',
    text: 'Not now is okay. Your plan will still be here.',
    captionSha256:
      '005c598da489f0160c529b659a88ef396d624d9e7ea12ca07fbbaa506d8ec8e7',
    speakerId: 'corky',
    fileStem: 'en__corky__not-now-03',
    kind: 'not-now',
  },
  {
    id: 'corky.return.01',
    text: 'There you are. The turntable kept your place.',
    captionSha256:
      'db91e3420f647779f4385be19b82070ef9705602b013be9b194972272cccee04',
    speakerId: 'corky',
    fileStem: 'en__corky__return-01',
    kind: 'return',
  },
  {
    id: 'corky.return.02',
    text: 'Records wait. It’s one of their best features.',
    captionSha256:
      '9c1e31ec76e02d254ef2b8ea0bfb1bdb23cec43c67855c5861567a9da52058aa',
    speakerId: 'corky',
    fileStem: 'en__corky__return-02',
    kind: 'return',
  },
  {
    id: 'corky.return.03',
    text: 'Right where we left the sleeve.',
    captionSha256:
      '1c01926781b38c6023bc8f79aea888a9e277c337a508d0a0e9e66c925975e2f1',
    speakerId: 'corky',
    fileStem: 'en__corky__return-03',
    kind: 'return',
  },
  {
    id: 'corky.reminder-set.01',
    text: 'Done. I’ll bring it back then.',
    captionSha256:
      'ffb6bade1a07f2793fb0de99847ad7c257bedf478981535b7b28941d7ffc756f',
    speakerId: 'corky',
    fileStem: 'en__corky__reminder-set-01',
    kind: 'reminder-set',
  },
  {
    id: 'corky.reminder-set.02',
    text: 'Your reminder is set. You can change it whenever you like.',
    captionSha256:
      '7ee0dfe2563956875bff10bec3e1407c57fbee66160c512a753ac0d00423f02e',
    speakerId: 'corky',
    fileStem: 'en__corky__reminder-set-02',
    kind: 'reminder-set',
  },
  {
    id: 'corky.pressing.01',
    text: 'That’s a pressing. Hold it up to the light.',
    captionSha256:
      'eca2248625d308c5e663101f70ca4375e777f5aa162ca87b8d831308a3945c05',
    speakerId: 'corky',
    fileStem: 'en__corky__pressing-01',
    kind: 'pressing',
  },
  {
    id: 'corky.pressing.02',
    text: 'Every groove in this one is a turn you made.',
    captionSha256:
      'cc73823ece290cc5a60b5ff11625e89e9b2c8e9d5dcabe406180f0503025e0f4',
    speakerId: 'corky',
    fileStem: 'en__corky__pressing-02',
    kind: 'pressing',
  },
  {
    id: 'corky.pressing.03',
    text: 'Limited edition. Run of one.',
    captionSha256:
      'e9116fbf1e494f4396304eb6975f982fc1cd492cc35330535017e97be98e0b9f',
    speakerId: 'corky',
    fileStem: 'en__corky__pressing-03',
    kind: 'pressing',
  },
  {
    id: 'pull.scrolling.meet',
    text: 'I’m The Scroll. I always have one more thing to show you, and then one more after that.',
    captionSha256:
      'bf571883693058b075bb34dde614cf0918efd72e275571ec9bad3bbc56dec4be',
    speakerId: 'the-scroll',
    fileStem: 'en__the-scroll__meet',
    kind: 'meet',
  },
  {
    id: 'pull.scrolling.present',
    text: 'I can keep going for you. That’s what I do.',
    captionSha256:
      '3602330934a53153f78c530615a78788ddfc78062fdeda655cb5e57ad9b7d19b',
    speakerId: 'the-scroll',
    fileStem: 'en__the-scroll__present',
    kind: 'present',
  },
  {
    id: 'pull.scrolling.recede',
    text: 'All right. I’ll keep the next thing for later.',
    captionSha256:
      '9e727ecc35cfc0503948b76b63871ff9def965fb030d7a71e4f93801fd5277b4',
    speakerId: 'the-scroll',
    fileStem: 'en__the-scroll__recede',
    kind: 'recede',
  },
  {
    id: 'pull.snacking.meet',
    text: 'Hi. I’m Sugarlump—the little reach that happens before you notice the reaching.',
    captionSha256:
      '56e322fecc1782d88f5fbc775e4d5bc29b673e1743c29106a75153ac94ddbcf5',
    speakerId: 'sugarlump',
    fileStem: 'en__sugarlump__meet',
    kind: 'meet',
  },
  {
    id: 'pull.snacking.present',
    text: 'Something easy and sweet? I can make that sound like the whole plan.',
    captionSha256:
      '4fee7b53ac9835584ab7de99ab905ae071c15f408dad59bfbc8856d94f2855e4',
    speakerId: 'sugarlump',
    fileStem: 'en__sugarlump__present',
    kind: 'present',
  },
  {
    id: 'pull.snacking.recede',
    text: 'Okay. The sparkle keeps. You can choose again later.',
    captionSha256:
      '548abb48687a650381dce4ea304419369a968cb0941eef585ec310143240b83b',
    speakerId: 'sugarlump',
    fileStem: 'en__sugarlump__recede',
    kind: 'recede',
  },
  {
    id: 'pull.familiar-ritual.meet',
    text: 'I’m The Usual. I know the time, the place, and the shape of the routine.',
    captionSha256:
      '1dcb4ee30aa75cc8a7fd154064eb6697a112224a61d6f3d3a9bfdd7d417035f8',
    speakerId: 'the-usual',
    fileStem: 'en__the-usual__meet',
    kind: 'meet',
  },
  {
    id: 'pull.familiar-ritual.present',
    text: 'Same place, same order, no new decision. Familiar can feel very comfortable.',
    captionSha256:
      '4e1d4a0848b8760922973d9ccb68c5c82442cab94f80c1a067f3b689fa6cb5ef',
    speakerId: 'the-usual',
    fileStem: 'en__the-usual__present',
    kind: 'present',
  },
  {
    id: 'pull.familiar-ritual.recede',
    text: 'The place will still be here. You can make a different ritual in it.',
    captionSha256:
      '8a87875698dfc05d8d20d44950e316d5933012713ac9245331ba68236184b2f9',
    speakerId: 'the-usual',
    fileStem: 'en__the-usual__recede',
    kind: 'recede',
  },
  {
    id: 'pull.two-minute-pause.meet',
    text: 'I’m Ember. I turn a busy moment into one small pause you already know.',
    captionSha256:
      '3f907d6a6d42907c3e291da6fe0f74e4f343ff48e35fae6c0647132ea28d5e56',
    speakerId: 'ember',
    fileStem: 'en__ember__meet',
    kind: 'meet',
  },
  {
    id: 'pull.two-minute-pause.present',
    text: 'Step away with me for a minute. The rest can wait.',
    captionSha256:
      '36d62b8fc9ec84522e74272221059687e5a5bcc5dbd0cad5fe20f76a6a159924',
    speakerId: 'ember',
    fileStem: 'en__ember__present',
    kind: 'present',
  },
  {
    id: 'pull.two-minute-pause.recede',
    text: 'Take the pause without me. The quiet part was yours anyway.',
    captionSha256:
      'a7559c1a930415ae271a1ab9880708bc6934d45d4b084bf17555311afaead9c4',
    speakerId: 'ember',
    fileStem: 'en__ember__recede',
    kind: 'recede',
  },
  {
    id: 'pull.one-tap-convenience.meet',
    text: 'Ding. I’m Dinger. I make the fastest answer feel chosen before you choose it.',
    captionSha256:
      '93ff13b3f18c1b4d5f1f141393b2dab6f90cf4bddb3fe794fb2475cf099143d7',
    speakerId: 'dinger',
    fileStem: 'en__dinger__meet',
    kind: 'meet',
  },
  {
    id: 'pull.one-tap-convenience.present',
    text: 'One tap, no planning, done. Easy has a very good sound.',
    captionSha256:
      '1458f912babc626dc4d87a1099364ef22b1b094c71578b96466f3071b7f5fb67',
    speakerId: 'dinger',
    fileStem: 'en__dinger__present',
    kind: 'present',
  },
  {
    id: 'pull.one-tap-convenience.recede',
    text: 'Ding—unrung. The button can wait.',
    captionSha256:
      '860b9d15570e900d0e5412974d24c1840167fe17e4dba00ebd6b83bf84338540',
    speakerId: 'dinger',
    fileStem: 'en__dinger__recede',
    kind: 'recede',
  },
  {
    id: 'pull.avoidance.meet',
    text: 'I’m The Fog. I’m not stopping anything. I’m just making the first step hard to see.',
    captionSha256:
      '354f881afac8a220e1f763bcf809dbb3147042c734be7d9f65a42f53af46d5a2',
    speakerId: 'the-fog',
    fileStem: 'en__the-fog__meet',
    kind: 'meet',
  },
  {
    id: 'pull.avoidance.present',
    text: 'It can wait until later. Later always sounds a little easier.',
    captionSha256:
      '487f6ae4a039bd51852652d119cf959d70458617f1add6e97a42d739bd30869c',
    speakerId: 'the-fog',
    fileStem: 'en__the-fog__present',
    kind: 'present',
  },
  {
    id: 'pull.avoidance.recede',
    text: 'Start with one small thing, then. I tend to thin out once you begin.',
    captionSha256:
      'b3e09cbbc16f280ddf51743c874e249297d5a90f8f6a5d82fa164251f329f256',
    speakerId: 'the-fog',
    fileStem: 'en__the-fog__recede',
    kind: 'recede',
  },
] as const satisfies readonly CanonicalVoiceLine[]

export type CanonicalVoiceLineId = (typeof CANONICAL_VOICE_LINES)[number]['id']

export function findCanonicalVoiceLine(
  id: string,
): CanonicalVoiceLine | undefined {
  return CANONICAL_VOICE_LINES.find((line) => line.id === id)
}
