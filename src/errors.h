/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_ERRORS_H_
#define SRC_ERRORS_H_

#include <nan.h>
#include <iostream>
#include <string>

#include "rdkafkacpp.h"

#include "src/common.h"

namespace NodeKafka {

class Baton {
 public:
  explicit Baton(const RdKafka::ErrorCode &);
  explicit Baton(void* data);
  explicit Baton(const RdKafka::ErrorCode &, std::string);
  explicit Baton(const RdKafka::ErrorCode &, std::string, bool isFatal,
                 bool isRetriable, bool isTxnRequiresAbort);

  template<typename T> T data() {
    return static_cast<T>(m_data);
  }

  RdKafka::ErrorCode err();
  std::string errstr();

  v8::Local<v8::Object> ToObject();
  v8::Local<v8::Object> ToTxnObject();

 private:
  void* m_data;
  std::string m_errstr;
  RdKafka::ErrorCode m_err;
  bool m_isFatal;
  bool m_isRetriable;
  bool m_isTxnRequiresAbort;
};

v8::Local<v8::Object> RdKafkaError(const RdKafka::ErrorCode &);

}  // namespace NodeKafka

#endif  // SRC_ERRORS_H_
