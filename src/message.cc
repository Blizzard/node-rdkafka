/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>

#include "src/message.h"

namespace NodeKafka {

v8::Local<v8::Value> Message::Pack() {
  if (IsError()) {
    return GetErrorObject();
  }

  v8::Local<v8::Object> pack = Nan::New<v8::Object>();

  Nan::Set(pack, Nan::New<v8::String>("message").ToLocalChecked(), ToBuffer());
  Nan::Set(pack, Nan::New<v8::String>("size").ToLocalChecked(),
    Nan::New<v8::Number>(size));
  Nan::Set(pack, Nan::New<v8::String>("topic").ToLocalChecked(),
    Nan::New<v8::String>(topic_name).ToLocalChecked());
  Nan::Set(pack, Nan::New<v8::String>("offset").ToLocalChecked(),
    Nan::New<v8::Number>(offset));
  Nan::Set(pack, Nan::New<v8::String>("partition").ToLocalChecked(),
    Nan::New<v8::Number>(partition));

  return pack;
}

RdKafka::Message* Message::GetMessage() {
  return m_message;
}

RdKafka::ErrorCode Message::errcode() {
  return m_errcode;
}

Message::Message(const RdKafka::ErrorCode &err) {
  stop_running = false;
  m_errcode = err;
  m_message = NULL;
}

Message::Message(RdKafka::Message *message):
  m_message(message) {
  m_errcode = message->err();
  stop_running = false;

  // Starts polling before the partitioner is ready.
  // This may be a problem we want to keep record of
  switch (m_errcode) {
    case RdKafka::ERR_NO_ERROR:
      /* Real message */
      size = message->len();
      offset = message->offset();

      partition = message->partition();

      topic_name = message->topic_name();
      payload = message->payload();

      break;

    case RdKafka::ERR__TIMED_OUT:
      errstr = message->errstr();
      break;

    case RdKafka::ERR__PARTITION_EOF:
      errstr = message->errstr();
      // exit_eof && ++eof_cnt == partition_cnt
      break;

    case RdKafka::ERR__UNKNOWN_TOPIC:
    case RdKafka::ERR__UNKNOWN_PARTITION:
      errstr = message->errstr();
      stop_running = true;
      break;

    default:
      /* Errors */
      errstr = message->errstr();
      stop_running = true;  // We don't know what this is so back out
  }
}

Message::~Message() {
  if (m_message) {
    delete m_message;
  }
}

size_t Message::Size() {
  return size;
}

void Message::Free(char * data, void * hint) {
  Message* m = static_cast<Message*>(hint);
  // @note Am I responsible for freeing data as well?
  delete m;
}

v8::Local<v8::Object> Message::ToBuffer() {
  Nan::MaybeLocal<v8::Object> buff =
    Nan::NewBuffer(static_cast<char*>(Payload()),
    static_cast<int>(Size()),
    Message::Free,
    this);

  return buff.ToLocalChecked();
}

bool Message::IsError() {
  return m_errcode != RdKafka::ERR_NO_ERROR;
}

v8::Local<v8::Object> Message::GetErrorObject() {
  return RdKafkaError(m_errcode);
}

char* Message::Payload() {
  return static_cast<char *>(payload);
}

bool Message::ConsumerShouldStop() {
  return stop_running;
}

}  // namespace NodeKafka
