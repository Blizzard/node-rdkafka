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

  Nan::Set(pack, Nan::New<v8::String>("payload").ToLocalChecked(), ToBuffer());
  Nan::Set(pack, Nan::New<v8::String>("size").ToLocalChecked(),
    Nan::New<v8::Number>(m_size));

  if (m_key) {
    Nan::Set(pack, Nan::New<v8::String>("key").ToLocalChecked(),
      Nan::New<v8::String>(*m_key).ToLocalChecked());
  } else {
    Nan::Set(pack, Nan::New<v8::String>("key").ToLocalChecked(),
      Nan::Undefined());
  }

  Nan::Set(pack, Nan::New<v8::String>("topic").ToLocalChecked(),
    Nan::New<v8::String>(m_topic_name).ToLocalChecked());
  Nan::Set(pack, Nan::New<v8::String>("offset").ToLocalChecked(),
    Nan::New<v8::Number>(m_offset));
  Nan::Set(pack, Nan::New<v8::String>("partition").ToLocalChecked(),
    Nan::New<v8::Number>(m_partition));

  return pack;
}

RdKafka::ErrorCode Message::errcode() {
  return m_errcode;
}

Message::Message(const RdKafka::ErrorCode &err) {
  m_stop_running = false;
  m_errcode = err;
  m_payload = NULL;
}

Message::Message(RdKafka::Message *message) {
  m_errcode = message->err();
  m_stop_running = false;

  // Starts polling before the partitioner is ready.
  // This may be a problem we want to keep record of
  switch (m_errcode) {
    case RdKafka::ERR_NO_ERROR:
      /* Real message */
      m_size = message->len();
      m_offset = message->offset();

      m_partition = message->partition();

      m_topic_name = message->topic_name();
      m_payload = malloc(message->len());
      memcpy(m_payload, message->payload(), m_size);

      if (message->key()) {
        // copy the key because life sucks
        m_key = new std::string(*message->key());
      } else {
        m_key = NULL;
      }

      break;

    case RdKafka::ERR__TIMED_OUT:
      m_errstr = message->errstr();
      break;

    case RdKafka::ERR__PARTITION_EOF:
      m_errstr = message->errstr();
      // exit_eof && ++eof_cnt == partition_cnt
      break;

    case RdKafka::ERR__UNKNOWN_TOPIC:
    case RdKafka::ERR__UNKNOWN_PARTITION:
      m_errstr = message->errstr();
      m_stop_running = true;
      break;

    default:
      /* Errors */
      m_errstr = message->errstr();
      m_stop_running = true;  // We don't know what this is so back out
  }

}

Message::~Message() {
  if (m_key) {
    delete m_key;
  }
}

size_t Message::Size() {
  return m_size;
}

v8::Local<v8::Object> Message::ToBuffer() {
  Nan::MaybeLocal<v8::Object> buff =
    Nan::NewBuffer(static_cast<char*>(Payload()),
    static_cast<int>(Size()));

  return buff.ToLocalChecked();
}

bool Message::IsError() {
  return m_errcode != RdKafka::ERR_NO_ERROR;
}

v8::Local<v8::Object> Message::GetErrorObject() {
  return RdKafkaError(m_errcode);
}

char* Message::Payload() {
  return static_cast<char *>(m_payload);
}

bool Message::ConsumerShouldStop() {
  return m_stop_running;
}

}  // namespace NodeKafka
