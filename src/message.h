/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_MESSAGE_H_
#define SRC_MESSAGE_H_

#include <nan.h>
#include <string>

#include "deps/librdkafka/src-cpp/rdkafkacpp.h"

#include "src/common.h"
#include "src/errors.h"

namespace NodeKafka {

class Message {
 public:
  explicit Message(RdKafka::Message*);
  explicit Message(const RdKafka::ErrorCode &);
  ~Message();

  bool ConsumerShouldStop();
  bool IsSubscribed();

  char* Payload();
  size_t Size();

  bool IsError();
  v8::Local<v8::Object> GetErrorObject();

  RdKafka::Message* GetMessage();
  v8::Local<v8::Value> Pack();

  RdKafka::ErrorCode errcode();

  static void Free(char *, void *);
  v8::Local<v8::Object> ToBuffer();

 private:
  RdKafka::Message* m_message;
  RdKafka::ErrorCode m_errcode;

  size_t size;
  int64_t offset;
  std::string topic_name;
  void* payload;
  int partition;

  bool stop_running;

  std::string errstr;
};

}  // namespace NodeKafka

#endif  // SRC_MESSAGE_H_
