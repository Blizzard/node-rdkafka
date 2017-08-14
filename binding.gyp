{
  "variables": {
      # may be redefined in command line on configuration stage
      'conditions': [
        [ 'OS=="win"', {
          "BUILD_LIBRDKAFKA%": "<!(IF DEFINED BUILD_LIBRDKAFKA (echo %BUILD_LIBRDKAFKA%) ELSE (echo 0))",
          "WITH_SASL%": "<!(IF DEFINED WITH_SASL (echo %WITH_SASL%) ELSE (echo 0))",
          "WITH_LZ4%": "<!(IF DEFINED WITH_LZ4 (echo %WITH_LZ4%) ELSE (echo 0))"
        }],
        [ 'OS!="win"', {
          "BUILD_LIBRDKAFKA%": "<!(echo ${BUILD_LIBRDKAFKA:-1})",
          "WITH_SASL%": "<!(echo ${WITH_SASL:-1})",
          "WITH_LZ4%": "<!(echo ${WITH_LZ4:-0})"
        }]
      ]
  },
  "targets": [
    {
      "target_name": "node-librdkafka",
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "<(module_root_dir)/"
      ],
      'conditions': [
        [ 'OS!="win"', {
          "sources": [ "<!@(ls -1 src/*.cc)", ]
        }],
        [ 'OS=="win"', {
          "sources": [ '<!@(findwin src *.cc)' ],
          "include_dirs": [
            "deps/librdkafka/src-cpp",
          ],
          'configurations': {
            'Debug': {
              'msvs_settings': {
                'VCLinkerTool': {
                  'SetChecksum': 'true'
                },
                'VCCLCompilerTool': {
                  'RuntimeTypeInfo': 'true',
                  'RuntimeLibrary': '1', # /MTd
                }
              },
            },
            'Release': {
              'msvs_settings': {
                'VCLinkerTool': {
                  'SetChecksum': 'true'
                },
                'VCCLCompilerTool': {
                  'RuntimeTypeInfo': 'true',
                  'RuntimeLibrary': '0', # /MT
                }
              },
            }
          }
        }],
        [ "<(BUILD_LIBRDKAFKA)==1",
            {
                "dependencies": [
                    "<(module_root_dir)/deps/librdkafka.gyp:librdkafka_cpp"
                ],
                "include_dirs": [ "deps/librdkafka/src-cpp" ],
            },
            # Else link against globally installed rdkafka and use
            # globally installed headers.  On Debian, you should
            # install the librdkafka1, librdkafka++1, and librdkafka-dev
            # .deb packages.
            {
                'conditions': [
                  [ 'OS!="win"', {
                      "libraries": ["-lrdkafka", "-lrdkafka++"],
                      "include_dirs": [
                          "/usr/include/librdkafka",
                          "/usr/local/include/librdkafka"
                      ],
                  }],
                  [ 'OS=="win"', {
                      "libraries": ["-l../deps/win32-runtime/librdkafka", "-l../deps/win32-runtime/librdkafkacpp"],
                  }],
				],
            },
        ],
        [
          'OS=="linux"',
          {
            'cflags_cc' : [
              '-std=c++11'
            ],
            'cflags_cc!': [
              '-fno-rtti'
            ]
          }
        ],
        [
          'OS=="mac"',
          {
            'xcode_settings': {
              'MACOSX_DEPLOYMENT_TARGET': '10.11',
              'GCC_ENABLE_CPP_RTTI': 'YES',
              'OTHER_CPLUSPLUSFLAGS': [
                '-std=c++11'
              ],
            },
          }
        ],
        [ "<(WITH_SASL)==1",
          {
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
        ],
        [ "<(WITH_LZ4)==1",
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
        ]
      ]
    }
  ]
}
