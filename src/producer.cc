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

#include "src/producer.h"
#include "src/kafka-consumer.h"
#include "src/workers.h"

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

Producer::Producer(Conf* gconfig, Conf* tconfig):
  Connection(gconfig, tconfig),
  m_dr_cb(),
  m_partitioner_cb() {
    std::string errstr;

    m_gconfig->set("default_topic_conf", m_tconfig, errstr);
    m_gconfig->set("dr_cb", &m_dr_cb, errstr);
  }

Producer::~Producer() {
  Disconnect();
}

Nan::Persistent<v8::Function> Producer::constructor;

void Producer::Init(v8::Local<v8::Object> exports) {
  Nan::HandleScope scope;

  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("Producer").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  /*
   * Lifecycle events inherited from NodeKafka::Connection
   *
   * @sa NodeKafka::Connection
   */

  Nan::SetPrototypeMethod(tpl, "configureCallbacks", NodeConfigureCallbacks);

  /*
   * @brief Methods to do with establishing state
   */

  Nan::SetPrototypeMethod(tpl, "connect", NodeConnect);
  Nan::SetPrototypeMethod(tpl, "disconnect", NodeDisconnect);
  Nan::SetPrototypeMethod(tpl, "getMetadata", NodeGetMetadata);
  Nan::SetPrototypeMethod(tpl, "queryWatermarkOffsets", NodeQueryWatermarkOffsets);  // NOLINT
  Nan::SetPrototypeMethod(tpl, "poll", NodePoll);

  /*
   * @brief Methods exposed to do with message production
   */

  Nan::SetPrototypeMethod(tpl, "setPartitioner", NodeSetPartitioner);
  Nan::SetPrototypeMethod(tpl, "produce", NodeProduce);

  Nan::SetPrototypeMethod(tpl, "flush", NodeFlush);

  /*
   * @brief Methods exposed to do with transactions
   */

  Nan::SetPrototypeMethod(tpl, "initTransactions", NodeInitTransactions);
  Nan::SetPrototypeMethod(tpl, "beginTransaction", NodeBeginTransaction);
  Nan::SetPrototypeMethod(tpl, "commitTransaction", NodeCommitTransaction);
  Nan::SetPrototypeMethod(tpl, "abortTransaction", NodeAbortTransaction);
  Nan::SetPrototypeMethod(tpl, "sendOffsetsToTransaction", NodeSendOffsetsToTransaction);

    // connect. disconnect. resume. pause. get meta data
  constructor.Reset((tpl->GetFunction(Nan::GetCurrentContext()))
    .ToLocalChecked());

  Nan::Set(exports, Nan::New("Producer").ToLocalChecked(),
    tpl->GetFunction(Nan::GetCurrentContext()).ToLocalChecked());
}

void Producer::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowError("non-constructor invocation not supported");
  }

  if (info.Length() < 2) {
    return Nan::ThrowError("You must supply global and topic configuration");
  }

  if (!info[0]->IsObject()) {
    return Nan::ThrowError("Global configuration data must be specified");
  }

  if (!info[1]->IsObject()) {
    return Nan::ThrowError("Topic configuration must be specified");
  }

  std::string errstr;

  Conf* gconfig =
    Conf::create(RdKafka::Conf::CONF_GLOBAL,
      (info[0]->ToObject(Nan::GetCurrentContext())).ToLocalChecked(), errstr);

  if (!gconfig) {
    return Nan::ThrowError(errstr.c_str());
  }

  Conf* tconfig =
    Conf::create(RdKafka::Conf::CONF_TOPIC,
      (info[1]->ToObject(Nan::GetCurrentContext())).ToLocalChecked(), errstr);

  if (!tconfig) {
    // No longer need this since we aren't instantiating anything
    delete gconfig;
    return Nan::ThrowError(errstr.c_str());
  }

  Producer* producer = new Producer(gconfig, tconfig);

  // Wrap it
  producer->Wrap(info.This());

  // Then there is some weird initialization that happens
  // basically it sets the configuration data
  // we don't need to do that because we lazy load it

  info.GetReturnValue().Set(info.This());
}

