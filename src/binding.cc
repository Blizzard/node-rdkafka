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
using NodeKafka::KafkaConsumer;
using NodeKafka::AdminClient;
using NodeKafka::Topic;

using node::AtExit;
using RdKafka::ErrorCode;

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

NAN_METHOD(NodeRdKafkaErr2Str) {
  int points = Nan::To<int>(info[0]).FromJust();
  // Cast to error code
  RdKafka::ErrorCode err = static_cast<RdKafka::ErrorCode>(points);

  std::string errstr = RdKafka::err2str(err);

  info.GetReturnValue().Set(Nan::New<v8::String>(errstr).ToLocalChecked());
}

NAN_METHOD(NodeRdKafkaBuildInFeatures) {
  RdKafka::Conf * config = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);

  std::string features;

  if (RdKafka::Conf::CONF_OK == config->get("builtin.features", features)) {
    info.GetReturnValue().Set(Nan::New<v8::String>(features).ToLocalChecked());
  } else {
    info.GetReturnValue().Set(Nan::Undefined());
  }

  delete config;
}

void ConstantsInit(v8::Local<v8::Object> exports) {
  v8::Local<v8::Object> topicConstants = Nan::New<v8::Object>();

  // RdKafka Error Code definitions
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::PARTITION_UA);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_BEGINNING);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_END);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_STORED);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_INVALID);

  Nan::Set(exports, Nan::New("topic").ToLocalChecked(), topicConstants);

  Nan::Set(exports, Nan::New("err2str").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(NodeRdKafkaErr2Str)).ToLocalChecked());  // NOLINT

  Nan::Set(exports, Nan::New("features").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(NodeRdKafkaBuildInFeatures)).ToLocalChecked());  // NOLINT
}

void Init(v8::Local<v8::Object> exports, v8::Local<v8::Value> m_, void* v_) {
#ifdef NODE_MAJOR_VERSION <= 8
  AtExit(RdKafkaCleanup);
#else
  v8::Local<v8::Context> context = Nan::GetCurrentContext();
  node::Environment* env = node::GetCurrentEnvironment(context);
  AtExit(env, RdKafkaCleanup, NULL);
#endif
  KafkaConsumer::Init(exports);
  Producer::Init(exports);
  AdminClient::Init(exports);
  Topic::Init(exports);
  ConstantsInit(exports);

  Nan::Set(exports, Nan::New("librdkafkaVersion").ToLocalChecked(),
      Nan::New(RdKafka::version_str().c_str()).ToLocalChecked());
}

NODE_MODULE(kafka, Init)
