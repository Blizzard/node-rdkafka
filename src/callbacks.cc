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

#include "src/callbacks.h"
#include "src/consumer.h"

using v8::Local;
using v8::Value;
using v8::Object;
using v8::String;
using v8::Array;
using v8::Number;

namespace NodeKafka {
namespace Callbacks {

Dispatcher::Dispatcher() {
  async = NULL;
  uv_mutex_init(&async_lock);
}

Dispatcher::~Dispatcher() {
  if (callbacks.size() < 1) return;

  for (size_t i=0; i < callbacks.size(); i++) {
    callbacks[i].Reset();
  }

  uv_mutex_destroy(&async_lock);
}

// Only run this if we aren't already listening
void Dispatcher::Activate() {
  if (!async) {
    async = new uv_async_t;
    uv_async_init(uv_default_loop(), async, AsyncMessage_);

    async->data = this;
  }
}

// Should be able to run this regardless of whether it is active or not
void Dispatcher::Deactivate() {
  if (async) {
    uv_close(reinterpret_cast<uv_handle_t*>(async), NULL);
    async = NULL;
  }
}

bool Dispatcher::HasCallbacks() {
  return callbacks.size() > 0;
}

void Dispatcher::Execute() {
  if (async) {
    uv_async_send(async);
  }
}

void Dispatcher::Dispatch(const int _argc, Local<Value> _argv[]) {
  // This should probably be an array of v8 values
  if (!HasCallbacks()) {
    return;
  }

  for (size_t i=0; i < callbacks.size(); i++) {
    v8::Local<v8::Function> f = Nan::New<v8::Function>(callbacks[i]);
    Nan::Callback cb(f);
    cb.Call(_argc, _argv);
  }
}

void Dispatcher::AddCallback(v8::Local<v8::Function> func) {
  Nan::Persistent<v8::Function,
                  Nan::CopyablePersistentTraits<v8::Function> > value(func);
  // PersistentCopyableFunction value(func);
  callbacks.push_back(value);
}

event_t::event_t(const RdKafka::Event &event) {
  message = "";
  fac = "";

  type = event.type();

  switch (type = event.type()) {
    case RdKafka::Event::EVENT_ERROR:
      message = RdKafka::err2str(event.err());
    break;
    case RdKafka::Event::EVENT_STATS:
      message = event.str();
    break;
    case RdKafka::Event::EVENT_LOG:
      severity = event.severity();
      fac = event.fac();
      message = event.str();
    break;
    case RdKafka::Event::EVENT_THROTTLE:
      message = RdKafka::err2str(event.err());
      throttle_time = event.throttle_time();
      broker_name = event.broker_name();
      broker_id = static_cast<int>(event.broker_id());
    break;
    default:
      message = event.str();
    break;
  }
}
event_t::~event_t() {}

// Event callback
Event::Event():
  dispatcher() {}

Event::~Event() {}

void Event::event_cb(RdKafka::Event &event) {
  // Second parameter is going to be an object with properties to
  // represent the others.

  if (!dispatcher.HasCallbacks()) {
    return;
  }

  event_t e(event);

  dispatcher.Add(e);
  dispatcher.Execute();
}

EventDispatcher::EventDispatcher() {}
EventDispatcher::~EventDispatcher() {}

void EventDispatcher::Add(const event_t &e) {
  scoped_mutex_lock lock(async_lock);
  events.push_back(e);
}

void EventDispatcher::Flush() {
  Nan::HandleScope scope;
  // Iterate through each of the currently stored events
  // generate a callback object for each, setting to the members
  // then
  if (events.size() < 1) return;

  const unsigned int argc = 2;

  std::vector<event_t> _events;
  {
    scoped_mutex_lock lock(async_lock);
    events.swap(_events);
  }

  for (size_t i=0; i < _events.size(); i++) {
    Local<Value> argv[argc] = {};
    Local<Object> jsobj = Nan::New<Object>();

    switch (_events[i].type) {
      case RdKafka::Event::EVENT_ERROR:
        argv[0] = Nan::New("error").ToLocalChecked();
        argv[1] = Nan::Error(_events[i].message.c_str());

        // if (event->err() == RdKafka::ERR__ALL_BROKERS_DOWN). Stop running
        // This may be better suited to the node side of things
        break;
      case RdKafka::Event::EVENT_STATS:
        argv[0] = Nan::New("stats").ToLocalChecked();

        Nan::Set(jsobj, Nan::New("message").ToLocalChecked(),
          Nan::New<String>(_events[i].message.c_str()).ToLocalChecked());

        break;
      case RdKafka::Event::EVENT_LOG:
        argv[0] = Nan::New("log").ToLocalChecked();

        Nan::Set(jsobj, Nan::New("severity").ToLocalChecked(),
          Nan::New(_events[i].severity));
        Nan::Set(jsobj, Nan::New("fac").ToLocalChecked(),
          Nan::New(_events[i].fac.c_str()).ToLocalChecked());
        Nan::Set(jsobj, Nan::New("message").ToLocalChecked(),
          Nan::New(_events[i].message.c_str()).ToLocalChecked());

        break;
      case RdKafka::Event::EVENT_THROTTLE:
        argv[0] = Nan::New("throttle").ToLocalChecked();

        Nan::Set(jsobj, Nan::New("message").ToLocalChecked(),
          Nan::New(_events[i].message.c_str()).ToLocalChecked());

        Nan::Set(jsobj, Nan::New("throttleTime").ToLocalChecked(),
          Nan::New(_events[i].throttle_time));
        Nan::Set(jsobj, Nan::New("brokerName").ToLocalChecked(),
          Nan::New(_events[i].broker_name).ToLocalChecked());
        Nan::Set(jsobj, Nan::New("brokerId").ToLocalChecked(),
          Nan::New<Number>(_events[i].broker_id));

        break;
      default:
        argv[0] = Nan::New("event").ToLocalChecked();

        Nan::Set(jsobj, Nan::New("message").ToLocalChecked(),
          Nan::New(events[i].message.c_str()).ToLocalChecked());

        break;
    }

    if (_events[i].type != RdKafka::Event::EVENT_ERROR) {
      // error would be assigned already
      argv[1] = jsobj;
    }

    Dispatch(argc, argv);
  }
}

DeliveryReportDispatcher::DeliveryReportDispatcher() {}
DeliveryReportDispatcher::~DeliveryReportDispatcher() {}

void DeliveryReportDispatcher::Add(const delivery_report_t &e) {
  scoped_mutex_lock lock(async_lock);
  events.push_back(e);
}

void DeliveryReportDispatcher::Flush() {
  Nan::HandleScope scope;
  //
  if (events.size() < 1) return;

  const unsigned int argc = 2;

  std::vector<delivery_report_t> _events;
  {
    scoped_mutex_lock lock(async_lock);
    events.swap(_events);
  }

  for (size_t i=0; i < _events.size(); i++) {
    v8::Local<v8::Value> argv[argc] = {};

    if (_events[i].is_error) {
        // If it is an error we need the first argument to be set
        argv[0] = Nan::Error(_events[i].error_string.c_str());
    } else {
        argv[0] = Nan::Null();
    }
    Local<Object> jsobj(Nan::New<Object>());

    Nan::Set(jsobj, Nan::New("topic").ToLocalChecked(),
            Nan::New(_events[i].topic_name).ToLocalChecked());
    Nan::Set(jsobj, Nan::New("partition").ToLocalChecked(),
            Nan::New<v8::Number>(_events[i].partition));
    Nan::Set(jsobj, Nan::New("offset").ToLocalChecked(),
            Nan::New<v8::Number>(_events[i].offset));
    if (_events[i].key.empty()) {
        Nan::Set(jsobj, Nan::New("key").ToLocalChecked(), Nan::Null());
    } else {
        Nan::Set(jsobj, Nan::New("key").ToLocalChecked(),
                Nan::New<v8::String>(_events[i].key).ToLocalChecked());
    }

    if (_events[i].payload) {
        Nan::MaybeLocal<v8::Object> buff = Nan::NewBuffer(
                static_cast<char*>(_events[i].payload),
                static_cast<int>(_events[i].len));
        Nan::Set(jsobj, Nan::New<v8::String>("value").ToLocalChecked(),
                buff.ToLocalChecked());
    }
    Nan::Set(jsobj, Nan::New<v8::String>("size").ToLocalChecked(),
            Nan::New<v8::Number>(_events[i].len));

    argv[1] = jsobj;

    Dispatch(argc, argv);
  }
}

delivery_report_t::delivery_report_t(RdKafka::Message &message,
        bool dr_copy_payload) {
  if (message.err() == RdKafka::ERR_NO_ERROR) {
    is_error = false;
  } else {
    is_error = true;
    error_code = message.err();
    error_string = message.errstr();
  }

  topic_name = message.topic_name();
  partition = message.partition();
  offset = message.offset();
  if (message.key_len() > 0) {
    key = *message.key();
  } else {
    key = "";
  }
  len = message.len();
  if (len > 0 && dr_copy_payload) {
      // this pointer will be owned and freed by the Nan::NewBuffer
      // created in DeliveryReportDispatcher::Flush()
      payload = malloc(len);
      memcpy(payload, message.payload(), len);
  } else {
      payload = NULL;
  }
}

delivery_report_t::~delivery_report_t() {}

// Delivery Report

Delivery::Delivery():
  dispatcher() {}
Delivery::~Delivery() {}

void Delivery::dr_cb(RdKafka::Message &message) {
  if (!dispatcher.HasCallbacks()) {
    return;
  }

  delivery_report_t msg(message, dispatcher.dr_copy_payload);
  dispatcher.Add(msg);
  dispatcher.Execute();
}

// Rebalance CB

RebalanceDispatcher::RebalanceDispatcher() {}
RebalanceDispatcher::~RebalanceDispatcher() {}

void RebalanceDispatcher::Add(const rebalance_event_t &e) {
  scoped_mutex_lock lock(async_lock);
  events.push_back(e);
}

void RebalanceDispatcher::Flush() {
  Nan::HandleScope scope;
  // Iterate through each of the currently stored events
  // generate a callback object for each, setting to the members
  // then

  if (events.size() < 1) return;

  const unsigned int argc = 1;

  std::vector<rebalance_event_t> _events;
  {
    scoped_mutex_lock lock(async_lock);
    events.swap(_events);
  }

  for (size_t i=0; i < _events.size(); i++) {
    v8::Local<v8::Value> argv[argc] = {};
    Local<Object> jsobj(Nan::New<Object>());

    switch (_events[i].err) {
      case RdKafka::ERR__ASSIGN_PARTITIONS:
        Nan::Set(jsobj, Nan::New("code").ToLocalChecked(),
          Nan::New(500));
      break;
      default:
        Nan::Set(jsobj, Nan::New("code").ToLocalChecked(),
          Nan::New(501));
      break;
    }

    std::vector<rebalance_topic_partition_t> parts = _events[i].partitions;

    v8::Local<v8::Array> tp_array = Nan::New<v8::Array>();

    for (size_t i = 0; i < parts.size(); i++) {
      v8::Local<v8::Object> tp_obj = Nan::New<v8::Object>();
      rebalance_topic_partition_t tp = parts[i];

      Nan::Set(tp_obj, Nan::New("topic").ToLocalChecked(),
        Nan::New<v8::String>(tp.topic.c_str()).ToLocalChecked());
      Nan::Set(tp_obj, Nan::New("partition").ToLocalChecked(),
        Nan::New<v8::Number>(tp.partition));

      if (tp.offset >= 0) {
        Nan::Set(tp_obj, Nan::New("offset").ToLocalChecked(),
          Nan::New<v8::Number>(tp.offset));
      }

      tp_array->Set(i, tp_obj);
    }
    // Now convert the TopicPartition list to a JS array
    Nan::Set(jsobj, Nan::New("assignment").ToLocalChecked(), tp_array);

    argv[0] = jsobj;

    Dispatch(argc, argv);
  }
}

Rebalance::Rebalance(v8::Local<v8::Function> &cb) {
  dispatcher.AddCallback(cb);
}
Rebalance::~Rebalance() {}

void Rebalance::rebalance_cb(RdKafka::KafkaConsumer *consumer,
    RdKafka::ErrorCode err, std::vector<RdKafka::TopicPartition*> &partitions) {
  dispatcher.Add(rebalance_event_t(err, partitions));
  dispatcher.Execute();
}

// Partitioner callback

Partitioner::Partitioner() {}
Partitioner::~Partitioner() {}

int32_t Partitioner::partitioner_cb(const RdKafka::Topic *topic,
                                    const std::string *key,
                                    int32_t partition_cnt,
                                    void *msg_opaque) {
  // Send this and get teh callback and parse the int
  if (callback.IsEmpty()) {
    // default behavior
    return random(topic, partition_cnt);
  }

  Local<Value> argv[3] = {};

  argv[0] = Nan::New<v8::String>(topic->name().c_str()).ToLocalChecked();
  if (key->empty()) {
    argv[1] = Nan::Null();
  } else {
    argv[1] = Nan::New<v8::String>(key->c_str()).ToLocalChecked();
  }

  argv[2] = Nan::New<v8::Int32>(partition_cnt);

  v8::Local<v8::Value> return_value = callback.Call(3, argv);

  Nan::Maybe<int32_t> partition_return = Nan::To<int32_t>(return_value);

  int32_t chosen_partition;

  if (partition_return.IsNothing()) {
    chosen_partition = RdKafka::Topic::PARTITION_UA;
  } else {
     chosen_partition = partition_return.FromJust();
  }

  if (!topic->partition_available(chosen_partition)) {
    return RdKafka::Topic::PARTITION_UA;
  }

  return chosen_partition;
}

unsigned int Partitioner::djb_hash(const char *str, size_t len) {
  unsigned int hash = 5381;
  for (size_t i = 0 ; i < len ; i++)
    hash = ((hash << 5) + hash) + str[i];
  return hash;
}

unsigned int Partitioner::random(const RdKafka::Topic *topic, int32_t max) {
  int32_t random_partition = rand() % max;  // NOLINT

  if (topic->partition_available(random_partition)) {
    return random_partition;
  } else {
    return RdKafka::Topic::PARTITION_UA;
  }
}

void Partitioner::SetCallback(v8::Local<v8::Function> cb) {
  callback(cb);
}


}  // end namespace Callbacks

}  // End namespace NodeKafka
