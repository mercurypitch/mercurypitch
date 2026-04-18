import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { importX } from 'eslint-plugin-import-x'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      '.pnpm-noop',
      '**/*.css.d.ts',
      '**/coverage',
      '**/dist',
      '**/node_modules',
      '**/.pnpm-store',
    ],
  },
  importX.flatConfigs.recommended,
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      'import-x/consistent-type-specifier-style': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-named-as-default': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-named-as-default-member': 'off',
      // Disable import resolution rules — handled by typescript-eslint parser
      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
      'import-x/no-duplicates': 'off',

      '@typescript-eslint/unified-signatures': 'off',
      'no-console': ['error', { allow: ['info', 'warn', 'error', 'table'] }],
      'no-throw-literal': 'error',
      'no-useless-concat': 'error',
      'prefer-template': 'error',
      eqeqeq: 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'function' },
      ],

      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            [
              '^\\^@',
              '^@?\\w',
              '^',
              '^\\.',
              '^@?\\w.*\\^@$',
              '^.*\\^@$',
            ],
          ],
        },
      ],

      'no-restricted-globals': [
        'error',
        'blur', 'captureEvents', 'chrome', 'clientInformation', 'close',
        'closed', 'createImageBitmap', 'crypto', 'customElements', 'defaultStatus',
        'defaultstatus', 'devicePixelRatio', 'external', 'find', 'focus',
        'frameElement', 'frames', 'getComputedStyle', 'getSelection', 'indexedDB',
        'innerHeight', 'innerWidth', 'isSecureContext', 'length', 'location',
        'locationbar', 'matchMedia', 'menubar', 'moveBy', 'moveTo', 'name',
        'navigator', 'onabort', 'onafterprint', 'onanimationend', 'onanimationiteration',
        'onanimationstart', 'onappinstalled', 'onauxclick', 'onbeforeinstallprompt',
        'onbeforeprint', 'onbeforeunload', 'onblur', 'oncancel', 'oncanplay',
        'oncanplaythrough', 'onchange', 'onclick', 'onclose', 'oncontextmenu',
        'oncuechange', 'ondblclick', 'ondevicemotion', 'ondeviceorientation',
        'ondeviceorientationabsolute', 'ondrag', 'ondragend', 'ondragenter',
        'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange',
        'onemptied', 'onended', 'onerror', 'onfocus', 'ongotpointercapture',
        'onhashchange', 'oninput', 'oninvalid', 'onkeydown', 'onkeypress',
        'onkeyup', 'onlanguagechange', 'onload', 'onloadeddata', 'onloadedmetadata',
        'onloadstart', 'onlostpointercapture', 'onmessage', 'onmessageerror',
        'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout',
        'onmouseover', 'onmouseup', 'onmousewheel', 'onoffline', 'ononline',
        'onpagehide', 'onpageshow', 'onpause', 'onplay', 'onplaying',
        'onpointercancel', 'onpointerdown', 'onpointerenter', 'onpointerleave',
        'onpointermove', 'onpointerout', 'onpointerover', 'onpointerup',
        'onpopstate', 'onprogress', 'onratechange', 'onrejectionhandled',
        'onreset', 'onresize', 'onscroll', 'onsearch', 'onseeked', 'onseeking',
        'onselect', 'onstalled', 'onstorage', 'onsubmit', 'onsuspend',
        'ontimeupdate', 'ontoggle', 'ontransitionend', 'onunhandledrejection',
        'onunload', 'onvolumechange', 'onwaiting', 'onwebkitanimationend',
        'onwebkitanimationiteration', 'onwebkitanimationstart', 'onwebkittransitionend',
        'onwheel', 'open', 'openDatabase', 'opener', 'origin', 'outerHeight',
        'outerWidth', 'pageXOffset', 'pageYOffset', 'parent', 'performance',
        'personalbar', 'postMessage', 'print', 'releaseEvents', 'resizeBy',
        'resizeTo', 'screen', 'screenLeft', 'screenTop', 'screenX', 'screenY',
        'scroll', 'scrollBy', 'scrollTo', 'scrollX', 'scrollY', 'scrollbars',
        'self', 'speechSynthesis', 'status', 'statusbar', 'stop', 'styleMedia',
        'toolbar', 'top', 'visualViewport', 'webkitRequestFileSystem',
        'webkitResolveLocalFileSystemURL', 'webkitStorageInfo',
      ],
    },
  },
)