v8::Local<v8::Object> Producer::NewInstance(v8::Local<v8::Value> arg) {
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;

  v8::Local<v8::Value> argv[argc] = { arg };
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance =
    Nan::NewInstance(cons, argc, argv).ToLocalChecked();

  return scope.Escape(instance);
}


std::string Producer::Name() {
  if (!IsConnected()) {
    return std::string("");
  }
  return std::string(m_client->name());
}

Baton Producer::Connect() {
  if (IsConnected()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  std::string errstr;
  {
    scoped_shared_read_lock lock(m_connection_lock);
    m_client = RdKafka::Producer::create(m_gconfig, errstr);
  }

  if (!m_client) {
    // @todo implement errstr into this somehow
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

void Producer::ActivateDispatchers() {
  m_event_cb.dispatcher.Activate();  // From connection
  m_dr_cb.dispatcher.Activate();
}

void Producer::DeactivateDispatchers() {
  m_event_cb.dispatcher.Deactivate();  // From connection
  m_dr_cb.dispatcher.Deactivate();
}

void Producer::Disconnect() {
  if (IsConnected()) {
    scoped_shared_write_lock lock(m_connection_lock);
    delete m_client;
    m_client = NULL;
  }
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - RdKafka::Topic* object to send the message to. Generally
 * created by NodeKafka::Topic::toRDKafkaTopic
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, RdKafka::Topic* topic,
  int32_t partition, const void *key, size_t key_len, void* opaque) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      response_code = producer->produce(topic, partition,
            RdKafka::Producer::RK_MSG_COPY,
            message, size, key, key_len, opaque);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  // These topics actually link to the configuration
  // they are made from. It's so we can reuse topic configurations
  // That means if we delete it here and librd thinks its still linked,
  // producing to the same topic will try to reuse it and it will die.
  //
  // Honestly, we may need to make configuration a first class object
  // @todo(Conf needs to be a first class object that is passed around)
  // delete topic;

  if (response_code != RdKafka::ERR_NO_ERROR) {
    return Baton(response_code);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - String topic to use so we do not need to create
 * an RdKafka::Topic*
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, std::string topic,
  int32_t partition, std::string *key, int64_t timestamp, void* opaque,
  RdKafka::Headers* headers) {
  return Produce(message, size, topic, partition,
    key ? key->data() : NULL, key ? key->size() : 0,
    timestamp, opaque, headers);
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - String topic to use so we do not need to create
 * an RdKafka::Topic*
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, std::string topic,
  int32_t partition, const void *key, size_t key_len,
  int64_t timestamp, void* opaque, RdKafka::Headers* headers) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      // This one is a bit different
      response_code = producer->produce(topic, partition,
            RdKafka::Producer::RK_MSG_COPY,
            message, size,
            key, key_len,
            timestamp, headers, opaque);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  // These topics actually link to the configuration
  // they are made from. It's so we can reuse topic configurations
  // That means if we delete it here and librd thinks its still linked,
  // producing to the same topic will try to reuse it and it will die.
  //
  // Honestly, we may need to make configuration a first class object
  // @todo(Conf needs to be a first class object that is passed around)
  // delete topic;

  if (response_code != RdKafka::ERR_NO_ERROR) {
    return Baton(response_code);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

void Producer::Poll() {
  m_client->poll(0);
}

void Producer::ConfigureCallback(const std::string &string_key, const v8::Local<v8::Function> &cb, bool add) {
  if (string_key.compare("delivery_cb") == 0) {
    if (add) {
      bool dr_msg_cb = false;
      v8::Local<v8::String> dr_msg_cb_key = Nan::New("dr_msg_cb").ToLocalChecked();
      if (Nan::Has(cb, dr_msg_cb_key).FromMaybe(false)) {
        v8::Local<v8::Value> v = Nan::Get(cb, dr_msg_cb_key).ToLocalChecked();
        if (v->IsBoolean()) {
          dr_msg_cb = Nan::To<bool>(v).ToChecked();
        }
      }
      if (dr_msg_cb) {
        this->m_dr_cb.SendMessageBuffer(true);
      }
      this->m_dr_cb.dispatcher.AddCallback(cb);
    } else {
      this->m_dr_cb.dispatcher.RemoveCallback(cb);
    }
  } else {
    Connection::ConfigureCallback(string_key, cb, add);
  }
}

Baton rdkafkaErrorToBaton(RdKafka::Error* error) {
  if ( NULL == error) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }
  else {
    Baton result(error->code(), error->str(), error->is_fatal(),
                 error->is_retriable(), error->txn_requires_abort());
    delete error;
    return result;
  }
}

Baton Producer::InitTransactions(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->init_transactions(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::BeginTransaction() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->begin_transaction();

  return rdkafkaErrorToBaton( error);
}

Baton Producer::CommitTransaction(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->commit_transaction(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::AbortTransaction(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->abort_transaction(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::SendOffsetsToTransaction(
  std::vector<RdKafka::TopicPartition*> &offsets,
  NodeKafka::KafkaConsumer* consumer,
  int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ConsumerGroupMetadata* group_metadata = dynamic_cast<RdKafka::KafkaConsumer*>(consumer->m_client)->groupMetadata();

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->send_offsets_to_transaction(offsets, group_metadata, timeout_ms);
  delete group_metadata;

  return rdkafkaErrorToBaton( error);
}

/* Node exposed methods */

/**
 * @brief Producer::NodeProduce - produce a message through a producer
 *
 * This is a synchronous method. You may ask, "why?". The answer is because
 * there is no true value doing this asynchronously. All it does is degrade
 * performance. This method does not block - all it does is add a message
 * to a queue. In the case where the queue is full, it will return an error
 * immediately. The only way this method blocks is when you provide it a
 * flag to do so, which we never do.
 *
 * Doing it asynchronously eats up the libuv threadpool for no reason and
 * increases execution time by a very small amount. It will take two ticks of
 * the event loop to execute at minimum - 1 for executing it and another for
 * calling back the callback.
 *
 * @sa RdKafka::Producer::produce
 */
NAN_METHOD(Producer::NodeProduce) {
  Nan::HandleScope scope;

  // Need to extract the message data here.
  if (info.Length() < 3) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a topic, partition, and message");
  }

  // Second parameter is the partition
  int32_t partition;

  if (info[1]->IsNull() || info[1]->IsUndefined()) {
    partition = RdKafka::Topic::PARTITION_UA;
  } else {
    partition = Nan::To<int32_t>(info[1]).FromJust();
  }

  if (partition < 0) {
    partition = RdKafka::Topic::PARTITION_UA;
  }

  size_t message_buffer_length;
  void* message_buffer_data;

  if (info[2]->IsNull()) {
    // This is okay for whatever reason
    message_buffer_length = 0;
    message_buffer_data = NULL;
  } else if (!node::Buffer::HasInstance(info[2])) {
    return Nan::ThrowError("Message must be a buffer or null");
  } else {
    v8::Local<v8::Object> message_buffer_object =
      (info[2]->ToObject(Nan::GetCurrentContext())).ToLocalChecked();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    message_buffer_length = node::Buffer::Length(message_buffer_object);
    message_buffer_data = node::Buffer::Data(message_buffer_object);
    if (message_buffer_data == NULL) {
      // empty string message buffer should not end up as null message
      v8::Local<v8::Object> message_buffer_object_emptystring = Nan::NewBuffer(new char[0], 0).ToLocalChecked();
      message_buffer_length = node::Buffer::Length(message_buffer_object_emptystring);
      message_buffer_data = node::Buffer::Data(message_buffer_object_emptystring);
    }
  }

  size_t key_buffer_length;
  const void* key_buffer_data;
  std::string * key = NULL;

  if (info[3]->IsNull() || info[3]->IsUndefined()) {
    // This is okay for whatever reason
    key_buffer_length = 0;
    key_buffer_data = NULL;
  } else if (node::Buffer::HasInstance(info[3])) {
    v8::Local<v8::Object> key_buffer_object =
      (info[3]->ToObject(Nan::GetCurrentContext())).ToLocalChecked();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    key_buffer_length = node::Buffer::Length(key_buffer_object);
    key_buffer_data = node::Buffer::Data(key_buffer_object);
    if (key_buffer_data == NULL) {
      // empty string key buffer should not end up as null key
        v8::Local<v8::Object> key_buffer_object_emptystring = Nan::NewBuffer(new char[0], 0).ToLocalChecked();
        key_buffer_length = node::Buffer::Length(key_buffer_object_emptystring);
        key_buffer_data = node::Buffer::Data(key_buffer_object_emptystring);
    }
  } else {
    // If it was a string just use the utf8 value.
    v8::Local<v8::String> val = Nan::To<v8::String>(info[3]).ToLocalChecked();
    // Get string pointer for this thing
    Nan::Utf8String keyUTF8(val);
    key = new std::string(*keyUTF8);

    key_buffer_data = key->data();
    key_buffer_length = key->length();
  }

  int64_t timestamp;

  if (info.Length() > 4 && !info[4]->IsUndefined() && !info[4]->IsNull()) {
    if (!info[4]->IsNumber()) {
      return Nan::ThrowError("Timestamp must be a number");
    }

    timestamp = Nan::To<int64_t>(info[4]).FromJust();
  } else {
    timestamp = 0;
  }

  void* opaque = NULL;
  // Opaque handling
  if (info.Length() > 5 && !info[5]->IsUndefined()) {
    // We need to create a persistent handle
    opaque = new Nan::Persistent<v8::Value>(info[5]);
    // To get the local from this later,
    // v8::Local<v8::Object> object = Nan::New(persistent);
  }

  std::vector<RdKafka::Headers::Header> headers;
  if (info.Length() > 6 && !info[6]->IsUndefined()) {
    v8::Local<v8::Array> v8Headers = v8::Local<v8::Array>::Cast(info[6]);

    if (v8Headers->Length() >= 1) {
      for (unsigned int i = 0; i < v8Headers->Length(); i++) {
        v8::Local<v8::Object> header = Nan::Get(v8Headers, i).ToLocalChecked()
          ->ToObject(Nan::GetCurrentContext()).ToLocalChecked();
        if (header.IsEmpty()) {
          continue;
        }

        v8::Local<v8::Array> props = header->GetOwnPropertyNames(
          Nan::GetCurrentContext()).ToLocalChecked();
        Nan::MaybeLocal<v8::String> v8Key = Nan::To<v8::String>(
            Nan::Get(props, 0).ToLocalChecked());
        Nan::MaybeLocal<v8::String> v8Value = Nan::To<v8::String>(
            Nan::Get(header, v8Key.ToLocalChecked()).ToLocalChecked());

        Nan::Utf8String uKey(v8Key.ToLocalChecked());
        std::string key(*uKey);

        Nan::Utf8String uValue(v8Value.ToLocalChecked());
        std::string value(*uValue);
        headers.push_back(
          RdKafka::Headers::Header(key, value.c_str(), value.size()));
      }
    }
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  // Let the JS library throw if we need to so the error can be more rich
  int error_code;

  if (info[0]->IsString()) {
    // Get string pointer for this thing
    Nan::Utf8String topicUTF8(Nan::To<v8::String>(info[0]).ToLocalChecked());
    std::string topic_name(*topicUTF8);
    RdKafka::Headers *rd_headers = RdKafka::Headers::create(headers);

    Baton b = producer->Produce(message_buffer_data, message_buffer_length,
     topic_name, partition, key_buffer_data, key_buffer_length,
     timestamp, opaque, rd_headers);

    error_code = static_cast<int>(b.err());
    if (error_code != 0 && rd_headers) {
      delete rd_headers;
    }
  } else {
    // First parameter is a topic OBJECT
    Topic* topic = ObjectWrap::Unwrap<Topic>(info[0].As<v8::Object>());

    // Unwrap it and turn it into an RdKafka::Topic*
    Baton topic_baton = topic->toRDKafkaTopic(producer);

    if (topic_baton.err() != RdKafka::ERR_NO_ERROR) {
      // Let the JS library throw if we need to so the error can be more rich
      error_code = static_cast<int>(topic_baton.err());

      return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
    }

    RdKafka::Topic* rd_topic = topic_baton.data<RdKafka::Topic*>();

    Baton b = producer->Produce(message_buffer_data, message_buffer_length,
     rd_topic, partition, key_buffer_data, key_buffer_length, opaque);

    // Delete the topic when we are done.
    delete rd_topic;

    error_code = static_cast<int>(b.err());
  }

  if (error_code != 0 && opaque) {
    // If there was an error enqueing this message, there will never
    // be a delivery report for it, so we have to clean up the opaque
    // data now, if there was any.

    Nan::Persistent<v8::Value> *persistent =
      static_cast<Nan::Persistent<v8::Value> *>(opaque);
    persistent->Reset();
    delete persistent;
  }

  if (key != NULL) {
    delete key;
  }

  info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
}

NAN_METHOD(Producer::NodeSetPartitioner) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  producer->m_partitioner_cb.SetCallback(cb);
  info.GetReturnValue().Set(Nan::True());
}

NAN_METHOD(Producer::NodeConnect) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  // This needs to be offloaded to libuv
  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerConnect(callback, producer));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodePoll) {
  Nan::HandleScope scope;

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  if (!producer->IsConnected()) {
    Nan::ThrowError("Producer is disconnected");
  } else {
    producer->Poll();
    info.GetReturnValue().Set(Nan::True());
  }
}

Baton Producer::Flush(int timeout_ms) {
  RdKafka::ErrorCode response_code;
  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      response_code = producer->flush(timeout_ms);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  return Baton(response_code);
}

NAN_METHOD(Producer::NodeFlush) {
  Nan::HandleScope scope;

  if (info.Length() < 2 || !info[1]->IsFunction() || !info[0]->IsNumber()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a timeout and a callback");
  }

  int timeout_ms = Nan::To<int>(info[0]).FromJust();

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  Nan::AsyncQueueWorker(
    new Workers::ProducerFlush(callback, producer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeDisconnect) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }


  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerDisconnect(callback, producer));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeInitTransactions) {
  Nan::HandleScope scope;

  if (info.Length() < 2 || !info[1]->IsFunction() || !info[0]->IsNumber()) {
    return Nan::ThrowError("Need to specify a timeout and a callback");
  }

  int timeout_ms = Nan::To<int>(info[0]).FromJust();

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerInitTransactions(callback, producer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeBeginTransaction) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    return Nan::ThrowError("Need to specify a callback");
  }

  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerBeginTransaction(callback, producer));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeCommitTransaction) {
  Nan::HandleScope scope;

  if (info.Length() < 2 || !info[1]->IsFunction() || !info[0]->IsNumber()) {
    return Nan::ThrowError("Need to specify a timeout and a callback");
  }

  int timeout_ms = Nan::To<int>(info[0]).FromJust();

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerCommitTransaction(callback, producer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeAbortTransaction) {
  Nan::HandleScope scope;

  if (info.Length() < 2 || !info[1]->IsFunction() || !info[0]->IsNumber()) {
    return Nan::ThrowError("Need to specify a timeout and a callback");
  }

  int timeout_ms = Nan::To<int>(info[0]).FromJust();

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerAbortTransaction(callback, producer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Producer::NodeSendOffsetsToTransaction) {
  Nan::HandleScope scope;

  if (info.Length() < 4) {
    return Nan::ThrowError("Need to specify offsets, consumer, timeout for 'send offsets to transaction', and callback");
  }
  if (!info[0]->IsArray()) {
    return Nan::ThrowError("First argument to 'send offsets to transaction' has to be a consumer object");
  }
  if (!info[1]->IsObject()) {
    Nan::ThrowError("Kafka consumer must be provided");
  }
  if (!info[2]->IsNumber()) {
    Nan::ThrowError("Timeout must be provided");
  }
  if (!info[3]->IsFunction()) {
    return Nan::ThrowError("Need to specify a callback");
  }

  std::vector<RdKafka::TopicPartition*> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<v8::Array>());
  NodeKafka::KafkaConsumer* consumer =
    ObjectWrap::Unwrap<KafkaConsumer>(info[1].As<v8::Object>());
  int timeout_ms = Nan::To<int>(info[2]).FromJust();
  v8::Local<v8::Function> cb = info[3].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  Nan::AsyncQueueWorker(new Workers::ProducerSendOffsetsToTransaction(
    callback,
    producer,
    toppars,
    consumer,
    timeout_ms
  ));

  info.GetReturnValue().Set(Nan::Null());
}

}  // namespace NodeKafka
