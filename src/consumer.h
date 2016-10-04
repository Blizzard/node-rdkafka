/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_CONSUMER_H_
#define SRC_CONSUMER_H_

#include <nan.h>
#include <uv.h>
#include <iostream>
#include <string>
#include <vector>

#include "deps/librdkafka/src-cpp/rdkafkacpp.h"

#include "src/common.h"
#include "src/connection.h"
#include "src/callbacks.h"
#include "src/message.h"

namespace NodeKafka {

struct consumer_commit_t {
  int64_t _offset;
  int _partition;
  std::string _topic_name;

  consumer_commit_t(std::string, int, int64_t);
  consumer_commit_t();
};


/**
 * @brief Consumer v8 wrapped object.
 *
 * Specializes the connection to wrap a consumer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

class Consumer : public Connection {
 public:
  static void Init(v8::Local<v8::Object>);
  static v8::Local<v8::Object> NewInstance(v8::Local<v8::Value>);

  Baton Connect();
  Baton Disconnect();

  Baton Unsubscribe();
  bool IsSubscribed();

  Baton Commit(std::string, int, int64_t);
  Baton Commit();

  Baton RefreshAssignments();

  bool HasAssignedPartitions();
  int AssignedPartitionCount();

  Baton Assign(std::vector<RdKafka::TopicPartition*>);
  Baton Unassign();

  std::string Name();

  Baton Subscribe(std::vector<std::string>);
  NodeKafka::Message* Consume(int timeout_ms);

  void ActivateDispatchers();
  void DeactivateDispatchers();

 protected:
  static Nan::Persistent<v8::Function> constructor;
  static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);

  Consumer(Conf *, Conf *);
  ~Consumer();

 private:
  static void part_list_print(const std::vector<RdKafka::TopicPartition*>&);

  std::vector<RdKafka::TopicPartition*> m_partitions;
  int m_partition_cnt;
  bool m_is_subscribed = false;

  // Node methods
  static NAN_METHOD(NodeConnect);
  static NAN_METHOD(NodeSubscribe);
  static NAN_METHOD(NodeSubscribeSync);
  static NAN_METHOD(NodeDisconnect);
  static NAN_METHOD(NodeAssign);
  static NAN_METHOD(NodeUnassign);
  static NAN_METHOD(NodeAssignments);
  static NAN_METHOD(NodeUnsubscribe);
  static NAN_METHOD(NodeUnsubscribeSync);
  static NAN_METHOD(NodeCommit);
  static NAN_METHOD(NodeCommitSync);

  static NAN_METHOD(NodeConsumeLoop);
  static NAN_METHOD(NodeConsume);
};

}  // namespace NodeKafka

#endif  // SRC_CONSUMER_H_
