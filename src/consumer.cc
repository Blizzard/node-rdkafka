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

#include "src/consumer.h"
#include "src/workers.h"

using Nan::FunctionCallbackInfo;

namespace NodeKafka {

consumer_commit_t::consumer_commit_t(std::string topic_name, int partition, int64_t offset) {  // NOLINT
  m_topic_name = topic_name;
  m_partition = partition;
  m_offset = offset;
}

consumer_commit_t::consumer_commit_t() {
  m_topic_name = "";
}

/**
 * @brief Consumer v8 wrapped object.
 *
 * Specializes the connection to wrap a consumer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

Consumer::Consumer(Conf* gconfig, Conf* tconfig):
  Connection(gconfig, tconfig) {
    std::string errstr;

    m_gconfig->set("default_topic_conf", m_tconfig, errstr);
  }

Consumer::~Consumer() {
  // We only want to run this if it hasn't been run already
  Disconnect();
}

Baton Consumer::Connect() {
  if (IsConnected()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  std::string errstr;
  {
    scoped_shared_write_lock lock(m_connection_lock);
    m_client = RdKafka::KafkaConsumer::create(m_gconfig, errstr);
  }

  if (!m_client || !errstr.empty()) {
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  if (m_partitions.size() > 0) {
    m_client->resume(m_partitions);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

void Consumer::ActivateDispatchers() {
  // Listen to global config
  m_gconfig->listen();

  // Listen to non global config
  // tconfig->listen();

  // This should be refactored to config based management
  m_event_cb.dispatcher.Activate();
}

Baton Consumer::Disconnect() {
  // Only close client if it is connected
  RdKafka::ErrorCode err = RdKafka::ERR_NO_ERROR;

  if (IsConnected()) {
    m_is_closing = true;
    {
      scoped_shared_write_lock lock(m_connection_lock);

      RdKafka::KafkaConsumer* consumer =
        dynamic_cast<RdKafka::KafkaConsumer*>(m_client);
      err = consumer->close();

      delete m_client;
      m_client = NULL;
    }
  }

  m_is_closing = false;

  return Baton(err);
}

void Consumer::DeactivateDispatchers() {
  // Stop listening to the config dispatchers
  m_gconfig->stop();

  // Also this one
  m_event_cb.dispatcher.Deactivate();
}

bool Consumer::IsSubscribed() {
  if (!IsConnected()) {
    return false;
  }

  if (!m_is_subscribed) {
    return false;
  }

  return true;
}


bool Consumer::HasAssignedPartitions() {
  return !m_partitions.empty();
}
int Consumer::AssignedPartitionCount() {
  return m_partition_cnt;
}

void Consumer::part_list_print(const std::vector<RdKafka::TopicPartition*> &partitions) {  // NOLINT
  for (unsigned int i = 0 ; i < partitions.size() ; i++)
    std::cerr << partitions[i]->topic() <<
      "[" << partitions[i]->partition() << "], ";
  std::cerr << std::endl;
}

Baton Consumer::Assign(std::vector<RdKafka::TopicPartition*> partitions) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is disconnected");
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  RdKafka::ErrorCode errcode = consumer->assign(partitions);

  if (errcode != RdKafka::ERR_NO_ERROR) {
    return Baton(errcode);
  }

  m_partition_cnt = partitions.size();
  m_partitions.swap(partitions);

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton Consumer::Unassign() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  RdKafka::ErrorCode errcode = consumer->unassign();

  if (errcode != RdKafka::ERR_NO_ERROR) {
    return Baton(errcode);
  }

  m_partitions.empty();
  m_partition_cnt = 0;

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton Consumer::Commit(std::string topic_name, int partition, int64_t offset) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  RdKafka::TopicPartition* topic =
    RdKafka::TopicPartition::create(topic_name, partition);
  topic->set_offset(offset);

  // Need to put topic in a vector for it to work
  std::vector<RdKafka::TopicPartition*> offsets = {topic};

  RdKafka::ErrorCode err = consumer->commitSync(offsets);

  // We are done. Clean up our mess
  delete topic;

  return Baton(err);
}

Baton Consumer::Commit() {
  // sets an error message
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  RdKafka::ErrorCode err = consumer->commitSync();

  return Baton(err);
}

Baton Consumer::Committed(int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  std::vector<RdKafka::TopicPartition*> * partitions =
    new std::vector<RdKafka::TopicPartition*>(m_partitions);

  RdKafka::ErrorCode err = consumer->committed(*partitions, timeout_ms);

  if (err == RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Good to go
    return Baton(partitions);
  }

  return Baton(err);
}

Baton Consumer::Position() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  std::vector<RdKafka::TopicPartition*> * partitions =
    new std::vector<RdKafka::TopicPartition*>(m_partitions);

  RdKafka::ErrorCode err = consumer->position(*partitions);

  if (err == RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Good to go
    return Baton(partitions);
  }

  return Baton(err);
}

Baton Consumer::Subscription() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  // Needs to be a pointer since we're returning it through the baton
  std::vector<std::string> * topics = new std::vector<std::string>;

  RdKafka::ErrorCode err = consumer->subscription(*topics);

  if (err == RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Good to go
    return Baton(topics);
  }

  return Baton(err);
}

Baton Consumer::Unsubscribe() {
  if (IsConnected() && IsSubscribed()) {
    RdKafka::KafkaConsumer* consumer =
      dynamic_cast<RdKafka::KafkaConsumer*>(m_client);
    consumer->unsubscribe();
    m_is_subscribed = false;
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton Consumer::Subscribe(std::vector<std::string> topics) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  RdKafka::ErrorCode errcode = consumer->subscribe(topics);
  if (errcode != RdKafka::ERR_NO_ERROR) {
    return Baton(errcode);
  }

  m_is_subscribed = true;

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton Consumer::Consume(int timeout_ms) {
  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
    } else {
      RdKafka::KafkaConsumer* consumer =
        dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

      RdKafka::Message * message = consumer->consume(timeout_ms);
      RdKafka::ErrorCode response_code = message->err();
      if (response_code != RdKafka::ERR_NO_ERROR) {
        delete message;
        return Baton(response_code);
      }

      return Baton(message);
    }
  } else {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }
}

Baton Consumer::RefreshAssignments() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::KafkaConsumer* consumer =
    dynamic_cast<RdKafka::KafkaConsumer*>(m_client);

  std::vector<RdKafka::TopicPartition*> partition_list;
  RdKafka::ErrorCode err = consumer->assignment(partition_list);

  switch (err) {
    case RdKafka::ERR_NO_ERROR:
      m_partition_cnt = partition_list.size();
      m_partitions.swap(partition_list);
      return Baton(RdKafka::ERR_NO_ERROR);
    break;
    default:
      return Baton(err);
    break;
  }
}

std::string Consumer::Name() {
  if (!IsConnected()) {
    return std::string("");
  }
  return std::string(m_client->name());
}

Nan::Persistent<v8::Function> Consumer::constructor;

void Consumer::Init(v8::Local<v8::Object> exports) {
  Nan::HandleScope scope;

  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("KafkaConsumer").ToLocalChecked());
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
  // Nan::SetPrototypeMethod(tpl, "poll", NodePoll);

  /*
   * Lifecycle events specifically designated for RdKafka::KafkaConsumer
   *
   * @sa RdKafka::KafkaConsumer
   */

