/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_CONFIG_H_
#define SRC_CONFIG_H_

#include <nan.h>
#include <iostream>
#include <vector>

#include "deps/librdkafka/src-cpp/rdkafkacpp.h"
#include "src/common.h"

namespace NodeKafka {
namespace Config {

template<typename T> void LoadParameter(v8::Local<v8::Object>, std::string, T &);  // NOLINT
std::string GetValue(RdKafka::Conf*, const std::string);
RdKafka::Conf* Create(RdKafka::Conf::ConfType, v8::Local<v8::Object>, std::string &);  // NOLINT

}  // namespace Config

}  // namespace NodeKafka

#endif  // SRC_CONFIG_H_
