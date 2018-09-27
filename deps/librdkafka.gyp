{
  'targets': [
    {
      "target_name": "librdkafka",
      "type": "none",
      "conditions": [
        [
          'OS=="win"',
          {
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
