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

  // Admin client operations
  Nan::SetPrototypeMethod(tpl, "createTopic", NodeCreateTopic);
  Nan::SetPrototypeMethod(tpl, "deleteTopic", NodeDeleteTopic);
  Nan::SetPrototypeMethod(tpl, "createPartitions", NodeCreatePartitions);

  Nan::SetPrototypeMethod(tpl, "connect", NodeConnect);
  Nan::SetPrototypeMethod(tpl, "disconnect", NodeDisconnect);

  constructor.Reset(
    (tpl->GetFunction(Nan::GetCurrentContext())).ToLocalChecked());
  Nan::Set(exports, Nan::New("AdminClient").ToLocalChecked(),
    tpl->GetFunction(Nan::GetCurrentContext()).ToLocalChecked());
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
    Conf::create(RdKafka::Conf::CONF_GLOBAL,
      (info[0]->ToObject(Nan::GetCurrentContext())).ToLocalChecked(), errstr);

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

/**
 * Poll for a particular event on a queue.
 *
 * This will keep polling until it gets an event of that type,
 * given the number of tries and a timeout
 */
rd_kafka_event_t* PollForEvent(
  rd_kafka_queue_t * topic_rkqu,
  rd_kafka_event_type_t event_type,
  int max_tries,
  int timeout_ms) {
  // Establish what attempt we are on
  int attempt = 0;

  rd_kafka_event_t * event_response;

  // Poll the event queue until we get it
  do {
    // Increment attempt counter
    attempt = attempt + 1;
    event_response = rd_kafka_queue_poll(topic_rkqu, timeout_ms);
  } while (
    rd_kafka_event_type(event_response) != event_type &&
    attempt < max_tries);

  // If this isn't the type of response we want, or if we do not have a response
  // type, bail out with a null
  if (event_response == NULL ||
    rd_kafka_event_type(event_response) != event_type) {
    return NULL;
  }

  return event_response;
}

Baton AdminClient::CreateTopic(rd_kafka_NewTopic_t* topic, int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are creating topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_CREATETOPICS);

    // Create queue just for this operation
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_CreateTopics(m_client->c_ptr(), &topic, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_CREATETOPICS_RESULT,
      5,
      1000);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      return Baton(static_cast<RdKafka::ErrorCode>(
        rd_kafka_event_error(event_response)));
    }

    // get the created results
    const rd_kafka_CreateTopics_result_t * create_topic_results =
      rd_kafka_event_CreateTopics_result(event_response);

    size_t created_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_CreateTopics_result_topics(  // NOLINT
      create_topic_results,
      &created_topic_count);

    for (int i = 0 ; i < static_cast<int>(created_topic_count) ; i++) {
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);
      const char *errmsg = rd_kafka_topic_result_error_string(terr);

      if (errcode != RD_KAFKA_EVENT_CREATETOPICS_RESULT) {
        if (errmsg) {
          return Baton(static_cast<RdKafka::ErrorCode>(errcode), std::string(errmsg)); // NOLINT
        } else {
          return Baton(static_cast<RdKafka::ErrorCode>(errcode));
        }
      }
    }

    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DeleteTopic(rd_kafka_DeleteTopic_t* topic, int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DELETETOPICS);

    // Create queue just for this operation.
    // May be worth making a "scoped queue" class or something like a lock
    // for RAII
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_DeleteTopics(m_client->c_ptr(), &topic, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_DELETETOPICS_RESULT,
      5,
      1000);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      return Baton(static_cast<RdKafka::ErrorCode>(
        rd_kafka_event_error(event_response)));
    }

    // get the created results
    const rd_kafka_DeleteTopics_result_t * delete_topic_results =
      rd_kafka_event_DeleteTopics_result(event_response);

    size_t deleted_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_DeleteTopics_result_topics(  // NOLINT
      delete_topic_results,
      &deleted_topic_count);

    for (int i = 0 ; i < static_cast<int>(deleted_topic_count) ; i++) {
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);

      if (errcode != RD_KAFKA_EVENT_CREATETOPICS_RESULT) {
        return Baton(static_cast<RdKafka::ErrorCode>(errcode));
      }
    }

    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::CreatePartitions(
  rd_kafka_NewPartitions_t* partitions,
  int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_CREATEPARTITIONS);

    // Create queue just for this operation.
    // May be worth making a "scoped queue" class or something like a lock
    // for RAII
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_CreatePartitions(m_client->c_ptr(),
      &partitions, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_CREATEPARTITIONS_RESULT,
      5,
      1000);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      return Baton(static_cast<RdKafka::ErrorCode>(
        rd_kafka_event_error(event_response)));
    }

    // get the created results
    const rd_kafka_CreatePartitions_result_t * create_partitions_results =
      rd_kafka_event_CreatePartitions_result(event_response);

    size_t created_partitions_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_CreatePartitions_result_topics(  // NOLINT
      create_partitions_results,
      &created_partitions_topic_count);

    for (int i = 0 ; i < static_cast<int>(created_partitions_topic_count) ; i++) {  // NOLINT
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);
      const char *errmsg = rd_kafka_topic_result_error_string(terr);

      if (errcode != RD_KAFKA_EVENT_CREATEPARTITIONS_RESULT) {
        if (errmsg) {
          return Baton(static_cast<RdKafka::ErrorCode>(errcode), std::string(errmsg)); // NOLINT
        } else {
          return Baton(static_cast<RdKafka::ErrorCode>(errcode));
        }
      }
    }

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

  if (info.Length() < 3 || !info[2]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  if (!info[1]->IsNumber()) {
    return Nan::ThrowError("Must provide 'timeout'");
  }

  // Create the final callback object
  v8::Local<v8::Function> cb = info[2].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);
  AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

  // Get the timeout
  int timeout = Nan::To<int32_t>(info[2]).FromJust();

  std::string errstr;
  // Get that topic we want to create
  rd_kafka_NewTopic_t* topic = Conversion::Admin::FromV8TopicObject(
    info[0].As<v8::Object>(), errstr);

  if (topic == NULL) {
    Nan::ThrowError(errstr.c_str());
    return;
  }

  // Queue up dat work
  Nan::AsyncQueueWorker(
    new Workers::AdminClientCreateTopic(callback, client, topic, timeout));

  return info.GetReturnValue().Set(Nan::Null());
}

