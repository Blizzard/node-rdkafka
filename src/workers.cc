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

typedef std::vector<const RdKafka::BrokerMetadata*> BrokerMetadataList;
typedef std::vector<const RdKafka::PartitionMetadata*> PartitionMetadataList;
typedef std::vector<const RdKafka::TopicMetadata *> TopicMetadataList;

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
  timeout_ms_(timeout_ms) {}

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
    metadata_ = b.data<RdKafka::Metadata*>();
  } else {
    SetErrorCode(b.err());
  }
}

void ConnectionMetadata::HandleOKCallback() {
  Nan::HandleScope scope;

  const unsigned int argc = 2;

  // This is a big one!

  v8::Local<v8::Object> obj = Nan::New<v8::Object>();

  v8::Local<v8::Array> broker_data = Nan::New<v8::Array>();
  v8::Local<v8::Array> topic_data = Nan::New<v8::Array>();

  const BrokerMetadataList* brokers = metadata_->brokers();  // NOLINT

  unsigned int broker_i = 0;

  for (BrokerMetadataList::const_iterator it = brokers->begin();
    it != brokers->end(); ++it, broker_i++) {
    // Start iterating over brokers and set the object up

    const RdKafka::BrokerMetadata* x = *it;

    v8::Local<v8::Object> current_broker = Nan::New<v8::Object>();

    Nan::Set(current_broker, Nan::New("id").ToLocalChecked(),
      Nan::New<v8::Number>(x->id()));
    Nan::Set(current_broker, Nan::New("host").ToLocalChecked(),
      Nan::New<v8::String>(x->host().c_str()).ToLocalChecked());
    Nan::Set(current_broker, Nan::New("port").ToLocalChecked(),
      Nan::New<v8::Number>(x->port()));

    broker_data->Set(broker_i, current_broker);
  }

  unsigned int topic_i = 0;

  const TopicMetadataList* topics = metadata_->topics();

  for (TopicMetadataList::const_iterator it = topics->begin();
    it != topics->end(); ++it, topic_i++) {
    // Start iterating over topics

    const RdKafka::TopicMetadata* x = *it;

    v8::Local<v8::Object> current_topic = Nan::New<v8::Object>();

    Nan::Set(current_topic, Nan::New("name").ToLocalChecked(),
      Nan::New<v8::String>(x->topic().c_str()).ToLocalChecked());

    v8::Local<v8::Array> current_topic_partitions = Nan::New<v8::Array>();

    const PartitionMetadataList* current_partition_data = x->partitions();

    unsigned int partition_i = 0;
    PartitionMetadataList::const_iterator itt;

    for (itt = current_partition_data->begin();
      itt != current_partition_data->end(); ++itt, partition_i++) {
      // partition iterate
      const RdKafka::PartitionMetadata* xx = *itt;

      v8::Local<v8::Object> current_partition = Nan::New<v8::Object>();

      Nan::Set(current_partition, Nan::New("id").ToLocalChecked(),
        Nan::New<v8::Number>(xx->id()));
      Nan::Set(current_partition, Nan::New("leader").ToLocalChecked(),
        Nan::New<v8::Number>(xx->leader()));

      const std::vector<int32_t> * replicas  = xx->replicas();
      const std::vector<int32_t> * isrs = xx->isrs();

      std::vector<int32_t>::const_iterator r_it;
      std::vector<int32_t>::const_iterator i_it;

      unsigned int r_i = 0;
      unsigned int i_i = 0;

      v8::Local<v8::Array> current_replicas = Nan::New<v8::Array>();

      for (r_it = replicas->begin(); r_it != replicas->end(); ++r_it, r_i++) {
        current_replicas->Set(r_i, Nan::New<v8::Int32>(*r_it));
      }

      v8::Local<v8::Array> current_isrs = Nan::New<v8::Array>();

      for (i_it = isrs->begin(); i_it != isrs->end(); ++i_it, i_i++) {
        current_isrs->Set(r_i, Nan::New<v8::Int32>(*i_it));
      }

      Nan::Set(current_partition, Nan::New("replicas").ToLocalChecked(),
        current_replicas);
      Nan::Set(current_partition, Nan::New("isrs").ToLocalChecked(),
        current_isrs);

      current_topic_partitions->Set(partition_i, current_partition);
    }  // iterate over partitions

    Nan::Set(current_topic, Nan::New("partitions").ToLocalChecked(),
      current_topic_partitions);

    topic_data->Set(topic_i, current_topic);
  }  // End iterating over topics

  Nan::Set(obj, Nan::New("orig_broker_id").ToLocalChecked(),
    Nan::New<v8::Number>(metadata_->orig_broker_id()));

  Nan::Set(obj, Nan::New("orig_broker_name").ToLocalChecked(),
    Nan::New<v8::String>(metadata_->orig_broker_name()).ToLocalChecked());

  Nan::Set(obj, Nan::New("topics").ToLocalChecked(), topic_data);
  Nan::Set(obj, Nan::New("brokers").ToLocalChecked(), broker_data);

  v8::Local<v8::Value> argv[argc] = { Nan::Null(), obj};

  callback->Call(argc, argv);

  delete metadata_;
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
    SetErrorCode(b.err());
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
                                     Consumer* consumer) :
  MessageWorker(callback),
  consumer(consumer) {}

ConsumerConsumeLoop::~ConsumerConsumeLoop() {}

void ConsumerConsumeLoop::Execute(const ExecutionMessageBus& bus) {
  // Do one check here before we move forward
  while (consumer->IsConnected() && consumer->IsSubscribed()) {
    NodeKafka::Message* message = consumer->Consume();
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
                                     const uint32_t & num_messages) :
  ErrorAwareWorker(callback),
  m_consumer(consumer),
  m_num_messages(num_messages) {}

ConsumerConsumeNum::~ConsumerConsumeNum() {}

void ConsumerConsumeNum::Execute() {
  const int max = static_cast<int>(m_num_messages);
  for (int i = 0; i < max; i++) {
    // Get a message
    NodeKafka::Message* message = m_consumer->Consume();
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
                                     Consumer* consumer) :
  ErrorAwareWorker(callback),
  consumer(consumer) {}

ConsumerConsume::~ConsumerConsume() {}

void ConsumerConsume::Execute() {
  _message = consumer->Consume();
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
