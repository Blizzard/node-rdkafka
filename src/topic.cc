/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>
#include <vector>

#include "src/common.h"
#include "src/connection.h"
#include "src/topic.h"

namespace NodeKafka {

/**
 * @brief Producer v8 wrapped object.
 *
 * Wraps the RdKafka::Producer object with compositional inheritence and
 * provides methods for interacting with it exposed to node.
 *
 * The base wrappable RdKafka::Handle deals with most of the wrapping but
 * we still need to declare its prototype.
 *
 * @sa RdKafka::Producer
 * @sa NodeKafka::Connection
 */

Topic::Topic(std::string topic_name, RdKafka::Conf* config, Connection * handle) {  // NOLINT
  Baton b = handle->CreateTopic(topic_name, config);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    m_topic = NULL;
  } else {
    m_topic = b.data<RdKafka::Topic*>();
  }
}

Topic::~Topic() {
  if (m_topic) {
    delete m_topic;
  }
}

Nan::Persistent<v8::Function> Topic::constructor;

void Topic::Init(v8::Local<v8::Object> exports) {
  Nan::HandleScope scope;

  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("Topic").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  Nan::SetPrototypeMethod(tpl, "name", NodeGetName);

  // connect. disconnect. resume. pause. get meta data
  constructor.Reset(tpl->GetFunction());

  exports->Set(Nan::New("Topic").ToLocalChecked(), tpl->GetFunction());
}

void Topic::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowError("non-constructor invocation not supported");
  }

  if (info.Length() < 3) {
    return Nan::ThrowError("Handle, topic name, configuration required");
  }

  if (!info[0]->IsString()) {
    return Nan::ThrowError("Topic name must be a string");
  }

  Nan::Utf8String parameterValue(info[0]->ToString());
  std::string topic_name(*parameterValue);

  if (!info[1]->IsObject()) {
    return Nan::ThrowError("Configuration data must be specified");
  }

  std::string errstr;

  RdKafka::Conf* config =
    Conf::create(RdKafka::Conf::CONF_TOPIC, info[1]->ToObject(), errstr);

  if (!config) {
    return Nan::ThrowError(errstr.c_str());
  }

  if (!info[2]->IsObject()) {
    return Nan::ThrowError("Client is not of valid type.");
  }

  Connection* connection = ObjectWrap::Unwrap<Connection>(info[2]->ToObject());

  if (!connection->IsConnected()) {
    return Nan::ThrowError("Client is not connected");
  }

  Topic* topic = new Topic(topic_name, config, connection);

  // Wrap it
  topic->Wrap(info.This());

  // Then there is some weird initialization that happens
  // basically it sets the configuration data
  // we don't need to do that because we lazy load it

  info.GetReturnValue().Set(info.This());
}

// handle

v8::Local<v8::Object> Topic::NewInstance(v8::Local<v8::Value> arg) {
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;

  v8::Local<v8::Value> argv[argc] = { arg };
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance =
    Nan::NewInstance(cons, argc, argv).ToLocalChecked();

  return scope.Escape(instance);
}

std::string Topic::name() {
  return m_topic->name();
}

RdKafka::Topic * Topic::toRDKafkaTopic() {
  return m_topic;
}

/*

bool partition_available(int32_t partition) {
  return topic_->partition_available(partition);
}

Baton offset_store (int32_t partition, int64_t offset) {
  RdKafka::ErrorCode err = topic_->offset_store(partition, offset);

  switch (err) {
    case RdKafka::ERR_NO_ERROR:

      break;
    default:

      break;
  }
}

*/

NAN_METHOD(Topic::NodeGetName) {
  Nan::HandleScope scope;

  Topic* topic = ObjectWrap::Unwrap<Topic>(info.This());

  info.GetReturnValue().Set(Nan::New(topic->name()).ToLocalChecked());
}

NAN_METHOD(Topic::NodePartitionAvailable) {
  // @TODO(sparente)
}

NAN_METHOD(Topic::NodeOffsetStore) {
  // @TODO(sparente)
}

}  // namespace NodeKafka
