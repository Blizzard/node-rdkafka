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
    SetErrorBaton(b);
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
    SetErrorBaton(b);
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

/**
 * @brief Producer disconnect worker
 *
 * Easy Nan::AsyncWorker for disconnecting from clients
 */

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

/**
 * @brief Producer flush worker
 *
 * Easy Nan::AsyncWorker for flushing a producer.
 */

ProducerFlush::ProducerFlush(Nan::Callback *callback,
  Producer* producer, int timeout_ms):
  ErrorAwareWorker(callback),
  producer(producer),
  timeout_ms(timeout_ms) {}

ProducerFlush::~ProducerFlush() {}

void ProducerFlush::Execute() {
  if (!producer->IsConnected()) {
    SetErrorMessage("Producer is disconnected");
    return;
  }

  Baton b = producer->Flush(timeout_ms);
  if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerFlush::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

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
    SetErrorBaton(b);
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
  m_timeout_ms(timeout_ms),
  m_rand_seed(time(NULL)) {}

ConsumerConsumeLoop::~ConsumerConsumeLoop() {}

void ConsumerConsumeLoop::Execute(const ExecutionMessageBus& bus) {
  // Do one check here before we move forward
  while (consumer->IsConnected()) {
    Baton b = consumer->Consume(m_timeout_ms);

    if (b.err() == RdKafka::ERR__PARTITION_EOF) {
      // EOF means there are no more messages to read.
      // We should wait a little bit for more messages to come in
      // when in consume loop mode
      // Randomise the wait time to avoid contention on different
      // slow topics
      usleep(static_cast<int>(rand_r(&m_rand_seed) * 1000 * 1000 / RAND_MAX));
    } else if (
      b.err() == RdKafka::ERR__TIMED_OUT ||
      b.err() == RdKafka::ERR__TIMED_OUT_QUEUE) {
      // If it is timed out this could just mean there were no
      // new messages fetched quickly enough. This isn't really
      // an error that should kill us.
      usleep(500*1000);
    } else if (b.err() == RdKafka::ERR_NO_ERROR) {
      bus.Send(b.data<RdKafka::Message*>());
    } else {
      // Unknown error. We need to break out of this
      SetErrorBaton(b);
      break;
    }
  }
}

void ConsumerConsumeLoop::HandleMessageCallback(RdKafka::Message* msg) {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::Message::ToV8Object(msg);

  // We can delete msg now
  delete msg;

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
    Baton b = m_consumer->Consume(m_timeout_ms);
    if (b.err() != RdKafka::ERR_NO_ERROR) {
      if (b.err() != RdKafka::ERR__TIMED_OUT &&
          b.err() != RdKafka::ERR__PARTITION_EOF &&
          b.err() != RdKafka::ERR__TIMED_OUT_QUEUE) {
        if (i == 0) {
          SetErrorBaton(b);
        }
      }
      break;
    }

    m_messages.push_back(b.data<RdKafka::Message*>());
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
    for (std::vector<RdKafka::Message*>::iterator it = m_messages.begin();
        it != m_messages.end(); ++it) {
      i++;
      RdKafka::Message* message = *it;
      returnArray->Set(i, Conversion::Message::ToV8Object(message));

      delete message;
    }
  }

  argv[1] = returnArray;

  callback->Call(argc, argv);
}

void ConsumerConsumeNum::HandleErrorCallback() {
  Nan::HandleScope scope;

  if (m_messages.size() > 0) {
    for (std::vector<RdKafka::Message*>::iterator it = m_messages.begin();
        it != m_messages.end(); ++it) {
      RdKafka::Message* message = *it;
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
  Baton b = consumer->Consume(m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    if (b.err() != RdKafka::ERR__TIMED_OUT ||
      b.err() != RdKafka::ERR__PARTITION_EOF ||
      b.err() != RdKafka::ERR__TIMED_OUT_QUEUE) {
      SetErrorBaton(b);
    }
  } else {
    m_message = b.data<RdKafka::Message*>();
  }
}

void ConsumerConsume::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::Message::ToV8Object(m_message);

  delete m_message;

  callback->Call(argc, argv);
}

void ConsumerConsume::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Consumer get committed topic partitions worker.
 *
 * This callback will get a topic partition list of committed offsets
 * for each topic partition. It is done async because it has a timeout
 * and I don't want node to block
 *
 * @see RdKafka::KafkaConsumer::Committed
 */

ConsumerCommitted::ConsumerCommitted(Nan::Callback *callback,
                                     Consumer* consumer,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_timeout_ms(timeout_ms) {}

ConsumerCommitted::~ConsumerCommitted() {}

void ConsumerCommitted::Execute() {
  Baton b = m_consumer->Committed(m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  } else {
    m_topic_partitions = b.data<std::vector<RdKafka::TopicPartition*>*>();
  }
}

void ConsumerCommitted::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::TopicPartition::ToV8Array(*m_topic_partitions);

  delete m_topic_partitions;

  callback->Call(argc, argv);
}

void ConsumerCommitted::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

}  // namespace Workers
}  // namespace NodeKafka
