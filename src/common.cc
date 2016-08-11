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

#include "src/common.h"

namespace NodeKafka {

void Log(std::string str) {
  std::cerr << "% " << str.c_str() << std::endl;
}

template<typename T>
T GetParameter(v8::Local<v8::Object> object, std::string field_name, T def) {
  v8::Local<v8::String> field = Nan::New(field_name.c_str()).ToLocalChecked();
  if (Nan::Has(object, field).FromMaybe(false)) {
    Nan::Maybe<T> maybeT = Nan::To<T>(Nan::Get(object, field).ToLocalChecked());
    if (maybeT.IsNothing()) {
      return def;
    } else {
      return maybeT.FromJust();
    }
  }
  return def;
}

template<>
int64_t GetParameter<int64_t>(v8::Local<v8::Object> object,
  std::string field_name, int64_t def) {
  v8::Local<v8::String> field = Nan::New(field_name.c_str()).ToLocalChecked();
  if (Nan::Has(object, field).FromMaybe(false)) {
    Nan::Maybe<int64_t> maybeInt = Nan::To<int64_t>(
      Nan::Get(object, field).ToLocalChecked());
    if (maybeInt.IsNothing()) {
      return def;
    } else {
      return maybeInt.FromJust();
    }
  }
  return def;
}

template<>
int GetParameter<int>(v8::Local<v8::Object> object,
  std::string field_name, int def) {
  v8::Local<v8::String> field = Nan::New(field_name.c_str()).ToLocalChecked();
  if (Nan::Has(object, field).FromMaybe(false)) {
    Nan::Maybe<int64_t> maybeInt = Nan::To<int64_t>(
      Nan::Get(object, field).ToLocalChecked());
    if (!maybeInt.IsNothing()) {
      return static_cast<int>(maybeInt.FromJust());
    }
  }
  return def;
}

template<>
std::string GetParameter<std::string>(v8::Local<v8::Object> object,
                                      std::string field_name,
                                      std::string def) {
  v8::Local<v8::String> field = Nan::New(field_name.c_str()).ToLocalChecked();
  if (Nan::Has(object, field).FromMaybe(false)) {
    Nan::MaybeLocal<v8::String> parameter =
      Nan::To<v8::String>(Nan::Get(object, field).ToLocalChecked());

    if (!parameter.IsEmpty()) {
      Nan::Utf8String parameterValue(parameter.ToLocalChecked());
      std::string parameterString(*parameterValue);

      return parameterString;
    }
  }
  return def;
}

template<>
std::vector<std::string> GetParameter<std::vector<std::string> >(
  v8::Local<v8::Object> object, std::string field_name,
  std::vector<std::string> def) {
  v8::Local<v8::String> field = Nan::New(field_name.c_str()).ToLocalChecked();

  if (Nan::Has(object, field).FromMaybe(false)) {
    v8::Local<v8::Value> maybeArray = Nan::Get(object, field).ToLocalChecked();
    if (maybeArray->IsArray()) {
      v8::Local<v8::Array> parameter = maybeArray.As<v8::Array>();
      return v8ArrayToStringVector(parameter);
    }
  }
  return def;
}

std::vector<std::string> v8ArrayToStringVector(v8::Local<v8::Array> parameter) {
  std::vector<std::string> newItem;

  if (parameter->Length() >= 1) {
    for (unsigned int i = 0; i < parameter->Length(); i++) {
      Nan::MaybeLocal<v8::String> p = Nan::To<v8::String>(parameter->Get(i));
      if (p.IsEmpty()) {
        continue;
      }
      Nan::Utf8String pVal(p.ToLocalChecked());
      std::string pString(*pVal);
      newItem.push_back(pString);
    }
  }
  return newItem;
}

}  // namespace NodeKafka
