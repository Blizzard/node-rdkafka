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
        "librdkafka/src-cpp/RdKafka.cpp",
        "librdkafka/src-cpp/ConfImpl.cpp",
        "librdkafka/src-cpp/HandleImpl.cpp",
        "librdkafka/src-cpp/ConsumerImpl.cpp",
        "librdkafka/src-cpp/ProducerImpl.cpp",
        "librdkafka/src-cpp/KafkaConsumerImpl.cpp",
        "librdkafka/src-cpp/TopicImpl.cpp",
        "librdkafka/src-cpp/TopicPartitionImpl.cpp",
        "librdkafka/src-cpp/MessageImpl.cpp",
        "librdkafka/src-cpp/QueueImpl.cpp",
        "librdkafka/src-cpp/MetadataImpl.cpp"
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
              '-g'
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
              '-g'
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
        [ "<(WITH_SASL)==1",
          {
            'sources': [
              'librdkafka/src/rdkafka_sasl.c'
            ]
          }
        ]
      ],
      'sources': [
        "librdkafka/src/rdgz.c",
        "librdkafka/src/rdkafka.c",
        "librdkafka/src/rdkafka_feature.c",
        "librdkafka/src/rdkafka_broker.c",
        "librdkafka/src/rdkafka_msg.c",
        "librdkafka/src/rdkafka_topic.c",
        "librdkafka/src/rdkafka_conf.c",
        "librdkafka/src/rdkafka_timer.c",
        "librdkafka/src/rdkafka_offset.c",
        "librdkafka/src/rdkafka_transport.c",
        "librdkafka/src/rdkafka_buf.c",
        "librdkafka/src/rdkafka_queue.c",
        "librdkafka/src/rdkafka_op.c",
        "librdkafka/src/rdkafka_request.c",
        "librdkafka/src/rdkafka_cgrp.c",
        "librdkafka/src/rdkafka_pattern.c",
        "librdkafka/src/rdkafka_partition.c",
        "librdkafka/src/rdkafka_subscription.c",
        "librdkafka/src/rdkafka_assignor.c",
        "librdkafka/src/rdkafka_range_assignor.c",
        "librdkafka/src/rdkafka_roundrobin_assignor.c",
        "librdkafka/src/rdcrc32.c",
        "librdkafka/src/rdaddr.c",
        "librdkafka/src/rdrand.c",
        "librdkafka/src/rdlist.c",
        "librdkafka/src/tinycthread.c",
        "librdkafka/src/rdlog.c",
        "librdkafka/src/snappy.c"
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
