/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_NODE_RDKAFKA_INT_H_
#define SRC_NODE_RDKAFKA_INT_H_

#include <uv.h>
#include <nan.h>

#include <vector>

#include "rdkafkacpp.h"
#include "src/common.h"

typedef Nan::Persistent<v8::Function,
  Nan::CopyablePersistentTraits<v8::Function> > PersistentCopyableFunction;
typedef std::vector<PersistentCopyableFunction> CopyableFunctionList;

namespace NodeKafka {

namespace Util {

template <typename T>
class Dispatcher {
 public:

  /**
   * Create the dispatcher.
   */
  Dispatcher();

  /**
   * Virtual destructor so things can be subclassed
   */
  virtual ~Dispatcher();

  /**
   * Flush method. Must be overriden
   */
  virtual void Flush() = 0;

  /**
   * Add an element to the victor
   */
  void Add(const T &);

  void Dispatch(const int, v8::Local<v8::Value> []);

  /**
   * Add a callback to be executed when the dispatcher executes
   */
  void AddCallback(v8::Local<v8::Function>);

  /**
   * @return whether callbacks are registered
   */
  bool HasCallbacks();

  /**
   * Execute. When this is run it will dispatch all of the callbacks
   * registered to it
   */
  void Execute();

  /**
   * Activate the dispatcher. When activated it means that events will
   * begin to flow and execute callbacks.
   */
  void Activate();

  /**
   * Deactivate the dispatcher. This ensures events do not fire
   */
  void Deactivate();

 protected:
  std::vector<v8::Persistent<v8::Function, v8::CopyablePersistentTraits<v8::Function> > > callbacks;  // NOLINT

  uv_mutex_t async_lock;

  std::vector<T> m_events;

 private:
  NAN_INLINE static NAUV_WORK_CB(AsyncMessage_) {
     Dispatcher *dispatcher =
            static_cast<Dispatcher*>(async->data);
     dispatcher->Flush();
  }

  uv_async_t *async;
};

}  // namespace Util

}  // namespace NodeKafka

#endif  // SRC_NODE_RDKAFKA_INT_H_
