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

#include "src/workers.h"
#include "src/admin.h"

using Nan::FunctionCallbackInfo;

namespace NodeKafka {

/**
 * @brief AdminClient v8 wrapped object.
 *
 * Specializes the connection to wrap a consumer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

AdminClient::AdminClient(Conf* gconfig):
  Connection(gconfig, NULL) {
    rkqu = NULL;
}

AdminClient::~AdminClient() {
  Disconnect();
}

Baton AdminClient::Connect() {
  std::string errstr;

  {
    scoped_shared_write_lock lock(m_connection_lock);
    m_client = RdKafka::Producer::create(m_gconfig, errstr);
  }

  if (!m_client || !errstr.empty()) {
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  if (rkqu == NULL) {
    rkqu = rd_kafka_queue_new(m_client->c_ptr());
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton AdminClient::Disconnect() {
  if (IsConnected()) {
    scoped_shared_write_lock lock(m_connection_lock);

    if (rkqu != NULL) {
      rd_kafka_queue_destroy(rkqu);
      rkqu = NULL;
    }

    delete m_client;
    m_client = NULL;
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

Nan::Persistent<v8::Function> AdminClient::constructor;

void AdminClient::Init(v8::Local<v8::Object> exports) {
  Nan::HandleScope scope;

  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("AdminClient").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  Nan::SetPrototypeMethod(tpl, "createTopic", NodeCreateTopic);
  Nan::SetPrototypeMethod(tpl, "connect", NodeConnect);
  Nan::SetPrototypeMethod(tpl, "disconnect", NodeDisconnect);

  constructor.Reset(tpl->GetFunction());
  exports->Set(Nan::New("AdminClient").ToLocalChecked(), tpl->GetFunction());
}

void AdminClient::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowError("non-constructor invocation not supported");
  }

  if (info.Length() < 1) {
    return Nan::ThrowError("You must supply a global configuration");
  }

  if (!info[0]->IsObject()) {
    return Nan::ThrowError("Global configuration data must be specified");
  }

  std::string errstr;

  Conf* gconfig =
    Conf::create(RdKafka::Conf::CONF_GLOBAL, info[0]->ToObject(), errstr);

  if (!gconfig) {
    return Nan::ThrowError(errstr.c_str());
  }

  AdminClient* client = new AdminClient(gconfig);

  // Wrap it
  client->Wrap(info.This());

  // Then there is some weird initialization that happens
  // basically it sets the configuration data
  // we don't need to do that because we lazy load it

  info.GetReturnValue().Set(info.This());
}

v8::Local<v8::Object> AdminClient::NewInstance(v8::Local<v8::Value> arg) {
  Nan::EscapableHandleScope scope;

  const unsigned argc = 1;

  v8::Local<v8::Value> argv[argc] = { arg };
  v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
  v8::Local<v8::Object> instance =
    Nan::NewInstance(cons, argc, argv).ToLocalChecked();

  return scope.Escape(instance);
}

Baton AdminClient::CreateTopic(rd_kafka_NewTopic_t* topic, int timeout_ms) {
  if (!IsConnected() || rkqu == NULL) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected() || rkqu == NULL) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are creating topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_CREATETOPICS);

    rd_kafka_CreateTopics(m_client->c_ptr(), &topic, 1, options, rkqu);

    rd_kafka_event_t * event_response;

    // Poll the event queue until we get it
    do {
      event_response = rd_kafka_queue_poll(rkqu, timeout_ms);
      if (rd_kafka_event_error(event_response)) {
        // Destroy the options we just made
        rd_kafka_AdminOptions_destroy(options);

        return Baton(static_cast<RdKafka::ErrorCode>(rd_kafka_event_error(event_response)));
      }
    } while (rd_kafka_event_type(event_response) != RD_KAFKA_EVENT_CREATETOPICS_RESULT);

    // Destroy the options we just made
    rd_kafka_AdminOptions_destroy(options);

    /*
    // get the created results
    const rd_kafka_CreateTopics_result_t * create_topic_results =
      rd_kafka_event_CreateTopics_result(event_response);

    size_t created_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_CreateTopics_result_topics(
      create_topic_results,
      &created_topic_count
    );

    for (int i = 0 ; i < (int)created_topic_count ; i++) {
      const rd_kafka_topic_result_t *terr = restopics[i];

      Log(rd_kafka_topic_result_name(terr));
    }*/

    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

void AdminClient::ActivateDispatchers() {
  // Listen to global config
  m_gconfig->listen();

  // Listen to non global config
  // tconfig->listen();

  // This should be refactored to config based management
  m_event_cb.dispatcher.Activate();
}
void AdminClient::DeactivateDispatchers() {
  // Stop listening to the config dispatchers
  m_gconfig->stop();

  // Also this one
  m_event_cb.dispatcher.Deactivate();
}

/**
 * @section
 * C++ Exported prototype functions
 */

 NAN_METHOD(AdminClient::NodeConnect) {
   Nan::HandleScope scope;

   AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

   Baton b = client->Connect();
   // Let the JS library throw if we need to so the error can be more rich
   int error_code = static_cast<int>(b.err());
   return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
 }

 NAN_METHOD(AdminClient::NodeDisconnect) {
   Nan::HandleScope scope;

   AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

   Baton b = client->Disconnect();
   // Let the JS library throw if we need to so the error can be more rich
   int error_code = static_cast<int>(b.err());
   return info.GetReturnValue().Set(Nan::New<v8::Number>(error_code));
 }

/**
 * Create topic
 */
NAN_METHOD(AdminClient::NodeCreateTopic) {
   Nan::HandleScope scope;

   if (info.Length() < 2 || !info[1]->IsFunction()) {
     // Just throw an exception
     return Nan::ThrowError("Need to specify a callback");
   }

   v8::Local<v8::Function> cb = info[1].As<v8::Function>();
   Nan::Callback *callback = new Nan::Callback(cb);
   AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

   std::string errstr;
   // Get that topic we want to create
   rd_kafka_NewTopic_t* topic = Conversion::Admin::FromV8TopicObject(info[0].As<v8::Object>(), errstr);

   if (topic == NULL) {
     Nan::ThrowError(errstr.c_str());
     return;
   }

   // Queue up dat work
   Nan::AsyncQueueWorker(new Workers::AdminClientCreateTopic(callback, client, topic, 1000));

   return info.GetReturnValue().Set(Nan::Null());
 }

}  // namespace NodeKafka
