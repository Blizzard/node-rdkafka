/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

// Prevent warnings from node-gyp bindings.h
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma clang diagnostic ignored "-Wunused-parameter"

#include <string>
#include <vector>
#include <list>
#include <memory> // For std::shared_ptr

#include "nan.h"  // NOLINT

// Include rdkafka headers first
#include "rdkafka.h" // C API
#include <rdkafkacpp.h> // C++ API

// Now include local headers
#include "src/errors.h"
#include "src/common.h"
#include "src/workers.h"
#include "src/producer.h"
#include "src/kafka-consumer.h"
#include "src/admin.h"
#include "src/config.h"

#ifndef _WIN32
#include <unistd.h>
#else
// Windows specific
#include <time.h>
#endif

using NodeKafka::Producer;
using NodeKafka::Connection;

namespace NodeKafka {
namespace Workers {

namespace Handle {
/**
 * @brief Handle: get offsets for times.
 *
 * This callback will take a topic partition list with timestamps and
 * for each topic partition, will fill in the offsets. It is done async
 * because it has a timeout and I don't want node to block
 *
 * @see RdKafka::KafkaConsumer::Committed
 */

OffsetsForTimes::OffsetsForTimes(Nan::Callback *callback,
                                 Connection* handle,
                                 std::vector<RdKafka::TopicPartition*> & t,
                                 const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_handle(handle),
  m_topic_partitions(t),
  m_timeout_ms(timeout_ms) {}

OffsetsForTimes::~OffsetsForTimes() {
  // Delete the underlying topic partitions as they are ephemeral or cloned
  RdKafka::TopicPartition::destroy(m_topic_partitions);
}

void OffsetsForTimes::Execute() {
  Baton b = m_handle->OffsetsForTimes(m_topic_partitions, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void OffsetsForTimes::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::TopicPartition::ToV8Array(m_topic_partitions);

  callback->Call(argc, argv);
}

void OffsetsForTimes::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}
}  // namespace Handle

ConnectionMetadata::ConnectionMetadata(
  Nan::Callback *callback, Connection* connection,
  std::string topic, int timeout_ms, bool all_topics) :
  ErrorAwareWorker(callback),
  m_connection(connection),
  m_topic(topic),
  m_timeout_ms(timeout_ms),
  m_all_topics(all_topics),
  m_metadata(NULL) {}

ConnectionMetadata::~ConnectionMetadata() {}

void ConnectionMetadata::Execute() {
  Baton b = m_connection->GetMetadata(m_all_topics, m_topic, m_timeout_ms);

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
 * @brief Client query watermark offsets worker
 *
 * Easy Nan::AsyncWorker for getting watermark offsets from a broker
 *
 * @sa RdKafka::Handle::query_watermark_offsets
 * @sa NodeKafka::Connection::QueryWatermarkOffsets
 */

ConnectionQueryWatermarkOffsets::ConnectionQueryWatermarkOffsets(
  Nan::Callback *callback, Connection* connection,
  std::string topic, int32_t partition, int timeout_ms) :
  ErrorAwareWorker(callback),
  m_connection(connection),
  m_topic(topic),
  m_partition(partition),
  m_timeout_ms(timeout_ms) {}

ConnectionQueryWatermarkOffsets::~ConnectionQueryWatermarkOffsets() {}

void ConnectionQueryWatermarkOffsets::Execute() {
  Baton b = m_connection->QueryWatermarkOffsets(
    m_topic, m_partition, &m_low_offset, &m_high_offset, m_timeout_ms);

  // If we got any error here we need to bail out
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ConnectionQueryWatermarkOffsets::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;

  v8::Local<v8::Object> offsetsObj = Nan::New<v8::Object>();
  Nan::Set(offsetsObj, Nan::New<v8::String>("lowOffset").ToLocalChecked(),
  Nan::New<v8::Number>(m_low_offset));
  Nan::Set(offsetsObj, Nan::New<v8::String>("highOffset").ToLocalChecked(),
  Nan::New<v8::Number>(m_high_offset));

  // This is a big one!
  v8::Local<v8::Value> argv[argc] = { Nan::Null(), offsetsObj};

  callback->Call(argc, argv);
}

void ConnectionQueryWatermarkOffsets::HandleErrorCallback() {
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
 * @brief Producer init transactions worker.
 *
 * Easy Nan::AsyncWorker for initiating transactions
 *
 * @sa RdKafka::Producer::init_transactions
 * @sa NodeKafka::Producer::InitTransactions
 */

ProducerInitTransactions::ProducerInitTransactions(Nan::Callback *callback,
  Producer* producer, const int & timeout_ms):
  ErrorAwareWorker(callback),
  producer(producer),
  m_timeout_ms(timeout_ms) {}

ProducerInitTransactions::~ProducerInitTransactions() {}

void ProducerInitTransactions::Execute() {
  Baton b = producer->InitTransactions(m_timeout_ms);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerInitTransactions::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerInitTransactions::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { m_baton.ToTxnObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Producer begin transaction worker.
 *
 * Easy Nan::AsyncWorker for begin transaction
 *
 * @sa RdKafka::Producer::begin_transaction
 * @sa NodeKafka::Producer::BeginTransaction
 */

ProducerBeginTransaction::ProducerBeginTransaction(Nan::Callback *callback, Producer* producer):
  ErrorAwareWorker(callback),
  producer(producer) {}

ProducerBeginTransaction::~ProducerBeginTransaction() {}

void ProducerBeginTransaction::Execute() {
  Baton b = producer->BeginTransaction();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerBeginTransaction::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;

  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerBeginTransaction::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Producer commit transaction worker.
 *
 * Easy Nan::AsyncWorker for committing transaction
 *
 * @sa RdKafka::Producer::commit_transaction
 * @sa NodeKafka::Producer::CommitTransaction
 */

ProducerCommitTransaction::ProducerCommitTransaction(Nan::Callback *callback,
  Producer* producer, const int & timeout_ms):
  ErrorAwareWorker(callback),
  producer(producer),
  m_timeout_ms(timeout_ms) {}

ProducerCommitTransaction::~ProducerCommitTransaction() {}

void ProducerCommitTransaction::Execute() {
  Baton b = producer->CommitTransaction(m_timeout_ms);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerCommitTransaction::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerCommitTransaction::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { m_baton.ToTxnObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Producer abort transaction worker.
 *
 * Easy Nan::AsyncWorker for aborting transaction
 *
 * @sa RdKafka::Producer::abort_transaction
 * @sa NodeKafka::Producer::AbortTransaction
 */

ProducerAbortTransaction::ProducerAbortTransaction(Nan::Callback *callback,
  Producer* producer, const int & timeout_ms):
  ErrorAwareWorker(callback),
  producer(producer),
  m_timeout_ms(timeout_ms) {}

ProducerAbortTransaction::~ProducerAbortTransaction() {}

void ProducerAbortTransaction::Execute() {
  Baton b = producer->AbortTransaction(m_timeout_ms);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerAbortTransaction::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerAbortTransaction::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { m_baton.ToTxnObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Producer SendOffsetsToTransaction worker.
 *
 * Easy Nan::AsyncWorker for SendOffsetsToTransaction
 *
 * @sa RdKafka::Producer::send_offsets_to_transaction
 * @sa NodeKafka::Producer::SendOffsetsToTransaction
 */

ProducerSendOffsetsToTransaction::ProducerSendOffsetsToTransaction(
    Nan::Callback *callback,
    Producer* producer,
    std::vector<RdKafka::TopicPartition *> & t,
    KafkaConsumer* consumer,
    const int & timeout_ms):
  ErrorAwareWorker(callback),
  producer(producer),
  m_topic_partitions(t),
  consumer(consumer),
  m_timeout_ms(timeout_ms) {}

ProducerSendOffsetsToTransaction::~ProducerSendOffsetsToTransaction() {}

void ProducerSendOffsetsToTransaction::Execute() {
  Baton b = producer->SendOffsetsToTransaction(
    m_topic_partitions,
    consumer,
    m_timeout_ms
  );

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void ProducerSendOffsetsToTransaction::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Null() };

  // Activate the dispatchers
  producer->ActivateDispatchers();

  callback->Call(argc, argv);
}

void ProducerSendOffsetsToTransaction::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { m_baton.ToTxnObject() };

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer connect worker.
 *
 * Easy Nan::AsyncWorker for setting up client connections
 *
 * @sa RdKafka::KafkaConsumer::connect
 * @sa NodeKafka::KafkaConsumer::Connect
 */

KafkaConsumerConnect::KafkaConsumerConnect(Nan::Callback *callback,
  KafkaConsumer* consumer):
  ErrorAwareWorker(callback),
  consumer(consumer) {}

KafkaConsumerConnect::~KafkaConsumerConnect() {}

void KafkaConsumerConnect::Execute() {
  Baton b = consumer->Connect();
  // consumer->Wait();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void KafkaConsumerConnect::HandleOKCallback() {
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

void KafkaConsumerConnect::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer disconnect worker.
 *
 * Easy Nan::AsyncWorker for disconnecting and cleaning up librdkafka artifacts
 *
 * @sa RdKafka::KafkaConsumer::disconnect
 * @sa NodeKafka::KafkaConsumer::Disconnect
 */

KafkaConsumerDisconnect::KafkaConsumerDisconnect(Nan::Callback *callback,
  KafkaConsumer* consumer):
  ErrorAwareWorker(callback),
  consumer(consumer) {}

KafkaConsumerDisconnect::~KafkaConsumerDisconnect() {}

void KafkaConsumerDisconnect::Execute() {
  Baton b = consumer->Disconnect();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void KafkaConsumerDisconnect::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc] = { Nan::Null(), Nan::True() };

  consumer->DeactivateDispatchers();

  callback->Call(argc, argv);
}

void KafkaConsumerDisconnect::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  consumer->DeactivateDispatchers();

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer get messages worker.
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
 * @sa NodeKafka::KafkaConsumer::GetMessage
 */

KafkaConsumerConsumeLoop::KafkaConsumerConsumeLoop(Nan::Callback *callback,
                                     KafkaConsumer* consumer,
                                     const int & timeout_ms,
                                     const int & timeout_sleep_delay_ms) :
  MessageWorker(callback),
  consumer(consumer),
  m_looping(true),
  m_timeout_ms(timeout_ms),
  m_timeout_sleep_delay_ms(timeout_sleep_delay_ms) {
  uv_thread_create(&thread_event_loop, KafkaConsumerConsumeLoop::ConsumeLoop, (void*)this);
}

KafkaConsumerConsumeLoop::~KafkaConsumerConsumeLoop() {}

void KafkaConsumerConsumeLoop::Close() {
  m_looping = false;
  uv_thread_join(&thread_event_loop);
}

void KafkaConsumerConsumeLoop::Execute(const ExecutionMessageBus& bus) {
  // ConsumeLoop is used instead
}

void KafkaConsumerConsumeLoop::ConsumeLoop(void *arg) {
  KafkaConsumerConsumeLoop* consumerLoop = (KafkaConsumerConsumeLoop*)arg;
  ExecutionMessageBus bus(consumerLoop);
  KafkaConsumer* consumer = consumerLoop->consumer;

  // Do one check here before we move forward
  while (consumerLoop->m_looping && consumer->IsConnected()) {
    Baton b = consumer->Consume(consumerLoop->m_timeout_ms);
    RdKafka::ErrorCode ec = b.err();
    if (ec == RdKafka::ERR_NO_ERROR) {
      RdKafka::Message *message = b.data<RdKafka::Message*>();
      switch (message->err()) {
        case RdKafka::ERR__PARTITION_EOF:
          bus.Send(message);
          break;

        case RdKafka::ERR__TIMED_OUT:
        case RdKafka::ERR__TIMED_OUT_QUEUE:
          delete message;
          if (consumerLoop->m_timeout_sleep_delay_ms > 0) {
            // If it is timed out this could just mean there were no
            // new messages fetched quickly enough. This isn't really
            // an error that should kill us.
            #ifndef _WIN32
            usleep(consumerLoop->m_timeout_sleep_delay_ms*1000);
            #else
            _sleep(consumerLoop->m_timeout_sleep_delay_ms);
            #endif
          }
          break;
        case RdKafka::ERR_NO_ERROR:
          bus.Send(message);
          break;
        default:
          // Unknown error. We need to break out of this
          consumerLoop->SetErrorBaton(b);
          consumerLoop->m_looping = false;
          break;
        }
    } else if (ec == RdKafka::ERR_UNKNOWN_TOPIC_OR_PART || ec == RdKafka::ERR_TOPIC_AUTHORIZATION_FAILED) {
      bus.SendWarning(ec);
    } else {
      // Unknown error. We need to break out of this
      consumerLoop->SetErrorBaton(b);
      consumerLoop->m_looping = false;
    }
  }
}

void KafkaConsumerConsumeLoop::HandleMessageCallback(RdKafka::Message* msg, RdKafka::ErrorCode ec) {
  Nan::HandleScope scope;

  const unsigned int argc = 4;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  if (msg == NULL) {
    argv[1] = Nan::Null();
    argv[2] = Nan::Null();
    argv[3] = Nan::New<v8::Number>(ec);
  } else {
    argv[3] = Nan::Null();
    switch (msg->err()) {
      case RdKafka::ERR__PARTITION_EOF: {
        argv[1] = Nan::Null();
        v8::Local<v8::Object> eofEvent = Nan::New<v8::Object>();

        Nan::Set(eofEvent, Nan::New<v8::String>("topic").ToLocalChecked(),
          Nan::New<v8::String>(msg->topic_name()).ToLocalChecked());
        Nan::Set(eofEvent, Nan::New<v8::String>("offset").ToLocalChecked(),
          Nan::New<v8::Number>(msg->offset()));
        Nan::Set(eofEvent, Nan::New<v8::String>("partition").ToLocalChecked(),
          Nan::New<v8::Number>(msg->partition()));

        argv[2] = eofEvent;
        break;
      }
      default:
        argv[1] = Conversion::Message::ToV8Object(msg);
        argv[2] = Nan::Null();
        break;
    }

    // We can delete msg now
    delete msg;
  }

  callback->Call(argc, argv);
}

void KafkaConsumerConsumeLoop::HandleOKCallback() {
  Nan::HandleScope scope;
}

void KafkaConsumerConsumeLoop::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer get messages worker.
 *
 * This callback will get a number of messages. Can be of use in streams or
 * places where you don't want an infinite loop managed in C++land and would
 * rather manage it in Node.
 *
 * @see RdKafka::KafkaConsumer::Consume
 * @see NodeKafka::KafkaConsumer::GetMessage
 */

KafkaConsumerConsumeNum::KafkaConsumerConsumeNum(Nan::Callback *callback,
                                     KafkaConsumer* consumer,
                                     const uint32_t & num_messages,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_num_messages(num_messages),
  m_timeout_ms(timeout_ms) {}

KafkaConsumerConsumeNum::~KafkaConsumerConsumeNum() {}

void KafkaConsumerConsumeNum::Execute() {
  std::size_t max = static_cast<std::size_t>(m_num_messages);
  bool looping = true;
  int timeout_ms = m_timeout_ms;
  std::size_t eof_event_count = 0;

  while (m_messages.size() - eof_event_count < max && looping) {
    // Get a message
    Baton b = m_consumer->Consume(timeout_ms);
    if (b.err() == RdKafka::ERR_NO_ERROR) {
      RdKafka::Message *message = b.data<RdKafka::Message*>();
      RdKafka::ErrorCode errorCode = message->err();
      switch (errorCode) {
        case RdKafka::ERR__PARTITION_EOF:
          // If partition EOF and have consumed messages, retry with timeout 1
          // This allows getting ready messages, while not waiting for new ones
          if (m_messages.size() > eof_event_count) {
            timeout_ms = 1;
          }

          // We will only go into this code path when `enable.partition.eof` is set to true
          // In this case, consumer is also interested in EOF messages, so we return an EOF message
          m_messages.push_back(message);
          eof_event_count += 1;
          break;
        case RdKafka::ERR__TIMED_OUT:
        case RdKafka::ERR__TIMED_OUT_QUEUE:
          // Break of the loop if we timed out
          delete message;
          looping = false;
          break;
        case RdKafka::ERR_NO_ERROR:
          m_messages.push_back(b.data<RdKafka::Message*>());
          break;
        default:
          // Set the error for any other errors and break
          delete message;
          if (m_messages.size() == eof_event_count) {
            SetErrorBaton(Baton(errorCode));
          }
          looping = false;
          break;
      }
    } else {
      if (m_messages.size() == eof_event_count) {
        SetErrorBaton(b);
      }
      looping = false;
    }
  }
}

void KafkaConsumerConsumeNum::HandleOKCallback() {
  Nan::HandleScope scope;
  const unsigned int argc = 3;
  v8::Local<v8::Value> argv[argc];
  argv[0] = Nan::Null();

  v8::Local<v8::Array> returnArray = Nan::New<v8::Array>();
  v8::Local<v8::Array> eofEventsArray = Nan::New<v8::Array>();

  if (m_messages.size() > 0) {
    int returnArrayIndex = -1;
    int eofEventsArrayIndex = -1;
    for (std::vector<RdKafka::Message*>::iterator it = m_messages.begin();
        it != m_messages.end(); ++it) {
      RdKafka::Message* message = *it;

      switch (message->err()) {
        case RdKafka::ERR_NO_ERROR:
          ++returnArrayIndex;
          Nan::Set(returnArray, returnArrayIndex, Conversion::Message::ToV8Object(message));
          break;
        case RdKafka::ERR__PARTITION_EOF:
          ++eofEventsArrayIndex;

          // create EOF event
          v8::Local<v8::Object> eofEvent = Nan::New<v8::Object>();

          Nan::Set(eofEvent, Nan::New<v8::String>("topic").ToLocalChecked(),
            Nan::New<v8::String>(message->topic_name()).ToLocalChecked());
          Nan::Set(eofEvent, Nan::New<v8::String>("offset").ToLocalChecked(),
            Nan::New<v8::Number>(message->offset()));
          Nan::Set(eofEvent, Nan::New<v8::String>("partition").ToLocalChecked(),
            Nan::New<v8::Number>(message->partition()));

          // also store index at which position in the message array this event was emitted
          // this way, we can later emit it at the right point in time
          Nan::Set(eofEvent, Nan::New<v8::String>("messageIndex").ToLocalChecked(),
            Nan::New<v8::Number>(returnArrayIndex));

          Nan::Set(eofEventsArray, eofEventsArrayIndex, eofEvent);
      }

      delete message;
    }
  }

  argv[1] = returnArray;
  argv[2] = eofEventsArray;

  callback->Call(argc, argv);
}

void KafkaConsumerConsumeNum::HandleErrorCallback() {
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
 * @brief KafkaConsumer get message worker.
 *
 * This callback will get a single message. Can be of use in streams or places
 * where you don't want an infinite loop managed in C++land and would rather
 * manage it in Node.
 *
 * @see RdKafka::KafkaConsumer::Consume
 * @see NodeKafka::KafkaConsumer::GetMessage
 */

KafkaConsumerConsume::KafkaConsumerConsume(Nan::Callback *callback,
                                     KafkaConsumer* consumer,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  consumer(consumer),
  m_timeout_ms(timeout_ms) {}

KafkaConsumerConsume::~KafkaConsumerConsume() {}

void KafkaConsumerConsume::Execute() {
  Baton b = consumer->Consume(m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  } else {
    RdKafka::Message *message = b.data<RdKafka::Message*>();
    RdKafka::ErrorCode errorCode = message->err();
    if (errorCode == RdKafka::ERR_NO_ERROR) {
      m_message = message;
    } else {
      delete message;
    }
  }
}

void KafkaConsumerConsume::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::Message::ToV8Object(m_message);

  delete m_message;

  callback->Call(argc, argv);
}

void KafkaConsumerConsume::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer get committed topic partitions worker.
 *
 * This callback will get a topic partition list of committed offsets
 * for each topic partition. It is done async because it has a timeout
 * and I don't want node to block
 *
 * @see RdKafka::KafkaConsumer::Committed
 */

KafkaConsumerCommitted::KafkaConsumerCommitted(Nan::Callback *callback,
                                     KafkaConsumer* consumer,
                                     std::vector<RdKafka::TopicPartition*> & t,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_topic_partitions(t),
  m_timeout_ms(timeout_ms) {}

KafkaConsumerCommitted::~KafkaConsumerCommitted() {
  // Delete the underlying topic partitions as they are ephemeral or cloned
  RdKafka::TopicPartition::destroy(m_topic_partitions);
}

void KafkaConsumerCommitted::Execute() {
  Baton b = m_consumer->Committed(m_topic_partitions, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void KafkaConsumerCommitted::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();
  argv[1] = Conversion::TopicPartition::ToV8Array(m_topic_partitions);

  callback->Call(argc, argv);
}

void KafkaConsumerCommitted::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief KafkaConsumer seek
 *
 * This callback will take a topic partition list with offsets and
 * seek messages from there
 *
 * @see RdKafka::KafkaConsumer::seek
 *
 * @remark Consumption for the given partition must have started for the
 *         seek to work. Use assign() to set the starting offset.
 */

KafkaConsumerSeek::KafkaConsumerSeek(Nan::Callback *callback,
                                     KafkaConsumer* consumer,
                                     const RdKafka::TopicPartition * toppar,
                                     const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_toppar(toppar),
  m_timeout_ms(timeout_ms) {}

KafkaConsumerSeek::~KafkaConsumerSeek() {
  if (m_timeout_ms > 0) {
    // Delete it when we are done with it.
    // However, if the timeout was less than 1, that means librdkafka is going
    // to queue the request up asynchronously, which apparently looks like if
    // we delete the memory here, since it was a pointer, librdkafka segfaults
    // when it actually does the operation (since it no longer blocks).

    // Well, that means we will be leaking memory when people do a timeout of 0
    // so... we should never get to this block. But just in case...
    delete m_toppar;
  }
}

void KafkaConsumerSeek::Execute() {
  Baton b = m_consumer->Seek(*m_toppar, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void KafkaConsumerSeek::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();

  callback->Call(argc, argv);
}

void KafkaConsumerSeek::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief createTopic
 *
 * This callback will create a topic
 *
 */
AdminClientCreateTopic::AdminClientCreateTopic(Nan::Callback *callback,
                                               AdminClient* client,
                                               rd_kafka_NewTopic_t* topic,
                                               const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_client(client),
  m_topic(topic),
  m_timeout_ms(timeout_ms) {}

AdminClientCreateTopic::~AdminClientCreateTopic() {
  // Destroy the topic creation request when we are done
  rd_kafka_NewTopic_destroy(m_topic);
}

void AdminClientCreateTopic::Execute() {
  Baton b = m_client->CreateTopic(m_topic, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void AdminClientCreateTopic::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();

  callback->Call(argc, argv);
}

void AdminClientCreateTopic::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Delete a topic in an asynchronous worker.
 *
 * This callback will delete a topic
 *
 */
AdminClientDeleteTopic::AdminClientDeleteTopic(Nan::Callback *callback,
                                               AdminClient* client,
                                               rd_kafka_DeleteTopic_t* topic,
                                               const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_client(client),
  m_topic(topic),
  m_timeout_ms(timeout_ms) {}

AdminClientDeleteTopic::~AdminClientDeleteTopic() {
  // Destroy the topic creation request when we are done
  rd_kafka_DeleteTopic_destroy(m_topic);
}

void AdminClientDeleteTopic::Execute() {
  Baton b = m_client->DeleteTopic(m_topic, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void AdminClientDeleteTopic::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();

  callback->Call(argc, argv);
}

void AdminClientDeleteTopic::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

/**
 * @brief Delete a topic in an asynchronous worker.
 *
 * This callback will delete a topic
 *
 */
AdminClientCreatePartitions::AdminClientCreatePartitions(
                                         Nan::Callback *callback,
                                         AdminClient* client,
                                         rd_kafka_NewPartitions_t* partitions,
                                         const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_client(client),
  m_partitions(partitions),
  m_timeout_ms(timeout_ms) {}

AdminClientCreatePartitions::~AdminClientCreatePartitions() {
  // Destroy the topic creation request when we are done
  rd_kafka_NewPartitions_destroy(m_partitions);
}

void AdminClientCreatePartitions::Execute() {
  Baton b = m_client->CreatePartitions(m_partitions, m_timeout_ms);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(b);
  }
}

void AdminClientCreatePartitions::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc];

  argv[0] = Nan::Null();

  Nan::Call(*callback, argc, argv);
}

void AdminClientCreatePartitions::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  Nan::Call(*callback, argc, argv);
}

/**
 * @brief Describe configuration for resources
 *
 * This callback will describe configuration for resources
 *
 */
AdminClientDescribeConfigs::AdminClientDescribeConfigs(
    Nan::Callback *callback,
    AdminClient* client,
    rd_kafka_ConfigResource_t** configs,
    size_t config_cnt,
    const int & timeout_ms):
      ErrorAwareWorker(callback),
      m_client(client),
      m_config_cnt(config_cnt),
      m_timeout_ms(timeout_ms),
      m_event(nullptr) {

  // Create a copy of the configs array for our use
  m_configs = new rd_kafka_ConfigResource_t*[config_cnt];
  for (size_t i = 0; i < config_cnt; i++) {
    // We need to make a copy because the original will be destroyed
    // by the caller after this constructor returns
    rd_kafka_ResourceType_t res_type = rd_kafka_ConfigResource_type(configs[i]);
    const char* res_name = rd_kafka_ConfigResource_name(configs[i]);
    m_configs[i] = rd_kafka_ConfigResource_new(res_type, res_name);

    // Store requested config names if provided (for potential later validation)
    // We'll use the resource type and name as the key
    std::pair<int, std::string> key = std::make_pair(
      static_cast<int>(res_type),
      std::string(res_name)
    );

    // Get the config entries to see if there are any specific configs requested
    size_t entry_cnt = 0;
    const rd_kafka_ConfigEntry_t **entries = rd_kafka_ConfigResource_configs(
      configs[i], &entry_cnt);

    if (entries && entry_cnt > 0) {
      std::set<std::string> names;
      for (size_t j = 0; j < entry_cnt; j++) {
        const rd_kafka_ConfigEntry_t *entry = entries[j];
        const char* name = rd_kafka_ConfigEntry_name(entry);
        if (name) {
          names.insert(std::string(name));
        }
      }
      if (!names.empty()) {
        m_requested_configs[key] = names;
      }
    }
  }
}

AdminClientDescribeConfigs::~AdminClientDescribeConfigs() {
  // Clean up ConfigResource objects created in the constructor
  if (m_configs) {
    for (size_t i = 0; i < m_config_cnt; i++) {
      if (m_configs[i]) {
        rd_kafka_ConfigResource_destroy(m_configs[i]);
      }
    }
    delete[] m_configs;
  }

  // Clean up the event if it exists
  if (m_event) {
    rd_kafka_event_destroy(m_event);
  }

  // Clean up the options if they exist
  if (m_opts) {
    rd_kafka_AdminOptions_destroy(m_opts);
  }
}

void AdminClientDescribeConfigs::Execute() {
  // Check if we had an error during construction
  if (IsErrored()) {
    return;
  }

  if (!m_client->IsConnected()) {
    SetErrorBaton(Baton(RdKafka::ERR__STATE, "AdminClient is disconnected."));
    return;
  }

  // Use the AdminClient's DescribeConfigs method which handles the C API calls
  std::pair<RdKafka::ErrorCode, rd_kafka_event_t*> result =
    m_client->DescribeConfigs(m_configs, m_config_cnt, m_timeout_ms);

  // Store the error code and event
  if (result.first != RdKafka::ERR_NO_ERROR) {
    SetErrorBaton(Baton(result.first));
    // If we got an event despite the error, store it for potential partial results
    m_event = result.second;
    return;
  }

  // Store the event for processing in HandleOKCallback
  m_event = result.second;

  if (!m_event) {
    SetErrorBaton(Baton(RdKafka::ERR__TIMED_OUT));
    return;
  }

  // Check that we got the right event type
  if (rd_kafka_event_type(m_event) != RD_KAFKA_EVENT_DESCRIBECONFIGS_RESULT) {
    SetErrorBaton(Baton(RdKafka::ERR__FAIL,
      "Received unexpected event type from DescribeConfigs queue"));
    return;
  }

  // Check for errors in the event
  if (rd_kafka_event_error(m_event)) {
    SetErrorBaton(Baton(static_cast<RdKafka::ErrorCode>(rd_kafka_event_error(m_event)),
      rd_kafka_event_error_string(m_event)));
    // We still keep m_event, HandleOKCallback will process potential partial results/errors
  }

  // The event will be processed in HandleOKCallback and cleaned up in the destructor
}

/**
 * @brief Convert the DescribeConfigs result event data to v8 object
 *
 * @param event The rd_kafka_event_t containing the DescribeConfigs result.
 * @param requested_configs Map of originally requested config names per resource.
 * @return v8::Local<v8::Object> V8 representation of the result.
 */
v8::Local<v8::Object> AdminClientDescribeConfigs::ResultEventToV8Object(
    rd_kafka_event_t *event,
    const std::map<std::pair<int, std::string>, std::set<std::string>>& requested_configs) {
  Nan::EscapableHandleScope scope;

  // Create the top-level result V8 object
  v8::Local<v8::Object> result_v8 = Nan::New<v8::Object>();

  // Get the result from the event
  const rd_kafka_DescribeConfigs_result_t *result =
    rd_kafka_event_DescribeConfigs_result(event);

  if (!result) {
    // If we can't get the result, return an empty object
    return scope.Escape(result_v8);
  }

  // Get the resources from the result
  size_t resource_cnt;
  const rd_kafka_ConfigResource_t **resources =
    rd_kafka_DescribeConfigs_result_resources(result, &resource_cnt);

  // Create a V8 array to hold the resource results
  v8::Local<v8::Array> resources_v8_array = Nan::New<v8::Array>(resource_cnt);

  // Iterate over each resource result
  for (size_t i = 0; i < resource_cnt; ++i) {
    const rd_kafka_ConfigResource_t *resource = resources[i];
    v8::Local<v8::Object> resource_v8_obj = Nan::New<v8::Object>();

    // Set type and name
    rd_kafka_ResourceType_t res_type = rd_kafka_ConfigResource_type(resource);
    const char *res_name = rd_kafka_ConfigResource_name(resource);

    Nan::Set(resource_v8_obj, Nan::New("type").ToLocalChecked(),
      Nan::New<v8::Number>(static_cast<int>(res_type)));
    Nan::Set(resource_v8_obj, Nan::New("name").ToLocalChecked(),
      Nan::New<v8::String>(res_name).ToLocalChecked());

    // Set error if present
    rd_kafka_resp_err_t resource_err = rd_kafka_ConfigResource_error(resource);
    if (resource_err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      const char *err_str = rd_kafka_ConfigResource_error_string(resource);
      v8::Local<v8::Object> error = Nan::New<v8::Object>();
      Nan::Set(error, Nan::New("code").ToLocalChecked(),
        Nan::New<v8::Number>(resource_err));
      if (err_str) {
        Nan::Set(error, Nan::New("message").ToLocalChecked(),
          Nan::New<v8::String>(err_str).ToLocalChecked());
      }
      Nan::Set(resource_v8_obj, Nan::New("error").ToLocalChecked(), error);
    } else {
      Nan::Set(resource_v8_obj, Nan::New("error").ToLocalChecked(), Nan::Null());
    }

    // Get config entries
    size_t entry_cnt;
    const rd_kafka_ConfigEntry_t **entries =
      rd_kafka_ConfigResource_configs(resource, &entry_cnt);

    v8::Local<v8::Array> entries_v8_array = Nan::New<v8::Array>(entry_cnt);

    // Iterate over config entries for this resource
    for (size_t j = 0; j < entry_cnt; ++j) {
      const rd_kafka_ConfigEntry_t *entry = entries[j];
      v8::Local<v8::Object> entry_v8_obj = Nan::New<v8::Object>();

      const char *name = rd_kafka_ConfigEntry_name(entry);
      const char *value = rd_kafka_ConfigEntry_value(entry);

      Nan::Set(entry_v8_obj, Nan::New("name").ToLocalChecked(),
        Nan::New<v8::String>(name).ToLocalChecked());

      if (value) {
        Nan::Set(entry_v8_obj, Nan::New("value").ToLocalChecked(),
          Nan::New<v8::String>(value).ToLocalChecked());
      } else {
        Nan::Set(entry_v8_obj, Nan::New("value").ToLocalChecked(), Nan::Null());
      }

      Nan::Set(entry_v8_obj, Nan::New("source").ToLocalChecked(),
        Nan::New<v8::Number>(rd_kafka_ConfigEntry_source(entry)));
      Nan::Set(entry_v8_obj, Nan::New("isDefault").ToLocalChecked(),
        Nan::New<v8::Boolean>(rd_kafka_ConfigEntry_is_default(entry)));
      Nan::Set(entry_v8_obj, Nan::New("isReadOnly").ToLocalChecked(),
        Nan::New<v8::Boolean>(rd_kafka_ConfigEntry_is_read_only(entry)));
      Nan::Set(entry_v8_obj, Nan::New("isSensitive").ToLocalChecked(),
        Nan::New<v8::Boolean>(rd_kafka_ConfigEntry_is_sensitive(entry)));
      // Note: Synonyms are available via rd_kafka_ConfigEntry_synonyms if needed in the future

      Nan::Set(entries_v8_array, j, entry_v8_obj);
    }

    Nan::Set(resource_v8_obj, Nan::New("configs").ToLocalChecked(), entries_v8_array);
    Nan::Set(resources_v8_array, i, resource_v8_obj);
  }

  Nan::Set(result_v8, Nan::New("resources").ToLocalChecked(), resources_v8_array);
  return scope.Escape(result_v8);
}

void AdminClientDescribeConfigs::HandleOKCallback() {
  Nan::HandleScope scope;

  // Check if Execute stored a Baton error. If so, HandleErrorCallback should be called.
  // Also check if m_event is null (could happen if poll failed but error wasn't set right).
  if (IsErrored() || m_event == nullptr) {
    if (!IsErrored()) { // Ensure baton is set if event is missing unexpectedly
        SetErrorBaton(Baton(RdKafka::ERR_UNKNOWN, "DescribeConfigs event missing in HandleOKCallback"));
    }
    HandleErrorCallback();
    return;
  }

  // Check for top-level error within the event itself.
  // Even if there's a top-level error, we proceed to convert the (potentially partial)
  // result, as individual resources might still contain data or specific errors.
  // The JS layer might want to inspect this.
  rd_kafka_resp_err_t top_level_err = rd_kafka_event_error(m_event);
  v8::Local<v8::Value> err_obj = Nan::Null();
  if (top_level_err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      const char* errstr = rd_kafka_event_error_string(m_event);
      if (errstr) {
          // Create a Baton with the error code and message, then convert to v8 object
          Baton baton(static_cast<RdKafka::ErrorCode>(top_level_err), errstr);
          err_obj = baton.ToObject();
      } else {
          // Create a Baton with just the error code, then convert to v8 object
          err_obj = RdKafkaError(static_cast<RdKafka::ErrorCode>(top_level_err));
      }
  }

  // Convert the result event to V8 object
  v8::Local<v8::Object> result_v8_obj = ResultEventToV8Object(m_event, m_requested_configs);

  // Prepare arguments for the JS callback
  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc] = {
    err_obj,        // Pass top-level error (or null)
    result_v8_obj   // Pass the structured result object
  };

  Nan::Call(*callback, argc, argv);

  // m_event will be cleaned up in the destructor
}

void AdminClientDescribeConfigs::HandleErrorCallback() {
  Nan::HandleScope scope;

  // If m_event is null, it means Execute() failed very early, use m_baton.
  // If m_event is not null, it means Execute() stored a result (possibly with errors),
  // but a top-level error occurred (either in Execute or implicitly set by Nan framework).
  // We should prioritize the error from m_baton if it exists.

  v8::Local<v8::Value> argv[1];
  if (IsErrored()) {
      argv[0] = GetErrorObject();
  } else {
      // Fallback, should not typically happen if IsErrored() is false here
      Baton baton(RdKafka::ERR_UNKNOWN, "Unknown error in HandleErrorCallback");
      argv[0] = baton.ToObject();
  }

  // Event object (m_event) might be available even on error, but we don't pass it here.
  // The destructor will handle cleanup.
  Nan::Call(*callback, 1, argv);
}

/**
 * @brief AlterConfigs worker implementation
 */
AdminClientAlterConfigs::AdminClientAlterConfigs(Nan::Callback *callback,
                                               AdminClient* client,
                                               rd_kafka_ConfigResource_t** configs,
                                               size_t config_cnt,
                                               const int & timeout_ms) :
  ErrorAwareWorker(callback),
  m_client(client),
  m_configs(configs), // Takes ownership
  m_config_cnt(config_cnt),
  m_timeout_ms(timeout_ms),
  m_result_event(nullptr),
  m_error_code(RdKafka::ERR_NO_ERROR) {
    // Basic validation
    if (!m_configs || m_config_cnt == 0) {
        m_error_code = RdKafka::ERR__INVALID_ARG;
        SetErrorMessage("Invalid config resource array passed to worker.");
        m_configs = nullptr; // Prevent cleanup issues
        m_config_cnt = 0;
    }
}

AdminClientAlterConfigs::~AdminClientAlterConfigs() {
  if (m_configs) {
      for (size_t i = 0; i < m_config_cnt; ++i) {
          if (m_configs[i]) rd_kafka_ConfigResource_destroy(m_configs[i]);
      }
      delete[] m_configs;
  }
  if (m_result_event) {
    rd_kafka_event_destroy(m_result_event);
  }
}

void AdminClientAlterConfigs::Execute() {
  if (m_error_code != RdKafka::ERR_NO_ERROR) return;
  if (!m_client || !m_client->IsConnected()) {
    m_error_code = RdKafka::ERR__STATE;
    SetErrorMessage("Client is not connected");
    return;
  }

  std::pair<RdKafka::ErrorCode, rd_kafka_event_t*> result =
    m_client->AlterConfigs(m_configs, m_config_cnt, m_timeout_ms);

  m_error_code = result.first;
  m_result_event = result.second;

  if (m_error_code != RdKafka::ERR_NO_ERROR && m_result_event == nullptr) {
      std::string errstr = RdKafka::err2str(m_error_code);
      SetErrorMessage(errstr.c_str());
  }
}

// Helper to convert AlterConfigs result event to V8 object
v8::Local<v8::Object> AdminClientAlterConfigs::ResultEventToV8Object(rd_kafka_event_t* event_response) {
    Nan::EscapableHandleScope scope;
    v8::Local<v8::Object> result_obj = Nan::New<v8::Object>();
    const rd_kafka_AlterConfigs_result_t *result = rd_kafka_event_AlterConfigs_result(event_response);

    if (!result) {
        Nan::Set(result_obj, Nan::New("error").ToLocalChecked(), Nan::New("Invalid AlterConfigs result event").ToLocalChecked());
        return scope.Escape(result_obj);
    }

    size_t res_cnt = 0;
    const rd_kafka_ConfigResource_t **resources = rd_kafka_AlterConfigs_result_resources(result, &res_cnt);
    v8::Local<v8::Array> resources_array = Nan::New<v8::Array>(res_cnt);

    for (size_t i = 0; i < res_cnt; i++) {
      const rd_kafka_ConfigResource_t *resource = resources[i];
      v8::Local<v8::Object> resource_obj = Nan::New<v8::Object>();

      Nan::Set(resource_obj, Nan::New("type").ToLocalChecked(), Nan::New<v8::Number>(rd_kafka_ConfigResource_type(resource)));
      Nan::Set(resource_obj, Nan::New("name").ToLocalChecked(), Nan::New<v8::String>(rd_kafka_ConfigResource_name(resource)).ToLocalChecked());

      rd_kafka_resp_err_t resource_err = rd_kafka_ConfigResource_error(resource);
      if (resource_err != RD_KAFKA_RESP_ERR_NO_ERROR) {
        std::string err_str = rd_kafka_ConfigResource_error_string(resource);
        v8::Local<v8::Object> err_obj = Nan::New<v8::Object>();
        Nan::Set(err_obj, Nan::New("message").ToLocalChecked(), Nan::New(err_str).ToLocalChecked());
        Nan::Set(err_obj, Nan::New("code").ToLocalChecked(), Nan::New(static_cast<int>(resource_err)));
        Nan::Set(resource_obj, Nan::New("error").ToLocalChecked(), err_obj);
      } else {
         Nan::Set(resource_obj, Nan::New("error").ToLocalChecked(), Nan::Null());
      }
      // AlterConfigs result doesn't contain the config values themselves, just success/failure per resource.
      Nan::Set(resources_array, i, resource_obj);
    }

    Nan::Set(result_obj, Nan::New("resources").ToLocalChecked(), resources_array);
    return scope.Escape(result_obj);
}

void AdminClientAlterConfigs::HandleOKCallback() {
  Nan::HandleScope scope;

  if (m_error_code != RdKafka::ERR_NO_ERROR) {
    if (m_result_event && !ErrorMessage()) {
        const char* event_err_str_c = rd_kafka_event_error_string(m_result_event);
        std::string event_err_str = event_err_str_c ? event_err_str_c : "";
        std::string default_err_str = RdKafka::err2str(m_error_code);
        SetErrorMessage(event_err_str.empty() ? default_err_str.c_str() : event_err_str.c_str());
    }
    if (m_baton.err() == RdKafka::ERR_NO_ERROR) {
        m_baton = Baton(m_error_code, ErrorMessage());
    }
    HandleErrorCallback();
    return;
  }

  if (!m_result_event) {
      m_error_code = RdKafka::ERR_UNKNOWN;
      SetErrorMessage("AlterConfigs succeeded but result event is missing");
      m_baton = Baton(m_error_code, ErrorMessage());
      HandleErrorCallback();
      return;
  }

  v8::Local<v8::Object> result_obj = ResultEventToV8Object(m_result_event);
  const unsigned int argc = 2;
  v8::Local<v8::Value> argv[argc] = { Nan::Null(), result_obj };
  Nan::Call(*callback, argc, argv);

  rd_kafka_event_destroy(m_result_event);
  m_result_event = nullptr;
}

void AdminClientAlterConfigs::HandleErrorCallback() {
  Nan::HandleScope scope;

  // If m_result_event is null, it means Execute() failed very early, use m_baton.
  // If m_result_event is not null, it means Execute() stored a result (possibly with errors),
  // but a top-level error occurred (either in Execute or implicitly set by Nan framework).
  // We should prioritize the error from m_baton if it exists.

  v8::Local<v8::Value> argv[1];
  if (IsErrored()) {
      argv[0] = GetErrorObject();
  } else {
      // Fallback, should not typically happen if IsErrored() is false here
      Baton baton(RdKafka::ERR_UNKNOWN, "Unknown error in HandleErrorCallback");
      argv[0] = baton.ToObject();
  }

  // Event object (m_result_event) might be available even on error, but we don't pass it here.
  // The destructor will handle cleanup.
  Nan::Call(*callback, 1, argv);
}

}  // namespace Workers
}  // namespace NodeKafka