  /*
   * @brief Methods exposed to do with message retrieval
   */


  Nan::SetPrototypeMethod(tpl, "subscription", NodeSubscription);
  Nan::SetPrototypeMethod(tpl, "subscribe", NodeSubscribe);
  Nan::SetPrototypeMethod(tpl, "unsubscribe", NodeUnsubscribe);
  Nan::SetPrototypeMethod(tpl, "consumeLoop", NodeConsumeLoop);
  Nan::SetPrototypeMethod(tpl, "consume", NodeConsume);

  /*
   * @brief Methods to do with partition assignment / rebalancing
   */

  Nan::SetPrototypeMethod(tpl, "committed", NodeCommitted);
  Nan::SetPrototypeMethod(tpl, "position", NodePosition);
  Nan::SetPrototypeMethod(tpl, "assign", NodeAssign);
  Nan::SetPrototypeMethod(tpl, "unassign", NodeUnassign);
  Nan::SetPrototypeMethod(tpl, "assignments", NodeAssignments);

  Nan::SetPrototypeMethod(tpl, "commit", NodeCommit);
  Nan::SetPrototypeMethod(tpl, "commitSync", NodeCommitSync);

  constructor.Reset(tpl->GetFunction());
  exports->Set(Nan::New("KafkaConsumer").ToLocalChecked(), tpl->GetFunction());
}

