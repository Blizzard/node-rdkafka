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
                'inputs': [ ],
                'outputs': [ ],
                'action': ['nuget.exe', 'restore', 'librdkafka/win32/librdkafka.sln']
              },
              {
                'action_name': 'build_dependencies',
                'inputs': [
                  'librdkafka/win32/librdkafka.sln'
                ],
                'outputs': [
                  'librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
                  'librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
                ],
                # Fun story export PATH="$PATH:/c/Program Files (x86)/MSBuild/12.0/Bin/"
                # I wish there was a better way, but can't find one right now
                'action': ['msbuild', '<@(_inputs)', '/p:Configuration="Release"', '/p:Platform="x64"', '/t:librdkafkacpp']
              }
            ],
            'copies': [
              {
                'files': [
                  'librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
                  'librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
                  'librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll'
                ],
                'destination': '../build/Release'
              }
            ],
            'libraries': [
              'librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.lib',
              'librdkafka/win32/outdir/v120/x64/Release/librdkafka.lib'
            ],
            'build_files': [
              'librdkafka/win32/outdir/v120/x64/Release/zlib.dll',
              'librdkafka/win32/outdir/v120/x64/Release/librdkafka.dll',
              'librdkafka/win32/outdir/v120/x64/Release/librdkafkacpp.dll',
            ],
            'msvs_settings': {
              'VCCLCompilerTool': {
                'AdditionalUsingDirectories': [
                  'librdkafka/win32/outdir/v120/x64/Release/'
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