/**
 * Delete topic
 */
NAN_METHOD(AdminClient::NodeDeleteTopic) {
  Nan::HandleScope scope;

  if (info.Length() < 3 || !info[2]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  if (!info[1]->IsNumber() || !info[0]->IsString()) {
    return Nan::ThrowError("Must provide 'timeout', and 'topicName'");
  }

  // Create the final callback object
  v8::Local<v8::Function> cb = info[2].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);
  AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

  // Get the topic name from the string
  std::string topic_name = Util::FromV8String(
    Nan::To<v8::String>(info[0]).ToLocalChecked());

  // Get the timeout
  int timeout = Nan::To<int32_t>(info[2]).FromJust();

  // Get that topic we want to create
  rd_kafka_DeleteTopic_t* topic = rd_kafka_DeleteTopic_new(
    topic_name.c_str());

  // Queue up dat work
  Nan::AsyncQueueWorker(
    new Workers::AdminClientDeleteTopic(callback, client, topic, timeout));

  return info.GetReturnValue().Set(Nan::Null());
}

/**
 * Delete topic
 */
NAN_METHOD(AdminClient::NodeCreatePartitions) {
  Nan::HandleScope scope;

  if (info.Length() < 4) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback");
  }

  if (!info[3]->IsFunction()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callback 2");
  }

  if (!info[2]->IsNumber() || !info[1]->IsNumber() || !info[0]->IsString()) {
    return Nan::ThrowError(
      "Must provide 'totalPartitions', 'timeout', and 'topicName'");
  }

  // Create the final callback object
  v8::Local<v8::Function> cb = info[3].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);
  AdminClient* client = ObjectWrap::Unwrap<AdminClient>(info.This());

  // Get the total number of desired partitions
  int partition_total_count = Nan::To<int32_t>(info[1]).FromJust();

  // Get the topic name from the string
  std::string topic_name = Util::FromV8String(
    Nan::To<v8::String>(info[0]).ToLocalChecked());

  // Create an error buffer we can throw
  char* errbuf = reinterpret_cast<char*>(malloc(100));

  // Create the new partitions request
  rd_kafka_NewPartitions_t* new_partitions = rd_kafka_NewPartitions_new(
    topic_name.c_str(), partition_total_count, errbuf, 100);

  // If we got a failure on the create new partitions request,
  // fail here
  if (new_partitions == NULL) {
    return Nan::ThrowError(errbuf);
  }

  // Queue up dat work
  Nan::AsyncQueueWorker(new Workers::AdminClientCreatePartitions(
    callback, client, new_partitions, 1000));

  return info.GetReturnValue().Set(Nan::Null());
}

}  // namespace NodeKafka