void Consumer::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
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
    delete gconfig;
    return Nan::ThrowError(errstr.c_str());
  }

  Consumer* consumer = new Consumer(gconfig, tconfig);

  // Wrap it
  consumer->Wrap(info.This());

  // Then there is some weird initialization that happens
  // basically it sets the configuration data
  // we don't need to do that because we lazy load it

  info.GetReturnValue().Set(info.This());
}

v8::Local<v8::Object> Consumer::NewInstance(v8::Local<v8::Value> arg) {
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;

  v8::Local<v8::Value> argv[argc] = { arg };
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance =
    Nan::NewInstance(cons, argc, argv).ToLocalChecked();

  return scope.Escape(instance);
}

/* Node exposed methods */

NAN_METHOD(Consumer::NodeCommitted) {
  Nan::HandleScope scope;

  int timeout_ms;
  Nan::Maybe<uint32_t> maybeTimeout =
    Nan::To<uint32_t>(info[0].As<v8::Number>());

  if (maybeTimeout.IsNothing()) {
    timeout_ms = 1000;
  } else {
    timeout_ms = static_cast<int>(maybeTimeout.FromJust());
  }

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());
  Baton b = consumer->RefreshAssignments();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
  }

  Nan::AsyncQueueWorker(
    new Workers::ConsumerCommitted(callback, consumer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Consumer::NodeSubscription) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Baton b = consumer->Subscription();

  if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
  }

  std::vector<std::string> * topics = b.data<std::vector<std::string>*>();

  info.GetReturnValue().Set(Conversion::Topic::ToV8Array(*topics));

  delete topics;
}

NAN_METHOD(Consumer::NodePosition) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());
  Baton br = consumer->RefreshAssignments();

  if (br.err() != RdKafka::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(br.err());
    return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
  }

  Baton b = consumer->Position();

  if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
  }

  std::vector<RdKafka::TopicPartition*> * partitions =
    b.data<std::vector<RdKafka::TopicPartition*>*>();

  info.GetReturnValue().Set(Conversion::TopicPartition::ToV8Array(*partitions)); // NOLINT

  delete partitions;
}

NAN_METHOD(Consumer::NodeAssignments) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Baton b = consumer->RefreshAssignments();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
  }

  info.GetReturnValue().Set(
    Conversion::TopicPartition::ToV8Array(consumer->m_partitions));
}

