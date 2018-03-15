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
                  '<(module_root_dir)/deps/librdkafka/win32/librdkafka.sln'
                ],
                'outputs': [ ],
                'action': ['nuget', 'restore', '<@(_inputs)']
              },
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
          },
          {
            "conditions": [
              [
                'OS=="mac"',
                {
                  'copies': [
                    {
                      'files': [
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.dylib',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.1.dylib',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.dylib',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.1.dylib'
                      ],
                      'destination': '<(module_root_dir)/build/Release'
                    }
                  ],
                },
                {
                  'copies': [
                    {
                      'files': [
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.so',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.so.1',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.so',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.so.1',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.a',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.a',
                      ],
                      'destination': '<(module_root_dir)/build/Release'
                    }
                  ],
                }
              ]
            ],
            "actions": [
              {
                "action_name": "build_dependencies",
                "inputs": [
                  "<(module_root_dir)/deps/librdkafka/config.h",
                ],
                "action": [
                  "make", "-C", "<(module_root_dir)/deps/librdkafka", "libs"
                ],
                "conditions": [
                  [
                    'OS=="mac"',
                    {
                      'outputs': [
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.dylib',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.1.dylib',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.dylib',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.1.dylib'
                      ],
                    },
                    {
                      'outputs': [
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.so',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.so.1',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.so',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.so.1',
                        '<(module_root_dir)/deps/librdkafka/src-cpp/librdkafka++.a',
                        '<(module_root_dir)/deps/librdkafka/src/librdkafka.a',
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
