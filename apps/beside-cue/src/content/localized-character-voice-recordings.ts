// ============================================================
// Localized recordings — screened Spanish and German selected-cast deliveries
// ============================================================

import type { CharacterVoiceRecording } from './character-voice-recordings'
import type { ContentLocale } from './localized-voice-lines'

/** Generated but withheld for listening: possible spoken-word mismatches, never English fallbacks. */
export const WITHHELD_LOCALIZED_VOICE_LINE_IDS: Readonly<
  Record<Exclude<ContentLocale, 'en'>, readonly string[]>
> = {
  es: ['corky.not-now.02'],
  de: ['pull.familiar-ritual.present'],
}

/** Delivered bytes only. Missing bindings stay caption-only until the wording is confirmed. */
export const LOCALIZED_CHARACTER_VOICE_RECORDINGS: Readonly<
  Record<Exclude<ContentLocale, 'en'>, readonly CharacterVoiceRecording[]>
> = {
  es: [
    {
      lineId: 'corky.onboarding.greeting',
      captionSha256:
        '8d93b58c1094731f66fa27ddd992e7cb6b27d1d32043ba5f968ecc57c13cbe30',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-greeting__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '84fd5bff6fc622eb89a72ce86022361604376acde216dd29b09bc5985019d4f7',
          byteLength: 27594,
          durationMs: 1740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.pull-choice',
      captionSha256:
        'd2ea6e60d83551b2fd6593b9c8cf6cbab8630259ff37ed9677ad44f004e29de7',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-pull-choice__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'a6571497ef12cecb8c7f3f498af699323ae7067257eef51a132b07f53b8915d0',
          byteLength: 126949,
          durationMs: 7980,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.cue-context',
      captionSha256:
        'b5e000b39940ff4c40145bef6ea478ab40329b83f98a8925d389c554d62537ae',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-cue-context__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5eb55124ca6ad30fb4039508bf826614b74949c645cd25975485988c30e2070a',
          byteLength: 133387,
          durationMs: 8380,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.sides',
      captionSha256:
        '6a752b46413c11d1fdc45a6dde51fd32d06e5a167f281111a56f525cbfd67be3',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-sides__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'b6d9d89dcb4144c598e8e5ad4f23da35b47d28c33284074cc79e84708bef3caf',
          byteLength: 120667,
          durationMs: 7500,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.spin',
      captionSha256:
        'ea76ffa0bfcc23ce770c43d9c95363f895dde6be578461d0d9655ba68044a335',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-spin__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'b178921ea52f98689b9e63b7ca59e7fb2ed066d60a21cc1dc4d6d19f7fb65864',
          byteLength: 122124,
          durationMs: 7280,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.saved',
      captionSha256:
        '3ee3086fd72bad32f31c5b10f6138c387c5da164fd78d8c82a6812eec6f6d5a2',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-saved__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '130c043961a912050319f7c336d0b809cf268c96ad4ca11a7d58c608c3619022',
          byteLength: 42210,
          durationMs: 2700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.reminder',
      captionSha256:
        '950fc6b83b921c488722f97815e485fb67350ed3a00560cf200d9d6b113c7cb7',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-reminder__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'f23af5077a6e95894292bbc7e68a12ea19660905e1a7f23e0bfd209a8a064192',
          byteLength: 103715,
          durationMs: 6540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.close',
      captionSha256:
        'b7399d44ccc2fcfa303095f6b7241e61c68cbefd267a1aa36b928ea2bc665eaa',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__onboarding-close__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'c81b3949b1b72ee849bf18f12c0e901fb5f9225b293cf7f6085b376455c92666',
          byteLength: 58396,
          durationMs: 3580,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.01',
      captionSha256:
        'd009c6246a736beebab73048f3d4ca4b2d2c0fbce6e9a800b50881d5dbf3aa41',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__cue-open-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '624d4dd1d289e2565fdadd1b1da094a999f061faa2e46b3d60c859d2c733d5eb',
          byteLength: 61861,
          durationMs: 3900,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.02',
      captionSha256:
        '01881cc7fb2c44aebcb1ebb06d8d1dba50df6c2dfa5dbc07ddee678d745c7175',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__cue-open-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '74bc075c952c86972456132d0433c75e0bafa9c295a3266104ea6a201ffede29',
          byteLength: 39650,
          durationMs: 2540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.03',
      captionSha256:
        'c8303b1143343e1bc766e2786f02702832d505f1e43e26b4fcaa7618503012b7',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__cue-open-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'ee0f0d4eff38f40cff440be04ca62b54303a0b3d76f1424d3d853b44092e8f8d',
          byteLength: 21283,
          durationMs: 1420,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.01',
      captionSha256:
        'd2737695bfdd3bb44d31a29161c8acf55d1bfc1f8e7c304e3ec052632aaff19b',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__side-b-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'f354aa621b07a3e54c6faa776fffc2aaeff2225d91ebec7d4b127066b9e39abd',
          byteLength: 31660,
          durationMs: 2060,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.02',
      captionSha256:
        'd018cf6d33bd22571469a9fda1855454778e289defced6a82f95103a79066d38',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__side-b-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'd32704aecfbb791e531989b206218498a25ddf340a7dc1cbed4c551667944978',
          byteLength: 72809,
          durationMs: 4700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.03',
      captionSha256:
        'a1237c0d5953c07a2b797e9c37bc60fa7f95b78f8be90597e69c8b91d8a6f475',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__side-b-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'a8b6fc3a789855889a9949551ae4a49db11c079ed3c139fc8385799a7c7b2ee2',
          byteLength: 26426,
          durationMs: 1820,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.01',
      captionSha256:
        '96f61ac65e6f288aebf0212292d2f15744ee6a2e0a06f9919f803503bb4e5199',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__not-now-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8a502dfe73188f852719929411d47613714c2f51fa4fc03fd914e70d5e0c3bbd',
          byteLength: 38957,
          durationMs: 2540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.03',
      captionSha256:
        '9172b47e9d13e65d95b3bdb2971b58ed69cb99da93ce2771f8c6a8d30328dfad',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__not-now-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '26b07553547de5a5feda65095bb1c5124644d3bf3cacd8f77af1be2b938b4352',
          byteLength: 67195,
          durationMs: 4140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.01',
      captionSha256:
        '8bb40eb22e41701ebfe1605d160734e9652a086a325bdcadfb575f07b6e28f48',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__return-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '6a095b6320d62f220741392bf3ab231479edacf3fd0314ca3464b462a935ca19',
          byteLength: 66135,
          durationMs: 4220,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.02',
      captionSha256:
        '162e4465559d388c8adc26b6086bc9c3dc690927331440d4235f348d85c0f5b3',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__return-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '684c38fbfd138000c72af9cfdf8e6743c9570645bb4d287bd53fed7eb6f4d0fa',
          byteLength: 77709,
          durationMs: 4860,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.03',
      captionSha256:
        '9671df4c2d02c3359addb8f76af4dac81c14ed47a69e93d1270a29eb30a92f5f',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__return-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '6d1220e5f1b89364d35990b86dbcfdec36ee2798c946aa7ffd40beda32439b44',
          byteLength: 32940,
          durationMs: 2060,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.01',
      captionSha256:
        '1c84217f4971edd5b59fdecc5aa0c9c74be51b67ac96dd8e1575773edfd4000f',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__reminder-set-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5e06e55ffe474a9f2c50920301dffae229c255a400cdf733f4bb9d484963b637',
          byteLength: 44947,
          durationMs: 2860,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.02',
      captionSha256:
        '74cbe02b1f840bc6058c55ea831888012d481d26f70b88ddbbf22de2a6bf2f7f',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__reminder-set-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '49e4645a87bcfed3db410c9a502dce8f226862c1694631ed5b3fde59ef571fac',
          byteLength: 69551,
          durationMs: 4380,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.01',
      captionSha256:
        'bd0b7a081e5d2cfd6d059ecfb49ea0ceff10faeb811499d3e129015590e8e2bc',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__pressing-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '71589f642cc6e75133fed52b0a09ba07e473d16624bc2d0e7ccf7a393f8c597a',
          byteLength: 53381,
          durationMs: 3419.0209999999997,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.02',
      captionSha256:
        'f118f1738c06d111e6e18fb9070c21123d01de1f3346052512f5b7c558307818',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__pressing-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5666c8025ab54962a6cb9e91e75848ec0b99387186b1b669cd81a7c083c4c6f4',
          byteLength: 64915,
          durationMs: 4140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.03',
      captionSha256:
        '081839777ac4aa53896a516725d3d954e417dc537b98788e916018284b9d715c',
      sources: [
        {
          src: '/audio/voice/es/corky/es__corky__pressing-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'f82a153ef0d45e2e477c81a47c3e1659e24b05932ca4198a3e457275de10c9f0',
          byteLength: 53218,
          durationMs: 3420,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.meet',
      captionSha256:
        '2018da853868552ab335ddfda29e152f17a1bb157e1b73eb8eff29b231f8c671',
      sources: [
        {
          src: '/audio/voice/es/the-scroll/es__the-scroll__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'c1b83965d75530c9e13bb5fc30d2334403d877407dbf7c0e371c2f97e44281e1',
          byteLength: 95223,
          durationMs: 6060,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.present',
      captionSha256:
        '7e8ad5841891adac4a4228db64cc212f14a65109c0cad40c5d9034c05d0b6cc0',
      sources: [
        {
          src: '/audio/voice/es/the-scroll/es__the-scroll__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'fffe7a01713ea847719a81f0114d7ebf53a4f02537658341ddfe486069e15806',
          byteLength: 38387,
          durationMs: 2460,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.recede',
      captionSha256:
        '5d39f62b9351038289a7bee5b859aa03acb1e2855fc07f0727d761eefc596414',
      sources: [
        {
          src: '/audio/voice/es/the-scroll/es__the-scroll__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'dbdeba08f5d96b671eaf23bc96141e1a7fdd11a1c9d80e3feb8186534e70bf07',
          byteLength: 58656,
          durationMs: 3740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.meet',
      captionSha256:
        '0e32bcac3d94d5b7ff1dc08b95c898d8ed8228ffff10dd44b217fe601a72f4c8',
      sources: [
        {
          src: '/audio/voice/es/sugarlump/es__sugarlump__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '49a91a622fb532840da2ad52fac1f49f119d7f8798c0435364e1c9e73b7b5cf8',
          byteLength: 101874,
          durationMs: 6240,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.present',
      captionSha256:
        'c6d77672261d5f767db4f0f6196dd2355be75d04290a831e7ee66b3576c7700c',
      sources: [
        {
          src: '/audio/voice/es/sugarlump/es__sugarlump__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '23f77bc91bff5c6eb34871f093f7b6aa8682387223fe74da6471406e517f6c03',
          byteLength: 72688,
          durationMs: 4480,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.recede',
      captionSha256:
        '11b64becde79d1d128baeb854c0e46f14c564295318da08a2ea6df4004760480',
      sources: [
        {
          src: '/audio/voice/es/sugarlump/es__sugarlump__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '1e04e41b30fd100ed579014b9c07ffad6df1fbbd006437f7b0c9e59c4e4ac15e',
          byteLength: 82043,
          durationMs: 5100,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.familiar-ritual.meet',
      captionSha256:
        'f978050f700a32586586486467a5c68c2ee0b8883d15a1d10903ed4b67b9b9b5',
      sources: [
        {
          src: '/audio/voice/es/the-usual/es__the-usual__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '678bb69a0159d6177637e76501130a50fcd8874448dad66b4539509bdfb4bbfb',
          byteLength: 101150,
          durationMs: 6380,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.familiar-ritual.present',
      captionSha256:
        'e9cbe1f25e226b868e6bb7fbaa9affbb0de50b7e6b7a6ded2dea873178717880',
      sources: [
        {
          src: '/audio/voice/es/the-usual/es__the-usual__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'caa3408dafb1bf6ba78f5e4ac86ef61f19211954003c8e79ae7f014640601da3',
          byteLength: 139209,
          durationMs: 8780,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.familiar-ritual.recede',
      captionSha256:
        '81c5331bf73fd8d640bfc59046e1faf84153a099e93a936803f41dad1034c2e8',
      sources: [
        {
          src: '/audio/voice/es/the-usual/es__the-usual__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'f24b75c4fe5450e7e18772dbbdeb3cf2dabe21fda2584b62688b115dfcae9755',
          byteLength: 71514,
          durationMs: 4540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.meet',
      captionSha256:
        'cf5ba4705052893764d67423329af59aa3ad8c7617b15ceb9f9beebf654411be',
      sources: [
        {
          src: '/audio/voice/es/ember/es__ember__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5902758357764babb6d31c69a132d2a5388299ab5f7b997a4fab12df0c69c83b',
          byteLength: 105837,
          durationMs: 6700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.present',
      captionSha256:
        '5960082d49bac87c48c19565f0349eeecd172d00647999975a1da63e78f71d7a',
      sources: [
        {
          src: '/audio/voice/es/ember/es__ember__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'e77e9e5f8cc0ffd2be8fb706e39f2dfd02ee90b4363860de2c190eb43a88081b',
          byteLength: 94208,
          durationMs: 5980,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.recede',
      captionSha256:
        '09b8498a85a1adb661ed86df7eecfb937043b3216dfdb4659b2e2cc0b3264d29',
      sources: [
        {
          src: '/audio/voice/es/ember/es__ember__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'af5103afa08313bc0d2ee3e60921daa4eaac9c77c746311078c761d9a5fb9566',
          byteLength: 67792,
          durationMs: 4380,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.meet',
      captionSha256:
        'bee13894e36403dc3526a7f12e82d3ddec7385eec1275857d8b9f293a68639cb',
      sources: [
        {
          src: '/audio/voice/es/dinger/es__dinger__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8136979b0e3d8df87f887b1c5f375b123901ca6915704cdf7b1ad6355e1df679',
          byteLength: 109683,
          durationMs: 6780,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.present',
      captionSha256:
        'a8e4bfe311e818712fd2ed251c2a7c7543067f940c928a5dce0162181baa6814',
      sources: [
        {
          src: '/audio/voice/es/dinger/es__dinger__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '035bf05995150916578ad174302dda2d1549ad9214d7273abb1ecf99fd47a6bc',
          byteLength: 79201,
          durationMs: 5020,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.recede',
      captionSha256:
        '1f069f8c60929c19a59f71d29938a28ba5d1b3a01267b42a060140354ab1986b',
      sources: [
        {
          src: '/audio/voice/es/dinger/es__dinger__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '1a3b09ada6a575122b011b98b82f026c1533b9303f4c897815d977a1dfbc3d5b',
          byteLength: 64336,
          durationMs: 4059.9999999999995,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.meet',
      captionSha256:
        '0235135bb152316414c6c6ac9aaa4cc091de6ac0e43152907800ad2b21cc0c1b',
      sources: [
        {
          src: '/audio/voice/es/the-fog/es__the-fog__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'da105628a7b48d0fb003770f4221e1eec2961a02430effd0b1fe308db0870729',
          byteLength: 119976,
          durationMs: 7580,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.present',
      captionSha256:
        '351bc35b5e49a21279bc3c8b9ca3dd10ff7e6f2e2ef638e9e5a5631b5041a585',
      sources: [
        {
          src: '/audio/voice/es/the-fog/es__the-fog__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '567926ea0ead35bda8c6c709a2330f53eca4051d03d9ff04399b1768b7572201',
          byteLength: 118285,
          durationMs: 7420,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.recede',
      captionSha256:
        '682e964c5a17c0858e8f034365f5fc5095ff1983239f377faa21e62dbecd4d83',
      sources: [
        {
          src: '/audio/voice/es/the-fog/es__the-fog__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '753cd190178d63f68baf8e14dab157c83dd50e4e3886b84e6f9e8233bea69db8',
          byteLength: 97916,
          durationMs: 6060,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
  ],
  de: [
    {
      lineId: 'corky.onboarding.greeting',
      captionSha256:
        'e1dbd135681d716301ffff179f8d53b9083396d06ec9ab55c8df2c8bc3b4aa46',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-greeting__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8d004a1b3535f668946cf216c40aa34262ac65e441ca421195afb3a7e50342fc',
          byteLength: 28910,
          durationMs: 1980,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.pull-choice',
      captionSha256:
        '74d22002cf52864ec2d597d6ed7c149cc902b575fcf86d285649889d4a188546',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-pull-choice__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'e18adcabeeeb570a218b4285ca0192d61a2da6083cf33b320e21122380a16540',
          byteLength: 156997,
          durationMs: 9660,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.cue-context',
      captionSha256:
        '0732cf4b65af3c43b7781e8cd2d1625aeb0c7520a7390c8934cd4011ffc0c4a2',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-cue-context__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8bcb0ee6f71585bc8264be444d6ed76ec4c44ad104b195f1b32d301b5a2df89f',
          byteLength: 122151,
          durationMs: 7740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.sides',
      captionSha256:
        '25c6ec17c15bcf43e1bef51f1be657de023ebdd91987a73a01f7780e7b9d8144',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-sides__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'bf6d9f7c3fa363caef21127f2bc47cf40e7613e0265bbce7053429939f39005d',
          byteLength: 135289,
          durationMs: 8540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.spin',
      captionSha256:
        '587e25157930398e3931dd09d752344e0e0a4159396008528663f57373f9fb22',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-spin__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '39801f04774f4676c0978fc5443f600281629e9235b0d0aff9df468d44929a8c',
          byteLength: 120670,
          durationMs: 7280,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.saved',
      captionSha256:
        '28920aa4010573ff1bd2e9ca4014d5bd91e6b7eaa1c425e66fa26d6beb234aef',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-saved__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '9dbc3ac8fdfebaa45aaa6660964213d241142c4cc77cd1ae9c508655fb68d370',
          byteLength: 44893,
          durationMs: 2940,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.reminder',
      captionSha256:
        '18fd4484c1a9213a6a0c3433948ad43b1d35e614ad7be3e042ad2a26ffe8c3c0',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-reminder__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'e6da72062f452b3d48aae7d6a2a468e7ebced3ee01366436b5294e330a250712',
          byteLength: 108694,
          durationMs: 6700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.onboarding.close',
      captionSha256:
        '189e28306a753946f2a759522cdd4abccc3c131b65adbfc8a9306b6ef5a3a81e',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__onboarding-close__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '949f5084ace27eaeb3c9b0330911de689fb50ed56b9f21f7f581e3ce5b38cc92',
          byteLength: 65200,
          durationMs: 4140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.01',
      captionSha256:
        '854c9d01d7e0a7d1b184fe934548cc6300ada332db77408b3cdeb46c7cd39470',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__cue-open-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '951c806c2107548dad6cc045d073f501b08357e9b3d157c35e63594e1a83e561',
          byteLength: 62667,
          durationMs: 3920,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.02',
      captionSha256:
        '8cd9c7ebc4450193518f8ceccad64cd8f560b896e0cefbae939ee436a0dcb83f',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__cue-open-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '9d1adfe76fdb0181a89364fb08f27960ecaba6a2be37f299d3fc4c46c66cd064',
          byteLength: 42285,
          durationMs: 2620,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.cue-open.03',
      captionSha256:
        '68f29661ff40c3daf4c7ff6ea84c9e611c889f0ba4199758098db443b9cb0a7d',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__cue-open-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8c0e60e8c71d4e64e7d3a0769c897929c4b9dc7f48823209be61c2d30cd57db0',
          byteLength: 27627,
          durationMs: 1820,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.01',
      captionSha256:
        'd30481fa7bd9fb908fa4f18a4ce34d95600f4f7510617739a39854351a9b3ce6',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__side-b-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '54077c9c7a4f037390e2dc238e5c375127e1cbf49e3a1ed152ab348f7072d343',
          byteLength: 33662,
          durationMs: 2140,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.02',
      captionSha256:
        'f56d4c11fad56245ce5db764b04daa580ad295395c03260fd51015b1d5e3577b',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__side-b-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '3861549f2f86c8073183c472eb2d440675573bd4c61a1084981919b21c7fd8a2',
          byteLength: 74745,
          durationMs: 4860,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.side-b.03',
      captionSha256:
        'c76beb0e70d916a0c4d817b7d02b93a95abab004d72eebabac952c5eecb7ad9c',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__side-b-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '55f65aa81ec04d4b503404efb83b9c6b13885b0db90521b485449e35d6a30c22',
          byteLength: 25136,
          durationMs: 1660,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.01',
      captionSha256:
        '814f66c5d936c694d65260df136aa125a2f6ff534c2e1b1102c8523b28c4d65a',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__not-now-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'b187fd4ace9fea952765486a64a2f4eb85f51739539e3b52264b7370dab2da0a',
          byteLength: 41336,
          durationMs: 2620,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.02',
      captionSha256:
        'f4c87dbc8fd273ff2a0d3eb82eedb17b5f2dd952de9e6482db275c1f07dad38f',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__not-now-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '9ed16b2c56c970f23522baf638a2c7e256f326c95d4518f5d6938f0f7fbc7cf0',
          byteLength: 88315,
          durationMs: 5440,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.not-now.03',
      captionSha256:
        '6d98892e981e555896d709a2c30f77625dc06907db88dcb5e34e40a5b07652f3',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__not-now-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '4368399616e243b52e6cd3e144d89a7fccac989000bf7437719d2c205859fab0',
          byteLength: 56371,
          durationMs: 3660,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.01',
      captionSha256:
        '75e1c9e639b0e29a7c71e3c66c10aad3dd18d1b18a8117a2537ab9c7afb07f94',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__return-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '0ee628419d8dbf2ba862e2fed1ef9c73c93bc0ce8a0c1ea63b35bc8558ae511f',
          byteLength: 56800,
          durationMs: 3660,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.02',
      captionSha256:
        '3e8ddeb1580cff7ae2b07feff945d2630b4a5d90c8f5698a79aa26d06cb4fbcf',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__return-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '07cd73f99ff40e272d32f6f5d4d8f84d15a0405ec65001ce0a8a5e80cad2b8c1',
          byteLength: 71035,
          durationMs: 4540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.return.03',
      captionSha256:
        'b979d598ffed7f0ddebe812edfd9914d385311a2332f7f01f09701021c48386e',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__return-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'db2702647244ddb680ef23022b9b03a849b17197352f7a4606222d00941c89af',
          byteLength: 46281,
          durationMs: 2940,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.01',
      captionSha256:
        '35340b62b8c0d5b1a991df2562819139349c281750d1a4e80e3c128512882c47',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__reminder-set-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '772213139ab636c427c98bec290bfcc4a1e62cea44b35fb8ca6bfb721e02f7e2',
          byteLength: 58621,
          durationMs: 3740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.reminder-set.02',
      captionSha256:
        '40828c9c430a49aa4d9e7decce4393fb0dc2759c0e61856b29a7899cdaef7b92',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__reminder-set-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'aeb325aff6780cbbca976f066bbf08c9573347f540ac5f7b78bcbc28d7667a8b',
          byteLength: 86133,
          durationMs: 5200,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.01',
      captionSha256:
        '2f55d9eb5e924c3e4c3b7c53be34e26cdebd2e16a9c0ea806c03a83de68db4db',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__pressing-01__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '3e13122273ff64ba197c0f443b23b3bfacfb74ecea82e2e26b86936c8d6a5055',
          byteLength: 43908,
          durationMs: 2780,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.02',
      captionSha256:
        '6991084d39f6a75c5ab87d1e76f837d741d4e7b03b698ee4242e2beb0425b1ce',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__pressing-02__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '63e636e8109d4bc195ab103c10aa1f3b1bf7e7f6f9001418c2b7a63537312dfa',
          byteLength: 64790,
          durationMs: 4059.9999999999995,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'corky.pressing.03',
      captionSha256:
        '17b924f7be7072943fcbfd590ca32defd08ce46eb9daad68453c6de1ba925e87',
      sources: [
        {
          src: '/audio/voice/de/corky/de__corky__pressing-03__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '66ea10ed92f4d7b75106ee06eff4b94ac0399b37e49bb8350be8221853fddf22',
          byteLength: 61478,
          durationMs: 3900,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.meet',
      captionSha256:
        'c133df53bf3aebf914005ecc72c9f65a94fb4ec74bc380976b8505d91a76a254',
      sources: [
        {
          src: '/audio/voice/de/the-scroll/de__the-scroll__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '1270ea7180b69afc9a511086ef96b307491c83fd06ec46f98d6ceda8adf857f0',
          byteLength: 89035,
          durationMs: 5660,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.present',
      captionSha256:
        '5e886e5644e22623890ec10ecceda555c6c52d4de9d6ffb3aa15560e1f799759',
      sources: [
        {
          src: '/audio/voice/de/the-scroll/de__the-scroll__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '0c2a8f6704bb6f13155d3ae7479f7dd7e7496731dda7bd493969865b69d0fdc7',
          byteLength: 51166,
          durationMs: 3260,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.scrolling.recede',
      captionSha256:
        '4fa3231b136416cf0b26059e54fb8379d34f1e4e09c16685a1cb31d9badc4346',
      sources: [
        {
          src: '/audio/voice/de/the-scroll/de__the-scroll__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5e1a5b9f3d046db61eb9c2ec4807ca1a2bec8d77950039d7055bb4a81eb550dc',
          byteLength: 54445,
          durationMs: 3500,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.meet',
      captionSha256:
        '091ef925d5997a8a45741dff5b217fe0d9cb3fb1b77c78c01a66b50095dca3fe',
      sources: [
        {
          src: '/audio/voice/de/sugarlump/de__sugarlump__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'b2e52395facd1913c28b7fc73b5a44bac3bace8c0ecf4278399f5503bcfc1589',
          byteLength: 92485,
          durationMs: 5820,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.present',
      captionSha256:
        '3fe1b993c9afd75c570c9b5a4c476875f6a30837c518ef44a4dc339a52abee69',
      sources: [
        {
          src: '/audio/voice/de/sugarlump/de__sugarlump__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'aac66040514d138354c972bce90c73e6fe514b2453fe2e7edb8331048341f036',
          byteLength: 116029,
          durationMs: 7260,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.snacking.recede',
      captionSha256:
        '0c854f30cad858cc2b64e68e59432eb55e61783ab15e60aadaaa4a0c54aedf63',
      sources: [
        {
          src: '/audio/voice/de/sugarlump/de__sugarlump__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '8417d82b9c6cc4fa0c3d2b72ce829cbbc247cff1b79e3602bd0b4ad00ea5cfbf',
          byteLength: 72684,
          durationMs: 4540,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.familiar-ritual.meet',
      captionSha256:
        '0acc0dbbefdcfdc3fa22db84bba8fad5649bea7f46c40646b2488ecb64a98031',
      sources: [
        {
          src: '/audio/voice/de/the-usual/de__the-usual__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'e2cb9bc9b273fda4f3a5243c0e659252e5c50d8f5e68aa3d538a46ae73dfe93d',
          byteLength: 105957,
          durationMs: 6620,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.familiar-ritual.recede',
      captionSha256:
        'a2a6c71aa480e39e3fbcf31aff261481ba2481a8286e575fec0e19c81defb5e1',
      sources: [
        {
          src: '/audio/voice/de/the-usual/de__the-usual__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '79227cb6605c8e8b37b6ad2ada216a94c9aa48a9ecace0a6253ed61840f71c98',
          byteLength: 89147,
          durationMs: 5740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.meet',
      captionSha256:
        'a1ce03dc6dc579de373187d20847a73bcad0e55d527110193a2843d15e02a9bd',
      sources: [
        {
          src: '/audio/voice/de/ember/de__ember__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'c66062f00b9b3b3ac8c45953c51b7e85bca8a7644cd18a646d31598074bdc5b1',
          byteLength: 111574,
          durationMs: 7020,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.present',
      captionSha256:
        '7e90145d3b06070493c3047611447c228541939ecb8df6570978c190d9a32f7f',
      sources: [
        {
          src: '/audio/voice/de/ember/de__ember__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '91a5a91ace8bd13ffa945131346bbecfb5454402a12ca2f1e4624f3fe623679e',
          byteLength: 80204,
          durationMs: 5180,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.two-minute-pause.recede',
      captionSha256:
        '119277094f652c3b94e6d7f4889d94aa057b201b15fd22d6005d7a4e79e94fab',
      sources: [
        {
          src: '/audio/voice/de/ember/de__ember__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '5eb7c4a96b2181a00dc3457f6a02902673d20e914e8844e0eed6bbd940b3a7e4',
          byteLength: 90320,
          durationMs: 5740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.meet',
      captionSha256:
        '3f487dfe5466644d878cb78ec77c9c984c213ea4ac94c51a0ff3d5c9ed6beab8',
      sources: [
        {
          src: '/audio/voice/de/dinger/de__dinger__meet__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '2b16e0af54912b5a664d1628a60a462fcb210da4e8aec3351d7d1288ec945c09',
          byteLength: 114615,
          durationMs: 7260,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.present',
      captionSha256:
        '75157a114a790ae4945ef56e539385b24bfe44efb7d54f48f1fd90171aded618',
      sources: [
        {
          src: '/audio/voice/de/dinger/de__dinger__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '7f07f22dc05c8ac2b05a792d2aba16d8fa8927f1cd0f6e83de083bb3ed37019f',
          byteLength: 73901,
          durationMs: 4700,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.one-tap-convenience.recede',
      captionSha256:
        '796a50ba277c185c52ced2d6bccb3da6775a09e6c4a365f6b9dd58ea66a26336',
      sources: [
        {
          src: '/audio/voice/de/dinger/de__dinger__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'b479ec576acb7cd51fd5df80106ec5f17866a6b03bfefa9054f15ecc788f5d2e',
          byteLength: 57109,
          durationMs: 3580,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.meet',
      captionSha256:
        '1a89bc15d31e7057fda2fd7861ee61e9fdc2a8d977dc2f17bb49e1a812dadb00',
      sources: [
        {
          src: '/audio/voice/de/the-fog/de__the-fog__meet__v1_03.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'ffe0e8e5fc762b5325d5be0ac4eb0d98dc75745f7a09b2ce4b3424b0b2434d37',
          byteLength: 189594,
          durationMs: 11740,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.present',
      captionSha256:
        '5e0df30436eb17acff715fd57ca8d37b9d31a5fc47d40b2a07e681c555cf2ee4',
      sources: [
        {
          src: '/audio/voice/de/the-fog/de__the-fog__present__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '1b5e8bb5c1358049610d1f6818464745e44d3ef99dbc4ad76dd848f8e26303a2',
          byteLength: 107817,
          durationMs: 6860,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
    {
      lineId: 'pull.avoidance.recede',
      captionSha256:
        '9b2fb97f1c2a99e25c906196f87796d9f485a78ea61c55956e84fbe03bf713a7',
      sources: [
        {
          src: '/audio/voice/de/the-fog/de__the-fog__recede__v1_01.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            'a0482e1dc059101a5f1a0b6c766b095073ffd0e07972d97d29db3221e8a0d8dc',
          byteLength: 133146,
          durationMs: 8160,
          sampleRateHz: 48000,
          channels: 1,
        },
      ],
    },
  ],
}
