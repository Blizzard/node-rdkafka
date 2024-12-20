/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <mutex>
#include <unordered_map>
#include <utility>

#include "per-isolate-data.h"

namespace NodeKafka {

static std::unordered_map<v8::Isolate*, PerIsolateData> per_isolate_data_;
static std::mutex mutex;

PerIsolateData* PerIsolateData::For(v8::Isolate* isolate) {
  const std::lock_guard<std::mutex> lock(mutex);
  auto maybe = per_isolate_data_.find(isolate);
  if (maybe != per_isolate_data_.end()) {
    return &maybe->second;
  }

  per_isolate_data_.emplace(std::make_pair(isolate, PerIsolateData()));

  auto pair = per_isolate_data_.find(isolate);
  auto perIsolateData = &pair->second;

  node::AddEnvironmentCleanupHook(isolate, [](void* data) {
    const std::lock_guard<std::mutex> lock(mutex);
    per_isolate_data_.erase(static_cast<v8::Isolate*>(data));
  }, isolate);

  return perIsolateData;
}

Nan::Global<v8::Function>& PerIsolateData::AdminClientConstructor() {
  return admin_client_constructor;
}

Nan::Global<v8::Function>& PerIsolateData::KafkaConsumerConstructor() {
  return kafka_consumer_constructor;
}

Nan::Global<v8::Function>& PerIsolateData::KafkaProducerConstructor() {
  return kafka_producer_constructor;
}

Nan::Global<v8::Function>& PerIsolateData::TopicConstructor() {
  return topic_constructor;
}

}  // namespace dd
