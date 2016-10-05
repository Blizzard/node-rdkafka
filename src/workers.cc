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

using NodeKafka::Producer;
using NodeKafka::Connection;
using NodeKafka::Message;

namespace NodeKafka {
namespace Workers {

ConnectionMetadata::ConnectionMetadata(
  Nan::Callback *callback, Connection* connection,
  std::string topic, int timeout_ms) :
  ErrorAwareWorker(callback),
  connection_(connection),
  topic_(topic),
  timeout_ms_(timeout_ms),
  m_metadata(NULL) {}

ConnectionMetadata::~ConnectionMetadata() {}

void ConnectionMetadata::Execute() {
  if (!connection_->IsConnected()) {
    SetErrorMessage("You are not connected");
    return;
  }

  Baton b = connection_->GetMetadata(topic_, timeout_ms_);

  if (b.err() == RdKafka::ERR_NO_ERROR) {
    // No good way to do this except some stupid string delimiting.
    // maybe we'll delimit it by a | or something and just split
    // the string to create the object
    m_metadata = b.data<RdKafka::Metadata*>();
  } else {
    SetErrorCode(b.err());
  }
}

void ConnectionMetadata::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;

  // This is a big one!
  v8::Local<v8::Value> argv[argc] = { Nan::Null(),
    Conversion::Metadata::ToV8Object(m_metadata)};

  callback->Call(argc, argv);

  delete m_metadata;
}

void ConnectionMetadata::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Producer connect worker.
 *
 * Easy Nan::AsyncWorker for setting up client connections
 *
 * @sa RdKafka::Producer::connect
 * @sa NodeKafka::Producer::Connect
 */

ProducerConnect::ProducerConnect(Nan::Callback *callback, Producer* producer):
  ErrorAwareWorker(callback),
  producer(producer) {}

ProducerConnect::~ProducerConnect() {}

void ProducerConnect::Execute() {
  Baton b = producer->Connect();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ProducerConnect::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;

  v8::Local<v8::Object> obj = Nan::New<v8::Object>();
  Nan::Set(obj, Nan::New("name").ToLocalChecked(),
    Nan::New(producer->Name()).ToLocalChecked());

  v8::Local<v8::Value> argv[argc] = { Nan::Null(), obj};

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerConnect::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

ProducerDisconnect::ProducerDisconnect(Nan::Callback *callback,
  Producer* producer):
  ErrorAwareWorker(callback),
  producer(producer) {}

ProducerDisconnect::~ProducerDisconnect() {}

void ProducerDisconnect::Execute() {
  producer->Disconnect();
}

void ProducerDisconnect::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc] = { Nan::Null(), Nan::True()};

  // Deactivate the dispatchers
  producer->DeactivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerDisconnect::HandleErrorCallback() {
  // This should never run
  assert(0);
}

ProducerProduce::ProducerProduce(
    Nan::Callback *callback,
    Producer *producer,
    ProducerMessage *message):
  ErrorAwareWorker(callback),
  producer(producer),
  message(message) {}

ProducerProduce::~ProducerProduce() {
  delete message;
}

void ProducerProduce::Execute() {
  Baton b = producer->Produce(message);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ProducerProduce::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  callback->Call(argc, argv);
}

void ProducerProduce::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer connect worker.
 *
 * Easy Nan::AsyncWorker for setting up client connections
 *
 * @sa RdKafka::KafkaConsumer::connect
 * @sa NodeKafka::Consumer::Connect
 */

ConsumerConnect::ConsumerConnect(Nan::Callback *callback, Consumer* consumer):
  ErrorAwareWorker(callback),
  consumer(consumer) {}

ConsumerConnect::~ConsumerConnect() {}

void ConsumerConnect::Execute() {
  Baton b = consumer->Connect();
  // consumer->Wait();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ConsumerConnect::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;

  // Create the object
  v8::Local<v8::Object> obj = Nan::New<v8::Object>();
  Nan::Set(obj, Nan::New("name").ToLocalChecked(),
    Nan::New(consumer->Name()).ToLocalChecked());

  v8::Local<v8::Value> argv[argc] = { Nan::Null(), obj };
  consumer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ConsumerConnect::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer disconnect worker.
 *
 * Easy Nan::AsyncWorker for disconnecting and cleaning up librdkafka artifacts
 *
 * @sa RdKafka::KafkaConsumer::disconnect
 * @sa NodeKafka::Consumer::Disconnect
 */

ConsumerDisconnect::ConsumerDisconnect(Nan::Callback *callback,
  Consumer* consumer):
  ErrorAwareWorker(callback),
  consumer(consumer) {}

ConsumerDisconnect::~ConsumerDisconnect() {}

void ConsumerDisconnect::Execute() {
  Baton b = consumer->Disconnect();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ConsumerDisconnect::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc] = { Nan::Null(), Nan::True() };

  consumer->DeactivateDispatchers();

  callback->Call(argc, argv);
}

void ConsumerDisconnect::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  consumer->DeactivateDispatchers();

