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
#include <list>

#include "src/config.h"

using RdKafka::Conf;
using Nan::MaybeLocal;
using Nan::Maybe;
using v8::Local;
using v8::String;
using v8::Object;
using std::cout;
using std::endl;

namespace NodeKafka {

namespace Config {

void DumpConfig(std::list<std::string> *dump) {
  for (std::list<std::string>::iterator it = dump->begin();
         it != dump->end(); ) {
    std::cout << *it << " = ";
    it++;
    std::cout << *it << std::endl;
    it++;
  }
  std::cout << std::endl;
}

template<typename T>
void LoadParameter(v8::Local<v8::Object> object, std::string field, const T &to) {  // NOLINT
  to = GetParameter<T>(object, field, to);
}

std::string GetValue(RdKafka::Conf* rdconf, const std::string name) {
  std::string value;
  if (rdconf->get(name, value) == RdKafka::Conf::CONF_UNKNOWN) {
    return std::string();
  }

  return value;
}

RdKafka::Conf* Create(RdKafka::Conf::ConfType type, v8::Local<v8::Object> object, std::string &errstr) {  // NOLINT
  RdKafka::Conf* rdconf = RdKafka::Conf::create(type);

  v8::Local<v8::Array> property_names = object->GetOwnPropertyNames();

  for (unsigned int i = 0; i < property_names->Length(); ++i) {
    std::string string_value;
    std::string string_key;

    v8::Local<v8::Value> key = property_names->Get(i);
    v8::Local<v8::Value> value = object->Get(key);

    if (key->IsString()) {
      Nan::Utf8String utf8_key(key);
      string_key = std::string(*utf8_key);
    } else {
      continue;
    }

    if (!value->IsFunction()) {
      Nan::Utf8String utf8_value(value.As<v8::String>());
      string_value = std::string(*utf8_value);
      if (rdconf->set(string_key, string_value, errstr)
        != Conf::CONF_OK) {
          delete rdconf;
          return NULL;
      }
    }
  }

  return rdconf;
}

}  // namespace Config

}  // namespace NodeKafka
