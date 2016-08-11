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

v8::Local<v8::Object> RdKafkaError(const RdKafka::ErrorCode &err) {
  //
  int code = static_cast<int>(err);

  v8::Local<v8::Object> ret = Nan::New<v8::Object>();

  ret->Set(Nan::New("message").ToLocalChecked(),
    Nan::New<v8::String>(RdKafka::err2str(err)).ToLocalChecked());
  ret->Set(Nan::New("code").ToLocalChecked(),
    Nan::New<v8::Number>(code));

  return ret;
}

Baton::Baton(const RdKafka::ErrorCode &code) {
  m_err = code;
}

Baton::Baton(void* _data) {
  m_err = RdKafka::ERR_NO_ERROR;
  m_data = _data;
}

v8::Local<v8::Object> Baton::ToObject() {
  return RdKafkaError(m_err);
}

RdKafka::ErrorCode Baton::err() {
  return m_err;
}
}  // namespace NodeKafka
