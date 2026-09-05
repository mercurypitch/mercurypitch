// ============================================================
// Selected character recordings — approved V1 Corky, Sugarlump and Scroll
// ============================================================
//
// Corky 02-i, Sugarlump 02-e and Scroll 02-f. These are exact packaged
// delivery bytes; canonical captions and semantic ids remain authoritative.

import { registerCharacterVoiceRecordings } from './character-voice-recordings'

export const SELECTED_CHARACTER_VOICE_REVISION =
  'besidecue-v1-selected-voices-01'

export const SELECTED_CHARACTER_VOICE_AUDIO_ASSETS =
  registerCharacterVoiceRecordings([
    {
      lineId: 'corky.onboarding.greeting',
      captionSha256:
        '4d74d9080a6e32473f9a83d5956dae4e47dfc8861f0fae159e8a4e4c9febd805',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-greeting__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'd13be42cec087cec140e4ddc5f4d700f54df0de59103210799beb3e535ca03f9',
          byteLength: 31003,
          durationMs: 1869.021,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.pull-choice',
      captionSha256:
        '4fe141a27c26ba96b3eea66681e7249ce6bd5d8888549412f63248fbd2e7aa23',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-pull-choice__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'cb6d032d24d566e175f262bf13c5b0a06bdc0fa0c5d0b8737a4abd081ed53939',
          byteLength: 120634,
          durationMs: 7500,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.cue-context',
      captionSha256:
        '2996fcb0665b33eda5d12c259104ef7171804f608a98f83f4ee0f05c213dafe8',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-cue-context__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '92e86dfb0749db6a1b903520d255495ca73f2774a1a8821a1dd0db9225b4648c',
          byteLength: 116548,
          durationMs: 7180,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.sides',
      captionSha256:
        '240e4e4671d760c953b737d81ae18e867aeeb92fec6ceba424e5452475dab82a',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-sides__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'e363d2832b7d400fb1eaa2cde28fbf33e2d5f8d4ae2be0466e75c598ad57c2c8',
          byteLength: 132366,
          durationMs: 8140.000000000001,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.spin',
      captionSha256:
        'c3ea3b7ac8211bcd9562632e563e17de326c6222c99f81dfa94c0e96311497b3',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-spin__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '2e743d26b6538cac8f801e76183d94b04f643be75428964fd23875dae87bd1cb',
          byteLength: 75664,
          durationMs: 4700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.saved',
      captionSha256:
        'ca21f3ce0b484c0c6c7c060ebe0f3f8aa51d023a1719d0e637efded841557f06',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-saved__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '9d8f099244e081d575255f61d2f33d31f54c9a3b6967828ae125e546c7c3f124',
          byteLength: 43884,
          durationMs: 2780,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.reminder',
      captionSha256:
        'bc7389a56856a5b26b3570f2286199fefce9b27b27667b7ed0987919ca9e6c71',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-reminder__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'fc7b1a7bbaab0d1e031e18ce5c54022fbd9d186f2a5049dd31feabd6fffc0823',
          byteLength: 84821,
          durationMs: 5340,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.close',
      captionSha256:
        'd729954f914357bc4c1e3aef9b5c2341230ce66e4a7e031ba8a435dd97a806ba',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__onboarding-close__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8047ed6bb97d6357c90fb9e128fb1902eaf31d98901b4d8df1db9220da67547b',
          byteLength: 47368,
          durationMs: 3100,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.01',
      captionSha256:
        'e15171581fc255f3685a05add36880a8437799cecdd480e25255a4f832343523',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__cue-open-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '6f5a9006df77fde7d0f0591ff1bae2c6249451ab5de9f45c8736d96b066c22b9',
          byteLength: 35640,
          durationMs: 2190,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.02',
      captionSha256:
        '5daa5af9afa8dad71937238f88c2802a276125cef93e7efc67cc110aacc0d6cd',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__cue-open-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '909af2f565e2e49e868610c75734063b879e3587da6496967266bee80e835061',
          byteLength: 38003,
          durationMs: 2380,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.03',
      captionSha256:
        '5fb720560eb852dba1a22ce7b5c28818a5900e0fcbfe409fd4d05409cc3f9a21',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__cue-open-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '60701135fee3d220fba19d679beb161315b11c5f395a3eac1693c3b7ee302159',
          byteLength: 17633,
          durationMs: 1180,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.01',
      captionSha256:
        '88d037855c0da7e0291b1a7073649c31534d220bfd0d8da2ec20bb9a47fa3f17',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__side-b-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'ec5f022c9c7153411882b2c16f9798c5984e4413d47430e20b2a97dc62f3d556',
          byteLength: 29904,
          durationMs: 1980,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.02',
      captionSha256:
        '57a912f4e9c2120d6cb2f3f8664e5d1ad5d49dbe17af809636fd9d48314d884b',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__side-b-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '073b60a15152eb3da2a117ad7423502d4cf97e74bbd83ede642e9c06d0bca299',
          byteLength: 64249,
          durationMs: 4059.9999999999995,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.03',
      captionSha256:
        '451f8a415308e917f0d008b827bb28ddbfbbb4d76f20b4491467dbf96d54583d',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__side-b-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'd4ff3145913d768e6dc16185db622f276afb2b02012834653715ca553d3c0835',
          byteLength: 27003,
          durationMs: 1630,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.01',
      captionSha256:
        '9c94366367bc59672c971c209f985ee7853c2e9c70aa9dfeba9eaed760a2158f',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__not-now-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'd4b5e9040feb8fe4ca8867e64d6f000a529e806b1b2559f839f7aa18aa29645b',
          byteLength: 30391,
          durationMs: 1840,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.02',
      captionSha256:
        'cafe5658d3858c30c42c61d534473a4dfe06c07e767266bd7b10e4e09387ffb2',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__not-now-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '7dbe6f5c436a98e1455bbfecd5a4b7ca37107005a19c57deaadf22fae368fbf1',
          byteLength: 59776,
          durationMs: 3820,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.03',
      captionSha256:
        '005c598da489f0160c529b659a88ef396d624d9e7ea12ca07fbbaa506d8ec8e7',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__not-now-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '800f5f0a0105b5c230a94cff6d4ec88331a1c00b555729f50251af72b0f5d1e7',
          byteLength: 65522,
          durationMs: 4140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.01',
      captionSha256:
        'db91e3420f647779f4385be19b82070ef9705602b013be9b194972272cccee04',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__return-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '7930a96f18dd9698d2e16f4914ee58f8f98997fb00753208e75de687207c1adb',
          byteLength: 55131,
          durationMs: 3580,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.02',
      captionSha256:
        '9c1e31ec76e02d254ef2b8ea0bfb1bdb23cec43c67855c5861567a9da52058aa',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__return-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5e1389b43ecd7d8fbf05996b4923bfcc6cb03f76debac06644c132b79c238ab1',
          byteLength: 52104,
          durationMs: 3340,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.03',
      captionSha256:
        '1c01926781b38c6023bc8f79aea888a9e277c337a508d0a0e9e66c925975e2f1',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__return-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '42d88161966d4938bada13a6b8080002002062d50f78533c52e3a7b4c422e93d',
          byteLength: 34393,
          durationMs: 2300,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.01',
      captionSha256:
        'ffb6bade1a07f2793fb0de99847ad7c257bedf478981535b7b28941d7ffc756f',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__reminder-set-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '866d162d7155a8517001076635586b6c3bcd475210eb130a7be4bb19eab55b5e',
          byteLength: 31960,
          durationMs: 2140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.02',
      captionSha256:
        '7ee0dfe2563956875bff10bec3e1407c57fbee66160c512a753ac0d00423f02e',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__reminder-set-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '0a72e4a906bc99cb112c591f0341e6f5a1d839337c39093ec55607935d4f0a19',
          byteLength: 60378,
          durationMs: 3820,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.01',
      captionSha256:
        'eca2248625d308c5e663101f70ca4375e777f5aa162ca87b8d831308a3945c05',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__pressing-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'f6cb8a5381b188bc9fec230c6ab3990a5ee6394b6fed3f3d5700e7876f233e5b',
          byteLength: 49225,
          durationMs: 3180,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.02',
      captionSha256:
        'cc73823ece290cc5a60b5ff11625e89e9b2c8e9d5dcabe406180f0503025e0f4',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__pressing-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '9d6d96634883a1a05d359cd81319a019a4ef283264650abb5b147ecde6467b78',
          byteLength: 51681,
          durationMs: 3180,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.03',
      captionSha256:
        'e9116fbf1e494f4396304eb6975f982fc1cd492cc35330535017e97be98e0b9f',
      sources: [
        {
          src: '/audio/voice/en/corky/en__corky__pressing-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'dccb6b6f380cb23f7bc78b8315b534c7e101da9b9a7d09e9dd1cbd1926f23d25',
          byteLength: 40828,
          durationMs: 2620,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.meet',
      captionSha256:
        '56e322fecc1782d88f5fbc775e4d5bc29b673e1743c29106a75153ac94ddbcf5',
      sources: [
        {
          src: '/audio/voice/en/sugarlump/en__sugarlump__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'aeff27a1725ad4bd590281b2351ab30387615af11c622d95ace3636438e887ae',
          byteLength: 97312,
          durationMs: 5969.021,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.present',
      captionSha256:
        '4fee7b53ac9835584ab7de99ab905ae071c15f408dad59bfbc8856d94f2855e4',
      sources: [
        {
          src: '/audio/voice/en/sugarlump/en__sugarlump__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '3c1a5c2e58c5905b3c970edd6287db4a795c9992e059bb3523b4f5480d4371ee',
          byteLength: 98275,
          durationMs: 6070,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.recede',
      captionSha256:
        '548abb48687a650381dce4ea304419369a968cb0941eef585ec310143240b83b',
      sources: [
        {
          src: '/audio/voice/en/sugarlump/en__sugarlump__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '42d8116abf269a35469e8094e303df71546c8bcbaade31892862765e26f105a3',
          byteLength: 66273,
          durationMs: 4221,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.meet',
      captionSha256:
        'bf571883693058b075bb34dde614cf0918efd72e275571ec9bad3bbc56dec4be',
      sources: [
        {
          src: '/audio/voice/en/the-scroll/en__the-scroll__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '2b930c0a5410b50d9179f884659dd9119d859bb87378f7f60b2233ed290c9724',
          byteLength: 101156,
          durationMs: 6170,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.present',
      captionSha256:
        '3602330934a53153f78c530615a78788ddfc78062fdeda655cb5e57ad9b7d19b',
      sources: [
        {
          src: '/audio/voice/en/the-scroll/en__the-scroll__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '23bd5b5667db8b44215771e0c379034fb6b30916b368e8f66d4c930e9288f9e5',
          byteLength: 55005,
          durationMs: 3410,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.recede',
      captionSha256:
        '9e727ecc35cfc0503948b76b63871ff9def965fb030d7a71e4f93801fd5277b4',
      sources: [
        {
          src: '/audio/voice/en/the-scroll/en__the-scroll__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'c90f0f55105b8e19293767cf32e972b86ad2d832ac8f2c5fa9268d9d0fedec71',
          byteLength: 52076,
          durationMs: 3320,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
  ])
