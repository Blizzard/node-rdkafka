/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var librdkafka = require('../librdkafka');

module.exports = Topic;

var topicKey = 'RdKafka::Topic::';
var topicKeyLength = topicKey.length;

// Take all of the topic special codes from librdkafka and add them
// to the object
// You can find this list in the C++ code at
// https://github.com/edenhill/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L1250
for (var key in librdkafka.topic) {
  // Skip it if it doesn't start with ErrorCode
  if (key.indexOf('RdKafka::Topic::') !== 0) {
    continue;
  }

  // Replace/add it if there are any discrepancies
  var newKey = key.substring(topicKeyLength);
  Topic[newKey] = librdkafka.topic[key];
}

/**
 * Create a topic. Just returns the string you gave it right now.
 *
 * Looks like a class, but all it does is return the topic name.
 * This is so that one day if there are interface changes that allow
 * different use of topic parameters, we can just add to this constructor and
 * have it return something richer
 */
function Topic(topicName) {
  return topicName;
}
