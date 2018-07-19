/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

using v8::Local;
using v8::Value;
using v8::Object;
using v8::String;
using v8::Array;
using v8::Number;

namespace NodeKafka {
namespace Util {

Dispatcher::Dispatcher() {
  async = NULL;
  uv_mutex_init(&async_lock);
}

Dispatcher::~Dispatcher() {
  if (callbacks.size() < 1) return;

  for (size_t i=0; i < callbacks.size(); i++) {
    callbacks[i].Reset();
  }

  uv_mutex_destroy(&async_lock);
}

// Only run this if we aren't already listening
void Dispatcher::Activate() {
  if (!async) {
    async = new uv_async_t;
    uv_async_init(uv_default_loop(), async, AsyncMessage_);

    async->data = this;
  }
}

// Should be able to run this regardless of whether it is active or not
void Dispatcher::Deactivate() {
  if (async) {
    uv_close(reinterpret_cast<uv_handle_t*>(async), NULL);
    async = NULL;
  }
}

bool Dispatcher::HasCallbacks() {
  return callbacks.size() > 0;
}

void Dispatcher::Add(const T &e) {
  scoped_mutex_lock lock(async_lock);
  events.push_back(e);
}

void Dispatcher::Execute() {
  if (async) {
    uv_async_send(async);
  }
}

void Dispatcher::Dispatch(const int _argc, Local<Value> _argv[]) {
  // This should probably be an array of v8 values
  if (!HasCallbacks()) {
    return;
  }

  for (size_t i=0; i < callbacks.size(); i++) {
    v8::Local<v8::Function> f = Nan::New<v8::Function>(callbacks[i]);
    Nan::Callback cb(f);
    cb.Call(_argc, _argv);
  }
}

void Dispatcher::AddCallback(v8::Local<v8::Function> func) {
  Nan::Persistent<v8::Function,
                  Nan::CopyablePersistentTraits<v8::Function> > value(func);
  // PersistentCopyableFunction value(func);
  callbacks.push_back(value);
}

}  // end namespace Util
}  // End namespace NodeKafka
