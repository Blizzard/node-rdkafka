/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var KafkaConsumer = require('./kafka-consumer');
var Producer = require('./producer');
var TopicReadable = require('./topic-readable');
var error = require('./error');
var util = require('util');

module.exports = {
  Consumer: util.deprecate(KafkaConsumer, 'Use KafkaConsumer instead. This may be changed in a later version'),
  Producer: Producer,
  KafkaConsumer: KafkaConsumer,
  TopicReadable: TopicReadable,
  CODES: {
    REBALANCE: {
      PARTITION_ASSIGNMENT: 500,
      PARTITION_UNASSIGNMENT: 501
    },
    ERRORS: error.codes
  }
};
