{
  'variables': {
    "WITH_SASL%": "<!(echo ${WITH_SASL:-1})"
  },
  'targets': [
    {
      "target_name": "librdkafka_cpp",
      "type": "static_library",
      "include_dirs": [
        "librdkafka/src-cpp",
        "librdkafka/src"
      ],
      "dependencies": [
        "librdkafka"
      ],
      'sources': [
         '<!@(find librdkafka/src-cpp -name *.cpp)'
      ],
      "conditions": [
        [
          'OS=="linux"',
          {
            'cflags_cc!': [
              '-fno-rtti'
            ],
            'cflags_cc' : [
              '-Wno-sign-compare',
              '-Wno-missing-field-initializers',
              '-Wno-empty-body',
            ],
          }
        ],
        ['OS=="mac"', {
          'xcode_settings': {
            'OTHER_CFLAGS': [
              '-ObjC'
            ],
            'MACOSX_DEPLOYMENT_TARGET': '10.7',
            'GCC_ENABLE_CPP_RTTI': 'YES',
            'OTHER_CPLUSPLUSFLAGS': [
              '-std=c++11',
              '-stdlib=libc++'
            ],
            'OTHER_LDFLAGS': [],
          },
          'defines': [
            'FWD_LINKING_REQ'
          ]
        }]
      ]
    },
    {
      "target_name": "librdkafka",
      "type": "static_library",
      'defines': [
         'HAVE_CONFIG_H'
      ],
      "include_dirs": [
        "librdkafka/src"
      ],
      'cflags': [
        '-Wunused-function',
        '-Wformat',
        '-Wimplicit-function-declaration'
      ],
      "conditions": [
        [
          'OS=="linux"',
          {
            'cflags!': [
            ],
            'cflags' : [
              '-Wno-type-limits',
              '-Wno-unused-function',
              '-Wno-maybe-uninitialized',
              '-Wno-sign-compare',
              '-Wno-missing-field-initializers',
              '-Wno-empty-body',
              '-Wno-old-style-declaration',
            ],
            "dependencies": [
              "librdkafka_config"
            ]
          }
        ],
        [
          'OS=="mac"',
          {
            'xcode_settings': {
              'OTHER_CFLAGS' : [
                '-Wno-sign-compare',
                '-Wno-missing-field-initializers',
                '-ObjC',
                '-Wno-implicit-function-declaration',
                '-Wno-unused-function',
                '-Wno-format'
              ],
              'OTHER_LDFLAGS': [],
              'MACOSX_DEPLOYMENT_TARGET': '10.11',
              'libraries' : ['-lz']
            },
            "dependencies": [
                "librdkafka_config"
            ]
          }
        ],
        [
          'OS=="win"',
          {
            'msvs_settings': {
              'VCLinkerTool': {
                 'SetChecksum': 'true'
              }
            },
          }
        ],
        [ 'OS!="win" and <(WITH_SASL)==1',
          {
            'sources': [
              '<!@(find librdkafka/src -name rdkafka_sasl*.c ! -name rdkafka_sasl_win32*.c )'
            ]
          }
        ],
        [ 'OS=="win" and <(WITH_SASL)==1',
          {
            'sources': [
              '<!@(find librdkafka/src -name rdkafka_sasl*.c ! -name rdkafka_sasl_cyrus*.c )'
            ]
          }
        ]
      ],
      'sources': [
         '<!@(find librdkafka/src -name *.c ! -name rdkafka_sasl* )'
      ],
      'cflags!': [ '-fno-rtti' ],
    },
    {
      "target_name": "librdkafka_config",
      "type": "none",
      "actions": [
        {
          'action_name': 'configure_librdkafka',
          'message': 'configuring librdkafka...',
          'inputs': [
            'librdkafka/configure',
          ],
          'outputs': [
            'librdkafka/config.h',
          ],
          "conditions": [
            [ 'OS!="win"',
              {
                "conditions": [
                  [ "<(WITH_SASL)==1",
                    {
                      'action': ['eval', 'cd librdkafka && chmod a+x ./configure && ./configure']
                    },
                    {
                      'action': ['eval', 'cd librdkafka && chmod a+x ./configure && ./configure --disable-sasl']
                    }
                  ]
                ]
              },
              {
                'action': ['echo']
              }
            ]
          ]
        }
      ]
    }
  ]
}