  callback->Call(argc, argv);
}

/**
 * @brief Consumer subscribe worker.
 *
 * Easy Nan::AsyncWorker for subscribing to a list of topics
 *
 * @sa RdKafka::KafkaConsumer::Subscribe
 * @sa NodeKafka::Consumer::Subscribe
 */

ConsumerSubscribe::ConsumerSubscribe(Nan::Callback *callback,
  Consumer* consumer,
  std::vector<std::string> topics) :
  ErrorAwareWorker(callback),
  consumer(consumer),
  topics(topics) {}

ConsumerSubscribe::~ConsumerSubscribe() {}

void ConsumerSubscribe::Execute() {
  Baton b = consumer->Subscribe(topics);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ConsumerSubscribe::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  callback->Call(argc, argv);
}

void ConsumerSubscribe::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer unsubscribe worker.
 *
 * Easy Nan::AsyncWorker for unsubscribing from the currently subscribed topics
 *
 * @sa RdKafka::KafkaConsumer::Unsubscribe
 * @sa NodeKafka::Consumer::Unsubscribe
 */

ConsumerUnsubscribe::ConsumerUnsubscribe(Nan::Callback *callback,
                                     Consumer* consumer) :
  ErrorAwareWorker(callback),
  consumer(consumer) {}

ConsumerUnsubscribe::~ConsumerUnsubscribe() {}

void ConsumerUnsubscribe::Execute() {
  Baton b = consumer->Unsubscribe();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ConsumerUnsubscribe::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  callback->Call(argc, argv);
}

void ConsumerUnsubscribe::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer get messages worker.
 *
 * A more complex Nan::AsyncProgressWorker. I made a custom superclass to deal
 * with more real-time progress points. Instead of using ProgressWorker, which
 * is not time sensitive, this custom worker will poll using libuv and send
 * data back to v8 as it comes available without missing any
 *
 * The actual event runs through a continuous while loop. It stops when the
 * consumer is flagged as disconnected or as unsubscribed.
 *
 * @todo thread-safe isConnected checking
 * @note Chances are, when the connection is broken with the way librdkafka works,
 * we are shutting down. But we want it to shut down properly so we probably
 * need the consumer to have a thread lock that can be used when
 * we are dealing with manipulating the `client`
 *
 * @sa RdKafka::KafkaConsumer::Consume
 * @sa NodeKafka::Consumer::GetMessage
 */

ConsumerConsumeLoop::ConsumerConsumeLoop(Nan::Callback *callback,
                                     Consumer* consumer,
                                     const int & timeout_ms) :
  MessageWorker(callback),
  consumer(consumer),
  m_timeout_ms(timeout_ms) {}

ConsumerConsumeLoop::~ConsumerConsumeLoop() {}

void ConsumerConsumeLoop::Execute(const ExecutionMessageBus& bus) {
  // Do one check here before we move forward
  while (consumer->IsConnected()) {
    NodeKafka::Message* message = consumer->Consume(m_timeout_ms);
    if (message->errcode() == RdKafka::ERR__PARTITION_EOF) {
      delete message;
      usleep(1*1000);
    } else if (message->errcode() == RdKafka::ERR__TIMED_OUT) {
      // If it is timed out this could just mean there were no
      // new messages fetched quickly enough. This isn't really
      // an error that should kill us.
      //
      // But... this error is given when we are disconnecting so
      // we need to check that
      delete message;
      usleep(1000*1000);
    } else {
      bus.Send(message);
      if (message->IsError() || message->ConsumerShouldStop()) {
        break;
      }
    }
  }
}

void ConsumerConsumeLoop::HandleMessageCallback(NodeKafka::Message* msg) {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  if (msg->IsError()) {
    argv[0] = msg->GetErrorObject();
    argv[1] = Nan::Null();
    // Delete message here. If it is not passed to a buffer, we need to get rid
    // of it
    delete msg;
  } else {
    argv[0] = Nan::Null();
    argv[1] = msg->Pack();
  }

  callback->Call(argc, argv);
}

void ConsumerConsumeLoop::HandleOKCallback() {
  Nan::HandleScope scope;
}

