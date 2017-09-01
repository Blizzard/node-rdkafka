{
  'variables': {
    # "with_sasl%": "<!(echo ${WITH_SASL:-1})",
    # "with_lz4%": "<!(echo ${WITH_SASL:-1})",
    "with_sasl%": "0",
    "with_lz4%": "0"
  },
  'targets': [
    {
      "target_name": "librdkafkacpp",
      'conditions': [
        [
          'OS=="win"',
          {
            'type': 'static_library',
            'msvs_version': '2013',
            'msbuild_toolset': 'v120',
            'actions': [
              {
                'action_name': 'build_dependencies',
                'inputs': [
                  '<(module_root_dir)/deps/librdkafka/win32/librdkafka.sln'
                ],
                'outputs': [
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
                ],
                # Fun story export PATH="$PATH:/c/Program Files (x86)/MSBuild/12.0/Bin/"
                # I wish there was a better way, but can't find one right now
                'action': ['msbuild', '<@(_inputs)', '/p:Configuration="Release"', '/p:Platform="x64"', '/t:librdkafkacpp']
              }
            ],
            'copies': [
              {
                'files': [
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll'
                ],
                'destination': '<(module_root_dir)/build/Release'
              }
            ],
            'libraries': [
              '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
              '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
            ],
            'build_files': [
              '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
              '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
              '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll',
            ],
            'msvs_settings': {
              'VCCLCompilerTool': {
                'AdditionalUsingDirectories': [
                  '<(module_root_dir)/deps/librdkafka/win32/outdir/v120/x64/Release/'
                ]
              }
            },
            'sources': [
              'win.cc'
            ]
          },
          {
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
          }

        ]
      ]
    },
    {
      "target_name": "librdkafka",
      'conditions': [
        [
          'OS!="win"',
          {
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
              [ '<(with_lz4)==1',
                {
                  'libraries' : ['-llz4'],
                  'conditions': [
                    [ 'OS=="mac"',
                      {
                        'xcode_settings': {
                          'libraries' : ['-llz4']
                        }
                      }
                    ],
                  ]
                }
              ],
              [ '<(with_sasl)==1',
                {
                  'sources': [
                    '<!@(find librdkafka/src -name rdkafka_sasl*.c ! -name rdkafka_sasl_win32*.c )'
                  ],
                  'libraries' : ['-lsasl2'],
                  'conditions': [
                    [ 'OS=="mac"',
                      {
                        'xcode_settings': {
                          'libraries' : ['-lsasl2']
                        }
                      }
                    ],
                  ]
                }
              ]
            ],
            'sources': [
               '<!@(find librdkafka/src -name *.c ! -name rdkafka_sasl* )'
            ],
            'cflags!': [ '-fno-rtti' ],
          }
        ]
      ]
    },
    {
      "target_name": "librdkafka_config",
      "type": "none",
      'conditions': [
        [
          'OS!="win"',
          {
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
                        [ "<(with_sasl)==1",
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
      ]
    }
  ]
}
