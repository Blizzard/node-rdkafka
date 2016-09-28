/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>

#include "src/connection.h"
#include "src/workers.h"

using RdKafka::Conf;

namespace NodeKafka {

/**
 * @brief Connection v8 wrapped object.
 *
 * Wraps the RdKafka::Handle object with compositional inheritence and
 * provides sensible defaults for exposing callbacks to node
 *
 * This object can't itself expose methods to the prototype directly, as far
 * as I can tell. But it can provide the NAN_METHODS that just need to be added
 * to the prototype. Since connections, etc. are managed differently based on
 * whether it is a producer or consumer, they manage that. This base class
 * handles some of the wrapping functionality and more importantly, the
 * configuration of callbacks
 *
 * Any callback available to both consumers and producers, like logging or
 * events will be handled in here.
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

Connection::Connection(Conf* gconfig, Conf* tconfig):
  m_event_cb(),
  m_gconfig(gconfig),
  m_tconfig(tconfig) {
    std::string errstr;

    m_client = NULL;
    m_is_closing = false;
    uv_mutex_init(&m_connection_lock);

    // Try to set the event cb. Shouldn't be an error here, but if there
    // is, it doesn't get reported.
    //
    // Perhaps node new methods should report this as an error? But there
    // isn't anything the user can do about it.
    m_gconfig->set("event_cb", &m_event_cb, errstr);
  }

Connection::~Connection() {
  uv_mutex_destroy(&m_connection_lock);

  if (m_tconfig) {
    delete m_tconfig;
  }

  if (m_gconfig) {
    delete m_gconfig;
  }
}

RdKafka::TopicPartition* Connection::GetPartition(std::string &topic) {
  return RdKafka::TopicPartition::create(topic, RdKafka::Topic::PARTITION_UA);
}

RdKafka::TopicPartition* Connection::GetPartition(std::string &topic, int partition) {  // NOLINT
  return RdKafka::TopicPartition::create(topic, partition);
}

bool Connection::IsConnected() {
  return !m_is_closing && m_client != NULL;
}

RdKafka::Handle* Connection::GetClient() {
  return m_client;
}

Baton Connection::CreateTopic(std::string topic_name) {
  return CreateTopic(topic_name, NULL);
}

Baton Connection::CreateTopic(std::string topic_name, RdKafka::Conf* conf) {
  std::string errstr;

  RdKafka::Topic* topic = NULL;

  if (IsConnected()) {
    scoped_mutex_lock lock(m_connection_lock);
    if (IsConnected()) {
    topic = RdKafka::Topic::create(m_client, topic_name, conf, errstr);
    } else {
      return Baton(RdKafka::ErrorCode::ERR__STATE);
    }
  } else {
    return Baton(RdKafka::ErrorCode::ERR__STATE);
  }

  if (!errstr.empty()) {
    return Baton(RdKafka::ErrorCode::ERR_TOPIC_EXCEPTION, errstr);
  }

  // Maybe do it this way later? Then we don't need to do static_cast
  // <RdKafka::Topic*>
  return Baton(topic);
}

Baton Connection::GetMetadata(std::string topic_name, int timeout_ms) {
  RdKafka::Topic* topic = NULL;
  RdKafka::ErrorCode err;

  std::string errstr;

  if (!topic_name.empty()) {
    Baton b = CreateTopic(topic_name);
    if (b.err() == RdKafka::ErrorCode::ERR_NO_ERROR) {
      topic = b.data<RdKafka::Topic*>();
    }
  }

  RdKafka::Metadata* metadata = NULL;

  if (!errstr.empty()) {
    return Baton(RdKafka::ERR_TOPIC_EXCEPTION);
  }

  if (IsConnected()) {
    scoped_mutex_lock lock(m_connection_lock);
    if (IsConnected()) {
      err = m_client->metadata(topic != NULL, topic, &metadata, timeout_ms);
    } else {
      err = RdKafka::ERR__STATE;
    }
  } else {
    err = RdKafka::ERR__STATE;
  }

  if (err == RdKafka::ERR_NO_ERROR) {
    return Baton(metadata);
  } else {
    // metadata is not set here
    // @see https://github.com/edenhill/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L860
    return Baton(err);
  }
}

// NAN METHODS

NAN_METHOD(Connection::NodeGetMetadata) {
  Nan::HandleScope scope;

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

  v8::Local<v8::Object> config;
  if (info[0]->IsObject()) {
    config = info[0].As<v8::Object>();
  } else {
    config = Nan::New<v8::Object>();
  }

  if (!info[1]->IsFunction()) {
    Nan::ThrowError("Second parameter must be a callback");
    return;
  }

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();

  std::string topic = GetParameter<std::string>(config, "topic", "");
  int timeout_ms = GetParameter<int64_t>(config, "timeout", 30000);

  Nan::Callback *callback = new Nan::Callback(cb);

  Nan::AsyncQueueWorker(new Workers::ConnectionMetadata(
    callback, obj, topic, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

// Node methods
NAN_METHOD(Connection::NodeOnEvent) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  obj->m_event_cb.dispatcher.AddCallback(cb);

  info.GetReturnValue().Set(Nan::True());
}

}  // namespace NodeKafka