NAN_METHOD(Consumer::NodeAssign) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsArray()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify an array of partitions");
  }

  v8::Local<v8::Array> partitions = info[0].As<v8::Array>();
  std::vector<RdKafka::TopicPartition*> topic_partitions;

  for (unsigned int i = 0; i < partitions->Length(); ++i) {
    v8::Local<v8::Value> partition_obj_value = partitions->Get(i);
    if (!partition_obj_value->IsObject()) {
      Nan::ThrowError("Must pass topic-partition objects");
    }

    v8::Local<v8::Object> partition_obj = partition_obj_value.As<v8::Object>();

    // Got the object
    int64_t partition = GetParameter<int64_t>(partition_obj, "partition", -1);
    std::string topic = GetParameter<std::string>(partition_obj, "topic", "");

    if (!topic.empty()) {
      RdKafka::TopicPartition* part;

      if (partition < 0) {
        part = Connection::GetPartition(topic);
      } else {
        part = Connection::GetPartition(topic, partition);
      }

      int64_t offset = GetParameter<int64_t>(partition_obj, "offset", -1);
      if (offset >= 0) {
        part->set_offset(offset);
      }

      topic_partitions.push_back(part);
    }
  }

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Baton b = consumer->Assign(topic_partitions);

  // i dont know who manages the memory at this point
  // i have to assume it does because it is asking for pointers

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Nan::ThrowError(RdKafka::err2str(b.err()).c_str());
  }

  info.GetReturnValue().Set(Nan::True());
}

NAN_METHOD(Consumer::NodeUnassign) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  if (!consumer->IsConnected()) {
    Nan::ThrowError("Consumer is disconnected");
    return;
  }

  Baton b = consumer->Unassign();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Nan::ThrowError(RdKafka::err2str(b.err()).c_str());
  }

  info.GetReturnValue().Set(Nan::True());
}

NAN_METHOD(Consumer::NodeUnsubscribe) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Baton b = consumer->Unsubscribe();

  info.GetReturnValue().Set(Nan::New<v8::Number>(static_cast<int>(b.err())));
}

NAN_METHOD(Consumer::NodeCommitSync) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  if (!consumer->IsConnected()) {
    Nan::ThrowError("Consumer is disconnected");
    return;
  }

  // If we are provided a message object
  if (info.Length() >= 1 && info[0]->IsObject()) {
    v8::Local<v8::Object> params = info[0].As<v8::Object>();

    // This one is a buffer
    std::string topic_name = GetParameter<std::string>(params, "topic", "");
    int partition = GetParameter<int>(params, "partition", 0);
    int64_t offset = GetParameter<int64_t>(params, "offset", -1);

    // Do it sync i guess
    Baton b = consumer->Commit(topic_name, partition, offset);

    if (b.err() != RdKafka::ERR_NO_ERROR) {
      info.GetReturnValue().Set(b.ToObject());
      return;
    }

  } else {
    Baton b = consumer->Commit();

    if (b.err() != RdKafka::ERR_NO_ERROR) {
      info.GetReturnValue().Set(b.ToObject());
      return;
    }

    info.GetReturnValue().Set(Nan::True());
  }
}

NAN_METHOD(Consumer::NodeCommit) {
  Nan::HandleScope scope;

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  if (info.Length() >= 1 && info[0]->IsObject()) {
    v8::Local<v8::Object> params = info[0].As<v8::Object>();

    // This one is a buffer
    std::string topic_name = GetParameter<std::string>(params, "topic", "");
    int partition = GetParameter<int>(params, "partition", 0);
    int64_t offset = GetParameter<int64_t>(params, "offset", -1);

    consumer_commit_t commit_request(topic_name, partition, offset);
    v8::Local<v8::Function> cb = info[1].As<v8::Function>();

    Nan::Callback *callback = new Nan::Callback(cb);

    Nan::AsyncQueueWorker(
      new Workers::ConsumerCommit(callback, consumer, commit_request));

    info.GetReturnValue().Set(Nan::Null());

  } else {
    v8::Local<v8::Function> cb = info[0].As<v8::Function>();

    Nan::Callback *callback = new Nan::Callback(cb);
    // These workers likely need to be tracked so we can stop them when we
    //  disconnect or run unubscribe
    Nan::AsyncQueueWorker(new Workers::ConsumerCommit(callback, consumer));

    info.GetReturnValue().Set(Nan::Null());
  }
}

