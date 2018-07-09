{
  'targets': [
    {
      "target_name": "librdkafka",
      "type": "none",
      "conditions": [
        [
          'OS=="win"',
          {
            'msvs_version': '2013',
            'msbuild_toolset': 'v120',
            'actions': [
              {
                'action_name': 'nuget_restore',
                'inputs': [
                  'deps/librdkafka/win32/librdkafka.sln'
                ],
                'outputs': [ ],
                'action': ['nuget', 'restore', '<@(_inputs)']
              },
              {
                'action_name': 'build_dependencies',
                'inputs': [
                  'deps/librdkafka/win32/librdkafka.sln'
                ],
                'outputs': [
                  'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
                  'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
                ],
                # Fun story export PATH="$PATH:/c/Program Files (x86)/MSBuild/12.0/Bin/"
                # I wish there was a better way, but can't find one right now
                'action': ['msbuild', '<@(_inputs)', '/p:Configuration="Release"', '/p:Platform="x64"', '/t:librdkafkacpp']
              }
            ],
            'copies': [
              {
                'files': [
                  'deps/librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
                  'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
                  'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll'
                ],
                'destination': '../build/Release'
              }
            ],
            'libraries': [
              'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
              'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
            ],
            'build_files': [
              'deps/librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
              'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
              'deps/librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll',
            ],
            'msvs_settings': {
              'VCCLCompilerTool': {
                'AdditionalUsingDirectories': [
                  'deps/librdkafka/win32/outdir/v120/x64/Release/'
                ]
              }
            },
          },
          {
            "actions": [
              {
                "action_name": "configure",
                "inputs": [],
                "outputs": [
                  "librdkafka/config.h",
                ],
                "action": [
                  "node", "../util/configure"
                ]
              },
              {
                "action_name": "build_dependencies",
                "inputs": [
                  "librdkafka/config.h",
                ],
                "action": [
                  "make", "-C", "librdkafka", "libs", "install"
                ],
                "conditions": [
                  [
                    'OS=="mac"',
                    {
                      'outputs': [
                        'deps/librdkafka/src-cpp/librdkafka++.dylib',
                        'deps/librdkafka/src-cpp/librdkafka++.1.dylib',
                        'deps/librdkafka/src/librdkafka.dylib',
                        'deps/librdkafka/src/librdkafka.1.dylib'
                      ],
                    },
                    {
                      'outputs': [
                        'deps/librdkafka/src-cpp/librdkafka++.so',
                        'deps/librdkafka/src-cpp/librdkafka++.so.1',
                        'deps/librdkafka/src/librdkafka.so',
                        'deps/librdkafka/src/librdkafka.so.1',
                        'deps/librdkafka/src-cpp/librdkafka++.a',
                        'deps/librdkafka/src/librdkafka.a',
                      ],
                    }
                  ]
                ],
              }
            ]
          }

        ]
      ]
    }
  ]
}
