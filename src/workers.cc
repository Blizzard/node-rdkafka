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

  callback->Call(argc, argv);
}

void AdminClientCreatePartitions::HandleErrorCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 1;
  v8::Local<v8::Value> argv[argc] = { GetErrorObject() };

  callback->Call(argc, argv);
}

}  // namespace Workers
}  // namespace NodeKafka
