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
  explicit ErrorAwareWorker(Nan::Callback* callback_)
      : Nan::AsyncWorker(callback_) {}
  virtual ~ErrorAwareWorker() {}

  virtual void Execute() = 0;
  virtual void HandleOKCallback() = 0;
  virtual void HandleErrorCallback() = 0;

 protected:
  void SetErrorCode(const int & code) {
    RdKafka::ErrorCode rd_err = static_cast<RdKafka::ErrorCode>(code);
    SetErrorMessage(RdKafka::err2str(rd_err).c_str());
    m_error_code = code;
  }
  void SetErrorCode(const RdKafka::ErrorCode & err) {
    SetErrorCode(static_cast<int>(err));
  }

  int GetErrorCode() {
    return m_error_code;
  }
  v8::Local<v8::Object> GetErrorObject() {
    int code = GetErrorCode();
    Baton b = Baton(static_cast<RdKafka::ErrorCode>(code));
    return b.ToObject();
  }

  int m_error_code;
};

class MessageWorker : public Nan::AsyncWorker {
 public:
  explicit MessageWorker(Nan::Callback* callback_)
      : Nan::AsyncWorker(callback_), m_asyncdata() {
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

    std::vector<NodeKafka::Message*> message_queue;

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
     void Send(NodeKafka::Message* m) const {
       that_->Produce_(m);
     }
   private:
    explicit ExecutionMessageBus(MessageWorker* that) : that_(that) {}
    MessageWorker* const that_;
  };

  virtual void Execute(const ExecutionMessageBus&) = 0;
  virtual void HandleMessageCallback(NodeKafka::Message*) = 0;

  virtual void Destroy() {
    uv_close(reinterpret_cast<uv_handle_t*>(m_async), AsyncClose_);
  }

 private:
  void Execute() {
    ExecutionMessageBus message_bus(this);
    Execute(message_bus);
  }

  void Produce_(NodeKafka::Message* m) {
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
  std::vector<NodeKafka::Message*> m_asyncdata;
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

  RdKafka::Metadata* metadata_;

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

class ProducerProduce : public ErrorAwareWorker {
 public:
  ProducerProduce(
    Nan::Callback*, NodeKafka::Producer*, NodeKafka::ProducerMessage*);
  ~ProducerProduce();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
  NodeKafka::ProducerMessage * message;
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

class ConsumerSubscribe : public ErrorAwareWorker {
 public:
  ConsumerSubscribe(
    Nan::Callback*, NodeKafka::Consumer*, std::vector<std::string>);
  ~ConsumerSubscribe();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * consumer;
  std::vector<std::string> topics;
};

class ConsumerUnsubscribe : public ErrorAwareWorker {
 public:
  ConsumerUnsubscribe(
    Nan::Callback*, NodeKafka::Consumer*);
  ~ConsumerUnsubscribe();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * consumer;
};

class ConsumerConsumeLoop : public MessageWorker {
 public:
  ConsumerConsumeLoop(Nan::Callback*, NodeKafka::Consumer*);
  ~ConsumerConsumeLoop();

  void Execute(const ExecutionMessageBus&);
  void HandleOKCallback();
  void HandleErrorCallback();
  void HandleMessageCallback(NodeKafka::Message*);
 private:
  NodeKafka::Consumer * consumer;
};

class ConsumerConsume : public ErrorAwareWorker {
 public:
  ConsumerConsume(Nan::Callback*, NodeKafka::Consumer*);
  ~ConsumerConsume();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * consumer;
  NodeKafka::Message* _message;
};

class ConsumerConsumeNum : public ErrorAwareWorker {
 public:
  ConsumerConsumeNum(Nan::Callback*, NodeKafka::Consumer*, const uint32_t &);
  ~ConsumerConsumeNum();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * m_consumer;
  const uint32_t m_num_messages;
  std::vector<NodeKafka::Message*> m_messages;
};

class ConsumerCommit : public ErrorAwareWorker {
 public:
  ConsumerCommit(
    Nan::Callback*, NodeKafka::Consumer*);
  ConsumerCommit(
    Nan::Callback*, NodeKafka::Consumer*, consumer_commit_t);
  ~ConsumerCommit();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::Consumer * consumer;
  consumer_commit_t _conf;
  bool committing_message;
};

}  // namespace Workers

}  // namespace NodeKafka

#endif  // SRC_WORKERS_H_
