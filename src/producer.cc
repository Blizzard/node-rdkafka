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

  Nan::SetPrototypeMethod(tpl, "onEvent", NodeOnEvent);

  /*
   * @brief Methods to do with establishing state
   */

  Nan::SetPrototypeMethod(tpl, "connect", NodeConnect);
  Nan::SetPrototypeMethod(tpl, "disconnect", NodeDisconnect);
  Nan::SetPrototypeMethod(tpl, "getMetadata", NodeGetMetadata);
  Nan::SetPrototypeMethod(tpl, "poll", NodePoll);

  /*
   * Lifecycle events specifically designated for RdKafka::Producer
   *
   * @sa RdKafka::Producer
   */

  Nan::SetPrototypeMethod(tpl, "onDeliveryReport", NodeOnDelivery);

  /*
   * @brief Methods exposed to do with message production
   */

  Nan::SetPrototypeMethod(tpl, "setPartitioner", NodeSetPartitioner);
  Nan::SetPrototypeMethod(tpl, "produce", NodeProduce);

    // connect. disconnect. resume. pause. get meta data
  constructor.Reset(tpl->GetFunction());

  exports->Set(Nan::New("Producer").ToLocalChecked(), tpl->GetFunction());
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
    Conf::create(RdKafka::Conf::CONF_GLOBAL, info[0]->ToObject(), errstr);

  if (!gconfig) {
    return Nan::ThrowError(errstr.c_str());
  }

  Conf* tconfig =
    Conf::create(RdKafka::Conf::CONF_TOPIC, info[1]->ToObject(), errstr);

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

  m_client = RdKafka::Producer::create(m_gconfig, errstr);

  if (!m_client) {
    // @todo implement errstr into this somehow
    return Baton(RdKafka::ERR__STATE);
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
    scoped_mutex_lock lock(m_connection_lock);
    // @todo look at hanging
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
  int32_t partition, std::string *key) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_mutex_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      response_code = producer->produce(topic, partition,
            RdKafka::Producer::RK_MSG_COPY, message, size, key, NULL);

      Poll();
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
  if (info.Length() < 3 || !info[0]->IsObject()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a topic, partition, and message");
  }

  // First parameter is a topic
  Topic* topic = ObjectWrap::Unwrap<Topic>(info[0].As<v8::Object>());

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
    v8::Local<v8::Object> message_buffer_object = info[2]->ToObject();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    message_buffer_length = node::Buffer::Length(message_buffer_object);
    message_buffer_data = node::Buffer::Data(message_buffer_object);
  }

  // Last we have to get the key
  std::string * key;

  if (info[3]->IsNull() || info[3]->IsUndefined()) {
    key = NULL;
  } else {
    v8::Local<v8::String> val = info[3]->ToString();
    // Get string pointer for this thing
    Nan::Utf8String keyUTF8(val);
    key = new std::string(*keyUTF8);
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  Baton b = producer->Produce(message_buffer_data, message_buffer_length,
    topic->toRDKafkaTopic(), partition, key);

  // we can delete the key as librdkafka will take a copy of the message
  if (key) {
    delete key;
  }

  // Let the JS library throw if we need to so the error can be more rich
  int error_code = static_cast<int>(b.err());

  info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
}

NAN_METHOD(Producer::NodeOnDelivery) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());
  v8::Local<v8::Function> cb = info[0].As<v8::Function>();

  producer->m_dr_cb.dispatcher.AddCallback(cb);
  info.GetReturnValue().Set(Nan::True());
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

#if RD_KAFKA_VERSION > 0x00090200
Baton Producer::Flush(int timeout_ms) {
  RdKafka::ErrorCode response_code;
  if (IsConnected()) {
    scoped_mutex_lock lock(m_connection_lock);
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

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  int timeout_ms;

  if (info[0]->IsNull() || info[0]->IsUndefined()) {
    timeout_ms = 1000;
  } else {
    timeout_ms = Nan::To<int>(info[0]).FromJust();
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  if (!producer->IsConnected()) {
    Nan::ThrowError("Producer is disconnected");
  } else {
    Baton b = producer->Flush(timeout_ms);
    if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
      return Nan::ThrowError(b.errstr().c_str());
    }
    info.GetReturnValue().Set(Nan::True());
  }
}
#endif

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

}  // namespace NodeKafka
