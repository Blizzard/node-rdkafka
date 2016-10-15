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

  v8::Local<v8::Object> ToBuffer();

 private:
  RdKafka::ErrorCode m_errcode;

  std::string * m_key;
  size_t m_size;
  int64_t m_offset;
  std::string m_topic_name;
  void* m_payload;
  int m_partition;

  bool m_stop_running;

  std::string m_errstr;
};

}  // namespace NodeKafka

#endif  // SRC_MESSAGE_H_
