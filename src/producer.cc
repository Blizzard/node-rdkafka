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

Producer::Producer(RdKafka::Conf* gconfig, RdKafka::Conf* tconfig):
  Connection(gconfig, tconfig),
  m_dr_cb(),
  m_partitioner_cb() {
    std::string errstr;

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
  Nan::SetPrototypeMethod(tpl, "produceSync", NodeProduceSync);

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

  RdKafka::Conf* gconfig =
    Config::Create(RdKafka::Conf::CONF_GLOBAL, info[0]->ToObject(), errstr);

  if (!gconfig) {
    return Nan::ThrowError(errstr.c_str());
  }

  RdKafka::Conf* tconfig =
    Config::Create(RdKafka::Conf::CONF_TOPIC, info[1]->ToObject(), errstr);

  if (!tconfig) {
    // No longer need this since we aren't instantiating anything
    delete gconfig;
    return Nan::ThrowError(errstr.c_str());
  }

  Producer* producer = new Producer(gconfig, gconfig);

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
  v8::Local<v8::Object> instance = cons->NewInstance(argc, argv);

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

  RdKafka::wait_destroyed(1000);
}

Baton Producer::Produce(ProducerMessage* msg) {
  return Produce(msg->Payload(), msg->Size(), msg->GetTopic(),
    msg->partition, msg->key);
}

Baton Producer::Produce(void* message, size_t size, std::string topic_name,
  int32_t partition, std::string *key) {
  std::string errstr;

  RdKafka::Topic* topic =
    RdKafka::Topic::create(m_client, topic_name, m_tconfig, errstr);

  if (errstr.empty()) {
    // Cede ownership of the pointer to this function
    return Produce(message, size, topic, partition, key);
  }

  // We own the pointer here so we need to free it
  free(message);
  return Baton(RdKafka::ERR__INVALID_ARG);
}

Baton Producer::Produce(void* message, size_t size, RdKafka::Topic* topic,
  int32_t partition, std::string *key) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_mutex_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);

      response_code = producer->produce(topic, partition,
            RdKafka::Producer::RK_MSG_FREE, message, size, NULL, NULL);

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
NAN_METHOD(Producer::NodeProduceSync) {
  Nan::HandleScope scope;

  // Need to extract the message data here.
  if (info.Length() < 2 || !info[0]->IsObject() || !info[1]->IsObject()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify message data and topic");
  }

  v8::Local<v8::Object> obj = info[0].As<v8::Object>();

  // Second parameter is a topic config
  Topic* topic = ObjectWrap::Unwrap<Topic>(info[1].As<v8::Object>());

  ProducerMessage* message = new ProducerMessage(obj, topic);
  if (message->IsEmpty()) {
    if (message->errstr.empty()) {
      return Nan::ThrowError("Need to specify a message to send");
    } else {
      return Nan::ThrowError(message->errstr.c_str());
    }
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  // Make a fake callback for this function to call.
  Baton b = producer->Produce(message);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    info.GetReturnValue().Set(b.ToObject());
  } else {
    info.GetReturnValue().Set(Nan::True());
  }
}

NAN_METHOD(Producer::NodeProduce) {
  Nan::HandleScope scope;

  // This needs to be offloaded to libuv
  // Need to extract the message data here.
  if (info.Length() < 2 || !info[0]->IsObject() || !info[1]->IsObject()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify message data and topic");
  }

  v8::Local<v8::Object> obj = info[0].As<v8::Object>();

  // Second parameter is a topic config
  Topic* topic = ObjectWrap::Unwrap<Topic>(info[1].As<v8::Object>());

  ProducerMessage* message = new ProducerMessage(obj, topic);
  if (message->IsEmpty()) {
    if (message->errstr.empty()) {
      return Nan::ThrowError("Need to specify a message to send");
    } else {
      return Nan::ThrowError(message->errstr.c_str());
    }
  }

  Producer* producer = ObjectWrap::Unwrap<Producer>(info.This());

  if (info.Length() < 3 || !info[2]->IsFunction()) {
    return Nan::ThrowError("You must provide a callback");
  }

  v8::Local<v8::Function> cb = info[2].As<v8::Function>();

  Nan::Callback * callback = new Nan::Callback(cb);

  Nan::AsyncQueueWorker(
    new Workers::ProducerProduce(callback, producer, message));
  info.GetReturnValue().Set(Nan::Null());
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

/**
 * @brief Producer message object.
 *
 * Handles conversions between v8::Values for topic config and message config
 *
 * Rather than have the Producer itself worry about v8 I'd rather it be decoupled.
 * Similarly to the way we have topics deal with conversions of v8 objects
 * rather than the Producer itself, we have this message object deal with
 * validating object parameters and getting it ready to send.
 *
 * @sa RdKafka::Producer::send
 * @sa NodeKafka::Consumer::Produce
 */

ProducerMessage::ProducerMessage(v8::Local<v8::Object> obj, Topic * topic):
  topic_(topic),
  is_empty(true) {
  // We have this bad boy now
  v8::Local<v8::String> partitionField = Nan::New("partition").ToLocalChecked();
  if (Nan::Has(obj, partitionField).FromMaybe(false)) {
    v8::Local<v8::Value> partitionVal =
      Nan::Get(obj, partitionField).ToLocalChecked();

    if (!partitionVal->IsNumber()) {
      partition = -1;
    } else {
      partition = Nan::To<int64_t>(partitionVal).FromJust();
    }

  } else {
    partition = -1;
  }

  if (partition < 0) {
    partition = RdKafka::Topic::PARTITION_UA;  // this is just -1
  }

  // This one is a buffer
  v8::Local<v8::String> field = Nan::New("message").ToLocalChecked();
  if (Nan::Has(obj, field).FromMaybe(false)) {
    Nan::MaybeLocal<v8::Value> buffer_pre_object =
      Nan::Get(obj, field);

    if (buffer_pre_object.IsEmpty()) {
      // this is an error object then
      // errstr = "Missing message parameter";
      return;
    }

    v8::Local<v8::Value> buffer_value = buffer_pre_object.ToLocalChecked();

    if (!node::Buffer::HasInstance(buffer_value)) {
      return;
    }

    v8::Local<v8::Object> buffer_object = buffer_value->ToObject();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    buffer_length = node::Buffer::Length(buffer_object);
    buffer_data = malloc(buffer_length);
    memcpy(buffer_data, node::Buffer::Data(buffer_object), buffer_length);
  } else {
    return;
  }

  is_empty = false;

  // partition = GetParameter<int32_t>(obj, "partition", 0);
  std::string key_string = GetParameter<std::string>(obj, "key", "");
  key = &key_string;
}

ProducerMessage::~ProducerMessage() {}

bool ProducerMessage::IsEmpty() {
  return is_empty;
}

void* ProducerMessage::Payload() {
  return buffer_data;
}

RdKafka::Topic* ProducerMessage::GetTopic() {
  return topic_->toRDKafkaTopic();
}

size_t ProducerMessage::Size() {
  return buffer_length;
}

}  // namespace NodeKafka
