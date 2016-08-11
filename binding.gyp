{
  "targets": [
    {
      "target_name": "node-librdkafka",
      "sources": [
        "src/common.cc",
        "src/errors.cc",
        "src/config.cc",
        "src/topic.cc",
        "src/callbacks.cc",
        "src/connection.cc",
        "src/message.cc",
        "src/consumer.cc",
        "src/producer.cc",
        "src/workers.cc",
        "src/binding.cc"
      ],
      "dependencies": [
        "<(module_root_dir)/deps/librdkafka.gyp:librdkafka_cpp"
      ],
      "include_dirs": [
        "<(module_root_dir)/deps/librdkafka/src-cpp",
        "<!(node -e \"require('nan')\")",
        "<(module_root_dir)/"
      ],
      'conditions': [
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
          'OS=="win"',
          {
            'cflags_cc' : [
              '-std=c++11'
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
      ]
    }
  ]
}
