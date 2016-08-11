/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <iostream>
#include "src/binding.h"

using NodeKafka::Producer;
using NodeKafka::Consumer;
using NodeKafka::Topic;

using node::AtExit;

static void RdKafkaCleanup(void*) {  // NOLINT
  /*
   * Wait for RdKafka to decommission.
   * This is not strictly needed but
   * allows RdKafka to clean up all its resources before the application
   * exits so that memory profilers such as valgrind wont complain about
   * memory leaks.
   */

  RdKafka::wait_destroyed(5000);
}

void Init(v8::Local<v8::Object> exports, v8::Local<v8::Object> module) {
  AtExit(RdKafkaCleanup);
  Consumer::Init(exports);
  Producer::Init(exports);
  Topic::Init(exports);

  exports->Set(Nan::New("librdkafkaVersion").ToLocalChecked(),
      Nan::New(RdKafka::version_str().c_str()).ToLocalChecked());
}

NODE_MODULE(kafka, Init)
