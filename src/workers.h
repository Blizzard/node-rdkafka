/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_WORKERS_H_
#define SRC_WORKERS_H_

#include <uv.h>
#include <nan.h>
#include <unistd.h>
#include <string>
#include <vector>

#include "src/common.h"
#include "src/producer.h"
#include "src/consumer.h"

namespace NodeKafka {
namespace Workers {

class ErrorAwareWorker : public Nan::AsyncWorker {
 public:
  explicit ErrorAwareWorker(Nan::Callback* callback_) :
    Nan::AsyncWorker(callback_),
    m_baton(RdKafka::ERR_NO_ERROR) {}
  virtual ~ErrorAwareWorker() {}

  virtual void Execute() = 0;
  virtual void HandleOKCallback() = 0;
  void HandleErrorCallback() {
    Nan::HandleScope scope;

    const unsigned int argc = 1;
    v8::Local<v8::Value> argv[argc] = { Nan::Error(ErrorMessage()) };

    callback->Call(argc, argv);
  }

 protected:
  void SetErrorCode(const int & code) {
    RdKafka::ErrorCode rd_err = static_cast<RdKafka::ErrorCode>(code);
    SetErrorCode(rd_err);
  }
  void SetErrorCode(const RdKafka::ErrorCode & err) {
    SetErrorBaton(Baton(err));
  }
  void SetErrorBaton(const NodeKafka::Baton & baton) {
    m_baton = baton;
    SetErrorMessage(m_baton.errstr().c_str());
  }

  int GetErrorCode() {
    return m_baton.err();
  }

  v8::Local<v8::Object> GetErrorObject() {
    return m_baton.ToObject();
  }

  Baton m_baton;
};

class MessageWorker : public ErrorAwareWorker {
 public:
  explicit MessageWorker(Nan::Callback* callback_)
      : ErrorAwareWorker(callback_), m_asyncdata() {
    m_async = new uv_async_t;
    uv_async_init(
      uv_default_loop(),
      m_async,
      m_async_message);
    m_async->data = this;

    uv_mutex_init(&m_async_lock);
  }

  virtual ~MessageWorker() {
    uv_mutex_destroy(&m_async_lock);
  }

  void WorkMessage() {
    if (!callback) {
      return;
    }

    std::vector<RdKafka::Message*> message_queue;

    {
      scoped_mutex_lock lock(m_async_lock);
      // Copy the vector and empty it
      m_asyncdata.swap(message_queue);
    }

    for (unsigned int i = 0; i < message_queue.size(); i++) {
      HandleMessageCallback(message_queue[i]);

      // we are done with it. it is about to go out of scope
      // for the last time so let's just free it up here. can't rely
      // on the destructor
    }
  }

  class ExecutionMessageBus {
    friend class MessageWorker;
   public:
     void Send(RdKafka::Message* m) const {
       that_->Produce_(m);
     }
   private:
    explicit ExecutionMessageBus(MessageWorker* that) : that_(that) {}
    MessageWorker* const that_;
  };

  virtual void Execute(const ExecutionMessageBus&) = 0;
  virtual void HandleMessageCallback(RdKafka::Message*) = 0;

  virtual void Destroy() {
    uv_close(reinterpret_cast<uv_handle_t*>(m_async), AsyncClose_);
  }

 private:
  void Execute() {
    ExecutionMessageBus message_bus(this);
    Execute(message_bus);
  }

  void Produce_(RdKafka::Message* m) {
    scoped_mutex_lock lock(m_async_lock);
    m_asyncdata.push_back(m);
    uv_async_send(m_async);
  }
  NAN_INLINE static NAUV_WORK_CB(m_async_message) {
    MessageWorker *worker = static_cast<MessageWorker*>(async->data);
    worker->WorkMessage();
  }

  NAN_INLINE static void AsyncClose_(uv_handle_t* handle) {
    MessageWorker *worker = static_cast<MessageWorker*>(handle->data);
    delete reinterpret_cast<uv_async_t*>(handle);
    delete worker;
  }

  uv_async_t *m_async;
  uv_mutex_t m_async_lock;
  std::vector<RdKafka::Message*> m_asyncdata;
};

class ConnectionMetadata : public ErrorAwareWorker {
 public:
  ConnectionMetadata(Nan::Callback*, NodeKafka::Connection*, std::string, int);
  ~ConnectionMetadata();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Connection * connection_;

  std::string topic_;
  int timeout_ms_;

  RdKafka::Metadata* m_metadata;

  // Now this is the data that will get translated in the OK callback
};

class ProducerConnect : public ErrorAwareWorker {
 public:
  ProducerConnect(Nan::Callback*, NodeKafka::Producer*);
  ~ProducerConnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
};

class ProducerDisconnect : public ErrorAwareWorker {
 public:
  ProducerDisconnect(Nan::Callback*, NodeKafka::Producer*);
  ~ProducerDisconnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
};

class ProducerFlush : public ErrorAwareWorker {
 public:
  ProducerFlush(Nan::Callback*, NodeKafka::Producer*, int);
  ~ProducerFlush();

  void Execute();
  void HandleOKCallback();

 private:
  NodeKafka::Producer * producer;
  int timeout_ms;
};

class ConsumerConnect : public ErrorAwareWorker {
 public:
  ConsumerConnect(Nan::Callback*, NodeKafka::Consumer*);
  ~ConsumerConnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Consumer * consumer;
};

class ConsumerDisconnect : public ErrorAwareWorker {
 public:
  ConsumerDisconnect(Nan::Callback*, NodeKafka::Consumer*);
  ~ConsumerDisconnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Consumer * consumer;
};

class ConsumerConsumeLoop : public MessageWorker {
 public:
  ConsumerConsumeLoop(Nan::Callback*, NodeKafka::Consumer*, const int &);
  ~ConsumerConsumeLoop();

  void Execute(const ExecutionMessageBus&);
  void HandleOKCallback();
  void HandleErrorCallback();
  void HandleMessageCallback(RdKafka::Message*);
 private:
  NodeKafka::Consumer * consumer;
  const int m_timeout_ms;
  unsigned int m_rand_seed;
};

class ConsumerConsume : public ErrorAwareWorker {
 public:
  ConsumerConsume(Nan::Callback*, NodeKafka::Consumer*, const int &);
  ~ConsumerConsume();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * consumer;
  const int m_timeout_ms;
  RdKafka::Message* m_message;
};

class ConsumerCommitted : public ErrorAwareWorker {
 public:
  ConsumerCommitted(Nan::Callback*, NodeKafka::Consumer*, const int &);
  ~ConsumerCommitted();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * m_consumer;
  const int m_timeout_ms;
  std::vector<RdKafka::TopicPartition*> * m_topic_partitions;
};

class ConsumerConsumeNum : public ErrorAwareWorker {
 public:
  ConsumerConsumeNum(Nan::Callback*, NodeKafka::Consumer*, const uint32_t &, const int &);  // NOLINT
  ~ConsumerConsumeNum();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * m_consumer;
  const uint32_t m_num_messages;
  const int m_timeout_ms;
  std::vector<RdKafka::Message*> m_messages;
};

}  // namespace Workers

}  // namespace NodeKafka

#endif  // SRC_WORKERS_H_
