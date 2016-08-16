/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_PRODUCER_H_
#define SRC_PRODUCER_H_

#include <nan.h>
#include <node.h>
#include <node_buffer.h>
#include <string>

#include "deps/librdkafka/src-cpp/rdkafkacpp.h"

#include "src/common.h"
#include "src/connection.h"
#include "src/callbacks.h"
#include "src/topic.h"

namespace NodeKafka {

class ProducerMessage {
 public:
  explicit ProducerMessage(v8::Local<v8::Object>, NodeKafka::Topic*);
  ~ProducerMessage();

  void* Payload();
  size_t Size();
  bool IsEmpty();
  RdKafka::Topic * GetTopic();

  std::string errstr;

  Topic * topic_;
  int32_t partition;
  std::string* key;

  void* buffer_data;
  size_t buffer_length;

  bool is_empty;
};

class Producer : public Connection {
 public:
  static void Init(v8::Local<v8::Object>);
  static v8::Local<v8::Object> NewInstance(v8::Local<v8::Value>);

  Baton Connect();
  void Disconnect();
  void Poll();

  Baton Produce(ProducerMessage* msg);
  Baton Produce(void*, size_t, RdKafka::Topic*, int32_t, std::string*);
  std::string Name();

  void ActivateDispatchers();
  void DeactivateDispatchers();

 protected:
  static Nan::Persistent<v8::Function> constructor;
  static void New(const Nan::FunctionCallbackInfo<v8::Value>&);

  Producer(RdKafka::Conf*, RdKafka::Conf*);
  ~Producer();

 private:
  static NAN_METHOD(NodeProduceSync);
  static NAN_METHOD(NodeProduce);
  static NAN_METHOD(NodeOnDelivery);
  static NAN_METHOD(NodeSetPartitioner);
  static NAN_METHOD(NodeConnect);
  static NAN_METHOD(NodeDisconnect);
  static NAN_METHOD(NodePoll);

  Callbacks::Delivery m_dr_cb;
  Callbacks::Partitioner m_partitioner_cb;
};

}  // namespace NodeKafka

#endif  // SRC_PRODUCER_H_