NAN_METHOD(Consumer::NodeSubscribe) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsArray()) {
    // Just throw an exception
    return Nan::ThrowError("First parameter must be an array");
  }

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  v8::Local<v8::Array> topicsArray = info[0].As<v8::Array>();
  std::vector<std::string> topics = Conversion::Topic::ToStringVector(topicsArray);  // NOLINT

  Baton b = consumer->Subscribe(topics);

  int error_code = static_cast<int>(b.err());
  info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
}

NAN_METHOD(Consumer::NodeConsumeLoop) {
  Nan::HandleScope scope;

  if (info.Length() < 2) {
    // Just throw an exception
    return Nan::ThrowError("Invalid number of parameters");
  }

  if (!info[0]->IsNumber()) {
    return Nan::ThrowError("Need to specify a timeout");
  }

  if (!info[1]->IsFunction()) {
    return Nan::ThrowError("Need to specify a callback");
  }

  int timeout_ms;
  Nan::Maybe<uint32_t> maybeTimeout =
    Nan::To<uint32_t>(info[0].As<v8::Number>());

  if (maybeTimeout.IsNothing()) {
    timeout_ms = 1000;
  } else {
    timeout_ms = static_cast<int>(maybeTimeout.FromJust());
  }

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();

  Nan::Callback *callback = new Nan::Callback(cb);
  Nan::AsyncQueueWorker(
    new Workers::ConsumerConsumeLoop(callback, consumer, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Consumer::NodeConsume) {
  Nan::HandleScope scope;

  if (info.Length() < 2) {
    // Just throw an exception
    return Nan::ThrowError("Invalid number of parameters");
  }

  int timeout_ms;
  Nan::Maybe<uint32_t> maybeTimeout =
    Nan::To<uint32_t>(info[0].As<v8::Number>());

  if (maybeTimeout.IsNothing()) {
    timeout_ms = 1000;
  } else {
    timeout_ms = static_cast<int>(maybeTimeout.FromJust());
  }

  if (info[1]->IsNumber()) {
    if (!info[2]->IsFunction()) {
      return Nan::ThrowError("Need to specify a callback");
    }

    v8::Local<v8::Number> numMessagesNumber = info[1].As<v8::Number>();
    Nan::Maybe<uint32_t> numMessagesMaybe = Nan::To<uint32_t>(numMessagesNumber);  // NOLINT

    uint32_t numMessages;
    if (numMessagesMaybe.IsNothing()) {
      return Nan::ThrowError("Parameter must be a number over 0");
    } else {
      numMessages = numMessagesMaybe.FromJust();
    }

    Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

    v8::Local<v8::Function> cb = info[2].As<v8::Function>();
    Nan::Callback *callback = new Nan::Callback(cb);
    Nan::AsyncQueueWorker(
      new Workers::ConsumerConsumeNum(callback, consumer, numMessages, timeout_ms));  // NOLINT

  } else {
    if (!info[1]->IsFunction()) {
      return Nan::ThrowError("Need to specify a callback");
    }

    Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

    v8::Local<v8::Function> cb = info[1].As<v8::Function>();
    Nan::Callback *callback = new Nan::Callback(cb);
    Nan::AsyncQueueWorker(
      new Workers::ConsumerConsume(callback, consumer, timeout_ms));
  }

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Consumer::NodeConnect) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Nan::Callback *callback = new Nan::Callback(info[0].As<v8::Function>());
  Nan::AsyncQueueWorker(new Workers::ConsumerConnect(callback, consumer));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Consumer::NodeDisconnect) {
  Nan::HandleScope scope;

  if (info.Length() < 1 || !info[0]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  v8::Local<v8::Function> cb = info[0].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);
  Consumer* consumer = ObjectWrap::Unwrap<Consumer>(info.This());

  Nan::AsyncQueueWorker(new Workers::ConsumerDisconnect(callback, consumer));
  info.GetReturnValue().Set(Nan::Null());
}

}  // namespace NodeKafka
