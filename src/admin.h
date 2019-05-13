/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_ADMIN_H_
#define SRC_ADMIN_H_

#include <nan.h>
#include <uv.h>
#include <iostream>
#include <string>
#include <vector>

#include "rdkafkacpp.h"
#include "rdkafka.h"  // NOLINT

#include "src/common.h"
#include "src/connection.h"
#include "src/callbacks.h"

namespace NodeKafka {

/**
 * @brief KafkaConsumer v8 wrapped object.
 *
 * Specializes the connection to wrap a consumer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

class AdminClient : public Connection {
 public:
  static void Init(v8::Local<v8::Object>);
  static v8::Local<v8::Object> NewInstance(v8::Local<v8::Value>);

  void ActivateDispatchers();
  void DeactivateDispatchers();

  Baton Connect();
  Baton Disconnect();

  Baton CreateTopic(rd_kafka_NewTopic_t* topic, int timeout_ms);
  Baton DeleteTopic(rd_kafka_DeleteTopic_t* topic, int timeout_ms);
  Baton CreatePartitions(rd_kafka_NewPartitions_t* topic, int timeout_ms);
  // Baton AlterConfig(rd_kafka_NewTopic_t* topic, int timeout_ms);
  // Baton DescribeConfig(rd_kafka_NewTopic_t* topic, int timeout_ms);

 protected:
  static Nan::Persistent<v8::Function> constructor;
  static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);

  explicit AdminClient(Conf* globalConfig);
  ~AdminClient();

  rd_kafka_queue_t* rkqu;

 private:
  // Node methods
  // static NAN_METHOD(NodeValidateTopic);
  static NAN_METHOD(NodeCreateTopic);
  static NAN_METHOD(NodeDeleteTopic);
  static NAN_METHOD(NodeCreatePartitions);

  static NAN_METHOD(NodeConnect);
  static NAN_METHOD(NodeDisconnect);
};

}  // namespace NodeKafka

#endif  // SRC_ADMIN_H_
