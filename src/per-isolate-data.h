/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_PER_ISOLATE_DATA_H_
#define SRC_PER_ISOLATE_DATA_H_

#include <node.h>
#include <nan.h>
#include <v8.h>

namespace NodeKafka {

class PerIsolateData {
 private:
  Nan::Global<v8::Function> admin_client_constructor;
  Nan::Global<v8::Function> kafka_consumer_constructor;
  Nan::Global<v8::Function> kafka_producer_constructor;
  Nan::Global<v8::Function> topic_constructor;

  PerIsolateData() {}

 public:
  static PerIsolateData* For(v8::Isolate* isolate);

  Nan::Global<v8::Function>& AdminClientConstructor();
  Nan::Global<v8::Function>& KafkaConsumerConstructor();
  Nan::Global<v8::Function>& KafkaProducerConstructor();
  Nan::Global<v8::Function>& TopicConstructor();
};

}  // namespace NodeKafka

#endif  // SRC_PER_ISOLATE_DATA_H_