void ConsumerConsumeLoop::HandleErrorCallback() {
  Nan::HandleScope scope;


  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer get messages worker.
 *
 * This callback will get a number of message. Can be of use in streams or
 * places where you don't want an infinite loop managed in C++land and would
 * rather manage it in Node.
 *
 * @see RdKafka::KafkaConsumer::Consume
 * @see NodeKafka::Consumer::GetMessage
 */

ConsumerConsumeNum::ConsumerConsumeNum(Nan::Callback *callback,
                                     Consumer* consumer,
                                     const uint32_t & num_messages,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_num_messages(num_messages),
  m_timeout_ms(timeout_ms) {}

ConsumerConsumeNum::~ConsumerConsumeNum() {}

void ConsumerConsumeNum::Execute() {
  const int max = static_cast<int>(m_num_messages);
  for (int i = 0; i < max; i++) {
    // Get a message
    NodeKafka::Message* message = m_consumer->Consume(m_timeout_ms);
    if (message->IsError()) {
      if (message->errcode() != RdKafka::ERR__TIMED_OUT &&
          message->errcode() != RdKafka::ERR__PARTITION_EOF) {
        SetErrorCode(message->errcode());
        usleep(1000);
      }
      break;
    }

    m_messages.push_back(message);
  }
}

void ConsumerConsumeNum::HandleOKCallback() {
  Nan::HandleScope scope;
  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];
  argv[0] = Nan::Null();

  v8::Local<v8::Array> returnArray = Nan::New<v8::Array>();

  if (m_messages.size() > 0) {
    int i = -1;
    for (std::vector<NodeKafka::Message*>::iterator it = m_messages.begin();
        it != m_messages.end(); ++it) {
      i++;
      NodeKafka::Message* message = *it;
      returnArray->Set(i, message->Pack());
    }
  }

  argv[1] = returnArray;

  callback->Call(argc, argv);
}

void ConsumerConsumeNum::HandleErrorCallback() {
  Nan::HandleScope scope;

  if (m_messages.size() > 0) {
    for (std::vector<NodeKafka::Message*>::iterator it = m_messages.begin();
        it != m_messages.end(); ++it) {
      NodeKafka::Message* message = *it;
      delete message;
    }
  }

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer get message worker.
 *
 * This callback will get a single message. Can be of use in streams or places
 * where you don't want an infinite loop managed in C++land and would rather
 * manage it in Node.
 *
 * @see RdKafka::KafkaConsumer::Consume
 * @see NodeKafka::Consumer::GetMessage
 */

ConsumerConsume::ConsumerConsume(Nan::Callback *callback,
                                     Consumer* consumer,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  consumer(consumer),
  m_timeout_ms(timeout_ms) {}

ConsumerConsume::~ConsumerConsume() {}

void ConsumerConsume::Execute() {
  _message = consumer->Consume(m_timeout_ms);
  if (_message->IsError()) {
    if (_message->errcode() != RdKafka::ERR__TIMED_OUT ||
      _message->errcode() != RdKafka::ERR__PARTITION_EOF) {
      SetErrorMessage(RdKafka::err2str(_message->errcode()).c_str());
    }
  }
}

void ConsumerConsume::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];
  argv[0] = Nan::Null();
  if (_message->IsError()) {
    argv[1] = Nan::False();
    delete _message;
  } else {
    argv[1] = _message->Pack();
  }
  callback->Call(argc, argv);
}

void ConsumerConsume::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { _message->GetErrorObject() };

  callback->Call(argc, argv);

  delete _message;
}

// Commit

ConsumerCommit::ConsumerCommit(Nan::Callback *callback,
                                     Consumer* consumer,
                                     consumer_commit_t config) :
  ErrorAwareWorker(callback),
  consumer(consumer),
  _conf(config) {
    committing_message = true;
  }

ConsumerCommit::ConsumerCommit(Nan::Callback *callback,
                                     Consumer* consumer) :
  ErrorAwareWorker(callback),
  consumer(consumer) {
    committing_message = false;
  }

ConsumerCommit::~ConsumerCommit() {}

void ConsumerCommit::Execute() {
  Baton b(NULL);

  if (committing_message) {
    b = consumer->Commit(_conf._topic_name, _conf._partition, _conf._offset);
  } else {
    b = consumer->Commit();
  }

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorCode(b.err());
  }
}

void ConsumerCommit::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  callback->Call(argc, argv);
}

void ConsumerCommit::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

}  // namespace Workers
}  // namespace NodeKafka
