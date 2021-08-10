/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>

#include "src/errors.h"

namespace NodeKafka {

v8::Local<v8::Object> RdKafkaError(const RdKafka::ErrorCode &err, std::string errstr) {  // NOLINT
  //
  int code = static_cast<int>(err);

  v8::Local<v8::Object> ret = Nan::New<v8::Object>();

  Nan::Set(ret, Nan::New("message").ToLocalChecked(),
    Nan::New<v8::String>(errstr).ToLocalChecked());
  Nan::Set(ret, Nan::New("code").ToLocalChecked(),
    Nan::New<v8::Number>(code));

  return ret;
}

v8::Local<v8::Object> RdKafkaError(const RdKafka::ErrorCode &err) {
  return RdKafkaError(err, RdKafka::err2str(err));
}

v8::Local<v8::Object> RdKafkaError(const RdKafka::ErrorCode &err, std::string errstr,
      bool isFatal, bool isRetriable, bool isTxnRequiresAbort) {
  v8::Local<v8::Object> ret = RdKafkaError(err, errstr);

  Nan::Set(ret, Nan::New("isFatal").ToLocalChecked(),
    Nan::New<v8::Boolean>(isFatal));
  Nan::Set(ret, Nan::New("isRetriable").ToLocalChecked(),
    Nan::New<v8::Boolean>(isRetriable));
  Nan::Set(ret, Nan::New("isTxnRequiresAbort").ToLocalChecked(),
    Nan::New<v8::Boolean>(isTxnRequiresAbort));

  return ret;
}

Baton::Baton(const RdKafka::ErrorCode &code) {
  m_err = code;
}

Baton::Baton(const RdKafka::ErrorCode &code, std::string errstr) {
  m_err = code;
  m_errstr = errstr;
}

Baton::Baton(void* data) {
  m_err = RdKafka::ERR_NO_ERROR;
  m_data = data;
}

Baton::Baton(const RdKafka::ErrorCode &code, std::string errstr, bool isFatal,
             bool isRetriable, bool isTxnRequiresAbort) {
  m_err = code;
  m_errstr = errstr;
  m_isFatal = isFatal;
  m_isRetriable = isRetriable;
  m_isTxnRequiresAbort = isTxnRequiresAbort;
}


v8::Local<v8::Object> Baton::ToObject() {
  if (m_errstr.empty()) {
    return RdKafkaError(m_err);
  } else {
    return RdKafkaError(m_err, m_errstr);
  }
}

v8::Local<v8::Object> Baton::ToTxnObject() {
  return RdKafkaError(m_err, m_errstr, m_isFatal, m_isRetriable, m_isTxnRequiresAbort);
}

RdKafka::ErrorCode Baton::err() {
  return m_err;
}

std::string Baton::errstr() {
  if (m_errstr.empty()) {
    return RdKafka::err2str(m_err);
  } else {
    return m_errstr;
  }
}

}  // namespace NodeKafka
